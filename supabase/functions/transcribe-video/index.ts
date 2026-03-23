import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { audioBase64, mimeType, videoUrl } = body;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Transcription service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let audioBlob: Blob;
    let extension = "webm";

    // Handle base64 audio from client-side extraction
    if (audioBase64) {
      console.log("Processing base64 audio, mimeType:", mimeType);
      
      // Convert base64 to blob
      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      audioBlob = new Blob([bytes], { type: mimeType || "audio/webm" });
      
      // Determine extension from mime type - be thorough
      if (mimeType?.includes("wav") || mimeType?.includes("wave")) {
        extension = "wav";
      } else if (mimeType?.includes("webm")) {
        extension = "webm";
      } else if (mimeType?.includes("mp3") || mimeType?.includes("mpeg")) {
        extension = "mp3";
      } else if (mimeType?.includes("ogg")) {
        extension = "ogg";
      } else if (mimeType?.includes("m4a") || mimeType?.includes("mp4")) {
        extension = "m4a";
      }
      
      const sizeMB = (audioBlob.size / 1024 / 1024).toFixed(2);
      console.log(`Audio blob size: ${audioBlob.size} bytes (${sizeMB}MB), extension: ${extension}`);
    }
    // Legacy: Handle video URL (fallback for older requests)
    else if (videoUrl) {
      console.log("Fetching video from URL:", videoUrl);
      
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        console.error("Failed to fetch video:", videoResponse.status);
        return new Response(
          JSON.stringify({ error: "Failed to fetch video file" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      audioBlob = await videoResponse.blob();
      const contentType = videoResponse.headers.get("content-type") || "video/mp4";
      
      // Get file extension from URL or content type
      const urlPath = new URL(videoUrl).pathname;
      const urlExt = urlPath.split('.').pop()?.toLowerCase();
      if (urlExt && ['mp4', 'mov', 'webm', 'avi', 'm4a', 'mp3', 'wav'].includes(urlExt)) {
        extension = urlExt;
      }
      
      console.log("Video size:", audioBlob.size, "bytes, type:", contentType);
    }
    else {
      return new Response(
        JSON.stringify({ error: "Either audioBase64 or videoUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check file size (Whisper API limit is 25MB)
    if (audioBlob.size > 25 * 1024 * 1024) {
      console.log("Audio too large for Whisper API, returning empty transcript");
      return new Response(
        JSON.stringify({ 
          transcript: "", 
          warning: "Audio exceeds 25MB limit for transcription. Caption will need to be written manually." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create form data for Whisper API
    const formData = new FormData();
    formData.append("file", audioBlob, `audio.${extension}`);
    formData.append("model", "whisper-1");
    formData.append("response_format", "text");

    console.log("Sending to Whisper API, file size:", audioBlob.size);

    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error("Whisper API error:", whisperResponse.status, errorText);
      
      if (whisperResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Transcription failed", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transcript = await whisperResponse.text();
    console.log("Transcription successful, length:", transcript.length);

    return new Response(
      JSON.stringify({ transcript: transcript.trim() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
