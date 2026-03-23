import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("cancel-contract-subscription: Starting cancellation");

  try {
    const { contract_id, cancel_immediately = false } = await req.json();

    if (!contract_id) {
      console.error("Missing contract_id");
      return new Response(
        JSON.stringify({ error: "Missing contract_id" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Create Supabase client with service role for database access
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

    // Fetch contract
    console.log("Fetching contract:", contract_id);
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("id, stripe_subscription_id, payment_type")
      .eq("id", contract_id)
      .maybeSingle();

    if (contractError || !contract) {
      console.error("Contract fetch error:", contractError);
      return new Response(
        JSON.stringify({ error: "Contract not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    if (!contract.stripe_subscription_id) {
      console.error("No subscription found for contract");
      return new Response(
        JSON.stringify({ error: "No active subscription for this contract" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      console.error("Missing Stripe secret key");
      return new Response(
        JSON.stringify({ error: "Payment system not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil",
    });

    console.log("Cancelling subscription:", contract.stripe_subscription_id);

    let subscription: Stripe.Subscription;
    
    if (cancel_immediately) {
      // Cancel immediately
      subscription = await stripe.subscriptions.cancel(contract.stripe_subscription_id);
      console.log("Subscription cancelled immediately");
    } else {
      // Cancel at end of billing period
      subscription = await stripe.subscriptions.update(contract.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
      console.log("Subscription set to cancel at period end:", subscription.current_period_end);
    }

    // Update contract
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (cancel_immediately) {
      updateData.payment_status = "cancelled";
      updateData.stripe_subscription_id = null;
    } else {
      updateData.payment_status = "cancelling";
    }

    const { error: updateError } = await supabase
      .from("contracts")
      .update(updateData)
      .eq("id", contract_id);

    if (updateError) {
      console.error("Error updating contract:", updateError);
      // Don't fail - Stripe cancellation was successful
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        cancelled_immediately: cancel_immediately,
        cancel_at: cancel_immediately ? null : new Date(subscription.current_period_end * 1000).toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error cancelling subscription:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
