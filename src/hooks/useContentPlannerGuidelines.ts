import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type TextPlatform = 'linkedin' | 'twitter' | 'threads';

export interface ContentPlannerGuideline {
  id: string;
  user_id: string;
  platform: TextPlatform;
  name: string;
  text_guidelines: string | null;
  pdf_url: string | null;
  pdf_filename: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useContentPlannerGuidelines(platform?: TextPlatform) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: guidelines = [], isLoading } = useQuery({
    queryKey: ['content-planner-guidelines', platform],
    queryFn: async () => {
      let query = supabase
        .from('content_planner_guidelines')
        .select('*')
        .order('created_at', { ascending: false });

      if (platform) {
        query = query.eq('platform', platform);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ContentPlannerGuideline[];
    },
  });

  const createGuideline = useMutation({
    mutationFn: async ({
      platform,
      name,
      textGuidelines,
      pdfFile,
    }: {
      platform: TextPlatform;
      name: string;
      textGuidelines?: string;
      pdfFile?: File;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let pdfUrl: string | null = null;
      let pdfFilename: string | null = null;

      if (pdfFile) {
        const fileExt = pdfFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('planner-guidelines')
          .upload(fileName, pdfFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('planner-guidelines')
          .getPublicUrl(fileName);

        pdfUrl = urlData.publicUrl;
        pdfFilename = pdfFile.name;
      }

      const { data, error } = await supabase
        .from('content_planner_guidelines')
        .insert({
          user_id: user.id,
          platform,
          name,
          text_guidelines: textGuidelines || null,
          pdf_url: pdfUrl,
          pdf_filename: pdfFilename,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ContentPlannerGuideline;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-planner-guidelines'] });
      toast({ title: 'Guideline saved' });
    },
    onError: (error) => {
      toast({ title: 'Failed to save guideline', description: error.message, variant: 'destructive' });
    },
  });

  const updateGuideline = useMutation({
    mutationFn: async ({
      id,
      name,
      textGuidelines,
      pdfFile,
    }: {
      id: string;
      name?: string;
      textGuidelines?: string;
      pdfFile?: File;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updates: Partial<ContentPlannerGuideline> = {};
      if (name !== undefined) updates.name = name;
      if (textGuidelines !== undefined) updates.text_guidelines = textGuidelines;

      if (pdfFile) {
        const fileExt = pdfFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('planner-guidelines')
          .upload(fileName, pdfFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('planner-guidelines')
          .getPublicUrl(fileName);

        updates.pdf_url = urlData.publicUrl;
        updates.pdf_filename = pdfFile.name;
      }

      const { data, error } = await supabase
        .from('content_planner_guidelines')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ContentPlannerGuideline;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-planner-guidelines'] });
      toast({ title: 'Guideline updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update guideline', description: error.message, variant: 'destructive' });
    },
  });

  const deleteGuideline = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('content_planner_guidelines')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-planner-guidelines'] });
      toast({ title: 'Guideline deleted' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete guideline', description: error.message, variant: 'destructive' });
    },
  });

  const setDefaultGuideline = useMutation({
    mutationFn: async ({ id, platform }: { id: string; platform: TextPlatform }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // First, unset all defaults for this platform
      await supabase
        .from('content_planner_guidelines')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('platform', platform);

      // Then set the new default
      const { error } = await supabase
        .from('content_planner_guidelines')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content-planner-guidelines'] });
      toast({ title: 'Default guideline set' });
    },
    onError: (error) => {
      toast({ title: 'Failed to set default', description: error.message, variant: 'destructive' });
    },
  });

  const getDefaultGuideline = (p: TextPlatform) => {
    return guidelines.find(g => g.platform === p && g.is_default);
  };

  const getGuidelinesByPlatform = (p: TextPlatform) => {
    return guidelines.filter(g => g.platform === p);
  };

  return {
    guidelines,
    isLoading,
    createGuideline: createGuideline.mutateAsync,
    updateGuideline: updateGuideline.mutateAsync,
    deleteGuideline: deleteGuideline.mutateAsync,
    setDefaultGuideline: setDefaultGuideline.mutateAsync,
    isCreating: createGuideline.isPending,
    isUpdating: updateGuideline.isPending,
    isDeleting: deleteGuideline.isPending,
    getDefaultGuideline,
    getGuidelinesByPlatform,
  };
}
