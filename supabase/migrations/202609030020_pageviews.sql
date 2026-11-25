-- Per-path counter tables replacing per-visit analytics rows for
-- Top Pages, Pageviews Today and the traffic graph.
-- pageviews.duration is the cumulative total of duration_ms across all visits;
-- average time on page is derived as duration / views.
create table if not exists public.pageviews (
  id text primary key,
  path text not null unique,
  duration bigint not null default 0 check (duration >= 0),
  views bigint not null default 0 check (views >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pageview_daily (
  path text not null,
  day date not null,
  views bigint not null default 0 check (views >= 0),
  duration bigint not null default 0 check (duration >= 0),
  primary key (path, day)
);

create index if not exists pageviews_views_idx on public.pageviews (views desc);
create index if not exists pageview_daily_day_idx on public.pageview_daily (day desc);

alter table public.pageviews enable row level security;
alter table public.pageview_daily enable row level security;
revoke all on public.pageviews from anon, authenticated;
revoke all on public.pageview_daily from anon, authenticated;

-- Backfill lifetime totals + daily buckets from historic analytics rows,
-- so existing Top Pages / Today / graph numbers carry over.
insert into public.pageviews (id, path, duration, views, created_at, updated_at)
select md5(path), path, coalesce(sum(duration_ms), 0)::bigint, count(*)::bigint,
  min(created_at), max(created_at)
from public.analytics
group by path
on conflict (path) do update set
  duration = public.pageviews.duration + excluded.duration,
  views = public.pageviews.views + excluded.views,
  updated_at = greatest(public.pageviews.updated_at, excluded.updated_at);

insert into public.pageview_daily (path, day, views, duration)
select path, (created_at at time zone 'UTC')::date as day, count(*)::bigint,
  coalesce(sum(duration_ms), 0)::bigint
from public.analytics
group by path, ((created_at at time zone 'UTC')::date)
on conflict (path, day) do update set
  views = public.pageview_daily.views + excluded.views,
  duration = public.pageview_daily.duration + excluded.duration;

-- Atomic +1 visit: upserts the lifetime row and today's daily bucket.
-- Returns the pageviews row id for later duration finalization.
create or replace function public.record_pageview(p_path text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_id text;
begin
  insert into pageviews (id, path, duration, views, created_at, updated_at)
  values (md5(p_path), p_path, 0, 1, now(), now())
  on conflict (path) do update set views = pageviews.views + 1, updated_at = now()
  returning id into v_id;
  insert into pageview_daily (path, day, views, duration)
  values (p_path, (now() at time zone 'UTC')::date, 1, 0)
  on conflict (path, day) do update set views = pageview_daily.views + 1;
  return v_id;
end;
$$;

-- Adds measured on-page time to the lifetime row and today's bucket for the path.
create or replace function public.add_pageview_duration(p_id text, p_ms integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_path text;
begin
  update pageviews set duration = duration + p_ms where id = p_id returning path into v_path;
  if v_path is null then return; end if;
  insert into pageview_daily (path, day, views, duration)
  values (v_path, (now() at time zone 'UTC')::date, 0, p_ms)
  on conflict (path, day) do update set duration = pageview_daily.duration + p_ms;
end;
$$;

revoke all on function public.record_pageview(text) from public;
revoke all on function public.add_pageview_duration(text, integer) from public;
