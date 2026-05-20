/**
 * Read a complete brand pack for a client (authenticated).
 *
 * Returns: client base, colors, logos, fonts, guidelines.
 * Used by the in-app Brand Pack tab.
 *
 * Contract:
 *   Request:  { clientId }
 *   Response: { client, colors, logos[], fonts[], guidelines[] }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { notFound } from '../_shared/errors.ts';
import { ensureUuid } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { requireClientAccess } from '../_shared/auth.ts';

interface RequestBody { clientId: unknown }

Deno.serve(withErrorHandling({ fn: 'brand-pack-data' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const clientId = ensureUuid('clientId', body.clientId);

  await requireClientAccess(req, clientId);

  const supabase = getSupabaseAdmin();

  const [clientResult, logosResult, fontsResult, guidelinesResult] = await Promise.all([
    supabase
      .from('clients')
      .select('id, business_name, industry, brand_primary_color, brand_secondary_color, brand_accent_color, brand_background_color, brand_text_color, brand_fonts, brand_logo_url, brand_style_notes')
      .eq('id', clientId)
      .maybeSingle(),
    supabase
      .from('client_logos')
      .select('*')
      .eq('client_id', clientId)
      .order('is_primary', { ascending: false })
      .order('sort_order', { ascending: true }),
    supabase
      .from('client_brand_fonts')
      .select('*')
      .eq('client_id', clientId)
      .order('role', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase
      .from('client_brand_guidelines')
      .select('*')
      .eq('client_id', clientId)
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

  log.info('brand_pack_loaded', {
    clientId,
    logos: logosResult.data?.length ?? 0,
    fonts: fontsResult.data?.length ?? 0,
    guidelines: guidelinesResult.data?.length ?? 0,
  });

  return jsonResponse({
    client: {
      id: c.id,
      business_name: c.business_name,
      industry: c.industry,
      style_notes: c.brand_style_notes ?? null,
      legacy_logo_url: c.brand_logo_url ?? null,
      legacy_font_names: c.brand_fonts ?? [],
    },
    colors,
    logos: logosResult.data ?? [],
    fonts: fontsResult.data ?? [],
    guidelines: guidelinesResult.data ?? [],
  });
}));
