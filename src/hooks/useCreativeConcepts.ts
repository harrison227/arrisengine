import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface CreativeConcept {
  id: string;
  client_id: string;
  hook: string;
  description: string;
  target_emotion: string;
  format: string;
  platform: string;
  status: 'idea' | 'in_development' | 'active' | 'paused' | 'retired';
  cta_options: string[];
  target_audiences: string[];
  performance_notes: string | null;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreativeVariation {
  id: string;
  creative_concept_id: string;
  headline: string;
  body_copy: string | null;
  cta: string | null;
  platform_notes: string | null;
  status: 'draft' | 'testing' | 'winner' | 'loser';
  created_at: string;
}

export interface CreativeConceptInsert {
  client_id: string;
  hook: string;
  description: string;
  target_emotion: string;
  format: string;
  platform: string;
  status?: 'idea' | 'in_development' | 'active' | 'paused' | 'retired';
  cta_options?: string[];
  target_audiences?: string[];
  performance_notes?: string | null;
  ai_generated?: boolean;
}

export interface CreativeConceptUpdate {
  id: string;
  hook?: string;
  description?: string;
  target_emotion?: string;
  format?: string;
  platform?: string;
  status?: 'idea' | 'in_development' | 'active' | 'paused' | 'retired';
  cta_options?: string[];
  target_audiences?: string[];
  performance_notes?: string | null;
}

export interface CreativeVariationInsert {
  creative_concept_id: string;
  headline: string;
  body_copy?: string | null;
  cta?: string | null;
  platform_notes?: string | null;
  status?: 'draft' | 'testing' | 'winner' | 'loser';
}

export function useCreativeConcepts(clientId: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const conceptsQuery = useQuery({
    queryKey: ['creative_concepts', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('creative_concepts')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CreativeConcept[];
    },
    enabled: !!user && !!clientId,
  });

  const variationsQuery = useQuery({
    queryKey: ['creative_variations', clientId],
    queryFn: async () => {
      const conceptIds = conceptsQuery.data?.map(c => c.id) ?? [];
      if (conceptIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('creative_variations')
        .select('*')
        .in('creative_concept_id', conceptIds)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CreativeVariation[];
    },
    enabled: !!user && !!clientId && (conceptsQuery.data?.length ?? 0) > 0,
  });

  const createConceptMutation = useMutation({
    mutationFn: async (concept: CreativeConceptInsert) => {
      const { data, error } = await supabase
        .from('creative_concepts')
        .insert(concept)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creative_concepts', clientId] });
      toast({ title: 'Creative concept created' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create concept', description: error.message, variant: 'destructive' });
    },
  });

  const updateConceptMutation = useMutation({
    mutationFn: async ({ id, ...updates }: CreativeConceptUpdate) => {
      const { data, error } = await supabase
        .from('creative_concepts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creative_concepts', clientId] });
      toast({ title: 'Creative concept updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update concept', description: error.message, variant: 'destructive' });
    },
  });

  const deleteConceptMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('creative_concepts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creative_concepts', clientId] });
      toast({ title: 'Creative concept deleted' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete concept', description: error.message, variant: 'destructive' });
    },
  });

  const createVariationMutation = useMutation({
    mutationFn: async (variation: CreativeVariationInsert) => {
      const { data, error } = await supabase
        .from('creative_variations')
        .insert(variation)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creative_variations', clientId] });
      toast({ title: 'Variation added' });
    },
    onError: (error) => {
      toast({ title: 'Failed to add variation', description: error.message, variant: 'destructive' });
    },
  });

  const updateVariationMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CreativeVariation> & { id: string }) => {
      const { data, error } = await supabase
        .from('creative_variations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creative_variations', clientId] });
      toast({ title: 'Variation updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update variation', description: error.message, variant: 'destructive' });
    },
  });

  const deleteVariationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('creative_variations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creative_variations', clientId] });
      toast({ title: 'Variation deleted' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete variation', description: error.message, variant: 'destructive' });
    },
  });

  const getVariationsForConcept = (conceptId: string) => {
    return variationsQuery.data?.filter(v => v.creative_concept_id === conceptId) ?? [];
  };

  return {
    concepts: conceptsQuery.data ?? [],
    variations: variationsQuery.data ?? [],
    getVariationsForConcept,
    isLoading: conceptsQuery.isLoading,
    error: conceptsQuery.error,
    createConcept: createConceptMutation.mutate,
    updateConcept: updateConceptMutation.mutate,
    deleteConcept: deleteConceptMutation.mutate,
    createVariation: createVariationMutation.mutate,
    updateVariation: updateVariationMutation.mutate,
    deleteVariation: deleteVariationMutation.mutate,
    isCreatingConcept: createConceptMutation.isPending,
    isUpdatingConcept: updateConceptMutation.isPending,
  };
}
