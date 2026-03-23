import { format } from 'date-fns';
import { Calendar, CheckCircle, Clock, Plus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Session {
  id: string;
  title: string | null;
  created_at: string;
  status: string | null;
}

interface ImageStudioSidebarProps {
  clients: Array<{ id: string; business_name: string }>;
  selectedClientId: string | null;
  onClientChange: (clientId: string) => void;
  sessions: Session[];
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string | null) => void;
  stats: {
    approved: number;
    pending: number;
    total: number;
  };
  isLoading?: boolean;
}

export function ImageStudioSidebar({
  clients,
  selectedClientId,
  onClientChange,
  sessions,
  activeSessionId,
  onSessionSelect,
  stats,
}: ImageStudioSidebarProps) {
  const groupedSessions = sessions.reduce((acc, session) => {
    const date = format(new Date(session.created_at), 'MMM d');
    if (!acc[date]) acc[date] = [];
    acc[date].push(session);
    return acc;
  }, {} as Record<string, Session[]>);

  return (
    <div className="h-full border-r bg-card flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">Image Studio</span>
        </div>
      </div>

      {/* Client Selector */}
      <div className="p-4 border-b">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
          Client
        </label>
        <Select value={selectedClientId || ''} onValueChange={onClientChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.business_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      {selectedClientId && (
        <div className="p-4 border-b">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="text-lg font-bold text-foreground">
                {stats.total}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase font-medium">Total</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="text-lg font-bold text-green-600">{stats.approved}</div>
              <div className="text-[10px] text-muted-foreground uppercase font-medium">Done</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <div className="text-lg font-bold text-amber-600">{stats.pending}</div>
              <div className="text-[10px] text-muted-foreground uppercase font-medium">Pending</div>
            </div>
          </div>
        </div>
      )}

      {/* Sessions */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4 pb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Sessions
          </label>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onSessionSelect(null)}
          >
            <Plus className="h-3 w-3 mr-1" />
            New
          </Button>
        </div>
        
        <ScrollArea className="flex-1 px-4 pb-4">
          {Object.entries(groupedSessions).length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No sessions yet</p>
              <p className="text-xs text-muted-foreground mt-1">Start generating to create one</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedSessions).map(([date, dateSessions]) => (
                <div key={date}>
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5 font-medium">
                    <Calendar className="h-3 w-3" />
                    {date}
                  </div>
                  <div className="space-y-1.5">
                    {dateSessions.map((session) => (
                      <button
                        key={session.id}
                        onClick={() => onSessionSelect(session.id)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all',
                          activeSessionId === session.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 hover:bg-muted'
                        )}
                      >
                        <div className="font-medium truncate">
                          {session.title || 'Untitled Session'}
                        </div>
                        <div className={cn(
                          'text-xs flex items-center gap-2 mt-0.5',
                          activeSessionId === session.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        )}>
                          {session.status === 'completed' ? (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          ) : (
                            <Clock className="h-3 w-3 text-amber-500" />
                          )}
                          {format(new Date(session.created_at), 'h:mm a')}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
