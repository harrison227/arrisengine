import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format, parseISO } from 'date-fns';
import { ExternalLink, Calendar, Clock, AlertCircle, Download, Loader2, Pencil, X, CheckCircle, MessageSquare, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
interface ContentPiece {
  id: string;
  concept: string;
  status: string;
  content_type: string;
  platform: string;
  platforms?: string[] | null;
  caption?: string | null;
  hashtags?: string[] | null;
  asset_url?: string | null;
  scheduled_date?: string | null;
  target_duration?: number | null;
}

interface PublicContentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  piece: ContentPiece | null;
  brandColor?: string;
  shareId?: string;
  onActionComplete?: () => void;
}

type ActionType = 'approve' | 'request_changes' | 'reject';

const statusLabels: Record<string, string> = {
  idea: 'Draft',
  draft: 'Draft',
  scripted: 'Scripted',
  filmed: 'Filmed',
  edited: 'For Review',
  pending_review: 'For Review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  live: 'Posted',
  published: 'Posted',
};

const contentTypeLabels: Record<string, string> = {
  video: 'Video',
  image: 'Image',
  carousel: 'Carousel',
  story: 'Story',
  reel: 'Reel',
  ugc: 'UGC',
  text_post: 'Text Post',
};

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸',
  instagram_reels: '📸',
  instagram_stories: '📱',
  tiktok: '🎵',
  facebook: '👥',
  facebook_stories: '📱',
  linkedin: '💼',
  youtube: '▶️',
  youtube_shorts: '▶️',
  twitter: '🐦',
  threads: '🧵',
};

const formatPlatformName = (platform: string) => {
  const platformMap: Record<string, string> = {
    instagram: 'Instagram',
    instagram_reels: 'Instagram Reels',
    instagram_stories: 'Instagram Stories',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    youtube_shorts: 'YouTube Shorts',
    facebook: 'Facebook',
    facebook_stories: 'Facebook Stories',
    linkedin: 'LinkedIn',
    twitter: 'Twitter/X',
    threads: 'Threads',
  };
  return platformMap[platform.toLowerCase()] || platform;
};

export function PublicContentDetailDialog({ 
  open, 
  onOpenChange, 
  piece,
  brandColor = '#3b82f6',
  shareId,
  onActionComplete,
}: PublicContentDetailDialogProps) {
  // IMPORTANT: All hooks MUST be called unconditionally at the top level (rules of hooks).
  // We handle "no piece" after the hooks.
  const isMobile = useIsMobile();
  const [videoError, setVideoError] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [videoLoadErrorMessage, setVideoLoadErrorMessage] = useState<string | null>(null);
  const [useStreamingFallback, setUseStreamingFallback] = useState(false);
  
  // Client editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editedCaption, setEditedCaption] = useState('');
  const [editedHashtags, setEditedHashtags] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);

  // Initialize edited values when piece changes
  useEffect(() => {
    if (piece) {
      setEditedCaption(piece.caption || '');
      setEditedHashtags(piece.hashtags || []);
      setFeedback('');
      setIsEditing(false);
    }
  }, [piece?.id]);

  // Check for video by examining the URL path (before query params)
  const getUrlPath = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  };

  // Parse carousel images from asset_url (JSON array)
  const carouselImages: string[] = (() => {
    if (!piece?.asset_url) return [];
    try {
      const parsed = JSON.parse(piece.asset_url);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not JSON, single URL
    }
    return [];
  })();

  const isCarousel = carouselImages.length > 1 || piece?.content_type === 'carousel';
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Reset carousel index when piece changes
  useEffect(() => {
    setCarouselIndex(0);
  }, [piece?.id]);

  const isVideo = piece?.asset_url && !isCarousel
    ? (() => {
        const path = getUrlPath(piece.asset_url!);
        return (
          path.endsWith('.mp4') ||
          path.endsWith('.mov') ||
          path.endsWith('.webm') ||
          path.endsWith('.m4v') ||
          path.endsWith('.avi') ||
          path.includes('/video/') ||
          piece.content_type === 'video' ||
          piece.content_type === 'reel'
        );
      })()
    : false;

  // Reset states when piece changes
  useEffect(() => {
    // Always reset states when piece or open changes
    setVideoError(false);
    setVideoLoading(true);
    setVideoBlobUrl(null);
    setDownloadProgress(0);
    setVideoLoadErrorMessage(null);
    setUseStreamingFallback(false);

    // For non-videos or when not open, just stop loading
    if (!open || !piece?.asset_url || !isVideo) {
      setVideoLoading(false);
      return;
    }

    // We'll try streaming first - no blob loading needed initially
    // The blob loading will only be triggered if streaming fails
  }, [open, piece?.id, piece?.asset_url, isVideo]);

  // Load video as blob (only when streaming fails)
  useEffect(() => {
    if (!useStreamingFallback || !open || !piece?.asset_url || !isVideo) {
      return;
    }

    let cancelled = false;
    let currentBlobUrl: string | null = null;
    const controller = new AbortController();

    const loadVideoAsBlob = async () => {
      try {
        console.log('[PublicContentDetailDialog] Streaming failed, loading video as blob:', {
          pieceId: piece.id,
          url: piece.asset_url,
        });

        setVideoLoading(true);
        setDownloadProgress(0);

        const response = await fetch(piece.asset_url!, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const msg = `Failed to fetch video: ${response.status} ${response.statusText}`;
          throw new Error(msg);
        }

        const contentTypeHeader = response.headers.get('content-type') || '';
        const contentLength = parseInt(response.headers.get('content-length') || '0', 10);

        let blob: Blob;
        if (response.body?.getReader) {
          const reader = response.body.getReader();
          let receivedLength = 0;
          const chunks: BlobPart[] = [];

          while (true) {
            const { done, value } = await reader.read();

            if (done) break;
            if (cancelled) return;
            if (!value) continue;

            chunks.push(value);
            receivedLength += value.byteLength;

            if (contentLength > 0) {
              const progress = (receivedLength / contentLength) * 100;
              setDownloadProgress(Math.round(progress));
            }
          }

          if (cancelled) return;

          const blobType = contentTypeHeader || 'video/mp4';
          blob = new Blob(chunks, { type: blobType });
        } else {
          blob = await response.blob();
        }

        if (cancelled) return;

        const blobUrl = URL.createObjectURL(blob);
        currentBlobUrl = blobUrl;

        console.log('[PublicContentDetailDialog] Video blob created:', {
          pieceId: piece.id,
          blobUrl,
          sizeMB: Number((blob.size / 1024 / 1024).toFixed(2)),
        });
        setVideoBlobUrl(blobUrl);
        setDownloadProgress(0);
      } catch (error) {
        if ((error as any)?.name === 'AbortError') return;

        console.error('[PublicContentDetailDialog] Failed to load video as blob:', error);
        if (!cancelled) {
          setVideoLoadErrorMessage(error instanceof Error ? error.message : String(error));
          setVideoError(true);
          setVideoLoading(false);
        }
      }
    };

    loadVideoAsBlob();

    return () => {
      cancelled = true;
      controller.abort();
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [useStreamingFallback, open, piece?.id, piece?.asset_url, isVideo]);

  // Now we can safely handle the "no piece" case after all hooks have been called.
  if (!piece) return null;

  const allPlatforms = piece.platforms?.length ? piece.platforms : [piece.platform];

  // Determine if actions are available based on status
  const isApproved = piece.status === 'approved' || piece.status === 'scheduled' || piece.status === 'live' || piece.status === 'published';
  const isRejected = piece.status === 'rejected';
  const canTakeAction = shareId && !isApproved && !isRejected;

  const handleCancelEdit = () => {
    setEditedCaption(piece.caption || '');
    setEditedHashtags(piece.hashtags || []);
    setIsEditing(false);
  };

  const handleAction = async (action: ActionType) => {
    if (!shareId) return;

    // Require feedback for request_changes and reject
    if ((action === 'request_changes' || action === 'reject') && !feedback.trim()) {
      toast.error('Please provide feedback for this action');
      return;
    }

    setIsSubmitting(true);
    setActiveAction(action);

    try {
      const requestBody: Record<string, any> = {
        shareId,
        pieceId: piece.id,
        action,
        feedback: feedback.trim() || null,
      };

      // Include edited caption if changed
      if (editedCaption !== (piece.caption || '')) {
        requestBody.caption = editedCaption;
      }

      // Include edited hashtags if changed
      if (JSON.stringify(editedHashtags) !== JSON.stringify(piece.hashtags || [])) {
        requestBody.hashtags = editedHashtags;
      }

      const { data, error } = await supabase.functions.invoke('public-content-action', {
        body: requestBody,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const actionMessages: Record<ActionType, string> = {
        approve: 'Content approved successfully',
        request_changes: 'Feedback submitted',
        reject: 'Content rejected',
      };

      toast.success(actionMessages[action]);
      onActionComplete?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting action:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit action');
    } finally {
      setIsSubmitting(false);
      setActiveAction(null);
    }
  };

  const handleViewOriginal = () => {
    if (!piece.asset_url) return;
    
    // For mobile, trigger download which is more reliable than inline playback
    if (isMobile && isVideo) {
      const link = document.createElement('a');
      link.href = piece.asset_url;
      link.download = `video-${piece.id}.mp4`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      window.open(piece.asset_url, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto bg-white text-slate-900 p-4 sm:p-6 rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-slate-800 text-base sm:text-lg pr-6">
            <span className="line-clamp-2">{piece.concept}</span>
            <Badge 
              variant="outline" 
              className="border-slate-300 text-xs sm:text-sm flex-shrink-0"
              style={{ borderColor: brandColor, color: brandColor }}
            >
              {statusLabels[piece.status] || piece.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-5 mt-2">
          {/* Media Preview */}
          {piece.asset_url && (
            <div className="space-y-2 sm:space-y-3">
              <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                {isVideo ? (
                  videoError ? (
                    // Error fallback - offer download as primary action
                    <div className="flex flex-col items-center justify-center p-8 bg-slate-50 text-center space-y-4">
                      <AlertCircle className="h-12 w-12 text-slate-400" />
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-slate-700">Unable to load video preview</p>
                        <p className="text-xs text-slate-500">
                          {isMobile 
                            ? "Tap below to download the video"
                            : "Click below to view the video directly"
                          }
                        </p>
                        {videoLoadErrorMessage && (
                          <p className="text-[10px] text-slate-400 break-words">
                            {videoLoadErrorMessage}
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={handleViewOriginal}
                        className="bg-slate-800 hover:bg-slate-700 text-white"
                      >
                        {isMobile ? (
                          <>
                            <Download className="h-4 w-4 mr-2" />
                            Download Video
                          </>
                        ) : (
                          <>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open Video Directly
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    // Video playback - try streaming first, fallback to blob
                    <div className="relative min-h-[200px]">
                      {videoLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 min-h-[200px]">
                          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                          <div className="text-sm text-slate-500">
                            Loading video...
                            {downloadProgress > 0 && ` ${downloadProgress}%`}
                          </div>
                        </div>
                      )}
                      
                      {useStreamingFallback ? (
                        // Blob fallback for browsers where streaming fails (e.g., some iOS Safari)
                        videoBlobUrl ? (
                          <video 
                            key={videoBlobUrl}
                            src={videoBlobUrl}
                            controls 
                            playsInline
                            preload="metadata"
                            className="w-full max-h-[50vh] sm:max-h-80 object-contain bg-black"
                            onLoadedMetadata={() => {
                              console.log('[PublicContentDetailDialog] Blob video metadata loaded', { pieceId: piece.id });
                              setVideoLoading(false);
                            }}
                            onError={(e) => {
                              console.error('[PublicContentDetailDialog] Blob video playback error:', e);
                              setVideoError(true);
                              setVideoLoading(false);
                            }}
                          />
                        ) : (
                          !videoLoading && (
                            <div className="flex flex-col items-center justify-center min-h-[200px] p-6 text-center space-y-3">
                              <p className="text-sm text-slate-600">Video preview isn't available.</p>
                              <Button variant="outline" size="sm" onClick={handleViewOriginal}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Original
                              </Button>
                            </div>
                          )
                        )
                      ) : (
                        // Direct streaming - fast initial load
                        <video 
                          key={`stream-${piece.id}`}
                          src={piece.asset_url}
                          controls 
                          playsInline
                          preload="auto"
                          className="w-full max-h-[50vh] sm:max-h-80 object-contain bg-black"
                          onLoadedMetadata={() => {
                            console.log('[PublicContentDetailDialog] Streaming video metadata loaded', { pieceId: piece.id });
                            setVideoLoading(false);
                          }}
                          onError={(e) => {
                            console.log('[PublicContentDetailDialog] Streaming failed, falling back to blob', { pieceId: piece.id });
                            // If streaming fails (CORS, iOS Safari issues), fall back to blob loading
                            setUseStreamingFallback(true);
                          }}
                        />
                      )}
                    </div>
                  )
                ) : isCarousel && carouselImages.length > 0 ? (
                  <div className="relative">
                    <img 
                      src={carouselImages[carouselIndex]} 
                      alt={`${piece.concept} - ${carouselIndex + 1}`}
                      className="w-full max-h-[50vh] sm:max-h-80 object-contain"
                    />
                    {carouselImages.length > 1 && (
                      <>
                        <button
                          onClick={() => setCarouselIndex((i) => (i - 1 + carouselImages.length) % carouselImages.length)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setCarouselIndex((i) => (i + 1) % carouselImages.length)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                          {carouselImages.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => setCarouselIndex(idx)}
                              className={`w-2 h-2 rounded-full transition-colors ${idx === carouselIndex ? 'bg-white' : 'bg-white/50'}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <img 
                    src={piece.asset_url} 
                    alt={piece.concept}
                    className="w-full max-h-[50vh] sm:max-h-80 object-contain"
                  />
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewOriginal}
                className="w-full text-sm"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Original
              </Button>
            </div>
          )}

          {/* Caption - Editable when actions available */}
          {(piece.caption || canTakeAction) && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs sm:text-sm font-medium text-slate-500">Caption</h4>
                  {canTakeAction && !isEditing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className="h-6 sm:h-7 text-xs"
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  )}
                  {isEditing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEdit}
                      className="h-6 sm:h-7 text-xs text-slate-500"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  )}
                </div>
                
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editedCaption}
                      onChange={(e) => setEditedCaption(e.target.value)}
                      rows={6}
                      className="resize-none text-xs sm:text-sm bg-white text-slate-900 border-slate-300 placeholder:text-slate-400"
                      placeholder="Enter caption..."
                    />
                    <p className="text-[10px] sm:text-xs text-slate-500">
                      {editedCaption.length} characters
                      {editedCaption !== (piece.caption || '') && (
                        <span className="text-amber-600 ml-2">• Edited</span>
                      )}
                    </p>
                  </div>
                ) : (
                  <>
                    {piece.caption ? (
                      <>
                        <div className="bg-slate-50 rounded-lg p-3 sm:p-4 border border-slate-200">
                          <p className="whitespace-pre-wrap text-xs sm:text-sm text-slate-700">{piece.caption}</p>
                        </div>
                        <p className="text-[10px] sm:text-xs text-slate-400">
                          {piece.caption.length} characters
                        </p>
                      </>
                    ) : (
                      <p className="text-xs sm:text-sm text-slate-400 italic">No caption yet</p>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {/* Hashtags */}
          {(piece.hashtags && piece.hashtags.length > 0) && !isEditing && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-medium text-slate-500">Hashtags</h4>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {piece.hashtags.map((tag, i) => (
                    <Badge 
                      key={i} 
                      variant="secondary" 
                      className="bg-slate-100 text-slate-600 hover:bg-slate-100 text-xs"
                    >
                      {tag.startsWith('#') ? tag : `#${tag}`}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Platforms */}
          {allPlatforms.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-xs sm:text-sm font-medium text-slate-500">Platforms</h4>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {allPlatforms.map((platform, i) => (
                    <Badge key={i} variant="outline" className="text-xs sm:text-sm border-slate-300">
                      {PLATFORM_ICONS[platform.toLowerCase()] || '📱'} {formatPlatformName(platform)}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Content Type & Schedule */}
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-medium text-slate-500">Content Type</h4>
              <p className="text-xs sm:text-sm text-slate-700">{contentTypeLabels[piece.content_type] || piece.content_type}</p>
            </div>
            {piece.scheduled_date && (
              <div className="space-y-1">
                <h4 className="text-xs sm:text-sm font-medium text-slate-500">Scheduled</h4>
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-700 flex-wrap">
                  <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400" />
                  {format(parseISO(piece.scheduled_date), 'MMM d, yyyy')}
                  <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400 ml-1 sm:ml-2" />
                  {format(parseISO(piece.scheduled_date), 'h:mm a')}
                </div>
              </div>
            )}
          </div>

          {/* Duration (if applicable) */}
          {piece.target_duration && (
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-medium text-slate-500">Duration</h4>
              <p className="text-xs sm:text-sm text-slate-700">{piece.target_duration} seconds</p>
            </div>
          )}

          {/* Approval Actions */}
          {canTakeAction && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-xs sm:text-sm font-medium text-slate-500">Your Feedback</h4>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Add any notes or feedback (required for changes/rejection)..."
                  rows={3}
                  className="resize-none text-xs sm:text-sm bg-white text-slate-900 border-slate-300 placeholder:text-slate-400"
                />
                
                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    onClick={() => handleAction('approve')}
                    disabled={isSubmitting}
                    className="w-full bg-green-600 hover:bg-green-700 h-10 sm:h-11 text-sm"
                  >
                    {isSubmitting && activeAction === 'approve' ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Approve
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAction('request_changes')}
                      disabled={isSubmitting}
                      variant="outline"
                      className="flex-1 border-yellow-500 text-yellow-700 hover:bg-yellow-50 h-10 sm:h-11 text-xs sm:text-sm"
                    >
                      {isSubmitting && activeAction === 'request_changes' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4 mr-2" />
                      )}
                      Request Changes
                    </Button>

                    <Button
                      onClick={() => handleAction('reject')}
                      disabled={isSubmitting}
                      variant="outline"
                      className="flex-1 border-red-500 text-red-700 hover:bg-red-50 h-10 sm:h-11 text-xs sm:text-sm"
                    >
                      {isSubmitting && activeAction === 'reject' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Status Messages */}
          {isApproved && (
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700">This content has been approved</span>
            </div>
          )}
          {isRejected && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-700">This content was rejected</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
