import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shareId, postId, action, feedback, content } = await req.json();

    console.log("Received public text post action:", { shareId, postId, action, hasContent: !!content });

    // Validate required fields
    if (!shareId || !postId || !action) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: shareId, postId, action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate action type
    const validActions = ["approve", "request_changes", "reject"];
    if (!validActions.includes(action)) {
      return new Response(
        JSON.stringify({ error: "Invalid action. Must be: approve, request_changes, or reject" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Require feedback for request_changes and reject
    if ((action === "request_changes" || action === "reject") && !feedback) {
      return new Response(
        JSON.stringify({ error: "Feedback is required for this action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate the share link exists and is active
    const { data: shareLink, error: shareLinkError } = await supabase
      .from("calendar_share_links")
      .select("id, client_id, is_active, start_date, end_date")
      .eq("share_id", shareId)
      .single();

    if (shareLinkError || !shareLink) {
      console.error("Share link not found:", shareLinkError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired share link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!shareLink.is_active) {
      return new Response(
        JSON.stringify({ error: "This share link is no longer active" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the post belongs to the client and is within the date range
    const { data: post, error: postError } = await supabase
      .from("text_posts")
      .select("id, client_id, scheduled_date")
      .eq("id", postId)
      .single();

    if (postError || !post) {
      console.error("Post not found:", postError);
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (post.client_id !== shareLink.client_id) {
      return new Response(
        JSON.stringify({ error: "Post does not belong to this client" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map action to status
    const statusMap: Record<string, string> = {
      approve: "approved",
      request_changes: "changes_requested",
      reject: "rejected",
    };

    const newStatus = statusMap[action];

    // Build update payload
    const updatePayload: Record<string, any> = {
      status: newStatus,
      client_feedback: feedback || null,
      client_feedback_at: new Date().toISOString(),
      client_feedback_by: "client",
    };

    // Include content update if provided and valid
    if (content !== undefined && content !== null && typeof content === "string") {
      // Validate content length (max 5000 chars for safety)
      if (content.length > 5000) {
        return new Response(
          JSON.stringify({ error: "Content exceeds maximum length of 5000 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      updatePayload.content = content;
      console.log("Including content update, length:", content.length);
    }

    // Update the post
    const { error: updateError } = await supabase
      .from("text_posts")
      .update(updatePayload)
      .eq("id", postId);

    if (updateError) {
      console.error("Error updating post:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update post" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Post updated successfully:", { postId, newStatus });

    return new Response(
      JSON.stringify({ success: true, status: newStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
