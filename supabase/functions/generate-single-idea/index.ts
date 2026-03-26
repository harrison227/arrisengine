import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, clientContext, existingIdea } = await req.json();

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) {
      throw new Error("GOOGLE_AI_API_KEY is not configured");
    }

    let systemPrompt = `You are a flexible content strategist. Generate a single content idea based on the user's prompt.

IMPORTANT: Match the TONE and STYLE the user requests. Not all content needs to be punchy or viral-style.
- If they want a testimonial, make it authentic and conversational
- If they want slow-paced or reflective content, respect that
- If they provide a specific script or structure, follow it closely
- Only use viral/hook-style formatting when specifically requested or appropriate

Return ONLY a valid JSON object (no markdown, no code blocks) with this exact structure:
{
  "hook": "A title or opening for the content (style depends on content type)",
  "script": "The full script - structure it appropriately for the content type",
  "platform": ["Instagram", "TikTok"],
  "formatType": "Talking Head",
  "duration": 60,
  "shotList": ["Shot 1 description", "Shot 2 description"],
  "audioSuggestion": "Audio/music suggestion if relevant"
}

Guidelines:
- hook: A title or opening that matches the content tone (not everything needs to be "attention-grabbing")
- script: Structure appropriately for the content type:
  * For viral/punchy content: Use [HOOK], [MAIN], [CTA]
  * For testimonials: Use natural conversational flow
  * For educational: Use clear sections or steps
  * For storytelling: Use narrative flow
  * If the user provides a script, use their structure
- platform: An ARRAY of suitable platforms from: Instagram, TikTok, YouTube, Facebook, LinkedIn, Twitter. Choose multiple when the content fits.
- formatType: Choose from Talking Head, B-Roll, Tutorial, Behind the Scenes, Interview, Product Demo, Testimonial, Documentary, Story
- duration: Suggest based on content depth (15-180 seconds)
- shotList: 2-5 specific visual shots appropriate for the format
- audioSuggestion: Background music, trending audio, or voiceover style if relevant`;

    if (clientContext) {
      systemPrompt += `\n\nClient Context:\n${clientContext}`;
    }

    let userPrompt = prompt;
    if (existingIdea) {
      userPrompt = `Modify this content idea based on the user's guidance: "${prompt}"
      
Current idea:
- Hook: ${existingIdea.hook}
- Script: ${existingIdea.script || 'None'}
- Platform: ${Array.isArray(existingIdea.platform) ? existingIdea.platform.join(', ') : existingIdea.platform}
- Format: ${existingIdea.formatType}

IMPORTANT: Follow the user's guidance closely. If they provide a specific script or style, use it. 
Do NOT automatically make it "more punchy" or "more viral" unless specifically asked.`;
    }

    console.log('Generating single idea with prompt:', userPrompt.substring(0, 100));

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
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits depleted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content returned from AI");
    }

    // Parse the JSON response - handle possible markdown code blocks
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.slice(7);
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.slice(3);
    }
    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.slice(0, -3);
    }
    cleanedContent = cleanedContent.trim();

    let idea;
    try {
      idea = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse AI response:", cleanedContent);
      throw new Error("Failed to parse AI response as JSON");
    }

    // Validate and ensure required fields
    const validatedIdea = {
      hook: idea.hook || "Generated content idea",
      script: idea.script || "",
      platform: Array.isArray(idea.platform) ? idea.platform : [idea.platform || "Instagram"],
      formatType: idea.formatType || "Talking Head",
      duration: idea.duration || 60,
      shotList: Array.isArray(idea.shotList) ? idea.shotList : [],
      audioSuggestion: idea.audioSuggestion || "",
    };

    console.log('Generated idea:', validatedIdea.hook);

    return new Response(JSON.stringify({ idea: validatedIdea }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error in generate-single-idea:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate idea";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
