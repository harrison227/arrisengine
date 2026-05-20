/**
 * Public read endpoint backing the shared calendar UI.
 *
 * Contract preserved:
 *   Request:  { shareId }
 *   Response: { shareLink, client, contentPieces[], textPosts[] }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { ensureNonEmptyString } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { getCalendarShareLink } from '../_shared/share-links.ts';

interface RequestBody { shareId: unknown }

const CONTENT_PIECE_COLUMNS = `
  id, concept, status, content_type, platform, hook, script, caption, hashtags,
  cta, asset_url, scheduled_date, target_duration, shot_notes, talent_notes,
  b_roll_needed, edit_notes
`;

const TEXT_POST_STATUSES = ['scheduled', 'pending_review', 'approved', 'published'] as const;

Deno.serve(withErrorHandling({ fn: 'public-calendar-data' }, async ({ req, log }) => {
  const { shareId: rawShareId } = await parseJsonBody<RequestBody>(req);
  const shareId = ensureNonEmptyString('shareId', rawShareId, 200);

  const supabase = getSupabaseAdmin();
  const shareLink = await getCalendarShareLink(supabase, shareId);

  log.info('share_link_resolved', { clientId: shareLink.client_id });

  const [clientResult, plansResult, textPostsResult] = await Promise.all([
    supabase
      .from('clients_public_safe')
      .select('business_name, brand_logo_url, brand_primary_color')
      .eq('id', shareLink.client_id)
      .maybeSingle(),
    supabase
      .from('content_plans')
      .select('id')
      .eq('client_id', shareLink.client_id),
    supabase
      .from('text_posts')
      .select('id, content, platform, status, scheduled_date')
      .eq('client_id', shareLink.client_id)
      .in('status', [...TEXT_POST_STATUSES])
      .gte('scheduled_date', shareLink.start_date ?? '1970-01-01')
      .lte('scheduled_date', shareLink.end_date ?? '9999-12-31')
      .not('scheduled_date', 'is', null),
  ]);

  if (plansResult.error) throw new Error(plansResult.error.message);
  if (textPostsResult.error) throw new Error(textPostsResult.error.message);

  const planIds = (plansResult.data ?? []).map((p) => p.id);
  const textPosts = textPostsResult.data ?? [];

  let contentPieces: Array<Record<string, unknown>> = [];
  if (planIds.length > 0) {
    const { data, error } = await supabase
      .from('content_pieces')
      .select(CONTENT_PIECE_COLUMNS)
      .in('content_plan_id', planIds)
      .gte('scheduled_date', shareLink.start_date ?? '1970-01-01')
      .lte('scheduled_date', shareLink.end_date ?? '9999-12-31')
      .not('scheduled_date', 'is', null);
    if (error) throw new Error(error.message);
    contentPieces = data ?? [];
  }

  log.info('calendar_data_assembled', {
    plans: planIds.length,
    pieces: contentPieces.length,
    textPosts: textPosts.length,
  });

  return jsonResponse({
    shareLink: {
      start_date: shareLink.start_date,
      end_date: shareLink.end_date,
      client_id: shareLink.client_id,
    },
    client: clientResult.data ?? {
      business_name: null,
      brand_logo_url: null,
      brand_primary_color: null,
    },
    contentPieces,
    textPosts,
  });
}));
