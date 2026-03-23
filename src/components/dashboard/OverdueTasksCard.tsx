import { AlertTriangle, Clock, CheckSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTasks } from '@/hooks/useTasks';
import { format, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const priorityColors: Record<string, string> = {
  low: 'text-muted-foreground',
  medium: 'text-blue-500',
  high: 'text-orange-500',
  urgent: 'text-red-500',
};

export function OverdueTasksCard() {
  const { tasks } = useTasks();

  const overdueTasks = tasks.filter(t => 
    t.due_date && 
    isPast(new Date(t.due_date)) && 
    !isToday(new Date(t.due_date)) && 
    t.status !== 'complete'
  ).slice(0, 5);

  const todayTasks = tasks.filter(t => 
    t.due_date && 
    isToday(new Date(t.due_date)) && 
    t.status !== 'complete'
  ).slice(0, 3);

  const totalOverdue = tasks.filter(t => 
    t.due_date && 
    isPast(new Date(t.due_date)) && 
    !isToday(new Date(t.due_date)) && 
    t.status !== 'complete'
  ).length;

  return (
    <Card className={cn(totalOverdue > 0 && "border-destructive/50")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className={cn("w-5 h-5", totalOverdue > 0 ? "text-destructive" : "text-primary")} />
          Task Overview
        </CardTitle>
        <CardDescription>
          {totalOverdue > 0 
            ? `${totalOverdue} overdue task${totalOverdue > 1 ? 's' : ''} need attention`
            : 'All tasks on track'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {overdueTasks.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-destructive flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Overdue
            </p>
            {overdueTasks.map(task => (
              <div
                key={task.id}
                className="flex items-center justify-between p-2 bg-destructive/10 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.clients?.business_name && `${task.clients.business_name} • `}
                    Due {format(new Date(task.due_date!), 'MMM d')}
                  </p>
                </div>
                <Badge variant="destructive" className="text-xs shrink-0">
                  {Math.abs(Math.ceil((new Date(task.due_date!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))}d late
                </Badge>
              </div>
            ))}
          </div>
        )}

        {todayTasks.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-orange-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Due Today
            </p>
            {todayTasks.map(task => (
              <div
                key={task.id}
                className="flex items-center justify-between p-2 bg-orange-500/10 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.clients?.business_name}
                  </p>
                </div>
                <Badge className={cn("text-xs shrink-0", priorityColors[task.priority])}>
                  {task.priority}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {overdueTasks.length === 0 && todayTasks.length === 0 && (
          <div className="text-center py-4 text-green-500">
            <CheckSquare className="w-8 h-8 mx-auto mb-2" />
            <p className="font-medium">All caught up!</p>
            <p className="text-sm text-muted-foreground">No overdue tasks</p>
          </div>
        )}

        <Link to="/tasks">
          <Button variant="outline" className="w-full">
            View All Tasks
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
