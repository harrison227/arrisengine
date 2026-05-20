/**
 * Public analytics fetcher backing the shared analytics dashboard.
 *
 * Talks to Late.is on the client's behalf using the per-client API key.
 * Aggregates follower stats, post analytics, and per-platform breakdowns
 * into a single response.
 *
 * Contract preserved:
 *   Request:  { shareId, fromDate?, toDate? }
 *   Response: { client, accounts, followerStats, postAnalytics,
 *               aggregatedMetrics, platformBreakdown, topPosts, ... }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { badRequest, notFound, forbidden } from '../_shared/errors.ts';
import { ensureNonEmptyString, ensureOptionalString } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { LateClient } from '../_shared/late.ts';
import type { Logger } from '../_shared/logger.ts';

interface RequestBody {
  shareId: unknown;
  fromDate?: unknown;
  toDate?: unknown;
}

type Account = Record<string, unknown> & { id: string; platform?: string; provider?: string; username?: string; handle?: string };

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
  thumbnailUrl: string | null;
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

Deno.serve(withErrorHandling({ fn: 'public-analytics-fetch' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const shareId = ensureNonEmptyString('shareId', body.shareId, 200);
  const fromDate = ensureOptionalString('fromDate', body.fromDate, 100);
  const toDate = ensureOptionalString('toDate', body.toDate, 100);

  const supabase = getSupabaseAdmin();

  // Resolve share link.
  const { data: shareLink } = await supabase
    .from('analytics_share_links')
    .select('*')
    .eq('share_id', shareId)
    .eq('is_active', true)
    .maybeSingle();
  if (!shareLink) throw notFound('Invalid or expired share link');
  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
    throw forbidden('Share link has expired');
  }

  // Resolve client + Late credentials.
  const { data: client } = await supabase
    .from('clients')
    .select('id, business_name, brand_logo_url, brand_primary_color, late_api_key, late_profile_id')
    .eq('id', shareLink.client_id)
    .maybeSingle();
  if (!client) throw notFound('Client not found');
  if (!client.late_api_key) throw badRequest('Late not connected for this client');

  const late = new LateClient(client.late_api_key);
  const effectiveFromDate = fromDate ?? shareLink.date_range_start;
  const effectiveToDate = toDate ?? shareLink.date_range_end;

  const accountsBundle = await fetchAccounts({ late, profileId: client.late_profile_id, log });
  let { accounts } = accountsBundle;
  const { hasAnalyticsAccess } = accountsBundle;

  if (Array.isArray(shareLink.platforms) && shareLink.platforms.length > 0) {
    accounts = accounts.filter((a) => (shareLink.platforms as string[]).includes(String(a.platform ?? a.provider ?? '')));
  }

  if (accounts.length === 0) {
    return jsonResponse(emptyResponse(client, hasAnalyticsAccess, effectiveFromDate, effectiveToDate));
  }

  const accountIds = accounts.map((a) => a.id).join(',');

  const { followerStats, analyticsNotEnabled: followerAnalyticsBlocked } = await fetchFollowerStats({
    late, profileId: client.late_profile_id, accountIds, fromDate: effectiveFromDate, toDate: effectiveToDate, accounts, log,
  });

  const { postAnalytics, analyticsNotEnabled: postAnalyticsBlocked } = await fetchPostAnalytics({
    late, profileId: client.late_profile_id, fromDate: effectiveFromDate, toDate: effectiveToDate, log,
  });

  const analyticsNotEnabled = followerAnalyticsBlocked || postAnalyticsBlocked;
  const aggregated = aggregate(followerStats, postAnalytics);
  const topPosts = [...postAnalytics].sort((a, b) => b.engagement - a.engagement).slice(0, 12);

  log.info('analytics_assembled', {
    accounts: accounts.length, posts: postAnalytics.length, hasAnalyticsAccess,
  });

  return jsonResponse({
    client: { name: client.business_name, logoUrl: client.brand_logo_url, primaryColor: client.brand_primary_color },
    accounts: accounts.map((a) => ({
      id: a.id,
      platform: str(a.platform, a.provider),
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
    analyticsNotEnabled,
    dateRange: { from: effectiveFromDate, to: effectiveToDate },
    fetchedAt: new Date().toISOString(),
  });
}));

async function fetchAccounts(args: { late: LateClient; profileId: string | null; log: Logger }): Promise<{ accounts: Account[]; hasAnalyticsAccess: boolean }> {
  const endpoint = args.profileId ? `/accounts?profileId=${encodeURIComponent(args.profileId)}` : '/accounts';
  const result = await args.late.call<{ accounts?: Account[]; data?: Account[]; hasAnalyticsAccess?: boolean }>({ endpoint, method: 'GET' });
  if (result.error) {
    args.log.warn('late_accounts_failed', { error: result.error, status: result.status });
    return { accounts: [], hasAnalyticsAccess: false };
  }
  const raw = result.data?.accounts ?? result.data?.data ?? [];
  return {
    accounts: raw.map((a: Record<string, unknown>) => ({ ...(a as Account), id: String(a._id ?? a.id ?? '') })).filter((a) => a.id),
    hasAnalyticsAccess: Boolean(result.data?.hasAnalyticsAccess),
  };
}

interface FollowerArgs { late: LateClient; profileId: string | null; accountIds: string; fromDate: string | null; toDate: string | null; accounts: Account[]; log: Logger }
async function fetchFollowerStats(args: FollowerArgs): Promise<{ followerStats: FollowerStat[]; analyticsNotEnabled: boolean }> {
  const params = new URLSearchParams();
  if (args.profileId) params.append('profileId', args.profileId);
  params.append('accountIds', args.accountIds);
  if (args.fromDate) params.append('fromDate', args.fromDate);
  if (args.toDate) params.append('toDate', args.toDate);
  params.append('granularity', 'daily');
  const result = await args.late.call<{ currentFollowers?: Record<string, number>; stats?: Record<string, Array<{ date: string; followers?: number; count?: number }>> }>({
    endpoint: `/accounts/follower-stats?${params}`, method: 'GET',
  });

  if (result.error && result.status === 403) return { followerStats: [], analyticsNotEnabled: true };
  if (result.error) {
    args.log.warn('late_follower_stats_failed', { error: result.error });
    return { followerStats: args.accounts.map((a) => baseStat(a)), analyticsNotEnabled: false };
  }
  const currentFollowers = result.data?.currentFollowers ?? {};
  const statsData = result.data?.stats ?? {};
  return {
    followerStats: args.accounts.map((a) => ({
      accountId: a.id,
      platform: str(a.platform, a.provider),
      username: str(a.username, a.handle),
      current_followers: currentFollowers[a.id] ?? num(a.followersCount, a.followers),
      follower_history: (statsData[a.id] ?? []).map((h) => ({ date: h.date, count: num(h.followers, h.count) })),
    })),
    analyticsNotEnabled: false,
  };
}

function baseStat(a: Account): FollowerStat {
  return {
    accountId: a.id,
    platform: str(a.platform, a.provider),
    username: str(a.username, a.handle),
    current_followers: num(a.followersCount, a.followers),
    follower_history: [],
  };
}

interface PostArgs { late: LateClient; profileId: string | null; fromDate: string | null; toDate: string | null; log: Logger }
async function fetchPostAnalytics(args: PostArgs): Promise<{ postAnalytics: PostMetric[]; analyticsNotEnabled: boolean }> {
  const params = new URLSearchParams();
  if (args.profileId) params.append('profileId', args.profileId);
  params.append('platform', 'all');
  if (args.fromDate) params.append('fromDate', args.fromDate);
  if (args.toDate) params.append('toDate', args.toDate);
  params.append('limit', '50');
  params.append('page', '1');
  params.append('sortBy', 'engagement');
  params.append('order', 'desc');

  const result = await args.late.call<{ posts?: unknown[]; data?: unknown[] } | unknown[]>({
    endpoint: `/analytics?${params}`, method: 'GET',
  });
  if (result.error && result.status === 403) return { postAnalytics: [], analyticsNotEnabled: true };
  if (result.error) {
    args.log.warn('late_post_analytics_failed', { error: result.error });
    return { postAnalytics: [], analyticsNotEnabled: false };
  }
  const raw = Array.isArray(result.data) ? result.data : (result.data?.posts ?? result.data?.data ?? []);
  const postAnalytics = (Array.isArray(raw) ? raw : []).map((p) => normalizePost(p as Record<string, unknown>));
  return { postAnalytics, analyticsNotEnabled: false };
}

function normalizePost(post: Record<string, unknown>): PostMetric {
  const analytics = (post.analytics as Record<string, unknown> | undefined) ?? {};
  const views = num(post.views, analytics.views, post.impressions, analytics.impressions);
  const reach = num(post.reach, analytics.reach);
  const likes = num(post.likes, analytics.likes, post.likeCount, analytics.likeCount);
  const comments = num(post.comments, analytics.comments, post.commentCount, analytics.commentCount);
  const shares = num(post.shares, analytics.shares, post.retweets, analytics.retweets, post.reposts, analytics.reposts);
  const saves = num(post.saves, analytics.saves, post.bookmarks, analytics.bookmarks);
  const clicks = num(post.clicks, analytics.clicks, post.linkClicks, analytics.linkClicks);
  const engagement = num(post.engagement, analytics.engagement) || (likes + comments + shares + saves);
  return {
    id: String(post._id ?? post.id ?? post.postId ?? ''),
    caption: str(post.caption, post.content, post.text),
    posted_at: (post.publishedAt as string | undefined) ?? (post.postedAt as string | undefined) ?? (post.createdAt as string | undefined) ?? null,
    platform: str(post.platform, post.provider),
    accountId: str(post.accountId, post.account_id),
    username: str(post.username),
    impressions: views,
    views,
    reach,
    likes,
    comments,
    shares,
    saves,
    clicks,
    engagement,
    engagementRate: num(post.engagementRate, analytics.engagementRate),
    thumbnailUrl: (post.thumbnailUrl as string | undefined) ?? (post.mediaUrl as string | undefined) ?? (post.imageUrl as string | undefined) ?? null,
  };
}

interface AggregateResult {
  metrics: {
    totalFollowers: number; totalPosts: number; totalImpressions: number; totalReach: number;
    totalLikes: number; totalComments: number; totalShares: number; totalClicks: number;
    averageEngagementRate: number;
  };
  platformBreakdown: Record<string, { platform: string; followers: number; impressions: number; engagement: number; posts: number }>;
}

function aggregate(followerStats: FollowerStat[], posts: PostMetric[]): AggregateResult {
  const metrics = {
    totalFollowers: 0, totalPosts: posts.length, totalImpressions: 0, totalReach: 0,
    totalLikes: 0, totalComments: 0, totalShares: 0, totalClicks: 0, averageEngagementRate: 0,
  };
  const platformBreakdown: AggregateResult['platformBreakdown'] = {};
  const ensure = (p: string) => {
    platformBreakdown[p] ??= { platform: p, followers: 0, impressions: 0, engagement: 0, posts: 0 };
    return platformBreakdown[p];
  };
  for (const s of followerStats) {
    metrics.totalFollowers += s.current_followers;
    ensure(s.platform || 'unknown').followers += s.current_followers;
  }
  for (const p of posts) {
    metrics.totalImpressions += p.impressions;
    metrics.totalReach += p.reach;
    metrics.totalLikes += p.likes;
    metrics.totalComments += p.comments;
    metrics.totalShares += p.shares;
    metrics.totalClicks += p.clicks;
    const bucket = ensure(p.platform || 'unknown');
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

function emptyResponse(client: { business_name: string | null; brand_logo_url: string | null; brand_primary_color: string | null }, hasAnalyticsAccess: boolean, fromDate: string | null, toDate: string | null) {
  return {
    client: { name: client.business_name, logoUrl: client.brand_logo_url, primaryColor: client.brand_primary_color },
    accounts: [], followerStats: [], postAnalytics: [],
    aggregatedMetrics: { totalFollowers: 0, totalPosts: 0, totalImpressions: 0, totalReach: 0, totalLikes: 0, totalComments: 0, totalShares: 0, totalClicks: 0, averageEngagementRate: 0 },
    platformBreakdown: [], topPosts: [],
    hasAnalyticsAccess, noAccountsFound: true,
    dateRange: { from: fromDate, to: toDate },
    fetchedAt: new Date().toISOString(),
  };
}
