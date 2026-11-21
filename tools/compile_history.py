#!/usr/bin/env python3
"""Compile dataset.zip (census v0.2-draft) into the inline HIST table for the Full history tour.

Usage: python3 -I compile_history.py <dataset_dir> <out.js>
Everything the browser needs is computed here: lifetimes, edge timing, mass steps,
and a lifetime-aware layout where cells alive at the same time never overlap.
"""
import csv, json, math, re, sys, hashlib, collections, datetime

DS, OUT = sys.argv[1], sys.argv[2]
g = json.load(open(DS + "/core/graph.json"))
units_csv = {r["canonical_id"]: r for r in csv.DictReader(open(DS + "/core/units.csv"))}
edges_csv = {r["event_id"]: r for r in csv.DictReader(open(DS + "/core/edges.csv"))}
sha = hashlib.sha256(open(DS + "/core/graph.json", "rb").read()).hexdigest()

TOUR_END = 2026.9

def yf(s):
    """date string -> fractional year (day midpoint). Year-only -> mid-year."""
    if not s: return None
    p = s.split("-")
    y = int(p[0])
    if len(p) == 1: return y + 0.5
    if len(p) == 2: m = int(p[1]); return y + (m - 0.5) / 12
    d = datetime.date(y, int(p[1]), int(p[2]))
    n = (datetime.date(y + 1, 1, 1) - datetime.date(y, 1, 1)).days
    return y + ((d - datetime.date(y, 1, 1)).days + 0.5) / n

# ---------------- reviewed overrides (operations dates; see federal-cells-demo memory) -------------
OPS = {
    "ev-00030": ("1958-10-01", "NASA began operations 1 Oct 1958 (NASA, '65 Years Ago'). Statute 29 Jul 1958."),
    "ev-04204": ("1975-01-19", "ERDA and NRC began operations 19 Jan 1975 (NRC NUREG/BR-0533). Act signed 11 Oct 1974."),
    "ev-04205": ("1975-01-19", "ERDA and NRC began operations 19 Jan 1975 (NRC NUREG/BR-0533). Act signed 11 Oct 1974."),
}
DOE_OPS = ("1977-10-01", "DOE activated 1 Oct 1977, absorbing ERDA, FEA and FPC. Act signed 4 Aug 1977.")
REVIEWED = {"ev-00030", "ev-04204", "ev-04205", "ev-04501"}

# ---------------- units ----------------
def clean(name):
    n = re.sub(r",\s*[A-Z]{2,5}$", "", name.strip())
    n = re.sub(r"\s+", " ", n)
    return n

def usable(name):
    if not re.match(r'^[A-Z0-9"]', name): return False
    if name.count("(") != name.count(")"): return False
    if re.search(r"Stat\.|Terminated| EO |functions transferred", name): return False
    if re.fullmatch(r"[A-Z]{2,6}", name): return False
    if len(re.findall(r"(?:^|, )[A-Z]{2,5}(?=,|$)", name)) >= 2: return False
    return len(name) <= 150

nodes = {n["id"]: n for n in g["nodes"]}
U = {}
dropped = collections.Counter()
for n in g["nodes"]:
    if n.get("excluded"): dropped["excluded"] += 1; continue
    uc = units_csv.get(n["id"], {})
    start, basis = n["start"], n["start_basis"]
    ref = False
    if start is None and n["level"] == 1 and uc.get("reference_start_unverified"):
        start, basis, ref = int(uc["reference_start_unverified"]), "reference", True
    if start is None: dropped["undated"] += 1; continue
    name = clean(n["name"])
    if not usable(name): dropped["name"] += 1; continue
    U[n["id"]] = dict(id=n["id"], name=name, level=n["level"], parent=n["parent"], sY=start, eY=n["end"],
                      basis=basis or "", conf=n["confidence"] or "low", ref=ref,
                      url=uc.get("primary_url", ""), loc=uc.get("primary_locator", ""))
for u in U.values():
    s, e = u["sY"], u["eY"]
    u["t0"] = s + 0.5 if e != s else s + 0.25
    u["t1"] = None if e is None else (e + 0.5 if e != s else e + 0.75)
    u["endKind"] = 0 if e is None else 1   # 0 open, 1 ended (no edge), 2 absorbed, 3 renamed, 4 divided, 5 retired by feed

# ---------------- edges ----------------
KIND = {"absorbed": 0, "merged": 1, "moved": 2, "partial_transfer": 3, "renamed": 4, "succeeded": 5}
E = []
for e in g["edges"]:
    if e["from"] not in U or e["to"] not in U: dropped["edge_unit"] += 1; continue
    ev = e["source_event"]; date = e["date"]; note = ""
    if ev in OPS: date, note = OPS[ev]
    elif e["to"] == "u-fr-136" and date == "1977-08-04": date, note = DOE_OPS
    t = yf(date)
    row = edges_csv.get(ev, {})
    E.append(dict(f=e["from"], to=e["to"], kind=e["kind"], date=date or "", stat=e["date"] or "", t=t, auth=e["authority"] or "",
                  conf=e["confidence"] or "", ev=ev, sent=(row.get("sentence") or "")[:400], note=note,
                  reviewed=ev in REVIEWED or (note == DOE_OPS[1] and ev in ("ev-00683", "ev-04832"))))

TERM = ("absorbed", "merged", "renamed", "succeeded")
by_from = collections.defaultdict(list)
for e in E:
    if e["t"] is not None: by_from[e["f"]].append(e)

# successors that come into existence with the edge start at the edge date
for e in E:
    if e["t"] is None or e["kind"] not in TERM: continue
    tgt = U[e["to"]]
    if abs(tgt["sY"] - math.floor(e["t"])) <= 1 or (tgt["t0"] > e["t"] and tgt["t0"] - e["t"] < 2.5):
        if tgt["t0"] >= e["t"] - 1.0: tgt["t0"] = e["t"]; tgt["born_of"] = e["f"]
# donors end at their terminal edge
for fid, es in by_from.items():
    d = U[fid]
    term = sorted([e for e in es if e["kind"] in TERM], key=lambda x: x["t"])
    if not term: continue
    t = term[-1]["t"]
    if d["t1"] is None or abs(d["t1"] - t) <= 2.6:
        same = [e for e in term if abs(e["t"] - t) < 1e-6]
        d["t1"] = t
        d["into"] = [e["to"] for e in same]
        newborn = [x for x in d["into"] if abs(U[x]["t0"] - t) < 1e-6]
        if len(same) >= 2 and len(newborn) >= 2: d["endKind"] = 4
        elif newborn: d["endKind"] = 3; d["into"] = newborn
        else: d["endKind"] = 2
# formations: several donors end into one newborn target on the same date -> donors converge on it
fgroups = collections.defaultdict(set)
for e in E:
    if e["t"] is not None and e["kind"] in TERM and abs(U[e["to"]]["t0"] - e["t"]) < 1e-6 and U[e["f"]]["t1"] == e["t"]:
        fgroups[(e["to"], e["t"])].add(e["f"])
for (tid, t), donors in fgroups.items():
    if len(donors) < 2: continue
    U[tid]["formed"] = True
    for d in donors:
        if U[d]["endKind"] != 4: U[d]["endKind"] = 2; U[d]["into"] = [tid]
# sanity: positive lifetimes; temporary bodies with no recorded end retire after 4 years (flagged)
for u in U.values():
    if u["t1"] is not None and u["t1"] <= u["t0"]: u["t1"] = u["t0"] + 0.4
    if u["t1"] is None and u["level"] == 6: u["t1"] = u["t0"] + 4; u["endKind"] = 5
    if u["t1"] is not None and u["t1"] > TOUR_END: u["t1"] = None; u["endKind"] = 0

alive = lambda u, t: u["t0"] <= t and (u["t1"] is None or t < u["t1"])

# ---------------- parent over time (moves) ----------------
for u in U.values():
    p = U.get(u["parent"]) if u["parent"] else None
    p0 = u["parent"] if p and alive(p, u["t0"] + 1e-6) else None
    u["segs"] = [[u["t0"], p0]]
for e in sorted([e for e in E if e["kind"] == "moved" and e["t"] is not None], key=lambda x: x["t"]):
    u, np_ = U[e["f"]], U[e["to"]]
    if not alive(u, e["t"]) or not alive(np_, e["t"]) or e["t"] - u["t0"] < 0.3: continue
    if u["segs"][-1][1] == e["to"]: continue
    u["segs"].append([e["t"], e["to"]])

def parent_at(u, t):
    p = None
    for s in u["segs"]:
        if s[0] <= t + 1e-9: p = s[1]
    if p and not alive(U[p], t): return None
    return p

def tier(u):
    if u["level"] == 1: return 1
    if not any(s[1] for s in u["segs"]): return 2 if u["level"] == 2 else 3
    return min(6, max(3, u["level"]))
for u in U.values(): u["tier"] = tier(u)

# ---------------- mass steps (blueprint: 1 + absorbed mass + 0.5 per moved-in unit; +0.25 per live sub-unit) -------
acc = collections.defaultdict(float); kids = collections.defaultdict(int)
steps = collections.defaultdict(list)
evq = []
for u in U.values():
    for i, (t, p) in enumerate(u["segs"]):
        if p:
            t_end = u["segs"][i + 1][0] if i + 1 < len(u["segs"]) else u["t1"]
            if U[p]["t1"] is not None: t_end = min(t_end, U[p]["t1"]) if t_end is not None else U[p]["t1"]
            evq.append((t, 1, "kid+", p, None))
            if t_end is not None: evq.append((t_end, 0, "kid-", p, None))
for e in E:
    if e["t"] is None: continue
    if e["kind"] in ("absorbed", "merged") and U[e["f"]].get("t1") == e["t"]: evq.append((e["t"], 2, "abs", e["to"], e["f"]))
    if e["kind"] in ("renamed", "succeeded") and U[e["f"]].get("t1") == e["t"]: evq.append((e["t"], 2, "inh", e["to"], e["f"]))
    if e["kind"] == "moved": evq.append((e["t"], 2, "mov", e["to"], e["f"]))
evq.sort(key=lambda x: (x[0], x[1]))
mass = lambda k: min(40.0, 1 + acc[k] + 0.25 * kids[k])
for u in U.values(): steps[u["id"]].append((u["t0"], 1.0))
for t, _, kind, k, d in evq:
    if kind == "kid+": kids[k] += 1
    elif kind == "kid-": kids[k] = max(0, kids[k] - 1)
    elif kind == "abs": acc[k] += min(8.0, mass(d))
    elif kind == "inh": acc[k] += acc[d]
    elif kind == "mov": acc[k] += 0.5
    m = round(mass(k), 2)
    if steps[k] and abs(steps[k][-1][0] - t) < 1e-9: steps[k][-1] = (t, m)
    elif not steps[k] or steps[k][-1][1] != m: steps[k].append((t, m))
BASE = {1: 2.0, 2: 1.35, 3: 1.0, 4: 0.78, 5: 0.62, 6: 0.68}
R_UNIT = 30
def rmax(u, t0, t1):
    st = steps[u["id"]]; best = 1.0
    prev = [m for (t, m) in st if t <= t0]
    if prev: best = prev[-1]
    for (t, m) in st:
        if t0 < t and (t1 is None or t < t1): best = max(best, m)
    return R_UNIT * BASE[u["tier"]] * math.sqrt(best)

# ---------------- layout: lifetime-aware spiral packing ----------------
CELL = 260
grid = collections.defaultdict(list)
placed = []
def overlaps(a0, a1, b0, b1):
    return a0 < (b1 if b1 is not None else 1e9) and b0 < (a1 if a1 is not None else 1e9)
def free(x, y, r, t0, t1, gap):
    cx, cy = int(math.floor(x / CELL)), int(math.floor(y / CELL))
    reach = int(math.ceil((r + 520 + gap) / CELL))
    for i in range(cx - reach, cx + reach + 1):
        for j in range(cy - reach, cy + reach + 1):
            for s in grid.get((i, j), ()):
                if not overlaps(t0, t1, s[3], s[4]): continue
                if math.hypot(s[0] - x, s[1] - y) < s[2] + r + gap: return False
    return True
def put(x, y, r, t0, t1):
    s = (x, y, r, t0, t1); placed.append(s)
    cx, cy = int(math.floor(x / CELL)), int(math.floor(y / CELL))
    grid[(cx, cy)].append(s)

def home_of(uid, t):
    u = U[uid]; h = u["homes"][0]
    for hh in u["homes"]:
        if hh[0] <= t + 1e-9: h = hh
    return h

# department anchors on a wide ring, ordered by founding
depts = sorted([u for u in U.values() if u["tier"] == 1], key=lambda u: (u["t0"], u["name"]))
RING = 3900
for i, u in enumerate(depts):
    a = -math.pi / 2 + i * (2 * math.pi / len(depts))
    u["anchor"] = (RING * math.cos(a), RING * math.sin(a) * 0.72)

GOLD = math.pi * (3 - math.sqrt(5))
def hval(s): return int(hashlib.md5(s.encode()).hexdigest()[:8], 16)
jobs = []
for u in U.values():
    u["homes"] = []
    for i, (t, p) in enumerate(u["segs"]):
        t_end = u["segs"][i + 1][0] if i + 1 < len(u["segs"]) else u["t1"]
        jobs.append((t, u["tier"], u["id"], i, t_end, p))
jobs.sort(key=lambda j: (j[0], j[1], j[2]))
for t, tr, uid, i, t_end, p in jobs:
    u = U[uid]; r = rmax(u, t, t_end)
    gap = 14 if tr >= 3 else 40
    # successors born of a predecessor try its spot first
    tries = []
    if i == 0 and u.get("born_of") and U[u["born_of"]].get("homes"):
        h = home_of(u["born_of"], t - 1e-6); tries.append((h[1], h[2]))
    if p and U[p].get("homes"):
        ph = home_of(p, t); pr = rmax(U[p], t, t_end)
        ax, ay, d0 = ph[1], ph[2], pr + r + gap
    elif tr == 1:
        ax, ay = u["anchor"]; d0 = 0
    elif i == 0 and u.get("born_of") and U[u["born_of"]].get("homes"):
        h = home_of(u["born_of"], t - 1e-6); ax, ay, d0 = h[1], h[2], r
    elif i == 0 and any(e["kind"] in TERM and U[e["to"]].get("homes") and alive(U[e["to"]], t) for e in by_from.get(uid, [])):
        e = next(e for e in sorted(by_from[uid], key=lambda x: x["t"]) if e["kind"] in TERM and U[e["to"]].get("homes") and alive(U[e["to"]], t))
        h = home_of(e["to"], t); ax, ay, d0 = h[1], h[2], rmax(U[e["to"]], t, t_end) + r + gap
    else:
        a = (hval(uid) % 3600) / 3600 * 2 * math.pi
        ax, ay, d0 = 1500 * math.cos(a), 1100 * math.sin(a), 0
    for k in range(0, 4000):
        ang = k * GOLD + (hval(uid) % 628) / 100
        dist = d0 + 9 * math.sqrt(k) * max(6, r * 0.55)
        tries.append((ax + dist * math.cos(ang), ay + dist * math.sin(ang)))
    for (x, y) in tries:
        if free(x, y, r, t, t_end, gap):
            break
    put(x, y, r, t, t_end)
    u["homes"].append([round(t, 4), round(x), round(y), p])

xs = [s[0] - s[2] for s in placed] + [s[0] + s[2] for s in placed]
ys = [s[1] - s[2] for s in placed] + [s[1] + s[2] for s in placed]
PAD = 600
ox, oy = min(xs) - PAD, min(ys) - PAD
W, H = max(xs) + PAD - ox, max(ys) + PAD - oy

# ---------------- beats ----------------
def title_for(group):
    e0 = group[0]; f = U[e0["f"]]["name"]
    tos = [U[e["to"]]["name"] for e in group]
    k = e0["kind"]
    if len(group) >= 2 and U[e0["f"]].get("endKind") == 4: return f"{f} divides into " + " and ".join(tos)
    if k == "renamed": return f"{f} renamed {tos[0]}"
    if k == "succeeded": return f"{f} succeeded by {tos[0]}"
    tos = list(dict.fromkeys(tos))
    if k in ("absorbed", "merged") and len(tos) >= 2: return f"{f} {k} into " + ", ".join(tos[:-1]) + " and " + tos[-1]
    if k == "merged": return f"{f} merged into {tos[0]}"
    if k == "moved": return f"{f} moved to {tos[0]}"
    if k == "partial_transfer": return f"{f} transfers functions to {tos[0]}"
    newborn = abs(U[e0["to"]]["t0"] - e0["t"]) < 1e-6
    return f"{f} becomes {tos[0]}" if newborn else f"{f} absorbed into {tos[0]}"
cands = []
groups = collections.defaultdict(list)
for i, e in enumerate(E):
    if e["t"] is None: continue
    e["i"] = i
    groups[(e["f"], round(e["t"], 4), e["kind"])].append(e)
formed = collections.defaultdict(list)
for e in E:
    if e["t"] is not None and e["kind"] in TERM and abs(U[e["to"]]["t0"] - e["t"]) < 1e-6: formed[(e["to"], round(e["t"], 4))].append(e)
formed = {k: v for k, v in formed.items() if len({e["f"] for e in v}) >= 2}
in_formed = {e["i"] for v in formed.values() for e in v}
for (tid, t), grp in formed.items():
    donors = list(dict.fromkeys(e["f"] for e in grp))
    rev = any(e["ev"] in REVIEWED for e in grp)
    tiers = [U[tid]["tier"]] + [U[x]["tier"] for x in donors]
    names = list(dict.fromkeys(U[x]["name"] for x in donors))
    title = f"{U[tid]['name']} formed from " + (names[0] if len(names) == 1 else ", ".join(names[:-1]) + " and " + names[-1] if len(names) <= 4 else ", ".join(names[:3]) + f" and {len(names) - 3} more")
    cands.append(dict(t=t, kind="formed", title=title, units=donors + [tid], edges=[e["i"] for e in grp], score=(6 - min(tiers)) * 2 + 6 + (100 if rev else 0), reviewed=rev))
for (fid, t, kind), grp in groups.items():
    if kind in ("moved", "partial_transfer"): continue
    if any(e["i"] in in_formed for e in grp): continue
    # only edges the feed actually animates: the donor ends there or the target starts there
    if not any(abs((U[e["f"]]["t1"] or -1) - e["t"]) < 1e-6 or abs(U[e["to"]]["t0"] - e["t"]) < 1e-6 for e in grp): continue
    tiers = [U[fid]["tier"]] + [U[e["to"]]["tier"] for e in grp]
    score = (6 - min(tiers)) * 2 + (2 if grp[0]["conf"] == "high" else 0) + (3 if len(grp) >= 2 else 0) + (2 if len(grp[0]["date"]) == 10 else 0)
    rev = any(e["reviewed"] and e["ev"] in REVIEWED for e in grp)
    if rev: score += 100
    cands.append(dict(t=t, kind="split" if U[fid].get("endKind") == 4 and len(grp) >= 2 else kind, title=title_for(grp), units=[fid] + [e["to"] for e in grp], edges=[e["i"] for e in grp], score=score, reviewed=rev))
for u in depts:
    cands.append(dict(t=u["t0"], kind="founded", title=f"{u['name']} established", units=[u["id"]], edges=[], score=20 + (0 if u["ref"] else 2), reviewed=False))
    if u["t1"] is not None and u["endKind"] in (1,):
        cands.append(dict(t=u["t1"], kind="abolished", title=f"{u['name']} abolished", units=[u["id"]], edges=[], score=19, reviewed=False))
for u in U.values():
    if u["tier"] == 2 and u["conf"] in ("med", "high") and u["basis"] in ("law", "stated") and not u.get("born_of"):
        cands.append(dict(t=u["t0"], kind="founded", title=f"{u['name']} established", units=[u["id"]], edges=[], score=7 + (1 if u["conf"] == "high" else 0), reviewed=False))
cands.sort(key=lambda c: -c["score"])
beats = []
for c in cands:
    gap = 0.6
    if c["reviewed"] or all(abs(c["t"] - b["t"]) >= gap for b in beats):
        beats.append(c)
beats.sort(key=lambda b: b["t"])

# ---------------- histogram per year ----------------
Y0, Y1 = 1775, 2026
hist = {y: [0, 0, 0] for y in range(Y0, Y1 + 1)}
for u in U.values():
    y = int(math.floor(u["t0"]))
    if Y0 <= y <= Y1: hist[y][0] += 1
    if u["t1"] is not None and u["endKind"] != 5:
        y = int(math.floor(u["t1"]))
        if Y0 <= y <= Y1: hist[y][1] += 1
for e in E:
    if e["t"] is not None and Y0 <= int(e["t"]) <= Y1: hist[int(e["t"])][2] += 1


# ---------------- entity classification (rule-based, inferred from the name; see docs/data-caveats.md) ----------------
# 0 federal executive, 1 legislative/judicial, 2 pre-federal predecessor, 3 state/local/territorial/foreign,
# 4 archival collection / record group, 5 advisory or temporary body. Nothing is deleted: classes 3 and 4 are quarantined in the UI.
CLS_LEG = re.compile(r"^(United States |U\.S\. )?(Senate|House of Representatives|Congress\b|Supreme Court|Court of (Claims|Appeals|Customs)|Tax Court)|District Courts?\b|Library of Congress|Government Printing Office|General Accounting Office|Government Accountability Office|Architect of the Capitol|Botanic Garden|Capitol Police|Congressional Budget Office|Office of Technology Assessment")
CLS_NOT_LEG = re.compile(r"^(U\.S\. Attorneys|U\.S\. Marshals|Office of Solicitor|Solicitor)|\(Justice\)|Section")
CLS_TERR = re.compile(r"^Government of (the )?(?!United States)|^Territory of|^Provisional Government|^Military Government of|Canal Zone Government|Danish West Indies")
CLS_ARCH = re.compile(r"Collection of .*Records|Records Collection|RG-\d+ Records|Custodian of the Records|and Related Records|^Domestic Records$")
CLS_PRE = re.compile(r"Continental|Confederation|Constitutional Convention")
def classify(u):
    n = u["name"]
    if CLS_ARCH.search(n): return 4
    if CLS_TERR.search(n): return 3
    if CLS_PRE.search(n) and u["sY"] < 1789: return 2
    if CLS_LEG.search(n) and not CLS_NOT_LEG.search(n): return 1
    if u["level"] == 6: return 5
    return 0
def flags(u):
    f = 0
    if u["basis"] == "records" and not u["ref"]: f |= 1          # start year is the start of a records span, not a founding date
    if u["ref"]: f |= 2                                          # reference year, not sourced
    if u["sY"] < 1789 and classify(u) == 0: f |= 4               # executive-classed unit dated before the federal government existed
    return f

# ---------------- emit ----------------
order = sorted(U.values(), key=lambda u: (u["t0"], u["tier"], u["name"]))
idx = {u["id"]: i for i, u in enumerate(order)}
urls = []; uidx = {}
def url_i(s):
    if not s: return -1
    if s not in uidx: uidx[s] = len(urls); urls.append(s)
    return uidx[s]
BASIS = {"law": 0, "stated": 1, "history": 2, "records": 3, "reference": 4, "": 5}
CONF = {"high": 0, "med": 1, "low": 2}
def r4(x): return None if x is None else round(x, 4)
units_out = []
for u in order:
    flat_m = []
    for t, m in steps[u["id"]]: flat_m += [r4(t), m]
    homes = [[h[0], h[1] - round(ox), h[2] - round(oy), idx[h[3]] if h[3] else -1] for h in u["homes"]]
    units_out.append([u["name"], u["tier"], u["level"], r4(u["t0"]), r4(u["t1"]), u["endKind"], CONF[u["conf"]], BASIS[u["basis"] if not u["ref"] else "reference"],
                      url_i(u["url"]), u["id"], homes, flat_m, (-1 if u.get("formed") else idx.get(u.get("born_of"), -1)), [idx[x] for x in u.get("into", [])], u["sY"], u["eY"], u["loc"], classify(u), flags(u)])
edges_out = []
for e in E:
    edges_out.append([idx[e["f"]], idx[e["to"]], KIND[e["kind"]], r4(e["t"]), e["date"], e["stat"], e["auth"], CONF.get(e["conf"], 2), e["ev"], e["sent"], e["note"], 1 if e["reviewed"] else 0])
beats_out = [[r4(b["t"]), b["kind"], b["title"], [idx[x] for x in b["units"]], b["edges"], 1 if b["reviewed"] else 0] for b in beats]
data = dict(meta=dict(version=g["meta"]["version"], sha=sha[:16], nodes=len(g["nodes"]), edges=len(g["edges"]), used_units=len(order), used_edges=len(E),
                      dropped=dict(dropped), world=[round(W), round(H)], y0=Y0, y1=Y1),
            U=units_out, E=edges_out, B=beats_out, H=[hist[y] for y in range(Y0, Y1 + 1)], URL=urls)
js = "const HIST = " + json.dumps(data, separators=(",", ":"), ensure_ascii=False) + ";\n"
open(OUT, "w").write(js)
peak = max(sum(1 for u in order if alive(u, y + 0.5)) for y in range(Y0, Y1 + 1, 5))
print(f"units {len(order)} edges {len(E)} beats {len(beats)} world {W:.0f}x{H:.0f} peak-alive {peak} bytes {len(js)} dropped {dict(dropped)}")
