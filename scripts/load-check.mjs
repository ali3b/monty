// Smoke check: the game boots, a scripted few seconds play without page errors, and it saves screenshots.
//   node scripts/load-check.mjs [url] [scene]
// Scenes: title | room | flow | deaths | gameover | all   ("flow" drives several rooms: idol, bonus, level, death).
// The scene is entered directly with ?scene=<name>. Software GL (SwiftShader): the shared GPU stays free.
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const url = process.argv[2] ?? process.env.GAME_URL ?? 'http://localhost:5197';
const scene = process.argv[3] ?? 'room';
const base = url.replace(/\/$/, '');
const env = { ...process.env };
delete env.DISPLAY;
delete env.WAYLAND_DISPLAY;
fs.mkdirSync('test-results', { recursive: true });

const browser = await chromium.launch({ env, args: ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
const errors = [];
/** Software GL leaks over a long session, so each phase of the flow check gets a fresh page. */
let page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const wire = (p) => {
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  
};
wire(page);
async function freshPage() {
  await page.close().catch(() => undefined);
  page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  wire(page);
  return page;
}

let ok = true;
const fail = (msg) => {
  ok = false;
  console.log(`FAIL: ${msg}`);
};
const inPage = (fn, arg) => page.evaluate(fn, arg);
/** A screenshot is evidence, not a gate: software GL on a busy box sometimes fails to capture. */
async function shot(name) {
  try {
    await page.screenshot({ path: `test-results/${name}.png` });
  } catch (e) {
    console.log(`(screenshot ${name} failed: ${e.message.split('\n')[0]})`);
  }
}
/**
 * Wait until the expression is truthy. The expression is re-created in the page, so it may only use `s` (the room
 * scene) and the `arg` passed here: nothing from this file's scope.
 */
const until = (fn, arg, ms = 12000) =>
  page
    .waitForFunction(
      ([src, a]) => new Function('s', 'a', `return (${src})(s, a)`)(window.game.scene.getScene('room'), a),
      [fn.toString(), arg ?? null],
      { timeout: ms, polling: 40 }
    )
    .then(() => true)
    .catch(() => false);
const room = (fn, arg) => inPage(fn, arg);
const here = () => inPage(() => window.game.scene.getScene('room'));
const joe = () =>
  room(() => {
    const s = window.game.scene.getScene('room');
    const j = s.joe;
    return {
      x: Math.round(j.mover.x),
      y: Math.round(j.mover.y),
      state: j.state,
      clip: j.view.anims.currentAnim?.key ?? null,
      textured: j.view.texture.key === 'joe' && j.view.width > 0,
      dead: j.dead,
      onGround: j.mover.onGround,
    };
  });
/** Put Joe somewhere, without waiting for him to walk there. */
const put = (x, y) =>
  room(
    ([px, py]) => {
      const j = window.game.scene.getScene('room').joe;
      j.mover.x = px;
      j.mover.y = py;
      j.mover.vx = 0;
      j.mover.vy = 0;
    },
    [x, y]
  );
const goto = async (roomId, level = 1) => {
  await page.goto(`${base}/?scene=room&room=${roomId}&level=${level}`);
  await page.waitForFunction(() => window.game?.scene?.isActive('room'), null, { timeout: 90000 });
  await page.waitForTimeout(900);
};

async function checkTitle() {
  await page.goto(`${base}/?scene=title`);
  await page.waitForFunction(() => window.game?.scene?.isActive('title'), null, { timeout: 90000 });
  await page.waitForTimeout(900);
  const title = await room(() => ({ prompt: window.game.scene.getScene('title').prompt?.text }));
  console.log('title:', JSON.stringify(title));
  if (!title.prompt) fail('the title screen has no prompt');
  await shot('title');
  await page.keyboard.press('Enter');
  const started = await page
    .waitForFunction(() => window.game.scene.isActive('room'), null, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  if (!started) fail('Enter did not start the game');
  await page.waitForTimeout(800);
  await shot('title-play');
}

async function checkRoom() {
  await page.goto(`${base}/?scene=room`);
  await page.waitForFunction(() => window.game?.scene?.isActive('room'), null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  const start = await joe();
  console.log('start:', JSON.stringify(start));
  if (!start.textured) fail('Joe is a placeholder box (assets missing? run npm run assets)');
  if (start.dead) fail('Joe died on arrival');
  if (start.y !== 320) fail(`Joe is not standing on the floor (y ${start.y}, expected 320)`);
  await shot('room');

  // Walking right, kept short: the skull patrols the right half of this room and will catch him.
  await page.keyboard.down('ArrowRight');
  await until((s) => s.joe.state === 'walk', null, 8000);
  await page.waitForTimeout(500);
  const walked = await joe();
  await page.keyboard.up('ArrowRight');
  console.log('walk:', JSON.stringify(walked));
  if (walked.x <= start.x + 10) fail(`Joe did not walk (x ${start.x} → ${walked.x})`);
  if (!String(walked.clip).includes('walk_forward')) fail(`Joe plays ${walked.clip}, not the walk clip`);
  if (walked.y !== start.y) fail(`Joe left the floor while walking (y ${walked.y})`);

  // Jumping: off the floor and back down. The key is held: headless software GL runs at a few fps, so a quick
  // press can fall between two frames and never be seen.
  await page.keyboard.down('Space');
  const rose = await until((s) => s.joe.mover.y < 300, null, 5000);
  await page.keyboard.up('Space');
  if (!rose) fail('Joe did not leave the floor');
  await shot('room-jump');
  if (!(await until((s) => s.joe.mover.onGround && s.joe.mover.y >= 300, null, 8000))) fail('Joe never came back down');

  // The rest of the check needs Joe alive and the room still: wait out a death if the skull got him.
  await until((s) => !s.busy && !s.joe.dead, null, 20000);
  if ((await joe()).dead) fail('Joe did not come back after the skull took him');

  // Picking the gold key up, and spending it on the left door of the entrance hall.
  const key = await room(() => {
    const s = window.game.scene.getScene('room');
    const k = s.pickups.find((p) => p.kind === 'key:gold');
    if (!k) return null;
    return [k.sprite.x, k.sprite.y + 8];
  });
  if (!key) fail('the entrance hall has no gold key');
  else {
    await put(key[0], key[1]);
    if (!(await until((s) => s.hud.keys.gold >= 1, null, 6000))) {
      const why = await room(() => {
        const s = window.game.scene.getScene('room');
        const k = s.pickups.find((p) => p.kind === 'key:gold');
        return { joe: [Math.round(s.joe.mover.x), Math.round(s.joe.mover.y)], dead: s.joe.dead, key: k ? [Math.round(k.sprite.x), Math.round(k.sprite.y)] : null };
      });
      fail(`Joe did not pick the gold key up (${JSON.stringify(why)})`);
    }
  }

  // Through the gold door into the rope hall.
  const door = await room(() => {
    const s = window.game.scene.getScene('room');
    const d = s.doors[0];
    return [d.zone.x + (d.dir === 'left' ? 6 : -6), d.zone.y + 14];
  });
  await put(door[0], door[1]);
  if (!(await until((s) => s.defId === 'rope', null, 8000))) fail('the gold door did not open');
  await page.waitForTimeout(900);
  const through = await here();
  console.log('through the door:', JSON.stringify({ room: through.defId, gold: through.hud.keys.gold }));
  if (through.hud.keys.gold !== 0) fail('the gold key was not spent');
  await shot('room-rope');

  // A locked door bounces Joe back instead of opening.
  const other = await room(() => {
    const s = window.game.scene.getScene('room');
    const d = s.doors.find((x) => x.colour !== 'gold') ?? s.doors[0];
    return { room: s.defId, x: d.zone.x + (d.dir === 'left' ? 6 : -6), y: d.zone.y + 14 };
  });
  await put(other.x, other.y);
  await page.waitForTimeout(900);
  if ((await here()).defId !== other.room) fail('a door with no key opened the room');
  else console.log('locked door held (no key):', other.room);

  // Climbing a ladder.
  const climb = await room(() => {
    const s = window.game.scene.getScene('room');
    const c = s.climbables.find((x) => !x.rope);
    if (!c) return null;
    return { col: c.col, bottom: c.bottom, y0: (c.bottom + 1) * 32 };
  });
  if (!climb) fail('no ladder found in the rope hall');
  else {
    await put(climb.col * 32 + 16, climb.y0);
    await page.keyboard.down('ArrowUp');
    const up = await until((s, v) => s.joe.mover.y < v.y0 - 60, climb, 25000);
    await page.keyboard.up('ArrowUp');
    if (!up) fail(`Joe did not climb the ladder (y stayed near ${climb.y0})`);
    else console.log('ladder: climbed from y', climb.y0, 'to', (await joe()).y);
    await shot('room-ladder');
  }
}

async function checkDeaths() {
  // Fire kills: the pit is the one thing in the tomb that is always fatal.
  await goto('fire', 1);
  const fire = await room(() => {
    const s = window.game.scene.getScene('room');
    for (let row = 0; row < 11; row++) {
      const i = s.grid[row].indexOf('^');
      if (i >= 0) return [i * 32 + 16, row * 32 + 16];
    }
    return null;
  });
  if (!fire) fail('the fire pit has no fire in it');
  else {
    await put(fire[0], fire[1]);
    if (!(await until((s) => s.joe.dead, null, 6000))) fail('walking into fire did not kill Joe');
    else console.log('fire kills');
    if (!(await until((s) => !s.busy, null, 12000))) fail('the fire death left the room stuck');
  }

  // A fall further than Joe is tall is fatal, as in the original.
  await goto('entry', 1);
  const livesBefore = (await here()).hud.lives;
  // Put him on the ledge and wait until the game has seen him land: onGround and the height are still the ones
  // from the floor he was teleported off, so the fall reference (fellFrom) is what says he has settled.
  await put(5 * 32 + 16, 7 * 32);
  if (!(await until((s, v) => s.joe.mover.onGround && Math.abs(s.joe.mover.y - v.y) < 2 && Math.abs(s.joe.fellFrom - v.y) < 2, { y: 7 * 32 }, 8000))) {
    fail('Joe did not land on the ledge');
  }
  await put(9 * 32 + 16, 7 * 32); // and off the edge of it
  if (!(await until((s) => s.joe.dead, null, 8000))) fail('the long fall did not kill Joe');
  else console.log('a long fall kills');
  if (!(await until((s) => !s.busy, null, 15000))) fail('the death left the room stuck');
  const after = await here();
  if (after.joe.dead) fail('Joe is still dead after the restart');
  if (after.hud.lives !== livesBefore - 1) fail(`the death cost ${livesBefore - after.hud.lives} lives, not one`);
}

async function checkGameOverRun() {
  // The last life ends the run, and Enter goes back to the title.
  await goto('entry', 1);
  await room(() => {
    window.state.lives = 1;
    const s = window.game.scene.getScene('room');
    s.hud.lives = 1;
    s.syncHud();
  });
  if ((await here()).hud.lives !== 1) fail('could not set up the last life');
  await put(5 * 32 + 16, 7 * 32);
  if (!(await until((s, v) => s.joe.mover.onGround && Math.abs(s.joe.fellFrom - v.y) < 2, { y: 7 * 32 }, 8000))) {
    fail('Joe did not land on the ledge');
  }
  await put(9 * 32 + 16, 7 * 32);
  const over = await page
    .waitForFunction(() => window.game.scene.isActive('gameover'), null, { timeout: 25000 })
    .then(() => true)
    .catch(() => false);
  if (!over) fail('the game did not end after the last life');
  await page.waitForTimeout(700);
  await shot('flow-gameover');
  await page.keyboard.press('Enter');
  if (!(await page.waitForFunction(() => window.game.scene.isActive('title'), null, { timeout: 10000 }).catch(() => false))) {
    fail('Enter on the game over screen did not go back to the title');
  }
}

async function checkFlow() {
  // The idol ends the level, the bonus room follows, and the next level is deeper.
  await goto('treasure', 1);
  await room(() => {
    const s = window.game.scene.getScene('room');
    return [s.idol.x, s.idol.y + 16];
  }).then(([x, y]) => put(x, y));
  if (!(await until((s) => s.defId === 'bonus', null, 30000))) fail('taking the idol did not lead to the bonus room');
  await page.waitForTimeout(700);
  const bonus = await here();
  console.log('idol → bonus:', JSON.stringify({ room: bonus.defId, level: bonus.hud.level, score: bonus.hud.score }));
  if (bonus.hud.score < 1000) fail('the idol did not score');
  await shot('flow-bonus');

  await room(() => {
    window.game.scene.getScene('room').bonusLeft = 0.05;
  });
  if (!(await until((s) => s.defId === 'entry' && s.hud.level === 2, null, 30000))) {
    const st = await room(() => {
      const s = window.game.scene.getScene('room');
      return { id: s?.defId, hud: s?.hud?.level, busy: s?.busy, url: location.search };
    });
    fail(`the bonus room did not start level 2 (${JSON.stringify(st)})`);
  }
  console.log('bonus → level:', JSON.stringify({ room: (await here()).defId, level: (await here()).hud.level }));
  await shot('flow-level2');

  // The dark rooms stay dark, the torch lights them, and the extra creatures turn up from their level.
  await goto('dark', 2);
  if (!(await until((s) => !!s.darkness, null, 5000))) fail('the dark room is not dark at level 2');
  await room(() => window.game.scene.getScene('room').hud.pack.push('torch'));
  await page.waitForTimeout(600);
  await shot('flow-dark-torch');
  await goto('fire', 6);
  const mobs = (await here()).creatures.length;
  if (mobs < 2) fail(`the fire pit has no extra creatures at level 6 (${mobs})`);
  else console.log('fire pit at level 6:', mobs, 'creatures');
}

try {
  if (scene === 'title') await checkTitle();

  else if (scene === 'room') await checkRoom();
  else if (scene === 'flow') await checkFlow();
  else if (scene === 'deaths') await checkDeaths();
  else if (scene === 'gameover') await checkGameOverRun();
  else if (scene === 'all') {
    await checkTitle();
    await checkRoom();
    await checkGameOverRun();
    await checkFlow();
    await checkDeaths();
  } else fail(`unknown scene "${scene}" (title, gameover, room, flow, deaths, gameover, all)`);
} catch (e) {
  ok = false;
  console.log('NOT LOADED:', e.message.split('\n')[0]);
  await shot(scene);
}

const uniq = [...new Set(errors)].filter((e) => !/favicon/.test(e));
if (uniq.length) console.log('page errors:', uniq.slice(0, 5).join(' | '));
console.log(ok && !uniq.length ? 'game loads ok' : 'FAILED');
await browser.close();
process.exit(ok && !uniq.length ? 0 : 1);