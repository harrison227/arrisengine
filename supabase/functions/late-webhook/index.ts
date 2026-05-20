/**
 * Inbound webhook from Late.is.
 *
 * Two security upgrades vs the original:
 *   1. Signature verification is fail-closed: if LATE_WEBHOOK_SECRET is set,
 *      a missing/invalid x-late-signature is rejected with 401.
 *   2. Idempotency via the new `webhook_events` table — duplicate
 *      deliveries (same event id) are acknowledged but not re-applied.
 *
 * Contract preserved:
 *   POST <body>           — JSON payload from Late
 *   Response: { received: true, event } | { error }
 */

import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';
import { createLogger, newRequestId } from '../_shared/logger.ts';
import { optionalEnv } from '../_shared/env.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { verifyHmacSha256Hex, claimWebhookEvent } from '../_shared/webhook.ts';

const corsHeaders = buildCorsHeaders({ extraAllowHeaders: ['x-late-signature'] });

interface LatePayload {
  event?: string;
  data?: {
    postId?: string;
    eventId?: string;
    error?: string;
    updatedAt?: string;
    content?: string;
    scheduledFor?: string;
  };
  id?: string;
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req, corsHeaders);
  if (pre) return pre;

  const requestId = req.headers.get('x-request-id') ?? newRequestId();
  const log = createLogger('late-webhook', { requestId });

  try {
    const supabase = getSupabaseAdmin();
    const body = await req.text();

    // 1. Verify signature.
    const verification = await verifyHmacSha256Hex(
      body,
      req.headers.get('x-late-signature'),
      optionalEnv('LATE_WEBHOOK_SECRET'),
    );
    if (verification.kind === 'invalid') {
      log.warn('signature_invalid', { reason: verification.reason });
      return new Response(JSON.stringify({ error: 'Invalid signature', requestId }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (verification.kind === 'no_secret') {
      log.warn('webhook_secret_missing_accepting_unverified');
    }

    let payload: LatePayload;
    try { payload = JSON.parse(body) as LatePayload; }
    catch { return jsonError(400, 'Invalid JSON', requestId); }

    const event = payload.event ?? '';
    const data = payload.data ?? {};

    // 2. Idempotency.
    const eventId = data.eventId ?? payload.id ?? `${event}:${data.postId ?? 'unknown'}:${Date.now()}`;
    const claim = await claimWebhookEvent({ supabase, provider: 'late', eventId, eventType: event });
    if (!claim.claimed && !claim.error) {
      log.info('duplicate_event_skipped', { eventId, event });
      return new Response(JSON.stringify({ received: true, deduped: true, requestId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data.postId) {
      log.info('no_post_id_in_payload', { event });
      return new Response(JSON.stringify({ received: true, requestId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [{ data: pieces }, { data: textPosts }] = await Promise.all([
      supabase.from('content_pieces').select('id, status, updated_at').eq('late_post_id', data.postId),
      supabase.from('text_posts').select('id, status').eq('late_post_id', data.postId),
    ]);
    const piece = pieces?.[0];
    const textPost = textPosts?.[0];
    if (!piece && !textPost) {
      log.info('no_match', { postId: data.postId });
      return new Response(JSON.stringify({ received: true, message: 'Post not found in system', requestId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    switch (event) {
      case 'post.published':
        if (piece) await supabase.from('content_pieces').update({
          status: 'live', late_sync_status: 'synced', late_last_synced_at: new Date().toISOString(), late_error_message: null,
        }).eq('id', piece.id);
        if (textPost) await supabase.from('text_posts').update({
          status: 'published', published_at: new Date().toISOString(),
        }).eq('id', textPost.id);
        break;

      case 'post.scheduled':
        if (piece) await supabase.from('content_pieces').update({
          late_sync_status: 'synced', late_last_synced_at: new Date().toISOString(), late_error_message: null,
        }).eq('id', piece.id);
        break;

      case 'post.failed':
        if (piece) await supabase.from('content_pieces').update({
          late_sync_status: 'error', late_error_message: data.error ?? 'Post failed to publish',
        }).eq('id', piece.id);
        if (textPost) await supabase.from('text_posts').update({ status: 'draft' }).eq('id', textPost.id);
        break;

      case 'post.updated':
        if (piece && data.updatedAt && new Date(data.updatedAt) > new Date(piece.updated_at)) {
          const updates: Record<string, unknown> = { late_last_synced_at: new Date().toISOString() };
          if (data.content) {
            const hashtagMatch = data.content.match(/(#\w+\s*)+$/);
            if (hashtagMatch) {
              const captionEnd = data.content.indexOf(hashtagMatch[0]);
              updates.caption = data.content.substring(0, captionEnd).trim();
              updates.hashtags = data.content.match(/#\w+/g) ?? [];
            } else {
              updates.caption = data.content;
            }
          }
          if (data.scheduledFor) updates.scheduled_date = data.scheduledFor;
          await supabase.from('content_pieces').update(updates).eq('id', piece.id);
        }
        break;

      case 'post.deleted':
        if (piece) await supabase.from('content_pieces').update({
          late_post_id: null, late_sync_status: 'not_synced', late_error_message: null,
        }).eq('id', piece.id);
        if (textPost) await supabase.from('text_posts').update({ late_post_id: null }).eq('id', textPost.id);
        break;

      default:
        log.info('unhandled_event', { event });
    }

    return new Response(JSON.stringify({ received: true, event, requestId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    log.error('webhook_error', err);
    return jsonError(500, err instanceof Error ? err.message : 'Unknown error', requestId);
  }
});

function jsonError(status: number, message: string, requestId: string): Response {
  return new Response(JSON.stringify({ error: message, requestId }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
