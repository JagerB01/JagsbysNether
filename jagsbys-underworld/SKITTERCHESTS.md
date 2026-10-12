# Skitterchests — v0.2.37 native-screen test build

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
standing state. No player riding is enabled. Neither pet nor helper is assigned
an overhead name. The native title may still use its default Minecart with Chest
label; title customization is secondary to verifying the real inventory screen.

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

Only this native-screen integration is new. Untamed Crimson/Warped retain their
4-block hostile detection range and 10 XP player-kill reward. Blackstone flees
within 8 blocks and gives 30 XP. Lava avoidance, fire immunity, one-block traversal,
retracting legs, no breeding and no riding remain in place. Netherite Scrap tames
Crimson/Warped with a 1/3 chance. Ambient/hurt/death use strider, glow squid and
nautilus sounds. Real container access events play the selected LargeMeat.wav and
RawLargeMeat.wav clips. Models and animations originate in the supplied NetherPlus
archive; provenance and sound hashes are in docs/skitterchests.

## Required in-game checks

This environment cannot run the Bedrock client. The native inventory backend is
the same container type previously confirmed to open in-game, but the hidden
helper and interaction overlap require an actual client check. This is a native
screen test build, not a claim of verified gameplay restoration.

1. Tame a fresh Crimson/Warped. Confirm custom model, movement and no visible helper.
2. Stand and interact: confirm Minecraft's actual chest grid, player inventory,
   drag/drop/stacking and normal controller behavior, with no ActionForm list.
3. Crouch and interact: confirm sitting/standing and movement afterward.
4. Confirm existing contents migrate once, persist after reload, and drop once on death.
5. Hit the chest: confirm its health, hurt/death sounds and XP are correct.
6. Test multiple viewers, native open/close sounds and resuming motion after closing.

Requires Bedrock 26.50+ and stable server 2.10.0 (target: user version 26.52).
No server-ui dependency, horse runtime on the mob, or custom storage menu remains.

The helper’s unique skin marker 99137 selects zero client render scale, including the inherited vanilla chest-minecart client definition. Normal chest minecarts retain scale 1. This does not shrink the server interaction hitbox or assign an overhead name. Invisibility potion effects are not required.
