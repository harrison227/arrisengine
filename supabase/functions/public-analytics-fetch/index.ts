import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LATE_API_BASE = 'https://getlate.dev/api/v1';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { shareId, fromDate, toDate } = await req.json();

    if (!shareId) {
      return new Response(
        JSON.stringify({ error: 'Share ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching public analytics for shareId: ${shareId}`);

    // Get share link details
    const { data: shareLink, error: shareLinkError } = await supabase
      .from('analytics_share_links')
      .select('*')
      .eq('share_id', shareId)
      .eq('is_active', true)
      .single();

    if (shareLinkError || !shareLink) {
      console.error('Error fetching share link:', shareLinkError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired share link' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Share link has expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client details
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, business_name, brand_logo_url, brand_primary_color, late_api_key, late_profile_id')
      .eq('id', shareLink.client_id)
      .single();

    if (clientError || !client) {
      console.error('Error fetching client:', clientError);
      return new Response(
        JSON.stringify({ error: 'Client not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!client.late_api_key) {
      return new Response(
        JSON.stringify({ error: 'Late not connected for this client' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lateHeaders = {
      'Authorization': `Bearer ${client.late_api_key}`,
      'Content-Type': 'application/json',
    };

    // Use date range from share link if not overridden
    const effectiveFromDate = fromDate || shareLink.date_range_start;
    const effectiveToDate = toDate || shareLink.date_range_end;

    // Fetch connected accounts with profileId
    console.log('Fetching connected accounts...');
    let accounts = [];
    let hasAnalyticsAccess = false;
    
    try {
      const accountsUrl = client.late_profile_id 
        ? `${LATE_API_BASE}/accounts?profileId=${client.late_profile_id}`
        : `${LATE_API_BASE}/accounts`;
      
      console.log(`Accounts URL: ${accountsUrl}`);
      
      const accountsResponse = await fetch(accountsUrl, {
        headers: lateHeaders,
      });

      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        console.log('Accounts response:', JSON.stringify(accountsData, null, 2));
        
        // Late returns { accounts: [...], hasAnalyticsAccess: boolean }
        accounts = accountsData.accounts || accountsData.data || [];
        hasAnalyticsAccess = accountsData.hasAnalyticsAccess ?? false;
        
        // Normalize account IDs
        accounts = accounts.map((acc: any) => ({
          ...acc,
          id: acc._id || acc.id,
        }));
        
        console.log(`Found ${accounts.length} accounts`);
      } else {
        console.error('Failed to fetch accounts:', accountsResponse.status);
      }
    } catch (fetchError) {
      console.error('Error fetching accounts:', fetchError);
    }

    // Filter by platforms if specified in share link
    if (shareLink.platforms && shareLink.platforms.length > 0) {
      accounts = accounts.filter((acc: any) => 
        shareLink.platforms.includes(acc.platform || acc.provider)
      );
    }

    if (accounts.length === 0) {
      return new Response(
        JSON.stringify({ 
          client: { 
            name: client.business_name, 
            logoUrl: client.brand_logo_url,
            primaryColor: client.brand_primary_color,
          },
          accounts: [],
          followerStats: [],
          postAnalytics: [],
          aggregatedMetrics: {
            totalFollowers: 0,
            totalPosts: 0,
            totalImpressions: 0,
            totalReach: 0,
            totalLikes: 0,
            totalComments: 0,
            totalShares: 0,
            totalClicks: 0,
            averageEngagementRate: 0,
          },
          platformBreakdown: [],
          topPosts: [],
          hasAnalyticsAccess,
          noAccountsFound: true,
          dateRange: { from: effectiveFromDate, to: effectiveToDate },
          fetchedAt: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get account IDs for batch requests
    const accountIds = accounts.map((acc: any) => acc.id).join(',');

    // Fetch follower stats
    let followerStats: any[] = [];
    let analyticsNotEnabled = false;
    
    try {
      const followerParams = new URLSearchParams();
      if (client.late_profile_id) {
        followerParams.append('profileId', client.late_profile_id);
      }
      followerParams.append('accountIds', accountIds);
      if (effectiveFromDate) {
        followerParams.append('fromDate', effectiveFromDate);
      }
      if (effectiveToDate) {
        followerParams.append('toDate', effectiveToDate);
      }
      followerParams.append('granularity', 'daily');
      
      const followerUrl = `${LATE_API_BASE}/accounts/follower-stats?${followerParams}`;
      console.log(`Fetching follower stats from: ${followerUrl}`);
      
      const followerResponse = await fetch(followerUrl, {
        headers: lateHeaders,
      });
      
      if (followerResponse.ok) {
        const followerData = await followerResponse.json();
        console.log('Follower stats response:', JSON.stringify(followerData, null, 2));
        
        const currentFollowers = followerData.currentFollowers || {};
        const statsData = followerData.stats || {};
        
        followerStats = accounts.map((account: any) => {
          const accId = account.id;
          const history = statsData[accId] || [];
          
          return {
            accountId: accId,
            platform: account.platform || account.provider,
            username: account.username || account.handle,
            current_followers: currentFollowers[accId] || account.followersCount || 0,
            follower_history: history.map((h: any) => ({
              date: h.date,
              count: h.followers || h.count,
            })),
          };
        });
      } else if (followerResponse.status === 403) {
        console.log('Analytics add-on not enabled');
        analyticsNotEnabled = true;
      } else {
        console.error('Follower stats error:', followerResponse.status);
      }
    } catch (followerError) {
      console.error('Error fetching follower stats:', followerError);
    }

    // Build basic stats if no API response
    if (followerStats.length === 0 && !analyticsNotEnabled) {
      followerStats = accounts.map((account: any) => ({
        accountId: account.id,
        platform: account.platform || account.provider,
        username: account.username || account.handle,
        current_followers: account.followersCount || account.followers || 0,
        follower_history: [],
      }));
    }

    // Fetch post analytics using unified endpoint
    let postAnalytics: any[] = [];
    
    try {
      const analyticsParams = new URLSearchParams();
      if (client.late_profile_id) {
        analyticsParams.append('profileId', client.late_profile_id);
      }
      analyticsParams.append('platform', 'all');
      if (effectiveFromDate) {
        analyticsParams.append('fromDate', effectiveFromDate);
      }
      if (effectiveToDate) {
        analyticsParams.append('toDate', effectiveToDate);
      }
      analyticsParams.append('limit', '50');
      analyticsParams.append('page', '1');
      analyticsParams.append('sortBy', 'engagement');
      analyticsParams.append('order', 'desc');
      
      const analyticsUrl = `${LATE_API_BASE}/analytics?${analyticsParams}`;
      console.log(`Fetching analytics from: ${analyticsUrl}`);
      
      const analyticsResponse = await fetch(analyticsUrl, {
        headers: lateHeaders,
      });
      
      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        console.log('Analytics response:', JSON.stringify(analyticsData, null, 2));
        
        const posts = analyticsData.posts || analyticsData.data || analyticsData || [];
        
        postAnalytics = (Array.isArray(posts) ? posts : []).map((post: any) => {
          // Late may nest metrics under analytics object
          const analytics = post.analytics || {};
          
          // Get views/impressions from multiple possible locations
          const views = post.views || analytics.views || post.impressions || analytics.impressions || 0;
          const reach = post.reach || analytics.reach || 0;
          const likes = post.likes || analytics.likes || post.likeCount || analytics.likeCount || 0;
          const comments = post.comments || analytics.comments || post.commentCount || analytics.commentCount || 0;
          const shares = post.shares || analytics.shares || post.retweets || analytics.retweets || post.reposts || analytics.reposts || 0;
          const saves = post.saves || analytics.saves || post.bookmarks || analytics.bookmarks || 0;
          const clicks = post.clicks || analytics.clicks || post.linkClicks || analytics.linkClicks || 0;
          
          return {
            id: post._id || post.id || post.postId,
            caption: post.caption || post.content || post.text || '',
            posted_at: post.publishedAt || post.postedAt || post.createdAt,
            platform: post.platform || post.provider,
            accountId: post.accountId || post.account_id,
            username: post.username || '',
            impressions: views,
            views: views,
            reach: reach,
            likes: likes,
            comments: comments,
            shares: shares,
            saves: saves,
            clicks: clicks,
            engagement: post.engagement || analytics.engagement || (likes + comments + shares + saves),
            engagementRate: post.engagementRate || analytics.engagementRate || 0,
            thumbnailUrl: post.thumbnailUrl || post.mediaUrl || post.imageUrl,
          };
        });
      } else if (analyticsResponse.status === 403) {
        analyticsNotEnabled = true;
      } else {
        console.error('Analytics error:', analyticsResponse.status);
      }
    } catch (analyticsError) {
      console.error('Error fetching analytics:', analyticsError);
    }

    // Calculate aggregate metrics
    const aggregatedMetrics = {
      totalFollowers: 0,
      totalPosts: postAnalytics.length,
      totalImpressions: 0,
      totalReach: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalClicks: 0,
      averageEngagementRate: 0,
    };

    const platformBreakdown: Record<string, any> = {};

    followerStats.forEach((stat: any) => {
      const followers = stat.current_followers || 0;
      aggregatedMetrics.totalFollowers += followers;
      
      const plat = stat.platform || 'unknown';
      if (!platformBreakdown[plat]) {
        platformBreakdown[plat] = {
          platform: plat,
          followers: 0,
          impressions: 0,
          engagement: 0,
          posts: 0,
        };
      }
      platformBreakdown[plat].followers += followers;
    });

    postAnalytics.forEach((post: any) => {
      aggregatedMetrics.totalImpressions += post.impressions || 0;
      aggregatedMetrics.totalReach += post.reach || 0;
      aggregatedMetrics.totalLikes += post.likes || 0;
      aggregatedMetrics.totalComments += post.comments || 0;
      aggregatedMetrics.totalShares += post.shares || 0;
      aggregatedMetrics.totalClicks += post.clicks || 0;

      const plat = post.platform || 'unknown';
      if (!platformBreakdown[plat]) {
        platformBreakdown[plat] = {
          platform: plat,
          followers: 0,
          impressions: 0,
          engagement: 0,
          posts: 0,
        };
      }
      platformBreakdown[plat].impressions += post.impressions || 0;
      platformBreakdown[plat].engagement += post.engagement || 0;
      platformBreakdown[plat].posts++;
    });

    if (aggregatedMetrics.totalImpressions > 0) {
      const totalEngagements = aggregatedMetrics.totalLikes + aggregatedMetrics.totalComments + aggregatedMetrics.totalShares;
      aggregatedMetrics.averageEngagementRate = (totalEngagements / aggregatedMetrics.totalImpressions) * 100;
    }

    const topPosts = [...postAnalytics]
      .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
      .slice(0, 12);

    const response = {
      client: {
        name: client.business_name,
        logoUrl: client.brand_logo_url,
        primaryColor: client.brand_primary_color,
      },
      accounts: accounts.map((acc: any) => ({
        id: acc.id,
        platform: acc.platform || acc.provider,
        username: acc.username || acc.handle,
        profilePictureUrl: acc.profilePicture || acc.avatarUrl || acc.profile_picture_url,
        followers: acc.followersCount || acc.followers || 0,
      })),
      followerStats,
      postAnalytics,
      aggregatedMetrics,
      platformBreakdown: Object.values(platformBreakdown),
      topPosts,
      hasAnalyticsAccess,
      analyticsNotEnabled,
      dateRange: {
        from: effectiveFromDate,
        to: effectiveToDate,
      },
      fetchedAt: new Date().toISOString(),
    };

    console.log(`Returning public analytics: ${accounts.length} accounts, ${postAnalytics.length} posts`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in public-analytics-fetch:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
