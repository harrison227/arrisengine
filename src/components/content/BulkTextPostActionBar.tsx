import { X, FileCheck, Clock, CheckCircle, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { TextPost } from '@/hooks/useTextPosts';

interface BulkTextPostActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkStatusChange: (status: TextPost['status']) => void;
  onBulkDelete?: () => void;
  isUpdating?: boolean;
}

export function BulkTextPostActionBar({
  selectedCount,
  onClearSelection,
  onBulkStatusChange,
  onBulkDelete,
  isUpdating = false,
}: BulkTextPostActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="bg-card border border-border rounded-xl shadow-xl px-4 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm font-medium px-2.5 py-1">
            {selectedCount} selected
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="h-6 w-px bg-border" />

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkStatusChange('draft')}
            disabled={isUpdating}
            className="h-8 text-xs"
          >
            <FileCheck className="w-3.5 h-3.5 mr-1.5" />
            Draft
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkStatusChange('pending_review')}
            disabled={isUpdating}
            className="h-8 text-xs bg-amber-500/10 border-amber-300 text-amber-700 hover:bg-amber-500/20"
          >
            <Clock className="w-3.5 h-3.5 mr-1.5" />
            Pending Review
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkStatusChange('approved')}
            disabled={isUpdating}
            className="h-8 text-xs bg-green-500/10 border-green-300 text-green-700 hover:bg-green-500/20"
          >
            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
            Approved
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkStatusChange('scheduled')}
            disabled={isUpdating}
            className="h-8 text-xs bg-purple-500/10 border-purple-300 text-purple-700 hover:bg-purple-500/20"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Scheduled
          </Button>
        </div>

        {onBulkDelete && (
          <>
            <div className="h-6 w-px bg-border" />
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkDelete}
              disabled={isUpdating}
              className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
