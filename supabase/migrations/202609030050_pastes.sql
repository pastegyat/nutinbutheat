-- Admin-created text pastes. Views are counted server-side but never exposed
-- publicly; only the admin list reads the views column.
create table if not exists public.pastes (
  id text primary key,
  slug text not null unique check (char_length(slug) = 3),
  title text not null default '',
  content text not null default '' check (char_length(content) <= 20000),
  views bigint not null default 0 check (views >= 0),
  created_at timestamptz not null default now()
);

create index if not exists pastes_created_idx on public.pastes (created_at desc);

alter table public.pastes enable row level security;
revoke all on public.pastes from anon, authenticated;

-- Simple +1 (non-unique) counter for paste pageviews.
create or replace function public.increment_paste_view(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update pastes set views = views + 1 where slug = p_slug;
end;
$$;

revoke all on function public.increment_paste_view(text) from public;
