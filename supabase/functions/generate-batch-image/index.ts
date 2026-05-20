/**
 * Generate (or regenerate) a single image for an image_batch_items row.
 *
 * Routes the prompt to one of:
 *   - OpenAI DALL-E 3 / GPT Image 1
 *   - Ideogram v3 (with style references)
 *   - Google Nano Banana / Nano Banana 2 (Gemini image preview)
 *
 * On regeneration the previous image is saved into image_batch_revisions
 * before the row is updated with the new asset.
 *
 * Heavy model-specific logic is preserved verbatim. Boilerplate (CORS,
 * env, validation, Supabase, rate-limit, R2 upload) uses the shared lib.
 *
 * Contract preserved:
 *   Request:  { batchItemId?, clientId, concept, templateType?, feedback?,
 *               promptAdditions?, referenceImageUrl?, referenceImages?,
 *               brandLogoUrl?, logoPlacement?, model?, savedReferenceImageIds?,
 *               isRegeneration? }
 *   Response: { success, imageUrl, batchItemId, modelUsed } | { error }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { notFound, rateLimited, upstream } from '../_shared/errors.ts';
import {
  ensureNonEmptyString, ensureUuid, ensureOptionalString, ensureOptionalArray,
  ensureOptionalBoolean, ensureOptionalUuid,
} from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { requireClientAccess } from '../_shared/auth.ts';
import { requireEnv, optionalEnv } from '../_shared/env.ts';
import { timeoutSignal } from '../_shared/retry.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { uploadToR2 } from '../_shared/cloudinary-upload.ts';

interface RequestBody {
  batchItemId?: unknown;
  clientId: unknown;
  concept: unknown;
  templateType?: unknown;
  feedback?: unknown;
  promptAdditions?: unknown;
  referenceImageUrl?: unknown;
  referenceImages?: unknown;
  brandLogoUrl?: unknown;
  logoPlacement?: unknown;
  model?: unknown;
  savedReferenceImageIds?: unknown;
  isRegeneration?: unknown;
}

const INDUSTRY_STYLES: Record<string, string> = {
  Education: 'Clean, trustworthy, warm colors, approachable typography',
  Technology: 'Modern, minimal, geometric shapes, cool tones',
  'Health & Wellness': 'Calming, natural colors, organic shapes, breathing room',
  Finance: 'Professional, navy/gold, conservative typography, authoritative',
  'Real Estate': 'Luxurious, elegant, high contrast, aspirational imagery',
  Retail: 'Vibrant, energetic, bold typography, lifestyle focused',
  Construction: 'Bold, industrial, high contrast, strong typography, safety colors',
};

function getLogoPlacementInstructions(placement?: string): string {
  switch (placement) {
    case 'corner':
      return 'Place the logo as a small watermark in the bottom-right or bottom-left corner. It should be visible but not dominate the design.';
    case 'featured':
      return 'Feature the logo prominently in the design - larger size, in the header area or as a central design element. The logo should be a key focal point.';
    case 'badge':
      return 'Place the logo as a subtle badge - small, contained area, possibly with a background shape. Professional and unobtrusive.';
    default:
      return 'Use your professional judgment to place the logo where it looks most balanced and professional for this type of content. Ensure it is clearly visible.';
  }
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

async function fetchAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const resp = await fetch(url, { signal: timeoutSignal(60_000) });
  const buf = await resp.arrayBuffer();
  return {
    data: bytesToBase64(new Uint8Array(buf)),
    mimeType: resp.headers.get('content-type') ?? 'image/png',
  };
}

Deno.serve(withErrorHandling({ fn: 'generate-batch-image' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const batchItemId = ensureOptionalUuid('batchItemId', body.batchItemId);
  const clientId = ensureUuid('clientId', body.clientId);
  const concept = ensureNonEmptyString('concept', body.concept, 50_000);
  const templateType = ensureOptionalString('templateType', body.templateType, 100);
  const feedback = ensureOptionalString('feedback', body.feedback, 10_000);
  const promptAdditions = ensureOptionalString('promptAdditions', body.promptAdditions, 10_000);
  const referenceImageUrl = ensureOptionalString('referenceImageUrl', body.referenceImageUrl, 10_000_000);
  const referenceImages = ensureOptionalArray('referenceImages', body.referenceImages,
    (item, i) => ensureNonEmptyString(`referenceImages[${i}]`, item, 10_000_000), { max: 10 });
  const brandLogoUrl = ensureOptionalString('brandLogoUrl', body.brandLogoUrl, 4_000);
  const logoPlacement = ensureOptionalString('logoPlacement', body.logoPlacement, 50);
  const model = ensureOptionalString('model', body.model, 100);
  const savedReferenceImageIds = ensureOptionalArray('savedReferenceImageIds', body.savedReferenceImageIds,
    (item, i) => ensureUuid(`savedReferenceImageIds[${i}]`, item), { max: 20 });
  const isRegeneration = ensureOptionalBoolean('isRegeneration', body.isRegeneration);

  await requireClientAccess(req, clientId);

  const supabase = getSupabaseAdmin();
  const rl = await checkRateLimit({ bucket: 'generate-batch-image', subject: clientId, windowSec: 60, max: 15, supabase });
  if (!rl.allowed) throw rateLimited(`Rate limit exceeded. Please wait ${rl.waitTime} seconds before generating more images.`, rl.waitTime);

  const googleApiKey = requireEnv('GOOGLE_AI_API_KEY');
  const openaiApiKey = optionalEnv('OPENAI_API_KEY');
  const ideogramApiKey = optionalEnv('IDEOGRAM_API_KEY');
  const selectedModel = model ?? 'nano-banana';
  if ((selectedModel === 'dalle3' || selectedModel === 'gpt-image-1.5') && !openaiApiKey) throw new Error('OPENAI_API_KEY is not configured for OpenAI models');
  if (selectedModel === 'ideogram' && !ideogramApiKey) throw new Error('IDEOGRAM_API_KEY is not configured for Ideogram');

  const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
  if (!client) throw notFound('Client not found');

  // Pull structured brand fonts (Brand Pack feature) so the prompt names
  // the actual fonts the agency has uploaded, not just the legacy free-text
  // brand_fonts array on clients.
  const { data: structuredFonts } = await supabase
    .from('client_brand_fonts')
    .select('family_name, role, weight, fallback_stack')
    .eq('client_id', clientId)
    .order('role', { ascending: true });

  // Collect reference images from all sources.
  let allReferenceImages: string[] = referenceImages ? [...referenceImages] : [];
  if (referenceImageUrl) allReferenceImages.push(referenceImageUrl);
  if (savedReferenceImageIds && savedReferenceImageIds.length > 0) {
    const { data: savedImages } = await supabase.from('client_reference_images').select('thumbnail_url').in('id', savedReferenceImageIds);
    if (savedImages) {
      const urls = savedImages.map((img) => img.thumbnail_url).filter(Boolean) as string[];
      allReferenceImages = [...urls, ...allReferenceImages];
    }
  }

  // Mark batch item as generating.
  if (batchItemId) {
    await supabase.from('image_batch_items').update({ status: 'generating' }).eq('id', batchItemId);
  }

  // Concept may be a JSON-serialised object with description / textOverlay / etc.
  let conceptData: Record<string, unknown> = { description: concept };
  try {
    const parsed = JSON.parse(concept);
    if (parsed && typeof parsed === 'object' && parsed.description) conceptData = parsed;
  } catch { /* keep raw concept as description */ }

  const hasBrandColors = client.brand_primary_color && client.brand_primary_color !== '#3B82F6';
  const hasReferenceImages = allReferenceImages.length > 0;

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

  const industryHint = !hasReferenceImages
    ? `\nINDUSTRY STYLE GUIDE: ${INDUSTRY_STYLES[client.industry] ?? 'Modern, professional, clean lines, balanced composition'}`
    : '';

  const colorDirective = hasBrandColors ? `
BRAND COLORS (apply 60-30-10 rule):
- Primary (60%): ${client.brand_primary_color} - backgrounds, large shapes
- Secondary (30%): ${client.brand_secondary_color ?? 'complementary to primary'}
- Accent (10%): ${client.brand_accent_color ?? 'for CTAs and highlights'}
- Text on colored backgrounds: WHITE or ensure 4.5:1 contrast` : `
COLOR APPROACH (no brand colors defined):
- Use sophisticated, muted tones appropriate for ${client.industry}
- Prefer neutral backgrounds with one accent color
- Look to reference images for color guidance`;

  // Prefer the structured Brand Pack fonts (have role + weight metadata).
  // Fall back to the legacy free-text brand_fonts array on the client row.
  const structuredBrandFonts = (structuredFonts ?? []) as Array<{ family_name: string; role: string; weight: string; fallback_stack: string | null }>;
  const brandFonts = structuredBrandFonts.length > 0
    ? structuredBrandFonts.map((f) => `${f.role}: ${f.family_name}${f.weight !== '400' ? ` ${f.weight}` : ''}${f.fallback_stack ? ` (fallback: ${f.fallback_stack})` : ''}`).join('; ')
    : client.brand_fonts?.length
      ? (client.brand_fonts as string[]).join(', ')
      : 'Clean modern sans-serif (like Inter, SF Pro, or Helvetica Neue)';

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

  let generatedImageUrl: string | undefined;

  if (selectedModel === 'dalle3' || selectedModel === 'gpt-image-1.5') {
    const modelName = selectedModel === 'gpt-image-1.5' ? 'gpt-image-1' : 'dall-e-3';
    const requestBody: Record<string, unknown> = { model: modelName, prompt, n: 1, size: '1024x1280' };
    if (selectedModel === 'dalle3') {
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
      if (batchItemId) await supabase.from('image_batch_items').update({ status: 'pending' }).eq('id', batchItemId);
      log.warn('openai_failed', { status: response.status });
      return jsonResponse({ error: message });
    }
    const aiResponse = await response.json();
    const b64Data = aiResponse.data?.[0]?.b64_json;
    if (b64Data) generatedImageUrl = `data:image/png;base64,${b64Data}`;
  } else if (selectedModel === 'ideogram') {
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('rendering_speed', 'DEFAULT');
    formData.append('aspect_ratio', '4x5');
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
      signal: timeoutSignal(180_000),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let message = errorText;
      try { message = JSON.parse(errorText)?.error?.message ?? errorText; } catch { /* ignore */ }
      if (batchItemId) await supabase.from('image_batch_items').update({ status: 'pending' }).eq('id', batchItemId);
      log.warn('ideogram_failed', { status: response.status });
      return jsonResponse({ error: message });
    }
    const aiResponse = await response.json();
    const imageUrl = aiResponse.data?.[0]?.url;
    if (imageUrl) {
      const imageResponse = await fetch(imageUrl, { signal: timeoutSignal(60_000) });
      const buffer = await imageResponse.arrayBuffer();
      generatedImageUrl = `data:image/png;base64,${bytesToBase64(new Uint8Array(buffer))}`;
    }
  } else {
    // nano-banana / nano-banana-2 — same Google Gemini image preview model.
    const geminiModel = 'gemini-3.1-flash-image-preview';
    const parts: Array<Record<string, unknown>> = [{ text: prompt }];
    if (brandLogoUrl) {
      try {
        const { data, mimeType } = await fetchAsBase64(brandLogoUrl);
        parts.push({ inlineData: { mimeType, data } });
      } catch (err) {
        log.warn('logo_fetch_failed', { error: err instanceof Error ? err.message : String(err) });
      }
    }
    for (const refImage of allReferenceImages) {
      try {
        if (refImage.startsWith('data:')) {
          const mimeMatch = refImage.match(/^data:(image\/\w+);base64,/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
          parts.push({ inlineData: { mimeType, data: refImage.split(',')[1] } });
        } else {
          const { data, mimeType } = await fetchAsBase64(refImage);
          parts.push({ inlineData: { mimeType, data } });
        }
      } catch (err) {
        log.warn('ref_image_fetch_failed', { error: err instanceof Error ? err.message : String(err) });
      }
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${googleApiKey}`;
    const MAX_RETRIES = 5;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const waitMs = Math.min(15_000 * attempt, 60_000);
        await new Promise((r) => setTimeout(r, waitMs));
      }
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } }),
        signal: timeoutSignal(180_000),
      });
      if (response.status === 429) {
        if (attempt === MAX_RETRIES) {
          if (batchItemId) await supabase.from('image_batch_items').update({ status: 'pending' }).eq('id', batchItemId);
          throw rateLimited('Image generation is busy. Please try again in a few minutes.');
        }
        continue;
      }
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        log.error('google_failed', undefined, { status: response.status, body: errorText.slice(0, 500) });
        throw upstream(`Google API error: ${response.status}`, 502);
      }
      const aiResponse = await response.json();
      const candidates = aiResponse.candidates;
      if (candidates?.[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData) {
            generatedImageUrl = `data:${part.inlineData.mimeType ?? 'image/png'};base64,${part.inlineData.data}`;
            break;
          }
        }
      }
      if (generatedImageUrl) break;
      if (attempt === MAX_RETRIES) log.error('google_no_image_after_retries');
    }
  }

  if (!generatedImageUrl) {
    if (batchItemId) await supabase.from('image_batch_items').update({ status: 'pending' }).eq('id', batchItemId);
    return jsonResponse({ error: 'Image generation failed. The AI model did not return an image. Please try a different prompt or switch to another model.' });
  }

  const r2Result = await uploadToR2(generatedImageUrl, { folder: `${clientId}/batch` });
  const finalImageUrl = r2Result.url;

  if (batchItemId) {
    const { data: batchItem } = await supabase
      .from('image_batch_items')
      .select('attempts, generated_image_url, model_used, feedback')
      .eq('id', batchItemId)
      .maybeSingle();

    // Save the existing image as a revision before overwriting.
    if (batchItem?.generated_image_url) {
      const { data: existingRevisions } = await supabase
        .from('image_batch_revisions')
        .select('version')
        .eq('batch_item_id', batchItemId)
        .order('version', { ascending: false })
        .limit(1);
      const nextVersion = (existingRevisions?.[0]?.version ?? 0) + 1;
      const { error: revisionError } = await supabase.from('image_batch_revisions').insert({
        batch_item_id: batchItemId,
        version: nextVersion,
        image_url: batchItem.generated_image_url,
        model_used: batchItem.model_used,
        feedback: batchItem.feedback,
      });
      if (revisionError) log.warn('revision_insert_failed', { error: revisionError.message });
    }

    await supabase.from('image_batch_items').update({
      generated_image_url: finalImageUrl,
      status: 'pending',
      attempts: (batchItem?.attempts ?? 0) + 1,
      feedback: feedback ?? null,
      model_used: selectedModel,
    }).eq('id', batchItemId);
  }

  log.info('batch_image_generated', { clientId, batchItemId, model: selectedModel, uploaded: r2Result.uploaded });

  return jsonResponse({ success: true, imageUrl: finalImageUrl, batchItemId, modelUsed: selectedModel });
}));
