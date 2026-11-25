-- Simple +1 (non-unique) counters for post views and link clicks.
-- Each call increments unconditionally; no post_events row, no visitor dedup.
-- record_post_event() is left untouched for backwards compatibility.
create or replace function public.increment_post_view(p_post_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update posts set views = views + 1 where id = p_post_id;
end;
$$;

create or replace function public.increment_post_link_click(p_post_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update posts set link_clicks = link_clicks + 1 where id = p_post_id;
end;
$$;
