/**
 * Webhook helpers: signature verification and idempotency.
 *
 * Two big behavioural changes versus the original code:
 *
 *   1. Signature verification is FAIL-CLOSED. The previous webhooks
 *      treated `if (secret && signature)` as the gate — meaning a missing
 *      secret silently disabled verification. Here, when the env var
 *      LATE_WEBHOOK_SECRET / STRIPE_WEBHOOK_SECRET is set the webhook
 *      MUST present a valid signature; if the secret is unset the
 *      verifier returns "no_secret" so the caller can decide (we
 *      currently log a warning and accept, mirroring the legacy default,
 *      but the call site can tighten this trivially).
 *
 *   2. Idempotency via the new `webhook_events` table. claim() inserts
 *      a row keyed by (provider, event_id) and returns false if the row
 *      already exists, so duplicate deliveries become no-ops.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

export type SignatureCheck =
  | { kind: 'verified' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'no_secret' };

/**
 * Verify an HMAC-SHA256 hex signature (used by Late.is webhooks).
 * Returns 'no_secret' when no shared secret is configured, otherwise
 * 'verified' or 'invalid'.
 */
export async function verifyHmacSha256Hex(
  body: string,
  signatureHex: string | null,
  secret: string | undefined,
): Promise<SignatureCheck> {
  if (!secret) return { kind: 'no_secret' };
  if (!signatureHex) return { kind: 'invalid', reason: 'Missing signature header' };

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expectedBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  const expectedHex = Array.from(new Uint8Array(expectedBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (constantTimeEqual(expectedHex, signatureHex.toLowerCase())) {
    return { kind: 'verified' };
  }
  return { kind: 'invalid', reason: 'Signature mismatch' };
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface ClaimWebhookEventArgs {
  supabase: SupabaseClient;
  provider: 'stripe' | 'late' | string;
  eventId: string;
  eventType?: string;
  payloadHash?: string;
}

/**
 * Insert a row into `webhook_events` to mark this event as processed.
 * Returns true if inserted (first delivery), false if duplicate.
 *
 * The unique index on (provider, event_id) is what makes this race-safe.
 */
export async function claimWebhookEvent(args: ClaimWebhookEventArgs): Promise<{ claimed: boolean; error?: string }> {
  const { supabase, provider, eventId, eventType, payloadHash } = args;
  const { error } = await supabase
    .from('webhook_events')
    .insert({ provider, event_id: eventId, event_type: eventType, payload_hash: payloadHash });
  if (!error) return { claimed: true };
  // Postgres unique-violation error code.
  // Supabase surfaces this with code: '23505'.
  const code = (error as unknown as { code?: string }).code;
  if (code === '23505') return { claimed: false };
  return { claimed: false, error: error.message };
}
