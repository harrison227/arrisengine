import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ImageRevision {
  id: string;
  version: number;
  imageUrl: string;
  model_used: string | null;
  feedback: string | null;
  created_at: string;
}

export function useImageRevisions(batchItemId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: revisions = [], isLoading, refetch } = useQuery({
    queryKey: ['image-revisions', batchItemId],
    queryFn: async () => {
      if (!batchItemId) return [];
      
      const { data, error } = await supabase
        .from('image_batch_revisions')
        .select('*')
        .eq('batch_item_id', batchItemId)
        .order('version', { ascending: true });
      
      if (error) {
        console.error('Error fetching revisions:', error);
        return [];
      }
      
      return (data || []).map(rev => ({
        id: rev.id,
        version: rev.version,
        imageUrl: rev.image_url,
        model_used: rev.model_used,
        feedback: rev.feedback,
        created_at: rev.created_at,
      })) as ImageRevision[];
    },
    enabled: !!batchItemId,
  });

  const deleteRevisionMutation = useMutation({
    mutationFn: async (revisionId: string) => {
      const { error } = await supabase
        .from('image_batch_revisions')
        .delete()
        .eq('id', revisionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['image-revisions', batchItemId] });
      toast.success('Version deleted');
    },
    onError: (error) => {
      console.error('Error deleting revision:', error);
      toast.error('Failed to delete version');
    },
  });

  return { 
    revisions, 
    isLoading, 
    refetch,
    deleteRevision: deleteRevisionMutation.mutateAsync,
    isDeletingRevision: deleteRevisionMutation.isPending,
  };
}
