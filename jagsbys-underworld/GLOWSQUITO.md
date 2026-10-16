# Glowsquito and Glowhusk — v0.2.113

Glowsquito imports only the user-supplied Infernal Expansion visual design: the original normal/glow textures and converted ten-part Java model with its constant wing flapping. No Java gameplay, sounds, other mobs, items, structures or biomes are imported. The separate pollen sac is a Bedrock visual extension. Apache-2.0 attribution, hashes and model reference are bundled in `docs/glowsquito/`.

Glowhusk currently uses vanilla Shroomlight artwork on a cube. Glow Wax uses the vanilla Honeycomb icon. These are temporary placeholders; no existing vanilla or Underworld textures are replaced.

## Playing and testing

- Summon `/summon jagsby_nether:glowsquito`, or use its creative spawn egg.
- Wild natural spawn weights are **3 in Warped Forest** (groups 1–2) and **1 in Crimson Forest** (single mobs). Both density limits are 4. Weights are relative to other eligible animal entries, not absolute spawn percentages. No other biome rules are added and no Glowhusks generate naturally.
- Glowsquitos have 10 HP, retaliate for 1 damage, and defend their assigned colony after uncalmed harvesting. They have no poison or post-attack death. Native flight/wandering, Glowstone Dust temptation/breeding and fungus-seeking goals are used. Breeding cooldown is 300 seconds; babies mature in 1,200 loaded seconds and cannot pollinate or claim a hive. Player-bred babies are persistent, so a deliberate colony expansion is not lost to distance despawning.
- Craft Glowhusk with Nether planks across the top/bottom rows and Glowstone Dust / Shroomlight / Glowstone Dust in the middle. All 64 mixed Crimson/Warped plank combinations are supported; Overworld planks are excluded.
- Adults discover Glowhusks within 16 blocks through native movement and a bounded, loaded-block lookup on spawn/load or completed pollination. Placing a hive also assigns nearby homeless adults with one filtered entity query. Native return movement runs first; arrival within two blocks or a stalled 20-second pollen return safely enters the assigned loaded hive without replacing the actor. Adults discover Glowhusks within 16 blocks and each hive reserves at most three unique residents. An assigned Glowsquito is persistent and generally stays within 16 blocks; native wandering is supplemented by rare boundary corrections. A wild Glowsquito does not need a hive and continues seeking fungi normally.
- Native fungus seeking stays at Crimson or Warped Fungus for 20 seconds and signals pollen collection. The fungus is never removed or modified. Returning to the assigned hive deposits one unit, capped at five. Residents rest hidden inside for 30 loaded seconds, then exit into a free neighboring air block. Blocked/unloaded exits retain the original resident for retry.
- Five deposits make a Glowhusk harvestable. Use shears for **one Glow Wax**, resetting the level to zero; shears respect Creative and Unbreaking. Early shearing gives nothing. Glow Wax + Redstone Dust crafts **two Gunpowder**. No ordinary drops or recipes are overridden.
- A lit campfire or soul campfire on the same column within five blocks beneath the hive calms harvesting, unless a solid block interrupts its smoke. Colony members otherwise become angry for 25 seconds.
- Look at a hive and run `/scriptevent jagsby_nether:glowhusk_status` to read its wax level and assigned occupancy. v0.2.112 installs this diagnostic before mob subscriptions, acknowledges missed targets, and reports subscription/raycast failures in chat. Spawn/load subscriptions use their supported single-argument signatures.

## Persistence and performance

Custom blocks cannot be given vanilla beehive block-entity storage through the public block component catalog. This implementation therefore uses native mob AI plus custom-block entity callbacks. Each resident remains the **same live entity** inside the hive; no remove/respawn serialization cycle is used. Hive assignments are stored in world dynamic properties, resident home/pollen/inside phase in entity dynamic properties, and production in the saved block state.

Confirmed deaths release their slot. Unloading does not release slots or cause replacement entities to spawn. Destroying a hive releases loaded residents and invalidates its home token; an unloaded resident becomes homeless when it reloads, without attaching to a replacement hive at the same coordinates. Native hive entry targets are not unique custom-home coordinates, so arrival at another Glowhusk is corrected to the assigned hive; there is no continuous script flight steering.

No global entity, block or dispenser scans are scheduled. One 40-tick timeout exists only while loaded assigned or pollen-carrying Glowsquitos need work, processing at most four per callback. Empty worlds/wild non-pollen mobs have no colony timeout chain. Stored residents temporarily use a housed-only family so ordinary mob-targeting goals do not select them. Hidden residents use their native 30-second timer, not scripted occupancy polling. Unloading removes active references without deleting persistent assignments.

Pollen-carrying adults have a small chance of advancing nearby Sorgum, Grollet stems or Scarberry bushes by **one** stage. Checks happen only during the bounded active callback and only after the chance succeeds. Existing Nether/soil requirements and reduced dry-soil rate remain; mature/attached crops, Polyps and other dimensions are excluded. Disabling mobGriefing also disables this assistance.

## MineScape compatibility

Successful manual collection emits MineScape v1.5.18's existing `minescape:apiary_harvest` hook with count one and the collecting player's ID. MineScape applies its configured honeycomb Husbandry XP and existing modifiers. No MineScape files or dependency are changed. Without a receiver it has no gameplay effect. Full-inventory overflow drops the wax normally but emits no collection XP. There is no dispenser XP path.

## Technical limits in this version

- **Dispenser shearing is not implemented.** Native dispensers do not expose a cancellable custom-hive shearing action. Simulating a neighboring dispenser through redstone could race native shears ejection; no scanning or unreliable duplicate harvest workaround is added.
- **Occupied Silk Touch relocation is not implemented.** The public custom-block API cannot safely transfer these live resident entities into an inventory item while preserving all native breeding/entity state across unloaded chunks. Breaking with Silk Touch follows the same safe release policy as other tools: residents remain alive/homeless and the native loot table drops one empty Glowhusk. Production is not carried in the dropped item. Glowhusks are piston-immovable to protect coordinate-based home ownership. No colony cloning/respawning workaround is used.
- Direct operator entity removal can leave a conservative reservation because the remove event also covers unloading. Confirmed deaths free slots; breaking/replacing the hive resets its assignments. Unknown missing IDs are never assumed dead.

## Verification status

Automated checks cover asset scope and hashes, model parts, native behavior definitions, forest spawn rules, all recipe variants, capacity/identity, pollen cycle guards, harvest reset/durability/XP, campfire smoke, inventory overflow/delivery failure, reload persistence, unloaded/blocked exits, destroyed/replaced homes, confirmed deaths, boundary work and valid crop stages.

There is no Bedrock client in this workspace. **Native spawning, flight, breeding, pollination goal timing, custom-block onEntity callbacks, sleeping/render visibility, actual chunk reload ordering, block-break/explosion callbacks, shaders and MineScape XP delivery remain live-unverified.** Automated mocks do not prove native occupancy works. Before relying on colonies on a Realm, test eggs and natural spawns, both fungi, full colonies, several save/reload/unload cycles, blocked exits, ordinary/Silk Touch breaks, explosion release, campfire harvesting, full inventory and the Content Log.
