# Plan: Google login and a daily points leaderboard

Status: local implementation in progress; no remote project, Google, or hosting
changes have been made. Written 2026-10-30. The implementation uses the UTC/win-only
defaults below. See [setup and operation](supabase-setup.md).

## Goals and boundaries

- Optional Google OAuth login through Supabase Auth.
- A daily leaderboard summing points earned by each logged-in player, not their
  single best game. Unlimited games; retain today's random deals and scoring.
- Keep anonymous play, local saves, personal records, sound, and offline gameplay.
- Trust browser-calculated scores. No anti-cheat system, authoritative gameplay
  server, shared daily deal, or server-tracked moves.
- Keep the frontend statically hosted. Supabase Auth and Postgres are sufficient;
  SQL functions are database RPCs, not a separately hosted application backend.
  No Edge Functions, Realtime subscription, or scheduled reset job is necessary.

This intentionally relaxes the repository's current no-accounts/no-backend/no-API
policy. Before implementation, update `AGENTS.md`, `README.md`, and `RULES.md` to
permit optional Supabase authentication and remote leaderboard records, while
keeping actual game state local and forbidding analytics.

## Proposed scoring and day boundaries

These are explicit defaults to confirm before implementation:

1. **Calendar days in UTC**, from 00:00 inclusive to the next 00:00 exclusive.
   Everyone sees the same day. This is not a rolling last-24-hours leaderboard or
   a separate reset time per user. Show the UTC date and reset time in the UI.
2. **Sum final scores from completed wins**, including frozen gold values,
   hint-zeroed cards, and mistake deductions. Preserve negative winning scores;
   do not silently clamp scores or change gameplay rules.
3. **Show route contributes zero** and does not submit the assisted route. Games
   abandoned through New game contribute nothing. This follows the current
   personal-record model, which records scores for wins only.
4. A player must be authenticated **when the win occurs**. Signing in later does
   not import anonymous wins or the existing top-ten records. A game begun while
   anonymous may count if the player signs in before winning.
5. The database assigns each submission its **server receipt time** and UTC day.
   An offline win retried after midnight counts on its acceptance day, not its
   browser-reported completion day. Explain this when a result is queued.
6. Equal totals share a rank, using `dense_rank()` on points only. A display-name
   and user-ID order provides stable pagination, not a hidden speed tiebreaker.
7. Reset means querying the new day's rows; retain historical submissions.
   Clearing local Your scores must never clear the daily board or remote history.

If points from unfinished/lost games, positive-only totals, or a different reset
timezone are desired, decide that before building the database and UI.

## Google OAuth and existing credential reuse

Observed integration points, without copying any secrets:

- `~/src/jarv/flyemoji/app.go`, `setupOAuth()`, uses `GOOGLE_KEY`, `GOOGLE_SECRET`,
  and `BASE_URL`, with `BASE_URL + /auth/google/callback`.
- FlyEmoji's local `.mise.toml` loads credentials through its `.1pass.sh` hook.
- The deployment template exists at
  `~/src/jarv/config-mgmt/ansible/roles/flyemoji/templates/flyemoji.env.j2`.
  Its contents were not inspected because read permission was denied.
- Border Race hosting/cache configuration is in
  `~/src/jarv/config-mgmt/borderrace.com.tf`; hosting changes remain in that repo.

Setup steps:

1. Create a dedicated Supabase project for Border Race; do not share FlyEmoji's
   application database or user sessions merely because OAuth credentials match.
2. Enable Google in Supabase Auth. Securely retrieve the existing Google client
   ID and secret from their established secret-management source and configure
   them in Supabase. Do not put the secret in this repo, browser, build variables,
   logs, deployment artifacts, or this document.
3. Add the exact Supabase-provided Google callback URL to the existing OAuth
   client's authorized redirect URIs, typically
   `https://<project-ref>.supabase.co/auth/v1/callback`.
   Preserve all existing FlyEmoji production/development callback entries.
4. Review the shared Google consent screen's app name, domains, privacy policy,
   scopes, and publishing status. Reusing credentials also shares consent-screen
   branding and configuration; it does not create an independent Border Race app.
   Request only the basic identity scopes needed for login.
5. Configure Supabase's Site URL and explicit redirect allowlist for the canonical
   Border Race HTTPS URL, supported subpath, and local development URL
   `http://127.0.0.1:4173/`. Avoid broad production redirect wildcards.
6. Use the Supabase SDK's PKCE OAuth flow. Return to the actual application base
   URL, preserving subpath deployments; exchange the authorization code once,
   remove OAuth parameters from the URL, and handle failures without losing play.
7. Smoke-test both Border Race login and FlyEmoji login after the Google change.
   Existing FlyEmoji accounts do not automatically become Border Race accounts.

Google OAuth avoids needing a transactional email provider for this initial
release. Email/password login and password recovery are out of scope.

## Database design

Store versioned migrations under `supabase/migrations/` during implementation.

### `profiles`

- `user_id uuid primary key`, referencing `auth.users(id)` with delete cascade.
- `display_name text`, trimmed, length-bounded, with a non-empty fallback.
- Public names need not be unique; identity is always the authenticated UUID.
- Ask users to choose their public leaderboard name. Do not automatically publish
  Google email addresses, legal names, or avatars. Treat names as untrusted text.

### `score_submissions`

- `id bigint generated ... primary key`.
- `user_id uuid not null`, referencing `auth.users(id)` with delete cascade.
- `game_id text not null`, the existing locally generated game identifier.
- `points integer not null`, the final winning score, including negative values.
- `rules_version text not null`, identifying the scoring/leaderboard contract.
- `submitted_at timestamptz not null`, assigned by the database.
- Unique `(user_id, game_id)` for retry/reload idempotency.
- An index beginning with `submitted_at` for the daily window; verify the query
  plan and add an appropriate user/window index when measurements justify it.

Do not upload decks, action history, routes, hint history, or active saves. A
submission represents one browser-reported win, not a synchronized game session.

### Database API and access rules

- Enable RLS on both tables. Deny direct browser writes to submissions.
- A narrowly scoped `submit_score(game_id, points, rules_version)` SQL function
  requires `auth.uid()`, assigns ownership and time itself, validates field types,
  lengths, and supported versions, and inserts once. Duplicate retries are no-ops;
  an existing game's points and day must never be overwritten.
- Never accept an owner ID, UTC day, or timestamp supplied by the browser.
- Profile creation/update is restricted to the authenticated user's own row.
  Do not expose the full Google identity metadata through profile fields.
- A read-only `get_daily_leaderboard(...)` RPC computes the current UTC day on
  the server, groups submissions by user, sums using bigint, and ranks totals.
  Return the top 50 plus the current user's rank/total when outside that range.
  Include the authoritative day and next-reset time in the response.
- Allow public leaderboard reads, including for anonymous visitors, but return
  only public names, ranks, points, and an own-row marker. Do not expose emails,
  tokens, raw submission history, or other users' auth IDs.
- Use database functions with explicit grants, a locked-down search path, and
  schema-qualified objects. Any `security definer` function must explicitly check
  identity before writes; it must not rely on RLS to constrain its elevated role.
- Keep raw submission reads private; optionally allow owners to inspect their own
  rows. Aggregate access must not accidentally grant general table access.
- Test permissions as anonymous, user A, and user B, not just as the database
  owner. Keep service-role keys exclusively in administrative tooling.

This prevents accidental duplicate submissions and cross-account edits, not
cheating. An authenticated player can still fabricate scores; that is accepted.

## Frontend integration

- Add an exactly pinned `@supabase/supabase-js` dependency using mise/npm and
  commit both package files. Bundle the SDK locally; no runtime CDN scripts.
- Add small `src/auth.js` and `src/leaderboard.js` modules to keep remote services
  separate from pure game logic, local records, workers, and animation code.
- Supply only the Supabase project URL and publishable key as public deployment
  configuration. A proposed build-time interface is `SUPABASE_URL` and
  `SUPABASE_PUBLISHABLE_KEY`, explicitly injected by `build.js` rather than exposing
  the entire environment. Missing configuration disables online features cleanly.
- Coordinate configured production/release builds so the published artifact has
  the intended public configuration. Builds remain reproducible for identical
  source and public configuration; do not require secrets to build or test.
- Use the SDK's persisted session and auth-state notifications. Keep session data
  separate from the existing version-2 game save; local score clearing must not
  sign the user out. Handle unavailable storage without preventing local play.
- Provide compact Sign in / Sign out controls and a daily leaderboard dialog.
  Preserve Your scores as a separate local personal-record view. Keep the phone
  toolbar single-row and 44px touch targets; finalize the placement before coding.
- Retain native modal semantics, keyboard access, reduced motion, and the existing
  rule that only New game remains enabled during/after Show route completion.
- Fetch the board when opened, on explicit refresh, and when the UTC day changes
  while visible. Recheck on tab visibility/focus after sleep. No frequent polling
  or realtime subscription is needed initially.

### Submission lifecycle

1. On an actual win, preserve today's immediate local save and win record.
2. If authenticated, snapshot the user ID, game ID, final score, and rules version
   into a small separate local outbox before starting the network request.
3. Submit independently of the point animation, celebration, dialog, and next game.
   Never delay or block gameplay on Supabase.
4. Retry transient failures with bounded backoff on reconnect/session recovery.
   Bind queued results to the original user; never submit user A's result as B.
   On sign-out, stop authenticated requests and retain only that user's pending
   queue for their next login. Do not replay it under another session.
5. Remove the queued result after acknowledgment. Database uniqueness handles
   reloads, multiple tabs, and a response lost after a successful insert.
6. Bound queue size, age, and retry work; report discarded/expired entries rather
   than silently promising permanent offline synchronization. If storage fails,
   try the current result in memory and explain that retries may not survive reload.
7. Show concise pending/error status in the leaderboard UI. An unavailable or
   paused Supabase project must not prevent New game or local play.

## Implementation phases

1. Confirm the scoring/day defaults and the consent-screen implications of sharing
   the Google OAuth client. Update the repository's architecture policy.
2. Provision the Supabase project, migrations, RLS, and RPCs. Configure Google and
   Supabase redirects through the appropriate administrative/secret-management
   workflow. No automatic infrastructure apply from this plan.
3. Add optional public configuration and Google login/logout with callback/session
   handling. Verify root, subpath, local, reload, and sign-out behavior.
4. Add idempotent win submissions and account-bound retry handling without changing
   local scoring, saving, or point-arrival animations.
5. Add public daily totals/ranking UI and reset behavior, then check small phones,
   tablets, desktop, keyboard, reduced motion, and offline failure cases.
6. Document setup, deployment configuration, public data/privacy, accepted cheating
   limitations, and how to disable the feature without breaking existing saves.

## Verification and rollout

- Unit tests: win-only contribution, negative/hinted/mistake-adjusted totals,
  duplicate completion events, bounded retries, queue persistence, account changes,
  and unavailable/full local storage.
- SQL integration tests: per-user sums across multiple wins, tied ranks, UTC
  midnight boundaries, duplicate retries retaining their original day, concurrent
  insert retries, anonymous write rejection, and user A/B isolation.
- Browser tests: mocked auth/network by default, no credentials in CI; sign-in,
  callback failure, sign-out, pending/error states, offline wins, midnight rollover,
  new games during upload, and no assisted-route submissions. Cover 320px–650px
  phones, keyboard dialogs, reduced motion, and subpath callbacks.
- Keep pure gameplay tests network-free. Add SQL tests against local Supabase or
  a disposable test project, never the live leaderboard. Pin any new tooling and
  expose commands through mise.
- Run `mise run check`, `mise run test:browser`, database integration tests, and
  `mise run test:release`. Ensure release assets contain no OAuth/admin secrets.
- Manually verify Google login with a non-admin player, continued FlyEmoji login,
  two accounts earning cumulative points, and a fresh board at the UTC boundary.
- Roll out with a feature/configuration switch. Disabling online features restores
  local-only gameplay without deleting remote history or changing saved games.

Supabase's Free plan should support a small deployment, subject to current
database/auth/egress quotas and inactivity pausing. Check actual usage and policies
before launch; the leaderboard is not an uptime guarantee or a trustworthy contest.
