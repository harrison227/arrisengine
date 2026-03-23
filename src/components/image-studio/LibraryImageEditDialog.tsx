import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Sparkles, ImagePlus, Library, Check, Upload, Image as ImageIcon, Download, Trash2, CalendarPlus, SkipForward, Layers } from 'lucide-react';
import { ReferenceImageUploader } from './ReferenceImageUploader';
import { useClientReferenceImages } from '@/hooks/useClientReferenceImages';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ClientImageItem } from '@/hooks/useAllClientImages';
import { cn } from '@/lib/utils';

type ImageModel = 'nano-banana' | 'nano-banana-2' | 'dalle3' | 'gpt-image-1.5' | 'ideogram';
type LogoPlacement = 'auto' | 'corner' | 'featured' | 'badge';

export interface LogoSettings {
  includeLogo: boolean;
  logoUrl: string | undefined;
  logoPlacement: LogoPlacement;
}

interface LibraryImageEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ClientImageItem | null;
  clientId: string;
  brandLogoUrl?: string | null;
  onRegenerate: (
    itemId: string, 
    feedback: string, 
    model: ImageModel, 
    referenceImages: string[], 
    savedReferenceImageIds: string[],
    logoSettings?: LogoSettings
  ) => Promise<void>;
  // New action props
  onApprove?: (id: string) => void;
  onSkip?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDownload?: (url: string, filename: string) => void;
  onAddToCalendar?: (item: ClientImageItem) => void;
}

export function LibraryImageEditDialog({
  open,
  onOpenChange,
  item,
  clientId,
  brandLogoUrl,
  onRegenerate,
  onApprove,
  onSkip,
  onDelete,
  onDownload,
  onAddToCalendar,
}: LibraryImageEditDialogProps) {
  const { toast } = useToast();
  const [feedback, setFeedback] = useState('');
  const [selectedModel, setSelectedModel] = useState<ImageModel>('nano-banana-2');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [uploadedRefImages, setUploadedRefImages] = useState<string[]>([]);
  const [selectedSavedImageIds, setSelectedSavedImageIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('feedback');
  
  // Logo settings
  const [includeLogo, setIncludeLogo] = useState(!!brandLogoUrl);
  const [logoPlacement, setLogoPlacement] = useState<LogoPlacement>('auto');
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { savedImages, isLoading: loadingSavedImages } = useClientReferenceImages(clientId);

  // The effective logo URL - custom upload takes precedence over brand logo
  const effectiveLogoUrl = customLogoUrl || brandLogoUrl || undefined;
  const hasLogo = !!effectiveLogoUrl;

  if (!item) return null;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please upload an image file', variant: 'destructive' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Logo must be under 5MB', variant: 'destructive' });
      return;
    }

    setIsUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${clientId}/logos/${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('client-assets')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('client-assets')
        .getPublicUrl(fileName);

      setCustomLogoUrl(publicUrl);
      setIncludeLogo(true);
      toast({ title: 'Logo uploaded successfully' });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({ title: 'Failed to upload logo', variant: 'destructive' });
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };

  const handleRegenerate = async () => {
    if (!feedback.trim()) return;
    
    setIsRegenerating(true);
    try {
      const logoSettings: LogoSettings | undefined = includeLogo && effectiveLogoUrl
        ? {
            includeLogo: true,
            logoUrl: effectiveLogoUrl,
            logoPlacement,
          }
        : undefined;

      await onRegenerate(
        item.id, 
        feedback.trim(), 
        selectedModel, 
        uploadedRefImages,
        selectedSavedImageIds,
        logoSettings
      );
      setFeedback('');
      setUploadedRefImages([]);
      onOpenChange(false);
    } finally {
      setIsRegenerating(false);
    }
  };

  const toggleSavedImage = (id: string) => {
    setSelectedSavedImageIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const totalRefCount = uploadedRefImages.length + selectedSavedImageIds.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Image Details
          </DialogTitle>
          
          {/* Quick Actions in header */}
          <div className="flex items-center gap-1.5">
            {item.generated_image_url && onDownload && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDownload(item.generated_image_url!, `image-${item.sequence_number}.png`)}
                className="h-8 gap-1.5"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            )}
            {onAddToCalendar && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  onAddToCalendar(item);
                  onOpenChange(false);
                }}
                className="h-8 gap-1.5"
              >
                <CalendarPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Calendar</span>
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm('Delete this image?')) {
                    onDelete(item.id);
                    onOpenChange(false);
                  }
                }}
                className="h-8 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid md:grid-cols-2 gap-6">
          {/* Left: Image Preview */}
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden border bg-muted">
              {item.generated_image_url ? (
                <img
                  src={item.generated_image_url}
                  alt={item.concept}
                  className="w-full h-auto max-h-[40vh] object-contain"
                />
              ) : (
                <div className="aspect-square flex items-center justify-center">
                  <p className="text-muted-foreground">No image</p>
                </div>
              )}
              
              {/* Status badge */}
              <div className="absolute top-2 left-2">
                <Badge 
                  variant={item.status === 'approved' ? 'default' : 'secondary'}
                  className={cn(
                    'capitalize',
                    item.status === 'approved' && 'bg-green-500 hover:bg-green-600',
                    item.status === 'skipped' && 'bg-muted text-muted-foreground'
                  )}
                >
                  {item.status}
                </Badge>
              </div>
              
              {/* Revision indicator */}
              {item.has_revisions && (
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary" className="gap-1">
                    <Layers className="h-3 w-3" />
                    {item.revisions.length + 1} versions
                  </Badge>
                </div>
              )}
            </div>
            
            {/* Original Concept */}
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="font-medium text-xs text-muted-foreground mb-1">Original Concept</p>
              <p className="line-clamp-3">{item.concept}</p>
            </div>

            {/* Model Selection */}
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Model for Regeneration
              </Label>
              <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as ImageModel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nano-banana-2">Nano Banana 2</SelectItem>
                  <SelectItem value="nano-banana">Nano Banana Pro</SelectItem>
                  <SelectItem value="dalle3">DALL-E 3</SelectItem>
                  <SelectItem value="gpt-image-1.5">GPT Image 1.5</SelectItem>
                  <SelectItem value="ideogram">Ideogram 3.0</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Right: Editing Controls */}
          <div className="flex flex-col min-h-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="feedback" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Instructions
                </TabsTrigger>
                <TabsTrigger value="logo" className="gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Logo
                  {includeLogo && (
                    <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      ✓
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="references" className="gap-2">
                  <ImagePlus className="h-4 w-4" />
                  Refs
                  {totalRefCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {totalRefCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 min-h-0 mt-4">
                <TabsContent value="feedback" className="h-full mt-0 flex flex-col">
                  <div className="flex-1 flex flex-col gap-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">
                        AI Edit Instructions
                      </Label>
                      <Textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="E.g., 'Make the text larger', 'Use warmer colors', 'Add more contrast', 'Change background to blue', 'Make it more minimalist', 'Add the brand logo in the corner'"
                        className="min-h-[150px] resize-none"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Describe what changes you want. The AI will regenerate with your feedback combined with brand guidelines.
                      </p>
                    </div>

                    <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="font-medium">Add logo to image</Label>
                          <p className="text-xs text-muted-foreground">
                            {hasLogo ? 'Include your brand logo in this regeneration' : 'Upload a logo in the Logo tab first'}
                          </p>
                        </div>
                        <Switch
                          checked={includeLogo}
                          onCheckedChange={setIncludeLogo}
                          disabled={!hasLogo}
                        />
                      </div>

                      {includeLogo && hasLogo && (
                        <Select value={logoPlacement} onValueChange={(v) => setLogoPlacement(v as LogoPlacement)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Logo placement" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto placement</SelectItem>
                            <SelectItem value="corner">Corner</SelectItem>
                            <SelectItem value="featured">Featured</SelectItem>
                            <SelectItem value="badge">Badge</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="logo" className="h-full mt-0 flex flex-col min-h-0">
                  <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-6">
                      {/* Logo Toggle */}
                      <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center",
                            hasLogo ? "bg-primary/10" : "bg-muted"
                          )}>
                            {effectiveLogoUrl ? (
                              <img 
                                src={effectiveLogoUrl} 
                                alt="Logo" 
                                className="h-8 w-8 object-contain"
                              />
                            ) : (
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <Label className="font-medium">Include Logo</Label>
                            <p className="text-xs text-muted-foreground">
                              {hasLogo ? 'Add your brand logo to the image' : 'Upload a logo to include it'}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={includeLogo}
                          onCheckedChange={setIncludeLogo}
                          disabled={!hasLogo}
                        />
                      </div>

                      {/* Logo Upload */}
                      <div>
                        <Label className="text-sm font-medium mb-3 block">
                          {brandLogoUrl ? 'Use Different Logo' : 'Upload Logo'}
                        </Label>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={isUploadingLogo}
                            className="flex-1"
                          >
                            {isUploadingLogo ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            {customLogoUrl ? 'Change Logo' : 'Upload Logo'}
                          </Button>
                          {customLogoUrl && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setCustomLogoUrl(null);
                                if (!brandLogoUrl) setIncludeLogo(false);
                              }}
                              title="Remove custom logo"
                            >
                              ×
                            </Button>
                          )}
                        </div>
                        {customLogoUrl && (
                          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Custom logo uploaded
                          </p>
                        )}
                        {!customLogoUrl && brandLogoUrl && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Using brand logo from client profile
                          </p>
                        )}
                      </div>

                      {/* Logo Placement */}
                      {includeLogo && hasLogo && (
                        <div>
                          <Label className="text-sm font-medium mb-3 block">
                            Logo Placement
                          </Label>
                          <Select value={logoPlacement} onValueChange={(v) => setLogoPlacement(v as LogoPlacement)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">Auto - AI decides best placement</SelectItem>
                              <SelectItem value="corner">Corner - Small watermark in corner</SelectItem>
                              <SelectItem value="featured">Featured - Prominent placement</SelectItem>
                              <SelectItem value="badge">Badge - Subtle contained badge</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-2">
                            {logoPlacement === 'auto' && 'The AI will choose the best position based on the image composition.'}
                            {logoPlacement === 'corner' && 'Small logo watermark in the bottom corner.'}
                            {logoPlacement === 'featured' && 'Logo as a key focal point in the design.'}
                            {logoPlacement === 'badge' && 'Logo in a subtle, contained badge area.'}
                          </p>
                        </div>
                      )}

                      {!hasLogo && (
                        <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground text-sm">
                          <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No logo available</p>
                          <p className="text-xs mt-1">
                            Upload a logo above or add one in the client's Brand settings
                          </p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="references" className="h-full mt-0 flex flex-col min-h-0">
                  <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-6">
                      {/* Upload New References */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <Label className="text-sm font-medium">Upload Reference Images</Label>
                        </div>
                        <ReferenceImageUploader
                          images={uploadedRefImages}
                          onImagesChange={setUploadedRefImages}
                          maxImages={3}
                        />
                      </div>

                      {/* Saved Reference Library */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Library className="h-4 w-4 text-muted-foreground" />
                          <Label className="text-sm font-medium">Saved Style References</Label>
                          {selectedSavedImageIds.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {selectedSavedImageIds.length} selected
                            </Badge>
                          )}
                        </div>
                        
                        {loadingSavedImages ? (
                          <div className="grid grid-cols-3 gap-2">
                            {[1, 2, 3].map(i => (
                              <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
                            ))}
                          </div>
                        ) : savedImages.length === 0 ? (
                          <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground text-sm">
                            No saved reference images yet.
                            <br />
                            <span className="text-xs">Add images from the Style tab to build your library.</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            {savedImages.map((img) => {
                              const isSelected = selectedSavedImageIds.includes(img.id);
                              return (
                                <button
                                  key={img.id}
                                  onClick={() => toggleSavedImage(img.id)}
                                  className={cn(
                                    "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                                    isSelected 
                                      ? "border-primary ring-2 ring-primary/20" 
                                      : "border-transparent hover:border-muted-foreground/50"
                                  )}
                                >
                                  <img
                                    src={img.thumbnail_url || ''}
                                    alt={img.name}
                                    className="w-full h-full object-cover"
                                  />
                                  {isSelected && (
                                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                                        <Check className="h-4 w-4 text-primary-foreground" />
                                      </div>
                                    </div>
                                  )}
                                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                                    <p className="text-xs text-white truncate">{img.name}</p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Reference images help the AI understand the visual style you want. 
                        The AI will analyze these images and incorporate their aesthetic into the regenerated image.
                      </p>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>

            {/* Action Buttons */}
            <div className="pt-4 border-t mt-4 space-y-3">
              {/* Regenerate */}
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
                Regenerate with AI
                {(totalRefCount > 0 || includeLogo) && (
                  <span className="text-xs opacity-75">
                    ({[
                      totalRefCount > 0 && `${totalRefCount} ref${totalRefCount !== 1 ? 's' : ''}`,
                      includeLogo && 'logo'
                    ].filter(Boolean).join(', ')})
                  </span>
                )}
              </Button>
              
              {/* Approve / Skip buttons */}
              {(onApprove || onSkip) && item.status !== 'approved' && (
                <div className="flex gap-2">
                  {onSkip && item.status !== 'skipped' && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        onSkip(item.id);
                        onOpenChange(false);
                      }}
                      className="flex-1 gap-2"
                    >
                      <SkipForward className="h-4 w-4" />
                      Skip
                    </Button>
                  )}
                  {onApprove && (
                    <Button
                      variant="default"
                      onClick={() => {
                        onApprove(item.id);
                        onOpenChange(false);
                      }}
                      className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
