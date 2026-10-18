# Infernal Lords — v0.2.118 integration test

This build integrates the three Infernal Lords, Ashen Tower Wraith and Crimson
Necromancer directly into Underworld. Activate Underworld's BP and RP; disable
Alylica's Dungeons and the five-mob standalone test packs. Their identifiers are
retained, so running those packs together would define the same content twice.
No additional Script API dependency or Beta APIs are required.

**In-game combat verification is pending.** Offline checks cover dependencies,
script loading, selected mechanics and scheduler behavior. There is no Bedrock
client in this workspace; they do not prove the full combat, rendering, audio,
HUD or Realms experience.

| Name | Active summon ID | HP | Dormant form |
|---|---|---:|---|
| Malzareth, Lord of Decay | `dungeons:nameless_one` | 600 | `dungeons:nameless_one_resting` |
| Nerezhal, Lord of Lamentation | `dungeons:wretched_wraith` | 500 | `dungeons:wretched_wraith_resting` |
| Baelgor, Lord of Ruin | `dungeons:boss_wildfire` | 500 | `dungeons:boss_wildfire_resting` |
| Ashen Tower Wraith | `dungeons:tower_wraith` | 36 | — |
| Crimson Necromancer | `dungeons:necromancer` | 50 | — |

Use `/summon <ID>` for each. The dormant forms retain their original interaction,
awakening animation and timed transformation. Summon in a separate test world,
then switch to Survival for combat. `/scriptevent jagsby_nether:lords_status`
reports the loaded roster, scheduler state and any caught handler error.

## Content and dependency scope

The original six combat modules, entity state machines, summoning helpers,
projectiles, fire/poison fields, death effects and loot helpers are retained.
There are 39 scoped entity definitions, including dormant forms, transient
helpers, required minions and enchanted variants; this is not 39 new primary
mobs. No imported mob has a free-roaming natural spawn rule. Dormant bosses are placed
once at verified sites in newly generated matching giants and new manual template
placements. Existing built structures and older partially built structures are
not backfilled. The unrelated Ancient Terror and other original bosses are
excluded.

Standalone v0.1.4 supplies Nether recolours, names and decorative boss bars.
Original texture-set/MER companions and the used glint material are bundled;
the material and custom arrow geometry have scoped names to protect native assets.
Nerezhal retains both normal and immune-phase bars. Original resources fill
missing dependencies, including 39 custom sound events and their recordings.
Baelgor retains the original dormant texture/model; a dedicated fullbright
render controller addresses the reported dark resting form without replacing a
shared controller. His preliminary shield-break awakening alias is retained
and now has its recording. Verify brightness and all three awakening cues live.

The RP adds the standalone's boss-health-panel definitions, rather than replacing
the entire HUD screen or action bar. Enchanted-target inspection uses the original
translated action-bar text with a Unicode star, avoiding a global font-atlas
override. Test alongside MineScape and any other HUD packs: only one pack can own
a conflicting JSON UI definition, and target inspection can share action-bar
space with other add-ons.

Boss direct loot retains Nameless/Wretched/Blaze Keys and its existing rewards.
Each kill additionally guarantees exactly one matching placeholder ingredient:
Malzareth drops Withered Heart, Nerezhal drops Weeping Soul, and Baelgor drops
Ruinous Ember. These fire-resistant, stackable items currently reuse their
respective boss-key icons until custom artwork is supplied. Native unconditional
loot pools provide the drops without player-kill restrictions, Looting bonuses or
new script checks.
Their delayed **bonus** rewards use `chests/underworld_structure`, as requested.
The keys have no new progression use in this release. Original Vanguard glaive
and Frozen Zombie frost equipment are included only because summoned support
actors equip them; their component handlers, icons and attachables are included.
No source explorer maps, bonus weapon pools, artifacts or progression menus are
loaded. Original empty-helper tables are scoped to avoid a global loot override.

`INFERNAL_LORDS_SOURCE.json` records source archive hashes, original asset hashes,
normalized output hashes, native resource references and integration changes.
Existing credits/licenses remain intact. The original script entry point,
server-ui dependency and vanilla entity overrides are not imported.

## Enchanted framework and future spawner API

The original 18 common abilities and all 35 handler modules are included,
including special abilities such as Chains, Echo, Multishot, Resurrection Aura,
Growing and Tempo Theft. Original Easy/Normal/Hard selection, multiple abilities,
individual effect values and cooldowns are retained. Baseline enchanted damage
is **1.5×**; declared variants provide **2× HP, 1.1× scale and +0.2 knockback
resistance**. These stack with individual abilities such as Double Damage.

Test the requested enemies' opt-in variants:

```mcfunction
/summon dungeons:enchanted_necromancer
/summon dungeons:enchanted_tower_wraith
```

The Necromancer variant has 100 HP and the Tower Wraith variant has 72 HP.
Original enchanted variants of required minions are included as support actors.
Necromancers retain their native 10% enchanted spawn roll.

Future trial-spawner code can import `spawnEnchanted(dimension, typeId, location)`
and `registerEnchantedVariant(typeId)` from
`behavior_pack/scripts/infernal_lords/main.js`. Registering an ID only opts an
**existing declared BP variant** into the scoped roster. Its definition must
include the `enchanted` family and baseline health/scale/knockback changes; it
also needs a matching client definition with the original glint controller.
Tags alone cannot change a vanilla mob's maximum health or scale. Trial pools now include enchanted Tower Wraiths directly; Necromancers retain their native enchanted roll.

Arrow-specific effects need the included `dungeons:enchanted_arrow` projectile
in a future ranged variant's shooter definition. It isolates the original Growing
scale properties/events from vanilla arrows; no `minecraft:arrow` override is
installed. The present five enemies retain their own original projectile types.
Abilities with weapon/projectile/family requirements still obey those original
requirements; they do not become applicable to every mob merely by adding a tag.

Source bug fixes are limited to working dependencies and clear handler defects:
null projectile-owner guards; a five-minion comparison; removal of the correct
invalid chain target; Radiance checking each ally rather than the query array;
and guards against delayed effects accessing removed actors. Numerical balance
is unchanged. Timed chains/clouds/healing stop using a removed caster; finite
native status effects and particles expire normally. Boss death sequences and
original delayed resurrection mechanics retain their own timings.

## Runtime cost

Spawn/load/remove/death events maintain a scoped roster. Native global entity
queries run once at world load to rediscover already-loaded imported actors and
source-tagged minions. Subsequent roster polling is in memory. A single lazy
scheduler serves original intervals only while their relevant enchanted actors
or minions exist, and clears itself when they are removed/unloaded. Dormant
bosses and normal wandering mobs alone do not activate the effect scheduler.
Player lists are shared per tick while effects are active. Local combat queries,
projectile processing and finite attack/death callbacks still run when triggered.
No continuous world-wide entity scan or structure scan was added.

## Live acceptance checks

1. With only Underworld BP/RP active, summon all five primary mobs. Verify models,
   all recolours, animations, targeting, hurt/death sounds and drops. Repeat with
   the patched MineScape companion and Conquest Commerce enabled.
2. Summon each dormant form and interact. Check timing, transformation and audio,
   particularly Baelgor's resting brightness and awakening/ambient recordings.
3. Fight Malzareth through summons, illusions, teleportation, spell patterns and
   complete death; verify illusion recolours and bone-gold decorative bar.
4. Fight Nerezhal through teleport, ranged/fire and bullet-hell phases. Verify
   temporary immunity and the purple alternate bar, then complete death.
5. Fight Baelgor through shield impacts/breaks, reflection, ranged fire,
   shockwaves, Blaze summons and complete death. Verify all audio.
6. Kill bosses and verify both original direct drops and Underworld bonus loot.
7. Test enchanted variants at Easy/Normal/Hard; verify glint, particles, selection,
   health/size/knockback and stacked abilities. For special-ability testing, add
   original `dungeons:enchanted_mob_<ability>` tags to a declared enchanted actor.
   Test ability prerequisites, cooldowns, caster death and chunk unload/reload.
8. After all relevant actors/minions are removed, `lords_status` should report
   `ticking:false`. Record errors and compare CPU profiles during/after combat;
   no FPS claim is inferred from the offline checks.

## Verified structure placement

| Boss | Spot | Full-template local feet position | Modular-keep local feet position |
|---|---|---|---|
| Malzareth | Center of the keep roof's four trial spawners | 122.5, 29, 125.5 | 0.5, 29, 0.5 |
| Nerezhal | Main dragon hall's purple-glass boss platform | 90.5, 6, 59.5 | — |
| Baelgor | Ground-level central fighting floor under the high roof | 31.5, 2, 56.5 | — |

These use the original authored Warden of the Keep, Drakebone Tyrant and Arena
Gladiator marker positions. Those original mobs are not imported. The Mega
position is exactly midway between the four roof spawners. Offline validation
reads actual structure blocks: all three positions have supported floors and
sufficient clear space in manual and natural templates, plus the modular keep.
Offsets are relative to placement origin, not player coordinates; see
`BOSS_PLACEMENTS.json` for the source markers and clearance requirements.

Boss placement runs after a new structure finishes, using a small temporary chunk
lease at the boss site. It never scans for a missing boss or respawns one after
awakening, death or an add-on update. A permanent per-site placement claim is
saved before the native spawn; successful spawns record their entity ID. A native
spawn failure releases the lease and can retry through the existing generation
job. A crash-window claim is preserved rather than risking a duplicate boss.
There is no new polling interval or existing-world backfill. Natural generation
records created before this version have no opt-in marker and remain unchanged.

For live placement testing, create fresh structures with
`/scriptevent jagsby_nether:template mega_fortress X Y Z` (and `dragon_arena` or
`large_arena`), then visit the local position above. Manual placement does not
perform natural terrain carving/foundation surveys. Verify one dormant boss,
correct floor contact, awakening, and no respawn after defeat or world reload.
Do not reuse a claimed origin when testing a fresh encounter.

Later work remains separate: arena containment, explicit defeat/quest tracking,
and the planned Grimoire recipe and uses for the three boss ingredients.
The placement ledger prevents automatic respawns; it does not implement quests
or containment.

## v0.2.110 ability repairs

Malzareth's original server casting controller is restored. Teleport events no longer depend on a tag set only during transformation, so direct summons and existing untagged bosses can teleport too. Malzareth and Nerezhal use bounded local floor/clearance searches with native collision validation; failed teleports produce no success effects. Nerezhal can return home in the Nether and use teleport/floor-fire abilities on the arena's stone instead of requiring Overworld ice. Bullet-hell floor-fire placement yields between columns and stops if the caster unloads. Two projectile friendly-fire handlers now reference the actual hurt entity. All three active and dormant bosses have native fire immunity plus fire/fire-tick/lava damage exclusions in every damage-sensor phase. These changes add no idle polling.

Automated ability tests cover Malzareth's close/distant/post-cast teleports, projectile fan and vanguard mode switch; Nerezhal's Nether teleport, home return, melee, floor fire and owned projectile fans; Baelgor's shield-break transition, shockwave and minions. Native awakening, combat animation timing and full encounters still need Bedrock playtesting. Check `/scriptevent jagsby_nether:lords_status` for script failures during combat.

## v0.2.111 arena caster balance

| Raw damage | Easy | Normal | Hard |
|---|---:|---:|---:|
| Necromancer projectile | 6 | 10 | 14 |
| Tower Wraith fire/poison opening hit, per player per cast | 6 | 10 | 14 |
| Tower Wraith lingering pulse | 1 | 1.5 | 2 |

The Hard opening hit is slightly below an armed Bedrock Piglin Brute (roughly 15 raw damage). Necromancer projectile scaling preserves earlier damage modifiers and the existing enchanted 1.5x multiplier (21 on Hard). Tower Wraith spell hazards retain their fire/magic causes and existing resistance/poison behavior; these raw figures are not guaranteed final health loss. Repeating hazards do not apply a full opening hit every half-second: all patches from one fire cast share successful-hit history, while each poison cloud tracks the players it has successfully hit. Different players and fresh casts get their own opening hit. Other wraith and boss hazards are unchanged. Fire history is bounded and pruned only during active hits; no new interval or background scan is added.

## v0.2.113 combat repairs

Nerezhal and Malzareth projectiles now deal native projectile impact damage rather than script fire damage. Fire Resistance no longer cancels their ordinary bolts. Nerezhal uses a 22–32-second ranged timer, a 1.25-second windup and a 13-second special phase with finite scheduled volleys. Retreat no longer depends on its melee cooldown; hurt and nearby-target teleport triggers are restored. Teleport landing checks accept structural floors and do not require a straight unobstructed flight path.

Baelgor slam/recovery/cooldown and Malzareth summon cooldowns use native component timers. Malzareth detects remaining vanguards through its native entity sensor. Load events recover interrupted phases without resetting health or Baelgor shield progress. No new periodic world scans were added. `/scriptevent jagsby_nether:lords_status` reports phase events, successful teleports and delivered projectile damage for loaded bosses.

Automated sequence tests execute the configured events and timers. Actual AI navigation, animation timing and complete fights remain pending Bedrock acceptance.

## v0.2.115 delivery and damage candidate

Stable `dataDrivenEntityTrigger` documents component-definition changes, so empty/property-only source events cannot be treated as guaranteed notifications. Original scripted boss actions now use queued `scriptevent jagsby_nether:boss_event` responses and one validated dispatcher. Those routed events ignore native notifications to avoid duplicate volleys or shield breaks. The old test fixture incorrectly notified every empty event; it now models component changes and queued-command delivery separately.

Malzareth spread initialization waits for native projectile ownership and accepts Event-cause spawns. Illusion removal uses the same reliable command route. Nerezhal storm origins are fixed relative to feet, avoiding the original head-height-minus-1.4 offset intersecting floors on native runtimes with a low eye height. Floor hazards retain their 20-second lifespan and half-second hits but no longer disappear because a collisionless helper reports not being on ground. Baelgor keeps his original two-Blaze cap scoped to the summoning boss. No boss health, movement speed, phase duration, projectile count/spread, attack cadence, invulnerability, shield values, awakening, animation, particle or sound resource was redesigned.

See [INFERNAL_LORDS_DAMAGE.md](INFERNAL_LORDS_DAMAGE.md) for raw native damage inputs and the explicitly unverified Hard mitigation targets. Actual health-loss logging is opt-in and event-driven, with no interval, inventory edits or health subtraction.

Arena caster audit (v0.2.118): Necromancer summon markers, Tower Wraith poison
creation and shared Wraith fire initialization/hits now use queued event delivery;
native notifications are suppressed for those routes to prevent duplicate hits.
The collisionless fire actor no longer despawns for lacking ground contact and
uses native nearby-entity sensors for its original half-second hit cadence.
Fire placement/spread resolves local floors, excludes itself from duplicate checks,
skips unloaded neighbors and retains one opening-hit history across each cast.
Normal/enchanted support Wraith teleports no longer query above the Nether roof.
Unavailable biome data falls back to the regular zombie instead of aborting summons.
Health, damage values, spell types, enchanted spawn weights, projectile cadence,
spell spread counts and summon limits are retained. Eight added BP-event pipeline
checks cover these repairs; they do not execute native AI goals, pathfinding,
projectile aim, client rendering or actual armor mitigation. Live acceptance remains
required for both caster variants in their arenas and after save/reload.
