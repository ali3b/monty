// Checks the pyramid: every room is a full screen, the ladders reach the floor and have a platform to step off,
// every item has something under it, and every door leads to a room that exists.
//   node scripts/check-rooms.mjs
// rooms.ts is bundled on the fly with esbuild (a dev dependency of vite), so the check sees the real data.
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmp = path.join(os.tmpdir(), `monty-rooms-${process.pid}.mjs`);
await build({ entryPoints: [path.join(root, 'src/rooms.ts')], bundle: true, format: 'esm', outfile: tmp, logLevel: 'silent' });
const { room, roomIds, COLS, ROWS } = await import(pathToFileURL(tmp).href);
fs.rmSync(tmp, { force: true });

const WALL = '#';
const PLATFORM = '=';
const LADDER = 'H';
const ROPE = 'R';
const ITEMS = 'ywjeotdV';
const STANDABLE = new Set([WALL, PLATFORM, 'x']);
const problems = [];
const say = (room_, msg) => problems.push(`${room_}: ${msg}`);

/** Runs of a character in a column, as [top, bottom] rows. */
function columnRuns(rows, ch) {
  const out = [];
  let start = -1;
  for (let row = 0; row <= ROWS; row++) {
    const c = row < ROWS ? rows[row].split('')[0] : ' ';
    void c;
    const at = row < ROWS ? rows[row] : '';
    const isCh = at.length > 0 && at.split('')[0] === ch;
    if (isCh && start < 0) start = row;
    if (!isCh && start >= 0) {
      out.push([start, row - 1]);
      start = -1;
    }
  }
  return out;
}

for (const id of roomIds()) {
  const def = room(id);
  const at = (col, row) => (row < 0 || row >= ROWS || col < 0 || col >= COLS ? WALL : def.rows[row][col]);

  if (def.rows.length !== ROWS) say(id, `has ${def.rows.length} rows, not ${ROWS}`);
  def.rows.forEach((r, i) => {
    if (r.length !== COLS) say(id, `row ${i} is ${r.length} wide, not ${COLS}`);
  });

  // Ladders: must reach the floor, and have a platform to step off at the top.
  for (let col = 0; col < COLS; col++) {
    let start = -1;
    for (let row = 0; row <= ROWS; row++) {
      const isLadder = row < ROWS && def.rows[row][col] === LADDER;
      if (isLadder && start < 0) start = row;
      if (!isLadder && start >= 0) {
        const top = start;
        const bottom = row - 1;
        // Something to stand on below the ladder.
        const below = at(col, bottom + 1);
        if (!STANDABLE.has(below) && below !== ' ') say(id, `ladder at ${col},${top}-${bottom} has no floor below it`);
        else if (!STANDABLE.has(below)) say(id, `ladder at ${col},${top}-${bottom} ends over a hole`);
        // A platform beside the top, or at the top row itself, to step off onto.
        const beside = [at(col - 1, top), at(col + 1, top)].some((c) => c === PLATFORM || c === WALL);
        if (!beside && at(col, top - 1) !== WALL) say(id, `ladder at ${col},${top}-${bottom} has nowhere to step off at the top`);
        start = -1;
      }
    }
  }

  // Ropes must hang from the ceiling.
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      if (def.rows[row][col] !== ROPE) continue;
      if (row === 0) say(id, `rope at ${col},${row} starts at the ceiling tile`);
      if (row > 0 && def.rows[row - 1][col] !== ROPE && def.rows[row - 1][col] !== WALL) say(id, `rope at ${col},${row} hangs from nothing`);
    }
  }

  // Every item has something under it, so it can be reached.
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const c = def.rows[row][col];
      if (!ITEMS.includes(c) || c === 'V') continue;
      // Items may float (they are grabbed out of the air), but there has to be something to jump from.
      let supported = false;
      for (let below = row + 1; below < ROWS; below++) {
        if (STANDABLE.has(at(col, below))) supported = true;
        if (at(col, below) === WALL || at(col, below) === '^') break;
      }
      if (!supported) say(id, `item "${c}" at ${col},${row} has nothing to stand on below it`);
    }
  }

  // Doors.
  for (const d of def.doors) {
    if (!roomIds().includes(d.to)) say(id, `door leads to unknown room "${d.to}"`);
    if (d.x !== 0 && d.x !== COLS - 1) say(id, `door at ${d.x} is not in a wall`);
    const [sx, sy] = d.spawn;
    const target = room(d.to);
    if (sy >= ROWS || sx < 0 || sx >= COLS) say(id, `door spawn ${sx},${sy} is outside "${d.to}"`);
    else if (STANDABLE.has(target.rows[sy][sx])) say(id, `door spawn ${sx},${sy} is inside a wall in "${d.to}"`);
  }

  // The idol must not be buried.
  if (def.idol) {
    const [col, row] = def.idol;
    if (STANDABLE.has(at(col, row))) say(id, `the idol at ${col},${row} is inside the scenery`);
  }
}

if (problems.length) {
  console.log(`FAIL: ${problems.length} problem(s)`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log(`all ${roomIds().length} rooms check out`);