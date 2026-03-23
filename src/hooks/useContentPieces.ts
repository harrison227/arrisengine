import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Late sync helper (fire-and-forget) - only syncs if approved and scheduled
const syncToLate = async (
  pieceOrId: { id: string; status: string; scheduled_date: string | null; late_post_id?: string | null } | string, 
  action: 'create' | 'update' | 'delete',
  latePostId?: string | null
) => {
  const pieceId = typeof pieceOrId === 'string' ? pieceOrId : pieceOrId.id;
  const postId = latePostId ?? (typeof pieceOrId !== 'string' ? pieceOrId.late_post_id : null);
  
  // Only sync if approved and has scheduled date (except for delete)
  if (action !== 'delete' && typeof pieceOrId !== 'string') {
    if (pieceOrId.status !== 'approved' || !pieceOrId.scheduled_date) {
      console.log('Skipping Late sync - content not approved or not scheduled');
      return;
    }
  }
  
  try {
    await supabase.functions.invoke('sync-to-late', {
      body: { contentPieceId: pieceId, action, latePostId: postId },
    });
  } catch (error) {
    console.error('Late sync error:', error);
  }
};

export interface ContentPiece {
  id: string;
  content_plan_id: string;
  filming_day_id: string | null;
  concept: string;
  hook: string | null;
  content_type: 'video' | 'image' | 'carousel' | 'story' | 'reel' | 'ugc';
  platform: string;
  status: 'idea' | 'scripted' | 'filmed' | 'edited' | 'approved' | 'live';
  asset_url: string | null;
  sort_order: number;
  script: string | null;
  shot_notes: string | null;
  cta: string | null;
  target_duration: number | null;
  talent_notes: string | null;
  b_roll_needed: string[];
  edit_notes: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  // Fields for social scheduling
  caption: string | null;
  hashtags: string[] | null;
  platforms: string[] | null;
  scheduled_date: string | null;
  // Late sync fields
  late_post_id: string | null;
  late_sync_status: 'synced' | 'pending' | 'error' | 'not_synced' | null;
  late_last_synced_at: string | null;
  late_error_message: string | null;
  // Instagram-specific fields
  instagram_first_comment: string | null;
  instagram_collaborators: string[] | null;
}

export interface ContentPieceInsert {
  content_plan_id: string;
  filming_day_id?: string | null;
  concept: string;
  hook?: string | null;
  content_type: 'video' | 'image' | 'carousel' | 'story' | 'reel' | 'ugc';
  platform: string;
  status?: 'idea' | 'scripted' | 'filmed' | 'edited' | 'approved' | 'live';
  sort_order?: number;
  script?: string | null;
  shot_notes?: string | null;
  cta?: string | null;
  target_duration?: number | null;
  talent_notes?: string | null;
  b_roll_needed?: string[];
  edit_notes?: string | null;
  asset_url?: string | null;
  // New fields for social scheduling
  caption?: string | null;
  hashtags?: string[] | null;
  platforms?: string[] | null;
  scheduled_date?: string | null;
  // Instagram-specific fields
  instagram_first_comment?: string | null;
  instagram_collaborators?: string[] | null;
}

export interface ContentPieceUpdate {
  id: string;
  filming_day_id?: string | null;
  concept?: string;
  hook?: string | null;
  content_type?: 'video' | 'image' | 'carousel' | 'story' | 'reel' | 'ugc';
  platform?: string;
  status?: 'idea' | 'scripted' | 'filmed' | 'edited' | 'approved' | 'live';
  sort_order?: number;
  script?: string | null;
  shot_notes?: string | null;
  cta?: string | null;
  target_duration?: number | null;
  talent_notes?: string | null;
  b_roll_needed?: string[];
  edit_notes?: string | null;
  version?: number;
  asset_url?: string | null;
  // New fields for social scheduling
  caption?: string | null;
  hashtags?: string[] | null;
  platforms?: string[] | null;
  scheduled_date?: string | null;
  // Instagram-specific fields
  instagram_first_comment?: string | null;
  instagram_collaborators?: string[] | null;
}

export function useContentPieces(contentPlanId?: string, filmingDayId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['content_pieces', contentPlanId, filmingDayId],
    queryFn: async () => {
      let q = supabase
        .from('content_pieces')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (contentPlanId) {
        q = q.eq('content_plan_id', contentPlanId);
      }
      
      if (filmingDayId) {
        q = q.eq('filming_day_id', filmingDayId);
      }
      
      const { data, error } = await q;
      if (error) throw error;
      return data as ContentPiece[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (piece: ContentPieceInsert) => {
      const { data, error } = await supabase
        .from('content_pieces')
        .insert(piece)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['content_pieces'] });
      toast({ title: 'Content piece created' });
      // Fire-and-forget Late sync (only if approved and scheduled)
      syncToLate(data, 'create');
    },
    onError: (error) => {
      toast({ title: 'Failed to create content piece', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: ContentPieceUpdate) => {
      const { data, error } = await supabase
        .from('content_pieces')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['content_pieces'] });
      toast({ title: 'Content piece updated' });
      // Fire-and-forget Late sync (only if approved and scheduled)
      syncToLate(data, 'update');
    },
    onError: (error) => {
      toast({ title: 'Failed to update content piece', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, latePostId }: { id: string; latePostId?: string | null }) => {
      // Fire-and-forget Late sync BEFORE deleting (pass latePostId since piece will be gone)
      syncToLate(id, 'delete', latePostId);
      
      const { error } = await supabase
        .from('content_pieces')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content_pieces'] });
      toast({ title: 'Content piece deleted' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete content piece', description: error.message, variant: 'destructive' });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (pieces: { id: string; sort_order: number }[]) => {
      const updates = pieces.map(p => 
        supabase
          .from('content_pieces')
          .update({ sort_order: p.sort_order })
          .eq('id', p.id)
      );
      
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content_pieces'] });
    },
    onError: (error) => {
      toast({ title: 'Failed to reorder pieces', description: error.message, variant: 'destructive' });
    },
  });

  return {
    pieces: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createPiece: createMutation.mutate,
    updatePiece: updateMutation.mutate,
    deletePiece: deleteMutation.mutate,
    reorderPieces: reorderMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
