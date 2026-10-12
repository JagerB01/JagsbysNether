# Soul-light spawn protection — v0.2.53

Soul torches protect a 12-block radius; soul lanterns protect a 16-block radius;
lit soul campfires protect a 20-block radius. Extinguished soul campfires
and ordinary campfires provide no protection.
The radius is a sphere measured from the light’s block center to the mob’s spawn
position, including vertical distance. Wall-mounted soul torches and hanging
soul lanterns use the same Bedrock block IDs and qualify. Protection works
through walls, in all dimensions, and with existing lights. Ordinary torches and
lanterns do not provide this protection.

The script subscribes only to entitySpawn. It has no interval, player-area
patrol, startup scan, placement cache or entityLoad cleanup. Each newly spawned
hostile triggers one native filtered block-volume lookup for soul lights, then
checks distances only to matching light blocks. Bounds are clipped to the world’s
height range, and unloaded chunks are skipped. Placing/removing a light affects
the next spawn immediately. Lights must be in loaded blocks to be found.

Stable Bedrock has no cancellable before-spawn event. The callback therefore
removes the mob immediately after it spawns, using remove() rather than killing
or damaging it. Rejected mobs give no death loot or XP. Existing mobs are not
removed. Natural spawns, mob-spawner spawns, spawn eggs and commands all trigger
the same protection; Bedrock’s generic spawn event does not distinguish them.

All vanilla hostile/monster-category mobs are covered, including hoglins and
Nether mobs such as endermen and piglins. Add-on mobs in the monster type family
also qualify; custom add-ons that omit that family cannot be identified reliably
from their AI using the stable API. Wild Crimson/Warped Skitterchests are explicitly
covered. Tamed creatures are exempt. Blackstone Skitterchests flee rather than
attack, and Hongos are passive; neither is blocked. Villagers, players, items and
other passive entities do not trigger the light search.

Automated tests cover boundary distances, vertical/diagonal range, ordinary
lights, passive/tamed exemptions, hostile add-on families, current block reads,
world-height limits, event-only operation and no use of kill/damage/item drops.
Bedrock checks: compare a zombie spawner inside/outside each range, try wall
torches/hanging lanterns, remove a light and retest, and confirm existing mobs
and tame pets are left alone. The API removes after spawning, so a brief client
spawn flicker remains possible and needs in-game observation.
