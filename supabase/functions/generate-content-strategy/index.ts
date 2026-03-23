import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, clientName, industry } = await req.json();

    if (!clientId) {
      return new Response(
        JSON.stringify({ success: false, error: 'clientId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get knowledge base entries for context
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: knowledgeEntries, error: kbError } = await supabase
      .from('knowledge_entries')
      .select('*')
      .eq('client_id', clientId);

    if (kbError) {
      console.error('Error fetching knowledge entries:', kbError);
    }

    // Build context from knowledge base
    let knowledgeContext = '';
    if (knowledgeEntries && knowledgeEntries.length > 0) {
      for (const entry of knowledgeEntries) {
        knowledgeContext += `## ${entry.category.toUpperCase()}: ${entry.title}\n${entry.content}\n\n`;
      }
    }

    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    console.log('Generating content strategy for client:', clientName);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert content strategist creating a 30-day content plan for a client.

Based on the client's knowledge base, create content plans that:
- Are tailored to their brand voice and target audience
- Include a variety of content types (video, carousel, story, reel, ugc)
- Have engaging hooks and clear concepts
- Are scheduled across the month with optimal posting times
- Target appropriate platforms (TikTok, Instagram, YouTube, LinkedIn, Facebook)

Today's date is ${today.toISOString().split('T')[0]}.
Create plans spread across the next 30 days ending ${thirtyDaysFromNow.toISOString().split('T')[0]}.`
          },
          {
            role: "user",
            content: `Create a 30-day content strategy for this client:

Client: ${clientName || 'Unknown'}
Industry: ${industry || 'General'}

Knowledge Base:
${knowledgeContext || 'No knowledge base entries available. Create general content suggestions based on the industry.'}

Generate 25-30 content plans with filming dates spread across the month. Include a variety of content types and platforms.`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_content_plans",
              description: "Create content plans for the next 30 days",
              parameters: {
                type: "object",
                properties: {
                  plans: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Content plan title" },
                        brief: { type: "string", description: "Detailed content brief with hook ideas and key messages" },
                        filming_date: { type: "string", description: "ISO date string for filming (YYYY-MM-DD)" },
                        content_pieces: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              concept: { type: "string", description: "Content concept/idea" },
                              hook: { type: "string", description: "Opening hook to grab attention" },
                              content_type: { 
                                type: "string", 
                                enum: ["video", "image", "carousel", "story", "reel", "ugc"] 
                              },
                              platform: { type: "string", description: "Target platform" }
                            },
                            required: ["concept", "hook", "content_type", "platform"]
                          }
                        }
                      },
                      required: ["title", "brief", "filming_date", "content_pieces"]
                    }
                  }
                },
                required: ["plans"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_content_plans" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      throw new Error(`AI strategy generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI strategy response received');

    // Extract plans from tool call
    let plans: Array<{
      title: string;
      brief: string;
      filming_date: string;
      content_pieces: Array<{
        concept: string;
        hook: string;
        content_type: string;
        platform: string;
      }>;
    }> = [];

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        plans = parsed.plans || [];
      } catch (e) {
        console.error('Error parsing AI response:', e);
      }
    }

    console.log(`Generated ${plans.length} content plans`);

    // Create a SINGLE content plan with all ideas bundled together
    // Convert plans into the format expected by the content plan brief (JSON array)
    const contentIdeas = plans.map(plan => ({
      hook: plan.title,
      script: plan.brief,
      formatType: plan.content_pieces?.[0]?.content_type || 'video',
      platform: plan.content_pieces?.map(p => p.platform) || ['instagram'],
      duration: 60,
      contentPieces: plan.content_pieces,
    }));

    const planTitle = `${clientName || 'Client'} - 30 Day Content Strategy`;
    
    const { data: contentPlan, error: planError } = await supabase
      .from('content_plans')
      .insert({
        client_id: clientId,
        title: planTitle,
        brief: JSON.stringify(contentIdeas), // Store as JSON array like AI Chat does
        filming_date: null,
        status: 'planning',
      })
      .select()
      .single();

    if (planError) {
      console.error('Error creating content plan:', planError);
      throw new Error('Failed to create content plan');
    }

    console.log(`Created 1 content plan with ${contentIdeas.length} ideas`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        plansCreated: 1,
        ideasCount: contentIdeas.length,
        plans: [contentPlan]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-content-strategy:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
