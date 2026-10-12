# Skitterchests — v0.2.25

Only the three chest pets and their models, textures, animations and spawn eggs
are adapted from the supplied NetherPlus Add-on MA v3 by BubbleStudio and
MarcoGamer. Asset hashes and provenance are in SKITTERCHESTS_SOURCE.json.

| Mob | Natural habitat | Taming |
| --- | --- | --- |
| Crimson Skitterchest | Crimson Forest | Netherite Scrap, 1/3 chance |
| Warped Skitterchest | Warped Forest | Netherite Scrap, 1/3 chance |
| Blackstone Skitterchest | Nether Wastes (rare), Basalt Deltas | Cannot be tamed |

Each has a native 27-slot chest inventory and a creative spawn egg. No variant
can be ridden or bred; natural spawns are adults. Crimson and Warped retain
following, sitting, healing and defense after taming. Once a Skitterchest is
interacted with, it becomes persistent to protect stored items from distance
despawning. Inventories drop their contents on death. They are fire immune.

Spawn rules retain the source weights and difficulty ranges. Crimson can spawn
on crimson nylium, correcting the source's exclusion of its own biome floor.
Spawn rules apply to suitable Nether terrain; existing explored chunks can spawn
these mobs too. Commands use jagsby_nether:crimson_skitterchest,
jagsby_nether:warped_skitterchest and jagsby_nether:blackstone_skitterchest.

In-game checks: spawn each egg, open and fill all three chests, tame Crimson and
Warped with Netherite Scrap, confirm Blackstone stays untameable, confirm no
riding prompt or breeding, and leave/reload to check stored items. Natural
spawning, storage UI and pet interactions require Bedrock playtesting.
