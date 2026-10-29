# Border Race

A frontend-only geography game. Connect the Atlantic and Pacific coasts with
24 state cards. Games start immediately and finish automatically when connected.
Cards fly into a geographic chain across an unlabeled SVG map. A compact,
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
| `mise run check`           | Unit tests and production build                 |
| `mise run format`          | Format source and documentation                 |
| `mise run browser:install` | Install Chromium for browser tests (once)       |
| `mise run test:browser`    | Desktop and touch-enabled phone tests           |

All frontend bundling happens in **`build.js`**, using esbuild. Assets are local
and URLs are relative, so the same output works at a domain root or a subpath.
The supplied `assets/us.svg` is adapted at build time;
Alaska, Hawaii, and DC are excluded. See [third-party credits](THIRD_PARTY.md).

## Made for phones, too

The phone layout has touch-sized CSS cards, an independently scrolling hand,
a collapsible map, fixed bottom game
controls, safe-area padding, and responsive dialogs. Everything is also usable
with a keyboard. Reduced-motion preferences disable animation. No WebGL or
large 3D engine is required; Motion, SVG, CSS, and canvas provide the effects.

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

Short synthesized sounds accompany links and completion. Sound starts
only after interaction; the header toggle mutes it and remembers your preference.
There is no music, autoplay, or external audio download.

The current game and top 10 wins are saved to local storage.
Reloading resumes the game and preserves hint penalties. Blocked/full storage
falls back to in-memory play. There is no shared leaderboard or cross-device sync.
Use **Your scores → Clear** to clear scores and game counts without resetting the
current game or sound setting. Use **New game** for a fresh board.
Older saves are archived; compatible games and point records are migrated without
time fields. New games and records do not track any time.

Browser tests use port **4174**, separately from your dev server. Restart the
dev server after changes to `build.js`; normal app changes rebuild automatically.

## Releases and Caddy deployment

Push conventional commits to `master` (`feat:` for minor releases, `fix:` for
patches, and `BREAKING CHANGE:` for majors). The Release action runs formatting,
unit/browser tests, a production build, and artifact checks before semantic-release
publishes a GitHub release. With no previous release tag, the first release is
**v1.0.0**. Release commits update the changelog and package version with `[skip ci]`.
Publishing uses the built-in `GITHUB_TOKEN`, as in Stardewar; no new secrets or
npm publishing credentials are needed.

Each release includes `borderrace.tar.gz` and `borderrace.tar.gz.sha256`. The archive
contains only the built site, license notices, and `version.json`, not source,
dependencies, tests, or local configuration. To build and verify it locally:

```sh
mise run build-release 1.0.0
mise run test:release
```

Deployment lives in `~/src/jarv/config-mgmt/ansible`. The `borderrace` role downloads
the latest release through GitHub's asset API using
`vault_github_repository_readonly`, verifies SHA-256, extracts into
`/srv/borderrace/releases/<tag>/`, and switches `/srv/borderrace/current`.
Caddy serves that static directory; no application service or backend is needed.
Old release directories remain available for rollback.

From the infrastructure repository, after reviewing/applying the Terraform DNS
changes, deploy with:

```sh
cd ansible
ansible-playbook site.yml --tags borderrace,caddy_servers
# Pin a release or roll back:
ansible-playbook site.yml --tags borderrace -e borderrace_version=v1.0.0
```

Terraform manages proxied IPv4/IPv6 records for `borderrace.com`,
`s.borderrace.com`, and `m.borderrace.com`, following the existing active-server
pattern. All three serve the same game. Their browser storage is separate by
origin. Caddy listens on HTTP behind Cloudflare, matching the other sites and
their flexible SSL configuration. Release publication does not automatically
run Terraform or Ansible; GitHub Pages is not used.

For contributions and architecture, see [AGENTS.md](AGENTS.md).
