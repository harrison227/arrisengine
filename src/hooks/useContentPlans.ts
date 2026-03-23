import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

type ContentPlan = Tables<'content_plans'>;
type ContentPlanInsert = TablesInsert<'content_plans'>;
type ContentPlanUpdate = TablesUpdate<'content_plans'>;

interface ContentIdea {
  hook: string;
  script?: string;
  shotList?: string[];
  audioSuggestion?: string;
  formatType: string;
  platform: string;
  trendingAngle?: string;
  duration?: number;
}

interface SavePlanParams {
  clientId: string;
  title: string;
  contentIdeas: ContentIdea[];
  filmingDate?: string;
  strategyNotes?: string;
}

export function useContentPlans(clientId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['content_plans', clientId],
    queryFn: async () => {
      let queryBuilder = supabase
        .from('content_plans')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (clientId) {
        queryBuilder = queryBuilder.eq('client_id', clientId);
      }
      
      const { data, error } = await queryBuilder;
      
      if (error) throw error;
      return data as ContentPlan[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (plan: ContentPlanInsert) => {
      const { data, error } = await supabase
        .from('content_plans')
        .insert(plan)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content_plans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      toast({ title: 'Content plan created' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create plan', description: error.message, variant: 'destructive' });
    },
  });

  // Save plan with content ideas (stores ideas as JSON in brief field)
  const savePlanMutation = useMutation({
    mutationFn: async ({ clientId, title, contentIdeas, filmingDate, strategyNotes }: SavePlanParams) => {
      const { data, error } = await supabase
        .from('content_plans')
        .insert({
          client_id: clientId,
          title,
          brief: JSON.stringify(contentIdeas),
          filming_date: filmingDate || null,
          strategy_notes: strategyNotes || null,
          status: 'planning',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content_plans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      toast({ title: 'Plan saved!', description: 'Your content plan has been saved.' });
    },
    onError: (error) => {
      toast({ title: 'Failed to save plan', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: ContentPlanUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('content_plans')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content_plans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
    },
    onError: (error) => {
      toast({ title: 'Failed to update plan', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('content_plans')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content_plans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      toast({ title: 'Content plan deleted' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete plan', description: error.message, variant: 'destructive' });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (plan: ContentPlan) => {
      const { data, error } = await supabase
        .from('content_plans')
        .insert({
          client_id: plan.client_id,
          title: `${plan.title} (Copy)`,
          brief: plan.brief,
          strategy_notes: plan.strategy_notes,
          filming_date: plan.filming_date,
          status: 'planning',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content_plans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] });
      toast({ title: 'Plan duplicated!', description: 'A copy of the plan has been created.' });
    },
    onError: (error) => {
      toast({ title: 'Failed to duplicate plan', description: error.message, variant: 'destructive' });
    },
  });

  return {
    contentPlans: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createContentPlan: createMutation.mutate,
    savePlan: savePlanMutation.mutateAsync,
    updateContentPlan: updateMutation.mutate,
    deleteContentPlan: deleteMutation.mutate,
    duplicateContentPlan: duplicateMutation.mutate,
    isCreating: createMutation.isPending,
    isSaving: savePlanMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isDuplicating: duplicateMutation.isPending,
  };
}
