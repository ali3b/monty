import Phaser from 'phaser';
import { preloadAssets, setupAssets } from '../assets';
import { Title } from './Title';
import { Room } from './Room';

export class Boot extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    preloadAssets(this);
  }

  create() {
    if (!setupAssets(this)) {
      // The manifest never arrived: the assets have not been built (`npm run assets`).
      this.add
        .text(160, 140, 'ASSETS MISSING\n\nrun: npm run assets', {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '10px',
          color: '#ffb4a2',
          align: 'center',
        })
        .setOrigin(0.5);
      return;
    }
    const wanted = new URLSearchParams(window.location.search).get('scene');
    if (wanted === 'room') this.scene.start('room', {});
    else if (wanted === 'gameover') this.scene.start('gameover', {});
    else this.scene.start('title');
  }
}