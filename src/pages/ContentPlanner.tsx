import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useClients } from '@/hooks/useClients';
import { useAISession, AISession } from '@/hooks/useAISession';
import { useAgencySettings } from '@/hooks/useAgencySettings';
import { useContentPlans } from '@/hooks/useContentPlans';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AIChat } from '@/components/planner/AIChat';
import { DraftPreview } from '@/components/planner/DraftPreview';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SessionHistoryDropdown } from '@/components/planner/SessionHistoryDropdown';
import { AutosaveIndicator } from '@/components/planner/AutosaveIndicator';
import { ContentPlannerSettings } from '@/components/planner/ContentPlannerSettings';
import { SavePlanDialog } from '@/components/dialogs/SavePlanDialog';
import { PlatformModeSelector } from '@/components/planner/PlatformModeSelector';
import { TextPostWorkspace } from '@/components/planner/TextPostWorkspace';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, FileText, Sparkles, Save, Eye, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { TextPlatform } from '@/hooks/useContentPlannerGuidelines';
import type { TopPostContext } from '@/components/planner/TextPostWorkspace';

export default function ContentPlanner() {
  type ContentIdea = {
    hook: string;
    script?: string;
    shotList?: string[];
    audioSuggestion?: string;
    formatType: string;
    platform: string;
    trendingAngle?: string;
    duration?: number;
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [draftPlan, setDraftPlan] = useState<any>(null);
  const [pendingIdeas, setPendingIdeas] = useState<ContentIdea[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isPlanSheetOpen, setIsPlanSheetOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isViewingPendingIdeas, setIsViewingPendingIdeas] = useState(false);
  
  // Mode selection: null = not selected, 'video' = existing flow, 'text' = text posts
  const [plannerMode, setPlannerMode] = useState<'video' | 'text' | null>(null);
  const [selectedTextPlatform, setSelectedTextPlatform] = useState<TextPlatform | null>(null);
  const [topPostsContext, setTopPostsContext] = useState<TopPostContext[] | null>(null);
  const [worstPostsContext, setWorstPostsContext] = useState<TopPostContext[] | null>(null);
  
  const { clients, isLoading: clientsLoading } = useClients();
  const {
    sessions,
    isLoading: sessionsLoading,
    createSession,
    sendMessage,
    appendIdeas,
    isSending,
    isAppendingIdeas,
    deleteSession,
  } = useAISession(selectedClientId, 'filming_plan');
  const { settings: agencySettings } = useAgencySettings();
  const { savePlan, isSaving: isSavingPlan } = useContentPlans();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Refs to prevent race conditions with deep-link state
  // hasMountedRef: prevents the client-change reset effect from running on initial mount
  const hasMountedRef = useRef(false);
  // skipNextClientResetRef: when true, the next client-change won't reset plannerMode/platform
  const skipNextClientResetRef = useRef(false);
  // deepLinkAppliedThisMountRef: ensures we only apply a deep-link once per mount
  const deepLinkAppliedThisMountRef = useRef(false);
  const PENDING_DEEPLINK_STORAGE_KEY = 'contentPlanner:pendingDeepLink';

  // Handle deep linking from analytics - use location.state (preferred) or URL params (fallback)
  // plus a sessionStorage fallback to survive React 18 StrictMode remounts in dev.
  useEffect(() => {
    if (deepLinkAppliedThisMountRef.current) return;

    const locationState = location.state as {
      clientId?: string;
      platform?: string;
      topPostsContext?: TopPostContext[];
      worstPostsContext?: TopPostContext[];
    } | null;

    // Read any persisted deep-link payload (helps in dev StrictMode where we remount)
    let storedState: {
      clientId?: string;
      platform?: string;
      topPostsContext?: TopPostContext[] | null;
      worstPostsContext?: TopPostContext[] | null;
      createdAt?: number;
    } | null = null;

    try {
      const raw = sessionStorage.getItem(PENDING_DEEPLINK_STORAGE_KEY);
      if (raw) storedState = JSON.parse(raw);
    } catch {
      storedState = null;
    }

    const storedIsFresh =
      typeof storedState?.createdAt === 'number' && Date.now() - storedState.createdAt < 60_000;

    if (storedState && !storedIsFresh) {
      try {
        sessionStorage.removeItem(PENDING_DEEPLINK_STORAGE_KEY);
      } catch {
        // ignore
      }
      storedState = null;
    }

    const hasStored = !!(storedState?.clientId && storedState?.platform);

    // Skip if no deep-link data
    const hasLocationState = !!(locationState?.clientId && locationState?.platform);
    const hasUrlParams = !!(searchParams.get('clientId') && searchParams.get('platform'));

    if (!hasLocationState && !hasUrlParams && !hasStored) return;

    // Wait for clients to load
    if (clients.length === 0) return;

    const normalizeTextPlatform = (p?: string | null): TextPlatform | null => {
      const v = (p ?? '').toString().trim().toLowerCase();
      if (!v) return null;
      if (v === 'linkedin') return 'linkedin';
      if (v === 'twitter' || v === 'x' || v === 'twitter/x' || v === 'twitter-x') return 'twitter';
      if (v === 'threads' || v === 'thread') return 'threads';
      return null;
    };

    const applyDeepLink = (payload: {
      clientId: string;
      platform: string;
      topPostsContext?: TopPostContext[] | null;
      worstPostsContext?: TopPostContext[] | null;
    }) => {
      const clientExists = clients.some((c) => c.id === payload.clientId);
      if (!clientExists) return false;

      const normalizedPlatform = normalizeTextPlatform(payload.platform);
      if (!normalizedPlatform) return false;

      // Persist payload so a dev StrictMode remount can still read it
      try {
        sessionStorage.setItem(
          PENDING_DEEPLINK_STORAGE_KEY,
          JSON.stringify({
            clientId: payload.clientId,
            platform: payload.platform,
            topPostsContext: payload.topPostsContext ?? null,
            worstPostsContext: payload.worstPostsContext ?? null,
            createdAt: Date.now(),
          })
        );
      } catch {
        // ignore
      }

      // Tell the reset effect to skip resetting plannerMode/platform/context for the next client change
      skipNextClientResetRef.current = true;

      // Apply all state
      setSelectedClientId(payload.clientId);
      setPlannerMode('text');
      setSelectedTextPlatform(normalizedPlatform);
      setTopPostsContext(payload.topPostsContext ?? null);
      setWorstPostsContext(payload.worstPostsContext ?? null);
      deepLinkAppliedThisMountRef.current = true;

      // Clear persisted payload shortly after (keeps it around for dev StrictMode remount)
      setTimeout(() => {
        try {
          sessionStorage.removeItem(PENDING_DEEPLINK_STORAGE_KEY);
        } catch {
          // ignore
        }
      }, 5000);

      return true;
    };

    // Process location.state first (preferred)
    if (hasLocationState && locationState) {
      const applied = applyDeepLink({
        clientId: locationState.clientId!,
        platform: locationState.platform!,
        topPostsContext: locationState.topPostsContext ?? null,
        worstPostsContext: locationState.worstPostsContext ?? null,
      });

      if (applied) {
        // Clear location state AFTER state is set
        setTimeout(() => {
          navigate(location.pathname, { replace: true, state: null });
        }, 0);
      }

      return;
    }

    // Fallback to URL params
    if (hasUrlParams) {
      const clientIdParam = searchParams.get('clientId')!;
      const platformParamRaw = searchParams.get('platform')!;
      const topPostsParam = searchParams.get('topPostsContext');
      const worstPostsParam = searchParams.get('worstPostsContext');

      let parsedTopPosts: TopPostContext[] | null = null;
      let parsedWorstPosts: TopPostContext[] | null = null;

      if (topPostsParam) {
        try {
          parsedTopPosts = JSON.parse(topPostsParam) as TopPostContext[];
        } catch (e) {
          console.error('Failed to parse top posts context:', e);
        }
      }

      if (worstPostsParam) {
        try {
          parsedWorstPosts = JSON.parse(worstPostsParam) as TopPostContext[];
        } catch (e) {
          console.error('Failed to parse worst posts context:', e);
        }
      }

      const applied = applyDeepLink({
        clientId: clientIdParam,
        platform: platformParamRaw,
        topPostsContext: parsedTopPosts,
        worstPostsContext: parsedWorstPosts,
      });

      if (applied) {
        // Clear URL params after state is set
        setTimeout(() => {
          setSearchParams({}, { replace: true });
        }, 0);
      }

      return;
    }

    // Final fallback: persisted payload (dev StrictMode-safe)
    if (hasStored && storedState?.clientId && storedState?.platform) {
      applyDeepLink({
        clientId: storedState.clientId,
        platform: storedState.platform,
        topPostsContext: storedState.topPostsContext ?? null,
        worstPostsContext: storedState.worstPostsContext ?? null,
      });
    }
  }, [location.state, searchParams, clients, setSearchParams, navigate, location.pathname]);

  // Reset state when client changes (but skip on initial mount and when deep-link just set the client)
  useEffect(() => {
    // Skip the first run (initial mount) to avoid consuming the skip flag prematurely
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    // Always reset chat/session state on any real client change
    setMessages([]);
    setDraftPlan(null);
    setPendingIdeas([]);
    setCurrentSessionId(null);
    setLastSaved(null);
    
    // Check if we should skip resetting plannerMode (deep-link just set it)
    if (skipNextClientResetRef.current) {
      skipNextClientResetRef.current = false;
      // Don't reset plannerMode/platform/context - deep-link already set them
    } else {
      // Normal client switch - reset everything
      setPlannerMode(null);
      setSelectedTextPlatform(null);
      setTopPostsContext(null);
      setWorstPostsContext(null);
    }
  }, [selectedClientId]);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const handleStartSession = async () => {
    if (!selectedClientId) return;
    try {
      const session = await createSession({ clientId: selectedClientId, sessionType: 'filming_plan' });
      setCurrentSessionId(session.id);
      setMessages([]);
      setDraftPlan(null);
      setIsPlanSheetOpen(false);
      
      const response = await sendMessage({
        sessionId: session.id,
        clientId: selectedClientId,
        message: `I need to plan a filming day for ${selectedClient?.business_name}. What information do you need to create a great content plan?`
      });
      
      setMessages([
        { role: 'user', content: `I need to plan a filming day for ${selectedClient?.business_name}. What information do you need to create a great content plan?` },
        { role: 'assistant', content: response.message }
      ]);
      if (response.draftPlan?.contentIdeas?.length) {
        setPendingIdeas(response.draftPlan.contentIdeas);
        toast({
          title: 'Ideas ready to add',
          description: `${response.draftPlan.contentIdeas.length} ideas are ready — click “Add to plan” below.`
        });
      } else if (response.draftPlan) {
        setDraftPlan(response.draftPlan);
        setIsPlanSheetOpen(true);
      }
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!selectedClientId) return;
    
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    
    try {
      const response = await sendMessage({
        sessionId: currentSessionId || undefined,
        clientId: selectedClientId,
        message
      });
      
      setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
      if (response.draftPlan?.contentIdeas?.length) {
        setPendingIdeas(response.draftPlan.contentIdeas);
        toast({
          title: 'Ideas ready to add',
          description: `${response.draftPlan.contentIdeas.length} ideas are ready — click “Add to plan” below.`
        });
      } else if (response.draftPlan) {
        setDraftPlan(response.draftPlan);
        setIsPlanSheetOpen(true);
      }
      if (response.sessionId && !currentSessionId) setCurrentSessionId(response.sessionId);
      setLastSaved(new Date());
    } catch (error) {
      setMessages(prev => prev.slice(0, -1));
    }
  };

  const handleSelectSession = (session: AISession) => {
    setCurrentSessionId(session.id);
    setMessages(session.session_data?.messages?.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    })) || []);
    setDraftPlan(session.session_data?.draftPlan || null);
    if (session.session_data?.draftPlan) {
      setIsPlanSheetOpen(true);
    }
    toast({ title: 'Session loaded', description: session.title || 'Previous session restored' });
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteSession(sessionId);
    if (sessionId === currentSessionId) {
      setCurrentSessionId(null);
      setMessages([]);
      setDraftPlan(null);
    }
  };

  const handleApprove = async () => {
    if (!selectedClientId || !draftPlan?.contentIdeas?.length) return;
    
    try {
      await savePlan({
        clientId: selectedClientId,
        title: defaultPlanTitle,
        contentIdeas: draftPlan.contentIdeas,
      });
      setIsPlanSheetOpen(false);
      setDraftPlan(null);
      navigate('/saved-plans');
    } catch (error) {
      console.error('Failed to save plan:', error);
    }
  };

  const handleAddPendingToPlan = async () => {
    if (!selectedClientId || !currentSessionId || pendingIdeas.length === 0) return;

    const count = pendingIdeas.length;
    try {
      const response = await appendIdeas({
        sessionId: currentSessionId,
        clientId: selectedClientId,
        ideas: pendingIdeas,
      });

      if (response?.draftPlan) {
        setDraftPlan(response.draftPlan);
      }

      setPendingIdeas([]);
      setIsPlanSheetOpen(true);
      setLastSaved(new Date());
      toast({ title: 'Added to plan', description: `Added ${count} idea${count === 1 ? '' : 's'} to your plan.` });
    } catch (error) {
      console.error('Failed to append ideas:', error);
    }
  };

  const handleDiscardPending = () => {
    setPendingIdeas([]);
  };

  const handleDeleteIdea = (index: number) => {
    if (!draftPlan?.contentIdeas) return;
    const updatedIdeas = draftPlan.contentIdeas.filter((_: any, i: number) => i !== index);
    setDraftPlan({ ...draftPlan, contentIdeas: updatedIdeas });
  };

  const handleAddIdea = (idea: { hook: string; formatType: string; platform: string; duration?: number; trendingAngle?: string }) => {
    const updatedIdeas = [...(draftPlan?.contentIdeas || []), idea];
    setDraftPlan({ ...draftPlan, contentIdeas: updatedIdeas });
  };

  const handleSavePlan = async (title: string, strategyNotes?: string) => {
    if (!selectedClientId || !draftPlan?.contentIdeas?.length) return;
    
    try {
      await savePlan({
        clientId: selectedClientId,
        title,
        contentIdeas: draftPlan.contentIdeas,
        strategyNotes,
      });
      setIsSaveDialogOpen(false);
    } catch (error) {
      console.error('Failed to save plan:', error);
    }
  };

  const defaultPlanTitle = selectedClient 
    ? `${selectedClient.business_name} - ${format(new Date(), 'MMM d, yyyy')}`
    : '';

  return (
    <div className="min-h-screen h-[100dvh] flex flex-col overflow-hidden">
      {/* Minimal Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.business_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-2">
            <AutosaveIndicator isSaving={isSending} lastSaved={lastSaved} />
            <ContentPlannerSettings />
            {selectedClientId && sessions.length > 0 && (
              <SessionHistoryDropdown
                sessions={sessions}
                currentSessionId={currentSessionId}
                onSelectSession={handleSelectSession}
                onDeleteSession={handleDeleteSession}
                isLoading={sessionsLoading}
              />
            )}
            {selectedClientId && (
              <Button variant="outline" size="sm" onClick={handleStartSession} disabled={isSending}>
                <Plus className="w-4 h-4 mr-2" />
                New Session
              </Button>
            )}
            {pendingIdeas.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsViewingPendingIdeas(true)}
              >
                <Eye className="w-4 h-4 mr-2" />
                View {pendingIdeas.length} Ideas
              </Button>
            )}
            {draftPlan?.contentIdeas?.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsSaveDialogOpen(true)}
                disabled={isSavingPlan}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Plan
              </Button>
            )}
            {draftPlan && (
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => setIsPlanSheetOpen(true)}
              >
                <FileText className="w-4 h-4 mr-2" />
                View Plan
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {!selectedClientId ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md px-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">Content Planner</h2>
              <p className="text-muted-foreground mb-6">
                Plan filming days and generate content ideas with AI assistance. Select a client to get started.
              </p>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="w-full max-w-xs mx-auto">
                  <SelectValue placeholder="Choose a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.business_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : plannerMode === null ? (
          <PlatformModeSelector
            onSelectVideo={() => setPlannerMode('video')}
            onSelectTextPlatform={(platform) => {
              setPlannerMode('text');
              setSelectedTextPlatform(platform);
            }}
          />
        ) : plannerMode === 'text' && selectedTextPlatform ? (
          <TextPostWorkspace
            platform={selectedTextPlatform}
            clientId={selectedClientId}
            clientName={selectedClient?.business_name}
            initialTopPostsContext={topPostsContext}
            initialWorstPostsContext={worstPostsContext}
            onBack={() => {
              setPlannerMode(null);
              setSelectedTextPlatform(null);
              setTopPostsContext(null);
              setWorstPostsContext(null);
            }}
          />
        ) : (
          <AIChat
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isSending || isAppendingIdeas}
            placeholder="Describe your filming goals, ask for content ideas..."
            clientName={selectedClient?.business_name}
            footer={
              pendingIdeas.length > 0 ? (
                <div className="max-w-3xl mx-auto px-6 pt-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
                    <div className="text-sm">
                      <span className="font-medium text-foreground">{pendingIdeas.length} ideas ready</span>
                      <span className="text-muted-foreground"> — add this batch to your plan?</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDiscardPending}
                        disabled={isSending || isAppendingIdeas}
                      >
                        Discard
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={handleAddPendingToPlan}
                        disabled={!currentSessionId || isSending || isAppendingIdeas}
                      >
                        Add to plan
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null
            }
          />
        )}
      </div>

      {/* Slide-in Plan Sheet */}
      <Sheet open={isPlanSheetOpen} onOpenChange={setIsPlanSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle>Draft Plan Preview</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 -mx-6 px-6">
            <DraftPreview
              draftPlan={draftPlan}
              onApprove={handleApprove}
              onDeleteIdea={handleDeleteIdea}
              onAddIdea={handleAddIdea}
              clientName={selectedClient?.business_name}
              agencySettings={agencySettings}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Save Plan Dialog */}
      <SavePlanDialog
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        onSave={handleSavePlan}
        isSaving={isSavingPlan}
        defaultTitle={defaultPlanTitle}
      />

      {/* View Pending Ideas Sheet */}
      <Sheet open={isViewingPendingIdeas} onOpenChange={setIsViewingPendingIdeas}>
        <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle>Generated Ideas ({pendingIdeas.length})</SheetTitle>
          </SheetHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-3 py-4">
              {pendingIdeas.map((idea, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardContent className="pt-4 pb-3">
                    <p className="font-medium text-foreground leading-snug">{idea.hook}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Badge variant="outline">{idea.formatType}</Badge>
                      {(Array.isArray(idea.platform) ? idea.platform : [idea.platform]).map((p, pIdx) => (
                        <Badge key={pIdx} variant="secondary">{p}</Badge>
                      ))}
                      {idea.duration && (
                        <Badge variant="outline">{idea.duration}s</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
          <div className="flex gap-2 pt-4 border-t border-border flex-shrink-0">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => {
                handleDiscardPending();
                setIsViewingPendingIdeas(false);
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Discard All
            </Button>
            <Button 
              className="flex-1"
              onClick={() => { 
                handleAddPendingToPlan(); 
                setIsViewingPendingIdeas(false); 
              }}
              disabled={!currentSessionId || isAppendingIdeas}
            >
              Add All to Plan
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
