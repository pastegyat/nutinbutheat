ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS preview_image_url text NOT NULL DEFAULT '';
