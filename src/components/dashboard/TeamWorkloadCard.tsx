import { Users, CheckSquare, Building2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAnalytics } from '@/hooks/useAnalytics';
import { cn } from '@/lib/utils';

export function TeamWorkloadCard() {
  const { teamWorkload, isLoading } = useAnalytics();

  const maxTasks = Math.max(...teamWorkload.map(t => t.taskCount), 1);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Workload</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Team Workload
        </CardTitle>
        <CardDescription>Task distribution across team members</CardDescription>
      </CardHeader>
      <CardContent>
        {teamWorkload.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No team activity yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {teamWorkload.slice(0, 5).map(member => {
              const initials = member.name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
              const completionRate = member.taskCount > 0
                ? (member.completedTasks / member.taskCount) * 100
                : 0;
              const workloadPercent = (member.taskCount / maxTasks) * 100;

              return (
                <div key={member.userId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">{member.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CheckSquare className="w-3 h-3" />
                            {member.taskCount} tasks
                          </span>
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {member.clientCount} clients
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "text-sm font-medium",
                        completionRate >= 70 ? "text-green-500" : 
                        completionRate >= 40 ? "text-yellow-500" : "text-orange-500"
                      )}>
                        {completionRate.toFixed(0)}%
                      </p>
                      <p className="text-xs text-muted-foreground">complete</p>
                    </div>
                  </div>
                  <Progress value={workloadPercent} className="h-1.5" />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
