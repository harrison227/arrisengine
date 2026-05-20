/**
 * Single-image generator. Routes to one of:
 *   - OpenAI DALL-E 3 / GPT Image 1
 *   - Ideogram v3
 *   - Google Nano Banana / Nano Banana 2 (Gemini image preview)
 *
 * Heavy business logic — kept intact during the cleanup. Boilerplate
 * (CORS, errors, env, supabase) is now centralised.
 *
 * Contract preserved:
 *   Request:  { clientId, prompt, templateType?, referenceImages?, saveToAssets?,
 *               model?, savedReferenceImageIds?, brandLogoUrl?, logoPlacement? }
 *   Response: { success, imageUrl, assetId, description, modelUsed } | { error }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { notFound, rateLimited, upstream } from '../_shared/errors.ts';
import { ensureNonEmptyString, ensureUuid, ensureOptionalString, ensureOptionalArray, ensureOptionalBoolean } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { requireClientAccess } from '../_shared/auth.ts';
import { requireEnv, optionalEnv } from '../_shared/env.ts';
import { timeoutSignal } from '../_shared/retry.ts';
import { uploadToR2 } from '../_shared/cloudinary-upload.ts';

interface RequestBody {
  clientId: unknown;
  prompt: unknown;
  templateType?: unknown;
  referenceImages?: unknown;
  saveToAssets?: unknown;
  model?: unknown;
  savedReferenceImageIds?: unknown;
  brandLogoUrl?: unknown;
  logoPlacement?: unknown;
}

async function fetchImageAsBlob(imageSource: string): Promise<Blob> {
  if (imageSource.startsWith('data:')) {
    const base64Data = imageSource.split(',')[1];
    const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    return new Blob([bytes], { type: 'image/png' });
  }
  const response = await fetch(imageSource, { signal: timeoutSignal(60_000) });
  return response.blob();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

const TEMPLATE_INSTRUCTIONS: Record<string, string> = {
  quote_card: 'Create a visually striking quote card with elegant typography. The quote should be the focal point with tasteful background design.',
  stat_graphic: 'Design a bold statistics graphic that makes numbers pop. Use clean data visualization with clear hierarchy.',
  announcement: 'Create an eye-catching announcement post with celebratory or attention-grabbing elements.',
  testimonial: 'Design a testimonial card that feels authentic and trustworthy. Include space for the quote and attribution.',
  tips_carousel: 'Create a tips/educational slide with numbered points, clean layout, and easy-to-read formatting.',
  behind_the_scenes: 'Design a casual, authentic-looking behind-the-scenes style graphic with a raw, unpolished aesthetic.',
  promotional: 'Create a promotional graphic that drives action with clear CTA placement and urgency elements.',
};

const PLACEMENT_MAP: Record<string, string> = {
  'top-left': 'top-left corner',
  'top-right': 'top-right corner',
  'bottom-left': 'bottom-left corner',
  'bottom-right': 'bottom-right corner',
  center: 'center',
  auto: 'a subtle, professional position (bottom-right or top-left)',
};

Deno.serve(withErrorHandling({ fn: 'generate-social-image' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const clientId = ensureUuid('clientId', body.clientId);
  const prompt = ensureNonEmptyString('prompt', body.prompt, 50_000);
  const templateType = ensureOptionalString('templateType', body.templateType, 100);
  const referenceImages = ensureOptionalArray('referenceImages', body.referenceImages,
    (item, i) => ensureNonEmptyString(`referenceImages[${i}]`, item, 10_000_000), { max: 10 }) ?? [];
  const saveToAssets = ensureOptionalBoolean('saveToAssets', body.saveToAssets) ?? false;
  const model = ensureOptionalString('model', body.model, 100);
  const savedReferenceImageIds = ensureOptionalArray('savedReferenceImageIds', body.savedReferenceImageIds,
    (item, i) => ensureUuid(`savedReferenceImageIds[${i}]`, item), { max: 20 });
  const brandLogoUrl = ensureOptionalString('brandLogoUrl', body.brandLogoUrl, 4_000);
  const logoPlacement = ensureOptionalString('logoPlacement', body.logoPlacement, 50);

  await requireClientAccess(req, clientId);

  const supabase = getSupabaseAdmin();

  // Required for default Gemini path; specific models check their own keys below.
  const googleApiKey = requireEnv('GOOGLE_AI_API_KEY');
  const openaiApiKey = optionalEnv('OPENAI_API_KEY');
  const ideogramApiKey = optionalEnv('IDEOGRAM_API_KEY');
  if ((model === 'dalle3' || model === 'gpt-image-1.5') && !openaiApiKey) throw new Error('OPENAI_API_KEY is not configured for OpenAI models');
  if (model === 'ideogram' && !ideogramApiKey) throw new Error('IDEOGRAM_API_KEY is not configured for Ideogram');

  const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
  if (!client) throw notFound('Client not found');

  // Brand Pack primary logo wins over the legacy single brand_logo_url, but
  // only if the caller didn't supply one explicitly.
  let effectiveBrandLogoUrl: string | null = brandLogoUrl ?? null;
  if (!effectiveBrandLogoUrl) {
    const { data: primaryLogo } = await supabase
      .from('client_logos')
      .select('file_url')
      .eq('client_id', clientId)
      .eq('is_primary', true)
      .maybeSingle();
    effectiveBrandLogoUrl = primaryLogo?.file_url ?? (client.brand_logo_url as string | null) ?? null;
  }

  let allReferenceImages: string[] = [...referenceImages];
  if (effectiveBrandLogoUrl) allReferenceImages.unshift(effectiveBrandLogoUrl);
  if (savedReferenceImageIds && savedReferenceImageIds.length > 0) {
    const { data: savedImages } = await supabase.from('client_reference_images').select('thumbnail_url').in('id', savedReferenceImageIds);
    if (savedImages) {
      const urls = savedImages.map((img) => img.thumbnail_url).filter(Boolean) as string[];
      allReferenceImages = [...allReferenceImages, ...urls];
    }
  }

  const [{ data: knowledgeSummary }, { data: knowledgeEntries }, { data: structuredFonts }] = await Promise.all([
    supabase.from('knowledge_summary').select('*').eq('client_id', clientId).maybeSingle(),
    supabase.from('knowledge_entries').select('title, content, category').eq('client_id', clientId)
      .in('category', ['brand_guidelines', 'visual_identity', 'tone_voice', 'content_pillars'])
      .order('importance', { ascending: false }).limit(10),
    supabase.from('client_brand_fonts').select('family_name, role, weight, fallback_stack')
      .eq('client_id', clientId)
      .order('role', { ascending: true }),
  ]);

  const brandGuidelines = (knowledgeEntries ?? []).map((e) => `[${e.category}] ${e.title}: ${e.content}`).join('\n');
  const brandContext = `
Brand: ${client.business_name}
Industry: ${client.industry}
${knowledgeSummary?.positioning_summary ? `Positioning: ${knowledgeSummary.positioning_summary}` : ''}
${knowledgeSummary?.key_differentiators ? `Key Points: ${(knowledgeSummary.key_differentiators as string[]).join(', ')}` : ''}
${knowledgeSummary?.ideal_customer_profile ? `Target Audience: ${knowledgeSummary.ideal_customer_profile}` : ''}
`;

  const hasBrandColors = client.brand_primary_color || client.brand_secondary_color;
  const brandColorsList = [
    client.brand_primary_color ? `- Primary Color: ${client.brand_primary_color}` : '',
    client.brand_secondary_color ? `- Secondary Color: ${client.brand_secondary_color}` : '',
    client.brand_accent_color ? `- Accent Color: ${client.brand_accent_color}` : '',
    client.brand_background_color ? `- Background Color: ${client.brand_background_color}` : '',
    client.brand_text_color ? `- Text Color: ${client.brand_text_color}` : '',
  ].filter(Boolean).join('\n');
  // Prefer structured Brand Pack fonts (with role + weight) when present.
  const structuredBrandFonts = (structuredFonts ?? []) as Array<{ family_name: string; role: string; weight: string; fallback_stack: string | null }>;
  const brandFonts = structuredBrandFonts.length > 0
    ? `- Typography: ${structuredBrandFonts.map((f) => `${f.role}: ${f.family_name}${f.weight !== '400' ? ` ${f.weight}` : ''}`).join('; ')}`
    : client.brand_fonts?.length ? `- Typography: ${(client.brand_fonts as string[]).join(', ')}` : '';
  const brandStyle = client.brand_style_notes ? `- Style Notes: ${client.brand_style_notes}` : '';
  const brandIdentity = (hasBrandColors || brandGuidelines) ? `
Brand Identity:
${brandColorsList}
${brandFonts}
${brandStyle}
${brandGuidelines ? `\nBrand Guidelines:\n${brandGuidelines}` : ''}

IMPORTANT: Use these exact brand colors prominently in the design. The generated image must feel on-brand with this color palette and adhere to the brand guidelines.
` : '';

  const templateInstruction = (templateType && TEMPLATE_INSTRUCTIONS[templateType]) ?? TEMPLATE_INSTRUCTIONS.quote_card;

  let imagePrompt = `Create a professional social media graphic for a ${client.industry} brand.

${templateInstruction}

User Request: ${prompt}

Brand Context:
${brandContext}
${brandIdentity}
Style Requirements:
- Modern, clean design suitable for Instagram/LinkedIn
- Professional typography${client.brand_fonts?.length ? ` (prefer ${(client.brand_fonts as string[])[0]} style)` : ''}
- Cohesive color scheme that feels on-brand
- High contrast for readability
- Optimized for square (1:1) format
- No placeholder text - use the actual content provided`;

  if (effectiveBrandLogoUrl) {
    const placementText = PLACEMENT_MAP[logoPlacement ?? 'auto'] ?? 'a subtle position';
    imagePrompt += `\n\nIMPORTANT - BRAND LOGO: A brand logo image has been provided as one of the reference images. You MUST incorporate this logo into the design, placed in ${placementText}. The logo should be clearly visible but not overwhelm the main content.`;
  }
  if (allReferenceImages.length > 0) {
    imagePrompt += `\n\nIMPORTANT: Analyze and mimic the visual style from the reference images provided:
- Match the color palette and mood
- Use similar typography style and layout patterns
- Capture the same aesthetic and design language
- Maintain the same level of visual complexity`;
  }

  let generatedImage: string | undefined;
  let textContent: string | undefined;

  if (model === 'dalle3' || model === 'gpt-image-1.5') {
    const modelName = model === 'gpt-image-1.5' ? 'gpt-image-1' : 'dall-e-3';
    const requestBody: Record<string, unknown> = { model: modelName, prompt: imagePrompt, n: 1, size: '1024x1024' };
    if (model === 'dalle3') {
      requestBody.quality = 'hd';
      requestBody.style = 'vivid';
      requestBody.response_format = 'b64_json';
    }
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: timeoutSignal(120_000),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let message = errorText;
      try { message = JSON.parse(errorText)?.error?.message ?? errorText; } catch { /* ignore */ }
      log.warn('openai_failed', { status: response.status });
      // Legacy contract: error returned as 200. Preserved.
      return jsonResponse({ error: message });
    }
    const aiResponse = await response.json();
    const b64Data = aiResponse.data?.[0]?.b64_json;
    if (b64Data) generatedImage = `data:image/png;base64,${b64Data}`;
    textContent = aiResponse.data?.[0]?.revised_prompt;
  } else if (model === 'ideogram') {
    const formData = new FormData();
    formData.append('prompt', imagePrompt);
    formData.append('rendering_speed', 'DEFAULT');
    formData.append('aspect_ratio', '1x1');
    if (allReferenceImages.length > 0) {
      const imagesToUse = allReferenceImages.slice(0, 3);
      for (let i = 0; i < imagesToUse.length; i++) {
        try {
          const blob = await fetchImageAsBlob(imagesToUse[i]);
          formData.append('style_reference_images', blob, `reference_${i}.png`);
        } catch (err) {
          log.warn('ideogram_ref_failed', { error: err instanceof Error ? err.message : String(err) });
        }
      }
    }
    const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate', {
      method: 'POST',
      headers: { 'Api-Key': ideogramApiKey! },
      body: formData,
      signal: timeoutSignal(120_000),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let message = errorText;
      try { message = JSON.parse(errorText)?.error?.message ?? errorText; } catch { /* ignore */ }
      log.warn('ideogram_failed', { status: response.status });
      return jsonResponse({ error: message });
    }
    const aiResponse = await response.json();
    const imageUrl = aiResponse.data?.[0]?.url;
    if (imageUrl) {
      const imageResponse = await fetch(imageUrl, { signal: timeoutSignal(60_000) });
      const buffer = await imageResponse.arrayBuffer();
      generatedImage = `data:image/png;base64,${bytesToBase64(new Uint8Array(buffer))}`;
    }
  } else {
    // Default + nano-banana-2 share Google native API path with the same model id.
    const geminiModel = 'gemini-3.1-flash-image-preview';
    const parts: Array<Record<string, unknown>> = [{ text: imagePrompt }];
    for (const refImage of allReferenceImages) {
      try {
        if (refImage.startsWith('data:')) {
          const mimeMatch = refImage.match(/^data:(image\/\w+);base64,/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
          parts.push({ inlineData: { mimeType, data: refImage.split(',')[1] } });
        } else {
          const imgResp = await fetch(refImage, { signal: timeoutSignal(60_000) });
          const buf = await imgResp.arrayBuffer();
          const contentType = imgResp.headers.get('content-type') ?? 'image/png';
          parts.push({ inlineData: { mimeType: contentType, data: bytesToBase64(new Uint8Array(buf)) } });
        }
      } catch (err) {
        log.warn('google_ref_failed', { error: err instanceof Error ? err.message : String(err) });
      }
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${googleApiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }),
      signal: timeoutSignal(180_000),
    });
    if (!response.ok) {
      if (response.status === 429) throw rateLimited('Rate limit exceeded. Please try again later.');
      const errorText = await response.text().catch(() => '');
      log.error('google_failed', undefined, { status: response.status, body: errorText.slice(0, 500) });
      throw upstream(`Google API error: ${response.status}`, 502);
    }
    const aiResponse = await response.json();
    const candidates = aiResponse.candidates;
    if (candidates?.[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          generatedImage = `data:${part.inlineData.mimeType ?? 'image/png'};base64,${part.inlineData.data}`;
          break;
        }
        if (part.text) textContent = part.text;
      }
    }
  }

  if (!generatedImage) throw upstream('No image generated in response');

  const r2Result = await uploadToR2(generatedImage, { folder: `${clientId}/social` });
  let assetUrl = r2Result.url;
  let assetId: string | null = null;

  if (saveToAssets) {
    try {
      const storagePath = r2Result.uploaded ? `r2:${r2Result.key}` : `${clientId}/${Date.now()}-ai-generated.png`;
      if (!r2Result.uploaded) {
        const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, '');
        const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        const { error: uploadError } = await supabase.storage.from('client-assets').upload(storagePath, imageBytes, { contentType: 'image/png', upsert: false });
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('client-assets').getPublicUrl(storagePath);
          assetUrl = publicUrl;
        }
      }
      const { data: asset, error: assetError } = await supabase.from('assets').insert({
        client_id: clientId,
        name: `AI Generated - ${templateType ?? 'custom'} - ${new Date().toLocaleDateString()}`,
        asset_type: 'creative',
        storage_path: storagePath,
        thumbnail_url: assetUrl,
        tags: ['ai-generated', templateType ?? 'custom', model ?? 'nano-banana'],
      }).select().single();
      if (assetError) log.warn('asset_insert_failed', { error: assetError.message });
      else assetId = asset.id;
    } catch (err) {
      log.error('asset_save_error', err);
    }
  }

  log.info('image_generated', { clientId, model: model ?? 'nano-banana', uploaded: r2Result.uploaded });

  return jsonResponse({
    success: true,
    imageUrl: assetUrl,
    assetId,
    description: textContent,
    modelUsed: model ?? 'nano-banana',
  });
}));
