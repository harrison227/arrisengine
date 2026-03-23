import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, Clock, AlertTriangle, CloudOff, RefreshCw, Settings } from 'lucide-react';
import { useLateSync } from '@/hooks/useLateSync';
import { Link } from 'react-router-dom';

interface LateSyncBadgeProps {
  contentPieceId: string;
  syncStatus: string | null;
  errorMessage?: string | null;
  lastSyncedAt?: string | null;
  showRetry?: boolean;
  compact?: boolean;
  clientId?: string;
}

export function LateSyncBadge({
  contentPieceId,
  syncStatus,
  errorMessage,
  lastSyncedAt,
  showRetry = true,
  compact = false,
  clientId,
}: LateSyncBadgeProps) {
  const { retrySyncToLate, isSyncing } = useLateSync();

  const getStatusConfig = () => {
    switch (syncStatus) {
      case 'synced':
        return {
          icon: Check,
          label: 'Synced to Late',
          variant: 'default' as const,
          className: 'bg-green-500/10 text-green-600 border-green-500/20',
          showConfigure: false,
        };
      case 'pending':
        return {
          icon: Clock,
          label: 'Syncing...',
          variant: 'secondary' as const,
          className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
          showConfigure: false,
        };
      case 'error':
        return {
          icon: AlertTriangle,
          label: 'Sync Error',
          variant: 'destructive' as const,
          className: 'bg-destructive/10 text-destructive border-destructive/20',
          showConfigure: false,
        };
      default:
        // Not synced / not configured
        return {
          icon: CloudOff,
          label: 'Not Synced',
          variant: 'outline' as const,
          className: 'bg-muted/30 text-muted-foreground/70 border-muted/50',
          showConfigure: true,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const tooltipContent = (
    <div className="text-xs space-y-1.5 max-w-[220px]">
      <div className="font-medium">{config.label}</div>
      {lastSyncedAt && (
        <div className="text-muted-foreground">
          Last synced: {new Date(lastSyncedAt).toLocaleString()}
        </div>
      )}
      {errorMessage && (
        <div className="text-destructive">{errorMessage}</div>
      )}
      {config.showConfigure && (
        <div className="text-muted-foreground">
          Configure Late integration in client settings to enable auto-sync
        </div>
      )}
    </div>
  );

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1 p-1 rounded ${config.className}`}>
              <Icon className="h-3 w-3" />
              {syncStatus === 'error' && showRetry && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    retrySyncToLate(contentPieceId);
                  }}
                  disabled={isSyncing}
                >
                  <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                </Button>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="left">{tooltipContent}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Badge variant={config.variant} className={config.className}>
              <Icon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
            {syncStatus === 'error' && showRetry && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  retrySyncToLate(contentPieceId);
                }}
                disabled={isSyncing}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                Retry
              </Button>
            )}
            {config.showConfigure && clientId && (
              <Link to={`/clients/${clientId}?tab=late`} onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                  <Settings className="h-3 w-3 mr-1" />
                  Configure
                </Button>
              </Link>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>{tooltipContent}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
