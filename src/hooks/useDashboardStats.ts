import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useDashboardStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: async () => {
      // Fetch all data in parallel for faster load
      const [clientsResult, leadsResult, adLaunchesResult, contentPlansResult] = await Promise.all([
        supabase.from('clients').select('mrr, status, is_personal'),
        supabase.from('leads').select('proposal_value, stage'),
        supabase.from('ad_launches').select('status'),
        supabase.from('content_plans').select('filming_date, status'),
      ]);
      
      if (clientsResult.error) throw clientsResult.error;
      if (leadsResult.error) throw leadsResult.error;
      if (adLaunchesResult.error) throw adLaunchesResult.error;
      if (contentPlansResult.error) throw contentPlansResult.error;
      
      const clients = clientsResult.data;
      const leads = leadsResult.data;
      const adLaunches = adLaunchesResult.data;
      const contentPlans = contentPlansResult.data;

      // Calculate stats - count active and onboarding clients as "current", exclude personal
      const currentClients = clients?.filter(c => (c.status === 'active' || c.status === 'onboarding') && !c.is_personal) || [];
      const totalMRR = currentClients.reduce((sum, c) => sum + Number(c.mrr), 0);
      const currentClientCount = currentClients.length;
      
      const activePipelineStages = ['new', 'contacted', 'proposal', 'negotiating'];
      const pipelineValue = leads
        ?.filter(l => activePipelineStages.includes(l.stage))
        ?.reduce((sum, l) => sum + Number(l.proposal_value), 0) || 0;
      
      const activeCampaigns = adLaunches?.filter(a => a.status === 'live').length || 0;
      
      const now = new Date();
      const upcomingFilmings = contentPlans?.filter(cp => {
        if (!cp.filming_date) return false;
        const filmDate = new Date(cp.filming_date);
        return filmDate >= now && cp.status !== 'complete';
      }).length || 0;

      return {
        totalMRR,
        currentClientCount,
        pipelineValue,
        activeCampaigns,
        upcomingFilmings,
      };
    },
    enabled: !!user,
  });
}
