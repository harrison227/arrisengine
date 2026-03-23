-- Fix infinite recursion on contracts RLS by using a SECURITY DEFINER helper function

-- 1) Drop the problematic policy that references contract_share_links directly
DROP POLICY IF EXISTS "Public can view contracts via active share link" ON public.contracts;

-- 2) Create a SECURITY DEFINER function that checks for an active share link
--    SECURITY DEFINER bypasses RLS inside the function, preventing circular policy evaluation.
CREATE OR REPLACE FUNCTION public.has_active_contract_share_link(contract_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contract_share_links csl
    WHERE csl.contract_id = contract_uuid
      AND csl.is_active = true
  );
$$;

-- 3) Recreate the policy using the function
CREATE POLICY "Public can view contracts via active share link"
ON public.contracts
FOR SELECT
USING (public.has_active_contract_share_link(id));
