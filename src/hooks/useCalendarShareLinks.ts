import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CalendarShareLink {
  id: string;
  share_id: string;
  client_id: string;
  start_date: string;
  end_date: string;
  created_at: string;
  created_by: string;
  is_active: boolean;
}

interface CreateShareLinkInput {
  clientId: string;
  startDate: string;
  endDate: string;
}

// Generate a random alphanumeric share ID
const generateShareId = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export function useCalendarShareLinks(clientId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shareLinks = [], isLoading, error } = useQuery({
    queryKey: ['calendar_share_links', clientId],
    queryFn: async () => {
      let query = supabase
        .from('calendar_share_links')
        .select('*')
        .order('created_at', { ascending: false });

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CalendarShareLink[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateShareLinkInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const shareId = generateShareId();
      
      const { data, error } = await supabase
        .from('calendar_share_links')
        .insert({
          share_id: shareId,
          client_id: input.clientId,
          start_date: input.startDate,
          end_date: input.endDate,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CalendarShareLink;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendar_share_links'] });
      toast({
        title: 'Share link created',
        description: 'The calendar share link has been generated.',
      });
      return data;
    },
    onError: (error) => {
      console.error('Failed to create share link:', error);
      toast({
        title: 'Error',
        description: 'Failed to create share link. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('calendar_share_links')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar_share_links'] });
      toast({
        title: 'Link deactivated',
        description: 'The share link has been deactivated.',
      });
    },
    onError: (error) => {
      console.error('Failed to deactivate share link:', error);
      toast({
        title: 'Error',
        description: 'Failed to deactivate share link.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('calendar_share_links')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar_share_links'] });
      toast({
        title: 'Link deleted',
        description: 'The share link has been deleted.',
      });
    },
    onError: (error) => {
      console.error('Failed to delete share link:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete share link.',
        variant: 'destructive',
      });
    },
  });

  return {
    shareLinks,
    isLoading,
    error,
    createShareLink: createMutation.mutateAsync,
    deactivateShareLink: deactivateMutation.mutate,
    deleteShareLink: deleteMutation.mutate,
    isCreating: createMutation.isPending,
  };
}

// Separate hook for fetching a single share link by shareId (for public page)
export function usePublicShareLink(shareId: string | undefined) {
  return useQuery({
    queryKey: ['public_share_link', shareId],
    queryFn: async () => {
      if (!shareId) return null;
      
      const { data, error } = await supabase
        .from('calendar_share_links')
        .select('*')
        .eq('share_id', shareId)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      return data as CalendarShareLink;
    },
    enabled: !!shareId,
  });
}
