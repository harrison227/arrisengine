import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Image, Pencil, Save, X, Sparkles, MessageSquare, Quote, BarChart3, Megaphone, Star, Lightbulb, Camera, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type ImageModel = 'nano-banana' | 'nano-banana-2' | 'dalle3' | 'gpt-image-1.5' | 'ideogram';

interface Concept {
  id: string;
  sequence_number: number;
  template_type: string;
  concept: string;
  platform: string | null;
  status: string | null;
  feedback: string | null;
  prompt_additions: string | null;
}

interface ConceptListProps {
  concepts: Concept[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onGenerateSelected: (model: ImageModel) => void;
  onUpdateConcept?: (id: string, updates: { concept?: string; promptAdditions?: string; feedback?: string }) => Promise<void>;
  onGenerateSingle?: (id: string) => void;
  isGenerating: boolean;
  isLoading?: boolean;
  selectedModel: ImageModel;
  onModelChange: (model: ImageModel) => void;
}

const templateConfig: Record<string, { label: string; icon: typeof Quote; color: string }> = {
  quote_card: { label: 'Quote', icon: Quote, color: 'text-blue-600 bg-blue-100 dark:bg-blue-950/50' },
  stat_graphic: { label: 'Stats', icon: BarChart3, color: 'text-amber-600 bg-amber-100 dark:bg-amber-950/50' },
  announcement: { label: 'Announce', icon: Megaphone, color: 'text-pink-600 bg-pink-100 dark:bg-pink-950/50' },
  testimonial: { label: 'Review', icon: Star, color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-950/50' },
  tips_carousel: { label: 'Tips', icon: Lightbulb, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950/50' },
  behind_the_scenes: { label: 'BTS', icon: Camera, color: 'text-violet-600 bg-violet-100 dark:bg-violet-950/50' },
  promotional: { label: 'Promo', icon: Tag, color: 'text-red-600 bg-red-100 dark:bg-red-950/50' },
};

const defaultConfig = { label: 'Content', icon: MessageSquare, color: 'text-gray-600 bg-gray-100 dark:bg-gray-950/50' };

export function ConceptList({
  concepts,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onGenerateSelected,
  onUpdateConcept,
  onGenerateSingle,
  isGenerating,
  isLoading,
  selectedModel,
  onModelChange,
}: ConceptListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    concept: string;
    promptAdditions: string;
    feedback: string;
  }>({ concept: '', promptAdditions: '', feedback: '' });
  const [isSaving, setIsSaving] = useState(false);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
        ))}
      </div>
    );
  }

  if (concepts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
          <Sparkles className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-2">No Concepts Yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Generate a content calendar from the Setup tab to get started with AI-powered concepts.
        </p>
      </div>
    );
  }

  const pendingConcepts = concepts.filter(c => c.status === 'pending' || !c.status);
  const allSelected = pendingConcepts.length > 0 && pendingConcepts.every(c => selectedIds.has(c.id));

  const handleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (expandedId === id) {
      setExpandedId(null);
      setEditingId(null);
    } else {
      setExpandedId(id);
      const concept = concepts.find(c => c.id === id);
      if (concept) {
        setEditValues({
          concept: concept.concept,
          promptAdditions: concept.prompt_additions || '',
          feedback: concept.feedback || '',
        });
      }
    }
  };

  const handleStartEdit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    const concept = concepts.find(c => c.id === id);
    if (concept) {
      setEditValues({
        concept: concept.concept,
        promptAdditions: concept.prompt_additions || '',
        feedback: concept.feedback || '',
      });
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    const concept = concepts.find(c => c.id === expandedId);
    if (concept) {
      setEditValues({
        concept: concept.concept,
        promptAdditions: concept.prompt_additions || '',
        feedback: concept.feedback || '',
      });
    }
  };

  const handleSave = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateConcept) return;

    setIsSaving(true);
    try {
      await onUpdateConcept(id, {
        concept: editValues.concept,
        promptAdditions: editValues.promptAdditions || undefined,
        feedback: editValues.feedback || undefined,
      });
      setEditingId(null);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateSingle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onGenerateSingle) {
      onGenerateSingle(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 py-4 px-4 -mx-6 bg-card border rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">Content Concepts</h2>
            <p className="text-sm text-muted-foreground">
              {selectedIds.size} of {pendingConcepts.length} selected
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={allSelected ? onDeselectAll : onSelectAll}
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </Button>
            <Select value={selectedModel} onValueChange={(v) => onModelChange(v as ImageModel)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nano-banana-2">Nano Banana 2</SelectItem>
                <SelectItem value="nano-banana">Nano Banana Pro</SelectItem>
                <SelectItem value="dalle3">DALL-E 3</SelectItem>
                <SelectItem value="gpt-image-1.5">GPT Image 1.5</SelectItem>
                <SelectItem value="ideogram">Ideogram v3</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="lg"
              onClick={() => onGenerateSelected(selectedModel)}
              disabled={selectedIds.size === 0 || isGenerating}
              className="gap-2"
            >
              <Image className="h-5 w-5" />
              Generate {selectedIds.size > 0 ? selectedIds.size : ''} Images
            </Button>
          </div>
        </div>
      </div>

      {/* Visual Card Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {concepts.map((concept) => {
          const isSelected = selectedIds.has(concept.id);
          const isPending = concept.status === 'pending' || !concept.status;
          const isApproved = concept.status === 'approved';
          const isExpanded = expandedId === concept.id;
          const isEditing = editingId === concept.id;
          const hasCustomizations = concept.prompt_additions || concept.feedback;
          
          const config = templateConfig[concept.template_type] || defaultConfig;
          const IconComponent = config.icon;

          return (
            <div key={concept.id} className="relative">
              {/* Card */}
              <div
                onClick={() => isPending && onToggleSelect(concept.id)}
                className={cn(
                  'relative rounded-xl overflow-hidden transition-all cursor-pointer border bg-card',
                  isPending && 'hover:shadow-md',
                  isSelected && 'ring-2 ring-primary ring-offset-2',
                  !isPending && 'opacity-60 cursor-default'
                )}
              >
                {/* Visual Preview Area */}
                <div className="aspect-[4/5] p-3 flex flex-col">
                  {/* Type Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <div className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                      config.color
                    )}>
                      <IconComponent className="h-3 w-3" />
                      {config.label}
                    </div>
                    
                    {/* Status indicators */}
                    {isApproved && (
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    {hasCustomizations && !isApproved && (
                      <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                        <Pencil className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Concept Preview */}
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-xs text-center line-clamp-5 text-foreground/80">
                      "{concept.concept}"
                    </p>
                  </div>

                  {/* Platform & Number */}
                  <div className="flex items-center justify-between mt-2">
                    {concept.platform && (
                      <span className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium">
                        {concept.platform}
                      </span>
                    )}
                    <span className="text-[9px] font-mono text-muted-foreground ml-auto">
                      #{concept.sequence_number}
                    </span>
                  </div>
                </div>

                {/* Selection Overlay */}
                {isSelected && (
                  <div className="absolute top-2 left-2">
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  </div>
                )}

                {/* Expand Button */}
                <button
                  onClick={(e) => handleExpand(concept.id, e)}
                  className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background shadow transition-colors"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </button>
              </div>

              {/* Expanded Panel */}
              {isExpanded && (
                <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-card rounded-lg shadow-xl border p-3 space-y-2">
                  {/* Concept text */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Concept
                    </label>
                    {isEditing ? (
                      <Textarea
                        value={editValues.concept}
                        onChange={(e) => setEditValues(prev => ({ ...prev, concept: e.target.value }))}
                        className="resize-none text-xs"
                        rows={2}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <p className="text-xs text-foreground bg-muted/50 rounded p-2">
                        {concept.concept}
                      </p>
                    )}
                  </div>

                  {/* Prompt additions */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Style Additions
                    </label>
                    {isEditing ? (
                      <Textarea
                        value={editValues.promptAdditions}
                        onChange={(e) => setEditValues(prev => ({ ...prev, promptAdditions: e.target.value }))}
                        placeholder="E.g., 'Use gradient background', 'Make text larger'"
                        className="resize-none text-xs"
                        rows={2}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                        {concept.prompt_additions || <span className="italic">None</span>}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          onClick={(e) => handleSave(concept.id, e)}
                          disabled={isSaving}
                          className="gap-1 h-7 text-xs"
                        >
                          <Save className="h-3 w-3" />
                          {isSaving ? 'Saving...' : 'Save'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelEdit}
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleStartEdit(concept.id, e)}
                          className="gap-1 h-7 text-xs"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Button>
                        {isPending && onGenerateSingle && (
                          <Button
                            size="sm"
                            onClick={(e) => handleGenerateSingle(concept.id, e)}
                            disabled={isGenerating}
                            className="gap-1 h-7 text-xs"
                          >
                            <Image className="h-3 w-3" />
                            Generate
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
