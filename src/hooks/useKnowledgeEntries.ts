import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type KnowledgeEntry = Tables<'knowledge_entries'>;
type KnowledgeEntryInsert = TablesInsert<'knowledge_entries'>;
type KnowledgeEntryUpdate = TablesUpdate<'knowledge_entries'>;

export function useKnowledgeEntries(clientId: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['knowledge_entries', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_entries')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as KnowledgeEntry[];
    },
    enabled: !!user && !!clientId,
  });

  const createMutation = useMutation({
    mutationFn: async (entry: Omit<KnowledgeEntryInsert, 'created_by'>) => {
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('knowledge_entries')
        .insert({ ...entry, created_by: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge_entries', clientId] });
      toast({ title: 'Knowledge entry created' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create entry', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: KnowledgeEntryUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('knowledge_entries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge_entries', clientId] });
      toast({ title: 'Knowledge entry updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update entry', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('knowledge_entries')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge_entries', clientId] });
      toast({ title: 'Knowledge entry deleted' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete entry', description: error.message, variant: 'destructive' });
    },
  });

  return {
    entries: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createEntry: createMutation.mutate,
    updateEntry: updateMutation.mutate,
    deleteEntry: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
