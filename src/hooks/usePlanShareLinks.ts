import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface PlanShareLink {
  id: string;
  share_id: string;
  content_plan_id: string;
  client_name: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
  feedback_submitted_at: string | null;
}

interface CreateShareLinkInput {
  contentPlanId: string;
  clientName?: string;
  expiresAt?: string;
}

// Generate a random share ID
function generateShareId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function usePlanShareLinks(contentPlanId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['plan_share_links', contentPlanId],
    queryFn: async () => {
      let queryBuilder = supabase
        .from('plan_share_links')
        .select('*')
        .order('created_at', { ascending: false });

      if (contentPlanId) {
        queryBuilder = queryBuilder.eq('content_plan_id', contentPlanId);
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;
      return data as PlanShareLink[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async ({ contentPlanId, clientName, expiresAt }: CreateShareLinkInput) => {
      if (!user) throw new Error('Not authenticated');

      const shareId = generateShareId();

      const { data, error } = await supabase
        .from('plan_share_links')
        .insert({
          share_id: shareId,
          content_plan_id: contentPlanId,
          client_name: clientName || null,
          expires_at: expiresAt || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as PlanShareLink;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan_share_links'] });
      toast({ title: 'Share link created', description: 'You can now share this link with your client.' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create share link', description: error.message, variant: 'destructive' });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('plan_share_links')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan_share_links'] });
      toast({ title: 'Share link deactivated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to deactivate link', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('plan_share_links')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan_share_links'] });
      toast({ title: 'Share link deleted' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete link', description: error.message, variant: 'destructive' });
    },
  });

  return {
    shareLinks: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createShareLink: createMutation.mutateAsync,
    deactivateShareLink: deactivateMutation.mutate,
    deleteShareLink: deleteMutation.mutate,
    isCreating: createMutation.isPending,
  };
}

// Hook for public access - fetches share link without auth
// Uses clients_public_safe view to exclude sensitive data like API keys
export function usePublicPlanShareLink(shareId: string | undefined) {
  return useQuery({
    queryKey: ['public_plan_share_link', shareId],
    queryFn: async () => {
      if (!shareId) return null;

      // Fetch the share link with plan data only
      const { data, error } = await supabase
        .from('plan_share_links')
        .select(`
          *,
          content_plans (*)
        `)
        .eq('share_id', shareId)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      // Check if expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        return null;
      }

      // Fetch client from public-safe view (excludes sensitive data like API keys)
      let clientData = null;
      if (data.content_plans?.client_id) {
        const { data: client } = await supabase
          .from('clients_public_safe')
          .select('id, business_name, brand_logo_url, brand_primary_color, industry')
          .eq('id', data.content_plans.client_id)
          .single();
        
        clientData = client;
      }

      // Fetch upcoming filming day for the client
      let filmingDay = null;
      if (data.content_plans?.client_id) {
        const { data: filmingData } = await supabase
          .from('filming_days')
          .select('*')
          .eq('client_id', data.content_plans.client_id)
          .order('date', { ascending: true })
          .limit(1)
          .maybeSingle();
        
        filmingDay = filmingData;
      }

      return {
        ...data,
        content_plans: {
          ...data.content_plans,
          clients: clientData
        },
        filming_day: filmingDay
      };
    },
    enabled: !!shareId,
  });
}
