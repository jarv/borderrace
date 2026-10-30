// Integration check, separate from the fast Node unit-test discovery.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extract, list } from 'tar';

execFileSync(process.execPath, ['release.js', '1.0.0'], { stdio: 'inherit' });
const archive = 'release/borderrace.tar.gz';
const first = createHash('sha256')
  .update(await readFile(archive))
  .digest('hex');
assert.equal((await readFile(`${archive}.sha256`, 'utf8')).trim(), `${first}  borderrace.tar.gz`);
const entries = [];
await list({ file: archive, onReadEntry: (entry) => entries.push(entry.path) });
assert.deepEqual(entries.sort(), [
  'LICENSES.txt',
  'THIRD_PARTY.md',
  'app.css',
  'app.js',
  'favicon.svg',
  'index.html',
  'scoring-worker.js',
  'solution-worker.js',
  'version.json',
]);
const directory = await mkdtemp(join(tmpdir(), 'borderrace-release-'));
try {
  await extract({ file: archive, cwd: directory });
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'version.json'), 'utf8')), {
    version: '1.0.0',
  });
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  assert.match(html, /src="\.\/app.js"/);
  assert.match(html, /href="\.\/app.css"/);
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
console.log('Verified release contents, checksum, version, and reproducibility.');
