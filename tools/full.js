/* ================= FULL HISTORY 1775–2026 (compiled from dataset.zip by compile_history.py) ================= */
/* Every position, size and frame below is a pure function of the date (year as a float), so reverse play,
   scrubbing and forward replay all land on the same state. */
const HDATASET = "census-" + HIST.meta.version + "/full";
const yToMs = y => { const Y = Math.floor(y), a = Date.UTC(Y, 0, 1), b = Date.UTC(Y + 1, 0, 1); return a + (y - Y) * (b - a); };
const msToY = ms => { const Y = new Date(ms).getUTCFullYear(), a = Date.UTC(Y, 0, 1), b = Date.UTC(Y + 1, 0, 1); return Y + (ms - a) / (b - a); };
const FY0 = 1774.5, FY1 = msToY(D("2026-11-19") + DAY / 2);
const HWORLD = { w: HIST.meta.world[0], h: HIST.meta.world[1] };
const TIER_BASE = { 1: 2.0, 2: 1.35, 3: 1.0, 4: 0.78, 5: 0.62, 6: 0.68 };
const LEVEL_NAME = { 1: "Department", 2: "Independent agency", 3: "Bureau", 4: "Sub-agency or office", 5: "Field or regional unit", 6: "Temporary or advisory body" };
const BASIS_NAME = ["law", "stated in source", "agency history", "records span", "reference year, not sourced", "not recorded"];
const CONF_NAME = ["high", "medium", "low"];
const KIND_NAME = ["absorbed", "merged", "moved", "partial transfer", "renamed", "succeeded"];
const KIND_EXPL = ["abolished; functions went to the target", "combined into the target", "unit survives, new parent", "some functions moved to the target", "same entity, new name", "replaced by the target"];
const END_NAME = ["No end recorded", "Ended", "Absorbed", "Continued under a new name", "Divided", "Retired by the feed"];
function hsl(h, s, l) { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)); return "#" + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join(""); }
const GLYPH_RULES = [[/aeronaut|space/i, "planet"], [/aviation|air (force|corps|commerce|mail)|aircraft|airport/i, "wing"], [/atomic|nuclear/i, "atom"], [/energy|power|electric/i, "bolt"], [/defense|security|regulat|intelligence|protect/i, "shield"], [/navy|naval|maritime|coast|ship|harbor|steamboat/i, "anchor"], [/army|war\b|military|veteran|marine corps/i, "star"], [/agricult|farm|food|grain|crop|forest/i, "wheat"], [/interior|land|park|geolog|mine|reclamation|mountain/i, "mountain"], [/census|statistic|budget|treasury|revenue|mint|accounts/i, "tally"], [/broadcast|radio|communicat|telegraph|signal|postal|post office/i, "mast"], [/labor|works|engineer|construction|housing|road|highway/i, "hardhat"], [/department|court|justice|state\b|commission/i, "portico"]];
const HU = HIST.U.map((a, i) => ({ i, key: "h" + i, name: a[0], tier: a[1], level: a[2], t0: a[3], t1: a[4], endKind: a[5], conf: a[6], basis: a[7], url: a[8], id: a[9], homes: a[10], m: a[11], bornOf: a[12], into: a[13], sY: a[14], eY: a[15], loc: a[16], seed: (i * 2654435761 % 1000) / 160, ins: [], outs: [] }));
const HE = HIST.E.map((a, i) => ({ i, from: a[0], to: a[1], kind: a[2], t: a[3], date: a[4], stat: a[5], auth: a[6], conf: a[7], ev: a[8], sent: a[9], note: a[10], reviewed: !!a[11] }));
const HB = HIST.B.map((a, i) => ({ i, t: a[0], kind: a[1], title: a[2], units: a[3], edges: a[4], reviewed: !!a[5] }));
const HBYID = new Map(HU.map(u => [u.id, u]));
HE.forEach(e => { HU[e.from].outs.push(e); HU[e.to].ins.push(e); });
const HE_T = HE.filter(e => e.t !== null).sort((a, b) => a.t - b.t);
/* family colours: each root (department or parentless agency) gets a hue; its sub-units share it */
(() => {
  const rootOf = u => { let c = u, n = 0; while (c.homes[0][3] >= 0 && n++ < 12) c = HU[c.homes[0][3]]; return c; };
  let di = 0;
  for (const u of HU) {
    const r = rootOf(u);
    if (r.hue === undefined) r.hue = r.tier === 1 ? (di++ * 137.508 + 8) % 360 : (r.i * 97.3) % 360;
    const light = { 1: 56, 2: 60, 3: 63, 4: 66, 5: 69, 6: 67 }[u.tier];
    u.color = hsl((r.hue + (u === r ? 0 : (u.i % 7 - 3) * 4) + 360) % 360, u.tier === 1 ? 70 : 62, light);
    u.glyph = (GLYPH_RULES.find(([re]) => re.test(u.name)) || [])[1] || null;
  }
})();
const hkey = k => typeof k === "string" && k[0] === "h" ? HU[+k.slice(1)] : null;
const hAlive = (u, y) => y >= u.t0 && (u.t1 === null || y < u.t1);
const fmtY = y => fmt(yToMs(y));

function hHomeAt(u, y) {
  const H = u.homes; let k = 0;
  for (let i = 1; i < H.length; i++) if (H[i][0] <= y) k = i;
  if (k > 0) { const v = (y - H[k][0]) / 0.6; if (v < 1) { const e = ease(v); return [lerp(H[k - 1][1], H[k][1], e), lerp(H[k - 1][2], H[k][2], e)]; } }
  return [H[k][1], H[k][2]];
}
function hDrift(u, y) { if (reduced) return [0, 0]; const s = u.seed, t = y * 4; return [Math.sin(t * 0.9 + s) * 5 + Math.sin(t * 0.37 + s * 2.3) * 3, Math.cos(t * 0.8 + s * 1.7) * 5 + Math.cos(t * 0.23 + s) * 3]; }
function hMass(u, y) {
  const m = u.m; let j = -1;
  for (let i = 0; i < m.length; i += 2) { if (m[i] <= y) j = i; else break; }
  if (j < 0) return 1;
  const cur = m[j + 1], prev = j >= 2 ? m[j - 1] : 1;
  return prev + (cur - prev) * ease(clamp01((y - m[j]) / 0.4));
}
const hRadius = (u, y) => 30 * TIER_BASE[u.tier] * Math.sqrt(hMass(u, y));
function hPosRaw(u, y) { const h = hHomeAt(u, y), d = hDrift(u, y); return [h[0] + d[0], h[1] + d[1]]; }
const SPAWN = 0.35;
function hCell(u, y) {
  if (y < u.t0 || (u.t1 !== null && y >= u.t1)) return null;
  let [x, yy] = hPosRaw(u, y), r = hRadius(u, y), a = 1;
  const sp = (y - u.t0) / SPAWN;
  if (sp < 1) {
    const e = ease(sp), src = u.bornOf >= 0 ? hPosRaw(HU[u.bornOf], u.t0 - 1e-4) : (u.homes[0][3] >= 0 ? hPosRaw(HU[u.homes[0][3]], u.t0) : null);
    if (src) { x = lerp(src[0], x, e); yy = lerp(src[1], yy, e); }
    r *= 0.25 + 0.75 * e; a = Math.min(1, 0.25 + sp);
  }
  if (u.t1 !== null) {
    const left = u.t1 - y;
    if (u.endKind === 2 && u.into.length) {
      const w = hTravel(u); if (left < w) { const tp = hPosRaw(HU[u.into[0]], y), e = ease(1 - left / w); x = lerp(x, tp[0], e); yy = lerp(yy, tp[1], e); r *= 1 - 0.75 * e; }
    } else { const w = 0.3; if (left < w) { const e = 1 - left / w; r *= 1 - 0.6 * e; a *= 1 - e; } }
  }
  return { u, key: u.key, x, y: yy, r, a, color: u.color };
}
/* absorbed agencies travel to their recipient; longer trips take longer (0.7 to 1.8 years), still a pure function of the date */
function hTravel(u) { if (u._w === undefined) { const a = hHomeAt(u, u.t1 - 1e-4), b = hHomeAt(HU[u.into[0]], u.t1); u._w = Math.max(0.7, Math.min(1.8, Math.hypot(a[0] - b[0], a[1] - b[1]) / 2500)); } return u._w; }
function hCells(y) { const out = []; for (const u of HU) { if (u.t0 > y) break; const c = hCell(u, y); if (c) out.push(c); } return out; }
function hPosAny(u, y) {
  if (y < u.t0) return [u.homes[0][1], u.homes[0][2], hRadius(u, u.t0 + 0.01)];
  if (u.t1 !== null && y >= u.t1) {
    if (u.endKind === 2 && u.into.length) return hPosAny(HU[u.into[0]], y);
    if ((u.endKind === 3 || u.endKind === 4) && u.into.length) { const p = hPosRaw(u, u.t1 - 1e-4); return [p[0], p[1], hRadius(u, u.t1 - 1e-4)]; }
    const c = hCell(u, Math.max(u.t0, u.t1 - 0.31)); return c ? [c.x, c.y, c.r] : [u.homes[0][1], u.homes[0][2], 30];
  }
  const c = hCell(u, y); return [c.x, c.y, Math.max(c.r, hRadius(u, y) * 0.6)];
}

/* ---------- camera director ---------- */
function hBounds(items, pad, W, H, zmax = 1.1, minW = 760) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y, r] of items) { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); }
  if (!isFinite(x0)) return { x: HWORLD.w / 2, y: HWORLD.h / 2, z: Math.min(W / HWORLD.w, H / HWORLD.h) };
  const bw = Math.max(minW, (x1 - x0) * (1 + 2 * pad)), bh = Math.max(minW * 0.56, (y1 - y0) * (1 + 2 * pad));
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: Math.max(0.02, Math.min(zmax, W / bw, H / bh)) };
}
/* frame only the agencies that change at this beat (plus where they go), so stray duplicates do not widen the shot */
function hBeatUnits(b) {
  if (b._u) return b._u;
  const near = t => t !== null && Math.abs(t - b.t) < 1e-3, set = new Set();
  for (const i of b.units) { const u = HU[i]; if (near(u.t0) || near(u.t1)) { set.add(i); if (near(u.t1)) u.into.forEach(j => set.add(j)); } }
  return (b._u = set.size ? [...set] : b.units);
}
const hBeatFrame = (b, y, W, H) => hBounds(hBeatUnits(b).map(i => hPosAny(HU[i], y)), 0.55, W, H);
function hOverview(cells, W, H) { return hBounds(cells.filter(c => c.u.tier <= 2 || cells.length < 60).map(c => [c.x, c.y, c.r]), 0.08, W, H, 0.6, 1400); }
const LEAD = 1.2, HOLD = 0.9;
function hBeatIdx(y) { let lo = 0, hi = HB.length - 1, ans = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (HB[m].t <= y) { ans = m; lo = m + 1; } else hi = m - 1; } return ans; }
function hAuto(y, W, H, cells) {
  if (Math.abs(S.speed) >= 10 && S.playing && !S.capturing) return hOverview(cells || hCells(y), W, H);
  const i = hBeatIdx(y), a = HB[i], b = HB[i + 1];
  if (!a) return b && y > b.t - LEAD ? hBeatFrame(b, y, W, H) : hOverview(cells || hCells(y), W, H);
  const FA = hBeatFrame(a, y, W, H);
  if (!b) return y < a.t + HOLD ? FA : mixCam(FA, hOverview(cells || hCells(y), W, H), ease((y - a.t - HOLD) / 2));
  const FB = hBeatFrame(b, y, W, H), s0 = a.t + HOLD, s1 = b.t - LEAD;
  if (s1 <= s0) return mixCam(FA, FB, ease(clamp01((y - (s0 + s1) / 2) / 0.5 + 0.5)));
  if (y < s0) return FA; if (y > s1) return FB;
  if (s1 - s0 > 3.2) {
    const OV = hOverview(cells || hCells(y), W, H);
    if (y < s0 + 1.4) return mixCam(FA, OV, ease((y - s0) / 1.4));
    if (y > s1 - 1.4) return mixCam(OV, FB, ease((y - (s1 - 1.4)) / 1.4));
    return OV;
  }
  const c = mixCam(FA, FB, ease((y - s0) / (s1 - s0)));
  c.z /= 1 + 0.35 * Math.sin(Math.PI * clamp01((y - s0) / (s1 - s0)));
  return c;
}
function hFollow(k, y, W, H) { const u = hkey(k), c = u && hCell(u, y); if (!c) return null; return { x: c.x, y: c.y, z: Math.max(0.12, Math.min(1.4, H * 0.16 / Math.max(c.r, 10))) }; }

/* ---------- pellets: procedural tiles, decoration only ---------- */
function tilePellets(tx, ty) { const rnd = mulberry((tx * 73856093) ^ (ty * 19349663) ^ 1775), out = []; for (let i = 0; i < 9; i++) out.push({ x: (tx + rnd()) * 300, y: (ty + rnd()) * 300, r: 4 + rnd() * 2.6, c: PEL_COLORS[(rnd() * PEL_COLORS.length) | 0] }); return out; }

/* ---------- renderer ---------- */
function renderFull(ctx, W, H, cam, y, cells, opt = {}) {
  ctx.save();
  ctx.fillStyle = "#ece9df"; ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2, H / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  const vx0 = cam.x - W / 2 / cam.z, vy0 = cam.y - H / 2 / cam.z, vx1 = cam.x + W / 2 / cam.z, vy1 = cam.y + H / 2 / cam.z;
  ctx.fillStyle = "#f8f6ef"; ctx.fillRect(0, 0, HWORLD.w, HWORLD.h);
  let g = 50; while (g * cam.z < 14) g *= 2;
  ctx.beginPath();
  for (let x = Math.max(0, Math.floor(vx0 / g) * g); x <= Math.min(HWORLD.w, vx1); x += g) { ctx.moveTo(x, Math.max(0, vy0)); ctx.lineTo(x, Math.min(HWORLD.h, vy1)); }
  for (let yy = Math.max(0, Math.floor(vy0 / g) * g); yy <= Math.min(HWORLD.h, vy1); yy += g) { ctx.moveTo(Math.max(0, vx0), yy); ctx.lineTo(Math.min(HWORLD.w, vx1), yy); }
  ctx.strokeStyle = "#e2dfd6"; ctx.lineWidth = 1 / cam.z; ctx.stroke();
  if (cam.z > 0.16) {
    for (let tx = Math.max(0, Math.floor(vx0 / 300)); tx <= Math.min(HWORLD.w / 300, vx1 / 300); tx++)
      for (let ty = Math.max(0, Math.floor(vy0 / 300)); ty <= Math.min(HWORLD.h / 300, vy1 / 300); ty++)
        for (const p of tilePellets(tx, ty)) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fillStyle = p.c; ctx.fill(); }
  }
  const byU = new Map(cells.map(c => [c.u.i, c]));
  /* relationship streams: moves and partial transfers glow for a few months around their date */
  let lo = 0, hi = HE_T.length; while (lo < hi) { const m = (lo + hi) >> 1; if (HE_T[m].t < y - 0.5) lo = m + 1; else hi = m; }
  ctx.lineCap = "round";
  for (let i = lo; i < HE_T.length && HE_T[i].t <= y + 0.5; i++) {
    const e = HE_T[i]; if (e.kind !== 2 && e.kind !== 3) continue;
    const a = byU.get(e.from), b = byU.get(e.to); if (!a || !b) continue;
    const al = 1 - Math.abs(y - e.t) / 0.5;
    ctx.globalAlpha = 0.65 * al; ctx.strokeStyle = e.kind === 2 ? "#5fa8c6" : "#e0a040"; ctx.lineWidth = Math.max(3, 5 / cam.z) ; ctx.setLineDash([14 / cam.z, 10 / cam.z]); ctx.lineDashOffset = -y * 400;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  const vis = cells.filter(c => !(c.x + c.r < vx0 || c.x - c.r > vx1 || c.y + c.r < vy0 || c.y - c.r > vy1)).sort((a, b) => a.r - b.r);
  for (const c of vis) {
    const sr = c.r * cam.z; ctx.globalAlpha = c.a;
    if (sr < 7) { ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fillStyle = c.color; ctx.fill(); continue; }
    if (sr < 26) { ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 7); ctx.fillStyle = c.color; ctx.fill(); ctx.lineWidth = Math.max(1.5, c.r * 0.07); ctx.strokeStyle = shade(c.color, -0.16); if (c.u.endKind === 5) ctx.setLineDash([c.r * 0.2, c.r * 0.14]); ctx.stroke(); ctx.setLineDash([]); }
    else drawCellBody(ctx, c.x, c.y, c.r, c.color, y * 3, c.u.seed * 3, { preop: c.u.endKind === 5 });
    ctx.globalAlpha = 1;
    drawLabel(ctx, c.x, c.y, Math.round(c.r / 3) * 3, c.u.name, c.u.tier <= 3 ? c.u.glyph : null, c.color, c.a, cam.z);
  }
  if (opt.pin) {
    const c = byU.get(hkey(opt.pin) ? hkey(opt.pin).i : -1);
    if (c) { const s = c.r + 14 / cam.z, L = 16 / cam.z; ctx.strokeStyle = "#f2b45a"; ctx.lineWidth = 2.4 / cam.z; ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(c.x + sx * s, c.y + sy * (s - L)); ctx.lineTo(c.x + sx * s, c.y + sy * s); ctx.lineTo(c.x + sx * (s - L), c.y + sy * s); } ctx.stroke(); }
  }
  ctx.restore();
}

/* ---------- viewer actions ---------- */
function seekY(y, opts = {}) {
  S.Y = Math.max(FY0, Math.min(FY1, y)); S.ended = S.Y >= FY1;
  if (S.pin && S.Y < S.pinSinceY) S.pinSinceY = S.Y;
  if (!opts.keepCam) snapCam = true;
  if (!S.started) { S.started = true; $("start").hidden = true; }
  S.pinEnd = null; captureGen++;
}
function hReplay() {
  seekY(FY0); if (S.speed < 0) S.speed = 1; S.playing = true; S.ended = false; S.dismissed.clear(); S.pinSinceY = FY0; S.railPick = null;
  if (S.pin) { S.pin = null; S.mode = "auto"; }
  if (S.mode === "free") S.mode = "auto";
  log("Replay · " + Math.floor(FY0 + 0.5) + " → 2026");
}
function hStep(dir) {
  const cur = S.Y;
  const t = dir > 0 ? HB.find(b => b.t - LEAD > cur + 0.05) : [...HB].reverse().find(b => b.t - LEAD < cur - 0.3);
  if (!t) { if (dir < 0) { seekY(FY0); log("Previous · start of history"); } return; }
  seekY(t.t - LEAD); log((dir > 0 ? "Next" : "Previous") + " · " + t.title);
}
function hAutoSubject(y) {
  const i = Math.max(0, hBeatIdx(y + LEAD)), b = HB[i]; if (!b) return null;
  const order = y < b.t ? b.units : [...b.units].reverse();
  const k = order.find(j => hAlive(HU[j], y));
  if (k !== undefined) return HU[k].key;
  const big = hCells(y).sort((a, c) => c.r - a.r)[0]; return big ? big.key : HU[0].key;
}
function hInvolves(b, k) { const u = hkey(k); return !!u && b.units.includes(u.i); }

/* ---------- evidence rail: frames rendered from the simulation at canonical framing ---------- */
const H_PHASES = b => [{ key: "before", label: "Before", t: b.t - 0.6 }, { key: "event", label: b.kind === "founded" ? "Founding" : b.kind === "split" ? "Division" : "Contact", t: b.t + 0.12 }, { key: "after", label: "After", t: b.t + 0.7 }];
const hCapKey = (b, ph) => `${HDATASET}|${b.i}|${ph.key}|r${RENDER_V}`;
function hRequestCapture(b, ph) {
  const key = hCapKey(b, ph); if (capCache.has(key) || capPending.has(key)) return;
  capPending.add(key); const gen = captureGen;
  setTimeout(() => {
    capPending.delete(key);
    try {
      const W = 352, H = 198, c = document.createElement("canvas"); c.width = W; c.height = H;
      S.capturing = true; const cells = hCells(ph.t), fr = hAuto(ph.t, W, H, cells); S.capturing = false;
      renderFull(c.getContext("2d"), W, H, fr, ph.t, cells);
      capCache.set(key, c.toDataURL("image/png"));
    } catch (e) { S.capturing = false; console.warn("capture failed", key, e); }
    if (gen === captureGen || capCache.has(key)) renderRail(true);
  }, 0);
}
/* rail: the last beat on record, until the next beat's "before" frame is due */
function hRailCur(y) { const i = hBeatIdx(y), n = HB[i + 1]; return n && y >= n.t - 0.6 ? i + 1 : Math.max(0, i); }
function hRailIdx() { if (S.railPick !== null) return S.railPick; return hRailCur(S.Y); }
function renderRailFull(force) {
  const idx = hRailIdx(), b = HB[idx], phases = H_PHASES(b), reached = hRailCur(S.Y);
  const filed = phases.map(p => S.Y >= p.t);
  const sig = ["F", idx, filed.join(), phases.map(p => capCache.has(hCapKey(b, p))).join(), reached].join("|");
  if (sig === railSig && !force) return; railSig = sig;
  $("obsNo").textContent = "Observation " + String(idx + 1).padStart(4, "0") + " of " + HB.length + (b.reviewed ? " · reviewed" : " · draft");
  $("obsTitle").textContent = b.title;
  $("obsTabs").innerHTML = `<button type="button" data-hobs="${idx - 1}" ${idx <= 0 ? "disabled" : ""} aria-label="Previous observation">${ic("prev", "sm")}</button><button type="button" data-hobs="${idx + 1}" ${idx + 1 > Math.max(reached, 0) ? "disabled" : ""} aria-label="Next observation">${ic("next", "sm")}</button><button type="button" aria-pressed="true" disabled>${Math.floor(b.t)}</button>`;
  let cur = -1; phases.forEach((p, i) => { if (filed[i]) cur = i; });
  $("slots").innerHTML = phases.map((p, i) => {
    const key = hCapKey(b, p), img = capCache.get(key);
    if (filed[i] && !img) hRequestCapture(b, p);
    const frame = filed[i] && img
      ? `<button type="button" class="frame" data-hseek="${p.t}" data-hb="${b.i}" data-ph="${p.key}" aria-label="Open ${p.label} frame of ${b.title}"><img alt="${p.label}: ${b.title}, rendered from the simulation" src="${img}"></button>`
      : `<div class="frame"><span class="await">${filed[i] ? "FILING FRAME" : "AWAITING FRAME"}</span></div>`;
    return `<div class="slot ${i === cur && idx === reached ? "current" : ""}" data-slot="${p.key}" data-filed="${filed[i] && !!img}">${frame}<div class="meta"><span>0${i + 1} ${p.label}</span><span class="st ${filed[i] ? "" : "pend"}">${filed[i] ? (img ? ic("check", "sm") + "FILED" : "…") : ic("pending", "sm") + "PENDING"}</span></div></div>`;
  }).join("");
}

/* ---------- desk panels ---------- */
function hOnRecord() {
  const y = S.Y, i = hBeatIdx(y + LEAD), b = HB[i];
  if (!b) return { t: "Before the first recorded federal unit", ph: "Lead-in · " + fmtY(y) };
  const pre = b.reviewed ? "Reviewed · " : "Draft · ";
  if (y < b.t) return { t: b.title, ph: pre + "Approach · " + fmtY(b.t) };
  if (y < b.t + HOLD) return { t: b.title, ph: pre + "On record · " + fmtY(b.t) };
  const nx = HB[i + 1];
  return { t: b.title, ph: nx ? "Quiet interval · next beat " + Math.floor(nx.t) : (S.ended ? "History complete · Replay available" : "Holding result") };
}
function hParentAt(u, y) { let p = -1; for (const h of u.homes) if (h[0] <= y + 1e-9) p = h[3]; return p >= 0 && hAlive(HU[p], y) ? HU[p] : null; }
function hStatus(u, y) {
  if (y < u.t0) return { s: "Not yet established · " + (u.sY || Math.floor(u.t0)), tag: "off" };
  if (u.t1 !== null && y >= u.t1) return { s: END_NAME[u.endKind] + " · " + (u.endKind >= 2 && u.endKind <= 4 ? fmtY(u.t1) : Math.floor(u.t1)), tag: "off" };
  return { s: u.endKind === 5 ? "Operating · end not recorded" : "Operating", tag: "on" };
}
const hDates = u => `${u.sY}${u.basis === 4 ? " (reference year, not sourced)" : ""} – ${u.t1 === null ? (u.endKind === 0 ? "present or not recorded" : "") : u.endKind === 5 ? "not recorded" : (u.endKind >= 2 && u.endKind <= 4 ? fmtY(u.t1) : Math.floor(u.t1))}`;
let hDosSig = "";
function renderDossierFull() {
  const k = selectedKeyFull(), u = hkey(k), y = S.Y; if (!u) return;
  const st = hStatus(u, y), m = hAlive(u, y) ? hMass(u, y).toFixed(2) : "—", par = hParentAt(u, y);
  const sig = [k, st.s, S.inspect, S.pin, S.mode, m, par && par.i, u.ins.filter(e => e.t !== null && e.t <= y).length + u.outs.filter(e => e.t !== null && e.t <= y).length].join("|");
  if (sig === hDosSig) return; hDosSig = sig;
  $("selMode").innerHTML = S.inspect ? ic("lens", "sm") + " Inspecting" : S.pin === k ? ic("lock", "sm") + " Pinned" : ic("route", "sm") + " Auto select";
  $("selMode").style.color = S.pin === k && !S.inspect ? "var(--amber)" : "";
  $("dShort").textContent = u.name; $("dLong").textContent = "Census ID " + u.id + " · draft v0.2";
  const g = embCanvas.getContext("2d"); g.clearRect(0, 0, 112, 112); g.beginPath(); g.arc(56, 56, 50, 0, 7); g.fillStyle = u.color; g.fill();
  if (u.glyph) { g.save(); g.translate(56, 56); glyph(g, u.glyph, 58, shade(u.color, -0.55)); g.restore(); }
  $("dKv").innerHTML = `<dt>Status</dt><dd><span class="tag ${st.tag}">${st.s}</span></dd><dt>Dates</dt><dd>${hDates(u)}</dd><dt>Level</dt><dd>${LEVEL_NAME[u.level] || "Unit"}</dd><dt>Parent</dt><dd>${par ? par.name : "None recorded at this date"}</dd><dt>Mass</dt><dd>${m} <span class="lbl">in this dataset</span></dd><dt>Confidence</dt><dd>${CONF_NAME[u.conf]} · start basis: ${BASIS_NAME[u.basis]}</dd><dt>Census ID</dt><dd class="mono">${u.id}</dd>`;
  $("dExpl").textContent = u.ins.length + u.outs.length ? `${u.ins.length + u.outs.length} dated relationship${u.ins.length + u.outs.length > 1 ? "s" : ""} in the draft census.` : "No dated relationships in the draft census.";
  let b = "";
  if (S.pin === k) b += `<button class="btn amber" type="button" data-act="unpin">${ic("close")}Stop following</button>`;
  else if (hAlive(u, y)) b += `<button class="btn amber" type="button" data-act="follow" data-k="${k}">${ic("lock")}Follow</button>`;
  b += `<button class="btn cyan" type="button" data-act="record" data-k="${k}">${ic("doc")}Open record</button>`;
  if (S.inspect) b += `<button class="btn" type="button" data-act="uninspect">${ic("return")}Back to camera subject</button>`;
  $("dBtns").innerHTML = b;
  renderLineageFull(u, y);
}
function selectedKeyFull() { return S.inspect || S.pin || (S.returnPin && S.mode === "free" ? S.returnPin : null) || hAutoSubject(S.Y); }
function renderLineageFull(u, y) {
  const svg = $("linSvg");
  const pick = list => list.filter(e => e.kind !== 3).sort((a, b) => Math.abs((a.t ?? 9e9) - y) - Math.abs((b.t ?? 9e9) - y)).slice(0, 4).sort((a, b) => (a.t ?? 9e9) - (b.t ?? 9e9));
  const ins = pick(u.ins), outs = pick(u.outs);
  if (!ins.length && !outs.length) { svg.setAttribute("viewBox", "0 0 320 40"); svg.innerHTML = `<text x="0" y="24" fill="#6f7d78" font-family="IBM Plex Mono, monospace" font-size="11">No lineage events recorded for this unit</text>`; $("linText").textContent = ""; $("linNote").textContent = ""; return; }
  const LH = 12.5, esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const lines = (t, w) => wrapTxt(t, Math.floor((w - 12) / 6.2)).slice(0, 3);
  const node = (v, x, yy, w, on, self) => { const ls = lines(v.name, w), h = ls.length * LH + 11; return [`<g class="node" data-k="${v.key}" tabindex="0" role="button" aria-label="Inspect ${esc(v.name)}"><rect x="${x}" y="${yy}" width="${w}" height="${h}" fill="${self ? "#1a1710" : "#111a17"}" stroke="${self ? "#f2b45a" : on ? "#5fd4c6" : "#2a3833"}" stroke-width="1.2" ${on || self ? "" : 'stroke-dasharray="3 3"'}/>${ls.map((l, i) => `<text x="${x + w / 2}" y="${yy + 15 + i * LH}" text-anchor="middle" fill="${on || self ? "#dfe7e3" : "#6f7d78"}" font-family="IBM Plex Mono, monospace" font-size="10.5">${esc(l)}</text>`).join("")}</g>`, h]; };
  const lbl = (x, yy, t, on) => `<text x="${x}" y="${yy}" fill="${on ? "#a9b6b1" : "#6f7d78"}" font-family="IBM Plex Mono, monospace" font-size="10">${esc(t)}</text>`;
  let h = "", Y = 2; const W = 236, X = 42;
  for (const e of ins) { const on = e.t !== null && y >= e.t, [s, hh] = node(HU[e.from], X, Y, W, on); h += s; Y += hh; h += `<path d="M${X + W / 2} ${Y} L${X + W / 2} ${Y + 22}" stroke="${on ? "#f2b45a" : "#2a3833"}" stroke-width="1.6" ${on ? "" : 'stroke-dasharray="3 4"'}/>` + lbl(X + W / 2 + 8, Y + 15, `${KIND_NAME[e.kind]} · ${e.date || "undated"}`, on); Y += 24; }
  const [s, hh] = node(u, X, Y, W, true, true); h += s; Y += hh;
  for (const e of outs) { const on = e.t !== null && y >= e.t; h += `<path d="M${X + W / 2} ${Y} L${X + W / 2} ${Y + 22}" stroke="${on ? "#f2b45a" : "#2a3833"}" stroke-width="1.6" ${on ? "" : 'stroke-dasharray="3 4"'}/>` + lbl(X + W / 2 + 8, Y + 15, `${KIND_NAME[e.kind]} · ${e.date || "undated"}`, on); Y += 24; const [s2, h2] = node(HU[e.to], X, Y, W, on); h += s2; Y += h2 + 4; }
  svg.setAttribute("viewBox", `0 0 320 ${Math.ceil(Y + 4)}`); svg.innerHTML = h;
  const more = u.ins.length + u.outs.length - ins.length - outs.length;
  $("linText").textContent = `${u.ins.length} incoming, ${u.outs.length} outgoing relationship${u.outs.length === 1 ? "" : "s"}${more > 0 ? " · " + more + " more in Records" : ""}. Dashed links are ahead of the playhead.`;
  $("linNote").textContent = "Open a node to inspect";
}
function hNoticeState() {
  if (S.mode !== "follow" || !S.pin) return null;
  const i = hBeatIdx(S.Y); if (i < 0) return null;
  const live = []; for (let j = i; j >= 0 && HB[j].t >= S.Y - 2.2; j--) { const b = HB[j]; if (!hInvolves(b, S.pin) && b.t >= S.pinSinceY - 0.01 && !S.dismissed.has("b" + b.i)) live.push(b); }
  if (!live.length) return null;
  return { b: live[0], more: live.length - 1 };
}
function renderNoticeFull() {
  const n = hNoticeState(), el = $("notice"), sig = n ? "F" + n.b.i + "|" + n.more + "|" + S.pin : "";
  if (sig === noticeSig) return; noticeSig = sig;
  el.hidden = !n; if (!n) return;
  $("noticeWhen").textContent = "Elsewhere / " + fmtShort(yToMs(n.b.t));
  $("noticeText").textContent = "Watch: " + n.b.title;
  $("noticeStayT").textContent = "Stay with " + NM(S.pin);
  $("noticeMore").hidden = n.more < 1; $("noticeMore").textContent = `+${n.more} more event${n.more > 1 ? "s" : ""} while pinned · see Records`;
  if (lastNoticeId !== "b" + n.b.i) { lastNoticeId = "b" + n.b.i; log("Event detected elsewhere · " + n.b.title, true); }
}
function renderPinEndFull() {
  const el = $("pinEnd"), p = S.pinEnd;
  if (!p) { el.hidden = true; el._k = null; return; }
  if (el._k === p.key) return; el._k = p.key; el.hidden = false;
  const u = hkey(p.key), succ = u.into.map(i => HU[i]);
  const btns = succ.map(v => `<button class="btn amber" type="button" data-f="${v.key}">${ic("lock")}Follow ${v.name}</button>`).join("");
  const rec = u.outs.find(e => e.t !== null && Math.abs(e.t - u.t1) < 1e-6);
  el.innerHTML = `<span class="lbl a">Pinned agency ${END_NAME[u.endKind].toLowerCase()} · ${hDates(u).split(" – ")[1]}</span><span class="t">${u.name}</span><div class="btnrow">${btns}<button class="btn" type="button" data-resume="1">${ic("route")}Resume tour</button>${rec ? `<button class="btn" type="button" data-hrec="${rec.i}">${ic("doc")}Final record</button>` : ""}</div>`;
}

/* ---------- timeline: agencies created per year, marked beats, playhead ---------- */
const tlXF = y => (y - 1775) / (2027 - 1775);
let tlFSig = "";
function renderTimelineFull() {
  const tl = $("tl");
  if (!tl.querySelector("#tlc")) {
    let h = `<div class="axis">`; for (const yr of [1775, 1800, 1825, 1850, 1875, 1900, 1925, 1950, 1975, 2000, 2026]) h += `<span class="yr${yr % 50 ? " minor" : ""}" style="left:${tlXF(yr) * 100}%">${yr}</span>`; h += `</div>`;
    h += `<span class="lane-l" style="top:40px;color:var(--cyan)">${ic("plus", "sm")}FOUNDED / YR</span><span class="lane-l" style="top:72px;color:var(--amber)">${ic("merge", "sm")}EVENTS</span><canvas id="tlc" style="position:absolute;left:0;top:18px;width:100%;height:66px"></canvas><div class="ph"></div>`;
    tl.innerHTML = h; tl._h = "full"; tlFSig = "";
  }
  const c = $("tlc"), r = c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(r.width * dpr), hh = Math.round(66 * dpr);
  const sig = w + "|" + Math.floor(S.Y * 4);
  if (sig !== tlFSig) {
    tlFSig = sig; if (c.width !== w) c.width = w; if (c.height !== hh) c.height = hh;
    const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, 66);
    const max = Math.max(...HIST.H.map(v => v[0])), bw = Math.max(1, r.width / 252 - 0.6);
    HIST.H.forEach((v, i) => { const yr = 1775 + i, x = tlXF(yr) * r.width, hgt = Math.sqrt(v[0] / max) * 34; g.fillStyle = yr + 1 <= S.Y ? "#5fd4c6" : "#2a4741"; g.fillRect(x, 38 - hgt, bw, hgt); });
    g.fillStyle = "#2a3833"; g.fillRect(0, 54, r.width, 1);
    for (const b of HB) { const x = tlXF(b.t) * r.width; g.save(); g.translate(x, 54); g.rotate(Math.PI / 4); g.fillStyle = b.reviewed ? "#f2b45a" : b.kind === "split" ? "#d58fd6" : b.kind === "founded" ? "#5fd4c6" : "#a9b6b1"; g.globalAlpha = b.t <= S.Y ? 1 : 0.4; const s = b.reviewed ? 4.5 : 3; g.fillRect(-s, -s, 2 * s, 2 * s); g.restore(); }
  }
  tl.querySelector(".ph").style.left = tlXF(S.Y) * 100 + "%";
  tl.setAttribute("aria-valuemin", "1775"); tl.setAttribute("aria-valuemax", "2026");
  tl.setAttribute("aria-valuenow", Math.floor(S.Y)); tl.setAttribute("aria-valuetext", fmtY(S.Y));
}

/* ---------- workspaces ---------- */
let hWsSig = "";
function renderWorkspaceFull(force) {
  if (S.tab === "arena") return;
  const y = S.Y, sig = S.tab + "|" + Math.floor(y * 4) + "|" + entFilter + "|" + S.pin;
  if (sig === hWsSig && !force) return; hWsSig = sig;
  const el = $("ws-" + S.tab), esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  if (S.tab === "entities") {
    const q = entFilter.trim().toLowerCase();
    const alive = hCells(y).map(c => ({ u: c.u, m: hMass(c.u, y) })).sort((a, b) => b.m - a.m || a.u.tier - b.u.tier || a.u.name.localeCompare(b.u.name));
    const match = alive.filter(o => !q || (o.u.name + " " + o.u.id).toLowerCase().includes(q));
    let h = `<h3>Entities · ${fmtY(y)}</h3><div class="lbl c">Live in the draft census at this date: ${alive.length.toLocaleString("en-US")} · Mass in this dataset, not budget or staff</div><div class="kv" style="grid-template-columns:200px 1fr"><dt>Discovered in census</dt><dd class="mono">${HIST.meta.nodes.toLocaleString("en-US")} units (${HIST.meta.version})</dd><dt>Playable, dated</dt><dd class="mono">${HIST.meta.used_units.toLocaleString("en-US")} units · ${HIST.meta.used_edges} dated relationships · unverified</dd><dt>Left out</dt><dd class="mono">${(HIST.meta.dropped.undated || 0).toLocaleString("en-US")} undated · ${HIST.meta.dropped.name || 0} unreadable names · ${HIST.meta.dropped.excluded || 0} excluded by census</dd></div>`;
    h += `<label class="lbl" for="entq" style="display:inline-flex;gap:6px;align-items:center">${ic("search", "sm")}Search agencies</label><input id="entq" type="search" value="${esc(entFilter)}" placeholder="Name or census ID" autocomplete="off">`;
    h += `<table><thead><tr><th>#</th><th>Agency</th><th>Level</th><th>Since</th><th>Mass</th><th></th></tr></thead><tbody>`;
    match.slice(0, 150).forEach((o, i) => { h += `<tr><td class="mono">${i + 1}</td><td><b>${esc(o.u.name)}</b><br><span class="mono" style="color:var(--dim)">${o.u.id}</span></td><td>${LEVEL_NAME[o.u.level] || ""}</td><td class="mono">${o.u.sY}</td><td class="mono">${o.m.toFixed(2)}</td><td><button class="btn" type="button" data-follow="${o.u.key}">${ic("lock")}${S.pin === o.u.key ? "Following" : "Follow"}</button></td></tr>`; });
    h += `</tbody></table>${match.length > 150 ? `<div class="lbl">Showing 150 of ${match.length.toLocaleString("en-US")} · refine the search</div>` : ""}`;
    const focusQ = document.activeElement && document.activeElement.id === "entq", caret = focusQ ? document.activeElement.selectionStart : 0;
    el.innerHTML = h; if (focusQ) { const qq = $("entq"); qq.focus(); qq.setSelectionRange(caret, caret); }
  } else if (S.tab === "lineage") {
    const near = HE_T.filter(e => Math.abs(e.t - y) <= 5);
    el.innerHTML = `<h3>Lineage · ${fmtY(y)}</h3><div class="lbl">Dated relationships within five years of the playhead · ${near.length} of ${HE_T.length}</div><table><thead><tr><th>Date</th><th>From</th><th>Relation</th><th>To</th><th>At playhead</th><th></th></tr></thead><tbody>${near.map(e => `<tr><td class="mono">${e.date}</td><td><button class="btn" type="button" data-inspect="${HU[e.from].key}">${esc(HU[e.from].name)}</button></td><td>${KIND_NAME[e.kind]}</td><td><button class="btn" type="button" data-inspect="${HU[e.to].key}">${esc(HU[e.to].name)}</button></td><td><span class="tag ${y >= e.t ? "on" : "off"}">${y >= e.t ? "Recorded" : "Not yet reached"}</span></td><td><button class="btn cyan" type="button" data-hrec="${e.i}">${ic("doc")}Record</button></td></tr>`).join("")}</tbody></table>`;
  } else if (S.tab === "records") {
    el.innerHTML = `<h3>Records</h3><div class="lbl">${HB.length} marked events, oldest to newest · text equivalent of the feed · amber rows are the three reviewed events, the rest are unverified draft data</div><table><thead><tr><th>Date</th><th>Event</th><th>Review</th></tr></thead><tbody>${HB.map(b => `<tr><td class="mono">${fmtY(b.t)}</td><td><b>${esc(b.title)}</b><br><span style="color:var(--ink-2)">${b.kind}${b.edges.length ? " · " + b.edges.map(i => HE[i].ev).join(", ") : ""}</span><div class="acts"><button class="btn" type="button" data-hseekb="${b.i}">${ic("skip")}Seek</button>${b.edges.length ? `<button class="btn cyan" type="button" data-hrec="${b.edges[0]}">${ic("doc")}Sources</button>` : `<button class="btn cyan" type="button" data-hrecu="${HU[b.units[0]].key}">${ic("doc")}Record</button>`}</div></td><td><span class="tag ${b.reviewed ? "amb" : "off"}">${b.reviewed ? "Reviewed · sources checked" : "Draft · unverified"}</span><br><span class="tag ${y >= b.t ? "on" : "off"}">${y >= b.t ? "On record at playhead" : "Ahead of playhead"}</span></td></tr>`).join("")}</tbody></table>`;
  }
}
function openRecordFull(o) {
  const d = $("drawer"), esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  let h = `<div class="dhead"><span class="lbl c" style="display:inline-flex;gap:6px;align-items:center">${ic("doc", "sm")}Record drawer</span><button class="btn" type="button" id="drawerClose">${ic("close", "sm")}Close · Esc</button></div>`;
  if (o.edge !== undefined) {
    const e = HE[o.edge], f = HU[e.from], t = HU[e.to];
    h += `<h3 id="drawerTitle">${esc(f.name)} → ${esc(t.name)}</h3><dl class="kv"><dt>Relation</dt><dd>${KIND_NAME[e.kind]} · ${KIND_EXPL[e.kind]}</dd><dt>Played on</dt><dd>${e.date || "Undated · not animated"}</dd>${e.stat && e.stat !== e.date ? `<dt>Dataset date</dt><dd>${e.stat} · statute</dd>` : ""}<dt>Authority</dt><dd>${esc(e.auth || "Not recorded")}</dd><dt>Confidence</dt><dd>${CONF_NAME[e.conf]}</dd><dt>Event ID</dt><dd class="mono">${e.ev}</dd><dt>Review</dt><dd>${e.reviewed ? '<span class="tag amb">Reviewed · operations date checked against cited sources</span>' : '<span class="tag off">Draft · unverified</span>'}</dd></dl>`;
    if (e.note) h += `<p class="expl">${esc(e.note)}</p>`;
    if (e.sent) h += `<div class="src"><span class="st">SOURCE SENTENCE · U.S. GOVERNMENT MANUAL TEXT</span><blockquote>${esc(e.sent)}</blockquote></div>`;
    h += `<div class="btnrow"><button class="btn" type="button" data-hrecu2="${f.key}">${ic("doc")}${esc(f.name)}</button><button class="btn" type="button" data-hrecu2="${t.key}">${ic("doc")}${esc(t.name)}</button></div>`;
    log("Record opened · " + e.ev);
  } else {
    const u = hkey(o.ent), url = HIST.URL[u.url];
    h += `<h3 id="drawerTitle">${esc(u.name)}</h3><dl class="kv"><dt>Census ID</dt><dd class="mono">${u.id}</dd><dt>Dates</dt><dd>${hDates(u)}</dd><dt>Start basis</dt><dd>${BASIS_NAME[u.basis]}</dd><dt>Level</dt><dd>${LEVEL_NAME[u.level] || ""}</dd><dt>Confidence</dt><dd>${CONF_NAME[u.conf]}</dd><dt>Citation</dt><dd>${esc(u.loc || "No locator")}${url ? `<br><a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;gap:6px;align-items:center">${ic("external", "sm")}Open primary citation</a>` : ""}</dd></dl>`;
    if (u.endKind === 5) h += `<p class="expl">The census gives no end date for this temporary body. The feed retires it four years after it starts so temporary bodies do not pile up; that end is a display rule, not a historical claim.</p>`;
    for (const e of [...u.ins, ...u.outs].sort((a, b) => (a.t || 0) - (b.t || 0))) h += `<button class="btn cyan" type="button" data-hrec2="${e.i}">${ic("doc")}${KIND_NAME[e.kind]} · ${esc(HU[e.from === u.i ? e.to : e.from].name)} · ${e.date || "undated"}</button>`;
    log("Record opened · " + u.name);
  }
  d.innerHTML = h; d.hidden = false; $("drawerClose").focus();
}
$("drawer").addEventListener("click", e => { const a = e.target.closest("[data-hrec2]"), b = e.target.closest("[data-hrecu2]"); if (a) openRecordFull({ edge: +a.dataset.hrec2 }); else if (b) openRecordFull({ ent: b.dataset.hrecu2 }); });

/* ---------- mini map ---------- */
function renderMiniFull(cells) {
  const W = mini.width, H = mini.height, s = Math.min(W / HWORLD.w, H / HWORLD.h);
  mctx.fillStyle = "#111a17"; mctx.fillRect(0, 0, W, H);
  const ox = (W - HWORLD.w * s) / 2, oy = (H - HWORLD.h * s) / 2; mini._t = { s, ox, oy };
  mctx.strokeStyle = "#1c2924"; mctx.lineWidth = 1; mctx.strokeRect(ox, oy, HWORLD.w * s, HWORLD.h * s);
  for (const c of cells) { mctx.globalAlpha = c.a; mctx.fillStyle = c.color; const rr = Math.max(1.2, c.r * s); mctx.fillRect(ox + c.x * s - rr, oy + c.y * s - rr, rr * 2, rr * 2); }
  mctx.globalAlpha = 1;
  const vw = AW / cam.z, vh = AH / cam.z;
  mctx.strokeStyle = "#f2b45a"; mctx.lineWidth = 2; mctx.strokeRect(ox + (cam.x - vw / 2) * s, oy + (cam.y - vh / 2) * s, vw * s, vh * s);
}
