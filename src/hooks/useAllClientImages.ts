import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { checkAIImageRateLimit, recordAIImageRequest } from './useRateLimiter';

export interface ImageRevision {
  id: string;
  version: number;
  image_url: string;
  model_used: string | null;
  feedback: string | null;
  created_at: string;
}

export interface ClientImageItem {
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
  // Joined session info
  session_title: string | null;
  session_created_at: string;
  // Revision info
  revisions: ImageRevision[];
  has_revisions: boolean;
}

type ImageModel = 'nano-banana' | 'nano-banana-2' | 'nano-banana-pro' | 'dalle3' | 'gpt-image-1.5' | 'ideogram';
type LogoPlacement = 'auto' | 'corner' | 'featured' | 'badge';

export interface LogoSettings {
  includeLogo: boolean;
  logoUrl: string | undefined;
  logoPlacement: LogoPlacement;
}

const PAGE_SIZE = 48;
const SESSION_LIMIT = 120;

const isPublicHttpUrl = (value: string | null | undefined): boolean => {
  if (!value) return false;
  return value.startsWith('http://') || value.startsWith('https://');
};

export function useAllClientImages(clientId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ['all-client-images', clientId],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!clientId) return { items: [] as ClientImageItem[], nextOffset: undefined as number | undefined };

      // Keep sessions bounded to prevent huge IN payloads
      const { data: sessions, error: sessionsError } = await supabase
        .from('ai_sessions')
        .select('id, title, created_at')
        .eq('client_id', clientId)
        .in('session_type', ['image_batch', 'quick_batch'])
        .order('created_at', { ascending: false })
        .limit(SESSION_LIMIT);

      if (sessionsError) throw sessionsError;
      if (!sessions || sessions.length === 0) {
        return { items: [] as ClientImageItem[], nextOffset: undefined as number | undefined };
      }

      const sessionIds = sessions.map(s => s.id);
      const sessionMap = new Map(sessions.map(s => [s.id, s]));

      // True DB pagination to avoid loading whole library in memory
      const { data: items, error: itemsError } = await supabase
        .from('image_batch_items')
        .select('id, session_id, sequence_number, concept, template_type, platform, status, generated_image_url, asset_id, feedback, prompt_additions, attempts, model_used, carousel_group_id, created_at, updated_at')
        .in('session_id', sessionIds)
        .not('generated_image_url', 'is', null)
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (itemsError) throw itemsError;

      const safeItems = (items ?? [])
        // Critical: exclude legacy inline base64 blobs from list rendering (major memory source)
        .filter(item => isPublicHttpUrl(item.generated_image_url))
        .map(item => ({
          ...item,
          session_title: sessionMap.get(item.session_id)?.title || null,
          session_created_at: sessionMap.get(item.session_id)?.created_at || item.created_at,
          revisions: [],
          has_revisions: (item.attempts ?? 0) > 1,
        })) as ClientImageItem[];

      const hasMore = (items?.length ?? 0) === PAGE_SIZE;
      return {
        items: safeItems,
        nextOffset: hasMore ? pageParam + PAGE_SIZE : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Approve an image
  const approveMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase
        .from('image_batch_items')
        .update({ status: 'approved' })
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-client-images', clientId] });
      queryClient.invalidateQueries({ queryKey: ['image-batch-items'] });
      toast({ title: 'Image approved!' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to approve image',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  // Skip an image
  const skipMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase
        .from('image_batch_items')
        .update({ status: 'skipped' })
        .eq('id', itemId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-client-images', clientId] });
      queryClient.invalidateQueries({ queryKey: ['image-batch-items'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to skip image',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  // Delete an image
  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('image_batch_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-client-images', clientId] });
      queryClient.invalidateQueries({ queryKey: ['image-batch-items'] });
      toast({ title: 'Image deleted' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to delete image',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  // Regenerate an image with AI feedback
  const regenerateMutation = useMutation({
    mutationFn: async ({
      itemId,
      feedback,
      model,
      referenceImages,
      savedReferenceImageIds,
      logoSettings
    }: {
      itemId: string;
      feedback: string;
      model: ImageModel;
      referenceImages: string[];
      savedReferenceImageIds: string[];
      logoSettings?: LogoSettings;
    }) => {
      // Rate limit check
      const rateLimitCheck = checkAIImageRateLimit();
      if (!rateLimitCheck.allowed) {
        throw new Error(`Rate limit reached. Please wait ${rateLimitCheck.waitTime} seconds.`);
      }

      // Get the current item to get the concept and current image
      const allItems = query.data?.pages.flatMap(p => p.items) ?? [];
      const item = allItems.find(i => i.id === itemId);
      if (!item) throw new Error('Image not found');

      // Mark as regenerating
      await supabase
        .from('image_batch_items')
        .update({ status: 'regenerating' })
        .eq('id', itemId);

      recordAIImageRequest();

      // Include current image as primary reference
      const allReferenceImages = [...referenceImages];
      if (item.generated_image_url) {
        allReferenceImages.unshift(item.generated_image_url);
      }

      const { data, error } = await supabase.functions.invoke('generate-batch-image', {
        body: {
          batchItemId: itemId,
          clientId,
          concept: item.concept,
          templateType: item.template_type,
          feedback,
          referenceImages: allReferenceImages.length > 0 ? allReferenceImages : undefined,
          savedReferenceImageIds: savedReferenceImageIds.length > 0 ? savedReferenceImageIds : undefined,
          model,
          isRegeneration: true,
          brandLogoUrl: logoSettings?.includeLogo ? logoSettings.logoUrl : undefined,
          logoPlacement: logoSettings?.includeLogo ? logoSettings.logoPlacement : undefined,
        },
      });

      if (error) {
        if (error.message?.includes('401') || error.message?.includes('Unauthorized') || error.message?.includes('Missing authorization')) {
          throw new Error('Your session has expired. Please log in again to continue.');
        }
        throw error;
      }
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-client-images', clientId] });
      queryClient.invalidateQueries({ queryKey: ['image-batch-items'] });
      queryClient.invalidateQueries({ queryKey: ['image-revisions'] });
      toast({ title: 'Image regenerated successfully!' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to regenerate image',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const imagesWithUrls = (query.data?.pages.flatMap(page => page.items) ?? []).filter(item => item.generated_image_url);

  const stats = {
    total: imagesWithUrls.length,
    approved: imagesWithUrls.filter(i => i.status === 'approved').length,
    pending: imagesWithUrls.filter(i => i.status === 'pending' || i.status === 'generating' || i.status === 'regenerating').length,
    skipped: imagesWithUrls.filter(i => i.status === 'skipped').length,
  };

  return {
    images: imagesWithUrls,
    allItems: query.data?.pages.flatMap(page => page.items) ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    approveItem: approveMutation.mutate,
    skipItem: skipMutation.mutate,
    deleteItem: deleteMutation.mutate,
    regenerateItem: regenerateMutation.mutateAsync,
    isRegenerating: regenerateMutation.isPending,
    stats,
    refetch: query.refetch,
    hasMore: !!query.hasNextPage,
    loadMore: () => query.fetchNextPage(),
    isLoadingMore: query.isFetchingNextPage,
  };
}
