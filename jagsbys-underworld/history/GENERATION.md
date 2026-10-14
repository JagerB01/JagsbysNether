# Historical documentation snapshot

This preserves earlier release notes through v0.2.101. Descriptions below may be superseded; use the [current guide](../GENERATION.md) for active behavior.

---

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

## Extended village search — v0.2.66

Automatic village generation can now inspect eligible regions up to 768 blocks
from a Nether player. The existing terrain-ranked survey of loaded nearby sites is retained.
When it has no eligible site, the planner tries a farther region; there is no
minimum distance band. Existing terrain scoring and the three-house requirement remain
in effect. One candidate at a time is temporarily loaded in a 113×113-block
survey footprint (at most 64 chunks), then fully planned before placement.
Failed sites stay eligible with a ten-minute retry cooldown; new attempts start
no more often than every 30 seconds. Owned temporary areas are released after
completion/failure. This extends reach; it does not guarantee distant placement
or remove visible construction for nearby eligible sites.

The stable server 2.10 API's ticking-area load promise confirms completion before
block probes and placement. Command fallback requests preload and waits for
actual availability up to 30 seconds. API areas left after a world closes mid-job
and tracked fallback command areas are cleaned on the next startup.

## Village retry correction — v0.2.67

A player inside the temporary survey square no longer rejects the whole site;
only actual building footprints must clear players. Each automatic search can
try eight terrain-ranked local sites and two remote regions before giving up.
Failed local sites have a one-minute per-cell cooldown, not a ten-minute ban on
the whole region. Failed remote region probes retry after two minutes. The
scheduler checks every five seconds while idle, keeping one search job active.
Loaded local sites retain their surveyed floor height.

Use `/scriptevent nether_settlements:status` in the Nether to see whether the
search is loading, planning, idle, or rejected because insufficient houses fit.
The three-house requirement, terrain checks and existing village spacing remain.

## Residential growth — v0.2.68

Village targets now count residential houses only: small 6–8, medium 9–11,
large 12–14. One farm and up to two other amenities have separate slots. Roads
with building entrances are preferred, with longer branches and 40/48/56-block
layout radii. Farms are prioritized after three homes fit; the planner continues
trying for a first farm even after reaching its residential target. Terrain can
still prevent a farm or truncate a village; the minimum remains three homes.

Remote survey footprints grow to 145×145 blocks, covering layout radius plus
site offsets while touching at most 100 Bedrock chunks. Changes affect new
villages only; existing villages are not expanded or rebuilt.

## Performance and durable unsuitable sites — v0.2.69

See PERFORMANCE.md for the profile findings, per-plan terrain caching, bounded
job scheduling, and permanent area-based terrain rejection. Village layouts
and size targets are unchanged. Rejected areas do not become eligible through
mining; incomplete or player-blocked assessments are not permanent rejections.

## Regional village comparison — v0.2.74

Automatic searches compare up to six distinct regions before placing any village: up to two strong loaded sites plus candidates distributed across the 0–768-block search range. Every comparison area is temporarily loaded and assessed for connected terrain, building headroom and slope. Completed assessments are retained in a bounded 512-entry cache; full layouts and final placements still read current terrain. Equal-quality areas use deterministic seeded ordering, not player distance or loaded-first preference. No portal exclusion radius is added.

Only fully assessed absence of floor is persisted as unsuitable. Incomplete comparison data/loading errors defer that region and prevent placement during that comparison batch. Cached completed comparisons do not reload their footprints; construction still loads and verifies the selected area. The selected area still uses the existing detailed village planner and three-house minimum; failed layouts can fall back to the next compared area. The shared queue and per-tick budget remain. Comparison adds some initial wait, with loading and comparison counts shown in status.

Version 0.2.94 requires at least four residential houses and one farm before any village blocks are placed. Farm templates use soul soil instead of soul sand; planted crops use soul-soil farmland. New village centers must be at least 256 blocks from recorded villages. Existing villages are not rebuilt.

Version 0.2.95 removes the Crimson and Warped large-farm templates and all their pool/feature entries. Villages still require four residential houses and a farm, using the small-farm template.
