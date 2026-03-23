-- Add GST fields to contracts table
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS include_gst BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gst_percentage DECIMAL(5,2) DEFAULT 10.00;