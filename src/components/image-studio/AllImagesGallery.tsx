import { useState, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Clock, CheckCircle2, XCircle, Layers, Pencil, AlertTriangle, RefreshCw, CheckSquare, Square, LayoutGrid } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { LibraryImageEditDialog, type LogoSettings } from './LibraryImageEditDialog';
import type { ClientImageItem } from '@/hooks/useAllClientImages';

type FilterType = 'all' | 'pending' | 'approved' | 'skipped';
type ImageModel = 'nano-banana' | 'nano-banana-2' | 'nano-banana-pro' | 'dalle3' | 'gpt-image-1.5' | 'ideogram';

interface AllImagesGalleryProps {
  images: ClientImageItem[];
  isLoading: boolean;
  isError?: boolean;
  onRetry?: () => void;
  clientId: string;
  brandLogoUrl?: string | null;
  onApprove: (id: string) => void;
  onSkip: (id: string) => void;
  onDelete: (id: string) => void;
  onAddToCalendar: (item: ClientImageItem) => void;
  onCreateCarousel?: (imageUrls: string[], concepts: string[]) => void;
  onDownload: (url: string, filename: string) => void;
  onRegenerate: (
    itemId: string,
    feedback: string,
    model: ImageModel,
    referenceImages: string[],
    savedReferenceImageIds: string[],
    logoSettings?: LogoSettings
  ) => Promise<void>;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

/** Lightweight image tile that only renders <img> when near viewport */
function LazyImageTile({ 
  img, 
  selectMode, 
  isSelected, 
  onToggleSelect, 
  onClick,
  getStatusIcon,
}: {
  img: ClientImageItem;
  selectMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onClick: () => void;
  getStatusIcon: (status: string) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "group relative aspect-square rounded-lg overflow-hidden border bg-muted cursor-pointer",
        selectMode && isSelected && "ring-2 ring-primary ring-offset-2"
      )}
      onClick={() => {
        if (selectMode) {
          onToggleSelect(img.id, { stopPropagation: () => {} } as React.MouseEvent);
        } else {
          onClick();
        }
      }}
    >
      {isVisible ? (
        <img
          src={img.generated_image_url!}
          alt={img.concept}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          style={{ aspectRatio: '1/1' }}
        />
      ) : (
        <div className="w-full h-full bg-muted animate-pulse" />
      )}

      {/* Select checkbox overlay */}
      {selectMode && (
        <div className="absolute top-2 right-2 z-10">
          <div className={cn(
            'h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all',
            isSelected 
              ? 'bg-primary border-primary text-primary-foreground' 
              : 'bg-background/80 border-muted-foreground/50 backdrop-blur-sm'
          )}>
            {isSelected && <CheckSquare className="h-4 w-4" />}
          </div>
        </div>
      )}
      
      {/* Status Badge */}
      <div className="absolute top-2 left-2">
        <div className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm',
          img.status === 'approved' && 'bg-green-500/20 text-green-100',
          img.status === 'skipped' && 'bg-muted/80 text-muted-foreground',
          (img.status === 'pending' || img.status === 'generating' || img.status === 'regenerating') && 'bg-amber-500/20 text-amber-100'
        )}>
          {getStatusIcon(img.status)}
        </div>
      </div>

      {/* Revision indicator */}
      {!selectMode && img.has_revisions && (
        <div className="absolute top-2 right-2">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm bg-blue-500/20 text-blue-100">
            <Layers className="h-3 w-3" />
            <span>{Math.max(img.attempts ?? 1, (img.revisions?.length ?? 0) + 1)}</span>
          </div>
        </div>
      )}

      {/* Hover Overlay */}
      {!selectMode && isVisible && (
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="text-center text-white">
            <Pencil className="h-5 w-5 mx-auto mb-1" />
            <p className="text-sm font-medium">Click to edit</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function AllImagesGallery({
  images,
  isLoading,
  isError,
  onRetry,
  clientId,
  brandLogoUrl,
  onApprove,
  onSkip,
  onDelete,
  onAddToCalendar,
  onCreateCarousel,
  onDownload,
  onRegenerate,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: AllImagesGalleryProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [editingItem, setEditingItem] = useState<ClientImageItem | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(48); // retained for compatibility

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateCarousel = () => {
    const selectedImages = images.filter(img => selectedIds.has(img.id) && img.generated_image_url);
    const urls = selectedImages.map(img => img.generated_image_url!);
    const concepts = selectedImages.map(img => img.concept);
    if (urls.length >= 2 && onCreateCarousel) {
      onCreateCarousel(urls, concepts);
      setSelectedIds(new Set());
      setSelectMode(false);
    }
  };

  const filteredImages = images.filter(img => {
    if (filter === 'all') return true;
    if (filter === 'pending') return img.status === 'pending' || img.status === 'generating' || img.status === 'regenerating';
    return img.status === filter;
  });

  // Reset pagination when filter changes
  const handleFilterChange = (f: FilterType) => {
    setFilter(f);
    setVisibleCount(48);
  };

  // Sort images by created_at descending (newest first)
  const sortedImages = [...filteredImages].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Keep all currently loaded images; backend pagination controls growth
  const paginatedImages = sortedImages;

  // Group paginated images by the image's creation date
  const groupedImagesMap = new Map<string, { date: Date; images: ClientImageItem[] }>();
  paginatedImages.forEach(img => {
    const imageDate = new Date(img.created_at);
    const dateKey = format(imageDate, 'MMM d, yyyy');
    
    if (!groupedImagesMap.has(dateKey)) {
      groupedImagesMap.set(dateKey, { date: imageDate, images: [] });
    }
    groupedImagesMap.get(dateKey)!.images.push(img);
  });

  // Convert to array and sort groups by date (newest first)
  const sortedGroups = Array.from(groupedImagesMap.entries())
    .sort((a, b) => b[1].date.getTime() - a[1].date.getTime());

  // Convert back to object for rendering compatibility
  const groupedImages = Object.fromEntries(
    sortedGroups.map(([key, value]) => [key, value.images])
  );

  const filterCounts = {
    all: images.length,
    pending: images.filter(i => i.status === 'pending' || i.status === 'generating' || i.status === 'regenerating').length,
    approved: images.filter(i => i.status === 'approved').length,
    skipped: images.filter(i => i.status === 'skipped').length,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case 'skipped':
        return <XCircle className="h-3.5 w-3.5 text-muted-foreground" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-amber-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex gap-2 mb-6">
          {['All', 'Pending', 'Approved', 'Skipped'].map((label) => (
            <Skeleton key={label} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <p className="text-lg font-medium mb-1">Failed to load images</p>
          <p className="text-sm text-muted-foreground mb-4">There was a problem connecting to the database</p>
          {onRetry && (
            <Button variant="outline" onClick={onRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium mb-1">No images yet</p>
          <p className="text-sm">Generated images will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ScrollArea className="flex-1 h-full">
        <div className="p-6">
          {/* Filter Pills + Select Mode */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <div className="flex gap-2 flex-wrap">
              {(['all', 'pending', 'approved', 'skipped'] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => handleFilterChange(f)}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5',
                    filter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  )}
                >
                  <span className="capitalize">{f}</span>
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full',
                    filter === f ? 'bg-primary-foreground/20' : 'bg-background'
                  )}>
                    {filterCounts[f]}
                  </span>
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-2">
              {selectMode && selectedIds.size >= 2 && onCreateCarousel && (
                <Button
                  size="sm"
                  onClick={handleCreateCarousel}
                  className="gap-1.5"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Create Carousel ({selectedIds.size})
                </Button>
              )}
              <Button
                size="sm"
                variant={selectMode ? 'default' : 'outline'}
                onClick={() => {
                  setSelectMode(!selectMode);
                  if (selectMode) setSelectedIds(new Set());
                }}
                className="gap-1.5"
              >
                {selectMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {selectMode ? `${selectedIds.size} selected` : 'Select'}
              </Button>
            </div>
          </div>

          {/* Grouped Images */}
          {Object.entries(groupedImages).length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <p>No images match the current filter</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedImages).map(([groupKey, groupImages]) => (
                <div key={groupKey}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    {groupKey}
                    <Badge variant="secondary" className="text-xs">
                      {groupImages.length}
                    </Badge>
                  </h3>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {groupImages.map((img) => (
                      <LazyImageTile
                        key={img.id}
                        img={img}
                        selectMode={selectMode}
                        isSelected={selectedIds.has(img.id)}
                        onToggleSelect={toggleSelect}
                        onClick={() => setEditingItem(img)}
                        getStatusIcon={getStatusIcon}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-6 pb-2">
              <Button
                variant="outline"
                onClick={() => onLoadMore?.()}
                disabled={isLoadingMore}
                className="gap-2"
              >
                {isLoadingMore ? 'Loading…' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>


      {/* Edit Dialog - now with all actions */}
      <LibraryImageEditDialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
        clientId={clientId}
        brandLogoUrl={brandLogoUrl}
        onRegenerate={onRegenerate}
        onApprove={onApprove}
        onSkip={onSkip}
        onDelete={onDelete}
        onDownload={onDownload}
        onAddToCalendar={onAddToCalendar}
      />
    </div>
  );
}
