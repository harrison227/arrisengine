import { useState } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { Bell, Check, X, Calendar, Users, FileText, AlertTriangle, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useReminders, ReminderType } from '@/hooks/useReminders';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const reminderTypeConfig: Record<ReminderType, { icon: typeof Bell; color: string; label: string }> = {
  filming: { icon: Calendar, color: 'text-blue-500', label: 'Filming' },
  follow_up: { icon: Users, color: 'text-orange-500', label: 'Follow-up' },
  contract_renewal: { icon: FileText, color: 'text-purple-500', label: 'Contract' },
  task_due: { icon: AlertTriangle, color: 'text-yellow-500', label: 'Task' },
  stale_lead: { icon: Users, color: 'text-red-500', label: 'Stale Lead' },
  custom: { icon: Bell, color: 'text-muted-foreground', label: 'Reminder' },
};

export function NotificationBell() {
  const { reminders, unreadCount, markAsRead, dismissReminder } = useReminders();
  const [open, setOpen] = useState(false);

  const activeReminders = reminders.filter(r => !r.is_dismissed);
  const dueReminders = activeReminders.filter(r => new Date(r.due_date) <= new Date());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Notifications</h3>
          <p className="text-sm text-muted-foreground">
            {dueReminders.length} pending reminders
          </p>
        </div>
        
        <ScrollArea className="max-h-[400px]">
          {activeReminders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activeReminders.map(reminder => {
                const config = reminderTypeConfig[reminder.reminder_type];
                const Icon = config.icon;
                const isDue = new Date(reminder.due_date) <= new Date();
                const isOverdue = isPast(new Date(reminder.due_date)) && !isToday(new Date(reminder.due_date));
                
                return (
                  <div
                    key={reminder.id}
                    className={cn(
                      "p-3 hover:bg-muted/50 transition-colors",
                      !reminder.is_read && isDue && "bg-primary/5"
                    )}
                    onClick={() => !reminder.is_read && markAsRead(reminder.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded-lg bg-muted", config.color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm">{reminder.title}</p>
                        {reminder.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{reminder.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={cn("text-xs", isOverdue && "text-destructive border-destructive")}>
                            {isToday(new Date(reminder.due_date)) 
                              ? 'Today' 
                              : format(new Date(reminder.due_date), 'MMM d')}
                          </Badge>
                          {reminder.clients?.business_name && (
                            <span className="text-xs text-muted-foreground">
                              {reminder.clients.business_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissReminder(reminder.id);
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-2 border-t border-border">
          <Link to="/tasks" onClick={() => setOpen(false)}>
            <Button variant="ghost" className="w-full justify-between text-sm">
              View all tasks
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
