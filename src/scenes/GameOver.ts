import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../main';
import { state } from '../state';
import { resetState } from '../state';
import { sfx } from '../sfx';

export class GameOver extends Phaser.Scene {
  constructor() {
    super('gameover');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0b0709');
    const best = Math.max(Number(localStorage.getItem('monty.high') ?? 0), state.score);
    localStorage.setItem('monty.high', String(best));
    const text = (t: string, y: number, size: number, colour: string) =>
      this.add
        .text(WIDTH / 2, y, t, { fontFamily: '"Press Start 2P", monospace', fontSize: `${size}px`, color: colour, align: 'center' })
        .setOrigin(0.5)
        .setResolution(2);

    text('THE TOMB KEEPS YOU', 96, 9, '#ffb4a2');
    text(`SCORE ${String(state.score).padStart(6, '0')}`, 132, 10, '#f4e4c4');
    text(`DEPTH ${state.level}`, 154, 8, '#b79a6a');
    text(`JEWELS ${state.jewels}`, 174, 8, '#b79a6a');
    text(`BEST ${String(best).padStart(6, '0')}`, 206, 8, '#ffd75e');

    const prompt = text('PRESS ENTER', HEIGHT - 34, 9, '#ffffff');
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 600, yoyo: true, repeat: -1 });
    this.input.keyboard?.on('keydown-ENTER', () => {
      resetState();
      sfx.door();
      this.scene.start('title');
    });
  }
}