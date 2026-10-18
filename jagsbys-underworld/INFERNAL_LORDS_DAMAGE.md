# Infernal Lords damage candidate — v1.0.0

**Status: calculated targets and automated contract/model tests, NOT measured Bedrock combat results.** No Bedrock client/server is available in this workspace. The requested live health-loss matrix below is unrun. Do not treat raw NBT values or model test passes as proof of native damage or complete boss behavior.

Hard is the reference difficulty. All damage passes through native projectile or `applyDamage` handling; no override damage, equipment-dependent health subtraction, armour stripping or Protection/Resistance cancellation is used. Health remains Malzareth 600, Nerezhal 500 and Baelgor 500. Existing boss attack counts, timings, speeds, phases and resources are retained. Delivery repairs are described in INFERNAL_LORDS.md.

## Configured inputs and expected mitigation

The Bedrock model uses 20 armour points = 80% reduction and Protection IV on four pieces = 16 EPF = 64% additional reduction. Physical damage reaching that model is multiplied by 0.2 × 0.36 = **0.072**. This is the Bedrock fixed armour model, not Java's toughness-dependent formula. Resistance I/II then multiply by 0.8/0.6. Other add-ons, native source/difficulty handling, shields, absorption and actual collision/hurt-immunity behavior require live measurement.

| Hard attack | Native raw input | Expected HP lost, full Netherite + Protection IV | Expected hearts |
|---|---:|---:|---:|
| Malzareth bolt, including illusion bolts | 96 | 6.912 | 3.456 |
| Nerezhal ordinary bolt / close burst | 96 | 6.912 | 3.456 |
| Nerezhal storm bolt | 160 | 11.520 | 5.760 |
| Baelgor fireball impact | 96 | 6.912 | 3.456 |
| Baelgor shockwave at zero distance | 208 | 14.976 | 7.488 |
| Nerezhal ground-fire pulse | 32 fire damage | 11.520, using Protection without physical-armour reduction | 5.760 |

Standard hits without enchantments model 19.2 HP through full Netherite; without any armour they are lethal at normal maximum health. Shockwaves can kill an unenchanted Netherite player. Protection is essential, and Resistance remains beneficial: a standard protected hit models 5.530 HP with Resistance I or 4.147 HP with Resistance II. Defensive MineScape passives, absorption and other native/add-on reductions are retained rather than normalized away.

Easy/Normal/Hard configured multipliers are 0.5 / 2÷3 / 1. Native projectile semi-random difficulty damage is disabled to avoid adding a second projectile difficulty roll. The native engine's actual source-dependent result must still be checked; adjust constants if live measurements disagree.

Baelgor's falloff remains Alylica's `20 − round(distance × 3)` within four blocks, scaled to the new raw magnitude. Expected protected losses at 0/1/2/3/4 blocks are approximately 14.98/12.73/10.48/8.24/5.99 HP. Exact entity-origin distance matters. His reflection, shields and summons are retained. Fire Resistance is expected to stop subsequent burning, not physical impact; it also stops Nerezhal ground fire. That interaction needs live confirmation for the native fireball runtime.

Three accepted standard hits or two accepted storm hits exceed 20 HP in the protected model. This does not bypass normal damage immunity between hits: simultaneous projectiles may be rejected by native hurt immunity. Summoned enemies retain their own damage.

## Native acceptance — all pending

Run Hard, Survival, isolated attacks with full health. Turn on:

```mcfunction
/scriptevent jagsby_nether:boss_damage_watch on
```

It records health immediately before and after actual boss hurt events and reports HP/hearts lost. It does not equip gear, change health, force a hit, bypass immunity or poll. Absorption can yield zero health loss even when damage was absorbed. Disable with the same command followed by `off`.

| Loadout / scenario | Malzareth | Nerezhal | Baelgor |
|---|---|---|---|
| No armour | Unrun | Unrun | Unrun |
| Full Netherite, no enchantments | Unrun | Unrun | Unrun |
| Protection IV on all four Netherite pieces | Unrun | Unrun | Unrun |
| Same + Resistance I | Unrun | Unrun | Unrun |
| Same + Resistance II | Unrun | Unrun | Unrun |
| Same + Fire Resistance | Unrun | Unrun | Unrun |
| Repeated / simultaneous projectiles | Unrun | Unrun | Unrun |
| Full fight from resting state | Unrun | Unrun | Unrun |

Measure ordinary and storm bolts separately, Nerezhal close burst and floor fire, Baelgor impact versus subsequent burning, and shockwaves at multiple distances. Repeat sufficient accepted hits; exclude blocked/shielded hits from unblocked targets. Record difficulty, effects and any other add-on defensive bonuses. Confirm Malzareth teleports/illusions, Nerezhal visible volleys/invulnerability, and Baelgor shield-break shockwaves and Blazes before accepting the release as balanced. `/scriptevent jagsby_nether:lords_status` supplies actual boss-event counters and teleport successes.
