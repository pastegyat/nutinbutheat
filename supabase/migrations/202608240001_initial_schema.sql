-- The Worker is the sole database client. Appwrite document IDs are preserved as text.
create table public.posts (
  id text primary key,
  title text not null,
  slug text not null unique,
  description text not null default '',
  image_url text not null default '',
  category text not null default '',
  is_premium text not null default 'no' check (is_premium in ('yes', 'no')),
  status text not null default 'public' check (status in ('public', 'private')),
  views bigint not null default 0 check (views >= 0),
  link_clicks bigint not null default 0 check (link_clicks >= 0),
  created_at timestamptz not null default now()
);

create table public.albums (
  id text primary key,
  title text not null,
  slug text not null unique,
  description text not null default '',
  thumbnail text not null default '',
  is_premium text not null default 'no' check (is_premium in ('yes', 'no')),
  view_count bigint not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now()
);

create table public.album_items (
  id text primary key,
  album_id text not null references public.albums(id) on delete cascade,
  type text not null check (type in ('image', 'video')),
  title text not null default '',
  r2_url text not null,
  thumbnail text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.reactions (
  id text primary key,
  post_id text not null references public.posts(id) on delete cascade,
  visitor_hash text not null,
  type text not null check (type in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  unique (post_id, visitor_hash)
);

create table public.post_events (
  id text primary key,
  post_id text not null references public.posts(id) on delete cascade,
  visitor_hash text not null,
  event_type text not null check (event_type in ('view', 'link_click')),
  created_at timestamptz not null default now(),
  unique (post_id, visitor_hash, event_type)
);

create table public.analytics (
  id text primary key,
  path text not null,
  search_term text not null default '',
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default now()
);

create table public.contact_messages (
  id text primary key,
  name text not null,
  email text not null,
  reason text not null,
  message text not null,
  ip_address text not null,
  created_at timestamptz not null default now()
);

create index posts_public_created_idx on public.posts (created_at desc) where status = 'public';
create index posts_status_created_idx on public.posts (status, created_at desc);
create index album_items_album_sort_idx on public.album_items (album_id, sort_order, id);
create index reactions_post_idx on public.reactions (post_id);
create index post_events_post_idx on public.post_events (post_id);
create index analytics_created_idx on public.analytics (created_at desc);
create index analytics_path_created_idx on public.analytics (path, created_at desc);
create index contact_messages_ip_created_idx on public.contact_messages (ip_address, created_at desc);

-- The service-role key held by the Worker bypasses RLS. No browser policies are created.
alter table public.posts enable row level security;
alter table public.albums enable row level security;
alter table public.album_items enable row level security;
alter table public.reactions enable row level security;
alter table public.post_events enable row level security;
alter table public.analytics enable row level security;
alter table public.contact_messages enable row level security;

create or replace function public.record_post_event(p_post_id text, p_visitor_hash text, p_event_type text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare inserted_rows integer;
begin
  insert into post_events (id, post_id, visitor_hash, event_type)
  values (md5(p_post_id || ':' || p_visitor_hash || ':' || p_event_type), p_post_id, p_visitor_hash, p_event_type)
  on conflict (post_id, visitor_hash, event_type) do nothing;
  get diagnostics inserted_rows = row_count;
  if inserted_rows > 0 then
    update posts
    set views = views + case when p_event_type = 'view' then 1 else 0 end,
        link_clicks = link_clicks + case when p_event_type = 'link_click' then 1 else 0 end
    where id = p_post_id;
  end if;
  return inserted_rows > 0;
end;
$$;

create or replace function public.toggle_reaction(p_post_id text, p_visitor_hash text, p_type text)
returns table (likes bigint, dislikes bigint)
language plpgsql
security definer
set search_path = public
as $$
declare existing_type text;
begin
  select type into existing_type from reactions where post_id = p_post_id and visitor_hash = p_visitor_hash for update;
  if existing_type = p_type then
    delete from reactions where post_id = p_post_id and visitor_hash = p_visitor_hash;
  elsif existing_type is null then
    insert into reactions (id, post_id, visitor_hash, type)
    values (md5(p_post_id || ':' || p_visitor_hash), p_post_id, p_visitor_hash, p_type);
  else
    update reactions set type = p_type where post_id = p_post_id and visitor_hash = p_visitor_hash;
  end if;
  return query select count(*) filter (where type = 'like'), count(*) filter (where type = 'dislike') from reactions where post_id = p_post_id;
end;
$$;

revoke all on all tables in schema public from anon, authenticated;
revoke all on function public.record_post_event(text, text, text) from public;
revoke all on function public.toggle_reaction(text, text, text) from public;
