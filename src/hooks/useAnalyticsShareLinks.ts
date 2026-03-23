import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AnalyticsShareLink {
  id: string;
  client_id: string;
  share_id: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  date_range_start: string | null;
  date_range_end: string | null;
  platforms: string[] | null;
}

interface CreateShareLinkParams {
  clientId: string;
  expiresAt?: string | null;
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
  platforms?: string[] | null;
}

export function useAnalyticsShareLinks(clientId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: shareLinks, isLoading } = useQuery({
    queryKey: ['analytics-share-links', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('analytics_share_links')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AnalyticsShareLink[];
    },
    enabled: !!clientId,
  });

  const createShareLink = useMutation({
    mutationFn: async (params: CreateShareLinkParams) => {
      if (!user) throw new Error('User not authenticated');

      const shareId = crypto.randomUUID().slice(0, 8);

      const { data, error } = await supabase
        .from('analytics_share_links')
        .insert({
          client_id: params.clientId,
          share_id: shareId,
          created_by: user.id,
          expires_at: params.expiresAt,
          date_range_start: params.dateRangeStart,
          date_range_end: params.dateRangeEnd,
          platforms: params.platforms,
        })
        .select()
        .single();

      if (error) throw error;
      return data as AnalyticsShareLink;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics-share-links'] });
      toast.success('Share link created successfully');
    },
    onError: (error) => {
      console.error('Error creating share link:', error);
      toast.error('Failed to create share link');
    },
  });

  const deactivateShareLink = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from('analytics_share_links')
        .update({ is_active: false })
        .eq('id', linkId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics-share-links'] });
      toast.success('Share link deactivated');
    },
    onError: (error) => {
      console.error('Error deactivating share link:', error);
      toast.error('Failed to deactivate share link');
    },
  });

  const deleteShareLink = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from('analytics_share_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics-share-links'] });
      toast.success('Share link deleted');
    },
    onError: (error) => {
      console.error('Error deleting share link:', error);
      toast.error('Failed to delete share link');
    },
  });

  return {
    shareLinks: shareLinks || [],
    isLoading,
    createShareLink,
    deactivateShareLink,
    deleteShareLink,
  };
}
