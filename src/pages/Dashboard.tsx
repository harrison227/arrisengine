import { DollarSign, Users, Target, Megaphone } from 'lucide-react';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { MRRChart } from '@/components/dashboard/MRRChart';
import { ClientBreakdown } from '@/components/dashboard/ClientBreakdown';
import { UpcomingFilmings } from '@/components/dashboard/UpcomingFilmings';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { RevenueGoalCard } from '@/components/dashboard/RevenueGoalCard';
import { ClientHealthCard } from '@/components/dashboard/ClientHealthCard';
import { TeamWorkloadCard } from '@/components/dashboard/TeamWorkloadCard';
import { ContentCalendarCard } from '@/components/dashboard/ContentCalendarCard';
import { OverdueTasksCard } from '@/components/dashboard/OverdueTasksCard';
import { PipelineAnalyticsCard } from '@/components/dashboard/PipelineAnalyticsCard';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back. Here's what's happening with your agency.</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="clients">Client Analytics</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Monthly Recurring Revenue"
              value={`$${(stats?.totalMRR || 0).toLocaleString()}`}
              icon={<DollarSign className="w-6 h-6 text-primary" />}
            />
            <MetricCard
              title="Current Clients"
              value={(stats?.currentClientCount || 0).toString()}
              icon={<Users className="w-6 h-6 text-primary" />}
            />
            <MetricCard
              title="Pipeline Value"
              value={`$${(stats?.pipelineValue || 0).toLocaleString()}`}
              icon={<Target className="w-6 h-6 text-primary" />}
            />
            <MetricCard
              title="Active Campaigns"
              value={(stats?.activeCampaigns || 0).toString()}
              icon={<Megaphone className="w-6 h-6 text-primary" />}
            />
          </div>

          {/* Revenue Goal & Tasks */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <RevenueGoalCard />
            <OverdueTasksCard />
            <ContentCalendarCard />
          </div>

          {/* Charts & Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MRRChart />
            <ClientBreakdown />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UpcomingFilmings />
            <RecentActivity />
          </div>
        </TabsContent>

        <TabsContent value="clients" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ClientHealthCard />
            <TeamWorkloadCard />
            <div className="space-y-6">
              <ContentCalendarCard />
            </div>
          </div>
          
          {/* Client Performance Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MRRChart />
            <ClientBreakdown />
          </div>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-6">
          <PipelineAnalyticsCard />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecentActivity />
            <UpcomingFilmings />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
