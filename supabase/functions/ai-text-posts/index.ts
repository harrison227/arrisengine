/**
 * AI text-post chat / rewrite endpoint.
 *
 * Two flows on the same function:
 *   - `action: 'rewrite'` — rewrites a single post in a chosen style.
 *   - default — generates new posts grounded in the client's knowledge base
 *               and (optionally) their top-performing past posts.
 *
 * Contract preserved:
 *   Rewrite:  Request { clientId, platform, action:'rewrite', rewriteStyle, originalContent, customPrompt? }
 *             Response { rewrittenContent }
 *   Generate: Request { clientId, platform, message, guidelines?, conversationHistory?, topPostsContext? }
 *             Response { message, posts: string[] }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { rateLimited, notFound } from '../_shared/errors.ts';
import { ensureArray, ensureEnum, ensureNonEmptyString, ensureOptionalArray, ensureOptionalString, ensureRecord, ensureUuid } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { requireClientAccess } from '../_shared/auth.ts';
import { callAnthropic, type AnthropicMessage } from '../_shared/anthropic.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

interface RequestBody {
  clientId: unknown;
  platform: unknown;
  action?: unknown;
  rewriteStyle?: unknown;
  originalContent?: unknown;
  customPrompt?: unknown;
  message?: unknown;
  guidelines?: unknown;
  conversationHistory?: unknown;
  topPostsContext?: unknown;
}

const REWRITE_STYLES = ['shorter', 'punchier', 'professional', 'emoji', 'custom'] as const;
type RewriteStyle = typeof REWRITE_STYLES[number];

const REWRITE_PROMPTS: Record<RewriteStyle, string> = {
  shorter: 'Rewrite this post to be more concise while keeping the core message. Remove filler words and unnecessary phrases. Keep the same tone.',
  punchier: 'Rewrite this post to be more attention-grabbing and energetic. Add impactful hooks and dynamic language while keeping the message.',
  professional: 'Rewrite this post in a more professional, polished tone. Make it suitable for a business audience while maintaining the core message.',
  emoji: "Add relevant emojis to this post to make it more engaging. Place them strategically but don't overdo it. Keep the original text mostly intact.",
  custom: 'Improve this post.',
};

const PLATFORM_INSTRUCTIONS: Record<string, string> = {
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

const REWRITE_SYSTEM = `You are a social media content editor. Your task is to rewrite posts according to specific instructions.

IMPORTANT: Output ONLY the rewritten post content. No explanations, no quotation marks around the entire response, no prefixes like "Here's the rewritten post:". Just the post itself.`;

interface TopPost { caption?: string; impressions?: number; likes?: number; comments?: number; shares?: number }

Deno.serve(withErrorHandling({ fn: 'ai-text-posts' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const clientId = ensureUuid('clientId', body.clientId);
  const platform = ensureNonEmptyString('platform', body.platform, 50).toLowerCase();
  const action = ensureOptionalString('action', body.action, 50);

  await requireClientAccess(req, clientId);

  const supabase = getSupabaseAdmin();
  const rl = await checkRateLimit({ bucket: 'ai-text-posts', subject: clientId, windowSec: 60, max: 20, supabase });
  if (!rl.allowed) throw rateLimited(`Rate limit exceeded. Please wait ${rl.waitTime} seconds before making another request.`, rl.waitTime);

  if (action === 'rewrite') {
    const rewriteStyle = ensureEnum<RewriteStyle>('rewriteStyle', body.rewriteStyle, REWRITE_STYLES);
    const originalContent = ensureNonEmptyString('originalContent', body.originalContent, 50_000);
    const customPrompt = ensureOptionalString('customPrompt', body.customPrompt, 5_000);
    const promptText = rewriteStyle === 'custom' ? (customPrompt ?? REWRITE_PROMPTS.custom) : REWRITE_PROMPTS[rewriteStyle];

    const { text } = await callAnthropic({
      system: REWRITE_SYSTEM,
      messages: [{ role: 'user', content: `${promptText}\n\nOriginal post:\n${originalContent}` }],
      maxTokens: 2_048,
    });
    log.info('post_rewritten', { style: rewriteStyle });
    return jsonResponse({ rewrittenContent: text.trim() });
  }

  const message = ensureNonEmptyString('message', body.message, 50_000);
  const guidelines = ensureOptionalString('guidelines', body.guidelines, 50_000);
  const conversationHistory = ensureOptionalArray('conversationHistory', body.conversationHistory, (item, i) => {
    const obj = ensureRecord(`conversationHistory[${i}]`, item);
    return {
      role: ensureEnum(`conversationHistory[${i}].role`, obj.role, ['user', 'assistant'] as const),
      content: ensureNonEmptyString(`conversationHistory[${i}].content`, obj.content, 50_000),
    } as AnthropicMessage;
  }, { max: 200 }) ?? [];
  const topPostsContext = ensureOptionalArray('topPostsContext', body.topPostsContext, (item, i) => {
    const obj = ensureRecord(`topPostsContext[${i}]`, item) as TopPost;
    return obj;
  }, { max: 50 }) ?? [];

  const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
  if (!client) throw notFound('Client not found');

  const { data: knowledgeEntries } = await supabase.from('knowledge_entries').select('*').eq('client_id', clientId);
  const { data: knowledgeSummary } = await supabase.from('knowledge_summary').select('*').eq('client_id', clientId).maybeSingle();

  const grouped: Record<string, string[]> = {};
  for (const entry of knowledgeEntries ?? []) {
    const cat = (entry.category as string).toUpperCase();
    grouped[cat] ??= [];
    grouped[cat].push(`• ${entry.title}: ${entry.content}`);
  }
  const knowledgeContext = Object.entries(grouped)
    .map(([category, entries]) => `=== ${category} ===\n${entries.join('\n')}`)
    .join('\n\n') || 'No knowledge base entries yet.';

  const platformSection = PLATFORM_INSTRUCTIONS[platform] ?? '';

  let systemPrompt = `You are an expert content writer specializing in ${platform.toUpperCase()} content for ${client.business_name}.

═══════════════════════════════════════════════════════════════
CLIENT PROFILE: ${client.business_name}
═══════════════════════════════════════════════════════════════
Industry: ${client.industry}
Contact: ${client.contact_name}

▸ BRAND POSITIONING:
${knowledgeSummary?.positioning_summary ?? 'Not yet defined'}

▸ KEY DIFFERENTIATORS:
${(knowledgeSummary?.key_differentiators ?? []).map((d: string) => `• ${d}`).join('\n') || 'Not yet defined'}

▸ IDEAL CUSTOMER PROFILE:
${knowledgeSummary?.ideal_customer_profile ?? 'Not yet defined'}

═══════════════════════════════════════════════════════════════
KNOWLEDGE BASE
═══════════════════════════════════════════════════════════════
${knowledgeContext}
`;

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

  if (topPostsContext.length > 0) {
    const list = topPostsContext.map((p, i) => {
      const captionFull = p.caption ?? 'No caption';
      const caption = captionFull.length > 200 ? `${captionFull.slice(0, 200)}...` : captionFull;
      return `\n${i + 1}. "${caption}"\n   📊 Impressions: ${(p.impressions ?? 0).toLocaleString()} | ❤️ Likes: ${(p.likes ?? 0).toLocaleString()} | 💬 Comments: ${(p.comments ?? 0).toLocaleString()} | 🔄 Shares: ${(p.shares ?? 0).toLocaleString()}`;
    }).join('\n');
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

TOP POSTS:${list}
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

  const messages: AnthropicMessage[] = [
    ...conversationHistory,
    { role: 'user', content: message },
  ];

  const { text } = await callAnthropic({ system: systemPrompt, messages, maxTokens: 8_192 });

  const posts: string[] = [];
  for (const match of text.matchAll(/---POST \d+---\s*([\s\S]*?)(?=---POST \d+---|$)/g)) {
    const post = match[1].trim();
    if (post) posts.push(post);
  }

  log.info('text_posts_generated', { platform, posts: posts.length });
  return jsonResponse({ message: text, posts });
}));
