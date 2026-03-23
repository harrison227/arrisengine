import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LATE_API_BASE = 'https://getlate.dev/api/v1';

interface AnalyticsRequest {
  clientId: string;
  fromDate?: string;
  toDate?: string;
  platform?: string;
}

// Helper to fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Helper to fetch single post analytics by Late Post ID
async function fetchSinglePostAnalytics(
  postId: string,
  lateHeaders: Record<string, string>
): Promise<any | null> {
  try {
    const url = `${LATE_API_BASE}/analytics?postId=${postId}`;
    const response = await fetchWithTimeout(url, { headers: lateHeaders }, 8000);
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.error(`Failed to fetch analytics for postId ${postId}:`, e);
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clientId, fromDate, toDate, platform }: AnalyticsRequest = await req.json();

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: 'Client ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching Late analytics for client: ${clientId}, fromDate: ${fromDate}, toDate: ${toDate}, platform: ${platform}`);

    // Get client's Late API key and profile ID
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('late_api_key, late_profile_id, business_name, brand_logo_url')
      .eq('id', clientId)
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
        JSON.stringify({ error: 'Late API key not configured for this client', lateNotConnected: true }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lateHeaders = {
      'Authorization': `Bearer ${client.late_api_key}`,
      'Content-Type': 'application/json',
    };

    // Fetch connected accounts
    console.log('Fetching connected accounts from Late API...');
    let accounts: any[] = [];
    let hasAnalyticsAccess = false;
    
    try {
      const accountsUrl = client.late_profile_id 
        ? `${LATE_API_BASE}/accounts?profileId=${client.late_profile_id}`
        : `${LATE_API_BASE}/accounts`;
      
      const accountsResponse = await fetchWithTimeout(accountsUrl, { headers: lateHeaders });

      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        accounts = accountsData.accounts || accountsData.data || [];
        hasAnalyticsAccess = accountsData.hasAnalyticsAccess ?? false;
        
        // Normalize account IDs
        accounts = accounts.map((acc: any) => ({
          ...acc,
          id: acc._id || acc.id,
        }));
        
        console.log(`Found ${accounts.length} accounts, hasAnalyticsAccess: ${hasAnalyticsAccess}`);
      } else {
        const errorText = await accountsResponse.text();
        console.error('Failed to fetch accounts:', accountsResponse.status, errorText);
        return new Response(
          JSON.stringify({ error: `Late API error: ${accountsResponse.status}`, details: errorText }),
          { status: accountsResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (networkError) {
      console.error('Network error fetching Late API:', networkError);
      return new Response(
        JSON.stringify({ error: 'Unable to connect to Late API', networkError: true }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter by platform if specified
    if (platform && platform !== 'all') {
      accounts = accounts.filter((acc: any) => 
        (acc.platform || acc.provider)?.toLowerCase() === platform.toLowerCase()
      );
    }

    if (accounts.length === 0) {
      console.log('No accounts found');
      return new Response(
        JSON.stringify({ 
          client: { name: client.business_name, logoUrl: client.brand_logo_url },
          accounts: [],
          followerStats: [],
          postAnalytics: [],
          aggregatedMetrics: {
            totalFollowers: 0, totalPosts: 0, totalImpressions: 0, totalReach: 0,
            totalLikes: 0, totalComments: 0, totalShares: 0, totalClicks: 0, averageEngagementRate: 0,
          },
          platformBreakdown: [],
          topPosts: [],
          hasAnalyticsAccess,
          noAccountsFound: true,
          dateRange: { from: fromDate, to: toDate },
          fetchedAt: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountIds = accounts.map((acc: any) => acc.id).join(',');

    // Fetch follower stats
    let followerStats: any[] = [];
    let analyticsNotEnabled = false;
    
    try {
      const followerParams = new URLSearchParams();
      if (client.late_profile_id) followerParams.append('profileId', client.late_profile_id);
      followerParams.append('accountIds', accountIds);
      if (fromDate) followerParams.append('fromDate', fromDate);
      if (toDate) followerParams.append('toDate', toDate);
      followerParams.append('granularity', 'daily');
      
      const followerUrl = `${LATE_API_BASE}/accounts/follower-stats?${followerParams}`;
      console.log(`Fetching follower stats from: ${followerUrl}`);
      
      const followerResponse = await fetchWithTimeout(followerUrl, { headers: lateHeaders });
      
      if (followerResponse.ok) {
        const followerData = await followerResponse.json();
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
        analyticsNotEnabled = true;
      }
    } catch (followerError) {
      console.error('Error fetching follower stats:', followerError);
    }

    // Fallback if no follower stats from API
    if (followerStats.length === 0 && !analyticsNotEnabled) {
      followerStats = accounts.map((account: any) => ({
        accountId: account.id,
        platform: account.platform || account.provider,
        username: account.username || account.handle,
        current_followers: account.followersCount || account.followers || 0,
        follower_history: [],
      }));
    }

    // ========== POST ANALYTICS: NEW STRATEGY ==========
    // 1. First try /v1/analytics list endpoint
    // 2. If empty but posts exist, fetch /v1/posts and enrich each with single-post analytics
    let postAnalytics: any[] = [];
    let postAnalyticsSource = 'none';
    
    try {
      // Step 1: Try the analytics list endpoint
      const analyticsParams = new URLSearchParams();
      if (client.late_profile_id) analyticsParams.append('profileId', client.late_profile_id);
      if (platform && platform !== 'all') analyticsParams.append('platform', platform);
      if (fromDate) analyticsParams.append('fromDate', fromDate);
      if (toDate) analyticsParams.append('toDate', toDate);
      analyticsParams.append('limit', '50');
      analyticsParams.append('sortBy', 'engagement');
      analyticsParams.append('order', 'desc');
      
      const analyticsUrl = `${LATE_API_BASE}/analytics?${analyticsParams}`;
      console.log(`Fetching analytics list from: ${analyticsUrl}`);
      
      const analyticsResponse = await fetchWithTimeout(analyticsUrl, { headers: lateHeaders });
      
      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        const posts = analyticsData.posts || analyticsData.data || [];
        
        console.log('Analytics list response:', {
          totalPosts: analyticsData.overview?.totalPosts,
          paginationTotal: analyticsData.pagination?.total,
          postsLength: posts.length,
        });
        
        if (Array.isArray(posts) && posts.length > 0) {
          postAnalyticsSource = 'analytics_list';
          postAnalytics = posts.map((post: any) => normalizePostAnalytics(post, accounts));
        }
      }
      
      // Step 2: If analytics list is empty, fetch published posts and enrich with per-post analytics
      if (postAnalytics.length === 0) {
        console.log('Analytics list empty, fetching published posts for per-post enrichment...');
        
        const postsParams = new URLSearchParams();
        if (client.late_profile_id) postsParams.append('profileId', client.late_profile_id);
        postsParams.append('status', 'published');
        if (platform && platform !== 'all') postsParams.append('platform', platform);
        // Use dateFrom/dateTo for /v1/posts endpoint
        if (fromDate) postsParams.append('dateFrom', fromDate);
        if (toDate) postsParams.append('dateTo', toDate);
        postsParams.append('limit', '50');
        
        const postsUrl = `${LATE_API_BASE}/posts?${postsParams}`;
        console.log(`Fetching published posts from: ${postsUrl}`);
        
        const postsResponse = await fetchWithTimeout(postsUrl, { headers: lateHeaders });
        
        if (postsResponse.ok) {
          const postsData = await postsResponse.json();
          const publishedPosts = postsData.posts || postsData.data || [];
          console.log(`Found ${publishedPosts.length} published posts`);
          
          if (publishedPosts.length > 0) {
            postAnalyticsSource = 'postId_enriched';
            
            // Log sample post structure for debugging
            const samplePost = publishedPosts[0];
            console.log('Sample post structure from /v1/posts:', JSON.stringify({
              hasId: !!samplePost._id,
              hasPlatforms: !!samplePost.platforms?.length,
              firstPlatform: samplePost.platforms?.[0]?.platform,
              firstAccountUsername: samplePost.platforms?.[0]?.accountId?.username,
              hasMediaItems: !!samplePost.mediaItems?.length,
              hasContent: !!samplePost.content,
              keys: Object.keys(samplePost).slice(0, 15),
            }));
            
            // Enrich posts with per-post analytics (batch with concurrency limit)
            const enrichedPosts: any[] = [];
            const batchSize = 5;
            
            for (let i = 0; i < Math.min(publishedPosts.length, 50); i += batchSize) {
              const batch = publishedPosts.slice(i, i + batchSize);
              const batchResults = await Promise.all(
                batch.map(async (post: any, batchIndex: number) => {
                  const latePostId = post._id || post.id;
                  const singleAnalytics = await fetchSinglePostAnalytics(latePostId, lateHeaders);
                  
                  // Log first post's analytics structure for debugging
                  if (i === 0 && batchIndex === 0 && singleAnalytics) {
                    console.log('Sample single-post analytics response:', JSON.stringify({
                      hasAnalytics: !!singleAnalytics.analytics,
                      analyticsKeys: singleAnalytics.analytics ? Object.keys(singleAnalytics.analytics) : [],
                      impressions: singleAnalytics.analytics?.impressions,
                      likes: singleAnalytics.analytics?.likes,
                      hasPlatformAnalytics: !!singleAnalytics.platformAnalytics?.length,
                      paAnalyticsKeys: singleAnalytics.platformAnalytics?.[0]?.analytics 
                        ? Object.keys(singleAnalytics.platformAnalytics[0].analytics) : [],
                      paPlatform: singleAnalytics.platformAnalytics?.[0]?.platform,
                      paImpressions: singleAnalytics.platformAnalytics?.[0]?.analytics?.impressions,
                    }));
                  }
                  
                  if (singleAnalytics) {
                    // Merge post data with analytics
                    return {
                      ...post,
                      analytics: singleAnalytics.analytics || {},
                      platformAnalytics: singleAnalytics.platformAnalytics || [],
                    };
                  }
                  return post;
                })
              );
              enrichedPosts.push(...batchResults);
            }
            
            postAnalytics = enrichedPosts.map((post: any) => normalizePostAnalytics(post, accounts));
            
            // Log sample normalized post for debugging
            if (postAnalytics.length > 0) {
              console.log('Sample normalized post:', JSON.stringify({
                id: postAnalytics[0].id,
                platform: postAnalytics[0].platform,
                username: postAnalytics[0].username,
                impressions: postAnalytics[0].impressions,
                likes: postAnalytics[0].likes,
                comments: postAnalytics[0].comments,
                hasThumbnail: !!postAnalytics[0].thumbnail_url,
              }));
            }
          }
        }
      }
      
      console.log(`Post analytics source: ${postAnalyticsSource}, count: ${postAnalytics.length}`);
      
    } catch (analyticsError) {
      console.error('Error fetching analytics:', analyticsError);
    }

    // Helper function to normalize post analytics
    function normalizePostAnalytics(post: any, accounts: any[]): any {
      // Analytics from single-post /v1/analytics?postId= response
      const analytics = post.analytics || {};
      const platformAnalytics = post.platformAnalytics?.[0] || {};
      const paAnalytics = platformAnalytics.analytics || {};
      
      // Extract platform from platforms array (from /v1/posts response structure)
      const platformsArray = post.platforms || [];
      const firstPlatformEntry = platformsArray[0] || {};
      const accountFromPlatform = firstPlatformEntry.accountId || {};
      
      // Priority: platformAnalytics.platform > platforms[0].platform > post.platform
      const postPlatform = (
        platformAnalytics.platform || 
        firstPlatformEntry.platform || 
        post.platform || 
        post.provider || 
        'unknown'
      ).toLowerCase();
      
      // Priority: platformAnalytics.accountUsername > platforms[0].accountId.username > matchingAccount
      const matchingAccount = accounts.find((acc: any) => 
        acc.id === post.accountId || 
        acc.id === platformAnalytics.accountId ||
        acc.id === accountFromPlatform._id ||
        acc.id === accountFromPlatform.id
      );
      
      const username = 
        platformAnalytics.accountUsername || 
        accountFromPlatform.username || 
        accountFromPlatform.handle ||
        matchingAccount?.username || 
        matchingAccount?.handle ||
        '';
      
      // Get metrics from multiple possible locations (paAnalytics first since it's from single-post analytics)
      const views = paAnalytics.views || analytics.views || post.views || 0;
      const impressions = paAnalytics.impressions || analytics.impressions || post.impressions || views || 0;
      const reach = paAnalytics.reach || analytics.reach || post.reach || 0;
      const likes = paAnalytics.likes || analytics.likes || post.likeCount || post.likes || 0;
      const comments = paAnalytics.comments || analytics.comments || post.commentCount || post.comments || 0;
      const shares = paAnalytics.shares || analytics.shares || post.reposts || post.retweets || post.shares || 0;
      const saves = paAnalytics.saves || analytics.saves || post.bookmarks || post.saves || 0;
      const clicks = paAnalytics.clicks || analytics.clicks || post.linkClicks || post.clicks || 0;
      const engagement = paAnalytics.engagement || analytics.engagement || (likes + comments + shares + saves);
      const engagementRate = paAnalytics.engagementRate || analytics.engagementRate || 0;
      
      // Get media URLs from mediaItems array (from /v1/posts response)
      const mediaItems = post.mediaItems || post.media || [];
      const firstMedia = mediaItems[0] || {};
      const thumbnailUrl = 
        post.thumbnailUrl || 
        firstMedia.thumbnailUrl || 
        firstMedia.url ||
        platformAnalytics.thumbnailUrl || 
        post.mediaUrl || 
        post.imageUrl || 
        '';
      const mediaUrl = 
        post.mediaUrl || 
        firstMedia.url || 
        firstMedia.thumbnailUrl ||
        post.thumbnailUrl ||
        '';
      
      // Extract platform post URL for direct linking
      const platformPostUrl = 
        post.platformPostUrl ||
        firstPlatformEntry.platformPostUrl ||
        platformAnalytics.platformPostUrl ||
        post.url ||
        '';
      
      return {
        id: post._id || post.id || post.postId,
        caption: post.content || post.caption || post.text || '',
        posted_at: post.publishedAt || post.postedAt || post.createdAt,
        platform: postPlatform,
        accountId: post.accountId || platformAnalytics.accountId || accountFromPlatform._id,
        username,
        impressions,
        views,
        reach,
        likes,
        comments,
        shares,
        saves,
        clicks,
        engagement,
        engagementRate,
        // Both snake_case and camelCase for compatibility
        thumbnail_url: thumbnailUrl,
        media_url: mediaUrl,
        thumbnailUrl: thumbnailUrl,
        mediaUrl: mediaUrl,
        platform_post_url: platformPostUrl,
        platformPostUrl: platformPostUrl,
      };
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

    const platformBreakdown: Record<string, {
      followers: number;
      impressions: number;
      engagement: number;
      posts: number;
      platform: string;
    }> = {};

    // Process follower stats
    followerStats.forEach((stat: any) => {
      const followers = stat.current_followers || 0;
      aggregatedMetrics.totalFollowers += followers;
      
      const plat = (stat.platform || 'unknown').toLowerCase();
      if (!platformBreakdown[plat]) {
        platformBreakdown[plat] = { platform: plat, followers: 0, impressions: 0, engagement: 0, posts: 0 };
      }
      platformBreakdown[plat].followers += followers;
    });

    // Process post analytics
    postAnalytics.forEach((post: any) => {
      aggregatedMetrics.totalImpressions += post.impressions || 0;
      aggregatedMetrics.totalReach += post.reach || 0;
      aggregatedMetrics.totalLikes += post.likes || 0;
      aggregatedMetrics.totalComments += post.comments || 0;
      aggregatedMetrics.totalShares += post.shares || 0;
      aggregatedMetrics.totalClicks += post.clicks || 0;

      const plat = (post.platform || 'unknown').toLowerCase();
      if (!platformBreakdown[plat]) {
        platformBreakdown[plat] = { platform: plat, followers: 0, impressions: 0, engagement: 0, posts: 0 };
      }
      platformBreakdown[plat].impressions += post.impressions || 0;
      platformBreakdown[plat].engagement += post.engagement || 0;
      platformBreakdown[plat].posts++;
    });

    // Calculate engagement rate
    if (aggregatedMetrics.totalImpressions > 0) {
      const totalEngagements = aggregatedMetrics.totalLikes + aggregatedMetrics.totalComments + aggregatedMetrics.totalShares;
      aggregatedMetrics.averageEngagementRate = (totalEngagements / aggregatedMetrics.totalImpressions) * 100;
    }

    // Get top performing posts by engagement
    const topPosts = [...postAnalytics]
      .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
      .slice(0, 12);

    const response = {
      client: { name: client.business_name, logoUrl: client.brand_logo_url },
      accounts: accounts.map((acc: any) => ({
        id: acc.id,
        platform: (acc.platform || acc.provider || '').toLowerCase(),
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
      postAnalyticsSource,
      profileIdUsed: client.late_profile_id || null,
      dateRange: { from: fromDate, to: toDate },
      fetchedAt: new Date().toISOString(),
    };

    console.log(`Returning: ${accounts.length} accounts, ${postAnalytics.length} posts, source: ${postAnalyticsSource}`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in fetch-late-analytics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
