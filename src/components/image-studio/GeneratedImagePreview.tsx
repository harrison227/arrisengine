import { useState } from 'react';
import { Expand, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface GeneratedImagePreviewProps {
  imageUrl: string;
}

export function GeneratedImagePreview({ imageUrl }: GeneratedImagePreviewProps) {
  const [showFullscreen, setShowFullscreen] = useState(false);

  return (
    <>
      <div className="relative group">
        <img
          src={imageUrl}
          alt="Generated social media graphic"
          className="w-full rounded-lg border shadow-sm"
        />
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => setShowFullscreen(true)}
        >
          <Expand className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Generated Image</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <img
              src={imageUrl}
              alt="Generated social media graphic"
              className="w-full rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
