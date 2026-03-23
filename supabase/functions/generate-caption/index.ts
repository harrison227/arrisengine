import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiter (per-function instance)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per client

function checkRateLimit(clientId: string): { allowed: boolean; waitTime: number } {
  const now = Date.now();
  const timestamps = rateLimitMap.get(clientId) || [];
  
  // Remove timestamps outside the window
  const validTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (validTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldestTimestamp = validTimestamps[0];
    const waitTime = Math.ceil((oldestTimestamp + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, waitTime };
  }
  
  // Record this request
  validTimestamps.push(now);
  rateLimitMap.set(clientId, validTimestamps);
  
  return { allowed: true, waitTime: 0 };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { concept, clientId, refinement, existingCaption, videoTranscript } = await req.json();

    if (!concept) {
      return new Response(
        JSON.stringify({ error: 'Concept is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    if (clientId) {
      const rateLimitCheck = checkRateLimit(clientId);
      if (!rateLimitCheck.allowed) {
        console.log(`Rate limit exceeded for client ${clientId}. Wait ${rateLimitCheck.waitTime}s`);
        return new Response(
          JSON.stringify({ 
            error: `Rate limit exceeded. Please wait ${rateLimitCheck.waitTime} seconds.`,
            rateLimited: true,
            waitTime: rateLimitCheck.waitTime
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    // Get client info for context
    let clientContext = '';
    if (clientId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: client } = await supabase
        .from('clients')
        .select('business_name, industry')
        .eq('id', clientId)
        .single();

      if (client) {
        clientContext = `\nBrand: ${client.business_name}\nIndustry: ${client.industry}`;
      }

      // Get knowledge entries for better context - use all available categories
      const { data: knowledge, error: knowledgeError } = await supabase
        .from('knowledge_entries')
        .select('title, content, category')
        .eq('client_id', clientId)
        .limit(10);

      if (knowledgeError) {
        console.error('Error loading knowledge entries:', knowledgeError);
      }

      if (knowledge && knowledge.length > 0) {
        clientContext += '\n\nBrand Knowledge:';
        knowledge.forEach(k => {
          clientContext += `\n- [${k.category.toUpperCase()}] ${k.title}: ${k.content.substring(0, 500)}`;
        });
        console.log(`Loaded ${knowledge.length} knowledge entries for context`);
      } else {
        console.log('No knowledge entries found for client:', clientId);
      }
    }

    // Build refinement instructions
    let refinementInstructions = '';
    if (refinement) {
      refinementInstructions = `\n\nUSER GUIDANCE: ${refinement}`;
    }
    
    let existingCaptionContext = '';
    if (existingCaption) {
      existingCaptionContext = `\n\nEXISTING CAPTION (use as reference or improve upon it): "${existingCaption}"`;
    }

    // Build video transcript context
    let transcriptContext = '';
    if (videoTranscript && videoTranscript.trim()) {
      console.log(`Including video transcript (${videoTranscript.length} chars) in caption generation`);
      transcriptContext = `\n\nVIDEO TRANSCRIPT (use this spoken content to inform the caption - reference key themes and messages):
"${videoTranscript.substring(0, 1500)}"`;
    }

    const systemPrompt = `You are an expert social media copywriter who creates engaging, authentic captions for social media posts.

CRITICAL RULES:
- Your captions MUST align with the brand's voice, tone, and positioning provided below
- If there is a video transcript, the caption should complement and contextualize what is being said in the video
- Write in the brand's established tone - do not use generic motivational language
- Be specific to this business and their industry

Your captions should be:
- Conversational and relatable
- Engaging with a hook at the start
- Include a call-to-action when appropriate
- NOT overly promotional or generic
- Specific to this brand's messaging
${clientContext}${refinementInstructions}`;

    const userPrompt = `Write a social media caption for a post.

Content concept: "${concept}"${existingCaptionContext}${transcriptContext}

${videoTranscript ? `IMPORTANT: This is a video post. The transcript shows what is being said in the video. Your caption should:
- Complement and introduce what viewers will see/hear
- Use the brand's specific language and positioning (see Brand Knowledge above)
- NOT just paraphrase the transcript, but add context relevant to this brand` : ''}

Create a concise, engaging caption (2-3 sentences, under 300 characters) that:
- Opens with a strong hook related to this brand's messaging
- Provides value or emotional connection specific to their audience
- Ends with a call-to-action or engaging question

${refinement ? `Additional guidance: ${refinement}` : ''}

Respond with ONLY the caption text - no titles, no hashtags, no JSON. Just the caption.`;

    console.log('Generating caption with Claude Sonnet 4.5, refinement:', refinement || 'none');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 529) {
        return new Response(
          JSON.stringify({ error: 'API is overloaded. Please try again shortly.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error('No content returned from AI');
    }

    // Clean up the caption (remove quotes if wrapped)
    let caption = content.trim();
    if (caption.startsWith('"') && caption.endsWith('"')) {
      caption = caption.slice(1, -1);
    }

    console.log('Generated caption for concept:', concept.substring(0, 50));

    return new Response(
      JSON.stringify({ caption }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-caption:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
