import { useState } from 'react';
import { 
  CheckCircle2, Clock, Eye, MessageSquare, Send, ArrowRight, 
  RotateCcw, ThumbsUp, AlertCircle, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useContentApprovals, ApprovalStatus } from '@/hooks/useContentApprovals';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const statusConfig: Record<ApprovalStatus, { label: string; icon: typeof Clock; color: string; bgColor: string }> = {
  draft: { label: 'Draft', icon: Clock, color: 'text-muted-foreground', bgColor: 'bg-muted' },
  internal_review: { label: 'Internal Review', icon: Eye, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  client_review: { label: 'Client Review', icon: Send, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  revision_requested: { label: 'Revision Requested', icon: RotateCcw, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  approved: { label: 'Approved', icon: ThumbsUp, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  published: { label: 'Published', icon: CheckCircle2, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
};

const statusFlow: ApprovalStatus[] = ['draft', 'internal_review', 'client_review', 'approved', 'published'];

interface ContentApprovalPanelProps {
  contentPieceId: string;
  className?: string;
}

export function ContentApprovalPanel({ contentPieceId, className }: ContentApprovalPanelProps) {
  const { approval, comments, updateApprovalStatus, addComment, deleteComment, isUpdating } = useContentApprovals(contentPieceId);
  const [newComment, setNewComment] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  const currentStatus = approval?.status || 'draft';
  const config = statusConfig[currentStatus];
  const Icon = config.icon;

  const handleStatusChange = (newStatus: ApprovalStatus) => {
    updateApprovalStatus({ 
      contentPieceId, 
      status: newStatus,
      reviewNotes: reviewNotes || undefined 
    });
    setReviewNotes('');
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addComment({ contentPieceId, content: newComment });
    setNewComment('');
  };

  const getNextStatus = (): ApprovalStatus | null => {
    const currentIndex = statusFlow.indexOf(currentStatus);
    if (currentIndex < statusFlow.length - 1) {
      return statusFlow[currentIndex + 1];
    }
    return null;
  };

  const nextStatus = getNextStatus();

  return (
    <div className={cn("space-y-4", className)}>
      {/* Current Status */}
      <div className={cn("p-4 rounded-lg", config.bgColor)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={cn("w-5 h-5", config.color)} />
            <span className={cn("font-medium", config.color)}>{config.label}</span>
          </div>
          {approval?.approved_at && (
            <span className="text-xs text-muted-foreground">
              Approved {format(new Date(approval.approved_at), 'MMM d, yyyy')}
            </span>
          )}
        </div>
        {approval?.review_notes && (
          <p className="text-sm text-muted-foreground mt-2">{approval.review_notes}</p>
        )}
      </div>

      {/* Status Progress */}
      <div className="flex items-center justify-between">
        {statusFlow.map((status, index) => {
          const statusConf = statusConfig[status];
          const StatusIcon = statusConf.icon;
          const isActive = status === currentStatus;
          const isPast = statusFlow.indexOf(currentStatus) > index;
          
          return (
            <div key={status} className="flex items-center">
              <button
                onClick={() => handleStatusChange(status)}
                disabled={isUpdating}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
                  isActive && "bg-primary/10",
                  !isActive && !isPast && "opacity-50",
                  "hover:bg-primary/5"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  isPast || isActive ? statusConf.bgColor : "bg-muted"
                )}>
                  <StatusIcon className={cn("w-4 h-4", isPast || isActive ? statusConf.color : "text-muted-foreground")} />
                </div>
                <span className={cn("text-xs", isActive ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {statusConf.label.split(' ')[0]}
                </span>
              </button>
              {index < statusFlow.length - 1 && (
                <ArrowRight className="w-4 h-4 text-muted-foreground mx-1" />
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        {nextStatus && (
          <Button 
            onClick={() => handleStatusChange(nextStatus)} 
            disabled={isUpdating}
            className="flex-1"
          >
            Move to {statusConfig[nextStatus].label}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
        {currentStatus !== 'revision_requested' && currentStatus !== 'draft' && (
          <Button
            variant="outline"
            onClick={() => handleStatusChange('revision_requested')}
            disabled={isUpdating}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Request Revision
          </Button>
        )}
      </div>

      {/* Review Notes */}
      {(currentStatus === 'internal_review' || currentStatus === 'client_review') && (
        <div className="space-y-2">
          <Textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder="Add review notes (optional)..."
            className="min-h-[80px]"
          />
        </div>
      )}

      <Separator />

      {/* Comments */}
      <div className="space-y-3">
        <h4 className="font-medium text-foreground flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Comments ({comments.length})
        </h4>
        
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {comments.map(comment => {
            const initials = comment.profiles?.full_name
              ?.split(' ')
              .map(n => n[0])
              .join('')
              .toUpperCase() || 'U';
            
            return (
              <div key={comment.id} className="flex gap-3 group">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {comment.profiles?.full_name || comment.profiles?.email}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                    </span>
                    {comment.is_internal && (
                      <Badge variant="outline" className="text-xs">Internal</Badge>
                    )}
                    <button
                      onClick={() => deleteComment(comment.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{comment.content}</p>
                </div>
              </div>
            );
          })}
          
          {comments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No comments yet</p>
          )}
        </div>

        <div className="flex gap-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="min-h-[60px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAddComment();
              }
            }}
          />
          <Button onClick={handleAddComment} size="icon" disabled={!newComment.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
