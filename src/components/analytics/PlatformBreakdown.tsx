import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface PlatformBreakdownProps {
  platformBreakdown: Array<{
    platform: string;
    followers: number;
    impressions: number;
    engagement: number;
    posts: number;
  }>;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'hsl(340, 82%, 52%)',
  facebook: 'hsl(214, 89%, 52%)',
  linkedin: 'hsl(210, 88%, 46%)',
  youtube: 'hsl(0, 100%, 50%)',
  twitter: 'hsl(203, 89%, 53%)',
  tiktok: 'hsl(280, 70%, 50%)',
  threads: 'hsl(0, 0%, 20%)',
};

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString();
}

export function PlatformBreakdown({ platformBreakdown }: PlatformBreakdownProps) {
  if (platformBreakdown.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Platform Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
          No platform data available
        </CardContent>
      </Card>
    );
  }

  const pieData = platformBreakdown.map((p) => ({
    name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
    value: p.impressions,
    color: PLATFORM_COLORS[p.platform] || 'hsl(var(--primary))',
  }));

  const barData = platformBreakdown.map((p) => ({
    name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
    platform: p.platform,
    engagement: p.engagement,
    impressions: p.impressions,
    posts: p.posts,
  }));

  const chartConfig = {
    engagement: { label: 'Engagement', color: 'hsl(var(--primary))' },
    impressions: { label: 'Impressions', color: 'hsl(var(--accent))' },
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Pie Chart - Impressions by Platform */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Impressions by Platform</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip
                  content={({ payload }) => {
                    if (!payload || !payload[0]) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border rounded-lg p-2 shadow-lg">
                        <p className="font-medium">{data.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatNumber(data.value)} impressions
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {pieData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-muted-foreground">{entry.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bar Chart - Engagement by Platform */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Engagement by Platform</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(value) => formatNumber(value)}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="engagement"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
