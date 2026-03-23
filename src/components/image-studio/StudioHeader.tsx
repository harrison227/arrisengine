import { Plus, Palette, Lightbulb, ChevronDown, Images, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface Client {
  id: string;
  business_name: string;
  industry: string;
}

interface Session {
  id: string;
  title: string | null;
  created_at: string;
}

export type StudioMode = 'quick' | 'batch' | 'variations' | 'library';

interface StudioHeaderProps {
  clients: Client[];
  selectedClientId: string | null;
  onClientChange: (id: string) => void;
  sessions: Session[];
  activeSessionId: string | null;
  onSessionSelect: (id: string | null) => void;
  onNewSession: () => void;
  mode: StudioMode;
  onModeChange: (mode: StudioMode) => void;
  onOpenStyleDrawer: () => void;
  onOpenBrandDrawer: () => void;
  stats: { approved: number; pending: number; total: number };
}

export function StudioHeader({
  clients,
  selectedClientId,
  onClientChange,
  sessions,
  activeSessionId,
  onSessionSelect,
  onNewSession,
  mode,
  onModeChange,
  onOpenStyleDrawer,
  onOpenBrandDrawer,
  stats,
}: StudioHeaderProps) {
  const selectedClient = clients.find(c => c.id === selectedClientId);
  const activeSession = sessions.find(s => s.id === activeSessionId);

  return (
    <div className="h-14 border-b bg-card px-4 flex items-center justify-between shrink-0">
      {/* Left: Client + Session */}
      <div className="flex items-center gap-3">
        {/* Client Selector */}
        <Select value={selectedClientId || ''} onValueChange={onClientChange}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                <span className="font-medium">{client.business_name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Session Dropdown */}
        {selectedClientId && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <span className="max-w-[140px] truncate">
                  {activeSession?.title || 'Select session'}
                </span>
                {stats.total > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {stats.approved}/{stats.total}
                  </Badge>
                )}
                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[220px]">
              <DropdownMenuItem onClick={onNewSession} className="gap-2">
                <Plus className="h-4 w-4" />
                New Session
              </DropdownMenuItem>
              {sessions.length > 0 && (
                <>
                  <div className="h-px bg-border my-1" />
                  {sessions.slice(0, 10).map((session) => (
                    <DropdownMenuItem 
                      key={session.id} 
                      onClick={() => onSessionSelect(session.id)}
                      className={activeSessionId === session.id ? 'bg-accent' : ''}
                    >
                      <span className="truncate">{session.title || 'Untitled'}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Center: Mode Tabs */}
      <Tabs value={mode} onValueChange={(v) => onModeChange(v as StudioMode)}>
        <TabsList className="h-9">
          <TabsTrigger value="quick" className="text-sm px-4">Quick</TabsTrigger>
          <TabsTrigger value="batch" className="text-sm px-4">Batch</TabsTrigger>
          <TabsTrigger value="variations" className="text-sm px-4 gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Variations
          </TabsTrigger>
          <TabsTrigger value="library" className="text-sm px-4 gap-1.5">
            <Images className="h-3.5 w-3.5" />
            Library
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Right: Drawer Buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenStyleDrawer}
          className="h-9 gap-2"
        >
          <Palette className="h-4 w-4" />
          <span className="hidden sm:inline">Style</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenBrandDrawer}
          className="h-9 gap-2"
        >
          <Lightbulb className="h-4 w-4" />
          <span className="hidden sm:inline">Brand</span>
        </Button>
      </div>
    </div>
  );
}
