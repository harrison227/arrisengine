import { useState, useCallback } from 'react';
import { Loader2, Wand2, Download, CalendarPlus, RefreshCw, Check, X, Expand } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StyleSetupCard, type LogoPlacement } from './StyleSetupCard';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { checkAIImageRateLimit, recordAIImageRequest } from '@/hooks/useRateLimiter';

type ImageModel = 'nano-banana' | 'nano-banana-2' | 'nano-banana-pro';

interface ReferenceImage {
  id: string;
  url: string;
  name: string;
}

interface VariationsWorkspaceProps {
  clientId: string;
  clientReferenceImages: ReferenceImage[];
  brandLogoUrl?: string | null;
  onAddToCalendar: (url: string, prompt: string) => void;
  onSessionCreated?: (sessionId: string) => void;
  clientName?: string;
}

interface VariationSlot {
  id: string;
  status: 'idle' | 'generating' | 'done' | 'error';
  imageUrl: string | null;
  error: string | null;
  label: string;
  suffix: string;
}

const VARIATION_STYLES = [
  { label: 'Version A', suffix: '' },
  { label: 'Version B', suffix: '' },
  { label: 'Version C', suffix: '' },
  { label: 'Version D', suffix: '' },
];

export function VariationsWorkspace({
  clientId,
  clientReferenceImages,
  brandLogoUrl,
  onAddToCalendar,
  onSessionCreated,
  clientName,
}: VariationsWorkspaceProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<ImageModel>('nano-banana-2');
  const [isGenerating, setIsGenerating] = useState(false);

  // Style state
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [styleNotes, setStyleNotes] = useState('');
  const [includeLogo, setIncludeLogo] = useState(true);
  const [logoPlacement, setLogoPlacement] = useState<LogoPlacement>('auto');
  const [selectedSavedImageIds, setSelectedSavedImageIds] = useState<string[]>([]);

  const [slots, setSlots] = useState<VariationSlot[]>(
    VARIATION_STYLES.map((v, i) => ({
      id: `slot-${i}`,
      status: 'idle',
      imageUrl: null,
      error: null,
      label: v.label,
      suffix: v.suffix,
    }))
  );

  const resetSlots = () => {
    setSlots(VARIATION_STYLES.map((v, i) => ({
      id: `slot-${i}`,
      status: 'idle',
      imageUrl: null,
      error: null,
      label: v.label,
      suffix: v.suffix,
    })));
  };

  const generateVariations = async () => {
    if (!prompt.trim()) return;

    const rateLimitCheck = checkAIImageRateLimit();
    if (!rateLimitCheck.allowed) {
      toast({
        title: 'Rate limit reached',
        description: `Please wait ${rateLimitCheck.waitTime} seconds.`,
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    // Reset slots to generating
    setSlots(prev => prev.map(s => ({ ...s, status: 'generating' as const, imageUrl: null, error: null })));

    // Create session
    let sessionId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: session, error: sessionError } = await supabase
        .from('ai_sessions')
        .insert({
          client_id: clientId,
          user_id: user.id,
          session_type: 'image_batch',
          title: `Variations - ${clientName || 'Client'} - ${new Date().toLocaleDateString()}`,
          status: 'in_progress',
          session_data: { type: 'variations', prompt: prompt.trim() },
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      sessionId = session.id;
      onSessionCreated?.(sessionId);
    } catch (err) {
      console.error('Failed to create session:', err);
      toast({ title: 'Failed to start generation', variant: 'destructive' });
      setIsGenerating(false);
      setSlots(prev => prev.map(s => ({ ...s, status: 'idle' as const })));
      return;
    }

    // Generate 4 images in parallel
    const results = await Promise.allSettled(
      slots.map(async (slot, index) => {
        recordAIImageRequest();
        const variantPrompt = prompt.trim();

        const { data, error } = await supabase.functions.invoke('generate-social-image', {
          body: {
            clientId,
            prompt: variantPrompt,
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

        // Save to batch items
        if (sessionId) {
          await supabase.from('image_batch_items').insert({
            session_id: sessionId,
            sequence_number: index + 1,
            concept: prompt.trim(),
            template_type: 'quote_card',
            platform: 'instagram',
            status: 'pending',
            generated_image_url: data.imageUrl,
            model_used: model,
            prompt_additions: slot.suffix,
          });
        }

        return { index, url: data.imageUrl };
      })
    );

    // Update slots with results
    setSlots(prev => {
      const updated = [...prev];
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          updated[i] = { ...updated[i], status: 'done', imageUrl: result.value.url };
        } else {
          updated[i] = { ...updated[i], status: 'error', error: 'Generation failed' };
        }
      });
      return updated;
    });

    setIsGenerating(false);
    queryClient.invalidateQueries({ queryKey: ['all-client-images', clientId] });

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    toast({ title: `Generated ${successCount}/4 variations` });
  };

  const handleRegenerateSlot = useCallback(async (slotIndex: number) => {
    const slot = slots[slotIndex];
    const rateLimitCheck = checkAIImageRateLimit();
    if (!rateLimitCheck.allowed) {
      toast({
        title: 'Rate limit reached',
        description: `Please wait ${rateLimitCheck.waitTime} seconds.`,
        variant: 'destructive',
      });
      return;
    }

    setSlots(prev => {
      const updated = [...prev];
      updated[slotIndex] = { ...updated[slotIndex], status: 'generating', error: null };
      return updated;
    });

    recordAIImageRequest();

    try {
      const variantPrompt = prompt.trim();
      const { data, error } = await supabase.functions.invoke('generate-social-image', {
        body: {
          clientId,
          prompt: variantPrompt,
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

      setSlots(prev => {
        const updated = [...prev];
        updated[slotIndex] = { ...updated[slotIndex], status: 'done', imageUrl: data.imageUrl };
        return updated;
      });

      queryClient.invalidateQueries({ queryKey: ['all-client-images', clientId] });
    } catch (err) {
      console.error('Regenerate failed:', err);
      setSlots(prev => {
        const updated = [...prev];
        updated[slotIndex] = { ...updated[slotIndex], status: 'error', error: 'Regeneration failed' };
        return updated;
      });
    }
  }, [slots, prompt, clientId, model, referenceImages, selectedSavedImageIds, includeLogo, brandLogoUrl, logoPlacement, queryClient, toast]);

  const handleDownload = (url: string, index: number) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `variation-${index + 1}.png`;
    link.click();
  };

  const [fullscreenSlot, setFullscreenSlot] = useState<VariationSlot | null>(null);

  const hasResults = slots.some(s => s.status === 'done' || s.status === 'error');

  return (
    <div className="h-full flex">
      {/* Left: Input Panel */}
      <div className="w-[360px] border-r bg-card/50 flex flex-col shrink-0">
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Concept</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your image concept... e.g. 'A professional team meeting in a modern office with natural lighting'"
              className="min-h-[100px] resize-none"
            />
          </div>

          <div>
            <Label className="text-sm font-medium mb-1.5 block">Model</Label>
            <Select value={model} onValueChange={(v) => setModel(v as ImageModel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nano-banana-2">Nano Banana 2</SelectItem>
                <SelectItem value="nano-banana-pro">Nano Banana Pro (Highest Quality)</SelectItem>
                <SelectItem value="nano-banana">Nano Banana (Legacy)</SelectItem>
              </SelectContent>
            </Select>
          </div>

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

          <Button
            onClick={generateVariations}
            disabled={!prompt.trim() || isGenerating}
            className="w-full gap-2"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating 4 Versions...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Generate 4 Versions
              </>
            )}
          </Button>

          {hasResults && (
            <Button
              variant="outline"
              onClick={() => { resetSlots(); setPrompt(''); }}
              className="w-full"
              size="sm"
            >
              Start New Concept
            </Button>
          )}
        </div>
      </div>

      {/* Right: 2x2 Grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        {!hasResults && !isGenerating ? (
          <div className="h-full flex items-center justify-center text-center">
            <div>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                <Wand2 className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Generate Variations</h3>
              <p className="text-muted-foreground text-sm max-w-sm">
                Enter a concept on the left and generate 4 different visual interpretations at once.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 h-full auto-rows-fr">
            {slots.map((slot, index) => (
              <div
                key={slot.id}
                className="relative rounded-lg border bg-card overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="px-3 py-2 border-b flex items-center justify-between shrink-0">
                  <span className="text-xs font-medium text-muted-foreground">{slot.label}</span>
                  <Badge
                    variant={
                      slot.status === 'done' ? 'default' :
                      slot.status === 'generating' ? 'secondary' :
                      slot.status === 'error' ? 'destructive' : 'outline'
                    }
                    className="text-[10px] h-5"
                  >
                    {slot.status === 'generating' ? 'Generating...' :
                     slot.status === 'done' ? 'Done' :
                     slot.status === 'error' ? 'Error' : 'Waiting'}
                  </Badge>
                </div>

                {/* Image Area */}
                <div className="flex-1 relative min-h-0">
                  {slot.status === 'generating' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  )}

                  {slot.status === 'error' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/30">
                      <X className="h-6 w-6 text-destructive" />
                      <p className="text-xs text-muted-foreground">Failed</p>
                      <Button size="sm" variant="outline" onClick={() => handleRegenerateSlot(index)}>
                        <RefreshCw className="h-3 w-3 mr-1" /> Retry
                      </Button>
                    </div>
                  )}

                  {slot.status === 'done' && slot.imageUrl && (
                    <>
                      <img
                        src={slot.imageUrl}
                        alt={slot.label}
                        className="w-full h-full object-contain cursor-pointer bg-muted/30"
                        onClick={() => setFullscreenSlot(slot)}
                        decoding="async"
                      />
                      {/* Hover actions */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-center gap-2 p-3 opacity-0 hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 gap-1.5 text-xs"
                          onClick={(e) => { e.stopPropagation(); handleDownload(slot.imageUrl!, index); }}
                        >
                          <Download className="h-3 w-3" /> Download
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 gap-1.5 text-xs"
                          onClick={(e) => { e.stopPropagation(); onAddToCalendar(slot.imageUrl!, prompt); }}
                        >
                          <CalendarPlus className="h-3 w-3" /> Calendar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 gap-1.5 text-xs"
                          onClick={(e) => { e.stopPropagation(); handleRegenerateSlot(index); }}
                        >
                          <RefreshCw className="h-3 w-3" /> Redo
                        </Button>
                      </div>
                    </>
                  )}

                  {slot.status === 'idle' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
                      <p className="text-xs text-muted-foreground">Waiting</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Fullscreen Preview Dialog */}
      <Dialog open={!!fullscreenSlot} onOpenChange={(open) => !open && setFullscreenSlot(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{fullscreenSlot?.label || 'Generated Image'}</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            {fullscreenSlot?.imageUrl && (
              <>
                <img
                  src={fullscreenSlot.imageUrl}
                  alt={fullscreenSlot.label}
                  className="w-full rounded-lg"
                />
                <div className="flex gap-2 mt-4 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const idx = slots.findIndex(s => s.id === fullscreenSlot.id);
                      if (idx >= 0) handleDownload(fullscreenSlot.imageUrl!, idx);
                    }}
                  >
                    <Download className="h-4 w-4 mr-1.5" /> Download
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      onAddToCalendar(fullscreenSlot.imageUrl!, prompt);
                      setFullscreenSlot(null);
                    }}
                  >
                    <CalendarPlus className="h-4 w-4 mr-1.5" /> Add to Calendar
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
