import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { uploadToR2 } from "../_shared/cloudinary-upload.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiter (per-function instance)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 15; // 15 image generations per minute per client

function checkRateLimit(clientId: string): { allowed: boolean; waitTime: number } {
  const now = Date.now();
  const timestamps = rateLimitMap.get(clientId) || [];
  
  // Remove timestamps outside the window
  const validTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (validTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldestTimestamp = validTimestamps[0];
    const waitTime = Math.ceil((oldestTimestamp + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, waitTime };
  }
  
  // Record this request
  validTimestamps.push(now);
  rateLimitMap.set(clientId, validTimestamps);
  
  return { allowed: true, waitTime: 0 };
}

// Helper function to convert base64 or URL image to Blob
async function fetchImageAsBlob(imageSource: string): Promise<Blob> {
  if (imageSource.startsWith('data:')) {
    const base64Data = imageSource.split(',')[1];
    const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    return new Blob([bytes], { type: 'image/png' });
  } else {
    const response = await fetch(imageSource);
    return await response.blob();
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchItemId, clientId, concept, templateType, feedback, promptAdditions, referenceImageUrl, referenceImages, brandLogoUrl, logoPlacement, model, savedReferenceImageIds, isRegeneration } = await req.json();
    
    // Debug logging for feedback
    console.log('=== REGENERATION DEBUG ===');
    console.log('batchItemId:', batchItemId);
    console.log('feedback received:', feedback || '(none)');
    console.log('isRegeneration:', isRegeneration);
    console.log('model:', model);
    console.log('=== END REGENERATION DEBUG ===');
    
    // Check rate limit before processing
    if (clientId) {
      const rateLimitCheck = checkRateLimit(clientId);
      if (!rateLimitCheck.allowed) {
        console.log(`Rate limit exceeded for client ${clientId}. Wait ${rateLimitCheck.waitTime}s`);
        return new Response(
          JSON.stringify({ 
            error: `Rate limit exceeded. Please wait ${rateLimitCheck.waitTime} seconds before generating more images.`,
            rateLimited: true,
            waitTime: rateLimitCheck.waitTime
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('GOOGLE_AI_API_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const ideogramApiKey = Deno.env.get('IDEOGRAM_API_KEY');
    const googleApiKey = Deno.env.get('GOOGLE_AI_API_KEY');

    if (!lovableApiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not configured');
    }

    // Validate API keys for specific models
    const selectedModel = model || 'nano-banana';
    if ((selectedModel === 'dalle3' || selectedModel === 'gpt-image-1.5') && !openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured for OpenAI models');
    }
    if (selectedModel === 'ideogram' && !ideogramApiKey) {
      throw new Error('IDEOGRAM_API_KEY is not configured for Ideogram');
    }
    if (selectedModel === 'nano-banana-2' && !googleApiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not configured for Nano Banana 2');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch client info for branding context
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (!client) {
      throw new Error('Client not found');
    }

    // Collect all reference images
    let allReferenceImages: string[] = [];
    
    // Add passed referenceImages array
    if (referenceImages && Array.isArray(referenceImages)) {
      allReferenceImages = [...referenceImages];
    }
    
    // Add single referenceImageUrl if provided (legacy support)
    if (referenceImageUrl) {
      allReferenceImages.push(referenceImageUrl);
    }
    
    // Fetch saved reference images if IDs provided
    if (savedReferenceImageIds && savedReferenceImageIds.length > 0) {
      const { data: savedImages } = await supabase
        .from('client_reference_images')
        .select('thumbnail_url')
        .in('id', savedReferenceImageIds);
      
      if (savedImages) {
        const savedUrls = savedImages
          .map(img => img.thumbnail_url)
          .filter(Boolean) as string[];
        allReferenceImages = [...savedUrls, ...allReferenceImages];
      }
    }

    console.log('=== REFERENCE IMAGES DEBUG ===');
    console.log('Total reference images count:', allReferenceImages.length);
    console.log('Reference image sources:');
    console.log('  - From referenceImages array:', referenceImages?.length || 0);
    console.log('  - From referenceImageUrl (legacy):', referenceImageUrl ? 1 : 0);
    console.log('  - From savedReferenceImageIds:', savedReferenceImageIds?.length || 0);
    if (allReferenceImages.length > 0) {
      console.log('Reference image URLs (truncated):');
      allReferenceImages.forEach((url, i) => {
        console.log(`  [${i + 1}]: ${url.substring(0, 80)}...`);
      });
    }
    console.log('=== END REFERENCE IMAGES DEBUG ===');

    // Helper function for logo placement instructions
    function getLogoPlacementInstructions(placement?: string): string {
      switch (placement) {
        case 'corner':
          return 'Place the logo as a small watermark in the bottom-right or bottom-left corner. It should be visible but not dominate the design.';
        case 'featured':
          return 'Feature the logo prominently in the design - larger size, in the header area or as a central design element. The logo should be a key focal point.';
        case 'badge':
          return 'Place the logo as a subtle badge - small, contained area, possibly with a background shape. Professional and unobtrusive.';
        case 'auto':
        default:
          return 'Use your professional judgment to place the logo where it looks most balanced and professional for this type of content. Ensure it is clearly visible.';
      }
    }

    // Update batch item status to generating
    if (batchItemId) {
      await supabase
        .from('image_batch_items')
        .update({ status: 'generating' })
        .eq('id', batchItemId);
    }

    // Parse enhanced concept data if it's JSON
    let conceptData: any = { description: concept };
    try {
      const parsed = JSON.parse(concept);
      if (parsed.description) {
        conceptData = parsed;
      }
    } catch {
      conceptData = { description: concept };
    }

    // Check if we have real brand colors (not defaults)
    const hasBrandColors = client.brand_primary_color && client.brand_primary_color !== '#3B82F6';
    const hasReferenceImages = allReferenceImages.length > 0;

    // Professional design system rules
    const designSystemPrompt = `You are a senior designer at a premium creative agency. Every graphic must look like it cost $500+ to produce.

LAYOUT RULES:
- Generous whitespace (minimum 15% padding on all sides)
- Rule of thirds for composition
- Clear visual hierarchy: one dominant element, supporting elements secondary
- Align all elements to an invisible grid

TYPOGRAPHY RULES:
- Headlines: Bold, high contrast, maximum 8 words
- Body text: 16-24pt equivalent, highly readable
- Maximum 2 font weights
- Slightly expanded letter spacing for headlines

COLOR APPLICATION:
- 60-30-10 rule (60% dominant, 30% secondary, 10% accent)
- 4.5:1 contrast ratio for text
- Apply colors intentionally, not randomly

QUALITY MARKERS:
- Crisp, pixel-perfect edges
- Professional photo integration (no stock photo look)
- Sophisticated color grading
- Subtle gradients or shadows for depth`;

    // Reference-first approach
    const referenceDirective = hasReferenceImages ? `
CRITICAL - STYLE REFERENCE IMAGES PROVIDED:
You MUST replicate the exact visual style from the reference images:
- Copy the color palette exactly as shown
- Match the typography style, weight, and hierarchy
- Replicate the layout composition and spacing
- Use the same graphic elements and design patterns
- Match the level of minimalism or complexity
- Copy the photo treatment, filters, or illustration style
The reference images define what "on-brand" means.` : '';

    // Industry-specific style hints
    const industryStyles: Record<string, string> = {
      'Education': 'Clean, trustworthy, warm colors, approachable typography',
      'Technology': 'Modern, minimal, geometric shapes, cool tones',
      'Health & Wellness': 'Calming, natural colors, organic shapes, breathing room',
      'Finance': 'Professional, navy/gold, conservative typography, authoritative',
      'Real Estate': 'Luxurious, elegant, high contrast, aspirational imagery',
      'Retail': 'Vibrant, energetic, bold typography, lifestyle focused',
      'Construction': 'Bold, industrial, high contrast, strong typography, safety colors',
    };
    const industryHint = !hasReferenceImages 
      ? `\nINDUSTRY STYLE GUIDE: ${industryStyles[client.industry] || 'Modern, professional, clean lines, balanced composition'}`
      : '';

    // Smart color directive
    const colorDirective = hasBrandColors ? `
BRAND COLORS (apply 60-30-10 rule):
- Primary (60%): ${client.brand_primary_color} - backgrounds, large shapes
- Secondary (30%): ${client.brand_secondary_color || 'complementary to primary'}
- Accent (10%): ${client.brand_accent_color || 'for CTAs and highlights'}
- Text on colored backgrounds: WHITE or ensure 4.5:1 contrast` : `
COLOR APPROACH (no brand colors defined):
- Use sophisticated, muted tones appropriate for ${client.industry}
- Prefer neutral backgrounds with one accent color
- Look to reference images for color guidance`;

    const brandFonts = client.brand_fonts?.length 
      ? client.brand_fonts.join(', ') 
      : 'Clean modern sans-serif (like Inter, SF Pro, or Helvetica Neue)';

    // Build the final prompt
    const prompt = `${designSystemPrompt}
${referenceDirective}
${industryHint}

CREATE: ${conceptData.description}
${conceptData.visualStyle ? `Visual Style: ${conceptData.visualStyle}` : ''}
${conceptData.textOverlay ? `Text to include: "${conceptData.textOverlay}"` : ''}

CLIENT: ${client.business_name} (${client.industry})
${colorDirective}

TYPOGRAPHY: ${brandFonts}

${client.brand_style_notes ? `BRAND NOTES: ${client.brand_style_notes}` : ''}
${promptAdditions ? `ADDITIONAL INSTRUCTIONS: ${promptAdditions}` : ''}
${feedback ? `FEEDBACK TO ADDRESS: ${feedback}` : ''}

${isRegeneration && hasReferenceImages ? `
REGENERATION MODE: The first reference image is the previous version. REFINE it based on feedback - keep composition and style, just improve based on notes.` : ''}

${brandLogoUrl ? `
LOGO: Include the provided brand logo. ${getLogoPlacementInstructions(logoPlacement)}` : ''}

OUTPUT: 4:5 portrait (1080x1350), ultra-sharp, magazine-quality, brand colors must be PROMINENT.`;

    console.log(`Generating professional image with ${selectedModel}...`);

    let generatedImageUrl: string | undefined;

    // Choose model based on selection
    if (selectedModel === 'dalle3' || selectedModel === 'gpt-image-1.5') {
      const modelName = selectedModel === 'gpt-image-1.5' ? 'gpt-image-1' : 'dall-e-3';
      console.log(`Calling OpenAI ${modelName} for batch image generation...`);

      // gpt-image-1 uses different API format than dall-e-3
      const requestBody: any = {
        model: modelName,
        prompt: prompt,
        n: 1,
        size: '1024x1280', // 4:5 aspect ratio (closest supported size)
      };

      // Only DALL-E 3 supports these parameters
      if (selectedModel === 'dalle3') {
        requestBody.quality = 'hd';
        requestBody.style = 'vivid';
        requestBody.response_format = 'b64_json';
      }

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', response.status, errorText);

        let message = errorText;
        try {
          const parsed = JSON.parse(errorText);
          message = parsed?.error?.message || errorText;
        } catch {
          // ignore
        }

        // return 200 so the client gets a structured error payload (no non-2xx)
        if (batchItemId) {
          await supabase
            .from('image_batch_items')
            .update({ status: 'pending' })
            .eq('id', batchItemId);
        }

        return new Response(
          JSON.stringify({ error: message }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const aiResponse = await response.json();

      // Both DALL-E 3 and GPT Image 1 return base64 data in b64_json
      const b64Data = aiResponse.data?.[0]?.b64_json;
      if (b64Data) {
        generatedImageUrl = `data:image/png;base64,${b64Data}`;
        console.log('Successfully extracted base64 image data');
      } else {
        console.error('No b64_json found in response:', JSON.stringify(aiResponse).slice(0, 500));
      }

    } else if (selectedModel === 'ideogram') {
      console.log('Calling Ideogram v3 for batch image generation...');
      console.log('Reference images count:', allReferenceImages.length);

      // Use multipart/form-data for Ideogram to support style reference images
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('rendering_speed', 'DEFAULT');
      formData.append('aspect_ratio', '4x5'); // 4:5 portrait aspect ratio

      // Add style reference images (max 3)
      if (allReferenceImages.length > 0) {
        console.log('Adding style reference images to Ideogram request...');
        const imagesToUse = allReferenceImages.slice(0, 3);
        
        for (let i = 0; i < imagesToUse.length; i++) {
          try {
            const imageBlob = await fetchImageAsBlob(imagesToUse[i]);
            formData.append('style_reference_images', imageBlob, `reference_${i}.png`);
            console.log(`Added reference image ${i + 1} (${imageBlob.size} bytes)`);
          } catch (err) {
            console.error(`Failed to add reference image ${i}:`, err);
          }
        }
      }

      const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate', {
        method: 'POST',
        headers: {
          'Api-Key': ideogramApiKey!,
          // Don't set Content-Type - fetch will set it with boundary for multipart
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ideogram API error:', response.status, errorText);

        let message = errorText;
        try {
          const parsed = JSON.parse(errorText);
          message = parsed?.error?.message || errorText;
        } catch {
          // ignore
        }

        if (batchItemId) {
          await supabase
            .from('image_batch_items')
            .update({ status: 'pending' })
            .eq('id', batchItemId);
        }

        return new Response(
          JSON.stringify({ error: message }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const aiResponse = await response.json();
      console.log('Ideogram Response received');

      const imageUrl = aiResponse.data?.[0]?.url;
      if (imageUrl) {
        // Fetch the image and convert to base64 in chunks to avoid stack overflow
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        const bytes = new Uint8Array(imageBuffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode(...chunk);
        }
        const base64 = btoa(binary);
        generatedImageUrl = `data:image/png;base64,${base64}`;
      }

    } else if (selectedModel === 'nano-banana-2') {
      // Nano Banana 2 via Google's Generative Language API directly
      console.log('Calling Nano Banana 2 via Google API for batch image generation...');

      const parts: any[] = [{ text: prompt }];

      // Add brand logo
      if (brandLogoUrl) {
        try {
          const logoResp = await fetch(brandLogoUrl);
          const logoBuffer = await logoResp.arrayBuffer();
          const logoBytes = new Uint8Array(logoBuffer);
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < logoBytes.length; i += chunkSize) {
            const chunk = logoBytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode(...chunk);
          }
          const b64 = btoa(binary);
          const contentType = logoResp.headers.get('content-type') || 'image/png';
          parts.push({ inlineData: { mimeType: contentType, data: b64 } });
          console.log('Added brand logo to Google API request');
        } catch (err) {
          console.error('Failed to add brand logo:', err);
        }
      }

      // Add reference images
      for (const refImage of allReferenceImages) {
        try {
          if (refImage.startsWith('data:')) {
            const mimeMatch = refImage.match(/^data:(image\/\w+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
            const base64Data = refImage.split(',')[1];
            parts.push({ inlineData: { mimeType, data: base64Data } });
          } else {
            const imgResp = await fetch(refImage);
            const imgBuffer = await imgResp.arrayBuffer();
            const imgBytes = new Uint8Array(imgBuffer);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < imgBytes.length; i += chunkSize) {
              const chunk = imgBytes.subarray(i, i + chunkSize);
              binary += String.fromCharCode(...chunk);
            }
            const b64 = btoa(binary);
            const contentType = imgResp.headers.get('content-type') || 'image/png';
            parts.push({ inlineData: { mimeType: contentType, data: b64 } });
          }
          console.log('Added reference image to Google API request');
        } catch (err) {
          console.error('Failed to add reference image:', err);
        }
      }

      const googleModel = 'gemini-3.1-flash-image-preview';
      const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:generateContent?key=${googleApiKey}`;

      // Retry loop for rate limits
      const MAX_RETRIES = 5;
      let lastError: string | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          const waitMs = Math.min(15000 * attempt, 60000);
          console.log(`Rate limited. Waiting ${waitMs / 1000}s before retry ${attempt}/${MAX_RETRIES}...`);
          await new Promise(r => setTimeout(r, waitMs));
        }

        const response = await fetch(googleUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
          }),
        });

        if (response.status === 429) {
          console.log(`HTTP 429 on attempt ${attempt}`);
          if (attempt === MAX_RETRIES) {
            if (batchItemId) {
              await supabase.from('image_batch_items').update({ status: 'pending' }).eq('id', batchItemId);
            }
            return new Response(
              JSON.stringify({ error: 'Image generation is busy. Please try again in a few minutes.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Google API error:', response.status, errorText);
          throw new Error(`Google API error: ${response.status}`);
        }

        const aiResponse = await response.json();
        console.log('Google API Response received');

        // Extract image from response
        const candidates = aiResponse.candidates;
        if (candidates?.[0]?.content?.parts) {
          for (const part of candidates[0].content.parts) {
            if (part.inlineData) {
              generatedImageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
              break;
            }
          }
        }

        if (generatedImageUrl) break;
        lastError = 'No image returned from Google API';
        if (attempt === MAX_RETRIES) break;
      }

    } else {
      // Nano Banana / Nano Banana Pro via Google native API
      if (!googleApiKey) {
        throw new Error('GOOGLE_AI_API_KEY is not configured');
      }

      const geminiModel = 'gemini-2.0-flash-exp';
      console.log(`Calling ${selectedModel || 'nano-banana'} (${geminiModel}) via Google native API...`);
      console.log('Reference images count:', allReferenceImages.length);

      // Build parts array for Google native API
      const nativeParts: any[] = [{ text: prompt }];

      // Add brand logo
      if (brandLogoUrl) {
        try {
          const logoResp = await fetch(brandLogoUrl);
          const logoBuffer = await logoResp.arrayBuffer();
          const logoBytes = new Uint8Array(logoBuffer);
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < logoBytes.length; i += chunkSize) {
            const chunk = logoBytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode(...chunk);
          }
          const b64 = btoa(binary);
          const contentType = logoResp.headers.get('content-type') || 'image/png';
          nativeParts.push({ inlineData: { mimeType: contentType, data: b64 } });
          console.log('Added brand logo to Google API request');
        } catch (err) {
          console.error('Failed to add brand logo:', err);
        }
      }

      // Add reference images as inline data
      for (const refImage of allReferenceImages) {
        try {
          if (refImage.startsWith('data:')) {
            const mimeMatch = refImage.match(/^data:(image\/\w+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
            const base64Data = refImage.split(',')[1];
            nativeParts.push({ inlineData: { mimeType, data: base64Data } });
          } else {
            const imgResp = await fetch(refImage);
            const imgBuffer = await imgResp.arrayBuffer();
            const imgBytes = new Uint8Array(imgBuffer);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < imgBytes.length; i += chunkSize) {
              const chunk = imgBytes.subarray(i, i + chunkSize);
              binary += String.fromCharCode(...chunk);
            }
            const b64 = btoa(binary);
            const contentType = imgResp.headers.get('content-type') || 'image/png';
            nativeParts.push({ inlineData: { mimeType: contentType, data: b64 } });
          }
          console.log('Added reference image to Google API request');
        } catch (err) {
          console.error('Failed to add reference image:', err);
        }
      }

      const nativeGoogleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${googleApiKey}`;

      // Retry loop for rate limits
      const MAX_RETRIES = 5;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          const waitMs = Math.min(15000 * attempt, 60000);
          console.log(`Rate limited. Waiting ${waitMs / 1000}s before retry ${attempt}/${MAX_RETRIES}...`);
          await new Promise(r => setTimeout(r, waitMs));
        }

        const response = await fetch(nativeGoogleUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: nativeParts }],
            generationConfig: {
              responseModalities: ['TEXT', 'IMAGE'],
            },
          }),
        });

        if (response.status === 429) {
          console.log(`HTTP 429 on attempt ${attempt}`);
          if (attempt === MAX_RETRIES) {
            if (batchItemId) {
              await supabase.from('image_batch_items').update({ status: 'pending' }).eq('id', batchItemId);
            }
            return new Response(
              JSON.stringify({ error: 'Image generation is busy. Please try again in a few minutes.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Google API error:', response.status, errorText);
          throw new Error(`Google API error: ${response.status}`);
        }

        const aiResponse = await response.json();
        console.log('Google native API Response received');

        // Extract image from native API response
        const candidates = aiResponse.candidates;
        if (candidates?.[0]?.content?.parts) {
          for (const part of candidates[0].content.parts) {
            if (part.inlineData) {
              generatedImageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
              break;
            }
          }
        }

        if (generatedImageUrl) break;
        if (attempt === MAX_RETRIES) {
          console.error('No image returned from Google API after retries');
        }
      }
    }

    if (!generatedImageUrl) {
      console.error('Image generation failed - no image URL returned from any model');
      
      // Reset batch item status so user can try again
      if (batchItemId) {
        await supabase
          .from('image_batch_items')
          .update({ status: 'pending' })
          .eq('id', batchItemId);
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Image generation failed. The AI model did not return an image. Please try a different prompt or switch to another model.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upload to Cloudflare R2 before saving to DB
    const r2Result = await uploadToR2(generatedImageUrl, {
      folder: `${clientId}/batch`,
    });
    const finalImageUrl = r2Result.url;
    console.log('Image storage:', r2Result.uploaded ? 'R2' : 'fallback data URL');

    // Update batch item with generated image and model used
    if (batchItemId) {
      // First, fetch the current item to save as a revision
      const { data: batchItem } = await supabase
        .from('image_batch_items')
        .select('attempts, generated_image_url, model_used, feedback')
        .eq('id', batchItemId)
        .single();

      // If there's an existing image, save it as a revision before updating
      if (batchItem?.generated_image_url) {
        // Get the current max version for this item
        const { data: existingRevisions } = await supabase
          .from('image_batch_revisions')
          .select('version')
          .eq('batch_item_id', batchItemId)
          .order('version', { ascending: false })
          .limit(1);
        
        const nextVersion = (existingRevisions?.[0]?.version || 0) + 1;
        
        // Save the current image as a revision
        const { error: revisionError } = await supabase
          .from('image_batch_revisions')
          .insert({
            batch_item_id: batchItemId,
            version: nextVersion,
            image_url: batchItem.generated_image_url,
            model_used: batchItem.model_used,
            feedback: batchItem.feedback,
          });
        
        if (revisionError) {
          console.error('Failed to save revision:', revisionError);
        } else {
          console.log(`Saved revision ${nextVersion} for batch item ${batchItemId}`);
        }
      }

      // Now update the batch item with the new image (Cloudinary URL)
      await supabase
        .from('image_batch_items')
        .update({ 
          generated_image_url: finalImageUrl,
          status: 'pending',
          attempts: (batchItem?.attempts || 0) + 1,
          feedback: feedback || null,
          model_used: selectedModel,
        })
        .eq('id', batchItemId);
    }

    console.log('Professional image generated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: finalImageUrl,
        batchItemId,
        modelUsed: selectedModel,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-batch-image:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
