# Hongos — v0.2.51

Two normal tameable mushroom mobs from NetherPlus: Crimson Hongo and Warped
Hongo. Their original model, texture, idle/setup and walk animations and egg
artwork are retained with scoped identifiers. Black mushroom variants and other
NetherPlus content are not imported. Provenance is in HONGOS_SOURCE.json.

Hongos use passive cow-like ground movement components, not a wolf runtime or
wolf AI. Wild and tamed Hongos roam independently. They do not follow owners,
sit, guard owners, hunt skeletons, leap at enemies, breed or carry riders. Leads
can be used to bring them to an enclosure. They avoid lava, are fire immune,
and can traverse one-block steps.

Crimson Fungus tames Crimson; Warped Fungus tames Warped, with the source’s
33% success chance. Tamed Hongos persist and have 10 health (wild: 8). Their
matching fungus heals 2 health. They spawn naturally in their matching forest,
in groups of 1–2 at weight 5 with local density limits of 4 per variant, and
have working custom spawn eggs. These passive mobs may spawn on Peaceful.

## Skitterchest synergy

Both creatures must be tamed; ownership may differ. Within an 8-block spherical
range, a Crimson Hongo deposits one iron nugget into a Crimson Skitterchest,
and a Warped Hongo deposits one gold nugget into a Warped Skitterchest.
Blackstone and opposite variants receive nothing. Only sitting Skitterchests qualify; standing ones receive nothing.

Each tamed Hongo gets a random 5–10 second cooldown for testing based
on persistent world time. One successful deposit starts the next cooldown.
The nearest matching tamed chest with available storage is used, through the
existing native storage helper, never the old empty pet inventory. If matching
storage is unavailable or full, it retries after 2 seconds; no nuggets are
spawned into the world and no existing stacks are replaced.

The scheduler examines loaded Hongos once per second. Unloaded time does not
accumulate production: a returning Hongo can deposit at most one nugget, then
starts a fresh cooldown. More tame Hongos can contribute independently.

## Validation and in-game checks

Automated tests cover both nugget types, different owners, untamed creatures,
wrong variants, range, full-storage handling, native-container writes, cooldown
bounds and no production backlog. Bedrock client behavior still needs checking:
spawn both variants, confirm model/walk animation, tame and leash them, and
confirm they keep roaming. Place tamed matching chests within 8 blocks, make the Skitterchests sit, wait
5–10 seconds, then open their native inventory to inspect nugget deposits.

This is a fast-production test build. Previously saved long cooldowns are
shortened automatically; the normal 3–5 minute rate can be restored after testing.
