import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { checkAIImageRateLimit, recordAIImageRequest } from '@/hooks/useRateLimiter';

export interface ImageBatchItem {
  id: string;
  session_id: string;
  sequence_number: number;
  concept: string;
  template_type: string;
  platform: string;
  status: 'pending' | 'generating' | 'approved' | 'skipped' | 'regenerating';
  generated_image_url: string | null;
  asset_id: string | null;
  feedback: string | null;
  prompt_additions: string | null;
  attempts: number;
  model_used: string | null;
  carousel_group_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useImageBatch(sessionId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch batch items for a session
  const itemsQuery = useQuery({
    queryKey: ['image-batch-items', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('image_batch_items')
        .select('*')
        .eq('session_id', sessionId)
        .order('sequence_number', { ascending: true });
      
      if (error) throw error;
      return data as ImageBatchItem[];
    },
    enabled: !!sessionId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Generate batch plan (30 concepts)
  const generatePlanMutation = useMutation({
    mutationFn: async ({ 
      sessionId, 
      clientId, 
      referenceStyle,
      referenceImages,
      count = 30 
    }: { 
      sessionId: string;
      clientId: string; 
      referenceStyle?: string;
      referenceImages?: string[];
      count?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('generate-image-batch-plan', {
        body: { sessionId, clientId, referenceStyle, referenceImages, count }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['image-batch-items'] });
      toast({
        title: 'Content plan generated!',
        description: `Created ${data.count} image concepts.`
      });
    },
    onError: (error) => {
      toast({
        title: 'Failed to generate plan',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  });

  // Generate a single image
  const generateImageMutation = useMutation({
    mutationFn: async ({ 
      batchItemId, 
      clientId, 
      concept, 
      templateType,
      feedback,
      promptAdditions,
      referenceImageUrl,
      referenceImages,
      savedReferenceImageIds,
      brandLogoUrl,
      logoPlacement,
      model,
      isRegeneration
    }: { 
      batchItemId: string;
      clientId: string; 
      concept: string;
      templateType: string;
      feedback?: string;
      promptAdditions?: string;
      referenceImageUrl?: string;
      referenceImages?: string[];
      savedReferenceImageIds?: string[];
      brandLogoUrl?: string;
      logoPlacement?: 'auto' | 'corner' | 'featured' | 'badge';
      model?: 'nano-banana' | 'nano-banana-2' | 'nano-banana-pro' | 'dalle3' | 'gpt-image-1.5' | 'ideogram';
      isRegeneration?: boolean;
    }) => {
      // Check rate limit before making the request
      const rateLimitCheck = checkAIImageRateLimit();
      if (!rateLimitCheck.allowed) {
        throw new Error(`Rate limit reached. Please wait ${rateLimitCheck.waitTime} seconds before generating more images.`);
      }
      
      // Record the request
      recordAIImageRequest();
      
      const { data, error } = await supabase.functions.invoke('generate-batch-image', {
        body: { batchItemId, clientId, concept, templateType, feedback, promptAdditions, referenceImageUrl, referenceImages, savedReferenceImageIds, brandLogoUrl, logoPlacement, model, isRegeneration }
      });
      
      // Handle auth errors specifically
      if (error) {
        if (error.message?.includes('401') || error.message?.includes('Unauthorized') || error.message?.includes('Missing authorization')) {
          throw new Error('Your session has expired. Please log in again to continue.');
        }
        throw error;
      }
      if (data.error) throw new Error(data.error);
      return data;
    },
    onMutate: async (vars) => {
      if (!sessionId) return;

      await queryClient.cancelQueries({ queryKey: ['image-batch-items', sessionId] });
      const previous = queryClient.getQueryData<ImageBatchItem[]>(['image-batch-items', sessionId]);

      queryClient.setQueryData<ImageBatchItem[]>(['image-batch-items', sessionId], (old) => {
        const items = old ?? [];
        return items.map((i) =>
          i.id === vars.batchItemId
            ? { ...i, status: vars.isRegeneration ? 'regenerating' : 'generating' }
            : i
        );
      });

      return { previous } as { previous?: ImageBatchItem[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['image-batch-items'] });
      queryClient.invalidateQueries({ queryKey: ['image-revisions'] });
    },
    onError: (error, _vars, context) => {
      const ctx = context as { previous?: ImageBatchItem[] } | undefined;
      if (sessionId && ctx?.previous) {
        queryClient.setQueryData(['image-batch-items', sessionId], ctx.previous);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Generation failed',
        description: errorMessage.includes('did not return an image') 
          ? 'Try adjusting your prompt or using a different model.'
          : errorMessage,
        variant: 'destructive'
      });
      // Invalidate to refresh the item status (it should be reset to pending)
      queryClient.invalidateQueries({ queryKey: ['image-batch-items'] });
    }
  });

  // Update concept details (concept text, prompt additions, or feedback)
  const updateConceptMutation = useMutation({
    mutationFn: async ({ 
      batchItemId, 
      concept, 
      promptAdditions, 
      feedback 
    }: { 
      batchItemId: string;
      concept?: string;
      promptAdditions?: string;
      feedback?: string;
    }) => {
      const updates: Record<string, string | null> = {};
      if (concept !== undefined) updates.concept = concept;
      if (promptAdditions !== undefined) updates.prompt_additions = promptAdditions;
      if (feedback !== undefined) updates.feedback = feedback;
      
      const { data, error } = await supabase
        .from('image_batch_items')
        .update(updates)
        .eq('id', batchItemId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['image-batch-items'] });
      toast({ title: 'Concept updated!' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to update concept',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  });

  // Approve an image
  const approveItemMutation = useMutation({
    mutationFn: async (batchItemId: string) => {
      const { data, error } = await supabase
        .from('image_batch_items')
        .update({ status: 'approved' })
        .eq('id', batchItemId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['image-batch-items'] });
      toast({ title: 'Image approved!' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to approve image',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  });

  // Skip an image
  const skipItemMutation = useMutation({
    mutationFn: async (batchItemId: string) => {
      const { data, error } = await supabase
        .from('image_batch_items')
        .update({ status: 'skipped' })
        .eq('id', batchItemId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['image-batch-items'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to skip image',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  });

  // Delete an image
  const deleteItemMutation = useMutation({
    mutationFn: async (batchItemId: string) => {
      const { error } = await supabase
        .from('image_batch_items')
        .delete()
        .eq('id', batchItemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['image-batch-items'] });
      toast({ title: 'Image deleted' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to delete image',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  });

  // Add feedback for regeneration
  const addFeedbackMutation = useMutation({
    mutationFn: async ({ batchItemId, feedback }: { batchItemId: string; feedback: string }) => {
      const { data, error } = await supabase
        .from('image_batch_items')
        .update({ feedback, status: 'regenerating' })
        .eq('id', batchItemId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['image-batch-items'] });
    }
  });

  // Calculate progress
  const items = itemsQuery.data ?? [];
  const approvedCount = items.filter(i => i.status === 'approved').length;
  const skippedCount = items.filter(i => i.status === 'skipped').length;
  const pendingCount = items.filter(i => i.status === 'pending').length;
  const generatingCount = items.filter(i => i.status === 'generating' || i.status === 'regenerating').length;

  return {
    items,
    isLoading: itemsQuery.isLoading,
    generatePlan: generatePlanMutation.mutateAsync,
    isGeneratingPlan: generatePlanMutation.isPending,
    generateImage: generateImageMutation.mutateAsync,
    isGeneratingImage: generateImageMutation.isPending,
    updateConcept: updateConceptMutation.mutateAsync,
    isUpdatingConcept: updateConceptMutation.isPending,
    approveItem: approveItemMutation.mutate,
    skipItem: skipItemMutation.mutate,
    deleteItem: deleteItemMutation.mutate,
    addFeedback: addFeedbackMutation.mutate,
    progress: {
      total: items.length,
      approved: approvedCount,
      skipped: skippedCount,
      pending: pendingCount,
      generating: generatingCount,
      completed: approvedCount + skippedCount,
      percentage: items.length > 0 ? Math.round(((approvedCount + skippedCount) / items.length) * 100) : 0
    }
  };
}
