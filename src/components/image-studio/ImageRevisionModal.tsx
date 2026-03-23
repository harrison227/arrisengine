import { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Clock, Download, Check, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { cn } from '@/lib/utils';
import type { ClientImageItem, ImageRevision } from '@/hooks/useAllClientImages';

interface ImageRevisionModalProps {
  item: ClientImageItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: string) => void;
  onDownload: (url: string, filename: string) => void;
  onEdit?: (item: ClientImageItem) => void;
}

export function ImageRevisionModal({
  item,
  open,
  onOpenChange,
  onApprove,
  onDownload,
}: ImageRevisionModalProps) {
  // Build version list: revisions + current (with fallback for undefined revisions)
  const revisions = item?.revisions || [];
  const allVersions = item ? [
    // Historical revisions
    ...revisions,
    // Current version (from generated_image_url)
    {
      id: 'current',
      version: (revisions.length > 0 ? Math.max(...revisions.map(r => r.version)) + 1 : 1),
      image_url: item.generated_image_url || '',
      model_used: item.model_used,
      feedback: item.feedback,
      created_at: item.updated_at,
    }
  ] : [];

  const [currentIndex, setCurrentIndex] = useState(allVersions.length - 1);
  
  // Reset index when modal opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setCurrentIndex(allVersions.length - 1);
    }
    onOpenChange(open);
  };

  if (!item || allVersions.length === 0) return null;

  const currentVersion = allVersions[currentIndex] || allVersions[allVersions.length - 1];
  const isLatest = currentIndex === allVersions.length - 1;
  const totalVersions = allVersions.length;

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < allVersions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 gap-0 overflow-hidden flex flex-col" aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>Image Version History</DialogTitle>
        </VisuallyHidden>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              Version {currentVersion.version} of {totalVersions}
            </span>
          </div>
          {isLatest && (
            <Badge variant="secondary" className="text-xs">Current</Badge>
          )}
          {item.status === 'approved' && isLatest && (
            <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-xs">
              Approved
            </Badge>
          )}
        </div>

        {/* Main content - constrained height */}
        <div className="relative flex items-center justify-center flex-1 min-h-0 bg-black/5">
          {/* Navigation Arrows */}
          {totalVersions > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute left-2 z-10 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-lg",
                  currentIndex === 0 && "opacity-30 pointer-events-none"
                )}
                onClick={goToPrev}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute right-2 z-10 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-lg",
                  currentIndex === allVersions.length - 1 && "opacity-30 pointer-events-none"
                )}
                onClick={goToNext}
                disabled={currentIndex === allVersions.length - 1}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}

          {/* Image - properly constrained */}
          <div className="p-4 flex items-center justify-center max-h-[45vh]">
            <img
              src={currentVersion.image_url}
              alt={`Version ${currentVersion.version}`}
              className="max-w-full max-h-[43vh] object-contain rounded-lg shadow-lg"
            />
          </div>
        </div>

        {/* Version strip & actions */}
        <div className="border-t bg-muted/30 p-4">
          {/* Version thumbnails */}
          {totalVersions > 1 && (
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
              <span className="text-xs text-muted-foreground shrink-0 mr-2">Previous Versions:</span>
              {allVersions.map((version, idx) => (
                <button
                  key={version.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={cn(
                    "relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                    idx === currentIndex
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-transparent hover:border-muted-foreground/50"
                  )}
                >
                  <img
                    src={version.image_url}
                    alt={`Version ${version.version}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-xs py-0.5 text-center">
                    v{version.version}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Info & actions */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm line-clamp-1">{item.concept}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{format(new Date(currentVersion.created_at), 'MMM d, yyyy h:mm a')}</span>
                {currentVersion.model_used && (
                  <span className="capitalize">{currentVersion.model_used}</span>
                )}
              </div>
              {currentVersion.feedback && (
                <p className="text-xs text-muted-foreground italic">"{currentVersion.feedback}"</p>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(currentVersion.image_url, `image-v${currentVersion.version}.png`)}
              >
                <Download className="h-4 w-4 mr-1.5" />
                Download
              </Button>
              {isLatest && item.status !== 'approved' && (
                <Button
                  size="sm"
                  onClick={() => {
                    onApprove(item.id);
                    handleOpenChange(false);
                  }}
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  Approve
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}