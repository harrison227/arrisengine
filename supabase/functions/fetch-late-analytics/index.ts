/**
 * Fetch Late.is analytics for the agency-internal dashboard.
 *
 * Tries the bulk /v1/analytics endpoint first; if it returns nothing
 * (which happens for some Late accounts), falls back to /v1/posts and
 * enriches each row with /v1/analytics?postId=... — done in parallel
 * batches of 5 to keep within the edge function's time budget.
 *
 * Contract preserved:
 *   Request:  { clientId, fromDate?, toDate?, platform? }
 *   Response: { client, accounts, followerStats, postAnalytics,
 *               aggregatedMetrics, platformBreakdown, topPosts, ... }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { badRequest, notFound, upstream } from '../_shared/errors.ts';
import { ensureOptionalString, ensureUuid } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { LateClient } from '../_shared/late.ts';
import type { Logger } from '../_shared/logger.ts';

interface RequestBody {
  clientId: unknown;
  fromDate?: unknown;
  toDate?: unknown;
  platform?: unknown;
}

type Account = Record<string, unknown> & { id: string };

interface PostMetric {
  id: string;
  caption: string;
  posted_at: string | null;
  platform: string;
  accountId: string;
  username: string;
  impressions: number;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  engagement: number;
  engagementRate: number;
  thumbnail_url: string;
  media_url: string;
  thumbnailUrl: string;
  mediaUrl: string;
  platform_post_url: string;
  platformPostUrl: string;
}

interface FollowerStat {
  accountId: string;
  platform: string;
  username: string;
  current_followers: number;
  follower_history: Array<{ date: string; count: number }>;
}

const num = (...candidates: unknown[]): number => {
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return c;
  }
  return 0;
};
const str = (...candidates: unknown[]): string => {
  for (const c of candidates) {
    if (typeof c === 'string' && c) return c;
  }
  return '';
};

Deno.serve(withErrorHandling({ fn: 'fetch-late-analytics' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const clientId = ensureUuid('clientId', body.clientId);
  const fromDate = ensureOptionalString('fromDate', body.fromDate, 100);
  const toDate = ensureOptionalString('toDate', body.toDate, 100);
  const platform = ensureOptionalString('platform', body.platform, 50);

  const supabase = getSupabaseAdmin();
  const { data: client } = await supabase
    .from('clients')
    .select('late_api_key, late_profile_id, business_name, brand_logo_url')
    .eq('id', clientId)
    .maybeSingle();
  if (!client) throw notFound('Client not found');
  if (!client.late_api_key) {
    return jsonResponse({ error: 'Late API key not configured for this client', lateNotConnected: true }, { status: 400 });
  }

  const late = new LateClient(client.late_api_key);

  // Accounts ----------------------------------------------------------------
  const accountsEndpoint = client.late_profile_id ? `/accounts?profileId=${encodeURIComponent(client.late_profile_id)}` : '/accounts';
  const accountsResult = await late.call<{ accounts?: Account[]; data?: Account[]; hasAnalyticsAccess?: boolean }>({
    endpoint: accountsEndpoint, method: 'GET',
  });
  if (accountsResult.error) {
    if (accountsResult.status && accountsResult.status >= 400 && accountsResult.status < 500) {
      throw upstream(accountsResult.error, accountsResult.status);
    }
    throw upstream('Unable to connect to Late API', 503);
  }
  let accounts: Account[] = (accountsResult.data?.accounts ?? accountsResult.data?.data ?? []).map((a: Record<string, unknown>) => ({
    ...(a as Account),
    id: String(a._id ?? a.id ?? ''),
  })).filter((a) => a.id);
  const hasAnalyticsAccess = Boolean(accountsResult.data?.hasAnalyticsAccess);

  if (platform && platform !== 'all') {
    accounts = accounts.filter((a) => String(a.platform ?? a.provider ?? '').toLowerCase() === platform.toLowerCase());
  }

  if (accounts.length === 0) {
    log.info('no_accounts_found');
    return jsonResponse(emptyResponse(client, hasAnalyticsAccess, fromDate, toDate));
  }

  const accountIds = accounts.map((a) => a.id).join(',');

  // Follower stats ----------------------------------------------------------
  const { followerStats, analyticsNotEnabled: followerBlocked } = await fetchFollowerStats(late, client.late_profile_id, accountIds, fromDate, toDate, accounts, log);

  // Post analytics ----------------------------------------------------------
  let postAnalytics: PostMetric[] = [];
  let postAnalyticsSource: 'analytics_list' | 'postId_enriched' | 'none' = 'none';

  // Strategy 1: bulk analytics list.
  const analyticsParams = new URLSearchParams();
  if (client.late_profile_id) analyticsParams.append('profileId', client.late_profile_id);
  if (platform && platform !== 'all') analyticsParams.append('platform', platform);
  if (fromDate) analyticsParams.append('fromDate', fromDate);
  if (toDate) analyticsParams.append('toDate', toDate);
  analyticsParams.append('limit', '50');
  analyticsParams.append('sortBy', 'engagement');
  analyticsParams.append('order', 'desc');

  const analyticsResult = await late.call<{ posts?: unknown[]; data?: unknown[] }>({ endpoint: `/analytics?${analyticsParams}`, method: 'GET' });
  if (!analyticsResult.error) {
    const posts = (analyticsResult.data?.posts ?? analyticsResult.data?.data ?? []) as Record<string, unknown>[];
    if (posts.length > 0) {
      postAnalyticsSource = 'analytics_list';
      postAnalytics = posts.map((p) => normalize(p, accounts));
    }
  }

  // Strategy 2: /v1/posts then enrich.
  if (postAnalytics.length === 0) {
    const postsParams = new URLSearchParams();
    if (client.late_profile_id) postsParams.append('profileId', client.late_profile_id);
    postsParams.append('status', 'published');
    if (platform && platform !== 'all') postsParams.append('platform', platform);
    if (fromDate) postsParams.append('dateFrom', fromDate);
    if (toDate) postsParams.append('dateTo', toDate);
    postsParams.append('limit', '50');

    const postsResult = await late.call<{ posts?: unknown[]; data?: unknown[] }>({ endpoint: `/posts?${postsParams}`, method: 'GET' });
    if (!postsResult.error) {
      const published = (postsResult.data?.posts ?? postsResult.data?.data ?? []) as Record<string, unknown>[];
      if (published.length > 0) {
        postAnalyticsSource = 'postId_enriched';
        const limited = published.slice(0, 50);
        const enriched: Record<string, unknown>[] = [];
        const batchSize = 5;
        for (let i = 0; i < limited.length; i += batchSize) {
          const batch = limited.slice(i, i + batchSize);
          const batchResults = await Promise.all(batch.map(async (post) => {
            const latePostId = String(post._id ?? post.id ?? '');
            if (!latePostId) return post;
            const single = await late.call<{ analytics?: unknown; platformAnalytics?: unknown[] }>({
              endpoint: `/analytics?postId=${encodeURIComponent(latePostId)}`,
              method: 'GET',
              timeoutMs: 12_000,
            });
            if (single.error || !single.data) return post;
            return { ...post, analytics: single.data.analytics ?? {}, platformAnalytics: single.data.platformAnalytics ?? [] };
          }));
          enriched.push(...batchResults);
        }
        postAnalytics = enriched.map((p) => normalize(p, accounts));
      }
    }
  }

  const aggregated = aggregate(followerStats, postAnalytics);
  const topPosts = [...postAnalytics].sort((a, b) => b.engagement - a.engagement).slice(0, 12);

  log.info('analytics_assembled', {
    accounts: accounts.length, posts: postAnalytics.length, source: postAnalyticsSource,
  });

  return jsonResponse({
    client: { name: client.business_name, logoUrl: client.brand_logo_url },
    accounts: accounts.map((a) => ({
      id: a.id,
      platform: String(a.platform ?? a.provider ?? '').toLowerCase(),
      username: str(a.username, a.handle),
      profilePictureUrl: a.profilePicture ?? a.avatarUrl ?? a.profile_picture_url ?? null,
      followers: num(a.followersCount, a.followers),
    })),
    followerStats,
    postAnalytics,
    aggregatedMetrics: aggregated.metrics,
    platformBreakdown: Object.values(aggregated.platformBreakdown),
    topPosts,
    hasAnalyticsAccess,
    analyticsNotEnabled: followerBlocked,
    postAnalyticsSource,
    profileIdUsed: client.late_profile_id ?? null,
    dateRange: { from: fromDate, to: toDate },
    fetchedAt: new Date().toISOString(),
  });
}));

async function fetchFollowerStats(
  late: LateClient,
  profileId: string | null,
  accountIds: string,
  fromDate: string | null,
  toDate: string | null,
  accounts: Account[],
  log: Logger,
): Promise<{ followerStats: FollowerStat[]; analyticsNotEnabled: boolean }> {
  const params = new URLSearchParams();
  if (profileId) params.append('profileId', profileId);
  params.append('accountIds', accountIds);
  if (fromDate) params.append('fromDate', fromDate);
  if (toDate) params.append('toDate', toDate);
  params.append('granularity', 'daily');
  const result = await late.call<{ currentFollowers?: Record<string, number>; stats?: Record<string, Array<{ date: string; followers?: number; count?: number }>> }>({
    endpoint: `/accounts/follower-stats?${params}`, method: 'GET',
  });
  if (result.error && result.status === 403) return { followerStats: [], analyticsNotEnabled: true };
  if (result.error) {
    log.warn('follower_stats_failed', { error: result.error });
    return {
      followerStats: accounts.map((a) => ({
        accountId: a.id,
        platform: str(a.platform, a.provider),
        username: str(a.username, a.handle),
        current_followers: num(a.followersCount, a.followers),
        follower_history: [],
      })),
      analyticsNotEnabled: false,
    };
  }
  const currentFollowers = result.data?.currentFollowers ?? {};
  const statsData = result.data?.stats ?? {};
  return {
    followerStats: accounts.map((a) => ({
      accountId: a.id,
      platform: str(a.platform, a.provider),
      username: str(a.username, a.handle),
      current_followers: currentFollowers[a.id] ?? num(a.followersCount, a.followers),
      follower_history: (statsData[a.id] ?? []).map((h) => ({ date: h.date, count: num(h.followers, h.count) })),
    })),
    analyticsNotEnabled: false,
  };
}

function normalize(post: Record<string, unknown>, accounts: Account[]): PostMetric {
  const analytics = (post.analytics as Record<string, unknown> | undefined) ?? {};
  const platformAnalyticsArr = (post.platformAnalytics as Array<Record<string, unknown>> | undefined) ?? [];
  const platformAnalytics = (platformAnalyticsArr[0] ?? {}) as Record<string, unknown>;
  const paAnalytics = (platformAnalytics.analytics as Record<string, unknown> | undefined) ?? {};

  const platformsArray = (post.platforms as Array<Record<string, unknown>> | undefined) ?? [];
  const firstPlatformEntry = (platformsArray[0] ?? {}) as Record<string, unknown>;
  const accountFromPlatform = (firstPlatformEntry.accountId as Record<string, unknown> | undefined) ?? {};

  const postPlatform = String(
    platformAnalytics.platform ?? firstPlatformEntry.platform ?? post.platform ?? post.provider ?? 'unknown',
  ).toLowerCase();

  const matching = accounts.find((acc) =>
    acc.id === post.accountId ||
    acc.id === platformAnalytics.accountId ||
    acc.id === accountFromPlatform._id ||
    acc.id === accountFromPlatform.id,
  );

  const username = str(
    platformAnalytics.accountUsername,
    accountFromPlatform.username, accountFromPlatform.handle,
    matching?.username, matching?.handle,
  );

  const views = num(paAnalytics.views, analytics.views, post.views);
  const impressions = num(paAnalytics.impressions, analytics.impressions, post.impressions, views);
  const reach = num(paAnalytics.reach, analytics.reach, post.reach);
  const likes = num(paAnalytics.likes, analytics.likes, post.likeCount, post.likes);
  const comments = num(paAnalytics.comments, analytics.comments, post.commentCount, post.comments);
  const shares = num(paAnalytics.shares, analytics.shares, post.reposts, post.retweets, post.shares);
  const saves = num(paAnalytics.saves, analytics.saves, post.bookmarks, post.saves);
  const clicks = num(paAnalytics.clicks, analytics.clicks, post.linkClicks, post.clicks);
  const engagement = num(paAnalytics.engagement, analytics.engagement) || (likes + comments + shares + saves);
  const engagementRate = num(paAnalytics.engagementRate, analytics.engagementRate);

  const mediaItems = (post.mediaItems as Array<Record<string, unknown>> | undefined) ?? (post.media as Array<Record<string, unknown>> | undefined) ?? [];
  const firstMedia = (mediaItems[0] ?? {}) as Record<string, unknown>;
  const thumbnailUrl = str(post.thumbnailUrl, firstMedia.thumbnailUrl, firstMedia.url, platformAnalytics.thumbnailUrl, post.mediaUrl, post.imageUrl);
  const mediaUrl = str(post.mediaUrl, firstMedia.url, firstMedia.thumbnailUrl, post.thumbnailUrl);
  const platformPostUrl = str(post.platformPostUrl, firstPlatformEntry.platformPostUrl, platformAnalytics.platformPostUrl, post.url);

  return {
    id: String(post._id ?? post.id ?? post.postId ?? ''),
    caption: str(post.content, post.caption, post.text),
    posted_at: (post.publishedAt as string | undefined) ?? (post.postedAt as string | undefined) ?? (post.createdAt as string | undefined) ?? null,
    platform: postPlatform,
    accountId: str(post.accountId, platformAnalytics.accountId, accountFromPlatform._id),
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
    thumbnail_url: thumbnailUrl,
    media_url: mediaUrl,
    thumbnailUrl,
    mediaUrl,
    platform_post_url: platformPostUrl,
    platformPostUrl,
  };
}

interface AggregateResult {
  metrics: { totalFollowers: number; totalPosts: number; totalImpressions: number; totalReach: number; totalLikes: number; totalComments: number; totalShares: number; totalClicks: number; averageEngagementRate: number };
  platformBreakdown: Record<string, { platform: string; followers: number; impressions: number; engagement: number; posts: number }>;
}

function aggregate(followerStats: FollowerStat[], posts: PostMetric[]): AggregateResult {
  const metrics = { totalFollowers: 0, totalPosts: posts.length, totalImpressions: 0, totalReach: 0, totalLikes: 0, totalComments: 0, totalShares: 0, totalClicks: 0, averageEngagementRate: 0 };
  const platformBreakdown: AggregateResult['platformBreakdown'] = {};
  const ensure = (p: string) => {
    platformBreakdown[p] ??= { platform: p, followers: 0, impressions: 0, engagement: 0, posts: 0 };
    return platformBreakdown[p];
  };
  for (const s of followerStats) {
    metrics.totalFollowers += s.current_followers;
    ensure((s.platform || 'unknown').toLowerCase()).followers += s.current_followers;
  }
  for (const p of posts) {
    metrics.totalImpressions += p.impressions;
    metrics.totalReach += p.reach;
    metrics.totalLikes += p.likes;
    metrics.totalComments += p.comments;
    metrics.totalShares += p.shares;
    metrics.totalClicks += p.clicks;
    const bucket = ensure((p.platform || 'unknown').toLowerCase());
    bucket.impressions += p.impressions;
    bucket.engagement += p.engagement;
    bucket.posts += 1;
  }
  if (metrics.totalImpressions > 0) {
    const totalEngagements = metrics.totalLikes + metrics.totalComments + metrics.totalShares;
    metrics.averageEngagementRate = (totalEngagements / metrics.totalImpressions) * 100;
  }
  return { metrics, platformBreakdown };
}

function emptyResponse(client: { business_name: string | null; brand_logo_url: string | null }, hasAnalyticsAccess: boolean, fromDate: string | null, toDate: string | null) {
  return {
    client: { name: client.business_name, logoUrl: client.brand_logo_url },
    accounts: [], followerStats: [], postAnalytics: [],
    aggregatedMetrics: { totalFollowers: 0, totalPosts: 0, totalImpressions: 0, totalReach: 0, totalLikes: 0, totalComments: 0, totalShares: 0, totalClicks: 0, averageEngagementRate: 0 },
    platformBreakdown: [], topPosts: [],
    hasAnalyticsAccess, noAccountsFound: true,
    dateRange: { from: fromDate, to: toDate },
    fetchedAt: new Date().toISOString(),
  };
}
