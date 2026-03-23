import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Check, Trash2, Calendar } from 'lucide-react';
import { TextPost } from '@/hooks/useTextPosts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface TextPostCardProps {
  post: TextPost;
  isSelected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onEdit: (post: TextPost) => void;
  onApprove: (id: string) => void;
  onSchedule: (id: string) => void;
  onDelete: (id: string) => void;
  characterLimit?: number;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  approved: 'bg-green-500/10 text-green-600 border-green-500/20',
  scheduled: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  published: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
};

export function TextPostCard({
  post,
  isSelected,
  onSelect,
  onEdit,
  onApprove,
  onSchedule,
  onDelete,
  characterLimit = 500,
}: TextPostCardProps) {
  const isOverLimit = post.content.length > characterLimit;

  return (
    <Card
      className={cn(
        'p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(post.id, !!checked)}
          className="mt-1"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className={statusColors[post.status]}>
              {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
            </Badge>
            {post.scheduled_date && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(post.scheduled_date), 'MMM d, yyyy')}
              </span>
            )}
          </div>

          <p className="text-sm whitespace-pre-wrap break-words">
            {post.content}
          </p>

          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <span
              className={cn(
                'text-xs',
                isOverLimit ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {post.content.length}/{characterLimit} characters
            </span>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEdit(post)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>

              {post.status === 'draft' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-green-600"
                  onClick={() => onApprove(post.id)}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              )}

              {post.status === 'approved' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-blue-600"
                  onClick={() => onSchedule(post.id)}
                >
                  <Calendar className="h-3.5 w-3.5" />
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => onDelete(post.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
