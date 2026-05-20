/**
 * Post a single text_posts row immediately to Late.is.
 *
 * Contract preserved:
 *   Request:  { textPostId }
 *   Response: { success, latePostId } | { success, skipped, latePostId } | { success: false, error }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { badRequest, notFound, upstream } from '../_shared/errors.ts';
import { ensureUuid } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { LateClient, mapPlatform, extractLatePostId } from '../_shared/late.ts';
import { optionalEnv } from '../_shared/env.ts';

interface RequestBody { textPostId: unknown }

Deno.serve(withErrorHandling({ fn: 'post-text-to-late' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const textPostId = ensureUuid('textPostId', body.textPostId);

  const supabase = getSupabaseAdmin();
  const { data: textPost, error: postError } = await supabase
    .from('text_posts')
    .select(`*, clients!inner ( id, late_api_key, late_profile_id, business_name )`)
    .eq('id', textPostId)
    .maybeSingle();
  if (postError) throw new Error(postError.message);
  if (!textPost) throw notFound('Text post not found');

  if (textPost.status === 'published' && textPost.late_post_id) {
    log.info('post_already_published', { textPostId, latePostId: textPost.late_post_id });
    return jsonResponse({
      success: true,
      skipped: true,
      reason: 'Post has already been published to Late',
      latePostId: textPost.late_post_id,
    });
  }

  const client = (Array.isArray(textPost.clients) ? textPost.clients[0] : textPost.clients) as { id: string; late_api_key: string | null; business_name: string };
  const apiKey = client?.late_api_key ?? optionalEnv('LATE_API_KEY');
  if (!apiKey) throw badRequest('Late API key not configured for this client');

  const platform = (textPost.platform as string | undefined)?.toLowerCase() ?? 'threads';
  const mappedPlatform = mapPlatform(platform);

  const { data: accountMappings } = await supabase
    .from('late_account_mappings')
    .select('platform, late_account_id, account_username')
    .eq('client_id', textPost.client_id);

  const accountMapping = accountMappings?.find((m) =>
    (m.platform as string).toLowerCase() === platform || (m.platform as string).toLowerCase() === mappedPlatform,
  );
  if (!accountMapping) throw badRequest(`No Late account configured for ${platform}. Please connect your ${platform} account in Late settings.`);

  const late = new LateClient(apiKey);
  const idempotencyKey = `text_post_now:${textPostId}:${Date.now()}`;
  const result = await late.call({
    endpoint: '/posts',
    method: 'POST',
    body: {
      content: textPost.content,
      platforms: [{ platform: mappedPlatform, accountId: accountMapping.late_account_id }],
    },
    idempotencyKey,
  });
  if (result.error) {
    log.warn('late_post_failed', { textPostId, error: result.error });
    await supabase.from('text_posts').update({ status: 'error' }).eq('id', textPostId);
    throw upstream(result.error, result.status ?? 502);
  }

  const now = new Date().toISOString();
  const latePostId = extractLatePostId(result.data);
  await supabase
    .from('text_posts')
    .update({ status: 'published', published_at: now, scheduled_date: now, late_post_id: latePostId })
    .eq('id', textPostId);

  log.info('text_post_published', { textPostId, latePostId });
  return jsonResponse({ success: true, latePostId });
}));
