-- Add Instagram first comment and collaborators columns to content_pieces
ALTER TABLE public.content_pieces 
ADD COLUMN instagram_first_comment text,
ADD COLUMN instagram_collaborators text[];