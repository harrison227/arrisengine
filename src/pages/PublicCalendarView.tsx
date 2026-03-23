import { useMemo, useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, List, Grid } from 'lucide-react';
import { format, parseISO, isWithinInterval, isSameDay, startOfDay, endOfDay, isSameMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

// Lazy load heavy dialog components
const PublicContentDetailDialog = lazy(() =>
  import('@/components/dialogs/PublicContentDetailDialog').then((m) => ({
    default: m.PublicContentDetailDialog,
  }))
);

const PublicTextPostDetailDialog = lazy(() =>
  import('@/components/dialogs/PublicTextPostDetailDialog').then((m) => ({
    default: m.PublicTextPostDetailDialog,
  }))
);

// Preload functions - called on hover/touch and after initial render
const preloadContentDialog = () => {
  import('@/components/dialogs/PublicContentDetailDialog');
};

const preloadTextPostDialog = () => {
  import('@/components/dialogs/PublicTextPostDetailDialog');
};

const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const daysOfWeekShort = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const formatPlatformName = (platform: string) => {
  const platformMap: Record<string, string> = {
    instagram: 'Instagram',
    instagram_reels: 'IG Reels',
    instagram_stories: 'IG Stories',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    youtube_shorts: 'YT Shorts',
    facebook: 'Facebook',
    facebook_stories: 'FB Stories',
    linkedin: 'LinkedIn',
    twitter: 'Twitter/X',
    threads: 'Threads',
  };
  return platformMap[platform.toLowerCase()] || platform;
};

const formatPlatformsList = (platform: string, platforms?: string[] | null) => {
  const allPlatforms = platforms?.length ? platforms : [platform];
  if (allPlatforms.length <= 2) {
    return allPlatforms.map(p => formatPlatformName(p)).join(', ');
  }
  return `${formatPlatformName(allPlatforms[0])} +${allPlatforms.length - 1}`;
};

interface ContentPiece {
  id: string;
  concept: string;
  status: string;
  content_type: string;
  platform: string;
  platforms?: string[] | null;
  hook?: string | null;
  script?: string | null;
  caption?: string | null;
  hashtags?: string[] | null;
  cta?: string | null;
  asset_url?: string | null;
  scheduled_date?: string | null;
  target_duration?: number | null;
  shot_notes?: string | null;
  talent_notes?: string | null;
  b_roll_needed?: string[] | null;
  edit_notes?: string | null;
  isTextPost?: boolean;
}

interface PublicCalendarData {
  shareLink: {
    start_date: string;
    end_date: string;
    client_id: string;
  };
  client: {
    business_name: string | null;
    brand_logo_url: string | null;
    brand_primary_color: string | null;
  };
  contentPieces: Array<{
    id: string;
    concept: string;
    status: string;
    content_type: string;
    platform: string;
    platforms?: string[] | null;
    hook?: string | null;
    script?: string | null;
    caption?: string | null;
    hashtags?: string[] | null;
    cta?: string | null;
    asset_url?: string | null;
    scheduled_date?: string | null;
    target_duration?: number | null;
    shot_notes?: string | null;
    talent_notes?: string | null;
    b_roll_needed?: string[] | null;
    edit_notes?: string | null;
  }>;
  textPosts: Array<{
    id: string;
    content: string;
    platform: string;
    status: string;
    scheduled_date: string | null;
  }>;
}

// Dialog loading skeleton
const DialogSkeleton = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div className="bg-white rounded-xl p-6 w-[90vw] max-w-2xl">
      <Skeleton className="h-8 w-48 mb-4" />
      <Skeleton className="h-32 w-full mb-4" />
      <Skeleton className="h-10 w-full" />
    </div>
  </div>
);

export default function PublicCalendarView() {
  const { shareId } = useParams<{ shareId: string }>();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedPiece, setSelectedPiece] = useState<ContentPiece | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [textPostDialogOpen, setTextPostDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Auto-switch to list view on mobile
  const effectiveViewMode = isMobile ? (viewMode === 'calendar' ? 'list' : viewMode) : viewMode;

  // Prefetch dialog chunks after initial render for instant opening
  useEffect(() => {
    const timer = setTimeout(() => {
      preloadContentDialog();
      preloadTextPostDialog();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Memoized preload handlers for calendar items
  const handlePreloadContent = useCallback(() => preloadContentDialog(), []);
  const handlePreloadTextPost = useCallback(() => preloadTextPostDialog(), []);

  // Direct parallel queries - no edge function overhead
  const {
    data: calendarData,
    isLoading,
    error,
  } = useQuery<PublicCalendarData>({
    queryKey: ['public_calendar_data', shareId],
    queryFn: async () => {
      // Step 1: Fetch share link
      const { data: shareLink, error: shareLinkError } = await supabase
        .from('calendar_share_links')
        .select('id, client_id, start_date, end_date, is_active')
        .eq('share_id', shareId!)
        .eq('is_active', true)
        .maybeSingle();

      if (shareLinkError) throw shareLinkError;
      if (!shareLink) throw new Error('Share link not found');

      // Step 2: Parallel fetch - client, content plans, text posts
      const [clientResult, plansResult, textPostsResult] = await Promise.all([
        supabase
          .from('clients_public_safe')
          .select('business_name, brand_logo_url, brand_primary_color')
          .eq('id', shareLink.client_id)
          .maybeSingle(),
        supabase
          .from('content_plans')
          .select('id')
          .eq('client_id', shareLink.client_id),
        supabase
          .from('text_posts')
          .select('id, content, platform, status, scheduled_date')
          .eq('client_id', shareLink.client_id)
          .in('status', ['scheduled', 'pending_review', 'approved', 'published'])
          .gte('scheduled_date', shareLink.start_date)
          .lte('scheduled_date', shareLink.end_date)
          .not('scheduled_date', 'is', null)
      ]);

      const planIds = (plansResult.data || []).map(p => p.id);

      // Step 3: Fetch content pieces (if plans exist)
      let contentPieces: PublicCalendarData['contentPieces'] = [];
      if (planIds.length > 0) {
        const { data: pieces } = await supabase
          .from('content_pieces')
          .select('id, concept, status, content_type, platform, platforms, hook, script, caption, hashtags, cta, asset_url, scheduled_date, target_duration, shot_notes, talent_notes, b_roll_needed, edit_notes')
          .in('content_plan_id', planIds)
          .gte('scheduled_date', shareLink.start_date)
          .lte('scheduled_date', shareLink.end_date)
          .not('scheduled_date', 'is', null);
        
        contentPieces = pieces || [];
      }

      return {
        shareLink: {
          start_date: shareLink.start_date,
          end_date: shareLink.end_date,
          client_id: shareLink.client_id
        },
        client: clientResult.data || { business_name: null, brand_logo_url: null, brand_primary_color: null },
        contentPieces,
        textPosts: textPostsResult.data || []
      };
    },
    enabled: !!shareId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Transform and combine content pieces and text posts
  const pieces = useMemo(() => {
    if (!calendarData) return [];

    const contentPieces: ContentPiece[] = calendarData.contentPieces.map((piece) => ({
      ...piece,
      isTextPost: false,
    }));

    const textPosts: ContentPiece[] = calendarData.textPosts.map((post) => ({
      id: post.id,
      concept: post.content.slice(0, 100) + (post.content.length > 100 ? '...' : ''),
      status: post.status === 'pending_review' ? 'pending_review' : post.status,
      content_type: 'text_post',
      platform: post.platform,
      caption: post.content,
      scheduled_date: post.scheduled_date,
      isTextPost: true,
    }));

    return [...contentPieces, ...textPosts];
  }, [calendarData]);

  // Filter pieces by date range (already filtered server-side, but this adds safety)
  const filteredPieces = useMemo(() => {
    if (!calendarData?.shareLink) return pieces;
    const startDate = startOfDay(parseISO(calendarData.shareLink.start_date));
    const endDate = endOfDay(parseISO(calendarData.shareLink.end_date));

    return pieces.filter((piece) => {
      if (!piece.scheduled_date) return false;
      const pieceDate = parseISO(piece.scheduled_date);
      return isWithinInterval(pieceDate, { start: startDate, end: endDate });
    });
  }, [pieces, calendarData?.shareLink]);

  // Sort filtered pieces by date for list view
  const sortedPieces = useMemo(() => {
    return [...filteredPieces].sort((a, b) => {
      const aTime = a.scheduled_date ? parseISO(a.scheduled_date).getTime() : 0;
      const bTime = b.scheduled_date ? parseISO(b.scheduled_date).getTime() : 0;
      return aTime - bTime;
    });
  }, [filteredPieces]);

  // Group pieces by date for list view
  const groupedPieces = useMemo(() => {
    const groups: Record<string, ContentPiece[]> = {};
    sortedPieces.forEach((piece) => {
      if (piece.scheduled_date) {
        const dateKey = format(parseISO(piece.scheduled_date), 'yyyy-MM-dd');
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(piece);
      }
    });
    return groups;
  }, [sortedPieces]);

  // Generate calendar days for the current month view
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    const startPadding = (firstDay.getDay() + 6) % 7;
    for (let i = startPadding; i > 0; i--) {
      const d = new Date(year, month, 1 - i);
      days.push({ date: d, isCurrentMonth: false });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({
          date: new Date(year, month + 1, i),
          isCurrentMonth: false,
        });
      }
    }

    return days;
  }, [currentMonth]);

  const getScheduledContentForDate = (date: Date) => {
    return filteredPieces.filter((piece) => {
      if (!piece.scheduled_date) return false;
      const scheduledDate = parseISO(piece.scheduled_date);
      return isSameDay(scheduledDate, date);
    });
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handlePieceClick = (piece: ContentPiece) => {
    setSelectedPiece(piece);
    if (piece.isTextPost) {
      setTextPostDialogOpen(true);
    } else {
      setDetailDialogOpen(true);
    }
  };

  const handleTextPostActionComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['public_calendar_data', shareId] });
  };

  const handleContentActionComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['public_calendar_data', shareId] });
  };

  const now = new Date();
  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const isDateInRange = (date: Date) => {
    if (!calendarData?.shareLink) return false;
    const startDate = startOfDay(parseISO(calendarData.shareLink.start_date));
    const endDate = endOfDay(parseISO(calendarData.shareLink.end_date));
    return isWithinInterval(date, { start: startDate, end: endDate });
  };

  const getStatusStyle = (piece: ContentPiece) => {
    const pieceDate = piece.scheduled_date ? parseISO(piece.scheduled_date) : null;
    const isPast = pieceDate && pieceDate < now;

    if (piece.status === 'live' || piece.status === 'published' || isPast)
      return { borderColor: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)', label: 'Posted' };
    if (piece.status === 'approved' || piece.status === 'scheduled')
      return { borderColor: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.1)', label: 'Approved' };
    if (piece.status === 'pending_review')
      return { borderColor: '#f97316', bgColor: 'rgba(249, 115, 22, 0.1)', label: 'For Review' };
    if (piece.status === 'edited')
      return { borderColor: '#f97316', bgColor: 'rgba(249, 115, 22, 0.1)', label: 'Edited' };
    return { borderColor: '#eab308', bgColor: 'rgba(234, 179, 8, 0.1)', label: 'Draft' };
  };

  // Loading state with skeleton calendar
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header skeleton */}
          <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 sm:py-6 rounded-t-xl mb-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg" />
              <div>
                <Skeleton className="h-6 sm:h-8 w-32 sm:w-48 mb-2" />
                <Skeleton className="h-4 w-24 sm:w-32" />
              </div>
            </div>
          </div>

          {/* Calendar skeleton */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <Skeleton className="h-6 w-32" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>

            {/* Calendar grid skeleton */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {daysOfWeek.map((day, i) => (
                <Skeleton key={i} className="h-6" />
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-20 sm:h-28" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Invalid or expired link
  if (!calendarData || error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Calendar className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-slate-400 mb-4" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">Link Not Found</h1>
          <p className="text-sm sm:text-base text-slate-600">
            This calendar link is invalid or has expired.
          </p>
        </div>
      </div>
    );
  }

  const client = calendarData.client;
  const shareLink = calendarData.shareLink;
  const brandColor = client?.brand_primary_color || '#3b82f6';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header - Mobile Optimized */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 sm:py-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 sm:gap-4">
            {client?.brand_logo_url ? (
              <img
                src={client.brand_logo_url}
                alt={client.business_name || 'Logo'}
                className="h-10 sm:h-12 w-auto object-contain flex-shrink-0"
                loading="lazy"
              />
            ) : (
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg sm:text-xl flex-shrink-0"
                style={{ backgroundColor: brandColor }}
              >
                {client?.business_name?.charAt(0) || 'C'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold text-slate-800 truncate">
                {client?.business_name || 'Content Calendar'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                {format(parseISO(shareLink.start_date), 'MMM d')} –{' '}
                {format(parseISO(shareLink.end_date), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Calendar / List View */}
      <main className="max-w-6xl mx-auto p-4 sm:p-8">
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
            <h2 className="text-base sm:text-xl font-semibold text-slate-800 truncate">{monthLabel}</h2>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {/* View toggle - only show on larger screens or allow manual toggle */}
              <div className="hidden sm:flex items-center gap-1 mr-2 border border-slate-200 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('calendar')}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    viewMode === 'calendar'
                      ? 'bg-slate-100 text-slate-800'
                      : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'p-1.5 rounded transition-colors',
                    viewMode === 'list' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              <button onClick={goToPreviousMonth} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
              </button>
              <button
                onClick={() => setCurrentMonth(new Date())}
                className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Today
              </button>
              <button onClick={goToNextMonth} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
              </button>
            </div>
          </div>

          {/* Calendar Grid View (Desktop) */}
          {effectiveViewMode === 'calendar' && (
            <>
              {/* Days of Week Header */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1 sm:mb-2">
                {(isMobile ? daysOfWeekShort : daysOfWeek).map((day, i) => (
                  <div key={i} className="text-center text-xs sm:text-sm font-medium text-slate-500 py-1 sm:py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {calendarDays.map((day, index) => {
                  const scheduledContent = getScheduledContentForDate(day.date);
                  const isToday = isSameDay(day.date, now);
                  const inRange = isDateInRange(day.date);

                  const maxVisible = isMobile ? 2 : 3;
                  const scheduledContentSorted = [...scheduledContent].sort((a, b) => {
                    const aText = a.isTextPost ? 1 : 0;
                    const bText = b.isTextPost ? 1 : 0;
                    if (aText !== bText) return bText - aText;
                    const aTime = a.scheduled_date ? parseISO(a.scheduled_date).getTime() : 0;
                    const bTime = b.scheduled_date ? parseISO(b.scheduled_date).getTime() : 0;
                    return aTime - bTime;
                  });

                  return (
                    <div
                      key={index}
                      className={cn(
                        'min-h-[80px] sm:min-h-[120px] p-1 sm:p-2 rounded-lg border transition-colors',
                        day.isCurrentMonth && inRange ? 'bg-white border-slate-200' : 'bg-slate-50 border-transparent opacity-50',
                        isToday && 'ring-2 ring-blue-500'
                      )}
                    >
                      <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                        <span className={cn('text-xs sm:text-sm font-medium', isToday ? 'text-blue-600' : 'text-slate-700')}>
                          {day.date.getDate()}
                        </span>
                      </div>
                      <div className="space-y-0.5 sm:space-y-1">
                        {scheduledContentSorted.slice(0, maxVisible).map((piece) => {
                          const style = getStatusStyle(piece);

                          return (
                            <div
                              key={piece.id}
                              onClick={() => handlePieceClick(piece)}
                              onMouseEnter={piece.isTextPost ? handlePreloadTextPost : handlePreloadContent}
                              onTouchStart={piece.isTextPost ? handlePreloadTextPost : handlePreloadContent}
                              className="text-[10px] sm:text-xs p-1 sm:p-2 rounded cursor-pointer hover:opacity-80 transition-opacity active:scale-[0.98]"
                              style={{
                                borderLeft: `2px sm:3px solid ${style.borderColor}`,
                                backgroundColor: style.bgColor,
                              }}
                            >
                              <div className="font-medium text-slate-700 truncate">{piece.concept}</div>
                              <div className="text-slate-500 truncate mt-0.5 hidden sm:block">
                                {formatPlatformsList(piece.platform, piece.platforms)} • {piece.isTextPost ? 'Text' : piece.content_type}
                              </div>
                            </div>
                          );
                        })}
                        {scheduledContentSorted.length > maxVisible && (
                          <div className="text-[10px] sm:text-xs text-slate-500 pl-1 sm:pl-2">
                            +{scheduledContentSorted.length - maxVisible} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* List View (Mobile-friendly) */}
          {effectiveViewMode === 'list' && (
            <div className="space-y-4">
              {Object.keys(groupedPieces).length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No content scheduled for this period</p>
                </div>
              ) : (
                Object.entries(groupedPieces)
                  .filter(([dateKey]) => {
                    const date = parseISO(dateKey);
                    return isSameMonth(date, currentMonth);
                  })
                  .map(([dateKey, items]) => {
                    const date = parseISO(dateKey);
                    const isToday = isSameDay(date, now);

                    return (
                      <div key={dateKey} className="space-y-2">
                        {/* Date Header */}
                        <div className={cn('sticky top-0 bg-white z-10 py-2 border-b border-slate-100', isToday && 'border-blue-200')}>
                          <div className="flex items-center gap-2">
                            <span className={cn('text-sm font-semibold', isToday ? 'text-blue-600' : 'text-slate-800')}>
                              {format(date, 'EEEE, MMM d')}
                            </span>
                            {isToday && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">Today</span>}
                          </div>
                        </div>

                        {/* Content Items */}
                        <div className="space-y-2 pl-2">
                          {items.map((piece) => {
                            const style = getStatusStyle(piece);
                            const pieceDate = piece.scheduled_date ? parseISO(piece.scheduled_date) : null;

                            return (
                              <div
                                key={piece.id}
                                onClick={() => handlePieceClick(piece)}
                                onMouseEnter={piece.isTextPost ? handlePreloadTextPost : handlePreloadContent}
                                onTouchStart={piece.isTextPost ? handlePreloadTextPost : handlePreloadContent}
                                className="p-3 rounded-lg cursor-pointer hover:opacity-90 transition-all active:scale-[0.99] touch-manipulation"
                                style={{
                                  borderLeft: `4px solid ${style.borderColor}`,
                                  backgroundColor: style.bgColor,
                                }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                <div className="font-medium text-slate-800 text-sm line-clamp-2">{piece.concept}</div>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                                      <span>{formatPlatformsList(piece.platform, piece.platforms)}</span>
                                      <span>•</span>
                                      <span>{piece.isTextPost ? 'Text Post' : piece.content_type}</span>
                                      {pieceDate && (
                                        <>
                                          <span>•</span>
                                          <span>{format(pieceDate, 'h:mm a')}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <span
                                    className="text-xs font-medium px-2 py-1 rounded-full flex-shrink-0"
                                    style={{
                                      backgroundColor: style.borderColor,
                                      color: 'white',
                                    }}
                                  >
                                    {style.label}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          )}
        </div>

        {/* Legend - Mobile Optimized */}
        <div className="mt-4 sm:mt-6 flex items-center gap-3 sm:gap-6 text-xs sm:text-sm text-slate-600 flex-wrap">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm bg-blue-500" />
            <span>Posted</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm bg-green-500" />
            <span>Approved</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm bg-orange-500" />
            <span>For Review</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm bg-yellow-500" />
            <span>Draft</span>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-slate-400">
          Powered by Arris Studios
        </footer>
      </main>

      {/* Lazy-loaded dialogs */}
      <Suspense fallback={<DialogSkeleton />}>
        {detailDialogOpen && (
          <PublicContentDetailDialog
            open={detailDialogOpen}
            onOpenChange={setDetailDialogOpen}
            piece={selectedPiece}
            brandColor={brandColor}
            shareId={shareId}
            onActionComplete={handleContentActionComplete}
          />
        )}
      </Suspense>

      <Suspense fallback={<DialogSkeleton />}>
        {textPostDialogOpen && selectedPiece && shareId && (
          <PublicTextPostDetailDialog
            post={{
              id: selectedPiece.id,
              content: selectedPiece.caption || selectedPiece.concept,
              platform: selectedPiece.platform,
              scheduled_for: selectedPiece.scheduled_date || null,
              status: selectedPiece.status,
            }}
            open={textPostDialogOpen}
            onOpenChange={setTextPostDialogOpen}
            shareId={shareId}
            onActionComplete={handleTextPostActionComplete}
          />
        )}
      </Suspense>
    </div>
  );
}
