import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to truncate names for Stripe's 40-character limit
const truncateName = (name: string, maxLength: number = 40): string => {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 3) + '...';
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("create-contract-checkout: Starting checkout creation");

  try {
    const { contract_id, share_id } = await req.json();

    if (!contract_id || !share_id) {
      console.error("Missing required fields:", { contract_id, share_id });
      return new Response(
        JSON.stringify({ error: "Missing contract_id or share_id" }),
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

    // Fetch contract with client info
    console.log("Fetching contract:", contract_id);
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select(`
        id,
        title,
        payment_amount,
        payment_currency,
        payment_status,
        payment_type,
        billing_interval,
        initial_payment_amount,
        include_gst,
        gst_percentage,
        client_id,
        clients (
          id,
          business_name,
          email,
          contact_name
        )
      `)
      .eq("id", contract_id)
      .maybeSingle();

    if (contractError || !contract) {
      console.error("Contract fetch error:", contractError);
      return new Response(
        JSON.stringify({ error: "Contract not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Validate payment amount
    if (!contract.payment_amount || contract.payment_amount <= 0) {
      console.error("No payment amount configured for contract");
      return new Response(
        JSON.stringify({ error: "No payment required for this contract" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Check if already paid
    if (contract.payment_status === "paid") {
      console.log("Contract already paid");
      return new Response(
        JSON.stringify({ error: "Payment already completed", already_paid: true }),
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

    // Get the origin for success/cancel URLs
    const origin = Deno.env.get("VITE_PUBLIC_SITE_URL") || req.headers.get("origin") || "http://localhost:8080";
    const client = contract.clients as unknown as { id: string; business_name: string; email: string; contact_name: string } | null;

    console.log("Creating Stripe checkout session for:", {
      contractTitle: contract.title,
      amount: contract.payment_amount,
      currency: contract.payment_currency,
      paymentType: contract.payment_type,
      billingInterval: contract.billing_interval,
      initialPaymentAmount: contract.initial_payment_amount,
      clientEmail: client?.email,
    });

    // Create or retrieve Stripe customer
    let customerId: string | undefined;
    if (client?.email) {
      const customers = await stripe.customers.list({ email: client.email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        console.log("Found existing Stripe customer:", customerId);
      } else {
        // Create new customer for recurring payments
        const newCustomer = await stripe.customers.create({
          email: client.email,
          name: client.business_name || client.contact_name,
          metadata: {
            client_id: contract.client_id,
          },
        });
        customerId = newCustomer.id;
        console.log("Created new Stripe customer:", customerId);
      }
    }

    const isRecurring = contract.payment_type === 'recurring';
    const currency = contract.payment_currency || "aud";
    
    // Calculate GST if enabled
    const includeGst = contract.include_gst === true;
    const gstPercentage = contract.gst_percentage || 10;
    const gstAmount = includeGst ? contract.payment_amount * (gstPercentage / 100) : 0;
    
    console.log("GST calculation:", { includeGst, gstPercentage, gstAmount });
    
    let session: Stripe.Checkout.Session;
    let discountCouponId: string | undefined;

    if (isRecurring) {
      // RECURRING PAYMENT - Create subscription checkout
      console.log("Creating recurring subscription checkout");
      
      const billingInterval = contract.billing_interval || 'monthly';
      const intervalMap: Record<string, 'day' | 'week' | 'month' | 'year'> = {
        weekly: 'week',
        monthly: 'month',
        yearly: 'year',
      };
      
      // Create a price for the recurring amount
      const recurringPrice = await stripe.prices.create({
        currency: currency,
        unit_amount: Math.round(contract.payment_amount * 100),
        recurring: {
          interval: intervalMap[billingInterval],
        },
        product_data: {
          name: truncateName(contract.title || 'Contract Payment'),
          metadata: {
            contract_id: contract.id,
            client_id: contract.client_id,
          },
        },
      });
      
      console.log("Created recurring price:", recurringPrice.id);

      // Check if there's a custom first payment
      const hasCustomFirstPayment = contract.initial_payment_amount !== null && 
        contract.initial_payment_amount !== contract.payment_amount;
      
      // Build subscription data with potential invoice item for different first payment
      const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
        metadata: {
          contract_id: contract.id,
          client_id: contract.client_id,
          share_id: share_id,
        },
      };

    // If custom first payment, add an invoice item to adjust the first invoice
    if (hasCustomFirstPayment && contract.initial_payment_amount !== null) {
      const difference = contract.initial_payment_amount - contract.payment_amount;
      console.log("Custom first payment - difference:", difference);
      
      // Calculate GST difference if GST is enabled
      let gstDifference = 0;
      if (includeGst) {
        const initialGst = contract.initial_payment_amount * (gstPercentage / 100);
        const recurringGst = contract.payment_amount * (gstPercentage / 100);
        gstDifference = initialGst - recurringGst;  // Will be negative for discount
        console.log("GST difference for first payment:", gstDifference, "(initial GST:", initialGst, ", recurring GST:", recurringGst, ")");
      }
      
      // Total discount includes both amount difference and GST difference
      const totalDifference = difference + gstDifference;
      console.log("Total first payment adjustment (includes GST):", totalDifference);
      
      // If it's a discount (initial < recurring), create a coupon
      if (totalDifference < 0) {
        const coupon = await stripe.coupons.create({
          amount_off: Math.round(Math.abs(totalDifference) * 100),
          currency: currency,
          duration: 'once',
          name: truncateName('First month discount'),
        });
        
        discountCouponId = coupon.id;
        console.log("Created discount coupon (includes GST adjustment):", coupon.id);
      } else if (totalDifference > 0) {
        // Add invoice item to charge more on first payment
        subscriptionData.add_invoice_items = [
          {
            price_data: {
              currency: currency,
              unit_amount: Math.round(totalDifference * 100),
              product_data: {
                name: `First month additional charge`,
              },
            },
            quantity: 1,
          },
        ];
      }
    }

      // Build line items for subscription
      const subscriptionLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
        {
          price: recurringPrice.id,
          quantity: 1,
        },
      ];

      // Add GST as separate recurring line item if enabled
      if (includeGst && gstAmount > 0) {
        const gstPrice = await stripe.prices.create({
          currency: currency,
          unit_amount: Math.round(gstAmount * 100),
          recurring: {
            interval: intervalMap[billingInterval],
          },
          product_data: {
            name: `GST (${gstPercentage}%)`,
            metadata: {
              contract_id: contract.id,
              is_gst: 'true',
            },
          },
        });
        subscriptionLineItems.push({
          price: gstPrice.id,
          quantity: 1,
        });
        console.log("Created GST recurring price:", gstPrice.id);
      }

      session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : client?.email,
        line_items: subscriptionLineItems,
        mode: "subscription",
        subscription_data: subscriptionData,
        ...(discountCouponId && { discounts: [{ coupon: discountCouponId }] }),
        metadata: {
          contract_id: contract.id,
          client_id: contract.client_id,
          share_id: share_id,
        },
        success_url: `${origin}/contract/${share_id}?payment=success`,
        cancel_url: `${origin}/contract/${share_id}?payment=cancelled`,
      });
    } else {
      // ONE-TIME PAYMENT - Original logic
      console.log("Creating one-time payment checkout");
      
      // Build line items for one-time payment
      const paymentLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: truncateName(contract.title || 'Contract Payment'),
              description: `Contract payment for ${client?.business_name || "Client"}`,
            },
            unit_amount: Math.round(contract.payment_amount * 100),
          },
          quantity: 1,
        },
      ];

      // Add GST as separate line item if enabled
      if (includeGst && gstAmount > 0) {
        paymentLineItems.push({
          price_data: {
            currency: currency,
            product_data: {
              name: `GST (${gstPercentage}%)`,
            },
            unit_amount: Math.round(gstAmount * 100),
          },
          quantity: 1,
        });
        console.log("Added GST line item:", Math.round(gstAmount * 100));
      }
      
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : client?.email,
        line_items: paymentLineItems,
        mode: "payment",
        metadata: {
          contract_id: contract.id,
          client_id: contract.client_id,
          share_id: share_id,
        },
        success_url: `${origin}/contract/${share_id}?payment=success`,
        cancel_url: `${origin}/contract/${share_id}?payment=cancelled`,
      });
    }

    console.log("Stripe checkout session created:", session.id);

    // Update contract with checkout session ID, customer ID, and set status to processing
    const { error: updateError } = await supabase
      .from("contracts")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_customer_id: customerId || null,
        payment_status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", contract_id);

    if (updateError) {
      console.error("Error updating contract with session ID:", updateError);
      // Don't fail - the checkout session was created successfully
    }

    return new Response(
      JSON.stringify({ 
        checkoutUrl: session.url,
        sessionId: session.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error creating checkout session:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
