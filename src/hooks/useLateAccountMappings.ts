import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface LateAccountMapping {
  id: string;
  client_id: string;
  platform: string;
  late_account_id: string;
  account_username: string | null;
  created_at: string;
}

export interface LateAccountMappingInsert {
  client_id: string;
  platform: string;
  late_account_id: string;
  account_username?: string | null;
}

export interface LateAccountMappingUpdate {
  id: string;
  late_account_id?: string;
  account_username?: string | null;
}

export function useLateAccountMappings(clientId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['late_account_mappings', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('late_account_mappings')
        .select('*')
        .eq('client_id', clientId)
        .order('platform');

      if (error) throw error;
      return data as LateAccountMapping[];
    },
    enabled: !!clientId,
  });

  const createMutation = useMutation({
    mutationFn: async (mapping: LateAccountMappingInsert) => {
      const { data, error } = await supabase
        .from('late_account_mappings')
        .insert(mapping)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['late_account_mappings', clientId] });
      toast({ title: 'Account mapping added' });
    },
    onError: (error) => {
      toast({ title: 'Failed to add mapping', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: LateAccountMappingUpdate) => {
      const { data, error } = await supabase
        .from('late_account_mappings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['late_account_mappings', clientId] });
      toast({ title: 'Account mapping updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update mapping', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('late_account_mappings')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['late_account_mappings', clientId] });
      toast({ title: 'Account mapping removed' });
    },
    onError: (error) => {
      toast({ title: 'Failed to remove mapping', description: error.message, variant: 'destructive' });
    },
  });

  return {
    mappings: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createMapping: createMutation.mutate,
    updateMapping: updateMutation.mutate,
    deleteMapping: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
