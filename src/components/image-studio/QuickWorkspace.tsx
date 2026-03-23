import { useState, useCallback, useEffect } from 'react';
import { ImagePlus, Loader2, Wand2, Plus, Sparkles, Trash2, Layers } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { QuickImageConceptCard, type QuickConceptData } from './QuickImageConceptCard';
import { QuickGenerateGallery } from './QuickGenerateGallery';
import { QuickGenerateResultDialog } from './QuickGenerateResultDialog';
import { StyleSetupCard, type LogoPlacement } from './StyleSetupCard';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { checkAIImageRateLimit, recordAIImageRequest, checkAITextRateLimit, recordAITextRequest } from '@/hooks/useRateLimiter';

type ImageModel = 'nano-banana' | 'dalle3' | 'gpt-image-1.5' | 'ideogram';

interface ReferenceImage {
  id: string;
  url: string;
  name: string;
}

interface QuickWorkspaceProps {
  clientId: string;
  clientReferenceImages: ReferenceImage[];
  brandLogoUrl?: string | null;
  onAddToCalendar: (url: string, prompt: string) => void;
  onSessionCreated?: (sessionId: string) => void;
  clientName?: string;
  selectedSessionId?: string | null;
}

function generateId() {
  return `concept-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function QuickWorkspace({
  clientId,
  clientReferenceImages,
  brandLogoUrl,
  onAddToCalendar,
  onSessionCreated,
  clientName,
  selectedSessionId,
}: QuickWorkspaceProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Mode toggle
  const [isMultiMode, setIsMultiMode] = useState(false);
  
  // Single mode state
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<ImageModel>('nano-banana');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegeneratingSingle, setIsRegeneratingSingle] = useState(false);
  const [lastResult, setLastResult] = useState<{ url: string; prompt: string } | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);
  
  // Multi mode state
  const [concepts, setConcepts] = useState<QuickConceptData[]>([
    { id: generateId(), description: '', aiPrompt: '', model: 'nano-banana', useGlobalRefs: true, overrideRefIds: [], status: 'pending' }
  ]);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [currentBatchSessionId, setCurrentBatchSessionId] = useState<string | null>(null);
  
  // Style/Reference state (shared across modes)
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [styleNotes, setStyleNotes] = useState('');
  const [includeLogo, setIncludeLogo] = useState(true);
  const [logoPlacement, setLogoPlacement] = useState<LogoPlacement>('auto');
  const [selectedSavedImageIds, setSelectedSavedImageIds] = useState<string[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Load existing session data on mount or when selectedSessionId changes
  useEffect(() => {
    const loadSession = async (sessionId: string) => {
      setIsLoadingSession(true);
      try {
        // Verify it's a quick batch session
        const { data: session, error: sessionError } = await supabase
          .from('ai_sessions')
          .select('id, title, session_data, status')
          .eq('id', sessionId)
          .single();

        if (sessionError) throw sessionError;

        const sessionData = session?.session_data as { type?: string } | null;
        
        // If it's not a quick_batch session, reset state and return
        // (the parent component should switch to batch mode for regular sessions)
        if (sessionData?.type !== 'quick_batch') {
          setConcepts([{ id: generateId(), description: '', aiPrompt: '', model: 'nano-banana', useGlobalRefs: true, overrideRefIds: [], status: 'pending' }]);
          setCurrentBatchSessionId(null);
          setIsMultiMode(false);
          setIsLoadingSession(false);
          return;
        }

        // Load the batch items for this session
        const { data: items, error: itemsError } = await supabase
          .from('image_batch_items')
          .select('*')
          .eq('session_id', sessionId)
          .order('sequence_number', { ascending: true });

        if (itemsError) throw itemsError;

        if (items && items.length > 0) {
          setCurrentBatchSessionId(sessionId);
          onSessionCreated?.(sessionId);

          // Convert DB items to QuickConceptData
          const loadedConcepts: QuickConceptData[] = items.map((item) => ({
            id: item.id,
            description: item.concept,
            aiPrompt: item.prompt_additions || '',
            model: (item.model_used as ImageModel) || 'nano-banana',
            useGlobalRefs: true,
            overrideRefIds: [],
            status: item.generated_image_url ? 'done' : (item.status === 'generating' ? 'generating' : 'pending'),
            resultUrl: item.generated_image_url || undefined,
          }));

          setConcepts(loadedConcepts);
          
          // If any images exist, switch to multi mode
          if (loadedConcepts.some(c => c.resultUrl)) {
            setIsMultiMode(true);
          } else {
            setIsMultiMode(false);
          }
        } else {
          // Reset to empty state for this session
          setCurrentBatchSessionId(sessionId);
          onSessionCreated?.(sessionId);
          setConcepts([{ id: generateId(), description: '', aiPrompt: '', model: 'nano-banana', useGlobalRefs: true, overrideRefIds: [], status: 'pending' }]);
          setIsMultiMode(false);
        }
      } catch (error) {
        console.error('Failed to load session:', error);
        // Reset state on error
        setConcepts([{ id: generateId(), description: '', aiPrompt: '', model: 'nano-banana', useGlobalRefs: true, overrideRefIds: [], status: 'pending' }]);
        setCurrentBatchSessionId(null);
        setIsMultiMode(false);
      } finally {
        setIsLoadingSession(false);
      }
    };

    const loadMostRecentSession = async () => {
      setIsLoadingSession(true);
      try {
        // Find the most recent quick batch session for this client
        const { data: sessions, error: sessionsError } = await supabase
          .from('ai_sessions')
          .select('id, title, session_data, status')
          .eq('client_id', clientId)
          .eq('session_type', 'image_batch')
          .order('created_at', { ascending: false })
          .limit(1);

        if (sessionsError) throw sessionsError;

        const latestSession = sessions?.[0];
        if (!latestSession) {
          setIsLoadingSession(false);
          return;
        }

        const sessionData = latestSession.session_data as { type?: string } | null;
        if (sessionData?.type !== 'quick_batch') {
          setIsLoadingSession(false);
          return;
        }

        await loadSession(latestSession.id);
      } catch (error) {
        console.error('Failed to load existing session:', error);
        setIsLoadingSession(false);
      }
    };

    // If a specific session is selected, load it; otherwise load the most recent
    if (selectedSessionId) {
      loadSession(selectedSessionId);
    } else {
      loadMostRecentSession();
    }
  }, [clientId, selectedSessionId]);



  // Helper to create a quick batch session
  const createQuickBatchSession = async (conceptCount: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const title = `Quick Batch - ${clientName || 'Client'} - ${new Date().toLocaleDateString()}`;
      
      const { data: session, error } = await supabase
        .from('ai_sessions')
        .insert({
          client_id: clientId,
          user_id: user.id,
          session_type: 'image_batch',
          title,
          status: 'in_progress',
          session_data: { concepts: [], type: 'quick_batch' }
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setCurrentBatchSessionId(session.id);
      onSessionCreated?.(session.id);
      return session.id;
    } catch (error) {
      console.error('Failed to create session:', error);
      return null;
    }
  };

  // Helper to save batch item to database
  const saveBatchItemToDb = async (sessionId: string, concept: QuickConceptData, sequenceNumber: number, imageUrl?: string) => {
    try {
      const { error } = await supabase
        .from('image_batch_items')
        .insert({
          session_id: sessionId,
          sequence_number: sequenceNumber,
          concept: concept.description,
          template_type: 'quote_card',
          platform: 'instagram',
          status: imageUrl ? 'approved' : 'pending',
          generated_image_url: imageUrl || null,
          model_used: concept.model,
          prompt_additions: concept.aiPrompt,
        });
      
      if (error) console.error('Failed to save batch item:', error);
    } catch (error) {
      console.error('Failed to save batch item:', error);
    }
  };

  // Helper to save single-generated image to database for library
  const saveSingleImageToDb = async (imageUrl: string, promptText: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create or get a quick batch session for single images
      let sessionId = currentBatchSessionId;
      if (!sessionId) {
        const title = `Quick Generate - ${clientName || 'Client'} - ${new Date().toLocaleDateString()}`;
        const { data: session, error: sessionError } = await supabase
          .from('ai_sessions')
          .insert({
            client_id: clientId,
            user_id: user.id,
            session_type: 'image_batch',
            title,
            status: 'completed',
            session_data: { concepts: [], type: 'quick_batch' }
          })
          .select()
          .single();

        if (sessionError) {
          console.error('Failed to create session for single image:', sessionError);
          return;
        }
        sessionId = session.id;
        setCurrentBatchSessionId(sessionId);
        onSessionCreated?.(sessionId);
      }

      // Get the next sequence number for this session
      const { data: existingItems } = await supabase
        .from('image_batch_items')
        .select('sequence_number')
        .eq('session_id', sessionId)
        .order('sequence_number', { ascending: false })
        .limit(1);

      const nextSequence = (existingItems?.[0]?.sequence_number || 0) + 1;

      // Save the image to batch items
      const { error } = await supabase
        .from('image_batch_items')
        .insert({
          session_id: sessionId,
          sequence_number: nextSequence,
          concept: promptText,
          template_type: 'quote_card',
          platform: 'instagram',
          status: 'approved',
          generated_image_url: imageUrl,
          model_used: model,
          prompt_additions: promptText,
        });

      if (error) {
        console.error('Failed to save single image to database:', error);
      } else {
        // Invalidate the library query so the new image shows up immediately
        queryClient.invalidateQueries({ queryKey: ['all-client-images', clientId] });
      }
    } catch (error) {
      console.error('Error saving single image:', error);
    }
  };

  // Single Mode Generate
  const handleSingleGenerate = async () => {
    if (!prompt.trim()) return;

    const rateLimitCheck = checkAIImageRateLimit();
    if (!rateLimitCheck.allowed) {
      toast({
        title: 'Rate limit reached',
        description: `Please wait ${rateLimitCheck.waitTime} seconds before generating more images.`,
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    recordAIImageRequest();

    try {
      const currentPrompt = prompt.trim();
      const { data, error } = await supabase.functions.invoke('generate-social-image', {
        body: {
          clientId,
          prompt: currentPrompt,
          templateType: 'quote_card',
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
          savedReferenceImageIds: selectedSavedImageIds.length > 0 ? selectedSavedImageIds : undefined,
          saveToAssets: true,
          model,
          brandLogoUrl: includeLogo ? brandLogoUrl : undefined,
          logoPlacement: includeLogo ? logoPlacement : undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Save to database so it appears in library
      await saveSingleImageToDb(data.imageUrl, currentPrompt);

      setLastResult({ url: data.imageUrl, prompt: currentPrompt });
      setShowResultDialog(true);
      setPrompt('');
      toast({ title: 'Image generated successfully!' });
    } catch (error) {
      console.error('Quick generate error:', error);
      toast({
        title: 'Failed to generate image',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Multi Mode: Add Concept
  const addConcept = () => {
    if (concepts.length >= 10) {
      toast({ title: 'Maximum 10 concepts allowed', variant: 'destructive' });
      return;
    }
    setConcepts([
      ...concepts,
      { id: generateId(), description: '', aiPrompt: '', model: 'nano-banana', useGlobalRefs: true, overrideRefIds: [], status: 'pending' }
    ]);
  };

  // Multi Mode: Update Concept
  const updateConcept = useCallback((id: string, updates: Partial<QuickConceptData>) => {
    setConcepts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  // Multi Mode: Remove Concept
  const removeConcept = useCallback((id: string) => {
    setConcepts(prev => prev.filter(c => c.id !== id));
  }, []);

  // Multi Mode: Generate AI Prompts
  const handleGeneratePrompts = async () => {
    const validConcepts = concepts.filter(c => c.description.trim());
    if (validConcepts.length === 0) {
      toast({ title: 'Add at least one concept description', variant: 'destructive' });
      return;
    }

    const rateLimitCheck = checkAITextRateLimit();
    if (!rateLimitCheck.allowed) {
      toast({
        title: 'Rate limit reached',
        description: `Please wait ${rateLimitCheck.waitTime} seconds.`,
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingPrompts(true);
    recordAITextRequest();

    try {
      const { data, error } = await supabase.functions.invoke('generate-quick-prompts', {
        body: {
          clientId,
          concepts: validConcepts.map(c => ({ id: c.id, description: c.description })),
          styleNotes,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Update concepts with AI-generated prompts
      const promptsArray = data.prompts as Array<{ id: string; prompt: string }>;
      const promptMap = new Map<string, string>(promptsArray.map((p) => [p.id, p.prompt]));
      setConcepts(prev => prev.map(c => ({
        ...c,
        aiPrompt: promptMap.get(c.id) || c.aiPrompt
      })));

      toast({ title: `Generated ${promptsArray.length} prompts` });
    } catch (error) {
      console.error('Generate prompts error:', error);
      toast({
        title: 'Failed to generate prompts',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  // Multi Mode: Generate All Images
  const handleGenerateAllImages = async () => {
    const validConcepts = concepts.filter(c => c.aiPrompt.trim() && c.status === 'pending');
    if (validConcepts.length === 0) {
      toast({ title: 'No pending concepts with prompts', variant: 'destructive' });
      return;
    }

    setIsGeneratingImages(true);

    // Create a session for this quick batch
    let sessionId = currentBatchSessionId;
    if (!sessionId) {
      sessionId = await createQuickBatchSession(validConcepts.length);
    }

    let sequenceNumber = 0;

    for (const concept of validConcepts) {
      const rateLimitCheck = checkAIImageRateLimit();
      if (!rateLimitCheck.allowed) {
        toast({
          title: 'Rate limit reached',
          description: `Pausing generation. Wait ${rateLimitCheck.waitTime}s for remaining images.`,
          variant: 'destructive',
        });
        break;
      }

      recordAIImageRequest();
      updateConcept(concept.id, { status: 'generating' });

      try {
        // Determine which reference images to use
        const refIds = concept.useGlobalRefs ? selectedSavedImageIds : concept.overrideRefIds;
        
        const { data, error } = await supabase.functions.invoke('generate-social-image', {
          body: {
            clientId,
            prompt: concept.aiPrompt,
            templateType: 'quote_card',
            referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
            savedReferenceImageIds: refIds.length > 0 ? refIds : undefined,
            saveToAssets: true,
            model: concept.model,
            brandLogoUrl: includeLogo ? brandLogoUrl : undefined,
            logoPlacement: includeLogo ? logoPlacement : undefined,
          },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        updateConcept(concept.id, { status: 'done', resultUrl: data.imageUrl });

        // Save to database for history
        if (sessionId) {
          sequenceNumber++;
          await saveBatchItemToDb(sessionId, concept, sequenceNumber, data.imageUrl);
        }
      } catch (error) {
        console.error('Image generation error:', error);
        updateConcept(concept.id, { 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Generation failed' 
        });
      }

      // Small delay between generations
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Update session status to completed
    if (sessionId) {
      await supabase
        .from('ai_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId);
    }

    setIsGeneratingImages(false);
    toast({ title: 'Batch generation complete!' });
  };

  // Multi Mode: Regenerate Single Image with Feedback
  const handleRegenerateWithFeedback = async (conceptId: string, feedback: string, model: ImageModel) => {
    const concept = concepts.find(c => c.id === conceptId);
    if (!concept) return;

    const rateLimitCheck = checkAIImageRateLimit();
    if (!rateLimitCheck.allowed) {
      toast({
        title: 'Rate limit reached',
        description: `Please wait ${rateLimitCheck.waitTime} seconds.`,
        variant: 'destructive',
      });
      return;
    }

    recordAIImageRequest();
    updateConcept(conceptId, { status: 'generating' });

    try {
      // Combine original prompt with feedback
      const enhancedPrompt = `${concept.aiPrompt}\n\nADDITIONAL INSTRUCTIONS: ${feedback}`;
      const refIds = concept.useGlobalRefs ? selectedSavedImageIds : concept.overrideRefIds;

      const { data, error } = await supabase.functions.invoke('generate-social-image', {
        body: {
          clientId,
          prompt: enhancedPrompt,
          templateType: 'quote_card',
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
          savedReferenceImageIds: refIds.length > 0 ? refIds : undefined,
          saveToAssets: true,
          model,
          brandLogoUrl: includeLogo ? brandLogoUrl : undefined,
          logoPlacement: includeLogo ? logoPlacement : undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      updateConcept(conceptId, { 
        status: 'done', 
        resultUrl: data.imageUrl,
        model 
      });
      toast({ title: 'Image regenerated!' });
    } catch (error) {
      console.error('Regeneration error:', error);
      updateConcept(conceptId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Regeneration failed'
      });
      toast({
        title: 'Failed to regenerate',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  // Multi Mode: Retry Failed Image
  const handleRetryImage = async (conceptId: string) => {
    const concept = concepts.find(c => c.id === conceptId);
    if (!concept || !concept.aiPrompt) return;

    updateConcept(conceptId, { status: 'pending', error: undefined });
    
    // Trigger regeneration for this single image
    const rateLimitCheck = checkAIImageRateLimit();
    if (!rateLimitCheck.allowed) {
      toast({
        title: 'Rate limit reached',
        description: `Please wait ${rateLimitCheck.waitTime} seconds.`,
        variant: 'destructive',
      });
      return;
    }

    recordAIImageRequest();
    updateConcept(conceptId, { status: 'generating' });

    try {
      const refIds = concept.useGlobalRefs ? selectedSavedImageIds : concept.overrideRefIds;

      const { data, error } = await supabase.functions.invoke('generate-social-image', {
        body: {
          clientId,
          prompt: concept.aiPrompt,
          templateType: 'quote_card',
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
          savedReferenceImageIds: refIds.length > 0 ? refIds : undefined,
          saveToAssets: true,
          model: concept.model,
          brandLogoUrl: includeLogo ? brandLogoUrl : undefined,
          logoPlacement: includeLogo ? logoPlacement : undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      updateConcept(conceptId, { status: 'done', resultUrl: data.imageUrl });
      toast({ title: 'Image generated!' });
    } catch (error) {
      console.error('Retry error:', error);
      updateConcept(conceptId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Generation failed'
      });
    }
  };

  // Clear all concepts
  const handleClearAll = () => {
    setConcepts([
      { id: generateId(), description: '', aiPrompt: '', model: 'nano-banana', useGlobalRefs: true, overrideRefIds: [], status: 'pending' }
    ]);
    setCurrentBatchSessionId(null); // Reset session for next batch
  };

  const handleDownload = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
  };

  const handleAddToCalendarFromConcept = (concept: QuickConceptData) => {
    if (concept.resultUrl) {
      onAddToCalendar(concept.resultUrl, concept.description);
    }
  };

  // Single Mode: Regenerate with Feedback
  const handleSingleRegenerate = async (feedback?: string, selectedModel?: ImageModel, logoSettings?: { includeLogo: boolean; logoUrl: string | undefined }) => {
    if (!lastResult) return;

    const rateLimitCheck = checkAIImageRateLimit();
    if (!rateLimitCheck.allowed) {
      toast({
        title: 'Rate limit reached',
        description: `Please wait ${rateLimitCheck.waitTime} seconds.`,
        variant: 'destructive',
      });
      return;
    }

    setIsRegeneratingSingle(true);
    recordAIImageRequest();

    try {
      // Use the current image as a reference for the regeneration
      const regenerateRefs = [...referenceImages];
      if (lastResult.url) {
        regenerateRefs.unshift(lastResult.url);
      }

      const enhancedPrompt = feedback 
        ? `${lastResult.prompt}\n\nADDITIONAL INSTRUCTIONS: ${feedback}`
        : lastResult.prompt;

      // Determine logo: use explicit logoSettings from dialog if provided, else fall back to global setting
      const useLogo = logoSettings ? logoSettings.includeLogo : includeLogo;
      const logoUrl = logoSettings ? logoSettings.logoUrl : (includeLogo ? brandLogoUrl : undefined);

      const { data, error } = await supabase.functions.invoke('generate-social-image', {
        body: {
          clientId,
          prompt: enhancedPrompt,
          templateType: 'quote_card',
          referenceImages: regenerateRefs.length > 0 ? regenerateRefs : undefined,
          savedReferenceImageIds: selectedSavedImageIds.length > 0 ? selectedSavedImageIds : undefined,
          saveToAssets: true,
          model: selectedModel || model,
          brandLogoUrl: useLogo ? logoUrl : undefined,
          logoPlacement: useLogo ? logoPlacement : undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setLastResult({ url: data.imageUrl, prompt: lastResult.prompt });
      toast({ title: 'Image regenerated!' });
    } catch (error) {
      console.error('Regeneration error:', error);
      toast({
        title: 'Failed to regenerate',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsRegeneratingSingle(false);
    }
  };

  // Handle adding to calendar from result dialog
  const handleAddToCalendarFromDialog = (imageUrl: string, caption: string, _hashtags: string[]) => {
    onAddToCalendar(imageUrl, caption);
    setShowResultDialog(false);
  };

  const completedCount = concepts.filter(c => c.status === 'done').length;
  const pendingWithPromptCount = concepts.filter(c => c.status === 'pending' && c.aiPrompt.trim()).length;

  return (
    <div className="h-full flex">
      {/* Left Panel: Input */}
      <div className="w-[420px] border-r flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Mode Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Multi-Image Mode</Label>
              </div>
              <Switch
                checked={isMultiMode}
                onCheckedChange={setIsMultiMode}
              />
            </div>

            {/* Style & References Card */}
            <StyleSetupCard
              referenceImages={referenceImages}
              onReferenceImagesChange={setReferenceImages}
              styleNotes={styleNotes}
              onStyleNotesChange={setStyleNotes}
              brandLogoUrl={brandLogoUrl}
              includeLogo={includeLogo}
              onIncludeLogoChange={setIncludeLogo}
              logoPlacement={logoPlacement}
              onLogoPlacementChange={setLogoPlacement}
              clientId={clientId}
              selectedSavedImageIds={selectedSavedImageIds}
              onSelectedSavedImageIdsChange={setSelectedSavedImageIds}
            />

            <Separator />

            {isMultiMode ? (
              /* Multi-Image Mode */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Wand2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Multi-Generate</h3>
                      <p className="text-xs text-muted-foreground">{concepts.length} concept(s)</p>
                    </div>
                  </div>
                  {concepts.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAll}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Concept Cards */}
                <div className="space-y-3">
                  {concepts.map((concept, index) => (
                    <QuickImageConceptCard
                      key={concept.id}
                      concept={concept}
                      index={index}
                      globalReferences={clientReferenceImages}
                      selectedGlobalRefIds={selectedSavedImageIds}
                      onUpdate={(updates) => updateConcept(concept.id, updates)}
                      onRemove={() => removeConcept(concept.id)}
                      isGenerating={isGeneratingImages && concept.status === 'generating'}
                    />
                  ))}
                </div>

                {/* Add More Button */}
                <Button
                  variant="outline"
                  onClick={addConcept}
                  className="w-full gap-2"
                  disabled={concepts.length >= 10 || isGeneratingImages}
                >
                  <Plus className="h-4 w-4" />
                  Add Another Image ({concepts.length}/10)
                </Button>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  <Button
                    onClick={handleGeneratePrompts}
                    disabled={isGeneratingPrompts || isGeneratingImages || concepts.every(c => !c.description.trim())}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    {isGeneratingPrompts ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Generate AI Prompts
                  </Button>

                  <Button
                    onClick={handleGenerateAllImages}
                    disabled={isGeneratingImages || pendingWithPromptCount === 0}
                    size="lg"
                    className="w-full gap-2"
                  >
                    {isGeneratingImages ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    Generate All Images ({pendingWithPromptCount} pending)
                  </Button>
                </div>
              </div>
            ) : (
              /* Single Image Mode */
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-muted">
                    <Wand2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="font-semibold">Quick Generate</h2>
                    <p className="text-sm text-muted-foreground">Single image from prompt</p>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Model</Label>
                  <Select value={model} onValueChange={(v) => setModel(v as ImageModel)}>
                    <SelectTrigger className="h-10">
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

                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Prompt</Label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="E.g., 'A quote card about the importance of safety training with bold typography'"
                    className="resize-none h-32"
                  />
                </div>

                <Button
                  onClick={handleSingleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  size="lg"
                  className="w-full gap-2"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  Generate Image
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel: Results */}
      <div className="flex-1 bg-muted/30">
        {isMultiMode ? (
          <QuickGenerateGallery
            concepts={concepts}
            onAddToCalendar={handleAddToCalendarFromConcept}
            onDownload={handleDownload}
            onRegenerate={handleRegenerateWithFeedback}
            onRetry={handleRetryImage}
          />
        ) : (
          <div className="h-full flex items-center justify-center p-6">
            {lastResult ? (
              <div className="text-center space-y-4">
                <div className="rounded-xl overflow-hidden shadow-lg border bg-background max-w-md mx-auto relative">
                  {isRegeneratingSingle && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  )}
                  <img
                    src={lastResult.url}
                    alt={lastResult.prompt}
                    className="w-full h-auto cursor-pointer"
                    onClick={() => setShowResultDialog(true)}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground max-w-md mx-auto line-clamp-2">
                    "{lastResult.prompt}"
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setShowResultDialog(true)}
                  >
                    View & Edit
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <ImagePlus className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">Generated images will appear here</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Result Dialog for Single Mode */}
      {lastResult && (
        <QuickGenerateResultDialog
          isOpen={showResultDialog}
          onClose={() => setShowResultDialog(false)}
          imageUrl={lastResult.url}
          prompt={lastResult.prompt}
          clientId={clientId}
          brandLogoUrl={brandLogoUrl}
          onAddToCalendar={handleAddToCalendarFromDialog}
          onRegenerate={handleSingleRegenerate}
          isRegenerating={isRegeneratingSingle}
        />
      )}
    </div>
  );
}
