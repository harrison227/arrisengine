/**
 * Cron-driven publisher: every 5 minutes (configured at the project level)
 * pick up due text_posts and publish them via Late.is.
 *
 * Contract preserved:
 *   POST (no body)
 *   Response: { success, processed, successCount, failCount, results }
 */

import { withErrorHandling, jsonResponse } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { LateClient, mapPlatform, extractLatePostId } from '../_shared/late.ts';

interface DuePost {
  id: string;
  content: string;
  platform: string;
  scheduled_date: string;
  status: string;
  late_post_id: string | null;
  client_id: string;
  clients: { id: string; late_api_key: string | null; business_name: string } | { id: string; late_api_key: string | null; business_name: string }[] | null;
}

interface Result { postId: string; success: boolean; error?: string }

Deno.serve(withErrorHandling({ fn: 'late-scheduled-poster' }, async ({ log }) => {
  const supabase = getSupabaseAdmin();

  const { data: duePosts, error } = await supabase
    .from('text_posts')
    .select('id, content, platform, scheduled_date, status, late_post_id, client_id, clients ( id, late_api_key, business_name )')
    .in('status', ['scheduled', 'approved'])
    .lte('scheduled_date', new Date().toISOString())
    .is('late_post_id', null)
    .order('scheduled_date', { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);

  if (!duePosts || duePosts.length === 0) {
    return jsonResponse({ success: true, processed: 0 });
  }

  const results: Result[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const post of duePosts as unknown as DuePost[]) {
    try {
      const client = Array.isArray(post.clients) ? post.clients[0] : post.clients;
      if (!client?.late_api_key) {
        results.push({ postId: post.id, success: false, error: 'No Late API key configured' });
        failCount++;
        continue;
      }

      const mappedPlatform = mapPlatform(post.platform);
      const { data: accountMapping } = await supabase
        .from('late_account_mappings')
        .select('late_account_id, platform, account_username')
        .eq('client_id', post.client_id)
        .eq('platform', mappedPlatform)
        .maybeSingle();
      if (!accountMapping) {
        results.push({ postId: post.id, success: false, error: `No ${post.platform} account configured in Late` });
        failCount++;
        continue;
      }

      const late = new LateClient(client.late_api_key);
      const latePayload = {
        content: post.content,
        platforms: [{ platform: mappedPlatform, accountId: accountMapping.late_account_id }],
        publishNow: true,
      };

      const result = await late.call({ endpoint: '/posts', method: 'POST', body: latePayload, idempotencyKey: `scheduled:${post.id}` });
      if (result.error) {
        log.warn('post_failed', { postId: post.id, error: result.error });
        await supabase.from('text_posts').update({ status: 'error' }).eq('id', post.id);
        results.push({ postId: post.id, success: false, error: result.error });
        failCount++;
        continue;
      }

      const latePostId = extractLatePostId(result.data);
      await supabase
        .from('text_posts')
        .update({ status: 'published', late_post_id: latePostId, published_at: new Date().toISOString() })
        .eq('id', post.id);
      results.push({ postId: post.id, success: true });
      successCount++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error('post_processing_error', err, { postId: post.id });
      results.push({ postId: post.id, success: false, error: message });
      failCount++;
    }
  }

  log.info('scheduled_poster_done', { processed: duePosts.length, successCount, failCount });
  return jsonResponse({ success: true, processed: duePosts.length, successCount, failCount, results });
}));
