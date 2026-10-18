# Jagsby's Underworld v1.0.0

Underworld combines Nether villages and structures, agriculture, lava fishing,
Skitterchests, Hongos, Glowsquitos, food buffs and Infernal Lords in one `.mcaddon`
with one behavior pack and one resource pack. It uses stable `@minecraft/server`
2.10.0, requires Bedrock 26.50 or newer, and targets Bedrock 26.52. No Beta APIs
are required.

## Realm installation and upgrades

Activate **Jagsby's Underworld v1.0.0 Behavior** and **Resources** together.
Pack UUIDs, item/entity identifiers and saved world records are unchanged. Existing
structures are not rebuilt. In-progress generation and storage records remain.
A leftover forced giant test choice is cleared once on the first v1.0.0 load.

Disable separate Nether Settlements/Agriculture and original Dungeons/five-mob
packs where Underworld supplies the same content. Conquest & Commerce v1.1.0 can
remain active; Underworld does not override its villager definition or trades.

Food skill bonuses require `MineScape_v1.5.18_Underworld_Food_Buffs.mcpack` and
MineScape's original RP. Use the compatibility BP instead of a second original
MineScape BP. Its UUID/progression remain unchanged; see [FOOD_BUFFS.md](FOOD_BUFFS.md).
Standalone Settlements indexes used different UUIDs and do not automatically
transfer; ordinary Underworld updates preserve Underworld records.

## Features

- Villages require at least four houses and one small farm, with 256-block center
  spacing. Native villagers support Nether crop farming and breeding food.
- Small Arenas spawn only in Basalt Deltas. All three giants have equal selection
  after eligibility comparison. Giant starting footprints require 90% lava coverage;
  Dragon Arena follows its irregular base, and Mega Fortress expands in modules.
- Arena/keep trials select 25% Wraith family, 25% Necromancer and 50% Brute. Each
  trial caster rolls 33% enchanted; Brutes stay normal. Optional fortress modules
  retain ordinary spawners. Native Nether trials have event-based break protection.
- Malzareth, Nerezhal and Baelgor awaken in their matching structures. Nerezhal's
  Frozen Zombie summons and Baelgor's Blaze summons are always enchanted.
- Nether crops, lava heating, Wither Bone Meal, structure loot and recipes remain.
- Lava fishing provides seven fish, biome specialists, junk/treasure and 1.5x XP.
  Raw fish restore hunger/saturation without scripted food effects.
- Tamed Crimson/Warped Skitterchests open native storage while standing; crouching
  toggles sitting. Matching tamed Hongos deposit nuggets into sitting chests.
- Glowsquitos use Glowhusks to produce Glow Wax. Hive/wax artwork remains temporary;
  dispenser shearing and occupied Silk Touch relocation are unsupported.
- Five crafted foods stack to 16 and double selected MineScape primary skill bonuses
  for 20 minutes, with one active food buff at a time.
- Soul torches, lanterns and lit campfires suppress new hostile spawns nearby.

## Release cleanup and operator tools

Boss tracing and damage measurements are off by default. Their diagnostic hurt
listeners exist only while explicitly enabled. Startup test notices and the obsolete
compile-time giant override are removed. Gameplay safeguards, error reporting,
save migrations and recovery remain. Current admin/status/test commands are retained
in [OPERATIONS.md](OPERATIONS.md); prior development history stays in the repository.

## Build and verification

```sh
PYTHONDONTWRITEBYTECODE=1 python3 tools/build.py
```

The builder validates assets and runs Python/Node checks before producing
`../downloads/Jagsbys_Underworld_v1.0.0.mcaddon`. Source inspection files are under
ignored `.build/`. The original `pack_icon.png` is required for release builds.
Automated tests and build tools stay in the repository, outside the playable packs.
Original source references, credits and licenses remain bundled; see [CREDITS.txt](CREDITS.txt).

The release has **516 automated checks**. Native trial completion, actual combat
health loss, rendering and Realm performance still require in-game verification;
no Bedrock client is available in this workspace. [TESTING.txt](TESTING.txt) keeps
the regression checklist, and [PERFORMANCE.md](PERFORMANCE.md) describes scheduling.
