import { Calendar, ArrowRight } from 'lucide-react';
import { useContentPlans } from '@/hooks/useContentPlans';
import { useClients } from '@/hooks/useClients';
import { useTeam } from '@/hooks/useTeam';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';

export function UpcomingFilmings() {
  const { contentPlans, isLoading: plansLoading } = useContentPlans();
  const { clients, isLoading: clientsLoading } = useClients();
  const { team } = useTeam();

  const isLoading = plansLoading || clientsLoading;

  const upcomingPlans = contentPlans
    .filter(cp => cp.filming_date)
    .sort((a, b) => new Date(a.filming_date!).getTime() - new Date(b.filming_date!).getTime())
    .slice(0, 3);

  const getClientName = (clientId: string) => {
    return clients.find(c => c.id === clientId)?.business_name || 'Unknown';
  };

  const getAssigneeName = (assignedTo: string | null) => {
    if (!assignedTo) return 'Unassigned';
    const member = team.find(m => m.profile.id === assignedTo);
    return member?.profile.full_name || member?.profile.email || 'Unassigned';
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <Skeleton className="h-6 w-40 mb-6" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm animate-slide-up" style={{ animationDelay: '0.2s' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Upcoming Filmings</h3>
          <p className="text-sm text-muted-foreground">Scheduled content shoots</p>
        </div>
        <Link to="/content" className="text-primary text-sm font-medium flex items-center gap-1 hover:underline">
          View all <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="space-y-3">
        {upcomingPlans.map((plan) => (
          <div 
            key={plan.id} 
            className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{plan.title}</p>
              <p className="text-xs text-muted-foreground">{getClientName(plan.client_id)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{formatDate(plan.filming_date!)}</p>
              <p className="text-xs text-muted-foreground">{getAssigneeName(plan.assigned_to)}</p>
            </div>
          </div>
        ))}
        {upcomingPlans.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No upcoming filmings</p>
        )}
      </div>
    </div>
  );
}
