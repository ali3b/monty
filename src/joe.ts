import Phaser from 'phaser';
import { clipKey } from './assets';
import { Facing } from './rooms';
import { FALL_LIMIT, JUMP_SPEED, TILE, WALK_SPEED } from './main';
import { Mover, World } from './world';

export type JoeState = 'idle' | 'walk' | 'back' | 'jump' | 'crouch' | 'climb' | 'dead' | 'win';

/** A ladder Joe can climb both ways, or a rope he can only slide down, as in the original. */
export interface Climbable {
  col: number;
  /** Topmost and bottom row of the climbable, in tiles. */
  top: number;
  bottom: number;
  rope: boolean;
}

const CLIMB_SPEED = 108;

// FB-007: the walk clip stands in for climbing, because the library has no ladder or rope clip. The game keeps
// every ladder move (walk up, walk down, step off) on that one clip.
const CLIP = {
  idle: 'martial_arts_idle',
  walk: 'martial_arts_walk_forward',
  back: 'martial_arts_walk_back',
  jump: 'martial_arts_jump',
  crouch: 'martial_arts_crouch_idle',
  dead: 'martial_arts_ko',
} as const;

export class Joe {
  readonly mover = new Mover();
  view: Phaser.GameObjects.Sprite;
  state: JoeState = 'idle';
  facing: Facing = 'E';
  hasSword = false;
  dead = false;
  /** The ladder or rope he is on right now. */
  private climbable: Climbable | null = null;
  /** Every ladder and rope in the room. */
  climbables: Climbable[] = [];
  /** The tile his feet left when he last stood on something, for the fatal-fall rule. */
  private fellFrom = 0;
  /** The room object, for the ladders. */
  private world!: World;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.view = scene.add.sprite(x, y, 'joe').setDepth(60);
    this.mover.x = x;
    this.mover.y = y;
    this.fellFrom = y;
    this.playClip(CLIP.idle);
  }

  private playClip(clip: string) {
    const key = clipKey(this.view.scene, 'joe', clip, this.facing);
    if (!key) return;
    if (this.view.anims.currentAnim?.key !== key) this.view.play(key, true);
  }

  /** The climbable under Joe's feet, if any. */
  private climbableAt(): Climbable | null {
    const col = Math.floor(this.mover.x / TILE);
    const row = Math.floor((this.mover.y - 4) / TILE);
    return this.climbables.find((c) => col === c.col && row >= c.top && row <= c.bottom) ?? null;
  }

  update(input: { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean }, dt: number, world: World, gravity: number) {
    this.world = world;
    const m = this.mover;
    if (this.dead) {
      // He falls where he was struck.
      m.vx = 0;
      m.step(dt, world, gravity);
      this.syncView();
      return;
    }
    if (this.state === 'win') {
      m.vx = 0;
      m.vy = 0;
      this.playClip(CLIP.idle);
      this.syncView();
      return;
    }

    // ---- ladders and ropes -------------------------------------------------------------------------
    const near = this.climbableAt();
    if (this.climbable) {
      const c = this.climbable;
      m.vx = 0;
      m.vy = 0;
      m.x = c.col * TILE + TILE / 2;
      // A rope only goes down; a ladder goes both ways. Neither carries Joe past its ends.
      const dir = input.down ? 1 : input.up ? -1 : 0;
      if (!c.rope || dir === 1) {
        const floor = (c.bottom + 1) * TILE;
        m.y = Math.min(floor, Math.max(c.top * TILE, m.y + dir * CLIMB_SPEED * dt));
      }
      // Step off sideways onto a platform, at the top of the ladder or anywhere along it.
      if (input.left !== input.right) {
        m.x += (input.left ? -1 : 1) * CLIMB_SPEED * dt;
        const col = Math.floor(m.x / TILE);
        const rowBelow = Math.floor((m.y + 2) / TILE);
        if (world.solid(col, rowBelow) || world.ledge(col, rowBelow, m.gone)) this.dropClimb();
      }
      // A rope can be let go of with a jump; a ladder has to be climbed to its end.
      if (input.jump && c.rope) this.dropClimb();
      this.state = 'climb';
      this.playClip(CLIP.walk);
      this.syncView();
      return;
    }
    // A ladder is caught with up or down; a rope only with down, as Joe never climbs back up one.
    if (near && (near.rope ? input.down : input.up || input.down)) {
      this.climbable = near;
      m.vx = 0;
      m.vy = 0;
      return;
    }

    // ---- walking -----------------------------------------------------------------------------------
    if (input.left !== input.right) {
      this.facing = input.left ? 'W' : 'E';
      m.vx = (input.left ? -1 : 1) * WALK_SPEED;
    } else if (m.onGround) {
      m.vx = 0;
    }

    if (input.jump && m.onGround) {
      // A fixed-length jump, as in the original: once he is in the air it cannot be steered.
      m.vy = -JUMP_SPEED;
      this.fellFrom = m.y;
      this.state = 'jump';
      this.playClip(CLIP.jump);
    }

    m.step(dt, world, gravity);

    // The original kills Joe on a fall further than his own height. The drop is measured over the whole fall, not
    // frame by frame, so a slow frame cannot turn a fatal fall into a safe one.
    const drop = m.y - this.fellFrom;
    if (drop > FALL_LIMIT) this.kill();
    else if (!m.onGround) {
      this.state = 'jump';
      this.playClip(CLIP.jump);
    } else if (input.down) {
      m.vx = 0;
      this.state = 'crouch';
      this.playClip(CLIP.crouch);
    } else if (input.left !== input.right) {
      this.state = 'walk';
      this.playClip(CLIP.walk);
    } else {
      this.state = 'idle';
      this.playClip(CLIP.idle);
    }
    if (m.onGround) this.fellFrom = m.y;
    this.syncView();
  }

  /** Leave a ladder or rope and stand on the floor again. */
  private dropClimb() {
    this.climbable = null;
    this.state = 'idle';
  }

  private syncView() {
    this.view.setPosition(Math.round(this.mover.x), Math.round(this.mover.y));
  }

  /** Joe is caught: stop him where he is. */
  kill() {
    if (this.dead) return;
    this.dead = true;
    this.state = 'dead';
    this.climbable = null;
    this.mover.vx = 0;
    this.playClip(CLIP.dead);
  }

  /** Standing on the idol, for the end of the level. */
  win() {
    this.state = 'win';
    this.climbable = null;
    this.view.setTint(0xffe9a8);
  }

  get isClimbing() {
    return this.climbable !== null;
  }
}