# Underworld food buffs

All five foods apply a 20-minute bonus. Eating another replaces it; eating the same food refreshes it. One food bonus is active at a time, including shared Agility/Slayer bonuses. Expiry uses real elapsed time, including time offline, and saved player tags preserve the remaining duration across login or reload.

| Food | Doubled MineScape primary passive bonuses |
|---|---|
| Wickspit | Martial, Agility, Slayer |
| Gloamquill | Ranged, Agility, Slayer |
| Cragbake | Mining, Woodcutting, Excavation, Smithing |
| Murkbrew | Farming, Husbandry, Fishing, Cooking |
| Scarbisque | Enchanting, Alchemy, Trading |

The current earned bonus is doubled: 3% becomes 6%, 7% becomes 14%; an unearned 0% remains 0%. It uses current skill levels throughout the buff. Skill XP, levels, tiers, relic bonuses and separately unlocked secondary perks are unchanged. This modifies MineScape's existing calculations, rather than duplicating drop/combat events. It applies to activities already supported by MineScape; it does not add new activity integrations.

Foods retain their recipes, identifiers, gold names, textures and stack size 16. They restore 6 hunger points with saturation modifier 0.6 and take the normal 1.6-second eating duration. They can be eaten at full hunger so a buff can be replaced or refreshed.

## Installation

Import Underworld and the MineScape Food Buffs compatibility behavior pack. The compatibility pack updates the supplied MineScape 1.5.18 BP, retaining its UUID and existing player progression. It keeps the original dependency on the MineScape 1.5.18 resource pack, which must stay enabled. The compatibility BP uses import version 1.5.19 to allow replacement; it is a compatibility build of 1.5.18, not an official MineScape release. Do not enable a second copy of MineScape's behavior pack.

The original uploaded MineScape has no food multiplier hook; importing only Underworld will not alter its passive calculations. Keep this patch when testing food bonuses.

## Verification

`/scriptevent jagsby_nether:food_buff_status` shows the active food and remaining duration.

`/scriptevent passiveskills:food_buff_status` in the compatibility BP shows actual base and effective percentages for every skill. Compare before/after consumption, food replacement and expiry. The optional MineScape compatibility layer keeps cached per-player state, refreshing only on consumption/login or this command; expired multipliers revert to 1 during existing perk queries. No new recurring timers or player scans are added.

## Rebuilding compatibility

Run `python3 tools/build_minescape_food_patch.py /path/to/MineScape_v1.5.18.mcaddon` before the Underworld test/build. The tool verifies the original manifest and expected perk functions, preserves all other original BP entries byte-for-byte, and records the source hash. Original MineScape assets/credits remain in the pack.
