import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type AITone = 'professional' | 'casual' | 'bold' | 'friendly' | 'authoritative';

export interface AIVoiceSettings {
  id: string;
  user_id: string;
  tone: AITone;
  formality_level: number;
  creativity_level: number;
  custom_instructions: string;
  avoid_phrases: string[];
  preferred_phrases: string[];
  content_planner_master_prompt: string;
  preferred_formats: string[];
  preferred_platforms: string[];
  preferred_hooks_style: string;
  content_themes: string[];
  created_at: string;
  updated_at: string;
}

export function useAIVoiceSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['ai-voice-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('ai_voice_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as AIVoiceSettings | null;
    },
    enabled: !!user?.id,
  });

  const upsertSettings = useMutation({
    mutationFn: async (updates: Partial<AIVoiceSettings>) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('ai_voice_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('ai_voice_settings')
          .update(updates)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ai_voice_settings')
          .insert({ ...updates, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-voice-settings'] });
      toast({ title: 'AI settings saved', description: 'Your AI voice settings have been updated.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    settings,
    isLoading,
    upsertSettings: upsertSettings.mutate,
    isUpdating: upsertSettings.isPending,
  };
}
