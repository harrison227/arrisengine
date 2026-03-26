import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { uploadToR2 } from "../_shared/cloudinary-upload.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { clientId, prompt, templateType, referenceImages, saveToAssets, model, savedReferenceImageIds, brandLogoUrl, logoPlacement } = await req.json();
    
    if (!clientId || !prompt) {
      return new Response(
        JSON.stringify({ error: 'Client ID and prompt are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    if ((model === 'dalle3' || model === 'gpt-image-1.5') && !openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured for OpenAI models');
    }
    if (model === 'ideogram' && !ideogramApiKey) {
      throw new Error('IDEOGRAM_API_KEY is not configured for Ideogram');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch client info
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      throw new Error('Client not found');
    }

    // Fetch saved reference images if IDs provided
    let allReferenceImages: string[] = [...(referenceImages || [])];
    
    // Include brand logo as a reference image if provided
    if (brandLogoUrl) {
      allReferenceImages.unshift(brandLogoUrl);
      console.log('Added brand logo to reference images:', brandLogoUrl);
    }
    
    if (savedReferenceImageIds && savedReferenceImageIds.length > 0) {
      const { data: savedImages } = await supabase
        .from('client_reference_images')
        .select('thumbnail_url')
        .in('id', savedReferenceImageIds);
      
      if (savedImages) {
        const savedUrls = savedImages
          .map(img => img.thumbnail_url)
          .filter(Boolean) as string[];
        allReferenceImages = [...allReferenceImages, ...savedUrls];
      }
    }
    
    console.log('Total reference images:', allReferenceImages.length);

    // Fetch knowledge summary for brand context
    const { data: knowledgeSummary } = await supabase
      .from('knowledge_summary')
      .select('*')
      .eq('client_id', clientId)
      .single();

    // Fetch knowledge entries for brand guidelines
    const { data: knowledgeEntries } = await supabase
      .from('knowledge_entries')
      .select('title, content, category')
      .eq('client_id', clientId)
      .in('category', ['brand_guidelines', 'visual_identity', 'tone_voice', 'content_pillars'])
      .order('importance', { ascending: false })
      .limit(10);

    // Build brand guidelines from knowledge entries
    const brandGuidelines = knowledgeEntries?.length 
      ? knowledgeEntries.map(e => `[${e.category}] ${e.title}: ${e.content}`).join('\n')
      : '';

    // Build brand context
    const brandContext = `
Brand: ${client.business_name}
Industry: ${client.industry}
${knowledgeSummary?.positioning_summary ? `Positioning: ${knowledgeSummary.positioning_summary}` : ''}
${knowledgeSummary?.key_differentiators ? `Key Points: ${knowledgeSummary.key_differentiators.join(', ')}` : ''}
${knowledgeSummary?.ideal_customer_profile ? `Target Audience: ${knowledgeSummary.ideal_customer_profile}` : ''}
`;

    // Build brand identity section with colors and fonts
    const hasBrandColors = client.brand_primary_color || client.brand_secondary_color;
    const brandColorsList = [
      client.brand_primary_color ? `- Primary Color: ${client.brand_primary_color}` : '',
      client.brand_secondary_color ? `- Secondary Color: ${client.brand_secondary_color}` : '',
      client.brand_accent_color ? `- Accent Color: ${client.brand_accent_color}` : '',
      client.brand_background_color ? `- Background Color: ${client.brand_background_color}` : '',
      client.brand_text_color ? `- Text Color: ${client.brand_text_color}` : '',
    ].filter(Boolean).join('\n');

    const brandFonts = client.brand_fonts?.length ? `- Typography: ${client.brand_fonts.join(', ')}` : '';
    const brandStyle = client.brand_style_notes ? `- Style Notes: ${client.brand_style_notes}` : '';

    const brandIdentity = hasBrandColors || brandGuidelines ? `
Brand Identity:
${brandColorsList}
${brandFonts}
${brandStyle}
${brandGuidelines ? `\nBrand Guidelines:\n${brandGuidelines}` : ''}

IMPORTANT: Use these exact brand colors prominently in the design. The generated image must feel on-brand with this color palette and adhere to the brand guidelines.
` : '';

    // Template-specific instructions
    const templateInstructions: Record<string, string> = {
      quote_card: 'Create a visually striking quote card with elegant typography. The quote should be the focal point with tasteful background design.',
      stat_graphic: 'Design a bold statistics graphic that makes numbers pop. Use clean data visualization with clear hierarchy.',
      announcement: 'Create an eye-catching announcement post with celebratory or attention-grabbing elements.',
      testimonial: 'Design a testimonial card that feels authentic and trustworthy. Include space for the quote and attribution.',
      tips_carousel: 'Create a tips/educational slide with numbered points, clean layout, and easy-to-read formatting.',
      behind_the_scenes: 'Design a casual, authentic-looking behind-the-scenes style graphic with a raw, unpolished aesthetic.',
      promotional: 'Create a promotional graphic that drives action with clear CTA placement and urgency elements.',
    };

    const templateInstruction = templateInstructions[templateType] || templateInstructions.quote_card;

    // Build the image generation prompt
    let imagePrompt = `Create a professional social media graphic for a ${client.industry} brand.

${templateInstruction}

User Request: ${prompt}

Brand Context:
${brandContext}
${brandIdentity}
Style Requirements:
- Modern, clean design suitable for Instagram/LinkedIn
- Professional typography${client.brand_fonts?.length ? ` (prefer ${client.brand_fonts[0]} style)` : ''}
- Cohesive color scheme that feels on-brand
- High contrast for readability
- Optimized for square (1:1) format
- No placeholder text - use the actual content provided`;

    // Add logo placement instructions
    if (brandLogoUrl) {
      const placementMap: Record<string, string> = {
        'top-left': 'top-left corner',
        'top-right': 'top-right corner',
        'bottom-left': 'bottom-left corner',
        'bottom-right': 'bottom-right corner',
        'center': 'center',
        'auto': 'a subtle, professional position (bottom-right or top-left)',
      };
      const placementText = placementMap[logoPlacement || 'auto'] || 'a subtle position';
      imagePrompt += `

IMPORTANT - BRAND LOGO: A brand logo image has been provided as one of the reference images. You MUST incorporate this logo into the design, placed in ${placementText}. The logo should be clearly visible but not overwhelm the main content.`;
    }

    // If reference images are provided, add style analysis instructions
    if (allReferenceImages.length > 0) {
      imagePrompt += `

IMPORTANT: Analyze and mimic the visual style from the reference images provided:
- Match the color palette and mood
- Use similar typography style and layout patterns
- Capture the same aesthetic and design language
- Maintain the same level of visual complexity`;
    }

    let generatedImage: string | undefined;
    let textContent: string | undefined;

    // Choose model based on selection
    if (model === 'dalle3' || model === 'gpt-image-1.5') {
      const modelName = model === 'gpt-image-1.5' ? 'gpt-image-1' : 'dall-e-3';
      console.log(`Calling OpenAI ${modelName} for image generation...`);
      console.log('Prompt:', imagePrompt);
      console.log('Reference images count:', allReferenceImages.length);

      // gpt-image-1 uses different API format than dall-e-3
      // Note: OpenAI's generations endpoint doesn't support reference images directly,
      // so we include style reference instructions in the prompt instead
      const requestBody: any = {
        model: modelName,
        prompt: imagePrompt,
        n: 1,
        size: '1024x1024',
      };

      // Only DALL-E 3 supports these parameters
      if (model === 'dalle3') {
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

        return new Response(
          JSON.stringify({ error: message }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const aiResponse = await response.json();
      console.log(`${modelName} Response received`);

      // Both DALL-E 3 and GPT Image 1 return base64 data in b64_json
      const b64Data = aiResponse.data?.[0]?.b64_json;
      if (b64Data) {
        generatedImage = `data:image/png;base64,${b64Data}`;
        console.log('Successfully extracted base64 image data');
      } else {
        console.error('No b64_json found in response:', JSON.stringify(aiResponse).slice(0, 500));
      }
      textContent = aiResponse.data?.[0]?.revised_prompt;

    } else if (model === 'ideogram') {
      console.log('Calling Ideogram v3 for image generation...');
      console.log('Prompt:', imagePrompt);
      console.log('Reference images count:', allReferenceImages.length);

      // Use multipart/form-data for Ideogram to support style reference images
      const formData = new FormData();
      formData.append('prompt', imagePrompt);
      formData.append('rendering_speed', 'DEFAULT');
      formData.append('aspect_ratio', '1x1');

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

        return new Response(
          JSON.stringify({ error: message }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const aiResponse = await response.json();
      console.log('Ideogram Response received');

      // Ideogram returns URL in data array
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
        generatedImage = `data:image/png;base64,${base64}`;
      }

    } else if (model === 'nano-banana-2') {
      // Nano Banana 2 via Google's Generative Language API directly
      if (!googleApiKey) {
        throw new Error('GOOGLE_AI_API_KEY is not configured for Nano Banana 2');
      }

      const googleModel = 'gemini-3.1-flash-image-preview';
      console.log(`Calling Nano Banana 2 (${googleModel}) via Google API...`);
      console.log('Prompt:', imagePrompt);
      console.log('Reference images count:', allReferenceImages.length);

      // Build parts array for Google API
      const parts: any[] = [{ text: imagePrompt }];

      // Add reference images as inline data
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

      const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${googleModel}:generateContent?key=${googleApiKey}`;
      
      const response = await fetch(googleUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      });

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
            generatedImage = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            break;
          }
          if (part.text) {
            textContent = part.text;
          }
        }
      }

    } else {
      // Nano Banana / Nano Banana Pro via Lovable AI gateway
      const geminiModel = model === 'nano-banana-pro'
        ? 'gemini-2.0-flash-exp'
        : 'gemini-2.5-flash-image';
      
      console.log(`Calling ${model || 'nano-banana'} (${geminiModel}) for image generation...`);
      console.log('Prompt:', imagePrompt);

      // Build messages array
      const messages: any[] = [];
      
      if (allReferenceImages.length > 0) {
        const content: any[] = [
          { type: 'text', text: imagePrompt }
        ];
        
        for (const refImage of allReferenceImages) {
          content.push({
            type: 'image_url',
            image_url: { url: refImage }
          });
        }
        
        messages.push({ role: 'user', content });
      } else {
        messages.push({ role: 'user', content: imagePrompt });
      }

      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: geminiModel,
          messages,
          modalities: ['image', 'text'],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: 'API credits exhausted. Please add funds to continue.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const errorText = await response.text();
        console.error('AI API error:', response.status, errorText);
        throw new Error('Failed to generate image');
      }

      const aiResponse = await response.json();
      console.log('AI Response received');

      // Extract the generated image
      generatedImage = aiResponse.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      textContent = aiResponse.choices?.[0]?.message?.content;
    }

    if (!generatedImage) {
      console.error('No image in response');
      throw new Error('No image generated in response');
    }

    // Upload to Cloudflare R2 (always, for CDN + cost savings)
    const r2Result = await uploadToR2(generatedImage, {
      folder: `${clientId}/social`,
    });
    let assetUrl = r2Result.url;
    let assetId = null;
    console.log('Image storage:', r2Result.uploaded ? 'R2' : 'fallback data URL');

    // If saveToAssets is true, create an asset record pointing to R2 URL
    if (saveToAssets) {
      try {
        const storagePath = r2Result.uploaded
          ? `r2:${r2Result.key}`
          : `${clientId}/${Date.now()}-ai-generated.png`;

        // If R2 failed, fall back to Supabase Storage
        if (!r2Result.uploaded) {
          const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, '');
          const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          const { error: uploadError } = await supabase.storage
            .from('client-assets')
            .upload(storagePath, imageBytes, { contentType: 'image/png', upsert: false });
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from('client-assets').getPublicUrl(storagePath);
            assetUrl = publicUrl;
          }
        }

        const { data: asset, error: assetError } = await supabase
          .from('assets')
          .insert({
            client_id: clientId,
            name: `AI Generated - ${templateType || 'custom'} - ${new Date().toLocaleDateString()}`,
            asset_type: 'creative',
            storage_path: storagePath,
            thumbnail_url: assetUrl,
            tags: ['ai-generated', templateType || 'custom', model || 'nano-banana'],
          })
          .select()
          .single();

        if (assetError) {
          console.error('Asset record error:', assetError);
        } else {
          assetId = asset.id;
          console.log('Asset saved successfully:', assetId);
        }
      } catch (saveError) {
        console.error('Error saving asset:', saveError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: assetUrl,
        assetId,
        description: textContent,
        modelUsed: model || 'nano-banana',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-social-image:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
