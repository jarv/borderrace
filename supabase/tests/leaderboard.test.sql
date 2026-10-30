begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users(id) values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002');

select is((public.get_daily_leaderboard()->'entries'), '[]'::jsonb, 'empty daily board');
set local role anon;
select lives_ok('select public.get_daily_leaderboard()', 'anonymous aggregate reads allowed');
select throws_ok($$select public.submit_score('x', 1, 'wins-v1')$$, '42501', null, 'anonymous submissions denied');
select throws_ok($$select * from public.score_submissions$$, '42501', null, 'raw scores not public');
select throws_ok($$select * from public.profiles$$, '42501', null, 'raw profiles not public');
reset role;

set local role authenticated;
select throws_ok($$select public.submit_score('x', 1, 'wins-v1')$$, '42501', null, 'authenticated role still needs a user');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select lives_ok($$select public.set_display_name('Alice')$$, 'own profile created');
select lives_ok($$select public.submit_score('one', 10, 'wins-v1')$$, 'first win accepted');
select lives_ok($$select public.submit_score('two', -2, 'wins-v1')$$, 'negative win accepted');
select lives_ok($$select public.submit_score('one', 999, 'wins-v1')$$, 'retry is idempotent');
select throws_ok($$insert into public.score_submissions(user_id,game_id,points,rules_version) values (auth.uid(),'cheat',1,'wins-v1')$$, '42501', null, 'direct writes denied');
select throws_ok($$update public.score_submissions set points = 999$$, '42501', null, 'score overwrites denied');
select throws_ok($$select public.submit_score('bad', 1, 'unsupported')$$, '23514', null, 'unsupported rules denied');
select throws_ok($$select public.set_display_name('  ')$$, '23514', null, 'empty profile denied');
select is((public.get_daily_leaderboard()->'entries'->0->>'points'), '8', 'sums signed win scores, not best game');
select is((public.get_daily_leaderboard()->'entries'->0->>'own'), 'true', 'identifies own total');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select is((select count(*) from public.profiles), 0::bigint, 'other account cannot read profile');
select lives_ok($$select public.submit_score('one', 8, 'wins-v1')$$, 'second account may use its own game id');
select lives_ok($$select public.set_display_name('<script>')$$, 'names are data, not markup');
select is((public.get_daily_leaderboard()->'entries'->0->>'rank'), '1', 'first tied rank is one');
select is((public.get_daily_leaderboard()->'entries'->1->>'rank'), '1', 'ties share rank');
select ok(not (public.get_daily_leaderboard()->'entries'->0 ? 'user_id'), 'public response omits auth ids');
select throws_ok($$delete from public.profiles$$, '42501', null, 'profile deletion not exposed');
reset role;

select is((select count(*) from public.score_submissions), 3::bigint, 'duplicate creates no new submission');
select is((select points from public.score_submissions where game_id = 'one' and user_id = '00000000-0000-0000-0000-000000000001'), 10, 'retry never replaces points');
select is((select submitted_at from public.score_submissions where game_id = 'one' and user_id = '00000000-0000-0000-0000-000000000001'), now(), 'receipt timestamp assigned by server');

-- Midnight UTC is authoritative even if the database connection uses another zone.
set local timezone = 'Pacific/Honolulu';
insert into public.score_submissions(user_id,game_id,points,rules_version,submitted_at) values
 ('00000000-0000-0000-0000-000000000001','yesterday',500,'wins-v1',date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' - interval '1 microsecond'),
 ('00000000-0000-0000-0000-000000000001','tomorrow',500,'wins-v1',date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' + interval '24 hours');
select is((public.get_daily_leaderboard()->>'day'), to_char(now() at time zone 'UTC','YYYY-MM-DD'), 'UTC date, not connection date');
select is((public.get_daily_leaderboard()->>'resets_at')::timestamptz, date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' + interval '24 hours', 'next reset is midnight UTC');
select is((public.get_daily_leaderboard()->'entries'->0->>'points'), '8', 'outside-day scores excluded');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok($$select public.submit_score('yesterday', 999, 'wins-v1')$$, 'retry of an old win is accepted without moving days');
select is((public.get_daily_leaderboard()->'entries'->0->>'points'), '8', 'old retry does not enter the new day');
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select is((public.get_daily_leaderboard()->'entries'->0->>'own'), 'false', 'anonymous response has no own row');
reset role;
-- Top 50 plus a signed-in player's own row, without exposing auth IDs.
insert into auth.users(id)
select ('10000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid from generate_series(1,55) n;
insert into public.score_submissions(user_id,game_id,points,rules_version)
select ('10000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid, 'top-'||n, 100+n, 'wins-v1' from generate_series(1,55) n;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is(jsonb_array_length(public.get_daily_leaderboard()->'entries'), 51, 'top 50 plus own row outside the cutoff');
select is((public.get_daily_leaderboard()->'entries'->50->>'own'), 'true', 'own row included outside top 50');
reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select is(jsonb_array_length(public.get_daily_leaderboard()->'entries'), 50, 'anonymous board limited to 50');
reset role;
select * from finish();
rollback;
