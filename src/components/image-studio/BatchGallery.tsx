import React from 'react';
import { Download, ExternalLink, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImageBatchItem } from '@/hooks/useImageBatch';

interface BatchGalleryProps {
  items: ImageBatchItem[];
  onDownload?: (item: ImageBatchItem) => void;
  onRemove?: (itemId: string) => void;
}

export function BatchGallery({ items, onDownload, onRemove }: BatchGalleryProps) {
  const approvedItems = items.filter(item => item.status === 'approved' && item.generated_image_url);

  if (approvedItems.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30 rounded-lg border border-dashed border-border p-8">
        <div className="text-center text-muted-foreground">
          <p className="text-sm font-medium">No approved images yet</p>
          <p className="text-xs mt-1">Approved images will appear here</p>
        </div>
      </div>
    );
  }

  const handleDownloadAll = () => {
    approvedItems.forEach((item, index) => {
      if (item.generated_image_url) {
        setTimeout(() => {
          const link = document.createElement('a');
          link.href = item.generated_image_url!;
          link.download = `image-${item.sequence_number}-${item.template_type}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }, index * 500);
      }
    });
  };

  return (
    <div className="h-full flex flex-col bg-background rounded-lg border border-border">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-foreground">
          Approved Images ({approvedItems.length})
        </h3>
        <Button onClick={handleDownloadAll} variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Download All
        </Button>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {approvedItems.map((item) => (
            <div
              key={item.id}
              className="group relative aspect-square rounded-lg overflow-hidden bg-muted border border-border"
            >
              <img
                src={item.generated_image_url!}
                alt={item.concept}
                className="w-full h-full object-cover"
              />
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                <div className="flex items-start justify-between">
                  <Badge variant="secondary" className="text-xs">
                    #{item.sequence_number}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-background/50">
                    {item.template_type.replace('_', ' ')}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-center gap-2">
                  {onDownload && (
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8"
                      onClick={() => onDownload(item)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-8 w-8"
                    onClick={() => window.open(item.generated_image_url!, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  {onRemove && (
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-8 w-8"
                      onClick={() => onRemove(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
