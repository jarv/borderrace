# Working on Border Race

Border Race is a browser-only US geography card game. The previous Python/Django
implementation has been removed. Optional Supabase Google login and a daily
leaderboard are allowed; no custom backend, analytics, or server-side game state.
Gameplay and personal records stay local. Online features must never block play.

## Entry points

Use **mise** for tools, dependencies, and commands. Node is pinned in `mise.toml`;
JavaScript dependencies are pinned in `package-lock.json`.

```sh
mise trust
mise install
mise run dev             # http://127.0.0.1:4173
mise run check           # formatting + unit tests + production build
mise run format          # format source and documentation
mise run browser:install # Chromium, once per machine
mise run test:browser    # desktop + touch-enabled phone tests
mise run build          # deployable dist/ directory
```

Dependency installation (`npm ci`) is a prerequisite of the tasks. To change a
dependency, use `mise exec -- npm install --save-exact ...` (with `--save-dev`
for build/test tools), and commit both package files. No global npm packages.

## Code map

- `src/data.js`: state names, points, adjacency, coasts.
- `src/game.js`: pure game logic, solvable deals, exact sequence validation,
  hints and zero-point penalties, exact shortest/most-points routes, backtracking,
  snapshot validation. No duration-based scoring or special cards.
- `src/sweep.js` / `src/sweep-view.js`: normalized moving deadline, geographic
  frontier collision, panel-wide shading, visibility pause, and persisted pace.
- `src/sweep-effects.js`: decorative one-time slam/impact and bounded drifting
  sparks. Clean up on new game, hidden page, finished game, and reduced motion;
  never delay gameplay or replay the entrance on reload/resume.
- `src/solution-worker.js`: exact most-points search, off the main thread. Cancel on
  new game and ignore stale results. Never label an approximate route “most points”.
- `src/route-count.js` / `src/scoring.js` / `src/prepare-deal.js` / `src/scoring-worker.js`: exact winning-route
  participation and frozen deal points, prepared off-thread before play.
- `src/storage.js`: versioned local save, defensive loading, personal records.
- `src/main.js`: interaction, SVG map, rendering, dialogs, Motion animations,
  canvas celebration. Remote features stay in dedicated online modules.
- `src/auth.js`, `src/leaderboard.js`, `src/online.js`: optional Supabase auth,
  account-bound win outbox, daily leaderboard UI. Only completed wins count;
  server receipt assigns UTC day, equal totals share ranks. No retroactive uploads.
- `supabase/migrations/`, `supabase/tests/`: schema, RLS, narrow database RPCs,
  permission/scoring tests. Never apply migrations remotely without approval.
- `src/chain.js`: touch-sized zig-zag route placement; long routes wrap to fit the map.
- `src/arena.js`: keyed map-card chain, flying cards, energy bursts, score pops,
  and completion payoff. Bound and clean up transient effects; never block gameplay on animation.
- `src/audio.js`: lazy, gesture-unlocked Web Audio effects; no audio downloads,
  autoplay, or background music. Persist the sound toggle in the local save.
- `src/index.html` / `src/style.css` / `src/arena.css`: accessible markup,
  compact gameplay-first arcade HUD, neutral map, responsive UI.
- `assets/us.svg`: supplied Simplemaps map; preserve its copyright notice.
- `build.js`: esbuild entry point; extracts 48 state paths, bundles the SVG and
  application locally, and writes the site to `dist/`. Development watch/server
  mode is `--serve`. No framework or separate asset build pipeline.
- `build-assets.js`: content-hashed production assets and relative HTML/worker URL
  rewriting. Dev filenames stay stable; HTML must not use immutable caching.
- `test/`: Node unit tests; `browser/`: Playwright desktop and mobile tests on
  port 4174, separate from the user's port-4173 dev server. Do not stop that server.
- `.github/workflows/{ci,release}.yml`: mise-based checks and semantic-release.
- `release.js` / `verify-release.js`: reproducible static archive and checksum.
- `scripts/{count-routes,benchmark-routes,benchmark-browser-routes}.js`: development-only
  benchmarks sharing the production route counter. The harnesses are not bundled. See
  `docs/route-count-benchmark.md` for measurements and limitations.

## Gameplay invariants

Read `RULES.md`. Preserve these unless explicitly asked to change the rules:

- Deal 24 unique states with a guaranteed coast-to-coast solution. No wildcard.
- Start at either coast, append bordering states, finish at the opposite coast.
- Validate the actual submitted sequence, not just connectivity of the deck.
- Clicking a played card in the hand or map removes it and its suffix.
- New game acts immediately, without confirmation. Dismissing the
  You win dialog starts a new game. Score clearing also acts immediately.
- Keep unusual connections (AZ–CO, NM–UT, MI–MN, NY–RI). Gulf-only states are not
  valid coastal endpoints. Preserve original points for unversioned saved games.
- New games have 1-point cards, with +2 (3 total) for hard cards appearing in more
  than zero but fewer than 20% of exact winning routes for that deal. Gold marks
  hard cards; coastal cards remain recognizable. Freeze and persist the point
  table before play; use a spinner during analysis, cancel stale workers on New
  game, and never grant bonuses from incomplete counts. A clearly announced
  all-1-point fallback keeps gameplay available if analysis fails or times out.
  Successful new scoring (`hard-v2`) requires at least one gold card; re-deal
  without changing the rarity rule, bounded by 128 candidates and two seconds.
  Preserve frozen `hard-v1` saves without re-scoring or forcing a replacement.
- New games are immediately `playing`. No start/finish button, numeric countdown,
  timestamps, or duration-based scoring/ranking. A moving deadline starts at the
  first coastal play, from the full panel's left edge for west starts or right
  edge for east starts. Base crossing time is 90 seconds, +0.08 base speed per
  subsequent valid addition and +0.35 per Hint or invalid card selection, capped
  at 3x, in addition to existing point penalties. Undo never refunds
  pace/progress or changes the original direction; with no route, chase the
  original starting state. Pause while hidden; persist normalized progress/speed.
  Show a single narrow red line with subtle glow and no repeating internal animation;
  slam it down on first play, burst at the bottom, and shed sparks as it sweeps.
  Effects are decorative, bounded, and never alter deadline timing or geometry.
  Pulse the geographically furthest-forward current state
  red on entry and lose when the line clears its far edge. Briefly show You Lose!, then start a new game
  after one second. Record timeout losses once, never as assisted completions.
  Reduced motion skips slam/impact/sparks and uses a solid red warning, without changing timing.
- Reaching the opposite coast automatically wins and ends the route. Longest
  solutions must obey this in either direction: never continue past that coast.
- Highlight only played states, removing highlights on undo. No map labels or
  unplayed-state deck/next-move colors. Map cards have semi-transparent backgrounds
  but opaque text and solid opaque borders; do not set whole-card opacity.
  Permanent bright green Atlantic/Pacific shoreline edges mark coastal states,
  not their inland/international borders or Gulf-only shores. Hard cards use gold
  borders only; preserve normal hand/map/result backgrounds and text colors.
- Finished games are recorded once. Preserve compatible records and keep old
  discontinued-mode saves in the local archive rather than deleting them.
  New winning records include their actual route; show paths and points in scores,
  and a dash for older records without paths.
  Save wins immediately; allow two seconds of celebration before revealing the
  result dialog, skipping that delay for reduced motion. New game cancels it.
- Hints highlight a legal next card, or a card to remove when backtracking is
  needed. Set `hintPending` until the next valid added card; it scores zero even
  if it differs from the hint. Persist its code in `zeroCards` for the whole game,
  including undo/replay. Invalid clicks/removals do not consume the penalty.
  Hint text uses abbreviations (`Play XX` or `Remove XX, play YY`), with the
  zero-point reminder shown only once in its separate label.
- Win results show only the exact most-points reference route using frozen values
  and zeroCards, preferring fewer cards on score ties. No shortest reference.
  Mobile reference cards stay smaller than the player's route cards.
- No Show route control or assisted-completion animation. New game is the green
  primary action. During timeout feedback only New game is enabled; it cancels the
  pending automatic restart. Reloaded losses show brief feedback without recounting.
- Show the player's actual route and its score above solutions, not a points/states
  statistics grid. Show a score for each solution too, applying the same `zeroCards`.
- Save schema version 2 accepts optional validated sweep progress/pace and a
  timeout loss reason. No wall-clock timestamps, elapsed-duration records, or mode
  fields. Preserve old games/point records, starting legacy routes at zero progress.
- “Your scores” scrolls vertically when needed and contains an immediate Clear
  action that resets scores and game counts only. Preserve the active game, hint
  penalties, and sound preference.
  Use “New game”, not “New deal”. No local-data/credits footer or dialog.

## UI and deployment requirements

- Mobile is a first-class target. Check 320px–650px phones, tablets, and desktop.
  Preserve 44px+ primary touch targets, the always-visible phone map, single-row
  controls, safe-area padding, and lack of page-level horizontal overflow.
- The phone hand scrolls independently. Don't cover it with a sticky map;
  both the deck and map-chain cards must be usable by touch and keyboard.
- Cards on the hand and map must remain keyboard-accessible buttons. Dialogs use
  native modal behavior; messages use a live status region. Honor
  `prefers-reduced-motion` in CSS and JavaScript.
  Compact mobile modal headers put the 32px visual close button beside the title
  while retaining its 44px touch target.
- Keep animations lightweight (Motion, CSS, canvas). Don't require WebGL to play.
- Use arcade/mobile-game energy and reward feedback, not a literal casino/card
  table theme. No felt, suits, poker chips, large promotional headings, or hero area.
  Keep the playable board near the top and the map/card chain visually dominant.
- Keep copy literal and minimal throughout the app: no mode name, aphorisms,
  “adventures”, promotional headings, redundant chain strip, or reassurance about
  accounts/saving. No diamond icons on cards. Use short functional labels such as
  Hint, Play again, and Your scores. Show a short initial
  coastal-card prompt and one sentence explaining gold difficulty/value in the
  map's bottom message area, fading after play starts.
  Keep messages inside the map without changing board height.
- The map's route cards form a gentle zig-zag about two-thirds down, wrapping to
  fit without horizontal scrolling, not geographic anchors. In portrait,
  messages stay below the US in the upper
  half of the screen, above overlapping route cards.
- Effects and audio never grant bonuses or change game rules. Respect reduced
  motion, provide a persistent mute control, and degrade safely without Web Audio.
  Save points immediately but defer visible additions until their point pop reaches
  the HUD. Handle fast play, undo, and new games without stale additions; reduced
  motion updates the total immediately. Interrupted effects must not strand points.
- Bundle assets; no external fonts, map tiles, scripts, or runtime CDN calls.
  Only configured Supabase and explicit Google OAuth navigation may use the network.
  Never bundle OAuth secrets, admin keys, database passwords, or access tokens.
- Keep asset URLs relative so both domain roots and subpaths work.
- `dist/` is generated, ignored, and the only deployment artifact. Never publish
  `node_modules/`, source, test artifacts, or local configuration as the site.
  Releases package its contents plus version metadata as a portable static archive.
- Corrupt, unavailable, or full local storage must not prevent gameplay.
- Local scores are personal records, not a trustworthy global leaderboard.
- Update `README.md`, `RULES.md`, and tests when changing relevant behavior.

Before finishing work, run `mise run check` and, for UI/interaction changes,
`mise run test:browser`. Report blockers honestly. Semantic-release publishes
artifacts; hosting configuration is outside this repository.
