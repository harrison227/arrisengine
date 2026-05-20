/**
 * Generate hashtags via Gemini.
 *
 * Contract preserved:
 *   Request:  { clientId, title?, caption? }
 *   Response: { hashtags: string[] }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { notFound } from '../_shared/errors.ts';
import { ensureOptionalString, ensureUuid } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { requireClientAccess } from '../_shared/auth.ts';
import { callGemini } from '../_shared/gemini.ts';

interface RequestBody { clientId: unknown; title?: unknown; caption?: unknown }

const SYSTEM_PROMPT = `You are a social media expert. Generate 3-7 relevant hashtags for a social media post.

The hashtags should be:
- Relevant to the business and industry
- A mix of popular and niche hashtags
- In the correct format (lowercase, no spaces within hashtags)
- Engaging and likely to increase reach

Respond with ONLY a JSON array of hashtags, nothing else. Example: ["#marketing", "#socialmedia", "#business"]`;

Deno.serve(withErrorHandling({ fn: 'generate-hashtags' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const clientId = ensureUuid('clientId', body.clientId);
  const title = ensureOptionalString('title', body.title, 500);
  const caption = ensureOptionalString('caption', body.caption, 5_000);

  await requireClientAccess(req, clientId);

  const supabase = getSupabaseAdmin();

  const { data: client } = await supabase
    .from('clients')
    .select('business_name, industry')
    .eq('id', clientId)
    .maybeSingle();
  if (!client) throw notFound('Client not found');

  const { data: knowledgeEntries } = await supabase
    .from('knowledge_entries')
    .select('title, content, category')
    .eq('client_id', clientId)
    .limit(10);

  const knowledgeContext = (knowledgeEntries ?? [])
    .map((entry) => `${entry.category}: ${entry.title} - ${entry.content}`)
    .join('\n') || '';

  const userPrompt = `Generate hashtags for:
Business: ${client.business_name}
Industry: ${client.industry}
${title ? `Title: ${title}` : ''}
${caption ? `Caption: ${caption}` : ''}

Additional context about the business:
${knowledgeContext || 'No additional context available'}`;

  const { text } = await callGemini({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });

  let hashtags: string[];
  try {
    const parsed = JSON.parse(text.trim());
    hashtags = Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === 'string') : [];
  } catch {
    hashtags = (text.match(/#\w+/g) ?? []).slice(0, 7);
  }

  log.info('hashtags_generated', { count: hashtags.length });
  return jsonResponse({ hashtags });
}));
