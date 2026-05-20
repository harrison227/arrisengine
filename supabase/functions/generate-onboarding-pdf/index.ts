/**
 * Returns the data the frontend needs to assemble the onboarding PDF.
 * (Actual PDF generation runs client-side via jspdf for performance.)
 *
 * Contract preserved:
 *   Request:  { clientId, platforms, assetNeeds, customNote }
 *   Response: { success, client, knowledgeSummary, agencySettings, config, generatedAt }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { notFound } from '../_shared/errors.ts';
import { ensureBoolean, ensureOptionalString, ensureRecord, ensureUuid } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { requireClientAccess } from '../_shared/auth.ts';

interface PlatformsInput { facebook: unknown; tiktok: unknown; google: unknown; youtube: unknown; instagram: unknown }
interface AssetNeedsInput { rawFootage: unknown; productShipment: unknown; brandAssets: unknown; ugc: unknown }
interface RequestBody { clientId: unknown; platforms: unknown; assetNeeds: unknown; customNote?: unknown }

Deno.serve(withErrorHandling({ fn: 'generate-onboarding-pdf' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const clientId = ensureUuid('clientId', body.clientId);
  const platformsRaw = ensureRecord('platforms', body.platforms) as PlatformsInput;
  const assetNeedsRaw = ensureRecord('assetNeeds', body.assetNeeds) as AssetNeedsInput;
  const customNote = ensureOptionalString('customNote', body.customNote, 5_000) ?? '';

  await requireClientAccess(req, clientId);

  const platforms = {
    facebook: ensureBoolean('platforms.facebook', platformsRaw.facebook),
    tiktok: ensureBoolean('platforms.tiktok', platformsRaw.tiktok),
    google: ensureBoolean('platforms.google', platformsRaw.google),
    youtube: ensureBoolean('platforms.youtube', platformsRaw.youtube),
    instagram: ensureBoolean('platforms.instagram', platformsRaw.instagram),
  };
  const assetNeeds = {
    rawFootage: ensureBoolean('assetNeeds.rawFootage', assetNeedsRaw.rawFootage),
    productShipment: ensureBoolean('assetNeeds.productShipment', assetNeedsRaw.productShipment),
    brandAssets: ensureBoolean('assetNeeds.brandAssets', assetNeedsRaw.brandAssets),
    ugc: ensureBoolean('assetNeeds.ugc', assetNeedsRaw.ugc),
  };

  const supabase = getSupabaseAdmin();

  const [{ data: client }, { data: knowledgeSummary }, { data: agencySettings }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', clientId).maybeSingle(),
    supabase.from('knowledge_summary').select('*').eq('client_id', clientId).maybeSingle(),
    supabase.from('agency_settings').select('*').limit(1).maybeSingle(),
  ]);

  if (!client) throw notFound('Client not found');

  log.info('onboarding_payload_built', {
    clientId,
    hasKnowledgeSummary: Boolean(knowledgeSummary),
    hasAgencySettings: Boolean(agencySettings),
  });

  return jsonResponse({
    success: true,
    client: {
      id: client.id,
      business_name: client.business_name,
      contact_name: client.contact_name,
      email: client.email,
      phone: client.phone,
      website: client.website,
      industry: client.industry,
      mrr: client.mrr,
      status: client.status,
    },
    knowledgeSummary: knowledgeSummary ? {
      positioning_summary: knowledgeSummary.positioning_summary,
      key_differentiators: knowledgeSummary.key_differentiators ?? [],
      content_opportunities: knowledgeSummary.content_opportunities ?? [],
      compliance_flags: knowledgeSummary.compliance_flags ?? [],
      ideal_customer_profile: knowledgeSummary.ideal_customer_profile,
    } : null,
    agencySettings: agencySettings ? {
      agency_name: agencySettings.agency_name,
      logo_url: agencySettings.logo_url,
      primary_color: agencySettings.primary_color,
    } : null,
    config: { platforms, assetNeeds, customNote },
    generatedAt: new Date().toISOString(),
  });
}));
