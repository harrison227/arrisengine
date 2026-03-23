import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { subDays, differenceInDays, format } from 'date-fns';

export interface ClientHealth {
  clientId: string;
  businessName: string;
  healthScore: number; // 0-100
  contentDeliveryRate: number;
  kpiPerformance: number;
  lastActivity: string | null;
  mrr: number;
  status: string;
}

export interface PipelineAnalytics {
  stageConversions: { stage: string; count: number; value: number }[];
  avgTimeInStage: { stage: string; avgDays: number }[];
  winLossReasons: { reason: string; count: number }[];
  leadSources: { source: string; count: number; wonCount: number }[];
  conversionRate: number;
  avgDealSize: number;
}

export interface TeamWorkload {
  userId: string;
  name: string;
  email: string;
  taskCount: number;
  completedTasks: number;
  clientCount: number;
}

export function useAnalytics() {
  const { user } = useAuth();

  // Client Health Scores
  const { data: clientHealth = [], isLoading: healthLoading } = useQuery({
    queryKey: ['analytics-client-health', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch clients
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, business_name, mrr, status, updated_at');
      if (clientsError) throw clientsError;

      // Fetch content plans with pieces
      const { data: contentPlans } = await supabase
        .from('content_plans')
        .select('client_id, status');

      // Fetch content pieces
      const { data: contentPieces } = await supabase
        .from('content_pieces')
        .select('content_plan_id, status');

      // Fetch KPIs and entries
      const { data: kpis } = await supabase
        .from('kpis')
        .select('id, client_id, target');

      const { data: kpiEntries } = await supabase
        .from('kpi_entries')
        .select('kpi_id, value, recorded_date')
        .gte('recorded_date', subDays(new Date(), 30).toISOString().split('T')[0]);

      // Calculate health for each client
      const healthScores: ClientHealth[] = (clients || []).map(client => {
        // Content delivery rate
        const clientPlans = (contentPlans || []).filter(p => p.client_id === client.id);
        const completedPlans = clientPlans.filter(p => p.status === 'complete').length;
        const contentDeliveryRate = clientPlans.length > 0 
          ? (completedPlans / clientPlans.length) * 100 
          : 50; // Default if no plans

        // KPI performance
        const clientKpis = (kpis || []).filter(k => k.client_id === client.id);
        let kpiPerformance = 50; // Default
        if (clientKpis.length > 0) {
          const performances = clientKpis.map(kpi => {
            const entries = (kpiEntries || []).filter(e => e.kpi_id === kpi.id);
            if (entries.length === 0) return 50;
            const latestValue = entries[entries.length - 1]?.value || 0;
            return Math.min((latestValue / kpi.target) * 100, 100);
          });
          kpiPerformance = performances.reduce((a, b) => a + b, 0) / performances.length;
        }

        // Recency factor
        const daysSinceActivity = differenceInDays(new Date(), new Date(client.updated_at));
        const recencyScore = Math.max(0, 100 - daysSinceActivity * 2);

        // Combined health score
        const healthScore = Math.round(
          (contentDeliveryRate * 0.4) + 
          (kpiPerformance * 0.4) + 
          (recencyScore * 0.2)
        );

        return {
          clientId: client.id,
          businessName: client.business_name,
          healthScore,
          contentDeliveryRate: Math.round(contentDeliveryRate),
          kpiPerformance: Math.round(kpiPerformance),
          lastActivity: client.updated_at,
          mrr: client.mrr,
          status: client.status,
        };
      });

      return healthScores.sort((a, b) => a.healthScore - b.healthScore);
    },
    enabled: !!user?.id,
  });

  // Pipeline Analytics
  const { data: pipelineAnalytics, isLoading: pipelineLoading } = useQuery({
    queryKey: ['analytics-pipeline', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data: leads, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;

      const stages = ['new', 'contacted', 'proposal', 'negotiating', 'won', 'lost'];
      
      // Stage conversions
      const stageConversions = stages.map(stage => ({
        stage,
        count: (leads || []).filter(l => l.stage === stage).length,
        value: (leads || []).filter(l => l.stage === stage).reduce((sum, l) => sum + (l.proposal_value || 0), 0),
      }));

      // Average time in stage (simplified - using created_at to updated_at)
      const avgTimeInStage = stages.slice(0, -2).map(stage => {
        const stageLeads = (leads || []).filter(l => l.stage === stage);
        if (stageLeads.length === 0) return { stage, avgDays: 0 };
        const totalDays = stageLeads.reduce((sum, lead) => {
          return sum + differenceInDays(new Date(lead.updated_at), new Date(lead.created_at));
        }, 0);
        return { stage, avgDays: Math.round(totalDays / stageLeads.length) };
      });

      // Win/Loss reasons
      const lostLeads = (leads || []).filter(l => l.stage === 'lost');
      const reasonCounts: Record<string, number> = {};
      lostLeads.forEach(lead => {
        const reason = (lead as any).lost_reason || 'Not specified';
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      });
      const winLossReasons = Object.entries(reasonCounts).map(([reason, count]) => ({ reason, count }));

      // Lead sources
      const sourceCounts: Record<string, { total: number; won: number }> = {};
      (leads || []).forEach(lead => {
        if (!sourceCounts[lead.source]) {
          sourceCounts[lead.source] = { total: 0, won: 0 };
        }
        sourceCounts[lead.source].total++;
        if (lead.stage === 'won') {
          sourceCounts[lead.source].won++;
        }
      });
      const leadSources = Object.entries(sourceCounts).map(([source, data]) => ({
        source,
        count: data.total,
        wonCount: data.won,
      }));

      // Conversion rate
      const totalLeads = (leads || []).length;
      const wonLeads = (leads || []).filter(l => l.stage === 'won').length;
      const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

      // Average deal size
      const wonDeals = (leads || []).filter(l => l.stage === 'won');
      const avgDealSize = wonDeals.length > 0
        ? wonDeals.reduce((sum, l) => sum + (l.proposal_value || 0), 0) / wonDeals.length
        : 0;

      return {
        stageConversions,
        avgTimeInStage,
        winLossReasons,
        leadSources,
        conversionRate,
        avgDealSize,
      } as PipelineAnalytics;
    },
    enabled: !!user?.id,
  });

  // Team Workload
  const { data: teamWorkload = [], isLoading: workloadLoading } = useQuery({
    queryKey: ['analytics-team-workload', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email');

      // Fetch tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('assigned_to, status');

      // Fetch client assignments
      const { data: assignments } = await supabase
        .from('client_assignments')
        .select('user_id');

      // Calculate workload per team member
      const workload: TeamWorkload[] = (profiles || []).map(profile => {
        const userTasks = (tasks || []).filter(t => t.assigned_to === profile.id);
        const completedTasks = userTasks.filter(t => t.status === 'complete').length;
        const clientCount = (assignments || []).filter(a => a.user_id === profile.id).length;

        return {
          userId: profile.id,
          name: profile.full_name || 'Unknown',
          email: profile.email,
          taskCount: userTasks.length,
          completedTasks,
          clientCount,
        };
      });

      return workload.filter(w => w.taskCount > 0 || w.clientCount > 0);
    },
    enabled: !!user?.id,
  });

  return {
    clientHealth,
    pipelineAnalytics,
    teamWorkload,
    isLoading: healthLoading || pipelineLoading || workloadLoading,
  };
}
