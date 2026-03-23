import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type AdLaunch = Tables<'ad_launches'>;
type AdLaunchInsert = TablesInsert<'ad_launches'>;
type AdLaunchUpdate = TablesUpdate<'ad_launches'>;

export function useAdLaunches(clientId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ad_launches', clientId],
    queryFn: async () => {
      let queryBuilder = supabase
        .from('ad_launches')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (clientId) {
        queryBuilder = queryBuilder.eq('client_id', clientId);
      }
      
      const { data, error } = await queryBuilder;
      
      if (error) throw error;
      return data as AdLaunch[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (launch: AdLaunchInsert) => {
      const { data, error } = await supabase
        .from('ad_launches')
        .insert(launch)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad_launches'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      toast({ title: 'Ad campaign created' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create campaign', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: AdLaunchUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('ad_launches')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad_launches'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      toast({ title: 'Ad campaign updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update campaign', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ad_launches')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad_launches'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      toast({ title: 'Ad campaign deleted' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete campaign', description: error.message, variant: 'destructive' });
    },
  });

  return {
    adLaunches: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createAdLaunch: createMutation.mutate,
    updateAdLaunch: updateMutation.mutate,
    deleteAdLaunch: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
