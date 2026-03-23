import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, title, caption } = await req.json();

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "clientId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch client info
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("business_name, industry")
      .eq("id", clientId)
      .single();

    if (clientError) {
      console.error("Error fetching client:", clientError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch client" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch knowledge entries for context
    const { data: knowledgeEntries } = await supabase
      .from("knowledge_entries")
      .select("title, content, category")
      .eq("client_id", clientId)
      .limit(10);

    // Build context from knowledge entries
    const knowledgeContext = knowledgeEntries
      ?.map((entry) => `${entry.category}: ${entry.title} - ${entry.content}`)
      .join("\n") || "";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a social media expert. Generate 3-7 relevant hashtags for a social media post.

The hashtags should be:
- Relevant to the business and industry
- A mix of popular and niche hashtags
- In the correct format (lowercase, no spaces within hashtags)
- Engaging and likely to increase reach

Respond with ONLY a JSON array of hashtags, nothing else. Example: ["#marketing", "#socialmedia", "#business"]`;

    const userPrompt = `Generate hashtags for:
Business: ${client.business_name}
Industry: ${client.industry}
${title ? `Title: ${title}` : ""}
${caption ? `Caption: ${caption}` : ""}

Additional context about the business:
${knowledgeContext || "No additional context available"}`;

    console.log("Generating hashtags for client:", client.business_name);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No content in AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the hashtags from the response
    let hashtags: string[];
    try {
      // Try to parse as JSON array
      const parsed = JSON.parse(content.trim());
      hashtags = Array.isArray(parsed) ? parsed : [];
    } catch {
      // Fallback: extract hashtags from text
      const matches = content.match(/#\w+/g);
      hashtags = matches ? matches.slice(0, 7) : [];
    }

    console.log("Generated hashtags:", hashtags);

    return new Response(
      JSON.stringify({ hashtags }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating hashtags:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
