# Custom villager breeding food — v0.2.58

Drop raw Sorgum (`jagsby_nether:rye`) or Polyps (`jagsby_nether:polyp`) within
1.5 blocks of an adult villager. Twelve crops provide that villager’s normal
breeding-food requirement; two parents starting with no food therefore need
12 each (24 total), plus the usual valid unclaimed bed for the child. Crops may
be mixed and fed in smaller servings. Vanilla mobGriefing must be true, as with
normal villager food pickup. Seeds and harmful blistered/withered variants are
not breeding food. Native bread/carrot/potato/beetroot feeding still works.

Adult farmers harvest one ripe Sorgum or Polyps plant per second within 2.25
blocks during working hours, and immediately replant it at age zero using the
harvest propagule. The edible crop drops into the world for nearby pickup.
Walls, immature crops, other professions and mobGriefing=false prevent harvest.
This scripted harvesting preserves native movement: farmers do not pathfind to
distant custom fields. Place their composter next to the planted farm.
Villagers also do not seek out distant custom crop drops. Adult regular
Bedrock villagers qualify; baby villagers and C&C haggle/zombie merchants do not.
Already-fed villagers and those without space leave the crops untouched. Large
stacks retain their remainder and can feed another nearby hungry adult.

## Conquest & Commerce compatibility

The supplied v1.1.0 uses normal make_love/receive_love and the private eight-slot
food inventory. It customizes professions, biome variants, trade/working
schedules and emerald interactions. None of these definitions or scripts are
overridden or bundled. The source hashes and inspected behavior are recorded
in CONQUEST_COMPATIBILITY.json. Emerald drops and vanilla foods are ignored by
the new pickup handler, allowing their original handlers to run.

The stable engine cannot add a custom item to its internal breeding-food list
through Script API. Instead, every four accepted crops contribute one native
bread item in the villager’s private food inventory; twelve give three bread,
equivalent to the native twelve food points. Fewer than four crops remain as
persistent per-villager credit. Native food is accounted for, existing unrelated
stacks are preserved, and normal sharing may use that bread. This is a food
bridge, not replacement breeding AI: no babies are spawned or breeding events
forced by this script. Beds, time/cooldowns, profession behavior and offspring
variants remain controlled by whichever villager definition is active.

Only loaded custom crop drops are tracked, from spawn/load events and one
startup collection. A half-second scheduler processes at most 64 tracked drops
per pass, with no global villager scan. Crop remainders preserve their original
item data. Failed food writes restore the source crop stack.

## Native village styles

Automatic generation reads the actual biome: Nether Wastes (Bedrock biome ID
minecraft:hell) and Crimson Forest select Crimson; Warped Forest and Soul Sand
Valley select Warped. Ground decorations cannot override these choices. Explicit
command-forced themes remain available for testing.

## Checks

Automated tests cover both crops, partial/mixed servings, large-stack remainders,
babies/merchants/range, mobGriefing, full/already-fed inventories, normal foods,
existing inventory contents and failed writes. Biome tests verify automatic style
selection including Nether Wastes. The build asserts no villager definitions are
added by this integration. Bedrock’s actual food/willingness and bed checks cannot
be run in this environment, so breeding needs a client test with C&C active and
again without it: two adult villagers, three valid beds with headroom, mobGriefing
true, and 12 crops dropped at each parent’s feet. Confirm normal breeding and
correct baby appearance, and retest existing C&C trades/emerald interactions.

Village crop planting now queries the actual biome directly at every planting
position, including mixed-biome farm boundaries. The native biome-filter probe
is retained only as a fallback when the query API is unavailable.
