import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContentPiece {
  id: string;
  concept: string;
  status: string;
  content_type: string;
  platform: string;
  hook: string | null;
  script: string | null;
  caption: string | null;
  hashtags: string[] | null;
  cta: string | null;
  asset_url: string | null;
  scheduled_date: string | null;
  target_duration: number | null;
  shot_notes: string | null;
  talent_notes: string | null;
  b_roll_needed: string[] | null;
  edit_notes: string | null;
}

interface TextPost {
  id: string;
  content: string;
  platform: string;
  status: string;
  scheduled_date: string | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shareId } = await req.json();

    if (!shareId) {
      return new Response(
        JSON.stringify({ error: "Missing shareId parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[public-calendar-data] Fetching data for shareId: ${shareId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Fetch share link (single query with all needed data)
    const { data: shareLink, error: shareLinkError } = await supabase
      .from("calendar_share_links")
      .select("id, client_id, start_date, end_date, is_active")
      .eq("share_id", shareId)
      .eq("is_active", true)
      .maybeSingle();

    if (shareLinkError) {
      console.error("[public-calendar-data] Share link error:", shareLinkError);
      throw shareLinkError;
    }

    if (!shareLink) {
      return new Response(
        JSON.stringify({ error: "Share link not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[public-calendar-data] Share link found for client: ${shareLink.client_id}`);

    // Step 2: Parallel fetch - client info, content plans, and text posts
    const [clientResult, contentPlansResult, textPostsResult] = await Promise.all([
      // Fetch client info (public safe view)
      supabase
        .from("clients_public_safe")
        .select("business_name, brand_logo_url, brand_primary_color")
        .eq("id", shareLink.client_id)
        .maybeSingle(),

      // Fetch content plan IDs for the client
      supabase
        .from("content_plans")
        .select("id")
        .eq("client_id", shareLink.client_id),

      // Fetch text posts within date range (server-side filtering)
      supabase
        .from("text_posts")
        .select("id, content, platform, status, scheduled_date")
        .eq("client_id", shareLink.client_id)
        .in("status", ["scheduled", "pending_review", "approved", "published"])
        .gte("scheduled_date", shareLink.start_date)
        .lte("scheduled_date", shareLink.end_date)
        .not("scheduled_date", "is", null),
    ]);

    if (clientResult.error) {
      console.error("[public-calendar-data] Client fetch error:", clientResult.error);
    }

    if (contentPlansResult.error) {
      console.error("[public-calendar-data] Content plans fetch error:", contentPlansResult.error);
      throw contentPlansResult.error;
    }

    if (textPostsResult.error) {
      console.error("[public-calendar-data] Text posts fetch error:", textPostsResult.error);
      throw textPostsResult.error;
    }

    const client = clientResult.data;
    const contentPlanIds = (contentPlansResult.data || []).map((p) => p.id);
    const textPosts: TextPost[] = textPostsResult.data || [];

    console.log(`[public-calendar-data] Found ${contentPlanIds.length} content plans, ${textPosts.length} text posts`);

    // Step 3: Fetch content pieces for those plans (with date range filter)
    let contentPieces: ContentPiece[] = [];

    if (contentPlanIds.length > 0) {
      const { data: piecesData, error: piecesError } = await supabase
        .from("content_pieces")
        .select(`
          id,
          concept,
          status,
          content_type,
          platform,
          hook,
          script,
          caption,
          hashtags,
          cta,
          asset_url,
          scheduled_date,
          target_duration,
          shot_notes,
          talent_notes,
          b_roll_needed,
          edit_notes
        `)
        .in("content_plan_id", contentPlanIds)
        .gte("scheduled_date", shareLink.start_date)
        .lte("scheduled_date", shareLink.end_date)
        .not("scheduled_date", "is", null);

      if (piecesError) {
        console.error("[public-calendar-data] Content pieces fetch error:", piecesError);
        throw piecesError;
      }

      contentPieces = piecesData || [];
    }

    console.log(`[public-calendar-data] Found ${contentPieces.length} content pieces`);

    // Return combined response
    const response = {
      shareLink: {
        start_date: shareLink.start_date,
        end_date: shareLink.end_date,
        client_id: shareLink.client_id,
      },
      client: client || {
        business_name: null,
        brand_logo_url: null,
        brand_primary_color: null,
      },
      contentPieces,
      textPosts,
    };

    console.log(`[public-calendar-data] Returning combined data successfully`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("[public-calendar-data] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
