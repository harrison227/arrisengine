/**
 * Create / rotate / deactivate a public share link for a client's brand pack.
 *
 * Three actions on one endpoint:
 *   - 'create'      → mint a new active share link.
 *   - 'rotate'      → deactivate the old one and mint a new share_id.
 *   - 'deactivate'  → flip is_active=false on a specific share link.
 *
 * Contract:
 *   Request:  { clientId, action, shareLinkId?, expiresAt?, allowDownloads? }
 *   Response: { shareLink }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { badRequest, notFound } from '../_shared/errors.ts';
import {
  ensureEnum,
  ensureOptionalBoolean,
  ensureOptionalString,
  ensureOptionalUuid,
  ensureUuid,
} from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { requireClientAccess } from '../_shared/auth.ts';

const ACTIONS = ['create', 'rotate', 'deactivate'] as const;
type Action = typeof ACTIONS[number];

interface RequestBody {
  clientId: unknown;
  action: unknown;
  shareLinkId?: unknown;
  expiresAt?: unknown;
  allowDownloads?: unknown;
}

function generateShareId(): string {
  // 16 url-safe chars; collision risk negligible.
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

Deno.serve(withErrorHandling({ fn: 'create-brand-share-link' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const clientId = ensureUuid('clientId', body.clientId);
  const action = ensureEnum<Action>('action', body.action, ACTIONS);
  const shareLinkId = ensureOptionalUuid('shareLinkId', body.shareLinkId);
  const expiresAt = ensureOptionalString('expiresAt', body.expiresAt, 100);
  const allowDownloads = ensureOptionalBoolean('allowDownloads', body.allowDownloads);

  const userId = await requireClientAccess(req, clientId);
  const supabase = getSupabaseAdmin();

  if (action === 'deactivate') {
    if (!shareLinkId) throw badRequest('shareLinkId is required for deactivate');
    const { data, error } = await supabase
      .from('brand_share_links')
      .update({ is_active: false })
      .eq('id', shareLinkId)
      .eq('client_id', clientId)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw notFound('Share link not found');
    log.info('share_link_deactivated', { shareLinkId });
    return jsonResponse({ shareLink: data });
  }

  if (action === 'rotate') {
    if (!shareLinkId) throw badRequest('shareLinkId is required for rotate');
    const { error: deactivateError } = await supabase
      .from('brand_share_links')
      .update({ is_active: false })
      .eq('id', shareLinkId)
      .eq('client_id', clientId);
    if (deactivateError) throw new Error(deactivateError.message);
    // Fall through to create.
  }

  const newShareId = generateShareId();
  const insertPayload: Record<string, unknown> = {
    client_id: clientId,
    share_id: newShareId,
    is_active: true,
    created_by: userId,
  };
  if (expiresAt) insertPayload.expires_at = expiresAt;
  if (allowDownloads !== undefined) insertPayload.allow_downloads = allowDownloads;

  const { data, error } = await supabase
    .from('brand_share_links')
    .insert(insertPayload)
    .select()
    .single();
  if (error) throw new Error(error.message);

  log.info('share_link_created', { shareLinkId: data.id, action });
  return jsonResponse({ shareLink: data });
}));
