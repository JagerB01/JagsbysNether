# Lava fishing — v0.2.6 playtest build

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
in an arc and floats on the surface, with a curved black particle line running back to the rod tip. Wait for it to
dip and splash, then use the rod again. No action-bar prompts accompany casting,
waiting or bites. The default
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

Bedrock cannot load the Java mod or its Aquaculture hooks. The cast uses native entity gravity and an impulse, followed by a lava-surface
anchor. The bobber uses the built-in vanilla fishhook geometry and texture;
the line uses a short-lived world-space particle curve. The controller does not hook/pull entities. Weather and
open-sky speed modifiers are not reproduced. The original rod/cast textures are
included, but the inventory icon does not switch while a cast is active.

The mod's custom food status effects are approximated without extra effect or
potion items: Agni keeps the eater burning; Steam Flying Fish lifts/supports the
eater at the lava surface unless sneaking. Java's unarmed fire-punch spreading
and lava mining-speed bonus are omitted. These timers use wall-clock expiry,
including across disconnects. Test movement carefully: Steam Flying Fish does
not grant Fire Resistance.

## Required live checks

1. Import v0.2.6 and confirm both pack versions and the Content Log.
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

Original fish/cast assets are byte-for-byte copies from `lavafishing-26.1.2-1.3.1-all.jar`.
`LAVA_FISHING_SOURCE.json` records its hash, imported asset hashes and scope.
The rod icon is the unchanged user-supplied 64×64 ObsidianFishingRod.png;
its override hash is recorded separately.
The original fish loot tables and rod recipe are included under
`behavior_pack/docs/lava_fishing/source_data/`. Fishing code, assets and the full
AGPLv3 license are bundled and attributed. Other subsystem licenses are retained.

## v0.2.6 revision and AdvancedFishing reference

The displaced custom held-rod model and pose animations have been removed.
The rod uses the ordinary flat held-item renderer with the tool flag and short use duration from the previously working rod
definition. Its icon is the user-supplied replacement PNG. No attachment, custom hand translation or custom hand scale is used.

AdvancedFishing by Renderphoenix and devsuki was inspected for its native-physics
cast, surface anchor and curved world-space particle-line approach. This build
implements those techniques in the existing fishing controller. It does not
bundle that add-on's code, textures, fish, gear, chum or loot tables.

The old crosshair targeting and fixed-duration teleported cast arc are removed.
A cast launches from in front of the player's head using a real entity impulse;
collision and gravity come from Bedrock. On reaching exposed lava, the bobber
settles on its surface and waits for a bite. The curved black line follows the
rod tip and hook. Cast/retrieve sound uses the vanilla player throw sound and
its volume/pitch range; landing and bites use the vanilla hook splash sound.
Routine fishing has no action-bar messages.

This is a scripted lava-fishing controller with vanilla visuals and cues, rather
than a replacement for Bedrock's native water-fishing implementation. Catches,
XP and durability retain the existing Java-derived rules. The original rod/cast
textures are present, but the custom item icon remains static. Held orientation,
particle-line continuity, cast feel and client sound still require a gameplay
check; automated tests cannot establish those visual results.

## v0.2.6 rod-definition rollback

The rod item definition is restored to its previously loading v0.2.2 form:
no added menu group or tags, a 0.05-second use duration and the working bow
use-animation value. This rollback removes the item-level changes from the
older AdvancedFishing reference while retaining its physics-cast approach.
The supplied PNG, vanilla bobber, particle line, fish pools and pack-only outer
archive are retained. Check the live Content Log to confirm item loading.
