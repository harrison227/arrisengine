import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { TextPost, useTextPosts, TimeRange } from '@/hooks/useTextPosts';
import { format, addDays, startOfDay } from 'date-fns';
import { CalendarClock, Sparkles, Loader2, CalendarDays, CheckCircle, Clock } from 'lucide-react';
import { MiniContentCalendar } from './MiniContentCalendar';

interface TextPostSchedulerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posts: TextPost[];
  onSchedule: (postsWithDates: { id: string; scheduled_date: string; status?: 'scheduled' | 'pending_review' }[]) => void;
  platform: string;
  clientId: string;
}

export function TextPostScheduler({
  open,
  onOpenChange,
  posts,
  onSchedule,
  platform,
  clientId,
}: TextPostSchedulerProps) {
  const [mode, setMode] = useState<'manual' | 'auto'>('auto');
  const [selectedDates, setSelectedDates] = useState<Map<string, Date>>(new Map());
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [isLoadingDates, setIsLoadingDates] = useState(false);
  const [autoSchedulePreview, setAutoSchedulePreview] = useState<{ id: string; date: Date }[]>([]);
  const [startDate, setStartDate] = useState<Date>(startOfDay(new Date()));
  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<'scheduled' | 'pending_review'>('scheduled');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('14:00');

  const { getAvailableDates } = useTextPosts();

  // Parse time string to hours and minutes
  const parseTime = (time: string): { hour: number; minute: number } => {
    const [hour, minute] = time.split(':').map(Number);
    return { hour: hour || 0, minute: minute || 0 };
  };

  const getTimeRange = (): TimeRange => {
    const start = parseTime(startTime);
    const end = parseTime(endTime);
    return {
      startHour: start.hour,
      startMinute: start.minute,
      endHour: end.hour,
      endMinute: end.minute,
    };
  };

  useEffect(() => {
    if (open && mode === 'auto') {
      loadAvailableDates(startDate);
    }
  }, [open, mode, startDate, startTime, endTime, clientId]);

  const loadAvailableDates = async (fromDate: Date) => {
    setIsLoadingDates(true);
    try {
      const timeRange = getTimeRange();
      const dates = await getAvailableDates(fromDate, 30, clientId, timeRange);
      setAvailableDates(dates);
      
      // Auto-assign dates to posts
      const preview = posts.slice(0, dates.length).map((post, index) => ({
        id: post.id,
        date: dates[index],
      }));
      setAutoSchedulePreview(preview);
    } catch (error) {
      console.error('Failed to load available dates:', error);
    } finally {
      setIsLoadingDates(false);
    }
  };

  const handleStartDateSelect = (date: Date | undefined) => {
    if (date) {
      setStartDate(startOfDay(date));
      setIsStartDateOpen(false);
    }
  };

  const handleManualDateSelect = (postId: string, date: Date | undefined) => {
    const newDates = new Map(selectedDates);
    if (date) {
      newDates.set(postId, date);
    } else {
      newDates.delete(postId);
    }
    setSelectedDates(newDates);
  };

  const handleConfirmSchedule = () => {
    if (mode === 'auto') {
      onSchedule(
        autoSchedulePreview.map(({ id, date }) => ({
          id,
          scheduled_date: date.toISOString(),
          status: approvalStatus,
        }))
      );
    } else {
      const postsWithDates = Array.from(selectedDates.entries()).map(([id, date]) => ({
        id,
        scheduled_date: date.toISOString(),
        status: approvalStatus,
      }));
      onSchedule(postsWithDates);
    }
    onOpenChange(false);
  };

  const isThreads = platform === 'threads';
  const canSchedule = mode === 'auto' 
    ? autoSchedulePreview.length > 0 
    : selectedDates.size > 0;

  // Calculate end date for preview
  const endDate = autoSchedulePreview.length > 0 
    ? autoSchedulePreview[autoSchedulePreview.length - 1].date 
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col h-full">
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Schedule {posts.length} Post{posts.length !== 1 ? 's' : ''}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="py-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'manual' | 'auto')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="auto">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Auto-Schedule
                </TabsTrigger>
                <TabsTrigger value="manual">
                  <CalendarClock className="h-4 w-4 mr-2" />
                  Manual
                </TabsTrigger>
              </TabsList>

              <TabsContent value="auto" className="mt-4">
                <div className="space-y-4">
                  {/* Approval Status Selection */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Post Status</Label>
                    <RadioGroup 
                      value={approvalStatus} 
                      onValueChange={(v) => setApprovalStatus(v as 'scheduled' | 'pending_review')}
                      className="grid grid-cols-2 gap-3"
                    >
                      <Label 
                        htmlFor="approved" 
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          approvalStatus === 'scheduled' 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <RadioGroupItem value="scheduled" id="approved" />
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="font-medium text-sm">Approved</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Ready to post
                          </p>
                        </div>
                      </Label>
                      <Label 
                        htmlFor="pending" 
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          approvalStatus === 'pending_review' 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <RadioGroupItem value="pending_review" id="pending" />
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-amber-500" />
                            <span className="font-medium text-sm">Pending Review</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Send for client approval
                          </p>
                        </div>
                      </Label>
                    </RadioGroup>
                  </div>

                  {/* Mini Calendar Overview */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Calendar Overview</Label>
                    <MiniContentCalendar 
                      selectedDate={startDate}
                      postsToSchedule={posts.length}
                      clientId={clientId}
                      onDateSelect={(date) => {
                        if (date >= startOfDay(new Date())) {
                          setStartDate(date);
                        }
                      }}
                    />
                  </div>

                  {/* Start Date Picker */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Start scheduling from:</Label>
                    <Popover open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {format(startDate, 'EEEE, MMMM d, yyyy')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={handleStartDateSelect}
                          disabled={(date) => date < startOfDay(new Date())}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Post Time Range */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Post Time Range (Sydney)</Label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">From</Label>
                        <Input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">To</Label>
                        <Input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Posts will be randomly scheduled between these times
                    </p>
                  </div>

                  {isLoadingDates ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-muted-foreground">
                        {isThreads ? (
                          <p>
                            Auto-schedule <strong>1 post per day</strong> for the next 30 days,
                            skipping days that already have content scheduled.
                          </p>
                        ) : (
                          <p>
                            Automatically schedule posts on available days in your calendar.
                          </p>
                        )}
                      </div>

                      {availableDates.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          No available dates in the next 30 days from {format(startDate, 'MMM d')}.
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span>
                              {autoSchedulePreview.length} of {posts.length} posts will be scheduled
                            </span>
                            <Badge variant="outline">
                              {availableDates.length} days available
                            </Badge>
                          </div>

                          {endDate && (
                            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
                              {format(startDate, 'MMM d')} → {format(endDate, 'MMM d, yyyy')}
                            </div>
                          )}

                          <div className="border rounded-lg p-3">
                          <div className="space-y-2">
                              {autoSchedulePreview.map(({ id, date }) => {
                                const post = posts.find((p) => p.id === id);
                                return (
                                  <div
                                    key={id}
                                    className="flex items-start gap-3 p-2 rounded-md bg-muted/50"
                                  >
                                    <Badge variant="secondary" className="shrink-0 min-w-[100px] text-center">
                                      {format(date, 'MMM d')} at {format(date, 'h:mm a')}
                                    </Badge>
                                    <p className="text-sm line-clamp-2">
                                      {post?.content.slice(0, 80)}
                                      {(post?.content.length || 0) > 80 && '...'}
                                    </p>
                                  </div>
                                );
                              })}
                              {posts.length > autoSchedulePreview.length && (
                                <div className="text-sm text-muted-foreground text-center py-2">
                                  {posts.length - autoSchedulePreview.length} post(s) won't be scheduled
                                  (not enough available days)
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="manual" className="mt-4">
                <div className="space-y-4">
                  {/* Approval Status Selection */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Post Status</Label>
                    <RadioGroup 
                      value={approvalStatus} 
                      onValueChange={(v) => setApprovalStatus(v as 'scheduled' | 'pending_review')}
                      className="grid grid-cols-2 gap-3"
                    >
                      <Label 
                        htmlFor="approved-manual" 
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          approvalStatus === 'scheduled' 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <RadioGroupItem value="scheduled" id="approved-manual" />
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="font-medium text-sm">Approved</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Ready to post
                          </p>
                        </div>
                      </Label>
                      <Label 
                        htmlFor="pending-manual" 
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          approvalStatus === 'pending_review' 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:bg-muted/50'
                        }`}
                      >
                        <RadioGroupItem value="pending_review" id="pending-manual" />
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-amber-500" />
                            <span className="font-medium text-sm">Pending Review</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Send for client approval
                          </p>
                        </div>
                      </Label>
                    </RadioGroup>
                  </div>

                  {posts.map((post) => (
                    <div key={post.id} className="border rounded-lg p-3 space-y-3">
                      <p className="text-sm line-clamp-2">
                        {post.content.slice(0, 100)}
                        {post.content.length > 100 && '...'}
                      </p>
                      <Calendar
                        mode="single"
                        selected={selectedDates.get(post.id)}
                        onSelect={(date) => handleManualDateSelect(post.id, date)}
                        disabled={(date) => date < startOfDay(new Date())}
                        className="rounded-md border pointer-events-auto"
                      />
                      {selectedDates.get(post.id) && (
                        <Badge variant="secondary">
                          Scheduled for {format(selectedDates.get(post.id)!, 'MMM d, yyyy')}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        <SheetFooter className="shrink-0 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirmSchedule} disabled={!canSchedule}>
            {approvalStatus === 'scheduled' ? 'Schedule & Approve' : 'Add to Calendar'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
