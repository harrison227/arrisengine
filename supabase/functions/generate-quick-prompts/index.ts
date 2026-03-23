import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.23.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 15;

function checkRateLimit(clientId: string): { allowed: boolean; waitTime: number } {
  const now = Date.now();
  const timestamps = rateLimitMap.get(clientId) || [];
  const validTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (validTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldestValid = validTimestamps[0];
    const waitTime = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldestValid)) / 1000);
    return { allowed: false, waitTime };
  }
  
  validTimestamps.push(now);
  rateLimitMap.set(clientId, validTimestamps);
  return { allowed: true, waitTime: 0 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, concepts, styleNotes } = await req.json();

    if (!clientId || !concepts || !Array.isArray(concepts) || concepts.length === 0) {
      return new Response(
        JSON.stringify({ error: "clientId and concepts array are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting
    const rateLimitCheck = checkRateLimit(clientId);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: `Rate limit exceeded. Please wait ${rateLimitCheck.waitTime} seconds.`,
          rateLimited: true,
          waitTime: rateLimitCheck.waitTime
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch client info for brand context
    const { data: client } = await supabase
      .from("clients")
      .select("business_name, industry, brand_primary_color, brand_secondary_color, brand_accent_color, brand_fonts, brand_style_notes")
      .eq("id", clientId)
      .single();

    // Fetch knowledge summary for additional context
    const { data: knowledgeSummary } = await supabase
      .from("knowledge_summary")
      .select("positioning_summary, key_differentiators, ideal_customer_profile")
      .eq("client_id", clientId)
      .single();

    // Fetch knowledge entries for brand guidelines
    const { data: knowledgeEntries } = await supabase
      .from("knowledge_entries")
      .select("title, content, category")
      .eq("client_id", clientId)
      .in("category", ["brand_guidelines", "visual_identity", "tone_voice", "content_pillars"])
      .order("importance", { ascending: false })
      .limit(10);

    // Build brand guidelines from knowledge entries
    const brandGuidelines = knowledgeEntries?.length 
      ? knowledgeEntries.map(e => `[${e.category}] ${e.title}: ${e.content}`).join('\n')
      : '';

    // Build brand colors section
    const brandColors = [
      client?.brand_primary_color ? `Primary: ${client.brand_primary_color}` : '',
      client?.brand_secondary_color ? `Secondary: ${client.brand_secondary_color}` : '',
      client?.brand_accent_color ? `Accent: ${client.brand_accent_color}` : '',
    ].filter(Boolean).join(', ');

    // Build context for AI
    const brandContext = client ? `
Brand: ${client.business_name}
Industry: ${client.industry}
${brandColors ? `Brand Colors: ${brandColors}` : ''}
${client.brand_fonts?.length ? `Brand Fonts: ${client.brand_fonts.join(', ')}` : ''}
${client.brand_style_notes ? `Style Notes: ${client.brand_style_notes}` : ''}
${styleNotes ? `Additional Style Notes: ${styleNotes}` : ''}
${knowledgeSummary?.positioning_summary ? `Brand Positioning: ${knowledgeSummary.positioning_summary}` : ''}
${knowledgeSummary?.key_differentiators ? `Key Differentiators: ${knowledgeSummary.key_differentiators.join(', ')}` : ''}
${brandGuidelines ? `\nBrand Guidelines:\n${brandGuidelines}` : ''}
    `.trim() : '';

    const systemPrompt = `You are an expert at crafting detailed, optimized prompts for AI image generation. 
Your task is to transform short concept descriptions into rich, detailed prompts that will produce high-quality social media graphics.

Guidelines:
- Include specific visual details (colors, typography style, composition)
- Mention the intended use (social media post, quote card, etc.)
- Add professional styling elements (clean lines, modern design, etc.)
- Reference brand elements when provided
- Keep prompts focused and actionable (100-200 words each)
- Consider each concept's unique requirements

${brandContext ? `\nBrand Context:\n${brandContext}` : ''}

You will receive an array of short concept descriptions. For each one, generate an optimized, detailed prompt.
Return a JSON object with a "prompts" array containing objects with "id" and "prompt" fields matching the input order.`;

    const userMessage = `Generate optimized image prompts for these concepts:

${concepts.map((c: { id: string; description: string }, i: number) => `${i + 1}. [ID: ${c.id}] ${c.description}`).join('\n')}

Return valid JSON only, no markdown:
{"prompts": [{"id": "concept-id", "prompt": "detailed prompt here"}, ...]}`;

    console.log("[generate-quick-prompts] Processing", concepts.length, "concepts for client:", clientId);

    // Call Anthropic API
    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      console.error("[generate-quick-prompts] Anthropic API error:", errorText);
      throw new Error(`Anthropic API error: ${anthropicResponse.status}`);
    }

    const anthropicData = await anthropicResponse.json();
    const responseText = anthropicData.content?.[0]?.text || "";

    // Parse the JSON response
    let parsedResponse;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("[generate-quick-prompts] Failed to parse response:", responseText);
      throw new Error("Failed to parse AI response");
    }

    console.log("[generate-quick-prompts] Successfully generated", parsedResponse.prompts?.length, "prompts");

    return new Response(
      JSON.stringify(parsedResponse),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[generate-quick-prompts] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate prompts";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
