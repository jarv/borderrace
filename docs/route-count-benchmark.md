# Exact winning-route counting experiment

Measured on 2026-10-30 using Node 24.16.0 and headless Chromium 156.0.8078.4,
on Linux x64 with an Intel Core Ultra 7 155U. These are desktop measurements,
not measurements from a Galaxy S25.

## Method

- Generate 1,000 solvable 24-card deals using seeds 1–1,000 and the game's existing
  deal generator.
- Separately generate 10,000 candidate deals using seeds 1,001–11,000. Select the
  20 with the most dealt-state adjacency edges, breaking ties by seed. This is a
  deliberately biased stress cohort, not another random sample.
- Exhaustively enumerate simple, ordered routes from both coasts. Stop at the
  first opposite coast. Different legal orders and directions count separately.
- Accumulate exact integer totals, counts by direction and length, and per-card
  participation counts. No sampling, memoization, or reachability pruning is used.
- Allow 1,000 ms per deal, checking cancellation every 4,096 visited prefixes.
  Interrupted results would be marked incomplete and excluded from exact-count
  statistics. All 1,020 runs completed in both engines.
- Repeat the same deals in a dedicated Chromium worker using Playwright. Every
  completed browser total matched the corresponding Node total.
- Time only the counter, including per-card counting. Exclude deal generation,
  browser/worker startup, imports, message passing, and report serialization.
  Each engine runs one sequential pass, with no separate warmup phase.

## Results

| Cohort                   | Winning routes: min | Median | 95th percentile | Maximum |
| ------------------------ | ------------------: | -----: | --------------: | ------: |
| Random, 1,000 deals      |                   2 |    204 |           3,290 |  55,064 |
| Dense-selected, 20 deals |               7,837 | 26,216 |         127,794 | 133,456 |

| Engine and cohort               | Median compute time | 95th percentile |   Maximum |
| ------------------------------- | ------------------: | --------------: | --------: |
| Node, random                    |             0.14 ms |         2.18 ms |  36.93 ms |
| Chromium worker, random         |             0.20 ms |         2.40 ms |  37.20 ms |
| Node, dense-selected            |            20.08 ms |        96.91 ms | 102.36 ms |
| Chromium worker, dense-selected |            22.90 ms |       115.20 ms | 142.60 ms |

The largest random count was seed 433; the largest stress count was seed 1458.
The random cohort averaged 7.753 dealt cards that appeared in no winning route;
the stress cohort averaged 1.9. That distinction matters when designing points:
zero participation means unusable, not merely difficult.

## Interpretation

Exact deal-specific participation looks feasible enough to prototype in a worker.
This sample does not establish a worst-case runtime or mobile performance.
Measuring worker startup and end-to-end deal readiness on a real phone remains
necessary before choosing a production design. No game rules, scores, point
assignments, or saved data have been changed by this experiment.

## Reproduce

```sh
mise run benchmark:routes --deals 1000 --seed 1 --dense 20 --candidates 10000 --budget-ms 1000 --json /tmp/opencode/routes-benchmark.json
mise run browser:install
mise run benchmark:routes:browser --input /tmp/opencode/routes-benchmark.json --json /tmp/opencode/browser-routes-benchmark.json
```

The JSON reports include every measured deal, its exact or incomplete counts,
participation counts, visited prefixes, timing, and environment details.
Timings vary across machines and runs; seeds and completed counts are reproducible.
