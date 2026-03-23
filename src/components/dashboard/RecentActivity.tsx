import { CheckCircle2, MessageSquare, FileText, Play, UserPlus, Megaphone } from 'lucide-react';
import { useRecentActivity } from '@/hooks/useRecentActivity';
import { Skeleton } from '@/components/ui/skeleton';

const activityIcons = {
  lead: { icon: UserPlus, color: 'text-primary' },
  client: { icon: CheckCircle2, color: 'text-success' },
  content: { icon: FileText, color: 'text-warning' },
  ad: { icon: Megaphone, color: 'text-stage-contacted' },
};

export function RecentActivity() {
  const { data: activities, isLoading } = useRecentActivity(6);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm animate-slide-up" style={{ animationDelay: '0.25s' }}>
        <Skeleton className="h-6 w-40 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="w-5 h-5 rounded" />
              <div className="flex-1">
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm animate-slide-up" style={{ animationDelay: '0.25s' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
          <p className="text-sm text-muted-foreground">Latest updates across all clients</p>
        </div>
      </div>
      <div className="space-y-4">
        {activities && activities.length > 0 ? (
          activities.map((activity) => {
            const config = activityIcons[activity.type];
            const Icon = config.icon;
            return (
              <div key={activity.id} className="flex items-start gap-3">
                <div className={`mt-0.5 ${config.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{activity.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatTime(activity.timestamp)}</p>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent activity. Start by adding leads or clients!
          </p>
        )}
      </div>
    </div>
  );
}
