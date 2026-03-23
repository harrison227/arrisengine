import { useCallback } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ReferenceImageUploaderProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
}

export function ReferenceImageUploader({ 
  images, 
  onImagesChange, 
  maxImages = 3 
}: ReferenceImageUploaderProps) {
  const { toast } = useToast();

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      toast({
        title: 'Maximum images reached',
        description: `You can only upload up to ${maxImages} reference images`,
        variant: 'destructive',
      });
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    const newImages: string[] = [];

    for (const file of filesToProcess) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload only image files',
          variant: 'destructive',
        });
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Images must be under 5MB',
          variant: 'destructive',
        });
        continue;
      }

      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      newImages.push(base64);
    }

    onImagesChange([...images, ...newImages]);
    
    // Reset input
    e.target.value = '';
  }, [images, maxImages, onImagesChange, toast]);

  const handleRemove = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <label className={`
        border-2 border-dashed rounded-lg p-6 
        flex flex-col items-center justify-center
        cursor-pointer transition-colors
        ${images.length >= maxImages 
          ? 'border-muted bg-muted/20 cursor-not-allowed' 
          : 'border-border hover:border-primary hover:bg-primary/5'
        }
      `}>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
          disabled={images.length >= maxImages}
        />
        <Upload className={`h-8 w-8 mb-2 ${images.length >= maxImages ? 'text-muted' : 'text-muted-foreground'}`} />
        <span className={`text-sm font-medium ${images.length >= maxImages ? 'text-muted' : 'text-foreground'}`}>
          {images.length >= maxImages ? 'Maximum images reached' : 'Click to upload reference images'}
        </span>
        <span className="text-xs text-muted-foreground mt-1">
          Upload up to {maxImages} images (PNG, JPG, max 5MB each)
        </span>
      </label>

      {/* Preview Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {images.map((image, index) => (
            <div key={index} className="relative group aspect-square">
              <img
                src={image}
                alt={`Reference ${index + 1}`}
                className="w-full h-full object-cover rounded-lg border"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemove(index)}
              >
                <X className="h-3 w-3" />
              </Button>
              <div className="absolute bottom-1 left-1 bg-background/80 px-1.5 py-0.5 rounded text-xs">
                Reference {index + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Help Text */}
      {images.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <ImageIcon className="h-3 w-3 inline mr-1" />
          The AI will analyze these images and mimic their visual style in the generated image.
        </p>
      )}
    </div>
  );
}
