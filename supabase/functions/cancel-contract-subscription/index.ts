/**
 * Cancel a contract's Stripe subscription (immediately or at period end).
 *
 * Contract preserved:
 *   Request:  { contract_id, cancel_immediately? }
 *   Response: { success, cancelled_immediately, cancel_at }
 */

import Stripe from 'https://esm.sh/stripe@18.5.0';
import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { badRequest, notFound } from '../_shared/errors.ts';
import { ensureBoolean, ensureUuid } from '../_shared/validation.ts';
import { requireEnv } from '../_shared/env.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';

interface RequestBody { contract_id: unknown; cancel_immediately?: unknown }

const STRIPE_API_VERSION = '2025-08-27.basil';

Deno.serve(withErrorHandling({ fn: 'cancel-contract-subscription' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const contract_id = ensureUuid('contract_id', body.contract_id);
  const cancel_immediately = body.cancel_immediately === undefined ? false : ensureBoolean('cancel_immediately', body.cancel_immediately);

  const supabase = getSupabaseAdmin();
  const { data: contract, error } = await supabase
    .from('contracts')
    .select('id, stripe_subscription_id, payment_type')
    .eq('id', contract_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!contract) throw notFound('Contract not found');
  if (!contract.stripe_subscription_id) throw badRequest('No active subscription for this contract');

  const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'), { apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion });

  let subscription: Stripe.Subscription;
  if (cancel_immediately) {
    subscription = await stripe.subscriptions.cancel(contract.stripe_subscription_id);
    log.info('subscription_cancelled_immediately', { sub: contract.stripe_subscription_id });
  } else {
    subscription = await stripe.subscriptions.update(contract.stripe_subscription_id, { cancel_at_period_end: true });
    log.info('subscription_cancel_at_period_end', { sub: contract.stripe_subscription_id, periodEnd: subscription.current_period_end });
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (cancel_immediately) {
    updateData.payment_status = 'cancelled';
    updateData.stripe_subscription_id = null;
  } else {
    updateData.payment_status = 'cancelling';
  }

  const { error: updateError } = await supabase.from('contracts').update(updateData).eq('id', contract_id);
  if (updateError) log.warn('contract_update_failed', { error: updateError.message });

  return jsonResponse({
    success: true,
    cancelled_immediately: cancel_immediately,
    cancel_at: cancel_immediately ? null : new Date(subscription.current_period_end * 1000).toISOString(),
  });
}));
