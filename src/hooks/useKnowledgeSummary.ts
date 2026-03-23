import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface KnowledgeSummary {
  id: string;
  client_id: string;
  positioning_summary: string | null;
  key_differentiators: string[];
  content_opportunities: string[];
  compliance_flags: string[];
  ideal_customer_profile: string | null;
  generated_at: string;
}

export interface KnowledgeSummaryUpsert {
  client_id: string;
  positioning_summary?: string | null;
  key_differentiators?: string[];
  content_opportunities?: string[];
  compliance_flags?: string[];
  ideal_customer_profile?: string | null;
}

export function useKnowledgeSummary(clientId: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['knowledge_summary', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_summary')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle();
      
      if (error) throw error;
      return data as KnowledgeSummary | null;
    },
    enabled: !!user && !!clientId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (summary: KnowledgeSummaryUpsert) => {
      const { data, error } = await supabase
        .from('knowledge_summary')
        .upsert({
          ...summary,
          generated_at: new Date().toISOString(),
        }, { onConflict: 'client_id' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge_summary', clientId] });
      toast({ title: 'Knowledge summary updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update summary', description: error.message, variant: 'destructive' });
    },
  });

  return {
    summary: query.data,
    isLoading: query.isLoading,
    error: query.error,
    upsertSummary: upsertMutation.mutate,
    isUpserting: upsertMutation.isPending,
  };
}
