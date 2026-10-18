# Underworld v1.0.0 — Realm operations and future testing

Activate the v1.0.0 behavior and resource packs together. Pack UUIDs, item/entity
identifiers and saved structure/storage records are unchanged. Existing buildings
are not rebuilt. The first v1.0.0 world load clears a leftover `next_giant` test
choice once; in-progress construction is preserved. Later explicit admin choices
continue to work normally.

Food skill multipliers still require `MineScape_v1.5.18_Underworld_Food_Buffs.mcpack`
and MineScape's original RP. Use that BP instead of a second original MineScape BP.
Disable standalone Nether Settlements/Agriculture and original Dungeons/five-mob
test packs when Underworld supplies the same content. C&C v1.1.0 can remain active.

## Normal play

Combat tracing and health measurements start disabled and reset on world reload.
Diagnostic hurt listeners are absent until requested. Gameplay safety, damage,
spell triggers, migration, unload recovery and chunk-loading checks remain active.
Real errors still reach the Content Log; startup test-kit advertising is removed.
Development history stays in the repository instead of the release archive.

## Read-only diagnostics

```mcfunction
/scriptevent nether_settlements:status
/scriptevent nether_settlements:find village
/scriptevent jagsby_nether:structures_status
/scriptevent jagsby_nether:structures_diagnostics
/scriptevent jagsby_nether:structures_find
/scriptevent jagsby_nether:encounters_status
/scriptevent jagsby_nether:lords_status
/scriptevent jagsby_nether:glowhusk_status
/scriptevent jagsby_nether:food_buff_status
```

Status commands perform work only when invoked. `lords_status` always reports
current loaded bosses, phases and caught errors; event/teleport/projectile counters
are collected only after tracing is enabled. Glowhusk status needs a hive in view.

## Opt-in combat measurements

```mcfunction
/scriptevent jagsby_nether:lords_trace on
/scriptevent jagsby_nether:lords_status
/scriptevent jagsby_nether:lords_trace off
/scriptevent jagsby_nether:boss_damage_watch on
/scriptevent jagsby_nether:boss_damage_watch off
```

`lords_trace status` and `boss_damage_watch status` do not enable collection.
Turning tracing off clears its counters and removes its hurt listener. Health
measurement listeners are removed when the last observer disables them or leaves.
Neither tool adds a polling interval or changes combat damage.

## Explicit admin/test actions

These commands alter the world or supply items; they remain available for future
testing and repairs and do not execute automatically:

```mcfunction
/scriptevent jagsby_nether:kit
/scriptevent jagsby_nether:fishing_kit
/scriptevent nether_settlements:test crimson
/scriptevent nether_settlements:test warped
/scriptevent jagsby_nether:template list
/scriptevent jagsby_nether:next_giant mega_fortress
/scriptevent jagsby_nether:next_giant clear
/scriptevent jagsby_nether:encounters_update
```

`next_giant` also accepts `dragon_arena`, `large_arena` and `status`; all normal
placement requirements remain in force. Manual template placement and older
manual encounter registration are described in [ARENAS.md](ARENAS.md). Encounter
repairs can reset affected spawner encounter/cooldown state; they preserve saved
positions and do not recreate player-removed blocks.

Keep automated tests/build tools in the repository for future changes. The
`.mcaddon` contains the two playable packs, current reference documents, credits
and licenses. Native trial completion, combat/rendering and Realm performance
require in-game checks; see [TESTING.txt](TESTING.txt).
