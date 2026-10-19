# Monty: Montezuma's Revenge (1984) rebuilt through Synty Sprite Generator

A Phaser 3 remake of Parker Brothers' *Montezuma's Revenge* (Robert Jaeger, 1984): side-view rooms in an Aztec
tomb, Panama Joe climbing ladders and sliding down ropes, spending keys on locked doors, dodging skulls and
skeletons, and stealing the treasure at the bottom of the pyramid. Every sprite and every ground tile comes from
Synty Sprite Generator (`~/projects/synty-sprite-generator`). The game design is in `docs/DESIGN.md`; the
orchestration loop is the generator's `docs/GAME-LOOP.md`.

## Rules

- Use the generator **only** through its interfaces:
  - the CLI: `node /home/andrew/projects/synty-sprite-generator/apps/cli/bin/ssg.mjs …` (`--help` on any command)
  - the `synty-sprites` MCP tools (`.mcp.json`, which allows writes into this repo)
- **Never** edit, import or copy code from the generator repo, and never read its database directly. If you can't
  get something through the CLI or MCP, that's a finding: write it in `FEEDBACK.md`.
- Every asset the game uses is declared in `ssg.assets.json` and rebuilt by `npm run assets`
  (`scripts/build-assets.mjs`). `public/assets/` is generated output, so never hand-edit it.
- A workaround in the game (hand-made data, code that fixes up an export) needs a FEEDBACK entry. Mark the code
  `// FB-NNN` so it can be removed once the generator is fixed.
- Asset builds are heavy. Run one at a time, and never while a generator walk is running. Test exports render in
  software (the GTX 1060 is shared with the desktop).
- Start the dev server on port **5197** and stop that PID only; never kill processes by name (the generator's own
  dev server is a vite process too). Restart `npm run dev` after `npm run assets`: Vite does not see
  `public/assets` folders that were replaced while it was running.

## The cast, and where it comes from

| In the game | Model | Moves |
|---|---|---|
| Panama Joe | `POLYGON_War/Character_GentleMan_01` + `POLYGON_Palm_City/SM_Chr_Attach_Hat_03` | `martial_arts` (idle, walk, jump, crouch, hit, get up, ko) |
| Skull | `POLYGON_Dark_Fantasy/SM_Prop_Skull_01` | `bounce` |
| Skeleton | `POLYGON_Dungeon_Pack/Character_Skeleton_Slave_01` | `Idle_Standing`, `Walk_F`, `Run_F`, `hit_react`, `death_fall` |
| Keys (gold/silver/red) | `POLYGON_Dark_Fortress/SM_Prop_Key_01..03` | `bob` |
| Jewel, gold, torch, sword | `POLYGON_Dungeon_Pack/SM_Prop_Gem_01`, `SM_Item_Coins_01`, `POLYGON_Dark_Fantasy/SM_Prop_Torch_01`, `SM_Wep_Sword_01` | `bob` / `still` |
| Fire | `POLYGON_Particle_FX/SM_Flame_FX` | `still`, glowing |
| Door, web, vase, skull pile | `POLYGON_Dungeon_Pack/SM_Env_Door_01`, `POLYGON_Dark_Fortress/SM_Env_Spiderweb_01`, `POLYGON_Dungeon_Pack/SM_Prop_Vase_01`, `POLYGON_Dark_Fantasy/SM_Prop_Skull_03` | `still` |
| The tomb | tileset `tomb` (32×32): `void`, `brick`, `stone`, `floor`, `ember` | — |

The view is `side2` with the pixel-art look at `small`, and both facings are rendered (`_E` and `_W`), so the game
plays the direction it wants instead of flipping.

## Controls

Arrows or WASD. **Up / W / Space** jumps, or grabs a ladder (a rope only comes down). **Down / S** crouches, or
rides a rope down. On a ladder, left and right step off sideways onto a platform.

## Checks before you finish a milestone

- `npm run typecheck`
- `node scripts/check-rooms.mjs` (every room is a full screen, ladders reach the floor, items have something under
  them, every door leads somewhere)
- `npm run dev`, then:
  - `node scripts/load-check.mjs http://localhost:5197 room` — Joe stands on the floor, walks, jumps, picks the
    gold key up, spends it on the gold door, is held back by a locked door and climbs a ladder
  - `node scripts/load-check.mjs http://localhost:5197 flow` — the idol ends the level, the bonus room follows,
    level 2 is darker, fire kills, a long fall kills, three deaths reach the game over screen
  - `node scripts/tour.mjs` — every room loads and is screenshotted into `test-results/rooms/`
- Tick the milestone in `TODO.md`, update `FEEDBACK.md`, and commit in this repo.

The checks drive the real game over CDP and only use the `?scene=`, `?room=` and `?level=` query parameters, so a
room can be opened directly while working on it. They render in software, so they are slow on a busy machine, and
one that dies mid-run can take the browser with it ("Target page, context or browser has been closed"): re-run it
before believing a failure. Do not rebuild the assets while a check is running — Vite reloads the page when
`public/assets` changes, and the game starts again.