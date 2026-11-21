# Decisions (blueprint phases 0–4, Nov 2026)

1. **No Vite/TypeScript migration yet.** The blueprint prefers it, but also says "extract, do not rewrite blindly". The app stays one static HTML built from `tools/*.js` by `build.sh`, so the 64 original checks keep guarding visual and rewind parity. Simulate and Report are separate source files, which is the seam a later module split would use.
2. **Cold open = the reviewed NACA → NASA event**, played in the reviewed slice, then a choice: Replay, Explore history (continues the full archive from 1 Oct 1958), Enter simulation. `?intro=0` or any deep link skips it. Reduced motion shows the settled keyframe with a text summary.
3. **History starts at 1 Jan 1775** (was July 1774). Units whose start is a records span before 1775 are still shown, but the dossier says "records coverage begins", never a founding date.
4. **Quarantine, don't delete.** 16 units classed as record collections or territorial/foreign governments are hidden from the arena by default (Layers → Quarantined entries shows them). Classes are rule-based from names and labelled "inferred".
5. **Families, not proximity.** Wide-zoom clusters group units by recorded parent chain at that date, are drawn as dashed contours, and are labelled as a visual grouping. They dissolve into real cells by zoom 0.16.
6. **Review tag follows the displayed record.** The on-record row looks 1.2 years ahead; the REVIEWED / DRAFT tag always describes the record whose title is shown.
7. **Satire is a second channel.** Desk commentary appears in its own labelled row (and box on cards), only on some beats, and is never mixed into on-record text.
8. **Simulate scope**: 3 scenarios, 6 archetypes, 6 pellet types, 3 abilities (Task Force, Transfer Functions, Reorganization Plan), 12–16 rivals with a utility AI. Names are fictional. Balance is first-pass, not tuned.
9. **Report scope**: PNG cards only. Video export, keyframe editing and a storyboard timeline are not built.

## Not done yet (next most useful)
- Re-audit the three reviewed stories' participant sets against primary sources (DOE still shows only the ERDA lineage and says so on the card).
- Mobile bottom sheets with snap points (current phone layout uses the existing overlays).
- Data chunking out of the inline `HIST` literal; performance profiling at 2026 overview.
- Accessible DOM list of visible institutions alongside the canvas.
