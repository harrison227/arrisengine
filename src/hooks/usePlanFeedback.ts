import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlanFeedbackItem {
  id: string;
  share_link_id: string;
  content_plan_id: string;
  idea_index: number;
  idea_title: string | null;
  status: 'approved' | 'revision' | 'rejected';
  feedback_text: string | null;
  submitted_at: string;
  submitted_by_name: string | null;
}

export interface FeedbackGroup {
  shareLink: {
    id: string;
    share_id: string;
    client_name: string | null;
    feedback_submitted_at: string | null;
  };
  items: PlanFeedbackItem[];
  stats: {
    approved: number;
    revision: number;
    rejected: number;
    total: number;
  };
}

export const usePlanFeedback = (contentPlanId?: string) => {
  return useQuery({
    queryKey: ['plan_feedback', contentPlanId],
    queryFn: async () => {
      if (!contentPlanId) return [];

      // Fetch all share links for this plan that have feedback
      const { data: shareLinks, error: shareLinksError } = await supabase
        .from('plan_share_links')
        .select('id, share_id, client_name, feedback_submitted_at')
        .eq('content_plan_id', contentPlanId)
        .not('feedback_submitted_at', 'is', null)
        .order('feedback_submitted_at', { ascending: false });

      if (shareLinksError) throw shareLinksError;
      if (!shareLinks || shareLinks.length === 0) return [];

      // Fetch all feedback items for these share links
      const shareLinkIds = shareLinks.map(sl => sl.id);
      const { data: feedbackItems, error: feedbackError } = await supabase
        .from('plan_feedback')
        .select('*')
        .in('share_link_id', shareLinkIds)
        .order('idea_index', { ascending: true });

      if (feedbackError) throw feedbackError;

      // Group feedback by share link
      const feedbackGroups: FeedbackGroup[] = shareLinks.map(shareLink => {
        const items = (feedbackItems || []).filter(
          item => item.share_link_id === shareLink.id
        ) as PlanFeedbackItem[];

        const stats = {
          approved: items.filter(i => i.status === 'approved').length,
          revision: items.filter(i => i.status === 'revision').length,
          rejected: items.filter(i => i.status === 'rejected').length,
          total: items.length,
        };

        return {
          shareLink,
          items,
          stats,
        };
      });

      return feedbackGroups;
    },
    enabled: !!contentPlanId,
  });
};

export const useLatestPlanFeedbackStats = (contentPlanId?: string) => {
  const { data: feedbackGroups, isLoading } = usePlanFeedback(contentPlanId);

  if (!feedbackGroups || feedbackGroups.length === 0) {
    return { stats: null, isLoading, hasFeedback: false };
  }

  // Get the most recent feedback group
  const latest = feedbackGroups[0];
  return {
    stats: latest.stats,
    isLoading,
    hasFeedback: true,
    submittedAt: latest.shareLink.feedback_submitted_at,
    clientName: latest.shareLink.client_name,
  };
};
