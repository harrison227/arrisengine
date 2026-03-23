import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncResult {
  success: boolean;
  latePostId?: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

export function useTextPostSync() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: async ({ 
      textPostId, 
      action 
    }: { 
      textPostId: string; 
      action: 'create' | 'update' | 'delete';
    }): Promise<SyncResult> => {
      const { data, error } = await supabase.functions.invoke('sync-text-to-late', {
        body: { textPostId, action },
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as SyncResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['text-posts'] });
      
      if (data.success && !data.skipped) {
        // Silent success - don't spam toasts
        console.log('Text post synced to Late:', data.latePostId);
      }
    },
    onError: (error: Error) => {
      // Don't show error toast - sync failures shouldn't block the user
      console.error('Late text post sync failed:', error.message);
    },
  });

  const syncTextPost = async (textPostId: string, action: 'create' | 'update' | 'delete') => {
    try {
      await syncMutation.mutateAsync({ textPostId, action });
    } catch (error) {
      // Silently fail - sync errors don't block local operations
      console.error('Late text post sync error:', error);
    }
  };

  // Sync multiple posts (for batch scheduling)
  const syncMultiplePosts = async (textPostIds: string[], action: 'create' | 'update' | 'delete') => {
    const promises = textPostIds.map(id => syncTextPost(id, action));
    await Promise.allSettled(promises);
  };

  return {
    syncTextPost,
    syncMultiplePosts,
    isSyncing: syncMutation.isPending,
  };
}