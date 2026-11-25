-- Add visitor_hash to analytics for unique visitor tracking
ALTER TABLE public.analytics ADD COLUMN IF NOT EXISTS visitor_hash text not null default '';
CREATE INDEX IF NOT EXISTS analytics_visitor_date_idx ON public.analytics (visitor_hash, created_at desc);
