-- Simple +1 (non-unique) counter for album views.
-- Each album detail visit increments unconditionally; existing counts accumulate.
create or replace function public.increment_album_view(p_album_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update albums set view_count = view_count + 1 where id = p_album_id;
end;
$$;

revoke all on function public.increment_album_view(text) from public;
