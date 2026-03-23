import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-late-signature',
};

// Map Late status events to your content_status enum
const STATUS_MAP: Record<string, string> = {
  'post.published': 'live',
  'post.scheduled': 'approved',
  'post.failed': 'approved', // Keep as approved, but mark sync as error
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookSecret = Deno.env.get('LATE_WEBHOOK_SECRET');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the signature header for verification
    const signature = req.headers.get('x-late-signature');
    
    const body = await req.text();
    console.log('Received webhook:', body);

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      // Note: Implement actual signature verification based on Late's docs
      // This is a placeholder - adjust based on Late's signature scheme
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(webhookSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );
      
      const signatureBytes = hexToBytes(signature);
      const isValid = await crypto.subtle.verify(
        'HMAC',
        key,
        new Uint8Array(signatureBytes),
        encoder.encode(body)
      );
      
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }
    }

    const payload = JSON.parse(body);
    const { event, data } = payload;

    console.log(`Processing webhook event: ${event}`);

    if (!data?.postId) {
      console.log('No postId in webhook payload');
      return new Response(
        JSON.stringify({ received: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the content piece by Late post ID
    const { data: pieces, error: findError } = await supabase
      .from('content_pieces')
      .select('id, status, updated_at')
      .eq('late_post_id', data.postId);

    // Also check text_posts table
    const { data: textPosts, error: textPostError } = await supabase
      .from('text_posts')
      .select('id, status')
      .eq('late_post_id', data.postId);

    const piece = pieces?.[0];
    const textPost = textPosts?.[0];

    if (!piece && !textPost) {
      console.log(`No content piece or text post found for Late post ID: ${data.postId}`);
      return new Response(
        JSON.stringify({ received: true, message: 'Post not found in system' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (event) {
      case 'post.published':
        console.log('Post published, updating status');
        // Update content_pieces if found
        if (piece) {
          await supabase
            .from('content_pieces')
            .update({
              status: 'live',
              late_sync_status: 'synced',
              late_last_synced_at: new Date().toISOString(),
              late_error_message: null,
            })
            .eq('id', piece.id);
        }
        // Update text_posts if found
        if (textPost) {
          await supabase
            .from('text_posts')
            .update({
              status: 'published',
              published_at: new Date().toISOString(),
            })
            .eq('id', textPost.id);
        }
        break;

      case 'post.scheduled':
        console.log('Post scheduled in Late');
        if (piece) {
          await supabase
            .from('content_pieces')
            .update({
              late_sync_status: 'synced',
              late_last_synced_at: new Date().toISOString(),
              late_error_message: null,
            })
            .eq('id', piece.id);
        }
        break;

      case 'post.failed':
        console.log('Post failed to publish:', data.error);
        if (piece) {
          await supabase
            .from('content_pieces')
            .update({
              late_sync_status: 'error',
              late_error_message: data.error || 'Post failed to publish',
            })
            .eq('id', piece.id);
        }
        if (textPost) {
          await supabase
            .from('text_posts')
            .update({
              status: 'draft', // Mark as draft so user can retry
            })
            .eq('id', textPost.id);
        }
        break;

      case 'post.updated':
        // Only update content_pieces if Late's data is newer
        if (piece && data.updatedAt && new Date(data.updatedAt) > new Date(piece.updated_at)) {
          console.log('Late data is newer, updating local content');
          const updates: any = {
            late_last_synced_at: new Date().toISOString(),
          };
          
          // Update content if provided
          if (data.content) {
            // Try to extract caption and hashtags
            const hashtagMatch = data.content.match(/(#\w+\s*)+$/);
            if (hashtagMatch) {
              const captionEnd = data.content.indexOf(hashtagMatch[0]);
              updates.caption = data.content.substring(0, captionEnd).trim();
              updates.hashtags = hashtagMatch[0].match(/#\w+/g) || [];
            } else {
              updates.caption = data.content;
            }
          }
          
          // Update scheduled date if provided
          if (data.scheduledFor) {
            updates.scheduled_date = data.scheduledFor;
          }

          await supabase
            .from('content_pieces')
            .update(updates)
            .eq('id', piece.id);
        } else {
          console.log('Local data is newer or same, skipping update');
        }
        break;

      case 'post.deleted':
        console.log('Post deleted in Late, clearing sync data');
        if (piece) {
          await supabase
            .from('content_pieces')
            .update({
              late_post_id: null,
              late_sync_status: 'not_synced',
              late_error_message: null,
            })
            .eq('id', piece.id);
        }
        if (textPost) {
          await supabase
            .from('text_posts')
            .update({
              late_post_id: null,
            })
            .eq('id', textPost.id);
        }
        break;

      default:
        console.log(`Unhandled event type: ${event}`);
    }

    return new Response(
      JSON.stringify({ received: true, event }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Helper function to convert hex string to bytes
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}