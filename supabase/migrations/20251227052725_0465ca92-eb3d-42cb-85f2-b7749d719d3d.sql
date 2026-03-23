-- Add prompt_additions column to image_batch_items table
ALTER TABLE public.image_batch_items 
ADD COLUMN prompt_additions text;