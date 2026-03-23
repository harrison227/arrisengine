import { useClients } from '@/hooks/useClients';
import { Skeleton } from '@/components/ui/skeleton';

export function ClientBreakdown() {
  const { clients, isLoading } = useClients();
  
  // Include both active and onboarding clients
  const currentClients = clients
    .filter(c => c.status === 'active' || c.status === 'onboarding')
    .sort((a, b) => Number(b.mrr) - Number(a.mrr));

  const totalMRR = currentClients.reduce((sum, c) => sum + Number(c.mrr), 0);

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <Skeleton className="h-6 w-40 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm animate-slide-up" style={{ animationDelay: '0.15s' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">MRR Breakdown</h3>
          <p className="text-sm text-muted-foreground">Revenue by client</p>
        </div>
      </div>
      <div className="space-y-4">
        {currentClients.length > 0 ? (
          currentClients.map((client, index) => {
            const percentage = totalMRR > 0 ? (Number(client.mrr) / totalMRR) * 100 : 0;
            return (
              <div key={client.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{client.business_name}</span>
                  <span className="text-sm text-muted-foreground">${Number(client.mrr).toLocaleString()}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ 
                      width: `${percentage}%`,
                      opacity: 1 - (index * 0.15),
                    }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No clients yet</p>
        )}
      </div>
    </div>
  );
}
