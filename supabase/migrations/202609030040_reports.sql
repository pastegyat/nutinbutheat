-- User-submitted post reports (Report button on post detail pages).
-- post_slug/post_title are snapshots so a report stays readable.
create table if not exists public.reports (
  id text primary key,
  post_id text references public.posts(id) on delete cascade,
  post_slug text not null default '',
  post_title text not null default '',
  reason text not null default '' check (char_length(reason) <= 2000),
  ip_address text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists reports_created_idx on public.reports (created_at desc);
create index if not exists reports_post_idx on public.reports (post_id);

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
