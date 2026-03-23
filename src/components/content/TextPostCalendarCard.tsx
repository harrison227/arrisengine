import { useState } from 'react';
import { MessageSquare, Check, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { TextPost } from '@/hooks/useTextPosts';

interface TextPostCalendarCardProps {
  post: TextPost;
  isSelected: boolean;
  onSelect: (postId: string, e: React.MouseEvent) => void;
  onClick: (post: TextPost, e: React.MouseEvent) => void;
  onStatusChange: (postId: string, status: TextPost['status']) => void;
  onDragStart?: (e: React.DragEvent, post: TextPost) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  compact?: boolean;
}

const statusConfig: Record<TextPost['status'], { label: string; color: string; bgColor: string; borderColor: string }> = {
  draft: { label: 'Draft', color: 'text-muted-foreground', bgColor: 'bg-muted', borderColor: 'border-l-muted-foreground' },
  pending_review: { label: 'Pending Review', color: 'text-amber-600', bgColor: 'bg-amber-500/10', borderColor: 'border-l-amber-500' },
  approved: { label: 'Approved', color: 'text-green-600', bgColor: 'bg-green-500/10', borderColor: 'border-l-green-500' },
  scheduled: { label: 'Scheduled', color: 'text-purple-600', bgColor: 'bg-purple-500/10', borderColor: 'border-l-purple-500' },
  published: { label: 'Published', color: 'text-blue-600', bgColor: 'bg-blue-500/10', borderColor: 'border-l-blue-500' },
};

const platformIcons: Record<string, string> = {
  linkedin: '💼',
  twitter: '𝕏',
  threads: '🧵',
};

export function TextPostCalendarCard({
  post,
  isSelected,
  onSelect,
  onClick,
  onStatusChange,
  onDragStart,
  onDragEnd,
  isDragging = false,
  compact = false,
}: TextPostCalendarCardProps) {
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const config = statusConfig[post.status] || statusConfig.draft;

  const handleCardClick = (e: React.MouseEvent) => {
    // If clicking on checkbox, dropdown, or grip, don't trigger card click
    if ((e.target as HTMLElement).closest('[data-checkbox]') || 
        (e.target as HTMLElement).closest('[data-status-dropdown]') ||
        (e.target as HTMLElement).closest('[data-drag-handle]')) {
      return;
    }
    onClick(post, e);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent native text selection on shift+click
    onSelect(post.id, e);
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (onDragStart) {
      e.stopPropagation();
      onDragStart(e, post);
    }
  };

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "text-xs p-2 rounded cursor-pointer transition-all border-l-4 group relative select-none",
        config.bgColor,
        config.borderColor,
        isSelected && "ring-2 ring-primary ring-offset-1",
        isDragging && "opacity-50"
      )}
      onClick={handleCardClick}
    >
      {/* Selection checkbox - visible on hover or when selected */}
      <div
        data-checkbox
        className={cn(
          "absolute -left-1 top-1/2 -translate-y-1/2 transition-opacity",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        onClick={handleCheckboxClick}
      >
        <Checkbox
          checked={isSelected}
          className="h-4 w-4 bg-background border-border"
        />
      </div>

      <div className="flex items-center gap-1.5">
        {onDragStart && (
          <div data-drag-handle className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="w-3 h-3 flex-shrink-0 text-muted-foreground" />
          </div>
        )}
        <span className="flex-shrink-0">{platformIcons[post.platform] || '📝'}</span>
        <MessageSquare className={cn("w-3 h-3 flex-shrink-0", config.color)} />
        <span className="truncate text-foreground">
          {post.content.slice(0, compact ? 25 : 40)}...
        </span>
      </div>

      <div className="flex items-center gap-1 mt-1">
        {/* Status dropdown */}
        <DropdownMenu open={isStatusOpen} onOpenChange={setIsStatusOpen}>
          <DropdownMenuTrigger asChild data-status-dropdown>
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] px-1.5 py-0 h-4 capitalize cursor-pointer hover:opacity-80 transition-opacity",
                config.bgColor,
                config.color,
                "border-current"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {config.label}
            </Badge>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-36">
            {Object.entries(statusConfig).map(([status, cfg]) => (
              <DropdownMenuItem
                key={status}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(post.id, status as TextPost['status']);
                  setIsStatusOpen(false);
                }}
                className="text-xs"
              >
                <div className="flex items-center gap-2 w-full">
                  <div className={cn("w-2 h-2 rounded-full", cfg.bgColor, "border", cfg.color)} />
                  <span>{cfg.label}</span>
                  {post.status === status && <Check className="w-3 h-3 ml-auto" />}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {post.scheduled_date && (
          <span className="text-[9px] text-muted-foreground">
            {format(new Date(post.scheduled_date), 'h:mm a')}
          </span>
        )}

        {post.late_post_id && (
          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3 bg-blue-500/10 text-blue-600 border-blue-300">
            Synced
          </Badge>
        )}
      </div>
    </div>
  );
}
