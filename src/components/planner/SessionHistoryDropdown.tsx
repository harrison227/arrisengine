import React from 'react';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { History, Check, Clock, Pause, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { AISession } from '@/hooks/useAISession';

interface SessionHistoryDropdownProps {
  sessions: AISession[];
  currentSessionId: string | null;
  onSelectSession: (session: AISession) => void;
  onDeleteSession: (sessionId: string) => void;
  isLoading?: boolean;
}

export function SessionHistoryDropdown({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  isLoading,
}: SessionHistoryDropdownProps) {
  // Group sessions by date
  const groupedSessions = sessions.reduce((acc, session) => {
    const date = new Date(session.updated_at);
    let group = 'Earlier';
    
    if (isToday(date)) {
      group = 'Today';
    } else if (isYesterday(date)) {
      group = 'Yesterday';
    } else {
      group = format(date, 'MMM d, yyyy');
    }
    
    if (!acc[group]) acc[group] = [];
    acc[group].push(session);
    return acc;
  }, {} as Record<string, AISession[]>);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Check className="w-3 h-3 text-green-500" />;
      case 'paused':
        return <Pause className="w-3 h-3 text-yellow-500" />;
      default:
        return <Clock className="w-3 h-3 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="secondary" className="text-xs">Done</Badge>;
      case 'paused':
        return <Badge variant="outline" className="text-xs">Paused</Badge>;
      default:
        return null;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isLoading}>
          <History className="w-4 h-4 mr-2" />
          History
          {sessions.length > 0 && (
            <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
              {sessions.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            No previous sessions
          </div>
        ) : (
          Object.entries(groupedSessions).map(([group, groupSessions], idx) => (
            <React.Fragment key={group}>
              {idx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                {group}
              </DropdownMenuLabel>
              {groupSessions.map((session) => (
                <DropdownMenuItem
                  key={session.id}
                  className={`flex items-start gap-3 py-3 cursor-pointer ${
                    session.id === currentSessionId ? 'bg-accent' : ''
                  }`}
                  onClick={() => onSelectSession(session)}
                >
                  <div className="mt-0.5">
                    {getStatusIcon(session.status || 'in_progress')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {session.title || 'Untitled Session'}
                      </span>
                      {session.id === currentSessionId && (
                        <Badge variant="default" className="text-xs px-1 py-0">
                          Current
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })}
                      </span>
                      {getStatusBadge(session.status || 'in_progress')}
                    </div>
                    {session.session_data?.messages && (
                      <span className="text-xs text-muted-foreground">
                        {session.session_data.messages.length} messages
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </DropdownMenuItem>
              ))}
            </React.Fragment>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
