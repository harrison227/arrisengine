import { useState, useMemo, useCallback } from 'react';
import { ImagePlus, Image } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { useKnowledgeEntries } from '@/hooks/useKnowledgeEntries';
import { useKnowledgeSummary } from '@/hooks/useKnowledgeSummary';
import { useAISession } from '@/hooks/useAISession';
import { useImageBatch } from '@/hooks/useImageBatch';
import { useAllClientImages } from '@/hooks/useAllClientImages';
import { useClientReferenceImages } from '@/hooks/useClientReferenceImages';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { StudioHeader, type StudioMode } from '@/components/image-studio/StudioHeader';
import { StyleReferencesDrawer } from '@/components/image-studio/StyleReferencesDrawer';
import { BrandContextDrawer } from '@/components/image-studio/BrandContextDrawer';
import { QuickWorkspace } from '@/components/image-studio/QuickWorkspace';
import { BatchWorkspace } from '@/components/image-studio/BatchWorkspace';
import { VariationsWorkspace } from '@/components/image-studio/VariationsWorkspace';
import { AllImagesGallery } from '@/components/image-studio/AllImagesGallery';
import { FloatingActionBar } from '@/components/image-studio/FloatingActionBar';
import { ImageDetailModal } from '@/components/image-studio/ImageDetailModal';
import { AddContentDialog } from '@/components/dialogs/AddContentDialog';
import type { LogoPlacement } from '@/components/image-studio/StyleSetupCard';
import type { GalleryItem } from '@/components/image-studio/GenerationGallery';

type ImageModel = 'nano-banana' | 'nano-banana-2' | 'nano-banana-pro' | 'dalle3' | 'gpt-image-1.5' | 'ideogram';

export default function ImageStudio() {
  // Core state
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [mode, setMode] = useState<StudioMode>('batch');
  
  // Drawer visibility
  const [styleDrawerOpen, setStyleDrawerOpen] = useState(false);
  const [brandDrawerOpen, setBrandDrawerOpen] = useState(false);
  
  // Style setup
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [styleNotes, setStyleNotes] = useState('');
  const [includeLogo, setIncludeLogo] = useState(true);
  const [logoPlacement, setLogoPlacement] = useState<LogoPlacement>('auto');
  const [selectedSavedImageIds, setSelectedSavedImageIds] = useState<string[]>([]);
  
  // Quick generate - no longer needed, handled in QuickWorkspace
  // const [isQuickGenerating, setIsQuickGenerating] = useState(false);
  // const [quickGenerateResult, setQuickGenerateResult] = useState<{ url: string; prompt: string } | null>(null);
  
  // Add to calendar state
  const [addToCalendarOpen, setAddToCalendarOpen] = useState(false);
  const [pendingCalendarImage, setPendingCalendarImage] = useState<{ url: string; urls?: string[]; concept: string; caption: string; hashtags: string[] } | null>(null);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  
  // Gallery state for floating action bar
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<GalleryItem | null>(null);
  
  // Hooks
  const { clients } = useClients();
  const { entries: knowledgeEntries, isLoading: entriesLoading } = useKnowledgeEntries(selectedClientId || undefined);
  const { summary: knowledgeSummary, isLoading: summaryLoading } = useKnowledgeSummary(selectedClientId || undefined);
  const { savedImages: clientReferenceImages, isLoading: refsLoading } = useClientReferenceImages(selectedClientId || undefined);
  const { createSession, sessions } = useAISession(selectedClientId || undefined, 'image_batch');
  const { 
    items: batchItems, 
    isLoading: itemsLoading,
    generatePlan, 
    isGeneratingPlan,
    generateImage,
    isGeneratingImage,
    updateConcept,
    approveItem,
    skipItem,
    deleteItem,
    progress 
  } = useImageBatch(currentSessionId || undefined);
  
  // Hook for all client images (library mode)
  const {
    images: allClientImages,
    isLoading: allImagesLoading,
    isError: allImagesError,
    approveItem: approveLibraryItem,
    skipItem: skipLibraryItem,
    deleteItem: deleteLibraryItem,
    regenerateItem: regenerateLibraryItem,
    stats: libraryStats,
    refetch: refetchAllImages,
    hasMore: hasMoreLibraryImages,
    loadMore: loadMoreLibraryImages,
    isLoadingMore: isLoadingMoreLibraryImages,
  } = useAllClientImages(selectedClientId || undefined);
  
  const { toast } = useToast();

  // Derived state
  const selectedClient = clients.find(c => c.id === selectedClientId);
  
  const clientSessions = useMemo(() => {
    return sessions.filter(s => s.client_id === selectedClientId);
  }, [sessions, selectedClientId]);
  
  const stats = useMemo(() => {
    if (mode === 'library') {
      return {
        approved: libraryStats.approved,
        pending: libraryStats.pending,
        total: libraryStats.total,
      };
    }
    return {
      approved: progress.approved,
      pending: progress.pending + progress.generating,
      total: progress.total,
    };
  }, [mode, progress, libraryStats]);
  
  // Items that have images generated (for gallery view)
  const galleryItems: GalleryItem[] = useMemo(() => {
    return batchItems.filter(item => 
      item.generated_image_url || 
      item.status === 'generating' || 
      item.status === 'regenerating' ||
      item.status === 'approved' ||
      item.status === 'skipped'
    );
  }, [batchItems]);

  // Handlers
  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    setCurrentSessionId(null);
    setSelectedImageIds(new Set());
  };

  const handleSessionSelect = async (sessionId: string | null) => {
    setCurrentSessionId(sessionId);
    
    // When selecting a session, check its type and switch to appropriate mode
    if (sessionId) {
      const session = sessions.find(s => s.id === sessionId);
      const sessionData = session?.session_data as { type?: string } | null;
      
      if (sessionData?.type === 'quick_batch') {
        // Quick batch sessions should open in quick mode
        setMode('quick');
      } else {
        // Regular batch sessions open in batch mode
        setMode('batch');
      }
    }
  };

  const handleNewSession = async () => {
    if (!selectedClientId) return;
    const session = await createSession({ 
      clientId: selectedClientId, 
      sessionType: 'image_batch',
      title: `Batch ${new Date().toLocaleDateString()}`
    });
    setCurrentSessionId(session.id);
  };

  // Quick Generate is now fully handled inside QuickWorkspace component

  // Batch Generate
  const handleGenerateBatch = async () => {
    if (!selectedClientId) return;
    
    try {
      const session = await createSession({ 
        clientId: selectedClientId, 
        sessionType: 'image_batch',
        title: `Batch for ${selectedClient?.business_name}`
      });
      setCurrentSessionId(session.id);
      
      const allReferenceImages = [...referenceImages];
      
      await generatePlan({
        sessionId: session.id,
        clientId: selectedClientId,
        referenceStyle: styleNotes || undefined,
        referenceImages: allReferenceImages.length > 0 ? allReferenceImages : undefined,
        count: 30
      });
    } catch (error) {
      console.error('Failed to start batch:', error);
    }
  };

  const handleGenerateSelectedConcepts = async (ids: string[], model: ImageModel) => {
    if (!selectedClientId || ids.length === 0) return;

    const conceptsToGenerate = batchItems.filter(item => ids.includes(item.id));
    
    const generationPromises = conceptsToGenerate.map(item => 
      generateImage({
        batchItemId: item.id,
        clientId: selectedClientId,
        concept: item.concept,
        templateType: item.template_type,
        feedback: item.feedback || undefined,
        promptAdditions: item.prompt_additions || undefined,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        savedReferenceImageIds: selectedSavedImageIds.length > 0 ? selectedSavedImageIds : undefined,
        brandLogoUrl: includeLogo ? selectedClient?.brand_logo_url || undefined : undefined,
        logoPlacement: includeLogo ? logoPlacement : undefined,
        model,
      }).catch(error => {
        console.error(`Failed to generate image for ${item.id}:`, error);
        return null;
      })
    );

    await Promise.all(generationPromises);
  };

  const handleGenerateSingle = async (id: string) => {
    const item = batchItems.find(i => i.id === id);
    if (!item || !selectedClientId) return;

    try {
      await generateImage({
        batchItemId: item.id,
        clientId: selectedClientId,
        concept: item.concept,
        templateType: item.template_type,
        feedback: item.feedback || undefined,
        promptAdditions: item.prompt_additions || undefined,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        savedReferenceImageIds: selectedSavedImageIds.length > 0 ? selectedSavedImageIds : undefined,
        brandLogoUrl: includeLogo ? selectedClient?.brand_logo_url || undefined : undefined,
        logoPlacement: includeLogo ? logoPlacement : undefined
      });
    } catch (error) {
      console.error('Failed to generate:', error);
    }
  };

  const handleUpdateConcept = async (id: string, updates: { concept?: string; promptAdditions?: string; feedback?: string }) => {
    await updateConcept({
      batchItemId: id,
      concept: updates.concept,
      promptAdditions: updates.promptAdditions,
      feedback: updates.feedback,
    });
  };

  const handleRegenerateItem = useCallback(async (
    id: string,
    feedback?: string,
    model?: ImageModel,
    referenceImageUrl?: string,
    additionalReferenceImages?: string[]
  ) => {
    const item = batchItems.find(i => i.id === id);
    if (!item || !selectedClientId) return;

    const allReferenceImages = [...referenceImages];
    
    if (additionalReferenceImages && additionalReferenceImages.length > 0) {
      allReferenceImages.push(...additionalReferenceImages);
    }

    const isRegeneration = !!item.generated_image_url;
    if (isRegeneration) {
      const baseRef = referenceImageUrl || item.generated_image_url;
      if (baseRef) allReferenceImages.unshift(baseRef);
    }

    try {
      await generateImage({
        batchItemId: item.id,
        clientId: selectedClientId,
        concept: item.concept,
        templateType: item.template_type,
        feedback: feedback || undefined,
        promptAdditions: item.prompt_additions || undefined,
        referenceImages: allReferenceImages,
        savedReferenceImageIds: selectedSavedImageIds.length > 0 ? selectedSavedImageIds : undefined,
        brandLogoUrl: includeLogo ? selectedClient?.brand_logo_url || undefined : undefined,
        logoPlacement: includeLogo ? logoPlacement : undefined,
        model: model || (item.model_used as any) || 'nano-banana',
        isRegeneration,
      });
    } catch (error) {
      console.error('Failed to regenerate:', error);
    }
  }, [batchItems, selectedClientId, referenceImages, selectedSavedImageIds, includeLogo, selectedClient, logoPlacement, generateImage]);

  const handleAddToCalendarFromQuickGenerate = async (imageUrl: string, promptConcept: string) => {
    setIsGeneratingCaption(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-caption', {
        body: { concept: promptConcept, clientId: selectedClientId }
      });

      if (error) throw error;

      setPendingCalendarImage({ 
        url: imageUrl, 
        urls: undefined,
        concept: data?.title || 'New Post',
        caption: data?.caption || '', 
        hashtags: data?.hashtags || []
      });
      setAddToCalendarOpen(true);
    } catch (err) {
      console.error('Failed to generate caption:', err);
      setPendingCalendarImage({ url: imageUrl, urls: undefined, concept: 'New Post', caption: '', hashtags: [] });
      setAddToCalendarOpen(true);
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handleAddToCalendarFromBatch = async (item: GalleryItem) => {
    if (!item.generated_image_url) return;
    
    // If part of a carousel group, gather all sibling images and use carousel flow
    if (item.carousel_group_id) {
      const carouselSiblings = batchItems
        .filter(i => i.carousel_group_id === item.carousel_group_id && i.generated_image_url)
        .sort((a, b) => a.sequence_number - b.sequence_number);
      if (carouselSiblings.length >= 2) {
        setDetailItem(null);
        handleCreateCarousel(
          carouselSiblings.map(i => i.generated_image_url!),
          carouselSiblings.map(i => i.concept)
        );
        return;
      }
    }

    setIsGeneratingCaption(true);
    setDetailItem(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-caption', {
        body: { concept: item.concept, clientId: selectedClientId }
      });

      if (error) throw error;

      setPendingCalendarImage({ 
        url: item.generated_image_url, 
        urls: undefined,
        concept: data?.title || 'New Post',
        caption: data?.caption || '', 
        hashtags: data?.hashtags || [] 
      });
      setAddToCalendarOpen(true);
    } catch (err) {
      console.error('Failed to generate caption:', err);
      setPendingCalendarImage({ 
        url: item.generated_image_url, 
        urls: undefined,
        concept: 'New Post',
        caption: '', 
        hashtags: [] 
      });
      setAddToCalendarOpen(true);
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handleCreateCarousel = async (imageUrls: string[], concepts: string[]) => {
    setIsGeneratingCaption(true);
    const combinedConcept = concepts.slice(0, 3).join(', ');
    try {
      const { data, error } = await supabase.functions.invoke('generate-caption', {
        body: { concept: `Carousel post: ${combinedConcept}`, clientId: selectedClientId }
      });

      if (error) throw error;

      setPendingCalendarImage({ 
        url: imageUrls[0], 
        urls: imageUrls,
        concept: data?.title || 'Carousel Post',
        caption: data?.caption || '', 
        hashtags: data?.hashtags || [] 
      });
      setAddToCalendarOpen(true);
    } catch (err) {
      console.error('Failed to generate caption:', err);
      setPendingCalendarImage({ 
        url: imageUrls[0], 
        urls: imageUrls,
        concept: 'Carousel Post', 
        caption: '', 
        hashtags: [] 
      });
      setAddToCalendarOpen(true);
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handleApproveSelected = () => {
    selectedImageIds.forEach(id => approveItem(id));
    setSelectedImageIds(new Set());
    toast({ title: `Approved ${selectedImageIds.size} images` });
  };

  const handleDownloadSelected = async () => {
    const itemsToDownload = galleryItems.filter(
      item => selectedImageIds.has(item.id) && item.generated_image_url
    );

    for (const item of itemsToDownload) {
      const link = document.createElement('a');
      link.href = item.generated_image_url!;
      link.download = `image-${item.sequence_number}.png`;
      link.click();
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    toast({ title: `Downloaded ${itemsToDownload.length} images` });
  };

  // No client selected state
  if (!selectedClientId) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Simple header with logo */}
        <header className="border-b border-border bg-card/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Image className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-lg font-semibold">Image Studio</h1>
          </div>
        </header>

        {/* Client selection content */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
              <ImagePlus className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Select a Client</h2>
            <p className="text-muted-foreground mb-8">
              Choose a client to start generating images with their brand context
            </p>
            
            {/* Client cards grid */}
            {clients.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-xl mx-auto">
                {clients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => handleClientChange(client.id)}
                    className="p-4 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/50 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      {client.brand_logo_url ? (
                        <img
                          src={client.brand_logo_url}
                          alt=""
                          className="w-8 h-8 rounded object-contain bg-background"
                        />
                      ) : (
                        <div 
                          className="w-8 h-8 rounded flex items-center justify-center text-sm font-medium text-white"
                          style={{ 
                            backgroundColor: client.brand_primary_color || 'hsl(var(--muted))',
                          }}
                        >
                          {client.business_name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                      {client.business_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {client.industry}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No clients found. Create a client first.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Prepare reference images for BatchWorkspace
  const formattedReferenceImages = clientReferenceImages.map(img => ({
    id: img.id,
    url: img.thumbnail_url || '',
    name: img.name,
  })).filter(img => img.url);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <StudioHeader
        clients={clients}
        selectedClientId={selectedClientId}
        onClientChange={handleClientChange}
        sessions={clientSessions}
        activeSessionId={currentSessionId}
        onSessionSelect={handleSessionSelect}
        onNewSession={handleNewSession}
        mode={mode}
        onModeChange={setMode}
        onOpenStyleDrawer={() => setStyleDrawerOpen(true)}
        onOpenBrandDrawer={() => setBrandDrawerOpen(true)}
        stats={stats}
      />

      {/* Progress bar when generating */}
      {(isGeneratingPlan || isGeneratingImage) && (
        <div className="h-1 bg-muted shrink-0">
          <div 
            className="h-full bg-primary transition-all duration-500"
            style={{ width: isGeneratingPlan ? '30%' : `${progress.percentage}%` }}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {mode === 'quick' && (
          <QuickWorkspace
            clientId={selectedClientId}
            clientReferenceImages={formattedReferenceImages}
            brandLogoUrl={selectedClient?.brand_logo_url}
            onAddToCalendar={(url, prompt) => handleAddToCalendarFromQuickGenerate(url, prompt)}
            onSessionCreated={(sessionId) => setCurrentSessionId(sessionId)}
            clientName={selectedClient?.business_name}
            selectedSessionId={currentSessionId}
          />
        )}

        {mode === 'variations' && (
          <VariationsWorkspace
            clientId={selectedClientId}
            clientReferenceImages={formattedReferenceImages}
            brandLogoUrl={selectedClient?.brand_logo_url}
            onAddToCalendar={(url, prompt) => handleAddToCalendarFromQuickGenerate(url, prompt)}
            onSessionCreated={(sessionId) => setCurrentSessionId(sessionId)}
            clientName={selectedClient?.business_name}
          />
        )}
        
        {mode === 'batch' && (
          <BatchWorkspace
            concepts={batchItems}
            galleryItems={galleryItems}
            isGeneratingPlan={isGeneratingPlan}
            isGeneratingImage={isGeneratingImage}
            isLoading={itemsLoading}
            progress={{ ...progress, percentage: progress.percentage }}
            onGeneratePlan={handleGenerateBatch}
            onGenerateSelected={handleGenerateSelectedConcepts}
            onGenerateSingle={handleGenerateSingle}
            onUpdateConcept={handleUpdateConcept}
            onApprove={approveItem}
            onSkip={skipItem}
            onRegenerate={handleRegenerateItem}
            onDelete={deleteItem}
            onAddToCalendar={handleAddToCalendarFromBatch}
            // Brand context for inline display
            client={selectedClient}
            referenceImages={formattedReferenceImages}
            selectedReferenceIds={selectedSavedImageIds}
            onToggleReference={(id) => {
              setSelectedSavedImageIds(prev => 
                prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
              );
            }}
            includeLogo={includeLogo}
            onToggleLogo={setIncludeLogo}
            styleNotes={styleNotes}
            onStyleNotesChange={setStyleNotes}
            knowledgeSummary={knowledgeSummary}
          />
        )}
        
        {mode === 'library' && (
          <AllImagesGallery
            images={allClientImages}
            isLoading={allImagesLoading}
            isError={allImagesError}
            onRetry={refetchAllImages}
            clientId={selectedClientId || ''}
            brandLogoUrl={selectedClient?.brand_logo_url}
            onApprove={approveLibraryItem}
            onSkip={skipLibraryItem}
            onDelete={deleteLibraryItem}
            onAddToCalendar={(item) => {
              if (item.generated_image_url) {
                // If part of a carousel group, add all images in the group
                if (item.carousel_group_id) {
                  const carouselSiblings = allClientImages
                    .filter(img => img.carousel_group_id === item.carousel_group_id && img.generated_image_url)
                    .sort((a, b) => a.sequence_number - b.sequence_number);
                  if (carouselSiblings.length >= 2) {
                    handleCreateCarousel(
                      carouselSiblings.map(img => img.generated_image_url!),
                      carouselSiblings.map(img => img.concept)
                    );
                    return;
                  }
                }
                handleAddToCalendarFromQuickGenerate(item.generated_image_url, item.concept);
              }
            }}
            onCreateCarousel={handleCreateCarousel}
            onDownload={(url, filename) => {
              const link = document.createElement('a');
              link.href = url;
              link.download = filename;
              link.click();
            }}
            onRegenerate={async (itemId, feedback, model, referenceImages, savedReferenceImageIds, logoSettings) => {
              await regenerateLibraryItem({ itemId, feedback, model, referenceImages, savedReferenceImageIds, logoSettings });
            }}
            hasMore={hasMoreLibraryImages}
            isLoadingMore={isLoadingMoreLibraryImages}
            onLoadMore={loadMoreLibraryImages}
          />
        )}
      </div>

      {/* Style & References Drawer */}
      <StyleReferencesDrawer
        isOpen={styleDrawerOpen}
        onClose={() => setStyleDrawerOpen(false)}
        referenceImages={referenceImages}
        onReferenceImagesChange={setReferenceImages}
        styleNotes={styleNotes}
        onStyleNotesChange={setStyleNotes}
        brandLogoUrl={selectedClient?.brand_logo_url}
        includeLogo={includeLogo}
        onIncludeLogoChange={setIncludeLogo}
        logoPlacement={logoPlacement}
        onLogoPlacementChange={setLogoPlacement}
        clientId={selectedClientId || undefined}
        selectedSavedImageIds={selectedSavedImageIds}
        onSelectedSavedImageIdsChange={setSelectedSavedImageIds}
      />

      {/* Brand Context Drawer */}
      <BrandContextDrawer
        isOpen={brandDrawerOpen}
        onClose={() => setBrandDrawerOpen(false)}
        summary={knowledgeSummary}
        entries={knowledgeEntries}
        brandColors={selectedClient ? {
          brand_primary_color: selectedClient.brand_primary_color,
          brand_secondary_color: selectedClient.brand_secondary_color,
          brand_accent_color: selectedClient.brand_accent_color,
          brand_background_color: selectedClient.brand_background_color,
          brand_text_color: selectedClient.brand_text_color,
          brand_fonts: selectedClient.brand_fonts,
          brand_style_notes: selectedClient.brand_style_notes,
        } : null}
        isLoading={entriesLoading || summaryLoading}
      />

      {/* Floating Action Bar */}
      <FloatingActionBar
        selectedCount={selectedImageIds.size}
        onApproveAll={handleApproveSelected}
        onDownloadAll={handleDownloadSelected}
        onClearSelection={() => setSelectedImageIds(new Set())}
        isVisible={selectedImageIds.size > 0}
      />

      {/* Image Detail Modal (fallback for mobile) */}
      <ImageDetailModal
        item={detailItem}
        isOpen={!!detailItem}
        onClose={() => setDetailItem(null)}
        onApprove={approveItem}
        onSkip={skipItem}
        onRegenerate={handleRegenerateItem}
        onDelete={deleteItem}
        onAddToCalendar={handleAddToCalendarFromBatch}
        isRegenerating={
          !!detailItem && 
          (batchItems.find(i => i.id === detailItem.id)?.status === 'regenerating' || 
           batchItems.find(i => i.id === detailItem.id)?.status === 'generating')
        }
      />

      {/* Quick Generate Result Dialog - now handled inside QuickWorkspace */}

      {/* Add to Content Calendar Dialog */}
      <AddContentDialog
        open={addToCalendarOpen}
        onOpenChange={(open) => {
          setAddToCalendarOpen(open);
          if (!open) setPendingCalendarImage(null);
        }}
        selectedDate={new Date()}
        initialImageUrl={pendingCalendarImage?.urls ? undefined : pendingCalendarImage?.url}
        initialImageUrls={pendingCalendarImage?.urls}
        initialCaption={pendingCalendarImage?.caption}
        initialHashtags={pendingCalendarImage?.hashtags}
        initialClientId={selectedClientId || undefined}
        initialConcept={pendingCalendarImage?.concept}
      />
    </div>
  );
}
