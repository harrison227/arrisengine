import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation helpers
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function sanitizeString(str: unknown, maxLength = 10000): string {
  if (typeof str !== 'string') return '';
  // Remove control characters except newlines and tabs
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, maxLength);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { clientId, scrapedData, userId, action, clientName, knowledgeEntries } = body;

    // Handle analysis action
    if (action === 'analyze') {
      // Validate required fields for analysis
      if (!clientName || typeof clientName !== 'string') {
        return new Response(
          JSON.stringify({ success: false, error: 'clientName is required and must be a string' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!knowledgeEntries || typeof knowledgeEntries !== 'string') {
        return new Response(
          JSON.stringify({ success: false, error: 'knowledgeEntries is required for analysis' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
      if (!GOOGLE_AI_API_KEY) {
        throw new Error("GOOGLE_AI_API_KEY is not configured");
      }

      // Sanitize inputs for AI prompt
      const sanitizedClientName = sanitizeString(clientName, 200);
      const sanitizedKnowledgeEntries = sanitizeString(knowledgeEntries, 50000);

      console.log('Generating knowledge base analysis...');

      const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GOOGLE_AI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are an expert marketing strategist analyzing a client's knowledge base to generate actionable insights.

Based on the knowledge entries provided, generate:
1. A positioning summary (2-3 sentences on how this brand should position itself)
2. Key differentiators (3-5 unique selling points)
3. Content opportunities (3-5 specific content ideas or angles)
4. Compliance flags (any regulatory or legal considerations to keep in mind)
5. Ideal customer profile (brief description of the perfect customer)

Return a JSON object with this structure:
{
  "positioning": "Brief positioning statement...",
  "differentiators": ["Point 1", "Point 2", ...],
  "opportunities": ["Content idea 1", "Content idea 2", ...],
  "compliance": ["Compliance note 1", ...],
  "icp": "Description of ideal customer..."
}

Be specific and actionable. Base everything on the actual knowledge base content provided.`
            },
            {
              role: "user",
              content: `Analyze this knowledge base for ${sanitizedClientName}:\n\n${sanitizedKnowledgeEntries}`
            }
          ],
        }),
      });

      if (!aiResponse.ok) {
        throw new Error(`AI analysis failed: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      let result = {};
      
      const content = aiData.choices?.[0]?.message?.content;
      if (content) {
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error('Error parsing analysis response:', e);
        }
      }

      console.log('Analysis generated successfully');

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Original scraping flow - validate inputs
    if (!clientId || typeof clientId !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'clientId is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidUUID(clientId)) {
      return new Response(
        JSON.stringify({ success: false, error: 'clientId must be a valid UUID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!scrapedData || typeof scrapedData !== 'object') {
      return new Response(
        JSON.stringify({ success: false, error: 'scrapedData is required and must be an object' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate userId if provided
    if (userId && typeof userId === 'string' && !isValidUUID(userId)) {
      return new Response(
        JSON.stringify({ success: false, error: 'userId must be a valid UUID if provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) {
      throw new Error("GOOGLE_AI_API_KEY is not configured");
    }

    // Combine all scraped content with size limits
    let combinedContent = `# Main Page\n${sanitizeString(scrapedData.mainPage?.markdown, 30000)}\n\n`;
    
    if (Array.isArray(scrapedData.additionalPages)) {
      for (const page of scrapedData.additionalPages.slice(0, 10)) { // Limit to 10 pages
        if (page && typeof page.url === 'string' && typeof page.markdown === 'string') {
          combinedContent += `# ${sanitizeString(page.url, 500)}\n${sanitizeString(page.markdown, 10000)}\n\n`;
        }
      }
    }

    // Add branding info if available
    const branding = scrapedData.mainPage?.branding;
    if (branding && typeof branding === 'object') {
      combinedContent += `\n# Branding Information\n`;
      combinedContent += `Colors: ${JSON.stringify(branding.colors || {})}\n`;
      combinedContent += `Fonts: ${JSON.stringify(branding.fonts || [])}\n`;
      combinedContent += `Logo: ${sanitizeString(branding.logo, 500) || 'Not found'}\n`;
    }

    console.log('Sending content to AI for analysis...');

    // Use Lovable AI to analyze and categorize the content
    const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GOOGLE_AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert marketing strategist analyzing a client's website to build a comprehensive knowledge base. 
            
Extract and categorize information into these categories:
- brand: Company mission, values, unique selling points, brand voice, tone, visual identity
- audience: Target demographics, pain points, desires, customer segments
- competitors: Any mentioned competitors or industry context
- offers: Products/services, pricing, features, packages
- compliance: Industry disclaimers, legal requirements, terms, privacy policies
- notes: Any other relevant insights for content creation

Return a JSON object with this structure:
{
  "entries": [
    {
      "category": "brand" | "audience" | "competitors" | "offers" | "compliance" | "notes",
      "title": "Brief title for this insight",
      "content": "Detailed content/insight"
    }
  ]
}

Be thorough but concise. Create 5-15 entries covering all relevant information found.`
          },
          {
            role: "user",
            content: `Analyze this website content and extract knowledge base entries:\n\n${combinedContent.slice(0, 50000)}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_knowledge_entries",
              description: "Create knowledge base entries from website analysis",
              parameters: {
                type: "object",
                properties: {
                  entries: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { 
                          type: "string", 
                          enum: ["brand", "audience", "competitors", "offers", "compliance", "notes"] 
                        },
                        title: { type: "string" },
                        content: { type: "string" }
                      },
                      required: ["category", "title", "content"]
                    }
                  }
                },
                required: ["entries"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_knowledge_entries" } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    // Extract entries from tool call
    let entries: Array<{ category: string; title: string; content: string }> = [];
    
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        entries = parsed.entries || [];
      } catch (e) {
        console.error('Error parsing AI response:', e);
      }
    }

    if (entries.length === 0) {
      // Fallback: try to parse from content
      const content = aiData.choices?.[0]?.message?.content;
      if (content) {
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            entries = parsed.entries || [];
          }
        } catch (e) {
          console.error('Error parsing fallback content:', e);
        }
      }
    }

    // Validate and sanitize entries
    const validCategories = ['brand', 'audience', 'competitors', 'offers', 'compliance', 'notes'];
    entries = entries.filter(entry => 
      entry && 
      typeof entry.category === 'string' && 
      validCategories.includes(entry.category) &&
      typeof entry.title === 'string' && 
      typeof entry.content === 'string'
    ).map(entry => ({
      category: entry.category,
      title: sanitizeString(entry.title, 200),
      content: sanitizeString(entry.content, 5000)
    }));

    console.log(`Extracted ${entries.length} knowledge entries`);

    // Save entries to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const knowledgeEntriesToInsert = entries.map(entry => ({
      client_id: clientId,
      category: entry.category,
      title: entry.title,
      content: entry.content,
      created_by: userId && isValidUUID(userId) ? userId : null,
    }));

    if (knowledgeEntriesToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('knowledge_entries')
        .insert(knowledgeEntriesToInsert);

      if (insertError) {
        console.error('Error inserting knowledge entries:', insertError);
        throw insertError;
      }
    }

    // Store branding info as a special entry if available
    if (branding && typeof branding === 'object') {
      await supabase
        .from('knowledge_entries')
        .insert({
          client_id: clientId,
          category: 'brand',
          title: 'Visual Brand Identity',
          content: `Primary Color: ${sanitizeString(branding.colors?.primary, 50) || 'Not detected'}\n` +
                   `Secondary Color: ${sanitizeString(branding.colors?.secondary, 50) || 'Not detected'}\n` +
                   `Background: ${sanitizeString(branding.colors?.background, 50) || 'Not detected'}\n` +
                   `Fonts: ${Array.isArray(branding.fonts) ? branding.fonts.slice(0, 5).map((f: { family?: string }) => sanitizeString(f?.family, 50)).join(', ') : 'Not detected'}\n` +
                   `Logo URL: ${sanitizeString(branding.logo, 500) || 'Not found'}`,
          created_by: userId && isValidUUID(userId) ? userId : null,
        });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        entriesCreated: knowledgeEntriesToInsert.length + (branding ? 1 : 0),
        entries: knowledgeEntriesToInsert
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in build-knowledge-base:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
