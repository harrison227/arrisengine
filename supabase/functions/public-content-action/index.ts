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
    const { shareId, pieceId, action, feedback, caption, hashtags } = await req.json();

    console.log("Received public content action:", { shareId, pieceId, action, hasCaption: !!caption });

    // Validate required fields
    if (!shareId || !pieceId || !action) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: shareId, pieceId, action" }),
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

    // Verify the content piece belongs to the client via content_plans
    // Also fetch scheduled_date and late_post_id for sync decision
    const { data: piece, error: pieceError } = await supabase
      .from("content_pieces")
      .select(`
        id,
        content_plan_id,
        edit_notes,
        scheduled_date,
        late_post_id,
        content_plans!inner(client_id)
      `)
      .eq("id", pieceId)
      .single();

    if (pieceError || !piece) {
      console.error("Content piece not found:", pieceError);
      return new Response(
        JSON.stringify({ error: "Content piece not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pieceClientId = (piece.content_plans as any).client_id;
    if (pieceClientId !== shareLink.client_id) {
      return new Response(
        JSON.stringify({ error: "Content piece does not belong to this client" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map action to status
    const statusMap: Record<string, string> = {
      approve: "approved",
      request_changes: "pending_review", // Keep in review state but with feedback
      reject: "idea", // Reset to draft/idea state
    };

    const newStatus = statusMap[action];

    // Build update payload
    const existingNotes = (piece as any).edit_notes || '';
    const updatePayload: Record<string, any> = {
      status: newStatus,
      edit_notes: feedback 
        ? `[Client Feedback - ${new Date().toLocaleString()}]: ${feedback}${existingNotes ? `\n\n${existingNotes}` : ''}`
        : undefined,
    };

    // Remove undefined fields
    if (!updatePayload.edit_notes) delete updatePayload.edit_notes;

    // Include caption update if provided and valid
    if (caption !== undefined && caption !== null && typeof caption === "string") {
      // Validate caption length (max 5000 chars for safety)
      if (caption.length > 5000) {
        return new Response(
          JSON.stringify({ error: "Caption exceeds maximum length of 5000 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      updatePayload.caption = caption;
      console.log("Including caption update, length:", caption.length);
    }

    // Include hashtags update if provided
    if (hashtags !== undefined && Array.isArray(hashtags)) {
      updatePayload.hashtags = hashtags;
      console.log("Including hashtags update, count:", hashtags.length);
    }

    // Update the content piece
    const { error: updateError } = await supabase
      .from("content_pieces")
      .update(updatePayload)
      .eq("id", pieceId);

    if (updateError) {
      console.error("Error updating content piece:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update content piece" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Content piece updated successfully:", { pieceId, newStatus });

    // If approved and has scheduled_date, trigger Late sync
    if (action === "approve" && piece.scheduled_date) {
      console.log("Triggering Late sync for approved content piece:", pieceId);
      
      // Determine sync action: update if already synced, create if new
      const syncAction = piece.late_post_id ? "update" : "create";
      
      try {
        const { data: syncResult, error: syncError } = await supabase.functions.invoke("sync-to-late", {
          body: { contentPieceId: pieceId, action: syncAction },
        });
        
        if (syncError) {
          console.error("Late sync error (non-blocking):", syncError);
        } else {
          console.log("Late sync result:", syncResult);
        }
      } catch (syncErr) {
        // Non-blocking - log but don't fail the approval
        console.error("Late sync exception (non-blocking):", syncErr);
      }
    }

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
