/**
 * Synchronise a content_pieces row with Late.is.
 *
 * Status mapping:
 *   - edited     → draft on Late (no scheduledFor)
 *   - approved   → scheduled on Late (requires future scheduled_date)
 *   - live       → already published, skip
 *
 * Bug fix vs the original: the success response now correctly returns
 * the Late post id from the API response (or the existing one) instead
 * of echoing back the request body's `latePostId` field.
 *
 * Contract preserved:
 *   Request:  { contentPieceId, action: 'create'|'update'|'delete', latePostId? }
 *   Response: { success, latePostId? } | { success: true, skipped, reason } | { success: false, error }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { badRequest, notFound, upstream } from '../_shared/errors.ts';
import { ensureEnum, ensureOptionalString, ensureUuid } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { LateClient, mapPlatform, extractLatePostId } from '../_shared/late.ts';
import { optionalEnv } from '../_shared/env.ts';
import { uploadDataUrlToPublicStorage } from '../_shared/media-upload.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const ACTIONS = ['create', 'update', 'delete'] as const;
type Action = typeof ACTIONS[number];

const SYNCABLE_STATUSES = new Set(['edited', 'approved', 'live']);
const MIN_FUTURE_MINUTES = 2;

interface RequestBody { contentPieceId: unknown; action: unknown; latePostId?: unknown }

interface PlatformTarget {
  platform: string;
  accountId: string;
  platformSpecificData?: Record<string, unknown>;
}

const isLateNotFound = (err: string) => /Late API .*\b404\b/.test(err) || err.includes('not found');
const isLateNotEditable = (err: string) => err.includes('Only draft, scheduled, failed, and partial posts can be edited');
const isLateCannotDelete = (err: string) => err.includes('cannot be deleted');

Deno.serve(withErrorHandling({ fn: 'sync-to-late' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const contentPieceId = ensureUuid('contentPieceId', body.contentPieceId);
  const action = ensureEnum<Action>('action', body.action, ACTIONS);
  const incomingLatePostId = ensureOptionalString('latePostId', body.latePostId, 200);

  const supabase = getSupabaseAdmin();

  // Delete-by-id fast path: piece may already be deleted from DB.
  if (action === 'delete' && incomingLatePostId) {
    const apiKey = optionalEnv('LATE_API_KEY');
    if (!apiKey) {
      return jsonResponse({ success: true, skipped: true, reason: 'No Late API key configured' });
    }
    const late = new LateClient(apiKey);
    const result = await late.call({ endpoint: `/posts/${incomingLatePostId}`, method: 'DELETE' });
    if (result.error) {
      if (isLateNotFound(result.error) || isLateCannotDelete(result.error)) {
        return jsonResponse({ success: true, message: 'Post already deleted or not found in Late' });
      }
      throw upstream(result.error, result.status ?? 502);
    }
    log.info('late_post_deleted', { latePostId: incomingLatePostId });
    return jsonResponse({ success: true });
  }

  const { data: piece, error: pieceError } = await supabase
    .from('content_pieces')
    .select(`*, content_plans!inner ( client_id, clients!inner ( id, late_api_key, late_profile_id, business_name ) )`)
    .eq('id', contentPieceId)
    .maybeSingle();
  if (pieceError) throw new Error(pieceError.message);
  if (!piece) throw notFound('Content piece not found');

  const plans = piece.content_plans as { client_id: string; clients: { id: string; late_api_key: string | null; late_profile_id: string | null; business_name: string } | { id: string; late_api_key: string | null }[] };
  const client = Array.isArray(plans.clients) ? plans.clients[0] : plans.clients;
  const apiKey = client?.late_api_key ?? optionalEnv('LATE_API_KEY');
  if (!apiKey) {
    return jsonResponse({ success: true, skipped: true, reason: 'No Late API key configured' });
  }

  const status = piece.status as string;
  const shouldSyncAsDraft = status === 'edited';
  const shouldSyncAsScheduled = status === 'approved';

  if (action !== 'delete') {
    if (!SYNCABLE_STATUSES.has(status)) {
      return jsonResponse({ success: true, skipped: true, reason: `Content status '${status}' is not ready for Late sync. Mark as 'For Review' or 'Approved' first.` });
    }
    if (status === 'live') {
      return jsonResponse({ success: true, skipped: true, reason: 'Content is already published (live status)' });
    }
    if (shouldSyncAsScheduled) {
      if (!piece.scheduled_date) {
        return jsonResponse({ success: false, message: 'Approved content must have a scheduled date before syncing to Late' });
      }
      const scheduledTime = new Date(piece.scheduled_date as string).getTime();
      const minFutureTime = Date.now() + MIN_FUTURE_MINUTES * 60 * 1000;
      if (scheduledTime < minFutureTime) {
        return jsonResponse({ success: true, skipped: true, reason: 'Scheduled time has already passed or is too soon. Please reschedule to a future time.' });
      }
    }
  }

  await supabase.from('content_pieces').update({ late_sync_status: 'pending' }).eq('id', contentPieceId);

  const late = new LateClient(apiKey);

  if (action === 'delete') {
    if (!piece.late_post_id) return jsonResponse({ success: true, message: 'Nothing to delete' });
    const result = await late.call({ endpoint: `/posts/${piece.late_post_id}`, method: 'DELETE' });
    if (result.error) {
      if (isLateNotFound(result.error) || isLateCannotDelete(result.error)) {
        await supabase.from('content_pieces').update({
          late_post_id: null, late_sync_status: 'not_synced', late_last_synced_at: new Date().toISOString(), late_error_message: null,
        }).eq('id', contentPieceId);
        return jsonResponse({ success: true, message: 'Reference cleared' });
      }
      await markError(supabase, contentPieceId, result.error);
      throw upstream(result.error, result.status ?? 502);
    }
    await supabase.from('content_pieces').update({
      late_post_id: null, late_sync_status: 'not_synced', late_last_synced_at: new Date().toISOString(), late_error_message: null,
    }).eq('id', contentPieceId);
    log.info('content_piece_deleted_from_late', { contentPieceId });
    return jsonResponse({ success: true });
  }

  // Create / update flow.
  const clientId = plans.client_id;
  const { data: accountMappings } = await supabase
    .from('late_account_mappings')
    .select('platform, late_account_id')
    .eq('client_id', clientId);
  const accountMap = new Map(accountMappings?.map((m) => [m.platform as string, m.late_account_id as string]) ?? []);

  let content = (piece.caption as string | null) ?? (piece.concept as string | null) ?? '';
  const hashtags = piece.hashtags as string[] | null;
  if (hashtags && hashtags.length > 0) {
    content += '\n\n' + hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  }

  const platforms = ((piece.platforms as string[] | null) ?? [piece.platform as string | null]).filter(Boolean) as string[];
  const feedPlatforms: string[] = [];
  const storyPlatforms: string[] = [];
  for (const p of platforms) {
    const key = p.toLowerCase();
    (key.includes('_stories') ? storyPlatforms : feedPlatforms).push(key);
  }

  const isVideoContent = piece.content_type === 'video' || piece.content_type === 'reel';
  const isCarouselContent = piece.content_type === 'carousel';

  const lateFeedPlatforms: PlatformTarget[] = feedPlatforms
    .map((platformKey) => {
      const mappedPlatform = mapPlatform(platformKey);
      const accountId = accountMap.get(platformKey);
      if (!accountId) return null;
      const target: PlatformTarget = { platform: mappedPlatform, accountId };
      if (mappedPlatform === 'instagram') {
        const psd: Record<string, unknown> = {};
        if (isVideoContent) psd.contentType = 'reel';
        else if (isCarouselContent) psd.contentType = 'carousel';
        if (piece.instagram_first_comment) psd.firstComment = piece.instagram_first_comment;
        if (Array.isArray(piece.instagram_collaborators) && piece.instagram_collaborators.length > 0) {
          psd.collaborators = (piece.instagram_collaborators as string[]).map((c) => (c.startsWith('@') ? c.slice(1) : c));
        }
        if (Object.keys(psd).length > 0) target.platformSpecificData = psd;
      }
      return target;
    })
    .filter((p): p is PlatformTarget => p !== null);

  const lateStoryPlatforms: PlatformTarget[] = storyPlatforms
    .map<PlatformTarget | null>((platformKey) => {
      const basePlatform = platformKey.replace('_stories', '');
      const mappedPlatform = mapPlatform(basePlatform);
      const accountId = accountMap.get(platformKey) ?? accountMap.get(basePlatform);
      if (!accountId) return null;
      return { platform: mappedPlatform, accountId, platformSpecificData: { contentType: 'story' } };
    })
    .filter((p): p is PlatformTarget => p !== null);

  const latePlatforms = [...lateFeedPlatforms, ...lateStoryPlatforms];
  if (latePlatforms.length === 0) {
    return jsonResponse({ success: true, skipped: true, reason: 'No Late account mappings configured for selected platforms' });
  }

  const latePayload: Record<string, unknown> = { content, platforms: latePlatforms };
  if (shouldSyncAsDraft) latePayload.isDraft = true;
  else if (shouldSyncAsScheduled && piece.scheduled_date) {
    latePayload.isDraft = false;
    latePayload.scheduledFor = new Date(piece.scheduled_date as string).toISOString();
  }

  const requiresMedia = feedPlatforms.some((p) => p === 'instagram' || p === 'tiktok');
  let resolvedAssetUrl = (piece.asset_url as string | null) ?? null;

  if (resolvedAssetUrl?.startsWith('data:') && requiresMedia) {
    const { publicUrl, error } = await uploadDataUrlToPublicStorage({ supabase, dataUrl: resolvedAssetUrl, clientId, contentPieceId });
    if (error) {
      await markError(supabase, contentPieceId, error);
      throw badRequest(error);
    }
    resolvedAssetUrl = publicUrl ?? null;
  }

  if (resolvedAssetUrl) {
    if (resolvedAssetUrl.startsWith('http://') || resolvedAssetUrl.startsWith('https://')) {
      const isVideo = piece.content_type === 'video' || piece.content_type === 'reel';
      latePayload.mediaItems = [{ type: isVideo ? 'video' : 'image', url: resolvedAssetUrl }];
    } else if (resolvedAssetUrl.startsWith('[')) {
      try {
        const arr = JSON.parse(resolvedAssetUrl) as string[];
        const valid = arr.filter((u) => u.startsWith('http://') || u.startsWith('https://'));
        if (valid.length > 0) {
          latePayload.mediaItems = valid.map((url) => ({ type: 'image', url }));
        } else if (requiresMedia) {
          const msg = 'Carousel images must be public HTTPS URLs.';
          await markError(supabase, contentPieceId, msg);
          throw badRequest(msg);
        }
      } catch {
        if (requiresMedia) {
          const msg = 'Invalid carousel media format.';
          await markError(supabase, contentPieceId, msg);
          throw badRequest(msg);
        }
      }
    } else if (requiresMedia) {
      const msg = 'Media must be re-uploaded. Attached media URL is not a public HTTPS link.';
      await markError(supabase, contentPieceId, msg);
      throw badRequest(msg);
    }
  } else if (requiresMedia) {
    const msg = 'Instagram/TikTok posts require media. Please attach an image or video.';
    await markError(supabase, contentPieceId, msg);
    throw badRequest(msg);
  }

  let result: { data?: unknown; error?: string; status?: number };
  if (piece.late_post_id) {
    result = await late.call({ endpoint: `/posts/${piece.late_post_id}`, method: 'PUT', body: latePayload });
    if (result.error && isLateNotEditable(result.error)) {
      await supabase.from('content_pieces').update({
        late_sync_status: 'synced', late_last_synced_at: new Date().toISOString(), late_error_message: null,
      }).eq('id', contentPieceId);
      return jsonResponse({
        success: true, skipped: true,
        reason: 'Late post is not editable (likely already published).',
        latePostId: piece.late_post_id,
      });
    }
    if (result.error && isLateNotFound(result.error)) {
      await supabase.from('content_pieces').update({ late_post_id: null }).eq('id', contentPieceId);
      result = await late.call({ endpoint: '/posts', method: 'POST', body: latePayload, idempotencyKey: `content_piece:${contentPieceId}` });
    }
  } else {
    result = await late.call({ endpoint: '/posts', method: 'POST', body: latePayload, idempotencyKey: `content_piece:${contentPieceId}` });
  }

  if (result.error) {
    await markError(supabase, contentPieceId, result.error);
    throw upstream(result.error, result.status ?? 502);
  }

  const newLatePostId = extractLatePostId(result.data) ?? (piece.late_post_id as string | null);
  await supabase.from('content_pieces').update({
    late_post_id: newLatePostId,
    late_sync_status: 'synced',
    late_last_synced_at: new Date().toISOString(),
    late_error_message: null,
  }).eq('id', contentPieceId);

  log.info('content_piece_synced', { contentPieceId, latePostId: newLatePostId });
  return jsonResponse({ success: true, latePostId: newLatePostId });
}));

async function markError(supabase: SupabaseClient, contentPieceId: string, message: string): Promise<void> {
  await supabase.from('content_pieces').update({ late_sync_status: 'error', late_error_message: message }).eq('id', contentPieceId);
}
