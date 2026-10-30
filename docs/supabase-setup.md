# Optional Google login and daily leaderboard

The game remains a static site with local gameplay, saves, and personal records.
Optional Supabase Auth and Postgres add Google login and a browser-trusted daily
leaderboard. No custom server, Edge Functions, or cron jobs are needed.

## Local implementation versus remote setup

The repository contains migrations and a local Docker configuration. Nothing
automatically creates a hosted project, changes Google OAuth, or applies remote
migrations. Leave `flyemoji-dev` untouched until its removal is separately approved.
Use a dedicated new Border Race project when ready.

## Daily scoring

- Open **Your scores → Daily leaderboard**. Sign in with Google to contribute;
  anonymous players may view the board. Choose a public player name, or appear as
  “Player”. Google names, email addresses, and avatars are not published.
- Sum completed-win scores, including frozen gold values, zero-point hints, and
  mistake deductions. Negative winning scores stay negative. Unlimited games.
- Timeout losses and abandoned games do not contribute. Previous local records and
  anonymous wins are never uploaded retroactively. Authentication is captured at
  the moment of the win, not when a delayed result dialog appears.
- Each day runs from midnight to midnight **UTC**. The database assigns the date
  when it first accepts a score. Offline retries accepted after midnight count on
  the new day. History is retained; switching days does not delete rows.
- Equal totals share a rank. Show the top 50, plus your own row if outside them.
- Browser-reported scores are deliberately trusted. This is a casual leaderboard,
  not a cheat-resistant contest. RLS still prevents cross-account data edits.

## Configure a hosted project

1. Create a new Supabase project and select the desired region. Keep its database
   password in the established secret manager. The CLI is pinned in `mise.toml`.
2. Authenticate locally using `mise exec -- supabase login` if not already logged
   in. Do not commit the token or paste administrative credentials into chat.
3. With approval to change the selected remote database, run:

   ```sh
   mise exec -- supabase link --project-ref <border-race-project-ref>
   mise exec -- supabase db push --dry-run
   mise exec -- supabase db push
   ```

   Verify the selected project before pushing. `supabase/.temp/` is ignored. Never
   use `db reset --linked` on the hosted project. Database tests run locally only.

4. Enable Google in Supabase's authentication provider settings. Reuse the
   FlyEmoji Google client ID and secret from their secret manager; enter the
   secret directly into Supabase, never into the app environment or build.
5. In Google Cloud Console, add Supabase's exact callback URL to that OAuth client:
   `https://<project-ref>.supabase.co/auth/v1/callback`. Preserve every existing
   FlyEmoji redirect. Review the shared consent-screen name, domains, privacy
   policy, and publishing status; credential reuse shares those settings.
6. Set Supabase's Site URL to the canonical deployed app URL. Allow its exact
   callback destination (including a deployment subpath if used), and local
   development `http://127.0.0.1:4173/`. OAuth uses PKCE and returns to that app base
   URL; no separate backend callback route is required in Border Race.
7. Obtain the project URL and **publishable key**. Legacy `anon` JWT keys are also
   accepted. Never use `service_role`, a secret API key, or the database password.

## Build/deployment configuration

Both values below are public and intentionally bundled in the JavaScript:

```sh
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_PUBLISHABLE_KEY=sb_publishable_<public-key> \
mise run build
```

The same configuration works for `mise run dev`. Set it in the local shell or
existing secret/environment tooling; do not assume `.env` files are auto-loaded.
Restart the dev server after changing it. With neither variable set, builds make
no Supabase requests and hide the leaderboard entry. Partial configuration or a
non-public key fails the build instead of risking secret publication.

For semantic releases, configure the repository's GitHub Actions **variables**
`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. The release job passes only these
public values to the build. Identical source/configuration produces identical
assets. Changing configuration changes the hashed application asset; deploy a
fresh build rather than editing hashed JavaScript. Keep site HTML revalidated.

The deployment artifact remains only `dist/`. Supabase migrations, sources, test
fixtures, and local CLI configuration must not be published as site content.

## Local database and tests

Docker is required. The isolated local project is named `borderrace`, using API
port 55431, database 55432, and shadow database 55430, avoiding Supabase defaults.
The stack starts only the database, Auth, REST API, and gateway needed here.

```sh
mise run db:start
mise run test:db
# Reapply changed migrations to the disposable LOCAL database only:
mise run db:reset
mise run test:db
```

Keep local credentials local. CLI startup/status prints local keys; don't copy
that output into documentation. Local Google login additionally needs provider
configuration; regular browser tests mock Supabase and Google navigation instead.

Run `mise run check`, `mise run test:browser`, `mise run test:db`, and
`mise run test:release` before rollout. Browser tests use fake public configuration
and intercepted network requests, not a hosted Supabase account. Restart any
reused port-4174 test server if its configuration is stale.

## Persistence, retries, and privacy

- Game saves remain `border-race:v2`; local Clear only resets personal records.
- Supabase sessions use separate `border-race:auth:v1` storage. Sign out clears
  the current session without deleting the active game or personal records.
- `border-race:leaderboard:v1` holds at most 200 queued scores, for up to seven
  days. Entries contain only account ID, game ID, final points, and local queue
  time—not decks, routes, Google identity metadata, or access tokens.
- Only that entry's account can retry it. Logout/account switching cancels active
  sends; explicit request tokens bind in-flight RPCs to the captured account.
- The database's `(user_id, game_id)` uniqueness makes retries idempotent and
  preserves the original score and receipt day even if an acknowledgment is lost.
- Automatic retries are bounded. Refresh, reconnect, or a later login retries the
  queue; persistent errors/expired entries are reported. Failed local storage
  falls back to memory without blocking gameplay, but cannot promise reload recovery.
- Public responses contain only player names, ranks, totals, own-row flags, and
  day/reset metadata. Raw submission rows and Google identity data are not public.
  No analytics or remote gameplay state is introduced. Deleting an account through
  administrative tooling cascades its profile/submissions; self-service deletion
  and historical leaderboard UI are not included in this first version.

Manual launch checks still require the real project: non-admin Google login,
continued FlyEmoji login, cumulative scores from two accounts, and correct UTC
rollover. Free-plan quotas and inactivity pausing apply; failures must leave local
play available. To disable online features, rebuild without the two public values;
existing local saves and remote history remain intact.
