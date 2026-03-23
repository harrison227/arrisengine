import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Video, Send, Loader2, GripVertical, MessageSquare, Plus } from 'lucide-react';
import { ContentPiece } from '@/hooks/useContentPieces';
import { TextPost } from '@/hooks/useTextPosts';
import { LateSyncBadge } from '@/components/content/LateSyncBadge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface DayDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  scheduledContent: ContentPiece[];
  textPosts: TextPost[];
  onPieceClick: (piece: ContentPiece) => void;
  onTextPostClick: (post: TextPost) => void;
  onPostNow: (pieceId: string) => void;
  onAddContent?: (date: Date) => void;
  isPosting: boolean;
  postingId: string | null;
  getClientName: (planId: string) => string;
}

export function DayDetailSheet({
  open,
  onOpenChange,
  date,
  scheduledContent,
  textPosts,
  onPieceClick,
  onTextPostClick,
  onPostNow,
  onAddContent,
  isPosting,
  postingId,
  getClientName,
}: DayDetailSheetProps) {
  if (!date) return null;

  const totalItems = scheduledContent.length + textPosts.length;

  const getStatusLabel = (piece: ContentPiece) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pieceDate = piece.scheduled_date ? new Date(piece.scheduled_date) : null;
    if (pieceDate) pieceDate.setHours(0, 0, 0, 0);
    const isPast = pieceDate && pieceDate < today;

    if (piece.status === 'live' || isPast) return { text: 'Posted', color: 'bg-blue-500 text-white' };
    if (piece.status === 'approved') return { text: 'Scheduled', color: 'bg-green-500 text-white' };
    if (piece.status === 'edited') return { text: 'Review', color: 'bg-orange-500 text-white' };
    return { text: 'Draft', color: 'bg-yellow-500 text-white' };
  };

  const getTextPostStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-blue-500 text-white';
      case 'approved':
      case 'scheduled': return 'bg-green-500 text-white';
      case 'pending_review': return 'bg-orange-500 text-white';
      default: return 'bg-yellow-500 text-white';
    }
  };

  // Parse carousel asset_url
  const getImageUrl = (piece: ContentPiece): string | null => {
    if (!piece.asset_url) return null;
    try {
      const parsed = JSON.parse(piece.asset_url);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
    } catch { /* not JSON */ }
    return piece.asset_url;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {format(date, 'EEEE, MMMM d, yyyy')}
            <Badge variant="secondary" className="ml-2">{totalItems} items</Badge>
            {onAddContent && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto gap-1"
                onClick={() => { onAddContent(date); onOpenChange(false); }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-2">
          <div className="space-y-3">
            {/* Content Pieces */}
            {scheduledContent.map(piece => {
              const statusLabel = getStatusLabel(piece);
              const imageUrl = getImageUrl(piece);
              const time = piece.scheduled_date 
                ? format(new Date(piece.scheduled_date), 'h:mm a') 
                : null;

              return (
                <div
                  key={piece.id}
                  onClick={() => { onPieceClick(piece); onOpenChange(false); }}
                  className="flex gap-3 p-3 rounded-lg border border-border bg-card hover:bg-secondary/30 cursor-pointer transition-colors group"
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt=""
                      className="w-16 h-16 rounded-md object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <Video className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-2">{piece.concept}</p>
                    {piece.platforms && piece.platforms.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {piece.platforms.map(p => (
                          <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary capitalize">
                            {p.replace('_stories', ' Story')}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', statusLabel.color)}>
                        {statusLabel.text}
                      </span>
                      {time && (
                        <span className="text-[10px] text-muted-foreground">{time}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1" onClick={e => e.stopPropagation()}>
                    {piece.status !== 'live' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onPostNow(piece.id)}
                        disabled={isPosting && postingId === piece.id}
                      >
                        {isPosting && postingId === piece.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                    <LateSyncBadge
                      syncStatus={piece.late_sync_status}
                      lastSyncedAt={piece.late_last_synced_at}
                      errorMessage={piece.late_error_message}
                      contentPieceId={piece.id}
                      compact
                      showRetry
                    />
                  </div>
                </div>
              );
            })}

            {/* Text Posts */}
            {textPosts.map(post => {
              const time = post.scheduled_date
                ? format(new Date(post.scheduled_date), 'h:mm a')
                : null;

              return (
                <div
                  key={post.id}
                  onClick={() => { onTextPostClick(post); onOpenChange(false); }}
                  className="flex gap-3 p-3 rounded-lg border border-border bg-card hover:bg-secondary/30 cursor-pointer transition-colors"
                >
                  <div className="w-16 h-16 rounded-md bg-primary/5 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="w-6 h-6 text-primary/50" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground line-clamp-2">{post.content}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary capitalize">
                        {post.platform}
                      </span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', getTextPostStatusColor(post.status))}>
                        {post.status}
                      </span>
                      {time && (
                        <span className="text-[10px] text-muted-foreground">{time}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {totalItems === 0 && (
              <p className="text-center text-muted-foreground py-8">No content scheduled for this day</p>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
