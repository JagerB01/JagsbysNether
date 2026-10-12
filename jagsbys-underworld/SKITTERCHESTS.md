# Skitterchests — v0.2.30

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
walking and jumping. The chest-minecart runtime supplies the container
interaction; custom mob navigation remains in place, with no riding component.

## Opening and closing sounds

The exact user-selected clips from Eating Animations And Sounds SE V1.9.4
(Nexus mod 42602) are registered as:

- LargeMeat.wav → jagsby_nether.skitterchest.open
- RawLargeMeat.wav → jagsby_nether.skitterchest.close

They are mapped to the native chest.open and chest.closed sound events on
Crimson and Warped only. Full clips are preserved, converted to mono Ogg Vorbis
without changing duration, pitch or speed. No global vanilla chest sounds are
replaced. Original paths and SHA-256 hashes are in
resource_pack/docs/skitterchests/SOUND_SOURCE_METADATA.json.

## Playtest

Confirm wild mobs and Blackstone cannot open storage, tame Crimson and Warped,
then check standing sit/stand, crouching storage, both selected sounds, inventory
persistence and natural spawning. Native container interaction and sound-event
routing require verification in Bedrock; the cloud environment has no game
runtime. Spawn rules preserve source weights/difficulty ranges, except Crimson
can spawn on crimson nylium, correcting the source's exclusion of its own floor.

All three variants use the built-in mob.glow_squid.hurt sound when hurt and mob.nautilus.death sound on death, at normal pitch. Blackstone has no storage sounds.

## Storage title

Unnamed Crimson and Warped receive the default name Skitterchest on spawn, chunk load and initial script startup, so the native container uses that title. Player-applied names remain intact; ordinary chest minecarts are not renamed. Sitting/standing feedback is unchanged pending the user’s choice.
