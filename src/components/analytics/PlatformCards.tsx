import { Card, CardContent } from '@/components/ui/card';
import { Instagram, Facebook, Linkedin, Youtube, Twitter } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlatformCardsProps {
  followerStats: Array<{
    platform: string;
    username: string;
    current_followers?: number;
    follower_history?: Array<{ date: string; count: number }>;
  }>;
}

const platformConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  instagram: { icon: Instagram, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
  facebook: { icon: Facebook, color: 'text-blue-600', bgColor: 'bg-blue-600/10' },
  linkedin: { icon: Linkedin, color: 'text-blue-700', bgColor: 'bg-blue-700/10' },
  youtube: { icon: Youtube, color: 'text-red-600', bgColor: 'bg-red-600/10' },
  twitter: { icon: Twitter, color: 'text-sky-500', bgColor: 'bg-sky-500/10' },
  tiktok: { icon: () => <span className="text-lg">🎵</span>, color: 'text-foreground', bgColor: 'bg-muted' },
};

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

function calculateGrowth(history?: Array<{ date: string; count: number }>): number | null {
  if (!history || history.length < 2) return null;
  const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const oldest = sorted[0].count;
  const newest = sorted[sorted.length - 1].count;
  if (oldest === 0) return null;
  return ((newest - oldest) / oldest) * 100;
}

export function PlatformCards({ followerStats }: PlatformCardsProps) {
  if (followerStats.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          No connected social accounts found
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {followerStats.map((stat) => {
        const config = platformConfig[stat.platform] || platformConfig.twitter;
        const Icon = config.icon;
        const growth = calculateGrowth(stat.follower_history);

        return (
          <Card key={stat.platform + stat.username} className="overflow-hidden hover-lift">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={cn("p-2.5 rounded-xl", config.bgColor)}>
                  <Icon className={cn("w-5 h-5", config.color)} />
                </div>
                {growth !== null && (
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    growth >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                  )}>
                    {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                <p className="text-2xl font-bold">
                  {stat.current_followers ? formatNumber(stat.current_followers) : '—'}
                </p>
                <p className="text-xs font-medium text-muted-foreground">
                  Followers
                </p>
                <p className="text-sm text-muted-foreground capitalize mt-1">
                  {stat.platform}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  @{stat.username}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
