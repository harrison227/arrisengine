import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useClients } from '@/hooks/useClients';
import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function MRRChart() {
  const { clients, isLoading } = useClients();

  const chartData = useMemo(() => {
    if (!clients.length) return [];
    
    // Calculate total MRR from active clients
    const totalMRR = clients
      .filter(c => c.status === 'active')
      .reduce((sum, c) => sum + Number(c.mrr), 0);
    
    // Generate last 6 months based on current date
    const months: { month: string; mrr: number }[] = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short' });
      
      // Calculate MRR for each month based on contract_start dates
      // End of the month we're checking
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const monthMRR = clients
        .filter(c => {
          if ((c as { is_personal?: boolean }).is_personal) return false;
          if (c.status !== 'active' && c.status !== 'onboarding') return false;
          // If no contract_start, include the client
          if (!c.contract_start) return true;
          const contractStart = new Date(c.contract_start);
          // Client is included if their contract started on or before the end of this month
          return contractStart <= endOfMonth;
        })
        .reduce((sum, c) => sum + Number(c.mrr), 0);
      
      months.push({ month: monthLabel, mrr: monthMRR });
    }
    
    return months;
  }, [clients]);

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-4 w-48 mb-6" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">MRR Trend</h3>
            <p className="text-sm text-muted-foreground">Monthly recurring revenue over time</p>
          </div>
        </div>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          No client data yet
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm animate-slide-up" style={{ animationDelay: '0.1s' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">MRR Trend</h3>
          <p className="text-sm text-muted-foreground">Monthly recurring revenue over time</p>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(220, 13%, 91%)',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              labelStyle={{ color: 'hsl(224, 71%, 4%)' }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, 'MRR']}
            />
            <Area 
              type="monotone" 
              dataKey="mrr" 
              stroke="hsl(217, 91%, 60%)" 
              strokeWidth={2}
              fill="url(#mrrGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
