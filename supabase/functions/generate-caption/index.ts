/**
 * Generate a single social-media caption via Anthropic.
 *
 * Contract preserved:
 *   Request:  { concept, clientId?, refinement?, existingCaption?, videoTranscript? }
 *   Response: { caption } | { error, ... }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { ensureNonEmptyString, ensureOptionalString, ensureOptionalUuid } from '../_shared/validation.ts';
import { rateLimited } from '../_shared/errors.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { requireUser, requireClientAccess } from '../_shared/auth.ts';
import { callAnthropic } from '../_shared/anthropic.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

interface RequestBody {
  concept: unknown;
  clientId?: unknown;
  refinement?: unknown;
  existingCaption?: unknown;
  videoTranscript?: unknown;
}

const SYSTEM_PROMPT_BASE = `You are an expert social media copywriter who creates engaging, authentic captions for social media posts.

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
- Specific to this brand's messaging`;

Deno.serve(withErrorHandling({ fn: 'generate-caption' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const concept = ensureNonEmptyString('concept', body.concept, 5_000);
  const clientId = ensureOptionalUuid('clientId', body.clientId);
  const refinement = ensureOptionalString('refinement', body.refinement, 5_000);
  const existingCaption = ensureOptionalString('existingCaption', body.existingCaption, 5_000);
  const videoTranscript = ensureOptionalString('videoTranscript', body.videoTranscript, 50_000);

  const supabase = getSupabaseAdmin();

  // Auth gate. Without clientId we still require a logged-in user so this
  // endpoint can't be hit anonymously to burn AI credits. With a clientId,
  // verify the calling user actually has access to that client's data.
  if (clientId) await requireClientAccess(req, clientId);
  else await requireUser(req);

  if (clientId) {
    const rl = await checkRateLimit({ bucket: 'generate-caption', subject: clientId, windowSec: 60, max: 30, supabase });
    if (!rl.allowed) throw rateLimited(`Rate limit exceeded. Please wait ${rl.waitTime} seconds.`, rl.waitTime);
  }

  // Build per-client context.
  let clientContext = '';
  if (clientId) {
    const { data: client } = await supabase
      .from('clients')
      .select('business_name, industry')
      .eq('id', clientId)
      .maybeSingle();
    if (client) clientContext = `\nBrand: ${client.business_name}\nIndustry: ${client.industry}`;

    const { data: knowledge } = await supabase
      .from('knowledge_entries')
      .select('title, content, category')
      .eq('client_id', clientId)
      .limit(10);
    if (knowledge && knowledge.length > 0) {
      clientContext += '\n\nBrand Knowledge:';
      for (const k of knowledge) {
        clientContext += `\n- [${k.category.toUpperCase()}] ${k.title}: ${(k.content ?? '').substring(0, 500)}`;
      }
      log.info('knowledge_loaded', { entries: knowledge.length });
    }
  }

  const refinementInstructions = refinement ? `\n\nUSER GUIDANCE: ${refinement}` : '';
  const existingCaptionContext = existingCaption ? `\n\nEXISTING CAPTION (use as reference or improve upon it): "${existingCaption}"` : '';
  const transcriptContext = videoTranscript?.trim()
    ? `\n\nVIDEO TRANSCRIPT (use this spoken content to inform the caption - reference key themes and messages):\n"${videoTranscript.substring(0, 1500)}"`
    : '';

  const systemPrompt = `${SYSTEM_PROMPT_BASE}${clientContext}${refinementInstructions}`;

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

  const { text } = await callAnthropic({
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    maxTokens: 1024,
  });

  let caption = text.trim();
  if (caption.startsWith('"') && caption.endsWith('"')) caption = caption.slice(1, -1);

  log.info('caption_generated', { conceptLen: concept.length, captionLen: caption.length });
  return jsonResponse({ caption });
}));
