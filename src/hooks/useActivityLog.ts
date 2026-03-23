import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Json } from '@/integrations/supabase/types';

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: Json | null;
  created_at: string;
  profile?: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export function useActivityLogs() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['activity_logs'],
    queryFn: async () => {
      const { data: logs, error: logsError } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (logsError) throw logsError;

      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(logs?.map(log => log.user_id) || [])];
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Combine logs with profiles
      const logsWithProfiles: ActivityLog[] = (logs || []).map(log => ({
        ...log,
        profile: profiles?.find(p => p.id === log.user_id) || undefined,
      }));

      return logsWithProfiles;
    },
    enabled: !!user,
  });
}

export function useLogActivity() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      entityType,
      entityId,
      entityName,
      details,
    }: {
      action: string;
      entityType: string;
      entityId?: string;
      entityName?: string;
      details?: Record<string, unknown>;
    }) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase.from('activity_logs').insert([{
        user_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        entity_name: entityName || null,
        details: details as Json || null,
      }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity_logs'] });
    },
  });
}

// Helper function for use in other hooks
export async function logActivity(
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  entityName?: string,
  details?: Record<string, unknown>
) {
  const { error } = await supabase.from('activity_logs').insert([{
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    entity_name: entityName || null,
    details: details as Json || null,
  }]);

  if (error) {
    console.error('Failed to log activity:', error);
  }
}
