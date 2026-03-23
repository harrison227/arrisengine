import { useState, useRef } from 'react';
import { X, Check, RotateCcw, SkipForward, Download, Calendar, ChevronLeft, ChevronRight, Trash2, Loader2, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useImageRevisions } from '@/hooks/useImageRevisions';
import type { GalleryItem } from './GenerationGallery';

type ImageModel = 'nano-banana' | 'nano-banana-2' | 'dalle3' | 'gpt-image-1.5' | 'ideogram';

interface ImageInspectorPanelProps {
  item: GalleryItem;
  onClose: () => void;
  onApprove: (id: string) => void;
  onSkip: (id: string) => void;
  onRegenerate: (id: string, feedback?: string, model?: ImageModel, referenceImageUrl?: string, additionalReferenceImages?: string[]) => void;
  onDelete: (id: string) => void;
  onAddToCalendar: (item: GalleryItem) => void;
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

export function ImageInspectorPanel({
  item,
  onClose,
  onApprove,
  onSkip,
  onRegenerate,
  onDelete,
  onAddToCalendar,
  isRegenerating,
}: ImageInspectorPanelProps) {
  const [showRegenerateOptions, setShowRegenerateOptions] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [selectedModel, setSelectedModel] = useState<ImageModel>((item.model_used as ImageModel) || 'nano-banana');
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);
  const [additionalRefImages, setAdditionalRefImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { revisions, deleteRevision, isDeletingRevision } = useImageRevisions(item.id);

  const allVersions = revisions.map(r => ({
    version: r.version,
    imageUrl: r.imageUrl,
    feedback: r.feedback,
    model_used: r.model_used,
  }));

  const totalVersions = allVersions.length + (item.generated_image_url ? 1 : 0);

  const getCurrentImageUrl = () => {
    if (currentVersionIndex === -1) return item.generated_image_url;
    return allVersions[currentVersionIndex]?.imageUrl;
  };

  const isApproved = item.status === 'approved';
  const isSkipped = item.status === 'skipped';

  const handleApprove = () => onApprove(item.id);
  
  const handleApproveAndAddToCalendar = () => {
    onApprove(item.id);
    onAddToCalendar(item);
  };

  const handleSkip = () => {
    onSkip(item.id);
    onClose();
  };

  const handleSubmitRegenerate = () => {
    onRegenerate(
      item.id,
      feedback.trim() || undefined,
      selectedModel,
      getCurrentImageUrl() || undefined,
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
      if (dataUrl) setAdditionalRefImages(prev => [...prev, dataUrl]);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = () => {
    const imageUrl = getCurrentImageUrl();
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `image-${item.sequence_number}.png`;
    link.click();
  };

  const handleDelete = async () => {
    if (currentVersionIndex !== -1 && allVersions[currentVersionIndex]) {
      const revision = revisions.find(r => r.version === allVersions[currentVersionIndex].version);
      if (revision && confirm(`Delete version ${currentVersionIndex + 1}?`)) {
        await deleteRevision(revision.id);
        setCurrentVersionIndex(currentVersionIndex > 0 ? currentVersionIndex - 1 : -1);
      }
    } else {
      if (confirm('Delete this image and all versions?')) {
        onDelete(item.id);
        onClose();
      }
    }
  };

  return (
    <div className="h-full flex flex-col border-l bg-card">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold">#{item.sequence_number}</span>
          <Badge variant="secondary" className="text-xs">
            {templateLabels[item.template_type] || item.template_type}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {/* Image Preview */}
        <div className="bg-black aspect-square flex items-center justify-center relative">
          {getCurrentImageUrl() ? (
            <img
              src={getCurrentImageUrl()!}
              alt={item.concept}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <div className="text-white/50">No image</div>
          )}
          
          {/* Version navigation */}
          {totalVersions > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/60 rounded-full px-2 py-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                disabled={currentVersionIndex === 0}
                onClick={() => setCurrentVersionIndex(i => i === -1 ? allVersions.length - 1 : Math.max(0, i - 1))}
              >
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-xs text-white/80 min-w-[50px] text-center">
                v{currentVersionIndex === -1 ? totalVersions : currentVersionIndex + 1}/{totalVersions}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                disabled={currentVersionIndex === -1}
                onClick={() => setCurrentVersionIndex(i => i === allVersions.length - 1 ? -1 : i + 1)}
              >
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="p-3 space-y-3">
          {/* Status */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
            <div className="mt-1">
              {isRegenerating ? (
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Regenerating…
                </Badge>
              ) : isApproved ? (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Approved</Badge>
              ) : isSkipped ? (
                <Badge className="bg-muted text-muted-foreground">Skipped</Badge>
              ) : (
                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Pending</Badge>
              )}
            </div>
          </div>

          {/* Model */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Model</label>
            <p className="text-sm mt-1">{modelLabels[(item.model_used as ImageModel) || 'nano-banana']}</p>
          </div>

          {/* Concept */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Concept</label>
            <p className="text-sm mt-1">{item.concept}</p>
          </div>

          {/* Regenerate options */}
          {showRegenerateOptions && (
            <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
              <div>
                <Label className="text-xs">Model</Label>
                <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as ImageModel)}>
                  <SelectTrigger className="mt-1 h-8">
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
                <Label className="text-xs">Feedback</Label>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="E.g., 'Make text larger'"
                  className="mt-1 resize-none h-16 text-sm"
                />
              </div>
              
              {additionalRefImages.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {additionalRefImages.map((img, idx) => (
                    <div key={idx} className="relative">
                      <img src={img} alt="" className="w-10 h-10 object-cover rounded border" />
                      <button
                        onClick={() => setAdditionalRefImages(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAddReferenceImage} className="hidden" />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="w-full">
                <ImagePlus className="h-3.5 w-3.5 mr-1.5" />
                Add Reference
              </Button>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                  setShowRegenerateOptions(false);
                  setAdditionalRefImages([]);
                }}>
                  Cancel
                </Button>
                <Button size="sm" className="flex-1" onClick={handleSubmitRegenerate} disabled={isRegenerating}>
                  <RotateCcw className={cn("h-3.5 w-3.5 mr-1", isRegenerating && "animate-spin")} />
                  Regenerate
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Actions */}
      <div className="p-3 border-t space-y-2 shrink-0">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5 mr-1" />
            Download
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeletingRevision}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {!showRegenerateOptions && (
          <Button
            variant="outline"
            onClick={() => setShowRegenerateOptions(true)}
            disabled={isRegenerating}
            className="w-full"
            size="sm"
          >
            <RotateCcw className={cn("h-3.5 w-3.5 mr-1.5", isRegenerating && "animate-spin")} />
            Regenerate
          </Button>
        )}

        {!isApproved && !showRegenerateOptions && (
          <>
            <Button variant="outline" size="sm" onClick={handleSkip} className="w-full">
              <SkipForward className="h-3.5 w-3.5 mr-1" />
              Skip
            </Button>
            <Button variant="outline" size="sm" onClick={handleApprove} className="w-full">
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Approve
            </Button>
          </>
        )}

        {!showRegenerateOptions && (
          <Button
            onClick={isApproved ? () => onAddToCalendar(item) : handleApproveAndAddToCalendar}
            className="w-full bg-green-600 hover:bg-green-700"
            size="sm"
          >
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            {isApproved ? 'Add to Calendar' : 'Approve & Add'}
          </Button>
        )}
      </div>
    </div>
  );
}
