# Manual arena templates — v0.2.64

Small Arena, Large Arena and Dragon Arena are imported from the supplied Moogs
Nether Structures 3.1.1 JAR using its Java 1.21 template variants. The template
list is `behavior_pack/scripts/arena_catalog.js`. These arenas have NO natural
feature rules, placement probabilities or connections to village generation.

In a Creative test world with cheats and both Underworld packs enabled:

```
/scriptevent jagsby_nether:arena list
/scriptevent jagsby_nether:arena small_arena
/scriptevent jagsby_nether:arena large_arena
/scriptevent jagsby_nether:arena dragon_arena
```

Without coordinates, placement starts eight blocks east and south of the player,
with the template base one block below the player's feet. You can choose an
absolute base, for example:

```
/scriptevent jagsby_nether:arena dragon_arena 100 32 100
```

Placement writes template blocks into that footprint, including air to clear
interiors. Use an empty area in a test world. Gaps outside actual source pieces
retain existing terrain. A temporary ticking area loads the complete footprint
and is removed after placement or errors. If the world's ticking-area limit is
already full, the command stops before placing blocks. No recurring scan runs.

| Arena | Width × height × depth | Original structural pieces | Bedrock sections |
| --- | --- | --- | --- |
| Small | 56 × 18 × 93 | 4 | 2 |
| Large | 62 × 47 × 99 | 6 | 2 |
| Dragon | 129 × 45 × 120 | 20 | 6 |

Each source jigsaw connection is resolved offline by matching name/target,
front direction and up direction. Native sections are at most 64 blocks across
in X/Z and placed at fixed offsets, preserving complete layouts without requiring
Java jigsaw generation. All converted block names, states and state values are
checked against the bundled snapshot of Mojang's Bedrock block metadata.

This first import covers architecture, native Nether spawners and supported
vanilla block data. Nether Wart plants are removed throughout. Chests/barrels
use Underworld's Nether loot table. Dispenser/dropper/hopper basic item contents
and banner patterns are translated where supported. Original Java item-frame
entities and custom boss/mob encounter pools are omitted. Trial spawner and vault
blocks remain native blocks with default engine behavior; Java custom encounter
configurations/reward tables are not imported. Java terrain carving and support
pillar extension processors are not executed. Their placeholder orange glass is
replaced with deepslate. These gameplay limitations are recorded in provenance;
this is not a port of the mod's boss combat or Java processors.

Original selected source templates, pools and processors plus license texts are
bundled in `docs/moogs_arenas/`. Run `PYTHONDONTWRITEBYTECODE=1 python3
tools/convert_moogs_arenas.py` to reproduce the imported structures from those
retained sources. `MOOGS_ARENAS_SOURCE.json` records input hashes, joins and
conversion counts. Actual Bedrock placement, trap behavior and trial block
appearance still need an in-game test; no Bedrock client is available here.

## Additional manual structures — v0.2.65

The same catalog and placement command now also include Grave Yard, Large
Blackstone Pillars, Large Blackstone Walls and Mega Fortress. Use the generic
`jagsby_nether:template` command alias (the arena commands still work):

```
/scriptevent jagsby_nether:template grave_yard
/scriptevent jagsby_nether:template large_blackstone_pillars
/scriptevent jagsby_nether:template large_blackstone_walls
/scriptevent jagsby_nether:template mega_fortress 100 32 100
```

Mega Fortress is a fixed representative procedural layout built offline with
seed 31011, not the single start room and not every possible Java fortress.
Original pool weights select structural alternatives during this offline assembly
only; they are not natural spawn weights. Structural fronts/top directions and
name/target connections must match, bounding boxes must not overlap, and the
layout follows the source's 128-block radius. Assembly limits prioritize original
fallback/end pieces after depth five or 64 main pieces; blocked connectors may
remain unused, as recorded in provenance. Rotated pieces rotate block facing,
axes, connections and door states along with their coordinates. Mob/boss pool
attachments remain omitted.

The footprint exceeds Bedrock's 100-chunk ticking-area limit, so placement loads
and removes one section's temporary area at a time. No permanent ticking areas,
feature rules, automatic placement or natural mob spawn overrides are added.
