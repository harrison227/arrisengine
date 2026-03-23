import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("stripe-contract-webhook: Received webhook");

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeSecretKey) {
      console.error("Missing Stripe secret key");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil",
    });

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        console.log("Webhook signature verified");
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return new Response(
          JSON.stringify({ error: "Webhook signature verification failed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    } else {
      // Parse the event without verification (for development)
      event = JSON.parse(body);
      console.log("Warning: Webhook signature not verified (no secret configured)");
    }

    console.log("Webhook event type:", event.type);

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle checkout.session.completed event (works for both payment and subscription)
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      console.log("Checkout session completed:", {
        sessionId: session.id,
        mode: session.mode,
        paymentStatus: session.payment_status,
        metadata: session.metadata,
        subscriptionId: session.subscription,
      });

      const contractId = session.metadata?.contract_id;

      if (!contractId) {
        console.error("No contract_id in session metadata");
        return new Response(
          JSON.stringify({ error: "Missing contract_id in metadata" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Handle based on payment mode
      if (session.mode === 'subscription') {
        // SUBSCRIPTION MODE
        console.log("Processing subscription payment for contract:", contractId);
        
        const { error: updateError } = await supabase
          .from("contracts")
          .update({
            payment_status: "paid",
            stripe_subscription_id: session.subscription as string,
            stripe_customer_id: session.customer as string,
            paid_at: new Date().toISOString(),
            status: "signed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", contractId);

        if (updateError) {
          console.error("Error updating contract:", updateError);
          return new Response(
            JSON.stringify({ error: "Failed to update contract" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
          );
        }
      } else {
        // ONE-TIME PAYMENT MODE
        console.log("Processing one-time payment for contract:", contractId);
        
        const { error: updateError } = await supabase
          .from("contracts")
          .update({
            payment_status: "paid",
            stripe_payment_intent_id: session.payment_intent as string,
            paid_at: new Date().toISOString(),
            status: "signed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", contractId);

        if (updateError) {
          console.error("Error updating contract:", updateError);
          return new Response(
            JSON.stringify({ error: "Failed to update contract" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
          );
        }
      }

      // Make share link permanent by removing expiration
      console.log("Making share link permanent for contract:", contractId);
      const { error: linkUpdateError } = await supabase
        .from("contract_share_links")
        .update({ expires_at: null })
        .eq("contract_id", contractId)
        .eq("is_active", true);

      if (linkUpdateError) {
        console.error("Error updating share link:", linkUpdateError);
        // Don't fail - payment was processed successfully
      }

      console.log("Contract payment processed successfully:", contractId);
    }

    // Handle invoice.paid event for recurring payments
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      
      console.log("Invoice paid:", {
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription,
        amountPaid: invoice.amount_paid,
        billingReason: invoice.billing_reason,
      });

      // Only log for renewal invoices (subscription_cycle), not initial ones
      if (invoice.billing_reason === 'subscription_cycle' && invoice.subscription) {
        console.log("Recurring payment received for subscription:", invoice.subscription);
        
        // Update paid_at to track the latest payment
        const { error: updateError } = await supabase
          .from("contracts")
          .update({
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", invoice.subscription);

        if (updateError) {
          console.error("Error updating contract for recurring payment:", updateError);
        }
      }
    }

    // Handle invoice.payment_failed event
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      
      console.log("Invoice payment failed:", {
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription,
      });

      if (invoice.subscription) {
        const { error: updateError } = await supabase
          .from("contracts")
          .update({
            payment_status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", invoice.subscription);

        if (updateError) {
          console.error("Error updating contract payment status:", updateError);
        }
      }
    }

    // Handle customer.subscription.deleted event
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      
      console.log("Subscription cancelled:", {
        subscriptionId: subscription.id,
        status: subscription.status,
      });

      const { error: updateError } = await supabase
        .from("contracts")
        .update({
          payment_status: "cancelled",
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id);

      if (updateError) {
        console.error("Error updating contract for cancelled subscription:", updateError);
      }
    }

    // Handle customer.subscription.updated event (for status changes)
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      
      console.log("Subscription updated:", {
        subscriptionId: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });

      // Map Stripe subscription status to our payment status
      let paymentStatus = "paid";
      if (subscription.status === "past_due") {
        paymentStatus = "past_due";
      } else if (subscription.status === "canceled") {
        paymentStatus = "cancelled";
      } else if (subscription.status === "unpaid") {
        paymentStatus = "failed";
      }

      const { error: updateError } = await supabase
        .from("contracts")
        .update({
          payment_status: paymentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id);

      if (updateError) {
        console.error("Error updating contract subscription status:", updateError);
      }
    }

    // Handle payment_intent.payment_failed event (for one-time payments)
    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      console.log("Payment intent failed:", {
        paymentIntentId: paymentIntent.id,
        lastPaymentError: paymentIntent.last_payment_error?.message,
      });

      // Try to find the contract by payment intent ID and mark as failed
      const { error: updateError } = await supabase
        .from("contracts")
        .update({
          payment_status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_payment_intent_id", paymentIntent.id);

      if (updateError) {
        console.error("Error updating contract payment status:", updateError);
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
