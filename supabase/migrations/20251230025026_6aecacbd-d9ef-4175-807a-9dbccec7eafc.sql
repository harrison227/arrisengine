-- Add payment-related fields to contracts table for Stripe integration
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS payment_currency TEXT DEFAULT 'aud',
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'not_required',
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Add comment for payment_status values
COMMENT ON COLUMN public.contracts.payment_status IS 'Values: not_required, pending, processing, paid, failed';