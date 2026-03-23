import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AnalyticsData {
  client: {
    name: string;
    logoUrl: string | null;
    primaryColor?: string;
  };
  accounts: Array<{
    id: string;
    platform: string;
    username: string;
    profilePictureUrl?: string;
  }>;
  followerStats: Array<{
    accountId: string;
    platform: string;
    username: string;
    current_followers?: number;
    follower_history?: Array<{
      date: string;
      count: number;
    }>;
    error?: string;
  }>;
  postAnalytics: Array<{
    id: string;
    accountId?: string;
    platform: string;
    username: string;
    caption?: string;
    media_url?: string;
    thumbnail_url?: string;
    thumbnailUrl?: string;
    impressions?: number;
    views?: number;
    reach?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    clicks?: number;
    engagement?: number;
    engagementRate?: number;
    posted_at?: string;
    platform_post_url?: string;
    platformPostUrl?: string;
  }>;
  aggregatedMetrics: {
    totalFollowers: number;
    totalPosts: number;
    totalImpressions: number;
    totalReach: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalClicks: number;
    averageEngagementRate: number;
  };
  platformBreakdown: Array<{
    platform: string;
    followers: number;
    impressions: number;
    engagement: number;
    posts: number;
  }>;
  topPosts: Array<{
    id: string;
    platform: string;
    username: string;
    caption?: string;
    media_url?: string;
    thumbnail_url?: string;
    impressions?: number;
    reach?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    clicks?: number;
    posted_at?: string;
  }>;
  dateRange: {
    from?: string;
    to?: string;
  };
  fetchedAt: string;
}

interface UseLateAnalyticsOptions {
  clientId: string | undefined;
  dateFrom?: string;
  dateTo?: string;
  platform?: string;
  enabled?: boolean;
}

export function useLateAnalytics({ 
  clientId, 
  dateFrom, 
  dateTo, 
  platform,
  enabled = true 
}: UseLateAnalyticsOptions) {
  return useQuery({
    queryKey: ['late-analytics', clientId, dateFrom, dateTo, platform],
    queryFn: async (): Promise<AnalyticsData> => {
      if (!clientId) throw new Error('Client ID is required');

      const { data, error } = await supabase.functions.invoke('fetch-late-analytics', {
        body: {
          clientId,
          fromDate: dateFrom,
          toDate: dateTo,
          platform,
        },
      });

      if (error) {
        console.error('Error fetching analytics:', error);
        throw new Error(error.message || 'Failed to fetch analytics');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data as AnalyticsData;
    },
    enabled: enabled && !!clientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

interface UsePublicAnalyticsOptions {
  shareId: string | undefined;
  enabled?: boolean;
}

export function usePublicAnalytics({ shareId, enabled = true }: UsePublicAnalyticsOptions) {
  return useQuery({
    queryKey: ['public-analytics', shareId],
    queryFn: async (): Promise<AnalyticsData> => {
      if (!shareId) throw new Error('Share ID is required');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-analytics-fetch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ shareId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch analytics');
      }

      return response.json();
    },
    enabled: enabled && !!shareId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
