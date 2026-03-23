import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Area, AreaChart } from 'recharts';
import { format, parseISO } from 'date-fns';

interface FollowerGrowthChartProps {
  followerStats: Array<{
    platform: string;
    username: string;
    follower_history?: Array<{ date: string; count: number }>;
  }>;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'hsl(340, 82%, 52%)',
  facebook: 'hsl(214, 89%, 52%)',
  linkedin: 'hsl(210, 88%, 46%)',
  youtube: 'hsl(0, 100%, 50%)',
  twitter: 'hsl(203, 89%, 53%)',
  tiktok: 'hsl(0, 0%, 0%)',
};

export function FollowerGrowthChart({ followerStats }: FollowerGrowthChartProps) {
  // Combine all follower histories into a unified dataset
  const dateMap = new Map<string, Record<string, number>>();

  followerStats.forEach((stat) => {
    if (stat.follower_history) {
      stat.follower_history.forEach((entry) => {
        const dateKey = entry.date;
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, {});
        }
        dateMap.get(dateKey)![stat.platform] = entry.count;
      });
    }
  });

  const chartData = Array.from(dateMap.entries())
    .map(([date, platforms]) => ({
      date,
      ...platforms,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const platforms = [...new Set(followerStats.map((s) => s.platform))];

  const chartConfig = platforms.reduce((acc, platform) => {
    acc[platform] = {
      label: platform.charAt(0).toUpperCase() + platform.slice(1),
      color: PLATFORM_COLORS[platform] || 'hsl(var(--primary))',
    };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Follower Growth</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          No follower history data available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Follower Growth</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              {platforms.map((platform) => (
                <linearGradient key={platform} id={`gradient-${platform}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PLATFORM_COLORS[platform]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={PLATFORM_COLORS[platform]} stopOpacity={0} />
                </linearGradient>
              ))}
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
            {platforms.map((platform) => (
              <Area
                key={platform}
                type="monotone"
                dataKey={platform}
                stroke={PLATFORM_COLORS[platform]}
                fill={`url(#gradient-${platform})`}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
