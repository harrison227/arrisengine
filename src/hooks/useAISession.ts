import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface AISession {
  id: string;
  client_id: string;
  user_id: string;
  session_type: 'filming_plan' | 'image_batch';
  status: 'in_progress' | 'completed' | 'paused';
  title: string | null;
  session_data: {
    messages?: Array<{ role: string; content: string }>;
    draftPlan?: any;
    concepts?: any[];
    lastUpdated?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function useAISession(clientId?: string, sessionType?: 'filming_plan' | 'image_batch') {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing sessions for a client
  const sessionsQuery = useQuery({
    queryKey: ['ai-sessions', clientId, sessionType],
    queryFn: async () => {
      let query = supabase
        .from('ai_sessions')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (clientId) {
        query = query.eq('client_id', clientId);
      }
      if (sessionType) {
        query = query.eq('session_type', sessionType);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as AISession[];
    },
    enabled: !!user,
  });

  // Create a new session
  const createSessionMutation = useMutation({
    mutationFn: async ({ 
      clientId, 
      sessionType, 
      title 
    }: { 
      clientId: string; 
      sessionType: 'filming_plan' | 'image_batch';
      title?: string;
    }) => {
      const { data, error } = await supabase
        .from('ai_sessions')
        .insert({
          client_id: clientId,
          user_id: user?.id,
          session_type: sessionType,
          title: title || `${sessionType === 'filming_plan' ? 'Filming Plan' : 'Image Batch'} Session`,
          session_data: { messages: [] }
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as AISession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-sessions'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to create session',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  });

  // Send a message in a content planning session
  const sendMessageMutation = useMutation({
    mutationFn: async ({ 
      sessionId, 
      clientId, 
      message 
    }: { 
      sessionId?: string; 
      clientId: string; 
      message: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('ai-content-session', {
        body: { sessionId, clientId, message }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-sessions'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to send message',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  });

  // Append AI-generated ideas to the existing draft plan (batch workflow)
  const appendIdeasMutation = useMutation({
    mutationFn: async ({
      sessionId,
      clientId,
      ideas,
    }: {
      sessionId: string;
      clientId: string;
      ideas: any[];
    }) => {
      const { data, error } = await supabase.functions.invoke('ai-content-session', {
        body: { sessionId, clientId, action: 'append_ideas', ideas }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-sessions'] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to add ideas to plan',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  });

  // Update session status
  const updateSessionMutation = useMutation({
    mutationFn: async ({ 
      sessionId, 
      status, 
      title 
    }: { 
      sessionId: string; 
      status?: 'in_progress' | 'completed' | 'paused';
      title?: string;
    }) => {
      const updates: any = {};
      if (status) updates.status = status;
      if (title) updates.title = title;
      
      const { data, error } = await supabase
        .from('ai_sessions')
        .update(updates)
        .eq('id', sessionId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-sessions'] });
      toast({ title: 'Session updated' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to update session',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  });

  // Delete a session
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('ai_sessions')
        .delete()
        .eq('id', sessionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-sessions'] });
      toast({ title: 'Session deleted' });
    },
    onError: (error) => {
      toast({
        title: 'Failed to delete session',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  });

  return {
    sessions: sessionsQuery.data ?? [],
    isLoading: sessionsQuery.isLoading,
    createSession: createSessionMutation.mutateAsync,
    isCreating: createSessionMutation.isPending,
    sendMessage: sendMessageMutation.mutateAsync,
    isSending: sendMessageMutation.isPending,
    appendIdeas: appendIdeasMutation.mutateAsync,
    isAppendingIdeas: appendIdeasMutation.isPending,
    updateSession: updateSessionMutation.mutate,
    deleteSession: deleteSessionMutation.mutate,
  };
}
