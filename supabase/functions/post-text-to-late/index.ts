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
  threads: 'threads',
  x: 'twitter',
};

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
      console.log(`Late API ${method} ${endpoint}`, body ? JSON.stringify(body, null, 2) : '');
      
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
      console.log('Late API response:', JSON.stringify(data, null, 2));
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

    const { textPostId } = body;

    if (!textPostId || !isValidUUID(textPostId)) {
      return new Response(
        JSON.stringify({ success: false, error: 'textPostId is required and must be a valid UUID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Post Now request for text post ${textPostId}`);

    // Get the text post with client info
    const { data: textPost, error: postError } = await supabase
      .from('text_posts')
      .select(`
        *,
        clients!inner (
          id,
          late_api_key,
          late_profile_id,
          business_name
        )
      `)
      .eq('id', textPostId)
      .single();

    if (postError || !textPost) {
      console.error('Failed to fetch text post:', postError);
      return new Response(
        JSON.stringify({ success: false, error: 'Text post not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log('Text post found:', textPost.id, 'platform:', textPost.platform);

    // GUARD: If already published, don't post again
    if (textPost.status === 'published' && textPost.late_post_id) {
      console.log('Text post already published to Late, skipping to prevent duplicate');
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true, 
          reason: 'Post has already been published to Late',
          latePostId: textPost.late_post_id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const client = textPost.clients;
    const apiKey = client?.late_api_key || Deno.env.get('LATE_API_KEY');

    if (!apiKey) {
      console.log('No Late API key configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Late API key not configured for this client' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get account mappings for the client
    const { data: accountMappings } = await supabase
      .from('late_account_mappings')
      .select('platform, late_account_id, account_username')
      .eq('client_id', textPost.client_id);

    console.log('Account mappings:', accountMappings);

    const platform = textPost.platform?.toLowerCase() || 'threads';
    const mappedPlatform = PLATFORM_MAP[platform] || platform;
    
    // Find the account mapping for this platform
    const accountMapping = accountMappings?.find(m => 
      m.platform.toLowerCase() === platform || 
      m.platform.toLowerCase() === mappedPlatform
    );

    if (!accountMapping) {
      console.error(`No Late account mapping found for platform: ${platform}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `No Late account configured for ${platform}. Please connect your ${platform} account in Late settings.` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Using account mapping:', accountMapping);

    // Build the Late post payload for a text-only post
    const latePayload: Record<string, unknown> = {
      content: textPost.content,
      platforms: [{
        platform: mappedPlatform,
        accountId: accountMapping.late_account_id,
      }],
      // Post immediately by not setting scheduledFor
    };

    console.log('Late payload:', JSON.stringify(latePayload, null, 2));

    // Create post on Late with idempotency key
    const idempotencyKey = `text_post_now:${textPostId}:${Date.now()}`;
    const result = await callLateAPI('/posts', 'POST', apiKey, latePayload, idempotencyKey);

    if (result.error) {
      console.error('Late API post failed:', result.error);
      
      // Update text post with error
      await supabase
        .from('text_posts')
        .update({
          status: 'error',
        })
        .eq('id', textPostId);

      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const now = new Date().toISOString();
    const latePostId = extractLatePostId(result.data);

    // Update text post as published WITH late_post_id
    await supabase
      .from('text_posts')
      .update({
        status: 'published',
        published_at: now,
        scheduled_date: now,
        late_post_id: latePostId,
      })
      .eq('id', textPostId);

    console.log(`Successfully posted to Late. Post ID: ${latePostId}`);

    return new Response(
      JSON.stringify({ success: true, latePostId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Post error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
