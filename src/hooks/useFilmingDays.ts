import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface FilmingDay {
  id: string;
  client_id: string;
  date: string;
  location: string | null;
  call_time: string | null;
  wrap_time: string | null;
  notes: string | null;
  equipment_needed: string[];
  team_members: string[];
  status: 'upcoming' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
  client_change_requested: boolean | null;
  client_requested_date: string | null;
  client_requested_time: string | null;
  client_change_notes: string | null;
  client_change_requested_at: string | null;
}

export interface FilmingDayInsert {
  client_id: string;
  date: string;
  location?: string | null;
  call_time?: string | null;
  wrap_time?: string | null;
  notes?: string | null;
  equipment_needed?: string[];
  team_members?: string[];
  status?: 'upcoming' | 'in_progress' | 'completed';
}

export interface FilmingDayUpdate {
  id: string;
  date?: string;
  location?: string | null;
  call_time?: string | null;
  wrap_time?: string | null;
  notes?: string | null;
  equipment_needed?: string[];
  team_members?: string[];
  status?: 'upcoming' | 'in_progress' | 'completed';
  client_change_requested?: boolean | null;
  client_requested_date?: string | null;
  client_requested_time?: string | null;
  client_change_notes?: string | null;
  client_change_requested_at?: string | null;
}

export function useFilmingDays(clientId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['filming_days', clientId],
    queryFn: async () => {
      let q = supabase
        .from('filming_days')
        .select('*')
        .order('date', { ascending: true });
      
      if (clientId) {
        q = q.eq('client_id', clientId);
      }
      
      const { data, error } = await q;
      if (error) throw error;
      return data as FilmingDay[];
    },
    enabled: !!user,
  });

  const activeFilmingDay = query.data?.find(
    (day) => day.status === 'upcoming' || day.status === 'in_progress'
  );

  const createMutation = useMutation({
    mutationFn: async (filmingDay: FilmingDayInsert) => {
      const { data, error } = await supabase
        .from('filming_days')
        .insert(filmingDay)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filming_days'] });
      toast({ title: 'Filming day created' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create filming day', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: FilmingDayUpdate) => {
      const { data, error } = await supabase
        .from('filming_days')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filming_days'] });
      toast({ title: 'Filming day updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update filming day', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('filming_days')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filming_days'] });
      toast({ title: 'Filming day deleted' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete filming day', description: error.message, variant: 'destructive' });
    },
  });

  return {
    filmingDays: query.data ?? [],
    activeFilmingDay,
    isLoading: query.isLoading,
    error: query.error,
    createFilmingDay: createMutation.mutate,
    updateFilmingDay: updateMutation.mutate,
    deleteFilmingDay: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
