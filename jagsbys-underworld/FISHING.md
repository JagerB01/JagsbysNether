# Lava fishing — v0.2.1 playtest build

Adapted from the supplied **Lava Fishing 1.3.1** Java mod by TeamSunset.
Enable both Jagsby's Underworld packs on Bedrock 1.21.100 or newer. No Beta APIs.
Use a disposable world for this first fishing test.

## Getting started

Craft the Obsidian Fishing Rod using this pattern at a crafting table:

```text
..O
.OS
T.S
```

`O` = obsidian, `S` = string, `T` = stick. The rod has 256 durability.
For a test rod and one of each catch, run:

```mcfunction
/scriptevent jagsby_nether:fishing_kit
```

Cast toward exposed lava within 32 blocks and use the rod to cast. The bobber travels
in an arc and floats on the surface, with a modeled fishing line. Wait for it to
dip, splash and display **Bite! Reel in!**, then use the rod again. The default
wait is 5–30 seconds plus a 1–4 second approach, followed by a 1–2 second catch
window. Lure reduces the waiting phase. Missing a bite restarts the wait;
reeling early gives nothing. A successful catch gives one fish, 1–6 XP and uses
one durability (Creative uses none; Unbreaking is respected).

Catches enter the inventory; when full, the remaining fish drops at the player's
feet. The rod and fish items resist fire/lava. Walking more than 32 blocks away,
switching rods or slots, leaving the dimension or disconnecting cancels the cast.
Water does not work with this scoped lava rod; ordinary fishing remains vanilla.

## Catches

The exact original nested fish weights are retained. Outside the Nether,
lava has Flame Squat Lobster (34), Obsidian Sword Fish (33) and Arowana Fish (33).
In the Nether, the base group has weight 30, Lava Lamprey and Quartz Fish have
weight 12 each, and the applicable biome-specialist entries below join the pool.
The biome is read at the bobber, independently of village styles or nearby blocks.

| Catch | Availability | Raw food behavior |
| --- | --- | --- |
| Flame Squat Lobster | Any lava | 1 hunger; Resistance 20 seconds; burns eater 5 seconds |
| Obsidian Sword Fish | Any lava | 2 hunger; Fire Resistance 15 seconds |
| Arowana Fish | Any lava | 2 hunger |
| Lava Lamprey | Nether lava | 2 hunger |
| Quartz Fish | Nether lava | 2 hunger |
| Agni Fish | Crimson/warped forest lava; specialist weight 10 | 2 hunger; Endless Flame approximation 120 seconds |
| Steam Flying Fish | Soul sand valley lava; specialist weight 12 | 2 hunger; Lava Walker approximation 15 seconds |
| Scaly Foot Snail | Basalt delta lava; specialist weight 12 | 1 hunger |
| Yeti Crab | Basalt delta lava; specialist weight 12 | 1 hunger |

Raw foods use the original 0.1 saturation modifier. There are no additional
cooked foods, recipes, potion items, fishing gear, hooks, fish buckets, junk or
treasure. Only the rod and nine catch items are added.

## Catch items and Bedrock differences

All nine fish are inventory catch items only. There are no living fish entities,
fish spawn eggs or natural fish spawning. The bobber is the only entity added
for fishing and is needed to display casts, the line and bite cues.

Bedrock cannot load the Java mod or its Aquaculture hooks. Casting checks lava blocks directly and supports a forward,
falling arc and a custom bobber/line; it does not hook/pull entities. Weather and
open-sky speed modifiers are not reproduced. The original rod/cast textures are
included, but the inventory icon does not switch while a cast is active.

The mod's custom food status effects are approximated without extra effect or
potion items: Agni keeps the eater burning; Steam Flying Fish lifts/supports the
eater at the lava surface unless sneaking. Java's unarmed fire-punch spreading
and lava mining-speed bonus are omitted. These timers use wall-clock expiry,
including across disconnects. Test movement carefully: Steam Flying Fish does
not grant Fire Resistance.

## Required live checks

1. Import v0.2.1 and confirm both pack versions and the Content Log.
2. Craft the rod, cast/reel with mouse/controller/touch, and check held art,
   bobber, line, arc, dip, sound and bite timing. Native custom-item input needs
   this first live confirmation; automated mocks cannot validate it.
3. Test early reels, missed bites, Unbreaking, Lure, the 256th durability use,
   Creative, full inventory, death, disconnects, reloads and dimension changes.
4. Catch fish in all five Nether biomes and in Overworld lava. Check specialist
   catches stay in their correct biomes and every successful catch is a fish.
5. Inspect all nine fish item textures and raw food/effects. Confirm there are
   no fish spawn eggs or naturally spawning lava fish.
6. Retest village generation, villager compatibility, wart replacements and
   agriculture; the existing crop/village systems remain included.

Automated behavior/asset validation passes do not establish that this prototype
imports, casts, renders or behaves correctly in the Bedrock client.

## Source and license

Original assets are byte-for-byte copies from `lavafishing-26.1.2-1.3.1-all.jar`.
`LAVA_FISHING_SOURCE.json` records its hash, imported asset hashes and scope.
The original fish loot tables and rod recipe are included under
`behavior_pack/docs/lava_fishing/source_data/`. Fishing code, assets and the full
AGPLv3 license are bundled and attributed. Other subsystem licenses are retained.
