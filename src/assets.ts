import Phaser from 'phaser';

/** One entry of public/assets/manifest.json (written by scripts/build-assets.mjs). */
export interface SpriteEntry {
  name: string;
  asset: string;
  textureKey: string;
  atlas: string;
  path: string;
  anims: string;
  /** Prefix of the exported animation keys (`<base>/`). */
  animPrefix: string;
  meta: string | null;
  pixelsPerMetre: number | null;
  /** Untrimmed frame size in pixels. */
  frameSize: [number, number] | null;
  dirs: string[];
  clips: string[];
  clipInfo: Record<string, { frames: number | null; speedMps: number | null; events: { frame: number; name: string }[] }>;
  validation: unknown[];
}

export interface TilesetEntry {
  name: string;
  image: string;
  tsj: string;
  tile: string;
  width: number;
  height: number;
  columns: number;
  /** Terrain name -> tile id in the atlas (the plain tile of that terrain). */
  terrains: Record<string, number>;
}

export interface AssetManifest {
  project: string;
  view: string;
  format: string;
  fps: number;
  ppm: number;
  sprites: Record<string, SpriteEntry>;
  tilesets: Record<string, TilesetEntry>;
}

interface AnimJson {
  anims: { key: string; frameRate: number; repeat: number; frames: { key: string; frame: string }[] }[];
}

/** Queue the manifest; once it arrives, queue every sprite's atlas, animations and meta, and the tilesets. Call from preload(). */
export function preloadAssets(scene: Phaser.Scene) {
  scene.load.json('manifest', 'assets/manifest.json');
  scene.load.once('filecomplete-json-manifest', (_key: string, _type: string, m: AssetManifest) => {
    for (const s of Object.values(m.sprites)) {
      // The sprite's own name is the texture key.
      scene.load.multiatlas(s.name, s.atlas, s.path);
      scene.load.json(`anims:${s.name}`, s.anims);
      if (s.meta) scene.load.json(`meta:${s.name}`, s.meta);
    }
    for (const t of Object.values(m.tilesets ?? {})) {
      // The atlas is a plain grid of tiles, so it loads as a spritesheet and the terrain ids index it.
      scene.load.spritesheet(`tiles:${t.name}`, t.image, { frameWidth: t.width, frameHeight: t.height });
    }
  });
}

/** After loading: register every sprite's animations under the exported keys, on the sprite's own texture. */
export function setupAssets(scene: Phaser.Scene): AssetManifest | null {
  const m = scene.cache.json.get('manifest') as AssetManifest | undefined;
  if (!m) return null;
  for (const s of Object.values(m.sprites)) {
    if (!scene.textures.exists(s.name)) continue;
    const aj = scene.cache.json.get(`anims:${s.name}`) as AnimJson | undefined;
    for (const a of aj?.anims ?? []) {
      if (scene.anims.exists(a.key)) continue;
      scene.anims.create({
        key: a.key,
        frameRate: a.frameRate,
        repeat: a.repeat,
        frames: a.frames.map((f) => ({ key: s.name, frame: f.frame })),
      });
    }
  }
  return m;
}

export function manifest(scene: Phaser.Scene): AssetManifest | null {
  return (scene.cache.json.get('manifest') as AssetManifest | undefined) ?? null;
}

/**
 * The exported clips are named `<base>/<clip>_<dir>`, and the side view renders both facings (`_E`, `_W`), so the game
 * plays the direction it wants instead of flipping. Returns undefined when a clip is missing.
 */
export function clipKey(scene: Phaser.Scene, sprite: string, clip: string, facing: 'E' | 'W' = 'E'): string | undefined {
  const m = manifest(scene);
  const entry = m?.sprites[sprite];
  if (!entry) return undefined;
  const key = `${entry.animPrefix}${clip}_${facing}`;
  return scene.anims.exists(key) ? key : undefined;
}

/** The tile id of a ground terrain in the atlas, for stamping the room. */
export function terrainId(scene: Phaser.Scene, terrain: string): number {
  const m = manifest(scene);
  const t = Object.values(m?.tilesets ?? {})[0];
  return t?.terrains[terrain] ?? 0;
}

/** Texture key of the ground atlas. */
export function tilesTexture(scene: Phaser.Scene): string | null {
  const m = manifest(scene);
  const t = Object.values(m?.tilesets ?? {})[0];
  return t ? `tiles:${t.name}` : null;
}