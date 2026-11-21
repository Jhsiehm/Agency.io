# Agency.io

U.S. federal agencies as cells, from 1775 to 2026, inside a very serious observation desk. Static site: `index.html` is the whole app (no build step to serve it, no backend, no keys).

**Three modes**

- **Observe**: the historical archive. Opens on a reviewed featured event (NACA → NASA, 1958), then the full history 1775–2026 or the reviewed slice 1958–1977. Speeds −1× to 25×. Layers: institution families at wide zoom, uncertainty rims, quarantined entries.
- **Simulate**: a fictional sandbox. Pick a scenario and an agency archetype, steer with pointer/finger/WASD, collect six resource types, use Task Force / Transfer Functions / Reorganization Plan, survive oversight hearings. Seeded and replayable. Nothing here touches the archive.
- **Report**: briefing cards (16:9 and 9:16 PNG) for a reviewed story, the current archive moment, or the last simulation run. Satire is always a separate, labelled line.

**Links**: `?date=1958-10-02&entity=u-rg255` · `?story=naca-nasa|aec-split|erda-doe` · `?mode=simulate&scenario=jurisdiction-grab&seed=12345&agency=research` · `?mode=report&story=naca-nasa&format=vertical` · `?intro=0` skips the cold open.

**Data honesty**: everything in the full history is the census v0.2 **draft** unless marked Reviewed (3 events). See `docs/data-caveats.md` (generated) for coverage, classification and caveat counts. Cell size is a visual model, not budget, staff or legal power.

## Rebuild
1. `python3 -I tools/compile_history.py <dataset_dir> tools/hist.js`
2. `python3 -I tools/validate_census.py tools/hist.js docs` (exits 1 on hard errors; `--selftest` checks the rules)
3. `sh tools/build.sh && cp tools/index.html index.html`

## Tests (Playwright)
- `node tests/acceptance.test.js`: original 64 checks (slice, full history, speeds, reverse == seek).
- `node tests/blueprint.test.js`: 51 checks for cold open, provenance, LOD, Simulate determinism, Report export, deep links, phone layout.
