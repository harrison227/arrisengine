-- Add model_used column to track which AI model generated each image
ALTER TABLE public.image_batch_items ADD COLUMN model_used TEXT DEFAULT 'nano-banana';