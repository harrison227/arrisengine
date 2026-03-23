import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Json } from '@/integrations/supabase/types';

export interface TextPostSession {
  id: string;
  client_id: string;
  session_type: string;
  title: string | null;
  status: string | null;
  session_data: {
    platform: string;
    guideline_id?: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    post_count: number;
  } | null;
  created_at: string;
  updated_at: string;
}

export function useTextPostSessions(clientId: string, platform: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['text-post-sessions', clientId, platform],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_sessions')
        .select('*')
        .eq('client_id', clientId)
        .eq('session_type', `text_posts_${platform}`)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      return (data || []).map(session => ({
        ...session,
        session_data: session.session_data as TextPostSession['session_data'],
      })) as TextPostSession[];
    },
    enabled: !!user?.id && !!clientId,
  });

  const createSession = useMutation({
    mutationFn: async (params: {
      title?: string;
      guidelineId?: string;
      messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const sessionData: TextPostSession['session_data'] = {
        platform,
        guideline_id: params.guidelineId,
        messages: params.messages || [],
        post_count: 0,
      };

      const { data, error } = await supabase
        .from('ai_sessions')
        .insert({
          client_id: clientId,
          user_id: user.id,
          session_type: `text_posts_${platform}`,
          title: params.title || `${platform} session`,
          status: 'in_progress',
          session_data: sessionData as unknown as Json,
        })
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        session_data: data.session_data as TextPostSession['session_data'],
      } as TextPostSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['text-post-sessions', clientId, platform] });
    },
  });

  const updateSession = useMutation({
    mutationFn: async (params: {
      id: string;
      title?: string;
      status?: string;
      messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
      postCount?: number;
    }) => {
      const updates: Record<string, unknown> = {};
      
      if (params.title) updates.title = params.title;
      if (params.status) updates.status = params.status;
      
      // Get current session data if we need to update it
      if (params.messages !== undefined || params.postCount !== undefined) {
        const { data: current } = await supabase
          .from('ai_sessions')
          .select('session_data')
          .eq('id', params.id)
          .single();

        const currentData = (current?.session_data || {}) as TextPostSession['session_data'];
        const newData: TextPostSession['session_data'] = {
          platform: currentData?.platform || platform,
          guideline_id: currentData?.guideline_id,
          messages: params.messages !== undefined ? params.messages : (currentData?.messages || []),
          post_count: params.postCount !== undefined ? params.postCount : (currentData?.post_count || 0),
        };
        updates.session_data = newData as unknown as Json;
      }

      const { data, error } = await supabase
        .from('ai_sessions')
        .update(updates)
        .eq('id', params.id)
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        session_data: data.session_data as TextPostSession['session_data'],
      } as TextPostSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['text-post-sessions', clientId, platform] });
    },
  });

  const deleteSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('ai_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['text-post-sessions', clientId, platform] });
    },
  });

  return {
    sessions,
    isLoading,
    createSession,
    updateSession,
    deleteSession,
  };
}
