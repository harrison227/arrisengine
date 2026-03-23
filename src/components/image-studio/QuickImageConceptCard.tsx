import { useState } from 'react';
import { ChevronDown, ChevronUp, X, Sparkles, Image, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type ImageModel = 'nano-banana' | 'dalle3' | 'gpt-image-1.5' | 'ideogram';

export interface QuickConceptData {
  id: string;
  description: string;
  aiPrompt: string;
  model: ImageModel;
  useGlobalRefs: boolean;
  overrideRefIds: string[];
  status: 'pending' | 'generating' | 'done' | 'error';
  resultUrl?: string;
  error?: string;
}

interface ReferenceImage {
  id: string;
  url: string;
  name: string;
}

interface QuickImageConceptCardProps {
  concept: QuickConceptData;
  index: number;
  globalReferences: ReferenceImage[];
  selectedGlobalRefIds: string[];
  onUpdate: (updates: Partial<QuickConceptData>) => void;
  onRemove: () => void;
  isGenerating?: boolean;
}

export function QuickImageConceptCard({
  concept,
  index,
  globalReferences,
  selectedGlobalRefIds,
  onUpdate,
  onRemove,
  isGenerating,
}: QuickImageConceptCardProps) {
  const [refsExpanded, setRefsExpanded] = useState(false);

  const activeRefs = concept.useGlobalRefs 
    ? selectedGlobalRefIds 
    : concept.overrideRefIds;
  
  const refCount = activeRefs.length;

  const toggleOverrideRef = (refId: string) => {
    if (concept.useGlobalRefs) {
      // Switch to override mode and start with current selection minus this one
      onUpdate({ 
        useGlobalRefs: false, 
        overrideRefIds: selectedGlobalRefIds.includes(refId) 
          ? selectedGlobalRefIds.filter(id => id !== refId)
          : [...selectedGlobalRefIds, refId]
      });
    } else {
      const newIds = concept.overrideRefIds.includes(refId)
        ? concept.overrideRefIds.filter(id => id !== refId)
        : [...concept.overrideRefIds, refId];
      onUpdate({ overrideRefIds: newIds });
    }
  };

  const resetToGlobal = () => {
    onUpdate({ useGlobalRefs: true, overrideRefIds: [] });
  };

  return (
    <div className={cn(
      "rounded-xl border bg-card transition-all",
      concept.status === 'generating' && "ring-2 ring-primary/50",
      concept.status === 'done' && "ring-2 ring-green-500/50",
      concept.status === 'error' && "ring-2 ring-destructive/50"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
            {index + 1}
          </div>
          <span className="text-sm font-medium">
            {concept.status === 'done' ? 'Generated' : concept.status === 'generating' ? 'Generating...' : 'Concept'}
          </span>
          {concept.status === 'done' && (
            <Check className="h-4 w-4 text-green-500" />
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onRemove}
          disabled={isGenerating}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* Short Description */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Short Description</Label>
          <Input
            value={concept.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="e.g., Quote about workplace safety"
            disabled={isGenerating || concept.status === 'done'}
            className="h-9"
          />
        </div>

        {/* AI Prompt */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <Label className="text-xs text-muted-foreground">AI Prompt</Label>
            {concept.aiPrompt && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                AI Generated
              </span>
            )}
          </div>
          <Textarea
            value={concept.aiPrompt}
            onChange={(e) => onUpdate({ aiPrompt: e.target.value })}
            placeholder="Click 'Generate Prompts' to auto-fill, or write your own..."
            className="resize-none h-24 text-sm"
            disabled={isGenerating || concept.status === 'done'}
          />
        </div>

        {/* Model Selection */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Model</Label>
          <Select 
            value={concept.model} 
            onValueChange={(v) => onUpdate({ model: v as ImageModel })}
            disabled={isGenerating || concept.status === 'done'}
          >
            <SelectTrigger className="h-9">
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

        {/* Reference Images Collapsible */}
        <Collapsible open={refsExpanded} onOpenChange={setRefsExpanded}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center gap-2 text-sm">
                <Image className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Reference Images</span>
                <span className="text-xs text-muted-foreground">
                  ({concept.useGlobalRefs ? 'using global' : 'custom'}: {refCount})
                </span>
              </div>
              {refsExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="pt-3 space-y-2">
              {!concept.useGlobalRefs && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetToGlobal}
                  className="text-xs h-7"
                >
                  Reset to global references
                </Button>
              )}
              
              {globalReferences.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {globalReferences.map((ref) => {
                    const isSelected = concept.useGlobalRefs 
                      ? selectedGlobalRefIds.includes(ref.id)
                      : concept.overrideRefIds.includes(ref.id);
                    
                    return (
                      <button
                        key={ref.id}
                        onClick={() => toggleOverrideRef(ref.id)}
                        disabled={isGenerating || concept.status === 'done'}
                        className={cn(
                          "relative aspect-square rounded-lg overflow-hidden transition-all",
                          isSelected 
                            ? "ring-2 ring-primary ring-offset-1" 
                            : "opacity-50 hover:opacity-80"
                        )}
                      >
                        <img
                          src={ref.url}
                          alt={ref.name}
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                            <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-2.5 w-2.5 text-primary-foreground" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No reference images available
                </p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Result Preview */}
        {concept.status === 'done' && concept.resultUrl && (
          <div className="rounded-lg overflow-hidden border">
            <img
              src={concept.resultUrl}
              alt={concept.description}
              className="w-full h-auto"
            />
          </div>
        )}

        {/* Error State */}
        {concept.status === 'error' && concept.error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {concept.error}
          </div>
        )}
      </div>
    </div>
  );
}
