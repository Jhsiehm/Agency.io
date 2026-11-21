# Handoff notes for the next engineer

- `index.html` is generated. Edit `tools/src.html` (desk, reviewed slice) and `tools/full.js` (full-history engine), then run `sh tools/build.sh` from `tools/` and copy `tools/index.html` to the root.
- `tools/hist.js` is compiled data: `python3 -I tools/compile_history.py <dataset_dir> tools/hist.js`. The dataset (census v0.2-draft, `core/graph.json` sha256 c44c1d1e…) is not in this repo.
- Data overrides (operations dates for NASA 1 Oct 1958, ERDA/NRC 19 Jan 1975, DOE 1 Oct 1977) live in `compile_history.py` (`OPS`, `DOE_OPS`). Fix data there, not in the HTML.
- History is a pure function of the date (`hCells(y)`, `hAuto(y)`); reverse play and seeking must stay equivalent. `window.FC` and `FC.full` are the test hooks.
- Tests: `node tests/acceptance.test.js` (Playwright; 64 checks, last run all passing).
- Known draft-data gaps: War Department and National Military Establishment have no end date; 3,896 undated units are excluded; level-6 bodies with no end are retired after 4 years as a display rule.
