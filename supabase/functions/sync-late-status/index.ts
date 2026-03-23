import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LatePost {
  _id?: string;
  id?: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed' | 'posted';
  publishedAt?: string;
  postedAt?: string;
  error?: string;
}

// Extract post ID from Late response - handles both _id and id patterns
function extractPostId(post: unknown): string | null {
  if (!post || typeof post !== 'object') return null;
  const p = post as Record<string, unknown>;
  
  // Late typically uses _id (MongoDB style)
  if (typeof p._id === 'string') return p._id;
  if (typeof p.id === 'string') return p.id;
  
  // Sometimes nested in a post object
  if (p.post && typeof p.post === 'object') {
    const nested = p.post as Record<string, unknown>;
    if (typeof nested._id === 'string') return nested._id;
    if (typeof nested.id === 'string') return nested.id;
  }
  
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

    const { clientId } = await req.json().catch(() => ({}));

    console.log('[sync-late-status] Starting status sync...', { clientId });

    // Get clients with Late API keys
    let clientsQuery = supabase
      .from('clients')
      .select('id, late_api_key, business_name')
      .not('late_api_key', 'is', null);

    if (clientId) {
      clientsQuery = clientsQuery.eq('id', clientId);
    }

    const { data: clients, error: clientsError } = await clientsQuery;

    if (clientsError) {
      console.error('[sync-late-status] Error fetching clients:', clientsError);
      throw clientsError;
    }

    if (!clients || clients.length === 0) {
      console.log('[sync-late-status] No clients with Late API keys found');
      return new Response(
        JSON.stringify({ success: true, message: 'No clients with Late API keys', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalUpdated = 0;

    for (const client of clients) {
      console.log(`[sync-late-status] Processing client: ${client.business_name}`);

      try {
        // Fetch published posts from Late
        const lateResponse = await fetch('https://getlate.dev/api/v1/posts?status=published&limit=100', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${client.late_api_key}`,
            'Content-Type': 'application/json',
          },
        });

        if (!lateResponse.ok) {
          console.error(`[sync-late-status] Late API error for ${client.business_name}:`, lateResponse.status);
          continue;
        }

        const lateData = await lateResponse.json();
        const latePosts: unknown[] = lateData.posts || lateData.data || lateData || [];

        console.log(`[sync-late-status] Found ${latePosts.length} published posts in Late for ${client.business_name}`);

        // Extract post IDs using the robust extractor
        const latePostIds = latePosts
          .map(p => extractPostId(p))
          .filter((id): id is string => id !== null);

        console.log(`[sync-late-status] Extracted ${latePostIds.length} valid post IDs`);
        
        // Log first few IDs for debugging
        if (latePostIds.length > 0) {
          console.log(`[sync-late-status] Sample IDs: ${latePostIds.slice(0, 3).join(', ')}`);
        }

        if (latePostIds.length > 0) {
          // Update text_posts that are still "approved" but published in Late
          const { data: updatedTextPosts, error: textPostError } = await supabase
            .from('text_posts')
            .update({
              status: 'published',
              published_at: new Date().toISOString(),
            })
            .eq('client_id', client.id)
            .in('late_post_id', latePostIds)
            .neq('status', 'published')
            .select('id');

          if (textPostError) {
            console.error('[sync-late-status] Error updating text_posts:', textPostError);
          } else {
            console.log(`[sync-late-status] Updated ${updatedTextPosts?.length || 0} text posts to published`);
            totalUpdated += updatedTextPosts?.length || 0;
          }

          // Update content_pieces that are still "approved" but published in Late
          const { data: updatedContentPieces, error: contentError } = await supabase
            .from('content_pieces')
            .update({
              status: 'live',
              late_sync_status: 'synced',
              late_last_synced_at: new Date().toISOString(),
            })
            .in('late_post_id', latePostIds)
            .neq('status', 'live')
            .select('id');

          if (contentError) {
            console.error('[sync-late-status] Error updating content_pieces:', contentError);
          } else {
            console.log(`[sync-late-status] Updated ${updatedContentPieces?.length || 0} content pieces to live`);
            totalUpdated += updatedContentPieces?.length || 0;
          }
        }

        // ===== PHASE 2: Direct check for posts with past scheduled dates =====
        // Find text_posts that should have been published (scheduled_date in past) but are still approved
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        
        const { data: candidateTextPosts, error: candidateError } = await supabase
          .from('text_posts')
          .select('id, late_post_id')
          .eq('client_id', client.id)
          .not('late_post_id', 'is', null)
          .lt('scheduled_date', tenMinutesAgo)
          .in('status', ['approved', 'scheduled']);

        if (candidateError) {
          console.error('[sync-late-status] Error fetching candidate text_posts:', candidateError);
        } else if (candidateTextPosts && candidateTextPosts.length > 0) {
          console.log(`[sync-late-status] Found ${candidateTextPosts.length} candidate text posts to check individually`);
          
          // Check each candidate post status directly from Late
          for (const candidate of candidateTextPosts) {
            try {
              const postResponse = await fetch(`https://getlate.dev/api/v1/posts/${candidate.late_post_id}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${client.late_api_key}`,
                  'Content-Type': 'application/json',
                },
              });

              if (postResponse.ok) {
                const postData = await postResponse.json();
                const post = postData.post || postData;
                const status = post.status || post.state;
                
                console.log(`[sync-late-status] Post ${candidate.late_post_id} status in Late: ${status}`);
                
                // Check if published/posted (Late might use different status names)
                if (['published', 'posted', 'completed', 'sent'].includes(status?.toLowerCase())) {
                  const { error: updateError } = await supabase
                    .from('text_posts')
                    .update({
                      status: 'published',
                      published_at: post.publishedAt || post.postedAt || new Date().toISOString(),
                    })
                    .eq('id', candidate.id);

                  if (!updateError) {
                    console.log(`[sync-late-status] Updated text post ${candidate.id} to published via direct check`);
                    totalUpdated++;
                  }
                } else if (['failed', 'error'].includes(status?.toLowerCase())) {
                  await supabase
                    .from('text_posts')
                    .update({ status: 'draft' })
                    .eq('id', candidate.id);
                  console.log(`[sync-late-status] Marked text post ${candidate.id} as draft (failed in Late)`);
                }
              }
            } catch (postCheckError) {
              console.error(`[sync-late-status] Error checking individual post ${candidate.late_post_id}:`, postCheckError);
            }
          }
        }

        // Similar direct check for content_pieces
        const { data: candidateContentPieces, error: candidateCPError } = await supabase
          .from('content_pieces')
          .select('id, late_post_id, content_plan_id')
          .not('late_post_id', 'is', null)
          .lt('scheduled_date', tenMinutesAgo)
          .in('status', ['approved', 'scheduled']);

        if (!candidateCPError && candidateContentPieces && candidateContentPieces.length > 0) {
          console.log(`[sync-late-status] Found ${candidateContentPieces.length} candidate content pieces to check`);
          
          for (const candidate of candidateContentPieces) {
            try {
              const postResponse = await fetch(`https://getlate.dev/api/v1/posts/${candidate.late_post_id}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${client.late_api_key}`,
                  'Content-Type': 'application/json',
                },
              });

              if (postResponse.ok) {
                const postData = await postResponse.json();
                const post = postData.post || postData;
                const status = post.status || post.state;
                
                if (['published', 'posted', 'completed', 'sent'].includes(status?.toLowerCase())) {
                  const { error: updateError } = await supabase
                    .from('content_pieces')
                    .update({
                      status: 'live',
                      late_sync_status: 'synced',
                      late_last_synced_at: new Date().toISOString(),
                    })
                    .eq('id', candidate.id);

                  if (!updateError) {
                    console.log(`[sync-late-status] Updated content piece ${candidate.id} to live via direct check`);
                    totalUpdated++;
                  }
                }
              }
            } catch (postCheckError) {
              console.error(`[sync-late-status] Error checking content piece ${candidate.late_post_id}:`, postCheckError);
            }
          }
        }

        // Also fetch failed posts and update their status
        const failedResponse = await fetch('https://getlate.dev/api/v1/posts?status=failed&limit=100', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${client.late_api_key}`,
            'Content-Type': 'application/json',
          },
        });

        if (failedResponse.ok) {
          const failedData = await failedResponse.json();
          const failedPosts: unknown[] = failedData.posts || failedData.data || failedData || [];

          if (failedPosts.length > 0) {
            const failedPostIds = failedPosts
              .map(p => extractPostId(p))
              .filter((id): id is string => id !== null);

            if (failedPostIds.length > 0) {
              // Update content_pieces to error status
              await supabase
                .from('content_pieces')
                .update({
                  late_sync_status: 'error',
                  late_error_message: 'Post failed to publish on Late',
                })
                .in('late_post_id', failedPostIds);

              // Update text_posts to draft status
              await supabase
                .from('text_posts')
                .update({ status: 'draft' })
                .in('late_post_id', failedPostIds);

              console.log(`[sync-late-status] Marked ${failedPostIds.length} posts as failed`);
            }
          }
        }

      } catch (clientError) {
        console.error(`[sync-late-status] Error processing client ${client.business_name}:`, clientError);
        continue;
      }
    }

    console.log(`[sync-late-status] Completed. Total updated: ${totalUpdated}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: totalUpdated,
        message: `Updated ${totalUpdated} posts to published status`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[sync-late-status] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
