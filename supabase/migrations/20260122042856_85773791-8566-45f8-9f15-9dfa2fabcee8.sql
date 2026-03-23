-- Drop existing policies for late_account_mappings
DROP POLICY IF EXISTS "Users can view their own account mappings" ON public.late_account_mappings;
DROP POLICY IF EXISTS "Users can insert their own account mappings" ON public.late_account_mappings;
DROP POLICY IF EXISTS "Users can update their own account mappings" ON public.late_account_mappings;
DROP POLICY IF EXISTS "Users can delete their own account mappings" ON public.late_account_mappings;

-- Create new policies using has_client_access function which checks both ownership AND team assignments
CREATE POLICY "Users with client access can view account mappings" 
ON public.late_account_mappings 
FOR SELECT 
USING (
  public.has_client_access(auth.uid(), client_id) OR public.is_admin_or_owner(auth.uid())
);

CREATE POLICY "Users with client access can insert account mappings" 
ON public.late_account_mappings 
FOR INSERT 
WITH CHECK (
  public.has_client_access(auth.uid(), client_id) OR public.is_admin_or_owner(auth.uid())
);

CREATE POLICY "Users with client access can update account mappings" 
ON public.late_account_mappings 
FOR UPDATE 
USING (
  public.has_client_access(auth.uid(), client_id) OR public.is_admin_or_owner(auth.uid())
);

CREATE POLICY "Users with client access can delete account mappings" 
ON public.late_account_mappings 
FOR DELETE 
USING (
  public.has_client_access(auth.uid(), client_id) OR public.is_admin_or_owner(auth.uid())
);