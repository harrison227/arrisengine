import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Eye, Heart, MessageCircle, Share2, Sparkles, Trophy, TrendingDown, ExternalLink,
  Linkedin, Twitter, Instagram, Youtube, Facebook 
} from 'lucide-react';
import { format, parseISO, subDays, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';

interface TopPost {
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
  platform_post_url?: string;
  platformPostUrl?: string;
}

interface Account {
  platform: string;
  username: string;
}

interface TopPerformersSectionProps {
  clientId: string;
  clientName: string;
  topPosts: TopPost[];
  accounts: Account[];
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  facebook: 'bg-blue-600/10 text-blue-600 border-blue-600/20',
  linkedin: 'bg-blue-700/10 text-blue-700 border-blue-700/20',
  youtube: 'bg-red-600/10 text-red-600 border-red-600/20',
  twitter: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
  tiktok: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  threads: 'bg-foreground/10 text-foreground border-foreground/20',
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram className="w-4 h-4" />,
  facebook: <Facebook className="w-4 h-4" />,
  linkedin: <Linkedin className="w-4 h-4" />,
  youtube: <Youtube className="w-4 h-4" />,
  twitter: <Twitter className="w-4 h-4" />,
  tiktok: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  ),
  threads: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.028-3.576.878-6.43 2.523-8.483C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.332-3.023.85-.706 2.017-1.115 3.382-1.188 1.073-.057 2.099.053 3.07.328-.021-.848-.143-1.56-.364-2.134-.349-.907-1.01-1.358-2.02-1.378-.746.014-1.357.218-1.816.607-.41.349-.666.833-.76 1.44l-2.087-.29c.16-1.088.622-1.975 1.373-2.636.86-.758 2.005-1.157 3.307-1.152 1.713.034 3.016.67 3.874 1.892.67.955.984 2.247 1.03 4.226.02.184.028.373.028.568 0 .157-.005.31-.013.458a8.372 8.372 0 0 1 1.065.453c1.167.596 2.047 1.478 2.543 2.553.655 1.418.778 3.395-.477 5.623-1.265 2.246-3.378 3.576-6.287 3.958-.39.051-.79.077-1.199.077Zm-.515-9.154c-1.017.053-1.827.335-2.347.819-.44.409-.636.883-.602 1.45.034.567.292 1.035.768 1.392.515.388 1.21.585 2.007.539 1.08-.058 1.925-.463 2.508-1.204.457-.582.749-1.368.87-2.344-.74-.18-1.514-.289-2.31-.289-.3 0-.598.013-.894.037Z"/>
    </svg>
  ),
};

// Text-based platforms
const TEXT_PLATFORMS = ['linkedin', 'threads', 'twitter'];

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString();
}

function calculatePerformanceScore(post: TopPost): number {
  return (
    (post.impressions || 0) * 0.3 +
    (post.likes || 0) * 0.25 +
    (post.comments || 0) * 0.25 +
    (post.shares || 0) * 0.2
  );
}

export function TopPerformersSection({ clientId, clientName, topPosts, accounts }: TopPerformersSectionProps) {
  const navigate = useNavigate();
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [sortMode, setSortMode] = useState<'best' | 'worst'>('best');

  // Filter posts from last 60 days
  const recentPosts = useMemo(() => {
    const sixtyDaysAgo = subDays(new Date(), 60);
    return topPosts.filter(post => {
      if (!post.posted_at) return true; // Include posts without dates
      try {
        return isAfter(parseISO(post.posted_at), sixtyDaysAgo);
      } catch {
        return true;
      }
    });
  }, [topPosts]);

  // Get unique platforms from connected accounts (not from posts)
  const availablePlatforms = useMemo(() => {
    const platforms = new Set(accounts.map(a => a.platform.toLowerCase()));
    return Array.from(platforms);
  }, [accounts]);

  // Filter by selected platform and sort by performance score
  const filteredPosts = useMemo(() => {
    // Enrich posts with platform from accounts if missing
    let posts = recentPosts.map(post => {
      if (post.platform && post.platform !== 'unknown') return post;
      
      // Try to infer platform from username matching accounts
      const matchingAccount = accounts.find(a => 
        a.username && post.username && 
        a.username.toLowerCase() === post.username.toLowerCase()
      );
      if (matchingAccount) {
        return { ...post, platform: matchingAccount.platform.toLowerCase() };
      }
      return post;
    });
    
    if (selectedPlatform !== 'all') {
      posts = posts.filter(p => (p.platform || '').toLowerCase() === selectedPlatform);
    }
    
    return posts
      .map(post => ({ ...post, score: calculatePerformanceScore(post) }))
      .sort((a, b) => sortMode === 'best' ? b.score - a.score : a.score - b.score)
      .slice(0, 5);
  }, [recentPosts, selectedPlatform, accounts, sortMode]);

  // Determine which text platform to use for content generation
  const getTargetPlatform = (): 'linkedin' | 'twitter' | 'threads' | null => {
    if (selectedPlatform !== 'all' && TEXT_PLATFORMS.includes(selectedPlatform)) {
      return selectedPlatform as 'linkedin' | 'twitter' | 'threads';
    }
    // Default to linkedin if available, otherwise threads, otherwise twitter
    if (availablePlatforms.includes('linkedin')) return 'linkedin';
    if (availablePlatforms.includes('threads')) return 'threads';
    if (availablePlatforms.includes('twitter')) return 'twitter';
    // Fallback to linkedin for non-text platforms
    return 'linkedin';
  };

  const handleCreateIdeas = () => {
    const targetPlatform = getTargetPlatform();
    if (!targetPlatform) return;

    // Get top 5 posts for what worked
    const topPostsContext = recentPosts
      .map(p => ({ ...p, score: calculatePerformanceScore(p) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(p => ({
        caption: p.caption?.slice(0, 300),
        impressions: p.impressions || 0,
        likes: p.likes || 0,
        comments: p.comments || 0,
        shares: p.shares || 0,
        platform: p.platform,
      }));

    // Get worst 5 posts for what to avoid
    const worstPostsContext = recentPosts
      .map(p => ({ ...p, score: calculatePerformanceScore(p) }))
      .sort((a, b) => a.score - b.score) // Ascending = worst first
      .slice(0, 5)
      .map(p => ({
        caption: p.caption?.slice(0, 300),
        impressions: p.impressions || 0,
        likes: p.likes || 0,
        comments: p.comments || 0,
        shares: p.shares || 0,
        platform: p.platform,
      }));

    // Persist deep-link payload (dev StrictMode-safe) then navigate
    try {
      sessionStorage.setItem(
        'contentPlanner:pendingDeepLink',
        JSON.stringify({
          clientId,
          platform: targetPlatform,
          topPostsContext,
          worstPostsContext,
          createdAt: Date.now(),
        })
      );
    } catch {
      // ignore storage errors (private mode, blocked storage, etc.)
    }

    navigate('/content-planner', {
      state: {
        clientId,
        platform: targetPlatform,
        topPostsContext,
        worstPostsContext,
      },
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Select value={sortMode} onValueChange={(v) => setSortMode(v as 'best' | 'worst')}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="best">
                  <span className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    Top Performers
                  </span>
                </SelectItem>
                <SelectItem value="worst">
                  <span className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-destructive" />
                    Worst Performers
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <CardTitle className="text-lg">(Last 60 Days)</CardTitle>
          </div>
          <Button onClick={handleCreateIdeas} size="sm" className="gap-2">
            <Sparkles className="w-4 h-4" />
            Create 5 New Ideas
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Platform Tabs */}
        <Tabs value={selectedPlatform} onValueChange={setSelectedPlatform}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="all" className="text-xs">
              All
            </TabsTrigger>
            {availablePlatforms.map(platform => (
              <TabsTrigger key={platform} value={platform} className="text-xs gap-1.5">
                {PLATFORM_ICONS[platform]}
                <span className="capitalize">{platform}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Top 5 Posts Grid */}
        {filteredPosts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No Post Analytics Yet</p>
            <p className="text-sm mt-1">
              Analytics will appear once posts are published and synced.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {filteredPosts.map((post, index) => {
              const postUrl = post.platform_post_url || post.platformPostUrl;
              const isTextPlatform = TEXT_PLATFORMS.includes((post.platform || '').toLowerCase());
              
              return (
                <div
                  key={post.id || index}
                  className={cn(
                    "border border-border rounded-lg overflow-hidden transition-shadow bg-card",
                    postUrl ? "hover:shadow-md cursor-pointer" : ""
                  )}
                  onClick={() => {
                    if (postUrl) {
                      window.open(postUrl, '_blank', 'noopener,noreferrer');
                    }
                  }}
                >
                  {/* Post Image or Text Preview */}
                  <div className="aspect-square bg-muted relative">
                    {(() => {
                      // Handle both snake_case and camelCase field names
                      const thumbnailUrl = post.thumbnail_url || (post as any).thumbnailUrl;
                      const mediaUrl = post.media_url || (post as any).mediaUrl;
                      const imageUrl = thumbnailUrl || mediaUrl;
                      
                      // For text platforms, always show text preview
                      if (isTextPlatform || !imageUrl) {
                        return (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground p-3 overflow-hidden">
                            <p className="text-xs text-center line-clamp-6">
                              {post.caption?.slice(0, 200) || 'No content'}
                            </p>
                          </div>
                        );
                      }
                      
                      return (
                        <img
                          src={imageUrl}
                          alt="Post thumbnail"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      );
                    })()}
                    {/* Rank Badge */}
                    <div className={cn(
                      "absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                      sortMode === 'best' && index === 0 
                        ? "bg-yellow-500 text-yellow-950" 
                        : sortMode === 'worst' && index === 0
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-primary text-primary-foreground"
                    )}>
                      {sortMode === 'best' && index === 0 ? <Trophy className="w-4 h-4" /> : 
                       sortMode === 'worst' && index === 0 ? <TrendingDown className="w-4 h-4" /> : 
                       index + 1}
                    </div>
                    {/* Platform Badge */}
                    <Badge
                      variant="outline"
                      className={cn(
                        "absolute top-2 right-2 capitalize text-xs gap-1",
                        PLATFORM_COLORS[(post.platform || '').toLowerCase()]
                      )}
                    >
                      {PLATFORM_ICONS[(post.platform || '').toLowerCase()]}
                    </Badge>
                    {/* External Link Indicator */}
                    {postUrl && (
                      <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1">
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Post Details */}
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-muted-foreground">@{post.username}</p>
                    {post.caption && (
                      <p className="text-xs line-clamp-2">{post.caption}</p>
                    )}
                    {post.posted_at && (
                      <p className="text-[10px] text-muted-foreground">
                        {format(parseISO(post.posted_at), 'MMM d, yyyy')}
                      </p>
                    )}

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className="flex items-center gap-1 p-1.5 bg-muted/50 rounded">
                        <Eye className="w-3 h-3 text-muted-foreground" />
                        <span className="font-medium">{formatNumber(post.impressions || 0)}</span>
                      </div>
                      <div className="flex items-center gap-1 p-1.5 bg-muted/50 rounded">
                        <Heart className="w-3 h-3 text-destructive" />
                        <span className="font-medium">{formatNumber(post.likes || 0)}</span>
                      </div>
                      <div className="flex items-center gap-1 p-1.5 bg-muted/50 rounded">
                        <MessageCircle className="w-3 h-3 text-blue-500" />
                        <span className="font-medium">{formatNumber(post.comments || 0)}</span>
                      </div>
                      <div className="flex items-center gap-1 p-1.5 bg-muted/50 rounded">
                        <Share2 className="w-3 h-3 text-primary" />
                        <span className="font-medium">{formatNumber(post.shares || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
