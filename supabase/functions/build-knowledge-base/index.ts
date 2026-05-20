/**
 * Build a knowledge base for a client either by analysing scraped website
 * content (`action` omitted, the default flow), or by analysing existing
 * knowledge entries (`action: 'analyze'`) for high-level brand insights.
 *
 * Contracts preserved:
 *   --- Scrape flow ---
 *   Request:  { clientId, scrapedData, userId? }
 *   Response: { success, entriesCreated, entries[] }
 *
 *   --- Analyse flow ---
 *   Request:  { action: 'analyze', clientName, knowledgeEntries }
 *   Response: { positioning, differentiators[], opportunities[], compliance[], icp }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { badRequest, upstream } from '../_shared/errors.ts';
import { ensureNonEmptyString, ensureOptionalUuid, ensureRecord, ensureUuid, sanitizeString } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { requireClientAccess, requireUser } from '../_shared/auth.ts';
import { callGemini } from '../_shared/gemini.ts';
import { requireEnv } from '../_shared/env.ts';
import { timeoutSignal } from '../_shared/retry.ts';

interface RequestBody {
  clientId?: unknown;
  scrapedData?: unknown;
  userId?: unknown;
  action?: unknown;
  clientName?: unknown;
  knowledgeEntries?: unknown;
}

const VALID_CATEGORIES = ['brand', 'audience', 'competitors', 'offers', 'compliance', 'notes'] as const;
type Category = typeof VALID_CATEGORIES[number];
const GEMINI_TOOL_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

const ANALYSE_SYSTEM = `You are an expert marketing strategist analyzing a client's knowledge base to generate actionable insights.

Based on the knowledge entries provided, generate:
1. A positioning summary (2-3 sentences on how this brand should position itself)
2. Key differentiators (3-5 unique selling points)
3. Content opportunities (3-5 specific content ideas or angles)
4. Compliance flags (any regulatory or legal considerations to keep in mind)
5. Ideal customer profile (brief description of the perfect customer)

Return a JSON object with this structure:
{
  "positioning": "Brief positioning statement...",
  "differentiators": ["Point 1", "Point 2", ...],
  "opportunities": ["Content idea 1", "Content idea 2", ...],
  "compliance": ["Compliance note 1", ...],
  "icp": "Description of ideal customer..."
}

Be specific and actionable. Base everything on the actual knowledge base content provided.`;

const SCRAPE_SYSTEM = `You are an expert marketing strategist analyzing a client's website to build a comprehensive knowledge base.

Extract and categorize information into these categories:
- brand: Company mission, values, unique selling points, brand voice, tone, visual identity
- audience: Target demographics, pain points, desires, customer segments
- competitors: Any mentioned competitors or industry context
- offers: Products/services, pricing, features, packages
- compliance: Industry disclaimers, legal requirements, terms, privacy policies
- notes: Any other relevant insights for content creation

Return a JSON object with this structure:
{
  "entries": [
    { "category": "brand"|"audience"|"competitors"|"offers"|"compliance"|"notes", "title": "...", "content": "..." }
  ]
}

Be thorough but concise. Create 5-15 entries covering all relevant information found.`;

Deno.serve(withErrorHandling({ fn: 'build-knowledge-base' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);

  // ----- analyse flow -----
  if (body.action === 'analyze') {
    const clientName = sanitizeString(ensureNonEmptyString('clientName', body.clientName, 200));
    const knowledgeEntriesText = sanitizeString(ensureNonEmptyString('knowledgeEntries', body.knowledgeEntries, 50_000));

    await requireUser(req);

    const { text } = await callGemini({
      messages: [
        { role: 'system', content: ANALYSE_SYSTEM },
        { role: 'user', content: `Analyze this knowledge base for ${clientName}:\n\n${knowledgeEntriesText}` },
      ],
    });
    const match = text.match(/\{[\s\S]*\}/);
    let result: Record<string, unknown> = {};
    if (match) {
      try { result = JSON.parse(match[0]); } catch { /* preserve legacy soft-failure: return {} */ }
    }
    log.info('analysis_done');
    return jsonResponse(result);
  }

  // ----- scrape flow -----
  const clientId = ensureUuid('clientId', body.clientId);
  const userId = ensureOptionalUuid('userId', body.userId);
  if (!body.scrapedData || typeof body.scrapedData !== 'object' || Array.isArray(body.scrapedData)) {
    throw badRequest('scrapedData is required and must be an object');
  }

  await requireClientAccess(req, clientId);

  const scrapedData = body.scrapedData as { mainPage?: { markdown?: string; branding?: { colors?: Record<string, string>; fonts?: Array<{ family?: string }>; logo?: string } }; additionalPages?: Array<{ url?: string; markdown?: string }> };

  let combinedContent = `# Main Page\n${sanitizeString(scrapedData.mainPage?.markdown ?? '', 30_000)}\n\n`;
  if (Array.isArray(scrapedData.additionalPages)) {
    for (const page of scrapedData.additionalPages.slice(0, 10)) {
      if (page && typeof page.url === 'string' && typeof page.markdown === 'string') {
        combinedContent += `# ${sanitizeString(page.url, 500)}\n${sanitizeString(page.markdown, 10_000)}\n\n`;
      }
    }
  }
  const branding = scrapedData.mainPage?.branding;
  if (branding) {
    combinedContent += `\n# Branding Information\n`;
    combinedContent += `Colors: ${JSON.stringify(branding.colors ?? {})}\n`;
    combinedContent += `Fonts: ${JSON.stringify(branding.fonts ?? [])}\n`;
    combinedContent += `Logo: ${sanitizeString(branding.logo ?? '', 500) || 'Not found'}\n`;
  }

  // We use the function-tool variant directly here because it gives us
  // structured output (`tool_calls`) that the shared callGemini wrapper
  // doesn't currently expose.
  const apiKey = requireEnv('GOOGLE_AI_API_KEY');
  const aiResponse = await fetch(GEMINI_TOOL_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: SCRAPE_SYSTEM },
        { role: 'user', content: `Analyze this website content and extract knowledge base entries:\n\n${combinedContent.slice(0, 50_000)}` },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'create_knowledge_entries',
          description: 'Create knowledge base entries from website analysis',
          parameters: {
            type: 'object',
            properties: {
              entries: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    category: { type: 'string', enum: VALID_CATEGORIES },
                    title: { type: 'string' },
                    content: { type: 'string' },
                  },
                  required: ['category', 'title', 'content'],
                },
              },
            },
            required: ['entries'],
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'create_knowledge_entries' } },
    }),
    signal: timeoutSignal(90_000),
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text().catch(() => '');
    log.error('ai_failed', undefined, { status: aiResponse.status, body: errorText.slice(0, 500) });
    throw upstream('AI analysis failed', 502);
  }
  const aiData = await aiResponse.json() as { choices?: Array<{ message?: { content?: string; tool_calls?: Array<{ function?: { arguments?: string } }> } }> };

  let entries: Array<{ category: Category; title: string; content: string }> = [];
  const toolArgs = aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (toolArgs) {
    try {
      const parsed = JSON.parse(toolArgs) as { entries?: Array<{ category?: string; title?: string; content?: string }> };
      entries = (parsed.entries ?? []).filter((e): e is { category: Category; title: string; content: string } =>
        Boolean(e?.category) && (VALID_CATEGORIES as readonly string[]).includes(e.category as string) &&
        typeof e.title === 'string' && typeof e.content === 'string',
      );
    } catch (err) {
      log.warn('tool_args_parse_failed', { error: err instanceof Error ? err.message : String(err) });
    }
  }
  if (entries.length === 0) {
    const content = aiData.choices?.[0]?.message?.content;
    const m = content?.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const parsed = JSON.parse(m[0]) as { entries?: Array<{ category?: string; title?: string; content?: string }> };
        entries = (parsed.entries ?? []).filter((e): e is { category: Category; title: string; content: string } =>
          Boolean(e?.category) && (VALID_CATEGORIES as readonly string[]).includes(e.category as string) &&
          typeof e.title === 'string' && typeof e.content === 'string',
        );
      } catch (err) {
        log.warn('content_fallback_parse_failed', { error: err instanceof Error ? err.message : String(err) });
      }
    }
  }
  entries = entries.map((e) => ({ category: e.category, title: sanitizeString(e.title, 200), content: sanitizeString(e.content, 5_000) }));

  const supabase = getSupabaseAdmin();
  const insertPayload = entries.map((e) => ({ client_id: clientId, category: e.category, title: e.title, content: e.content, created_by: userId ?? null }));
  if (insertPayload.length > 0) {
    const { error: insertError } = await supabase.from('knowledge_entries').insert(insertPayload);
    if (insertError) throw new Error(insertError.message);
  }

  if (branding) {
    const fonts = Array.isArray(branding.fonts) ? branding.fonts.slice(0, 5).map((f) => sanitizeString(f?.family ?? '', 50)).filter(Boolean).join(', ') : 'Not detected';
    await supabase.from('knowledge_entries').insert({
      client_id: clientId,
      category: 'brand',
      title: 'Visual Brand Identity',
      content: [
        `Primary Color: ${sanitizeString(branding.colors?.primary ?? '', 50) || 'Not detected'}`,
        `Secondary Color: ${sanitizeString(branding.colors?.secondary ?? '', 50) || 'Not detected'}`,
        `Background: ${sanitizeString(branding.colors?.background ?? '', 50) || 'Not detected'}`,
        `Fonts: ${fonts}`,
        `Logo URL: ${sanitizeString(branding.logo ?? '', 500) || 'Not found'}`,
      ].join('\n'),
      created_by: userId ?? null,
    });
  }

  log.info('knowledge_entries_persisted', { count: insertPayload.length, branding: Boolean(branding) });

  return jsonResponse({
    success: true,
    entriesCreated: insertPayload.length + (branding ? 1 : 0),
    entries: insertPayload,
  });
}));
