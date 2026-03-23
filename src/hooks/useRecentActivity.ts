import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ActivityItem {
  id: string;
  type: 'lead' | 'client' | 'content' | 'ad';
  title: string;
  description: string;
  timestamp: string;
}

export function useRecentActivity(limit = 10) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recent_activity', limit],
    queryFn: async () => {
      const activities: ActivityItem[] = [];
      
      // Fetch recent leads
      const { data: leads } = await supabase
        .from('leads')
        .select('id, business_name, stage, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (leads) {
        leads.forEach(lead => {
          activities.push({
            id: `lead-${lead.id}`,
            type: 'lead',
            title: `New lead: ${lead.business_name}`,
            description: `Stage: ${lead.stage}`,
            timestamp: lead.created_at,
          });
        });
      }
      
      // Fetch recent clients
      const { data: clients } = await supabase
        .from('clients')
        .select('id, business_name, status, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (clients) {
        clients.forEach(client => {
          activities.push({
            id: `client-${client.id}`,
            type: 'client',
            title: `Client added: ${client.business_name}`,
            description: `Status: ${client.status}`,
            timestamp: client.created_at,
          });
        });
      }
      
      // Fetch recent content plans
      const { data: contentPlans } = await supabase
        .from('content_plans')
        .select('id, title, status, created_at, client:clients(business_name)')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (contentPlans) {
        contentPlans.forEach(plan => {
          activities.push({
            id: `content-${plan.id}`,
            type: 'content',
            title: `Content plan: ${plan.title}`,
            description: (plan.client as any)?.business_name || 'Unknown client',
            timestamp: plan.created_at,
          });
        });
      }
      
      // Fetch recent ad launches
      const { data: adLaunches } = await supabase
        .from('ad_launches')
        .select('id, name, status, created_at, client:clients(business_name)')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (adLaunches) {
        adLaunches.forEach(ad => {
          activities.push({
            id: `ad-${ad.id}`,
            type: 'ad',
            title: `Ad launch: ${ad.name}`,
            description: (ad.client as any)?.business_name || 'Unknown client',
            timestamp: ad.created_at,
          });
        });
      }
      
      // Sort by timestamp and limit
      return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    },
    enabled: !!user,
  });
}
