import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation helpers
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    // Only allow http and https protocols
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeUrl(url: string): string {
  // Remove any control characters and trim
  return url.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

// Block internal/private IP ranges to prevent SSRF
function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    
    // Block localhost and private IPs
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
      return true;
    }
    
    // Block private IP ranges
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/i,
      /^fe80:/i,
    ];
    
    for (const range of privateRanges) {
      if (range.test(hostname)) {
        return true;
      }
    }
    
    // Block internal domains
    const blockedDomains = ['internal', 'intranet', 'localhost', 'local'];
    for (const domain of blockedDomains) {
      if (hostname.includes(domain)) {
        return true;
      }
    }
    
    return false;
  } catch {
    return true; // If we can't parse it, block it
  }
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

    const { url } = body;

    // Validate URL presence
    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL length (prevent oversized requests)
    if (url.length > 2048) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL exceeds maximum length of 2048 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize and format URL
    let formattedUrl = sanitizeUrl(url);
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Validate URL format
    if (!isValidUrl(formattedUrl)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Block private/internal URLs (SSRF prevention)
    if (isPrivateUrl(formattedUrl)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Access to private or internal URLs is not allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping client website:', formattedUrl);

    // First, get the sitemap to find key pages
    const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        limit: 20,
        includeSubdomains: false,
      }),
    });

    const mapData = await mapResponse.json();
    console.log('Map result received');

    // Get main page with branding and content
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'branding'],
        onlyMainContent: true,
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok) {
      console.error('Firecrawl scrape error:', scrapeData);
      return new Response(
        JSON.stringify({ success: false, error: scrapeData.error || 'Failed to scrape website' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find and scrape key pages (about, services, products)
    const keyPageKeywords = ['about', 'service', 'product', 'pricing', 'team', 'contact'];
    const siteLinks = mapData.links || [];
    const keyPages: string[] = [];
    
    for (const link of siteLinks) {
      // Validate each discovered link before adding
      if (typeof link === 'string' && isValidUrl(link) && !isPrivateUrl(link)) {
        const lowerLink = link.toLowerCase();
        if (keyPageKeywords.some(keyword => lowerLink.includes(keyword)) && keyPages.length < 5) {
          keyPages.push(link);
        }
      }
    }

    // Scrape key pages
    const additionalContent: Array<{ url: string; markdown: string }> = [];
    
    for (const pageUrl of keyPages) {
      try {
        console.log('Scraping additional page:', pageUrl);
        const pageResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: pageUrl,
            formats: ['markdown'],
            onlyMainContent: true,
          }),
        });

        const pageData = await pageResponse.json();
        if (pageData.success && pageData.data?.markdown) {
          additionalContent.push({
            url: pageUrl,
            markdown: pageData.data.markdown,
          });
        }
      } catch (e) {
        console.error('Error scraping page:', pageUrl, e);
      }
    }

    const result = {
      success: true,
      data: {
        mainPage: {
          url: formattedUrl,
          markdown: scrapeData.data?.markdown || '',
          branding: scrapeData.data?.branding || null,
          metadata: scrapeData.data?.metadata || {},
        },
        additionalPages: additionalContent,
        siteLinks: siteLinks.slice(0, 50),
      }
    };

    console.log('Scrape completed successfully');
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in scrape-client-website:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
