# Villages, camps and structure loot — current v0.2.101

For arenas, ruins and Mega Fortress generation, see [ARENAS.md](ARENAS.md). This page describes the current village and original camp/outpost systems. Earlier generation revisions are preserved in [history/GENERATION.md](history/GENERATION.md).

## Village eligibility and size

A complete layout must fit **at least four residential houses and one farm** before the first world write. Insufficient layouts place no center, roads, houses, villagers or crops. Farm/amenity buildings do not count as residential houses. Only the small farm remains in the pools; Crimson/Warped large-farm templates and their feature entries are removed.

Village targets are small 6–8, medium 9–11 and large 12–14 residential houses, with a separate farm and up to two other amenities. Terrain can reduce those targets, but cannot bypass the four-house/one-farm minimum. New village centers must be **256 blocks apart**, including separation from older recorded villages. Existing villages are not expanded or rebuilt.

Nether Wastes and Crimson Forest select Crimson style; Warped Forest and Soul Sand Valley select Warped style. Native biome queries classify locations, rather than decorative surface blocks. Original style fallback remains for unavailable biome queries.

## Surveying and performance

Eligible sites can be considered from nearby terrain out to 768 blocks from a Nether player. Searches compare up to six distinct regions before detailed planning; equal-quality areas use seeded ordering rather than preferring the first loaded area or a portal. There is no minimum distance band or guaranteed out-of-view placement.

A remote village comparison area is 145×145 blocks, within Bedrock's 100-chunk temporary ticking-area limit. Chunk loading awaits actual availability and times out after 30 seconds. Comparison results and per-plan terrain reads are bounded caches; final layouts revalidate current blocks. Villages, landmarks and manual templates share a budgeted job queue (up to 24 generator steps/about 2 ms per callback). Temporary areas are released when work finishes or fails.

Fully assessed unsuitable areas are persisted as horizontal footprints, so excavating them later does not make them eligible. Unloaded/incomplete assessments and temporary player/loading interruptions defer rather than permanently fail. Evaluation is based on the whole layout, not independent chunk suitability. See [PERFORMANCE.md](PERFORMANCE.md) for measurement history and limits.

## Crops and residents

Village redstone torches become soul torches. Farm soul sand becomes soul soil; planted positions become custom soul-soil farmland. Former Nether Wart plant spots receive Sorgum in Crimson Forest/Nether Wastes and Polyps in Warped Forest/Soul Sand Valley, using each planting position's actual biome. Other unsupported biomes and standalone structures remain wart-free without replacement crops. Nether-wart building blocks remain intact.

One native villager is placed per residential house. Roads, centers and amenities add no residents. Definitions, trades and ordinary movement remain supplied by Minecraft or Conquest & Commerce. No village-boundary return behavior was added. Adult farmers harvest/replant nearby ripe custom crops during working hours; this does not add pathfinding to distant fields. See [VILLAGER_FOOD.md](VILLAGER_FOOD.md).

## Original camp/outpost attempts

These native feature rules affect newly generated chunks; they are separate from scripted village/landmark surveys. Larger campgrounds and outpost towers receive 50% more placement attempts while individual tent rates remain unchanged.

| Category in an eligible biome | Current attempt chance per chunk |
| --- | --- |
| Any abandoned-camp tent | 1.7361% |
| Any larger campground | 2.0833% |
| Any outpost tent in Nether Wastes | 0.5208% |
| Any outpost tower in Nether Wastes | 0.7813% |

These are placement attempts, not guaranteed successful structures; terrain restrictions still apply. The original pools and probability calculations are retained in the historical guide.

## Container loot

New template chests/barrels use native randomized Nether loot: 4–7 supply rolls (gold nuggets, quartz, Wither Bones, coal, string, leather, glowstone dust, fungi, obsidian and soul torches), plus independent 12% gold-ingot and 4% crying-obsidian rolls. One 2.5% planting-item roll chooses Sorgum seeds or Polyps equally, giving 1–3 items (1.25% per crop per container). Grollet seeds and plantable Scarberries are exclusive to Small Arena chest loot, with an independent 5% roll for each, giving 1–2 items. Wild-sprout Grollet and crimson-root Scarberry starter drops are removed; cultivation harvests remain. Nether Wart is excluded.

Additional independent rolls per container/half: Fire Resistance potion (3 minutes) **20%**, diamonds **5%** (1–2), golden apple **3%** (1), gold block **3%** (1), netherite scrap **1%** (1). One **12%** ominous-bottle roll picks tiers I/II/III/IV/V with relative weights 40/30/18/9/3, for overall chances of 4.8% / 3.6% / 2.16% / 1.08% / 0.36% respectively. Potion type and bottle amplifier use native Bedrock loot functions.

Double-chest halves retain separate native loot tables and reciprocal native `pairx`/`pairz`/`pairlead` metadata. Layout-aware offline repair handles partners across placement tiles, and slicing translates partner coordinates with the chest. Both 27-slot halves are configured for loot; native opening/merging still needs a Bedrock live check. The change adds no runtime container scanner or refill handler. Pairing repairs apply to newly placed templates; already rolled/looted inventories are preserved.

Intentional original container contents/loot tables are preserved. Existing placed containers are not refilled. No periodic container scanner runs. End-game arena-specific loot and imported Java vault rewards remain separate unfinished work.

## Commands

```mcfunction
/scriptevent nether_settlements:test crimson
/scriptevent nether_settlements:test warped
/scriptevent nether_settlements:find village
/scriptevent nether_settlements:status
```

Manual village tests use the same minimum layout requirements. `/find village` reports recorded villages; vanilla `/locate` does not find this scripted village index.

### v0.2.113 hanging lava

Active carving removes source and flowing lava inside each placement volume above the surveyed ground/ocean level. It preserves the ocean at/below that level and lava outside the volume. Adjacent external sources can still flow in. This uses filtered writes during generation, with no idle fluid scanning, and does not repair existing arenas.
