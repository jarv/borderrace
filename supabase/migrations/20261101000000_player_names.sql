-- Initialize once per account. Concurrent logins must never overwrite a chosen name.
create function public.ensure_display_name(p_display_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare result text;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  insert into public.profiles(user_id, display_name)
    values (auth.uid(), btrim(p_display_name))
    on conflict (user_id) do nothing;
  select display_name into result from public.profiles where user_id = auth.uid();
  return result;
end;
$$;
revoke all on function public.ensure_display_name(text) from public, anon;
grant execute on function public.ensure_display_name(text) to authenticated;
