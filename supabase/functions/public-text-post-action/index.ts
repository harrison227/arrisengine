/**
 * Public approval / change-request / rejection endpoint for text posts
 * (shared via a calendar share link, same as public-content-action).
 *
 * Contract preserved:
 *   Request:  { shareId, postId, action, feedback?, content? }
 *   Response: { success: true, status } | { error, code, requestId }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { badRequest, forbidden, notFound } from '../_shared/errors.ts';
import { ensureEnum, ensureNonEmptyString, ensureOptionalString, ensureUuid, sanitizeString } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { getCalendarShareLink } from '../_shared/share-links.ts';

const ACTIONS = ['approve', 'request_changes', 'reject'] as const;
type Action = typeof ACTIONS[number];

const STATUS_BY_ACTION: Record<Action, string> = {
  approve: 'approved',
  request_changes: 'changes_requested',
  reject: 'rejected',
};

interface RequestBody {
  shareId: unknown;
  postId: unknown;
  action: unknown;
  feedback?: unknown;
  content?: unknown;
}

Deno.serve(withErrorHandling({ fn: 'public-text-post-action' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const shareId = ensureNonEmptyString('shareId', body.shareId, 200);
  const postId = ensureUuid('postId', body.postId);
  const action = ensureEnum<Action>('action', body.action, ACTIONS);
  const rawFeedback = ensureOptionalString('feedback', body.feedback, 5_000);
  const feedback = rawFeedback !== undefined ? sanitizeString(rawFeedback, 5_000) : undefined;
  const rawContent = ensureOptionalString('content', body.content, 5_000);
  const content = rawContent !== undefined ? sanitizeString(rawContent, 5_000) : undefined;

  if ((action === 'request_changes' || action === 'reject') && !feedback) {
    throw badRequest('Feedback is required for this action');
  }

  const supabase = getSupabaseAdmin();
  const shareLink = await getCalendarShareLink(supabase, shareId);

  const { data: post, error: postError } = await supabase
    .from('text_posts')
    .select('id, client_id, scheduled_date')
    .eq('id', postId)
    .maybeSingle();

  if (postError || !post) throw notFound('Post not found');
  if (post.client_id !== shareLink.client_id) throw forbidden('Post does not belong to this client');

  const newStatus = STATUS_BY_ACTION[action];
  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    client_feedback: feedback ?? null,
    client_feedback_at: new Date().toISOString(),
    client_feedback_by: 'client',
  };
  if (content !== undefined) updatePayload.content = content;

  const { error: updateError } = await supabase.from('text_posts').update(updatePayload).eq('id', postId);
  if (updateError) {
    log.error('text_post_update_failed', updateError, { postId });
    throw new Error(updateError.message);
  }

  log.info('text_post_updated', { postId, newStatus, action });
  return jsonResponse({ success: true, status: newStatus });
}));
