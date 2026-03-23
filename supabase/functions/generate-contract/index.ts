import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      clientId, 
      contractType, 
      scopeOfWork, 
      startDate, 
      endDate, 
      paymentTerms, 
      deliverables, 
      revisionFeedback, 
      existingContent,
      agencyName,
      agencyContactName,
      agencyEmail,
      agencyPhone,
      clientContactName,
      clientEmail,
      clientPhone,
      paymentAmount,
      paymentCurrency,
      billingInterval,
      initialPaymentAmount,
      governingJurisdiction,
    } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get client info
    let clientInfo = null;
    if (clientId) {
      const { data: client } = await supabase
        .from('clients')
        .select('business_name, contact_name, email, phone, website, industry, mrr')
        .eq('id', clientId)
        .single();

      clientInfo = client;
    }

    // Get the default contract template
    const { data: template, error: templateError } = await supabase
      .from('contract_templates')
      .select('content')
      .eq('is_default', true)
      .single();

    if (templateError || !template) {
      console.error('Error fetching template:', templateError);
      throw new Error('No default contract template found');
    }

    const isRevision = !!revisionFeedback && !!existingContent;
    const clientName = clientInfo?.business_name || 'Client';

    // Format the payment amount
    const formatPaymentAmount = () => {
      const currency = paymentCurrency || 'USD';
      const amount = paymentAmount || clientInfo?.mrr || 0;
      
      if (billingInterval && billingInterval !== 'one_time') {
        const intervalMap: Record<string, string> = {
          'monthly': 'month',
          'quarterly': 'quarter',
          'yearly': 'year',
        };
        const intervalLabel = intervalMap[billingInterval] || billingInterval;
        
        if (initialPaymentAmount && initialPaymentAmount !== amount) {
          return `${initialPaymentAmount.toLocaleString()} ${currency} for the first ${intervalLabel}, then ${amount.toLocaleString()} ${currency} per ${intervalLabel}`;
        }
        return `${amount.toLocaleString()} ${currency} per ${intervalLabel}`;
      }
      return `${amount.toLocaleString()} ${currency}`;
    };

    // Format dates
    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return 'To be specified';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      } catch {
        return dateStr;
      }
    };

    if (isRevision) {
      // For revisions, use AI to modify the existing contract based on feedback
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        throw new Error('LOVABLE_API_KEY is not configured');
      }

      const systemPrompt = `You are a professional contract editor. Your job is to revise an existing contract based on feedback while maintaining the professional structure and legal language.

CRITICAL RULES:
1. Output PLAIN TEXT ONLY - absolutely NO markdown formatting
2. Do NOT use ** for bold, do NOT use # for headings
3. Keep the same section numbering and structure
4. Only modify the sections specifically mentioned in the feedback
5. Maintain all legal language and terms not mentioned in the feedback`;

      const userPrompt = `Please revise this existing contract based on the feedback provided.

EXISTING CONTRACT:
${existingContent}

REVISION FEEDBACK:
${revisionFeedback}

Return only the revised contract content with no markdown formatting.`;

      console.log('Revising contract for client:', clientName);

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI gateway error:', response.status, errorText);
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      let content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content returned from AI');
      }

      // Strip any remaining markdown
      content = content
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/^#+\s*/gm, '')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/```[\s\S]*?```/g, '');

      return new Response(
        JSON.stringify({ content }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For new contracts: Replace placeholders in the template
    let content = template.content;

    // Replace all placeholders
    const replacements: Record<string, string> = {
      '[EFFECTIVE DATE]': formatDate(startDate),
      '[CLIENT]': clientName,
      '[END DATE]': formatDate(endDate),
      '[MONTHLY FEE]': formatPaymentAmount(),
      '[GOVERNING JURISDICTION]': governingJurisdiction || 'California, USA',
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      // Replace all occurrences (global replace)
      content = content.split(placeholder).join(value);
    }

    // If custom scope of work is provided, use AI to enhance Section 2
    if (scopeOfWork && scopeOfWork.trim()) {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (LOVABLE_API_KEY) {
        const systemPrompt = `You are a professional contract writer. You need to update ONLY section 2 (SCOPE OF SERVICES) of a contract based on the custom scope provided.

CRITICAL RULES:
1. Output ONLY the updated Section 2 content
2. Keep the same subsection numbering (2.1, 2.2, 2.3)
3. Output PLAIN TEXT ONLY - no markdown
4. Maintain professional legal language
5. Keep the Change Requests clause (2.3) largely intact`;

        const userPrompt = `Update Section 2 (SCOPE OF SERVICES) based on this custom scope:

${scopeOfWork}

${deliverables ? `Deliverables to include: ${deliverables}` : ''}

Return ONLY the Section 2 content, starting with "2. SCOPE OF SERVICES"`;

        try {
          const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ],
            }),
          });

          if (response.ok) {
            const data = await response.json();
            let newSection2 = data.choices?.[0]?.message?.content;

            if (newSection2) {
              // Clean markdown from AI response
              newSection2 = newSection2
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/^#+\s*/gm, '')
                .replace(/`([^`]+)`/g, '$1');

              // Replace Section 2 in the template
              const section2Start = content.indexOf('2. SCOPE OF SERVICES');
              const section3Start = content.indexOf('3. DELIVERABLES');
              
              if (section2Start !== -1 && section3Start !== -1) {
                content = content.substring(0, section2Start) + 
                          newSection2.trim() + 
                          '\n\n' + 
                          content.substring(section3Start);
              }
            }
          }
        } catch (aiError) {
          console.log('AI enhancement failed, using template as-is:', aiError);
        }
      }
    }

    console.log('Generated contract for client:', clientName);

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-contract:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
