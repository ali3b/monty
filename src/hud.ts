import Phaser from 'phaser';
import { manifest, SpriteEntry } from './assets';
import { KeyColour } from './rooms';

export const HUD_HEIGHT = 24;

const KEY_COLOURS: Record<KeyColour, number> = { gold: 0xffd34d, silver: 0xd8d8e0, red: 0xff5a4d };

/**
 * The status strip across the top of the room: score, level, lives, the keys in Joe's pocket and the five things he
 * can carry (jewels do not take a slot, as in the original).
 */
export class Hud {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private sprites: Record<string, SpriteEntry>;

  score = 0;
  lives = 3;
  level = 1;
  keys: Record<KeyColour, number> = { gold: 0, silver: 0, red: 0 };
  /** Item textures in pocket order; jewels are counted on their own. */
  pack: string[] = [];
  jewels = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.sprites = manifest(scene)?.sprites ?? {};
    this.container = scene.add.container(0, 0).setDepth(900).setScrollFactor(0);
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.82).fillRect(0, 0, scene.scale.width, HUD_HEIGHT);
    g.lineStyle(1, 0x6b4f2a, 1).strokeRect(0.5, 0.5, scene.scale.width - 1, HUD_HEIGHT - 1);
    this.container.add(g);
    this.redraw();
  }

  /** ICONS[name] -> the texture of that item, or undefined when the asset is missing. */
  private icon(name: string): Phaser.Textures.Texture | null {
    const e = this.sprites[name];
    return e && this.scene.textures.exists(e.textureKey) ? this.scene.textures.get(e.textureKey) : null;
  }

  private label(x: number, y: number, text: string, size = 8, colour = '#f4e4c4') {
    const t = this.scene.add
      .text(x, y, text, { fontFamily: '"Press Start 2P", monospace', fontSize: `${size}px`, color: colour })
      .setResolution(2);
    this.container.add(t);
    return t;
  }

  /** A small still of an item sprite, for the pocket and the key counts. */
  private thumb(name: string, x: number, y: number, scale = 0.34) {
    const e = this.sprites[name];
    if (!e || !this.scene.textures.exists(e.textureKey)) return;
    const img = this.scene.add.image(x, y, e.textureKey).setOrigin(0.5).setScale(scale).setTint(0xffffff);
    this.container.add(img);
  }

  private clearDynamic() {
    for (const child of [...this.container.list]) if (child instanceof Phaser.GameObjects.Text || child instanceof Phaser.GameObjects.Image) child.destroy();
  }

  redraw() {
    this.clearDynamic();
    const w = this.scene.scale.width;
    const score = this.label(8, 8, `SCORE ${String(this.score).padStart(6, '0')}`);
    score.setFixedSize(118, 12);

    // The five pocket slots, then the jewels, which never use one.
    const pockets = 136;
    for (let i = 0; i < 5; i++) {
      const x = pockets + i * 20;
      const g = this.scene.add.graphics();
      g.lineStyle(1, 0x6b4f2a, 1).strokeRect(x - 8, 5, 16, 14);
      this.container.add(g);
      const item = this.pack[i];
      if (item) this.thumb(item, x, 12, 0.3);
    }
    if (this.jewels > 0) {
      this.thumb('jewel', pockets + 108, HUD_HEIGHT / 2, 0.3);
      this.label(pockets + 117, 8, `x${this.jewels}`);
    }

    this.label(w / 2 - 30, 8, `LEVEL ${this.level}`);
    this.label(w - 62, 8, `LIVES ${this.lives}`);

    // Keys in the pocket, coloured as their doors.
    let kx = w - 142;
    for (const c of ['gold', 'silver', 'red'] as KeyColour[]) {
      const n = this.keys[c];
      if (n <= 0) continue;
      this.thumb(`key_${c}`, kx, HUD_HEIGHT / 2, 0.3);
      const t = this.label(kx + 8, 9, `x${n}`, 8, '#' + KEY_COLOURS[c].toString(16).padStart(6, '0'));
      t.setOrigin(0, 0);
      kx += 32;
    }
  }

  destroy() {
    this.container.destroy();
  }
}

/** Can Joe carry one more thing? Jewels are free, as in the original. */
export function packFull(hud: Hud): boolean {
  return hud.pack.length >= 5;
}