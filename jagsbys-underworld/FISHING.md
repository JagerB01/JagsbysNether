# Lava fishing — v0.2.56 playtest build

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
window. Lure reduces the waiting phase. Missing a bite requires reeling in and casting again;
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

1. Import v0.2.56 and confirm both pack versions and the Content Log.
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

## v0.2.7 lava bite cues

The approaching fish leaves a trail of vanilla lava sparks instead of water
bubbles. Arrival triggers a twelve-spark plume above the lava and a deeper
bobber dip. Cast landing also uses a lava spark. Sounds, rod artwork, casting
physics and catch rules are unchanged. Verify these visuals in Minecraft.

## v0.2.8 successful catch sound

A successful catch plays a lava pop with a short, higher-pitched sizzle at
the player. Empty reels and missed bites do not play the catch cue. The
existing cast, splash and reel sounds are retained. The simulated line is
unchanged; the native fishing-line connection has no supported custom-rod API.

## v0.2.9 shoulder release and rod swing

The cast releases above the rod-side shoulder, rather than dropping its
origin toward the chest when aiming down. A brief rotation-only animation
swings the rod arm and item on cast and reel; no held-item model, pivot, scale
or position override is added. Current catch sounds and spark effects remain.
Check the swing in first and third person in Minecraft, including custom skins.

## v0.2.10 cast swing and thrown catches

The short use animation now overrides earlier bone animation and drives the
vanilla first-person swing variables on a dedicated runtime controller. This
is a gameplay candidate for the still-static first-person rod; verify it in
Minecraft, since mocked tests cannot establish native item-renderer motion.
Successful catches spawn one fire-resistant fish item above the bobber and
launch it toward the player with the vanilla-style distance-scaled impulse.
Items use normal world pickup, including when the inventory is full.

## v0.2.11 fishing enchantments

The rod retains the native fishing_rod enchantment slot (enchantability 9).
Lure I–III subtract five seconds per level from each waiting phase, with a
one-second minimum. Unbreaking I–III use the native durability chance.
Catch XP now spawns as one to six native XP orbs instead of directly crediting
the player, allowing native Mending to select and repair eligible equipment.
Luck of the Sea remains accepted without changing fish weights: its vanilla
fish/junk/treasure role is reserved for the planned junk and treasure pools.
Curse of Vanishing is left to native death/drop handling.

Automated checks cover Lure waits, Unbreaking level forwarding and catch orb
spawning. In-game verification is still required for anvil/table acceptance,
actual Mending repair and Curse of Vanishing on death (keepInventory false).
Hold a damaged Mending rod when collecting catch XP; other eligible Mending
equipment may receive the repair instead, as in vanilla.

## v0.2.12 first-person use and line attachment playtest

Live feedback confirms thrown catches and third-person arm motion work.
The remaining first-person motion candidate uses the native spear use
animation for a short 0.3-second window instead of the 0.05-second bow use.
The script-only attack-time variable override is removed; third-person
rotation animation is retained. No attachable or held geometry is added.
The line anchor moves 0.28 blocks lower and 0.20 blocks further to the rod
side, with a smaller pitch offset, to bring it away from the face toward
the held tip. Native first-person use and tip alignment require gameplay
verification. Catch launching, XP orbs and sounds remain unchanged.

## v0.2.13 held rod animation and grip playtest

A new rod attachable renders the unchanged user PNG as a thin sprite.
Its equipment-bound pivot is at [0,24,0], with the handle pixel (8,56) at
that pivot; this avoids the old zero-height binding that placed it at the feet.
The third-person hold turns the sprite around the vertical axis while leaving
its hanging line vertical. A first-person-only controller plays a 0.35-second
back-and-forward swing when the native cooldown is active. The script starts
that cooldown explicitly on accepted use. Supported since 1.20.60,
query.cooldown_time_remaining supplies the client animation trigger; the
short native bow use definition is restored. Third-person player arm swing
is retained. Inventory PNG, catches, sounds and enchantments are unchanged.

The particle line anchor moves further to the rod side and forward. It
remains an approximation: Script API does not expose rendered bone locators.
Verify the new grip, first-person visibility, motion, enchantment glint and
line connection in Minecraft. Automated tests cannot establish these visuals.

## v0.2.14 held rotation adjustment

Live feedback confirms the grip and first-person casting motion work.
Only the held sprite yaw is adjusted: third-person yaw turns from 180 to
90 degrees to put the shaft forward, while first-person yaw turns from 0
to 45 degrees to show the flat sprite face. These are separate view poses.
Handle pivot, model position, scale and cooldown swing are unchanged.
Verify visibility and direction in both views in Minecraft.

## v0.2.15 held position adjustment

Live feedback confirms the grip and rotation, but shows the third-person
rod above the hand and most of the first-person rod below the view.
Only view-specific hold translations change: third-person [0,-6,0] model
units and first-person [-3,6,-2]. The rotation, handle pivot, texture, scale
and casting motion are preserved. Verify hand placement and first-person
visibility in Minecraft; pose translations are a visual playtest.

## v0.2.16 pose correction

Third-person hold is raised one model unit from -6 to -5, keeping the
accepted yaw and grip. First-person lateral/depth shifts are removed; its
local Y offset changes to -4 and its pitch to -45 degrees to tilt the shaft
into view. The former positive local-Y adjustment hid the sprite; local
equipment axes must not be treated as camera/world axes. The first-person
yaw, texture and cooldown swing remain unchanged. Verify both poses in-game.

## v0.2.17 approved first-person preview pose

Applies the user-approved first-person preview exactly: rotation [147,30,21]
and position [0,-4,0], read from previews/rod-placement/preview-settings.json.
Third-person rotation [0,90,0] and position [0,-5,0] are retained. Grip pivot,
PNG, cooldown cast/reel swing, catch launching and enchantments are unchanged.
The editor preview is an approximation, so Minecraft remains the final check.

## v0.2.18 vanilla-comparison placement

First-person rotation [164.13,24.4,45.71] and position [1.42,1.92,2.67]
were fitted in the editor preview to the vanilla screenshot shaft-tip and
grip positions. A face-visibility constraint avoids turning the thin sprite
edge-on just to satisfy the two screen coordinates. Third-person yaw remains
90 degrees, with the grip raised only half a model unit (-5 to -4.5).
Preview renders are in previews/rod-placement-v0.2.18. The original PNG,
scale, handle pivot, cast motion, catches and enchantments remain unchanged.
These are screenshot-fitted editor approximations, not a native renderer;
check the final result in Minecraft.

## v0.2.19 line orientation and shaft angle

First-person rotation [142.49,26.09,34.72] keeps the accepted translation
[1.42,1.92,2.67]. It was fitted to place the hanging-line end beneath the tip while
retaining a visible sprite face and minimizing tip displacement. In third person, a sprite child rotates
10 degrees in the rod plane about the existing grip, lowering the shaft
angle without changing the parent yaw, hand position or first-person pose.
The sprite child has the same pivot as the hand-bound parent.
Preview artifacts are in previews/rod-placement-v0.2.19; Minecraft remains
the final check for this editor-based fit.

## v0.2.20 rightward placement and third-person shaft

First-person rotation stays [142.49,26.09,34.72]. Translation becomes
[2.36,0.736,5.427], calculated by moving along the preview camera right
axis only (7.5% of the screen width at the grip depth). Camera-plane height
and depth are preserved, so the accepted orientation and size remain.
The preview includes the hotbar rectangle measured from the user screenshot.
Third-person sprite rotation increases from 10 to 30 degrees, the requested
additional 20-degree downward turn, about the same grip.
Final Minecraft appearance still requires gameplay verification.

## v0.2.21 hotbar clearance, tip anchor and reel sound

Adds a further camera-right translation to first person, based on the
remaining overlap in the user screenshot. Orientation and third-person
pose are unchanged. Reel-in no longer plays random.bow; successful catches
retain lava pop/sizzle.

The particle line starts at the reference model tip, calculated from the
accepted 30-degree sprite turn, arm transform and the PNG tip pixel (49,9).
It follows body yaw, crouch and aim. This improves the former eye-height
offset but is still an approximation: the stable Script API cannot read
the rendered attachable locator or distinguish the client camera mode.
It cannot guarantee an exact first-person attachment to the camera-space
sprite; final line alignment requires gameplay verification.

## v0.2.22 item tooltip, missed bites and tip refinement

Cast sessions now keep a read-only rod-state signature in memory, rather
than writing a persistent rod_id onto the stack. Existing rod_id values
are removed from player inventories every second and before using a rod.
Only this addon-owned property is removed; name, enchantments, damage and
other addons' data are retained. Identical rods in the same slot cannot
be distinguished without persistent IDs; switching slots or changing
rod name/enchantment state cancels normally.

A missed bite enters a terminal missed state, leaving the bobber afloat.
No automatic next bite can occur: the next use reels in without loot, and
a subsequent use starts a fresh cast. Lure still shortens the new wait.

The model-based line anchor moves 0.06 blocks to the rod side and 0.12
blocks upward, based on the remaining gap in the user screenshot. It
still approximates client tip position rather than binding to its locator.

Casting currently uses custom animation.jagsby_nether.fishing_use for the
third-person arm and animation.jagsby_nether.rod_first_person_cast for the
held sprite. Both last 0.35 seconds; a native item cooldown drives the
first-person controller. These are custom keyframe animations, not the
vanilla fishing rod's internal use animation. Timing and swing can be edited
independently of the accepted rest/grip pose.

## v0.2.23 native first-person item swing and overhead arm cast

The script-driven arm animations have zero blend weight in first person,
so they do not combine the overhead motion with the vanilla item swing.
First person now references Minecraft's built-in
animation.player.first_person.attack_rotation_item. A hand-bound rightitem
parent receives that animation while a rod child retains the accepted
rest pose, so the native animation's override does not erase the grip.
The native rod-swing cooldown supplies normalized attack_time to the
attachable; its controller stops when that cooldown ends. No custom
first-person keyframe swing is active.

Third-person casting uses a new 0.7-second overhead arm animation with a
longer backward lift and forward sweep. Reeling retains the shorter
0.35-second third-person arm motion. Bobber launch physics and catch timing
remain unchanged; this revision changes visual motion only. Native asset
references do not copy vanilla source/assets into the add-on. The editor
preview can check the inherited resting pose but the simultaneous native
animation and owner-arm motion still need Minecraft verification.

## v0.2.24 continuous first-person swing timing

The native cooldown now triggers the swing only; it no longer directly
drives attack_time. The attachable accumulates query.delta_time while the
client animation is active, giving the native item swing a render-frame
clock instead of a seven-tick countdown. Entry and exit blend over 0.08
seconds, and a settling state waits for cooldown expiry before rearming,
preventing replay if the client timer and server cooldown end differently.
The native motion asset, resting pose, third-person overhead animation,
casting physics and catches are unchanged. Check smoothness in Minecraft.

## v0.2.29 lava XP bonus

Successful lava catches roll vanilla fishing’s 1–6 XP and multiply by 1.5. Half points round up/down with equal probability, for an exact 1.5× average (5.25 XP per catch, possible integer rewards 1–9). XP still uses native orbs for Mending. Failed and empty reels give no XP.
