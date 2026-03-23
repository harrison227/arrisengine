import { Card, CardContent } from '@/components/ui/card';
import { Users, Eye, MousePointer, TrendingUp, Heart, MessageCircle, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OverviewCardsProps {
  metrics: {
    totalFollowers: number;
    totalImpressions: number;
    totalReach: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalClicks: number;
    averageEngagementRate: number;
  };
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

const metricCards = [
  { key: 'totalFollowers', label: 'Total Followers', icon: Users, color: 'text-primary' },
  { key: 'totalImpressions', label: 'Total Views', icon: Eye, color: 'text-accent' },
  { key: 'totalReach', label: 'Total Reach', icon: TrendingUp, color: 'text-success' },
  { key: 'averageEngagementRate', label: 'Engagement Rate', icon: Heart, color: 'text-destructive', isPercentage: true },
];

const engagementCards = [
  { key: 'totalLikes', label: 'Likes', icon: Heart, color: 'text-destructive' },
  { key: 'totalComments', label: 'Comments', icon: MessageCircle, color: 'text-accent' },
  { key: 'totalShares', label: 'Shares', icon: Share2, color: 'text-primary' },
  { key: 'totalClicks', label: 'Clicks', icon: MousePointer, color: 'text-success' },
];

export function AnalyticsOverviewCards({ metrics }: OverviewCardsProps) {
  const noEngagementData = 
    metrics.totalImpressions === 0 && 
    metrics.totalLikes === 0 && 
    metrics.totalComments === 0 &&
    metrics.totalShares === 0;

  return (
    <div className="space-y-6">
      {noEngagementData && (
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 text-center">
          Post analytics will appear once posts are published and synced
        </div>
      )}
      {/* Main Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card) => {
          const value = metrics[card.key as keyof typeof metrics];
          const displayValue = card.isPercentage 
            ? `${(value as number).toFixed(2)}%` 
            : formatNumber(value as number);
          
          return (
            <Card key={card.key} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                    <p className="text-2xl font-bold mt-1">{displayValue}</p>
                  </div>
                  <div className={cn("p-3 rounded-xl bg-muted/50", card.color)}>
                    <card.icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Engagement Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {engagementCards.map((card) => {
          const value = metrics[card.key as keyof typeof metrics];
          
          return (
            <Card key={card.key} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg bg-muted/50", card.color)}>
                    <card.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className="text-lg font-semibold">{formatNumber(value as number)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
