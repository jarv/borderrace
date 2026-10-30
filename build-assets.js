import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, parse } from 'node:path';

// Workers are fingerprinted first: changing one also changes the app URL that
// references it. HTML is written last, after every referenced asset exists.
export async function fingerprintAssets(directory) {
  await mkdir(join(directory, 'assets'), { recursive: true });
  const manifest = {};
  async function emit(name, contents = null) {
    const bytes = contents ?? (await readFile(join(directory, name)));
    const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    const { name: stem, ext } = parse(name);
    const target = `assets/${stem}-${digest}${ext}`;
    await writeFile(join(directory, target), bytes);
    manifest[name] = target;
  }
  for (const name of ['scoring-worker.js', 'solution-worker.js', 'app.css', 'favicon.svg'])
    await emit(name);
  let app = await readFile(join(directory, 'app.js'), 'utf8');
  for (const name of ['scoring-worker.js', 'solution-worker.js']) {
    if (!app.includes(`./${name}`)) throw new Error(`Missing worker URL: ${name}`);
    app = app.replaceAll(`./${name}`, `./${manifest[name]}`);
  }
  await emit('app.js', app);
  let html = await readFile(join(directory, 'index.html'), 'utf8');
  for (const name of ['app.js', 'app.css', 'favicon.svg']) {
    if (!html.includes(`./${name}`)) throw new Error(`Missing HTML asset: ${name}`);
    html = html.replaceAll(`./${name}`, `./${manifest[name]}`);
  }
  await writeFile(join(directory, 'index.html'), html);
  for (const name of Object.keys(manifest)) await rm(join(directory, name));
  return manifest;
}
