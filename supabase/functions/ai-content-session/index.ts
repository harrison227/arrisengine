/**
 * AI content-planning chat session.
 *
 * Three flows on this single endpoint:
 *   - default chat: append user message, call Gemini, persist conversation
 *   - action: 'append_ideas' — merge a user-supplied list of ideas into
 *     the session's draft plan without calling the AI
 *   - action: 'generate' / 'chat' — same as default for legacy callers
 *
 * Auth: an Authorization header is required to associate the session
 * with the calling user (and unlock the AI voice settings). Missing
 * auth degrades gracefully — read-only operations still work.
 *
 * Contract preserved:
 *   Request:  { sessionId?, clientId, message?, action?, ideas? }
 *   Response: { message, draftPlan, sessionId } | { error }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { badRequest, forbidden, notFound, rateLimited, unauthorized, upstream } from '../_shared/errors.ts';
import { ensureEnum, ensureOptionalArray, ensureOptionalEnum, ensureOptionalString, ensureOptionalUuid, ensureUuid, sanitizeString } from '../_shared/validation.ts';
import { getSupabaseAdmin, getSupabaseUser, getUserIdFromAuth } from '../_shared/supabase.ts';
import { requireClientAccess } from '../_shared/auth.ts';
import { requireEnv } from '../_shared/env.ts';
import { timeoutSignal } from '../_shared/retry.ts';

const ACTIONS = ['append_ideas', 'generate', 'chat'] as const;
type Action = typeof ACTIONS[number];

interface RequestBody {
  sessionId?: unknown;
  clientId: unknown;
  message?: unknown;
  action?: unknown;
  ideas?: unknown;
}

interface IdeaShape {
  hook?: string;
  script?: string;
  shotList?: unknown;
  audioSuggestion?: string;
  formatType?: string;
  platform?: string;
  trendingAngle?: string;
  duration?: number;
}

const normalize = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '');
const ideaKey = (idea: IdeaShape) => `${normalize(idea?.platform)}|${normalize(idea?.formatType)}|${normalize(idea?.hook)}`;

Deno.serve(withErrorHandling({ fn: 'ai-content-session' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const sessionId = ensureOptionalUuid('sessionId', body.sessionId);
  const clientId = ensureUuid('clientId', body.clientId);
  const messageRaw = ensureOptionalString('message', body.message, 50_000);
  const action = ensureOptionalEnum<Action>('action', body.action, ACTIONS);
  const ideas = body.ideas !== undefined && body.ideas !== null
    ? ensureOptionalArray('ideas', body.ideas, (item) => item, { max: 100 })
    : undefined;
  const sanitizedMessage = messageRaw ? sanitizeString(messageRaw, 50_000) : '';

  await requireClientAccess(req, clientId);

  const supabase = getSupabaseAdmin();
  const lovableApiKey = requireEnv('GOOGLE_AI_API_KEY');

  const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
  if (!client) throw notFound('Client not found');

  const [{ data: knowledgeEntries }, { data: knowledgeSummary }] = await Promise.all([
    supabase.from('knowledge_entries').select('*').eq('client_id', clientId),
    supabase.from('knowledge_summary').select('*').eq('client_id', clientId).maybeSingle(),
  ]);

  // Resolve calling user + AI voice settings.
  let aiVoiceSettings: Record<string, unknown> | null = null;
  let authenticatedUserId: string | null = null;
  const userClient = getSupabaseUser(req);
  if (userClient) {
    authenticatedUserId = await getUserIdFromAuth(req);
    if (authenticatedUserId) {
      const { data: settings } = await supabase
        .from('ai_voice_settings')
        .select('*')
        .eq('user_id', authenticatedUserId)
        .maybeSingle();
      if (settings) aiVoiceSettings = settings;
    }
  }

  // Resolve or auto-create session.
  let session: Record<string, unknown> | null = null;
  let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  if (sessionId) {
    const { data: existing } = await supabase.from('ai_sessions').select('*').eq('id', sessionId).maybeSingle();
    if (existing) {
      session = existing;
      const data = (existing.session_data as { messages?: typeof conversationHistory }) ?? {};
      conversationHistory = Array.isArray(data.messages) ? data.messages : [];
    }
  }

  if (!session && authenticatedUserId) {
    const { data: newSession, error: createError } = await supabase
      .from('ai_sessions')
      .insert({
        client_id: clientId,
        user_id: authenticatedUserId,
        session_type: 'filming_plan',
        title: `Chat with ${client.business_name}`,
        status: 'in_progress',
        session_data: { messages: [] },
      })
      .select()
      .single();
    if (createError) throw badRequest('Could not create chat session. Please try again.');
    session = newSession;
  }

  if (!session && !sessionId) throw badRequest('No session available. Please log in and try again.');

  // ---- append_ideas flow (no AI call) ----
  if (action === 'append_ideas') {
    if (!authenticatedUserId) throw unauthorized('You must be logged in to modify a plan.');
    if (!session) throw badRequest('No session found to update. Please start or load a session first.');
    if (session.user_id !== authenticatedUserId) throw forbidden('You do not have permission to modify this session.');
    const incoming = Array.isArray(ideas) ? ideas as IdeaShape[] : [];
    if (incoming.length === 0) throw badRequest('No ideas provided to append.');

    const sessionData = (session.session_data as { draftPlan?: { contentIdeas?: IdeaShape[] } }) ?? {};
    const existingIdeas: IdeaShape[] = sessionData.draftPlan?.contentIdeas ?? [];
    const seen = new Set(existingIdeas.map(ideaKey));
    const merged = [...existingIdeas];
    let added = 0;
    for (const raw of incoming) {
      const cleaned: IdeaShape = {
        hook: typeof raw?.hook === 'string' ? raw.hook.trim() : '',
        script: typeof raw?.script === 'string' ? raw.script.trim() : undefined,
        shotList: Array.isArray(raw?.shotList) ? raw.shotList : undefined,
        audioSuggestion: typeof raw?.audioSuggestion === 'string' ? raw.audioSuggestion.trim() : undefined,
        formatType: typeof raw?.formatType === 'string' ? raw.formatType.trim() : '',
        platform: typeof raw?.platform === 'string' ? raw.platform.trim() : '',
        trendingAngle: typeof raw?.trendingAngle === 'string' ? raw.trendingAngle.trim() : undefined,
        duration: typeof raw?.duration === 'number' ? raw.duration : undefined,
      };
      if (!cleaned.hook || !cleaned.formatType || !cleaned.platform || !cleaned.script) continue;
      const key = ideaKey(cleaned);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(cleaned);
      added++;
    }
    const nextDraftPlan = { ...(sessionData.draftPlan ?? {}), contentIdeas: merged };
    const nextSessionData = { ...(sessionData ?? {}), draftPlan: nextDraftPlan, lastUpdated: new Date().toISOString() };
    await supabase.from('ai_sessions').update({ session_data: nextSessionData }).eq('id', session.id);
    log.info('ideas_appended', { added });
    return jsonResponse({
      message: `Added ${added} idea${added === 1 ? '' : 's'} to the plan.`,
      draftPlan: nextDraftPlan,
      sessionId: session.id,
    });
  }

  // ---- chat / generate flow ----
  if (!sanitizedMessage) throw badRequest('message is required for generation');

  const groupedKnowledge: Record<string, string[]> = {};
  for (const entry of knowledgeEntries ?? []) {
    const cat = (entry.category as string).toUpperCase();
    groupedKnowledge[cat] ??= [];
    groupedKnowledge[cat].push(`• ${entry.title}: ${entry.content}`);
  }
  const knowledgeContext = Object.entries(groupedKnowledge)
    .map(([category, entries]) => `=== ${category} ===\n${entries.join('\n')}`)
    .join('\n\n') || 'No knowledge base entries yet.';

  const differentiators = (knowledgeSummary?.key_differentiators as string[] | undefined)?.length
    ? (knowledgeSummary?.key_differentiators as string[]).map((d) => `• ${d}`).join('\n')
    : 'Not yet defined';
  const contentOpportunities = (knowledgeSummary?.content_opportunities as string[] | undefined)?.length
    ? (knowledgeSummary?.content_opportunities as string[]).map((o) => `• ${o}`).join('\n')
    : 'Not yet identified';

  const masterPromptBlock = aiVoiceSettings?.content_planner_master_prompt ? `

🚨🚨🚨 ABSOLUTE TOP PRIORITY - USER'S MASTER PROMPT 🚨🚨🚨
═══════════════════════════════════════════════════════════════
THE FOLLOWING INSTRUCTIONS FROM THE USER OVERRIDE ALL OTHER GUIDELINES.
YOU MUST FOLLOW THESE EXACTLY, WORD FOR WORD. NON-NEGOTIABLE:

${aiVoiceSettings.content_planner_master_prompt}

FAILURE TO FOLLOW THE ABOVE INSTRUCTIONS IS UNACCEPTABLE.
EVERY piece of content you generate MUST align with these instructions.
═══════════════════════════════════════════════════════════════
` : '';

  const systemPrompt = `You are an expert content strategist for ${client.business_name}. You have DEEP knowledge of this client from their knowledge base and MUST demonstrate this immediately.
${masterPromptBlock}
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
${knowledgeSummary?.positioning_summary ?? 'Not yet defined - but check the knowledge base entries below for context.'}

▸ KEY DIFFERENTIATORS (What makes them unique):
${differentiators}

▸ IDEAL CUSTOMER PROFILE:
${knowledgeSummary?.ideal_customer_profile ?? 'Not yet defined'}

▸ AI-IDENTIFIED CONTENT OPPORTUNITIES:
${contentOpportunities}

▸ COMPLIANCE/RESTRICTIONS:
${(knowledgeSummary?.compliance_flags as string[] | undefined)?.length ? (knowledgeSummary?.compliance_flags as string[]).join(', ') : 'None specified'}

═══════════════════════════════════════════════════════════════
USER CONTENT PREFERENCES (FOLLOW CLOSELY AFTER MASTER PROMPT)
═══════════════════════════════════════════════════════════════
${(aiVoiceSettings?.preferred_formats as string[] | undefined)?.length ? `▸ PREFERRED FORMATS: ${(aiVoiceSettings?.preferred_formats as string[]).join(', ')}\n  → Prioritize these formats when suggesting content ideas` : ''}
${(aiVoiceSettings?.preferred_platforms as string[] | undefined)?.length ? `▸ PREFERRED PLATFORMS: ${(aiVoiceSettings?.preferred_platforms as string[]).join(', ')}\n  → Focus content for these platforms first` : ''}
${aiVoiceSettings?.preferred_hooks_style ? `▸ HOOK STYLE: ${aiVoiceSettings.preferred_hooks_style}\n  → Use this style when crafting hooks (question-based, bold statement, story opener, etc.)` : ''}
${(aiVoiceSettings?.content_themes as string[] | undefined)?.length ? `▸ CONTENT THEMES TO FOCUS ON: ${(aiVoiceSettings?.content_themes as string[]).join(', ')}\n  → Incorporate these themes into content suggestions` : ''}
${!aiVoiceSettings?.content_planner_master_prompt && !(aiVoiceSettings?.preferred_formats as string[] | undefined)?.length && !(aiVoiceSettings?.preferred_platforms as string[] | undefined)?.length ? 'No user preferences set - use your best judgment based on the client knowledge base.' : ''}

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
JSON OUTPUT FORMAT (When generating filming plans)
═══════════════════════════════════════════════════════════════

⚠️⚠️⚠️ MANDATORY SCRIPT REQUIREMENT ⚠️⚠️⚠️
The "script" field is the MOST IMPORTANT field. It MUST contain:
- A COMPLETE word-for-word script (50-150 words minimum per idea)
- NOT just a hook or single sentence - that goes in the "hook" field
- Structure: [HOOK] opening, [MAIN] body content, [CTA] call to action
- Timing cues in parentheses: (pause), (show product), (gesture)
- On-screen text in brackets: [TEXT: Follow for more]

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

Remember: You already have the knowledge. Use it. Be specific. Be proactive. ALWAYS INCLUDE FULL SCRIPTS.`;

  conversationHistory.push({ role: 'user', content: sanitizedMessage });

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemini-2.5-pro',
      max_tokens: 16384,
      messages: [{ role: 'system', content: systemPrompt }, ...conversationHistory],
    }),
    signal: timeoutSignal(180_000),
  });

  if (!response.ok) {
    if (response.status === 429) throw rateLimited('Rate limit exceeded. Please try again later.');
    if (response.status === 402) throw upstream('API credits exhausted. Please add funds to continue.', 402);
    throw upstream('AI request failed', 502);
  }

  const responseText = await response.text();
  let aiResponse: { choices?: Array<{ message?: { content?: string } }> };
  try {
    aiResponse = JSON.parse(responseText);
  } catch (err) {
    log.warn('ai_response_truncated', { length: responseText.length });
    return jsonResponse({
      error: 'The AI response was too large and got truncated. Try asking for fewer ideas (10-15 at a time) or ask for ideas in batches.',
      suggestion: 'Try: "Give me 10 content ideas first, then I\'ll ask for more"',
    }, { status: 422 });
  }

  const assistantMessage = aiResponse.choices?.[0]?.message?.content;
  if (!assistantMessage) throw upstream('No response from AI');

  conversationHistory.push({ role: 'assistant', content: assistantMessage });

  let newDraftPlan: { contentIdeas?: IdeaShape[] } | null = null;
  const jsonMatch = assistantMessage.match(/```json\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    try { newDraftPlan = JSON.parse(jsonMatch[1]); }
    catch (err) { log.warn('plan_parse_failed', { error: err instanceof Error ? err.message : String(err) }); }
  }

  const existingDraftPlan = ((session?.session_data as { draftPlan?: Record<string, unknown> } | undefined)?.draftPlan ?? {}) as Record<string, unknown>;
  const existingIdeas: IdeaShape[] = Array.isArray((existingDraftPlan as { contentIdeas?: IdeaShape[] }).contentIdeas)
    ? (existingDraftPlan as { contentIdeas: IdeaShape[] }).contentIdeas
    : [];
  const newIdeas = Array.isArray(newDraftPlan?.contentIdeas) ? newDraftPlan.contentIdeas : [];

  const seen = new Set<string>(existingIdeas.map(ideaKey));
  const mergedIdeas: IdeaShape[] = [...existingIdeas];
  for (const idea of newIdeas) {
    const k = ideaKey(idea);
    if (!k || seen.has(k)) continue;
    if (!idea?.hook || !idea?.platform || !idea?.formatType || !idea?.script) continue;
    seen.add(k);
    mergedIdeas.push(idea);
  }
  const mergedDraftPlan = newDraftPlan
    ? { ...existingDraftPlan, ...newDraftPlan, contentIdeas: mergedIdeas }
    : existingDraftPlan;

  const sessionData = {
    messages: conversationHistory,
    draftPlan: mergedDraftPlan,
    lastUpdated: new Date().toISOString(),
  };

  let autoTitle: string | null = null;
  if (session && (!session.title || (session.title as string).includes('Session'))) {
    const firstUserMessage = (conversationHistory.find((m) => m.role === 'user')?.content ?? '');
    if (firstUserMessage) {
      autoTitle = firstUserMessage
        .replace(/I need to plan a filming day for .+?\./i, '')
        .trim()
        .slice(0, 50)
        .trim();
      if (autoTitle.length < 10) autoTitle = `Plan for ${client.business_name}`;
      else if (autoTitle.length === 50) autoTitle = `${autoTitle}...`;
    }
  }

  if (session) {
    const updateData: Record<string, unknown> = { session_data: sessionData };
    if (autoTitle) updateData.title = autoTitle;
    await supabase.from('ai_sessions').update(updateData).eq('id', session.id);
  }

  log.info('chat_completed', { sessionId: session?.id, ideas: mergedIdeas.length });

  return jsonResponse({
    message: assistantMessage,
    draftPlan: mergedDraftPlan,
    sessionId: session?.id,
  });
}));
