# Skitterchests — v0.2.34

Only the three chest pets and their models, textures, animations and spawn eggs
are adapted from the supplied NetherPlus Add-on MA v3 by BubbleStudio and
MarcoGamer. Asset hashes and provenance are in SKITTERCHESTS_SOURCE.json.

| Mob | Natural habitat | Taming and storage |
| --- | --- | --- |
| Crimson Skitterchest | Crimson Forest | Netherite Scrap, 1/3 chance; 27 slots once tamed |
| Warped Skitterchest | Warped Forest | Netherite Scrap, 1/3 chance; 27 slots once tamed |
| Blackstone Skitterchest | Nether Wastes (rare), Basalt Deltas | Cannot be tamed or opened |

All have creative spawn eggs and are fire immune. No variant can be ridden or
bred; natural spawns are adults. Tamed Crimson and Warped retain following,
healing and defense. Their inventories drop their contents on death. Tamed pets
are persistent, so distance despawning cannot remove the player's stored goods.
Wild mobs have no accessible storage; Blackstone has no inventory component.

## Controls

Stand and use Netherite Scrap to tame wild Crimson or Warped. Once tamed,
standing interaction toggles their sit/stand state; crouching interaction opens
the native 27-slot storage screen without changing that state. Sitting prevents
walking and jumping. The horse runtime supplies the container interaction while supporting animal
navigation. The tamed group has is_chested, and the inventory stays 27-slot
minecart_chest. No riding component is present.

## Opening and closing sounds

The exact user-selected clips from Eating Animations And Sounds SE V1.9.4
(Nexus mod 42602) are registered as:

- LargeMeat.wav → jagsby_nether.skitterchest.open
- RawLargeMeat.wav → jagsby_nether.skitterchest.close

They play from the real entityContainerOpened and entityContainerClosed
events on tamed Crimson and Warped only, using stable server 2.8.0. Full clips are preserved, converted to mono Ogg Vorbis
without changing duration, pitch or speed. No global vanilla chest sounds are
replaced. Original paths and SHA-256 hashes are in
resource_pack/docs/skitterchests/SOUND_SOURCE_METADATA.json.

## Playtest

Confirm wild mobs and Blackstone cannot open storage, tame Crimson and Warped,
then check standing sit/stand, crouching storage, both selected sounds, inventory
persistence and natural spawning. Native container interaction and sound-event
playback require verification in Bedrock; the cloud environment has no game
runtime. Spawn rules preserve source weights/difficulty ranges, except Crimson
can spawn on crimson nylium, correcting the source's exclusion of its own floor.

All three variants use the built-in mob.glow_squid.hurt sound when hurt and mob.nautilus.death sound on death, at normal pitch. Blackstone has no storage sounds.

## Storage title

Unnamed Crimson and Warped receive the default name Skitterchest on spawn, chunk load and initial script startup, so the native container uses that title. Player-applied names remain intact; ordinary chest minecarts are not renamed. Sitting retracts the legs and lowers the body onto the ground; standing extends them again.

## Retracting legs

Tamed Crimson and Warped smoothly retract both leg groups to zero scale while lowering all chest-body roots by three model units, matching the gap between their base and the ground. Standing reverses that pose. Frame-time-based interpolation smooths transitions and fades out walking and idle movement while sitting. Blackstone has no sitting control. No additional sit/stand sounds were added.

All three variants use mob.strider.idle as their periodic ambient sound, with the standard ambient interval settings (value 8, range 16).

## Movement and overhead names

Crimson and Warped now use an animal runtime instead of the chest-minecart runtime that interfered with normal mob walking. Nameable is removed from all variants so naming interaction and nameable-driven display are disabled; the internal default name remains for the storage title. Native container layout, overhead-name behavior and locomotion must be checked in Bedrock for this runtime combination.

This build requires Bedrock 26.50+ (tested target: user version 26.52) and stable server 2.8.0 for the native container access events.

## Wild behavior and death XP

Untamed Crimson and Warped acquire visible player targets within four blocks. Their wild targeting group is removed upon taming, retaining normal pet following and defensive behavior. No group anger broadcasting is used. Blackstone flees players within eight blocks, moving at 1.5x walking or 2x sprinting speed, and has no attack or retaliation goals. Player-attributed kills award 10 XP for Crimson/Warped and 30 XP for Blackstone, using native XP rewards. Environmental deaths without player attribution award no XP, as in vanilla.

## v0.2.34 wild behavior, lava and spawn eggs

Creative eggs are explicit entity_placer items targeting the custom Skitterchest identifiers, replacing automatically generated eggs that could inherit the animal runtime’s spawning behavior. The internal animal runtime remains for native inventory/movement support; eggs do not target minecraft:horse.

All three can path through and across lava, do not treat lava as a forbidden damage block, do not sink, and have explicit lava movement speed 0.3. The sitting group overrides lava movement to zero. These settings follow the vanilla strider navigation pattern.

Lava buoyancy keeps them at the surface and allows stepping back onto land. The old generic jumping-in-liquid goal is removed so it does not compete with lava navigation. Buoyancy has no wave motion.
