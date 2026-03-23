import { useState } from 'react';
import { Download, Calendar, Sparkles, Loader2, RefreshCw, ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type ImageModel = 'nano-banana' | 'dalle3' | 'gpt-image-1.5' | 'ideogram';

export interface RegenerateLogoSettings {
  includeLogo: boolean;
  logoUrl: string | undefined;
}

interface QuickGenerateResultDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  prompt: string;
  clientId: string;
  brandLogoUrl?: string | null;
  onAddToCalendar: (imageUrl: string, caption: string, hashtags: string[]) => void;
  onRegenerate?: (feedback?: string, model?: ImageModel, logoSettings?: RegenerateLogoSettings) => Promise<void>;
  isRegenerating?: boolean;
}

export function QuickGenerateResultDialog({
  isOpen,
  onClose,
  imageUrl,
  prompt,
  clientId,
  brandLogoUrl,
  onAddToCalendar,
  onRegenerate,
  isRegenerating = false,
}: QuickGenerateResultDialogProps) {
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [generatedCaption, setGeneratedCaption] = useState('');
  const [generatedHashtags, setGeneratedHashtags] = useState<string[]>([]);
  const [showRegenerateOptions, setShowRegenerateOptions] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [selectedModel, setSelectedModel] = useState<ImageModel>('nano-banana');
  const [includeLogoInRegen, setIncludeLogoInRegen] = useState(!!brandLogoUrl);
  const { toast } = useToast();

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `generated-image-${Date.now()}.png`;
    link.click();
  };

  const handleGenerateCaptionAndHashtags = async () => {
    if (!clientId) return;
    
    setIsGeneratingCaption(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-hashtags', {
        body: { 
          clientId, 
          title: prompt,
          caption: `Image generated with prompt: ${prompt}`,
          includeCaption: true
        }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      const hashtags = data.hashtags as string[];
      setGeneratedHashtags(hashtags);
      
      setGeneratedCaption(data.caption || prompt);
      
      toast({ title: 'Caption and hashtags generated!' });
    } catch (error) {
      console.error('Error generating:', error);
      toast({
        title: 'Failed to generate',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handleAddToCalendar = () => {
    if (!imageUrl) return;
    onAddToCalendar(imageUrl, generatedCaption || prompt, generatedHashtags);
    onClose();
  };

  const handleSubmitRegenerate = async () => {
    if (!onRegenerate) return;
    const logoSettings: RegenerateLogoSettings | undefined = brandLogoUrl
      ? { includeLogo: includeLogoInRegen, logoUrl: includeLogoInRegen ? brandLogoUrl : undefined }
      : undefined;
    await onRegenerate(feedback.trim() || undefined, selectedModel, logoSettings);
    setFeedback('');
    setShowRegenerateOptions(false);
  };

  if (!imageUrl) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generated Image</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Image Preview */}
          <div className="relative flex justify-center bg-muted rounded-lg p-4">
            {isRegenerating && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <img 
              src={imageUrl} 
              alt="Generated" 
              className="max-h-[400px] rounded-lg object-contain"
            />
          </div>
          
          {/* Prompt */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Prompt
            </label>
            <p className="mt-1 text-sm">{prompt}</p>
          </div>
          
          {/* Generated Caption & Hashtags */}
          {(generatedCaption || generatedHashtags.length > 0) && (
            <div className="space-y-2 p-3 bg-muted rounded-lg">
              {generatedCaption && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Caption
                  </label>
                  <p className="mt-1 text-sm">{generatedCaption}</p>
                </div>
              )}
              {generatedHashtags.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Hashtags
                  </label>
                  <p className="mt-1 text-sm text-primary">{generatedHashtags.join(' ')}</p>
                </div>
              )}
            </div>
          )}

          {/* Regenerate Options */}
          {showRegenerateOptions && (
            <div className="space-y-3 p-3 bg-muted rounded-lg border">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Model
                </label>
                <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as ImageModel)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nano-banana">Nano Banana Pro</SelectItem>
                    <SelectItem value="dalle3">DALL-E 3</SelectItem>
                    <SelectItem value="gpt-image-1.5">GPT Image 1.5</SelectItem>
                    <SelectItem value="ideogram">Ideogram v3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Logo Toggle */}
              {brandLogoUrl && (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                  <Checkbox
                    id="include-logo-regen"
                    checked={includeLogoInRegen}
                    onCheckedChange={(checked) => setIncludeLogoInRegen(!!checked)}
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <div className="h-8 w-8 rounded border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                      <img src={brandLogoUrl} alt="Logo" className="h-6 w-6 object-contain" />
                    </div>
                    <Label htmlFor="include-logo-regen" className="text-sm cursor-pointer">
                      Add logo to image
                    </Label>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Feedback (optional)
                </label>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="What would you like to change?"
                  className="mt-1"
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRegenerateOptions(false)}
                  disabled={isRegenerating}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmitRegenerate}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Regenerate
                </Button>
              </div>
            </div>
          )}
          
          {/* Actions */}
          {!showRegenerateOptions && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>

              {onRegenerate && (
                <Button 
                  variant="outline" 
                  onClick={() => setShowRegenerateOptions(true)}
                  disabled={isRegenerating}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              )}
              
              <Button 
                variant="outline" 
                onClick={handleGenerateCaptionAndHashtags}
                disabled={isGeneratingCaption}
              >
                {isGeneratingCaption ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate Caption & Hashtags
              </Button>
              
              <Button onClick={handleAddToCalendar} className="flex-1">
                <Calendar className="h-4 w-4 mr-2" />
                Add to Content Calendar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
