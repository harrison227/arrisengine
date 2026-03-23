-- Create contract_templates table to store the Arris Studios template
CREATE TABLE public.contract_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own templates" 
ON public.contract_templates 
FOR SELECT 
USING (auth.uid() = user_id OR is_default = true);

CREATE POLICY "Users can create their own templates" 
ON public.contract_templates 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates" 
ON public.contract_templates 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates" 
ON public.contract_templates 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_contract_templates_updated_at
BEFORE UPDATE ON public.contract_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the default Arris Studios template
INSERT INTO public.contract_templates (name, content, is_default, user_id) VALUES (
  'Arris Studios Service Agreement',
  E'SERVICE AGREEMENT\n\nThis Service Agreement (the "Agreement") is made effective as of [EFFECTIVE DATE] (the "Effective Date"), by and between Arris Studios (the "Provider") and [CLIENT] (the "Client").\n\n1. DEFINITIONS\n\n1.1 Provider:\nRefers to Arris Studios, a marketing agency.\n\n1.2 Client:\nRefers to [CLIENT], the entity receiving the Services.\n\n1.3 Services:\nMarketing services provided by Arris Studios as defined in this Agreement and any Statement of Work ("SOW").\n\n1.4 Deliverables:\nOutputs provided by Arris Studios under this Agreement or an SOW.\n\n1.5 Term:\nCommences on the Effective Date and concludes on [END DATE], unless earlier terminated.\n\n2. SCOPE OF SERVICES\n\n2.1 Services Provided.\nArris Studios shall provide marketing services which may include strategic planning, content planning, execution, monitoring, and reporting, as agreed in writing.\n\n2.2 Scope Limitation.\nServices do not include website development, paid advertising media buying, email marketing, CRM setup, funnel building, sales copywriting, brand identity development, or any services not expressly agreed in writing.\n\n2.3 Change Requests.\nOut-of-scope requests require written approval and may result in additional fees, revised timelines, or a separate agreement.\n\n3. DELIVERABLES, REVISIONS, AND TIMELINE\n\n3.1 Deliverables.\nDeliverables may include social media marketing activities such as content creation, scheduling, posting, community management, and performance reporting.\n\n3.2 Revision Policy.\n[CLIENT] may request revisions to Deliverables. Revision requests are not capped, provided they are reasonable, relate to the original scope, and do not constitute a change in strategy or scope. Revisions requiring new concepts, directions, or deliverables may be treated as a change request.\n\n3.3 No Guaranteed Results.\n[CLIENT] acknowledges that marketing outcomes are inherently uncertain. Arris Studios makes no guarantees regarding reach, engagement, leads, revenue, or growth metrics.\n\n3.4 Timeline.\nDeliverables are provided on an ongoing basis during the Term. Specific timelines will be agreed in writing where applicable.\n\n4. CLIENT RESPONSIBILITIES\n\n4.1 Client Cooperation.\n[CLIENT] shall provide timely access, approvals, content, assets, feedback, and information reasonably required.\n\n4.2 Client Delays.\nArris Studios is not responsible for delays, reduced performance, or missed timelines caused by [CLIENT]''s failure to provide required inputs.\n\n5. COMPENSATION AND PAYMENT\n\n5.1 Fees.\n[CLIENT] agrees to pay Arris Studios a monthly retainer of [MONTHLY FEE], unless otherwise agreed in writing.\n\n5.2 Upfront Payment.\nThe first month''s retainer is due immediately upon signing of this Agreement and must be paid before Services commence.\n\n5.3 Ongoing Payments.\nSubsequent monthly fees are due within seven (7) days of invoice date.\n\n5.4 Late Payments.\nOverdue amounts accrue interest at 1.5% per month or the maximum rate permitted by law. [CLIENT] is responsible for reasonable collection costs.\n\n5.5 Suspension for Non-Payment.\nArris Studios may immediately suspend Services if any invoice is more than seven (7) days overdue, without liability.\n\n6. INTELLECTUAL PROPERTY\n\n6.1 Ownership of Deliverables.\nUpon full payment, Deliverables created exclusively for [CLIENT] become the property of [CLIENT].\n\n6.2 Provider Materials.\nArris Studios retains ownership of all pre-existing tools, systems, methodologies, templates, and processes ("Provider Materials"). [CLIENT] receives a non-exclusive, non-transferable license to use Provider Materials solely with the Deliverables.\n\n6.3 Client Materials.\n[CLIENT] represents it owns or has rights to all materials provided and grants Arris Studios a license to use them solely to perform Services.\n\n6.4 Portfolio and Case Study Rights.\nArris Studios may reference [CLIENT]''s name, logo, and non-confidential Deliverables for portfolio, marketing, promotional, and case study purposes unless [CLIENT] provides written objection.\n\n7. CONFIDENTIALITY\n\n7.1 Confidential Information.\nEach party agrees to protect the other party''s confidential information and use it solely for this Agreement.\n\n7.2 Exclusions.\nConfidential Information does not include information that is public, independently developed, or lawfully obtained from a third party.\n\n7.3 Return or Destruction.\nUpon termination, confidential information shall be returned or destroyed upon request.\n\n8. TERM AND TERMINATION\n\n8.1 Term.\nThis Agreement remains in effect for the fixed Term unless terminated as provided herein.\n\n8.2 Termination for Cause.\nEither party may terminate if a material breach is not cured within thirty (30) days of written notice.\n\n8.3 No Termination for Convenience.\nNeither party may terminate for convenience during the fixed Term.\n\n8.4 Professional Conduct.\nArris Studios may terminate immediately if [CLIENT] engages in abusive, threatening, or unprofessional conduct.\n\n8.5 Effect of Termination.\n[CLIENT] must pay for all Services rendered up to termination. Survival clauses remain in effect.\n\n9. LIMITATION OF LIABILITY\n\n9.1 Exclusion of Damages.\nArris Studios is not liable for indirect, incidental, special, consequential, or punitive damages.\n\n9.2 Liability Cap.\nTotal liability shall not exceed fees paid by [CLIENT] in the three (3) months preceding the claim.\n\n9.3 Third-Party Platforms.\nArris Studios is not liable for actions by third-party platforms (e.g., account suspensions, algorithm changes, policy enforcement).\n\n10. FORCE MAJEURE\n\nNeither party shall be liable for failure or delay in performance caused by events beyond reasonable control, including but not limited to natural disasters, pandemics, government actions, labor disputes, power outages, or internet failures.\n\n11. DISPUTE RESOLUTION\n\n11.1 Good Faith Resolution.\nThe parties agree to attempt to resolve disputes through good-faith discussions.\n\n11.2 Mediation First.\nIf unresolved, disputes shall be submitted to non-binding mediation before either party may initiate litigation.\n\n11.3 Litigation.\nLitigation may only proceed if mediation fails.\n\n12. GENERAL PROVISIONS\n\n12.1 Independent Contractors.\nThe parties are independent contractors.\n\n12.2 Governing Law.\nThis Agreement is governed by the laws of [GOVERNING JURISDICTION].\n\n12.3 Amendments.\nAmendments must be in writing and signed by both parties.\n\n12.4 Entire Agreement.\nThis Agreement constitutes the entire agreement between Arris Studios and [CLIENT].\n\n12.5 Severability.\nIf any provision is unenforceable, the remaining provisions remain effective.\n\n\nIN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.\n\n\nPROVIDER:\nArris Studios\n\nSignature: ____________________________\nName: ________________________________\nTitle: ________________________________\nDate: ________________________________\n\n\nCLIENT:\n[CLIENT]\n\nSignature: ____________________________\nName: ________________________________\nTitle: ________________________________\nDate: ________________________________',
  true,
  NULL
);

-- Add governing_jurisdiction column to contracts table
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS governing_jurisdiction TEXT DEFAULT 'California, USA';