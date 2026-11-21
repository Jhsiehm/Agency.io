/* ================= REPORT: briefing cards for a reviewed story, an archive moment, or a fictional run =================
   A presentation and export workflow, not a third engine. Every fact on a card is read from EVENTS / HB / HE; satire is a separate, labelled line. */
const STORIES = [
  { id: "naca-nasa", ev: "ev-slice-001", code: "OBS-0001", desk: "TRANSFER COMPLETE. SPACE REMAINS UNCHANGED." },
  { id: "aec-split", ev: "ev-slice-002", code: "OBS-0002", desk: "THE COMMITTEE HAS BECOME TWO COMMITTEES." },
  { id: "erda-doe", ev: "ev-slice-003", code: "OBS-0003", desk: "ENERGY CONSOLIDATED. ENTROPY PENDING REVIEW.", subset: "Shows the Energy Research and Development Administration lineage only. Two other agencies also merged into DOE that day; their roles are not yet reviewed." }
];
const STORY_BY_EV = Object.fromEntries(STORIES.map(s => [s.ev, s]));
const REPORT = { story: "naca-nasa", phase: "after", format: "landscape", desk: true, lastRun: null, sig: "", canvas: null };
const DESK_BY_KIND = { founded: "STATUS: OPERATING. For now.", absorbed: "Nothing has been lost except the predecessor.", merged: "Forms will follow.", split: "An org chart has been inconvenienced.", renamed: "Same circle. New letterhead.", moved: "Authority has changed hands. The circle has grown." };
function deskLineForBeat(b) { if (!b) return ""; if (b.reviewed) { const k = HB.filter(x => x.reviewed).indexOf(b); return STORIES[k] ? STORIES[k].desk : ""; } return b.i % 2 ? "" : (DESK_BY_KIND[b.kind] || "Forms will follow."); }

function reportSources() {
  const out = [{ id: "naca-nasa", label: "Episode 01 · NACA → NASA", kind: "reviewed" }, { id: "aec-split", label: "Episode 02 · AEC division", kind: "reviewed" }, { id: "erda-doe", label: "Episode 03 · ERDA → DOE (subset)", kind: "reviewed" }];
  out.push({ id: "archive", label: "Current archive moment · " + Math.floor(S.Y), kind: "draft" });
  if (REPORT.lastRun) out.push({ id: "sim", label: "Last simulation run · " + REPORT.lastRun.sc, kind: "fiction" });
  return out;
}
/* single EventPresentation-like object: what the card is allowed to say */
function reportModel() {
  const st = STORIES.find(s => s.id === REPORT.story);
  if (st) {
    const ev = EVI[st.ev], ph = RAIL_PHASES[ev.kind](ev), pk = REPORT.phase === "before" ? ph[0] : REPORT.phase === "contact" ? ph[1] : ph[ph.length - 1];
    return { kind: "reviewed", status: "HISTORICAL / REVIEWED RECORD", code: st.code, title: ev.title, date: "Effective " + fmt(ev.eff), phaseLabel: pk.label, T: pk.T !== undefined ? pk.T : pk.t,
      ev, authority: ev.authority, source: (ev.claims[0] && SRC[ev.claims[0].src]) || null, quote: ev.claims[0] ? ev.claims[0].q : "", desk: st.desk, caveat: st.subset || ev.note || "", link: "?mode=report&story=" + st.id + "&format=" + REPORT.format + "&phase=" + REPORT.phase };
  }
  if (REPORT.story === "archive") {
    const i = Math.max(0, hBeatIdx(S.Y + LEAD)), b = HB[i], e = b && b.edges.length ? HE[b.edges[0]] : null;
    return { kind: b && b.reviewed ? "reviewed" : "draft", status: b && b.reviewed ? "HISTORICAL / REVIEWED RECORD" : "DRAFT / UNCERTAIN · UNREVIEWED CENSUS RECORD", code: "BEAT-" + String(i + 1).padStart(3, "0"), title: b ? b.title : "Archive moment", date: b ? (e && e.date ? "Dated " + e.date + " in the draft census" : "Year " + Math.floor(b.t) + " (year-level date)") : fmtY(S.Y), phaseLabel: REPORT.phase,
      beat: b, y: b ? (REPORT.phase === "before" ? b.t - 0.6 : REPORT.phase === "contact" ? b.t + 0.12 : b.t + 0.7) : S.Y, authority: e ? (e.auth || e.stat || "") : "", quote: e ? e.sent : "", desk: deskLineForBeat(b), caveat: "Draft census v0.2. Not reviewed by a person.", link: "?mode=observe&date=" + new Date(yToMs(b ? b.t : S.Y)).toISOString().slice(0, 10) };
  }
  const r = REPORT.lastRun;
  if (!r) return null;
  return { kind: "fiction", status: "SIMULATION / FICTIONAL · NOT A HISTORICAL RECORD", code: "RUN-" + r.hash.slice(0, 6).toUpperCase(), title: r.name + (r.won ? " secures its mandate" : " is reorganized"), date: r.sc + " · " + r.t.toFixed(1) + " s · seed " + r.meta.seed, phaseLabel: "Final frame",
    run: r, authority: "", quote: r.text, desk: r.won ? "Budget authority not conferred." : "Circle remains confident.", caveat: "Fictional game run. Names and outcomes are invented; scores are not claims about any agency.", link: "?mode=simulate&scenario=" + r.meta.scenario + "&seed=" + r.meta.seed + "&agency=" + r.meta.archetype };
}
let REP_LOGO = null;
function repLogo() { if (!REP_LOGO) { const img = document.querySelector("header .logo"); if (img && img.complete) REP_LOGO = img; } return REP_LOGO; }
function wrapCanvas(ctx, text, maxW) { const words = String(text).split(" "), lines = []; let cur = ""; for (const w of words) { const t = cur ? cur + " " + w : w; if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }
function drawReport(canvas, m) {
  const vertical = REPORT.format === "vertical", W = vertical ? 1080 : 1600, H = vertical ? 1920 : 900;
  canvas.width = W; canvas.height = H; const g = canvas.getContext("2d");
  g.fillStyle = "#0c1210"; g.fillRect(0, 0, W, H);
  const pad = vertical ? 64 : 48;
  /* header line */
  const logo = repLogo(); let lx = pad; if (logo) { const h = vertical ? 40 : 30, w = logo.naturalWidth * h / logo.naturalHeight; g.drawImage(logo, pad, pad - 4, w, h); lx = pad + w + 16; }
  g.fillStyle = "#dfe7e3"; g.font = `400 ${vertical ? 30 : 22}px "IBM Plex Sans", sans-serif`; g.textBaseline = "top"; g.fillText("Agency.io", lx, pad);
  g.font = `500 ${vertical ? 20 : 15}px "IBM Plex Mono", monospace`; g.fillStyle = m.kind === "fiction" ? "#d58fd6" : m.kind === "reviewed" ? "#5fd4c6" : "#f2b45a"; g.textAlign = "right"; g.fillText(m.status, W - pad, pad + 4); g.textAlign = "left";
  /* stage */
  const sx = pad, sy = pad + (vertical ? 80 : 56), sw = W - pad * 2, sh = vertical ? 1000 : 470;
  g.save(); g.beginPath(); g.rect(sx, sy, sw, sh); g.clip(); g.translate(sx, sy);
  if (m.ev) { const T = m.T, cells = cellsAt(T), camR = autoTarget(T, sw, sh); renderWorld(g, sw, sh, camR, T, { cells, capture: true }); }
  else if (m.beat) { const cells = hCells(m.y), camR = hBeatFrame(m.beat, m.y, sw, sh); renderFull(g, sw, sh, camR, m.y, cells, { families: false }); }
  else if (m.run && m.run.snap) { const s = m.run.snap, k = Math.max(sw / s.width, sh / s.height); g.drawImage(s, (sw - s.width * k) / 2, (sh - s.height * k) / 2, s.width * k, s.height * k); }
  g.restore();
  g.strokeStyle = "#2a3833"; g.lineWidth = 2; g.strokeRect(sx, sy, sw, sh);
  g.fillStyle = "rgba(15,26,23,.88)"; g.font = `500 ${vertical ? 18 : 13}px "IBM Plex Mono", monospace`; const tag = (m.code + " · " + m.phaseLabel).toUpperCase(), tw = g.measureText(tag).width; g.fillRect(sx + 12, sy + 12, tw + 20, vertical ? 34 : 26); g.fillStyle = "#5fd4c6"; g.fillText(tag, sx + 22, sy + 19);
  /* text block: facts on the left; in landscape the labelled satire sits in its own column on the right */
  let y = sy + sh + (vertical ? 48 : 26); const tx = pad, maxW = vertical ? W - pad * 2 : W - pad * 2 - 440;
  g.fillStyle = "#6f7d78"; g.font = `500 ${vertical ? 20 : 14}px "IBM Plex Mono", monospace`; g.fillText(m.kind === "fiction" ? "SIMULATION LOG" : "ON RECORD", tx, y); y += vertical ? 34 : 22;
  g.fillStyle = "#eef3f0"; g.font = `600 ${vertical ? 46 : 30}px "IBM Plex Sans", sans-serif`;
  for (const l of wrapCanvas(g, m.title, maxW).slice(0, vertical ? 4 : 2)) { g.fillText(l, tx, y); y += vertical ? 56 : 36; }
  g.fillStyle = "#f2b45a"; g.font = `500 ${vertical ? 24 : 16}px "IBM Plex Mono", monospace`; g.fillText(m.date, tx, y + 4); y += vertical ? 48 : 30;
  if (m.quote) { g.fillStyle = "#a9b6b1"; g.font = `400 ${vertical ? 24 : 15}px "IBM Plex Sans", sans-serif`; for (const l of wrapCanvas(g, "“" + m.quote + "”", maxW).slice(0, vertical ? 5 : 2)) { g.fillText(l, tx, y); y += vertical ? 34 : 21; } y += 6; }
  if (m.authority) { g.fillStyle = "#6f7d78"; g.font = `400 ${vertical ? 19 : 13}px "IBM Plex Mono", monospace`; for (const l of wrapCanvas(g, m.authority, maxW).slice(0, vertical ? 3 : 2)) { g.fillText(l, tx, y); y += vertical ? 28 : 18; } }
  if (REPORT.desk && m.desk) {
    let dx = tx, dy = y + (vertical ? 26 : 0), dw = maxW;
    if (!vertical) { dx = W - pad - 410; dy = sy + sh + 26; dw = 410; }
    g.strokeStyle = "#2a3833"; g.lineWidth = 1.5; g.setLineDash([6, 5]); g.strokeRect(dx, dy, dw, vertical ? 104 : 96); g.setLineDash([]);
    g.fillStyle = "#6f7d78"; g.font = `500 ${vertical ? 17 : 11.5}px "IBM Plex Mono", monospace`; g.fillText("DESK COMMENTARY · EDITORIAL, NOT A SOURCED FACT", dx + 14, dy + 14);
    g.fillStyle = "#dfe7e3"; g.font = `italic 400 ${vertical ? 28 : 18}px "IBM Plex Sans", sans-serif`; let ly = dy + (vertical ? 46 : 38); for (const l of wrapCanvas(g, m.desk, dw - 28).slice(0, 2)) { g.fillText(l, dx + 14, ly); ly += vertical ? 34 : 24; }
  }
  /* footer disclosure: two lines, never under the satire */
  g.fillStyle = "#6f7d78"; g.font = `400 ${vertical ? 17 : 12}px "IBM Plex Mono", monospace`; const lh = vertical ? 26 : 17;
  const left = (m.kind === "fiction" ? "Fictional sandbox · not a historical record" : "Visual metaphor · historical facts linked in source record") + " · cell size is a visual model, not budget or staff · " + (m.kind === "fiction" ? SIM_V : HDATASET);
  const lines = wrapCanvas(g, left, W - pad * 2).concat(m.caveat ? wrapCanvas(g, m.caveat, W - pad * 2).slice(0, 2) : []);
  let fy = H - pad - lh * lines.length + 6; g.fillStyle = "#0c1210"; g.fillRect(0, fy - 8, W, H - fy + 8); g.fillStyle = "#6f7d78";
  for (const l of lines) { g.fillText(l, tx, fy); fy += lh; }
  return { W, H };
}
function renderReportUI(force) {
  const srcs = reportSources(); if (!srcs.find(s => s.id === REPORT.story)) REPORT.story = srcs[0].id;
  const m = reportModel(); if (!m) return;
  const sig = [REPORT.story, REPORT.phase, REPORT.format, REPORT.desk, m.code, m.title].join("|"); if (!force && sig === REPORT.sig) return; REPORT.sig = sig;
  $("repList").innerHTML = srcs.map(s => `<button type="button" class="rep-item" data-story="${s.id}" aria-pressed="${s.id === REPORT.story}"><span class="rv ${s.kind === "reviewed" ? "ok" : s.kind === "fiction" ? "fic" : "draft"}">${s.kind === "reviewed" ? "Reviewed" : s.kind === "fiction" ? "Fictional" : "Draft"}</span>${s.label}</button>`).join("");
  $("repStory").innerHTML = srcs.map(s => `<option value="${s.id}"${s.id === REPORT.story ? " selected" : ""}>${s.label}</option>`).join("");
  document.querySelectorAll("#repPhase [data-v]").forEach(b => { b.setAttribute("aria-pressed", String(b.dataset.v === REPORT.phase)); b.disabled = m.kind === "fiction"; });
  document.querySelectorAll("#repFmt [data-v]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === REPORT.format)));
  $("repDesk").setAttribute("aria-pressed", String(REPORT.desk));
  const cv = $("repCanvas"); drawReport(cv, m); fitReport();
  $("repFacts").innerHTML = `<div class="lbl ${m.kind === "fiction" ? "" : m.kind === "reviewed" ? "c" : "a"}">${m.status}</div><div class="short">${m.title}</div><dl class="kv"><dt>Date</dt><dd>${m.date}</dd>${m.authority ? `<dt>Authority</dt><dd>${m.authority}</dd>` : ""}${m.source ? `<dt>Source</dt><dd><a href="${m.source.url}" target="_blank" rel="noopener">${m.source.title || m.source.url}</a></dd>` : ""}<dt>Satire</dt><dd>${REPORT.desk ? "Shown, labelled as desk commentary" : "Hidden"}</dd><dt>Link</dt><dd class="mono">${m.link}</dd></dl>${m.caveat ? `<p class="expl">${m.caveat}</p>` : ""}`;
}
function fitReport() { const cv = $("repCanvas"), st = $("repStage"), aw = st.clientWidth - 24, ah = st.clientHeight - 24; if (aw <= 0 || ah <= 0) return; const k = Math.min(aw / cv.width, ah / cv.height); cv.style.width = Math.floor(cv.width * k) + "px"; cv.style.height = Math.floor(cv.height * k) + "px"; }
addEventListener("resize", () => { if (S.app === "report") fitReport(); });
function reportExport() {
  const m = reportModel(); if (!m) return; const cv = document.createElement("canvas"); drawReport(cv, m);
  const name = `agency-io-${REPORT.story}-${REPORT.format === "vertical" ? "9x16" : "16x9"}.png`;
  cv.toBlob(b => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }, "image/png");
  log("Briefing card exported · " + name);
}
function reportCopyLink() {
  const m = reportModel(); if (!m) return; let base = location.href.split("?")[0].split("#")[0]; if (!/^https?:/.test(base)) base = "https://agency-io-cyan.vercel.app/";
  const url = base + m.link, done = ok => { $("repCopy").querySelector("span").textContent = ok ? "Link copied" : url; setTimeout(() => { $("repCopy").querySelector("span").textContent = "Copy link"; }, 2500); };
  try { navigator.clipboard.writeText(url).then(() => done(true), () => done(false)); } catch (e) { done(false); }
  log("Link prepared · " + m.link);
}
function reportWire() {
  $("repList").addEventListener("click", e => { const b = e.target.closest("[data-story]"); if (b) { REPORT.story = b.dataset.story; renderReportUI(true); } });
  $("repStory").addEventListener("change", e => { REPORT.story = e.target.value; renderReportUI(true); });
  $("repPhase").addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (b && !b.disabled) { REPORT.phase = b.dataset.v; renderReportUI(true); } });
  $("repFmt").addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (b) { REPORT.format = b.dataset.v; renderReportUI(true); } });
  $("repDesk").addEventListener("click", () => { REPORT.desk = !REPORT.desk; renderReportUI(true); });
  $("repExport").addEventListener("click", reportExport);
  $("repCopy").addEventListener("click", reportCopyLink);
}
