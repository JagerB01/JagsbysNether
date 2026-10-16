# Jagsby's Underworld v0.2.112

Underworld combines Nether villages and structures, agriculture, lava fishing, Skitterchests, Hongos and crafted food buffs in one `.mcaddon` containing one behavior pack and one resource pack. It uses stable `@minecraft/server` 2.10.0 and requires Bedrock 26.50 or newer; the target playtest version is 26.52. Beta APIs are not required.

## Installation and upgrades

Activate **Jagsby's Underworld v0.2.112 Behavior** and **Resources** together. Disable the separate Nether Settlements and Nether Agriculture packs to avoid duplicate scripts. The supplied cover is included in both packs.

Test upgrades on a copy of your world. Updates within Underworld retain its behavior/resource pack UUIDs, item identifiers and saved world records. Existing structures are not rebuilt to change their foundations, crops or village size. Encounter-data updates can update recorded trial-spawner locations once without rebuilding structures.

The original standalone Settlements/Agriculture packs used different UUIDs. Their old script-owned village indexes do not automatically transfer to Underworld, even though existing blocks and entities remain recognizable. This distinction does not apply to normal updates between Underworld releases.

Food bonuses require the supplied **MineScape v1.5.18 + Underworld Food Buffs** compatibility behavior pack, plus MineScape's original resource pack. That compatibility BP replaces the original MineScape BP rather than running alongside a second copy. See [FOOD_BUFFS.md](FOOD_BUFFS.md). Conquest & Commerce v1.1.0 can remain enabled; Underworld does not override its villager definition or trades.

## Current features

- **Glowsquitos and Glowhusks:** native flying/breeding/fungus goals, scripted persistent colony occupancy, manual Glow Wax shearing and gunpowder crafting. Hive/wax artwork is temporary; dispenser shearing and occupied Silk Touch relocation are unsupported. See [GLOWSQUITO.md](GLOWSQUITO.md).

- **Villages:** at least four residential houses and one small farm must fit before anything is placed. Centers are at least 256 blocks apart. Targets remain 6–8, 9–11 or 12–14 homes, subject to terrain. Large farms are removed. Actual biomes select the village style and crops; villagers retain native behavior and can use Sorgum/Polyps as breeding food. See [GENERATION.md](GENERATION.md) and [VILLAGER_FOOD.md](VILLAGER_FOOD.md).
- **Natural landmarks:** Small Arenas spawn only in Basalt Deltas. Large Arena, Dragon Arena and Mega Fortress have equal giant-selection chances after all three starting layouts qualify, surveying the largest footprint first. Initial footprints require 90% lava coverage; Dragon Arena coverage follows its irregular authored base. Ordinary Nether terrain can be carved within building space. Mega Fortress starts with its keep and expands through connected modules. See [ARENAS.md](ARENAS.md).
- **Arena encounters:** arena and Mega keep/lower-chamber trial spawners use Piglin Brutes, with Strays assigned where two Brute spawners are already within 16 blocks. Other fortress modules retain ordinary spawners. Nether trial spawners are protected by break/explosion events. Encounter changes use one revision comparison on world load and a finite migration of recorded locations; there is no periodic protection or crowding scan.
- **Agriculture:** planted soil grows crops without lava; lava heating improves growth. Empty fully cooled plots revert after about 30 loaded seconds. Native tilling and Wither Bone Meal handlers remain.
- **Lava fishing:** one Obsidian Fishing Rod, seven fish, biome-specific specialist catches, launched catch items, hunger/saturation without raw-fish effects, and 1.5× vanilla fishing XP. Catches use vanilla category weights: 85% fish, 10% junk and 5% treasure before Luck of the Sea. See [FISHING.md](FISHING.md).
- **Skitterchests and Hongos:** tamed Crimson/Warped Skitterchests have native 27-slot storage; standing opens it and crouching toggles sitting. Matching tamed Hongos deposit nuggets only into sitting tamed chests. Owners may differ. Warped produces gold every 25–35 seconds; Crimson produces iron every 40–60 seconds while loaded. See [SKITTERCHESTS.md](SKITTERCHESTS.md) and [HONGOS.md](HONGOS.md).
- **Food buffs:** five crafted foods, stack size 16, one active 20-minute buff, doubling selected MineScape primary percentage bonuses. See [FOOD_BUFFS.md](FOOD_BUFFS.md).
- **Soul lights:** new hostile spawns are checked against soul torches (12 blocks), lanterns (16) and lit campfires (20). Rejected mobs are removed after spawning without loot/XP; existing mobs remain. See [SOUL_LIGHTS.md](SOUL_LIGHTS.md).

## Useful commands

```mcfunction
/scriptevent jagsby_nether:kit
/scriptevent jagsby_nether:fishing_kit
/scriptevent nether_settlements:test crimson
/scriptevent nether_settlements:test warped
/scriptevent nether_settlements:find village
/scriptevent nether_settlements:status
/scriptevent jagsby_nether:template list
/scriptevent jagsby_nether:structures_status
/scriptevent jagsby_nether:structures_diagnostics
/scriptevent jagsby_nether:structures_find
/scriptevent jagsby_nether:encounters_status
/scriptevent jagsby_nether:food_buff_status
```

Use `/scriptevent nether_settlements:find village` to find a recorded Nether village; vanilla `/locate` does not index these scripted villages. Manual placement commands and older manual-spawner registration are documented in [ARENAS.md](ARENAS.md).

## Build and validation

From the project directory:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 tools/build.py
```

The builder merges the retained standalone archives, applies the authorized village/crop/block/loot changes, bakes native trial encounters, validates references and runs Python and Node tests. It writes `../downloads/Jagsbys_Underworld_v0.2.112.mcaddon`; merged inspection files are under ignored `.build/behavior_pack` and `.build/resource_pack`.

The original square cover must be at `pack_icon.png`. `--allow-placeholder-icon` is for local verification only and does not publish a release download. Original source references, credits and licenses remain bundled; see [CREDITS.txt](CREDITS.txt).

The v0.2.112 gameplay build passed **458 automated checks**. These do not verify native client rendering, natural encounter frequency, trial activation, vault rewards or frame-rate impact. Follow [TESTING.txt](TESTING.txt) and use fresh CPU profiles; [PERFORMANCE.md](PERFORMANCE.md) distinguishes script measurements from FPS. No Bedrock client is available in this workspace.

## Infernal Lords integration test

v0.2.108 adds Malzareth, Nerezhal, Baelgor, the Ashen Tower Wraith, Crimson
Necromancer and scoped original enchanted-mob handlers. Use Underworld alone;
disable the original Dungeons and five-mob test packs. Dormant bosses now appear once in new matching giant structures and new manual
template placements; existing structures are not backfilled. See [INFERNAL_LORDS.md](INFERNAL_LORDS.md) for commands, dependency
scope, future enchanted-variant API and required combat/HUD/audio tests. Full
in-game acceptance is pending; offline checks do not establish combat readiness.

v0.2.109 adds guaranteed Withered Heart / Weeping Soul / Ruinous Ember boss
drops with temporary boss-key icons, awaiting custom artwork.

For testing, `/scriptevent jagsby_nether:next_giant mega_fortress` guarantees the next eligible new natural giant type. Alternatives: `dragon_arena`, `large_arena`, `status`, `clear`. Failed surveys keep the choice. See [ARENAS.md](ARENAS.md).

v0.2.110 repairs boss teleport/casting and Nether ability compatibility, adds native fire/lava immunity to all three bosses, and compares up to three giant sites before placement. See [INFERNAL_LORDS.md](INFERNAL_LORDS.md) and [ARENAS.md](ARENAS.md).

v0.2.111 brings the necromancer projectile and Tower Wraith spell opening hits to 14 raw damage on Hard, with weaker lingering pulses. See the arena caster balance table in [INFERNAL_LORDS.md](INFERNAL_LORDS.md).

v0.2.112 makes Small Arena terrain checks, carving and foundations follow its authored outline, chooses a ground-fitting height and limits foundations to six blocks. Grollet seeds and plantable Scarberries are now exclusive Small Arena chest finds. See [ARENAS.md](ARENAS.md).
