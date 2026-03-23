import { TrendingUp, TrendingDown, Users, Clock, Target, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAnalytics } from '@/hooks/useAnalytics';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn } from '@/lib/utils';

const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6B7280'];

const stageLabels: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  proposal: 'Proposal',
  negotiating: 'Negotiating',
  won: 'Won',
  lost: 'Lost',
};

export function PipelineAnalyticsCard() {
  const { pipelineAnalytics, isLoading } = useAnalytics();

  if (isLoading || !pipelineAnalytics) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Pipeline Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-64 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const { stageConversions, avgTimeInStage, leadSources, conversionRate, avgDealSize } = pipelineAnalytics;

  // Prepare chart data
  const funnelData = stageConversions
    .filter(s => s.stage !== 'lost')
    .map(s => ({
      name: stageLabels[s.stage] || s.stage,
      count: s.count,
      value: s.value,
    }));

  const sourceData = leadSources.map((s, i) => ({
    name: s.source,
    value: s.count,
    won: s.wonCount,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <Card className="col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Pipeline Analytics
        </CardTitle>
        <CardDescription>Conversion rates and lead source performance</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-3 bg-secondary rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Conversion Rate</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{conversionRate.toFixed(1)}%</p>
          </div>
          <div className="p-3 bg-secondary rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Avg Deal Size</span>
            </div>
            <p className="text-2xl font-bold text-foreground">${avgDealSize.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-secondary rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Total Leads</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {stageConversions.reduce((sum, s) => sum + s.count, 0)}
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-6">
          {/* Funnel Chart */}
          <div>
            <p className="text-sm font-medium text-foreground mb-3">Pipeline Funnel</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={funnelData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number) => [value, 'Leads']}
                  contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Lead Sources */}
          <div>
            <p className="text-sm font-medium text-foreground mb-3">Lead Sources</p>
            {sourceData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie
                      data={sourceData}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={50}
                    >
                      {sourceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1">
                  {sourceData.slice(0, 4).map((source, i) => (
                    <div key={source.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: source.fill }}
                        />
                        <span className="text-foreground">{source.name}</span>
                      </div>
                      <span className="text-muted-foreground">{source.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No lead data yet</p>
            )}
          </div>
        </div>

        {/* Time in Stage */}
        <div className="mt-6">
          <p className="text-sm font-medium text-foreground mb-3">Average Time in Stage</p>
          <div className="flex gap-2">
            {avgTimeInStage.map((stage, i) => (
              <div key={stage.stage} className="flex-1 p-2 bg-secondary rounded-lg text-center">
                <p className="text-lg font-bold text-foreground">{stage.avgDays}d</p>
                <p className="text-xs text-muted-foreground">{stageLabels[stage.stage]}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
