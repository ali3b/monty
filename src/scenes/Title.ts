import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../main';
import { manifest, tilesTexture, terrainId } from '../assets';
import { resetState, state } from '../state';
import { sfx } from '../sfx';
import { COLS, ROWS } from '../rooms';
import { TILE } from '../main';

export class Title extends Phaser.Scene {
  private prompt?: Phaser.GameObjects.Text;
  private joe?: Phaser.GameObjects.Sprite;
  private high = 0;

  constructor() {
    super('title');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b0709');
    // The tomb wall behind the logo, from the generated ground tiles.
    const tex = tilesTexture(this);
    if (tex) {
      const frame = terrainId(this, 'brick');
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          this.add.image(col * TILE, row * TILE, tex, frame).setOrigin(0).setAlpha(0.5);
        }
      }
      for (let col = 0; col < COLS; col++) {
        this.add.image(col * TILE, (ROWS - 3) * TILE, tex, terrainId(this, 'stone')).setOrigin(0);
      }
    }
    const g = this.add.graphics().setAlpha(0.55);
    g.fillStyle(0x000000, 1).fillRect(0, 96, WIDTH, 96);

    const line = (text: string, y: number, size: number, colour: string) =>
      this.add
        .text(WIDTH / 2, y, text, { fontFamily: '"Press Start 2P", monospace', fontSize: `${size}px`, color: colour, align: 'center' })
        .setOrigin(0.5)
        .setResolution(2);

    line("MONTEZUMA'S", 44, 16, '#ffd75e');
    line('REVENGE', 68, 16, '#ffd75e');
    line('FEATURING PANAMA JOE', 108, 7, '#f4e4c4');
    line('A 1984 TEMPLE OF DOORS, KEYS AND SKULLS', 126, 6, '#b79a6a');

    // Joe pacing on the floor.
    const e = manifest(this)?.sprites.joe;
    if (e && this.textures.exists(e.textureKey)) {
      this.joe = this.add.sprite(WIDTH / 2, (ROWS - 3) * TILE, e.textureKey);
      const key = `${e.animPrefix}martial_arts_walk_forward_E`;
      if (this.anims.exists(key)) this.joe.play(key);
    }

    this.prompt = line('PRESS ENTER TO DESCEND', HEIGHT - 28, 8, '#ffffff');
    this.tweens.add({ targets: this.prompt, alpha: 0.25, duration: 600, yoyo: true, repeat: -1 });
    this.high = Number(localStorage.getItem('monty.high') ?? 0);
    line(`HIGH SCORE ${String(Math.max(this.high, state.score)).padStart(6, '0')}`, HEIGHT - 52, 7, '#b79a6a');

    this.input.keyboard?.on('keydown-ENTER', () => this.start());
    this.input.keyboard?.on('keydown-SPACE', () => this.start());
  }

  private start() {
    if (!this.scene.isActive()) return;
    resetState();
    sfx.extra();
    this.scene.start('room', {});
  }
}