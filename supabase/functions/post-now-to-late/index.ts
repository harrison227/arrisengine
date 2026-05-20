/**
 * Publish a content piece to Late.is immediately ("Post Now").
 *
 * Handles single-image, video, story and carousel content. Existing Late
 * posts (drafts/scheduled) are PUT-updated to flip isDraft=false; missing
 * Late posts are created fresh with an idempotency key.
 *
 * Contract preserved:
 *   Request:  { contentPieceId }
 *   Response: { success, latePostId } | { success, skipped, latePostId } | { success: false, error }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { badRequest, notFound, upstream } from '../_shared/errors.ts';
import { ensureUuid } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { LateClient, mapPlatform, extractLatePostId } from '../_shared/late.ts';
import { optionalEnv } from '../_shared/env.ts';
import { uploadDataUrlToPublicStorage } from '../_shared/media-upload.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

interface RequestBody { contentPieceId: unknown }

interface PlatformTarget {
  platform: string;
  accountId: string;
  platformSpecificData?: Record<string, unknown>;
}

Deno.serve(withErrorHandling({ fn: 'post-now-to-late' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const contentPieceId = ensureUuid('contentPieceId', body.contentPieceId);

  const supabase = getSupabaseAdmin();
  const { data: piece, error: pieceError } = await supabase
    .from('content_pieces')
    .select(`*, content_plans!inner ( client_id, clients!inner ( id, late_api_key, late_profile_id, business_name ) )`)
    .eq('id', contentPieceId)
    .maybeSingle();
  if (pieceError) throw new Error(pieceError.message);
  if (!piece) throw notFound('Content piece not found');

  const existingLatePostId = piece.late_post_id as string | null;
  const isAlreadySynced = existingLatePostId && piece.late_sync_status === 'synced';
  if (isAlreadySynced && piece.status === 'live') {
    return jsonResponse({
      success: true,
      skipped: true,
      reason: 'Content has already been published to Late',
      latePostId: existingLatePostId,
    });
  }
  const shouldUpdateExisting = Boolean(existingLatePostId);

  const plans = piece.content_plans as { client_id: string; clients: { id: string; late_api_key: string | null; late_profile_id: string | null; business_name: string } | { id: string; late_api_key: string | null }[] };
  const client = Array.isArray(plans.clients) ? plans.clients[0] : plans.clients;
  const apiKey = client?.late_api_key ?? optionalEnv('LATE_API_KEY');
  if (!apiKey) throw badRequest('Late is not configured. Please add your Late API key in client settings.');

  await supabase.from('content_pieces').update({ late_sync_status: 'pending' }).eq('id', contentPieceId);

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

  const platforms: string[] = ((piece.platforms as string[] | null) ?? [piece.platform as string | null]).filter(Boolean) as string[];
  const feedPlatforms: string[] = [];
  const storyPlatforms: string[] = [];
  for (const p of platforms) {
    const key = p.toLowerCase();
    (key.includes('_stories') ? storyPlatforms : feedPlatforms).push(key);
  }

  const isVideoContent = piece.content_type === 'video' || piece.content_type === 'reel';

  const lateFeedPlatforms: PlatformTarget[] = feedPlatforms
    .map((platformKey) => {
      const mappedPlatform = mapPlatform(platformKey);
      const accountId = accountMap.get(platformKey);
      if (!accountId) return null;
      const target: PlatformTarget = { platform: mappedPlatform, accountId };
      if (mappedPlatform === 'instagram') {
        const psd: Record<string, unknown> = {};
        if (isVideoContent) psd.contentType = 'reel';
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
    .map((platformKey) => {
      const basePlatform = platformKey.replace('_stories', '');
      const mappedPlatform = mapPlatform(basePlatform);
      const accountId = accountMap.get(platformKey) ?? accountMap.get(basePlatform);
      if (!accountId) return null;
      return { platform: mappedPlatform, accountId, platformSpecificData: { contentType: 'story' } };
    })
    .filter((p): p is PlatformTarget => p !== null);

  const latePlatforms = [...lateFeedPlatforms, ...lateStoryPlatforms];
  if (latePlatforms.length === 0) {
    await markPieceError(supabase, contentPieceId, 'No Late accounts linked for selected platforms');
    throw badRequest('No Late accounts linked for selected platforms. Please configure Late account mappings in client settings.');
  }

  const latePayload: Record<string, unknown> = { content, platforms: latePlatforms };
  const requiresMedia = [...feedPlatforms, ...storyPlatforms].some((p) => p.includes('instagram') || p.includes('tiktok'));

  let resolvedAssetUrl = (piece.asset_url as string | null) ?? null;
  let isJsonArray = false;
  let carouselUrls: string[] = [];

  if (resolvedAssetUrl) {
    try {
      const parsed = JSON.parse(resolvedAssetUrl);
      if (Array.isArray(parsed) && parsed.length > 0) {
        isJsonArray = true;
        carouselUrls = parsed as string[];
      }
    } catch { /* not JSON */ }
  }

  if (isJsonArray && carouselUrls.length > 0) {
    const resolvedUrls: string[] = [];
    for (let i = 0; i < carouselUrls.length; i++) {
      let url = carouselUrls[i];
      if (url.startsWith('https://')) { resolvedUrls.push(url); continue; }
      if (url.startsWith('data:')) {
        const { publicUrl, error } = await uploadDataUrlToPublicStorage({
          supabase, dataUrl: url, clientId, contentPieceId: `${contentPieceId}-carousel-${i}`,
        });
        if (error) {
          await markPieceError(supabase, contentPieceId, `Failed to upload carousel image ${i + 1}: ${error}`);
          throw badRequest(`Failed to upload carousel image ${i + 1}: ${error}`);
        }
        url = publicUrl!;
      }
      if (!url.startsWith('https://')) {
        const msg = `Carousel image ${i + 1} does not have a valid public HTTPS URL. Please re-upload the media.`;
        await markPieceError(supabase, contentPieceId, msg);
        throw badRequest(msg);
      }
      resolvedUrls.push(url);
    }
    await supabase.from('content_pieces').update({ asset_url: JSON.stringify(resolvedUrls) }).eq('id', contentPieceId);
    latePayload.mediaItems = resolvedUrls.map((url) => ({ type: 'image', url }));
    for (const p of lateFeedPlatforms) {
      if (p.platform === 'instagram') {
        p.platformSpecificData = { ...(p.platformSpecificData ?? {}), contentType: 'carousel' };
      }
    }
    log.info('carousel_ready', { count: resolvedUrls.length });
  } else {
    if (resolvedAssetUrl?.startsWith('data:') && requiresMedia) {
      const { publicUrl, error } = await uploadDataUrlToPublicStorage({ supabase, dataUrl: resolvedAssetUrl, clientId, contentPieceId });
      if (error) {
        await markPieceError(supabase, contentPieceId, error);
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
            await markPieceError(supabase, contentPieceId, msg);
            throw badRequest(msg);
          }
        } catch {
          if (requiresMedia) {
            const msg = 'Invalid carousel media format.';
            await markPieceError(supabase, contentPieceId, msg);
            throw badRequest(msg);
          }
        }
      } else if (requiresMedia) {
        const msg = 'Media must be re-uploaded. Attached media URL is not a public HTTPS link.';
        await markPieceError(supabase, contentPieceId, msg);
        throw badRequest(msg);
      }
    } else if (requiresMedia) {
      const msg = 'Instagram/TikTok posts require media. Please attach an image or video.';
      await markPieceError(supabase, contentPieceId, msg);
      throw badRequest(msg);
    }
  }

  const late = new LateClient(apiKey);
  let result: { data?: unknown; error?: string; status?: number };
  let finalLatePostId: string | null;

  if (shouldUpdateExisting && existingLatePostId) {
    const updatePayload: Record<string, unknown> = { ...latePayload, id: existingLatePostId, isDraft: false };
    delete updatePayload.scheduledFor;
    result = await late.call({ endpoint: `/posts/${existingLatePostId}`, method: 'PUT', body: updatePayload });
    if (result.error && /Late API.*\b405\b/.test(result.error)) {
      log.warn('put_405_falling_back_to_post', { existingLatePostId });
      result = await late.call({ endpoint: '/posts', method: 'POST', body: updatePayload, idempotencyKey: `post_now_update:${contentPieceId}:${existingLatePostId}:${Date.now()}` });
    }
    finalLatePostId = existingLatePostId;
  } else {
    result = await late.call({ endpoint: '/posts', method: 'POST', body: latePayload, idempotencyKey: `post_now:${contentPieceId}:${Date.now()}` });
    finalLatePostId = extractLatePostId(result.data);
  }

  if (result.error) {
    await markPieceError(supabase, contentPieceId, result.error);
    throw upstream(result.error, result.status ?? 502);
  }

  const { error: updatePieceError } = await supabase
    .from('content_pieces')
    .update({
      late_post_id: finalLatePostId,
      late_sync_status: 'synced',
      late_last_synced_at: new Date().toISOString(),
      late_error_message: null,
      status: 'live',
      scheduled_date: new Date().toISOString(),
    })
    .eq('id', contentPieceId);
  if (updatePieceError) {
    throw new Error(`Published to Late, but failed to update local record: ${updatePieceError.message}`);
  }

  log.info('post_now_published', { contentPieceId, latePostId: finalLatePostId });
  return jsonResponse({ success: true, latePostId: finalLatePostId });
}));

async function markPieceError(supabase: SupabaseClient, contentPieceId: string, message: string): Promise<void> {
  await supabase
    .from('content_pieces')
    .update({ late_sync_status: 'error', late_error_message: message })
    .eq('id', contentPieceId);
}
