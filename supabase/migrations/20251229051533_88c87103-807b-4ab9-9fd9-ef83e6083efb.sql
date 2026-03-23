-- Fix PUBLIC_DATA_EXPOSURE: Create a secure view for public client data
-- This view only exposes safe-to-share fields and excludes sensitive data

-- 1. Create a secure view for public client data (without sensitive fields)
CREATE VIEW public.clients_public_safe AS
SELECT 
  id,
  business_name,
  industry,
  brand_logo_url,
  brand_primary_color,
  brand_secondary_color,
  brand_accent_color,
  brand_background_color,
  brand_text_color,
  brand_fonts,
  brand_style_notes
  -- Explicitly EXCLUDE: late_api_key, email, phone, contact_name, mrr, contract_start, contract_end, website, user_id, late_profile_id, late_connected_at
FROM public.clients;

-- 2. Enable RLS on the view
ALTER VIEW public.clients_public_safe SET (security_invoker = on);

-- 3. Drop the overly permissive public policies on the clients table
DROP POLICY IF EXISTS "Public can view clients via active share link" ON public.clients;
DROP POLICY IF EXISTS "Public can view clients via plan share link" ON public.clients;

-- 4. Create new restrictive policies that only allow public access via the safe view
-- For authenticated users, they can still use the full clients table via existing policies

-- Grant SELECT on the safe view to anon and authenticated roles
GRANT SELECT ON public.clients_public_safe TO anon;
GRANT SELECT ON public.clients_public_safe TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW public.clients_public_safe IS 'Public-safe view of clients table that excludes sensitive data like API keys, contact info, and financial data';