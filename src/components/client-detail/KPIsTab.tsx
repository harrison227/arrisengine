import { useState } from 'react';
import { Plus, MoreHorizontal, Trash2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useKPIs } from '@/hooks/useKPIs';
import { AddKPIDialog } from '@/components/dialogs/AddKPIDialog';
import { LogKPIEntryDialog } from '@/components/dialogs/LogKPIEntryDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tables } from '@/integrations/supabase/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

type KPI = Tables<'kpis'>;

interface KPIsTabProps {
  clientId: string;
}

export function KPIsTab({ clientId }: KPIsTabProps) {
  const { kpis, entries, isLoading, deleteKPI } = useKPIs(clientId);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [logEntryKPI, setLogEntryKPI] = useState<KPI | null>(null);
  const [kpiToDelete, setKpiToDelete] = useState<string | null>(null);

  const getEntriesForKPI = (kpiId: string) => {
    return entries
      .filter(e => e.kpi_id === kpiId)
      .sort((a, b) => new Date(a.recorded_date).getTime() - new Date(b.recorded_date).getTime())
      .map(e => ({
        date: new Date(e.recorded_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Number(e.value),
      }));
  };

  const getLatestValue = (kpiId: string) => {
    const kpiEntries = entries.filter(e => e.kpi_id === kpiId);
    if (kpiEntries.length === 0) return null;
    return kpiEntries.sort((a, b) => 
      new Date(b.recorded_date).getTime() - new Date(a.recorded_date).getTime()
    )[0];
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        {[1, 2].map(i => <Skeleton key={i} className="h-64" />)}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">KPI Tracking</h3>
        <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Add KPI
        </Button>
      </div>

      {kpis.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {kpis.map((kpi) => {
            const chartData = getEntriesForKPI(kpi.id);
            const latestEntry = getLatestValue(kpi.id);
            const latestValue = latestEntry ? Number(latestEntry.value) : 0;
            const progress = kpi.target > 0 ? (latestValue / Number(kpi.target)) * 100 : 0;
            
            return (
              <div key={kpi.id} className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-foreground">{kpi.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      Target: {Number(kpi.target).toLocaleString()} {kpi.unit}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setLogEntryKPI(kpi)}>
                        <TrendingUp className="w-4 h-4 mr-2" />
                        Log Entry
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => setKpiToDelete(kpi.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete KPI
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <div className="text-3xl font-bold text-foreground">
                    {latestValue.toLocaleString()}
                  </div>
                  <span className="text-muted-foreground">{kpi.unit}</span>
                  <div className={`text-sm font-medium ${progress >= 100 ? 'text-success' : progress >= 75 ? 'text-warning' : 'text-muted-foreground'}`}>
                    {progress.toFixed(0)}% of target
                  </div>
                </div>

                {chartData.length > 0 ? (
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 10 }} 
                          stroke="hsl(var(--muted-foreground))"
                        />
                        <YAxis 
                          tick={{ fontSize: 10 }} 
                          stroke="hsl(var(--muted-foreground))"
                          width={40}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <ReferenceLine 
                          y={Number(kpi.target)} 
                          stroke="hsl(var(--primary))" 
                          strokeDasharray="3 3"
                          label={{ value: 'Target', fontSize: 10 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ fill: 'hsl(var(--primary))' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                    No entries yet.{' '}
                    <button 
                      onClick={() => setLogEntryKPI(kpi)}
                      className="text-primary hover:underline ml-1"
                    >
                      Log first entry
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
          <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No KPIs Yet</h3>
          <p className="text-muted-foreground mb-4">Track and monitor client performance metrics</p>
          <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Add First KPI
          </Button>
        </div>
      )}

      <AddKPIDialog 
        open={addDialogOpen} 
        onOpenChange={setAddDialogOpen} 
        clientId={clientId}
      />

      {logEntryKPI && (
        <LogKPIEntryDialog
          open={!!logEntryKPI}
          onOpenChange={() => setLogEntryKPI(null)}
          kpi={logEntryKPI}
        />
      )}

      <AlertDialog open={!!kpiToDelete} onOpenChange={() => setKpiToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete KPI</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this KPI? All associated entries will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (kpiToDelete) {
                  deleteKPI(kpiToDelete);
                  setKpiToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
