import { useState } from 'react';
import { Check, Loader2, RotateCcw, CheckCircle, XCircle, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export interface GalleryItem {
  id: string;
  sequence_number: number;
  template_type: string;
  concept: string;
  platform: string | null;
  status: string | null;
  generated_image_url: string | null;
  feedback: string | null;
  model_used: string | null;
  carousel_group_id?: string | null;
}

type FilterType = 'all' | 'pending' | 'approved' | 'skipped';

interface GenerationGalleryProps {
  items: GalleryItem[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onItemClick: (item: GalleryItem, carouselSlides?: GalleryItem[]) => void;
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  isLoading?: boolean;
}

const templateLabels: Record<string, string> = {
  quote_card: 'Quote',
  stat_graphic: 'Stats',
  announcement: 'Announce',
  testimonial: 'Testimonial',
  tips_carousel: 'Tips',
  behind_the_scenes: 'BTS',
  promotional: 'Promo',
};

export function GenerationGallery({
  items,
  selectedIds,
  onToggleSelect,
  onItemClick,
  filter,
  onFilterChange,
  isLoading,
}: GenerationGalleryProps) {
  const [carouselIndices, setCarouselIndices] = useState<Record<string, number>>({});

  // Group items by carousel_group_id
  const groupedItems = items.reduce((acc, item) => {
    if (item.carousel_group_id) {
      if (!acc.carousels[item.carousel_group_id]) {
        acc.carousels[item.carousel_group_id] = [];
      }
      acc.carousels[item.carousel_group_id].push(item);
    } else {
      acc.singles.push(item);
    }
    return acc;
  }, { carousels: {} as Record<string, GalleryItem[]>, singles: [] as GalleryItem[] });

  // Sort carousel slides by sequence number
  Object.keys(groupedItems.carousels).forEach(groupId => {
    groupedItems.carousels[groupId].sort((a, b) => a.sequence_number - b.sequence_number);
  });

  // Create display items: singles + first item of each carousel
  const displayItems: (GalleryItem | { isCarousel: true; groupId: string; slides: GalleryItem[] })[] = [];
  
  const carouselFirstItems = Object.entries(groupedItems.carousels).map(([groupId, slides]) => ({
    isCarousel: true as const,
    groupId,
    slides,
    sequence_number: Math.min(...slides.map(s => s.sequence_number))
  }));
  
  const allItems = [
    ...groupedItems.singles.map(item => ({ ...item, isCarousel: false as const })),
    ...carouselFirstItems
  ].sort((a, b) => a.sequence_number - b.sequence_number);
  
  allItems.forEach(item => {
    if ('isCarousel' in item && item.isCarousel === true && 'slides' in item) {
      displayItems.push(item as { isCarousel: true; groupId: string; slides: GalleryItem[] });
    } else {
      displayItems.push(item as GalleryItem);
    }
  });

  const filteredItems = displayItems.filter((item) => {
    if ('isCarousel' in item && item.isCarousel) {
      const slides = item.slides;
      if (filter === 'all') return true;
      if (filter === 'pending') return slides.some(s => s.status === 'pending' || s.status === 'generating' || s.status === 'regenerating' || !s.status);
      if (filter === 'approved') return slides.every(s => s.status === 'approved');
      if (filter === 'skipped') return slides.every(s => s.status === 'skipped');
      return true;
    } else {
      const singleItem = item as GalleryItem;
      if (filter === 'all') return true;
      if (filter === 'pending') return singleItem.status === 'pending' || singleItem.status === 'generating' || singleItem.status === 'regenerating' || !singleItem.status;
      if (filter === 'approved') return singleItem.status === 'approved';
      if (filter === 'skipped') return singleItem.status === 'skipped';
      return true;
    }
  });

  const counts = {
    all: items.length,
    pending: items.filter(i => i.status === 'pending' || i.status === 'generating' || i.status === 'regenerating' || !i.status).length,
    approved: items.filter(i => i.status === 'approved').length,
    skipped: items.filter(i => i.status === 'skipped').length,
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-2">
          {['All', 'Pending', 'Approved'].map((label) => (
            <Skeleton key={label} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const filters: { key: FilterType; label: string; icon?: typeof CheckCircle }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending', icon: RotateCcw },
    { key: 'approved', label: 'Approved', icon: CheckCircle },
    { key: 'skipped', label: 'Skipped', icon: XCircle },
  ];

  return (
    <div className="space-y-6">
      {/* Filter Pills */}
      <div className="flex gap-2 flex-wrap">
        {filters.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onFilterChange(key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all',
              filter === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-foreground'
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {label}
            {counts[key] > 0 && (
              <span className={cn(
                'px-2 py-0.5 rounded-full text-xs font-bold',
                filter === key ? 'bg-primary-foreground/20' : 'bg-background'
              )}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Gallery Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
            <Layers className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No images in this category</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {filteredItems.map((item) => {
            // Handle carousel groups
            if ('isCarousel' in item && item.isCarousel) {
              const slides = item.slides;
              const currentIndex = carouselIndices[item.groupId] || 0;
              const currentSlide = slides[currentIndex];
              const allApproved = slides.every(s => s.status === 'approved');
              const allSkipped = slides.every(s => s.status === 'skipped');
              const anyGenerating = slides.some(s => s.status === 'generating' || s.status === 'regenerating');
              const generatedCount = slides.filter(s => !!s.generated_image_url).length;

              return (
                <div
                  key={item.groupId}
                  className={cn(
                    'group relative aspect-[4/5] rounded-xl overflow-hidden transition-all cursor-pointer border bg-card hover:shadow-md',
                    allApproved && 'ring-2 ring-green-500 ring-offset-2',
                    allSkipped && 'opacity-50'
                  )}
                  onClick={() => currentSlide?.generated_image_url && onItemClick(currentSlide, slides)}
                >
                  {/* Carousel badge */}
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    <Layers className="h-3 w-3" />
                    {currentIndex + 1}/{slides.length}
                  </div>

                  {/* Navigation dots */}
                  <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 flex gap-1">
                    {slides.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCarouselIndices(prev => ({ ...prev, [item.groupId]: idx }));
                        }}
                        className={cn(
                          'w-1.5 h-1.5 rounded-full transition-all',
                          idx === currentIndex ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/70'
                        )}
                      />
                    ))}
                  </div>

                  {/* Current slide image */}
                  {currentSlide?.generated_image_url ? (
                    <img
                      src={currentSlide.generated_image_url}
                      alt={currentSlide.concept}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      {anyGenerating ? (
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      ) : (
                        <div className="text-center p-4">
                          <p className="text-xs text-muted-foreground">
                            {generatedCount}/{slides.length} slides
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <Badge variant="secondary" className="text-xs">
                        Carousel
                      </Badge>
                    </div>
                  </div>

                  {/* Approved indicator */}
                  {allApproved && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              );
            }

            // Handle single items
            const singleItem = item as GalleryItem;
            const isSelected = selectedIds.has(singleItem.id);
            const isGenerating = singleItem.status === 'generating' || singleItem.status === 'regenerating';
            const hasImage = !!singleItem.generated_image_url;
            const isApproved = singleItem.status === 'approved';
            const isSkipped = singleItem.status === 'skipped';

            return (
              <div
                key={singleItem.id}
                className={cn(
                  'group relative aspect-[4/5] rounded-xl overflow-hidden transition-all cursor-pointer border bg-card hover:shadow-md',
                  isSelected && 'ring-2 ring-primary ring-offset-2',
                  isApproved && !isSelected && 'ring-2 ring-green-500 ring-offset-2',
                  isSkipped && 'opacity-50'
                )}
                onClick={() => hasImage && onItemClick(singleItem)}
              >
                {/* Image or placeholder */}
                {hasImage ? (
                  <img
                    src={singleItem.generated_image_url!}
                    alt={singleItem.concept}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center p-4">
                    {isGenerating ? (
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Generating...</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground line-clamp-4 text-center">
                        {singleItem.concept}
                      </p>
                    )}
                  </div>
                )}

                {/* Hover overlay */}
                {hasImage && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <Badge variant="secondary" className="text-xs">
                        {templateLabels[singleItem.template_type] || singleItem.template_type}
                      </Badge>
                    </div>
                  </div>
                )}

                {/* Selection checkbox */}
                {hasImage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(singleItem.id);
                    }}
                    className={cn(
                      'absolute top-2 left-2 h-6 w-6 rounded-full flex items-center justify-center transition-all',
                      isSelected
                        ? 'bg-primary'
                        : 'bg-white/80 hover:bg-white'
                    )}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                  </button>
                )}

                {/* Status indicators */}
                {isApproved && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}

                {/* Sequence number */}
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/50 backdrop-blur text-[9px] font-mono text-white">
                  #{singleItem.sequence_number}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
