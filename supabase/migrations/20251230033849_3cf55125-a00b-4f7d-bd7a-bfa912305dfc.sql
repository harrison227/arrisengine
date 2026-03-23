-- Add columns for recurring payment support
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'one_time',
ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS initial_payment_amount NUMERIC,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add check constraint for valid payment types
ALTER TABLE public.contracts
ADD CONSTRAINT contracts_payment_type_check 
CHECK (payment_type IN ('one_time', 'recurring'));

-- Add check constraint for valid billing intervals
ALTER TABLE public.contracts
ADD CONSTRAINT contracts_billing_interval_check 
CHECK (billing_interval IN ('weekly', 'monthly', 'yearly'));