/* ================= SIMULATE: a fictional bureaucratic survival game =================
   Separate clock, seed and state. Nothing here reads or writes ArchiveState (HU/HE/HB, ENT, S.Y, S.T).
   Fixed timestep 1/60 s, seeded RNG, no trig (only + - * / sqrt) so a run replays from (seed, version, scenario, archetype, log). */
const SIM_V = "sim-1";
const SIM_DT = 1 / 60;
const SWORLD = { w: 3600, h: 2400 };
const PELLET_TYPES = [
  { k: "mandate", name: "Mandate", color: "#f2b45a", g: "M", w: 30, expl: "New responsibilities. Adds jurisdiction score." },
  { k: "approp", name: "Appropriation", color: "#6cc36b", g: "$", w: 25, expl: "Short-term capacity. Adds operating capacity and energy." },
  { k: "staff", name: "Staffing", color: "#5b8def", g: "S", w: 15, expl: "Throughput. Abilities recover faster." },
  { k: "pact", name: "Interagency agreement", color: "#46b7c6", g: "⇄", w: 8, expl: "Brief non-aggression pact. Rivals cannot absorb you while it lasts." },
  { k: "attn", name: "Public attention", color: "#ec6fb0", g: "◉", w: 12, expl: "Big score, but raises oversight exposure." },
  { k: "auth", name: "Regulatory authority", color: "#a874e0", g: "R", w: 10, expl: "Jurisdiction. Needed to absorb rivals with authority of their own." }
];
const ARCHETYPES = [
  { id: "research", name: "Office of Applied Research", short: "Research agency", why: "Grows slower, shrugs off oversight, long-lived task forces.", speed: 0.95, mass: 18, mul: { mandate: 1.25, approp: 0.8 }, exp: 0.6, tfLife: 3 },
  { id: "regulatory", name: "Bureau of Regulatory Affairs", short: "Regulatory bureau", why: "Starts with authority and earns it twice as fast. Attention hurts more.", speed: 0.9, mass: 18, auth: 3, mul: { auth: 2 }, exp: 1.3 },
  { id: "service", name: "Office of Service Delivery", short: "Service delivery office", why: "Quick, and staffing counts for more. Mandates count for less.", speed: 1.06, mass: 18, mul: { staff: 1.5, mandate: 0.8 }, exp: 1 },
  { id: "infra", name: "Department of Infrastructure Works", short: "Infrastructure department", why: "Starts big and turns slowly. Appropriations count for more.", speed: 0.8, mass: 26, mul: { approp: 1.3 }, exp: 1 },
  { id: "commission", name: "Independent Commission on Matters", short: "Independent commission", why: "Agreements last twice as long; plans recharge faster. Starts small.", speed: 1, mass: 15, mul: {}, exp: 1, pact: 2, rpCd: 0.7 },
  { id: "taskforce", name: "Temporary Task Force 12", short: "Temporary task force", why: "Fastest cell on the board, but a sunset clause drains capacity.", speed: 1.25, mass: 14, mul: {}, exp: 1, sunset: 0.006 }
];
const SCENARIOS = [
  { id: "jurisdiction-grab", name: "Jurisdiction Grab", goal: "Reach a jurisdiction score of 300 before the session ends.", limit: 180, rivals: 14, wave: 30, waveExp: 40, waveCut: 0.12, target: 300 },
  { id: "survive-reorg", name: "Survive the Reorganization", goal: "Stay operating for 150 seconds while structural proposals sweep the board.", limit: 150, rivals: 16, wave: 15, waveExp: 25, waveCut: 0.18, reorg: 25, aggro: 1.35 },
  { id: "approp-cycle", name: "The Appropriations Cycle", goal: "Pass four budget reviews (capacity 30, 50, 75, 100) every 40 seconds.", limit: 160, rivals: 12, wave: 40, waveExp: 50, waveCut: 0.1, cycles: [30, 50, 75, 100], pelletBias: "approp" }
];
const RIVAL_NAMES = ["Office of Forms Management", "Bureau of Adjacent Affairs", "Commission on Commissions", "Administration for Long-Range Planning", "Interagency Working Group 7", "Office of the Deputy Assistant", "National Board of Review Boards", "Bureau of Weights, Measures and Moods", "Department of Further Study", "Agency for Interagency Coordination", "Office of Strategic Paperclips", "Federal Committee on Committees", "Bureau of Pending Matters", "Office of Unfunded Mandates", "Directorate of Quarterly Reports", "Task Force on Task Forces", "Office of Records About Records", "Council on Scheduling Councils"];
const SIM_COLORS = ["#f0675d", "#f5a742", "#f2cf45", "#6cc36b", "#46b7c6", "#5b8def", "#a874e0", "#ec6fb0", "#e98a6b", "#7fc8a9", "#b4a0e6", "#e6b34a"];
const simR = m => 6 + 4.2 * Math.sqrt(Math.max(0, m));
const q8 = v => Math.round(v * 256) / 256;

function simNew(opts) {
  const sc = SCENARIOS.find(s => s.id === opts.scenario) || SCENARIOS[0], ar = ARCHETYPES.find(a => a.id === opts.archetype) || ARCHETYPES[0];
  const seed = (opts.seed >>> 0) || 1, rnd = mulberry(seed);
  const W = { v: SIM_V, seed, sc, ar, tick: 0, rnd, cells: [], pel: [], log: [], alerts: [], over: null, nextId: 1, lost: 0, waves: 0, input: { dx: 0, dy: 0 }, actions: [], plan: null, cycle: 0 };
  const weights = PELLET_TYPES.map(p => p.w * (sc.pelletBias === p.k ? 1.8 : 1)), tw = weights.reduce((a, b) => a + b, 0);
  W.pickType = () => { let r = W.rnd() * tw; for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; } return 0; };
  for (let i = 0; i < 620; i++) W.pel.push({ x: 30 + W.rnd() * (SWORLD.w - 60), y: 30 + W.rnd() * (SWORLD.h - 60), t: W.pickType() });
  const P = simCell(W, { name: ar.name, x: SWORLD.w / 2, y: SWORLD.h / 2, mass: ar.mass, auth: ar.auth || 0, color: "#f2b45a", player: true });
  W.player = P.id;
  for (let i = 0; i < sc.rivals; i++) {
    let x, y, n = 0; do { x = 120 + W.rnd() * (SWORLD.w - 240); y = 120 + W.rnd() * (SWORLD.h - 240); } while (n++ < 20 && (x - P.x) * (x - P.x) + (y - P.y) * (y - P.y) < 520 * 520);
    simCell(W, { name: RIVAL_NAMES[i % RIVAL_NAMES.length], x, y, mass: 8 + W.rnd() * (i < 3 ? 34 : 18), auth: (W.rnd() * 3) | 0, color: SIM_COLORS[i % SIM_COLORS.length], npc: true, think: i % 15 });
  }
  simAlert(W, "Session opened · " + sc.name + " · seed " + seed, "sys");
  return W;
}
function simCell(W, o) {
  const c = Object.assign({ id: W.nextId++, x: 0, y: 0, vx: 0, vy: 0, mass: 10, score: 0, staff: 0, auth: 0, exp: 0, energy: 0, pact: 0, alive: true, npc: false, player: false, state: "Forage", tgt: null, think: 0, cd: [0, 0, 0], owner: 0, life: 0, absorbed: 0 }, o);
  W.cells.push(c); return c;
}
const simGet = (W, id) => W.cells.find(c => c.id === id && c.alive);
function simAlert(W, text, kind) { W.alerts.push({ t: W.tick, text, kind: kind || "game" }); if (W.alerts.length > 60) W.alerts.shift(); }
function simVmax(W, c) { const a = c.player ? W.ar.speed : c.owner ? 1.15 : 1; return 330 * a / Math.sqrt(1 + c.mass / 60); }
function steer(c, dx, dy, vmax, dt) {
  const L = Math.sqrt(dx * dx + dy * dy); const tx = L > 1e-6 ? dx / L * vmax : 0, ty = L > 1e-6 ? dy / L * vmax : 0;
  const k = Math.min(1, dt * 6 / (1 + c.mass / 150)); c.vx += (tx - c.vx) * k; c.vy += (ty - c.vy) * k;
}
function simGain(W, c, t) {
  const p = PELLET_TYPES[t], mul = c.player ? (W.ar.mul[p.k] || 1) : 1;
  if (p.k === "mandate") { c.score += 3 * mul; c.mass += 0.4; }
  else if (p.k === "approp") { c.mass += 1.6 * mul; c.energy += 4; }
  else if (p.k === "staff") { c.staff = Math.min(20, c.staff + 1 * mul); c.mass += 0.5; }
  else if (p.k === "pact") { c.pact = Math.min(8, c.pact + 3 * (c.player ? W.ar.pact || 1 : 1)); c.mass += 0.4; }
  else if (p.k === "attn") { c.score += 5; c.exp += 6 * (c.player ? W.ar.exp : 1); }
  else if (p.k === "auth") { c.auth += 1 * mul; c.mass += 0.4; }
  if (c.player && W.stats) W.stats[p.k] = (W.stats[p.k] || 0) + 1;
}
/* jurisdiction predicate (casual): bigger by 25%, overlapping, enough authority, and no active pact */
function canAbsorb(a, b) { return a.mass >= 1.25 * b.mass && a.auth + 2 >= b.auth * 0.7 && b.pact <= 0; }
function simAbsorb(W, a, b, why) {
  const gain = b.mass * 0.8; W.lost += b.mass - gain;
  a.mass += gain; a.score += b.score * 0.5; a.auth += b.auth * 0.5; a.absorbed++; b.alive = false;
  const P = simGet(W, W.player);
  if (b.id === W.player) { simEnd(W, false, `${a.name} absorbed your agency${why ? " (" + why + ")" : ""}. Your functions have been transferred.`); return; }
  if (P && b.owner === W.player) simAlert(W, "Task force absorbed by " + a.name + ". Its funding has been transferred.");
  else if (a.id === W.player || a.owner === W.player) simAlert(W, (why || "Absorbed") + " · " + b.name + " · capacity +" + gain.toFixed(1));
  else if (W.rnd() < 0.3) simAlert(W, a.name + " absorbed " + b.name + ". Forms will follow.", "sys");
}
function simEnd(W, won, text) { if (W.over) return; W.over = { won, text, tick: W.tick }; simAlert(W, (won ? "SESSION OBJECTIVE MET · " : "SESSION ENDED · ") + text, "sys"); }

function simAct(W, a) {
  const P = simGet(W, W.player); if (!P || W.over) return;
  const cdMul = 1 - Math.min(0.6, P.staff * 0.03);
  if (a === 1) { /* Task Force: move 30% of capacity into a temporary satellite */
    if (P.cd[0] > 0) return simAlert(W, "Task Force not ready. Paperwork pending.");
    if (P.mass < 24) return simAlert(W, "Task Force needs capacity 24. Request denied.");
    if (W.cells.some(c => c.alive && c.owner === P.id)) return simAlert(W, "A task force is already deployed.");
    const m = P.mass * 0.3; P.mass -= m;
    const L = Math.sqrt(P.vx * P.vx + P.vy * P.vy) || 1, dx = P.vx / L || 1, dy = P.vy / L || 0;
    simCell(W, { name: "Task Force", x: P.x + dx * (simR(P.mass) + 30), y: P.y + dy * (simR(P.mass) + 30), vx: dx * 300, vy: dy * 300, mass: m, auth: P.auth * 0.5, color: "#ffd27a", owner: P.id, life: (9 + (W.ar.tfLife || 0)) * 60 });
    P.cd[0] = 12 * 60 * cdMul; simAlert(W, "Task Force created. Expires if not funded.");
  } else if (a === 2) { /* Transfer Functions */
    if (P.cd[1] > 0) return simAlert(W, "Transfer pending review.");
    const tf = W.cells.find(c => c.alive && c.owner === P.id);
    if (tf) { P.mass += tf.mass; P.score += tf.score; tf.alive = false; simAlert(W, "Functions transferred from the task force. Nothing was abolished."); }
    else if (P.staff >= 2) { P.staff -= 2; P.mass += 6; simAlert(W, "Staff reassigned to operations. Capacity +6."); }
    else return simAlert(W, "Nothing to transfer. A memo has been filed.");
    P.cd[1] = 6 * 60 * cdMul;
  } else if (a === 3) { /* Reorganization Plan: absorb the nearest smaller rival after a 2 s warning */
    if (P.cd[2] > 0) return simAlert(W, "A reorganization plan is already under review.");
    W.plan = { at: W.tick + 120 }; P.exp += 18 * W.ar.exp; P.cd[2] = 16 * 60 * cdMul * (W.ar.rpCd || 1);
    simAlert(W, "Reorganization Plan filed. Comment period: 2 seconds.");
  }
}
function simThink(W, c) {
  const r = simR(c.mass), aggro = W.sc.aggro || 1; let best = null, bu = -1e9, state = "Forage";
  for (const o of W.cells) {
    if (!o.alive || o === c || o.owner === c.id) continue;
    const dx = o.x - c.x, dy = o.y - c.y, d = Math.sqrt(dx * dx + dy * dy);
    if (canAbsorb(o, c) && d < 380 + simR(o.mass)) { const u = 1.8 * (1 - d / (380 + simR(o.mass))) * 10; if (u > bu) { bu = u; best = { x: c.x - dx, y: c.y - dy }; state = "Evade"; } }
    else if (canAbsorb(c, o) && d < 650) { const u = (o.mass * 0.8 * 1.0 + o.score * 0.5 * 1.4) * 0.35 * aggro - d / 100 * 0.7 - c.exp / 100 * 1.6; if (u > bu) { bu = u; best = o; state = o.player ? "Contest" : "Claim"; } }
  }
  const recover = c.mass < 9, oversight = c.exp > 60;
  for (const p of W.pel) {
    const k = PELLET_TYPES[p.t].k; if (oversight && k === "attn") continue;
    const dx = p.x - c.x, dy = p.y - c.y, d2 = dx * dx + dy * dy; if (d2 > 700 * 700) continue;
    const v = k === "approp" ? (recover ? 4 : 1.6) : k === "mandate" ? 1.4 : k === "staff" && oversight ? 2.5 : 1;
    const u = v * 1.0 - Math.sqrt(d2) / 100 * 0.7;
    if (u > bu) { bu = u; best = p; state = recover ? "Recover" : oversight ? "RespondToOversight" : c.mass > 120 ? "Consolidate" : "Forage"; }
  }
  c.tgt = best; c.state = state;
}
function simStep(W, input) {
  if (W.over) return;
  W.tick++; const dt = SIM_DT, P = simGet(W, W.player), t = W.tick / 60;
  if (input) { if (input.dx !== undefined) W.input = { dx: input.dx, dy: input.dy }; if (input.a) simAct(W, input.a); }
  for (const c of W.cells) {
    if (!c.alive) continue;
    const vmax = simVmax(W, c);
    if (c.player) steer(c, W.input.dx, W.input.dy, vmax, dt);
    else if (c.owner) { /* task force forages nearest pellet; returns home at the end */
      c.life--; const home = simGet(W, c.owner);
      if (c.life <= 0) { if (home) { const dx = home.x - c.x, dy = home.y - c.y, near = dx * dx + dy * dy < 600 * 600; home.mass += near ? c.mass : c.mass * 0.5; home.score += c.score; simAlert(W, near ? "Task force sunset. Functions returned in full." : "Task force sunset far from home. Half its capacity was recovered."); } c.alive = false; continue; }
      if (W.tick % 10 === c.id % 10 || !c.tgt || !W.pel.includes(c.tgt)) { let b = null, bd = 1e18; for (const p of W.pel) { const d = (p.x - c.x) * (p.x - c.x) + (p.y - c.y) * (p.y - c.y); if (d < bd) { bd = d; b = p; } } c.tgt = b; }
      if (c.tgt) steer(c, c.tgt.x - c.x, c.tgt.y - c.y, vmax, dt);
    } else {
      if ((W.tick + c.think) % 15 === 0 || (c.tgt && c.tgt.alive === false) || (c.tgt && c.tgt.t !== undefined && !W.pel.includes(c.tgt))) simThink(W, c);
      if (c.tgt) steer(c, c.tgt.x - c.x, c.tgt.y - c.y, vmax * (c.state === "Consolidate" ? 0.7 : 1), dt); else steer(c, 0, 0, vmax, dt);
    }
    c.x += c.vx * dt; c.y += c.vy * dt;
    const r = simR(c.mass); if (c.x < r) { c.x = r; c.vx = 0; } if (c.y < r) { c.y = r; c.vy = 0; } if (c.x > SWORLD.w - r) { c.x = SWORLD.w - r; c.vx = 0; } if (c.y > SWORLD.h - r) { c.y = SWORLD.h - r; c.vy = 0; }
    if (c.pact > 0) c.pact = Math.max(0, c.pact - dt);
    if (c.mass > 40) { const loss = c.mass * 0.004 * dt; c.mass -= loss; W.lost += loss; }
    if (c.player && W.ar.sunset) { const loss = c.mass * W.ar.sunset * dt; c.mass -= loss; W.lost += loss; }
    for (let i = 0; i < 3; i++) if (c.cd[i] > 0) c.cd[i] -= 1;
    c.exp = Math.max(0, c.exp - dt * 0.6);
  }
  /* pellets */
  for (const c of W.cells) {
    if (!c.alive) continue; const r = simR(c.mass), r2 = r * r;
    for (let i = 0; i < W.pel.length; i++) { const p = W.pel[i], dx = p.x - c.x, dy = p.y - c.y; if (dx * dx + dy * dy < r2) { simGain(W, c, p.t); W.pel[i] = { x: 30 + W.rnd() * (SWORLD.w - 60), y: 30 + W.rnd() * (SWORLD.h - 60), t: W.pickType() }; } }
  }
  /* contact absorption */
  const live = W.cells.filter(c => c.alive).sort((a, b) => b.mass - a.mass || a.id - b.id);
  for (const a of live) {
    if (!a.alive) continue; const ra = simR(a.mass);
    for (const b of live) {
      if (!b.alive || a === b || b.owner === a.id || a.owner === b.id || (a.owner && b.owner && a.owner === b.owner)) continue;
      if ((a.player && b.owner === a.id) || !canAbsorb(a, b)) continue;
      const dx = b.x - a.x, dy = b.y - a.y, rb = simR(b.mass);
      if (dx * dx + dy * dy < (ra - rb * 0.35) * (ra - rb * 0.35)) { simAbsorb(W, a, b, a.player ? "Contact absorption" : ""); if (W.over) return; }
    }
  }
  /* reorganization plan */
  if (W.plan && W.tick >= W.plan.at) {
    const P2 = simGet(W, W.player); W.plan = null;
    if (P2) { let b = null, bd = 1e18; const R = simR(P2.mass) * 2.6 + 120; for (const c of W.cells) { if (!c.alive || c === P2 || c.owner === P2.id || c.mass > 0.95 * P2.mass) continue; const d = (c.x - P2.x) * (c.x - P2.x) + (c.y - P2.y) * (c.y - P2.y); if (d < R * R && d < bd) { bd = d; b = c; } }
      if (b) { simAbsorb(W, P2, b, "Reorganization Plan approved"); simAlert(W, "REORGANIZATION FINALIZED. An org chart has been inconvenienced."); } else simAlert(W, "Plan withdrawn. No eligible agency in range. Forms retained."); }
  }
  /* oversight waves and scenario events */
  if (W.tick % (W.sc.wave * 60) === 0) {
    W.waves++; let hit = 0;
    for (const c of W.cells) if (c.alive && c.exp >= W.sc.waveExp) { const loss = c.mass * W.sc.waveCut; c.mass -= loss; W.lost += loss; c.exp *= 0.5; hit++; if (c.player) simAlert(W, "OVERSIGHT HEARING · your capacity −" + (W.sc.waveCut * 100).toFixed(0) + "%. Testimony was thorough."); }
    simAlert(W, "Oversight hearing convened · " + hit + " agenc" + (hit === 1 ? "y" : "ies") + " cited", "sys");
    if (W.sc.cycles) {
      const need = W.sc.cycles[W.cycle], P3 = simGet(W, W.player);
      if (P3 && need !== undefined) { if (P3.mass >= need) { simAlert(W, "BUDGET REVIEW " + (W.cycle + 1) + " PASSED · capacity " + P3.mass.toFixed(0) + " ≥ " + need); W.cycle++; if (W.cycle >= W.sc.cycles.length) simEnd(W, true, "All four budget reviews passed. The appropriations cycle continues without you noticing."); } else simEnd(W, false, "Budget review " + (W.cycle + 1) + " failed: capacity " + P3.mass.toFixed(0) + " below " + need + "."); }
    }
  }
  if (W.sc.reorg && W.tick % (W.sc.reorg * 60) === 0) {
    const npcs = W.cells.filter(c => c.alive && c.npc).sort((a, b) => a.mass - b.mass || a.id - b.id);
    if (npcs.length >= 2) { const [a, b] = [npcs[1], npcs[0]]; a.mass += b.mass; a.score += b.score; b.alive = false; simAlert(W, "STRUCTURAL PROPOSAL · " + b.name + " merged into " + a.name + ". Circle remains confident.", "sys"); }
  }
  const P4 = simGet(W, W.player);
  if (P4 && W.sc.target && P4.score >= W.sc.target) simEnd(W, true, "Jurisdiction score " + P4.score.toFixed(0) + ". Mandate secured. Budget authority not conferred.");
  if (P4 && P4.mass < 4) simEnd(W, false, "Operating capacity exhausted.");
  if (t >= W.sc.limit && !W.over) {
    if (W.sc.target) simEnd(W, false, "Session time expired at score " + (P4 ? P4.score.toFixed(0) : 0) + " of " + W.sc.target + ".");
    else if (!W.sc.cycles) simEnd(W, true, "Still operating after " + W.sc.limit + " seconds. For now.");
    else simEnd(W, false, "The session closed before the final review.");
  }
}
function simHash(W) {
  let h = 2166136261 >>> 0; const mix = v => { const s = String(v); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
  mix(W.tick); for (const c of W.cells) { mix(c.id); mix(c.alive ? 1 : 0); mix(c.x.toFixed(3)); mix(c.y.toFixed(3)); mix(c.mass.toFixed(4)); mix(c.score.toFixed(3)); }
  for (const p of W.pel) { mix(p.x.toFixed(2)); mix(p.t); }
  mix(W.over ? (W.over.won ? "W" : "L") + W.over.tick : "-"); return h.toString(16).padStart(8, "0");
}
/* replay: (seed, version, scenario, archetype, action log) -> identical state */
function simReplay(meta, log, ticks) {
  const W = simNew(meta); let i = 0; const n = ticks === undefined ? (log.length ? log[log.length - 1].t : 0) : ticks;
  while (W.tick < n && !W.over) { let inp = null; while (i < log.length && log[i].t === W.tick + 1) { const e = log[i++]; inp = inp || {}; if (e.a) simAct(W, e.a); else { inp.dx = e.dx; inp.dy = e.dy; } } simStep(W, inp); }
  return W;
}

/* ---------------- live session (viewer side) ---------------- */
const SIMV = { W: null, meta: null, log: [], acc: 0, paused: false, cam: { x: SWORLD.w / 2, y: SWORLD.h / 2, z: 0.6 }, ptr: null, keys: new Set(), lastIn: { dx: 0, dy: 0 }, pendingA: [], sig: "", lastSnap: null, setup: true };
function simStart(meta) {
  SIMV.meta = { scenario: meta.scenario, archetype: meta.archetype, seed: meta.seed >>> 0 || 1, v: SIM_V };
  SIMV.W = simNew(SIMV.meta); SIMV.W.stats = {}; SIMV.log = []; SIMV.acc = 0; SIMV.paused = false; SIMV.lastIn = { dx: 0, dy: 0 }; SIMV.pendingA = []; SIMV.setup = false; SIMV.sig = ""; SIMV.lastSnap = null;
  $("simSetup").hidden = true; $("simOver").hidden = true; arena.focus({ preventScroll: true });
  log("Simulation started · " + SIMV.W.sc.name + " · " + SIMV.W.ar.short + " · seed " + SIMV.meta.seed + " · fictional");
}
function simInputNow() {
  let dx = 0, dy = 0; const k = SIMV.keys;
  if (k.has("a") || k.has("arrowleft")) dx -= 1; if (k.has("d") || k.has("arrowright")) dx += 1; if (k.has("w") || k.has("arrowup")) dy -= 1; if (k.has("s") || k.has("arrowdown")) dy += 1;
  if (!dx && !dy && SIMV.ptr) { const P = simGet(SIMV.W, SIMV.W.player); if (P) { const sx = AW / 2 + (P.x - SIMV.cam.x) * SIMV.cam.z, sy = AH / 2 + (P.y - SIMV.cam.y) * SIMV.cam.z, ex = SIMV.ptr[0] - sx, ey = SIMV.ptr[1] - sy, L = Math.sqrt(ex * ex + ey * ey); if (L > 14) { dx = ex / L; dy = ey / L; } } }
  else if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
  return { dx: q8(dx), dy: q8(dy) };
}
function simFrame(dt) {
  const W = SIMV.W;
  if (W && !SIMV.paused && !W.over && !SIMV.setup) {
    SIMV.acc += dt; let n = 0;
    while (SIMV.acc >= SIM_DT && n++ < 6) {
      SIMV.acc -= SIM_DT; const t = W.tick + 1, inp = simInputNow(); let pass = null;
      if (inp.dx !== SIMV.lastIn.dx || inp.dy !== SIMV.lastIn.dy) { SIMV.log.push({ t, dx: inp.dx, dy: inp.dy }); SIMV.lastIn = inp; pass = { dx: inp.dx, dy: inp.dy }; }
      for (const a of SIMV.pendingA.splice(0)) { SIMV.log.push({ t, a }); simAct(W, a); }
      simStep(W, pass);
      if (W.over) { simShowOver(); break; }
    }
    if (SIMV.acc > SIM_DT * 6) SIMV.acc = 0;
  }
  const P = W && (simGet(W, W.player) || W.cells.find(c => c.id === W.player));
  if (P) { const want = { x: P.x, y: P.y, z: Math.max(0.3, Math.min(0.9, AH * 0.06 / simR(P.mass))) }; const k = 1 - Math.exp(-dt * 5); SIMV.cam.x += (want.x - SIMV.cam.x) * k; SIMV.cam.y += (want.y - SIMV.cam.y) * k; SIMV.cam.z = Math.exp(Math.log(SIMV.cam.z) + (Math.log(want.z) - Math.log(SIMV.cam.z)) * k); }
  actx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (W) renderSim(actx, AW, AH, SIMV.cam, W); else { actx.fillStyle = "#ece9df"; actx.fillRect(0, 0, AW, AH); }
  renderSimPanels();
}
function renderSim(ctx, W0, H0, cam, W, opt = {}) {
  ctx.save(); ctx.fillStyle = "#ece9df"; ctx.fillRect(0, 0, W0, H0);
  ctx.translate(W0 / 2, H0 / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  ctx.fillStyle = "#f8f6ef"; ctx.fillRect(0, 0, SWORLD.w, SWORLD.h);
  const vx0 = cam.x - W0 / 2 / cam.z, vy0 = cam.y - H0 / 2 / cam.z, vx1 = cam.x + W0 / 2 / cam.z, vy1 = cam.y + H0 / 2 / cam.z;
  ctx.beginPath(); for (let x = Math.max(0, Math.floor(vx0 / 50) * 50); x <= Math.min(SWORLD.w, vx1); x += 50) { ctx.moveTo(x, Math.max(0, vy0)); ctx.lineTo(x, Math.min(SWORLD.h, vy1)); }
  for (let y = Math.max(0, Math.floor(vy0 / 50) * 50); y <= Math.min(SWORLD.h, vy1); y += 50) { ctx.moveTo(Math.max(0, vx0), y); ctx.lineTo(Math.min(SWORLD.w, vx1), y); }
  ctx.strokeStyle = "#e2dfd6"; ctx.lineWidth = 1 / cam.z; ctx.stroke();
  ctx.strokeStyle = "#c9c4b6"; ctx.lineWidth = 3 / cam.z; ctx.strokeRect(0, 0, SWORLD.w, SWORLD.h);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const p of W.pel) {
    if (p.x < vx0 - 10 || p.x > vx1 + 10 || p.y < vy0 - 10 || p.y > vy1 + 10) continue;
    const T = PELLET_TYPES[p.t]; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 7); ctx.fillStyle = T.color; ctx.fill();
    if (cam.z > 0.55) { ctx.fillStyle = "rgba(29,35,33,.75)"; ctx.font = `700 8px ${CELL_FONT}`; ctx.fillText(T.g, p.x, p.y + 0.5); }
  }
  const P = W.cells.find(c => c.id === W.player);
  if (W.plan && P && P.alive) { const R = simR(P.mass) * 2.6 + 120; ctx.save(); ctx.setLineDash([12 / cam.z, 9 / cam.z]); ctx.lineDashOffset = -W.tick; ctx.strokeStyle = "#c2410c"; ctx.lineWidth = 2.4 / cam.z; ctx.beginPath(); ctx.arc(P.x, P.y, R, 0, 7); ctx.stroke(); ctx.restore(); }
  const cells = W.cells.filter(c => c.alive).sort((a, b) => a.mass - b.mass);
  for (const c of cells) {
    const r = simR(c.mass);
    if (c.pact > 0) { ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = "#46b7c6"; ctx.lineWidth = 4 / cam.z; ctx.beginPath(); ctx.arc(c.x, c.y, r + 8 / cam.z, 0, 7); ctx.stroke(); ctx.restore(); }
    drawCellBody(ctx, c.x, c.y, r, c.color, W.tick / 60, c.id * 1.7, { preop: !!c.owner });
    drawLabel(ctx, c.x, c.y, Math.round(r / 3) * 3, c.player ? "You · " + c.name : c.owner ? "Task Force" : c.name, null, c.color, 1, cam.z);
    if (c.player) { const s = r + 12 / cam.z, L = 14 / cam.z; ctx.strokeStyle = "#c2410c"; ctx.lineWidth = 2.4 / cam.z; ctx.beginPath(); for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(c.x + sx * s, c.y + sy * (s - L)); ctx.lineTo(c.x + sx * s, c.y + sy * s); ctx.lineTo(c.x + sx * (s - L), c.y + sy * s); } ctx.stroke(); }
  }
  ctx.restore();
}
/* ---------------- panels ---------------- */
function simPctBar(v) { return `<span class="bar"><i style="width:${Math.max(0, Math.min(100, v * 100)).toFixed(1)}%"></i></span>`; }
function renderSimPanels() {
  const W = SIMV.W; if (!W) return;
  const P = W.cells.find(c => c.id === W.player), t = W.tick / 60, sc = W.sc;
  const prog = sc.target ? P.score / sc.target : sc.cycles ? W.cycle / sc.cycles.length : t / sc.limit;
  const sig = [W.tick >> 3, W.over ? 1 : 0, SIMV.paused, W.alerts.length].join("|"); if (sig === SIMV.sig) return; SIMV.sig = sig;
  $("simMission").innerHTML = `<div class="lbl">Mission · ${sc.name}</div><div class="obs-title">${sc.goal}</div>${simPctBar(prog)}<div class="lbl">${sc.target ? "Score " + P.score.toFixed(0) + " / " + sc.target : sc.cycles ? "Reviews passed " + W.cycle + " / " + sc.cycles.length + (W.cycle < sc.cycles.length ? " · next needs " + sc.cycles[W.cycle] : "") : "Operating " + t.toFixed(0) + " / " + sc.limit + " s"}</div>`;
  $("simRes").innerHTML = PELLET_TYPES.map(p => `<li title="${p.expl}"><span class="pd" style="background:${p.color}">${p.g}</span><span>${p.name}</span><b>${(W.stats && W.stats[p.k]) || 0}</b></li>`).join("");
  $("simAlerts").innerHTML = W.alerts.slice(-7).reverse().map(a => `<li class="${a.kind}"><span class="ts">${(a.t / 60).toFixed(0)}s</span>${a.text}</li>`).join("");
  const cd = i => P.cd[i] > 0 ? (P.cd[i] / 60).toFixed(0) + "s" : "ready";
  document.querySelectorAll("#simAbil [data-a]").forEach(b => { const i = +b.dataset.a - 1, ready = P.cd[i] <= 0 && P.alive && !W.over; b.classList.toggle("ready", ready); b.querySelector(".cd").textContent = cd(i); });
  $("simClock").textContent = `${t.toFixed(1)} / ${sc.limit} s`; $("simSeed").textContent = "Seed " + W.seed;
  $("simTl").style.setProperty("--p", Math.min(1, t / sc.limit)); $("simPause").querySelector("span").textContent = SIMV.paused ? "Resume" : "Pause";
  if (!$("simTl").dataset.w || $("simTl").dataset.w !== sc.id) { $("simTl").dataset.w = sc.id; let h = ""; for (let s = sc.wave; s < sc.limit; s += sc.wave) h += `<i class="wv" style="left:${(s / sc.limit * 100).toFixed(2)}%" title="Oversight hearing at ${s}s"></i>`; $("simTl").innerHTML = h + '<b class="ph"></b>'; }
  $("simProfile").innerHTML = `<div class="ent"><canvas id="simEmb" width="112" height="112"></canvas><div><div class="lbl">Your agency · ${W.ar.short}</div><div class="short">${W.ar.name}</div></div></div>
    <dl class="kv"><dt>Status</dt><dd>${P.alive ? (W.over ? (W.over.won ? '<span class="tag on">Objective met</span>' : '<span class="tag off">Session ended</span>') : '<span class="tag on">Operating · for now</span>') : '<span class="tag off">Absorbed</span>'}</dd><dt>Jurisdiction</dt><dd>${P.score.toFixed(0)} <span class="lbl">score</span></dd><dt>Capacity</dt><dd>${P.mass.toFixed(1)} <span class="lbl">operating units</span></dd><dt>Oversight</dt><dd>${P.exp.toFixed(0)} <span class="lbl">exposure</span>${P.exp >= sc.waveExp ? ' <span class="tag warn">will be cited</span>' : ""}</dd><dt>Confidence</dt><dd>${Math.max(0, 100 - P.exp / 2).toFixed(0)}% <span class="lbl">public, fictional</span></dd><dt>Authority</dt><dd>${P.auth.toFixed(1)}</dd><dt>Staffing</dt><dd>${P.staff.toFixed(0)}</dd><dt>Absorbed</dt><dd>${P.absorbed}</dd></dl><p class="expl">${W.ar.why}</p>`;
  const g = $("simEmb").getContext("2d"); g.clearRect(0, 0, 112, 112); g.beginPath(); g.arc(56, 56, 50, 0, 7); g.fillStyle = P.color; g.fill();
  const rivals = W.cells.filter(c => c.alive && c.npc).sort((a, b) => b.mass - a.mass).slice(0, 7);
  $("simRivals").innerHTML = rivals.map(c => `<tr><td><span class="pd" style="background:${c.color}"></span>${c.name}</td><td class="mono">${c.state}</td><td class="mono">${c.mass.toFixed(0)}</td></tr>`).join("") + `<tr><td colspan="3" class="lbl">${W.cells.filter(c => c.alive && c.npc).length} rivals operating · ${W.lost.toFixed(0)} capacity lost to overhead</td></tr>`;
}
function simShowOver() {
  const W = SIMV.W, P = W.cells.find(c => c.id === W.player), el = $("simOver");
  SIMV.lastSnap = document.createElement("canvas"); SIMV.lastSnap.width = 1200; SIMV.lastSnap.height = 900; renderSim(SIMV.lastSnap.getContext("2d"), 1200, 900, { x: P.x, y: P.y, z: Math.max(0.3, Math.min(1.2, 900 * 0.12 / simR(P.mass))) }, W);
  REPORT.lastRun = { meta: { ...SIMV.meta }, log: SIMV.log.slice(), hash: simHash(W), won: W.over.won, text: W.over.text, score: P.score, mass: P.mass, t: W.tick / 60, name: W.ar.name, sc: W.sc.name, snap: SIMV.lastSnap };
  el.hidden = false;
  el.innerHTML = `<span class="lbl ${W.over.won ? "c" : "a"}">Simulation / fictional · ${W.over.won ? "Objective met" : "Session ended"}</span><span class="t">${W.over.text}</span>
    <div class="lbl">Score ${P.score.toFixed(0)} · capacity ${P.mass.toFixed(1)} · ${(W.tick / 60).toFixed(1)} s · seed ${W.seed} · run ${simHash(W)}</div>
    <div class="btnrow"><button class="btn amber" type="button" data-sim="retry">${ic("replay")}Retry same seed</button><button class="btn" type="button" data-sim="new">${ic("route")}New seed</button><button class="btn cyan" type="button" data-sim="report">${ic("doc")}Make a briefing card</button><button class="btn" type="button" data-sim="archive">${ic("history")}Back to the record</button></div>`;
  log("Simulation ended · " + (W.over.won ? "objective met" : "session ended") + " · score " + P.score.toFixed(0), true);
}
function simSetupCard() {
  SIMV.setup = true; $("simOver").hidden = true; const el = $("simSetup"); el.hidden = false;
  const cur = SIMV.meta || { scenario: SCENARIOS[0].id, archetype: ARCHETYPES[0].id, seed: 12345 };
  el.innerHTML = `<span class="lbl a">Experimental / fictional sandbox</span><span class="t">Choose an agency. Acquire jurisdiction. Dodge oversight.</span>
    <div class="lbl">Scenario</div><div class="pick" id="simScen">${SCENARIOS.map(s => `<button type="button" data-v="${s.id}" aria-pressed="${s.id === cur.scenario}"><b>${s.name}</b><span>${s.goal}</span></button>`).join("")}</div>
    <div class="lbl">Agency archetype</div><div class="pick" id="simArch">${ARCHETYPES.map(a => `<button type="button" data-v="${a.id}" aria-pressed="${a.id === cur.archetype}"><b>${a.short}</b><span>${a.why}</span></button>`).join("")}</div>
    <div class="btnrow" style="align-items:center"><label class="lbl" for="simSeedIn">Seed</label><input id="simSeedIn" inputmode="numeric" value="${cur.seed}" style="width:110px"><button class="btn amber" type="button" data-sim="start">${ic("play")}Start session</button></div>
    <p class="expl">Steer with the pointer, a finger, or WASD. Abilities: 1 Task Force, 2 Transfer Functions, 3 Reorganization Plan. Names are fictional. Nothing here changes the historical record.</p>`;
}
const simSel = id => { const b = document.querySelector(`#${id} [aria-pressed="true"]`); return b ? b.dataset.v : null; };
function simWire() {
  $("simSetup").addEventListener("click", e => {
    const p = e.target.closest(".pick button"); if (p) { p.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === p))); return; }
    if (e.target.closest('[data-sim="start"]')) simStart({ scenario: simSel("simScen"), archetype: simSel("simArch"), seed: parseInt($("simSeedIn").value, 10) || 1 });
  });
  $("simOver").addEventListener("click", e => {
    const b = e.target.closest("[data-sim]"); if (!b) return; const a = b.dataset.sim;
    if (a === "retry") simStart(SIMV.meta); else if (a === "new") simStart({ ...SIMV.meta, seed: (SIMV.meta.seed * 1103515245 + 12345) % 2147483647 });
    else if (a === "report") { setApp("report"); REPORT.story = "sim"; renderReportUI(true); } else if (a === "archive") setApp("observe");
  });
  $("simAbil").addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (b && SIMV.W && !SIMV.setup) { SIMV.pendingA.push(+b.dataset.a); arena.focus({ preventScroll: true }); } });
  $("simPause").addEventListener("click", () => { SIMV.paused = !SIMV.paused; });
  $("simRestart").addEventListener("click", () => SIMV.meta && simStart(SIMV.meta));
  $("simNew").addEventListener("click", () => simSetupCard());
  $("simBack").addEventListener("click", () => setApp("observe"));
  const rel = e => { const r = arena.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  arena.addEventListener("pointermove", e => { if (S.app === "simulate") SIMV.ptr = rel(e); });
  arena.addEventListener("pointerdown", e => { if (S.app === "simulate") { SIMV.ptr = rel(e); arena.focus({ preventScroll: true }); } });
  arena.addEventListener("pointerleave", e => { if (S.app === "simulate" && e.pointerType === "mouse") SIMV.ptr = null; });
  arena.addEventListener("pointerup", e => { if (S.app === "simulate" && e.pointerType !== "mouse") SIMV.ptr = null; });
}
function simKey(e, down) {
  const tag = (e.target.tagName || "").toLowerCase(); if (tag === "input" || tag === "textarea" || tag === "select") return false;
  const k = e.key.toLowerCase();
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { if (e.target.closest && e.target.closest("button,[role=slider]") && k.startsWith("arrow")) return false; e.preventDefault(); down ? SIMV.keys.add(k) : SIMV.keys.delete(k); return true; }
  if (down && ["1", "2", "3", "q", "e", "r"].includes(k) && SIMV.W && !SIMV.setup) { SIMV.pendingA.push({ 1: 1, 2: 2, 3: 3, q: 1, e: 2, r: 3 }[k]); return true; }
  if (down && k === " " && SIMV.W && !SIMV.setup && (e.target === arena || e.target === document.body)) { e.preventDefault(); SIMV.paused = !SIMV.paused; return true; }
  return false;
}
