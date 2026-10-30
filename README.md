# Border Race

A frontend-only geography game. Connect the Atlantic and Pacific coasts with
24 state cards. Games start immediately and finish automatically when connected.
Cards fly into a horizontal route row across an unlabeled SVG map. A compact,
gameplay-first arcade HUD with energy bursts, floating score numbers, collecting
gems, and a canvas celebration — not a literal casino table.
No Python, backend, accounts, tracking, or remote game state.

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

## Made for phones, too

The compact phone layout puts the map above smaller, touch-sized cards in portrait,
or beside them in landscape. Hint, sound, scores, **?** (help), New game, and End game
share one row; portrait uses a music-note sound toggle. The board fits Galaxy S25-sized
viewports, with an independently scrolling hand on shorter
screens, safe-area padding, and responsive dialogs. Everything is also usable
with a keyboard. Reduced-motion preferences disable animation. No WebGL or
large 3D engine is required; Motion, SVG, CSS, and canvas provide the effects.
Instructions and error messages appear below the map's states without shifting
the board. The starting prompt fades after the first valid card.
In portrait, messages stay below the US in the upper half of the screen. The
route follows a slight zig-zag about two-thirds down the map and overlaps Texas slightly.
Long routes wrap into compact rows inside the map, without horizontal scrolling.
Messages remain above the cards.

## Rules and local data

See [RULES.md](RULES.md) for complete rules. There is no timer. Every deal is
solvable. Played states highlight on an unlabeled map beneath translucent cards
with solid text and borders. Unplayed states have no gameplay coloring.

**Hint** highlights the next playable card, or a card to remove when backtracking
is needed. After a hint, the next added card scores zero, even if a different card
is chosen. That card stays at zero after undo/replay. Results show small linked
abbreviations for the shortest and longest routes, measured by card count.
The exact longest-route search runs in a worker; equal-length extremes are shown
as one solution.

Every new-game card is worth **1 point**, with a **+2 bonus** (3 total) for gold
hard cards. A hard card appears in more than zero but fewer than 10% of its deal's
winning routes. Values are calculated exactly before play, with a loading spinner,
and remain fixed across undo and reloads. If analysis is unavailable or exceeds
its budget, a notice appears and the game uses fixed 1-point cards instead.

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
falls back to in-memory play. There is no shared leaderboard or cross-device sync.
Use **Your scores → Clear** to clear scores and game counts without resetting the
current game or sound setting. Use **New game** for a fresh board.
Clearing scores is immediate, without confirmation; the scores dialog scrolls
vertically on shorter screens.
New game and End game act immediately without confirmation. Closing the You win
dialog starts the next game. Scores show each winning path alongside its points;
older records without a saved path show a dash.
Older saves are archived; compatible games and point records are migrated without
time fields. New games and records do not track any time.

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
