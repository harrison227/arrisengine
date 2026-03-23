import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Linkedin, Twitter, ArrowLeft, Settings2, Sparkles, CalendarClock, Plus } from 'lucide-react';
import { TextPlatform, useContentPlannerGuidelines, ContentPlannerGuideline } from '@/hooks/useContentPlannerGuidelines';
import { useTextPosts, TextPost } from '@/hooks/useTextPosts';
import { useTextPostSessions, TextPostSession } from '@/hooks/useTextPostSessions';
import { GuidelinesManager } from './GuidelinesManager';
import { AIChat } from './AIChat';
import { TextPostCard } from './TextPostCard';
import { TextPostEditDialog } from './TextPostEditDialog';
import { TextPostScheduler } from './TextPostScheduler';
import { TextPostActionBar } from './TextPostActionBar';
import { SessionHistoryDropdown } from './SessionHistoryDropdown';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import type { AISession } from '@/hooks/useAISession';


export interface TopPostContext {
  caption?: string;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  platform: string;
}

interface TextPostWorkspaceProps {
  platform: TextPlatform;
  clientId: string;
  clientName?: string;
  initialTopPostsContext?: TopPostContext[] | null;
  initialWorstPostsContext?: TopPostContext[] | null;
  onBack: () => void;
}

export function TextPostWorkspace({ platform, clientId, clientName, initialTopPostsContext, initialWorstPostsContext, onBack }: TextPostWorkspaceProps) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeGuideline, setActiveGuideline] = useState<ContentPlannerGuideline | null>(null);
  const [activeTab, setActiveTab] = useState<'draft' | 'approved' | 'scheduled'>('draft');
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [editingPost, setEditingPost] = useState<TextPost | null>(null);
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const sessionCreatedRef = useRef(false);
  const initialContextProcessedRef = useRef(false);
  
  const { guidelines, getDefaultGuideline, getGuidelinesByPlatform } = useContentPlannerGuidelines();
  const { 
    textPosts, 
    createPosts, 
    updatePost, 
    approvePosts, 
    schedulePosts, 
    deletePosts 
  } = useTextPosts(platform, clientId);
  const { 
    sessions, 
    isLoading: isLoadingSessions, 
    createSession, 
    updateSession, 
    deleteSession 
  } = useTextPostSessions(clientId, platform);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Set default guideline on mount
  useEffect(() => {
    const defaultGuideline = getDefaultGuideline(platform);
    if (defaultGuideline) {
      setActiveGuideline(defaultGuideline);
    }
  }, [platform, guidelines]);

  // Auto-trigger AI prompt when initialTopPostsContext is provided
  useEffect(() => {
    // Only run once when we have initial context and component is mounted
    if (
      initialTopPostsContext && 
      initialTopPostsContext.length > 0 && 
      !initialContextProcessedRef.current
    ) {
      // Mark as processed immediately to prevent re-runs
      initialContextProcessedRef.current = true;
      
      // Build the initial prompt based on top performing posts
      const topPostsSummary = initialTopPostsContext
        .map((p, i) => {
          const caption = p.caption?.slice(0, 200) || 'No caption';
          return `${i + 1}. "${caption}${p.caption && p.caption.length > 200 ? '...' : ''}"
   📊 ${p.impressions.toLocaleString()} impressions | ❤️ ${p.likes.toLocaleString()} likes | 💬 ${p.comments.toLocaleString()} comments | 🔄 ${p.shares.toLocaleString()} shares`;
        })
        .join('\n\n');
      
      // Build worst performers section if available
      let worstPostsSection = '';
      if (initialWorstPostsContext && initialWorstPostsContext.length > 0) {
        const worstPostsSummary = initialWorstPostsContext
          .map((p, i) => {
            const caption = p.caption?.slice(0, 150) || 'No caption';
            return `${i + 1}. "${caption}..."
   📊 ${p.impressions.toLocaleString()} impressions | ❤️ ${p.likes.toLocaleString()} likes`;
          })
          .join('\n');
        
        worstPostsSection = `

And here are my WORST performing posts - use these as examples of what to AVOID:

${worstPostsSummary}

Analyze why these underperformed and make sure the new posts don't repeat the same mistakes.`;
      }
      
      const initialPrompt = `Based on my top 5 highest-performing posts from the last 60 days, create 5 new post ideas that follow similar themes and styles. Here are my top performers:

${topPostsSummary}
${worstPostsSection}

Generate 5 fresh ${platform} posts that capture what made the top posts successful, while avoiding the patterns from the worst performers. Analyze the common themes, writing style, hooks, and engagement patterns.`;

      // Use setTimeout to ensure the component is fully mounted before triggering
      setTimeout(() => {
        handleSendMessage(initialPrompt);
      }, 100);
    }
  }, [initialTopPostsContext, initialWorstPostsContext, platform]);

  const platformConfig = {
    linkedin: {
      name: 'LinkedIn',
      icon: <Linkedin className="w-4 h-4" />,
      maxLength: 3000,
      description: 'Professional thought leadership posts',
    },
    twitter: {
      name: 'Twitter/X',
      icon: <Twitter className="w-4 h-4" />,
      maxLength: 280,
      description: 'Short tweets and threads',
    },
    threads: {
      name: 'Threads',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.028-3.576.878-6.43 2.523-8.483C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.332-3.023.85-.706 2.017-1.115 3.382-1.188 1.073-.057 2.099.053 3.07.328-.021-.848-.143-1.56-.364-2.134-.349-.907-1.01-1.358-2.02-1.378-.746.014-1.357.218-1.816.607-.41.349-.666.833-.76 1.44l-2.087-.29c.16-1.088.622-1.975 1.373-2.636.86-.758 2.005-1.157 3.307-1.152 1.713.034 3.016.67 3.874 1.892.67.955.984 2.247 1.03 4.226.02.184.028.373.028.568 0 .157-.005.31-.013.458a8.372 8.372 0 0 1 1.065.453c1.167.596 2.047 1.478 2.543 2.553.655 1.418.778 3.395-.477 5.623-1.265 2.246-3.378 3.576-6.287 3.958-.39.051-.79.077-1.199.077Zm-.515-9.154c-1.017.053-1.827.335-2.347.819-.44.409-.636.883-.602 1.45.034.567.292 1.035.768 1.392.515.388 1.21.585 2.007.539 1.08-.058 1.925-.463 2.508-1.204.457-.582.749-1.368.87-2.344-.74-.18-1.514-.289-2.31-.289-.3 0-.598.013-.894.037Z"/>
        </svg>
      ),
      maxLength: 500,
      description: 'Thread-style connected posts',
    },
  };

  const config = platformConfig[platform];
  const platformGuidelines = getGuidelinesByPlatform(platform);

  // Filter posts by status - approved excludes posts that are already scheduled on calendar
  const postsByStatus = useMemo(() => ({
    draft: textPosts.filter(p => p.status === 'draft'),
    approved: textPosts.filter(p => p.status === 'approved' && !p.scheduled_date),
    scheduled: textPosts.filter(p => p.status === 'scheduled' || (p.status === 'approved' && p.scheduled_date)),
  }), [textPosts]);

  const currentPosts = postsByStatus[activeTab];
  const selectedPosts = textPosts.filter(p => selectedPostIds.has(p.id));

  // Convert sessions to a compatible format for the dropdown
  const aiSessions = sessions.map(s => ({
    id: s.id,
    client_id: s.client_id,
    user_id: '',
    session_type: 'filming_plan' as const, // Type compatibility hack
    title: s.title,
    status: (s.status || 'in_progress') as 'in_progress' | 'completed' | 'paused',
    session_data: s.session_data as { messages?: Array<{ role: string; content: string }> },
    created_at: s.created_at,
    updated_at: s.updated_at,
  }));

  const handleNewSession = () => {
    setMessages([]);
    setCurrentSessionId(null);
    sessionCreatedRef.current = false;
  };

  const handleSelectSession = (session: AISession) => {
    setCurrentSessionId(session.id);
    const sessionData = session.session_data as TextPostSession['session_data'];
    setMessages(sessionData?.messages || []);
    
    // Restore guideline if saved
    if (sessionData?.guideline_id) {
      const guideline = guidelines.find(g => g.id === sessionData.guideline_id);
      if (guideline) {
        setActiveGuideline(guideline);
      }
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteSession.mutate(sessionId);
    if (currentSessionId === sessionId) {
      handleNewSession();
    }
  };

  const handleSendMessage = async (message: string) => {
    const newMessages = [...messages, { role: 'user' as const, content: message }];
    setMessages(newMessages);
    setIsLoading(true);

    // Create session if this is the first message
    if (!currentSessionId && !sessionCreatedRef.current) {
      sessionCreatedRef.current = true;
      try {
        const session = await createSession.mutateAsync({
          title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
          guidelineId: activeGuideline?.id,
          messages: newMessages,
        });
        setCurrentSessionId(session.id);
      } catch (error) {
        console.error('Failed to create session:', error);
      }
    }

    try {
      const { data, error } = await supabase.functions.invoke('ai-text-posts', {
        body: {
          clientId,
          platform,
          message,
          guidelines: activeGuideline?.text_guidelines || null,
          conversationHistory: messages,
          topPostsContext: initialTopPostsContext,
        },
      });

      if (error) throw error;

      const updatedMessages = [...newMessages, { role: 'assistant' as const, content: data.message }];
      setMessages(updatedMessages);

      // Update session with new messages
      if (currentSessionId) {
        updateSession.mutate({
          id: currentSessionId,
          messages: updatedMessages,
          postCount: data.posts?.length || 0,
        });
      }

      // Save generated posts to database
      if (data.posts?.length) {
        await createPosts.mutateAsync(
          data.posts.map((content: string) => ({
            client_id: clientId,
            platform,
            content,
            guideline_id: activeGuideline?.id,
            session_id: currentSessionId,
          }))
        );
        setActiveTab('draft');
        toast({
          title: 'Posts generated',
          description: `${data.posts.length} new posts saved as drafts.`,
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate content. Please try again.',
        variant: 'destructive',
      });
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPost = (id: string, selected: boolean) => {
    setSelectedPostIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPostIds(new Set(currentPosts.map(p => p.id)));
    } else {
      setSelectedPostIds(new Set());
    }
  };

  const handleEditPost = (post: TextPost) => {
    setEditingPost(post);
  };

  const handleSaveEdit = (
    id: string,
    content: string,
    scheduledDate?: string,
    status?: TextPost['status']
  ) => {
    const updates: Partial<TextPost> = { content };

    if (scheduledDate !== undefined) {
      updates.scheduled_date = scheduledDate ?? null;
    }

    if (status !== undefined) {
      updates.status = status;
    }

    updatePost.mutate({ id, updates });
  };

  const handleApprovePost = (id: string) => {
    approvePosts.mutate([id]);
  };

  const handleApproveSelected = () => {
    const draftIds = selectedPosts.filter(p => p.status === 'draft').map(p => p.id);
    if (draftIds.length > 0) {
      approvePosts.mutate(draftIds);
      setSelectedPostIds(new Set());
    }
  };

  const handleSchedulePost = (id: string) => {
    setSelectedPostIds(new Set([id]));
    setIsSchedulerOpen(true);
  };

  const handleScheduleSelected = () => {
    if (selectedPosts.length > 0) {
      setIsSchedulerOpen(true);
    }
  };

  const handleConfirmSchedule = (postsWithDates: { id: string; scheduled_date: string }[]) => {
    schedulePosts.mutate(postsWithDates, {
      onSuccess: () => {
        toast({
          title: 'Posts scheduled',
          description: `${postsWithDates.length} post(s) have been scheduled.`,
          action: (
            <Button variant="outline" size="sm" onClick={() => navigate('/content')}>
              View Calendar
            </Button>
          ),
        });
      },
    });
    setSelectedPostIds(new Set());
  };

  const handleDeletePost = (id: string) => {
    deletePosts.mutate([id]);
    setSelectedPostIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    const ids = Array.from(selectedPostIds);
    deletePosts.mutate(ids);
    setSelectedPostIds(new Set());
  };

  const allCurrentSelected = currentPosts.length > 0 && currentPosts.every(p => selectedPostIds.has(p.id));
  const isThreads = platform === 'threads';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="h-6 w-px bg-border" />
            <Badge variant="secondary" className="flex items-center gap-1.5">
              {config.icon}
              {config.name}
            </Badge>
            {clientName && (
              <span className="text-sm text-muted-foreground">
                for {clientName}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <SessionHistoryDropdown
              sessions={aiSessions}
              currentSessionId={currentSessionId}
              onSelectSession={handleSelectSession}
              onDeleteSession={handleDeleteSession}
              isLoading={isLoadingSessions}
            />
            <Button variant="outline" size="sm" onClick={handleNewSession}>
              <Plus className="w-4 h-4 mr-2" />
              New Session
            </Button>
            {activeGuideline && (
              <Badge variant="outline" className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                {activeGuideline.name}
              </Badge>
            )}
            <GuidelinesManager
              trigger={
                <Button variant="outline" size="sm">
                  <Settings2 className="w-4 h-4 mr-2" />
                  Guidelines
                </Button>
              }
            />
          </div>
        </div>
      </div>

      {/* Active guideline selector */}
      {platformGuidelines.length > 0 && (
        <div className="flex-shrink-0 px-6 py-3 border-b border-border bg-muted/30">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Using:</span>
              <Button
                variant={activeGuideline === null ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveGuideline(null)}
              >
                No guidelines
              </Button>
              {platformGuidelines.map((g) => (
                <Button
                  key={g.id}
                  variant={activeGuideline?.id === g.id ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveGuideline(g)}
                >
                  {g.name}
                  {g.is_default && <Badge variant="outline" className="ml-1.5 text-[10px] px-1">Default</Badge>}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs for post status */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-border">
        <div className="max-w-4xl mx-auto">
          <Tabs value={activeTab} onValueChange={(v) => {
            setActiveTab(v as typeof activeTab);
            setSelectedPostIds(new Set());
          }}>
            <TabsList>
              <TabsTrigger value="draft">
                Drafts ({postsByStatus.draft.length})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({postsByStatus.approved.length})
              </TabsTrigger>
              <TabsTrigger value="scheduled">
                Scheduled ({postsByStatus.scheduled.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 min-h-0 overflow-hidden flex">
        {/* Chat panel */}
        <div className="flex-1 min-w-0 border-r border-border">
          <AIChat
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            placeholder={`Describe what ${config.name} posts you want to create...`}
            clientName={clientName}
          />
        </div>

        {/* Posts panel */}
        <div className="w-[400px] flex flex-col bg-muted/30">
          <div className="flex-shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allCurrentSelected}
                onCheckedChange={handleSelectAll}
                disabled={currentPosts.length === 0}
              />
              <span className="text-sm font-medium">
                {currentPosts.length} {activeTab} post{currentPosts.length !== 1 ? 's' : ''}
              </span>
            </div>

            {isThreads && activeTab === 'approved' && postsByStatus.approved.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedPostIds(new Set(postsByStatus.approved.map(p => p.id)));
                  setIsSchedulerOpen(true);
                }}
              >
                <CalendarClock className="w-4 h-4 mr-2" />
                Auto-Schedule 30 Days
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {currentPosts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No {activeTab} posts yet.</p>
                {activeTab === 'draft' && (
                  <p className="text-xs mt-1">Generate posts using the chat on the left.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {currentPosts.map((post) => (
                  <TextPostCard
                    key={post.id}
                    post={post}
                    isSelected={selectedPostIds.has(post.id)}
                    onSelect={handleSelectPost}
                    onEdit={handleEditPost}
                    onApprove={handleApprovePost}
                    onSchedule={handleSchedulePost}
                    onDelete={handleDeletePost}
                    characterLimit={config.maxLength}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <TextPostActionBar
        selectedCount={selectedPostIds.size}
        onApprove={handleApproveSelected}
        onSchedule={handleScheduleSelected}
        onDelete={handleDeleteSelected}
        onClearSelection={() => setSelectedPostIds(new Set())}
      />

      {/* Edit dialog */}
      <TextPostEditDialog
        post={editingPost}
        open={!!editingPost}
        onOpenChange={(open) => !open && setEditingPost(null)}
        onSave={handleSaveEdit}
        characterLimit={config.maxLength}
      />

      {/* Scheduler */}
      <TextPostScheduler
        open={isSchedulerOpen}
        onOpenChange={setIsSchedulerOpen}
        posts={selectedPosts.filter(p => p.status === 'approved' || p.status === 'draft')}
        onSchedule={handleConfirmSchedule}
        platform={platform}
        clientId={clientId}
      />
    </div>
  );
}
