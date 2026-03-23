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

const CREATE_LOCK_PREFIX = '__creating__:';
const CREATE_LOCK_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

function isCreateLock(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(CREATE_LOCK_PREFIX);
}

function createLockValue(): string {
  return `${CREATE_LOCK_PREFIX}${Date.now()}:${crypto.randomUUID()}`;
}

function isStaleCreateLock(lockValue: string): boolean {
  const parts = lockValue.split(':');
  const ts = parts.length >= 2 ? Number(parts[1]) : NaN;
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts > CREATE_LOCK_MAX_AGE_MS;
}

interface SyncRequest {
  textPostId: string;
  action: 'create' | 'update' | 'delete';
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
      console.log(`Late API ${method} ${endpoint}`, body ? JSON.stringify(body, null, 2) : '');
      
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      
      // Add idempotency key if provided (helps prevent duplicates on network retries)
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
        
        // Don't retry on 4xx client errors
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
      
      // For POST, don't retry on network errors - might have succeeded server-side
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

    const { textPostId, action }: SyncRequest = body;

    if (!textPostId || !isValidUUID(textPostId)) {
      return new Response(
        JSON.stringify({ success: false, error: 'textPostId is required and must be a valid UUID' }),
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

    console.log(`Sync text post request: ${action} for ${textPostId}`);

    // Get the text post with client info
    const { data: textPost, error: postError } = await supabase
      .from('text_posts')
      .select(`
        *,
        clients (
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

    console.log('Text post found:', textPost.id, 'status:', textPost.status, 'platform:', textPost.platform);

    // Status mapping:
    // - 'pending_review' (For Review) → syncs as Draft on Late (no scheduledFor)
    // - 'scheduled' or 'approved' → syncs as Scheduled on Late (with scheduledFor)
    // - 'published' → already posted, skip
    const SYNCABLE_STATUSES = ['pending_review', 'scheduled', 'approved', 'published'];
    
    // Determine if this should be a draft or scheduled post on Late
    const shouldSyncAsDraft = textPost.status === 'pending_review';
    const shouldSyncAsScheduled = ['scheduled', 'approved'].includes(textPost.status);
    
    if (action !== 'delete') {
      if (!SYNCABLE_STATUSES.includes(textPost.status)) {
        console.log(`Skipping sync - text post status '${textPost.status}' not syncable`);
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: `Post status '${textPost.status}' not ready for Late sync. Mark as 'For Review' or 'Scheduled' first.` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // 'published' means already posted - don't re-sync
      if (textPost.status === 'published') {
        console.log('Post already published, skipping Late sync');
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'Post already published' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // For scheduled posts, require a future scheduled date
      if (shouldSyncAsScheduled) {
        if (!textPost.scheduled_date) {
          console.log('Skipping sync - scheduled/approved status needs scheduled date');
          return new Response(
            JSON.stringify({ success: true, skipped: true, reason: 'Scheduled/approved posts need a scheduled date' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // GUARD: Scheduled date must be in the future
        const scheduledTime = new Date(textPost.scheduled_date).getTime();
        const minFutureTime = Date.now() + MIN_FUTURE_MINUTES * 60 * 1000;
        
        if (scheduledTime < minFutureTime) {
          console.log(`Skipping sync - scheduled date is in the past or too soon: ${textPost.scheduled_date}`);
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
      // For draft posts (pending_review status), no scheduled date required
    }

    const client = textPost.clients;
    const apiKey = client?.late_api_key || Deno.env.get('LATE_API_KEY');

    if (!apiKey) {
      console.log('No Late API key configured, skipping sync');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'No Late API key configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle delete action
    if (action === 'delete') {
      if (!textPost.late_post_id) {
        console.log('No late_post_id, nothing to delete');
        return new Response(
          JSON.stringify({ success: true, message: 'Nothing to delete' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await callLateAPI(`/posts/${textPost.late_post_id}`, 'DELETE', apiKey);
      
      if (error) {
        // If Late says the post doesn't exist or can't be deleted, clear our reference anyway
        if (error.includes('404') || error.includes('not found') || error.includes('cannot be deleted')) {
          console.log('Post not found or cannot be deleted in Late, clearing reference');
          await supabase
            .from('text_posts')
            .update({ late_post_id: null })
            .eq('id', textPostId);
          return new Response(
            JSON.stringify({ success: true, message: 'Reference cleared' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.error('Failed to delete from Late:', error);
        return new Response(
          JSON.stringify({ success: false, error }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Clear the late_post_id
      await supabase
        .from('text_posts')
        .update({ late_post_id: null })
        .eq('id', textPostId);

      console.log('Successfully deleted from Late');
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      console.log(`No Late account mapping found for platform: ${platform}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true,
          reason: `No Late account configured for ${platform}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Using account mapping:', accountMapping);

    // Build the Late post payload
    const latePayload: Record<string, unknown> = {
      content: textPost.content,
      platforms: [{
        platform: mappedPlatform,
        accountId: accountMapping.late_account_id,
      }],
    };
    
    // Explicitly control draft status on Late
    // - For Review (pending_review) -> isDraft: true (creates/keeps as draft)
    // - Approved/Scheduled -> isDraft: false (creates/updates as scheduled)
    if (shouldSyncAsDraft) {
      latePayload.isDraft = true;
      // No scheduledFor for drafts
    } else if (shouldSyncAsScheduled && textPost.scheduled_date) {
      latePayload.isDraft = false;  // KEY: explicitly set to false to convert draft to scheduled
      latePayload.scheduledFor = new Date(textPost.scheduled_date).toISOString();
    }
    
    console.log(`Syncing as ${shouldSyncAsDraft ? 'DRAFT' : 'SCHEDULED'} to Late`);
    console.log('Late payload:', JSON.stringify(latePayload, null, 2));

    let result: { data?: unknown; error?: string } | null = null;
    let lockValue: string | null = null;

    // Protect against concurrent syncs that can double-create posts.
    let effectiveLatePostId: string | null = textPost.late_post_id;
    if (effectiveLatePostId && isCreateLock(effectiveLatePostId)) {
      if (isStaleCreateLock(effectiveLatePostId)) {
        console.log('Found stale create lock, clearing and retrying...');
        await supabase
          .from('text_posts')
          .update({ late_post_id: null })
          .eq('id', textPostId)
          .eq('late_post_id', effectiveLatePostId);
        effectiveLatePostId = null;
      } else {
        console.log('Sync already in progress, skipping.');
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'Sync already in progress' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const isLateNotFoundError = (err: string) =>
      /Late API error:\s*404\b/.test(err) || err.includes('"Post not found"') || err.includes('Post not found');

    const isLateNotEditableError = (err: string) =>
      err.includes('Only draft, scheduled, failed, and partial posts can be edited');

    // ALWAYS use DB state (not the requested action) to decide create vs update.
    if (effectiveLatePostId) {
      console.log(`Updating existing Late post: ${effectiveLatePostId}`);
      // Late API uses PUT for updates
      result = await callLateAPI(`/posts/${effectiveLatePostId}`, 'PUT', apiKey, latePayload);

      // Late will reject updates to already-published posts. Treat as non-fatal.
      if (result.error && isLateNotEditableError(result.error)) {
        console.log('Late post exists but is not editable; skipping sync.');
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: 'Late post is not editable (likely already published).',
            latePostId: effectiveLatePostId,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If post not found (404), clear the stale ID and recreate.
      if (result.error && isLateNotFoundError(result.error)) {
        console.log('Post not found in Late; clearing stored id and recreating.');
        await supabase
          .from('text_posts')
          .update({ late_post_id: null })
          .eq('id', textPostId)
          .eq('late_post_id', effectiveLatePostId);
        effectiveLatePostId = null;
        result = null;
      }
    }

    if (!effectiveLatePostId) {
      // Acquire a short-lived lock so only ONE request can create.
      lockValue = createLockValue();
      const { data: lockRows, error: lockError } = await supabase
        .from('text_posts')
        .update({ late_post_id: lockValue })
        .eq('id', textPostId)
        .is('late_post_id', null)
        .select('id');

      if (lockError) {
        console.error('Failed to acquire create lock:', lockError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to acquire sync lock' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      if (!lockRows || lockRows.length === 0) {
        // Someone else created/locked it between our read and lock attempt.
        const { data: latest } = await supabase
          .from('text_posts')
          .select('late_post_id')
          .eq('id', textPostId)
          .single();

        const latestId: string | null = (latest as { late_post_id?: string })?.late_post_id ?? null;
        if (latestId && !isCreateLock(latestId)) {
          console.log('Post already created by another request.');
          return new Response(
            JSON.stringify({ success: true, latePostId: latestId }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Sync already in progress (lock present), skipping.');
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'Sync already in progress' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Creating new Late post');
      // Use idempotency key to prevent duplicates on network retry
      const idempotencyKey = `text_post:${textPostId}`;
      result = await callLateAPI('/posts', 'POST', apiKey, latePayload, idempotencyKey);
    }

    if (!result) {
      return new Response(
        JSON.stringify({ success: false, error: 'No API call was made' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (result.error) {
      console.error('Late API sync failed:', result.error);

      // If we were in "create" mode, clear the lock so the user can retry.
      if (lockValue) {
        await supabase
          .from('text_posts')
          .update({ late_post_id: null })
          .eq('id', textPostId)
          .eq('late_post_id', lockValue);
      }

      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Extract late_post_id from response
    const latePostId = extractLatePostId(result.data) || effectiveLatePostId;

    if (!latePostId) {
      console.error('Unable to determine Late post id from response:', JSON.stringify(result.data));

      // If we were in "create" mode, clear the lock so the user can retry.
      if (lockValue) {
        await supabase
          .from('text_posts')
          .update({ late_post_id: null })
          .eq('id', textPostId)
          .eq('late_post_id', lockValue);
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Could not determine Late post id from Late response' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const baseUpdate = supabase
      .from('text_posts')
      .update({ late_post_id: latePostId })
      .eq('id', textPostId)
      .select('id');

    // If we acquired a lock, prefer updating only if the lock is still present.
    let updateResult = lockValue
      ? await baseUpdate.eq('late_post_id', lockValue)
      : await baseUpdate;

    // If the lock was lost between calls, fall back to a plain update.
    if (lockValue && (!updateResult.data || updateResult.data.length === 0) && !updateResult.error) {
      console.warn('Lock was not present during persist step; falling back to plain update.');
      updateResult = await supabase
        .from('text_posts')
        .update({ late_post_id: latePostId })
        .eq('id', textPostId)
        .select('id');
    }

    if (updateResult.error) {
      console.error('Failed to persist late_post_id:', updateResult.error);

      // Clear lock if we still own it, so the user can retry.
      if (lockValue) {
        await supabase
          .from('text_posts')
          .update({ late_post_id: null })
          .eq('id', textPostId)
          .eq('late_post_id', lockValue);
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save Late post id' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

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
