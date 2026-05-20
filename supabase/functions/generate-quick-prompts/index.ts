/**
 * Generate optimised image prompts from short concept descriptions.
 *
 * Contract preserved:
 *   Request:  { clientId, concepts: [{id, description}], styleNotes? }
 *   Response: { prompts: [{id, prompt}] }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { rateLimited, badRequest, upstream } from '../_shared/errors.ts';
import { ensureArray, ensureNonEmptyString, ensureOptionalString, ensureRecord, ensureUuid } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { requireClientAccess } from '../_shared/auth.ts';
import { callAnthropic } from '../_shared/anthropic.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

interface Concept { id: string; description: string }
interface RequestBody { clientId: unknown; concepts: unknown; styleNotes?: unknown }

const SYSTEM_PROMPT_BASE = `You are an expert at crafting detailed, optimized prompts for AI image generation.
Your task is to transform short concept descriptions into rich, detailed prompts that will produce high-quality social media graphics.

Guidelines:
- Include specific visual details (colors, typography style, composition)
- Mention the intended use (social media post, quote card, etc.)
- Add professional styling elements (clean lines, modern design, etc.)
- Reference brand elements when provided
- Keep prompts focused and actionable (100-200 words each)
- Consider each concept's unique requirements`;

Deno.serve(withErrorHandling({ fn: 'generate-quick-prompts' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const clientId = ensureUuid('clientId', body.clientId);
  const concepts = ensureArray<Concept>('concepts', body.concepts, (c, i) => {
    const obj = ensureRecord(`concepts[${i}]`, c);
    return {
      id: ensureNonEmptyString(`concepts[${i}].id`, obj.id, 200),
      description: ensureNonEmptyString(`concepts[${i}].description`, obj.description, 5_000),
    };
  }, { min: 1, max: 50 });
  const styleNotes = ensureOptionalString('styleNotes', body.styleNotes, 5_000);

  await requireClientAccess(req, clientId);

  const supabase = getSupabaseAdmin();
  const rl = await checkRateLimit({ bucket: 'generate-quick-prompts', subject: clientId, windowSec: 60, max: 15, supabase });
  if (!rl.allowed) throw rateLimited(`Rate limit exceeded. Please wait ${rl.waitTime} seconds.`, rl.waitTime);

  const [{ data: client }, { data: knowledgeSummary }, { data: knowledgeEntries }] = await Promise.all([
    supabase.from('clients').select('business_name, industry, brand_primary_color, brand_secondary_color, brand_accent_color, brand_fonts, brand_style_notes').eq('id', clientId).maybeSingle(),
    supabase.from('knowledge_summary').select('positioning_summary, key_differentiators, ideal_customer_profile').eq('client_id', clientId).maybeSingle(),
    supabase.from('knowledge_entries').select('title, content, category').eq('client_id', clientId).in('category', ['brand_guidelines', 'visual_identity', 'tone_voice', 'content_pillars']).order('importance', { ascending: false }).limit(10),
  ]);

  const brandGuidelines = (knowledgeEntries ?? []).map((e) => `[${e.category}] ${e.title}: ${e.content}`).join('\n');
  const brandColors = [
    client?.brand_primary_color ? `Primary: ${client.brand_primary_color}` : '',
    client?.brand_secondary_color ? `Secondary: ${client.brand_secondary_color}` : '',
    client?.brand_accent_color ? `Accent: ${client.brand_accent_color}` : '',
  ].filter(Boolean).join(', ');

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

  const systemPrompt = `${SYSTEM_PROMPT_BASE}

${brandContext ? `\nBrand Context:\n${brandContext}` : ''}

You will receive an array of short concept descriptions. For each one, generate an optimized, detailed prompt.
Return a JSON object with a "prompts" array containing objects with "id" and "prompt" fields matching the input order.`;

  const userMessage = `Generate optimized image prompts for these concepts:

${concepts.map((c, i) => `${i + 1}. [ID: ${c.id}] ${c.description}`).join('\n')}

Return valid JSON only, no markdown:
{"prompts": [{"id": "concept-id", "prompt": "detailed prompt here"}, ...]}`;

  const { text } = await callAnthropic({
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens: 4096,
  });

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw upstream('No JSON found in AI response');
  let parsed: { prompts?: Array<{ id?: string; prompt?: string }> };
  try {
    parsed = JSON.parse(match[0]);
  } catch (err) {
    log.error('parse_failed', err, { textHead: text.slice(0, 200) });
    throw badRequest('Failed to parse AI response as JSON');
  }

  log.info('prompts_generated', { count: parsed.prompts?.length ?? 0 });
  return jsonResponse(parsed);
}));
