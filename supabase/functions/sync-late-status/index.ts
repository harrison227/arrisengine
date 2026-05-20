/**
 * Periodic reconciliation of Late.is post status into our DB.
 *
 * For each client with a Late API key:
 *   1. Pull the latest published posts and mark matching rows as published / live.
 *   2. Pull the failed posts and surface that as draft + late_sync_status='error'.
 *   3. Re-check any rows that should have published more than 10 minutes
 *      ago but are still 'approved'/'scheduled' — webhooks sometimes miss.
 *
 * Contract preserved:
 *   Request:  { clientId? }   (omit to sync every client)
 *   Response: { success, updated, message }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { ensureOptionalUuid } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { LateClient, extractLatePostId } from '../_shared/late.ts';
import type { Logger } from '../_shared/logger.ts';

const PUBLISHED_STATUSES = new Set(['published', 'posted', 'completed', 'sent']);
const FAILED_STATUSES = new Set(['failed', 'error']);

interface RequestBody { clientId?: unknown }

Deno.serve(withErrorHandling({ fn: 'sync-late-status' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const clientId = ensureOptionalUuid('clientId', body.clientId);

  const supabase = getSupabaseAdmin();
  let q = supabase.from('clients').select('id, late_api_key, business_name').not('late_api_key', 'is', null);
  if (clientId) q = q.eq('id', clientId);
  const { data: clients, error: clientsError } = await q;
  if (clientsError) throw new Error(clientsError.message);

  if (!clients || clients.length === 0) {
    return jsonResponse({ success: true, message: 'No clients with Late API keys', updated: 0 });
  }

  let totalUpdated = 0;
  for (const client of clients) {
    try {
      const late = new LateClient(client.late_api_key as string);
      const childLog = log.child({ clientId: client.id });
      totalUpdated += await syncOneClient(client.id as string, late, supabase, childLog);
    } catch (err) {
      log.error('client_sync_failed', err, { clientId: client.id });
    }
  }

  log.info('sync_complete', { updated: totalUpdated });
  return jsonResponse({ success: true, updated: totalUpdated, message: `Updated ${totalUpdated} posts to published status` });
}));

async function syncOneClient(
  clientId: string,
  late: LateClient,
  supabase: ReturnType<typeof getSupabaseAdmin>,
  log: Logger,
): Promise<number> {
  let updated = 0;

  // 1. Bulk-published list.
  const publishedResult = await late.call<{ posts?: unknown[]; data?: unknown[] }>({
    endpoint: '/posts?status=published&limit=100', method: 'GET',
  });
  if (publishedResult.error) {
    log.warn('published_list_failed', { error: publishedResult.error });
  } else {
    const posts = (publishedResult.data?.posts ?? publishedResult.data?.data ?? []) as unknown[];
    const ids = posts.map(extractLatePostId).filter((x): x is string => Boolean(x));
    if (ids.length > 0) {
      const { data: tp } = await supabase
        .from('text_posts')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('client_id', clientId)
        .in('late_post_id', ids)
        .neq('status', 'published')
        .select('id');
      updated += tp?.length ?? 0;

      const { data: cp } = await supabase
        .from('content_pieces')
        .update({ status: 'live', late_sync_status: 'synced', late_last_synced_at: new Date().toISOString() })
        .in('late_post_id', ids)
        .neq('status', 'live')
        .select('id');
      updated += cp?.length ?? 0;
    }
  }

  // 2. Direct re-check of stalled rows (scheduled in the past but still 'approved').
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: candidateText } = await supabase
    .from('text_posts')
    .select('id, late_post_id')
    .eq('client_id', clientId)
    .not('late_post_id', 'is', null)
    .lt('scheduled_date', tenMinutesAgo)
    .in('status', ['approved', 'scheduled']);
  for (const c of candidateText ?? []) {
    const result = await late.call<Record<string, unknown>>({ endpoint: `/posts/${c.late_post_id}`, method: 'GET' });
    if (result.error || !result.data) continue;
    const post = (result.data.post as Record<string, unknown> | undefined) ?? result.data;
    const status = (post.status as string | undefined) ?? (post.state as string | undefined) ?? '';
    const lower = status.toLowerCase();
    if (PUBLISHED_STATUSES.has(lower)) {
      const { error } = await supabase
        .from('text_posts')
        .update({ status: 'published', published_at: (post.publishedAt as string | undefined) ?? (post.postedAt as string | undefined) ?? new Date().toISOString() })
        .eq('id', c.id);
      if (!error) updated++;
    } else if (FAILED_STATUSES.has(lower)) {
      await supabase.from('text_posts').update({ status: 'draft' }).eq('id', c.id);
    }
  }

  const { data: candidatePieces } = await supabase
    .from('content_pieces')
    .select('id, late_post_id, content_plan_id')
    .not('late_post_id', 'is', null)
    .lt('scheduled_date', tenMinutesAgo)
    .in('status', ['approved', 'scheduled']);
  for (const c of candidatePieces ?? []) {
    const result = await late.call<Record<string, unknown>>({ endpoint: `/posts/${c.late_post_id}`, method: 'GET' });
    if (result.error || !result.data) continue;
    const post = (result.data.post as Record<string, unknown> | undefined) ?? result.data;
    const status = ((post.status as string | undefined) ?? (post.state as string | undefined) ?? '').toLowerCase();
    if (PUBLISHED_STATUSES.has(status)) {
      const { error } = await supabase
        .from('content_pieces')
        .update({ status: 'live', late_sync_status: 'synced', late_last_synced_at: new Date().toISOString() })
        .eq('id', c.id);
      if (!error) updated++;
    }
  }

  // 3. Failed posts -> mark error.
  const failedResult = await late.call<{ posts?: unknown[]; data?: unknown[] }>({
    endpoint: '/posts?status=failed&limit=100', method: 'GET',
  });
  if (!failedResult.error) {
    const posts = (failedResult.data?.posts ?? failedResult.data?.data ?? []) as unknown[];
    const ids = posts.map(extractLatePostId).filter((x): x is string => Boolean(x));
    if (ids.length > 0) {
      await supabase
        .from('content_pieces')
        .update({ late_sync_status: 'error', late_error_message: 'Post failed to publish on Late' })
        .in('late_post_id', ids);
      await supabase.from('text_posts').update({ status: 'draft' }).in('late_post_id', ids);
    }
  }

  return updated;
}
