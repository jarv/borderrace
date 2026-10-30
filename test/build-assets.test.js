import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fingerprintAssets } from '../build-assets.js';

const source = {
  'index.html':
    '<link href="./favicon.svg"><link href="./app.css"><script src="./app.js"></script>',
  'app.js':
    'new Worker(new URL("./scoring-worker.js", document.baseURI));new Worker(new URL("./solution-worker.js", document.baseURI));',
  'app.css': 'body { color: white; }',
  'favicon.svg': '<svg/>',
  'scoring-worker.js': 'self.onmessage = () => self.postMessage(1);',
  'solution-worker.js': 'self.onmessage = () => self.postMessage(2);',
};
async function build(overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'border-assets-'));
  try {
    for (const [name, contents] of Object.entries({ ...source, ...overrides }))
      await writeFile(join(directory, name), contents);
    const manifest = await fingerprintAssets(directory);
    const contents = Object.fromEntries(
      await Promise.all(
        Object.entries(manifest).map(async ([name, target]) => [
          name,
          await readFile(join(directory, target), 'utf8'),
        ]),
      ),
    );
    return {
      manifest,
      contents,
      html: await readFile(join(directory, 'index.html'), 'utf8'),
      entries: await readdir(directory),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
test('production assets are content-addressed and HTML/worker references are relative', async () => {
  const { manifest, contents, html, entries } = await build();
  assert.deepEqual(entries.sort(), ['assets', 'index.html']);
  for (const [name, target] of Object.entries(manifest)) {
    const hash = createHash('sha256').update(contents[name]).digest('hex').slice(0, 16);
    assert.ok(target.includes(`-${hash}.`));
    assert.match(target, /^assets\/[a-z-]+-[a-f0-9]{16}\.(js|css|svg)$/);
    if (name.endsWith('worker.js')) assert.ok(contents['app.js'].includes(`./${target}`));
    else assert.ok(html.includes(`./${target}`));
  }
});
test('hashes are reproducible, and changed workers invalidate the app without invalidating CSS', async () => {
  const first = await build();
  assert.deepEqual(await build(), first);
  const changed = await build({
    'scoring-worker.js': 'self.onmessage = () => self.postMessage(3);',
  });
  assert.notEqual(changed.manifest['scoring-worker.js'], first.manifest['scoring-worker.js']);
  assert.notEqual(changed.manifest['app.js'], first.manifest['app.js']);
  assert.equal(changed.manifest['solution-worker.js'], first.manifest['solution-worker.js']);
  assert.equal(changed.manifest['app.css'], first.manifest['app.css']);
  const css = await build({ 'app.css': 'body { color: gold; }' });
  assert.notEqual(css.manifest['app.css'], first.manifest['app.css']);
  assert.equal(css.manifest['app.js'], first.manifest['app.js']);
});
