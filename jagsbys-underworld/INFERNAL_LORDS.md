# Infernal Lords — v0.2.108 integration test

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
not backfilled. No terrain policy, layout or trial-spawner role has changed. The unrelated Ancient Terror and other original bosses are
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

Boss direct loot tables remain original, including Nameless/Wretched/Blaze Keys.
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
Normal Underworld mobs are not converted or enchanted automatically.

Future trial-spawner code can import `spawnEnchanted(dimension, typeId, location)`
and `registerEnchantedVariant(typeId)` from
`behavior_pack/scripts/infernal_lords/main.js`. Registering an ID only opts an
**existing declared BP variant** into the scoped roster. Its definition must
include the `enchanted` family and baseline health/scale/knockback changes; it
also needs a matching client definition with the original glint controller.
Tags alone cannot change a vanilla mob's maximum health or scale. No existing
trial encounter has been switched to these variants in this release.

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
and Withered Heart / Weeping Soul / Ruinous Ember plus the planned Grimoire.
The placement ledger prevents automatic respawns; it does not implement quests
or containment.
