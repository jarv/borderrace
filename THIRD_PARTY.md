# Third-party assets

- The supplied **assets/us.svg** is copyright 2017 Pareto Software, LLC DBA
  Simplemaps.com. Its original notice is preserved. Free for commercial use
  subject to https://simplemaps.com/resources/svg-license. The game extracts
  only the 48 contiguous state paths and adds its own styling and labels.
- Interface animations: **Motion** (MIT). https://github.com/motiondivision/motion
- Bundler: **esbuild** (MIT). https://github.com/evanw/esbuild
- Optional authentication/database client: **supabase-js** (MIT), including its
  Auth, PostgREST, Realtime, Storage, Functions, Phoenix, and iceberg-js dependencies.
  Their license notices are included in `LICENSES.txt`. Realtime, remote file
  storage, and Edge Functions are not used by the game.

Motion includes Framer Motion, motion-dom, motion-utils (MIT), and tslib
(0BSD). Their copyright notices and full licenses are included in the deployed
`LICENSES.txt` file.

Package versions and integrity hashes are pinned in package-lock.json. The map
is bundled locally; the game loads no fonts, scripts, or map tiles from a CDN.
