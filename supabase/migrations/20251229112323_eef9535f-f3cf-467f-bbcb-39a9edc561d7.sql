-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Public can view client info via contract share link" ON public.clients;

-- Create a SECURITY DEFINER function to safely check for active contract share links
-- This breaks the recursion because SECURITY DEFINER functions bypass RLS checks inside
CREATE OR REPLACE FUNCTION public.has_active_contract_share_link_for_client(client_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.contract_share_links csl ON csl.contract_id = c.id
    WHERE c.client_id = client_uuid
    AND csl.is_active = true
  );
END;
$$;

-- Create new policy on clients using the SECURITY DEFINER function
CREATE POLICY "Public can view client info via contract share link"
ON public.clients FOR SELECT
USING (
  public.has_active_contract_share_link_for_client(id)
);