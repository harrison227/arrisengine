import { useState, useMemo } from 'react';
import { useClients } from '@/hooks/useClients';
import { useLateAnalytics } from '@/hooks/useLateAnalytics';
import { useAgencySettings } from '@/hooks/useAgencySettings';
import { AnalyticsOverviewCards } from '@/components/analytics/AnalyticsOverviewCards';
import { PlatformCards } from '@/components/analytics/PlatformCards';
import { FollowerGrowthChart } from '@/components/analytics/FollowerGrowthChart';
import { ImpressionsChart } from '@/components/analytics/ImpressionsChart';
import { PlatformBreakdown } from '@/components/analytics/PlatformBreakdown';
import { TopPostsGrid } from '@/components/analytics/TopPostsGrid';
import { TopPerformersSection } from '@/components/analytics/TopPerformersSection';
import { AnalyticsPdfExport } from '@/components/analytics/AnalyticsPdfExport';
import { DraggableAnalyticsGrid } from '@/components/analytics/DraggableAnalyticsGrid';
import { GenerateAnalyticsShareLinkDialog } from '@/components/dialogs/GenerateAnalyticsShareLinkDialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, RefreshCw, AlertCircle, BarChart3, Share2 } from 'lucide-react';
import { format, subDays } from 'date-fns';

const DATE_RANGES = [
  { label: 'Last 7 days', value: '7', from: () => subDays(new Date(), 7), to: () => new Date() },
  { label: 'Last 30 days', value: '30', from: () => subDays(new Date(), 30), to: () => new Date() },
  { label: 'Last 90 days', value: '90', from: () => subDays(new Date(), 90), to: () => new Date() },
  { label: 'Last 60 days', value: '60', from: () => subDays(new Date(), 60), to: () => new Date() },
];
export default function SocialAnalytics() {
  const { clients, isLoading: clientsLoading } = useClients();
  const { settings } = useAgencySettings();
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [dateRange, setDateRange] = useState('30');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const selectedRange = DATE_RANGES.find((r) => r.value === dateRange) || DATE_RANGES[1];
  const dateFrom = format(selectedRange.from(), 'yyyy-MM-dd');
  const dateTo = format(selectedRange.to(), 'yyyy-MM-dd');

  const { data, isLoading, error, refetch, isFetching } = useLateAnalytics({
    clientId: selectedClientId,
    dateFrom,
    dateTo,
    enabled: !!selectedClientId,
  });

  const connectedClients = clients?.filter((c) => c.late_api_key) || [];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />
            Social Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Track performance across all connected social accounts
          </p>
        </div>

        <div className="flex items-center gap-3">
          {data && (
            <>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowShareDialog(true)}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)}>
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Select a client" />
          </SelectTrigger>
          <SelectContent>
            {clientsLoading ? (
              <SelectItem value="loading" disabled>Loading...</SelectItem>
            ) : connectedClients.length === 0 ? (
              <SelectItem value="none" disabled>No clients with Late connected</SelectItem>
            ) : (
              connectedClients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.business_name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map((range) => (
              <SelectItem key={range.value} value={range.value}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {!selectedClientId ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Select a Client</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Choose a client with Late connected to view their social media analytics
            </p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[300px] rounded-lg" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h3 className="text-lg font-medium mb-2">Failed to Load Analytics</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              {(error as Error).message === 'Unable to connect to Late API' 
                ? 'Unable to connect to Late API. This may be a temporary network issue in the development environment. In production, this will work correctly.'
                : (error as Error).message}
            </p>
            <Button onClick={() => refetch()}>Try Again</Button>
          </CardContent>
        </Card>
      ) : data ? (
        <DraggableAnalyticsGrid
          modules={[
            {
              id: 'top-performers',
              title: 'Top Performers',
              component: (
                <TopPerformersSection
                  clientId={selectedClientId}
                  clientName={connectedClients.find(c => c.id === selectedClientId)?.business_name || ''}
                  topPosts={data.topPosts}
                  accounts={data.accounts || []}
                />
              ),
            },
            {
              id: 'platform-cards',
              title: 'Platform Overview',
              component: <PlatformCards followerStats={data.followerStats} />,
            },
            {
              id: 'overview-cards',
              title: 'Key Metrics',
              component: <AnalyticsOverviewCards metrics={data.aggregatedMetrics} />,
            },
            {
              id: 'follower-chart',
              title: 'Growth & Impressions',
              component: (
                <div className="grid lg:grid-cols-2 gap-6">
                  <FollowerGrowthChart followerStats={data.followerStats} />
                  <ImpressionsChart postAnalytics={data.postAnalytics} />
                </div>
              ),
            },
            {
              id: 'platform-breakdown',
              title: 'Platform Breakdown',
              component: <PlatformBreakdown platformBreakdown={data.platformBreakdown} />,
            },
            {
              id: 'top-posts',
              title: 'Top Posts',
              component: <TopPostsGrid topPosts={data.topPosts} />,
            },
          ]}
        />
      ) : null}

      {/* Export Dialog */}
      {data && (
        <AnalyticsPdfExport
          data={data}
          agencyName={settings?.agency_name || undefined}
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
        />
      )}

      {/* Share Dialog */}
      <GenerateAnalyticsShareLinkDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        preselectedClientId={selectedClientId}
        preselectedDateRange={{ from: dateFrom, to: dateTo }}
      />
    </div>
  );
}
