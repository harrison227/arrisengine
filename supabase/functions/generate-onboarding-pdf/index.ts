import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OnboardingRequest {
  clientId: string;
  platforms: {
    facebook: boolean;
    tiktok: boolean;
    google: boolean;
    youtube: boolean;
    instagram: boolean;
  };
  assetNeeds: {
    rawFootage: boolean;
    productShipment: boolean;
    brandAssets: boolean;
    ugc: boolean;
  };
  customNote: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, platforms, assetNeeds, customNote } = await req.json() as OnboardingRequest;

    if (!clientId) {
      return new Response(
        JSON.stringify({ success: false, error: 'clientId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating onboarding packet for client:', clientId);
    console.log('Platforms selected:', platforms);
    console.log('Asset needs:', assetNeeds);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error('Client not found:', clientError);
      throw new Error('Client not found');
    }

    console.log('Found client:', client.business_name);

    // Fetch knowledge summary for the client
    const { data: knowledgeSummary, error: summaryError } = await supabase
      .from('knowledge_summary')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle();

    if (summaryError) {
      console.warn('Could not fetch knowledge summary:', summaryError);
    }

    console.log('Knowledge summary found:', !!knowledgeSummary);

    // Fetch agency settings (optional, for branding)
    const { data: agencySettings } = await supabase
      .from('agency_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    console.log('Agency settings found:', !!agencySettings);

    // Return data for PDF generation on client-side
    return new Response(
      JSON.stringify({
        success: true,
        client: {
          id: client.id,
          business_name: client.business_name,
          contact_name: client.contact_name,
          email: client.email,
          phone: client.phone,
          website: client.website,
          industry: client.industry,
          mrr: client.mrr,
          status: client.status,
        },
        knowledgeSummary: knowledgeSummary ? {
          positioning_summary: knowledgeSummary.positioning_summary,
          key_differentiators: knowledgeSummary.key_differentiators || [],
          content_opportunities: knowledgeSummary.content_opportunities || [],
          compliance_flags: knowledgeSummary.compliance_flags || [],
          ideal_customer_profile: knowledgeSummary.ideal_customer_profile,
        } : null,
        agencySettings: agencySettings ? {
          agency_name: agencySettings.agency_name,
          logo_url: agencySettings.logo_url,
          primary_color: agencySettings.primary_color,
        } : null,
        config: {
          platforms,
          assetNeeds,
          customNote,
        },
        generatedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-onboarding-pdf:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
