import { useState, useEffect } from 'react';
import { Check, Sparkles, Loader2, RefreshCw, Circle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MediaUploader } from '@/components/content/MediaUploader';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { useClients } from '@/hooks/useClients';
import { useContentPlans } from '@/hooks/useContentPlans';
import { useContentPieces } from '@/hooks/useContentPieces';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
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
const statusToDbStatus: Record<SchedulingStatus, 'idea' | 'scripted' | 'filmed' | 'edited' | 'approved' | 'live'> = {
  'draft': 'idea',
  'for_review': 'edited',
  'approved_scheduled': 'approved',
  'posted': 'live',
};

interface AddContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  // Pre-fill props for Image Studio integration
  initialImageUrl?: string;
  initialImageUrls?: string[];  // For carousel posts with multiple images
  initialCaption?: string;
  initialHashtags?: string[];
  initialClientId?: string;
  initialConcept?: string;
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

// Convert 12-hour to 24-hour format
const to24Hour = (hour: string, period: "AM" | "PM"): number => {
  const h = parseInt(hour, 10);
  if (period === "AM") {
    return h === 12 ? 0 : h;
  }
  return h === 12 ? 12 : h + 12;
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

// Extensions for auto-detecting content type
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];

export function AddContentDialog({ 
  open, 
  onOpenChange, 
  selectedDate,
  initialImageUrl,
  initialImageUrls,
  initialCaption,
  initialHashtags,
  initialClientId,
  initialConcept
}: AddContentDialogProps) {
  const { clients } = useClients();
  const { contentPlans, createContentPlan } = useContentPlans();
  const { createPiece, isCreating } = useContentPieces();
  const { toast } = useToast();
  const [isGeneratingHashtags, setIsGeneratingHashtags] = useState(false);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [videoTranscript, setVideoTranscript] = useState('');
  
  const [clientId, setClientId] = useState('');
  const [contentPlanId, setContentPlanId] = useState('');
  const [concept, setConcept] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [contentType, setContentType] = useState<typeof CONTENT_TYPES[number]>('video');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [carouselUrls, setCarouselUrls] = useState<string[]>([]);
  const [schedulingStatus, setSchedulingStatus] = useState<SchedulingStatus>('draft');
  
  // New fields
  const [captionRefinement, setCaptionRefinement] = useState('');
  const [instagramFirstComment, setInstagramFirstComment] = useState('');
  const [instagramCollaborators, setInstagramCollaborators] = useState('');
  
  // DateTime state
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledHour, setScheduledHour] = useState('09');
  const [scheduledMinute, setScheduledMinute] = useState('00');
  const [scheduledPeriod, setScheduledPeriod] = useState<'AM' | 'PM'>('AM');
  
  // Check if any Instagram platform is selected
  const hasInstagram = selectedPlatforms.some(p => p.toLowerCase().includes('instagram'));
  
  // Auto-detect content type from media URL (only for single uploads)
  useEffect(() => {
    if (!mediaUrl || contentType === 'carousel') return;
    try {
      JSON.parse(mediaUrl); // If it parses as JSON array, skip auto-detect
      return;
    } catch {
      // not JSON — continue with extension-based detection below
    }
    const url = mediaUrl.toLowerCase();
    const urlWithoutParams = url.split('?')[0];
    
    if (VIDEO_EXTENSIONS.some(ext => urlWithoutParams.endsWith(ext))) {
      setContentType('video');
    } else if (IMAGE_EXTENSIONS.some(ext => urlWithoutParams.endsWith(ext))) {
      setContentType('image');
    }
  }, [mediaUrl]);

  // Filter content plans by selected client
  const clientContentPlans = contentPlans.filter(cp => cp.client_id === clientId);

  useEffect(() => {
    if (selectedDate) {
      setScheduledDate(selectedDate);
    }
  }, [selectedDate]);

  // Pre-fill form when initial values are provided
  useEffect(() => {
    if (open) {
      if (initialImageUrls && initialImageUrls.length > 1) {
        setCarouselUrls(initialImageUrls);
        setMediaUrl(JSON.stringify(initialImageUrls));
        setContentType('carousel');
      } else if (initialImageUrl) {
        setMediaUrl(initialImageUrl);
        setContentType('image');
      }
      if (initialCaption) {
        setCaption(initialCaption);
      }
      if (initialHashtags && initialHashtags.length > 0) {
        setHashtags(initialHashtags.join(' '));
      }
      if (initialClientId) {
        setClientId(initialClientId);
      }
      if (initialConcept) {
        setConcept(initialConcept);
      }
    }
  }, [open, initialImageUrl, initialImageUrls, initialCaption, initialHashtags, initialClientId, initialConcept]);

  useEffect(() => {
    if (!open) {
      setClientId('');
      setContentPlanId('');
      setConcept('');
      setCaption('');
      setHashtags('');
      setSelectedPlatforms([]);
      setContentType('video');
      setMediaUrl(null);
      setCarouselUrls([]);
      setScheduledDate(undefined);
      setScheduledHour('09');
      setScheduledMinute('00');
      setScheduledPeriod('AM');
      setSchedulingStatus('draft');
      setCaptionRefinement('');
      setInstagramFirstComment('');
      setInstagramCollaborators('');
      setVideoTranscript('');
    }
  }, [open]);

  // Auto-generate caption when video is transcribed
  const handleVideoTranscribed = async (transcript: string) => {
    setVideoTranscript(transcript);
    
    if (!clientId || !transcript.trim()) return;
    
    // Set a concept from transcript if none exists
    if (!concept) {
      setConcept(transcript.substring(0, 100) + '...');
    }
    
    setIsGeneratingCaption(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-caption', {
        body: { 
          concept: concept || 'social media video post', 
          clientId,
          refinement: captionRefinement || undefined,
          videoTranscript: transcript, // Pass transcript as supplementary context
        }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      if (data.title && !concept) {
        setConcept(data.title);
      }
      setCaption(data.caption || '');
      if (data.hashtags && data.hashtags.length > 0) {
        setHashtags(data.hashtags.join(' '));
      }
      toast({ title: 'Caption generated from video!' });
    } catch (error) {
      console.error('Error generating caption from transcript:', error);
      toast({
        title: 'Caption generation failed',
        description: 'Video was transcribed but caption generation failed. You can try regenerating.',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingCaption(false);
    }
  };

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

  const handleRegenerateCaption = async () => {
    if (!clientId) {
      toast({
        title: 'Missing information',
        description: 'Please select a client first',
        variant: 'destructive'
      });
      return;
    }
    
    // Use either the concept or caption as context for regeneration
    const contextForAI = concept || caption || 'social media post';
    
    setIsGeneratingCaption(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-caption', {
        body: { 
          concept: contextForAI, 
          clientId,
          refinement: captionRefinement || undefined,
          existingCaption: caption || undefined
        }
      });
      
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      // Update title if AI generated one
      if (data.title) {
        setConcept(data.title);
      }
      setCaption(data.caption || '');
      if (data.hashtags && data.hashtags.length > 0) {
        setHashtags(data.hashtags.join(' '));
      }
      toast({ title: 'Content regenerated!' });
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
    
    if (!clientId || !concept || selectedPlatforms.length === 0) return;

    // Parse hashtags
    const hashtagArray = hashtags
      .split(/[\s,]+/)
      .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
      .filter(tag => tag.length > 1);

    // Simplify date handling - use the selected date directly
    let scheduledDateTime: string | null = null;
    if (scheduledDate) {
      const hour24 = to24Hour(scheduledHour, scheduledPeriod);
      const year = scheduledDate.getFullYear();
      const month = scheduledDate.getMonth();
      const day = scheduledDate.getDate();
      const dateWithTime = new Date(year, month, day, hour24, parseInt(scheduledMinute, 10), 0, 0);
      scheduledDateTime = dateWithTime.toISOString();
    }

    // Map scheduling status to database status
    const dbStatus = statusToDbStatus[schedulingStatus];

    // If no content plan selected, we need to create one or use a default
    let planId = contentPlanId;
    if (!planId && clientContentPlans.length > 0) {
      planId = clientContentPlans[0].id;
    }
    
    if (!planId) {
      // Create a quick content plan
      const newPlan = await new Promise<any>((resolve) => {
        createContentPlan({
          client_id: clientId,
          title: `Content for ${scheduledDate ? format(scheduledDate, 'MMM d, yyyy') : format(new Date(), 'MMM d, yyyy')}`,
          status: 'scheduled',
          filming_date: scheduledDate ? format(scheduledDate, 'yyyy-MM-dd') : null,
        }, {
          onSuccess: (data) => resolve(data),
        });
      });
      planId = newPlan.id;
    }

    // Parse collaborators into array
    const collaboratorsArray = instagramCollaborators
      .split(/[,\s]+/)
      .map(c => c.trim().replace(/^@/, ''))
      .filter(c => c.length > 0);

    createPiece({
      content_plan_id: planId,
      concept,
      content_type: contentType,
      platform: selectedPlatforms[0], // Primary platform
      caption,
      hashtags: hashtagArray,
      platforms: selectedPlatforms,
      scheduled_date: scheduledDateTime,
      asset_url: mediaUrl,
      status: dbStatus,
      instagram_first_comment: instagramFirstComment || null,
      instagram_collaborators: collaboratorsArray.length > 0 ? collaboratorsArray : null,
    } as any);

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Add Content</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.business_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content Plan (optional) */}
          {clientId && clientContentPlans.length > 0 && (
            <div className="space-y-2">
              <Label>Content Plan (optional)</Label>
              <Select value={contentPlanId} onValueChange={setContentPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select or create new" />
                </SelectTrigger>
                <SelectContent>
                  {clientContentPlans.map(plan => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Media Upload / Carousel Preview */}
          {/* Carousel multi-image upload */}
          {clientId && contentType === 'carousel' && (
            <div className="space-y-2">
              <Label>Carousel Images</Label>
              <MediaUploader
                clientId={clientId}
                onChange={() => {}}
                multiple
                multipleValues={carouselUrls}
                onMultipleChange={(urls) => {
                  setCarouselUrls(urls);
                  setMediaUrl(urls.length > 0 ? JSON.stringify(urls) : null);
                }}
              />
            </div>
          )}
          {/* Single media upload for non-carousel */}
          {clientId && contentType !== 'carousel' && (
            <div className="space-y-2">
              <Label>Media</Label>
              <MediaUploader 
                clientId={clientId} 
                value={mediaUrl || undefined}
                onChange={setMediaUrl}
                onVideoTranscribed={handleVideoTranscribed}
              />
            </div>
          )}

          {/* Concept/Title */}
          <div className="space-y-2">
            <Label>Concept / Title *</Label>
            <Input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="What is this content about?"
            />
          </div>

          {/* Caption Refinement */}
          <div className="space-y-2">
            <Label>Caption Refinement</Label>
            <Input
              value={captionRefinement}
              onChange={(e) => setCaptionRefinement(e.target.value)}
              placeholder="Add guidance for AI (e.g., 'focus on benefits, keep it casual')"
            />
            <p className="text-xs text-muted-foreground">
              Optional: Guide the AI when regenerating caption
            </p>
          </div>

          {/* Caption */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Caption</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRegenerateCaption}
                disabled={isGeneratingCaption || !clientId || !concept}
                className="gap-1.5 h-7 text-xs"
              >
                {isGeneratingCaption ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Regenerate
              </Button>
            </div>
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
                disabled={isGeneratingHashtags || !clientId}
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

            {/* Feed Posts */}
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

            {/* Stories */}
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
              <p className="text-sm font-medium flex items-center gap-2">
                📸 Instagram Settings
              </p>
              
              <div className="space-y-2">
                <Label>First Comment</Label>
                <Textarea
                  value={instagramFirstComment}
                  onChange={(e) => setInstagramFirstComment(e.target.value)}
                  placeholder="Add hashtags or additional text as first comment..."
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  This will be posted as the first comment on your Instagram post
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
                  Add Instagram usernames to invite as collaborators
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isCreating || !clientId || !concept || selectedPlatforms.length === 0}
            >
              {isCreating ? 'Adding...' : 'Add Content'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
