/**
 * Create a Stripe Checkout session for a contract (one-time or recurring),
 * including GST line items and a custom-first-payment discount/charge
 * when initial_payment_amount differs from payment_amount.
 *
 * Contract preserved:
 *   Request:  { contract_id, share_id }
 *   Response: { checkoutUrl, sessionId } | { error, already_paid? }
 */

import Stripe from 'https://esm.sh/stripe@18.5.0';
import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { badRequest, notFound, conflict } from '../_shared/errors.ts';
import { ensureNonEmptyString, ensureUuid } from '../_shared/validation.ts';
import { requireEnv, optionalEnv } from '../_shared/env.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';

const STRIPE_API_VERSION = '2025-08-27.basil';

interface RequestBody { contract_id: unknown; share_id: unknown }

const truncateName = (name: string, maxLength = 40): string =>
  name.length <= maxLength ? name : `${name.substring(0, maxLength - 3)}...`;

Deno.serve(withErrorHandling({ fn: 'create-contract-checkout' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const contract_id = ensureUuid('contract_id', body.contract_id);
  const share_id = ensureNonEmptyString('share_id', body.share_id, 200);

  const supabase = getSupabaseAdmin();
  const { data: contract, error } = await supabase
    .from('contracts')
    .select(`id, title, payment_amount, payment_currency, payment_status, payment_type, billing_interval, initial_payment_amount, include_gst, gst_percentage, client_id,
      clients ( id, business_name, email, contact_name )`)
    .eq('id', contract_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!contract) throw notFound('Contract not found');
  if (!contract.payment_amount || contract.payment_amount <= 0) throw badRequest('No payment required for this contract');
  if (contract.payment_status === 'paid') throw conflict('Payment already completed');

  const stripe = new Stripe(requireEnv('STRIPE_SECRET_KEY'), { apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion });
  const origin = optionalEnv('VITE_PUBLIC_SITE_URL') ?? req.headers.get('origin') ?? 'http://localhost:8080';

  const client = (Array.isArray(contract.clients) ? contract.clients[0] : contract.clients) as { id: string; business_name: string; email: string; contact_name: string } | null;
  const currency = contract.payment_currency ?? 'aud';
  const includeGst = contract.include_gst === true;
  const gstPercentage = contract.gst_percentage ?? 10;
  const gstAmount = includeGst ? contract.payment_amount * (gstPercentage / 100) : 0;

  // Customer reuse / create.
  let customerId: string | undefined;
  if (client?.email) {
    const customers = await stripe.customers.list({ email: client.email, limit: 1 });
    if (customers.data.length > 0) customerId = customers.data[0].id;
    else {
      const created = await stripe.customers.create({
        email: client.email,
        name: client.business_name ?? client.contact_name ?? undefined,
        metadata: { client_id: contract.client_id },
      });
      customerId = created.id;
    }
  }

  const isRecurring = contract.payment_type === 'recurring';
  let session: Stripe.Checkout.Session;
  let discountCouponId: string | undefined;

  if (isRecurring) {
    const billingInterval = contract.billing_interval ?? 'monthly';
    const intervalMap: Record<string, 'day' | 'week' | 'month' | 'year'> = { weekly: 'week', monthly: 'month', yearly: 'year' };
    const recurringInterval = intervalMap[billingInterval] ?? 'month';

    const recurringPrice = await stripe.prices.create({
      currency,
      unit_amount: Math.round(contract.payment_amount * 100),
      recurring: { interval: recurringInterval },
      product_data: {
        name: truncateName(contract.title ?? 'Contract Payment'),
        metadata: { contract_id: contract.id, client_id: contract.client_id },
      },
    });

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: { contract_id: contract.id, client_id: contract.client_id, share_id },
    };

    const hasCustomFirstPayment = contract.initial_payment_amount !== null && contract.initial_payment_amount !== contract.payment_amount;
    if (hasCustomFirstPayment && contract.initial_payment_amount !== null) {
      const difference = contract.initial_payment_amount - contract.payment_amount;
      const gstDifference = includeGst
        ? contract.initial_payment_amount * (gstPercentage / 100) - contract.payment_amount * (gstPercentage / 100)
        : 0;
      const totalDifference = difference + gstDifference;

      if (totalDifference < 0) {
        const coupon = await stripe.coupons.create({
          amount_off: Math.round(Math.abs(totalDifference) * 100),
          currency,
          duration: 'once',
          name: truncateName('First month discount'),
        });
        discountCouponId = coupon.id;
      } else if (totalDifference > 0) {
        subscriptionData.add_invoice_items = [{
          price_data: {
            currency,
            unit_amount: Math.round(totalDifference * 100),
            product_data: { name: 'First month additional charge' },
          },
          quantity: 1,
        }];
      }
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: recurringPrice.id, quantity: 1 }];
    if (includeGst && gstAmount > 0) {
      const gstPrice = await stripe.prices.create({
        currency,
        unit_amount: Math.round(gstAmount * 100),
        recurring: { interval: recurringInterval },
        product_data: { name: `GST (${gstPercentage}%)`, metadata: { contract_id: contract.id, is_gst: 'true' } },
      });
      lineItems.push({ price: gstPrice.id, quantity: 1 });
    }

    session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : client?.email,
      line_items: lineItems,
      mode: 'subscription',
      subscription_data: subscriptionData,
      ...(discountCouponId && { discounts: [{ coupon: discountCouponId }] }),
      metadata: { contract_id: contract.id, client_id: contract.client_id, share_id },
      success_url: `${origin}/contract/${share_id}?payment=success`,
      cancel_url: `${origin}/contract/${share_id}?payment=cancelled`,
    });
  } else {
    const paymentLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{
      price_data: {
        currency,
        product_data: {
          name: truncateName(contract.title ?? 'Contract Payment'),
          description: `Contract payment for ${client?.business_name ?? 'Client'}`,
        },
        unit_amount: Math.round(contract.payment_amount * 100),
      },
      quantity: 1,
    }];
    if (includeGst && gstAmount > 0) {
      paymentLineItems.push({
        price_data: {
          currency,
          product_data: { name: `GST (${gstPercentage}%)` },
          unit_amount: Math.round(gstAmount * 100),
        },
        quantity: 1,
      });
    }
    session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : client?.email,
      line_items: paymentLineItems,
      mode: 'payment',
      metadata: { contract_id: contract.id, client_id: contract.client_id, share_id },
      success_url: `${origin}/contract/${share_id}?payment=success`,
      cancel_url: `${origin}/contract/${share_id}?payment=cancelled`,
    });
  }

  await supabase
    .from('contracts')
    .update({
      stripe_checkout_session_id: session.id,
      stripe_customer_id: customerId ?? null,
      payment_status: 'processing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', contract_id);

  log.info('checkout_session_created', { sessionId: session.id, contractId: contract_id, mode: session.mode });
  return jsonResponse({ checkoutUrl: session.url, sessionId: session.id });
}));
