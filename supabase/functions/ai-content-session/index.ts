import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation helpers
function isValidUUID(str: unknown): boolean {
  if (typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function sanitizeString(str: unknown, maxLength = 10000): string {
  if (typeof str !== 'string') return '';
  // Remove control characters except newlines and tabs
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, maxLength);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { sessionId, clientId, message, action, ideas } = body;

    // Validate clientId
    if (!clientId || !isValidUUID(clientId)) {
      return new Response(
        JSON.stringify({ error: 'clientId is required and must be a valid UUID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate sessionId if provided
    if (sessionId && !isValidUUID(sessionId)) {
      return new Response(
        JSON.stringify({ error: 'sessionId must be a valid UUID if provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate message if provided
    if (message !== undefined && typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'message must be a string if provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate action if provided
    const validActions = ['append_ideas', 'generate', 'chat'];
    if (action && typeof action === 'string' && !validActions.includes(action)) {
      return new Response(
        JSON.stringify({ error: `action must be one of: ${validActions.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate ideas if provided
    if (ideas !== undefined && !Array.isArray(ideas)) {
      return new Response(
        JSON.stringify({ error: 'ideas must be an array if provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit ideas array size
    if (Array.isArray(ideas) && ideas.length > 100) {
      return new Response(
        JSON.stringify({ error: 'ideas array cannot exceed 100 items' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize message
    const sanitizedMessage = sanitizeString(message, 50000);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('GOOGLE_AI_API_KEY');

    if (!lovableApiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch client info and knowledge base
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

    const { data: knowledgeEntries } = await supabase
      .from('knowledge_entries')
      .select('*')
      .eq('client_id', clientId);

    const { data: knowledgeSummary } = await supabase
      .from('knowledge_summary')
      .select('*')
      .eq('client_id', clientId)
      .single();

    // Get user's AI voice settings from the authorization header
    const authHeader = req.headers.get('authorization');
    let aiVoiceSettings: any = null;
    let authenticatedUserId: string | null = null;
    
    if (authHeader) {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
      if (anonKey) {
        const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
        const { data: { user }, error: authError } = await userClient.auth.getUser();
        
        if (authError) {
          console.log('Auth error:', authError.message);
        } else if (user) {
          authenticatedUserId = user.id;
          console.log('User authenticated:', user.id, user.email);
          
          const { data: settings, error: settingsError } = await supabase
            .from('ai_voice_settings')
            .select('*')
            .eq('user_id', user.id)
            .single();
          
          if (settingsError) {
            console.log('AI voice settings fetch error:', settingsError.message);
          } else if (settings) {
            aiVoiceSettings = settings;
            console.log('AI voice settings loaded:', {
              hasMasterPrompt: !!settings.content_planner_master_prompt,
              masterPromptPreview: settings.content_planner_master_prompt?.slice(0, 100) + '...',
              preferredFormats: settings.preferred_formats,
              preferredPlatforms: settings.preferred_platforms
            });
          }
        }
      } else {
        console.log('SUPABASE_ANON_KEY missing; cannot resolve user');
      }
    } else {
      console.log('No authorization header provided');
    }

    // Get existing session or create new
    let session: any = null;
    let conversationHistory: any[] = [];

    if (sessionId) {
      const { data: existingSession } = await supabase
        .from('ai_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      
      if (existingSession) {
        session = existingSession;
        conversationHistory = existingSession.session_data?.messages || [];
        console.log('Loaded existing session:', sessionId);
      }
    }
    
    // Auto-create session if none exists and we have required data
    if (!session && clientId && authenticatedUserId) {
      console.log('Auto-creating new session for client:', clientId);
      const { data: newSession, error: createError } = await supabase
        .from('ai_sessions')
        .insert({
          client_id: clientId,
          user_id: authenticatedUserId,
          session_type: 'filming_plan',
          title: `Chat with ${client.business_name}`,
          status: 'in_progress',
          session_data: { messages: [] }
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Failed to create session:', createError.message, createError.details);
        return new Response(
          JSON.stringify({ error: 'Could not create chat session. Please try again.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      session = newSession;
      console.log('Auto-created new session:', newSession.id);
    }
    
    // If we still don't have a session at this point, fail
    if (!session && !sessionId) {
      console.error('No session available and could not create one');
      return new Response(
        JSON.stringify({ error: 'No session available. Please log in and try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If the user is appending ideas to an existing plan, do it without calling the AI.
    if (action === 'append_ideas') {
      if (!authenticatedUserId) {
        return new Response(
          JSON.stringify({ error: 'You must be logged in to modify a plan.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!session) {
        return new Response(
          JSON.stringify({ error: 'No session found to update. Please start or load a session first.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (session.user_id !== authenticatedUserId) {
        return new Response(
          JSON.stringify({ error: 'You do not have permission to modify this session.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const incomingIdeas = Array.isArray(ideas) ? ideas : [];
      if (incomingIdeas.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No ideas provided to append.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const existingIdeas = session.session_data?.draftPlan?.contentIdeas ?? [];

      const normalize = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
      const ideaKey = (idea: any) => `${normalize(idea?.platform)}|${normalize(idea?.formatType)}|${normalize(idea?.hook)}`;

      const merged: any[] = Array.isArray(existingIdeas) ? [...existingIdeas] : [];
      const seen = new Set<string>(merged.map(ideaKey));

      let addedCount = 0;
      for (const idea of incomingIdeas) {
        const cleaned = {
          hook: typeof idea?.hook === 'string' ? idea.hook.trim() : '',
          script: typeof idea?.script === 'string' ? idea.script.trim() : undefined,
          shotList: Array.isArray(idea?.shotList) ? idea.shotList : undefined,
          audioSuggestion: typeof idea?.audioSuggestion === 'string' ? idea.audioSuggestion.trim() : undefined,
          formatType: typeof idea?.formatType === 'string' ? idea.formatType.trim() : '',
          platform: typeof idea?.platform === 'string' ? idea.platform.trim() : '',
          trendingAngle: typeof idea?.trendingAngle === 'string' ? idea.trendingAngle.trim() : undefined,
          duration: typeof idea?.duration === 'number' ? idea.duration : undefined,
        };

        if (!cleaned.hook || !cleaned.formatType || !cleaned.platform || !cleaned.script) continue;
        const k = ideaKey(cleaned);
        if (!k || seen.has(k)) continue;

        seen.add(k);
        merged.push(cleaned);
        addedCount += 1;
      }

      const nextDraftPlan = {
        ...(session.session_data?.draftPlan ?? {}),
        contentIdeas: merged,
      };

      const nextSessionData = {
        ...(session.session_data ?? {}),
        draftPlan: nextDraftPlan,
        lastUpdated: new Date().toISOString(),
      };

      await supabase
        .from('ai_sessions')
        .update({ session_data: nextSessionData })
        .eq('id', session.id);

      return new Response(
        JSON.stringify({
          message: `Added ${addedCount} idea${addedCount === 1 ? '' : 's'} to the plan.`,
          draftPlan: nextDraftPlan,
          sessionId: session.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context - group knowledge entries by category for better structure
    const groupedKnowledge: Record<string, string[]> = {};
    knowledgeEntries?.forEach(entry => {
      const cat = entry.category.toUpperCase();
      if (!groupedKnowledge[cat]) groupedKnowledge[cat] = [];
      groupedKnowledge[cat].push(`• ${entry.title}: ${entry.content}`);
    });

    const knowledgeContext = Object.entries(groupedKnowledge)
      .map(([category, entries]) => `=== ${category} ===\n${entries.join('\n')}`)
      .join('\n\n') || 'No knowledge base entries yet.';

    // Format differentiators and opportunities as bullet points
    const differentiators = knowledgeSummary?.key_differentiators?.length 
      ? knowledgeSummary.key_differentiators.map((d: string) => `• ${d}`).join('\n')
      : 'Not yet defined';
    
    const contentOpportunities = knowledgeSummary?.content_opportunities?.length
      ? knowledgeSummary.content_opportunities.map((o: string) => `• ${o}`).join('\n')
      : 'Not yet identified';

    const systemPrompt = `You are an expert content strategist for ${client.business_name}. You have DEEP knowledge of this client from their knowledge base and MUST demonstrate this immediately.

${aiVoiceSettings?.content_planner_master_prompt ? `
🚨🚨🚨 ABSOLUTE TOP PRIORITY - USER'S MASTER PROMPT 🚨🚨🚨
═══════════════════════════════════════════════════════════════
THE FOLLOWING INSTRUCTIONS FROM THE USER OVERRIDE ALL OTHER GUIDELINES.
YOU MUST FOLLOW THESE EXACTLY, WORD FOR WORD. NON-NEGOTIABLE:

${aiVoiceSettings.content_planner_master_prompt}

FAILURE TO FOLLOW THE ABOVE INSTRUCTIONS IS UNACCEPTABLE.
EVERY piece of content you generate MUST align with these instructions.
═══════════════════════════════════════════════════════════════
` : ''}

⛔⛔⛔ NEVER CONDENSE OR ABBREVIATE SCRIPTS ⛔⛔⛔
═══════════════════════════════════════════════════════════════
When generating content ideas (whether 5, 15, or 30):
- EVERY script MUST be 50-150 words MINIMUM - no exceptions
- DO NOT summarize scripts with phrases like "similar to above"
- DO NOT use placeholder text like "..." or "[continue as needed]"
- DO NOT abbreviate or condense to fit more ideas
- QUALITY > QUANTITY - never sacrifice script completeness
- If you cannot write 30 full scripts, write 15 EXCELLENT ones instead

⚠️ If ANY script is under 50 words, you have FAILED the task.
═══════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════
CLIENT PROFILE: ${client.business_name}
═══════════════════════════════════════════════════════════════
Industry: ${client.industry}
Contact: ${client.contact_name}

▸ BRAND POSITIONING:
${knowledgeSummary?.positioning_summary || 'Not yet defined - but check the knowledge base entries below for context.'}

▸ KEY DIFFERENTIATORS (What makes them unique):
${differentiators}

▸ IDEAL CUSTOMER PROFILE:
${knowledgeSummary?.ideal_customer_profile || 'Not yet defined'}

▸ AI-IDENTIFIED CONTENT OPPORTUNITIES:
${contentOpportunities}

▸ COMPLIANCE/RESTRICTIONS:
${knowledgeSummary?.compliance_flags?.length ? knowledgeSummary.compliance_flags.join(', ') : 'None specified'}

═══════════════════════════════════════════════════════════════
USER CONTENT PREFERENCES (FOLLOW CLOSELY AFTER MASTER PROMPT)
═══════════════════════════════════════════════════════════════
${aiVoiceSettings?.preferred_formats?.length ? `▸ PREFERRED FORMATS: ${aiVoiceSettings.preferred_formats.join(', ')}\n  → Prioritize these formats when suggesting content ideas` : ''}
${aiVoiceSettings?.preferred_platforms?.length ? `▸ PREFERRED PLATFORMS: ${aiVoiceSettings.preferred_platforms.join(', ')}\n  → Focus content for these platforms first` : ''}
${aiVoiceSettings?.preferred_hooks_style ? `▸ HOOK STYLE: ${aiVoiceSettings.preferred_hooks_style}\n  → Use this style when crafting hooks (question-based, bold statement, story opener, etc.)` : ''}
${aiVoiceSettings?.content_themes?.length ? `▸ CONTENT THEMES TO FOCUS ON: ${aiVoiceSettings.content_themes.join(', ')}\n  → Incorporate these themes into content suggestions` : ''}
${!aiVoiceSettings?.content_planner_master_prompt && !aiVoiceSettings?.preferred_formats?.length && !aiVoiceSettings?.preferred_platforms?.length ? 'No user preferences set - use your best judgment based on the client knowledge base.' : ''}

═══════════════════════════════════════════════════════════════
FULL KNOWLEDGE BASE
═══════════════════════════════════════════════════════════════
${knowledgeContext}

═══════════════════════════════════════════════════════════════
CRITICAL INSTRUCTIONS - READ CAREFULLY
═══════════════════════════════════════════════════════════════

 1. IN YOUR FIRST RESPONSE, YOU MUST:
    - Open by stating 2-3 specific things you know about ${client.business_name} from the knowledge base above
    - Reference their specific products, services, or unique selling points BY NAME
    - Mention their target audience with specifics (demographics, pain points)
    - Propose 5-10 initial short-form content ideas based on their differentiators

 2. WHEN USER ASKS FOR A FULL CONTENT PLAN OR 30 IDEAS:
    - Generate a MAXIMUM of 10 content ideas per response (batching is REQUIRED to maintain full scripts)
    - If the user requests more than 10, generate the first 10 and instruct them to reply "Next 10" for the next batch
    - Each idea MUST still include a complete script (50-150 words minimum)
    - Always include a single \`\`\`json fenced block containing the plan data for this batch

3. DO NOT:
   - Ask generic questions like "What are your goals?" or "Tell me about your business"
   - Say "I don't have information about..." when the knowledge base is available above
   - Give vague or one-size-fits-all advice
   - Wait to be told what to do - be proactive with specific suggestions

3. ALWAYS:
   - Quote or reference specific details from the knowledge base
   - Tailor every suggestion to their industry, audience, and positioning
   - Use the "Content Opportunities" above as a starting point for ideas
   - Be specific with hooks, formats, and shot lists

═══════════════════════════════════════════════════════════════
EXAMPLE OF A GOOD FIRST RESPONSE
═══════════════════════════════════════════════════════════════
"I've reviewed ${client.business_name}'s knowledge base and here's what I understand:

• You specialize in [SPECIFIC SERVICE/PRODUCT from knowledge base]
• Your target audience is [SPECIFIC AUDIENCE from knowledge base] who struggle with [PAIN POINT]
• Your key differentiator is [SPECIFIC USP from knowledge base]

Based on this, here are 5 short-form content ideas tailored to your positioning:

1. **Hook:** "[Specific hook referencing their USP]"
   Format: [talking_head/tutorial/etc] | Platform: TikTok/Reels
   Why it works: [Reference to their audience's pain point]

2. **Hook:** "[Another specific hook]"
   ...

Which of these directions resonates most? Or I can generate a full filming day plan if you'd like."

═══════════════════════════════════════════════════════════════
JSON OUTPUT FORMAT (When generating filming plans)
═══════════════════════════════════════════════════════════════

⚠️⚠️⚠️ MANDATORY SCRIPT REQUIREMENT ⚠️⚠️⚠️
The "script" field is the MOST IMPORTANT field. It MUST contain:
- A COMPLETE word-for-word script (50-150 words minimum per idea)
- NOT just a hook or single sentence - that goes in the "hook" field
- Structure: [HOOK] opening, [MAIN] body content, [CTA] call to action
- Timing cues in parentheses: (pause), (show product), (gesture)
- On-screen text in brackets: [TEXT: Follow for more]

❌ WRONG (DO NOT DO THIS):
"script": "This is where your project goes to die"
"script": "Ask this question to reveal red flags"

✅ CORRECT (DO THIS):
"script": "[HOOK] This is where your project goes to die. [MAIN] Let me show you exactly what I mean. (gesture to screen) See this section right here? This is your clash zone. When your plumber says one thing and your electrician says another, this is where it all falls apart. I see this in 90% of the builds I review. The fix? Get a single point of coordination before you start. [TEXT: Save this for your next project] [CTA] Follow for more tips that actually save you money on your build."

When ready to output a structured plan, use this JSON format:

\`\`\`json
{
  "filmingDays": [
    {
      "suggestedDate": "YYYY-MM-DD",
      "location": "string",
      "callTime": "HH:MM",
      "wrapTime": "HH:MM",
      "equipment": ["list", "of", "equipment"],
      "notes": "string"
    }
  ],
  "contentIdeas": [
    {
      "script": "[HOOK] Opening line that grabs attention. [MAIN] Full spoken content with all key points, transitions, and details. Include timing cues (pause) and gestures (point to X). This should be 50-150 words minimum - a complete teleprompter-ready script. [TEXT: On-screen text suggestions] [CTA] Clear call to action with specific instruction.",
      "hook": "Short 1-line preview of the hook for display purposes",
      "formatType": "talking_head|pov|tutorial|broll_montage|behind_the_scenes|before_after|day_in_the_life|storytime|comparison|myth_busting",
      "platform": "tiktok|instagram_reels|youtube_shorts",
      "trendingAngle": "What makes this timely or relevant now",
      "shotList": ["Shot 1: Camera angle and framing", "Shot 2: B-roll or transition", "Shot 3: Final shot setup"],
      "duration": 30,
      "audioSuggestion": "trending_sound|original_voiceover|emotional_music"
    }
  ]
}
\`\`\`

═══════════════════════════════════════════════════════════════
COMPLETE EXAMPLE OF A CONTENT IDEA WITH FULL SCRIPT
═══════════════════════════════════════════════════════════════

{
  "script": "[HOOK] Stop scrolling if you're about to renovate your bathroom. [MAIN] I've seen hundreds of bathroom renovations go wrong, and it always comes down to this one thing: the waterproofing. (move closer to camera) Here's what most people don't know - your tiler is NOT a waterproofer. They might offer to do it, but it's a completely different trade. (hold up two fingers) You need two separate sign-offs: one from your waterproofer, one from your tiler. (shake head) Skip this step and you're looking at $15,000 in repairs when water starts leaking through your floor. [TEXT: Save this before you renovate] [CTA] Follow for more renovation tips that'll save you thousands.",
  "hook": "Stop scrolling if you're about to renovate your bathroom",
  "formatType": "talking_head",
  "platform": "tiktok",
  "trendingAngle": "Renovation horror stories always perform well",
  "shotList": ["Close-up talking head, eye level", "Cut to hands showing two fingers", "Back to talking head for CTA"],
  "duration": 45,
  "audioSuggestion": "original_voiceover"
}

Remember: You already have the knowledge. Use it. Be specific. Be proactive. ALWAYS INCLUDE FULL SCRIPTS.`;

     console.log('AI voice settings applied:', { hasMasterPrompt: !!aiVoiceSettings?.content_planner_master_prompt, masterPromptLength: aiVoiceSettings?.content_planner_master_prompt?.length ?? 0, preferredFormats: aiVoiceSettings?.preferred_formats ?? [], preferredPlatforms: aiVoiceSettings?.preferred_platforms ?? [] });

     // Add the new user message
    conversationHistory.push({
      role: 'user',
      content: message
    });

    console.log('Calling Lovable AI for content session...');

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-pro',
        max_tokens: 16384,
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'API credits exhausted. Please add funds to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('AI request failed');
    }

    // Read response as text first to handle potential truncation
    const responseText = await response.text();
    console.log('AI response length:', responseText.length);
    
    let aiResponse;
    try {
      aiResponse = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Response preview:', responseText.slice(0, 500));
      console.error('Response end:', responseText.slice(-500));
      
      // Try to salvage partial response if it's truncated JSON
      // Common pattern: response cut off mid-content
      return new Response(
        JSON.stringify({ 
          error: 'The AI response was too large and got truncated. Try asking for fewer ideas (10-15 at a time) or ask for ideas in batches.',
          suggestion: 'Try: "Give me 10 content ideas first, then I\'ll ask for more"'
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const assistantMessage = aiResponse.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      console.error('No content in AI response:', JSON.stringify(aiResponse));
      throw new Error('No response from AI');
    }

    // Add assistant response to history
    conversationHistory.push({
      role: 'assistant',
      content: assistantMessage
    });

    // Try to extract JSON plan from response
    let newDraftPlan = null;
    const jsonMatch = assistantMessage.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      try {
        newDraftPlan = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.log('Could not parse JSON from response');
      }
    }

    // COMPOUND new ideas with existing ideas (don't overwrite!)
    const existingDraftPlan = session?.session_data?.draftPlan || {};
    const existingIdeas = Array.isArray(existingDraftPlan.contentIdeas) ? existingDraftPlan.contentIdeas : [];
    const newIdeas = Array.isArray(newDraftPlan?.contentIdeas) ? newDraftPlan.contentIdeas : [];

    // Dedupe by platform|formatType|hook key
    const normalize = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
    const ideaKey = (idea: any) => `${normalize(idea?.platform)}|${normalize(idea?.formatType)}|${normalize(idea?.hook)}`;
    const seen = new Set<string>(existingIdeas.map(ideaKey));

    const mergedIdeas = [...existingIdeas];
    for (const idea of newIdeas) {
      const k = ideaKey(idea);
      if (!k || seen.has(k)) continue;
      // Validate idea has required fields
      if (!idea?.hook || !idea?.platform || !idea?.formatType || !idea?.script) continue;
      seen.add(k);
      mergedIdeas.push(idea);
    }

    // Build the merged draft plan (compound, up to 100+ ideas)
    const mergedDraftPlan = newDraftPlan 
      ? { ...existingDraftPlan, ...newDraftPlan, contentIdeas: mergedIdeas }
      : existingDraftPlan;

    // Update or create session
    const sessionData = {
      messages: conversationHistory,
      draftPlan: mergedDraftPlan,
      lastUpdated: new Date().toISOString()
    };

    // Auto-generate title from first user message if session doesn't have one
    let autoTitle = null;
    if (session && (!session.title || session.title.includes('Session'))) {
      // Get first user message to create title
      const firstUserMessage = conversationHistory.find((m: any) => m.role === 'user')?.content || '';
      if (firstUserMessage) {
        // Extract first ~50 chars as title, clean up
        autoTitle = firstUserMessage
          .replace(/I need to plan a filming day for .+?\./i, '')
          .trim()
          .slice(0, 50)
          .trim();
        
        // If too short, use a better default
        if (autoTitle.length < 10) {
          autoTitle = `Plan for ${client.business_name}`;
        } else if (autoTitle.length === 50) {
          autoTitle = autoTitle + '...';
        }
      }
    }

    if (session) {
      const updateData: any = { session_data: sessionData };
      if (autoTitle) {
        updateData.title = autoTitle;
      }
      
      await supabase
        .from('ai_sessions')
        .update(updateData)
        .eq('id', session.id);
    }

    console.log('Session updated with auto-title:', autoTitle || session?.title);

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        draftPlan: mergedDraftPlan,
        sessionId: session?.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-content-session:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
