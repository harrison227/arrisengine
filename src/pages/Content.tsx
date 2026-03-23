import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Calendar, Plus, ChevronLeft, ChevronRight, Video, GripVertical, CalendarDays, CalendarRange, Link2, Send, Loader2, RefreshCw, Inbox, ChevronDown, ChevronUp, MessageSquare, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useContentPlans } from '@/hooks/useContentPlans';
import { useContentPieces, ContentPiece } from '@/hooks/useContentPieces';
import { useClients } from '@/hooks/useClients';
import { useTeam } from '@/hooks/useTeam';
import { useLateSync } from '@/hooks/useLateSync';
import { useTextPostSync } from '@/hooks/useTextPostSync';
import { usePostNow } from '@/hooks/usePostNow';
import { useTextPosts, TextPost } from '@/hooks/useTextPosts';
import { AddContentPlanDialog } from '@/components/dialogs/AddContentPlanDialog';
import { AddContentDialog } from '@/components/dialogs/AddContentDialog';
import { EditContentPieceDialog } from '@/components/dialogs/EditContentPieceDialog';
import { GenerateShareLinkDialog } from '@/components/dialogs/GenerateShareLinkDialog';
import { TextPostEditDialog } from '@/components/planner/TextPostEditDialog';
import { LateSyncBadge } from '@/components/content/LateSyncBadge';
import { TextPostCalendarCard } from '@/components/content/TextPostCalendarCard';
import { BulkTextPostActionBar } from '@/components/content/BulkTextPostActionBar';
import { DayDetailSheet } from '@/components/content/DayDetailSheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Platform-specific character limits
const platformCharacterLimits: Record<string, number> = {
  linkedin: 3000,
  twitter: 280,
  threads: 500,
};

type ViewMode = 'monthly' | 'weekly';

export default function Content() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addContentOpen, setAddContentOpen] = useState(false);
  const [editContentOpen, setEditContentOpen] = useState(false);
  const [shareLinkDialogOpen, setShareLinkDialogOpen] = useState(false);
  const [selectedPiece, setSelectedPiece] = useState<ContentPiece | null>(null);
  const [selectedTextPost, setSelectedTextPost] = useState<TextPost | null>(null);
  const [textPostDialogOpen, setTextPostDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  });
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [draggedPiece, setDraggedPiece] = useState<ContentPiece | null>(null);
  const [draggedTextPost, setDraggedTextPost] = useState<TextPost | null>(null);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [showUnscheduled, setShowUnscheduled] = useState(true);
  const [dayDetailDate, setDayDetailDate] = useState<Date | null>(null);
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  
  // Multi-select state for text posts
  const [selectedTextPostIds, setSelectedTextPostIds] = useState<Set<string>>(new Set());
  const lastSelectedTextPostId = useRef<string | null>(null);
  
  const queryClient = useQueryClient();
  const { contentPlans, isLoading: plansLoading } = useContentPlans();
  const { pieces, isLoading: piecesLoading, updatePiece } = useContentPieces();
  const { clients, isLoading: clientsLoading } = useClients();
  const { textPosts, isLoading: textPostsLoading, updatePost: updateTextPost, deletePosts: deleteTextPosts, bulkUpdateStatus } = useTextPosts();
  const { team } = useTeam();
  const { toast } = useToast();
  const { syncToLate, syncStatusFromLate, isSyncingStatus } = useLateSync();
  const { syncTextPost } = useTextPostSync();
  const { postNow, isPosting, postingId } = usePostNow();
  const isLoading = plansLoading || clientsLoading || piecesLoading || textPostsLoading;

  // Auto-sync status from Late on page load (hook shows toasts automatically)
  useEffect(() => {
    syncStatusFromLate().catch(console.error);
  }, []);

  // Filter data by selected client
  const filteredContentPlans = useMemo(() => {
    if (selectedClientId === 'all') return contentPlans;
    return contentPlans.filter(cp => cp.client_id === selectedClientId);
  }, [contentPlans, selectedClientId]);

  const filteredPieces = useMemo(() => {
    if (selectedClientId === 'all') return pieces;
    // Get content plan IDs for the selected client
    const clientPlanIds = contentPlans
      .filter(cp => cp.client_id === selectedClientId)
      .map(cp => cp.id);
    return pieces.filter(p => clientPlanIds.includes(p.content_plan_id));
  }, [pieces, contentPlans, selectedClientId]);

  // Filter unscheduled pieces (no scheduled_date)
  const unscheduledPieces = useMemo(() => {
    return filteredPieces.filter(p => !p.scheduled_date);
  }, [filteredPieces]);

  // Generate calendar days for the current month
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days: { date: Date | null; isCurrentMonth: boolean }[] = [];
    
    const startPadding = (firstDay.getDay() + 6) % 7;
    for (let i = 0; i < startPadding; i++) {
      days.push({ date: null, isCurrentMonth: false });
    }
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ 
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }
    
    return days;
  };

  // Generate week days
  const generateWeekDays = () => {
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      days.push({ date, isCurrentMonth: true });
    }
    return days;
  };

  const calendarDays = viewMode === 'monthly' ? generateCalendarDays() : generateWeekDays();
  const now = new Date();
  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekLabel = `${currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const goToPreviousWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(new Date());
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentWeekStart(new Date(today.getFullYear(), today.getMonth(), diff));
  };

  const getEventsForDate = (date: Date | null) => {
    if (!date) return [];
    
    return filteredContentPlans.filter(cp => {
      if (!cp.filming_date) return false;
      const filmingDate = new Date(cp.filming_date);
      return filmingDate.toDateString() === date.toDateString();
    });
  };

  const getScheduledContentForDate = (date: Date | null) => {
    if (!date) return [];
    
    return filteredPieces.filter(piece => {
      if (!piece.scheduled_date) return false;
      const scheduledDate = new Date(piece.scheduled_date);
      return scheduledDate.toDateString() === date.toDateString();
    });
  };

  // Filter text posts by selected client and sort by date for shift-click selection
  const filteredTextPosts = useMemo(() => {
    const posts = selectedClientId === 'all' ? textPosts : textPosts.filter(tp => tp.client_id === selectedClientId);
    
    // Sort by scheduled_date so shift-click selection works in visual order
    return [...posts].sort((a, b) => {
      if (!a.scheduled_date && !b.scheduled_date) return 0;
      if (!a.scheduled_date) return 1;
      if (!b.scheduled_date) return -1;
      return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
    });
  }, [textPosts, selectedClientId]);

  const getTextPostsForDate = (date: Date | null) => {
    if (!date) return [];
    
    return filteredTextPosts.filter(post => {
      if (!post.scheduled_date) return false;
      // Show any post that has been moved onto the calendar
      if (post.status !== 'scheduled' && post.status !== 'published' && post.status !== 'pending_review' && post.status !== 'approved') return false;
      const scheduledDate = new Date(post.scheduled_date);
      return scheduledDate.toDateString() === date.toDateString();
    });
  };

  const handleTextPostClick = (post: TextPost, e: React.MouseEvent) => {
    e.stopPropagation();
    // Don't open dialog if clicking on checkbox or dropdown
    if ((e.target as HTMLElement).closest('[data-checkbox]') || 
        (e.target as HTMLElement).closest('[data-status-dropdown]')) {
      return;
    }
    setSelectedTextPost(post);
    setTextPostDialogOpen(true);
  };

  // Handle text post selection with shift-click support
  const handleTextPostSelect = useCallback((postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent native text selection on shift+click
    
    if (e.shiftKey && lastSelectedTextPostId.current) {
      // Shift-click: select range
      const allPostIds = filteredTextPosts.map(p => p.id);
      const lastIdx = allPostIds.indexOf(lastSelectedTextPostId.current);
      const currentIdx = allPostIds.indexOf(postId);
      
      if (lastIdx !== -1 && currentIdx !== -1) {
        const [start, end] = lastIdx < currentIdx ? [lastIdx, currentIdx] : [currentIdx, lastIdx];
        const rangeIds = allPostIds.slice(start, end + 1);
        
        setSelectedTextPostIds(prev => {
          const next = new Set(prev);
          rangeIds.forEach(id => next.add(id));
          return next;
        });
      }
    } else {
      // Normal click: toggle selection
      setSelectedTextPostIds(prev => {
        const next = new Set(prev);
        if (next.has(postId)) {
          next.delete(postId);
        } else {
          next.add(postId);
        }
        return next;
      });
      lastSelectedTextPostId.current = postId;
    }
  }, [filteredTextPosts]);

  // Handle status change for a single text post
  const handleTextPostStatusChange = useCallback((postId: string, status: TextPost['status']) => {
    updateTextPost.mutate({ id: postId, updates: { status } });
  }, [updateTextPost]);

  // Handle bulk status change
  const handleBulkStatusChange = useCallback((status: TextPost['status']) => {
    if (selectedTextPostIds.size === 0) return;
    bulkUpdateStatus.mutate({ ids: Array.from(selectedTextPostIds), status });
    setSelectedTextPostIds(new Set());
  }, [selectedTextPostIds, bulkUpdateStatus]);

  // Handle bulk delete
  const handleBulkDelete = useCallback(() => {
    if (selectedTextPostIds.size === 0) return;
    deleteTextPosts.mutate(Array.from(selectedTextPostIds));
    setSelectedTextPostIds(new Set());
  }, [selectedTextPostIds, deleteTextPosts]);

  // Clear selection
  const clearTextPostSelection = useCallback(() => {
    setSelectedTextPostIds(new Set());
    lastSelectedTextPostId.current = null;
  }, []);

  const handleTextPostUpdate = (
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
    } else if (scheduledDate) {
      updates.status = 'scheduled';
    }

    updateTextPost.mutate({ id, updates });
  };

  const handleDateClick = (date: Date | null) => {
    if (!date) return;
    // Open day detail sheet to show all posts for this day
    setDayDetailDate(date);
    setDayDetailOpen(true);
  };

  const handlePieceClick = (piece: ContentPiece, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPiece(piece);
    setEditContentOpen(true);
  };

  const getClientName = (clientId: string) => {
    return clients.find(c => c.id === clientId)?.business_name || 'Unknown';
  };

  const getAssigneeName = (assignedTo: string | null) => {
    if (!assignedTo) return 'Unassigned';
    const member = team.find(m => m.profile.id === assignedTo);
    return member?.profile.full_name || member?.profile.email || 'Unassigned';
  };

  // Get client ID from content piece
  const getPieceClientId = (piece: ContentPiece) => {
    const plan = contentPlans.find(cp => cp.id === piece.content_plan_id);
    return plan?.client_id || '';
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, piece: ContentPiece) => {
    e.stopPropagation();
    setDraggedPiece(piece);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetDate: Date | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!targetDate) return;

    // Handle content piece drag
    if (draggedPiece) {
      const originalDate = draggedPiece.scheduled_date ? new Date(draggedPiece.scheduled_date) : new Date();
      const newDate = new Date(targetDate);
      newDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);

      updatePiece({
        id: draggedPiece.id,
        scheduled_date: newDate.toISOString(),
      });

      // Fire-and-forget Late sync for drag-drop reschedule (only if approved)
      if (draggedPiece.status === 'approved') {
        syncToLate(draggedPiece.id, 'update');
      }

      toast({ title: 'Content moved successfully' });
      setDraggedPiece(null);
      return;
    }

    // Handle text post drag
    if (draggedTextPost) {
      const originalDate = draggedTextPost.scheduled_date 
        ? new Date(draggedTextPost.scheduled_date) 
        : new Date();
      const newDate = new Date(targetDate);
      // Preserve the original time
      newDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);

      // Update the text post in database
      updateTextPost.mutate(
        { 
          id: draggedTextPost.id, 
          updates: { scheduled_date: newDate.toISOString() } 
        },
        {
          onSuccess: () => {
            // Sync to Late if the post has already been synced
            if (draggedTextPost.late_post_id) {
              syncTextPost(draggedTextPost.id, 'update');
            }
          }
        }
      );

      toast({ title: 'Text post rescheduled' });
      setDraggedTextPost(null);
      return;
    }
  };

  const handleDragEnd = () => {
    setDraggedPiece(null);
    setDraggedTextPost(null);
  };

  // Text post drag handlers
  const handleTextPostDragStart = (e: React.DragEvent, post: TextPost) => {
    e.stopPropagation();
    setDraggedTextPost(post);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', post.id);
  };

  const handleTextPostDragEnd = () => {
    setDraggedTextPost(null);
  };

  const statusColors: Record<string, string> = {
    planning: 'bg-muted',
    scheduled: 'bg-primary',
    filming: 'bg-warning',
    editing: 'bg-stage-contacted',
    complete: 'bg-success',
  };

  const handleBulkSync = async () => {
    setIsBulkSyncing(true);
    
    // Sync content pieces that are approved AND have a scheduled date
    const piecesToSync = filteredPieces.filter(p => 
      p.status === 'approved' && p.scheduled_date && p.platforms && p.platforms.length > 0
    );
    
    // Sync text posts that are approved/scheduled AND have a scheduled date
    const textPostsToSync = filteredTextPosts.filter(tp => 
      ['approved', 'scheduled'].includes(tp.status) && tp.scheduled_date
    );
    
    const totalToSync = piecesToSync.length + textPostsToSync.length;
    
    if (totalToSync === 0) {
      toast({ title: 'No content to sync', description: 'Content must be approved/scheduled with a date to sync.' });
      setIsBulkSyncing(false);
      return;
    }
    
    let successCount = 0;
    
    // Sync content pieces
    for (const piece of piecesToSync) {
      try {
        await supabase.functions.invoke('sync-to-late', {
          body: { contentPieceId: piece.id, action: piece.late_post_id ? 'update' : 'create' },
        });
        successCount++;
      } catch (error) {
        console.error('Sync error for piece:', piece.id, error);
      }
    }
    
    // Sync text posts
    for (const post of textPostsToSync) {
      try {
        await supabase.functions.invoke('sync-text-to-late', {
          body: { textPostId: post.id, action: post.late_post_id ? 'update' : 'create' },
        });
        successCount++;
      } catch (error) {
        console.error('Sync error for text post:', post.id, error);
      }
    }
    
    toast({ 
      title: 'Sync complete', 
      description: `Synced ${successCount} of ${totalToSync} items to Late.` 
    });
    
    queryClient.invalidateQueries({ queryKey: ['content_pieces'] });
    queryClient.invalidateQueries({ queryKey: ['text-posts'] });
    setIsBulkSyncing(false);
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Content Calendar</h1>
          <p className="text-muted-foreground mt-1">Plan and track content across all clients</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Client Filter */}
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map(client => (
                <SelectItem key={client.id} value={client.id}>
                  {client.business_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => syncStatusFromLate(selectedClientId !== 'all' ? selectedClientId : undefined)}
                  disabled={isSyncingStatus}
                >
                  {isSyncingStatus ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh published status from Late</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={handleBulkSync}
            disabled={isBulkSyncing}
          >
            {isBulkSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Sync to Late
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setShareLinkDialogOpen(true)}>
            <Link2 className="w-4 h-4" />
            Generate Client Link
          </Button>
          <Button className="gap-2" onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            New Content Plan
          </Button>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        {/* Month/Week Navigation */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">
            {viewMode === 'monthly' ? monthLabel : weekLabel}
          </h2>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center border rounded-lg overflow-hidden mr-2">
              <Button
                variant={viewMode === 'monthly' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none gap-1.5"
                onClick={() => setViewMode('monthly')}
              >
                <CalendarRange className="w-4 h-4" />
                Monthly
              </Button>
              <Button
                variant={viewMode === 'weekly' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-none gap-1.5"
                onClick={() => setViewMode('weekly')}
              >
                <CalendarDays className="w-4 h-4" />
                Weekly
              </Button>
            </div>
            
            <Button 
              variant="outline" 
              size="icon" 
              onClick={viewMode === 'monthly' ? goToPreviousMonth : goToPreviousWeek}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={viewMode === 'monthly' ? goToNextMonth : goToNextWeek}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {daysOfWeek.map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day, index) => {
            const events = getEventsForDate(day.date);
            const scheduledContent = getScheduledContentForDate(day.date);
            const scheduledTextPosts = getTextPostsForDate(day.date);
            const isToday = day.date?.toDateString() === now.toDateString();
            
            return (
              <div
                key={index}
                onClick={() => handleDateClick(day.date)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day.date)}
                className={cn(
                  'p-2 rounded-lg border transition-colors overflow-hidden',
                  viewMode === 'monthly' ? 'min-h-[140px]' : 'min-h-[520px]',
                  day.isCurrentMonth 
                    ? 'bg-secondary/30 border-border hover:bg-secondary/50 cursor-pointer' 
                    : 'bg-transparent border-transparent',
                  isToday && 'ring-2 ring-primary',
                  (draggedPiece || draggedTextPost) && day.date && 'hover:ring-2 hover:ring-primary/50'
                )}
              >
                {day.date && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(
                        'text-sm font-medium',
                        isToday ? 'text-primary' : 'text-foreground'
                      )}>
                        {day.date.getDate()}
                      </span>
                      {viewMode === 'weekly' && (
                        <span className="text-xs text-muted-foreground">
                          {day.date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {/* Content Plans (filming days) - only show if there are scheduled content pieces and has a real title */}
                      {events.filter(event => {
                        // Filter out events with empty or generic titles
                        const title = event.title?.trim();
                        const clientName = getClientName(event.client_id);
                        if (!title) return false;
                        if (title === clientName) return false;
                        if (title.toLowerCase().startsWith('content for ')) return false;
                        if (title.toLowerCase().startsWith('batch for ')) return false;
                        return true;
                      }).map(event => (
                        <div
                          key={event.id}
                          className={cn(
                            'text-xs p-1.5 rounded truncate',
                            statusColors[event.status],
                            event.status === 'scheduled' || event.status === 'complete'
                              ? 'text-primary-foreground'
                              : 'text-foreground'
                          )}
                          title={`${event.title} - ${getClientName(event.client_id)}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {event.title}
                        </div>
                      ))}
                      {/* Scheduled Content Pieces */}
                      {scheduledContent.slice(0, viewMode === 'weekly' ? 5 : (scheduledTextPosts.length > 0 ? 2 : 3)).map(piece => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const pieceDate = piece.scheduled_date ? new Date(piece.scheduled_date) : null;
                        if (pieceDate) pieceDate.setHours(0, 0, 0, 0);
                        const isPast = pieceDate && pieceDate < today;
                        
                        // Scheduling status color coding - "live" status OR past date = Posted (blue)
                        const getStatusColor = () => {
                          // If the piece is marked as 'live' or the date is in the past, it's Posted
                          if (piece.status === 'live' || isPast) return 'border-l-4 border-l-blue-500 bg-blue-500/10';
                          if (piece.status === 'approved') return 'border-l-4 border-l-green-500 bg-green-500/10';
                          if (piece.status === 'edited') return 'border-l-4 border-l-orange-500 bg-orange-500/10';
                          if (piece.status === 'idea' || piece.status === 'scripted' || piece.status === 'filmed') return 'border-l-4 border-l-yellow-500 bg-yellow-500/10';
                          return 'border-l-4 border-l-yellow-500 bg-yellow-500/10';
                        };

                        const getStatusLabel = () => {
                          if (piece.status === 'live' || isPast) return { text: 'Posted', color: 'bg-blue-500 text-white' };
                          if (piece.status === 'approved') return { text: 'Scheduled', color: 'bg-green-500 text-white' };
                          if (piece.status === 'edited') return { text: 'Review', color: 'bg-orange-500 text-white' };
                          return { text: 'Draft', color: 'bg-yellow-500 text-white' };
                        };
                        
                        const statusLabel = getStatusLabel();
                        return (
                          <div
                            key={piece.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, piece)}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => handlePieceClick(piece, e)}
                            className={cn(
                              "text-xs p-2 rounded cursor-pointer hover:opacity-80 transition-colors group relative",
                              getStatusColor(),
                              draggedPiece?.id === piece.id && "opacity-50"
                            )}
                            title={`${piece.concept} - Click to edit, drag to move`}
                          >
                            <div className={cn(
                              "flex gap-2",
                              viewMode === 'weekly' ? "flex-col" : "flex-row items-start"
                            )}>
                              <div className="flex items-start gap-2">
                                <GripVertical className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab mt-0.5" />
                                {piece.asset_url ? (
                                  <img 
                                    src={piece.asset_url} 
                                    alt="" 
                                    className={cn(
                                      "rounded object-cover flex-shrink-0",
                                      viewMode === 'weekly' ? "w-40 h-40" : "w-14 h-14"
                                    )}
                                  />
                                ) : (
                                  <div className={cn(
                                    "rounded bg-muted flex items-center justify-center flex-shrink-0",
                                    viewMode === 'weekly' ? "w-40 h-40" : "w-14 h-14"
                                  )}>
                                    <Video className={cn(
                                      "text-muted-foreground",
                                      viewMode === 'weekly' ? "w-10 h-10" : "w-6 h-6"
                                    )} />
                                  </div>
                                )}
                              {viewMode === 'monthly' && (
                                  <div className="flex-1 min-w-0 overflow-hidden">
                                    <p className="font-medium text-foreground line-clamp-2 break-words">{piece.concept}</p>
                                  </div>
                                )}
                              </div>
                              {/* Status Badge */}
                              <span className={cn(
                                "absolute bottom-1 left-1 px-1.5 py-0.5 text-[10px] font-semibold rounded",
                                statusLabel.color
                              )}>
                                {statusLabel.text}
                              </span>
                              {viewMode === 'weekly' && (
                                <div className="flex-1 min-w-0 space-y-1">
                                  <p className="font-medium text-foreground">{piece.concept}</p>
                                  {piece.caption && (
                                    <p className="text-muted-foreground text-xs whitespace-pre-wrap">{piece.caption}</p>
                                  )}
                                  {piece.hashtags && piece.hashtags.length > 0 && (
                                    <p className="text-primary/70 text-xs break-words">{piece.hashtags.join(' ')}</p>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* Late Sync Badge & Post Now */}
                            <div className="absolute top-1 right-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              {/* Post Now Button */}
                              {piece.status !== 'live' && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-primary/10 hover:bg-primary/20"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          postNow(piece.id);
                                        }}
                                        disabled={isPosting && postingId === piece.id}
                                      >
                                        {isPosting && postingId === piece.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Send className="h-3 w-3" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Post Now via Late</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              <LateSyncBadge
                                syncStatus={piece.late_sync_status}
                                lastSyncedAt={piece.late_last_synced_at}
                                errorMessage={piece.late_error_message}
                                contentPieceId={piece.id}
                                compact={true}
                                showRetry={true}
                              />
                            </div>
                          </div>
                        );
                      })}
                      {scheduledContent.length > (viewMode === 'weekly' ? 5 : (scheduledTextPosts.length > 0 ? 2 : 3)) && (
                        <button
                          className="text-xs text-primary hover:underline font-medium w-full text-left"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDayDetailDate(day.date);
                            setDayDetailOpen(true);
                          }}
                        >
                          +{scheduledContent.length - (viewMode === 'weekly' ? 5 : (scheduledTextPosts.length > 0 ? 2 : 3))} more
                        </button>
                      )}
                      {/* Scheduled Text Posts */}
                      {scheduledTextPosts.slice(0, viewMode === 'weekly' ? 3 : 2).map(post => (
                        <TextPostCalendarCard
                          key={post.id}
                          post={post}
                          isSelected={selectedTextPostIds.has(post.id)}
                          onSelect={handleTextPostSelect}
                          onClick={handleTextPostClick}
                          onStatusChange={handleTextPostStatusChange}
                          onDragStart={handleTextPostDragStart}
                          onDragEnd={handleTextPostDragEnd}
                          isDragging={draggedTextPost?.id === post.id}
                          compact={viewMode === 'monthly'}
                        />
                      ))}
                      {scheduledTextPosts.length > (viewMode === 'weekly' ? 3 : 2) && (
                        <button
                          className="text-xs text-primary hover:underline font-medium w-full text-left"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDayDetailDate(day.date);
                            setDayDetailOpen(true);
                          }}
                        >
                          +{scheduledTextPosts.length - (viewMode === 'weekly' ? 3 : 2)} more text posts
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Unscheduled Content Section */}
      {unscheduledPieces.length > 0 && (
        <div className="mt-8 bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => setShowUnscheduled(!showUnscheduled)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                <Inbox className="w-4 h-4 text-warning" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-foreground">
                  Unscheduled Content ({unscheduledPieces.length})
                </h3>
                <p className="text-sm text-muted-foreground">Drag to calendar to schedule</p>
              </div>
            </div>
            {showUnscheduled ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
          
          {showUnscheduled && (
            <div className="px-6 pb-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {unscheduledPieces.map(piece => {
                  const clientId = getPieceClientId(piece);
                  const clientName = getClientName(clientId);
                  
                  return (
                    <div
                      key={piece.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, piece)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => handlePieceClick(piece, e)}
                      className={cn(
                        'group relative p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-all',
                        'bg-warning/5 border-warning/20 hover:border-warning/40 hover:shadow-md',
                        draggedPiece?.id === piece.id && 'opacity-50'
                      )}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <GripVertical className="w-4 h-4 text-muted-foreground opacity-50 group-hover:opacity-100 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">
                            {piece.concept}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {clientName}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded capitalize',
                          piece.status === 'idea' && 'bg-muted text-muted-foreground',
                          piece.status === 'scripted' && 'bg-stage-contacted/20 text-stage-contacted',
                          piece.status === 'filmed' && 'bg-warning/20 text-warning',
                          piece.status === 'edited' && 'bg-primary/20 text-primary',
                          piece.status === 'approved' && 'bg-success/20 text-success',
                          piece.status === 'live' && 'bg-success text-success-foreground'
                        )}>
                          {piece.status}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground capitalize">
                          {piece.content_type}
                        </span>
                      </div>
                      
                      {piece.platforms && piece.platforms.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          {piece.platforms.slice(0, 3).map(platform => (
                            <span 
                              key={platform} 
                              className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary capitalize"
                            >
                              {platform}
                            </span>
                          ))}
                          {piece.platforms.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{piece.platforms.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upcoming List */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-foreground mb-4">Upcoming Shoots</h3>
        <div className="space-y-3">
          {filteredContentPlans
            .filter(cp => cp.filming_date)
            .sort((a, b) => new Date(a.filming_date!).getTime() - new Date(b.filming_date!).getTime())
            .map(plan => (
              <div key={plan.id} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{plan.title}</p>
                    <p className="text-sm text-muted-foreground">{getClientName(plan.client_id)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">
                    {new Date(plan.filming_date!).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground">{getAssigneeName(plan.assigned_to)}</p>
                </div>
              </div>
            ))}
          {filteredContentPlans.filter(cp => cp.filming_date).length === 0 && (
            <p className="text-center text-muted-foreground py-4">No upcoming shoots scheduled</p>
          )}
        </div>
      </div>

      <AddContentPlanDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      <AddContentDialog 
        open={addContentOpen} 
        onOpenChange={setAddContentOpen}
        selectedDate={selectedDate}
      />
      <EditContentPieceDialog
        open={editContentOpen}
        onOpenChange={setEditContentOpen}
        piece={selectedPiece}
        clientId={selectedPiece ? getPieceClientId(selectedPiece) : ''}
      />
      <GenerateShareLinkDialog
        open={shareLinkDialogOpen}
        onOpenChange={setShareLinkDialogOpen}
      />
      {selectedTextPost && (
        <TextPostEditDialog
          open={textPostDialogOpen}
          onOpenChange={setTextPostDialogOpen}
          post={selectedTextPost}
          onSave={handleTextPostUpdate}
          onDelete={(id) => deleteTextPosts.mutate([id])}
          characterLimit={platformCharacterLimits[selectedTextPost.platform] || 500}
        />
      )}

      <DayDetailSheet
        open={dayDetailOpen}
        onOpenChange={setDayDetailOpen}
        date={dayDetailDate}
        scheduledContent={getScheduledContentForDate(dayDetailDate)}
        textPosts={getTextPostsForDate(dayDetailDate)}
        onPieceClick={(piece) => { setSelectedPiece(piece); setEditContentOpen(true); }}
        onTextPostClick={(post) => { setSelectedTextPost(post); setTextPostDialogOpen(true); }}
        onPostNow={postNow}
        onAddContent={(date) => { setSelectedDate(date); setAddContentOpen(true); }}
        isPosting={isPosting}
        postingId={postingId}
        getClientName={(planId) => {
          const plan = contentPlans.find(cp => cp.id === planId);
          return plan ? getClientName(plan.client_id) : '';
        }}
      />

      {/* Bulk Action Bar for Text Posts */}
      <BulkTextPostActionBar
        selectedCount={selectedTextPostIds.size}
        onClearSelection={clearTextPostSelection}
        onBulkStatusChange={handleBulkStatusChange}
        onBulkDelete={handleBulkDelete}
        isUpdating={bulkUpdateStatus.isPending}
      />
    </div>
  );
}
