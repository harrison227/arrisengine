-- Create contract_share_links table for shareable contract signing links
CREATE TABLE public.contract_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id TEXT NOT NULL UNIQUE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID NOT NULL
);

-- Create contract_signatures table for capturing signatures with audit trail
CREATE TABLE public.contract_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  signer_role TEXT NOT NULL CHECK (signer_role IN ('agency', 'client')),
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signer_title TEXT,
  intent_confirmed BOOLEAN NOT NULL DEFAULT false,
  consent_to_electronic BOOLEAN NOT NULL DEFAULT false,
  signature_data TEXT,
  signature_type TEXT CHECK (signature_type IN ('draw', 'type', 'upload')),
  signed_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add signed_pdf_url column to contracts table
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS signed_pdf_url TEXT;

-- Enable RLS on new tables
ALTER TABLE public.contract_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contract_share_links
CREATE POLICY "Contract owners can manage share links"
ON public.contract_share_links
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.contracts
    WHERE contracts.id = contract_share_links.contract_id
    AND contracts.user_id = auth.uid()
  )
);

CREATE POLICY "Public can view active share links"
ON public.contract_share_links
FOR SELECT
USING (is_active = true);

-- RLS Policies for contract_signatures
CREATE POLICY "Contract owners can view signatures"
ON public.contract_signatures
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contracts
    WHERE contracts.id = contract_signatures.contract_id
    AND contracts.user_id = auth.uid()
  )
);

CREATE POLICY "Public can view signatures via active share link"
ON public.contract_signatures
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.contract_share_links
    WHERE contract_share_links.contract_id = contract_signatures.contract_id
    AND contract_share_links.is_active = true
  )
);

CREATE POLICY "Public can insert signatures via active share link"
ON public.contract_signatures
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.contract_share_links
    WHERE contract_share_links.contract_id = contract_signatures.contract_id
    AND contract_share_links.is_active = true
  )
);

-- Create indexes for performance
CREATE INDEX idx_contract_share_links_share_id ON public.contract_share_links(share_id);
CREATE INDEX idx_contract_share_links_contract_id ON public.contract_share_links(contract_id);
CREATE INDEX idx_contract_signatures_contract_id ON public.contract_signatures(contract_id);