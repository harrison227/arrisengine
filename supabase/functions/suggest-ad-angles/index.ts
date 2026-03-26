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
    const { clientId, clientName, industry } = await req.json();
    
    if (!clientId) {
      throw new Error("Client ID is required");
    }

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) {
      throw new Error("GOOGLE_AI_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch knowledge base entries for context
    const { data: knowledgeEntries, error: kbError } = await supabase
      .from("knowledge_entries")
      .select("title, content, category")
      .eq("client_id", clientId);

    if (kbError) {
      console.error("Error fetching knowledge entries:", kbError);
    }

    // Build context from knowledge base
    const kbContext = knowledgeEntries?.map(e => 
      `[${e.category.toUpperCase()}] ${e.title}: ${e.content}`
    ).join("\n\n") || "No knowledge base entries available.";

    const systemPrompt = `You are an expert digital advertising strategist. Generate 5 creative ad angle suggestions based on the client's knowledge base and industry.

For each ad angle, provide:
1. A compelling hook/headline (attention-grabbing, under 10 words)
2. Target emotion (e.g., curiosity, fear of missing out, aspiration, trust, urgency)
3. Recommended format (video, carousel, static image, story, reel)
4. Best platform (Meta, Google, TikTok, LinkedIn)
5. Brief description of the angle and why it works (2-3 sentences)

Return ONLY a valid JSON array with exactly 5 objects, each having these exact keys:
- hook (string)
- target_emotion (string)
- format (string)
- platform (string)
- description (string)

Do not include any markdown, code blocks, or explanations outside the JSON array.`;

    const userPrompt = `Client: ${clientName || "Unknown"}
Industry: ${industry || "Unknown"}

Knowledge Base Context:
${kbContext}

Generate 5 unique and creative ad angle suggestions for this client.`;

    console.log("Calling Lovable AI for ad suggestions...");

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GOOGLE_AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("AI response received, parsing suggestions...");

    // Parse the JSON response
    let suggestions;
    try {
      // Clean up potential markdown code blocks
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      suggestions = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse AI response as JSON");
    }

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      throw new Error("Invalid suggestions format from AI");
    }

    // Delete existing suggestions for this client
    const { error: deleteError } = await supabase
      .from("ad_suggestions")
      .delete()
      .eq("client_id", clientId);

    if (deleteError) {
      console.error("Error deleting old suggestions:", deleteError);
    }

    // Insert new suggestions
    const insertData = suggestions.slice(0, 5).map((s: any) => ({
      client_id: clientId,
      hook: s.hook || "Untitled Hook",
      target_emotion: s.target_emotion || "curiosity",
      format: s.format || "video",
      platform: s.platform || "Meta",
      description: s.description || "",
    }));

    const { data: insertedSuggestions, error: insertError } = await supabase
      .from("ad_suggestions")
      .insert(insertData)
      .select();

    if (insertError) {
      console.error("Error inserting suggestions:", insertError);
      throw new Error("Failed to save suggestions to database");
    }

    console.log(`Successfully generated ${insertedSuggestions.length} ad suggestions`);

    return new Response(JSON.stringify({ 
      success: true, 
      suggestions: insertedSuggestions 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in suggest-ad-angles function:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
