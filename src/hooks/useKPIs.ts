import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tables, TablesInsert } from '@/integrations/supabase/types';

type KPI = Tables<'kpis'>;
type KPIEntry = Tables<'kpi_entries'>;
type KPIInsert = TablesInsert<'kpis'>;
type KPIEntryInsert = TablesInsert<'kpi_entries'>;

export function useKPIs(clientId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const kpisQuery = useQuery({
    queryKey: ['kpis', clientId],
    queryFn: async () => {
      let q = supabase
        .from('kpis')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (clientId) {
        q = q.eq('client_id', clientId);
      }
      
      const { data, error } = await q;
      if (error) throw error;
      return data as KPI[];
    },
    enabled: !!user,
  });

  const entriesQuery = useQuery({
    queryKey: ['kpi_entries', clientId],
    queryFn: async () => {
      if (!kpisQuery.data?.length) return [];
      
      const kpiIds = kpisQuery.data.map(k => k.id);
      
      const { data, error } = await supabase
        .from('kpi_entries')
        .select('*')
        .in('kpi_id', kpiIds)
        .order('recorded_date', { ascending: true });
      
      if (error) throw error;
      return data as KPIEntry[];
    },
    enabled: !!user && !!kpisQuery.data?.length,
  });

  const createKPIMutation = useMutation({
    mutationFn: async (kpi: Omit<KPIInsert, 'id'>) => {
      const { data, error } = await supabase
        .from('kpis')
        .insert(kpi)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpis', clientId] });
      toast({ title: 'KPI created successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create KPI', description: error.message, variant: 'destructive' });
    },
  });

  const logEntryMutation = useMutation({
    mutationFn: async (entry: Omit<KPIEntryInsert, 'id'>) => {
      const { data, error } = await supabase
        .from('kpi_entries')
        .insert(entry)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi_entries', clientId] });
      toast({ title: 'Entry logged successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to log entry', description: error.message, variant: 'destructive' });
    },
  });

  const deleteKPIMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('kpis')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpis', clientId] });
      toast({ title: 'KPI deleted successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete KPI', description: error.message, variant: 'destructive' });
    },
  });

  return {
    kpis: kpisQuery.data ?? [],
    entries: entriesQuery.data ?? [],
    isLoading: kpisQuery.isLoading,
    createKPI: createKPIMutation.mutate,
    logEntry: logEntryMutation.mutate,
    deleteKPI: deleteKPIMutation.mutate,
    isCreating: createKPIMutation.isPending,
    isLogging: logEntryMutation.isPending,
  };
}
