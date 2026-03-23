import { useActivityLogs } from '@/hooks/useActivityLog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { 
  FileText, 
  Trash2, 
  Edit, 
  Plus, 
  User, 
  Briefcase, 
  Calendar,
  Image,
  Target,
  ClipboardList,
  Activity
} from 'lucide-react';

const actionIcons: Record<string, React.ReactNode> = {
  created: <Plus className="h-4 w-4 text-green-500" />,
  updated: <Edit className="h-4 w-4 text-blue-500" />,
  deleted: <Trash2 className="h-4 w-4 text-red-500" />,
};

const entityIcons: Record<string, React.ReactNode> = {
  contract: <FileText className="h-4 w-4" />,
  client: <Briefcase className="h-4 w-4" />,
  lead: <Target className="h-4 w-4" />,
  content_piece: <ClipboardList className="h-4 w-4" />,
  content_plan: <Calendar className="h-4 w-4" />,
  asset: <Image className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
};

const actionColors: Record<string, string> = {
  created: 'bg-green-500/10 text-green-700 dark:text-green-400',
  updated: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  deleted: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

export function ActivityLogSection() {
  const { data: logs, isLoading, error } = useActivityLogs();

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Log
          </CardTitle>
          <CardDescription>Failed to load activity logs</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity Log
        </CardTitle>
        <CardDescription>
          Track all actions taken by team members
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : logs && logs.length > 0 ? (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={log.profile?.avatar_url || undefined} />
                    <AvatarFallback>
                      {log.profile?.full_name?.charAt(0) || log.profile?.email?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">
                        {log.profile?.full_name || log.profile?.email || 'Unknown User'}
                      </span>
                      <Badge 
                        variant="secondary" 
                        className={actionColors[log.action] || 'bg-muted'}
                      >
                        {actionIcons[log.action]}
                        <span className="ml-1 capitalize">{log.action}</span>
                      </Badge>
                      <span className="text-muted-foreground flex items-center gap-1">
                        {entityIcons[log.entity_type] || <FileText className="h-4 w-4" />}
                        <span className="capitalize">{log.entity_type.replace('_', ' ')}</span>
                      </span>
                    </div>
                    
                    {log.entity_name && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        "{log.entity_name}"
                      </p>
                    )}
                    
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No activity logged yet</p>
              <p className="text-sm">Actions will appear here as team members work</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
