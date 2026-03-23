import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isValidUUID(str: unknown): boolean {
  if (typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Platform mapping from your system to Late's expected format
const PLATFORM_MAP: Record<string, string> = {
  instagram: 'instagram',
  tiktok: 'tiktok',
  facebook: 'facebook',
  linkedin: 'linkedin',
  youtube: 'youtube',
  twitter: 'twitter',
  instagram_stories: 'instagram',
  facebook_stories: 'facebook',
};

interface SyncRequest {
  contentPieceId: string;
  action: 'create' | 'update' | 'delete';
  latePostId?: string | null; // For delete action when piece is already deleted from DB
}

// Minimum time buffer: scheduled_date must be at least this many minutes in the future
const MIN_FUTURE_MINUTES = 2;

async function callLateAPI(
  endpoint: string,
  method: string,
  apiKey: string,
  body?: object,
  idempotencyKey?: string
): Promise<{ data?: unknown; error?: string }> {
  // For POST requests, do NOT retry to avoid duplicates
  const maxRetries = method === 'POST' ? 1 : 2;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      
      if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey;
      }
      
      const response = await fetch(`https://getlate.dev/api/v1${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = `Late API error: ${response.status} - ${errorText}`;
        console.error(`Attempt ${attempt + 1} failed:`, lastError);
        
        // Don't retry on 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          return { error: lastError };
        }
        
        // For POST, don't retry at all to avoid duplicates
        if (method === 'POST') {
          return { error: lastError };
        }
        
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
        continue;
      }

      const data = await response.json();
      return { data };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      lastError = `Network error: ${errorMessage}`;
      console.error(`Attempt ${attempt + 1} failed:`, lastError);
      
      // For POST, don't retry on network errors
      if (method === 'POST') {
        return { error: lastError };
      }
      
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
    }
  }

  return { error: lastError || 'Unknown error after retries' };
}

// Extract late_post_id from Late API response (handles { post: { _id } } structure)
function extractLatePostId(responseData: unknown): string | null {
  if (!responseData || typeof responseData !== 'object') return null;
  const data = responseData as Record<string, unknown>;
  
  // Late typically returns { post: { _id: "..." } }
  if (data.post && typeof data.post === 'object') {
    const post = data.post as Record<string, unknown>;
    if (typeof post._id === 'string') return post._id;
    if (typeof post.id === 'string') return post.id;
  }
  
  // Fallback to top-level
  if (typeof data._id === 'string') return data._id;
  if (typeof data.id === 'string') return data.id;
  
  return null;
}

const MIME_EXT_MAP: Record<string, string> = {
  // Images
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',

  // Videos
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-msvideo': 'avi',
  'video/x-matroska': 'mkv',
  'video/ogg': 'ogv',
};

function parseBase64DataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  // Expected format: data:<mime>;base64,<payload>
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

async function uploadDataUrlToPublicStorage(opts: {
  // Keep this untyped to avoid Supabase generic type issues in edge functions
  supabase: any;
  dataUrl: string;
  clientId: string | null | undefined;
  contentPieceId: string;
}): Promise<{ publicUrl?: string; error?: string }>{
  const parsed = parseBase64DataUrl(opts.dataUrl);
  if (!parsed) {
    return { error: 'Unsupported data URL format. Please re-upload the media.' };
  }

  const isImage = parsed.mimeType.startsWith('image/');
  const isVideo = parsed.mimeType.startsWith('video/');
  if (!isImage && !isVideo) {
    return { error: 'Media must be re-uploaded. Only image/video uploads are supported.' };
  }

  const estimatedBytes = Math.floor((parsed.base64.length * 3) / 4);
  const estimatedMB = estimatedBytes / 1024 / 1024;

  // Safety guard: refuse extremely large inline payloads
  // Note: base64 inflates payload size, and Edge Functions have tight memory/time limits.
  if (estimatedMB > 20) {
    return { error: 'Media must be re-uploaded. Inline media is too large to sync automatically (please upload the file normally).' };
  }

  const ext = MIME_EXT_MAP[parsed.mimeType] || (isVideo ? 'mp4' : 'png');
  const safeClientId = opts.clientId || 'unknown-client';
  const storagePath = `${safeClientId}/auto-upload/${opts.contentPieceId}-${Date.now()}.${ext}`;

  try {
    const binaryString = atob(parsed.base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

     const blob = new Blob([bytes], { type: parsed.mimeType });

    const { data: uploadData, error: uploadError } = await opts.supabase.storage
      .from('client-assets')
      .upload(storagePath, blob, {
        contentType: parsed.mimeType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError || !uploadData) {
      return { error: uploadError?.message || 'Failed to upload media to storage' };
    }

    const { data: urlData } = opts.supabase.storage
      .from('client-assets')
      .getPublicUrl(uploadData.path);

    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) {
      return { error: 'Failed to generate public media URL' };
    }

     // Persist the corrected URL back onto the content piece
    await opts.supabase
      .from('content_pieces')
      .update({
        asset_url: publicUrl,
        late_error_message: null,
      } as any)
      .eq('id', opts.contentPieceId);

    return { publicUrl };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { error: `Failed to process inline media: ${msg}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { contentPieceId, action, latePostId }: SyncRequest = body;

    if (!contentPieceId || !isValidUUID(contentPieceId)) {
      return new Response(
        JSON.stringify({ success: false, error: 'contentPieceId is required and must be a valid UUID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validActions = ['create', 'update', 'delete'];
    if (!action || !validActions.includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: `action is required and must be one of: ${validActions.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Sync request: ${action} for content piece ${contentPieceId}`);

    // For delete action, if we have latePostId passed directly, use it (piece may already be deleted)
    if (action === 'delete' && latePostId) {
      console.log(`Delete action with provided latePostId: ${latePostId}`);
      const apiKey = Deno.env.get('LATE_API_KEY');
      
      if (!apiKey) {
        console.log('No Late API key configured, skipping delete');
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'No Late API key configured' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await callLateAPI(`/posts/${latePostId}`, 'DELETE', apiKey);
      
      if (error) {
        // If Late says the post doesn't exist, consider it successfully deleted
        if (error.includes('404') || error.includes('not found') || error.includes('cannot be deleted')) {
          console.log('Post not found or cannot be deleted in Late, treating as success');
          return new Response(
            JSON.stringify({ success: true, message: 'Post already deleted or not found in Late' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.error('Failed to delete from Late:', error);
        return new Response(
          JSON.stringify({ success: false, error }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      console.log('Successfully deleted from Late');
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the content piece with plan and client info
    const { data: piece, error: pieceError } = await supabase
      .from('content_pieces')
      .select(`
        *,
        content_plans!inner (
          client_id,
          clients!inner (
            id,
            late_api_key,
            late_profile_id,
            business_name
          )
        )
      `)
      .eq('id', contentPieceId)
      .single();

    if (pieceError || !piece) {
      console.error('Failed to fetch content piece:', pieceError);
      return new Response(
        JSON.stringify({ success: false, error: 'Content piece not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const client = piece.content_plans?.clients;
    
    const apiKey = client?.late_api_key || Deno.env.get('LATE_API_KEY');
    
    if (!apiKey) {
      console.log('No Late API key configured, skipping sync');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'No Late API key configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Server-side validation for create/update (not delete)
    // Status mapping:
    // - 'edited' (For Review) → syncs as Draft on Late (no scheduledFor)
    // - 'approved' → syncs as Scheduled on Late (with scheduledFor)
    // - 'live' → already published, skip
    const SYNCABLE_STATUSES = ['edited', 'approved', 'live'];
    
    // Determine if this should be a draft or scheduled post on Late
    const shouldSyncAsDraft = piece.status === 'edited';
    const shouldSyncAsScheduled = piece.status === 'approved';
    
    if (action !== 'delete') {
      if (!SYNCABLE_STATUSES.includes(piece.status)) {
        console.log(`Skipping sync - content status '${piece.status}' not syncable to Late`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            skipped: true, 
            reason: `Content status '${piece.status}' is not ready for Late sync. Mark as 'For Review' or 'Approved' first.` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // 'live' content is already published, don't try to create/update
      if (piece.status === 'live') {
        console.log('Content is already live, skipping Late sync');
        return new Response(
          JSON.stringify({ 
            success: true, 
            skipped: true, 
            reason: 'Content is already published (live status)' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // For scheduled posts (approved status), require a future scheduled date
      if (shouldSyncAsScheduled) {
        if (!piece.scheduled_date) {
          console.log('Skipping sync - approved content needs scheduled date');
          return new Response(
            JSON.stringify({ success: false, message: 'Approved content must have a scheduled date before syncing to Late' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // GUARD: Scheduled date must be in the future
        const scheduledTime = new Date(piece.scheduled_date).getTime();
        const minFutureTime = Date.now() + MIN_FUTURE_MINUTES * 60 * 1000;
        
        if (scheduledTime < minFutureTime) {
          console.log(`Skipping sync - scheduled date is in the past or too soon: ${piece.scheduled_date}`);
          return new Response(
            JSON.stringify({ 
              success: true, 
              skipped: true, 
              reason: 'Scheduled time has already passed or is too soon. Please reschedule to a future time.' 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      // For draft posts (edited status), no scheduled date required
    }

    // Set status to pending
    await supabase
      .from('content_pieces')
      .update({ late_sync_status: 'pending' })
      .eq('id', contentPieceId);

    if (action === 'delete') {
      if (!piece.late_post_id) {
        console.log('No late_post_id, nothing to delete');
        return new Response(
          JSON.stringify({ success: true, message: 'Nothing to delete' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await callLateAPI(`/posts/${piece.late_post_id}`, 'DELETE', apiKey);
      
      if (error) {
        // If Late says the post doesn't exist, clear our reference anyway
        if (error.includes('404') || error.includes('not found') || error.includes('cannot be deleted')) {
          console.log('Post not found or cannot be deleted in Late, clearing reference');
          await supabase
            .from('content_pieces')
            .update({
              late_post_id: null,
              late_sync_status: 'not_synced',
              late_last_synced_at: new Date().toISOString(),
              late_error_message: null,
            })
            .eq('id', contentPieceId);
          return new Response(
            JSON.stringify({ success: true, message: 'Reference cleared' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.error('Failed to delete from Late:', error);
        await supabase
          .from('content_pieces')
          .update({
            late_sync_status: 'error',
            late_error_message: error,
          })
          .eq('id', contentPieceId);
        
        return new Response(
          JSON.stringify({ success: false, error }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      await supabase
        .from('content_pieces')
        .update({
          late_post_id: null,
          late_sync_status: 'not_synced',
          late_last_synced_at: new Date().toISOString(),
          late_error_message: null,
        })
        .eq('id', contentPieceId);

      console.log('Successfully deleted from Late');
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get account mappings for the client
    const clientId = piece.content_plans?.client_id;
    const { data: accountMappings } = await supabase
      .from('late_account_mappings')
      .select('platform, late_account_id')
      .eq('client_id', clientId);

    const accountMap = new Map(
      accountMappings?.map(m => [m.platform, m.late_account_id]) || []
    );

    // Build content string (caption + hashtags)
    let content = piece.caption || piece.concept || '';
    if (piece.hashtags && piece.hashtags.length > 0) {
      content += '\n\n' + piece.hashtags.map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ');
    }

    // Separate platforms into feed posts and stories
    const platforms = (piece.platforms || [piece.platform]).filter(Boolean);
    const feedPlatforms: string[] = [];
    const storyPlatforms: string[] = [];
    
    platforms.forEach((p: string) => {
      const platformKey = p.toLowerCase();
      if (platformKey.includes('_stories')) {
        storyPlatforms.push(platformKey);
      } else {
        feedPlatforms.push(platformKey);
      }
    });

    // Determine if this is video content (for Instagram Reels) or carousel
    const isVideoContent = piece.content_type === 'video' || piece.content_type === 'reel';
    const isCarouselContent = piece.content_type === 'carousel';

    // Build feed platforms array for Late API with Instagram-specific data
    const lateFeedPlatforms = feedPlatforms
      .map((platformKey: string) => {
        const mappedPlatform = PLATFORM_MAP[platformKey] || platformKey;
        const accountId = accountMap.get(platformKey);
        if (accountId) {
          const platformTarget: Record<string, unknown> = { platform: mappedPlatform, accountId };
          
          if (mappedPlatform === 'instagram') {
            const platformSpecificData: Record<string, unknown> = {};
            
            // CRITICAL: For video content, explicitly set contentType to 'reel'
            // Otherwise Late defaults to Story for video content
            if (isVideoContent) {
              platformSpecificData.contentType = 'reel';
            } else if (isCarouselContent) {
              platformSpecificData.contentType = 'carousel';
            }
            
            if (piece.instagram_first_comment) {
              platformSpecificData.firstComment = piece.instagram_first_comment;
            }
            
            if (piece.instagram_collaborators?.length > 0) {
              platformSpecificData.collaborators = piece.instagram_collaborators.map((c: string) => 
                c.startsWith('@') ? c.slice(1) : c
              );
            }
            
            if (Object.keys(platformSpecificData).length > 0) {
              platformTarget.platformSpecificData = platformSpecificData;
            }
          }
          
          return platformTarget;
        }
        return null;
      })
      .filter(Boolean);

    // Build story platforms array
    const lateStoryPlatforms = storyPlatforms
      .map((platformKey: string) => {
        const basePlatform = platformKey.replace('_stories', '');
        const mappedPlatform = PLATFORM_MAP[basePlatform] || basePlatform;
        const accountId = accountMap.get(platformKey) || accountMap.get(basePlatform);
        if (accountId) {
          return { 
            platform: mappedPlatform, 
            accountId,
            platformSpecificData: { contentType: 'story' }
          };
        }
        return null;
      })
      .filter(Boolean);

    const latePlatforms = [...lateFeedPlatforms, ...lateStoryPlatforms];

    if (latePlatforms.length === 0) {
      console.log('No valid platform mappings found, skipping sync');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'No Late account mappings configured for selected platforms' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the Late post payload
    const latePayload: Record<string, unknown> = {
      content,
      platforms: latePlatforms,
    };

    // Explicitly control draft status on Late
    // - For Review (edited) -> isDraft: true (creates/keeps as draft)
    // - Approved -> isDraft: false (creates/updates as scheduled)
    if (shouldSyncAsDraft) {
      latePayload.isDraft = true;
      // No scheduledFor for drafts
    } else if (shouldSyncAsScheduled && piece.scheduled_date) {
      latePayload.isDraft = false;  // KEY: explicitly set to false to convert draft to scheduled
      latePayload.scheduledFor = new Date(piece.scheduled_date).toISOString();
    }
    
    console.log(`Syncing as ${shouldSyncAsDraft ? 'DRAFT' : 'SCHEDULED'} to Late`);

    // Add media if present
    const requiresMedia = feedPlatforms.some(p => p === 'instagram' || p === 'tiktok');
    let resolvedAssetUrl: string | null = piece.asset_url || null;

    // Auto-fix legacy inline base64 media by uploading to storage and replacing asset_url.
    if (resolvedAssetUrl?.startsWith('data:') && requiresMedia) {
      console.log('Detected inline media URL; attempting automatic upload to storage');
      const { publicUrl, error: uploadError } = await uploadDataUrlToPublicStorage({
        supabase,
        dataUrl: resolvedAssetUrl,
        clientId,
        contentPieceId,
      });

      if (uploadError) {
        await supabase
          .from('content_pieces')
          .update({
            late_sync_status: 'error',
            late_error_message: uploadError,
          })
          .eq('id', contentPieceId);

        return new Response(
          JSON.stringify({ success: false, error: uploadError }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      resolvedAssetUrl = publicUrl || null;
    }

    if (resolvedAssetUrl) {
      if (resolvedAssetUrl.startsWith('http://') || resolvedAssetUrl.startsWith('https://')) {
        const isVideo = piece.content_type === 'video' || piece.content_type === 'reel';
        latePayload.mediaItems = [{
          type: isVideo ? 'video' : 'image',
          url: resolvedAssetUrl,
        }];
      } else if (resolvedAssetUrl.startsWith('[')) {
        // Carousel: asset_url is a JSON array of image URLs
        try {
          const carouselUrls = JSON.parse(resolvedAssetUrl) as string[];
          const validUrls = carouselUrls.filter((u: string) => 
            u.startsWith('http://') || u.startsWith('https://')
          );
          if (validUrls.length > 0) {
            latePayload.mediaItems = validUrls.map((url: string) => ({
              type: 'image' as const,
              url,
            }));
            console.log(`Carousel post: sending ${validUrls.length} media items`);
          } else if (requiresMedia) {
            const msg = 'Carousel images must be public HTTPS URLs.';
            await supabase
              .from('content_pieces')
              .update({ late_sync_status: 'error', late_error_message: msg })
              .eq('id', contentPieceId);
            return new Response(
              JSON.stringify({ success: false, error: msg }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }
        } catch {
          console.error('Failed to parse carousel asset_url as JSON array');
          if (requiresMedia) {
            const msg = 'Invalid carousel media format.';
            await supabase
              .from('content_pieces')
              .update({ late_sync_status: 'error', late_error_message: msg })
              .eq('id', contentPieceId);
            return new Response(
              JSON.stringify({ success: false, error: msg }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }
        }
      } else if (requiresMedia) {
        // Media exists but isn't reachable by Late (e.g. blob:, file:, or an unrecognized URL)
        const msg = 'Media must be re-uploaded. Attached media URL is not a public HTTPS link.';
        await supabase
          .from('content_pieces')
          .update({
            late_sync_status: 'error',
            late_error_message: msg,
          })
          .eq('id', contentPieceId);

        return new Response(
          JSON.stringify({ success: false, error: msg }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    } else if (requiresMedia) {
      const msg = 'Instagram/TikTok posts require media. Please attach an image or video.';
      await supabase
        .from('content_pieces')
        .update({
          late_sync_status: 'error',
          late_error_message: msg,
        })
        .eq('id', contentPieceId);

      return new Response(
        JSON.stringify({ success: false, error: msg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Late payload:', JSON.stringify(latePayload, null, 2));

    let result: { data?: unknown; error?: string };

    // If we already have a late_post_id, try to update
    if (piece.late_post_id) {
      // Late API uses PUT for updates
      result = await callLateAPI(`/posts/${piece.late_post_id}`, 'PUT', apiKey, latePayload);
      
      // Handle "not editable" error (post already published)
      if (result.error && result.error.includes('Only draft, scheduled, failed, and partial posts can be edited')) {
        console.log('Late post exists but is not editable; skipping sync.');
        await supabase
          .from('content_pieces')
          .update({
            late_sync_status: 'synced',
            late_last_synced_at: new Date().toISOString(),
            late_error_message: null,
          })
          .eq('id', contentPieceId);
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: 'Late post is not editable (likely already published).',
            latePostId: piece.late_post_id,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Handle 404 - post doesn't exist in Late, create new
      if (result.error && (result.error.includes('404') || result.error.includes('not found'))) {
        console.log('Post not found in Late, creating new one');
        await supabase
          .from('content_pieces')
          .update({ late_post_id: null })
          .eq('id', contentPieceId);
        
        const idempotencyKey = `content_piece:${contentPieceId}`;
        result = await callLateAPI('/posts', 'POST', apiKey, latePayload, idempotencyKey);
      }
    } else {
      // Create new post with idempotency key
      const idempotencyKey = `content_piece:${contentPieceId}`;
      result = await callLateAPI('/posts', 'POST', apiKey, latePayload, idempotencyKey);
    }

    if (result.error) {
      console.error('Late API sync failed:', result.error);
      await supabase
        .from('content_pieces')
        .update({
          late_sync_status: 'error',
          late_error_message: result.error,
        })
        .eq('id', contentPieceId);
      
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Extract late_post_id from response
    const newLatePostId = extractLatePostId(result.data) || piece.late_post_id;
    
    await supabase
      .from('content_pieces')
      .update({
        late_post_id: newLatePostId,
        late_sync_status: 'synced',
        late_last_synced_at: new Date().toISOString(),
        late_error_message: null,
      })
      .eq('id', contentPieceId);

    console.log(`Successfully synced to Late. Post ID: ${latePostId}`);
    
    return new Response(
      JSON.stringify({ success: true, latePostId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
