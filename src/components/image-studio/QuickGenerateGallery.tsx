import { useState } from 'react';
import { Check, Download, CalendarPlus, Loader2, ImagePlus, AlertCircle, Pencil, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { QuickConceptData } from './QuickImageConceptCard';
import { QuickBatchEditDialog } from './QuickBatchEditDialog';

type ImageModel = 'nano-banana' | 'dalle3' | 'gpt-image-1.5' | 'ideogram';

interface QuickGenerateGalleryProps {
  concepts: QuickConceptData[];
  onAddToCalendar: (concept: QuickConceptData) => void;
  onDownload: (url: string, name: string) => void;
  onRegenerate: (conceptId: string, feedback: string, model: ImageModel) => Promise<void>;
  onRetry: (conceptId: string) => void;
}

export function QuickGenerateGallery({
  concepts,
  onAddToCalendar,
  onDownload,
  onRegenerate,
  onRetry,
}: QuickGenerateGalleryProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingConcept, setEditingConcept] = useState<QuickConceptData | null>(null);

  const completedConcepts = concepts.filter(c => c.status === 'done' && c.resultUrl);
  const pendingCount = concepts.filter(c => c.status === 'pending').length;
  const generatingCount = concepts.filter(c => c.status === 'generating').length;
  const errorCount = concepts.filter(c => c.status === 'error').length;

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleDownloadAll = () => {
    completedConcepts.forEach((concept, index) => {
      if (concept.resultUrl) {
        setTimeout(() => {
          onDownload(concept.resultUrl!, `quick-generate-${index + 1}.png`);
        }, index * 300);
      }
    });
  };

  const handleEditClick = (concept: QuickConceptData) => {
    setEditingConcept(concept);
  };

  const hasAnyResults = completedConcepts.length > 0 || generatingCount > 0 || errorCount > 0;

  if (!hasAnyResults && pendingCount === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <ImagePlus className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Generated images will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col">
        {/* Gallery Header */}
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <div className="text-sm">
            <span className="font-medium">{completedConcepts.length}</span>
            <span className="text-muted-foreground"> generated</span>
            {generatingCount > 0 && (
              <>
                <span className="mx-2 text-muted-foreground">•</span>
                <span className="text-primary">{generatingCount} generating</span>
              </>
            )}
            {errorCount > 0 && (
              <>
                <span className="mx-2 text-muted-foreground">•</span>
                <span className="text-destructive">{errorCount} failed</span>
              </>
            )}
          </div>
          {completedConcepts.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAll}
              className="h-8 gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Download All
            </Button>
          )}
        </div>

        {/* Gallery Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-4">
            {concepts.map((concept) => (
              <div
                key={concept.id}
                className={cn(
                  "relative rounded-xl overflow-hidden border bg-card transition-all group",
                  concept.status === 'generating' && "animate-pulse",
                  concept.status === 'error' && "border-destructive/50"
                )}
              >
                {/* Image or Placeholder */}
                {concept.status === 'done' && concept.resultUrl ? (
                  <>
                    <div className="aspect-square relative">
                      <img
                        src={concept.resultUrl}
                        alt={concept.description}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      
                      {/* Hover Actions */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleEditClick(concept)}
                          className="h-8 gap-1.5"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onAddToCalendar(concept)}
                          className="h-8 gap-1.5"
                        >
                          <CalendarPlus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onDownload(concept.resultUrl!, `${concept.description.slice(0, 20)}.png`)}
                          className="h-8"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Selection Checkbox */}
                      <button
                        onClick={() => toggleSelect(concept.id)}
                        className={cn(
                          "absolute top-2 left-2 w-6 h-6 rounded-full border-2 transition-all",
                          selectedIds.has(concept.id)
                            ? "bg-primary border-primary"
                            : "bg-white/80 border-white/80 opacity-0 group-hover:opacity-100"
                        )}
                      >
                        {selectedIds.has(concept.id) && (
                          <Check className="h-4 w-4 text-primary-foreground m-auto" />
                        )}
                      </button>
                    </div>

                    {/* Caption */}
                    <div className="p-3 border-t">
                      <p className="text-sm line-clamp-2 text-muted-foreground">
                        {concept.description}
                      </p>
                    </div>
                  </>
                ) : concept.status === 'generating' ? (
                  <div className="aspect-square flex items-center justify-center bg-muted">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Generating...</p>
                    </div>
                  </div>
                ) : concept.status === 'error' ? (
                  <div className="aspect-square flex flex-col items-center justify-center bg-destructive/5 p-4">
                    <AlertCircle className="h-8 w-8 text-destructive mb-2" />
                    <p className="text-sm text-destructive font-medium">Failed</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 text-center">
                      {concept.error || 'Unknown error'}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRetry(concept.id)}
                      className="mt-3 gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Retry
                    </Button>
                  </div>
                ) : (
                  <div className="aspect-square flex items-center justify-center bg-muted/50">
                    <div className="text-center">
                      <ImagePlus className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Pending</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <QuickBatchEditDialog
        open={!!editingConcept}
        onOpenChange={(open) => !open && setEditingConcept(null)}
        concept={editingConcept}
        onRegenerate={onRegenerate}
        onAddToCalendar={onAddToCalendar}
        onDownload={onDownload}
      />
    </>
  );
}
