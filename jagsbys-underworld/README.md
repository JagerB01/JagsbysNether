# Jagsby's Underworld v0.1.0

Combined test build of Nether Settlements v0.8.24 and Nether Agriculture v0.1.6.
One `.mcaddon` imports one behavior pack and one resource pack. A single script
entry point loads both subsystems exactly once. Stable `@minecraft/server` 2.0.0
and Bedrock 1.21.100 or newer are required; no Beta APIs are needed.

Activate **Jagsby's Underworld v0.1.0 Behavior** and **Resources** together.
Deactivate the separate Nether Settlements and Nether Agriculture packs so
scripts do not run twice. The user-supplied cover is installed as `pack_icon.png`
in both packs when the original PNG file has been provided.

Use a new test world for the first combined test on Bedrock 26.52. To test an
existing world, use a copy, remove the old active packs and activate both new
packs. Original `nether_settlements` and `jagsby_nether` identifiers are preserved
so existing crops, items and structure identifiers remain recognizable.
The combined packs use new UUIDs to permit the requested v0.1.0 version alongside
the higher-version standalone releases. Old village-generation seed/spacing
records are scoped to the old behavior-pack UUID and do not automatically
transfer. Existing village blocks and entities remain, but the new generator
cannot use the old pack's village index. Full existing-world migration has not
been verified; use a new world to evaluate this first combined build.

The merge keeps the existing gameplay: 20% smooth-basalt road/center selection,
piglin defenders with invisible names, gradual farmland heating, dry-soil crop
growth, native tilling/fertilizer handlers and Grol-o’-Lantern naming. Empty fully
cooled plots revert after about 30 loaded seconds; planted and lava-protected
plots stay tilled. Village farms still use their existing crops. This merge does
not change their planting to Sorgum, Polyps or Grollet.

Commands remain:

```mcfunction
/scriptevent jagsby_nether:kit
/scriptevent nether_settlements:test crimson
/scriptevent nether_settlements:test warped
/scriptevent nether_settlements:find village
```

See [TESTING.txt](TESTING.txt) for the combined in-game checks.

## Build

The builder combines the exact checked-in standalone release archives. It checks
archive paths/collisions, preserves source scripts/assets byte-for-byte (scripts
move into separate subfolders), verifies pack references, and runs the existing
crop tests plus combined startup/command tests. Generated merged source is in
ignored `.build/behavior_pack` and `.build/resource_pack` for inspection.

Place the original supplied square PNG at `jagsbys-underworld/pack_icon.png`, then:

```sh
cd jagsbys-underworld
python3 tools/build.py
```

This writes `downloads/Jagsbys_Underworld_v0.1.0.mcaddon`. The cover is copied
unchanged into both packs. For local verification while the original icon is
unavailable, `--allow-placeholder-icon` produces an explicitly marked local build
inside `.build/`, never a release download. Original source licenses and credits
remain bundled; see [CREDITS.txt](CREDITS.txt).
