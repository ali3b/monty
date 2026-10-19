/**
 * The pyramid: one screen per room, the way the 1984 original is built (rooms reached through locked doors, each
 * level darker than the last).
 *
 * Rooms are written as ASCII art, one character per tile (20 wide, 11 high):
 *
 *   #  wall                    =  platform (jump up through it)      H  ladder (up and down)
 *   ^  fire pit (kills)        x  crumbling floor                     R  rope (down only)
 *   @  where Joe starts        .  nothing
 *
 *   y/w/e  gold / silver / red key      j  jewel      o  gold      t  torch      d  dagger
 *   s  patrolling skull       k  patrolling skeleton
 *   V  vase (breakable, 50)   W  spider web    B  skull pile    T  wall torch
 *
 * Ladders run from the floor to near the ceiling with a platform beside their top, so Joe climbs and steps off
 * sideways; ropes hang from the top and can only be ridden down.
 */
export const COLS = 20;
export const ROWS = 11;

export type KeyColour = 'gold' | 'silver' | 'red';
export type EnemyKind = 'skull' | 'skeleton';
export type Facing = 'E' | 'W';

export interface DoorDef {
  /** Tile column: 0 for a door in the left wall, COLS - 1 for the right one. */
  x: number;
  /** Tile row the doorway sits on. */
  y: number;
  dir: 'left' | 'right';
  colour: KeyColour;
  /** Room this door leads to. */
  to: string;
  /** Where Joe stands in that room, in tiles, and which way he faces. */
  spawn: [number, number];
  face: Facing;
}

export interface ExtraEnemy {
  /** The level from which this enemy is in the room. */
  from: number;
  x: number;
  y: number;
  kind: EnemyKind;
}

export interface RoomDef {
  id: string;
  /** Shown on the title card when Joe walks in. */
  title: string;
  rows: string[];
  doors: DoorDef[];
  /** From this level on the room is dark: Joe needs the torch to see it. */
  darkFrom?: number;
  /** The idol that ends the level. */
  idol?: [number, number];
  extraEnemies?: ExtraEnemy[];
}

const rooms: RoomDef[] = [
  {
    id: 'entry',
    title: 'THE ENTRANCE',
    rows: [
      '####################',
      '#..................#',
      '#..................#',
      '#.........W........#',
      '#..................#',
      '#..................#',
      '#....y......===....#',
      '#...===............#',
      '#.V............s...#',
      '#.......@..........#',
      '####################',
    ],
    doors: [
      { x: 0, y: 8, dir: 'left', colour: 'gold', to: 'rope', spawn: [17, 9], face: 'W' },
      { x: COLS - 1, y: 8, dir: 'right', colour: 'silver', to: 'ladder', spawn: [17, 9], face: 'W' },
    ],
  },
  {
    id: 'rope',
    title: 'THE ROPE HALL',
    rows: [
      '####################',
      '#.R................#',
      '#.R....H===........#',
      '#.R....H...........#',
      '#.R....H.....====..#',
      '#.R....H...........#',
      '#.R....H.........j.#',
      '#.R....H...........#',
      '#.R....H...B.......#',
      '#......H........o..#',
      '####################',
    ],
    doors: [
      { x: COLS - 1, y: 8, dir: 'right', colour: 'gold', to: 'entry', spawn: [2, 9], face: 'E' },
      { x: 0, y: 8, dir: 'left', colour: 'gold', to: 'crumble', spawn: [17, 9], face: 'W' },
    ],
  },
  {
    id: 'ladder',
    title: 'THE LADDER WELL',
    rows: [
      '####################',
      '#..................#',
      '#.....===H.........#',
      '#........H.........#',
      '#........H.======..#',
      '#........H.........#',
      '#.....w..H....k....#',
      '#........H.........#',
      '#.V......H.......V.#',
      '#........H.........#',
      '####################',
    ],
    doors: [
      { x: 0, y: 8, dir: 'left', colour: 'silver', to: 'entry', spawn: [2, 9], face: 'E' },
      { x: COLS - 1, y: 8, dir: 'right', colour: 'silver', to: 'skulls', spawn: [2, 9], face: 'E' },
    ],
  },
  {
    id: 'skulls',
    title: 'THE BONE HALL',
    rows: [
      '####################',
      '#..................#',
      '#.===....H===......#',
      '#........H.........#',
      '#....====H.........#',
      '#........H.........#',
      '#..j.....H.....j...#',
      '#........H.........#',
      '#.s.....sH.......s.#',
      '#........H.........#',
      '####################',
    ],
    doors: [
      { x: 0, y: 8, dir: 'left', colour: 'silver', to: 'ladder', spawn: [17, 9], face: 'W' },
      { x: COLS - 1, y: 8, dir: 'right', colour: 'gold', to: 'web', spawn: [2, 9], face: 'E' },
    ],
  },
  {
    id: 'crumble',
    title: 'THE CRUMBLING FLOOR',
    rows: [
      '####################',
      '#..................#',
      '#......H===..===...#',
      '#......H...........#',
      '#......H===........#',
      '#......H...........#',
      '#..x...Hx....x.....#',
      '#....^^H^^^^^^^^^..#',
      '#..x...Hx....x.....#',
      '#......He.......x..#',
      '####################',
    ],
    doors: [
      { x: COLS - 1, y: 8, dir: 'right', colour: 'gold', to: 'rope', spawn: [2, 9], face: 'E' },
      { x: 0, y: 8, dir: 'left', colour: 'red', to: 'dark', spawn: [17, 9], face: 'W' },
    ],
    extraEnemies: [{ from: 4, x: 10, y: 8, kind: 'skull' }],
  },
  {
    id: 'dark',
    title: 'THE DARK ROOM',
    darkFrom: 1,
    rows: [
      '####################',
      '#..................#',
      '#.===.....H===.....#',
      '#.........H........#',
      '#....=====H........#',
      '#.........H........#',
      '#.......t.H........#',
      '#.....====H........#',
      '#.B.......H.....B..#',
      '#.........H........#',
      '####################',
    ],
    doors: [
      { x: COLS - 1, y: 8, dir: 'right', colour: 'red', to: 'crumble', spawn: [2, 9], face: 'E' },
      { x: 0, y: 8, dir: 'left', colour: 'red', to: 'fire', spawn: [17, 9], face: 'W' },
    ],
    extraEnemies: [
      { from: 3, x: 6, y: 8, kind: 'skeleton' },
      { from: 5, x: 13, y: 8, kind: 'skull' },
    ],
  },
  {
    id: 'fire',
    title: 'THE FIRE PIT',
    rows: [
      '####################',
      '#..................#',
      '#.===.....H===.....#',
      '#.........H........#',
      '#....=====H........#',
      '#.........H........#',
      '#.........H........#',
      '#..^^^^^^^H^^^^^^..#',
      '#.x.......H......x.#',
      '#.........H........#',
      '####################',
    ],
    doors: [
      { x: COLS - 1, y: 8, dir: 'right', colour: 'red', to: 'dark', spawn: [2, 9], face: 'E' },
      { x: 0, y: 8, dir: 'left', colour: 'silver', to: 'jewels', spawn: [17, 9], face: 'W' },
    ],
    extraEnemies: [
      { from: 2, x: 8, y: 8, kind: 'skull' },
      { from: 6, x: 12, y: 8, kind: 'skeleton' },
    ],
  },
  {
    id: 'jewels',
    title: 'THE TREASURE',
    rows: [
      '####################',
      '#..................#',
      '#.===.....H===.....#',
      '#.........H........#',
      '#....=====H........#',
      '#.........H........#',
      '#...j..j..H.j...j..#',
      '#.........H........#',
      '#.o..o.o..H.o.o..o.#',
      '#.........H........#',
      '####################',
    ],
    doors: [
      { x: COLS - 1, y: 8, dir: 'right', colour: 'silver', to: 'fire', spawn: [2, 9], face: 'E' },
      { x: 0, y: 8, dir: 'left', colour: 'gold', to: 'web', spawn: [17, 9], face: 'W' },
    ],
    extraEnemies: [
      { from: 3, x: 5, y: 8, kind: 'skeleton' },
      { from: 5, x: 15, y: 8, kind: 'skull' },
    ],
  },
  {
    id: 'web',
    title: 'THE SPIDER WEB',
    rows: [
      '####################',
      '#.....R..R.........#',
      '#..===R..RH===.....#',
      '#.....R..RH........#',
      '#.....R..RH...===..#',
      '#.....R..RH........#',
      '#...j.R..RH.j......#',
      '#.....R..RH........#',
      '#.V..W....HW...V.B.#',
      '#.........H........#',
      '####################',
    ],
    doors: [
      { x: 0, y: 8, dir: 'left', colour: 'gold', to: 'jewels', spawn: [2, 9], face: 'E' },
      { x: COLS - 1, y: 8, dir: 'right', colour: 'silver', to: 'treasure', spawn: [2, 9], face: 'E' },
    ],
  },
  {
    id: 'treasure',
    title: 'THE SHRINE OF MONTEZUMA',
    rows: [
      '####################',
      '#..................#',
      '#....=====.........#',
      '#....=...=.........#',
      '#....=...=.........#',
      '#....=...=.........#',
      '#....=...=.........#',
      '#....=...=.........#',
      '#..T.......T.......#',
      '#..................#',
      '####################',
    ],
    idol: [7, 5],
    doors: [{ x: 0, y: 8, dir: 'left', colour: 'silver', to: 'web', spawn: [17, 9], face: 'W' }],
  },
  {
    id: 'bonus',
    title: 'THE BONUS ROOM',
    rows: [
      '####################',
      '#..R...R...R...R...#',
      '#..R...R...R...R...#',
      '#..R...R...R...R...#',
      '#..R..=R==.R...R...#',
      '#..Ro..Rj..Ro..Rj..#',
      '#..R...R...R===R...#',
      '#..R...R...R...R...#',
      '#..R...R...R...R...#',
      '#.........j...o....#',
      '####################',
    ],
    doors: [],
  },
];

const byId = new Map(rooms.map((r) => [r.id, r]));

export function room(id: string): RoomDef {
  const r = byId.get(id);
  if (!r) throw new Error(`no room "${id}" (see src/rooms.ts)`);
  return r;
}

export const START_ROOM = 'entry';

/** Every room reachable from the entrance by walking through doors. */
export function reachableFrom(start: string): Set<string> {
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const id = queue.shift() as string;
    for (const d of room(id).doors) {
      if (byId.has(d.to) && !seen.has(d.to)) {
        seen.add(d.to);
        queue.push(d.to);
      }
    }
  }
  return seen;
}

/** Every room, for the level select in tests. */
export function roomIds(): string[] {
  return rooms.map((r) => r.id);
}