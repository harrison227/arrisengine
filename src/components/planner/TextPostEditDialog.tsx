import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TextPost } from '@/hooks/useTextPosts';
import { cn } from '@/lib/utils';
import { Sparkles, Loader2, ChevronDown, Minus, Zap, Briefcase, Smile, Send, Clock, Calendar, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

interface TextPostEditDialogProps {
  post: TextPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, content: string, scheduledDate?: string, status?: TextPost['status']) => void;
  onDelete?: (id: string) => void;
  characterLimit?: number;
}

type RewriteStyle = 'shorter' | 'punchier' | 'professional' | 'emoji' | 'custom';

const rewriteOptions: { style: RewriteStyle; label: string; icon: typeof Minus }[] = [
  { style: 'shorter', label: 'Make shorter', icon: Minus },
  { style: 'punchier', label: 'Make punchier', icon: Zap },
  { style: 'professional', label: 'More professional', icon: Briefcase },
  { style: 'emoji', label: 'Add emojis', icon: Smile },
  { style: 'custom', label: 'Custom edit...', icon: Sparkles },
];

export function TextPostEditDialog({
  post,
  open,
  onOpenChange,
  onSave,
  onDelete,
  characterLimit = 500,
}: TextPostEditDialogProps) {
  const [content, setContent] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);
  const [previousContent, setPreviousContent] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [status, setStatus] = useState<TextPost['status']>('draft');
  const { toast } = useToast();

  useEffect(() => {
    if (post) {
      setContent(post.content);
      setStatus(post.status);
      setPreviousContent(null);
      setShowCustomPrompt(false);
      setCustomPrompt('');
      
      // Parse existing scheduled date/time
      if (post.scheduled_date) {
        const date = new Date(post.scheduled_date);
        setScheduledDate(date);
        setScheduledTime(format(date, 'HH:mm'));
      } else {
        // Default to 10am
        setScheduledDate(undefined);
        setScheduledTime('10:00');
      }
    }
  }, [post]);

  const isOverLimit = content.length > characterLimit;

  const handleSave = () => {
    if (post && content.trim()) {
      let finalScheduledDate: string | undefined;
      
      if (scheduledDate) {
        const [hours, minutes] = scheduledTime.split(':').map(Number);
        const dateWithTime = new Date(scheduledDate);
        dateWithTime.setHours(hours, minutes, 0, 0);
        finalScheduledDate = dateWithTime.toISOString();
      }
      
      onSave(post.id, content.trim(), finalScheduledDate, status);
      onOpenChange(false);
    }
  };

  const handleRewrite = async (style: RewriteStyle) => {
    if (style === 'custom') {
      setShowCustomPrompt(true);
      return;
    }
    
    if (!post || isRewriting) return;

    setIsRewriting(true);
    setPreviousContent(content);

    try {
      const { data, error } = await supabase.functions.invoke('ai-text-posts', {
        body: {
          clientId: post.client_id,
          platform: post.platform,
          action: 'rewrite',
          rewriteStyle: style,
          originalContent: content,
        },
      });

      if (error) throw error;

      if (data.rewrittenContent) {
        setContent(data.rewrittenContent);
        toast({
          title: 'Post rewritten',
          description: 'AI has updated your post. Click Undo to revert.',
        });
      }
    } catch (error) {
      console.error('Failed to rewrite post:', error);
      toast({
        title: 'Rewrite failed',
        description: 'Could not rewrite the post. Please try again.',
        variant: 'destructive',
      });
      setPreviousContent(null);
    } finally {
      setIsRewriting(false);
    }
  };

  const handleCustomRewrite = async () => {
    if (!post || isRewriting || !customPrompt.trim()) return;

    setIsRewriting(true);
    setPreviousContent(content);
    setShowCustomPrompt(false);

    try {
      const { data, error } = await supabase.functions.invoke('ai-text-posts', {
        body: {
          clientId: post.client_id,
          platform: post.platform,
          action: 'rewrite',
          rewriteStyle: 'custom',
          customPrompt: customPrompt.trim(),
          originalContent: content,
        },
      });

      if (error) throw error;

      if (data.rewrittenContent) {
        setContent(data.rewrittenContent);
        toast({
          title: 'Post rewritten',
          description: 'AI has updated your post based on your instructions.',
        });
      }
    } catch (error) {
      console.error('Failed to rewrite post:', error);
      toast({
        title: 'Rewrite failed',
        description: 'Could not rewrite the post. Please try again.',
        variant: 'destructive',
      });
      setPreviousContent(null);
    } finally {
      setIsRewriting(false);
      setCustomPrompt('');
    }
  };

  const handleUndo = () => {
    if (previousContent) {
      setContent(previousContent);
      setPreviousContent(null);
    }
  };

  const handlePostNow = async () => {
    if (!post || isPosting) return;

    setIsPosting(true);

    try {
      // Call the edge function to post to Late/Threads
      const { data, error } = await supabase.functions.invoke('post-text-to-late', {
        body: { textPostId: post.id },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to post to Threads');
      }

      toast({
        title: 'Posted to Threads!',
        description: 'Your post has been published.',
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to post:', error);
      toast({
        title: 'Failed to post',
        description: error instanceof Error ? error.message : 'Could not publish the post.',
        variant: 'destructive',
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setScheduledDate(date);
    setShowDatePicker(false);
  };

  const handleDelete = () => {
    if (post && onDelete) {
      onDelete(post.id);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Post
            {post?.platform && (
              <span className="text-sm font-normal text-muted-foreground capitalize">
                ({post.platform})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* AI Assist & Undo */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isRewriting}>
                  {isRewriting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-2" />
                  )}
                  AI Assist
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {rewriteOptions.map(({ style, label, icon: Icon }) => (
                  <DropdownMenuItem
                    key={style}
                    onClick={() => handleRewrite(style)}
                    disabled={isRewriting}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {previousContent && (
              <Button variant="ghost" size="sm" onClick={handleUndo}>
                Undo
              </Button>
            )}
          </div>

          {/* Custom Prompt Input */}
          {showCustomPrompt && (
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Make it more casual, add a question at the end..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customPrompt.trim()) {
                    handleCustomRewrite();
                  }
                }}
                className="flex-1"
              />
              <Button 
                size="sm" 
                onClick={handleCustomRewrite}
                disabled={!customPrompt.trim() || isRewriting}
              >
                {isRewriting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => {
                  setShowCustomPrompt(false);
                  setCustomPrompt('');
                }}
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Content Textarea */}
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your post..."
            className="min-h-[200px] resize-none"
            disabled={isRewriting}
          />
          <div className="flex justify-end">
            <span
              className={cn(
                'text-sm',
                isOverLimit ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {content.length}/{characterLimit} characters
            </span>
          </div>

          {/* Status & Scheduling */}
          <div className="border-t pt-4 space-y-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TextPost['status'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="published">Posted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Label className="text-sm font-medium">Schedule</Label>
            <div className="flex items-center gap-3">
              {/* Date Picker */}
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start gap-2">
                    <Calendar className="w-4 h-4" />
                    {scheduledDate 
                      ? format(scheduledDate, 'MMM d, yyyy')
                      : 'Select date'
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={scheduledDate}
                    onSelect={handleDateSelect}
                    initialFocus
                    className="p-3 pointer-events-auto"
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>

              {/* Time Picker */}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-28"
                />
              </div>
            </div>
            {scheduledDate && (
              <p className="text-xs text-muted-foreground">
                Will be posted on {format(scheduledDate, 'EEEE, MMMM d')} at {scheduledTime}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={handlePostNow}
              disabled={!content.trim() || isPosting || isRewriting}
              className="flex-1 sm:flex-none gap-2"
            >
              {isPosting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Post Now
            </Button>
            {onDelete && (
              <Button 
                variant="outline" 
                onClick={handleDelete}
                disabled={isPosting || isRewriting}
                className="flex-1 sm:flex-none gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!content.trim() || isRewriting}>
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
