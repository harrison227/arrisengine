import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, Heart, MessageCircle, Share2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface TopPostsGridProps {
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
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-500/10 text-pink-500',
  facebook: 'bg-blue-600/10 text-blue-600',
  linkedin: 'bg-blue-700/10 text-blue-700',
  youtube: 'bg-red-600/10 text-red-600',
  twitter: 'bg-sky-500/10 text-sky-500',
  tiktok: 'bg-purple-500/10 text-purple-500',
  threads: 'bg-neutral-500/10 text-neutral-500',
};

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString();
}

export function TopPostsGrid({ topPosts }: TopPostsGridProps) {
  if (topPosts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Performing Posts</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground py-8">
          No post analytics available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Top Performing Posts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {topPosts.slice(0, 9).map((post, index) => (
            <div
              key={post.id || index}
              className="border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Post Image */}
              <div className="aspect-square bg-muted relative">
                {(() => {
                  // Handle both snake_case and camelCase field names
                  const thumbnailUrl = post.thumbnail_url || (post as any).thumbnailUrl;
                  const mediaUrl = post.media_url || (post as any).mediaUrl;
                  const imageUrl = thumbnailUrl || mediaUrl;
                  
                  return imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Post thumbnail"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      No preview
                    </div>
                  );
                })()}
                {/* Rank Badge */}
                <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>
                {/* Platform Badge */}
                <Badge
                  variant="secondary"
                  className={cn(
                    "absolute top-2 right-2 capitalize text-xs",
                    PLATFORM_COLORS[(post.platform || '').toLowerCase()]
                  )}
                >
                  {post.platform || 'unknown'}
                </Badge>
              </div>

              {/* Post Details */}
              <div className="p-3">
                <p className="text-xs text-muted-foreground mb-1">@{post.username}</p>
                {post.caption && (
                  <p className="text-sm line-clamp-2 mb-3">{post.caption}</p>
                )}
                {post.posted_at && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {format(parseISO(post.posted_at), 'MMM d, yyyy')}
                  </p>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-4 gap-1 text-xs">
                  <div className="flex flex-col items-center p-1.5 bg-muted/50 rounded">
                    <Eye className="w-3 h-3 text-muted-foreground mb-0.5" />
                    <span className="font-medium">{formatNumber(post.impressions || 0)}</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 bg-muted/50 rounded">
                    <Heart className="w-3 h-3 text-destructive mb-0.5" />
                    <span className="font-medium">{formatNumber(post.likes || 0)}</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 bg-muted/50 rounded">
                    <MessageCircle className="w-3 h-3 text-accent mb-0.5" />
                    <span className="font-medium">{formatNumber(post.comments || 0)}</span>
                  </div>
                  <div className="flex flex-col items-center p-1.5 bg-muted/50 rounded">
                    <Share2 className="w-3 h-3 text-primary mb-0.5" />
                    <span className="font-medium">{formatNumber(post.shares || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
