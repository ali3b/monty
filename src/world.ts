import { COLS, ROWS } from './rooms';
import { TILE } from './main';

/** What the room decides Joe and the creatures can stand on. */
export interface World {
  /** Blocks from every side. */
  solid(col: number, row: number): boolean;
  /** A ledge: pass through from below, land on from above. `gone` covers a crumbling floor that has let go. */
  ledge(col: number, row: number, gone: Set<string>): boolean;
}

/**
 * A body in the rooms of the pyramid: a box whose origin is between its feet, moved and resolved against the tile
 * grid. The game needs very particular rules (a fixed-length jump, ladders, a fall that kills), so the collision is
 * done here rather than with the Arcade physics, whose body follows the sprite's texture origin.
 */
export class Mover {
  /** Centre x, and the y of the feet. */
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  w = 18;
  h = 46;
  onGround = false;
  /** Set when a step was stopped by a wall, so the creatures know to turn. */
  hitWall = false;
  /** Crumbling floors that have let go, keyed `${col},${row}`. */
  /** The room shares one set between Joe and the creatures. */
  gone = new Set<string>();

  get left() {
    return this.x - this.w / 2;
  }
  get right() {
    return this.x + this.w / 2;
  }
  get top() {
    return this.y - this.h;
  }
  get bottom() {
    return this.y;
  }

  get cx() {
    return this.x;
  }
  get cy() {
    return this.y - this.h / 2;
  }

  /** Move for dt seconds and resolve against the grid. */
  step(dt: number, world: World, gravity: number) {
    this.vy = Math.min(this.vy + gravity * dt, 900);
    this.hitWall = false;

    // ---- sideways ----
    this.x += this.vx * dt;
    if (this.vx !== 0) {
      const rowTop = Math.floor(this.top / TILE);
      const rowBottom = Math.floor((this.bottom - 1) / TILE);
      const col = this.vx > 0 ? Math.floor((this.right - 0.01) / TILE) : Math.floor((this.left + 0.01) / TILE);
      for (let row = rowTop; row <= rowBottom; row++) {
        if (!world.solid(col, row)) continue;
        if (this.vx > 0) this.x = col * TILE - this.w / 2 - 0.01;
        else this.x = (col + 1) * TILE + this.w / 2 + 0.01;
        this.hitWall = true;
        break;
      }
      if (this.hitWall) this.vx = 0;
    }

    // ---- down/up ----
    const wasBottom = this.bottom;
    this.y += this.vy * dt;
    this.onGround = false;
    const colFrom = Math.floor(this.left / TILE);
    const colTo = Math.floor((this.right - 1) / TILE);

    if (this.vy >= 0) {
      // Falling: land on the first surface the feet cross.
      let landing = Infinity;
      for (let col = colFrom; col <= colTo; col++) {
        const from = Math.max(0, Math.floor(wasBottom / TILE));
        const to = Math.min(ROWS - 1, Math.floor(this.bottom / TILE));
        for (let row = from; row <= to; row++) {
          const key = `${col},${row}`;
          if (!world.solid(col, row) && !(world.ledge(col, row, this.gone) && !this.gone.has(key))) continue;
          // Only catch Joe if his feet were above the surface before this step.
          if (wasBottom > row * TILE + 1) continue;
          landing = Math.min(landing, row * TILE);
        }
      }
      if (landing !== Infinity) {
        this.y = landing;
        this.vy = 0;
        this.onGround = true;
      }
    } else {
      // Rising: stop under a ceiling.
      const row = Math.floor(this.top / TILE);
      for (let col = colFrom; col <= colTo; col++) {
        if (!world.solid(col, row)) continue;
        this.y = (row + 1) * TILE + this.h;
        this.vy = 0;
        break;
      }
    }

    // Out of the room.
    this.x = Phaser_Clamp(this.x, this.w / 2, COLS * TILE - this.w / 2);
  }

  /** Is there anything to stand on just ahead? Used by the creatures so they turn at a ledge. */
  hasFloorAhead(world: World, dir: number, dy = 6): boolean {
    const col = Math.floor((this.x + dir * (this.w / 2 + 2)) / TILE);
    const row = Math.floor((this.y + dy) / TILE);
    return world.solid(col, row) || world.ledge(col, row, this.gone);
  }
}

// A tiny local clamp, so this module needs no Phaser import.
function Phaser_Clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}