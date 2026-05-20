/**
 * Plan a batch of social-media image concepts for a client. Persists each
 * concept (and any carousel slides) into image_batch_items so the
 * downstream generate-batch-image function can render them.
 *
 * Contract preserved:
 *   Request:  { sessionId?, clientId, referenceStyle?, referenceImages?, count? = 30 }
 *   Response: { success, concepts, count }
 */

import { withErrorHandling, jsonResponse, parseJsonBody } from '../_shared/http.ts';
import { notFound, upstream } from '../_shared/errors.ts';
import { ensureNumber, ensureOptionalArray, ensureOptionalString, ensureOptionalUuid, ensureUuid } from '../_shared/validation.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';
import { requireClientAccess } from '../_shared/auth.ts';
import { callGemini } from '../_shared/gemini.ts';

interface CarouselSlide { slideNumber?: number; description?: string; textOverlay?: string }
interface Concept {
  sequence?: number;
  concept: string;
  textOverlay?: string;
  templateType: string;
  platform?: string;
  caption?: string;
  hashtags?: string[];
  slides?: CarouselSlide[];
}

interface RequestBody {
  sessionId?: unknown;
  clientId: unknown;
  referenceStyle?: unknown;
  referenceImages?: unknown;
  count?: unknown;
}

Deno.serve(withErrorHandling({ fn: 'generate-image-batch-plan' }, async ({ req, log }) => {
  const body = await parseJsonBody<RequestBody>(req);
  const sessionId = ensureOptionalUuid('sessionId', body.sessionId);
  const clientId = ensureUuid('clientId', body.clientId);
  const referenceStyle = ensureOptionalString('referenceStyle', body.referenceStyle, 5_000);
  const referenceImages = ensureOptionalArray('referenceImages', body.referenceImages, () => undefined, { max: 50 });
  const count = body.count === undefined ? 30 : ensureNumber('count', body.count, { integer: true, min: 1, max: 100 });

  await requireClientAccess(req, clientId);

  const supabase = getSupabaseAdmin();
  const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
  if (!client) throw notFound('Client not found');

  const [{ data: knowledgeEntries }, { data: knowledgeSummary }] = await Promise.all([
    supabase.from('knowledge_entries').select('*').eq('client_id', clientId),
    supabase.from('knowledge_summary').select('*').eq('client_id', clientId).maybeSingle(),
  ]);

  const knowledgeContext = (knowledgeEntries ?? [])
    .map((entry) => `[${(entry.category as string).toUpperCase()}] ${entry.title}: ${entry.content}`)
    .join('\n\n') || 'No knowledge base available.';
  const summaryContext = knowledgeSummary ? `
Brand Positioning: ${knowledgeSummary.positioning_summary ?? 'Not defined'}
Key Differentiators: ${(knowledgeSummary.key_differentiators ?? []).join(', ') || 'Not defined'}
Ideal Customer: ${knowledgeSummary.ideal_customer_profile ?? 'Not defined'}
` : '';

  const hasReferenceImages = (referenceImages?.length ?? 0) > 0;
  const referenceContext = hasReferenceImages
    ? `\n\nREFERENCE IMAGES PROVIDED: ${referenceImages?.length} style reference image(s) have been uploaded. The image generation step will use these for visual style guidance.`
    : '';

  const systemPrompt = `You are a creative director generating social media content ideas. Your job is to create ${count} simple, clear content concepts that describe WHAT to post, not HOW it should look visually.

${hasReferenceImages ? `
⚠️ IMPORTANT: Reference images have been provided for visual style guidance.
- DO NOT describe colors, hex codes, layouts, or visual specifications
- The uploaded reference images will guide the visual style during image generation
- Focus ONLY on the content, message, and theme of each post
` : ''}

YOUR TASK:
Create simple, readable concept descriptions that a human can quickly understand. Each concept should describe:
- What type of post it is (testimonial, tip, quote, etc.)
- The topic or message
- Any specific text that should appear

TEMPLATE TYPES (distribute evenly):
- quote_card: Inspiring quotes, motivational messages
- stat_graphic: Key statistics, numbers that impress
- tip_carousel: Actionable tips, how-to content (IMPORTANT: For carousels, provide exactly 3 slides)
- testimonial: Customer success stories, reviews
- product_highlight: Feature showcases, benefits
- behind_scenes: Team content, process insights
- infographic: Step-by-step guides, processes
- announcement: News, launches, updates
- question_post: Engagement posts, polls, discussions
- lifestyle: Aspirational content, brand values

⚠️ SPECIAL INSTRUCTIONS FOR CAROUSELS (tip_carousel):
When creating a carousel post, you MUST provide a "slides" array with exactly 3 slide descriptions:
- Slide 1: Cover/hook slide that grabs attention
- Slide 2: Main content (tips, information, value)
- Slide 3: CTA slide with call-to-action

Return ONLY a valid JSON array with ${count} objects:
{
  "sequence": 1,
  "concept": "A simple, readable description of the post.",
  "textOverlay": "The actual text/quote that appears on the image (for non-carousels)",
  "templateType": "quote_card|stat_graphic|tip_carousel|testimonial|product_highlight|behind_scenes|infographic|announcement|question_post|lifestyle",
  "platform": "instagram|facebook|linkedin",
  "caption": "Engaging caption with hook and CTA",
  "hashtags": ["relevant", "hashtags", "5-7 max"],
  "slides": [
    { "slideNumber": 1, "description": "Cover slide description", "textOverlay": "Title text" },
    { "slideNumber": 2, "description": "Main content slide", "textOverlay": "Tips or content" },
    { "slideNumber": 3, "description": "CTA slide", "textOverlay": "Call to action text" }
  ]
}

NOTE: The "slides" array is ONLY required for tip_carousel template type. Omit it for other types.

CONCEPT GUIDELINES:
✓ Keep concepts under 50 words - simple and scannable
✓ Focus on CONTENT (what message/theme), not DESIGN (how it looks)
✓ Be specific to the brand's industry and audience
✓ Include a reference to using style images if provided
✓ Make each concept actionable and clear
✓ For carousels, create 3 complementary slide descriptions

❌ DO NOT INCLUDE:
- Hex color codes or color names
- Layout specifications (percentages, positions)
- Design details (gradients, shadows, fonts)
- Technical visual instructions

No markdown formatting, just the JSON array.`;

  const userPrompt = `Create ${count} simple content concepts for:

BUSINESS: ${client.business_name}
INDUSTRY: ${client.industry}
${client.website ? `WEBSITE: ${client.website}` : ''}

${summaryContext}

KNOWLEDGE BASE:
${knowledgeContext}
${referenceContext}
${referenceStyle ? `\nADDITIONAL NOTES: ${referenceStyle}` : ''}

Remember: Keep concepts simple and readable. Describe WHAT to create, not HOW it should look visually.${hasReferenceImages ? ' The reference images will handle the visual style.' : ''}`;

  const { text } = await callGemini({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    maxTokens: 8_192,
  });

  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');

  let concepts: Concept[];
  try {
    concepts = JSON.parse(cleaned);
    if (!Array.isArray(concepts)) throw new Error('not an array');
  } catch (err) {
    log.error('parse_failed', err, { head: cleaned.slice(0, 300) });
    throw upstream('Failed to parse content concepts');
  }

  if (sessionId) {
    const insertItems: Array<Record<string, unknown>> = [];
    let sequenceNumber = 0;

    for (const concept of concepts) {
      sequenceNumber++;
      if (concept.templateType === 'tip_carousel' && Array.isArray(concept.slides) && concept.slides.length >= 3) {
        const carouselGroupId = crypto.randomUUID();
        log.info('carousel_assembled', { slides: concept.slides.length, group: carouselGroupId });
        for (let slideIndex = 0; slideIndex < concept.slides.length; slideIndex++) {
          const slide = concept.slides[slideIndex];
          insertItems.push({
            session_id: sessionId,
            sequence_number: sequenceNumber * 1000 + slideIndex,
            concept: JSON.stringify({
              description: slide.description ?? `Carousel slide ${slideIndex + 1}: ${concept.concept}`,
              textOverlay: slide.textOverlay ?? concept.textOverlay,
              caption: concept.caption,
              hashtags: concept.hashtags,
              slideNumber: slideIndex + 1,
              totalSlides: concept.slides.length,
              carouselTitle: concept.concept,
            }),
            template_type: concept.templateType,
            platform: concept.platform,
            status: 'pending',
            carousel_group_id: carouselGroupId,
          });
        }
      } else {
        insertItems.push({
          session_id: sessionId,
          sequence_number: sequenceNumber * 1000,
          concept: JSON.stringify({
            description: concept.concept,
            textOverlay: concept.textOverlay,
            caption: concept.caption,
            hashtags: concept.hashtags,
          }),
          template_type: concept.templateType,
          platform: concept.platform,
          status: 'pending',
          carousel_group_id: null,
        });
      }
    }

    const { error } = await supabase.from('image_batch_items').insert(insertItems);
    if (error) throw new Error(error.message);
    await supabase.from('ai_sessions').update({ session_data: { concepts, generatedAt: new Date().toISOString() } }).eq('id', sessionId);
    log.info('batch_items_persisted', { count: insertItems.length });
  }

  log.info('plan_generated', { count: concepts.length });
  return jsonResponse({ success: true, concepts, count: concepts.length });
}));
