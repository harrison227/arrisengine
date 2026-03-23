import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiter (per-function instance)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per minute per client

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
    const body = await req.json();
    const { clientId, platform, action } = body;

    if (!clientId || !platform) {
      return new Response(
        JSON.stringify({ error: 'clientId and platform are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const rateLimitCheck = checkRateLimit(clientId);
    if (!rateLimitCheck.allowed) {
      console.log(`Rate limit exceeded for client ${clientId}. Wait ${rateLimitCheck.waitTime}s`);
      return new Response(
        JSON.stringify({ 
          error: `Rate limit exceeded. Please wait ${rateLimitCheck.waitTime} seconds before making another request.`,
          rateLimited: true,
          waitTime: rateLimitCheck.waitTime
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle rewrite action
    if (action === 'rewrite') {
      const { rewriteStyle, originalContent, customPrompt } = body;

      if (!rewriteStyle || !originalContent) {
        return new Response(
          JSON.stringify({ error: 'rewriteStyle and originalContent are required for rewrite action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const rewritePrompts: Record<string, string> = {
        shorter: 'Rewrite this post to be more concise while keeping the core message. Remove filler words and unnecessary phrases. Keep the same tone.',
        punchier: 'Rewrite this post to be more attention-grabbing and energetic. Add impactful hooks and dynamic language while keeping the message.',
        professional: 'Rewrite this post in a more professional, polished tone. Make it suitable for a business audience while maintaining the core message.',
        emoji: 'Add relevant emojis to this post to make it more engaging. Place them strategically but don\'t overdo it. Keep the original text mostly intact.',
        custom: customPrompt || 'Improve this post.',
      };

      const prompt = rewritePrompts[rewriteStyle] || rewritePrompts.shorter;

      console.log('Rewriting post with style:', rewriteStyle, 'using Claude Sonnet 4.5');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: `You are a social media content editor. Your task is to rewrite posts according to specific instructions. 
              
IMPORTANT: Output ONLY the rewritten post content. No explanations, no quotation marks around the entire response, no prefixes like "Here's the rewritten post:". Just the post itself.`,
          messages: [
            {
              role: 'user',
              content: `${prompt}\n\nOriginal post:\n${originalContent}`
            }
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

      const aiResponse = await response.json();
      const rewrittenContent = aiResponse.content?.[0]?.text?.trim();

      if (!rewrittenContent) {
        throw new Error('No response from AI');
      }

      return new Response(
        JSON.stringify({ rewrittenContent }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle generate action (original flow)
    const { message, guidelines, conversationHistory, topPostsContext } = body;

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'message is required for generation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch client info
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (!client) {
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch knowledge entries
    const { data: knowledgeEntries } = await supabase
      .from('knowledge_entries')
      .select('*')
      .eq('client_id', clientId);

    const { data: knowledgeSummary } = await supabase
      .from('knowledge_summary')
      .select('*')
      .eq('client_id', clientId)
      .single();

    // Build knowledge context
    const groupedKnowledge: Record<string, string[]> = {};
    knowledgeEntries?.forEach(entry => {
      const cat = entry.category.toUpperCase();
      if (!groupedKnowledge[cat]) groupedKnowledge[cat] = [];
      groupedKnowledge[cat].push(`• ${entry.title}: ${entry.content}`);
    });

    const knowledgeContext = Object.entries(groupedKnowledge)
      .map(([category, entries]) => `=== ${category} ===\n${entries.join('\n')}`)
      .join('\n\n') || 'No knowledge base entries yet.';

    // Platform-specific instructions (only used if no custom guidelines provided)
    const platformInstructions: Record<string, string> = {
      linkedin: `
LINKEDIN POST GUIDELINES:
- Write professional, thought-leadership style content
- Optimal length: 1,300-2,000 characters for maximum engagement
- Use line breaks for readability (short paragraphs of 1-3 sentences)
- Start with a strong hook in the first 2 lines (this is what shows before "see more")
- Include relevant emojis sparingly (1-3 per post)
- End with a call-to-action or question to drive engagement
- Consider using bullet points or numbered lists for key points
- Avoid hashtags in the main body; if used, limit to 3-5 at the end
`,
      twitter: `
TWITTER/X POST GUIDELINES:
- Maximum 280 characters per tweet
- If creating a thread, number each tweet (1/, 2/, etc.)
- Start with the most compelling point
- Use clear, punchy language
- Emojis are welcome but don't overdo it
- For threads: First tweet should hook readers to read the rest
- Hashtags: Use 1-2 maximum, or none if not relevant
- Consider using line breaks for visual impact within the 280 limit
`,
      threads: `
THREADS POST GUIDELINES:
- Similar to Instagram/Twitter hybrid style
- Maximum 500 characters per post
- Can create connected threads for longer content
- Conversational, authentic tone works best
- Use emojis naturally
- First line is crucial - make it scroll-stopping
- Good for storytelling and personal insights
`,
    };

    // Build the system prompt - ALWAYS include client context
    const platformSection = platformInstructions[platform] || '';

    let systemPrompt = `You are an expert content writer specializing in ${platform.toUpperCase()} content for ${client.business_name}.

═══════════════════════════════════════════════════════════════
CLIENT PROFILE: ${client.business_name}
═══════════════════════════════════════════════════════════════
Industry: ${client.industry}
Contact: ${client.contact_name}

▸ BRAND POSITIONING:
${knowledgeSummary?.positioning_summary || 'Not yet defined'}

▸ KEY DIFFERENTIATORS:
${knowledgeSummary?.key_differentiators?.map((d: string) => `• ${d}`).join('\n') || 'Not yet defined'}

▸ IDEAL CUSTOMER PROFILE:
${knowledgeSummary?.ideal_customer_profile || 'Not yet defined'}

═══════════════════════════════════════════════════════════════
KNOWLEDGE BASE
═══════════════════════════════════════════════════════════════
${knowledgeContext}
`;

    // Add custom guidelines if provided, otherwise use platform defaults
    if (guidelines) {
      systemPrompt += `
═══════════════════════════════════════════════════════════════
WRITING STYLE GUIDELINES (FOLLOW THESE STRICTLY)
═══════════════════════════════════════════════════════════════
${guidelines}
`;
    } else if (platformSection) {
      systemPrompt += `
═══════════════════════════════════════════════════════════════
${platformSection}
═══════════════════════════════════════════════════════════════
`;
    }

    // Add top posts context if provided (for generating ideas based on past performance)
    if (topPostsContext && Array.isArray(topPostsContext) && topPostsContext.length > 0) {
      systemPrompt += `
═══════════════════════════════════════════════════════════════
TOP PERFORMING POSTS ANALYSIS
═══════════════════════════════════════════════════════════════
The user's highest-performing posts from the last 60 days are provided below.
Analyze these for:
- Common themes and topics that resonate with the audience
- Writing style patterns (hooks, formatting, length)
- Engagement triggers (questions, stories, data, emotions)
- Tone and voice characteristics that drive engagement

Use these insights to generate new posts that capture similar success factors
while bringing fresh perspectives and ideas.

TOP POSTS:
${topPostsContext.map((p: any, i: number) => `
${i + 1}. "${p.caption?.slice(0, 200) || 'No caption'}${p.caption && p.caption.length > 200 ? '...' : ''}"
   📊 Impressions: ${p.impressions?.toLocaleString() || 0} | ❤️ Likes: ${p.likes?.toLocaleString() || 0} | 💬 Comments: ${p.comments?.toLocaleString() || 0} | 🔄 Shares: ${p.shares?.toLocaleString() || 0}
`).join('\n')}
═══════════════════════════════════════════════════════════════
`;
    }

    systemPrompt += `
CRITICAL INSTRUCTIONS:
1. Generate ready-to-post content that requires minimal editing
2. Use the client's knowledge base to inform your content
3. Match the client's industry and positioning
4. Be specific and actionable in your content
5. Follow the writing style guidelines EXACTLY
6. When asked to generate posts, output each post in a clear format:

---POST 1---
[Your post content here]

---POST 2---
[Your post content here]

(Continue for each post)

This format helps with parsing. Include the full post content between each marker.`;

    console.log('Calling Claude Sonnet 4.5 for text posts...', { platform, hasGuidelines: !!guidelines });

    // Convert conversation history to Anthropic format
    const anthropicMessages = [
      ...(conversationHistory || []).map((msg: { role: string; content: string }) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: systemPrompt,
        messages: anthropicMessages,
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

    const aiResponse = await response.json();
    const assistantMessage = aiResponse.content?.[0]?.text;

    if (!assistantMessage) {
      throw new Error('No response from AI');
    }

    // Extract posts from the response
    const posts: string[] = [];
    const postMatches = assistantMessage.matchAll(/---POST \d+---\s*([\s\S]*?)(?=---POST \d+---|$)/g);
    for (const match of postMatches) {
      const postContent = match[1].trim();
      if (postContent) {
        posts.push(postContent);
      }
    }

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        posts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-text-posts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
