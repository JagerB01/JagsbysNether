# Arena templates and natural landmarks — v0.2.73

Small Arena, Large Arena and Dragon Arena are imported from the supplied Moogs
Nether Structures 3.1.1 JAR using its Java 1.21 template variants. The template
list is `behavior_pack/scripts/arena_catalog.js`. Natural placement now uses the shared budgeted generation queue described below.
The original manual commands remain available.

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
and removes one section's temporary area at a time. The original import did not add natural placement; v0.2.72 adds it separately.
No permanent ticking areas or natural mob spawn overrides are added.

## Chunk loading correction — v0.2.66

Manual templates now use the stable API ticking-area loader and await its
completion instead of assuming chunks load in two ticks. Every touched chunk is
checked at a coordinate inside the requested footprint. Command fallback requests
preload explicitly and polls until available, with a 30-second limit. Failed
loads stop before that section is placed and temporary areas are cleaned up.
The same loader supports the extended village search.

## Natural generation — v0.2.72

Small Arenas and ruins retain deterministic candidate locations. Giants now discover sites across each region, reusing lava observations from village surveys and probing unobserved areas on a bounded 128-block search grid. Rejected giant search cells (64 blocks wide) are persisted, while unloaded terrain, unavailable biome queries and approached sites are deferred. Rejecting one site does not discard the whole region. Existing explored terrain can generate a new landmark when first assessed by this version; surveys reject obstructing blocks but cannot distinguish player-placed natural terrain from world terrain.

Small Arenas use 600-block regions and require Basalt Deltas. Each region searches multiple candidate sites, with at most one completed Small Arena. Arenas have at least 600 blocks between Small Arena centers; giant-to-Small Arena separation is 150 blocks.

Giants use 1,600-block regions with at most one giant per region. At a promising location all three sizes are assessed, largest first, using shared block snapshots and proven-clear volumes. A definite size or spacing failure excludes that size; any incomplete assessment defers the decision. Only after all size outcomes are known is the structure selected: Large Arena weight 60, Dragon Arena 25, Mega Fortress 15, normalized over the confirmed fitting options. With all three fitting, this is 60% / 25% / 15%; with just Large and Dragon fitting, it is 70.6% / 29.4%. These percentages choose the structure, not the chance of a successful placement. All require a lava-centered ocean site, but islands and carveable cavern terrain are allowed. Minimum sampled lava coverage is 60% for Large Arena, 55% for Dragon Arena and 35% for Mega Fortress. Large and Dragon Arena bases sit two blocks above lava; Mega Fortress lower foundations begin one block below its surface. Giants require 1,500 blocks between centers and at least 50 blocks between their footprint and village edges. Older villages use a conservative 113-block-square estimate; new villages store actual planned bounds. Future villages also respect recorded landmark footprints.

Small ruins use 192-block regions with one selection: Grave Yard 8%, Pillars 6%, Walls 4%, none 82%. Grave Yards require Soul Sand Valleys; pillars and walls require Basalt Deltas or Nether Wastes. Ruins have 150-block center separation and all landmarks require at least 32 blocks between footprints. Ground placements allow up to three blocks of sampled variation and add supports at actual template foundation anchors. Small ground structures are not excavated to make room; giant builds can carve ordinary Nether terrain.

Candidates are considered within 768 blocks of a Nether player. Initial giant surveys require players at least 128 blocks outside the footprint; other landmarks require 64. Placement pauses if a player approaches within 32 blocks. This reduces nearby pop-in but cannot guarantee placement outside every client's render distance.

Native block-volume queries survey 16-block-wide strips; sections load temporarily below the ticking-area limit. Natural builds place losslessly sliced 16 by 16 tiles with two-tick pauses, reserving their footprint and saving per-tile progress for restart recovery. Foundation supports extend down at most 64 blocks. Villages, natural landmarks and manual templates share one job queue with the existing per-tick work budget. Large block placement may still cause engine lighting/rendering work; live profiling is required.

Commands:
```
/scriptevent jagsby_nether:structures_status
/scriptevent jagsby_nether:structures_find
```

Natural generation does not add trial waves, custom bosses or trial rewards.
To regenerate the derived placement assets after template changes:
```
PYTHONDONTWRITEBYTECODE=1 python3 tools/generate_structure_foundations.py
PYTHONDONTWRITEBYTECODE=1 python3 tools/generate_natural_landmarks.py
```

## Shared discovery and complete size decisions — v0.2.73

Village surveys contribute lava-surface hints from their loaded neighborhood and distant 145-block survey areas. Positive hints are retained per 128-block terrain tile and ranked by neighboring ocean observations. They are only hints: every selected giant footprint is checked against real terrain. Initially probes search other in-range positions on a 128-block grid; visiting new areas exposes additional search sites. No entire 1,600-block region is loaded at once.

The old v0.2.72 region rejections are treated as failures of their original position; other positions in those regions become eligible. Completed and partially placed structures are retained, including their actual coordinates and saved tile progress.

Failed 64-block search cells are never retried after terrain edits. Missing data does not reject a cell. Complete size assessments share at most 60,000 block snapshots and clear native-volume proofs for that one site. Final placement still uses live checks. The shared queue and all existing distance, separation, village-edge, support and clearance rules remain. Status now distinguishes initial loading, individual size checks, survey sections and placement tiles, with elapsed game time.

## Terrain carving and reduced spacing — v0.2.75

Giants retain 1,500-block center separation from other giants; giant-to-Small Arena center separation is 150 blocks, with the independent 32-block landmark-footprint clearance still preventing overlap. Giant-to-village separation is 50 blocks between footprint edges, in both placement directions. Small-to-small arena separation stays 600 blocks.

Giants no longer need an empty rectangular volume or lava at every sample. After a complete size assessment they can replace ordinary Nether terrain inside each 16-block placement tile: netherrack, basalt, blackstone, gravel, soul terrain, native ores, nylium and Nether vegetation. Bedrock, portals, containers, constructed blocks and unrecognized custom blocks still obstruct a site. Native template air clears its rooms; the additional carving pass removes whitelisted terrain throughout the tile, including gaps the original template would otherwise retain. Liquids are not removed by the extra carving pass.

Carving is performed only after selection and immediately before each tile's native placement. Supports are planned to reach below the carving plane and placed after the template, so its air does not erase them. Per-tile placement is checkpointed before support work; recovery finishes supports without replacing an already-placed tile. Existing partially built structures retain their original non-carving policy.

Stricter pre-v0.2.75 giant search-cell failures reopen once for assessment under these new rules. New confirmed failures remain permanent. Village rejection history and completed structures are retained. Ordinary natural blocks placed by players are indistinguishable from generated terrain and may be carved; recognized constructed blocks and recorded structure spacing are protected. Ocean-observation density still ranks discovered sites before full assessments. Larger carving operations require live performance verification.

## Arena search and diagnostics — v0.2.78

Small Arenas now search multiple 64-block cells per 600-block region, reusing loaded-ground observations from village surveys. Basalt/blackstone ground observations are ranked ahead of other ground; both actual Basalt Deltas and Nether Wastes are accepted rather than preassigning a biome to one region coordinate. This replaces the old 80/20 biome-target roll; observed terrain and eligibility determine the resulting distribution. At most one Small Arena is completed per region.

Small Arenas can carve ordinary terrain and tolerate nearby floor differences of twelve blocks, requiring natural ground near at least half their sampled footprint. Other small ruins retain their existing ground rules. Giant ocean coverage and agreed structure spacing are unchanged. Surveys check usable heights up to the actual template height limit and down to Y8, using available floor/lava hints first. Giants no longer require any biome-classifier result because all Nether biomes are eligible.

Initial arena surveys use the smallest relevant footprint and the same 32-block player clearance as placement, replacing the extra 64/128-block survey exclusions. Larger options occupied by players are excluded for that attempt; no tile is carved within the placement safety gap. Searches can advance through four confirmed unsuitable candidates per queue turn, stopping on construction or incomplete data.

Old giant and Small Arena failed sites reopen once under search policy 3. Completed and reserved structures remain unchanged. Confirmed new failures remain permanent. Recent assessment coordinates and reasons are saved in an eight-entry journal; protected-block failures report their type and position when native query results are available:
```
/scriptevent jagsby_nether:structures_diagnostics
```

Arena support searches can now reach up to 128 blocks down (stopping above Y0), rather than rejecting deeper lava columns at 64 blocks. Giant biome queries are removed entirely; Small Arena and ruin biome queries retain their rules and report unavailable data explicitly.

Version 0.2.79 allows natural glowstone, bone fossils, and red and brown mushrooms to be cleared for arena placement. Search policy 4 reopens prior rejected arena sites once; completed structures and village rejection records are preserved.

Version 0.2.80 shortens player-approach placement pauses to 200 ticks (10 seconds), using a one-shot timer created only when an active build pauses. No additional recurring check is registered. Normal discovery retains its 100-tick cadence, the 32-block player clearance remains required, and obstruction retry delays remain 1200 ticks.

Version 0.2.81 gives newly reserved Small Arenas and giants solid foundations: a one-block blackstone perimeter and netherrack interior. Each column fills only air/lava below the structure origin until the first existing solid, without excavation. Scans and writes yield through the shared budget. Existing completed and partially placed structures retain their previous foundation policy.

Version 0.2.82 restricts new natural Small Arena placement to Basalt Deltas only. Existing structures remain. Spacing is unchanged: 600 blocks between Small Arena centres, 150 from giant centres, and 32 blocks between footprints (including villages), with one Small Arena per 600×600 region.

Version 0.2.83 requires a candidate to fit all three giants before selection. Any confirmed size failure rejects that search cell; incomplete assessments defer it. Eligible sites use the fixed Large/Dragon/Mega weights 60/25/15, with no smaller-only fallback. Natural terrain carving remains permitted.

Temporary v0.2.83 testing override: only Mega Fortress can be selected from eligible giant sites. All-three-fit eligibility remains enforced, and natural Small Arenas/ruins are unchanged. Normal 60/25/15 weights are retained in code for restoration.

Version 0.2.84 lowers sampled lava coverage to 20% Large Arena, 15% Dragon Arena, and 10% Mega Fortress. The centre still needs exposed lava; natural terrain in the rest of the build volume is carveable. All-three-fit eligibility and Mega-only testing remain. Search policy 5 reopens older rejected search cells once.

Version 0.2.85 replaces natural fixed Mega Fortress placement with 81 source-connected modules. The required centre plus roof is 43×56×43; 80 modules are optional and descendants require their parent. Only the core must qualify to initiate; the previous all-three-full-footprints rule is superseded for the Mega-only test build. Optional protected/spacing/ceiling conflicts prune that branch, while incomplete loading defers the survey. Exposed lava at the core centre sets elevation; no footprint lava percentage is required for modular fortress placement. Each accepted module is carved and placed in 16-block tiles with its own blackstone/netherrack foundation footprint. Selection and checkpoints persist module indices. Existing fixed-layout builds retain their original plan; manual Mega Fortress commands still place the original full template.

Version 0.2.86 builds the modular Mega Fortress incrementally. Only the core is surveyed and reserved initially; each connected module is surveyed and reserved after the previous module finishes. Player checks apply to the current/next module rather than the aggregate fortress rectangle. Temporary player/loading interruptions retry the same module; confirmed protected/spacing/ceiling conflicts omit that branch. Records persist expansion progress, accepted modules and tile checkpoints. No new idle polling is introduced.

Version 0.2.87 removes imported soul lanterns, soul torches, and soul campfires from fixed/manual, natural, and modular templates to avoid Underworld soul-light spawn suppression. Existing placed lights are unchanged.

| Structure | Native mob spawners |
|---|---|
| Small Arena | 5 Zombified Piglin, 2 Magma Cube, 1 Skeleton |
| Large Arena | 12 Wither Skeleton, 10 Skeleton |
| Dragon Arena | 4 Wither Skeleton, 3 Blaze, 3 Magma Cube |
| Grave Yard | 1 Wither Skeleton |
| Large Blackstone Pillars | None |
| Large Blackstone Walls | None |
| Mega Fortress required core | 4 Wither Skeleton, 1 Magma Cube |
| Mega Fortress complete module layout | 5 Wither Skeleton, 5 Magma Cube, 2 Blaze |

Optional branches determine actual Mega Fortress totals. These counts exclude trial spawners and Java encounter pools, which were not ported as configured encounters.

Version 0.2.88 replaces hanging soul lanterns with shroomlights and other removed soul lights with supported redstone torches. A torch without support is moved down to a suitable floor or wall inside its module. Neither replacement activates soul-light suppression; normal vanilla lighting rules still apply. Existing world placements are not edited. Spawner totals are unchanged.
