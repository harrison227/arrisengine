import { useState, useEffect, useRef } from 'react';
import { Check, RotateCcw, SkipForward, Download, ExternalLink, Calendar, ChevronLeft, ChevronRight, Trash2, Loader2, ImagePlus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useImageRevisions, type ImageRevision } from '@/hooks/useImageRevisions';
import type { GalleryItem } from './GenerationGallery';

type ImageModel = 'nano-banana' | 'nano-banana-2' | 'dalle3' | 'gpt-image-1.5' | 'ideogram';

interface ImageDetailModalProps {
  item: GalleryItem | null;
  carouselSlides?: GalleryItem[];
  isOpen: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onSkip: (id: string) => void;
  onRegenerate: (id: string, feedback?: string, model?: ImageModel, referenceImageUrl?: string, additionalReferenceImages?: string[]) => void;
  onDelete: (id: string) => void;
  onAddToCalendar?: (item: GalleryItem) => void;
  isRegenerating?: boolean;
}

const templateLabels: Record<string, string> = {
  quote_card: 'Quote Card',
  stat_graphic: 'Stats Graphic',
  announcement: 'Announcement',
  testimonial: 'Testimonial',
  tips_carousel: 'Tips/Educational',
  behind_the_scenes: 'Behind the Scenes',
  promotional: 'Promotional',
  quick_generate: 'Quick Generate',
};

const modelLabels: Record<ImageModel, string> = {
  'nano-banana': 'Nano Banana Pro',
  'nano-banana-2': 'Nano Banana 2',
  'dalle3': 'DALL-E 3',
  'gpt-image-1.5': 'GPT Image 1.5',
  'ideogram': 'Ideogram v3',
};

export function ImageDetailModal({
  item,
  carouselSlides,
  isOpen,
  onClose,
  onApprove,
  onSkip,
  onRegenerate,
  onDelete,
  onAddToCalendar,
  isRegenerating,
}: ImageDetailModalProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showRegenerateOptions, setShowRegenerateOptions] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [selectedModel, setSelectedModel] = useState<ImageModel>('nano-banana');
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1); // -1 means current/latest
  const [imageLoading, setImageLoading] = useState(true);
  const [additionalRefImages, setAdditionalRefImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Fetch revisions for this item
  const { revisions, isLoading: revisionsLoading, deleteRevision, isDeletingRevision } = useImageRevisions(item?.id);
  
  // Build versions array: revisions + current (current is index -1)
  const allVersions = [
    ...revisions.map(r => ({
      version: r.version,
      imageUrl: r.imageUrl,
      feedback: r.feedback,
      model_used: r.model_used,
    })),
    // Current version is implicit and shown when index is -1
  ];
  
  // Get model for currently displayed version
  const getCurrentVersionModel = (): ImageModel => {
    if (currentVersionIndex === -1) {
      return (item?.model_used as ImageModel) || 'nano-banana';
    }
    return (allVersions[currentVersionIndex]?.model_used as ImageModel) || 'nano-banana';
  };
  
  // Reset state when item changes
  useEffect(() => {
    if (item) {
      setSelectedModel((item.model_used as ImageModel) || 'nano-banana');
      setShowRegenerateOptions(false);
      setFeedback('');
      setCurrentVersionIndex(-1); // Start at current/latest
      setImageLoading(true);
      setAdditionalRefImages([]);
      // Reset slide index, find which slide we clicked
      if (carouselSlides && carouselSlides.length > 0) {
        const idx = carouselSlides.findIndex(s => s.id === item.id);
        setCurrentSlideIndex(idx >= 0 ? idx : 0);
      } else {
        setCurrentSlideIndex(0);
      }
    }
  }, [item?.id, item?.model_used, carouselSlides]);
  
  // Update selected model when viewing a different version
  useEffect(() => {
    if (!showRegenerateOptions) {
      setSelectedModel(getCurrentVersionModel());
    }
  }, [currentVersionIndex, revisions]);

  if (!item) return null;
  
  // Determine the active item (from carousel or single)
  const isCarousel = carouselSlides && carouselSlides.length > 1;
  const activeItem = isCarousel ? carouselSlides[currentSlideIndex] || item : item;
  
  const totalVersions = allVersions.length + (activeItem.generated_image_url ? 1 : 0);
  
  // Get the image to display
  const getCurrentImageUrl = () => {
    if (currentVersionIndex === -1) {
      return activeItem.generated_image_url;
    }
    return allVersions[currentVersionIndex]?.imageUrl;
  };
  
  const getCurrentVersionLabel = () => {
    if (currentVersionIndex === -1) {
      return `v${totalVersions} (current)`;
    }
    return `v${currentVersionIndex + 1}`;
  };

  const handleApprove = () => {
    onApprove(activeItem.id);
  };
  
  const handleApproveAndAddToCalendar = () => {
    onApprove(activeItem.id);
    onAddToCalendar?.(activeItem);
    onClose();
  };

  const handleSkip = () => {
    onSkip(activeItem.id);
    // Don't close if carousel - just move to next slide
    if (isCarousel && currentSlideIndex < carouselSlides!.length - 1) {
      setCurrentSlideIndex(i => i + 1);
      setCurrentVersionIndex(-1);
      setImageLoading(true);
    } else {
      onClose();
    }
  };

  const handleSubmitRegenerate = () => {
    const currentImageUrl = getCurrentImageUrl(); // Use currently displayed version
    onRegenerate(
      activeItem.id, 
      feedback.trim() || undefined, 
      selectedModel, 
      currentImageUrl || undefined,
      additionalRefImages.length > 0 ? additionalRefImages : undefined
    );
    setFeedback('');
    setShowRegenerateOptions(false);
    setAdditionalRefImages([]);
  };

  const handleAddReferenceImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setAdditionalRefImages(prev => [...prev, dataUrl]);
      }
    };
    reader.readAsDataURL(file);
    
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveRefImage = (index: number) => {
    setAdditionalRefImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleDelete = async () => {
    // If viewing a revision (not the current version), delete just that revision
    if (currentVersionIndex !== -1 && allVersions[currentVersionIndex]) {
      const revision = allVersions[currentVersionIndex];
      if (confirm(`Delete version ${currentVersionIndex + 1}? This cannot be undone.`)) {
        // Find the revision ID from the revisions array
        const revisionToDelete = revisions.find(r => r.version === revision.version);
        if (revisionToDelete) {
          try {
            await deleteRevision(revisionToDelete.id);
            // Move to a valid version after deletion
            if (currentVersionIndex > 0) {
              setCurrentVersionIndex(currentVersionIndex - 1);
            } else {
              setCurrentVersionIndex(-1); // Go to current
            }
          } catch (error) {
            // Error toast is already shown by the hook
          }
        }
      }
    } else {
      // Deleting current/latest version means deleting the entire item
      if (confirm('Delete this image and all its versions? This cannot be undone.')) {
        onDelete(item.id);
        onClose();
      }
    }
  };

  const handleDownload = () => {
    const imageUrl = getCurrentImageUrl();
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `image-${item.sequence_number}-v${currentVersionIndex === -1 ? totalVersions : currentVersionIndex + 1}.png`;
    link.click();
  };

  const handleOpenInNewTab = () => {
    const imageUrl = getCurrentImageUrl();
    if (!imageUrl) return;
    window.open(imageUrl, '_blank');
  };

  const isApproved = activeItem.status === 'approved';
  const isSkipped = activeItem.status === 'skipped';
  const displayImageUrl = getCurrentImageUrl();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0 overflow-hidden" aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>Image Details</DialogTitle>
        </VisuallyHidden>
        <div className="flex flex-col lg:flex-row max-h-[90vh]">
          {/* Image */}
          <div className="flex-1 bg-black flex flex-col items-center justify-center min-h-[250px] lg:min-h-[400px] max-h-[50vh] lg:max-h-[90vh] relative">
            {displayImageUrl ? (
              <>
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-white/50" />
                  </div>
                )}
                <img
                  src={displayImageUrl}
                  alt={activeItem.concept}
                  className={cn("max-w-full max-h-[350px] lg:max-h-[80vh] object-contain", imageLoading && "opacity-0")}
                  onLoad={() => setImageLoading(false)}
                />
              </>
            ) : (
              <div className="text-white/50">No image generated</div>
            )}
            
            {/* Carousel slide navigation */}
            {isCarousel && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white hover:text-white hover:bg-white/20"
                  disabled={currentSlideIndex === 0}
                  onClick={() => {
                    setCurrentSlideIndex(i => i - 1);
                    setCurrentVersionIndex(-1);
                    setImageLoading(true);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-white/80 min-w-[60px] text-center font-medium">
                  Slide {currentSlideIndex + 1}/{carouselSlides!.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white hover:text-white hover:bg-white/20"
                  disabled={currentSlideIndex === carouselSlides!.length - 1}
                  onClick={() => {
                    setCurrentSlideIndex(i => i + 1);
                    setCurrentVersionIndex(-1);
                    setImageLoading(true);
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            {/* Version navigation arrows */}
            {totalVersions > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white hover:text-white hover:bg-white/20"
                  disabled={currentVersionIndex === 0 || (currentVersionIndex === -1 && allVersions.length === 0)}
                  onClick={() => {
                    if (currentVersionIndex === -1) {
                      // Go to last revision
                      setCurrentVersionIndex(allVersions.length - 1);
                    } else {
                      setCurrentVersionIndex(i => Math.max(0, i - 1));
                    }
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-white/80 min-w-[80px] text-center">
                  {getCurrentVersionLabel()} / {totalVersions}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white hover:text-white hover:bg-white/20"
                  disabled={currentVersionIndex === -1}
                  onClick={() => {
                    if (currentVersionIndex === allVersions.length - 1) {
                      // Go to current
                      setCurrentVersionIndex(-1);
                    } else {
                      setCurrentVersionIndex(i => i + 1);
                    }
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Details panel */}
          <div className="w-full lg:w-80 border-l flex flex-col">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold">#{activeItem.sequence_number}</span>
                <Badge variant="secondary">
                  {templateLabels[activeItem.template_type] || activeItem.template_type}
                </Badge>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 space-y-4 overflow-auto">
              {/* Status */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Status
                </label>
                <div className="mt-1">
                  {isRegenerating ? (
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      {activeItem.generated_image_url ? 'Regenerating…' : 'Generating…'}
                    </Badge>
                  ) : (
                    <>
                      {isApproved && (
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                          Approved
                        </Badge>
                      )}
                      {isSkipped && (
                        <Badge className="bg-muted text-muted-foreground">
                          Skipped
                        </Badge>
                      )}
                      {!isApproved && !isSkipped && (
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                          Pending Review
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Model used */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Model Used
                </label>
                <p className="mt-1 text-sm">
                  {modelLabels[(activeItem.model_used as ImageModel) || 'nano-banana'] || activeItem.model_used || 'Unknown'}
                </p>
              </div>

              {/* Platform */}
              {activeItem.platform && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Platform
                  </label>
                  <p className="mt-1 text-sm">{activeItem.platform}</p>
                </div>
              )}

              {/* Concept */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Concept
                </label>
                <p className="mt-1 text-sm">{activeItem.concept}</p>
              </div>

              {/* Previous feedback (from current item) */}
              {activeItem.feedback && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Last Feedback
                  </label>
                  <p className="mt-1 text-sm text-muted-foreground italic">
                    "{activeItem.feedback}"
                  </p>
                </div>
              )}

              {/* Viewing old version info */}
              {currentVersionIndex !== -1 && allVersions[currentVersionIndex] && (
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Viewing Version {currentVersionIndex + 1}
                  </div>
                  {allVersions[currentVersionIndex].model_used && (
                    <p className="text-xs text-muted-foreground">
                      Model: {modelLabels[allVersions[currentVersionIndex].model_used as ImageModel] || allVersions[currentVersionIndex].model_used}
                    </p>
                  )}
                  {allVersions[currentVersionIndex].feedback && (
                    <p className="text-xs text-muted-foreground italic">
                      Feedback: "{allVersions[currentVersionIndex].feedback}"
                    </p>
                  )}
                </div>
              )}

              {/* Regeneration options */}
              {showRegenerateOptions && (
                <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Model
                    </Label>
                    <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as ImageModel)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nano-banana">Nano Banana Pro</SelectItem>
                        <SelectItem value="nano-banana-2">Nano Banana 2</SelectItem>
                        <SelectItem value="dalle3">DALL-E 3</SelectItem>
                        <SelectItem value="gpt-image-1.5">GPT Image 1.5</SelectItem>
                        <SelectItem value="ideogram">Ideogram v3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Feedback / Instructions
                    </Label>
                    <Textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="E.g., 'Make the text larger' or 'Use warmer colors'"
                      className="mt-1 resize-none h-20"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Reference Images (Optional)
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                      Add images to guide the regeneration (e.g., background, style reference)
                    </p>
                    
                    {/* Preview of added reference images */}
                    {additionalRefImages.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {additionalRefImages.map((img, idx) => (
                          <div key={idx} className="relative group">
                            <img 
                              src={img} 
                              alt={`Reference ${idx + 1}`} 
                              className="w-14 h-14 object-cover rounded border"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveRefImage(idx)}
                              className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAddReferenceImage}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                    >
                      <ImagePlus className="h-4 w-4 mr-2" />
                      Add Reference Image
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setShowRegenerateOptions(false);
                        setAdditionalRefImages([]);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleSubmitRegenerate}
                      disabled={isRegenerating}
                    >
                      <RotateCcw className={cn("h-4 w-4 mr-1", isRegenerating && "animate-spin")} />
                      Regenerate
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t space-y-2">
              {/* Quick actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleOpenInNewTab}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeletingRevision}
                  title={currentVersionIndex !== -1 ? `Delete version ${currentVersionIndex + 1}` : 'Delete all versions'}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Regenerate button - always visible */}
              {!showRegenerateOptions && (
                <Button
                  variant="outline"
                  onClick={() => {
                    // Ensure the default model matches the currently viewed version
                    setSelectedModel(getCurrentVersionModel());
                    setShowRegenerateOptions(true);
                  }}
                  disabled={isRegenerating}
                  className="w-full"
                >
                  <RotateCcw className={cn("h-4 w-4 mr-2", isRegenerating && "animate-spin")} />
                  {isRegenerating
                    ? (item.generated_image_url ? 'Regenerating…' : 'Generating…')
                    : (isApproved ? 'Regenerate Anyway' : 'Regenerate with Options')}
                </Button>
              )}

              {/* Approve/Skip - only for non-approved */}
              {!isApproved && !showRegenerateOptions && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSkip}
                    className="w-full"
                  >
                    <SkipForward className="h-4 w-4 mr-1" />
                    Skip
                  </Button>
                  <Button
                    onClick={handleApprove}
                    variant="outline"
                    className="w-full"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </>
              )}

              {/* Add to Calendar - always visible for approved or pending */}
              {!showRegenerateOptions && onAddToCalendar && (
                <Button
                  onClick={isApproved ? () => onAddToCalendar(item) : handleApproveAndAddToCalendar}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {isApproved ? 'Add to Calendar' : 'Approve & Add to Calendar'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
