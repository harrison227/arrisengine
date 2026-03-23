import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface AgencySettings {
  id: string;
  user_id: string;
  agency_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  timezone: string;
  working_hours_start: string;
  working_hours_end: string;
  default_email_signature: string;
  created_at: string;
  updated_at: string;
}

export function useAgencySettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['agency-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('agency_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as AgencySettings | null;
    },
    enabled: !!user?.id,
  });

  const upsertSettings = useMutation({
    mutationFn: async (updates: Partial<AgencySettings>) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('agency_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('agency_settings')
          .update(updates)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('agency_settings')
          .insert({ ...updates, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency-settings'] });
      toast({ title: 'Settings saved', description: 'Your agency settings have been updated.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/agency-logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('client-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('client-assets')
        .getPublicUrl(filePath);

      await upsertSettings.mutateAsync({ logo_url: urlData.publicUrl });
      return urlData.publicUrl;
    },
    onError: (error) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    },
  });

  return {
    settings,
    isLoading,
    upsertSettings: upsertSettings.mutate,
    uploadLogo: uploadLogo.mutate,
    isUpdating: upsertSettings.isPending,
    isUploading: uploadLogo.isPending,
  };
}
