// Walks every room in the pyramid and saves a screenshot of each, so the layouts can be looked at.
//   node scripts/tour.mjs [url]
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const url = process.argv[2] ?? process.env.GAME_URL ?? 'http://localhost:5197';
const env = { ...process.env };
delete env.DISPLAY;
delete env.WAYLAND_DISPLAY;
fs.mkdirSync('test-results/rooms', { recursive: true });

const rooms = JSON.parse(fs.readFileSync('src/rooms.json', 'utf8'));
const browser = await chromium.launch({ env, args: ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

let ok = true;
for (const { id, title, level } of rooms) {
  await page.goto(`${url.replace(/\/$/, '')}/?scene=room&room=${id}&level=${level}`);
  await page.waitForFunction(() => window.game?.scene?.isActive('room'), null, { timeout: 60000 });
  await page.waitForTimeout(1400);
  const info = await page.evaluate(() => {
    const s = window.game.scene.getScene('room');
    return {
      room: s.defId,
      joe: [Math.round(s.joe.mover.x), Math.round(s.joe.mover.y)],
      onGround: s.joe.mover.onGround,
      dead: s.joe.dead,
      pickups: s.pickups.length,
      creatures: s.creatures.length,
      doors: s.doors.length,
      climbables: s.climbables.length,
      crumbles: s.crumbles.length,
      dark: !!s.darkness,
    };
  });
  // Joe should be standing on something, alive, in every room.
  if (!info.onGround || info.dead) {
    console.log(`FAIL ${id}: ${JSON.stringify(info)}`);
    ok = false;
  }
  await page.screenshot({ path: `test-results/rooms/${id}.png` });
  console.log(`${id.padEnd(9)} ${title.padEnd(24)} ${JSON.stringify(info)}`);
}

const uniq = [...new Set(errors)].filter((e) => !/favicon/.test(e));
if (uniq.length) {
  console.log('page errors:', uniq.slice(0, 5).join(' | '));
  ok = false;
}
console.log(ok ? 'every room loads' : 'FAILED');
await browser.close();
process.exit(ok ? 0 : 1);