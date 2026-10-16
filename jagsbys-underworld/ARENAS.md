# Arenas and natural landmarks — current v0.2.116

Architecture is adapted from the supplied Moogs Nether Structures 3.1.1 Java 1.21 templates. Original selected templates, pools, processors, credits and licenses remain under `docs/moogs_arenas/`; source hashes and conversion notes are in `MOOGS_ARENAS_SOURCE.json`. This is not a port of the Java mod's bosses, custom encounter pools or reward progression.

Earlier policies, test-only selections and release notes are preserved in [history/ARENAS.md](history/ARENAS.md). They do not describe current eligibility or weights.

## Natural giant selection

At a promising site, survey **Dragon Arena first**, then Large Arena, then the Mega Fortress keep. All three starting layouts must qualify before choosing a structure. Any incomplete assessment defers the choice. Selection is **one third each** Large Arena, Dragon Arena and Mega Fortress; these are conditional selection chances, not chances per chunk or guaranteed successful placement.

Giants use 1,600×1,600 regions with at most one completed giant per region. Discovery reuses shared lava observations and searches multiple candidates, including a bounded 128-block probe grid. Search-cell failures are stored at 64-block granularity, rather than rejecting an entire region. Search policy 7 reopens older failed cells once; existing completed/reserved structures stay intact.

Large/Dragon starting footprints require at least 90% lava coverage at the chosen surface level. Dragon Arena uses its authored irregular base mask, excluding empty rectangular corners; Large Arena uses its rectangular base. Exact native chunk-sized plane queries count non-lava columns across each complete footprint, rather than requiring every section to independently qualify. This percentage is horizontal only, not a height or volume requirement. Ordinary Nether terrain within the building volume may be carved, while protected blocks, ceiling limits and spacing still apply. Mega Fortress checks only its 43×43 keep footprint at 90% coverage and allows keep carving; the full eventual fortress rectangle is not reserved or required initially. Large/Dragon bases are two blocks above lava; the Mega keep origin is one block below the lava surface.

## Spacing and loading

- Giant centers: at least 1,500 blocks apart.
- Giants to Small Arena centers: at least 150 blocks.
- Giants to recorded village footprint edges: at least 50 blocks.
- Other landmark footprints: at least 32 blocks apart.
- Candidates: within 768 blocks of a Nether player, with 32-block player clearance from the initial footprint.

Known spacing exclusions are filtered before terrain surveying/loading. They are eligibility skips, not permanent terrain failures or routine rejection diagnostics. A final check handles space reserved since selection. Existing unfinished builds keep their saved plan and resume path.

Natural placement uses at most 16×16 horizontal tiles and shares the budgeted queue with villages/manual templates. Chunk leases load only the needed area and await readiness; failure or cancellation releases them. Tile checkpoints allow restart recovery. A player approaching an active footprint pauses placement and schedules a one-shot retry after 10 seconds; other interruptions normally retry after 60 seconds. No extra idle player-proximity scanner is added. Construction can still be visible and cause native lighting/rendering work.

Former soul-campfire positions contain three lit red candles. Supporting slabs are made double slabs to give these clusters a full base in Bedrock. This is an offline template edit; previously placed or dropped candles are not restored automatically.

Imported dispensers containing splash water bottles now use a repeating mix of native Harming II (24), Poison II (27), and Decay/Wither II (36). Slot positions and bottle counts are preserved; other dispenser ammunition is unchanged. This is baked into templates, without runtime dispenser scans. Existing placed dispenser inventories are not refilled or overwritten.

## Mega Fortress expansion and foundations

The keep combines the center and roof into one required 43×56×43 module. The four starting side modules containing lower chambers are preflighted with the keep before any starter tile is placed. Only the keep needs 90% lava coverage; the chambers can trim natural terrain. They are still placed one tile at a time, with player-safety pauses and saved progress. Older in-progress starts keep their required chamber completion steps. Remaining branches expand one connected module at a time and require their parents; optional conflicts prune that branch, while other directions continue.

Optional modules carve their authored architectural envelope once even when natural terrain is dense. The old 512-block/8% hard rejection is removed. A placed optional module needing more than 128 blocks or more than 2% carving ends only that branch; descendants are skipped while independent branches continue. Counting stops as soon as that decision is known, then remaining volumes still receive protected-block checks. Branch stops persist through reloads. Required side chambers and the keep retain their carving allowance. Optional bridge surveys and carving use offline-generated architectural envelopes; terrain below unmarked suspended decks is preserved and does not consume their carving budget.

Dragon Arena foundations follow the authored irregular ground base, with blackstone on the actual perimeter and netherrack inside. Empty bounding-box corners and raised overhangs receive no foundation. Mega foundations extend only under authored pier feet/chamber bases, including raised feet marked by the source pillar processor. Red-glass pillar markers are resolved to polished blackstone bricks; unmarked bridge decks remain suspended; all Mega foundations use a stable mix of approximately 65% polished blackstone bricks and 35% deepslate. Every complete 20-block vertical band contains exactly 13 brick and 7 deepslate blocks; partial bands approximate that ratio. Material runs fill bottom-up in the existing generation budget and resume without changing the pattern. All fill only air/lava down to the first existing solid block, without excavation. Already generated older foundations are not removed or rebuilt.

## Small Arenas and ruins

Small Arenas spawn only in Basalt Deltas, using 600-block regions and multiple candidate sites. At most one completes per region; centers are at least 600 blocks apart. Their separate terrain policy permits uneven natural ground and limited footprint carving. Their frequency is not part of the three-way giant selection.

Ruins use 192-block regions: Grave Yard 8%, Large Blackstone Pillars 6%, Large Blackstone Walls 4%, no selection 82%. Grave Yards require Soul Sand Valleys; pillars/walls require Basalt Deltas or Nether Wastes. Ruin centers have 150-block separation, plus footprint spacing. These are regional selection chances, not guarantees that terrain permits placement.

## Spawners and encounters

All spawners in the three arenas and the Mega Fortress keep and four lower chambers are native trial spawners. Every trial spawner has an explicit selected mob. Initial selection weights are 25% Ashen Tower Wraith family, 25% Crimson Necromancer, 50% Piglin Brute. Wraith selections include 10% declared enchanted variants; Necromancers retain their native 10% enchanted transformation. New template entries contain a valid weighted fallback; one finite pass at structure completion selects weighted explicit presets independently for each new structure. Upgrades repair saved positions using the same presets. Choices are persisted before writing and unfinished fresh passes retry on world load. Native potential pools are retained, but automatic per-encounter rerolls are unverified and are not required for initial activation. There is no periodic selection or crowding scan.

| Build | Configured trial spawners | Ordinary spawners |
| --- | --- | --- |
| Small Arena | 8 | 0 |
| Large Arena | 26, including 4 originally imported trials | 0 |
| Dragon Arena | 13, including 3 originally imported trials | 0 |
| Mega Fortress keep and lower chambers | 9 | 0 |
| Other Mega modules, full source layout | 0 | 3; actual count depends on accepted branches |
| Grave Yard | 0 | 1 Wither Skeleton |
| Large Blackstone Pillars/Walls | 0 | 0 |

Nether trial spawners are protected against player breaking (including Creative) and explosions through before-action events. No continuous protection scan runs. Native trial blocks are non-pushable; operator commands/world editing can deliberately replace them. Protection applies to all Nether trial spawners, not just these templates. Ordinary module spawners, vaults and Overworld trial spawners retain their native behavior.

Edit `TRIAL_ENCOUNTERS.json` and rebuild to change encounter mobs/settings. One saved-revision comparison runs on world load. Changed encounter data triggers one finite, budgeted migration of recorded spawner locations, then stops. Stored positions are retained, newly included lower-chamber slots are added once, new roles are reconciled at those positions, and mined/replaced blocks are not restored. Successful sites are checkpointed; failed sites retry on the next world load or an explicit command. Applying changed encounter data resets the affected native encounter/cooldown. No periodic mob, proximity or terrain update scan is added.

Natural structures are discovered from their existing Underworld records. New manual structures record their locations on completion. Older manual placements were not indexed and require explicit registration at their original placement origin.

Large Arena has 4 native vault blocks; Dragon Arena has 3. Java vault reward/key configurations and boss progression are not ported. Template containers use the shared Nether loot table. Original soul lights are replaced with supported redstone torches, glow lichen and lit red candles; former soul campfires use three red candles. These lights do not activate Underworld's soul-light suppression.

## Manual templates and commands

```mcfunction
/scriptevent jagsby_nether:template list
/scriptevent jagsby_nether:template small_arena
/scriptevent jagsby_nether:template large_arena
/scriptevent jagsby_nether:template dragon_arena 100 32 100
/scriptevent jagsby_nether:template mega_fortress 100 32 100
/scriptevent jagsby_nether:template grave_yard
/scriptevent jagsby_nether:template large_blackstone_pillars
/scriptevent jagsby_nether:template large_blackstone_walls
/scriptevent jagsby_nether:structures_status
/scriptevent jagsby_nether:structures_diagnostics
/scriptevent jagsby_nether:structures_find
/scriptevent jagsby_nether:encounters_status
/scriptevent jagsby_nether:encounters_update
/scriptevent jagsby_nether:encounters_register dragon_arena 100 32 100
```

`jagsby_nether:arena` remains an alias for template placement. Without coordinates, templates start eight blocks east/south of the player and one block below their feet. Manual placement bypasses natural suitability checks, writes authored air/interiors, and does not add natural foundations. Mega manual placement uses the fixed full source assembly, not incremental natural module growth. Use a clear test area: manual placement can overwrite blocks.

| Template | Width × height × depth |
| --- | --- |
| Small Arena | 56 × 18 × 93 |
| Large Arena | 62 × 47 × 99 |
| Dragon Arena | 129 × 45 × 120 |
| Mega Fortress full manual assembly | 245 × 56 × 248 |
| Grave Yard | 18 × 8 × 10 |
| Large Blackstone Pillars | 13 × 11 × 13 |
| Large Blackstone Walls | 20 × 10 × 5 |

`structures_find` locates completed recorded landmarks. Diagnostics retain previous attempts, so an older entry may describe an earlier policy. Native client placement, activation, rewards and encounter completion require the checks in [TESTING.txt](TESTING.txt).

## Asset tooling

The converter preserves architecture and supported native block data, removes Nether Wart plants and Java jigsaw markers, and retains source/licenses. Java entity attachments/custom bosses and terrain processors are not executed. Use `tools/update_trial_encounters.py` after conversion to bake current mob roles/presets; `tools/build.py` does this automatically and regenerates natural tiles. Native trial NBT field verification used PowerNukkitX's [Bedrock-compatible implementation](https://github.com/PowerNukkitX/PowerNukkitX/blob/master/src/main/java/org/powernukkitx/blockentity/BlockEntityTrialSpawner.java) as a format reference, not a dependency. Automated asset checks do not verify activation in the target Bedrock client.

## Dormant bosses in new structures (v0.2.108)

New Mega Fortresses place Malzareth in the center of the four roof trial
spawners. New Dragon Arenas place Nerezhal on the main hall's purple-glass boss
platform; new Large Arenas place Baelgor on their central ground-level fighting
floor. The original authored encounter markers and real template clearances
were checked; see BOSS_PLACEMENTS.json and INFERNAL_LORDS.md for exact offsets.
Placement runs once after completion with a small temporary chunk lease, with
no periodic mob checks or backfill of existing structures. Manual template
commands use the same sites. A saved placement claim prevents respawning after
defeat or update. Containment and progression remain future work.

## Choose the next natural giant for testing

Run `/scriptevent jagsby_nether:next_giant mega_fortress` (or `dragon_arena` / `large_arena`). The world remembers this one-shot choice across reloads and failed/deferred surveys. Normal all-three-footprint, spacing and loading requirements still apply; this does not place a structure instantly. It clears once the chosen new natural build reserves its site and starts generating. Existing builds and manual templates do not consume it. Use `status` to inspect or `clear` to restore equal random selection. This adds no recurring checks.

## Bounded giant-site comparison (v0.2.110)

Before reserving a new giant, the natural worker surveys up to three shortlisted sites in its chosen region. Each must still pass all three starting-footprint checks. It selects the best confirmed fit using average lava coverage minus sampled solid-terrain occupancy across those footprints. The occupancy sample is 27 block reads per section, taken while that section's existing survey lease is loaded, with yields between reads. This estimates carving; it does not exhaustively count the whole volume. Higher-quality sites win; ties retain shortlist order. Unavailable sites defer without becoming permanent failures, and a ready site can win despite another site being unavailable. There is no unbounded search or new recurring task, and the existing planning budget is unchanged. The selected plan is reused rather than fully surveyed again; normal placement safety checks remain. Equal type chances and the one-shot next-giant command remain supported.

An active natural build pauses at its next tile checkpoint after the last eligible Nether player leaves, and its saved tile/module progress resumes when a Nether player is in working range. A survey comparison stops at its next site boundary; unfinished surveys are not marked unsuitable.

## Small Arena ground and seeds (v0.2.112)

Small Arena terrain sampling and foundation filling use its authored lowest-layer ground outline. Native protection checks and terrain carving use the actual built-column outline, including overhang architecture. Unused bounding-box columns are structure void, so template air cannot erase their terrain. The rectangle remains a loading/spacing envelope, not a foundation or terrain-suitability footprint.

A bounded ground survey chooses the least expensive height among sampled exposed floors, instead of following a single center pillar. At least 80% of ground-outline samples must be within six blocks below or eight above that level. Foundation columns connect directly beneath the authored floor (including the Small Arena's empty bottom layer) and fill at most six blocks down to existing solids. Deeper local gaps receive no foundation; broad unsupported sites fail the ground test. The rigid arena remains level and can embed into nearby basalt, rather than bending individual rooms. No idle checking or existing-structure reconstruction is added.

New Small Arena chests use `loot_tables/chests/small_arena.json`: normal Underworld supplies plus independent 5% rolls for Grollet seeds and plantable Scarberries, each yielding 1–2. Its 22 authored chest-half rolls give about 89.5% probability of at least one of either crop, or 67.6% for each crop individually. Other structure chests and generic structure bonus rewards no longer contain these two starter crops; Sorgum/Polyp per-item odds stay 1.25%. Wild-sprout Grollet and crimson-root Scarberry acquisition drops are removed; normal crop harvesting/replanting remains supported. Existing arena blocks and already-placed chest loot references are not migrated.

### v0.2.113 hanging lava

Active carving removes source and flowing lava inside each placement volume above the surveyed ground/ocean level. It preserves the ocean at/below that level and lava outside the volume. Adjacent external sources can still flow in. This uses filtered writes during generation, with no idle fluid scanning, and does not repair existing arenas.

## v0.2.114 spawner positions

31 trial spawners were moved into existing lower decorative blocks: 8 Small Arena, 18 Large Arena, 5 Dragon Arena. The four isolated Dragon Arena pedestal spawners now sit farther away near usable existing floors. Vacated slots use matching deepslate masonry or crimson stem. All relocated positions are checked offline for at least ten conservative floor candidates, three blocks of headroom for 2.1-block casters, and clear centre rays. Ten is an audit threshold, not a native spawn rule; precise native spawning still needs Bedrock acceptance. Counts and dormant boss platforms are unchanged.

Positions change in new templates only. Existing recorded spawners receive the weighted configuration at their existing positions through the finite revision migration; relocation does not overwrite existing terrain/player builds. Legacy coordinates are retained for older sites.

## v0.2.116 empty-spawner repair

The v0.2.114 weighted update omitted `spawn_data`, relying on the native potential pool to initialize it. That produced empty cages in live testing. Every template and one-block repair preset now contains a non-empty `spawn_data.TypeId`, matching the earlier working native format. All recorded arenas receive a new finite revision migration; selected repair mobs are saved before placement so retrying cannot reroll partial results. Old manual placements without records need encounters_register. Air and player replacement blocks remain untouched; placement locations, counts, activation distance and cooldown settings are unchanged.
