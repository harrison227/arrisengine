import { Upload, X, Image, Sparkles, Save, Trash2, Check, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useClientReferenceImages } from '@/hooks/useClientReferenceImages';
import { Skeleton } from '@/components/ui/skeleton';

export type LogoPlacement = 'auto' | 'corner' | 'featured' | 'badge';

interface StyleSetupCardProps {
  referenceImages: string[];
  onReferenceImagesChange: (images: string[]) => void;
  styleNotes: string;
  onStyleNotesChange: (notes: string) => void;
  defaultExpanded?: boolean;
  brandLogoUrl?: string | null;
  includeLogo: boolean;
  onIncludeLogoChange: (include: boolean) => void;
  logoPlacement: LogoPlacement;
  onLogoPlacementChange: (placement: LogoPlacement) => void;
  clientId?: string;
  selectedSavedImageIds: string[];
  onSelectedSavedImageIdsChange: (ids: string[]) => void;
}

export function StyleSetupCard({
  referenceImages,
  onReferenceImagesChange,
  styleNotes,
  onStyleNotesChange,
  brandLogoUrl,
  includeLogo,
  onIncludeLogoChange,
  logoPlacement,
  onLogoPlacementChange,
  clientId,
  selectedSavedImageIds,
  onSelectedSavedImageIdsChange,
}: StyleSetupCardProps) {
  const { savedImages, isLoading, saveImage, isSaving, deleteImage, isDeleting } = useClientReferenceImages(clientId);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        onReferenceImagesChange([...referenceImages, dataUrl]);
      };
      reader.readAsDataURL(file);
    });
    
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    onReferenceImagesChange(referenceImages.filter((_, i) => i !== index));
  };

  const handleSaveToLibrary = (imageData: string, index: number) => {
    saveImage({ 
      imageData, 
      name: `Reference ${Date.now()}` 
    });
  };

  const handleToggleSavedImage = (imageId: string) => {
    if (selectedSavedImageIds.includes(imageId)) {
      onSelectedSavedImageIdsChange(selectedSavedImageIds.filter(id => id !== imageId));
    } else {
      onSelectedSavedImageIdsChange([...selectedSavedImageIds, imageId]);
    }
  };

  const handleDeleteSavedImage = (imageId: string) => {
    deleteImage(imageId);
    onSelectedSavedImageIdsChange(selectedSavedImageIds.filter(id => id !== imageId));
  };

  const totalActiveImages = referenceImages.length + selectedSavedImageIds.length;

  return (
    <div className="rounded-xl bg-card border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Palette className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Style & References</h3>
            <p className="text-xs text-muted-foreground">
              {totalActiveImages > 0 ? `${totalActiveImages} reference image${totalActiveImages !== 1 ? 's' : ''} active` : 'Optional style configuration'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Brand Logo Section */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
            Brand Logo
          </label>
          {brandLogoUrl ? (
            <div className="flex items-start gap-4 p-3 rounded-lg border bg-muted/30">
              <div className="w-16 h-16 rounded-lg overflow-hidden border bg-background flex-shrink-0">
                <img
                  src={brandLogoUrl}
                  alt="Brand logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="include-logo"
                      checked={includeLogo}
                      onCheckedChange={onIncludeLogoChange}
                    />
                    <Label htmlFor="include-logo" className="text-sm font-medium cursor-pointer">
                      Include in images
                    </Label>
                  </div>
                  {includeLogo && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded-full">
                      <Sparkles className="h-3 w-3" />
                      Active
                    </div>
                  )}
                </div>
                
                {includeLogo && (
                  <Select
                    value={logoPlacement}
                    onValueChange={(value) => onLogoPlacementChange(value as LogoPlacement)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (AI decides)</SelectItem>
                      <SelectItem value="corner">Corner watermark</SelectItem>
                      <SelectItem value="featured">Featured in design</SelectItem>
                      <SelectItem value="badge">Subtle badge</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg border-2 border-dashed text-center">
              <Image className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No brand logo uploaded
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Add one in the Client's Brand tab
              </p>
            </div>
          )}
        </div>

        {/* Reference Images Grid */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
            Reference Images
          </label>
          
          <div className="grid grid-cols-4 gap-2">
            {/* Saved images */}
            {isLoading ? (
              <>
                <Skeleton className="aspect-square rounded-lg" />
                <Skeleton className="aspect-square rounded-lg" />
              </>
            ) : (
              savedImages.map((img) => {
                const isSelected = selectedSavedImageIds.includes(img.id);
                return (
                  <div
                    key={img.id}
                    onClick={() => handleToggleSavedImage(img.id)}
                    className={cn(
                      "relative aspect-square rounded-lg overflow-hidden group cursor-pointer transition-all",
                      isSelected 
                        ? "ring-2 ring-primary ring-offset-2" 
                        : "hover:ring-2 hover:ring-muted-foreground/30"
                    )}
                  >
                    <img
                      src={img.thumbnail_url || ''}
                      alt={img.name}
                      className="w-full h-full object-cover"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSavedImage(img.id);
                      }}
                      disabled={isDeleting}
                      className="absolute bottom-1 right-1 bg-destructive rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90"
                    >
                      <Trash2 className="h-3 w-3 text-destructive-foreground" />
                    </button>
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-black/50 text-white">
                      Saved
                    </div>
                  </div>
                );
              })
            )}

            {/* Uploaded (temporary) images */}
            {referenceImages.map((img, index) => (
              <div
                key={index}
                className="relative aspect-square rounded-lg overflow-hidden group ring-2 ring-amber-400 ring-offset-2"
              >
                <img
                  src={img}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {clientId && (
                    <button
                      onClick={() => handleSaveToLibrary(img, index)}
                      disabled={isSaving}
                      className="p-1.5 bg-primary rounded-full hover:bg-primary/90 transition-colors"
                      title="Save to library"
                    >
                      <Save className="h-3 w-3 text-primary-foreground" />
                    </button>
                  )}
                  <button
                    onClick={() => removeImage(index)}
                    className="p-1.5 bg-destructive rounded-full hover:bg-destructive/90 transition-colors"
                    title="Remove"
                  >
                    <X className="h-3 w-3 text-destructive-foreground" />
                  </button>
                </div>
                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500 text-white">
                  New
                </div>
              </div>
            ))}
            
            {/* Upload button */}
            <label className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-all group">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <Upload className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-[10px] text-muted-foreground group-hover:text-primary mt-1 font-medium">Upload</span>
            </label>
          </div>
          
          {referenceImages.length > 0 && clientId && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Hover new uploads to save them permanently
            </p>
          )}
        </div>

        {/* Style Notes */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
            Style Notes
          </label>
          <Textarea
            value={styleNotes}
            onChange={(e) => onStyleNotesChange(e.target.value)}
            placeholder="E.g., 'Bold typography, construction theme, orange accents, industrial feel...'"
            className="resize-none h-20 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
