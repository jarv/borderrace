import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { create } from 'tar';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+(?:-[\da-z.-]+)?$/i.test(version ?? '')) {
  throw new Error('Usage: mise run build-release <version>');
}

// Always build clean production files; never package dev source maps.
await import('./build.js');
await writeFile('dist/version.json', `${JSON.stringify({ version })}\n`);
await mkdir('release', { recursive: true });
const archive = 'release/borderrace.tar.gz';
await create(
  { file: archive, cwd: 'dist', gzip: true, portable: true, mtime: new Date(0) },
  (await readdir('dist')).sort(),
);
const digest = createHash('sha256')
  .update(await readFile(archive))
  .digest('hex');
await writeFile(`${archive}.sha256`, `${digest}  borderrace.tar.gz\n`);
console.log(`Packaged Border Race ${version}: ${archive}`);
