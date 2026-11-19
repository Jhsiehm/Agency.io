# Agency.io

U.S. federal agencies as Agar.io cells, from 1775 to 2026. Static site: `index.html` is the whole app (no build step to serve it).

- Full history tour: 4,005 dated agencies from the Statecraft census v0.2 draft (unverified except three reviewed events).
- Reviewed slice 1958–1977: NACA → NASA, the AEC split, ERDA → DOE, with checked operations dates.
- Speeds: −1×, 0.1×, 0.5×, 1×, 1.5×, 2×, 25×.

## Rebuild
`python3 tools/compile_history.py <dataset_dir> tools/hist.js`, then `sh tools/build.sh` and copy `tools/index.html` to the root.

## Tests
`node tests/acceptance.test.js` (Playwright).
