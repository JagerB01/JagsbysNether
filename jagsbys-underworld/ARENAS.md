# Arenas and natural landmarks — current v0.2.103

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

## Mega Fortress expansion and foundations

The keep combines the center and roof into one required 43×56×43 module. The four starting side modules containing lower chambers are required completion steps: a temporary/protected conflict pauses rather than permanently cutting those rooms off. Remaining branches expand one connected module at a time and require their parents; optional conflicts prune that branch, while other directions continue.

Optional modules may remove at most 512 solid terrain blocks and at most 8% of their volume. A placed optional module needing more than 128 blocks or more than 2% carving ends that branch; descendants are skipped. Branch stops persist through reloads. Required side chambers retain their earlier carving allowance; the new keep itself is not carved.

Dragon Arena foundations follow the authored irregular ground base, with blackstone on the actual perimeter and netherrack inside. Empty bounding-box corners and raised overhangs receive no foundation. Mega foundations extend only under authored pier feet/chamber bases, leaving bridge decks suspended; non-core foundations use polished blackstone bricks. All fill only air/lava down to the first existing solid block, without excavation. Already generated older foundations are not removed or rebuilt.

## Small Arenas and ruins

Small Arenas spawn only in Basalt Deltas, using 600-block regions and multiple candidate sites. At most one completes per region; centers are at least 600 blocks apart. Their separate terrain policy permits uneven natural ground and limited footprint carving. Their frequency is not part of the three-way giant selection.

Ruins use 192-block regions: Grave Yard 8%, Large Blackstone Pillars 6%, Large Blackstone Walls 4%, no selection 82%. Grave Yards require Soul Sand Valleys; pillars/walls require Basalt Deltas or Nether Wastes. Ruin centers have 150-block separation, plus footprint spacing. These are regional selection chances, not guarantees that terrain permits placement.

## Spawners and encounters

All spawners in the three arenas and the Mega Fortress keep are native trial spawners. Piglin Brute is the default mob. An offline deterministic assignment sorts local X/Y/Z positions and assigns a Stray when two earlier Piglin Brute spawners are within 16 blocks in 3D. No runtime crowding scan is used.

| Build | Configured trial spawners | Ordinary spawners |
| --- | --- | --- |
| Small Arena | 8 | 0 |
| Large Arena | 26, including 4 originally imported trials | 0 |
| Dragon Arena | 13, including 3 originally imported trials | 0 |
| Mega Fortress keep | 5 | 0 |
| Other Mega modules, full source layout | 0 | 7; actual count depends on accepted branches |
| Grave Yard | 0 | 1 Wither Skeleton |
| Large Blackstone Pillars/Walls | 0 | 0 |

Nether trial spawners are protected against player breaking (including Creative) and explosions through before-action events. No continuous protection scan runs. Native trial blocks are non-pushable; operator commands/world editing can deliberately replace them. Protection applies to all Nether trial spawners, not just these templates. Ordinary module spawners, vaults and Overworld trial spawners retain their native behavior.

Edit `TRIAL_ENCOUNTERS.json` and rebuild to change encounter mobs/settings. One saved-revision comparison runs on world load. Changed encounter data triggers one finite, budgeted migration of recorded spawner locations, then stops. Stored positions are retained, new roles are reconciled at those positions, and mined/replaced blocks are not restored. Successful sites are checkpointed; failed sites retry on the next world load or an explicit command. Applying changed encounter data resets the affected native encounter/cooldown. No periodic mob, proximity or terrain update scan is added.

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
