import Phaser from 'phaser';
import { clipKey, manifest, terrainId, tilesTexture } from '../assets';
import { COLS, ROWS, TILE, WIDTH, HEIGHT, GRAVITY } from '../main';
import { state } from '../state';
import { sfx } from '../sfx';
import { Climbable, Joe } from '../joe';
import { HUD_HEIGHT, Hud, packFull } from '../hud';
import { DoorDef, Facing, RoomDef, START_ROOM, room } from '../rooms';
import { Mover, World } from '../world';

/** What an ASCII cell holds that is not part of the scenery. */
interface Pickup {
  sprite: Phaser.GameObjects.Sprite;
  kind: string;
  points?: number;
  /** The texture it puts in Joe's pocket, when it takes one of the five slots. */
  carry?: string;
}

interface Creature {
  mover: Mover;
  view: Phaser.GameObjects.Sprite;
  kind: 'skull' | 'skeleton';
  dir: number;
  dead: boolean;
  /** Early levels: the creature does not come back after it has caught Joe once. */
  spent: boolean;
}

interface Crumble {
  col: number;
  row: number;
  view: Phaser.GameObjects.Image;
  timer: number;
  state: 'solid' | 'falling' | 'gone';
}

const WALL = '#';
const PLATFORM = '=';
const LADDER = 'H';
const ROPE = 'R';
const FIRE = '^';
const CRUMBLE = 'x';

const DOOR_TINT: Record<string, number> = { gold: 0xffd34d, silver: 0xd8d8e0, red: 0xff5a4d };
/** Jewels by colour: the deeper the colour, the more it is worth, as in the original. */
const JEWELS = [
  { tint: 0x7fd4ff, points: 500 },
  { tint: 0x9dffb0, points: 300 },
  { tint: 0xfff2a8, points: 200 },
  { tint: 0xffffff, points: 100 },
];
/** Brush sizes (canvas textures) for the two light radii: no torch, and torch. */
const DARK_R = 112;
const LIT_R = 156;

export class Room extends Phaser.Scene {
  private def!: RoomDef;
  private defId = START_ROOM;
  private grid: string[][] = [];
  private joe!: Joe;
  private hud!: Hud;
  private pickups: Pickup[] = [];
  private creatures: Creature[] = [];
  private crumbles: Crumble[] = [];
  private climbables: Climbable[] = [];
  private doors: (DoorDef & { view: Phaser.GameObjects.Image; zone: Phaser.GameObjects.Rectangle })[] = [];
  private idol: Phaser.GameObjects.Image | null = null;
  private darkness: Phaser.GameObjects.RenderTexture | null = null;
  private spawn: [number, number] = [1, ROWS - 2];
  private face: Facing = 'E';
  private nextRoom: { roomId: string; spawn?: [number, number]; face?: Facing } | null = null;
  /** Set while a room change, a death or the end of the bonus is under way. */
  private busy = false;
  private bonusMode = false;
  private bonusLeft = 0;
  private frozen = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  /** The crumbling floors that have let go, shared by everyone in the room. */
  private gone = new Set<string>();

  constructor() {
    super('room');
  }

  /** What Joe and the creatures can walk into, and what they can stand on. */
  private world: World = {
    solid: (col, row) => {
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
      return this.grid[row][col] === WALL;
    },
    ledge: (col, row, gone) => {
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
      const c = this.grid[row][col];
      return c === PLATFORM || (c === CRUMBLE && !gone.has(`${col},${row}`));
    },
  };

  init(data: { roomId?: string; spawn?: [number, number]; face?: Facing; level?: number } = {}) {
    const params = new URLSearchParams(window.location.search);
    // Room changes inside the game always carry their own data; only a fresh page load reads the query string.
    const fresh = data.roomId === undefined;
    this.defId = data.roomId ?? params.get('room') ?? START_ROOM;
    // ?level= opens the pyramid at a depth, so a room can be looked at as it is deeper down.
    const level = data.level ?? (fresh ? params.get('level') : null);
    if (level) state.level = Number(level);
    const def = room(this.defId);
    const marker = def.rows.findIndex((r) => r.includes('@'));
    this.spawn = data.spawn ?? (marker >= 0 ? [def.rows[marker].indexOf('@'), marker] : [1, ROWS - 2]);
    this.face = data.face ?? 'E';
    this.bonusMode = this.defId === 'bonus';
    this.bonusLeft = this.bonusMode ? 30 : 0;
    this.busy = false;
    this.nextRoom = null;
    this.gone = new Set<string>();
  }

  // ---- building --------------------------------------------------------------------------------------------

  tileAt(col: number, row: number): string {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return WALL;
    return this.grid[row][col] ?? ' ';
  }

  private centre(col: number, row: number) {
    return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
  }

  create() {
    if (!manifest(this)) {
      this.scene.start('title');
      return;
    }
    this.def = room(this.defId);
    this.grid = this.def.rows.map((r) => r.padEnd(COLS, ' ').split(''));
    this.cameras.main.setBackgroundColor('#0b0709');
    this.cameras.main.fadeIn(220, 0, 0, 0);

    const kb = this.input.keyboard;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left: kb!.addKey(K.LEFT),
      a: kb!.addKey(K.A),
      right: kb!.addKey(K.RIGHT),
      d: kb!.addKey(K.D),
      up: kb!.addKey(K.UP),
      w: kb!.addKey(K.W),
      down: kb!.addKey(K.S),
      space: kb!.addKey(K.SPACE),
    };

    this.drawScenery();
    this.buildClimbables();
    this.buildCrumbles();
    this.buildFires();
    this.buildPickups();
    this.buildIdol();
    this.buildDoors();
    this.buildCreatures();
    this.buildJoe();
    this.buildDarkness();
    this.buildHud();

    this.cameras.main.once('camerafadeoutcomplete', () => {
      // nextRoom names a room in the pyramid, not a scene: the game is one scene that rebuilds itself.
      if (this.nextRoom) this.scene.start('room', this.nextRoom);
      else this.scene.start('gameover');
    });
  }

  /** A scenery sprite from the manifest, sitting on the floor of its cell. */
  private addProp(name: string, col: number, row: number, depth: number, scale = 0.8) {
    const e = manifest(this)?.sprites[name];
    if (!e || !this.textures.exists(e.textureKey)) return null;
    return this.add
      .image(col * TILE + TILE / 2, (row + 1) * TILE, e.textureKey)
      .setOrigin(0.5, 0.95)
      .setDepth(depth)
      .setScale(scale);
  }

  /** The background, the walls and the platforms, painted with the generated ground tiles. */
  private drawScenery() {
    const tex = tilesTexture(this);
    if (!tex) return;
    const at = (terrain: string, col: number, row: number) =>
      this.add.image(col * TILE, row * TILE, tex, terrainId(this, terrain)).setOrigin(0).setDepth(0);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const c = this.grid[row][col];
        if (c === WALL) at('brick', col, row);
        else if (c === PLATFORM) at('stone', col, row);
        else if (c === CRUMBLE) at('floor', col, row);
        else if (c === FIRE) at('ember', col, row);
        else at('void', col, row);
      }
    }
    // A lit top edge on every ledge, so the platforms read as platforms.
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0xc8a86c, 0.85);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const c = this.grid[row][col];
        if ((c === PLATFORM || c === CRUMBLE) && this.tileAt(col, row - 1) === '.') g.fillRect(col * TILE, row * TILE, TILE, 3);
      }
    }
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const c = this.grid[row][col];
        if (c !== 'W' && c !== 'B' && c !== 'V' && c !== 'T') continue;
        const name = c === 'W' ? 'web' : c === 'B' ? 'skull_pile' : c === 'V' ? 'vase' : 'torch';
        const img = this.addProp(name, col, row, 5, c === 'V' ? 0.7 : c === 'T' ? 1.3 : 0.9);
        if (!img) continue;
        if (c === 'V') img.setTint(0xd8b48a);
        if (c === 'T') {
          img.setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc27a);
          this.tweens.add({ targets: img, alpha: 0.75, duration: 420, yoyo: true, repeat: -1 });
        }
      }
    }
  }

  private buildClimbables() {
    for (let col = 0; col < COLS; col++) {
      let start = -1;
      for (let row = 0; row <= ROWS; row++) {
        const c = row < ROWS ? this.grid[row][col] : ' ';
        const rope = c === ROPE;
        if ((c === LADDER || rope) && start < 0) start = row;
        if (c !== LADDER && !rope && start >= 0) {
          const climb: Climbable = { col, top: start, bottom: row - 1, rope };
          this.climbables.push(climb);
          this.drawClimbable(climb);
          start = -1;
        }
      }
    }
  }

// FB-002: ladders and ropes are drawn because the generated ladder prop renders as a 12-pixel-wide 3D ladder
// seen at an angle, which cannot be read in a flat side view. Delete this when the library has a 2D ladder.
private drawClimbable(c: Climbable) {
    const top = c.top * TILE;
    const bottom = (c.bottom + 1) * TILE;
    const x = c.col * TILE + TILE / 2;
    const g = this.add.graphics().setDepth(8);
    const wood = c.rope ? 0x9a7440 : 0xc9a25e;
    const shade = c.rope ? 0x6a4c26 : 0x8a6a3c;
    if (c.rope) {
      g.lineStyle(3, wood, 1).lineBetween(x, top, x, bottom);
      g.fillStyle(shade, 1).fillCircle(x, bottom - 4, 4);
      return;
    }
    // Two rails and the rungs between them.
    for (const dx of [-8, 8]) {
      g.fillStyle(shade, 1).fillRect(x + dx - 1.5, top, 3, bottom - top);
      g.fillStyle(wood, 1).fillRect(x + dx - 1, top, 2, bottom - top);
    }
    for (let y = top + 8; y < bottom - 2; y += 11) {
      g.fillStyle(shade, 1).fillRect(x - 10, y, 20, 4);
      g.fillStyle(wood, 1).fillRect(x - 9, y + 1, 18, 2);
    }
  }

  private buildCrumbles() {
    const tex = tilesTexture(this);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (this.grid[row][col] !== CRUMBLE) continue;
        const view = this.add
          .image(col * TILE, row * TILE, tex ?? '__DEFAULT', terrainId(this, 'floor'))
          .setOrigin(0)
          .setDepth(1)
          .setTint(0xbb9259);
        this.crumbles.push({ col, row, view, timer: 0, state: 'solid' });
      }
    }
  }

  private buildFires() {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (this.grid[row][col] !== FIRE) continue;
        const img = this.addProp('flame', col, row, 20, 1.15);
        if (!img) continue;
        img.setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: img, y: img.y - 5, scaleY: 1.25, duration: 330, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
    }
  }

  private buildPickups() {
    const table: Record<string, [string, string, number?, string?]> = {
      y: ['key_gold', 'key:gold', 25],
      w: ['key_silver', 'key:silver', 25],
      e: ['key_red', 'key:red', 25],
      j: ['jewel', 'jewel', 100],
      o: ['gold', 'gold', 50],
      t: ['torch', 'torch', 50, 'torch'],
      d: ['sword', 'sword', 50, 'sword'],
    };
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const t = table[this.grid[row][col]];
        if (!t) continue;
        const e = manifest(this)?.sprites[t[0]];
        if (!e || !this.textures.exists(e.textureKey)) continue;
        const { x, y } = this.centre(col, row);
        const sprite = this.add.sprite(x, y, e.textureKey).setDepth(45);
        // The original's jewels come in several colours and the rarer ones are worth more. The generated gem is a
        // dark ruby, so the colour is added on top rather than multiplied: the shape and its shading stay.
        if (t[1] === 'jewel') {
          const k = (col + row) % JEWELS.length;
          sprite.setBlendMode(Phaser.BlendModes.ADD).setTint(JEWELS[k].tint);
          this.pickups.push({ sprite, kind: t[1], points: JEWELS[k].points, carry: t[3] });
        } else {
          this.pickups.push({ sprite, kind: t[1], points: t[2], carry: t[3] });
        }
        const key = clipKey(this, t[0], 'bob');
        if (key) sprite.play(key);
      }
    }
  }

  private buildIdol() {
    if (!this.def.idol) return;
    const e = manifest(this)?.sprites.jewel;
    if (!e) return;
    const [col, row] = this.def.idol;
    const { x, y } = this.centre(col, row);
    this.idol = this.add.image(x, y, e.textureKey).setDepth(46).setScale(2.6).setTint(0xffe9a0).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: this.idol, y: y - 5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  private buildDoors() {
    for (const d of this.def.doors) {
      const e = manifest(this)?.sprites.door;
      if (!e || !this.textures.exists(e.textureKey)) continue;
      const y = d.y * TILE + TILE / 2;
      const view = this.add
        .image(d.dir === 'left' ? 2 : WIDTH - 2, y, e.textureKey)
        .setOrigin(d.dir === 'left' ? 0 : 1, 0.5)
        .setDepth(30)
        .setScale(1.7)
        .setTint(DOOR_TINT[d.colour]);
      const zone = this.add.rectangle(d.dir === 'left' ? 12 : WIDTH - 12, y, 24, TILE + 6, 0xffffff, 0).setDepth(31);
      this.doors.push({ ...d, view, zone });
    }
  }

  private buildCreatures() {
    const place = (kind: 'skull' | 'skeleton', col: number, row: number) => {
      const name = kind === 'skull' ? 'skull' : 'skeleton';
      const e = manifest(this)?.sprites[name];
      if (!e || !this.textures.exists(e.textureKey)) return;
      const { x, y } = this.centre(col, row);
      const view = this.add.sprite(x, y, e.textureKey).setDepth(55);
      const mover = new Mover();
      mover.x = x;
      mover.y = (row + 1) * TILE;
      mover.w = kind === 'skull' ? 20 : 22;
      mover.h = kind === 'skull' ? 22 : 46;
      mover.gone = this.gone;
      view.setPosition(mover.x, mover.y - mover.h);
      this.creatures.push({ mover, view, kind, dir: col % 2 ? 1 : -1, dead: false, spent: false });
      this.playCreature(view, kind, 'E');
    };
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const c = this.grid[row][col];
        if (c === 's') place('skull', col, row);
        else if (c === 'k') place('skeleton', col, row);
      }
    }
    for (const extra of this.def.extraEnemies ?? []) {
      if (state.level >= extra.from) place(extra.kind, extra.x, extra.y);
    }
  }

  private playCreature(view: Phaser.GameObjects.Sprite, kind: 'skull' | 'skeleton', face: Facing, clip?: string) {
    // A view destroyed with the scene has no anims any more; the last update before a shutdown can still reach here.
    if (!view?.scene || !view.anims) return;
    const key = clipKey(this, kind === 'skull' ? 'skull' : 'skeleton', clip ?? (kind === 'skull' ? 'bounce' : 'Walk_F'), face);
    if (key) view.play(key, true);
  }

  private buildJoe() {
    this.joe = new Joe(this, this.spawn[0] * TILE + TILE / 2, this.spawn[1] * TILE + TILE);
    this.joe.mover.gone = this.gone;
    this.joe.climbables = this.climbables;
    this.joe.facing = this.face;
  }

  /** Dark rooms are a black screen with a hole around Joe, wider when he carries the torch. */
  private buildDarkness() {
    const dark = this.def.darkFrom !== undefined && state.level >= this.def.darkFrom;
    if (!dark) return;
    for (const [name, r] of [
      ['brushDark', DARK_R],
      ['brushLit', LIT_R],
    ] as [string, number][]) {
      if (this.textures.exists(name)) continue;
      const tex = this.textures.createCanvas(name, r * 2, r * 2);
      if (!tex) continue;
      const ctx = tex.getContext();
      if (!ctx) continue;
      const g = ctx.createRadialGradient(r, r, r * 0.05, r, r, r);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.78, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, r * 2, r * 2);
      tex.refresh();
    }
    this.darkness = this.add.renderTexture(0, 0, WIDTH, HEIGHT).setOrigin(0).setDepth(45);
  }

  private buildHud() {
    this.hud = new Hud(this);
    this.syncHud();
    this.levelCard();
  }

  private levelCard() {
    const text = this.add
      .text(WIDTH / 2, HEIGHT / 2 - 24, this.bonusMode ? 'BONUS ROOM' : this.def.title, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '10px',
        color: '#f4e4c4',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(950)
      .setResolution(2);
    this.tweens.add({ targets: text, alpha: 0, duration: 700, delay: 1100, onComplete: () => text.destroy() });
  }

  // ---- the loop ---------------------------------------------------------------------------------------------

  override update(_time: number, delta: number) {
    if (this.frozen) return;
    const dt = Math.min(delta / 1000, 1 / 20);
    const k = this.keys;
    const input = {
      left: k.left.isDown || k.a.isDown,
      right: k.right.isDown || k.d.isDown,
      up: k.up.isDown || k.w.isDown,
      down: k.down.isDown,
      jump: Phaser.Input.Keyboard.JustDown(k.space) || Phaser.Input.Keyboard.JustDown(k.up) || Phaser.Input.Keyboard.JustDown(k.w),
    };
    if (!this.busy && !this.joe.dead) this.joe.update(input, dt, this.world, GRAVITY);
    else this.joe.update(input, dt, this.world, GRAVITY);
    this.updateCreatures(dt);
    this.updateCrumbles(dt);
    this.updatePickups();
    this.updateDoors();
    this.updateDarkness();
    this.updateBonus(dt);

    if (this.joe.mover.y > HEIGHT + 48 && !this.joe.dead) this.joe.kill();
    if (this.joe.dead && !this.busy) {
      this.busy = true;
      this.cameras.main.shake(240, 0.012);
      sfx.death();
      this.time.delayedCall(1600, () => this.afterDeath());
    }
  }

  private updateCreatures(dt: number) {
    for (const c of this.creatures) {
      if (c.dead || c.spent) continue;
      const m = c.mover;
      m.vx = c.dir * (c.kind === 'skull' ? 46 : 42);
      if (c.kind === 'skull') {
        // The skull hops at Joe when he comes into reach.
        const sameRow = Math.abs((this.joe.mover.y - 22 - m.y) / TILE) < 1.6;
        if (sameRow && Math.abs(this.joe.mover.x - m.x) < TILE * 3 && m.onGround) m.vy = -430;
      }
      m.step(dt, this.world, GRAVITY);
      if (m.hitWall || !m.hasFloorAhead(this.world, c.dir)) c.dir *= -1;
      this.playCreature(c.view, c.kind, c.dir > 0 ? 'E' : 'W');
      c.view.setPosition(Math.round(m.x), Math.round(m.y - m.h));
      if (c.kind === 'skull') c.view.rotation = Math.sin(this.time.now / 90) * 0.22;

      // Contact: the sword takes one of them, otherwise Joe is caught.
      const near = Math.abs(m.x - this.joe.mover.x) < (m.w + 20) / 2 && Math.abs(m.y - this.joe.mover.y) < 34;
      if (near && !this.joe.dead) {
        if (state.hasSword) {
          c.dead = true;
          state.hasSword = false;
          state.pack = state.pack.filter((p) => p !== 'sword');
          this.syncHud();
          sfx.break();
          this.tweens.add({ targets: c.view, alpha: 0, y: c.view.y + 16, duration: 400, onComplete: () => c.view.destroy() });
        } else {
          // In the early levels a creature does not come back to the same room after it catches Joe.
          if (state.level <= 2) c.spent = true;
          this.joe.kill();
        }
      }
    }
  }

  private updateCrumbles(dt: number) {
    for (const c of this.crumbles) {
      const key = `${c.col},${c.row}`;
      if (c.state === 'solid') {
        const onIt = this.joe.mover.onGround && Math.abs(this.joe.mover.x - (c.col * TILE + TILE / 2)) < TILE / 2 && Math.abs(this.joe.mover.y - c.row * TILE) < 4;
        if (onIt) {
          c.state = 'falling';
          c.timer = 0.5;
        }
        continue;
      }
      c.timer -= dt;
      if (c.state === 'falling' && c.timer <= 0) {
        c.state = 'gone';
        c.timer = 2.4;
        this.gone.add(key);
        this.tweens.add({ targets: c.view, alpha: 0, y: c.view.y + 12, duration: 240, onComplete: () => c.view.setAlpha(0) });
      } else if (c.state === 'gone' && c.timer <= 0) {
        c.state = 'solid';
        this.gone.delete(key);
        c.view.setAlpha(1).setY(c.view.y - 12);
      }
    }
  }

  private updatePickups() {
    if (this.joe.dead) return;
    const jx = this.joe.mover.x;
    const jy = this.joe.mover.y - 22;
    for (const p of this.pickups) {
      if (!p.sprite.active) continue;
      if (Phaser.Math.Distance.Between(p.sprite.x, p.sprite.y, jx, jy) > 28) continue;
      if (p.kind.startsWith('key:')) {
        const colour = p.kind.split(':')[1] as 'gold' | 'silver' | 'red';
        state.keys[colour] += 1;
        sfx.key();
      } else if (p.kind === 'jewel') {
        state.jewels += 1;
        this.addScore(p.points ?? 100);
        sfx.pickup();
      } else if (p.kind === 'gold') {
        this.addScore(p.points ?? 50);
        sfx.pickup();
      } else if (p.carry) {
        // The original refuses treasure once the five pockets are full; the torch still goes in, so a full pocket
        // can never lock a player out of the dark rooms.
        if (p.carry !== 'torch' && packFull(this.hud)) continue;
        if (state.pack.filter((x) => x === p.carry).length < 2) state.pack.push(p.carry);
        if (p.carry === 'sword') state.hasSword = true;
        sfx.pickup();
        this.addScore(p.points ?? 50);
      }
      p.sprite.destroy();
      p.sprite.active = false;
      this.syncHud();
    }

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (this.grid[row][col] !== FIRE) continue;
        const { x, y } = this.centre(col, row);
        if (Math.abs(jx - x) < TILE / 2 + 4 && Math.abs(this.joe.mover.y - y) < TILE / 2 + 16) this.joe.kill();
      }
    }

    if (this.idol?.active && !this.joe.dead && Phaser.Math.Distance.Between(this.idol.x, this.idol.y, jx, jy) < 30) {
      this.idol.setActive(false).setVisible(false);
      this.joe.win();
      this.busy = true;
      sfx.idol();
      this.addScore(1000);
      this.cameras.main.flash(400, 255, 220, 150);
      this.time.delayedCall(800, () => {
        this.nextRoom = { roomId: 'bonus', spawn: [1, ROWS - 2] };
        this.cameras.main.fadeOut(400, 0, 0, 0);
      });
    }
  }

  private updateDoors() {
    if (this.joe.dead || this.busy) return;
    const jx = this.joe.mover.x;
    const jTop = this.joe.mover.y - this.joe.mover.h;
    const jBottom = this.joe.mover.y;
    for (const d of this.doors) {
      // Joe has to touch the doorway itself, not stand on its row.
      const dTop = d.zone.y - TILE / 2 - 3;
      const dBottom = d.zone.y + TILE / 2 + 3;
      if (Math.abs(jx - d.zone.x) > 14 || jBottom < dTop || jTop > dBottom) continue;
      if (state.keys[d.colour] > 0) {
        state.keys[d.colour] -= 1;
        this.busy = true;
        sfx.door();
        this.syncHud();
        this.nextRoom = { roomId: d.to, spawn: d.spawn, face: d.face };
        this.cameras.main.fadeOut(400, 0, 0, 0);
        return;
      }
      sfx.locked();
      this.tweens.add({ targets: this.joe.view, x: this.joe.view.x + (d.dir === 'left' ? 12 : -12), duration: 130, yoyo: true });
      return;
    }
  }

  private updateDarkness() {
    if (!this.darkness) return;
    const rt = this.darkness;
    const lit = state.pack.includes('torch');
    rt.clear();
    rt.fill(0x04030a, 0.96);
    rt.erase(lit ? 'brushLit' : 'brushDark', this.joe.mover.x, this.joe.mover.y - 22);
    if (!lit) {
      // A torch burning on the wall is a small light of its own.
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          if (this.grid[row][col] !== 'T') continue;
          const { x, y } = this.centre(col, row);
          rt.erase('brushDark', x, y);
        }
      }
    }
  }

  private updateBonus(dt: number) {
    if (!this.bonusMode || this.busy) return;
    this.bonusLeft -= dt;
    if (this.bonusLeft <= 0) this.endBonus();
  }

  // ---- outcomes ---------------------------------------------------------------------------------------------

  private addScore(n: number) {
    state.score += n;
    if (state.score >= state.nextExtraLife) {
      state.nextExtraLife += 10000;
      state.lives += 1;
      sfx.extra();
    }
    this.syncHud();
  }

  private syncHud() {
    this.hud.score = state.score;
    this.hud.lives = state.lives;
    this.hud.level = state.level;
    this.hud.keys = state.keys;
    this.hud.pack = state.pack;
    this.hud.jewels = state.jewels;
    this.hud.redraw();
  }

  private afterDeath() {
    state.lives -= 1;
    if (state.lives <= 0) {
      this.busy = true;
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.nextRoom = null;
      return;
    }
    this.scene.restart({ roomId: this.defId, spawn: this.spawn, face: this.face });
  }

  /** The bonus room is over: deeper into the pyramid, and darker. */
  private endBonus() {
    if (this.busy) return;
    this.busy = true;
    sfx.bonus();
    this.addScore(Math.round(this.bonusLeft * 10));
    state.level += 1;
    this.nextRoom = { roomId: START_ROOM };
    this.cameras.main.fadeOut(400, 0, 0, 0);
  }

  /** Used by scripts/load-check.mjs to hold a frame still. */
  freeze() {
    this.frozen = true;
  }
}