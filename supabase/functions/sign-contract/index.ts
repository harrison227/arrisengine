import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const {
      contract_id,
      signer_role,
      signer_name,
      signer_email,
      signer_title,
      intent_confirmed,
      consent_to_electronic,
      signature_data,
      signature_type,
    } = body;

    console.log('Signing contract:', { contract_id, signer_role, signer_name, signer_email });

    // Validate required fields
    if (!contract_id || !signer_role || !signer_name || !signer_email || !signature_data) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate intent and consent
    if (!intent_confirmed || !consent_to_electronic) {
      return new Response(
        JSON.stringify({ error: 'Intent and consent confirmations are required for legal compliance' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate signer role
    if (!['agency', 'client'].includes(signer_role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid signer role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get IP address and user agent for audit trail
    const ipAddress = req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      'Unknown';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    // Check if this role has already signed
    const { data: existingSignature, error: checkError } = await supabase
      .from('contract_signatures')
      .select('id')
      .eq('contract_id', contract_id)
      .eq('signer_role', signer_role)
      .not('signed_at', 'is', null)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing signature:', checkError);
      throw checkError;
    }

    if (existingSignature) {
      return new Response(
        JSON.stringify({ error: `This contract has already been signed by the ${signer_role}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert the signature
    const { data: signature, error: insertError } = await supabase
      .from('contract_signatures')
      .insert({
        contract_id,
        signer_role,
        signer_name,
        signer_email,
        signer_title: signer_title || null,
        intent_confirmed,
        consent_to_electronic,
        signature_data,
        signature_type,
        signed_at: new Date().toISOString(),
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting signature:', insertError);
      throw insertError;
    }

    console.log('Signature recorded:', signature.id);

    // Check if both parties have now signed
    const { data: allSignatures, error: signaturesError } = await supabase
      .from('contract_signatures')
      .select('*')
      .eq('contract_id', contract_id)
      .not('signed_at', 'is', null);

    if (signaturesError) {
      console.error('Error fetching all signatures:', signaturesError);
      throw signaturesError;
    }

    const agencySigned = allSignatures.some(s => s.signer_role === 'agency');
    const clientSigned = allSignatures.some(s => s.signer_role === 'client');
    const isFullySigned = agencySigned && clientSigned;

    console.log('Signature status:', { agencySigned, clientSigned, isFullySigned });

    // If fully signed, update contract status and make share link permanent
    if (isFullySigned) {
      const { error: updateError } = await supabase
        .from('contracts')
        .update({ 
          status: 'signed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', contract_id);

      if (updateError) {
        console.error('Error updating contract status:', updateError);
        // Don't throw, signature was still recorded
      }

      // Remove expiration from all active share links for this contract
      // This makes the link permanent for signed contracts
      const { error: linkUpdateError } = await supabase
        .from('contract_share_links')
        .update({ expires_at: null })
        .eq('contract_id', contract_id)
        .eq('is_active', true);

      if (linkUpdateError) {
        console.error('Error removing link expiration:', linkUpdateError);
      } else {
        console.log('Share link expiration removed - link is now permanent');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        signature_id: signature.id,
        is_fully_signed: isFullySigned,
        message: isFullySigned 
          ? 'Contract is now fully signed by both parties!'
          : `${signer_role === 'agency' ? 'Agency' : 'Client'} signature recorded. Waiting for ${signer_role === 'agency' ? 'client' : 'agency'} signature.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sign-contract function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
