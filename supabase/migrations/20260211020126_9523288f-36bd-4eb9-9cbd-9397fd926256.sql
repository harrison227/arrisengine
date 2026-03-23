
-- Add is_approved column to profiles, default false for new users
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- Approve all existing users
UPDATE public.profiles SET is_approved = true;
