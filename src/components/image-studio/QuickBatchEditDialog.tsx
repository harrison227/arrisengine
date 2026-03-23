import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, Download, CalendarPlus, Sparkles } from 'lucide-react';
import type { QuickConceptData } from './QuickImageConceptCard';

type ImageModel = 'nano-banana' | 'dalle3' | 'gpt-image-1.5' | 'ideogram';

interface QuickBatchEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  concept: QuickConceptData | null;
  onRegenerate: (conceptId: string, feedback: string, model: ImageModel) => Promise<void>;
  onAddToCalendar: (concept: QuickConceptData) => void;
  onDownload: (url: string, name: string) => void;
}

export function QuickBatchEditDialog({
  open,
  onOpenChange,
  concept,
  onRegenerate,
  onAddToCalendar,
  onDownload,
}: QuickBatchEditDialogProps) {
  const [feedback, setFeedback] = useState('');
  const [selectedModel, setSelectedModel] = useState<ImageModel>('nano-banana');
  const [isRegenerating, setIsRegenerating] = useState(false);

  if (!concept) return null;

  const handleRegenerate = async () => {
    if (!feedback.trim()) return;
    
    setIsRegenerating(true);
    try {
      await onRegenerate(concept.id, feedback.trim(), selectedModel);
      setFeedback('');
      onOpenChange(false);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDownloadClick = () => {
    if (concept.resultUrl) {
      onDownload(concept.resultUrl, `${concept.description.slice(0, 20)}.png`);
    }
  };

  const handleAddToCalendarClick = () => {
    onAddToCalendar(concept);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Edit & Regenerate
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Image Preview */}
          <div className="space-y-3">
            <div className="rounded-xl overflow-hidden border bg-muted">
              {concept.resultUrl ? (
                <img
                  src={concept.resultUrl}
                  alt={concept.description}
                  className="w-full h-auto"
                />
              ) : (
                <div className="aspect-square flex items-center justify-center">
                  <p className="text-muted-foreground">No image</p>
                </div>
              )}
            </div>
            
            {/* Current Description */}
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="font-medium text-xs text-muted-foreground mb-1">Original Concept</p>
              <p className="line-clamp-3">{concept.description}</p>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadClick}
                className="flex-1 gap-2"
                disabled={!concept.resultUrl}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button
                variant="outline"
                onClick={handleAddToCalendarClick}
                className="flex-1 gap-2"
                disabled={!concept.resultUrl}
              >
                <CalendarPlus className="h-4 w-4" />
                Add to Calendar
              </Button>
            </div>
          </div>

          {/* Feedback & Regenerate */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">
                AI Feedback / Edit Instructions
              </Label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="E.g., 'Make the text larger', 'Use warmer colors', 'Add more contrast', 'Change background to blue'"
                className="h-32 resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Describe what changes you want. The AI will regenerate with your feedback.
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">
                Model for Regeneration
              </Label>
              <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as ImageModel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nano-banana">Nano Banana Pro</SelectItem>
                  <SelectItem value="dalle3">DALL-E 3</SelectItem>
                  <SelectItem value="gpt-image-1.5">GPT Image 1.5</SelectItem>
                  <SelectItem value="ideogram">Ideogram 3.0</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleRegenerate}
              disabled={isRegenerating || !feedback.trim()}
              size="lg"
              className="w-full gap-2"
            >
              {isRegenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Regenerate with Feedback
            </Button>

            {/* Prompt History */}
            {concept.aiPrompt && (
              <div className="mt-4 p-3 rounded-lg border bg-card">
                <p className="text-xs font-medium text-muted-foreground mb-1">Current Prompt</p>
                <p className="text-sm line-clamp-4">{concept.aiPrompt}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
