import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';

type ClientAssignment = Tables<'client_assignments'>;

export function useClientAssignments(userId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['client_assignments', userId],
    queryFn: async () => {
      let q = supabase
        .from('client_assignments')
        .select(`
          *,
          client:clients(id, business_name)
        `)
        .order('created_at', { ascending: false });
      
      if (userId) {
        q = q.eq('user_id', userId);
      }
      
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const assignMutation = useMutation({
    mutationFn: async ({ userId, clientId, isPrimary = false }: { userId: string; clientId: string; isPrimary?: boolean }) => {
      const { data, error } = await supabase
        .from('client_assignments')
        .insert({
          user_id: userId,
          client_id: clientId,
          is_primary: isPrimary,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client_assignments'] });
      toast({ title: 'Client assigned successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to assign client', description: error.message, variant: 'destructive' });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('client_assignments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client_assignments'] });
      toast({ title: 'Client unassigned successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to unassign client', description: error.message, variant: 'destructive' });
    },
  });

  return {
    assignments: query.data ?? [],
    isLoading: query.isLoading,
    assignClient: assignMutation.mutate,
    unassignClient: unassignMutation.mutate,
    isAssigning: assignMutation.isPending,
  };
}
