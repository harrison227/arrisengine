import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';

interface PostAnalyticsItem {
  posted_at?: string;
  publishedAt?: string;
  postedAt?: string;
  createdAt?: string;
  views?: number;
  impressions?: number;
  analytics?: PostAnalyticsItem | PostAnalyticsItem[];
  [key: string]: unknown;
}

interface ImpressionsChartProps {
  postAnalytics: PostAnalyticsItem[];
}

export function ImpressionsChart({ postAnalytics }: ImpressionsChartProps) {
  // Aggregate views by date across all platforms
  const dateMap = new Map<string, number>();

  postAnalytics.forEach((item) => {
    // Handle nested format: { accountId, platform, analytics: [...] }
    if (item.analytics && Array.isArray(item.analytics)) {
      item.analytics.forEach((post: PostAnalyticsItem) => {
        const dateStr = post.posted_at || post.publishedAt || post.postedAt || post.createdAt;
        const views = post.views || post.impressions || post.analytics?.views || post.analytics?.impressions || 0;
        if (dateStr && views) {
          const dateKey = dateStr.split('T')[0];
          dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + views);
        }
      });
    }
    // Handle flat format: { id, posted_at, impressions, views, ... }
    else {
      const dateStr = item.posted_at || item.publishedAt || item.postedAt || item.createdAt;
      const views = item.views || item.impressions || item.analytics?.views || item.analytics?.impressions || 0;
      if (dateStr && views) {
        const dateKey = dateStr.split('T')[0];
        dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + views);
      }
    }
  });

  const chartData = Array.from(dateMap.entries())
    .map(([date, impressions]) => ({
      date,
      impressions,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const chartConfig = {
    impressions: {
      label: 'Views',
      color: 'hsl(217, 91%, 60%)',
    },
  };

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Total Views</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          No views data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Total Views</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradient-impressions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(parseISO(value), 'MMM d')}
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={(value) => {
                if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                return value.toString();
              }}
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="impressions"
              stroke="hsl(217, 91%, 60%)"
              fill="url(#gradient-impressions)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
