# Skitterchests — v0.2.56 native-screen test build

This build removes the custom ActionForm storage menu entirely. Standing
interaction with a tamed Crimson/Warped opens a real native 27-slot container;
crouching toggles sitting/standing. Native drag/drop, stacking, inventory hotbar
and controller/touch handling are supplied by Minecraft, not scripted buttons.
Blackstone remains untameable and cannot be opened.

## Native storage architecture

The visible Skitterchest retains its custom model, ordinary mob runtime and AI.
Each tamed pet receives a separate hidden, non-colliding native storage entity.
The helper follows it every tick and presents the native interaction target. The
pet pauses while the inventory is open, then resumes its previous seated or
standing state. No player riding is enabled. The visible pet has no overhead
name. The hidden helper uses a formatting-only title marker with no visible
letters, giving its native window a blank heading as requested. This does not
change any resource-pack UI or other container titles. Native slots, input,
drag/drop and storage remain unchanged.

Existing 27-slot contents migrate slot-for-slot to the native container, including
item data. Copying completes before original slots are cleared; interrupted
copies can be retried. A persisted link identifies the container across reloads.
An unavailable linked container is never silently replaced, preventing duplication
or item loss from delayed chunk loading. Native container contents become the
single authoritative storage after migration. On owner death, contents drop and
the helper is removed. Failed death-drop operations leave remaining items in the
helper with an owner-dead marker for retry after load. The native before-hurt event
cancels hits to the helper and forwards calculated damage and attacker to the pet,
so its own health, defense and XP rules remain in control.

v0.2.39 lowered each variant’s base walking/lava movement speed from 0.3 to
0.2 (one third slower), including explicit standing restoration after sitting or
opening storage. Follow-owner speed stays at 1×; existing flee/avoidance
multipliers remain. A zero-volume entity sound mapping suppresses movement and
other native sounds for the hidden storage helper only; normal minecart mappings
and the visible mobs’ strider/glow-squid/nautilus sounds are unchanged. Scripted
chest open/close clips still play separately. Native rolling-sound suppression
needs an in-game check because this environment cannot run Bedrock.

The previous v0.2.38 changed only the native window title. The user confirmed the v0.2.37
native inventory and other behavior work in-game. Untamed Crimson/Warped retain their
4-block hostile detection range and 10 XP player-kill reward. Blackstone flees
within 8 blocks and gives 30 XP. Lava avoidance, fire immunity, one-block traversal,
retracting legs, no breeding and no riding remain in place. Netherite Scrap tames
Crimson/Warped with a 1/3 chance. Ambient/hurt/death use strider, glow squid and
nautilus sounds. Real container access events play the selected LargeMeat.wav and
RawLargeMeat.wav clips. Models and animations originate in the supplied NetherPlus
archive; provenance and sound hashes are in docs/skitterchests.

## Required in-game checks

This environment cannot run the Bedrock client. The user confirmed the native
inventory works in v0.2.37. The blank title and helper sound suppression need client
verification: confirm the Minecart with Chest heading is gone, no overhead text
appears, and a regular chest minecart keeps its normal title. Automated checks
cannot verify the engine renders a formatting-only name as blank.

1. Tame a fresh Crimson/Warped. Confirm custom model, movement and no visible helper.
2. Stand and interact: confirm Minecraft's actual chest grid, player inventory,
   drag/drop/stacking and normal controller behavior, with no ActionForm list.
3. Crouch and interact: confirm sitting/standing and movement afterward.
4. Confirm existing contents migrate once, persist after reload, and drop once on death.
5. Hit the chest: confirm its health, hurt/death sounds and XP are correct.
6. Test multiple viewers, native open/close sounds and resuming motion after closing.

Requires Bedrock 26.50+ and stable server 2.10.0 (target: user version 26.52).
No server-ui dependency, horse runtime on the mob, or custom storage menu remains.

The helper’s unique skin marker 99137 selects zero client render scale, including the inherited vanilla chest-minecart client definition. Normal chest minecarts retain scale 1. This does not shrink the server interaction hitbox or add visible overhead text. Invisibility potion effects are not required.

## v0.2.56 MineScape loot compatibility and rarity

Blackstone death loot has one fixed 75% random-chance roll for one MineScape
relic. On success, its 54 normal spawner-drop relics are equally weighted, matching
MineScape’s generic random-spawner pool. Last Ember and Idol of the Last Horizon
are excluded because MineScape marks them as special rewards. Each relic has the
exact level-1, zero-upgrade-progress lore generated by MineScape v1.5.18, so it
starts with its normal upgrade state and tooltip. The other 25% drops no relic.
The erroneous vanilla Relic music-disc drop from v0.2.40 is removed.

MineScape’s behavior and resource packs must be active for its item definitions,
textures, upgrades and effects. No MineScape items or gameplay scripts are bundled
in Underworld. Provenance, the exact eligible IDs and pool selection are recorded
in MINESCAPE_COMPATIBILITY.json. Looting does not increase the 75% chance or
quantity; a player kill is not required for the item roll. Blackstone’s existing
player-kill XP stays at 30. Stored items still drop on death, in addition to the variant death loot below.

Crimson/Warped retain their existing biome rules, singleton herds, weight 1 and
surface/underground density limits of 1.

## v0.2.56 Blackstone biome rarity

Blackstone can spawn naturally in Basalt Deltas, Nether Wastes and Soul Sand
Valleys. Basalt Deltas is the best place to search. v0.2.56 makes the natural-spawn
gates ten times more permissive than v0.2.43, as requested. All three rules have weight 1, herd size 1 and surface/underground
density limits of 1. Natural-spawn herd events apply additional gates:

| Biome | Surviving natural-spawn attempts | Event |
| --- | --- | --- |
| Basalt Deltas | 10% (1 in 10) | jagsby_nether:rare_natural_spawn |
| Nether Wastes | 1% (1 in 100) | jagsby_nether:exceptionally_rare_natural_spawn |
| Soul Sand Valley | 1% (1 in 100) | jagsby_nether:exceptionally_rare_natural_spawn |

These gates run only after Minecraft selects the already rare weight-1 rule
and finds a valid location. They are not chances per chunk or per tick. The
Nether Wastes and Soul Sand Valley gates are ten times stricter than Basalt
Deltas; actual encounter ratios depend on competing mob weights, terrain and
population limits. Actual search times need a Bedrock spawn test.

Every natural herd member invokes its event (`event_skip_count: 0`). Weighted
randomization keeps one attempt and immediately despawns the rejected attempts
without killing them, producing no death loot or XP. Spawn eggs and ordinary
summon commands bypass these natural-only events, and existing mobs are
unaffected. The fixed 75% MineScape relic roll and 30 XP player-kill reward remain
unchanged. Crimson/Warped spawning is unchanged.

## v0.2.56 seated push resistance

Sitting Crimson/Warped Skitterchests disable both entity pushes and piston
pushes. The temporary inventory-open state also disables pushing, preserving
their position while storage is accessed. Standing explicitly restores both
flags, including after repeated sit/stand and native inventory open/close cycles.
The hidden storage helper was already non-pushable. Blackstone behavior and
Hongos’ fast test production settings are unchanged.

## v0.2.56 movement

All three Skitterchests use base walking/lava movement 0.25 instead of 0.2,
including explicit standing restoration. This is a 25% increase; existing flee
and avoidance multipliers are unchanged. Sitting/inventory-open movement stays
zero, seated push resistance stays enabled, and Hongo movement is unchanged.

Tamed standing Crimson/Warped resume following their owner at a 4-block
distance and stop within 2 blocks (v0.2.56). Sitting behavior is unchanged.

## v0.2.56 Crimson death loot

Every row rolls independently once when a Crimson Skitterchest dies. Looting
does not modify these fixed chances or quantities. A player kill is not required.
Both wild and tamed Crimson use this table; a tamed chest additionally drops its
existing stored contents through the native-storage death handler.

| Item | Chance | Quantity |
| --- | --- | --- |
| Leather | 60% | 1–3 |
| Gold nuggets | 45% | 2–6 |
| Crimson fungus | 40% | 1–2 |
| Nether wart | 25% | 1–4 |
| Gold ingot | 10% | 1 |
| Netherite scrap | 1% | 1 |

Netherite Scrap replaces Ancient Debris as requested. Nether Wart is explicitly
allowed in this mob loot table; the ban on wart in generated structures remains.

## v0.2.56 Warped and Blackstone death loot

Every row below is an independent one-roll pool, with a uniform quantity within
its inclusive range. Looting does not alter these fixed probabilities/quantities.
Wild and tamed Warped use the same table; tamed storage contents drop separately.
Blackstone remains exceptionally rare and untameable with its 30 XP player-kill
reward. The original MineScape relic pool is retained byte-for-data unchanged as
one independent 75% roll for one of its 54 eligible relics. MineScape must be active.

| Warped item | Chance | Quantity |
| --- | --- | --- |
| Ender pearl | 45% | 1–2 |
| Gold nuggets | 40% | 2–6 |
| Warped fungus | 40% | 1–2 |
| Glowstone dust | 35% | 2–5 |
| Obsidian | 15% | 1 |
| Crying obsidian | 5% | 1 |

| Blackstone item | Chance | Quantity |
| --- | --- | --- |
| Gold ingots | 100% | 2–5 |
| Iron ingots | 75% | 2–4 |
| Obsidian | 50% | 1–3 |
| Nether quartz | 50% | 3–7 |
| Glowstone dust | 40% | 3–6 |
| Crying obsidian | 30% | 1–2 |
| Magma cream | 30% | 1–3 |
| Blaze rod | 20% | 1–2 |
| Diamond | 15% | 1–2 |
| Golden apple | 10% | 1 |
| Netherite scrap | 1% | 1 |
| Enchanted golden apple | 1% | 1 |
| MineScape relic | 75% | 1 |
