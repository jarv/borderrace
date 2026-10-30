-- Browser-reported wins only. These functions enforce ownership, not anti-cheat.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (
    char_length(display_name) between 1 and 24
    and display_name = btrim(display_name)
    and display_name !~ '[[:cntrl:]]'
  )
);

create table public.score_submissions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null check (char_length(game_id) between 1 and 128),
  points integer not null,
  rules_version text not null check (rules_version = 'wins-v1'),
  submitted_at timestamptz not null default now(),
  unique (user_id, game_id)
);
create index score_submissions_day on public.score_submissions(submitted_at);
alter table public.profiles enable row level security;
alter table public.score_submissions enable row level security;
revoke all on public.profiles, public.score_submissions from anon, authenticated;
revoke all on sequence public.score_submissions_id_seq from anon, authenticated;
grant select on public.profiles to authenticated;
create policy own_profile on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));

create function public.set_display_name(p_display_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  insert into public.profiles(user_id, display_name)
    values (auth.uid(), btrim(p_display_name))
    on conflict (user_id) do update set display_name = excluded.display_name;
end;
$$;

create function public.submit_score(p_game_id text, p_points integer, p_rules_version text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  insert into public.score_submissions(user_id, game_id, points, rules_version)
    values (auth.uid(), p_game_id, p_points, p_rules_version)
    on conflict (user_id, game_id) do nothing;
end;
$$;

create function public.get_daily_leaderboard()
returns jsonb language sql stable security definer set search_path = '' as $$
  with day as (
    select date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' as starts
  ), totals as (
    select s.user_id, sum(s.points) as points
    from public.score_submissions s cross join day d
    where s.submitted_at >= d.starts and s.submitted_at < d.starts + interval '24 hours'
    group by s.user_id
  ), ranked as (
    select t.user_id, coalesce(p.display_name, 'Player') as display_name, t.points,
      dense_rank() over (order by t.points desc) as rank,
      row_number() over (order by t.points desc, coalesce(p.display_name, 'Player'), t.user_id) as position
    from totals t left join public.profiles p on p.user_id = t.user_id
  )
  select jsonb_build_object(
    'day', to_char(d.starts at time zone 'UTC', 'YYYY-MM-DD'),
    'server_time', now(),
    'resets_at', d.starts + interval '24 hours',
    'entries', coalesce((select jsonb_agg(jsonb_build_object(
      'name', r.display_name, 'points', r.points, 'rank', r.rank, 'own', coalesce(r.user_id = auth.uid(), false)
    ) order by r.position) from ranked r where r.position <= 50 or r.user_id = auth.uid()), '[]'::jsonb)
  ) from day d;
$$;

revoke all on function public.set_display_name(text) from public, anon;
revoke all on function public.submit_score(text, integer, text) from public, anon;
revoke all on function public.get_daily_leaderboard() from public;
grant execute on function public.set_display_name(text) to authenticated;
grant execute on function public.submit_score(text, integer, text) to authenticated;
grant execute on function public.get_daily_leaderboard() to anon, authenticated;
