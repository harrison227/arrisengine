/**
 * Public read of a brand pack via a brand_share_links share id.
 *
 * No auth required. Validates the share link exists, is active, and not
 * expired. Increments view_count + last_viewed_at on each call.
 *
 * Contract:
 *   Request:  { shareId }
 *   Response: { shareLink, client, colors, logos[], fonts[], guidelines[] }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { notFound, rateLimited } from '../_shared/errors.ts';
import { ensureNonEmptyString } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { getBrandShareLink } from '../_shared/share-links.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

interface RequestBody { shareId: unknown }

Deno.serve(withErrorHandling({ fn: 'public-brand-pack' }, async ({ req, log }) => {
  const { shareId: rawShareId } = await parseJsonBody<RequestBody>(req);
  const shareId = ensureNonEmptyString('shareId', rawShareId, 200);

  const supabase = getSupabaseAdmin();

  // Rate limit per share-id. Generous — the page is small and assets are
  // CDN-cached — but prevents a runaway script from spamming the endpoint.
  const rl = await checkRateLimit({ bucket: 'public-brand-pack', subject: shareId, windowSec: 60, max: 120, supabase });
  if (!rl.allowed) throw rateLimited(`Too many requests. Please wait ${rl.waitTime} seconds.`, rl.waitTime);

  const shareLink = await getBrandShareLink(supabase, shareId);

  // Read everything needed for the brand pack page.
  const [clientResult, logosResult, fontsResult, guidelinesResult] = await Promise.all([
    supabase
      .from('client_brand_pack_safe')
      .select('*')
      .eq('client_id', shareLink.client_id)
      .maybeSingle(),
    supabase
      .from('client_logos')
      .select('id, label, variant, background_treatment, file_url, file_format, file_size_bytes, width_px, height_px, is_primary, sort_order, notes')
      .eq('client_id', shareLink.client_id)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true }),
    supabase
      .from('client_brand_fonts')
      .select('id, family_name, role, file_url, file_format, weight, style, source, source_url, fallback_stack, sort_order')
      .eq('client_id', shareLink.client_id)
      .order('role', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase
      .from('client_brand_guidelines')
      .select('id, section, title, content, sort_order')
      .eq('client_id', shareLink.client_id)
      .order('sort_order', { ascending: true }),
  ]);

  if (clientResult.error) throw new Error(clientResult.error.message);
  if (!clientResult.data) throw notFound('Client not found');

  const c = clientResult.data;
  const colors = {
    primary: c.brand_primary_color ?? null,
    secondary: c.brand_secondary_color ?? null,
    accent: c.brand_accent_color ?? null,
    background: c.brand_background_color ?? null,
    text: c.brand_text_color ?? null,
  };

  // Best-effort view tracking. Don't block the response on failure.
  // Supabase query builders return PromiseLike, not Promise — so we pass
  // both onfulfilled and onrejected to .then() instead of chaining .catch().
  supabase
    .rpc('record_brand_pack_view', { p_share_id: shareId })
    .then(() => {}, () => {});

  log.info('public_brand_pack_served', { shareId, clientId: shareLink.client_id });

  return jsonResponse({
    shareLink: {
      id: shareLink.id,
      allow_downloads: shareLink.allow_downloads,
      expires_at: shareLink.expires_at ?? null,
    },
    client: {
      business_name: c.business_name,
      industry: c.industry,
      style_notes: c.brand_style_notes ?? null,
      legacy_logo_url: c.legacy_logo_url ?? null,
      legacy_font_names: c.legacy_brand_fonts ?? [],
    },
    colors,
    logos: logosResult.data ?? [],
    fonts: fontsResult.data ?? [],
    guidelines: guidelinesResult.data ?? [],
  });
}));
