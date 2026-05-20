/**
 * Generate 5 creative ad-angle suggestions and persist them.
 *
 * Contract preserved:
 *   Request:  { clientId, clientName?, industry? }
 *   Response: { success, suggestions: [...] }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { upstream } from '../_shared/errors.ts';
import { ensureOptionalString, ensureUuid } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { requireClientAccess } from '../_shared/auth.ts';
import { callGemini } from '../_shared/gemini.ts';

const SYSTEM_PROMPT = `You are an expert digital advertising strategist. Generate 5 creative ad angle suggestions based on the client's knowledge base and industry.

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

interface RequestBody { clientId: unknown; clientName?: unknown; industry?: unknown }

interface RawSuggestion {
  hook?: string;
  target_emotion?: string;
  format?: string;
  platform?: string;
  description?: string;
}

Deno.serve(withErrorHandling({ fn: 'suggest-ad-angles' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const clientId = ensureUuid('clientId', body.clientId);
  const clientName = ensureOptionalString('clientName', body.clientName, 500) ?? 'Unknown';
  const industry = ensureOptionalString('industry', body.industry, 500) ?? 'Unknown';

  await requireClientAccess(req, clientId);

  const supabase = getSupabaseAdmin();

  const { data: knowledgeEntries, error: kbError } = await supabase
    .from('knowledge_entries')
    .select('title, content, category')
    .eq('client_id', clientId);
  if (kbError) log.warn('knowledge_fetch_failed', { error: kbError.message });

  const kbContext = (knowledgeEntries ?? [])
    .map((e) => `[${(e.category as string).toUpperCase()}] ${e.title}: ${e.content}`)
    .join('\n\n') || 'No knowledge base entries available.';

  const userPrompt = `Client: ${clientName}
Industry: ${industry}

Knowledge Base Context:
${kbContext}

Generate 5 unique and creative ad angle suggestions for this client.`;

  const { text } = await callGemini({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });

  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  let suggestions: RawSuggestion[];
  try {
    suggestions = JSON.parse(cleaned);
  } catch (err) {
    log.error('parse_failed', err, { head: cleaned.slice(0, 200) });
    throw upstream('Failed to parse AI response as JSON');
  }
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    throw upstream('Invalid suggestions format from AI');
  }

  const insertData = suggestions.slice(0, 5).map((s) => ({
    client_id: clientId,
    hook: s.hook ?? 'Untitled Hook',
    target_emotion: s.target_emotion ?? 'curiosity',
    format: s.format ?? 'video',
    platform: s.platform ?? 'Meta',
    description: s.description ?? '',
  }));

  // Replace existing suggestions for the client.
  await supabase.from('ad_suggestions').delete().eq('client_id', clientId);
  const { data: inserted, error: insertError } = await supabase.from('ad_suggestions').insert(insertData).select();
  if (insertError) {
    log.error('suggestions_insert_failed', insertError);
    throw new Error('Failed to save suggestions to database');
  }

  log.info('suggestions_generated', { count: inserted?.length ?? 0 });
  return jsonResponse({ success: true, suggestions: inserted ?? [] });
}));
