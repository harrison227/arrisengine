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

interface PostNowRequest {
  contentPieceId: string;
}

async function callLateAPI(
  endpoint: string,
  method: string,
  apiKey: string,
  body?: object,
  idempotencyKey?: string
): Promise<{ data?: unknown; error?: string }> {
  // For POST requests creating content, do NOT retry to avoid duplicates
  const maxRetries = method === 'POST' ? 1 : 3;
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
        
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
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
      
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
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
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

async function uploadDataUrlToPublicStorage(opts: {
  supabase: any;
  dataUrl: string;
  clientId: string | null | undefined;
  contentPieceId: string;
}): Promise<{ publicUrl?: string; error?: string }> {
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

    // Persist corrected URL back onto the content piece
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

    const { contentPieceId }: PostNowRequest = body;

    if (!contentPieceId || !isValidUUID(contentPieceId)) {
      return new Response(
        JSON.stringify({ success: false, error: 'contentPieceId is required and must be a valid UUID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Post Now request for content piece ${contentPieceId}`);

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

    // Check if post already exists in Late - we may need to UPDATE it to publish now
    const existingLatePostId = piece.late_post_id;
    const isAlreadySynced = existingLatePostId && piece.late_sync_status === 'synced';
    
    // If already synced AND status is 'live', it was already published - skip
    // Note: `content_pieces.status` is a DB enum (content_status) and does not include 'posted'.
    if (isAlreadySynced && piece.status === 'live') {
      console.log('Content already published to Late, skipping to prevent duplicate');
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true, 
          reason: 'Content has already been published to Late',
          latePostId: existingLatePostId 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // If we have an existing Late post ID, we'll UPDATE it to publish immediately
    const shouldUpdateExisting = !!existingLatePostId;

    const client = piece.content_plans?.clients;
    
    const apiKey = client?.late_api_key || Deno.env.get('LATE_API_KEY');
    
    if (!apiKey) {
      console.error('No Late API key configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Late is not configured. Please add your Late API key in client settings.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Set status to pending
    await supabase
      .from('content_pieces')
      .update({ late_sync_status: 'pending' })
      .eq('id', contentPieceId);

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

    // Determine if this is video content (for Instagram Reels)
    const isVideoContent = piece.content_type === 'video' || piece.content_type === 'reel';

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
      console.error('No valid platform mappings found');
      await supabase
        .from('content_pieces')
        .update({
          late_sync_status: 'error',
          late_error_message: 'No Late accounts linked for selected platforms',
        })
        .eq('id', contentPieceId);
        
      return new Response(
        JSON.stringify({ success: false, error: 'No Late accounts linked for selected platforms. Please configure Late account mappings in client settings.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Build the Late post payload - NO scheduledFor = publish immediately
    const latePayload: Record<string, unknown> = {
      content,
      platforms: latePlatforms,
    };

    const requiresMedia = [...feedPlatforms, ...storyPlatforms]
      .some(p => p.includes('instagram') || p.includes('tiktok'));

    let resolvedAssetUrl: string | null = piece.asset_url || null;

    // Check if this is a carousel (JSON array of URLs)
    const isCarouselContent = piece.content_type === 'carousel' || piece.content_type === 'carousel_post';
    let isJsonArray = false;
    let carouselUrls: string[] = [];
    
    if (resolvedAssetUrl) {
      try {
        const parsed = JSON.parse(resolvedAssetUrl);
        if (Array.isArray(parsed) && parsed.length > 0) {
          isJsonArray = true;
          carouselUrls = parsed;
        }
      } catch {
        // Not JSON, treat as single URL
      }
    }

    if (isJsonArray && carouselUrls.length > 0) {
      // Handle carousel: upload any base64/non-HTTPS images, then build mediaItems array
      console.log(`Processing carousel with ${carouselUrls.length} images`);
      const resolvedUrls: string[] = [];
      for (let i = 0; i < carouselUrls.length; i++) {
        let url = carouselUrls[i];
        
        // If already a valid HTTPS URL, keep it
        if (url.startsWith('https://')) {
          resolvedUrls.push(url);
          continue;
        }
        
        // Upload base64 or non-HTTPS URLs to storage
        if (url.startsWith('data:')) {
          console.log(`Uploading carousel image ${i + 1}/${carouselUrls.length} to storage (${Math.round(url.length / 1024)}KB)`);
          const { publicUrl, error: uploadError } = await uploadDataUrlToPublicStorage({
            supabase,
            dataUrl: url,
            clientId,
            contentPieceId: `${contentPieceId}-carousel-${i}`,
          });
          if (uploadError) {
            console.error(`Carousel image ${i + 1} upload failed:`, uploadError);
            await supabase.from('content_pieces').update({
              late_sync_status: 'error',
              late_error_message: `Failed to upload carousel image ${i + 1}: ${uploadError}`,
            }).eq('id', contentPieceId);
            return new Response(
              JSON.stringify({ success: false, error: `Failed to upload carousel image ${i + 1}: ${uploadError}` }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }
          url = publicUrl!;
        }
        
        // Final validation: must be HTTPS
        if (!url.startsWith('https://')) {
          const msg = `Carousel image ${i + 1} does not have a valid public HTTPS URL. Please re-upload the media.`;
          await supabase.from('content_pieces').update({
            late_sync_status: 'error',
            late_error_message: msg,
          }).eq('id', contentPieceId);
          return new Response(
            JSON.stringify({ success: false, error: msg }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
        
        resolvedUrls.push(url);
      }
      
      // Persist resolved public URLs back to content piece so future syncs don't re-upload
      await supabase.from('content_pieces').update({
        asset_url: JSON.stringify(resolvedUrls),
      }).eq('id', contentPieceId);

      latePayload.mediaItems = resolvedUrls.map((url: string) => ({
        type: 'image',
        url,
      }));
      
      // Set carousel content type for Instagram
      lateFeedPlatforms.forEach((p: any) => {
        if (p.platform === 'instagram') {
          p.platformSpecificData = { ...(p.platformSpecificData || {}), contentType: 'carousel' };
        }
      });
      
      console.log(`Carousel post ready with ${resolvedUrls.length} public HTTPS images`);
    } else {
      // Single asset handling
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
          await supabase.from('content_pieces').update({
            late_sync_status: 'error',
            late_error_message: uploadError,
          }).eq('id', contentPieceId);
          return new Response(
            JSON.stringify({ success: false, error: uploadError }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }

        resolvedAssetUrl = publicUrl || null;
      }

      // Add media (required for Instagram/TikTok)
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
              console.log(`Carousel post-now: sending ${validUrls.length} media items`);
            } else if (requiresMedia) {
              const msg = 'Carousel images must be public HTTPS URLs.';
              await supabase.from('content_pieces').update({
                late_sync_status: 'error',
                late_error_message: msg,
              }).eq('id', contentPieceId);
              return new Response(
                JSON.stringify({ success: false, error: msg }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
              );
            }
          } catch {
            if (requiresMedia) {
              const msg = 'Invalid carousel media format.';
              await supabase.from('content_pieces').update({
                late_sync_status: 'error',
                late_error_message: msg,
              }).eq('id', contentPieceId);
              return new Response(
                JSON.stringify({ success: false, error: msg }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
              );
            }
          }
        } else if (requiresMedia) {
          const msg = 'Media must be re-uploaded. Attached media URL is not a public HTTPS link.';
          await supabase.from('content_pieces').update({
            late_sync_status: 'error',
            late_error_message: msg,
          }).eq('id', contentPieceId);
          return new Response(
            JSON.stringify({ success: false, error: msg }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
      } else if (requiresMedia) {
        const msg = 'Instagram/TikTok posts require media. Please attach an image or video.';
        await supabase.from('content_pieces').update({
          late_sync_status: 'error',
          late_error_message: msg,
        }).eq('id', contentPieceId);
        return new Response(
          JSON.stringify({ success: false, error: msg }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    console.log('Post Now payload:', JSON.stringify(latePayload, null, 2));
    console.log('Should update existing:', shouldUpdateExisting, 'Existing Late Post ID:', existingLatePostId);

    let result: { data?: unknown; error?: string };
    let finalLatePostId: string | null = null;

    if (shouldUpdateExisting && existingLatePostId) {
      // UPDATE existing post to publish immediately.
      // Late does not accept PATCH for this endpoint (405); use supported update semantics.
      console.log(`Updating existing Late post ${existingLatePostId} to publish now`);

      const updatePayload: Record<string, unknown> = {
        ...latePayload,
        id: existingLatePostId,
        isDraft: false,
      };
      delete updatePayload.scheduledFor;

      // Prefer PUT to the resource URL; if method not allowed, fall back to POST /posts with id.
      // This avoids the previous 405 from PATCH.
      result = await callLateAPI(`/posts/${existingLatePostId}`, 'PUT', apiKey, updatePayload);
      if (result.error && result.error.includes('Late API error: 405')) {
        console.log('Late API returned 405 for PUT; retrying update via POST /posts with id');
        const idempotencyKey = `post_now_update:${contentPieceId}:${existingLatePostId}:${Date.now()}`;
        result = await callLateAPI('/posts', 'POST', apiKey, updatePayload, idempotencyKey);
      }

      finalLatePostId = existingLatePostId;
    } else {
      // Create new post with idempotency key (immediate publish)
      const idempotencyKey = `post_now:${contentPieceId}:${Date.now()}`;
      result = await callLateAPI('/posts', 'POST', apiKey, latePayload, idempotencyKey);
      finalLatePostId = extractLatePostId(result.data);
    }

    if (result.error) {
      console.error('Late API post failed:', result.error);
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

    const { error: updatePieceError } = await supabase
      .from('content_pieces')
      .update({
        late_post_id: finalLatePostId,
        late_sync_status: 'synced',
        late_last_synced_at: new Date().toISOString(),
        late_error_message: null,
        status: 'live',
        scheduled_date: new Date().toISOString(),
      })
      .eq('id', contentPieceId);

    if (updatePieceError) {
      console.error('Failed to update content piece after publishing:', updatePieceError);
      return new Response(
        JSON.stringify({ success: false, error: `Published to Late, but failed to update local record: ${updatePieceError.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`Successfully posted to Late. Post ID: ${finalLatePostId}`);
    
    return new Response(
      JSON.stringify({ success: true, latePostId: finalLatePostId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Post Now error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
