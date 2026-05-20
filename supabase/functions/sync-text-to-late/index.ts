/**
 * Synchronise a text_posts row with Late.is.
 *
 * Status mapping:
 *   - pending_review            → draft  on Late
 *   - scheduled / approved      → scheduled on Late (requires future scheduled_date)
 *   - published                 → no-op (already posted)
 *
 * Concurrency-safe via a transient `__creating__:` lock written into
 * late_post_id while the create call is in flight (replaces stale lock
 * after 5 minutes).
 *
 * Contract preserved:
 *   Request:  { textPostId, action: 'create' | 'update' | 'delete' }
 *   Response: { success, latePostId? } | { success: true, skipped, reason } | { success: false, error }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { badRequest, notFound } from '../_shared/errors.ts';
import { ensureEnum, ensureUuid } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { LateClient, mapPlatform, extractLatePostId } from '../_shared/late.ts';
import { optionalEnv } from '../_shared/env.ts';

const ACTIONS = ['create', 'update', 'delete'] as const;
type Action = typeof ACTIONS[number];

const SYNCABLE_STATUSES = new Set(['pending_review', 'scheduled', 'approved', 'published']);
const SCHEDULED_STATUSES = new Set(['scheduled', 'approved']);
const MIN_FUTURE_MINUTES = 2;

const CREATE_LOCK_PREFIX = '__creating__:';
const CREATE_LOCK_MAX_AGE_MS = 5 * 60 * 1000;

interface RequestBody { textPostId: unknown; action: unknown }

function isCreateLock(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(CREATE_LOCK_PREFIX);
}
function createLockValue(): string {
  return `${CREATE_LOCK_PREFIX}${Date.now()}:${crypto.randomUUID()}`;
}
function isStaleCreateLock(lockValue: string): boolean {
  const parts = lockValue.split(':');
  const ts = parts.length >= 2 ? Number(parts[1]) : NaN;
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts > CREATE_LOCK_MAX_AGE_MS;
}

const isLateNotFound = (err: string) => /Late API \s*404\b/.test(err) || /Late API 404\b/.test(err) || err.includes('"Post not found"') || err.includes('Post not found');
const isLateNotEditable = (err: string) => err.includes('Only draft, scheduled, failed, and partial posts can be edited');

Deno.serve(withErrorHandling({ fn: 'sync-text-to-late' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const textPostId = ensureUuid('textPostId', body.textPostId);
  const action = ensureEnum<Action>('action', body.action, ACTIONS);

  const supabase = getSupabaseAdmin();
  const { data: textPost, error: postError } = await supabase
    .from('text_posts')
    .select(`*, clients ( id, late_api_key, late_profile_id, business_name )`)
    .eq('id', textPostId)
    .maybeSingle();
  if (postError) throw new Error(postError.message);
  if (!textPost) throw notFound('Text post not found');

  const status = textPost.status as string;
  const shouldSyncAsDraft = status === 'pending_review';
  const shouldSyncAsScheduled = SCHEDULED_STATUSES.has(status);

  if (action !== 'delete') {
    if (!SYNCABLE_STATUSES.has(status)) {
      return jsonResponse({ success: true, skipped: true, reason: `Post status '${status}' not ready for Late sync. Mark as 'For Review' or 'Scheduled' first.` });
    }
    if (status === 'published') {
      return jsonResponse({ success: true, skipped: true, reason: 'Post already published' });
    }
    if (shouldSyncAsScheduled) {
      if (!textPost.scheduled_date) {
        return jsonResponse({ success: true, skipped: true, reason: 'Scheduled/approved posts need a scheduled date' });
      }
      const scheduledTime = new Date(textPost.scheduled_date).getTime();
      const minFutureTime = Date.now() + MIN_FUTURE_MINUTES * 60 * 1000;
      if (scheduledTime < minFutureTime) {
        return jsonResponse({ success: true, skipped: true, reason: 'Scheduled time has already passed or is too soon. Please reschedule to a future time.' });
      }
    }
  }

  const client = (Array.isArray(textPost.clients) ? textPost.clients[0] : textPost.clients) as { id: string; late_api_key: string | null; business_name: string };
  const apiKey = client?.late_api_key ?? optionalEnv('LATE_API_KEY');
  if (!apiKey) {
    return jsonResponse({ success: true, skipped: true, reason: 'No Late API key configured' });
  }
  const late = new LateClient(apiKey);

  if (action === 'delete') {
    if (!textPost.late_post_id) return jsonResponse({ success: true, message: 'Nothing to delete' });
    const result = await late.call({ endpoint: `/posts/${textPost.late_post_id}`, method: 'DELETE' });
    if (result.error) {
      if (isLateNotFound(result.error) || result.error.includes('cannot be deleted')) {
        await supabase.from('text_posts').update({ late_post_id: null }).eq('id', textPostId);
        return jsonResponse({ success: true, message: 'Reference cleared' });
      }
      throw new Error(result.error);
    }
    await supabase.from('text_posts').update({ late_post_id: null }).eq('id', textPostId);
    log.info('text_post_deleted_from_late', { textPostId });
    return jsonResponse({ success: true });
  }

  // Create or update.
  const platform = (textPost.platform as string | undefined)?.toLowerCase() ?? 'threads';
  const mappedPlatform = mapPlatform(platform);
  const { data: accountMappings } = await supabase
    .from('late_account_mappings')
    .select('platform, late_account_id, account_username')
    .eq('client_id', textPost.client_id);
  const accountMapping = accountMappings?.find((m) =>
    (m.platform as string).toLowerCase() === platform || (m.platform as string).toLowerCase() === mappedPlatform,
  );
  if (!accountMapping) {
    return jsonResponse({ success: true, skipped: true, reason: `No Late account configured for ${platform}` });
  }

  const latePayload: Record<string, unknown> = {
    content: textPost.content,
    platforms: [{ platform: mappedPlatform, accountId: accountMapping.late_account_id }],
  };
  if (shouldSyncAsDraft) latePayload.isDraft = true;
  else if (shouldSyncAsScheduled && textPost.scheduled_date) {
    latePayload.isDraft = false;
    latePayload.scheduledFor = new Date(textPost.scheduled_date).toISOString();
  }

  let result: { data?: unknown; error?: string; status?: number } | null = null;
  let lockValue: string | null = null;
  let effectiveLatePostId: string | null = textPost.late_post_id ?? null;

  if (effectiveLatePostId && isCreateLock(effectiveLatePostId)) {
    if (isStaleCreateLock(effectiveLatePostId)) {
      await supabase.from('text_posts').update({ late_post_id: null }).eq('id', textPostId).eq('late_post_id', effectiveLatePostId);
      effectiveLatePostId = null;
    } else {
      return jsonResponse({ success: true, skipped: true, reason: 'Sync already in progress' });
    }
  }

  if (effectiveLatePostId) {
    result = await late.call({ endpoint: `/posts/${effectiveLatePostId}`, method: 'PUT', body: latePayload });
    if (result.error && isLateNotEditable(result.error)) {
      return jsonResponse({ success: true, skipped: true, reason: 'Late post is not editable (likely already published).', latePostId: effectiveLatePostId });
    }
    if (result.error && isLateNotFound(result.error)) {
      await supabase.from('text_posts').update({ late_post_id: null }).eq('id', textPostId).eq('late_post_id', effectiveLatePostId);
      effectiveLatePostId = null;
      result = null;
    }
  }

  if (!effectiveLatePostId) {
    lockValue = createLockValue();
    const { data: lockRows, error: lockError } = await supabase
      .from('text_posts').update({ late_post_id: lockValue }).eq('id', textPostId).is('late_post_id', null).select('id');
    if (lockError) throw new Error('Failed to acquire sync lock');
    if (!lockRows || lockRows.length === 0) {
      const { data: latest } = await supabase.from('text_posts').select('late_post_id').eq('id', textPostId).maybeSingle();
      const latestId = (latest as { late_post_id?: string | null })?.late_post_id ?? null;
      if (latestId && !isCreateLock(latestId)) {
        return jsonResponse({ success: true, latePostId: latestId });
      }
      return jsonResponse({ success: true, skipped: true, reason: 'Sync already in progress' });
    }

    result = await late.call({ endpoint: '/posts', method: 'POST', body: latePayload, idempotencyKey: `text_post:${textPostId}` });
  }

  if (!result) throw badRequest('No API call was made');

  if (result.error) {
    if (lockValue) {
      await supabase.from('text_posts').update({ late_post_id: null }).eq('id', textPostId).eq('late_post_id', lockValue);
    }
    throw new Error(result.error);
  }

  const latePostId = extractLatePostId(result.data) ?? effectiveLatePostId;
  if (!latePostId) {
    if (lockValue) {
      await supabase.from('text_posts').update({ late_post_id: null }).eq('id', textPostId).eq('late_post_id', lockValue);
    }
    throw new Error('Could not determine Late post id from Late response');
  }

  // Build the update chain with all filters applied before .select() — Supabase
  // 2.57.2's typings won't let you add .eq() onto a TransformBuilder (post-select).
  let updateResult = lockValue
    ? await supabase.from('text_posts').update({ late_post_id: latePostId }).eq('id', textPostId).eq('late_post_id', lockValue).select('id')
    : await supabase.from('text_posts').update({ late_post_id: latePostId }).eq('id', textPostId).select('id');
  if (lockValue && (!updateResult.data || updateResult.data.length === 0) && !updateResult.error) {
    log.warn('lock_lost_during_persist', { textPostId });
    updateResult = await supabase.from('text_posts').update({ late_post_id: latePostId }).eq('id', textPostId).select('id');
  }
  if (updateResult.error) {
    if (lockValue) {
      await supabase.from('text_posts').update({ late_post_id: null }).eq('id', textPostId).eq('late_post_id', lockValue);
    }
    throw new Error('Failed to save Late post id');
  }

  log.info('text_post_synced', { textPostId, latePostId });
  return jsonResponse({ success: true, latePostId });
}));
