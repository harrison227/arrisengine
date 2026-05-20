/**
 * Generate a 30-day content plan for a client and persist it as a single
 * content_plans row whose `brief` field is the JSON-serialised idea list
 * (matching the format produced by ai-content-session).
 *
 * Contract preserved:
 *   Request:  { clientId, clientName?, industry? }
 *   Response: { success, plansCreated, ideasCount, plans: [...] }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { upstream } from '../_shared/errors.ts';
import { ensureOptionalString, ensureUuid } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { requireClientAccess } from '../_shared/auth.ts';
import { requireEnv } from '../_shared/env.ts';
import { timeoutSignal } from '../_shared/retry.ts';

interface RequestBody { clientId: unknown; clientName?: unknown; industry?: unknown }

const GEMINI_TOOL_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

interface AiPlan {
  title: string;
  brief: string;
  filming_date: string;
  content_pieces: Array<{ concept: string; hook: string; content_type: string; platform: string }>;
}

Deno.serve(withErrorHandling({ fn: 'generate-content-strategy' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const clientId = ensureUuid('clientId', body.clientId);
  const clientName = ensureOptionalString('clientName', body.clientName, 500) ?? 'Unknown';
  const industry = ensureOptionalString('industry', body.industry, 500) ?? 'General';

  await requireClientAccess(req, clientId);

  const supabase = getSupabaseAdmin();
  const apiKey = requireEnv('GOOGLE_AI_API_KEY');

  const { data: knowledgeEntries } = await supabase.from('knowledge_entries').select('*').eq('client_id', clientId);
  const knowledgeContext = (knowledgeEntries ?? [])
    .map((e) => `## ${(e.category as string).toUpperCase()}: ${e.title}\n${e.content}`)
    .join('\n\n');

  const today = new Date();
  const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const aiResponse = await fetch(GEMINI_TOOL_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `You are an expert content strategist creating a 30-day content plan for a client.

Based on the client's knowledge base, create content plans that:
- Are tailored to their brand voice and target audience
- Include a variety of content types (video, carousel, story, reel, ugc)
- Have engaging hooks and clear concepts
- Are scheduled across the month with optimal posting times
- Target appropriate platforms (TikTok, Instagram, YouTube, LinkedIn, Facebook)

Today's date is ${today.toISOString().split('T')[0]}.
Create plans spread across the next 30 days ending ${thirtyDays.toISOString().split('T')[0]}.`,
        },
        {
          role: 'user',
          content: `Create a 30-day content strategy for this client:

Client: ${clientName}
Industry: ${industry}

Knowledge Base:
${knowledgeContext || 'No knowledge base entries available. Create general content suggestions based on the industry.'}

Generate 25-30 content plans with filming dates spread across the month. Include a variety of content types and platforms.`,
        },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'create_content_plans',
          description: 'Create content plans for the next 30 days',
          parameters: {
            type: 'object',
            properties: {
              plans: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    brief: { type: 'string' },
                    filming_date: { type: 'string' },
                    content_pieces: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          concept: { type: 'string' },
                          hook: { type: 'string' },
                          content_type: { type: 'string', enum: ['video', 'image', 'carousel', 'story', 'reel', 'ugc'] },
                          platform: { type: 'string' },
                        },
                        required: ['concept', 'hook', 'content_type', 'platform'],
                      },
                    },
                  },
                  required: ['title', 'brief', 'filming_date', 'content_pieces'],
                },
              },
            },
            required: ['plans'],
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'create_content_plans' } },
    }),
    signal: timeoutSignal(120_000),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text().catch(() => '');
    log.error('ai_failed', undefined, { status: aiResponse.status, body: errText.slice(0, 500) });
    throw upstream('AI strategy generation failed', 502);
  }
  const aiData = await aiResponse.json() as { choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }> };
  const toolArgs = aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  let plans: AiPlan[] = [];
  if (toolArgs) {
    try { plans = (JSON.parse(toolArgs) as { plans?: AiPlan[] }).plans ?? []; }
    catch (err) { log.warn('tool_args_parse_failed', { error: err instanceof Error ? err.message : String(err) }); }
  }

  const contentIdeas = plans.map((plan) => ({
    hook: plan.title,
    script: plan.brief,
    formatType: plan.content_pieces?.[0]?.content_type ?? 'video',
    platform: plan.content_pieces?.map((p) => p.platform) ?? ['instagram'],
    duration: 60,
    contentPieces: plan.content_pieces,
  }));

  const planTitle = `${clientName} - 30 Day Content Strategy`;
  const { data: contentPlan, error: planError } = await supabase
    .from('content_plans')
    .insert({
      client_id: clientId,
      title: planTitle,
      brief: JSON.stringify(contentIdeas),
      filming_date: null,
      status: 'planning',
    })
    .select()
    .single();
  if (planError) throw new Error(planError.message);

  log.info('content_strategy_persisted', { ideas: contentIdeas.length });

  return jsonResponse({
    success: true,
    plansCreated: 1,
    ideasCount: contentIdeas.length,
    plans: [contentPlan],
  });
}));
