import { Button } from '@/components/ui/button';
import { Check, Calendar, Trash2, X } from 'lucide-react';

interface TextPostActionBarProps {
  selectedCount: number;
  onApprove: () => void;
  onSchedule: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

export function TextPostActionBar({
  selectedCount,
  onApprove,
  onSchedule,
  onDelete,
  onClearSelection,
}: TextPostActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 bg-background border rounded-full px-4 py-2 shadow-lg">
        <span className="text-sm font-medium px-2">
          {selectedCount} post{selectedCount !== 1 ? 's' : ''} selected
        </span>

        <div className="h-4 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          className="text-green-600 hover:text-green-700 hover:bg-green-50"
          onClick={onApprove}
        >
          <Check className="h-4 w-4 mr-1" />
          Approve
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          onClick={onSchedule}
        >
          <Calendar className="h-4 w-4 mr-1" />
          Schedule
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>

        <div className="h-4 w-px bg-border" />

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
