# Feedback for Synty Sprite Generator

Findings from building Montezuma's Revenge (Parker Brothers, 1984) through the generator. Each one is marked in
the game with `// FB-NNN`, so it can be removed once the generator is fixed.

## FB-001 · The `pickup` template turns flat items edge-on
- Severity: workaround · Milestone: G0
- Tried: `apply_sprites` with `"template": "pickup"` for the keys, the jewel and the gold
- Wanted: an item that bobs where it lies, so it can be picked up
- Got: the template is "float + spin" and rotates the model about its own axis, so a key or a coin spends most of
  its loop edge-on and is invisible in a side view
- Workaround: `"template": "bob"` in `ssg.assets.json` for every pickup
- Suggested change: `pickup` should spin about the vertical axis only (or offer `pickup:spin=0`), or the profile
  should say that it turns the model
- Status: open

## FB-002 · No flat ladder for a side view
- Severity: workaround · Milestone: G0
- Tried: `search_assets` for `Ladder` (23 models across five packs), rendered `POLYGON_Dark_Fortress/SM_Prop_Ladder_01`
  as an object in `side2`
- Wanted: a ladder that reads as a ladder in a 2D platformer, stretched down a column of tiles
- Got: the model is a 3D ladder seen at an angle; it renders 12 px wide inside a 64 px frame, so at any scale it
  is a dark smear rather than a ladder
- Workaround: ladders and ropes are drawn in `src/scenes/Room.ts` (two rails, rungs every 11 px, a knot at the end
  of a rope)
- Suggested change: a 2D ladder prop in one of the packs (flat, rungs only, tileable), or a `template` that tiles
  a model down a column
- Status: open

## FB-003 · No spider, snake or bat in the library
- Severity: blocks · Milestone: G1
- Tried: `search_assets` for `spider`, `snake`, `bat`, `insect`, `scorpion`, `crab`, `bug`, `worm`, `rat`
- Wanted: the game's three creatures — the spider that follows Joe up the ladders and the snake that sits and
  waits (the bats were dropped by Parker Brothers before release)
- Got: only spider webs (`SM_Env_Spiderweb_*`). No small creature models at all: the library has characters,
  vehicles, props and FX, but nothing that crawls
- Workaround: the skeleton guard (`Character_Skeleton_Slave_01`) stands in for the snake, and the skull covers
  both rolling and hopping; the spider is missing and the enemy system takes a data entry when a model turns up
- Suggested change: a pack of small dungeon creatures (spider, rat, snake, bat) with idle and walk clips, or the
  AI tagger pointed at a pack that has them
- Status: open

## FB-004 · The anims file names a texture key the caller never registered
- Severity: workaround · Milestone: G0
- Tried: `load.multiatlas(name, atlas, path)` under the sprite's name, then `anims.fromJSON` on the file the
  download produced
- Wanted: the frame keys inside `<base>_anims.json` to name the texture the atlas was loaded as
- Got: the anims file refers to the atlas's own base name (`Prop_Skull_01`), not the key it was loaded under
  (`skull`), so `textures.get(key)` on either returns the wrong thing. The same pattern is in the manifest of
  `~/projects/airborne-ranger` and `~/projects/sidefighter`
- Workaround: `scripts/build-assets.mjs` writes `textureKey: s.name` into the manifest, and the game registers the
  animations itself with that key
- Suggested change: write the texture key the engine is given into the anims file (or into a `texture` field in
  the manifest the profile writes)
- Status: open

## FB-005 · An Arcade body drifts away from a sprite placed by its exported pivot
- Severity: workaround · Milestone: G0
- Tried: a Phaser 3 `Arcade.Sprite` placed by the pivot in the `.meta.json` (Joe's pivot is between his feet),
  with `body.setSize()` and `body.setOffset()` from the same pivot
- Wanted: the body to stay under the art
- Got: the body ends up ~22 px above the sprite. Phaser recalculates the offset from the frame (its origin and
  display size) inside `updateBounds()`, so an offset written from the pivot is replaced; the sprite's y then
  disagrees with the body's by the difference. `refreshBody()` puts the placeholder texture's 32 px back on any
  body sized by hand
- Workaround: the game does its own collision against the tile grid (`src/world.ts`), which also made the
  fixed-length jump, the ladders and the fatal-fall rule straightforward
- Suggested change: document that `setOffset` is overwritten by `updateBounds`, or expose the pivot in the
  manifest as the body's suggested offset
- Status: open

## FB-006 · The ground tile id of a terrain is only in the wangset
- Severity: polish · Milestone: G0
- Tried: reading the exported `tomb.tsj` to find the tile to stamp for each ground terrain
- Wanted: terrain → tile id, so a game can paint the plain tile of a terrain
- Got: there are no `tiles` entries; the terrain names sit in `wangsets[].colors[]` and the tile ids in
  `wangtiles[].tileid` with `wangid[]` holding 1-based indexes into those colours
- Workaround: `scripts/build-assets.mjs` digs through `wangtiles` and writes `manifest.tilesets.tomb.terrains`
- Suggested change: write a flat `terrain` → `tileid` map into the .tsj properties, or into the manifest
- Status: open

## FB-007 · No ladder or rope climb clip
- Severity: workaround · Milestone: G0
- Tried: `search_animations` for `climb` (no results), and the martial arts moveset (which has `jump` but no
  climbing)
- Wanted: a clip for climbing a ladder and for riding a rope down, which the original spends a lot of its time on
- Got: nothing; Joe climbs by playing his walk cycle (`// FB-007` in `src/joe.ts`)
- Suggested change: a `climb` clip in the locomotion packs, or a procedural `climb_up` / `climb_down` template
- Status: open

## FB-008 · The 1984 rooms are wider than a square tile lock
- Severity: polish · Milestone: G1
- Tried: a `tomb` tileset at 32×32 and rooms of 20×11 tiles (640×352) with the project at 32 px per metre
- Wanted: rooms with the proportions of the original, which is about 1.7 times wider than it is tall
- Got: it works, but Joe comes out at 2¼ tiles tall (his hat is above the model's 1.87 m), so the rooms read a
  little more "big chamber" than "1984 Atari"
- Workaround: none needed; it is a look, and it is readable
- Suggested change: nothing — noted so the next platformer does not spend time rediscovering it
- Status: open