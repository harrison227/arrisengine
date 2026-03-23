import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface AdSuggestion {
  id: string;
  client_id: string;
  hook: string;
  target_emotion: string;
  format: string;
  platform: string;
  description: string;
  created_at: string;
}

export function useAdSuggestions(clientId: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ad_suggestions', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_suggestions')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AdSuggestion[];
    },
    enabled: !!user && !!clientId,
  });

  const generateMutation = useMutation({
    mutationFn: async ({ clientName, industry }: { clientName?: string; industry?: string }) => {
      const { data, error } = await supabase.functions.invoke('suggest-ad-angles', {
        body: { clientId, clientName, industry },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad_suggestions', clientId] });
      toast({ title: 'Ad angle suggestions generated!' });
    },
    onError: (error) => {
      toast({ 
        title: 'Failed to generate suggestions', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ad_suggestions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad_suggestions', clientId] });
      toast({ title: 'Suggestion removed' });
    },
    onError: (error) => {
      toast({ title: 'Failed to remove suggestion', description: error.message, variant: 'destructive' });
    },
  });

  return {
    suggestions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    generateSuggestions: generateMutation.mutate,
    isGenerating: generateMutation.isPending,
    deleteSuggestion: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
