# Lava fishing — current v0.2.101

Adapted from the supplied **Lava Fishing 1.3.1** Java mod by TeamSunset.
Enable both Jagsby's Underworld packs on Bedrock 26.50 or newer. No Beta APIs.
Use the [current testing checklist](TESTING.txt) for live checks.

## Getting started

Craft the Obsidian Fishing Rod using this pattern at a crafting table:

```text
..O
.BS
O.C
```

`O` = obsidian, `B` = blaze rod, `S` = string, `C` = crying obsidian. The rod has 256 durability.
For a test rod and one of each catch, run:

```mcfunction
/scriptevent jagsby_nether:fishing_kit
```

Cast toward exposed lava within 32 blocks and use the rod to cast. The bobber travels
in an arc and floats on the surface, with a curved black particle line running back to the rod tip. Wait for it to
dip and splash, then use the rod again. No action-bar prompts accompany casting,
waiting or bites. The default
wait is 5–30 seconds plus a 1–4 second approach, followed by a 1–2 second catch
window. Lure reduces the waiting phase. Missing a bite requires reeling in and casting again;
reeling early gives nothing. A successful catch gives one fish, 1.5× vanilla fishing XP and uses
one durability (Creative uses none; Unbreaking is respected).

Catches are launched from the bobber toward the player for normal item pickup. The rod and fish items resist fire/lava. Walking more than 32 blocks away,
switching rods or slots, leaving the dimension or disconnecting cancels the cast.
Water does not work with this scoped lava rod; ordinary fishing remains vanilla.

## Catches

Outside the Nether, Calderwyrm has weight 60 (70.6%) and Jetrapier weight 25
(29.4%). In the Nether, these two have the same weights, plus exactly one
matching biome fish at weight 13: 61.2% Calderwyrm, 25.5% Jetrapier, 13.3%
biome fish. Unknown/timed-out Nether biomes use only the two common fish.
The biome is read at the bobber, independently of village styles or nearby blocks.

| Catch | Availability | Raw food behavior |
| --- | --- | --- |
| Jetrapier | Any lava | 2 hunger |
| Calderwyrm | Any lava | 2 hunger |
| Prismfin | Nether Wastes only | 2 hunger |
| Wickerel | Crimson Forest only | 2 hunger |
| Lava Lamprey | Warped Forest only | 2 hunger |
| Gloamwing | Soul Sand Valley only | 2 hunger |
| Ashrime | Basalt Deltas only | 1 hunger |

Raw foods use the original 0.1 saturation modifier. There are no additional
cooked fish variants, potion items, fishing gear, hooks, fish buckets, junk or
treasure. The fishing subsystem adds the rod and seven catches. The five separate [buff foods](FOOD_BUFFS.md) use fish in their crafting recipes.

## Catch items and Bedrock differences

All seven fish are inventory catch items only. There are no living fish entities,
fish spawn eggs or natural fish spawning. The bobber is the only entity added
for fishing and is needed to display casts, the line and bite cues.

Bedrock cannot load the Java mod or its Aquaculture hooks. The cast uses native entity gravity and an impulse, followed by a lava-surface
anchor. The bobber uses the built-in vanilla fishhook geometry and texture;
the line uses a short-lived world-space particle curve. The controller does not hook/pull entities. Weather and
open-sky speed modifiers are not reproduced. The original rod/cast textures are
included, but the inventory icon does not switch while a cast is active.

Raw fish provide hunger and saturation only. The five crafted buff foods are implemented separately; see [FOOD_BUFFS.md](FOOD_BUFFS.md). Junk and treasure remain unimplemented. Luck of the Sea does not substitute extra biome-fish chances for those missing loot categories.

## Required live checks

1. Import v0.2.101 and confirm both pack versions and the Content Log.
2. Craft the rod, cast/reel with mouse/controller/touch, and check held art,
   bobber, line, arc, dip, sound and bite timing. Native custom-item input needs
   live confirmation; automated mocks cannot validate it.
3. Test early reels, missed bites, Unbreaking, Lure, the 256th durability use,
   Creative, full inventory, death, disconnects, reloads and dimension changes.
4. Catch fish in all five Nether biomes and in Overworld lava. Check specialist
   catches stay in their correct biomes and every successful catch is a fish.
5. Inspect all seven fish item textures and raw hunger/saturation. Confirm there are
   no fish spawn eggs or naturally spawning lava fish.
6. Retest village generation, villager compatibility, wart replacements and
   agriculture; the existing crop/village systems remain included.

Automated behavior/asset validation passes do not establish that the addon
imports, casts, renders or behaves correctly in the Bedrock client.

## Source and license

Original fish/cast assets are byte-for-byte copies from `lavafishing-26.1.2-1.3.1-all.jar`.
`LAVA_FISHING_SOURCE.json` records its hash, imported asset hashes and scope.
The rod icon is the unchanged user-supplied 64×64 ObsidianFishingRod.png;
its override hash is recorded separately.
The original fish loot tables and rod recipe are included under
`behavior_pack/docs/lava_fishing/source_data/`. Fishing code, assets and the full
AGPLv3 license are bundled and attributed. Other subsystem licenses are retained.


See [historical fishing revisions](history/FISHING.md) for earlier animation, input and asset changes.
