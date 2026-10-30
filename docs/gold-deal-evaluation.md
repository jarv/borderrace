# Gold-card availability and hand-space estimate

Measured on 2026-10-30, Linux x64, Intel Core Ultra 7 155U, Node 24.16.0 and
headless Chromium 156.0.8078.4. These are desktop, not Galaxy S25 measurements.

## How much of the hand space remains?

There are exactly **32,247,603,683,100** unordered 24-card hands from 48 states.
Of 100,000 unrestricted shuffled hands, 20,122 were coast-to-coast solvable:
an estimated **6.49 trillion solvable hands** before requiring gold.

We then counted all winning routes for 10,000 generated solvable
hands. A gold card must have positive participation strictly below the threshold;
zero-participation cards never qualify.

| Threshold | Solvable samples with gold | Fraction retained | Estimated qualifying hands |
| --------- | -------------------------: | ----------------: | -------------------------: |
| Below 10% |               856 / 10,000 |             8.56% |              0.56 trillion |
| Below 15% |             2,165 / 10,000 |            21.65% |              1.40 trillion |
| Below 20% |             3,649 / 10,000 |            36.49% |              2.37 trillion |

Thus requiring gold at 20% excludes about **63.5% of otherwise solvable hands**,
but still leaves an enormous estimated pool. It admits roughly 4.3 times as many
hands as requiring gold at 10%. These are sampling estimates, not exhaustive
counts or a guarantee of uniform gameplay variety. The filter intentionally
favors hands with less-common route options, changing which kinds of hands occur.

## Cost of preparing a gold-containing deal

For 1,000 reproducible seed streams, prepare a solvable hand, count it exactly,
and redraw if it has no gold. Use a 128-candidate cap and a two-second total
computation budget. Never accept partial counts or change the rarity threshold.

All **1,000 / 1,000** cases completed successfully in Node and in a Chromium
worker, with matching accepted hands and point tables.

| Measurement                      |  Median | 95th percentile |  Maximum |
| -------------------------------- | ------: | --------------: | -------: |
| Candidate hands analyzed         |       2 |               8 |       20 |
| Node preparation time            | 1.01 ms |         8.86 ms | 89.35 ms |
| Chromium worker preparation time | 0.60 ms |         5.90 ms | 55.80 ms |

Mean candidates analyzed: **2.892**. Times include generation, retries, and
participation counting, but exclude worker startup and message passing. This
sample establishes feasibility, not a worst-case or mobile runtime guarantee.
All prepared bonus-scored games contain gold; analysis failure or budget exhaustion
still uses the existing, explicitly announced all-1-point fallback. Existing
saved point tables are preserved without re-dealing or re-scoring.

## Reproduce

```sh
mise run benchmark:gold --json /tmp/opencode/gold-deal-evaluation.json
mise run benchmark:routes:browser --input /tmp/opencode/gold-deal-evaluation.json --json /tmp/opencode/browser-gold-deal-evaluation.json
```

The script uses a fixed PRNG stream for the hand-space samples, and seeds 1–1,000
for preparation. JSON output records the parameters, estimates, accepted hands,
point tables, retry counts, and timings. Counts/selection are reproducible;
timings vary by machine and run.
