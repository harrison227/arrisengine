import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { BarChart3, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { AnalyticsOverviewCards } from '@/components/analytics/AnalyticsOverviewCards';
import { PlatformCards } from '@/components/analytics/PlatformCards';
import { FollowerGrowthChart } from '@/components/analytics/FollowerGrowthChart';
import { ImpressionsChart } from '@/components/analytics/ImpressionsChart';
import { PlatformBreakdown } from '@/components/analytics/PlatformBreakdown';
import { TopPostsGrid } from '@/components/analytics/TopPostsGrid';

interface AnalyticsShareLink {
  id: string;
  client_id: string;
  share_id: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  date_range_start: string | null;
  date_range_end: string | null;
  platforms: string[] | null;
}

export default function PublicAnalyticsView() {
  const { shareId } = useParams<{ shareId: string }>();

  // Fetch share link data
  const { data: shareLink, isLoading: shareLinkLoading, error: shareLinkError } = useQuery({
    queryKey: ['public_analytics_share_link', shareId],
    queryFn: async () => {
      if (!shareId) return null;

      const { data, error } = await supabase
        .from('analytics_share_links')
        .select('*')
        .eq('share_id', shareId)
        .eq('is_active', true)
        .single();

      if (error) throw error;

      // Check if expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        throw new Error('Link has expired');
      }

      return data as AnalyticsShareLink;
    },
    enabled: !!shareId,
  });

  // Fetch client info from public-safe view
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['public_client_safe', shareLink?.client_id],
    queryFn: async () => {
      if (!shareLink?.client_id) return null;

      const { data, error } = await supabase
        .from('clients_public_safe')
        .select('business_name, brand_logo_url, brand_primary_color')
        .eq('id', shareLink.client_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!shareLink?.client_id,
  });

  // Fetch analytics via edge function
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['public_analytics', shareLink?.client_id, shareLink?.date_range_start, shareLink?.date_range_end],
    queryFn: async () => {
      if (!shareLink?.client_id) return null;

      const { data, error } = await supabase.functions.invoke('public-analytics-fetch', {
        body: {
          shareId: shareLink.share_id,
        },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!shareLink?.client_id,
  });

  // Filter by platforms if specified
  const filteredData = useMemo(() => {
    if (!analyticsData || !shareLink?.platforms?.length) return analyticsData;

    const platformFilter = shareLink.platforms.map((p) => p.toLowerCase());

    return {
      ...analyticsData,
      followerStats: analyticsData.followerStats?.filter((stat: any) =>
        platformFilter.includes(stat.platform?.toLowerCase())
      ),
      platformBreakdown: analyticsData.platformBreakdown?.filter((platform: any) =>
        platformFilter.includes(platform.platform?.toLowerCase())
      ),
      postAnalytics: analyticsData.postAnalytics?.filter((account: any) =>
        platformFilter.includes(account.platform?.toLowerCase())
      ),
      topPosts: analyticsData.topPosts?.filter((post: any) =>
        platformFilter.includes(post.platform?.toLowerCase())
      ),
    };
  }, [analyticsData, shareLink?.platforms]);

  const isLoading = shareLinkLoading || clientLoading || analyticsLoading;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-6xl mx-auto">
          <Skeleton className="h-16 w-64 mb-8" />
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-[300px] rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // Invalid or expired link
  if (!shareLink || shareLinkError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-16 h-16 mx-auto text-slate-400 mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Link Not Found</h1>
          <p className="text-slate-600">
            This analytics link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  // No data available
  if (!filteredData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-slate-400 mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">No Data Available</h1>
          <p className="text-slate-600">
            Analytics data could not be loaded at this time.
          </p>
        </div>
      </div>
    );
  }

  const brandColor = client?.brand_primary_color || '#3b82f6';
  const dateRangeText =
    shareLink.date_range_start && shareLink.date_range_end
      ? `${format(parseISO(shareLink.date_range_start), 'MMM d, yyyy')} – ${format(parseISO(shareLink.date_range_end), 'MMM d, yyyy')}`
      : 'All time';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          {client?.brand_logo_url ? (
            <img
              src={client.brand_logo_url}
              alt={client.business_name || 'Logo'}
              className="h-12 w-auto object-contain"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl"
              style={{ backgroundColor: brandColor }}
            >
              {client?.business_name?.charAt(0) || 'A'}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {client?.business_name || 'Analytics Dashboard'}
            </h1>
            <p className="text-sm text-slate-500">{dateRangeText}</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto p-8 space-y-8">
        {/* Platform Cards */}
        {filteredData.followerStats && filteredData.followerStats.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Platform Overview</h2>
            <PlatformCards followerStats={filteredData.followerStats} />
          </section>
        )}

        {/* Key Metrics */}
        {filteredData.aggregatedMetrics && (
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Key Metrics</h2>
            <AnalyticsOverviewCards metrics={filteredData.aggregatedMetrics} />
          </section>
        )}

        {/* Growth & Impressions Charts */}
        <section>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Growth & Impressions</h2>
          <div className="grid lg:grid-cols-2 gap-6">
            {filteredData.followerStats && (
              <FollowerGrowthChart followerStats={filteredData.followerStats} />
            )}
            {filteredData.postAnalytics && (
              <ImpressionsChart postAnalytics={filteredData.postAnalytics} />
            )}
          </div>
        </section>

        {/* Platform Breakdown */}
        {filteredData.platformBreakdown && filteredData.platformBreakdown.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Platform Breakdown</h2>
            <PlatformBreakdown platformBreakdown={filteredData.platformBreakdown} />
          </section>
        )}

        {/* Top Posts */}
        {filteredData.topPosts && filteredData.topPosts.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Top Performing Posts</h2>
            <TopPostsGrid topPosts={filteredData.topPosts} />
          </section>
        )}

        {/* Footer */}
        <footer className="pt-8 text-center text-sm text-slate-400">
          Powered by Arris Studios
        </footer>
      </main>
    </div>
  );
}
