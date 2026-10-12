# Skitterchests — v0.2.36

Models, textures and original movement animations are adapted from the supplied
NetherPlus Add-on MA v3 by BubbleStudio and MarcoGamer. Only its three chest pets
and their visual dependencies are included. See SKITTERCHESTS_SOURCE.json.

| Variant | Habitat | Wild behavior | Player-kill XP |
| --- | --- | --- | --- |
| Crimson | Crimson Forest | Attacks visible players within 4 blocks | 10 |
| Warped | Warped Forest | Attacks visible players within 4 blocks | 10 |
| Blackstone | Nether Wastes and Basalt Deltas | Flees players within 8 blocks | 30 |

Crimson/Warped tame with Netherite Scrap (1/3 chance). Blackstone cannot be tamed
and has no accessible storage. None can be ridden or bred. All use explicit
custom spawn eggs and custom entity rendering, with no horse/minecart runtime
inheritance. Automatic overhead names are removed, including labels from older
builds when entities load. Blackstone is not included in storage interaction.

## Controls and storage

Stand and use Netherite Scrap to tame wild Crimson/Warped. Once tamed:

- Stand and interact to open the custom 27-slot storage menu.
- Select a stored stack to withdraw it into your inventory.
- Choose Store item, then select an inventory stack to deposit it.
- Crouch and interact to toggle sitting/standing.

The menu title is Skitterchest. This is an action-form menu, not the vanilla
chest grid; the user approved this replacement to remove the runtime workaround.
The same underlying 27-slot entity inventory is retained for existing contents,
native death drops and persistence. Transfers preserve item data and leave
unaccepted quantities in their source slots. Stale selections are rejected.
Each player can have only one storage session active. The menu checks distance
and dimension between operations. Sitting smoothly retracts the legs, settles
the body onto the ground and stops both land and lava movement.

## Sounds and lava

Ambient: strider idle. Hurt: glow squid. Death: nautilus. The full user-selected
LargeMeat.wav/RawLargeMeat.wav clips from Eating Animations And Sounds SE V1.9.4
are converted to Ogg for opening/closing the storage menu. Source paths and hashes
are in docs/skitterchests/SOUND_SOURCE_METADATA.json. No global sounds are changed.

All variants are fire immune, actively avoid lava and do not plan paths through it. If pushed in, they remain fire immune and buoyant. No riding or breeding components are present.

## Playtest

Test fresh eggs and existing pets: chest model, no overhead name, land/lava
movement, wild behavior, taming, standing storage, item deposit/withdraw and
crouching sit/stand. Confirm stored items persist and drop on death, with 10/30 XP
for player-attributed kills. GUI presentation and gameplay require Bedrock testing.
Requires Bedrock 26.50+, stable server 2.8.0 and stable server-ui 2.0.0; target
user version is 26.52.

Standing explicitly restores movement, lava movement and jump components after the sitting group is removed. Loaded tamed pets marked as standing receive the repair event.

One-block traversal uses explicit navigation can_jump, normal jump power 0.42 and a one-block auto-step height. Sitting sets stepping to zero; standing restores jumping and stepping explicitly.
