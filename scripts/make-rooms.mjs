// Prints the room art for src/rooms.ts from a compact spec, so every row is exactly 20 tiles. Kept in the repo
// because the rooms are hand-tuned art and this is how they stay that size.
//   node scripts/make-rooms.mjs           the art, to paste into src/rooms.ts
//   node scripts/make-rooms.mjs --json    the same art, written to src/rooms.json for scripts/tour.mjs
import fs from 'node:fs';

const COLS = 20;
const ROWS = 11;

const grid = () => Array.from({ length: ROWS }, () => Array(COLS).fill('.'));
const put = (g, x, y, ch, x1 = x) => {
  for (let i = x; i <= x1; i++) if (g[y][i] === '.') g[y][i] = ch;
};
const putOver = (g, x, y, ch, x1 = x) => {
  for (let i = x; i <= x1; i++) g[y][i] = ch;
};

function room(spec) {
  const g = grid();
  for (const [x0, y, x1] of spec.plat ?? []) put(g, x0, y, '=', x1);
  for (const [x0, y, x1] of spec.crumb ?? []) put(g, x0, y, 'x', x1);
  for (const [x0, y, x1] of spec.fire ?? []) put(g, x0, y, '^', x1);
  for (const [c, a, b] of spec.ladder ?? []) putOver(g, c, a, 'H', c);
  for (let r = (spec.ladder ?? []).reduce((m, [, a, b]) => Math.min(m, a), ROWS); r < ROWS; r++) {
    for (const [c, a, b] of spec.ladder ?? []) if (r >= a && r <= b) g[r][c] = 'H';
  }
  for (const [c, a, b] of spec.rope ?? []) {
    for (let r = a; r <= b; r++) g[r][c] = 'R';
    // Ropes hang from the ceiling: the run always reaches row 1.
    for (let r = 1; r < a; r++) if (g[r][c] === '.') g[r][c] = 'R';
  }
  for (const [c, r, ch] of spec.items ?? []) putOver(g, c, r, ch);
  if (spec.at) putOver(g, spec.at[0], spec.at[1], '@');
  // Border walls last, so nothing pokes outside the room.
  for (let x = 0; x < COLS; x++) {
    g[0][x] = '#';
    g[ROWS - 1][x] = '#';
  }
  for (let y = 0; y < ROWS; y++) {
    g[y][0] = '#';
    g[y][COLS - 1] = '#';
  }
  return g.map((r) => r.join(''));
}

const rooms = {
  entry: {
    plat: [[4, 7, 6], [12, 6, 14]],
    items: [
      [5, 6, 'y'],
      [10, 3, 'W'],
      [2, 8, 'V'],
      [15, 8, 's'],
    ],
    at: [8, 9],
  },
  rope: {
    // A rope to come down and a ladder to climb back up, as the original pairs them.
    plat: [[8, 2, 10], [13, 4, 16]],
    ladder: [[7, 2, 9]],
    rope: [[2, 2, 8]],
    items: [
      [17, 6, 'j'],
      [11, 8, 'B'],
      [16, 9, 'o'],
    ],
  },
  ladder: {
    plat: [[6, 2, 8], [11, 4, 16]],
    ladder: [[9, 2, 9]],
    items: [
      [6, 6, 'w'],
      [14, 6, 'k'],
      [2, 8, 'V'],
      [17, 8, 'V'],
    ],
  },
  skulls: {
    plat: [[2, 2, 4], [10, 2, 12], [5, 4, 9]],
    ladder: [[9, 2, 9]],
    items: [
      [3, 6, 'j'],
      [15, 6, 'j'],
      [2, 8, 's'],
      [8, 8, 's'],
      [17, 8, 's'],
    ],
  },
  crumble: {
    plat: [[8, 2, 10], [13, 2, 15], [8, 4, 10]],
    ladder: [[7, 2, 9]],
    crumb: [[3, 6, 3], [8, 6, 8], [13, 6, 13], [3, 8, 3], [8, 8, 8], [13, 8, 13], [16, 9, 16]],
    fire: [[5, 7, 16]],
    items: [[8, 9, 'e']],
  },
  dark: {
    plat: [[2, 2, 4], [11, 2, 13], [5, 4, 9], [6, 7, 9]],
    ladder: [[10, 2, 9]],
    items: [
      [8, 6, 't'],
      [2, 8, 'B'],
      [16, 8, 'B'],
    ],
  },
  fire: {
    plat: [[2, 2, 4], [11, 2, 13], [5, 4, 9]],
    ladder: [[10, 2, 9]],
    crumb: [[2, 8, 2], [17, 8, 17]],
    fire: [[3, 7, 16]],
    items: [],
  },
  jewels: {
    plat: [[2, 2, 4], [11, 2, 13], [5, 4, 9]],
    ladder: [[10, 2, 9]],
    items: [
      [4, 6, 'j'],
      [7, 6, 'j'],
      [12, 6, 'j'],
      [16, 6, 'j'],
      [2, 8, 'o'],
      [5, 8, 'o'],
      [7, 8, 'o'],
      [12, 8, 'o'],
      [14, 8, 'o'],
      [17, 8, 'o'],
    ],
  },
  web: {
    plat: [[3, 2, 5], [11, 2, 13], [14, 4, 16]],
    ladder: [[10, 2, 9]],
    rope: [[6, 3, 7], [9, 3, 7]],
    items: [
      [4, 6, 'j'],
      [12, 6, 'j'],
      [2, 8, 'V'],
      [5, 8, 'W'],
      [11, 8, 'W'],
      [15, 8, 'V'],
      [17, 8, 'B'],
    ],
  },
  treasure: {
    plat: [[5, 2, 9], [5, 3, 5], [9, 3, 9], [5, 4, 5], [9, 4, 9], [5, 5, 5], [9, 5, 9], [5, 6, 5], [9, 6, 9], [5, 7, 5], [9, 7, 9]],
    items: [
      [3, 8, 'T'],
      [11, 8, 'T'],
    ],
  },
  bonus: {
    rope: [[3, 2, 8], [7, 2, 8], [11, 2, 8], [15, 2, 8]],
    plat: [[6, 4, 9], [12, 6, 15]],
    items: [
      [4, 5, 'o'],
      [8, 5, 'j'],
      [12, 5, 'o'],
      [16, 5, 'j'],
      [10, 9, 'j'],
      [14, 9, 'o'],
    ],
  },
};

const printed = {};
for (const [name, spec] of Object.entries(rooms)) {
  console.log(`  // ${name}`);
  const rows = room(spec);
  printed[name] = rows;
  for (const row of rows) console.log(`      '${row}',`);
  console.log();
}

// The tour walks this list, so it is written next to the art it comes from.
if (process.argv.includes('--json')) {
  const titles = {
    entry: 'THE ENTRANCE', rope: 'THE ROPE HALL', ladder: 'THE LADDER WELL', skulls: 'THE BONE HALL',
    crumble: 'THE CRUMBLING FLOOR', dark: 'THE DARK ROOM', fire: 'THE FIRE PIT', jewels: 'THE TREASURE',
    web: 'THE SPIDER WEB', treasure: 'THE SHRINE OF MONTEZUMA', bonus: 'THE BONUS ROOM',
  };
  const list = Object.entries(printed).map(([id, rows]) => ({ id, title: titles[id], rows }));
  fs.writeFileSync('src/rooms.json', `${JSON.stringify(list, null, 2)}\n`);
  console.log(`wrote src/rooms.json (${list.length} rooms)`);
}