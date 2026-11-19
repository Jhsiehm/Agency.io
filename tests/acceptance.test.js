const { chromium } = require('playwright');
const fs = require('fs');
const out = []; const say = (...a) => { const l = a.join(' '); out.push(l); console.log(l); };
let fails = 0; const check = (name, ok, extra) => { if (!ok) fails++; say((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
const st = p => p.evaluate(() => FC.state());
const waitT = async (p, t, max = 40000) => { await p.waitForFunction(t => FC.state().T >= t, t, { timeout: max, polling: 50 }); };
async function tlDrag(p, fromDate, toDate) {
  const box = await p.locator('#tl').boundingBox();
  const x = d => { const a = Date.parse('1958-01-01'), b = Date.parse('1978-01-01'); return box.x + box.width * (Date.parse(d) - a) / (b - a); };
  const y = box.y + 30;
  await p.mouse.move(x(fromDate), y); await p.mouse.down();
  const steps = 12; for (let i = 1; i <= steps; i++) { const a = Date.parse(fromDate), b = Date.parse(toDate); const d = new Date(a + (b - a) * i / steps).toISOString().slice(0, 10); await p.mouse.move(x(d), y); await p.waitForTimeout(30); }
  await p.mouse.up(); await p.waitForTimeout(250);
}
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1472, height: 860 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const url = 'file://' + __dirname + '/../index.html';
  fs.mkdirSync('shots/e2e', { recursive: true });

  /* ---------------- RUN A: hands-free ---------------- */
  say('== Run A: press Play history once, hands off');
  await p.goto(url); await p.waitForTimeout(800); await p.click('[data-tour="slice"]');
  await p.click('#startBtn');
  const samples = [];
  const marks = [[2.0, 'A_e1_approach'], [3.0, 'A_e1_contact'], [4.5, 'A_e1_post'], [11.5, 'A_e2_before'], [12.2, 'A_e2_division'], [13.7, 'A_e2_successors'], [18.0, 'A_e3_approach'], [18.7, 'A_e3_contact'], [20.3, 'A_e3_post']];
  for (const [t, name] of marks) { await waitT(p, t); const s = await st(p); samples.push(s); await p.screenshot({ path: `shots/e2e/${name}.png` }); }
  await p.waitForFunction(() => FC.state().ended, null, { timeout: 15000 });
  const endA = await st(p);
  say('A sample T:', samples.map(s => s.T + '/' + s.date).join(' '));
  await p.screenshot({ path: 'shots/e2e/A_end.png' });
  check('A: camera stayed in Auto tour the whole run', samples.every(s => s.mode === 'auto') && endA.mode === 'auto');
  check('A: E1 approach shows NACA and NASA live', samples[0].alive.includes('NACA') && samples[0].mass.NASA === 1);
  check('A: E1 after contact NACA ended, NASA mass 2, lineage NACA>NASA', !samples[2].alive.includes('NACA') && samples[2].mass.NASA === 2 && samples[2].edges.includes('NACA>NASA'));
  check('A: E2 before division shows one AEC, no successors', samples[3].alive.includes('AEC') && !samples[3].alive.includes('ERDA') && !samples[3].alive.includes('NRC'));
  check('A: E2 division: AEC ended, ERDA+NRC started together', !samples[4].alive.includes('AEC') && samples[4].alive.includes('ERDA') && samples[4].alive.includes('NRC'));
  check('A: E2 aftermath frames both successors', await p.evaluate(() => true) && samples[5].edges.includes('AEC>ERDA') && samples[5].edges.includes('AEC>NRC'));
  check('A: E3 ERDA ends into DOE, DOE mass 2', endA.alive.join() === 'NASA,NRC,DOE' && endA.mass.DOE === 2 && endA.edges.includes('ERDA>DOE'));
  check('A: final rail is ERDA transfer, 3 frames filed', endA.rail.event === 'ev-slice-003' && endA.rail.slots.every(x => x.endsWith('filed')), endA.rail.slots.join(' '));
  const regs = endA.log.filter(l => l.includes('registered'));
  check('A: each event registered exactly once', regs.length === 3, regs.join(' | '));
  check('A: dossier follows the director (NASA→AEC/ERDA→DOE)', samples[2].dossier === 'NASA' && samples[3].dossier === 'AEC' && samples[5].dossier === 'ERDA' && samples[6].dossier === 'ERDA' && endA.dossier === 'DOE', samples.map(s => s.dossier).join(','));
  check('A: Replay offered at end', await p.evaluate(() => document.getElementById('replay').classList.contains('hot')));
  check('A: 9 evidence captures generated from the simulation', (await p.evaluate(() => FC.captureKeys().length)) === 9);
  say('A log:', JSON.stringify(endA.log));

  /* ---------------- RUN B: take control ---------------- */
  say('== Run B: pin NASA, ignore AEC notice, replay, Watch the split, evidence, scrub back');
  await p.goto(url); await p.waitForTimeout(800); await p.click('[data-tour="slice"]');
  await p.click('#startBtn');
  await waitT(p, 5.2);
  const nasaXY = await p.evaluate(() => FC.screenOf('NASA'));
  await p.mouse.click(nasaXY[0], nasaXY[1]);
  await p.waitForTimeout(150);
  let s = await st(p);
  check('B1: clicking the NASA cell pins it', s.mode === 'follow' && s.pin === 'NASA' && s.dossier === 'NASA', `mode=${s.mode} pin=${s.pin}`);
  await waitT(p, 9.8);
  s = await st(p);
  check('B1: AEC notice offered while pinned', s.notice === 'Watch the Atomic Energy Commission split', String(s.notice));
  await p.screenshot({ path: 'shots/e2e/B1_notice.png' });
  const inview = [];
  for (const t of [11.0, 11.9, 12.6, 13.5, 15.0, 18.5, 20.0]) { await waitT(p, t); inview.push(await p.evaluate(() => ({ T: FC.state().T, nasa: FC.inView('NASA'), aecVisible: FC.inView('AEC'), mode: FC.state().mode, pin: FC.state().pin, notice: FC.state().notice }))); }
  check('B1: ignoring the notice, pin holds and NASA stays centered through the split and DOE', inview.every(v => v.nasa && v.mode === 'follow' && v.pin === 'NASA'), JSON.stringify(inview.map(v => [v.T, v.nasa, v.notice])));
  check('B1: camera never travelled to the AEC', inview.every(v => !v.aecVisible));
  await p.waitForFunction(() => FC.state().ended, null, { timeout: 15000 });
  s = await st(p);
  check('B1: history still advanced while pinned (end state identical to Run A)', s.alive.join() === endA.alive.join() && JSON.stringify(s.mass) === JSON.stringify(endA.mass) && s.edges.join() === endA.edges.join());
  await p.screenshot({ path: 'shots/e2e/B1_end_pinned.png' });

  await p.click('#replay'); await p.waitForTimeout(200);
  s = await st(p);
  check('B2: Replay restarts from 1958 with NASA still pinned', s.T < 1 && s.pin === 'NASA' && s.mode === 'follow' && s.alive.includes('NACA'), `T=${s.T}`);
  await p.waitForFunction(() => FC.state().notice === 'Watch the Atomic Energy Commission split', null, { timeout: 20000, polling: 50 });
  await p.click('#noticeWatch'); await p.waitForTimeout(150);
  s = await st(p);
  check('B2: Watch releases the pin, replays the split from its lead-in, Auto tour resumes', s.mode === 'auto' && s.pin === null && s.T >= 9.4 && s.T < 10.3 && s.playing, `T=${s.T} mode=${s.mode}`);
  await waitT(p, 13.75);
  const both = await p.evaluate(() => ({ e: FC.inView('ERDA'), n: FC.inView('NRC'), s: FC.state() }));
  check('B2: camera now frames both successors', both.e && both.n, JSON.stringify(both.s.cam));
  await p.screenshot({ path: 'shots/e2e/B2_successors.png' });
  /* select the split evidence frame */
  s = await st(p);
  check('B3: rail shows the AEC division with all three frames', s.rail.event === 'ev-slice-002' && s.rail.slots.every(x => x.endsWith('filed')), s.rail.slots.join(' '));
  await p.click('#slots [data-ph="division"]'); await p.waitForTimeout(250);
  s = await st(p);
  const divT = await p.evaluate(() => FC.phases['ev-slice-002'].find(x => x.key === 'division').t);
  check('B3: Division frame pauses and seeks to its phase', !s.playing && Math.abs(s.T - divT) < 0.01 && s.date === '1975-01-19', `T=${s.T}`);
  check('B3: at Division, later slot returns to pending', s.rail.slots.join() === 'before:filed,division:filed,successors:pending', s.rail.slots.join());
  check('B3: at Division, AEC ended and both successors exist', !s.alive.includes('AEC') && s.alive.includes('ERDA') && s.alive.includes('NRC'));
  await p.screenshot({ path: 'shots/e2e/B3_division_frame.png' });
  /* scrub backward */
  await tlDrag(p, '1975-01-19', '1965-06-01');
  s = await st(p);
  check('B4: scrub to 1965 restores one AEC cell, NASA mass 2, only NACA>NASA edge', s.alive.join() === 'NASA,AEC' && s.mass.NASA === 2 && s.edges.join() === 'NACA>NASA' && s.date.startsWith('1965'), `${s.date} alive=${s.alive} edges=${s.edges}`);
  check('B4: rail at 1965 shows NACA transfer, 3 frames filed', s.rail.event === 'ev-slice-001' && s.rail.slots.every(x => x.endsWith('filed')), s.rail.slots.join(' '));
  check('B4: scrub left playback paused (prior state)', !s.playing);
  await p.screenshot({ path: 'shots/e2e/B4_1965.png' });
  await tlDrag(p, '1965-06-01', '1958-09-15');
  s = await st(p);
  check('B4: scrub to Sep 1958 restores NACA, NASA mass 1, no lineage edges', s.alive.join() === 'NACA,NASA,AEC' && s.mass.NASA === 1 && s.edges.length === 0, `${s.date} alive=${s.alive}`);
  check('B4: Sep 1958 rail slots return to pending', s.rail.event === 'ev-slice-001' && s.rail.slots.every(x => x.endsWith('pending')), s.rail.slots.join(' '));
  const dossier1958 = await p.evaluate(() => [document.getElementById('dKv').innerText, document.getElementById('linText').innerText]);
  check('B4: NASA dossier reads pre-operational, transfer pending', /operations begin 1 Oct 1958/.test(dossier1958[0]) && /pending/i.test(dossier1958[1]), dossier1958.join(' / ').replace(/\n/g, ' '));
  await p.screenshot({ path: 'shots/e2e/B4_1958.png' });
  await tlDrag(p, '1958-09-15', '1976-03-01');
  s = await st(p);
  check('B4: scrub forward to 1976 gives NASA, ERDA, NRC; AEC gone; split edges back', s.alive.join() === 'NASA,ERDA,NRC' && s.edges.includes('AEC>ERDA') && s.edges.includes('AEC>NRC') && !s.edges.includes('ERDA>DOE'), `alive=${s.alive}`);
  check('B4: 1976 rail shows AEC division, 3 filed', s.rail.event === 'ev-slice-002' && s.rail.slots.every(x => x.endsWith('filed')));
  /* resume */
  await p.click('#play');
  await p.waitForFunction(() => FC.state().ended, null, { timeout: 20000 });
  s = await st(p);
  check('B5: resumed tour ends in the same state as Run A', s.alive.join() === endA.alive.join() && JSON.stringify(s.mass) === JSON.stringify(endA.mass) && s.edges.join() === endA.edges.join() && s.mode === 'auto');
  const regsB = s.log.filter(l => l.includes('Energy Research and Development Administration transfer registered'));
  check('B5: DOE event registered once in the resumed run', regsB.length >= 1);
  say('B log:', JSON.stringify(s.log));

  /* ---------------- RUN C: page 11 evidence acceptance ---------------- */
  say('== Run C: pause before contact, change speed, cross contact, rewind, replay');
  await p.goto(url); await p.waitForTimeout(800); await p.click('[data-tour="slice"]');
  await p.click('#startBtn'); await waitT(p, 2.0); await p.click('#play'); s = await st(p);
  check('C: paused before contact, contact slot pending', !s.playing && s.rail.slots[1] === 'contact:pending', s.rail.slots.join());
  await p.click('#speedBtn'); await p.click('#speedMenu [data-speed="2"]'); await p.click('#play'); await waitT(p, 4.7); s = await st(p);
  check('C: at 2x through contact, all three E1 slots filed (event-local phases cannot be skipped)', s.rail.slots.every(x => x.endsWith('filed')), s.rail.slots.join());
  await p.click('#play');
  await p.click('#prev'); await p.waitForTimeout(200); s = await st(p);
  check('C: Previous rewinds to E1 lead-in, slots pending again', s.rail.slots.every(x => x.endsWith('pending')) && s.alive.includes('NACA'), `T=${s.T} ${s.rail.slots.join()}`);
  const pel = await p.evaluate(() => { const P = FC.pellet(); const c = document.getElementById('pellet'); const g = c.getContext('2d').getImageData(36, 36, 1, 1).data; return { P, center: [g[0], g[1], g[2]] }; });
  const hex = pel.P.c; const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  check('C: magnified P-001 centre pixel matches the pellet colour in the arena render', rgb.every((v, i) => Math.abs(v - pel.center[i]) < 6), `${hex} vs ${pel.center}`);
  await p.click('#exhibitBtn'); await p.waitForTimeout(150); s = await st(p);
  check('C: opening the exhibit keeps playhead and selection', !s.playing && s.log.at(-1).includes('P-001'));
  await p.keyboard.press('Escape');
  check('C: zero pellet events in the dataset', await p.evaluate(() => FC.events.length === 3));

  /* ---------------- RUN D: full history 1775–2026 ---------------- */
  say('== Run D: full history, oldest to newest, and speeds');
  const fs_ = () => p.evaluate(() => FC.full.state());
  const waitY = async (y, max = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < max) { const v = await fs_(); if (v.Y >= y || v.ended) return v; await p.waitForTimeout(40); } return fs_(); };
  const setSpeed = async v => { await p.click('#speedBtn'); await p.click(`#speedMenu [data-speed="${v}"]`); };
  await p.goto(url); await p.waitForTimeout(900);
  s = await fs_();
  check('D: opens on the Full history tour at 1775 with Play history offered', (await p.evaluate(() => FC.tour())) === 'full' && s.Y < 1775 && await p.isVisible('#startBtn'), `Y=${s.Y}`);
  const speeds = await p.evaluate(() => [...document.querySelectorAll('#speedMenu [data-speed]')].map(b => +b.dataset.speed));
  check('D: speed menu offers -1x, 0.1x, 0.5x, 1x, 1.5x, 2x, 25x', speeds.join() === '-1,0.1,0.5,1,1.5,2,25', speeds.join());
  await p.click('#startBtn'); const y0 = (await fs_()).Y; await p.waitForTimeout(2000); s = await fs_();
  check('D: 1x plays about one year per second, hands-free in Auto tour', s.Y - y0 > 1.2 && s.Y - y0 < 2.4 && s.mode === 'auto' && s.playing, `advanced ${(s.Y - y0).toFixed(2)} yr`);
  await setSpeed(25); const trace = []; const tStart = Date.now();
  while (Date.now() - tStart < 20000) { const v = await fs_(); trace.push(v.Y); if (v.ended) break; await p.waitForTimeout(100); }
  s = await fs_();
  check('D: 25x reaches 19 Nov 2026 and holds', s.ended && s.date === '2026-11-19' && !s.playing, `${s.date} in ${((Date.now() - tStart) / 1000).toFixed(1)} s`);
  check('D: playback is chronological, oldest to newest (year never decreases at positive speed)', trace.every((v, i) => i === 0 || v >= trace[i - 1]));
  check('D: 2026 arena holds the agencies live in the draft census', s.alive > 700, `alive=${s.alive}`);
  check('D: completion logged once', s.log.filter(l => l.includes('History complete')).length === 1);
  /* reviewed events inside the full history keep their operations dates */
  const ids = await p.evaluate(() => { const A = d => FC.full.aliveIds(msToY(Date.parse(d + 'T00:00:00Z')) + 0.0005); return { n0: A('1958-09-30'), n1: A('1958-10-02'), a0: A('1975-01-18'), a1: A('1975-01-20'), d0: A('1977-09-30'), d1: A('1977-10-02') }; });
  const has = (l, id) => l.includes(id);
  check('D: NACA becomes NASA on 1 Oct 1958', has(ids.n0, 'u-gm-7404') && !has(ids.n0, 'u-rg255') && has(ids.n1, 'u-rg255') && !has(ids.n1, 'u-gm-7404'));
  check('D: AEC divides into ERDA and NRC on 19 Jan 1975', has(ids.a0, 'u-rg326') && !has(ids.a0, 'u-rg430') && has(ids.a1, 'u-rg430') && has(ids.a1, 'u-rg431') && !has(ids.a1, 'u-rg326'));
  check('D: ERDA goes into DOE on 1 Oct 1977', has(ids.d0, 'u-rg430') && !has(ids.d0, 'u-fr-136') && has(ids.d1, 'u-fr-136') && !has(ids.d1, 'u-rg430'));
  /* reverse */
  await p.evaluate(() => FC.full.seekDate('1978-06-01')); await setSpeed(-1); await p.click('#play');
  const yr0 = (await fs_()).Y; await p.waitForTimeout(1500); s = await fs_();
  check('D: -1x plays backward (year decreases)', s.Y < yr0 - 0.6 && s.playing && s.speed === -1, `${yr0.toFixed(2)} -> ${s.Y.toFixed(2)}`);
  await p.click('#play'); await p.waitForTimeout(150); const lbl = await p.evaluate(() => document.getElementById('playLbl').textContent);
  check('D: paused in reverse, Play reads Play backward', lbl === 'Play backward', lbl);
  await p.evaluate(() => FC.full.seekDate('1978-06-01')); await p.click('#play');
  let v; for (;;) { v = await fs_(); if (v.Y < 1974.95 || !v.playing) break; await p.waitForTimeout(25); }
  await p.click('#play'); await p.waitForTimeout(400);
  const revState = await p.evaluate(() => { const s = FC.full.state(); return { Y: s.Y, alive: FC.full.aliveIds(s.Y).join(), onRec: s.onRecord, rail: s.rail.join(), snap: FC.full.snapshot(s.Y) }; });
  const ra = revState.alive.split(','); check('D: reverse playback crossed the AEC division backward: AEC back, ERDA and NRC gone', ra.includes('u-rg326') && !ra.includes('u-rg430') && !ra.includes('u-rg431'), `Y=${revState.Y}`);
  const p2 = await ctx.newPage(); await p2.goto(url); await p2.waitForTimeout(900);
  const seekState = await p2.evaluate(y => { FC.full.seekY(y); return new Promise(r => setTimeout(() => { const s = FC.full.state(); r({ Y: s.Y, alive: FC.full.aliveIds(s.Y).join(), onRec: s.onRecord, rail: s.rail.join(), snap: FC.full.snapshot(s.Y) }); }, 600)); }, revState.Y);
  check('D: state reached by reverse play equals state reached by seeking (agencies, positions, record, rail)', revState.alive === seekState.alive && revState.snap === seekState.snap && revState.onRec === seekState.onRec && revState.rail === seekState.rail, `${revState.rail} vs ${seekState.rail}`);
  await p2.close();
  await setSpeed(0.1); await p.click('#play'); const ys = (await fs_()).Y; await p.waitForTimeout(2000); s = await fs_(); await p.click('#play');
  check('D: 0.1x is comically slow (about a tenth of a year in a second)', s.Y - ys > 0.08 && s.Y - ys < 0.35, `advanced ${(s.Y - ys).toFixed(3)} yr in 2 s`);
  /* scrub, evidence and pinning */
  const box = await p.locator('#tl').boundingBox(); await p.mouse.click(box.x + box.width * (1900.5 - 1775) / 252, box.y + 50); await p.waitForTimeout(300); s = await fs_();
  check('D: timeline scrub lands on the year under the pointer', Math.abs(s.Y - 1900.5) < 1.2, `Y=${s.Y.toFixed(2)}`);
  await p.evaluate(() => FC.full.seekDate('1958-06-01')); await setSpeed(1); await p.click('#play'); await waitY(1959.6); await p.click('#play'); await p.waitForTimeout(400);
  s = await fs_();
  check('D: rail files frames from the simulation as beats pass', s.rail.filter(x => x.endsWith('filed')).length >= 1, s.rail.join());
  const fr = await p.$('#slots button.frame');
  if (fr) { const ph = await fr.getAttribute('data-hseek'); await fr.click(); await p.waitForTimeout(300); s = await fs_(); check('D: clicking an evidence frame seeks to its moment and pauses', !s.playing && Math.abs(s.Y - +ph) < 0.01, `Y=${s.Y} ph=${ph}`); }
  else check('D: clicking an evidence frame seeks to its moment and pauses', false, 'no filed frame');
  await p.evaluate(() => FC.full.seekDate('1960-03-01')); await p.waitForTimeout(500);
  const nasaKey = await p.evaluate(() => FC.full.keyOf('u-rg255'));
  await p.evaluate(k => { const s = document.getElementById('arena'); }, nasaKey);
  await p.evaluate(k => follow(k, 'test'), nasaKey); await setSpeed(2); await p.click('#play');
  let saw = null; const tq = Date.now(); while (Date.now() - tq < 15000) { const q = await fs_(); if (q.notice) { saw = q; break; } await p.waitForTimeout(80); }
  check('D: pinned to NASA, a beat elsewhere raises a Watch notice and the pin holds', saw && saw.pin === nasaKey && saw.mode === 'follow' && /^Watch: /.test(saw.notice), saw ? saw.notice : 'no notice');
  await p.click('#play');
  const xy = await p.evaluate(k => FC.full.screenOf(k), nasaKey);
  check('D: pinned NASA stays on screen', xy && xy[0] > 200 && xy[0] < 1300, JSON.stringify(xy));
  await p.click('#noticeWatch'); await p.waitForTimeout(300); s = await fs_();
  check('D: Watch releases the pin and plays the beat in Auto tour', s.mode === 'auto' && s.pin === null && s.playing);
  await p.click('#play');
  /* slice reverse */
  await p.click('[data-tour="slice"]'); await p.evaluate(() => FC._seek(13.5)); await setSpeed(-1); await p.click('#play'); await p.waitForTimeout(1200); s = await st(p); await p.click('#play');
  check('D: -1x also runs the reviewed slice backward', s.T < 13.0, `T=${s.T}`);
  await p.click('#speedBtn'); await p.keyboard.press('Escape'); check('D: Escape closes the speed menu', await p.isHidden('#speedMenu'));
  check('no page errors', errs.length === 0, errs.join(' | '));
  say(`\n${fails} failing checks`);
  fs.writeFileSync(__dirname + '/acceptance-report.txt', out.join('\n'));
  await b.close();
})();
