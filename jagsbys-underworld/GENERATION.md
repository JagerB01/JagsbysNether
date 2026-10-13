# Non-village generation — v0.2.57

Larger abandoned campgrounds and both Nether-brick outpost tower variants have
50% more placement attempts. Every individual tent’s marginal per-chunk attempt
probability is unchanged. Existing biome filters, floor searches, vertical ranges,
grounded/unburied/intersection constraints and structure templates are retained.
This affects newly generated chunks, not previously explored terrain.

| Category (in its eligible biome) | Old attempt chance per chunk | New chance |
| --- | --- | --- |
| Any abandoned-camp tent | 1.7361% | 1.7361% |
| Any larger campground | 1.3889% | 2.0833% |
| Any outpost tent (Nether Wastes) | 0.5208% | 0.5208% |
| Any outpost tower (Nether Wastes) | 0.5208% | 0.7813% |

Each of the five biome camp pools changes campsite weight 2 to 3 while retaining
tent weight 1. The pool’s roll rises from 1/32 to 11/288, compensating for the
changed proportions: tent probability stays 10/18 × 1/32 = 10/22 × 11/288.
The outpost pool uses tent weight 2 and tower weight 3, with its roll changing
from 1/96 to 5/384: tent probability stays 2/4 × 1/96 = 4/10 × 5/384.

These are attempts, not guaranteed successful placements. Terrain constraints
can reject a selected structure, and additional structures can affect available
space. Actual successful counts and appearance need a Bedrock terrain survey.
The scripted village planner, three-house minimum and village spacing are unchanged.

Village planning now prioritizes a first farm after three residential houses
fit. Both farm sizes are attempted ahead of other building choices until one
fits, while preserving terrain, collision and village-size checks. Farms still
do not count toward the three-house minimum, and blocked layouts may lack one.
This affects new generation only; existing villages are not modified.

New structure chests and barrels receive native randomized Nether loot. Each
container has 4–7 supply rolls (gold nuggets, quartz, bones, coal, string, leather,
glowstone dust, fungi, obsidian and soul torches), plus independent 12% gold
ingot and 4% crying obsidian chances. A single 5% planting-item roll selects Sorgum seeds, Murky Gourd seeds,
Scarberries or Polyps equally, giving 1–3 (1.25% per crop per container). No Nether Wart appears
in this table. Existing intentional container contents/loot tables are preserved.
Loot is attached to the template's native block-entity data; no scanning or
periodic refill script runs. Existing placed containers are not changed.
