# Border Race

A frontend-only geography game. Connect the Atlantic and Pacific coasts with
24 state cards. Games start immediately and finish automatically when connected.
Cards fly into a horizontal route row across an unlabeled SVG map. A compact,
gameplay-first arcade HUD with energy bursts, floating score numbers, collecting
gems, and a canvas celebration — not a literal casino table.
No Python, custom backend, tracking, or remote game state. Optional Supabase Google
login adds a daily cumulative leaderboard; play and personal records remain local.
See [Supabase setup](docs/supabase-setup.md) for configuration, UTC scoring,
credential handling, database tests, and deployment. Unconfigured builds stay local-only.

## Play locally

Install [mise](https://mise.jdx.dev/), then:

```sh
mise trust
mise install
mise run dev
```

Open **http://127.0.0.1:4173**. Mise pins Node and installs all JavaScript
dependencies from the lockfile. No global npm tools are required.

## Commands

| Command                    | Purpose                                         |
| -------------------------- | ----------------------------------------------- |
| `mise run install`         | Install pinned dependencies                     |
| `mise run dev`             | esbuild watch mode and local server             |
| `mise run build`           | Production site in `dist/`                      |
| `mise run test`            | Game, generation, audio, and storage unit tests |
| `mise run check`           | Formatting, unit tests, and production build    |
| `mise run format`          | Format source and documentation                 |
| `mise run browser:install` | Install Chromium for browser tests (once)       |
| `mise run test:browser`    | Desktop and touch-enabled phone tests           |

All frontend bundling happens in **`build.js`**, using esbuild. Assets are local
and URLs are relative, so the same output works at a domain root or a subpath.
The supplied `assets/us.svg` is adapted at build time;
Alaska, Hawaii, and DC are excluded. See [third-party credits](THIRD_PARTY.md).

## Development workflow

App changes rebuild automatically while `mise run dev` is running. Restart the
dev server after changing `build.js`.

Before committing, run:

```sh
mise run check
mise run browser:install # once per machine
mise run test:browser
```

Browser tests use port **4174**, separately from the port-4173 dev server. They
cover desktop and touch-enabled phone layouts. Unit tests cover game rules,
deal generation, scoring, audio, and local storage.

The application is plain JavaScript, CSS, and SVG, bundled with esbuild. See
[AGENTS.md](AGENTS.md) for the source map, architecture, and contribution guidance.

### Route-count experiment

```sh
mise run benchmark:routes
mise run benchmark:routes --deals 100 --seed 1 --budget-ms 1000 --json /tmp/opencode/routes.json
mise run browser:install # once, for the optional browser measurement
mise run benchmark:routes:browser --input /tmp/opencode/routes.json --json /tmp/opencode/browser-routes.json
```

This development-only benchmark exhaustively counts winning routes, per-card
participation, and route lengths without changing gameplay or point values.
An ordered route counts once; both travel directions are included, and reaching
the first opposite coast stops the route. Reversed sequences are distinct when
both are legal. Counts use exact integers.

The random cohort uses reproducible solvable 24-card deals. A separate stress
cohort selects the most connected deals from a candidate pool (`--dense 5
--candidates 1000` by default). Timings include per-card counting but exclude
deal generation. Runs exceeding the per-deal budget are interrupted; their counts
are lower bounds, not exact results. Desktop Node timings do not establish mobile
browser performance. This is an enumeration baseline, not a claim of optimal speed.
The optional Playwright measurement repeats the saved deals in a dedicated Chromium
worker and checks completed totals against the Node run. It starts and closes its
own temporary loopback fixture server; neither benchmark touches the app's dev server.
Browser compute times exclude worker startup and message passing.
See [measured route-count results](docs/route-count-benchmark.md) for the
1,000-deal experiment, stress cases, and reproduction commands.
Use `mise run benchmark:gold --json /tmp/opencode/gold-deals.json` to compare gold
thresholds, estimate the remaining hand space, and measure bounded re-dealing.
See [gold-deal measurements](docs/gold-deal-evaluation.md) for the 100,000-hand
estimate and Node/Chromium preparation results.

## Made for phones, too

The compact phone layout puts the map above smaller, touch-sized cards in portrait,
or beside them in landscape. Hint, sound, **?** (help), New game, and the points total
share one row, keeping the score off the map; portrait uses a music-note sound toggle.
Taller phones use more of the available space for the US map. The board fits Galaxy S25-sized
viewports, with an independently scrolling hand on shorter
screens, safe-area padding, and responsive dialogs. Everything is also usable
with a keyboard. Reduced-motion preferences disable animation. No WebGL or
large 3D engine is required; Motion, SVG, CSS, and canvas provide the effects.
Instructions and error messages appear below the map's states without shifting
the board. The starting prompt explains coastal and gold cards, then fades after
the first valid card. Mobile dialogs put a smaller visual close button beside the
heading while preserving its touch target.
In portrait, messages stay below the US in the upper half of the screen. The
route follows a slight zig-zag about two-thirds down the map and overlaps Texas slightly.
Long routes wrap into compact rows inside the map, without horizontal scrolling.
Messages remain above the cards.

## Rules and local data

See [RULES.md](RULES.md) for complete rules. Every deal is
solvable from every dealt coastal starting card, including all-1-point fallback
games. Later choices can still lead to dead ends requiring backtracking. Existing
saves keep their original deals. Bright green shoreline edges mark the Atlantic and Pacific coastal
states. Played states highlight on an unlabeled map beneath translucent cards
with solid text and borders. Unplayed states have no gameplay coloring.

A single narrow red deadline line starts at the full map panel's left edge for a Pacific start,
or right edge for an Atlantic start. Its base crossing time is 90 seconds. Valid
additions accelerate it by 8% of base speed; Hint and invalid cards each add 35%,
capped at 3×. Point penalties remain unchanged. The
furthest-forward state pulses dark red as the line reaches it. Once overtaken,
**You Lose!** appears for one second before a fresh game. The shaded sweep follows
geographic states, not the zig-zag cards. It pauses while hidden, persists progress
and pace across reloads, and never rewinds on undo. Reduced motion keeps this
functional deadline but uses a solid red warning instead of pulsing. The line
has a subtle glow and no repeating internal animation. On the first play it slams
down into place with a small impact burst, then sheds sparks as it sweeps. These
effects never delay the deadline or block play, and are skipped for reduced motion.
Wins stop it; New game resets it.

**Hint** highlights the next playable card, or a card to remove when backtracking
is needed. After a hint, the next added card scores zero, even if a different card
is chosen. That card stays at zero after undo/replay. Results show small linked
abbreviations for the most-points route using
frozen values and hint penalties. Score ties prefer fewer cards. The exact
most-points search runs in a worker. Reference cards are smaller on mobile while your
route stays larger.
Hint messages use abbreviations: `Play NC` or `Remove KY, play GA`. The zero-point
reminder appears once. A win celebrates for two seconds before results appear;
reduced motion skips the animation delay. The result is saved immediately.

Hard cards use a gold border without changing their original backgrounds or text.
Every new-game card is worth **1 point**, with a **+2 bonus** (3 total) for gold
hard cards. A hard card appears in more than zero but fewer than 20% of its deal's
winning routes. Values are calculated exactly before play, with a loading spinner,
and remain fixed across undo and reloads. If analysis is unavailable or exceeds
its budget, a notice appears and the game uses fixed 1-point cards instead.
Successful analysis re-deals hands without gold so every new bonus-scored game
has at least one gold card. Preparation is bounded to 128 candidates and two
seconds; existing games keep their saved values.

Invalid card selections deduct the card's assigned value on every attempt.
Undoing is free, but does not erase deductions. Scores can go negative; deductions
survive reloads, count toward personal records, and reset with New game.
Hints zero the full card value, including bonuses. Existing games and records keep
their original values.

Short synthesized sounds accompany links and completion. Sound starts
only after interaction; the Sound toggle mutes it and remembers your preference.
There is no music, autoplay, or external audio download.

The current game and top 10 wins are saved to local storage.
Reloading resumes the game and preserves hint penalties. Blocked/full storage
falls back to in-memory play. Game saves do not sync across devices.
When configured, **Daily leaderboard** beside **Your scores** opens the public board,
including while logged out. The top-bar login/logout icon controls Google sign-in.
First login assigns an account-bound random pet-style player name; click your name
in the top bar to edit it. Existing chosen names are preserved across logins/devices.
Use **Your scores → Clear** to clear scores and game counts without resetting the
current game or sound setting. Use **New game** for a fresh board.
Clearing scores is immediate, without confirmation; the scores dialog scrolls
vertically on shorter screens.
New game is the green primary action. There is no assisted-route control.
Card point pops zoom toward the score total; the visible total increases when
they arrive. Scores are saved immediately, and reduced motion updates the total
immediately without the effect.
New game cancels any pending timeout restart without confirmation. Closing the You win
dialog starts the next game. Scores show each winning path alongside its points;
older records without a saved path show a dash.
Older saves are archived; compatible games and point records are migrated without
duration fields. Scores remain point-based, with no completion-time records.

## Static builds and release archives

`mise run build` writes the standalone static site to `dist/`. It needs no backend;
use any static web server to serve that directory. Generated files are ignored by Git.
Production JavaScript, CSS, workers, and the favicon use content-hashed filenames
under `dist/assets/`. HTML and worker references are updated automatically, so
changed assets get fresh URLs while unchanged assets keep their cache keys.
Development builds retain stable filenames for fast rebuilds.

For hosting, revalidate HTML and metadata (`Cache-Control: no-cache`); successful
hashed asset responses can use `public, max-age=31536000, immutable`. Do not apply
long-lived caching to missing files. Already-open tabs may need refreshing after
an update. Release verification also runs the packaged site in Chromium under a
subpath, so install the browser runtime before `mise run test:release`.

To build and verify a release archive locally:

```sh
mise run build-release 1.0.0
mise run test:release
```

The output is `release/borderrace.tar.gz` and its SHA-256 checksum. Archives contain
only the built site, license notices, and version metadata, not source or dependencies.

Commits to `master` use conventional prefixes: `feat:` for minor releases, `fix:` for
patches, and `BREAKING CHANGE:` for majors. Use `maint:` for maintenance-only changes
that should not trigger a release. The release workflow validates and publishes
GitHub release archives; hosting configuration is outside this repository.
