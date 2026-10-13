# Village planning performance — v0.2.69

The supplied profile `profile_2026-10-13_15-07-19.jsr.2.0.cpuprofile` contains
36.11 seconds of sampled script time. Approximately 92.4% was beneath automatic
village generation, 54.3% beneath rigid footprint planning, and 21.2% beneath
site ranking (inclusive figures overlap). Repeated tick-counter reads in chunk
loading alone accounted for approximately 7.3% of self samples. These percentages
refer to captured script work, not total game CPU usage or frame rate.

## Optimizations without shrinking villages

- Cache block snapshots and floor queries only during a single read-only layout
  plan. Caches are bounded. Revalidation and placement use live world blocks.
- Schedule at most 24 generator steps / approximately 2 milliseconds per tick.
  One individual step cannot be interrupted, but new steps stop at the budget.
- Chunk loading and player-clearance waits suspend scheduled work for 2 or 20
  ticks instead of busy-yielding while repeatedly reading the current tick.
- Keep the same size targets, template weights, farm priority, road rules,
  terrain checks, three-house minimum and far-site support.

Representative flat-terrain tests preserve the entire placement/entity/block
write sequence, with these native getBlock calls (including live revalidation):

| Seed | Houses | Before | After | Reduction |
| --- | --- | --- | --- | --- |
| 2 | 7 | 307,879 | 35,885 | 88.3% |
| 123 | 10 | 316,424 | 43,748 | 86.2% |
| 7000 | 12 | 326,600 | 51,342 | 84.3% |

Both village styles are covered. This is a native-call benchmark, not an FPS
measurement. A fresh Bedrock CPU profile is needed to measure the actual gain;
engine terrain generation and loading still have a cost.

## Durable unsuitable areas

Only a fully loaded, completed village assessment may permanently reject an
area for unsuitable terrain or fewer than three fitting houses. The assessed
145×145-block horizontal footprint is saved in world dynamic properties. Future
automatic candidate centers and planned building footprints that intersect that
rejected area are skipped, even after excavation or world reload. Evaluation
still considers the whole village layout across chunk boundaries; chunks are
not independently labeled unsuitable. Spatial indexing is only an accelerator.

Missing chunks, load failures, player obstruction, existing-village spacing and
placement errors are deferred instead of being recorded as unsuitable terrain.
Manual test generation can still be requested explicitly. This policy begins
with assessments made by v0.2.69: failures from earlier versions were not saved
and cannot be reconstructed retrospectively. There is no automatic expiry for
rejected areas. Existing generated villages remain untouched.

## v0.2.70 idle work

The stationary follow-up profile attributes 77.3% of sampled script time to agriculture getAllPlayers and approximately 6.1% to village search. These are script samples, not total game CPU or FPS measurements.

Hoe targeting now tracks spawn, selected-slot, inventory-change and leave events. One startup enumeration initializes connected players. Per-tick targeting runs only for tracked hoe holders, with a cleanup pass after deselection. The direct interaction fallback remains.

Preliminary village rankings use a bounded 8,192-entry cache keyed by dimension, position and survey height. Eligibility is rechecked each search. Full planning and final placement still inspect current terrain. Missing central floors are not cached. This removes repeated successful preliminary surveys, while unfinished plans and deferred sites may still require work.

Regression tests verify no repeated idle enumeration/raycast, restoration after hoe deselection, and identical repeated survey results without additional block reads. In-game profiling is required to measure frame-time improvement.

## v0.2.71 fishing idle work

Fishing enumerates players once at startup; spawn and incoming-rod inventory events migrate legacy rod properties. Tick updates only process tracked active casts. All fish status effects and their update loop have been removed. Spawn/startup clears obsolete persistent effect timers. Native hunger and saturation values remain unchanged. Bobber motion, bite timing, particles and catch behavior are unchanged. FPS improvement still requires in-game measurement.

## v0.2.72 natural landmarks

Villages, manual templates and natural landmarks use a single budgeted queue. Only deterministic unchecked candidates are surveyed; unsuitable candidates are persisted, with temporary errors deferred. Surveys use native filtered block volumes in 16-block-wide strips, temporary section loads and sparse foundation anchors, instead of inspecting every block through JavaScript. Natural placement tiles are at most 16 by 16 horizontally, with two-tick pauses and saved progress. Manual templates retain their original sections. Village landmark exclusion records are loaded once per layout plan. Engine lighting/rendering work still requires in-game profiling.

## v0.2.73 shared giant discovery

Giants reuse persistent lava-surface observations from already-loaded village neighborhoods and distant survey footprints. Each sampled column is checked once per bounded session cache; missing reads are not remembered as dry terrain. Other sites use bounded coarse probes. Confirmed unsuitable giant search cells are persisted without excluding their entire region. Region structure completion remains unique.

All giant sizes are assessed before selection; incomplete checks defer selection. Assessments share a bounded 60,000-block snapshot cache and clear-volume proofs across sizes. Native volume strips align to world chunks so smaller contained checks can reuse clear results. Obstructed volumes are not assumed obstructed for smaller footprints. Final construction always validates live blocks. This preserves the job budget, chunk lease limits and shared queue.

## v0.2.74 regional comparison

Village placement waits for a bounded six-area comparison rather than committing to the first valid loaded area. Coarse connected-floor assessments are cached (maximum 512 sites), and complete layouts are still planned only as needed in ranked order. The shared work budget and temporary loading limits remain unchanged. This trades additional initial surveying for better regional site choice; actual FPS and wait time require client measurements.

## v0.2.75 terrain carving

Giant fitting checks now allow whitelisted natural terrain and partial islands, retaining filtered native-volume queries and shared size-assessment snapshots. Actual carving uses a native filtered fill in each existing 16-block tile, followed by template placement and supports. No per-block carving loop or new idle polling is added. Increased lighting/block-update work during carving still requires in-game profiling.
