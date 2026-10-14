# Performance — current v0.2.101

Current scheduling separates idle work from active jobs. Villages, natural landmarks, manual templates and encounter migrations share a budgeted generation queue: up to 24 generator steps/about 2 ms per callback. A native operation inside one step cannot be interrupted and can still cause lighting, terrain-loading or rendering work.

- Agriculture avoids hoe/raycast work for players who are not holding a hoe.
- Fishing tracks active casts rather than performing idle fishing work for every player.
- Terrain reads are bounded per-plan snapshots; final placement uses current blocks.
- Region comparisons and surveyed columns use bounded caches; incomplete terrain is not stored as permanently unsuitable.
- Known landmark spacing exclusions are filtered before terrain surveys/chunk loading.
- Trial protection is event-based. Crowding assignments are baked offline. One encounter-revision comparison runs on world load; changed data starts a finite recorded-site migration, not a recurring scan.
- Soul-light suppression searches only when an applicable hostile entity spawns.
- Villager custom crop/food support and pet/storage/nugget systems still have their own loaded-entity scheduling. The addon is not entirely event-only.

Villages retain their current four-house/one-small-farm minimum and 256-block center spacing. Permanently unsuitable village areas remain unsuitable after mining; incomplete/player-blocked assessments defer. Giant surveys require every starting footprint to be over lava with clear volume and finish all three assessments before equal selection. Optional fortress carving and loading are budgeted active work.

The latest gameplay build passed 365 automated checks. This is not a current FPS or total CPU measurement. Fresh Bedrock stationary, exploration, generation and multiplayer profiles are still needed to measure the present workload and native-engine costs.

## Historical measurements

The original profile analysis and native-call benchmark tables are retained in [history/PERFORMANCE.md](history/PERFORMANCE.md). They measured earlier versions. Inclusive script-sample percentages overlap and do not equal total game CPU usage; native-call reductions do not directly translate into a promised FPS increase.
