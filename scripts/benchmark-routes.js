import { performance } from 'node:perf_hooks';
import { cpus, platform, arch } from 'node:os';
import { writeFile } from 'node:fs/promises';
import { createDeal } from '../src/game.js';
import { STATES } from '../src/data.js';
import { countWinningRoutes } from './count-routes.js';

const options = { deals: 100, seed: 1, 'budget-ms': 1000, dense: 5, candidates: 1000 };
let jsonPath;
for (let index = 2; index < process.argv.length; index += 2) {
  const name = process.argv[index].replace(/^--/, '');
  const value = process.argv[index + 1];
  if (name === 'json' && value) jsonPath = value;
  else if (
    Object.hasOwn(options, name) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) >= 0
  )
    options[name] = Number(value);
  else throw new Error(`Invalid option: ${process.argv[index]}`);
}
if (!options['budget-ms'] || options.dense > options.candidates)
  throw new Error('Use a positive time budget and dense <= candidates');
const seeded = (seed) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const edges = (deal) =>
  deal.reduce(
    (total, code) => total + STATES[code].neighbors.filter((next) => deal.includes(next)).length,
    0,
  ) / 2;
const random = Array.from({ length: options.deals }, (_, index) => {
  const seed = options.seed + index;
  const deal = createDeal(seeded(seed));
  return { cohort: 'random', seed, deal, edges: edges(deal) };
});
// Deliberately biased stress cohort: select the most connected solvable deals.
const candidates = Array.from({ length: options.candidates }, (_, index) => {
  const seed = options.seed + options.deals + index;
  const deal = createDeal(seeded(seed));
  return { cohort: 'dense-selected', seed, deal, edges: edges(deal) };
})
  .sort((a, b) => b.edges - a.edges || a.seed - b.seed)
  .slice(0, options.dense);

console.log(`Node ${process.version}, ${platform()} ${arch()}, ${cpus()[0]?.model}`);
console.log(
  `Exact enumeration plus per-card/length counts; ${options['budget-ms']} ms budget per deal.`,
);
console.log('cohort\tseed\tedges\twinning routes\tvisited prefixes\tms');
const results = [];
for (const fixture of [...random, ...candidates]) {
  const started = performance.now();
  const result = countWinningRoutes(fixture.deal, {
    shouldStop: () => performance.now() - started >= options['budget-ms'],
  });
  const milliseconds = performance.now() - started;
  results.push({ ...fixture, ...result, milliseconds });
  console.log(
    `${fixture.cohort}\t${fixture.seed}\t${fixture.edges}\t${result.complete ? '' : '>='}${result.routes}\t${result.visits}\t${milliseconds.toFixed(3)}${result.complete ? '' : ' (interrupted, NOT exact)'}`,
  );
}
const percentile = (sorted, fraction) =>
  sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
for (const cohort of ['random', 'dense-selected']) {
  const group = results.filter((result) => result.cohort === cohort);
  if (!group.length) continue;
  const exact = group.filter((result) => result.complete);
  const times = group.map((result) => result.milliseconds).sort((a, b) => a - b);
  const counts = exact.map((result) => result.routes).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  console.log(`\n${cohort}: ${exact.length}/${group.length} completed exactly`);
  console.log(
    `Time, including interrupted runs: median ${percentile(times, 0.5).toFixed(3)} ms; p95 ${percentile(times, 0.95).toFixed(3)} ms; max ${times.at(-1).toFixed(3)} ms`,
  );
  if (counts.length)
    console.log(
      `Winning routes, exact runs only: min ${counts[0]}; median ${percentile(counts, 0.5)}; p95 ${percentile(counts, 0.95)}; max ${counts.at(-1)}`,
    );
}
if (jsonPath) {
  await writeFile(
    jsonPath,
    JSON.stringify(
      {
        environment: {
          node: process.version,
          platform: platform(),
          architecture: arch(),
          cpu: cpus()[0]?.model,
        },
        options,
        results,
      },
      (_, value) => (typeof value === 'bigint' ? value.toString() : value),
      2,
    ) + '\n',
  );
  console.log(`\nFull results: ${jsonPath}`);
}
