import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncResult {
  success: boolean;
  latePostId?: string;
  error?: string;
}

interface StatusSyncResult {
  success: boolean;
  updated: number;
  message?: string;
}

export function useLateSync() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: async ({ 
      contentPieceId, 
      action,
      latePostId,
    }: { 
      contentPieceId: string; 
      action: 'create' | 'update' | 'delete';
      latePostId?: string | null;
    }): Promise<SyncResult> => {
      const { data, error } = await supabase.functions.invoke('sync-to-late', {
        body: { contentPieceId, action, latePostId },
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as SyncResult;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['content_pieces'] });
      
      if (data.success) {
        toast({ 
          title: variables.action === 'delete' ? 'Removed from Late' : 'Synced to Late',
          description: data.latePostId ? `Post ID: ${data.latePostId}` : undefined,
        });
      }
    },
    onError: (error: Error) => {
      // Don't show error toast - sync failures shouldn't block the user
      console.error('Late sync failed:', error.message);
    },
  });

  const statusSyncMutation = useMutation({
    mutationFn: async (clientId?: string): Promise<StatusSyncResult> => {
      const { data, error } = await supabase.functions.invoke('sync-late-status', {
        body: clientId ? { clientId } : {},
      });

      if (error) {
        throw new Error(error.message);
      }

      return data as StatusSyncResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['content_pieces'] });
      queryClient.invalidateQueries({ queryKey: ['text-posts'] });
      
      if (data.updated > 0) {
        toast({ 
          title: 'Status synced from Late',
          description: `Updated ${data.updated} posts to published`,
        });
      } else {
        toast({ 
          title: 'Status synced',
          description: 'All posts are already up to date',
        });
      }
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Sync failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const syncToLate = async (contentPieceId: string, action: 'create' | 'update' | 'delete', latePostId?: string | null) => {
    try {
      await syncMutation.mutateAsync({ contentPieceId, action, latePostId });
    } catch (error) {
      // Silently fail - sync errors don't block local operations
      console.error('Late sync error:', error);
    }
  };

  const retrySyncToLate = async (contentPieceId: string) => {
    toast({ title: 'Retrying sync...' });
    await syncToLate(contentPieceId, 'update');
  };

  const syncStatusFromLate = async (clientId?: string): Promise<StatusSyncResult | null> => {
    try {
      return await statusSyncMutation.mutateAsync(clientId);
    } catch {
      return null;
    }
  };

  return {
    syncToLate,
    retrySyncToLate,
    syncStatusFromLate,
    isSyncing: syncMutation.isPending,
    isSyncingStatus: statusSyncMutation.isPending,
  };
}