import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Platform mapping for Late API
const PLATFORM_MAP: Record<string, string> = {
  linkedin: 'linkedin',
  twitter: 'twitter',
  threads: 'threads',
  instagram: 'instagram',
  tiktok: 'tiktok',
  facebook: 'facebook',
  youtube: 'youtube',
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
  let lastError = '';

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
        console.error(`Attempt ${attempt + 1}:`, lastError);
        
        // For POST, don't retry at all to avoid duplicates
        if (method === 'POST') {
          return { error: lastError };
        }
        
        if (response.status >= 500 && attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        
        return { error: lastError };
      }

      const data = await response.json();
      return { data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      lastError = `Network error: ${errorMessage}`;
      console.error(`Attempt ${attempt + 1}:`, lastError);
      
      // For POST, don't retry on network errors
      if (method === 'POST') {
        return { error: lastError };
      }
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
    }
  }

  return { error: lastError };
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[late-scheduled-poster] Starting scheduled post check...');

    const now = new Date();
    
    // Find all text posts that are:
    // 1. Status is 'scheduled' or 'approved' 
    // 2. Have a scheduled_date that is in the past or now
    // 3. Don't have a late_post_id (not yet posted to Late)
    const { data: duePosts, error: fetchError } = await supabase
      .from('text_posts')
      .select(`
        id,
        content,
        platform,
        scheduled_date,
        status,
        late_post_id,
        client_id,
        clients (
          id,
          late_api_key,
          business_name
        )
      `)
      .in('status', ['scheduled', 'approved'])
      .lte('scheduled_date', now.toISOString())
      .is('late_post_id', null)
      .order('scheduled_date', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('[late-scheduled-poster] Error fetching due posts:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!duePosts || duePosts.length === 0) {
      console.log('[late-scheduled-poster] No posts due for publishing');
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[late-scheduled-poster] Found ${duePosts.length} posts due for publishing`);

    let successCount = 0;
    let failCount = 0;
    const results: { postId: string; success: boolean; error?: string }[] = [];

    for (const post of duePosts) {
      try {
        const clientData = post.clients;
        const client = Array.isArray(clientData) ? clientData[0] : clientData;
        
        if (!client?.late_api_key) {
          console.log(`[late-scheduled-poster] Skipping post ${post.id} - no Late API key for client ${client?.business_name}`);
          results.push({ postId: post.id, success: false, error: 'No Late API key configured' });
          failCount++;
          continue;
        }

        // Get account mapping for this platform
        const { data: accountMapping } = await supabase
          .from('late_account_mappings')
          .select('late_account_id, platform, account_username')
          .eq('client_id', post.client_id)
          .eq('platform', PLATFORM_MAP[post.platform] || post.platform)
          .single();

        if (!accountMapping) {
          console.log(`[late-scheduled-poster] Skipping post ${post.id} - no account mapping for ${post.platform}`);
          results.push({ postId: post.id, success: false, error: `No ${post.platform} account configured in Late` });
          failCount++;
          continue;
        }

        const mappedPlatform = PLATFORM_MAP[post.platform] || post.platform;
        const latePayload = {
          content: post.content,
          platforms: [{
            platform: mappedPlatform,
            accountId: accountMapping.late_account_id,
          }],
          publishNow: true,
        };

        console.log(`[late-scheduled-poster] Posting ${post.id} to Late for ${post.platform}...`);

        // Use idempotency key to prevent duplicates
        const idempotencyKey = `scheduled:${post.id}`;
        const { data: lateResponse, error: lateError } = await callLateAPI(
          '/posts',
          'POST',
          client.late_api_key,
          latePayload,
          idempotencyKey
        );

        if (lateError) {
          console.error(`[late-scheduled-poster] Failed to post ${post.id} to Late:`, lateError);
          
          await supabase
            .from('text_posts')
            .update({
              status: 'error',
            })
            .eq('id', post.id);
            
          results.push({ postId: post.id, success: false, error: lateError });
          failCount++;
          continue;
        }

        // Extract late_post_id from response correctly
        const latePostId = extractLatePostId(lateResponse);

        // Update post with success
        const { error: updateError } = await supabase
          .from('text_posts')
          .update({
            status: 'published',
            late_post_id: latePostId || null,
            published_at: new Date().toISOString(),
          })
          .eq('id', post.id);

        if (updateError) {
          console.error(`[late-scheduled-poster] Failed to update post ${post.id} after Late sync:`, updateError);
        }

        console.log(`[late-scheduled-poster] Successfully posted ${post.id} to Late (latePostId: ${latePostId})`);
        results.push({ postId: post.id, success: true });
        successCount++;

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[late-scheduled-poster] Error processing post ${post.id}:`, err);
        results.push({ postId: post.id, success: false, error: errorMessage });
        failCount++;
      }
    }

    console.log(`[late-scheduled-poster] Complete: ${successCount} success, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: duePosts.length,
        successCount,
        failCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[late-scheduled-poster] Unexpected error:', err);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
