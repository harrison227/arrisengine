import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type ApprovalStatus = 'draft' | 'internal_review' | 'client_review' | 'revision_requested' | 'approved' | 'published';

export interface ContentApproval {
  id: string;
  content_piece_id: string;
  status: ApprovalStatus;
  reviewed_by: string | null;
  review_notes: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentComment {
  id: string;
  content_piece_id: string;
  user_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  profiles?: { full_name: string | null; email: string } | null;
}

export function useContentApprovals(contentPieceId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: approval, isLoading: approvalLoading } = useQuery({
    queryKey: ['content-approval', contentPieceId],
    queryFn: async () => {
      if (!contentPieceId) return null;
      
      const { data, error } = await supabase
        .from('content_approvals')
        .select('*')
        .eq('content_piece_id', contentPieceId)
        .maybeSingle();

      if (error) throw error;
      return data as ContentApproval | null;
    },
    enabled: !!contentPieceId,
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['content-comments', contentPieceId],
    queryFn: async () => {
      if (!contentPieceId) return [];
      
      const { data, error } = await supabase
        .from('content_comments')
        .select('*')
        .eq('content_piece_id', contentPieceId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Fetch user profiles separately
      const userIds = [...new Set((data || []).map(c => c.user_id))];
      let profilesMap: Record<string, { full_name: string | null; email: string }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = { full_name: p.full_name, email: p.email };
            return acc;
          }, {} as Record<string, { full_name: string | null; email: string }>);
        }
      }
      
      return (data || []).map(comment => ({
        ...comment,
        profiles: profilesMap[comment.user_id] || null,
      })) as ContentComment[];
    },
    enabled: !!contentPieceId,
  });

  const updateApprovalStatus = useMutation({
    mutationFn: async ({ contentPieceId, status, reviewNotes }: { contentPieceId: string; status: ApprovalStatus; reviewNotes?: string }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Check if approval exists
      const { data: existing } = await supabase
        .from('content_approvals')
        .select('id')
        .eq('content_piece_id', contentPieceId)
        .maybeSingle();

      const updates: Partial<ContentApproval> = {
        status,
        reviewed_by: user.id,
        review_notes: reviewNotes || null,
        approved_at: status === 'approved' ? new Date().toISOString() : null,
      };

      if (existing) {
        const { error } = await supabase
          .from('content_approvals')
          .update(updates)
          .eq('content_piece_id', contentPieceId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('content_approvals')
          .insert({ ...updates, content_piece_id: contentPieceId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-approval'] });
      toast({ title: 'Status updated' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const addComment = useMutation({
    mutationFn: async ({ contentPieceId, content, isInternal = true }: { contentPieceId: string; content: string; isInternal?: boolean }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('content_comments')
        .insert({
          content_piece_id: contentPieceId,
          user_id: user.id,
          content,
          is_internal: isInternal,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-comments'] });
      toast({ title: 'Comment added' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('content_comments')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-comments'] });
    },
  });

  return {
    approval,
    comments,
    isLoading: approvalLoading || commentsLoading,
    updateApprovalStatus: updateApprovalStatus.mutate,
    addComment: addComment.mutate,
    deleteComment: deleteComment.mutate,
    isUpdating: updateApprovalStatus.isPending,
  };
}
