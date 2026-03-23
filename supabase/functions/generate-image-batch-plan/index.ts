import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, clientId, referenceStyle, referenceImages, count = 30 } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch client info
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (!client) {
      throw new Error('Client not found');
    }

    // Fetch knowledge base
    const { data: knowledgeEntries } = await supabase
      .from('knowledge_entries')
      .select('*')
      .eq('client_id', clientId);

    const { data: knowledgeSummary } = await supabase
      .from('knowledge_summary')
      .select('*')
      .eq('client_id', clientId)
      .single();

    const knowledgeContext = knowledgeEntries?.map(entry => 
      `[${entry.category.toUpperCase()}] ${entry.title}: ${entry.content}`
    ).join('\n\n') || 'No knowledge base available.';

    const summaryContext = knowledgeSummary ? `
Brand Positioning: ${knowledgeSummary.positioning_summary || 'Not defined'}
Key Differentiators: ${knowledgeSummary.key_differentiators?.join(', ') || 'Not defined'}
Ideal Customer: ${knowledgeSummary.ideal_customer_profile || 'Not defined'}
` : '';

    // Build reference images context
    const hasReferenceImages = referenceImages && referenceImages.length > 0;
    const referenceContext = hasReferenceImages 
      ? `\n\nREFERENCE IMAGES PROVIDED: ${referenceImages.length} style reference image(s) have been uploaded. The image generation step will use these for visual style guidance.`
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

    console.log('Generating enhanced image batch plan...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
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
          JSON.stringify({ error: 'API credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error('AI request failed');
    }

    const aiResponse = await response.json();
    let content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Clean and parse JSON
    content = content.trim();
    if (content.startsWith('```json')) {
      content = content.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (content.startsWith('```')) {
      content = content.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    let concepts;
    try {
      concepts = JSON.parse(content);
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Failed to parse content concepts');
    }

    // Insert batch items into database with simplified concept data
    // Handle carousel posts by creating multiple linked items
    if (sessionId) {
      const insertItems: any[] = [];
      let sequenceNumber = 0;

      for (const concept of concepts) {
        sequenceNumber++;
        
        // Check if this is a carousel with slides
        if (concept.templateType === 'tip_carousel' && concept.slides && Array.isArray(concept.slides) && concept.slides.length >= 3) {
          // Generate a carousel group ID to link all slides
          const carouselGroupId = crypto.randomUUID();
          
          console.log(`Creating carousel with ${concept.slides.length} slides, group: ${carouselGroupId}`);
          
          // Create an item for each slide in the carousel
          for (let slideIndex = 0; slideIndex < concept.slides.length; slideIndex++) {
            const slide = concept.slides[slideIndex];
            insertItems.push({
              session_id: sessionId,
              sequence_number: (sequenceNumber * 1000) + slideIndex, // e.g., 5000, 5001, 5002 (integers only)
              concept: JSON.stringify({
                description: slide.description || `Carousel slide ${slideIndex + 1}: ${concept.concept}`,
                textOverlay: slide.textOverlay || concept.textOverlay,
                caption: concept.caption,
                hashtags: concept.hashtags,
                slideNumber: slideIndex + 1,
                totalSlides: concept.slides.length,
                carouselTitle: concept.concept
              }),
              template_type: concept.templateType,
              platform: concept.platform,
              status: 'pending',
              carousel_group_id: carouselGroupId
            });
          }
        } else {
          // Non-carousel item - insert as normal
          insertItems.push({
            session_id: sessionId,
            sequence_number: sequenceNumber * 1000, // e.g., 5000 (integers only)
            concept: JSON.stringify({
              description: concept.concept,
              textOverlay: concept.textOverlay,
              caption: concept.caption,
              hashtags: concept.hashtags
            }),
            template_type: concept.templateType,
            platform: concept.platform,
            status: 'pending',
            carousel_group_id: null
          });
        }
      }

      // Insert all items
      const { error: insertError } = await supabase
        .from('image_batch_items')
        .insert(insertItems);

      if (insertError) {
        console.error('Failed to insert batch items:', insertError);
        throw new Error('Failed to save concepts to database');
      }

      console.log(`Inserted ${insertItems.length} batch items (includes carousel slides)`);

      // Update session with concepts
      await supabase
        .from('ai_sessions')
        .update({
          session_data: { concepts, generatedAt: new Date().toISOString() }
        })
        .eq('id', sessionId);
    }

    console.log(`Generated ${concepts.length} enhanced image concepts`);

    return new Response(
      JSON.stringify({ success: true, concepts, count: concepts.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-image-batch-plan:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
