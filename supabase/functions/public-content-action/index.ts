/**
 * Public approval / change-request / rejection endpoint for content pieces
 * shared via a calendar share link.
 *
 * Contract preserved:
 *   Request:  { shareId, pieceId, action, feedback?, caption?, hashtags? }
 *   Response: { success: true, status } | { error, code, requestId }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { badRequest, forbidden, notFound } from '../_shared/errors.ts';
import { ensureEnum, ensureNonEmptyString, ensureOptionalArray, ensureOptionalString, ensureUuid, sanitizeString } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { getCalendarShareLink } from '../_shared/share-links.ts';

const ACTIONS = ['approve', 'request_changes', 'reject'] as const;
type Action = typeof ACTIONS[number];

const STATUS_BY_ACTION: Record<Action, string> = {
  approve: 'approved',
  request_changes: 'pending_review',
  reject: 'idea',
};

interface RequestBody {
  shareId: unknown;
  pieceId: unknown;
  action: unknown;
  feedback?: unknown;
  caption?: unknown;
  hashtags?: unknown;
}

Deno.serve(withErrorHandling({ fn: 'public-content-action' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const shareId = ensureNonEmptyString('shareId', body.shareId, 200);
  const pieceId = ensureUuid('pieceId', body.pieceId);
  const action = ensureEnum<Action>('action', body.action, ACTIONS);
  const rawFeedback = ensureOptionalString('feedback', body.feedback, 5_000);
  const feedback = rawFeedback !== undefined ? sanitizeString(rawFeedback, 5_000) : undefined;
  const rawCaption = ensureOptionalString('caption', body.caption, 5_000);
  const caption = rawCaption !== undefined ? sanitizeString(rawCaption, 5_000) : undefined;
  const hashtags = ensureOptionalArray('hashtags', body.hashtags, (h, i) => ensureNonEmptyString(`hashtags[${i}]`, h, 200));

  if ((action === 'request_changes' || action === 'reject') && !feedback) {
    throw badRequest('Feedback is required for this action');
  }

  const supabase = getSupabaseAdmin();
  const shareLink = await getCalendarShareLink(supabase, shareId);

  // Verify the content piece belongs to this share link's client.
  const { data: piece, error: pieceError } = await supabase
    .from('content_pieces')
    .select('id, content_plan_id, edit_notes, scheduled_date, late_post_id, content_plans!inner(client_id)')
    .eq('id', pieceId)
    .maybeSingle();

  if (pieceError || !piece) throw notFound('Content piece not found');

  const pieceClientId = (piece.content_plans as unknown as { client_id: string }).client_id;
  if (pieceClientId !== shareLink.client_id) throw forbidden('Content piece does not belong to this client');

  const newStatus = STATUS_BY_ACTION[action];
  const existingNotes = (piece as { edit_notes?: string | null }).edit_notes ?? '';
  const updatePayload: Record<string, unknown> = { status: newStatus };
  if (feedback) {
    const stamped = `[Client Feedback - ${new Date().toLocaleString()}]: ${feedback}`;
    updatePayload.edit_notes = existingNotes ? `${stamped}\n\n${existingNotes}` : stamped;
  }
  if (caption !== undefined) updatePayload.caption = caption;
  if (hashtags !== undefined) updatePayload.hashtags = hashtags;

  const { error: updateError } = await supabase.from('content_pieces').update(updatePayload).eq('id', pieceId);
  if (updateError) {
    log.error('content_update_failed', updateError, { pieceId });
    throw new Error(updateError.message);
  }

  log.info('content_updated', { pieceId, newStatus, action });

  // Fire-and-forget Late sync if the piece is approved and scheduled.
  if (action === 'approve' && piece.scheduled_date) {
    const syncAction = piece.late_post_id ? 'update' : 'create';
    try {
      await supabase.functions.invoke('sync-to-late', { body: { contentPieceId: pieceId, action: syncAction } });
      log.info('late_sync_invoked', { pieceId, syncAction });
    } catch (err) {
      // Non-blocking — approval still succeeds even if Late is down.
      log.error('late_sync_invoke_failed', err, { pieceId });
    }
  }

  return jsonResponse({ success: true, status: newStatus });
}));
