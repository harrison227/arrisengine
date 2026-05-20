/**
 * Stripe webhook for contract checkout / subscription events.
 *
 * Hardening vs the original:
 *   - Signature verification is fail-closed when STRIPE_WEBHOOK_SECRET
 *     is configured. The legacy code accepted unsigned events when the
 *     signature header was missing — that's now a 400.
 *   - Idempotency via webhook_events: duplicate event ids are
 *     acknowledged but not re-applied.
 *   - Stripe API version pinned via STRIPE_API_VERSION constant.
 */

import Stripe from 'https://esm.sh/stripe@18.5.0';
import { buildCorsHeaders, handlePreflight } from '../_shared/cors.ts';
import { createLogger, newRequestId } from '../_shared/logger.ts';
import { requireEnv, optionalEnv } from '../_shared/env.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { claimWebhookEvent } from '../_shared/webhook.ts';

const STRIPE_API_VERSION = '2025-08-27.basil';
const corsHeaders = buildCorsHeaders({ extraAllowHeaders: ['stripe-signature'] });

Deno.serve(async (req) => {
  const pre = handlePreflight(req, corsHeaders);
  if (pre) return pre;

  const requestId = req.headers.get('x-request-id') ?? newRequestId();
  const log = createLogger('stripe-contract-webhook', { requestId });

  try {
    const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'), { apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion });
    const webhookSecret = optionalEnv('STRIPE_WEBHOOK_SECRET');
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    let event: Stripe.Event;
    if (webhookSecret) {
      if (!signature) {
        log.warn('signature_missing');
        return jsonError(400, 'Missing Stripe signature header', requestId);
      }
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err) {
        log.warn('signature_invalid', { reason: err instanceof Error ? err.message : String(err) });
        return jsonError(400, 'Webhook signature verification failed', requestId);
      }
    } else {
      log.warn('webhook_secret_unset_accepting_unverified');
      try { event = JSON.parse(body) as Stripe.Event; }
      catch { return jsonError(400, 'Invalid JSON body', requestId); }
    }

    log.info('event_received', { type: event.type, id: event.id });

    const supabase = getSupabaseAdmin();
    const claim = await claimWebhookEvent({ supabase, provider: 'stripe', eventId: event.id, eventType: event.type });
    if (!claim.claimed && !claim.error) {
      log.info('duplicate_event_skipped', { eventId: event.id });
      return jsonResponse({ received: true, deduped: true, requestId });
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event, supabase, log);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event, supabase, log);
        break;
      case 'invoice.payment_failed':
        await handleInvoiceFailed(event, supabase);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event, supabase);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event, supabase);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event, supabase);
        break;
      default:
        log.info('unhandled_event_type', { type: event.type });
    }

    return jsonResponse({ received: true, requestId });
  } catch (err) {
    log.error('webhook_error', err);
    return jsonError(500, err instanceof Error ? err.message : 'Unknown error', requestId);
  }
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(status: number, message: string, requestId: string): Response {
  return new Response(JSON.stringify({ error: message, requestId }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;
import type { Logger } from '../_shared/logger.ts';

async function handleCheckoutCompleted(event: Stripe.Event, supabase: SupabaseAdmin, log: Logger) {
  const session = event.data.object as Stripe.Checkout.Session;
  const contractId = session.metadata?.contract_id;
  if (!contractId) {
    log.warn('missing_contract_id_in_metadata');
    return;
  }

  const baseUpdate: Record<string, unknown> = {
    payment_status: 'paid',
    paid_at: new Date().toISOString(),
    status: 'signed',
    updated_at: new Date().toISOString(),
  };
  if (session.mode === 'subscription') {
    baseUpdate.stripe_subscription_id = session.subscription as string;
    baseUpdate.stripe_customer_id = session.customer as string;
  } else {
    baseUpdate.stripe_payment_intent_id = session.payment_intent as string;
  }

  const { error } = await supabase.from('contracts').update(baseUpdate).eq('id', contractId);
  if (error) {
    log.error('contract_update_failed', error, { contractId });
    return;
  }

  await supabase.from('contract_share_links').update({ expires_at: null }).eq('contract_id', contractId).eq('is_active', true);
  log.info('contract_payment_processed', { contractId, mode: session.mode });
}

async function handleInvoicePaid(event: Stripe.Event, supabase: SupabaseAdmin, log: Logger) {
  const invoice = event.data.object as Stripe.Invoice;
  if (invoice.billing_reason === 'subscription_cycle' && invoice.subscription) {
    const { error } = await supabase
      .from('contracts')
      .update({ paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', invoice.subscription);
    if (error) log.warn('recurring_payment_update_failed', { error: error.message });
  }
}

async function handleInvoiceFailed(event: Stripe.Event, supabase: SupabaseAdmin) {
  const invoice = event.data.object as Stripe.Invoice;
  if (!invoice.subscription) return;
  await supabase
    .from('contracts')
    .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', invoice.subscription);
}

async function handleSubscriptionDeleted(event: Stripe.Event, supabase: SupabaseAdmin) {
  const sub = event.data.object as Stripe.Subscription;
  await supabase
    .from('contracts')
    .update({ payment_status: 'cancelled', stripe_subscription_id: null, updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', sub.id);
}

async function handleSubscriptionUpdated(event: Stripe.Event, supabase: SupabaseAdmin) {
  const sub = event.data.object as Stripe.Subscription;
  let paymentStatus = 'paid';
  if (sub.status === 'past_due') paymentStatus = 'past_due';
  else if (sub.status === 'canceled') paymentStatus = 'cancelled';
  else if (sub.status === 'unpaid') paymentStatus = 'failed';
  await supabase
    .from('contracts')
    .update({ payment_status: paymentStatus, updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', sub.id);
}

async function handlePaymentIntentFailed(event: Stripe.Event, supabase: SupabaseAdmin) {
  const pi = event.data.object as Stripe.PaymentIntent;
  await supabase
    .from('contracts')
    .update({ payment_status: 'failed', updated_at: new Date().toISOString() })
    .eq('stripe_payment_intent_id', pi.id);
}
