import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { chromium } from '@playwright/test';

let input;
let output;
for (let index = 2; index < process.argv.length; index += 2) {
  if (process.argv[index] === '--input') input = process.argv[index + 1];
  else if (process.argv[index] === '--json') output = process.argv[index + 1];
  else throw new Error(`Invalid option: ${process.argv[index]}`);
}
if (!input) throw new Error('Use --input <Node benchmark JSON> [--json <output>]');
const source = JSON.parse(await readFile(input, 'utf8'));
const workerSource = `
import { countWinningRoutes } from '/scripts/count-routes.js';
self.onmessage = ({ data }) => {
  const started = performance.now();
  const result = countWinningRoutes(data.deal, {
    shouldStop: () => performance.now() - started >= data.budget,
  });
  self.postMessage({ ...result, milliseconds: performance.now() - started });
};`;
// An ephemeral, loopback-only fixture server. No changes to the app/dev server.
const server = createServer(async (request, response) => {
  const files = {
    '/scripts/count-routes.js': new URL('./count-routes.js', import.meta.url),
    '/src/data.js': new URL('../src/data.js', import.meta.url),
    '/src/route-count.js': new URL('../src/route-count.js', import.meta.url),
  };
  try {
    if (request.url === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><title>Route-count benchmark</title>');
    } else if (request.url === '/worker.js') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end(workerSource);
    } else if (Object.hasOwn(files, request.url)) {
      response.setHeader('Content-Type', 'text/javascript');
      response.end(await readFile(files[request.url]));
    } else {
      response.writeHead(404);
      response.end();
    }
  } catch {
    response.writeHead(500);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const results = await page.evaluate(
    async ({ fixtures, budget }) => {
      const worker = new Worker('/worker.js', { type: 'module' });
      const results = [];
      try {
        for (const fixture of fixtures) {
          const result = await new Promise((resolve, reject) => {
            worker.onmessage = ({ data }) => resolve(data);
            worker.onerror = (event) => reject(new Error(event.message));
            worker.postMessage({ deal: fixture.deal, budget });
          });
          if (result.complete && fixture.complete) {
            if (
              String(result.routes) !== fixture.routes ||
              fixture.deal.some((code) => String(result.byCard[code]) !== fixture.byCard[code])
            )
              throw new Error(`Count mismatch at seed ${fixture.seed}`);
          }
          results.push({
            cohort: fixture.cohort,
            seed: fixture.seed,
            deal: fixture.deal,
            ...result,
          });
        }
      } finally {
        worker.terminate();
      }
      return results;
    },
    { fixtures: source.results, budget: source.options['budget-ms'] },
  );
  console.log(`Headless Chromium ${browser.version()}, dedicated worker, ${cpus()[0]?.model}`);
  console.log(
    'Compute time excludes worker startup and message passing. Same fixtures as the Node run.',
  );
  const percentile = (values, fraction) =>
    values[Math.max(0, Math.ceil(values.length * fraction) - 1)];
  for (const cohort of ['random', 'dense-selected']) {
    const group = results.filter((result) => result.cohort === cohort);
    if (!group.length) continue;
    const exact = group.filter((result) => result.complete);
    const times = group.map((result) => result.milliseconds).sort((a, b) => a - b);
    console.log(
      `${cohort}: ${exact.length}/${group.length} completed exactly; median ${percentile(times, 0.5).toFixed(3)} ms; p95 ${percentile(times, 0.95).toFixed(3)} ms; max ${times.at(-1).toFixed(3)} ms`,
    );
  }
  if (output) {
    await writeFile(
      output,
      JSON.stringify(
        {
          environment: { chromium: browser.version(), cpu: cpus()[0]?.model },
          source: input,
          results,
        },
        (_, value) => (typeof value === 'bigint' ? value.toString() : value),
        2,
      ) + '\n',
    );
    console.log(`Full results: ${output}`);
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
