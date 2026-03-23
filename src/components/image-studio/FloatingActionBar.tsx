import { Download, Check, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FloatingActionBarProps {
  selectedCount: number;
  onApproveAll: () => void;
  onDownloadAll: () => void;
  onClearSelection: () => void;
  isVisible: boolean;
}

export function FloatingActionBar({
  selectedCount,
  onApproveAll,
  onDownloadAll,
  onClearSelection,
  isVisible,
}: FloatingActionBarProps) {
  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300',
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
      )}
    >
      <div className="bg-foreground text-background rounded-full px-6 py-3 shadow-2xl flex items-center gap-4">
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>

        <div className="h-4 w-px bg-background/20" />

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onApproveAll}
            className="text-background hover:bg-background/10 hover:text-background gap-2"
          >
            <Check className="h-4 w-4" />
            Approve All
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onDownloadAll}
            className="text-background hover:bg-background/10 hover:text-background gap-2"
          >
            <Download className="h-4 w-4" />
            Download
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClearSelection}
            className="text-background/70 hover:bg-background/10 hover:text-background h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
