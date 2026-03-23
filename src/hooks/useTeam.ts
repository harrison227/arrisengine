import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;
type UserRole = Tables<'user_roles'>;

interface TeamMember {
  profile: Profile;
  role: UserRole | null;
}

export function useTeam() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['team'],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (profilesError) throw profilesError;

      // Fetch user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');
      
      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const teamMembers: TeamMember[] = (profiles || []).map(profile => ({
        profile,
        role: roles?.find(r => r.user_id === profile.id) || null,
      }));

      return teamMembers;
    },
    enabled: !!user,
  });

  return {
    team: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useCurrentUserRole() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user_role', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        // If no role found, return null
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data as UserRole;
    },
    enabled: !!user,
  });
}
