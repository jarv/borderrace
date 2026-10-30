// Integration check, separate from the fast Node unit-test discovery.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { createServer } from 'node:http';
import { chromium } from '@playwright/test';
import { extract, list } from 'tar';
import { CODES } from './src/data.js';
import { STORAGE_KEY, emptySave } from './src/storage.js';

execFileSync(process.execPath, ['release.js', '1.0.0'], { stdio: 'inherit' });
const archive = 'release/borderrace.tar.gz';
const first = createHash('sha256')
  .update(await readFile(archive))
  .digest('hex');
assert.equal((await readFile(`${archive}.sha256`, 'utf8')).trim(), `${first}  borderrace.tar.gz`);
const entries = [];
await list({ file: archive, onReadEntry: (entry) => entries.push(entry.path) });
const asset = (name, extension) => {
  const matches = entries.filter((entry) =>
    new RegExp(`^assets/${name}-[a-f0-9]{16}\\.${extension}$`).test(entry),
  );
  assert.equal(matches.length, 1, `Expected one fingerprinted ${name}.${extension}`);
  return matches[0];
};
const assets = [
  asset('app', 'js'),
  asset('app', 'css'),
  asset('favicon', 'svg'),
  asset('scoring-worker', 'js'),
  asset('solution-worker', 'js'),
];
assert.deepEqual(
  entries.map((entry) => entry.replace(/\/$/, '')).sort(),
  ['LICENSES.txt', 'THIRD_PARTY.md', 'assets', 'index.html', 'version.json', ...assets].sort(),
);
const directory = await mkdtemp(join(tmpdir(), 'borderrace-release-'));
try {
  await extract({ file: archive, cwd: directory });
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'version.json'), 'utf8')), {
    version: '1.0.0',
  });
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  assert.match(html, /src="\.\/assets\/app-[a-f0-9]{16}\.js"/);
  assert.match(html, /href="\.\/assets\/app-[a-f0-9]{16}\.css"/);
  assert.match(html, /href="\.\/assets\/favicon-[a-f0-9]{16}\.svg"/);
  for (const file of assets) {
    const digest = createHash('sha256')
      .update(await readFile(join(directory, file)))
      .digest('hex')
      .slice(0, 16);
    assert.ok(file.includes(`-${digest}.`));
  }
  const app = await readFile(join(directory, asset('app', 'js')), 'utf8');
  for (const worker of ['scoring-worker', 'solution-worker'])
    assert.ok(app.includes(`./${asset(worker, 'js')}`));

  // Exercise the packaged (not dev) bundles under a subpath, including both workers.
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = pathname.startsWith('/game/')
      ? pathname.slice('/game/'.length) || 'index.html'
      : null;
    try {
      if (!file || file.includes('..')) throw new Error('Not found');
      const contents = await readFile(join(directory, file));
      response.setHeader(
        'Content-Type',
        {
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.svg': 'image/svg+xml',
          '.html': 'text/html',
        }[extname(file)] || 'text/plain',
      );
      response.setHeader(
        'Cache-Control',
        file.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
      response.end(contents);
    } catch {
      response.writeHead(404, { 'Cache-Control': 'no-cache' });
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    const requests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => requests.push(new URL(request.url()).pathname));
    const route = ['CA', 'AZ', 'NM', 'OK', 'AR', 'TN', 'NC'];
    const deal = [...new Set([...route, ...CODES])].slice(0, 24).sort();
    await page.addInitScript(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
      key: STORAGE_KEY,
      data: {
        ...emptySave(),
        game: {
          id: 'production-test',
          deal,
          route: [],
          zeroCards: [],
          hintPending: false,
          mistakePoints: 0,
          status: 'playing',
          scoring: 'hard-v1',
          cardPoints: null,
        },
      },
    });
    const response = await page.goto(`http://127.0.0.1:${server.address().port}/game/`);
    assert.equal(response.headers()['cache-control'], 'no-cache');
    await page.waitForFunction(
      () => document.querySelector('.board-layout')?.getAttribute('aria-busy') === 'false',
    );
    await page.locator('[data-card="CA"]').click();
    await page.locator('#end-game').click();
    await page.locator('.solution-chain[aria-label="Longest"]').waitFor();
    for (const worker of ['scoring-worker', 'solution-worker'])
      assert.ok(requests.includes(`/game/${asset(worker, 'js')}`));
    assert.ok(requests.includes(`/game/${asset('app', 'css')}`));
    const assetResponse = await page.request.get(
      `http://127.0.0.1:${server.address().port}/game/${asset('app', 'js')}`,
    );
    assert.equal(assetResponse.headers()['cache-control'], 'public, max-age=31536000, immutable');
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
execFileSync(process.execPath, ['release.js', '1.0.0'], { stdio: 'inherit' });
assert.equal(
  createHash('sha256')
    .update(await readFile(archive))
    .digest('hex'),
  first,
);
console.log(
  'Verified release contents, content hashes, subpath/worker loading, checksum, and reproducibility.',
);
