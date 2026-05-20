/**
 * Generate or refine a single content idea via Gemini.
 *
 * Contract preserved:
 *   Request:  { prompt, clientContext?, existingIdea? }
 *   Response: { idea: { hook, script, platform[], formatType, duration, shotList[], audioSuggestion } }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { upstream } from '../_shared/errors.ts';
import { ensureNonEmptyString, ensureOptionalString, ensureRecord } from '../_shared/validation.ts';
import { requireUser } from '../_shared/auth.ts';
import { callGemini } from '../_shared/gemini.ts';

const SYSTEM_PROMPT_BASE = `You are a flexible content strategist. Generate a single content idea based on the user's prompt.

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

interface RequestBody { prompt: unknown; clientContext?: unknown; existingIdea?: unknown }

Deno.serve(withErrorHandling({ fn: 'generate-single-idea' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const promptText = ensureNonEmptyString('prompt', body.prompt, 5_000);
  const clientContext = ensureOptionalString('clientContext', body.clientContext, 50_000);
  const existingIdea = body.existingIdea ? ensureRecord('existingIdea', body.existingIdea) : undefined;

  // No clientId on this endpoint — clientContext is supplied by the caller —
  // so we just gate on a logged-in user to prevent anon credit burn.
  await requireUser(req);

  let systemPrompt = SYSTEM_PROMPT_BASE;
  if (clientContext) systemPrompt += `\n\nClient Context:\n${clientContext}`;

  let userPrompt = promptText;
  if (existingIdea) {
    const platforms = Array.isArray(existingIdea.platform)
      ? (existingIdea.platform as unknown[]).join(', ')
      : String(existingIdea.platform ?? '');
    userPrompt = `Modify this content idea based on the user's guidance: "${promptText}"

Current idea:
- Hook: ${existingIdea.hook ?? ''}
- Script: ${existingIdea.script ?? 'None'}
- Platform: ${platforms}
- Format: ${existingIdea.formatType ?? ''}

IMPORTANT: Follow the user's guidance closely. If they provide a specific script or style, use it.
Do NOT automatically make it "more punchy" or "more viral" unless specifically asked.`;
  }

  const { text } = await callGemini({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const cleaned = text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  let idea: Record<string, unknown>;
  try {
    idea = JSON.parse(cleaned);
  } catch (err) {
    log.error('parse_failed', err, { head: cleaned.slice(0, 200) });
    throw upstream('Failed to parse AI response as JSON');
  }

  const validated = {
    hook: typeof idea.hook === 'string' && idea.hook ? idea.hook : 'Generated content idea',
    script: typeof idea.script === 'string' ? idea.script : '',
    platform: Array.isArray(idea.platform) ? idea.platform : [idea.platform || 'Instagram'],
    formatType: typeof idea.formatType === 'string' ? idea.formatType : 'Talking Head',
    duration: typeof idea.duration === 'number' ? idea.duration : 60,
    shotList: Array.isArray(idea.shotList) ? idea.shotList : [],
    audioSuggestion: typeof idea.audioSuggestion === 'string' ? idea.audioSuggestion : '',
  };

  log.info('idea_generated', { hook: validated.hook });
  return jsonResponse({ idea: validated });
}));
