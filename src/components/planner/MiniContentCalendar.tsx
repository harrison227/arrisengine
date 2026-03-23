import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay, addMonths, subMonths, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Video, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ScheduledItem {
  date: string;
  type: 'content' | 'text_post';
  platform?: string;
  title: string;
}

interface MiniContentCalendarProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  className?: string;
  postsToSchedule?: number; // Number of posts that will be auto-scheduled
  clientId?: string;
}

export function MiniContentCalendar({ 
  selectedDate, 
  onDateSelect, 
  className,
  postsToSchedule = 0,
  clientId
}: MiniContentCalendarProps) {
  const { user } = useAuth();
  const [viewMonth, setViewMonth] = useState(selectedDate || new Date());
  const [openPopoverDate, setOpenPopoverDate] = useState<string | null>(null);

  const { data: scheduledItems = [] } = useQuery({
    queryKey: ['mini-calendar-content', user?.id, format(viewMonth, 'yyyy-MM'), clientId],
    queryFn: async () => {
      if (!user?.id) return [];

      const monthStart = startOfMonth(viewMonth);
      const monthEnd = endOfMonth(viewMonth);

      // Fetch content pieces with scheduled dates - filter by client if provided
      let contentQuery = supabase
        .from('content_pieces')
        .select('scheduled_date, platform, concept, content_plan_id, content_plans!inner(client_id)')
        .gte('scheduled_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('scheduled_date', format(monthEnd, 'yyyy-MM-dd'))
        .not('scheduled_date', 'is', null);

      if (clientId) {
        contentQuery = contentQuery.eq('content_plans.client_id', clientId);
      }

      // Fetch scheduled text posts - include approved posts with scheduled dates
      let textPostsQuery = supabase
        .from('text_posts')
        .select('scheduled_date, platform, content, client_id')
        .in('status', ['approved', 'scheduled', 'published'])
        .not('scheduled_date', 'is', null)
        .gte('scheduled_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('scheduled_date', format(monthEnd, 'yyyy-MM-dd'));

      if (clientId) {
        textPostsQuery = textPostsQuery.eq('client_id', clientId);
      }

      const [{ data: contentPieces }, { data: textPosts }] = await Promise.all([
        contentQuery,
        textPostsQuery
      ]);

      const items: ScheduledItem[] = [];

      contentPieces?.forEach(item => {
        if (item.scheduled_date) {
          items.push({
            date: item.scheduled_date.split('T')[0],
            type: 'content',
            platform: item.platform,
            title: item.concept?.slice(0, 40) || 'Content',
          });
        }
      });

      textPosts?.forEach(item => {
        if (item.scheduled_date) {
          items.push({
            date: item.scheduled_date.split('T')[0],
            type: 'text_post',
            platform: item.platform,
            title: item.content?.slice(0, 40) || 'Text Post',
          });
        }
      });

      return items;
    },
    enabled: !!user?.id,
  });

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get day of week for the first day (0 = Sunday)
  const startDayOfWeek = monthStart.getDay();
  const paddingDays = Array(startDayOfWeek).fill(null);

  // Group items by date
  const itemsByDate = scheduledItems.reduce((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {} as Record<string, ScheduledItem[]>);

  // Calculate which dates will be filled when posts are auto-scheduled from selectedDate
  const getPreviewDates = (): Set<string> => {
    if (!selectedDate || postsToSchedule <= 0) return new Set();
    
    const previewDates = new Set<string>();
    let count = 0;
    let currentDate = new Date(selectedDate);
    const maxDays = 60; // Look ahead max 60 days
    let daysChecked = 0;

    while (count < postsToSchedule && daysChecked < maxDays) {
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      const hasExistingContent = itemsByDate[dateKey]?.length > 0;
      
      if (!hasExistingContent && currentDate >= new Date()) {
        previewDates.add(dateKey);
        count++;
      }
      
      currentDate = addDays(currentDate, 1);
      daysChecked++;
    }

    return previewDates;
  };

  const previewDates = getPreviewDates();

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const handleDayClick = (day: Date, dateKey: string) => {
    const dayItems = itemsByDate[dateKey] || [];
    if (dayItems.length > 0) {
      setOpenPopoverDate(openPopoverDate === dateKey ? null : dateKey);
    } else {
      setOpenPopoverDate(null);
      onDateSelect?.(day);
    }
  };

  return (
    <div className={cn("bg-muted/30 rounded-lg p-3 border", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setViewMonth(subMonths(viewMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {format(viewMonth, 'MMMM yyyy')}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map((day, i) => (
          <div key={i} className="text-[10px] text-muted-foreground text-center font-medium">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Padding for days before month starts */}
        {paddingDays.map((_, i) => (
          <div key={`pad-${i}`} className="h-7" />
        ))}

        {/* Actual days */}
        {days.map(day => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayItems = itemsByDate[dateKey] || [];
          const hasContent = dayItems.some(i => i.type === 'content');
          const hasTextPost = dayItems.some(i => i.type === 'text_post');
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isPreviewDate = previewDates.has(dateKey);
          const itemCount = dayItems.length;
          const isPast = day < new Date() && !isToday(day);

          const dayButton = (
            <button
              onClick={() => handleDayClick(day, dateKey)}
              disabled={isPast}
              className={cn(
                "h-7 w-full rounded text-xs relative flex items-center justify-center transition-colors",
                isPast && "opacity-40 cursor-not-allowed",
                isToday(day) && "ring-1 ring-primary",
                isSelected && "bg-primary text-primary-foreground",
                !isSelected && isPreviewDate && "bg-green-500/20 ring-1 ring-green-500/50",
                !isSelected && !isPreviewDate && itemCount > 0 && "bg-secondary",
                !isSelected && !isPreviewDate && !itemCount && !isPast && "hover:bg-muted"
              )}
            >
              <span>{format(day, 'd')}</span>
              
              {/* Indicators */}
              {(itemCount > 0 || isPreviewDate) && !isSelected && (
                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {hasContent && (
                    <div className="w-1 h-1 rounded-full bg-primary" />
                  )}
                  {hasTextPost && (
                    <div className="w-1 h-1 rounded-full bg-purple-500" />
                  )}
                  {isPreviewDate && !hasContent && !hasTextPost && (
                    <div className="w-1 h-1 rounded-full bg-green-500" />
                  )}
                </div>
              )}
            </button>
          );

          // If there are items, wrap in popover
          if (itemCount > 0) {
            return (
              <Popover 
                key={dateKey} 
                open={openPopoverDate === dateKey}
                onOpenChange={(open) => setOpenPopoverDate(open ? dateKey : null)}
              >
                <PopoverTrigger asChild>
                  {dayButton}
                </PopoverTrigger>
                <PopoverContent 
                  side="right" 
                  align="start"
                  className="w-56 p-2 z-50 bg-popover border shadow-lg"
                >
                  <div className="space-y-2">
                    <p className="font-medium text-sm border-b pb-1">
                      {format(day, 'EEE, MMM d')}
                    </p>
                    <ScrollArea className="max-h-32">
                      <div className="space-y-1.5">
                        {dayItems.map((item, i) => (
                          <div key={i} className="flex items-start gap-2 p-1.5 rounded bg-muted/50">
                            {item.type === 'content' ? (
                              <Video className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                            ) : (
                              <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-purple-500 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs truncate">{item.title}</p>
                              {item.platform && (
                                <p className="text-[10px] text-muted-foreground capitalize">
                                  {item.platform}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full h-7 text-xs"
                      onClick={() => {
                        setOpenPopoverDate(null);
                        onDateSelect?.(day);
                      }}
                    >
                      Start from this date
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            );
          }

          return <div key={dateKey}>{dayButton}</div>;
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 pt-2 border-t border-border/50">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span>Video/Image</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-purple-500" />
          <span>Text Post</span>
        </div>
        {postsToSchedule > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Will be scheduled</span>
          </div>
        )}
      </div>
    </div>
  );
}
