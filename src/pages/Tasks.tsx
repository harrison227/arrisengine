import { CheckSquare, Plus, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TaskBoard from '@/components/tasks/TaskBoard';
import { useReminders } from '@/hooks/useReminders';
import { useTasks } from '@/hooks/useTasks';
import { format, isPast, isToday, addDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, AlertTriangle, Clock, Users } from 'lucide-react';

export default function Tasks() {
  const { tasks } = useTasks();
  const { reminders } = useReminders();

  const overdueTasks = tasks.filter(t => 
    t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)) && t.status !== 'complete'
  );
  const todayTasks = tasks.filter(t => 
    t.due_date && isToday(new Date(t.due_date)) && t.status !== 'complete'
  );
  const upcomingTasks = tasks.filter(t => 
    t.due_date && new Date(t.due_date) > new Date() && new Date(t.due_date) <= addDays(new Date(), 7) && t.status !== 'complete'
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <CheckSquare className="w-8 h-8 text-primary" />
          Task Management
        </h1>
        <p className="text-muted-foreground mt-1">Manage all your tasks and deadlines in one place</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{overdueTasks.length}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              Due Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-500">{todayTasks.length}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-500">{upcomingTasks.length}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Total Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{tasks.filter(t => t.status !== 'complete').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Urgent Items */}
      {(overdueTasks.length > 0 || todayTasks.length > 0) && (
        <Card className="mb-8 border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Needs Attention
            </CardTitle>
            <CardDescription>Tasks that require immediate action</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueTasks.slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">{task.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.clients?.business_name && `${task.clients.business_name} • `}
                      Due {format(new Date(task.due_date!), 'MMM d')}
                    </p>
                  </div>
                  <Badge variant="destructive">Overdue</Badge>
                </div>
              ))}
              {todayTasks.slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">{task.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.clients?.business_name && `${task.clients.business_name} • `}
                      Due today
                    </p>
                  </div>
                  <Badge className="bg-orange-500">Today</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task Board */}
      <TaskBoard />
    </div>
  );
}
