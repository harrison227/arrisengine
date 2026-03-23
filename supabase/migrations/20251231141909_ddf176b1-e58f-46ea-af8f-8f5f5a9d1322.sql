-- Add carousel_group_id column to group carousel slides together
ALTER TABLE public.image_batch_items
ADD COLUMN carousel_group_id UUID DEFAULT NULL;

-- Add index for efficient grouping
CREATE INDEX idx_image_batch_items_carousel_group ON public.image_batch_items(carousel_group_id) WHERE carousel_group_id IS NOT NULL;