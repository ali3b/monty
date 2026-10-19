# Montezuma's Revenge — the design behind this remake

The original is *Montezuma's Revenge*, written by Robert Jaeger and published by Parker Brothers in 1984. Panama Joe
(an Indiana Jones lookalike, "Pedro" in the prototype) climbs down into the tomb of emperor Montezuma II, room by
room, to steal the treasure at the bottom of the pyramid. It is a single-screen platformer in the Donkey Kong
tradition: one room fills the screen, you never scroll, and every room is a small puzzle about reachability.

## What the original does

- **Rooms, not a world.** Up to 100 rooms per level, each a screen. From the very first room Joe is offered two
  locked doors, and the adventure is non-linear from there.
- **Three colours of door.** Gold, silver and red doors, each opened by the matching key. Keys are found all over
  the pyramid, so the way down depends on what you picked up on the way.
- **Five pockets.** Joe can carry five items; jewels are the exception and never use a slot. Once the pockets are
  full he cannot pick up anything else (the original's own quirk — see Deviations below).
- **The tomb gets darker every level.** Joe needs the torch to see anything on the lower floors, and the darkness
  creeps up until the whole pyramid is black. The first levels are gentle; by the fifth you have memorised the
  rooms.
- **Creatures.** Rolling and jumping skulls, spiders that follow him up and down ladders, and snakes that sit
  still. A dagger kills one of them (never a snake). An amulet makes them harmless for a few seconds. In the
  early levels a creature that has caught Joe once does not return to that room.
- **Traps.** Fire pits, floors that crumble, platforms that phase in and out, conveyor belts, and a few poles you
  can only slide down.
- **The jump cannot be steered.** Joe's arc is fixed once he leaves the ground, and a fall further than his own
  height kills him — the rule that makes the original unforgiving in a way later platformers are not.
- **Ropes go one way.** Ropes come down from the ceiling and cannot be climbed back up; ladders go both ways.
- **A bonus room ends every level**: a timed room of ropes and treasure, then deeper and darker.

## What this remake does

Same shape, built room by room as ASCII art (`src/rooms.ts`, one character per tile) so the layouts can be read
and checked. Eleven rooms make a level, joined by three coloured doors:

```
        entry ──(gold)── rope ──(gold)── crumble ──(red)── dark ──(red)── fire
          │                  │                                        │
       (silver)           (silver)                                 (silver)
          │                  │                                        │
       ladder ──(silver)── skulls ──(gold)── web ──(silver)── treasure
                              │
                           (gold) ⇄ jewels
```

- **Joe** is `Character_GentleMan_01` in a fedora, with the `martial_arts` moveset for the run, the jump and the
  KO.
- **The cast** is skulls (bouncing), skeleton guards (walking), and the traps: fire pits, crumbling floors, dark
  rooms and the torch.
- **The levels** reuse the same rooms, but every level deeper into the pyramid adds the creatures that are written
  down in the room (`extraEnemies`) and the rooms written `darkFrom` go dark.
- **The idol** in the shrine ends the level: a bonus room, then the next level, darker.

### The controls and the rules

| | |
|---|---|
| Left / right | walk (Joe cannot be turned around in the air) |
| Up / Space | jump, or grab a ladder |
| Down | crouch, ride a rope down, climb down |
| Left / right on a ladder | step off sideways onto a platform |

- Jump: 680 px/s against 2200 px/s² of gravity — about three tiles up and three across, fixed.
- A drop of more than 84 px (Joe is 46 px tall) is fatal, measured over the whole fall, so a slow frame cannot
  turn a fatal fall into a safe one.
- Ledges are pass-through from below and solid from above; the crumbling floors are ledges that give way half a
  second after Joe stands on them and come back after a little over two.

## Deviations, and why

- **The torch is always pickable.** The original refuses any treasure once the five pockets are full, which can
  strand a player in a dark room with no way to light it. Here the torch still goes in the pocket.
- **The bonus room is one room, not a maze of them**, and it counts down 30 seconds.
- **The pyramid is eleven rooms deep, not a hundred.** It is enough to need the keys in the right order and to
  feel like a tomb, and it can be finished in one sitting.
- **The climb uses the walk cycle** (FB-007): the library has no ladder clip.
- **Spiders and snakes are missing** (FB-003): the library has no model for either, so the skeleton guard takes
  the place of the snake that sits and waits.

## Where the art comes from

Everything is generated (`ssg.assets.json`): Joe and the skeleton from rigged characters, everything else from
props, and the tomb floor, walls and ledges from the `tomb` ground tileset. `scripts/check-rooms.mjs` keeps the
layouts honest: every room is a full screen, every ladder reaches the floor and has a platform to step off, every
item has something under it, and every door leads to a room that exists.