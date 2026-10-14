# Lava fishing — current v0.2.102

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
reeling early gives nothing. A successful catch gives one item, 1.5× vanilla fishing XP and uses
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
cooked fish variants, potion items, fishing gear, hooks or fish buckets. The fishing subsystem adds the rod and seven catches. The five separate [buff foods](FOOD_BUFFS.md) use fish in their crafting recipes.

## Junk and treasure

Each catch rolls one category, then one entry within that category. Fish frequencies above are conditional on the fish category. All rewards have quantity one and use the existing item launch, XP and durability handling. Ordinary water fishing tables are unchanged. No new polling or entity scans are added.

| Junk item | Weight |
| --- | ---: |
| Wither Bone (existing Underworld item) | 12 |
| Gold Nugget | 10 |
| Damaged Golden Sword | 4 |
| Damaged Golden Boots | 4 |
| Iron Nugget | 10 |
| Fire Charge | 7 |
| Magma Cream | 8 |
| Redstone Dust | 10 |
| Nether Quartz | 10 |
| Cooked Porkchop | 10 |
| Charcoal | 9 |
| Bottle o’ Enchanting | 6 |

| Treasure item | Weight |
| --- | ---: |
| Blaze Powder | 30 |
| Enchanted Book | 24 |
| Golden Apple | 18 |
| Crying Obsidian | 16 |
| Damaged Enchanted Golden Sword | 12 |
| Wither Skeleton Skull | 5 |
| Lodestone | 4 |
| Netherite Scrap | 1 |

Junk weights total 100; treasure weights total 110. Golden equipment retains a uniformly randomized whole-number durability in the 10–40% range. Junk equipment is unenchanted. Treasure books and swords use native `enchant_with_levels` at level 30 with treasure enchantments enabled; native item compatibility and enchantment conflicts apply. No MineScape enchantments or relics are injected. Vanilla junk/treasure items retain their ordinary fire behavior, so verify the existing launch clears lava before pickup.

Live checks: obtain all 12 junk entries and all 8 treasure entries, inspect actual book/sword enchantments and equipment damage, verify Luck I–III category changes and one launched item per catch. Native loot generation and Content Log cleanliness require a Bedrock client; automated checks cannot establish them.

## Catch items and Bedrock differences

All seven fish are inventory catch items only. There are no living fish entities,
fish spawn eggs or natural fish spawning. The bobber is the only entity added
for fishing and is needed to display casts, the line and bite cues.

Bedrock cannot load the Java mod or its Aquaculture hooks. The cast uses native entity gravity and an impulse, followed by a lava-surface
anchor. The bobber uses the built-in vanilla fishhook geometry and texture;
the line uses a short-lived world-space particle curve. The controller does not hook/pull entities. Weather and
open-sky speed modifiers are not reproduced. The original rod/cast textures are
included, but the inventory icon does not switch while a cast is active.

Raw fish provide hunger and saturation only. The five crafted buff foods are implemented separately; see [FOOD_BUFFS.md](FOOD_BUFFS.md). Luck of the Sea changes category weights using vanilla quality modifiers: fish 85−level, junk 10−2×level, treasure 5+2×level, normalized by their total. It does not change relative fish weights. No open-water restriction is added to lava fishing.

## Required live checks

1. Import v0.2.102 and confirm both pack versions and the Content Log.
2. Craft the rod, cast/reel with mouse/controller/touch, and check held art,
   bobber, line, arc, dip, sound and bite timing. Native custom-item input needs
   live confirmation; automated mocks cannot validate it.
3. Test early reels, missed bites, Unbreaking, Lure, the 256th durability use,
   Creative, full inventory, death, disconnects, reloads and dimension changes.
4. Catch fish in all five Nether biomes and in Overworld lava. Check specialist
   catches stay in their correct biomes and each successful catch produces exactly one item.
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
