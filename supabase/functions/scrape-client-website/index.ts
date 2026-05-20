/**
 * Scrape a client's marketing site via Firecrawl: main page + key sub-pages
 * (about / services / products / pricing / team / contact).
 *
 * Contract preserved:
 *   Request:  { url }
 *   Response: { success, data: { mainPage, additionalPages, siteLinks } }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { badRequest, upstream } from '../_shared/errors.ts';
import { ensureNonEmptyString } from '../_shared/validation.ts';
import { requireUser } from '../_shared/auth.ts';
import { requireEnv } from '../_shared/env.ts';
import { timeoutSignal } from '../_shared/retry.ts';
import { isPublicHttpUrl, normalizeUrl } from '../_shared/url-safety.ts';

const FIRECRAWL_BASE = 'https://api.firecrawl.dev/v1';
const KEY_PAGE_KEYWORDS = ['about', 'service', 'product', 'pricing', 'team', 'contact'] as const;

interface RequestBody { url: unknown }

interface FirecrawlScrapeResult {
  success?: boolean;
  data?: { markdown?: string; branding?: unknown; metadata?: Record<string, unknown> };
  error?: string;
}

interface FirecrawlMapResult { links?: string[] }

async function firecrawl(path: string, body: Record<string, unknown>, apiKey: string): Promise<unknown> {
  const res = await fetch(`${FIRECRAWL_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: timeoutSignal(60_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw upstream(`Firecrawl ${path} failed (${res.status}): ${text.slice(0, 300)}`, 502);
  }
  return res.json();
}

Deno.serve(withErrorHandling({ fn: 'scrape-client-website' }, async ({ req, log }) => {
  await requireUser(req);
  const apiKey = requireEnv('FIRECRAWL_API_KEY');
  const body = await parseJsonBody<RequestBody>(req);
  const rawUrl = ensureNonEmptyString('url', body.url, 2_048);

  const formattedUrl = normalizeUrl(rawUrl);
  if (!isPublicHttpUrl(formattedUrl)) throw badRequest('Invalid or private URL — must be a public http(s) URL');

  log.info('scrape_start', { url: formattedUrl });

  const [mapData, scrapeData] = await Promise.all([
    firecrawl('/map', { url: formattedUrl, limit: 20, includeSubdomains: false }, apiKey).catch((err) => {
      log.warn('map_failed', { error: err instanceof Error ? err.message : String(err) });
      return {} as FirecrawlMapResult;
    }) as Promise<FirecrawlMapResult>,
    firecrawl('/scrape', { url: formattedUrl, formats: ['markdown', 'branding'], onlyMainContent: true }, apiKey) as Promise<FirecrawlScrapeResult>,
  ]);

  const siteLinks = (mapData.links ?? []).filter((l): l is string => typeof l === 'string' && isPublicHttpUrl(l));

  const keyPages: string[] = [];
  for (const link of siteLinks) {
    if (keyPages.length >= 5) break;
    const lower = link.toLowerCase();
    if (KEY_PAGE_KEYWORDS.some((k) => lower.includes(k))) keyPages.push(link);
  }

  const additionalContent: Array<{ url: string; markdown: string }> = [];
  for (const pageUrl of keyPages) {
    try {
      const pageData = (await firecrawl('/scrape', { url: pageUrl, formats: ['markdown'], onlyMainContent: true }, apiKey)) as FirecrawlScrapeResult;
      if (pageData.success && pageData.data?.markdown) {
        additionalContent.push({ url: pageUrl, markdown: pageData.data.markdown });
      }
    } catch (err) {
      log.warn('subpage_failed', { url: pageUrl, error: err instanceof Error ? err.message : String(err) });
    }
  }

  log.info('scrape_done', { mainBytes: scrapeData.data?.markdown?.length ?? 0, subPages: additionalContent.length });

  return jsonResponse({
    success: true,
    data: {
      mainPage: {
        url: formattedUrl,
        markdown: scrapeData.data?.markdown ?? '',
        branding: scrapeData.data?.branding ?? null,
        metadata: scrapeData.data?.metadata ?? {},
      },
      additionalPages: additionalContent,
      siteLinks: siteLinks.slice(0, 50),
    },
  });
}));
