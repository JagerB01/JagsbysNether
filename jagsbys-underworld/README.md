# Jagsby's Underworld v0.2.7

Combined test build of Nether Settlements v0.8.24 and Nether Agriculture v0.1.6.
One `.mcaddon` imports one behavior pack and one resource pack. A single script
entry point loads both subsystems exactly once. Stable `@minecraft/server` 2.0.0
and Bedrock 1.21.100 or newer are required; no Beta APIs are needed.

Activate **Jagsby's Underworld v0.2.7 Behavior** and **Resources** together.
Deactivate the separate Nether Settlements and Nether Agriculture packs so
scripts do not run twice. The user-supplied cover is installed as `pack_icon.png`
in both packs when the original PNG file has been provided.

Use a new test world for the first combined test on Bedrock 26.52. To test an
existing world, use a copy, remove the old active packs and activate both new
packs. Original `nether_settlements` and `jagsby_nether` identifiers are preserved
so existing crops, items and structure identifiers remain recognizable.
The combined packs use new UUIDs to permit the requested v0.2.7 version alongside
the higher-version standalone releases. Old village-generation seed/spacing
records are scoped to the old behavior-pack UUID and do not automatically
transfer. Existing village blocks and entities remain, but the new generator
cannot use the old pack's village index. Full existing-world migration has not
been verified; use a new world to evaluate this first combined build.

The merge keeps the existing gameplay: 20% smooth-basalt road/center selection,
one native villager per residential house, gradual farmland heating, dry-soil crop
growth, native tilling/fertilizer handlers and Grol-o’-Lantern naming. Empty fully
cooled plots revert after about 30 loaded seconds; planted and lava-protected
plots stay tilled. Former nether-wart spots in villages now use soul soil farmland: Sorgum in
crimson forests and Nether wastes, Polyps in warped forests and soul sand valleys.

Commands remain:

```mcfunction
/scriptevent jagsby_nether:kit
/scriptevent nether_settlements:test crimson
/scriptevent nether_settlements:test warped
/scriptevent nether_settlements:find village
```

See [TESTING.txt](TESTING.txt) for the combined in-game checks.

## Build

The builder combines the exact checked-in standalone release archives. It checks
archive paths/collisions, preserves source scripts/assets byte-for-byte except the settlement population/generation
overrides and removal of nether wart from structure palettes (scripts
move into separate subfolders), verifies pack references, and runs the existing
crop tests plus combined startup/command tests. Generated merged source is in
ignored `.build/behavior_pack` and `.build/resource_pack` for inspection.

Place the original supplied square PNG at `jagsbys-underworld/pack_icon.png`, then:

```sh
cd jagsbys-underworld
python3 tools/build.py
```

This writes `downloads/Jagsbys_Underworld_v0.2.7.mcaddon`. The cover is copied
unchanged into both packs. For local verification while the original icon is
unavailable, `--allow-placeholder-icon` produces an explicitly marked local build
inside `.build/`, never a release download. Original source licenses and credits
remain bundled; see [CREDITS.txt](CREDITS.txt).

## Village residents

New villages spawn one native `minecraft:villager_v2` per residential house.
Nonresidential amenities, centers and roads receive no residents. Unsafe or
unloaded spawn positions are reported and skipped. Existing mobs are not replaced.
Appearance, age, profession and names use the active entity definition unchanged.
Conquest & Commerce v1.1.0 replaces that vanilla ID and selects Nether biome
variants in its normal spawn event, so no custom compatibility hook is needed.
Enable its behavior and resource packs together. Other villager overrides may
conflict. Pack inspection verifies this design; live gameplay remains untested.

## Structure crops

Every bundled structure has vanilla nether wart removed from its palette,
including abandoned camps and unused variants. During village generation, each
former wart position is replanted on soul soil farmland according to its actual
biome: Sorgum in crimson forests/Nether wastes, Polyps in warped forests/soul sand
valleys. Crop age and soil heat start at their normal defaults. Other crops and
nether-wart blocks used as building materials are unchanged. Standalone houses,
camps and basalt-delta planting spots remain empty where wart was removed.

An invisible, temporary native biome probe uses Bedrock `has_biome_tag` filters because
the stable server 2.0.0 API has no biome-query method. Each probe is removed after
classification, with a ten-second cleanup timer as a fallback. Selection is per
planting position and independent of forced village style. Existing structures
already placed in saved worlds are not retroactively edited.

## Lava fishing (v0.2.7 prototype)

Fishing-only adaptation of the supplied Lava Fishing 1.3.1 Java mod: one
Obsidian Fishing Rod and its nine catch species, with original textures,
item artwork, recipe, durability and biome-dependent fish weights.
See [FISHING.md](FISHING.md) for controls, catches and Bedrock differences.
No separate hooks, buckets, extra rods, tackle boxes, gear, junk or treasure
are included. Native rod input and bobber/line rendering require a Bedrock playtest.

Fish are catchable inventory items only. No fish creatures, natural spawning
or fish spawn eggs are included. The fishing bobber remains for casting.
