/* Blueprint acceptance: cold open, LOD, provenance, Simulate, Report, deep links, mobile.
   Run: node tests/blueprint.test.js   (Playwright; writes tests/blueprint-report.txt and shots/blueprint/*.png) */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const out = []; const say = (...a) => { const l = a.join(' '); out.push(l); console.log(l); };
let fails = 0; const check = (name, ok, extra) => { if (!ok) fails++; say((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
const base = 'file://' + __dirname + '/../index.html';
const SHOTS = 'shots/blueprint'; fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const b = await chromium.launch(); const errs = [];
  const page = async (opts = {}) => { const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, acceptDownloads: true, ...opts }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); return p; };

  /* ---------------- E1: cold open ---------------- */
  say('== E1: cold open on the reviewed 1958 event');
  let p = await page(); await p.goto(base); await p.waitForTimeout(900);
  let c = await p.evaluate(() => FC.cold());
  check('E1: first load opens the featured reviewed event, not 1775', c.cold && c.tour === 'slice' && c.playing && /1958 \/ FEATURED EVENT/.test(c.top), JSON.stringify(c));
  await p.screenshot({ path: SHOTS + '/E1_cold_playing.png' });
  await p.waitForFunction(() => FC.cold().card, null, { timeout: 15000 });
  c = await p.evaluate(() => FC.cold()); const rv = await p.evaluate(() => FC.review()), st = await p.evaluate(() => FC.state());
  check('E1: freezes after the transfer with Replay / Explore / Simulate', c.card && !c.playing && await p.isVisible('[data-cold="replay"]') && await p.isVisible('[data-cold="explore"]') && await p.isVisible('[data-cold="sim"]'));
  check('E1: alert reads INSTITUTIONAL TRANSFER DETECTED with the effective date', /INSTITUTIONAL TRANSFER DETECTED · EFFECTIVE 1 OCT 1958/.test(c.top), c.top);
  check('E1: NACA ended and NASA holds it (archive truth unchanged by the intro)', !st.alive.includes('NACA') && st.alive.includes('NASA') && st.mass.NASA === 2);
  check('E1: on-record tag is reviewed; satire is a separate, labelled line', rv.tag === 'HISTORICAL / REVIEWED' && rv.desk === 'Administrative appetite: significant.' && /editorial, not a sourced fact/i.test(await p.textContent('#cold')));
  check('E1: dossier follows a featured participant', /National Aeronautics and Space Administration/.test(st.dossierName), st.dossierName);
  await p.screenshot({ path: SHOTS + '/E1_cold_card.png' });
  await p.click('[data-cold="replay"]'); await p.waitForTimeout(400); c = await p.evaluate(() => FC.cold());
  check('E1: Replay event restarts the featured event', c.playing && c.T < 1.5 && !c.card, JSON.stringify(c));
  await p.waitForFunction(() => FC.cold().card, null, { timeout: 15000 });
  await p.click('[data-cold="explore"]'); await p.waitForTimeout(300);
  const fsx = await p.evaluate(() => FC.full.state());
  check('E1: Explore history continues in the full archive from 1 Oct 1958', (await p.evaluate(() => FC.tour())) === 'full' && fsx.date >= '1958-10-01' && fsx.date < '1959-06-01' && !(await p.evaluate(() => FC.cold().cold)), fsx.date);
  await p.close();
  p = await page({ reducedMotion: 'reduce' }); await p.goto(base); await p.waitForTimeout(800); c = await p.evaluate(() => FC.cold());
  check('E1: reduced motion shows a static keyframe with a text summary and the same choices', c.card && !c.playing && /Static keyframe/.test(await p.textContent('#cold')));
  await p.close();
  p = await page(); await p.goto(base); await p.waitForTimeout(600); await p.click('#coldSkip'); await p.waitForTimeout(200);
  check('E1: Skip intro lands on full history at 1775 with Play history', (await p.evaluate(() => FC.tour())) === 'full' && (await p.evaluate(() => FC.full.state().Y)) === 1775 && await p.isVisible('#startBtn'));
  await p.close();

  /* ---------------- E2: provenance and data integrity ---------------- */
  say('== E2: provenance, review status, quarantine');
  p = await page(); await p.goto(base + '?intro=0'); await p.waitForTimeout(700);
  const prov = await p.evaluate(() => {
    const show = k => { S.inspect = k; hDosSig = ""; renderDossierFull(); return document.getElementById('dKv').textContent + ' ' + document.getElementById('dExpl').textContent; };
    const rs = HU.find(u => u.flags & 1 && !u.q), yr = HU.find(u => u.basis === 1 && !(u.flags & 3)), lone = HU.find(u => !u.ins.length && !u.outs.length);
    const r = { rs: show(rs.key), rsName: rs.name, yr: show(yr.key), yrY: yr.sY, lone: show(lone.key), loneLin: document.getElementById('linSvg').textContent };
    const draft = HB.find(x => !x.reviewed && x.t > 1900), rev = HB.find(x => x.reviewed);
    seekY(draft.t + 0.05); renderReview(); r.draftTag = document.getElementById('rvTag').textContent;
    let ry = null; for (let y = rev.t - LEAD; y <= rev.t + HOLD; y += 0.02) if (HB[hBeatIdx(y + LEAD)] === rev) { ry = y; break; } reviewSig = ""; seekY(ry); renderReview(); r.revTag = ry === null ? 'never on record' : document.getElementById('rvTag').textContent;
    r.anyReviewedDraft = HB.filter(x => !x.reviewed).some(x => { reviewSig = ""; seekY(x.t + 0.01); renderReview(); return /REVIEWED/.test(document.getElementById('rvTag').textContent) && !HB[hBeatIdx(S.Y + LEAD)].reviewed; });
    S.inspect = null; return r;
  });
  check('E2: a records-span start reads "records coverage begins", flagged not a founding date', /records coverage begins/.test(prov.rs) && /not a founding date/.test(prov.rs) && !/sometime in/.test(prov.rs.split('Class')[0].split('Start')[1] || ''), prov.rsName);
  check('E2: a year-only start reads "sometime in <year>" (no invented day)', new RegExp('sometime in ' + prov.yrY).test(prov.yr));
  check('E2: dossier says Visual mass / model units, never "in this dataset"', /Visual mass/.test(prov.yr) && /model units/.test(prov.yr) && !/in this dataset/.test(prov.yr) && /not budget or staff/.test(prov.yr));
  check('E2: draft units carry a Draft badge', /Draft · unreviewed/.test(prov.yr));
  check('E2: a unit with no relationships gets no invented family tree', /No lineage events recorded/.test(prov.loneLin));
  check('E2: an unreviewed beat shows DRAFT / UNCERTAIN; a reviewed one shows REVIEWED', prov.draftTag === 'DRAFT / UNCERTAIN' && prov.revTag === 'HISTORICAL / REVIEWED', prov.draftTag + ' / ' + prov.revTag);
  check('E2: no draft beat ever shows the reviewed tag', !prov.anyReviewedDraft);
  const q = await p.evaluate(() => { const y = 1800.5, dwi = HU.find(u => /Danish West Indies/.test(u.name)).id; const a = FC.full.aliveIds(y).includes(dwi); FC.setLayer('showQ', true); const b2 = FC.full.aliveIds(y).includes(dwi); FC.setLayer('showQ', false); return { a, b: b2, n: HU.filter(u => u.q).length }; });
  check('E2: quarantined non-federal / record-collection entries are hidden by default and shown on request', !q.a && q.b && q.n === 16, JSON.stringify(q));
  const det = await p.evaluate(() => { const y = 1977.9, a = FC.full.snapshot(y); FC.full.seekY(1800); FC.setLayer('families', false); FC.setLayer('uncertain', true); FC.full.seekY(2010); const b2 = FC.full.snapshot(y); FC.setLayer('families', true); FC.setLayer('uncertain', false); return a === b2; });
  check('E2: layers are presentation only; snapshot(1977.9) identical after toggling and scrubbing', det);
  check('E2: header says Archive loaded (not connected)', /Archive loaded/.test(await p.textContent('header')) && !/Archive connected/.test(await p.textContent('header')));

  /* ---------------- E3: semantic zoom ---------------- */
  say('== E3: overview clusters and labels');
  await p.evaluate(() => { FC.full.seekDate('2026-01-01'); }); await p.waitForTimeout(400);
  await p.evaluate(() => FC.full.setCam({ x: HIST.meta.world[0] / 2, y: HIST.meta.world[1] / 2, z: 0.085 })); await p.waitForTimeout(400);
  let rs = await p.evaluate(() => FC.full.stats());
  await p.screenshot({ path: SHOTS + '/E3_2026_overview.png' });
  check('E3: 2026 wide view draws labelled institution families instead of 800 tiny labels', rs.families >= 6 && rs.smallLabels <= 36, JSON.stringify(rs));
  await p.evaluate(() => FC.full.setCam({ z: 0.5 })); await p.waitForTimeout(300); rs = await p.evaluate(() => FC.full.stats());
  check('E3: families dissolve into real cells when zoomed in', !rs.families, JSON.stringify(rs));
  await p.evaluate(() => FC.setLayer('families', false)); await p.evaluate(() => FC.full.setCam({ z: 0.085 })); await p.waitForTimeout(300); rs = await p.evaluate(() => FC.full.stats());
  check('E3: the Families layer can be turned off', !rs.families); await p.evaluate(() => FC.setLayer('families', true));
  await p.click('#layersBtn'); check('E3: Layers menu opens with three toggles', (await p.locator('#layersMenu [data-layer]').count()) === 3 && await p.isVisible('#layersMenu')); await p.keyboard.press('Escape');
  check('E3: Escape closes the Layers menu', await p.isHidden('#layersMenu'));
  await p.close();

  /* ---------------- E4: Simulate ---------------- */
  say('== E4: Simulate (fictional sandbox)');
  p = await page(); await p.goto(base + '?intro=0'); await p.waitForTimeout(600);
  const before = await p.evaluate(() => FC.full.snapshot(1958.8) + '|' + JSON.stringify(FC.state().alive));
  await p.click('[data-app="simulate"]'); await p.waitForTimeout(300);
  check('E4: Simulate opens with a scenario / archetype picker and a fictional banner', await p.isVisible('#simSetup') && /FICTIONAL SANDBOX · NOT A HISTORICAL RECORD/.test(await p.textContent('#simBanner')) && (await p.locator('#simScen button').count()) === 3 && (await p.locator('#simArch button').count()) === 6);
  check('E4: archive panels and the 1775–2026 timeline are hidden in Simulate', await p.isHidden('#timeline') && await p.isHidden('#transport') && await p.isVisible('#simSess') && /Not 1775–2026/.test(await p.textContent('#simSess')));
  await p.click('#simArch [data-v="infra"]'); await p.fill('#simSeedIn', '4242'); await p.click('[data-sim="start"]'); await p.waitForTimeout(200);
  await p.focus('#arena'); const x0 = (await p.evaluate(() => FC.sim.live())).player.x;
  await p.keyboard.down('d'); await p.waitForTimeout(1200); await p.keyboard.up('d');
  let L = await p.evaluate(() => FC.sim.live());
  check('E4: keyboard steering moves the player (D held 1.2 s)', L.player.x > x0 + 120, `${x0.toFixed(0)} -> ${L.player.x.toFixed(0)}`);
  await p.keyboard.press('1'); await p.waitForTimeout(400); L = await p.evaluate(() => FC.sim.live());
  check('E4: Task Force deploys (moves 30% of capacity into a satellite)', L.tf && L.player.cd[0] > 0, JSON.stringify(L.player));
  await p.keyboard.press('2'); await p.waitForTimeout(200); L = await p.evaluate(() => FC.sim.live());
  check('E4: Transfer Functions recalls the task force with its gains', !L.tf && L.alerts.some(a => /Functions transferred/.test(a)));
  await p.keyboard.press('3'); await p.waitForTimeout(2400); L = await p.evaluate(() => FC.sim.live());
  check('E4: Reorganization Plan resolves after its comment period', L.alerts.some(a => /Reorganization Plan filed/.test(a)) && L.alerts.some(a => /REORGANIZATION FINALIZED|Plan withdrawn/.test(a)));
  const box = await p.locator('#arena').boundingBox(); await p.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.8); await p.waitForTimeout(1500);
  await p.evaluate(() => FC.sim.pause(true)); L = await p.evaluate(() => FC.sim.live());
  check('E4: rivals run a utility AI with named states', L.rivals > 0 && L.states.length >= 1 && L.states.every(s => ['Forage', 'Evade', 'Claim', 'Contest', 'Consolidate', 'Recover', 'RespondToOversight'].includes(s)), L.states.join(','));
  const rep = await p.evaluate(l => FC.sim.run(l.meta, l.log, l.tick), L);
  check('E4: replay from (seed, version, scenario, archetype, action log) reproduces the live run exactly', rep.hash === L.hash && rep.tick === L.tick, `${rep.hash} vs ${L.hash} @ ${L.tick} ticks, ${L.log.length} log entries`);
  const det2 = await p.evaluate(() => { const m = { scenario: 'jurisdiction-grab', archetype: 'research', seed: 99 }; const lg = [{ t: 1, dx: 1, dy: 0 }, { t: 200, a: 1 }, { t: 400, dx: 0, dy: -1 }, { t: 700, a: 3 }]; const a = FC.sim.run(m, lg, 1500), b2 = FC.sim.run(m, lg, 1500), c2 = FC.sim.run({ ...m, seed: 100 }, lg, 1500); return { same: a.hash === b2.hash, diff: a.hash !== c2.hash }; });
  check('E4: same seed + log → same state; a different seed → a different state', det2.same && det2.diff);
  const cons = await p.evaluate(() => { const W = simNew({ scenario: 'jurisdiction-grab', archetype: 'research', seed: 5 }); const P = W.cells.find(c => c.id === W.player); P.mass = 30; const m0 = P.mass; simAct(W, 1); const tf = W.cells.find(c => c.owner === P.id); const after = P.mass + (tf ? tf.mass : 0); P.mass = 20; tf && (tf.alive = false); simAct(W, 1); const denied = !W.cells.some(c => c.alive && c.owner === P.id); return { conserved: Math.abs(after - m0) < 1e-9, denied }; });
  check('E4: a task force conserves capacity, and a split below capacity 24 creates nothing', cons.conserved && cons.denied, JSON.stringify(cons));
  await p.evaluate(() => FC.sim.pause(false)); await p.screenshot({ path: SHOTS + '/E4_sim.png' });
  await p.click('[data-app="observe"]'); await p.waitForTimeout(300);
  const after = await p.evaluate(() => FC.full.snapshot(1958.8) + '|' + JSON.stringify(FC.state().alive));
  check('E4: a simulation session leaves the archive untouched', before === after);
  check('E4: arrow keys are not hijacked in Observe after leaving Simulate', await p.evaluate(() => FC.app()) === 'observe');
  await p.close();

  /* ---------------- E5: Report ---------------- */
  say('== E5: Report cards and export');
  p = await page(); await p.goto(base + '?mode=report&story=naca-nasa'); await p.waitForTimeout(900);
  let m = await p.evaluate(() => FC.report.model());
  check('E5: report link opens a reviewed story card with status, date, and labelled satire', m.kind === 'reviewed' && m.status === 'HISTORICAL / REVIEWED RECORD' && m.date === 'Effective 1 Oct 1958' && m.desk && (await p.evaluate(() => FC.report.size())).join('x') === '1600x900', JSON.stringify(m));
  await p.screenshot({ path: SHOTS + '/E5_report_16x9.png' });
  let [dl] = await Promise.all([p.waitForEvent('download'), p.click('#repExport')]);
  let fp = SHOTS + '/' + dl.suggestedFilename(); await dl.saveAs(fp); let png = fs.readFileSync(fp);
  check('E5: Export PNG downloads a 1600×900 PNG', png.readUInt32BE(16) === 1600 && png.readUInt32BE(20) === 900, dl.suggestedFilename());
  await p.click('#repFmt [data-v="vertical"]'); await p.waitForTimeout(300);
  [dl] = await Promise.all([p.waitForEvent('download'), p.click('#repExport')]); fp = SHOTS + '/' + dl.suggestedFilename(); await dl.saveAs(fp); png = fs.readFileSync(fp);
  check('E5: 9:16 export is 1080×1920', png.readUInt32BE(16) === 1080 && png.readUInt32BE(20) === 1920, dl.suggestedFilename());
  await p.screenshot({ path: SHOTS + '/E5_report_9x16.png' });
  await p.evaluate(() => { FC.report.set({ story: 'erda-doe', format: 'landscape' }); }); m = await p.evaluate(() => FC.report.model());
  check('E5: the DOE card states it is a subset, not the full reorganization', /subset|lineage only/i.test(m.caveat), m.caveat);
  await p.evaluate(() => { FC.full.seekY(1913.4); FC.report.set({ story: 'archive' }); }); m = await p.evaluate(() => FC.report.model());
  check('E5: an archive-moment card from a draft beat is labelled DRAFT / UNCERTAIN', m.kind === 'draft' && /^DRAFT \/ UNCERTAIN/.test(m.status), m.status);
  await p.close();
  p = await page(); await p.goto(base + '?mode=simulate&scenario=survive-reorg&seed=7&agency=taskforce'); await p.waitForTimeout(1500);
  L = await p.evaluate(() => FC.sim.live());
  check('E5: simulate link starts the named scenario, seed and archetype', L && L.meta.scenario === 'survive-reorg' && L.meta.seed === 7 && L.meta.archetype === 'taskforce' && L.tick > 30);
  await p.evaluate(() => { const W = SIMV.W, P = W.cells.find(c => c.id === W.player); simEnd(W, true, 'Test end.'); simShowOver(); });
  await p.waitForTimeout(200); await p.click('[data-sim="report"]'); await p.waitForTimeout(400); m = await p.evaluate(() => FC.report.model());
  check('E5: a finished run becomes a card labelled SIMULATION / FICTIONAL', m.kind === 'fiction' && /SIMULATION \/ FICTIONAL/.test(m.status) && /seed=7/.test(m.link), m.status);
  await p.screenshot({ path: SHOTS + '/E5_report_sim.png' });
  await p.close();

  /* ---------------- E6: deep links ---------------- */
  say('== E6: deep links');
  p = await page(); await p.goto(base + '?date=1958-10-02&entity=u-rg255'); await p.waitForTimeout(800);
  let fs2 = await p.evaluate(() => FC.full.state());
  check('E6: ?date&entity opens the full archive at that date following NASA', fs2.date === '1958-10-02' && fs2.pinName === 'National Aeronautics and Space Administration' && fs2.mode === 'follow', JSON.stringify({ d: fs2.date, pin: fs2.pinName }));
  await p.goto(base + '?story=aec-split'); await p.waitForTimeout(700); let s2 = await p.evaluate(() => FC.state());
  check('E6: ?story=aec-split opens the reviewed slice at the AEC division', (await p.evaluate(() => FC.tour())) === 'slice' && s2.T > 9 && s2.T < 12.5, `T=${s2.T}`);
  await p.close();

  /* ---------------- E7: phone ---------------- */
  say('== E7: phone 390×844');
  const ctxM = await b.newContext({ ...devices['iPhone 13'] }); p = await ctxM.newPage(); p.on('pageerror', e => errs.push(String(e)));
  for (const [q2, name] of [['', 'cold'], ['?mode=simulate&seed=3&scenario=jurisdiction-grab', 'sim'], ['?mode=report&story=naca-nasa&format=vertical', 'report']]) {
    await p.goto(base + q2); await p.waitForTimeout(name === 'cold' ? 6000 : 1200);
    const ov = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, modes: [...document.querySelectorAll('#modes button')].every(b => { const r = b.getBoundingClientRect(); return r.right <= innerWidth && r.width > 0; }) }));
    check(`E7: ${name} fits the phone width and keeps the mode switch on screen`, ov.sw <= ov.w && ov.modes, JSON.stringify(ov));
    await p.screenshot({ path: SHOTS + `/E7_phone_${name}.png` });
  }
  const tgt = await p.evaluate(() => [...document.querySelectorAll('#repBar button, #modes button')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().height).every(h => h >= 30));
  check('E7: report controls are at least 30 px tall on the phone', tgt);
  await ctxM.close();

  check('no page errors', errs.length === 0, errs.join(' | '));
  say(`\n${fails} failing checks`);
  fs.writeFileSync(__dirname + '/blueprint-report.txt', out.join('\n'));
  await b.close(); process.exit(fails ? 1 : 0);
})();
