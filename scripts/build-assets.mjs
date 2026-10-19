// Builds every asset declared in ssg.assets.json through the Synty Sprite Generator CLI (never its code).
//   npm run assets                         build everything
//   node scripts/build-assets.mjs joe       apply/render/download a subset by name (the manifest keeps the rest)
// `ssg sprite apply - --render --download public/assets` keeps every sprite in the generator project named in the
// file (visible and editable in the app), renders only what is outdated and writes public/assets/<name>/.
// `ssg tileset render tomb` draws the ground atlas; the Tiled .tsj tells the game which tile id is which terrain,
// and both go into public/assets/tileset/. Then public/assets/manifest.json is written from the output.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SSG = process.env.SSG_BIN ?? '/home/andrew/projects/synty-sprite-generator/apps/cli/bin/ssg.mjs';
const out = path.join(root, 'public/assets');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'ssg.assets.json'), 'utf8'));

// The export folders must be inside an allowed root; ours is this repo (see .mcp.json).
process.env.SSG_ALLOWED_DIRS = [process.env.SSG_ALLOWED_DIRS, root].filter(Boolean).join(':');

// A render that shows no new progress line for this long counts as hung and is stopped (its batch keeps running in
// the generator).
const STALL_MS = 3 * 60 * 1000;

/** Run the CLI with --json, echoing its progress lines; stop it if they stall. Resolves {code, json, stdout}. */
function ssg(args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [SSG, '--json', ...args], {
      cwd: root,
      stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    if (input) p.stdin.end(input);
    let stdout = '';
    let last = '';
    let lastChange = Date.now();
    p.stdout.on('data', (d) => (stdout += d));
    p.stderr.on('data', (d) => {
      for (const l of String(d).split(/[\r\n]+/).filter(Boolean)) {
        if (l === last) continue;
        last = l;
        lastChange = Date.now();
        process.stderr.write(`  | ${l}\n`);
      }
    });
    const watchdog = setInterval(() => {
      if (Date.now() - lastChange > STALL_MS) {
        clearInterval(watchdog);
        p.kill('SIGTERM');
        reject(new Error(`ssg ${args[0]} stalled for ${STALL_MS / 60000} min (last progress: ${last || 'none'}) and was stopped`));
      }
    }, 5000);
    p.on('close', (code) => {
      clearInterval(watchdog);
      let json = null;
      try {
        json = JSON.parse(stdout);
      } catch {
        /* not JSON */
      }
      resolve({ code, json, stdout });
    });
  });
}

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

/** Manifest entry for one downloaded sprite folder public/assets/<name>/. */
function describe(s) {
  const dest = path.join(out, s.name);
  const files = fs.readdirSync(dest);
  const animsFile = files.filter((f) => f.endsWith('_anims.json')).sort((x, y) => x.length - y.length)[0];
  const base = animsFile?.slice(0, -'_anims.json'.length);
  const metaFile = files.find((f) => f === `${base}.meta.json`);
  const atlasFile = files.find((f) => f === `${base}.json`);
  if (!animsFile || !atlasFile) throw new Error(`no phaser3 atlas/anims in ${dest} (${files.join(', ')})`);
  const anims = readJson(path.join(dest, animsFile)).anims;
  const atlas = readJson(path.join(dest, atlasFile));
  const meta = metaFile ? readJson(path.join(dest, metaFile)) : null;
  // The game loads every multiatlas under the sprite's own name, so that is the texture key (the anims file names the
  // atlas's own base, which is not what textures.get() knows).
  const textureKey = s.name;
  // Anim keys are "<base>/<clip>_<dir>": the game plays them as they are.
  const bare = (k) => k.slice(k.lastIndexOf('/') + 1);
  const dirs = [...new Set(anims.map((a) => bare(a.key).split('_').pop()))];
  const clips = [...new Set(anims.map((a) => bare(a.key).slice(0, bare(a.key).lastIndexOf('_'))))];
  const frame0 = (atlas.textures?.[0]?.frames ?? Object.values(atlas.frames ?? {}))[0];
  const validation = meta?.validation ?? [];
  if (validation.length) console.error(`  ${s.name}: validation ${validation.map((v) => `${v.level}:${v.code}`).join(', ')}`);
  return {
    name: s.name,
    asset: s.asset,
    textureKey,
    atlas: `assets/${s.name}/${atlasFile}`,
    path: `assets/${s.name}/`,
    anims: `assets/${s.name}/${animsFile}`,
    animPrefix: anims[0] ? anims[0].key.slice(0, anims[0].key.lastIndexOf('/') + 1) : '',
    meta: metaFile ? `assets/${s.name}/${metaFile}` : null,
    pixelsPerMetre: meta?.scale?.pixelsPerMetre ?? meta?.pixelsPerMetre ?? null,
    frameSize: frame0 ? [frame0.sourceSize.w, frame0.sourceSize.h] : null,
    dirs,
    clips,
    // Per clip: frame count, ground speed (locomotion only) and named events by frame.
    clipInfo: Object.fromEntries(
      (meta?.clips ?? []).map((c) => [c.name, { frames: c.frameCount ?? c.frames ?? null, speedMps: c.speedMps ?? null, events: c.events ?? [] }])
    ),
    validation,
  };
}

/**
 * The ground tileset: public/assets/tileset/<name>.png (atlas) + .tsj (Tiled). The game needs, per terrain, the id of
 * a plain tile it can stamp; the .tsj lists them as wangset corners, so take the lowest id of each terrain.
 */
function describeTileset(t) {
  const dir = path.join(out, 'tileset');
  const tsj = fs.readdirSync(dir).find((f) => f.endsWith('.tsj') && f.startsWith(t.name));
  const png = fs.readdirSync(dir).find((f) => f.endsWith('.png') && f.startsWith(t.name));
  if (!tsj || !png) throw new Error(`no tileset .tsj/.png in ${dir} (${fs.readdirSync(dir).join(', ')})`);
  const doc = readJson(path.join(dir, tsj));
  // The .tsj holds one wangset: its colours are the terrains, its wangtiles the tile ids that draw each corner
  // (wangid entries are 1-based colour indexes, 0 meaning "nothing here"). The lowest tile id of a terrain is its
  // plain tile, which is what the game stamps.
  const wang = (doc.wangsets ?? []).find((w) => Array.isArray(w.colors) && Array.isArray(w.wangtiles));
  if (!wang) throw new Error(`no terrain wangset in ${tsj}`);
  const names = wang.colors.map((c) => c.name);
  const terrainIds = {};
  for (const wt of wang.wangtiles) {
    for (const c of wt.wangid ?? []) {
      const name = names[c - 1];
      if (!name) continue;
      if (terrainIds[name] === undefined || wt.tileid < terrainIds[name]) terrainIds[name] = wt.tileid;
    }
  }
  if (Object.keys(terrainIds).length !== names.length) throw new Error(`could not read every terrain id from ${tsj}`);
  return {
    name: t.name,
    image: `assets/tileset/${png}`,
    tsj: `assets/tileset/${tsj}`,
    tile: t.tile ?? '32x32',
    width: doc.tilewidth ?? 32,
    height: doc.tileheight ?? 32,
    columns: doc.columns ?? doc.imagewidth / (doc.tilewidth ?? 32),
    terrains: terrainIds,
  };
}

fs.mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('--'));
const unknown = only.filter((n) => !spec.sprites.some((s) => s.name === n));
if (unknown.length) {
  console.error(`unknown sprite name(s): ${unknown.join(', ')} (see ssg.assets.json)`);
  process.exit(1);
}
const manifestPath = path.join(out, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : {};
manifest.sprites ??= {};
// The shared settings of the project the sprites live in, read back from the generator so the manifest says what
// they were actually rendered with.
let project = null;
try {
  const r = await ssg(['projects', 'list']);
  project = (r.json ?? []).find((p) => p.name === spec.project) ?? null;
} catch {
  /* the manifest is still useful without them */
}
const defaults = project?.defaults ?? {};
Object.assign(manifest, {
  project: spec.project,
  view: defaults.viewCardId ?? spec.view ?? null,
  look: defaults.lookId ?? null,
  size: defaults.sizeId ?? null,
  format: defaults.profileId ?? spec.format ?? null,
  fps: defaults.view?.fps ?? spec.fps ?? null,
  generatedBy: 'Synty Sprite Generator (ssg CLI)',
});

const t0 = Date.now();
const failed = [];
const sprites = spec.sprites.filter((s) => !only.length || only.includes(s.name));
const tilesets = only.length ? [] : spec.tilesets ?? [];
console.error(`=== project "${spec.project}": sprites ${sprites.map((s) => s.name).join(', ')}`);
try {
  // One call declares the sprites and the tilesets: both are created/updated by name.
  const payload = { ...spec, sprites, tilesets };
  const r = await ssg(['sprite', 'apply', '-', '--render', '--download', 'public/assets', '--minutes', '120'], { input: JSON.stringify(payload) });
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  fs.writeFileSync(path.join(root, 'test-results/sprite-apply.json'), r.stdout);
  if (r.code !== 0) console.error(`  ssg sprite apply exited ${r.code}: ${r.json ? '' : r.stdout.trim().slice(0, 400)}`);
  for (const x of r.json?.sprites ?? []) console.error(`  ${x.name}: ${[x.action, x.render?.status ?? x.render, x.download?.status ?? x.download].filter((v) => typeof v === 'string').join(' · ')}`);
  for (const t of r.json?.tilesets ?? []) console.error(`  ${t.name} (tileset): ${[t.action, `${t.tiles ?? 0} tiles`].join(' · ')}`);
} catch (e) {
  console.error(`  FAILED: ${String(e.message).split('\n')[0]}`);
}
for (const s of sprites) {
  try {
    fs.rmSync(path.join(out, s.name, 'previews'), { recursive: true, force: true });
    manifest.sprites[s.name] = describe(s);
  } catch (e) {
    failed.push(s.name);
    console.error(`  ${s.name} FAILED: ${String(e.message).split('\n')[0]}`);
  }
}
for (const k of Object.keys(manifest.sprites)) if (!spec.sprites.some((s) => s.name === k)) delete manifest.sprites[k];
manifest.tilesets ??= {};
for (const t of tilesets) {
  try {
    const dir = path.join(out, 'tileset');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const r = await ssg(['tileset', 'render', t.name, '--project', spec.project, '--out', 'public/assets/tileset', '--format', 'tsj']);
    if (r.code !== 0) throw new Error(`ssg tileset render ${t.name} exited ${r.code}: ${(r.stdout || '').trim().slice(0, 300)}`);
    manifest.tilesets[t.name] = describeTileset(t);
  } catch (e) {
    failed.push(`tileset:${t.name}`);
    console.error(`  tileset ${t.name} FAILED: ${String(e.message).split('\n')[0]}`);
  }
}
for (const k of Object.keys(manifest.tilesets)) if (!tilesets.some((t) => t.name === k)) delete manifest.tilesets[k];
const ppms = [...new Set(Object.values(manifest.sprites).map((x) => x.pixelsPerMetre).filter(Boolean).map((v) => v.toFixed(3)))];
if (ppms.length > 1) console.error(`  WARNING: sprites disagree on pixels per metre: ${ppms.join(', ')}`);
manifest.ppm = Number(ppms[0] ?? spec.ppm ?? 0);
manifest.builtAt = new Date().toISOString();
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.error(
  `\n${Object.keys(manifest.sprites).length} sprites and ${Object.keys(manifest.tilesets).length} tilesets in the manifest, built in ${(
    (Date.now() - t0) /
    1000
  ).toFixed(1)} s${failed.length ? `; FAILED: ${failed.join(', ')}` : ''}`
);
// Vite's dev server can miss sprite folders that the download replaced: restart `npm run dev` if they 404.
console.error('(restart npm run dev if it was running: Vite may not see replaced public/assets folders)');
process.exit(failed.length ? 1 : 0);