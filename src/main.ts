import Phaser from 'phaser';
import { state } from './state';
import { Boot } from './scenes/Boot';
import { Title } from './scenes/Title';
import { Room } from './scenes/Room';
import { GameOver } from './scenes/GameOver';

/** The room grid. One tile is one metre, so every sprite is drawn at the scale the generator exported it. */
export const TILE = 32;
export const COLS = 20;
export const ROWS = 11;
export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;

/** Joe's feel: a fixed-length Donkey Kong jump, which cannot be steered once he is in the air. */
export const GRAVITY = 2200;
export const JUMP_SPEED = 680;
export const WALK_SPEED = 150;
/** A drop further than this is fatal, as in the original. */
export const FALL_LIMIT = 84;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: document.body,
  backgroundColor: '#0b0709',
  width: WIDTH,
  height: HEIGHT,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, autoRound: true },
  render: { roundPixels: true, antialias: false },
  scene: [Boot, Title, Room, GameOver],
});

// Exposed for scripts/load-check.mjs.
(window as unknown as { game: Phaser.Game; state: typeof state }).game = game;
(window as unknown as { game: Phaser.Game; state: typeof state }).state = state;