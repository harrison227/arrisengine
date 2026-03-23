import { useState, useEffect } from 'react';
import { Sparkles, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ConceptList, type ImageModel } from './ConceptList';
import { GenerationGallery, type GalleryItem } from './GenerationGallery';
import { ImageDetailModal } from './ImageDetailModal';
import { BrandStyleSummaryCard } from './BrandStyleSummaryCard';
import { Tables } from '@/integrations/supabase/types';

type Client = Tables<'clients'>;
type GalleryFilter = 'all' | 'pending' | 'approved' | 'skipped';

interface Concept {
  id: string;
  sequence_number: number;
  template_type: string;
  concept: string;
  platform: string | null;
  status: string | null;
  feedback: string | null;
  prompt_additions: string | null;
  generated_image_url: string | null;
  model_used: string | null;
  carousel_group_id?: string | null;
}

interface BatchWorkspaceProps {
  concepts: Concept[];
  galleryItems: GalleryItem[];
  isGeneratingPlan: boolean;
  isGeneratingImage: boolean;
  isLoading: boolean;
  progress: { approved: number; pending: number; total: number; percentage: number };
  onGeneratePlan: () => Promise<void>;
  onGenerateSelected: (ids: string[], model: ImageModel) => Promise<void>;
  onGenerateSingle: (id: string) => Promise<void>;
  onUpdateConcept: (id: string, updates: { concept?: string; promptAdditions?: string; feedback?: string }) => Promise<void>;
  onApprove: (id: string) => void;
  onSkip: (id: string) => void;
  onRegenerate: (id: string, feedback?: string, model?: ImageModel, referenceImageUrl?: string, additionalReferenceImages?: string[]) => void;
  onDelete: (id: string) => void;
  onAddToCalendar: (item: GalleryItem) => void;
  // Brand context props
  client?: Client;
  referenceImages: Array<{ id: string; url: string; name: string }>;
  selectedReferenceIds: string[];
  onToggleReference: (id: string) => void;
  includeLogo: boolean;
  onToggleLogo: (checked: boolean) => void;
  styleNotes: string;
  onStyleNotesChange: (notes: string) => void;
  knowledgeSummary?: {
    positioning_summary?: string;
    key_differentiators?: string[];
  } | null;
}

export function BatchWorkspace({
  concepts,
  galleryItems,
  isGeneratingPlan,
  isGeneratingImage,
  isLoading,
  progress,
  onGeneratePlan,
  onGenerateSelected,
  onGenerateSingle,
  onUpdateConcept,
  onApprove,
  onSkip,
  onRegenerate,
  onDelete,
  onAddToCalendar,
  client,
  referenceImages,
  selectedReferenceIds,
  onToggleReference,
  includeLogo,
  onToggleLogo,
  styleNotes,
  onStyleNotesChange,
  knowledgeSummary,
}: BatchWorkspaceProps) {
  const [selectedConceptIds, setSelectedConceptIds] = useState<Set<string>>(new Set());
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>('all');
  const [inspectedItem, setInspectedItem] = useState<GalleryItem | null>(null);
  const [inspectedCarouselSlides, setInspectedCarouselSlides] = useState<GalleryItem[] | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'concepts' | 'images'>('concepts');
  const [selectedModel, setSelectedModel] = useState<ImageModel>('nano-banana');

  const handleItemClick = (item: GalleryItem, carouselSlides?: GalleryItem[]) => {
    setInspectedItem(item);
    setInspectedCarouselSlides(carouselSlides);
  };

  const handleCloseModal = () => {
    setInspectedItem(null);
    setInspectedCarouselSlides(undefined);
  };

  const pendingConcepts = concepts.filter(c => c.status === 'pending' || !c.status);
  const hasConcepts = concepts.length > 0;
  const hasGalleryItems = galleryItems.length > 0;

  // Keyboard shortcuts for inspector (removed 'R' shortcut - regenerate should go through modal options)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!inspectedItem) return;
      
      // Don't trigger shortcuts if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        onApprove(inspectedItem.id);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        onSkip(inspectedItem.id);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const idx = galleryItems.findIndex(i => i.id === inspectedItem.id);
        if (idx < galleryItems.length - 1) {
          setInspectedItem(galleryItems[idx + 1]);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = galleryItems.findIndex(i => i.id === inspectedItem.id);
        if (idx > 0) {
          setInspectedItem(galleryItems[idx - 1]);
        }
      } else if (e.key === 'Escape') {
        setInspectedItem(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectedItem, galleryItems, onApprove, onSkip]);

  const handleToggleConceptSelect = (id: string) => {
    const newSet = new Set(selectedConceptIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedConceptIds(newSet);
  };

  const handleSelectAllConcepts = () => {
    setSelectedConceptIds(new Set(pendingConcepts.map(c => c.id)));
  };

  const handleDeselectAllConcepts = () => {
    setSelectedConceptIds(new Set());
  };

  const handleGenerateSelectedConcepts = async (model: ImageModel) => {
    await onGenerateSelected(Array.from(selectedConceptIds), model);
    setSelectedConceptIds(new Set());
  };

  const handleToggleImageSelect = (id: string) => {
    const newSet = new Set(selectedImageIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedImageIds(newSet);
  };

  // Loading state when fetching batch items for a session
  if (isLoading && !hasConcepts) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading batch...</p>
        </div>
      </div>
    );
  }

  // Empty state - no concepts yet (show brand context inline)
  if (!hasConcepts && !isGeneratingPlan) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Generate CTA */}
            <div className="flex flex-col justify-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Start a Batch</h2>
              <p className="text-muted-foreground mb-6">
                Generate 30 AI-powered content concepts based on the client's brand and knowledge base.
              </p>
              <Button size="lg" onClick={onGeneratePlan} className="gap-2 w-fit">
                <Sparkles className="h-4 w-4" />
                Generate 30 Concepts
              </Button>
            </div>

            {/* Right: Brand Context Summary */}
            {client && (
              <BrandStyleSummaryCard
                client={client}
                referenceImages={referenceImages}
                selectedReferenceIds={selectedReferenceIds}
                onToggleReference={onToggleReference}
                includeLogo={includeLogo}
                onToggleLogo={onToggleLogo}
                styleNotes={styleNotes}
                onStyleNotesChange={onStyleNotesChange}
                knowledgeSummary={knowledgeSummary}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Generating plan
  if (isGeneratingPlan) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Generating concepts...</p>
        </div>
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'concepts' | 'images')} className="h-full flex flex-col">
      {/* Tab Header */}
      <div className="border-b px-4 py-2 flex items-center justify-between shrink-0">
        <TabsList>
          <TabsTrigger value="concepts" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Concepts
            <Badge variant="secondary" className="ml-1">{concepts.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="images" className="gap-2">
            <ImageIcon className="h-4 w-4" />
            Images
            <Badge variant="secondary" className="ml-1">{galleryItems.length}</Badge>
          </TabsTrigger>
        </TabsList>
        
        <div className="text-sm text-muted-foreground">
          {progress.approved}/{progress.total} approved
        </div>
      </div>

      {/* Concepts Tab */}
      <TabsContent value="concepts" className="flex-1 overflow-auto m-0 p-4 space-y-4">
        <ConceptList
          concepts={concepts}
          selectedIds={selectedConceptIds}
          onToggleSelect={handleToggleConceptSelect}
          onSelectAll={handleSelectAllConcepts}
          onDeselectAll={handleDeselectAllConcepts}
          onGenerateSelected={handleGenerateSelectedConcepts}
          onUpdateConcept={onUpdateConcept}
          onGenerateSingle={onGenerateSingle}
          isGenerating={isGeneratingImage}
          isLoading={isLoading}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
        
        {/* Brand context */}
        {client && (
          <BrandStyleSummaryCard
            client={client}
            referenceImages={referenceImages}
            selectedReferenceIds={selectedReferenceIds}
            onToggleReference={onToggleReference}
            includeLogo={includeLogo}
            onToggleLogo={onToggleLogo}
            styleNotes={styleNotes}
            onStyleNotesChange={onStyleNotesChange}
            knowledgeSummary={knowledgeSummary}
          />
        )}
      </TabsContent>

      {/* Images Tab */}
      <TabsContent value="images" className="flex-1 overflow-auto m-0 p-4">
        {hasGalleryItems ? (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Generated Images</h2>
              <p className="text-sm text-muted-foreground">
                Click an image to view details. <span className="font-medium">A</span>=approve, <span className="font-medium">S</span>=skip, arrows=navigate
              </p>
            </div>
            <GenerationGallery
              items={galleryItems}
              selectedIds={selectedImageIds}
              onToggleSelect={handleToggleImageSelect}
              onItemClick={handleItemClick}
              filter={galleryFilter}
              onFilterChange={setGalleryFilter}
              isLoading={isLoading}
            />
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No images generated yet</p>
              <p className="text-sm">Generate concepts first, then create images</p>
            </div>
          </div>
        )}
      </TabsContent>

      {/* Image Detail Modal */}
      <ImageDetailModal
        item={inspectedItem}
        carouselSlides={inspectedCarouselSlides}
        isOpen={!!inspectedItem}
        onClose={handleCloseModal}
        onApprove={onApprove}
        onSkip={onSkip}
        onRegenerate={onRegenerate}
        onDelete={onDelete}
        onAddToCalendar={onAddToCalendar}
        isRegenerating={
          inspectedItem ? (
            concepts.find(c => c.id === inspectedItem.id)?.status === 'regenerating' ||
            concepts.find(c => c.id === inspectedItem.id)?.status === 'generating'
          ) : false
        }
      />
    </Tabs>
  );
}
