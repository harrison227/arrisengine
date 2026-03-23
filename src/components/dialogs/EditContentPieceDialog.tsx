import { useState, useEffect } from 'react';
import { Check, Trash2, Sparkles, Loader2, Circle, ExternalLink, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MediaUploader } from '@/components/content/MediaUploader';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { LateSyncBadge } from '@/components/content/LateSyncBadge';
import { useContentPieces, ContentPiece } from '@/hooks/useContentPieces';
import { usePostNow } from '@/hooks/usePostNow';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SCHEDULING_STATUSES = [
  { id: 'draft', label: 'Draft', color: 'bg-yellow-500' },
  { id: 'for_review', label: 'For Review', color: 'bg-orange-500' },
  { id: 'approved_scheduled', label: 'Approved + Scheduled', color: 'bg-green-500' },
  { id: 'posted', label: 'Posted', color: 'bg-blue-500' },
] as const;

type SchedulingStatus = typeof SCHEDULING_STATUSES[number]['id'];

// Map scheduling status to database content_status enum
const statusToDbStatus: Record<SchedulingStatus, ContentPiece['status']> = {
  'draft': 'idea',
  'for_review': 'edited',
  'approved_scheduled': 'approved',
  'posted': 'live',
};

// Reverse map from database status to scheduling status
const dbStatusToSchedulingStatus: Record<string, SchedulingStatus> = {
  'idea': 'draft',
  'scripted': 'draft',
  'filmed': 'draft',
  'edited': 'for_review',
  'approved': 'approved_scheduled',
  'live': 'posted',
};

interface EditContentPieceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  piece: ContentPiece | null;
  clientId: string;
}

const FEED_PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '📸' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'facebook', label: 'Facebook', icon: '👥' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'youtube', label: 'YouTube', icon: '▶️' },
  { id: 'twitter', label: 'Twitter/X', icon: '🐦' },
  { id: 'threads', label: 'Threads', icon: '🧵' },
];

const STORY_PLATFORMS = [
  { id: 'instagram_stories', label: 'Instagram Stories', icon: '📱' },
  { id: 'facebook_stories', label: 'Facebook Stories', icon: '📱' },
];

const CONTENT_TYPES = ['video', 'image', 'carousel', 'story', 'reel', 'ugc'] as const;

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];

const to24Hour = (hour: string, period: "AM" | "PM"): number => {
  let h = parseInt(hour, 10);
  if (period === "AM") {
    return h === 12 ? 0 : h;
  } else {
    return h === 12 ? 12 : h + 12;
  }
};

type PlatformOption = { id: string; label: string; icon: string };

function PlatformToggleButton({
  platform,
  selected,
  onToggle,
}: {
  platform: PlatformOption;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-border hover:border-primary/50 hover:bg-muted/50",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded border",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
        )}
      >
        <Check className={cn("h-3.5 w-3.5", selected ? "opacity-100" : "opacity-0")} />
      </span>
      <span className="text-lg" aria-hidden="true">
        {platform.icon}
      </span>
      <span className="text-sm font-medium leading-none">{platform.label}</span>
    </button>
  );
}

// Helper to detect content type from URL
function detectContentTypeFromUrl(url: string): typeof CONTENT_TYPES[number] | null {
  if (!url) return null;
  const lowerUrl = url.toLowerCase();
  
  if (VIDEO_EXTENSIONS.some(ext => lowerUrl.includes(ext))) {
    return 'video';
  }
  if (IMAGE_EXTENSIONS.some(ext => lowerUrl.includes(ext))) {
    return 'image';
  }
  return null;
}

export function EditContentPieceDialog({ open, onOpenChange, piece, clientId }: EditContentPieceDialogProps) {
  const { updatePiece, deletePiece, isUpdating, isDeleting } = useContentPieces();
  const { postNow, isPosting } = usePostNow();
  const { toast } = useToast();
  
  const [concept, setConcept] = useState('');
  const [caption, setCaption] = useState('');
  const [captionRefinement, setCaptionRefinement] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [contentType, setContentType] = useState<typeof CONTENT_TYPES[number]>('video');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isGeneratingHashtags, setIsGeneratingHashtags] = useState(false);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [schedulingStatus, setSchedulingStatus] = useState<SchedulingStatus>('draft');
  
  // Instagram-specific fields
  const [instagramFirstComment, setInstagramFirstComment] = useState('');
  const [instagramCollaborators, setInstagramCollaborators] = useState('');
  
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledHour, setScheduledHour] = useState('09');
  const [scheduledMinute, setScheduledMinute] = useState('00');
  const [scheduledPeriod, setScheduledPeriod] = useState<'AM' | 'PM'>('AM');

  // Check if Instagram is selected
  const hasInstagram = selectedPlatforms.some(p => p.toLowerCase().includes('instagram'));

  useEffect(() => {
    if (piece && open) {
      setConcept(piece.concept || '');
      setCaption(piece.caption || '');
      setCaptionRefinement('');
      setHashtags(piece.hashtags?.join(' ') || '');
      setSelectedPlatforms(piece.platforms || [piece.platform]);
      setContentType(piece.content_type);
      setMediaUrl(piece.asset_url);
      setInstagramFirstComment(piece.instagram_first_comment || '');
      setInstagramCollaborators(piece.instagram_collaborators?.join(', ') || '');
      
      // Map database status to scheduling status
      setSchedulingStatus(dbStatusToSchedulingStatus[piece.status] || 'draft');
      
      if (piece.scheduled_date) {
        const date = new Date(piece.scheduled_date);
        setScheduledDate(date);
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const period = hours >= 12 ? 'PM' : 'AM';
        const hour12 = hours % 12 || 12;
        setScheduledHour(hour12.toString().padStart(2, '0'));
        setScheduledMinute(minutes.toString().padStart(2, '0'));
        setScheduledPeriod(period);
      } else {
        setScheduledDate(undefined);
        setScheduledHour('09');
        setScheduledMinute('00');
        setScheduledPeriod('AM');
      }
    }
  }, [piece, open]);

  // Auto-detect content type when media changes
  useEffect(() => {
    if (mediaUrl) {
      const detectedType = detectContentTypeFromUrl(mediaUrl);
      if (detectedType) {
        setContentType(detectedType);
      }
    }
  }, [mediaUrl]);

  const handlePlatformToggle = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    );
  };

  const handleGenerateHashtags = async () => {
    if (!clientId) return;
    
    setIsGeneratingHashtags(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-hashtags', {
        body: { clientId, title: concept, caption }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      const generatedHashtags = data.hashtags as string[];
      setHashtags(generatedHashtags.join(' '));
      toast({ title: 'Hashtags generated!' });
    } catch (error) {
      console.error('Error generating hashtags:', error);
      toast({
        title: 'Failed to generate hashtags',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingHashtags(false);
    }
  };

  const handleGenerateCaption = async () => {
    if (!clientId) return;
    
    setIsGeneratingCaption(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-caption', {
        body: { 
          clientId, 
          concept, 
          refinement: captionRefinement,
          existingCaption: caption 
        }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setCaption(data.caption);
      toast({ title: 'Caption generated!' });
    } catch (error) {
      console.error('Error generating caption:', error);
      toast({
        title: 'Failed to generate caption',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!piece) return;
    
    const hashtagArray = hashtags
      .split(/[\s,]+/)
      .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
      .filter(tag => tag.length > 1);

    // Parse collaborators from comma-separated input
    const collaboratorsArray = instagramCollaborators
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0)
      .map(c => c.startsWith('@') ? c : `@${c}`);

    // Simplify date handling - use the selected date directly without timezone conversion
    let scheduledDateTime: string | null = null;
    if (scheduledDate) {
      const hour24 = to24Hour(scheduledHour, scheduledPeriod);
      // Create a new date from the selected date to avoid mutating it
      const year = scheduledDate.getFullYear();
      const month = scheduledDate.getMonth();
      const day = scheduledDate.getDate();
      const dateWithTime = new Date(year, month, day, hour24, parseInt(scheduledMinute, 10), 0, 0);
      scheduledDateTime = dateWithTime.toISOString();
    }

    // Map scheduling status to database status
    const dbStatus = statusToDbStatus[schedulingStatus];

    updatePiece({
      id: piece.id,
      concept,
      caption,
      hashtags: hashtagArray,
      platforms: selectedPlatforms,
      platform: selectedPlatforms[0] || piece.platform,
      content_type: contentType,
      asset_url: mediaUrl,
      scheduled_date: scheduledDateTime,
      status: dbStatus,
      instagram_first_comment: instagramFirstComment || null,
      instagram_collaborators: collaboratorsArray.length > 0 ? collaboratorsArray : null,
    });

    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!piece) return;
    deletePiece({ id: piece.id, latePostId: piece.late_post_id });
    onOpenChange(false);
  };

  if (!piece) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Edit Content</DialogTitle>
            <LateSyncBadge
              syncStatus={piece.late_sync_status}
              lastSyncedAt={piece.late_last_synced_at}
              errorMessage={piece.late_error_message}
              contentPieceId={piece.id}
              compact={false}
              showRetry={true}
            />
          </div>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Media Upload */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Media</Label>
              {mediaUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-7 text-xs"
                  onClick={() => window.open(mediaUrl, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="h-3 w-3" />
                  View Full Size
                </Button>
              )}
            </div>
            <MediaUploader 
              clientId={clientId} 
              value={mediaUrl || undefined}
              onChange={setMediaUrl}
            />
          </div>

          {/* Concept/Title */}
          <div className="space-y-2">
            <Label>Concept / Title *</Label>
            <Input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="What is this content about?"
            />
          </div>

          {/* Caption with Refinement */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Caption</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGenerateCaption}
                disabled={isGeneratingCaption || !concept}
                className="gap-1.5 h-7 text-xs"
              >
                {isGeneratingCaption ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Generate
              </Button>
            </div>
            <Input
              value={captionRefinement}
              onChange={(e) => setCaptionRefinement(e.target.value)}
              placeholder="Add guidance for AI (e.g., 'focus on benefits, keep it casual')"
              className="text-sm"
            />
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your post caption..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground text-right">
              {caption.length} characters
            </p>
          </div>

          {/* Hashtags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Hashtags</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGenerateHashtags}
                disabled={isGeneratingHashtags}
                className="gap-1.5 h-7 text-xs"
              >
                {isGeneratingHashtags ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Generate
              </Button>
            </div>
            <Input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#marketing #socialmedia #content"
            />
            <p className="text-xs text-muted-foreground">
              Separate with spaces or commas
            </p>
          </div>

          {/* Platforms */}
          <div className="space-y-4">
            <Label>Platforms *</Label>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Feed Posts</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {FEED_PLATFORMS.map((platform) => (
                  <PlatformToggleButton
                    key={platform.id}
                    platform={platform}
                    selected={selectedPlatforms.includes(platform.id)}
                    onToggle={() => handlePlatformToggle(platform.id)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stories</p>
              <div className="grid grid-cols-2 gap-3">
                {STORY_PLATFORMS.map((platform) => (
                  <PlatformToggleButton
                    key={platform.id}
                    platform={platform}
                    selected={selectedPlatforms.includes(platform.id)}
                    onToggle={() => handlePlatformToggle(platform.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Instagram-specific fields */}
          {hasInstagram && (
            <div className="space-y-4 p-4 rounded-lg bg-muted/50 border">
              <p className="text-sm font-medium">Instagram Options</p>
              
              <div className="space-y-2">
                <Label>First Comment</Label>
                <Textarea
                  value={instagramFirstComment}
                  onChange={(e) => setInstagramFirstComment(e.target.value)}
                  placeholder="Add additional hashtags or text as a first comment..."
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Posted automatically as the first comment on your Instagram post
                </p>
              </div>

              <div className="space-y-2">
                <Label>Collaborators</Label>
                <Input
                  value={instagramCollaborators}
                  onChange={(e) => setInstagramCollaborators(e.target.value)}
                  placeholder="@username1, @username2"
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple usernames with commas
                </p>
              </div>
            </div>
          )}

          {/* Content Type */}
          <div className="space-y-2">
            <Label>Content Type</Label>
            <Select value={contentType} onValueChange={(v) => setContentType(v as typeof CONTENT_TYPES[number])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date & Time Picker */}
          <div className="space-y-2">
            <Label>Schedule Date & Time</Label>
            <DateTimePicker
              date={scheduledDate}
              setDate={setScheduledDate}
              hour={scheduledHour}
              setHour={setScheduledHour}
              minute={scheduledMinute}
              setMinute={setScheduledMinute}
              period={scheduledPeriod}
              setPeriod={setScheduledPeriod}
            />
          </div>

          {/* Scheduling Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={schedulingStatus} onValueChange={(v) => setSchedulingStatus(v as SchedulingStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULING_STATUSES.map(status => (
                  <SelectItem key={status.id} value={status.id}>
                    <div className="flex items-center gap-2">
                      <Circle className={cn("h-3 w-3 fill-current", status.color, "text-transparent")} />
                      {status.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
            <div className="flex-1" />
            {piece.status !== 'live' && (
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                onClick={async () => {
                  const success = await postNow(piece.id);
                  if (success) {
                    onOpenChange(false);
                  }
                }}
                disabled={isPosting}
              >
                <Send className="h-4 w-4" />
                {isPosting ? 'Posting...' : 'Post Now'}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isUpdating || !concept || selectedPlatforms.length === 0}
            >
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
