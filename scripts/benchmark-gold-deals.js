import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { writeFile } from 'node:fs/promises';
import { createDeal, findSolution } from '../src/game.js';
import { CODES } from '../src/data.js';
import { countWinningRoutes } from '../src/route-count.js';
import { prepareGoldDeal } from '../src/prepare-deal.js';
import { HARD_CARD_PERCENT } from '../src/scoring.js';

const options = {
  deals: 1000,
  seed: 1,
  hands: 100000,
  'threshold-deals': 10000,
  'budget-ms': 2000,
  'max-attempts': 128,
};
let output;
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, '');
  const value = process.argv[i + 1];
  if (key === 'json' && value) output = value;
  else if (Object.hasOwn(options, key) && Number.isSafeInteger(Number(value)) && Number(value) > 0)
    options[key] = Number(value);
  else throw new Error(`Invalid option: ${process.argv[i]}`);
}
const seeded = (seed) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
const random = seeded(0x62c4a91d + options.seed - 1);
let totalHands = 1n;
for (let i = 1n; i <= 24n; i++) totalHands = (totalHands * (24n + i)) / i;
let solvable = 0;
for (let sample = 0; sample < options.hands; sample++) {
  const hand = [...CODES];
  for (let i = hand.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [hand[i], hand[j]] = [hand[j], hand[i]];
  }
  if (findSolution(hand.slice(0, 24))) solvable++;
}
const handSpace = { totalHands: totalHands.toString(), samples: options.hands, solvable };
const thresholds = [10, 15, 20].map((percent) => ({ percent, qualifying: 0, goldCards: 0 }));
let completed = 0;
for (let i = 0; i < options['threshold-deals']; i++) {
  const deal = createDeal(random);
  const started = performance.now();
  const counts = countWinningRoutes(deal, {
    shouldStop: () => performance.now() - started >= options['budget-ms'],
  });
  if (!counts.complete) continue;
  completed++;
  for (const threshold of thresholds) {
    const gold = deal.filter(
      (code) =>
        counts.byCard[code] > 0n &&
        counts.byCard[code] * 100n < BigInt(threshold.percent) * counts.routes,
    ).length;
    threshold.qualifying += Number(gold > 0);
    threshold.goldCards += gold;
  }
}
console.log(`Node ${process.version}, ${cpus()[0]?.model}`);
console.log(
  `Hand space: ${totalHands} total combinations; ${solvable}/${options.hands} unrestricted samples solvable`,
);
for (const row of thresholds) {
  row.estimatedHands = Math.round(
    (((Number(totalHands) * solvable) / options.hands) * row.qualifying) / completed,
  );
  console.log(
    `${row.percent}%: ${row.qualifying}/${completed} exact solvable samples contain gold; estimated ${(row.estimatedHands / 1e12).toFixed(3)} trillion qualifying hands`,
  );
}
const results = [];
for (let i = 0; i < options.deals; i++) {
  const seed = options.seed + i;
  const random = seeded(seed);
  const started = performance.now();
  const initial = createDeal(random);
  const result = prepareGoldDeal(initial, {
    nextDeal: () => createDeal(random),
    shouldStop: () => performance.now() - started >= options['budget-ms'],
    maxAttempts: options['max-attempts'],
  });
  results.push({
    cohort: 'gold-prepared',
    seed,
    ...result,
    milliseconds: performance.now() - started,
  });
}
const exact = results.filter((result) => result.complete);
const times = results.map((result) => result.milliseconds).sort((a, b) => a - b);
const attempts = results.map((result) => result.attempts).sort((a, b) => a - b);
const percentile = (items, fraction) => items[Math.max(0, Math.ceil(items.length * fraction) - 1)];
console.log(
  `Gold-guaranteed preparation at ${HARD_CARD_PERCENT}%: ${exact.length}/${results.length} completed`,
);
console.log(
  `Attempts: mean ${(attempts.reduce((a, b) => a + b, 0) / attempts.length).toFixed(3)}; median ${percentile(attempts, 0.5)}; p95 ${percentile(attempts, 0.95)}; max ${attempts.at(-1)}`,
);
console.log(
  `Time including generation/retries: median ${percentile(times, 0.5).toFixed(3)} ms; p95 ${percentile(times, 0.95).toFixed(3)} ms; max ${times.at(-1).toFixed(3)} ms`,
);
if (output) {
  await writeFile(
    output,
    JSON.stringify(
      {
        kind: 'gold-deals',
        environment: { node: process.version, cpu: cpus()[0]?.model },
        options,
        handSpace,
        thresholds,
        completed,
        results,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Full results: ${output}`);
}
