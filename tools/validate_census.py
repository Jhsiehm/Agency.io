#!/usr/bin/env python3
"""Quality gates for the compiled Agency.io history (tools/hist.js).

usage:  python3 -I tools/validate_census.py tools/hist.js docs/      # writes docs/caveats.json + docs/data-caveats.md
        python3 -I tools/validate_census.py --selftest              # seeds known-bad records and checks each rule fires

Exit status is 1 when a hard error is found (dangling edge, self loop, impossible date order, parent cycle).
Soft findings (caveats) are counted and published, never deleted.
"""
import json, sys, os, collections

CLASS_NAME = ["Federal executive", "Legislative or judicial", "Pre-federal predecessor", "State, local, territorial or foreign",
              "Archival collection or record group", "Advisory or temporary body"]
BASIS_NAME = ["law", "stated in source", "agency history", "records span", "reference year, not sourced", "not recorded"]
CONF_NAME = ["high", "medium", "low"]
KIND_NAME = ["absorbed", "merged", "moved", "partial transfer", "renamed", "succeeded"]
RENAME_WORDS = ("redesignated", "renamed", "name changed", "changed name")


def load(path):
    s = open(path, encoding="utf-8").read()
    return json.loads(s[s.index("{"):s.rindex("}") + 1])


def check(H):
    U, E, B = H["U"], H["E"], H["B"]
    n = len(U)
    hard = collections.defaultdict(list)
    soft = collections.defaultdict(list)
    for i, e in enumerate(E):
        f, t, kind, et = e[0], e[1], e[2], e[3]
        if not (0 <= f < n and 0 <= t < n): hard["dangling_edge"].append(i); continue
        if f == t: hard["self_loop"].append(i); continue
        if et is not None and et < U[f][3] - 1e-6: soft["edge_before_donor_exists"].append(i)
        if kind in (0, 1, 5) and any(w in (e[9] or "").lower() for w in RENAME_WORDS): soft["rename_modeled_as_absorption"].append(i)
        if not e[11]: soft["unreviewed_edge"].append(i)
    for i, u in enumerate(U):
        t0, t1 = u[3], u[4]
        if t1 is not None and t1 < t0: hard["end_before_start"].append(i)
        homes = u[10]
        for h in homes:
            p = h[3]
            if p >= n: hard["dangling_parent"].append(i); continue
            if p >= 0:
                pu = U[p]
                if h[0] < pu[3] - 1e-6 or (pu[4] is not None and h[0] >= pu[4]): soft["parent_not_alive_at_date"].append(i)
        # parent cycle: walk first-home parents
        seen, c, steps = set(), i, 0
        while c >= 0 and steps < 64:
            if c in seen: hard["parent_cycle"].append(i); break
            seen.add(c); c = U[c][10][0][3] if U[c][10] else -1; steps += 1
        cls = u[17] if len(u) > 17 else 0
        fl = u[18] if len(u) > 18 else 0
        if fl & 1: soft["start_is_records_span"].append(i)
        if fl & 2: soft["reference_year_not_sourced"].append(i)
        if fl & 4: soft["executive_dated_before_1789"].append(i)
        if cls == 4: soft["quarantined_archival_collection"].append(i)
        if cls == 3: soft["quarantined_non_federal_government"].append(i)
        if u[6] == 2: soft["low_confidence"].append(i)
    # duplicate names alive at the same time
    by = collections.defaultdict(list)
    for i, u in enumerate(U): by[u[0].lower()].append(i)
    for name, ids in by.items():
        for a in range(len(ids)):
            for b in range(a + 1, len(ids)):
                x, y = U[ids[a]], U[ids[b]]
                if x[3] < (y[4] if y[4] is not None else 9e9) and y[3] < (x[4] if x[4] is not None else 9e9):
                    soft["duplicate_name_overlapping_life"].append(ids[b])
    for i, b in enumerate(B):
        if not b[5]: soft["unreviewed_beat"].append(i)
        for k in b[3]:
            if not (0 <= k < n): hard["beat_dangling_unit"].append(i)
    return hard, soft


def summary(H, hard, soft):
    U = H["U"]
    cls = collections.Counter(CLASS_NAME[u[17] if len(u) > 17 else 0] for u in U)
    conf = collections.Counter(CONF_NAME[u[6]] for u in U)
    basis = collections.Counter(BASIS_NAME[u[7]] for u in U)
    return {
        "dataset": {"version": H["meta"]["version"], "graph_sha256_prefix": H["meta"]["sha"], "source_nodes": H["meta"]["nodes"], "source_edges": H["meta"]["edges"],
                    "included_units": len(U), "included_edges": len(H["E"]), "marked_beats": len(H["B"]), "reviewed_beats": sum(1 for b in H["B"] if b[5]),
                    "reviewed_edges": sum(1 for e in H["E"] if e[11]), "dropped": H["meta"]["dropped"]},
        "classification": dict(cls), "confidence": dict(conf), "start_basis": dict(basis),
        "hard_errors": {k: len(v) for k, v in hard.items()},
        "caveats": {k: len(v) for k, v in sorted(soft.items())},
        "examples": {k: [U[i][0] if not k.endswith(("edge", "absorption", "exists")) and not k.endswith("beat") else i for i in v[:8]] for k, v in sorted(soft.items())},
    }


CAVEAT_TEXT = {
    "start_is_records_span": "Start year is the first year of an archival records span. Shown as \"records coverage begins\", never as a founding date.",
    "reference_year_not_sourced": "Department start year comes from a reference list with no source in the census.",
    "executive_dated_before_1789": "Classed as a federal executive body but dated before the federal government (usually a records span).",
    "quarantined_archival_collection": "Looks like a record collection rather than an institution. Hidden from the arena by default; listed in Entities.",
    "quarantined_non_federal_government": "Territorial, local or foreign government. Hidden from the arena by default; listed in Entities.",
    "low_confidence": "Census confidence is low.",
    "unreviewed_edge": "Relationship has not been reviewed by a person.",
    "unreviewed_beat": "Marked event has not been reviewed by a person (draft).",
    "rename_modeled_as_absorption": "Source sentence says the body was renamed or redesignated, but the edge type is absorbed, merged or succeeded.",
    "edge_before_donor_exists": "Relationship date is earlier than the donor's start date.",
    "parent_not_alive_at_date": "Parent is not alive at the date the unit is placed under it.",
    "duplicate_name_overlapping_life": "Another unit with the same name is alive at the same time (possible alias).",
}


def write_docs(rep, outdir):
    os.makedirs(outdir, exist_ok=True)
    json.dump(rep, open(os.path.join(outdir, "caveats.json"), "w"), indent=1, ensure_ascii=False)
    d = rep["dataset"]
    L = ["# Data caveats (generated)", "",
         f"Generated by `tools/validate_census.py` from census {d['version']} (graph.json sha256 {d['graph_sha256_prefix']}…). Do not edit by hand.", "",
         "Everything in the full-history tour is a **draft** unless it says Reviewed. Cell size is a visual model, not budget, staff or legal power.", "",
         "## Coverage", "",
         f"- {d['source_nodes']:,} source units, {d['included_units']:,} included (dated and readable). Dropped: " + ", ".join(f"{v:,} {k}" for k, v in d["dropped"].items()) + ".",
         f"- {d['source_edges']:,} source relationships, {d['included_edges']:,} included, {d['reviewed_edges']} reviewed.",
         f"- {d['marked_beats']} marked events, {d['reviewed_beats']} reviewed.", "",
         "## Classification (rule-based, inferred from names)", ""]
    L += [f"- {k}: {v:,}" for k, v in sorted(rep["classification"].items(), key=lambda x: -x[1])]
    L += ["", "## Confidence", ""] + [f"- {k}: {v:,}" for k, v in rep["confidence"].items()]
    L += ["", "## Start basis", ""] + [f"- {k}: {v:,}" for k, v in sorted(rep["start_basis"].items(), key=lambda x: -x[1])]
    L += ["", "## Hard errors", ""] + ([f"- {k}: {v}" for k, v in rep["hard_errors"].items()] or ["- none"])
    L += ["", "## Caveats", "", "| Check | Count | Meaning |", "|---|---:|---|"]
    L += [f"| `{k}` | {v:,} | {CAVEAT_TEXT.get(k, '')} |" for k, v in rep["caveats"].items()]
    L += ["", "## Examples", ""]
    for k, v in rep["examples"].items():
        if v and isinstance(v[0], str): L.append(f"- `{k}`: " + "; ".join(v[:5]))
    open(os.path.join(outdir, "data-caveats.md"), "w").write("\n".join(L) + "\n")


def selftest():
    def unit(name, t0, t1=None, parent=-1, cls=0, fl=0, conf=1):
        return [name, 3, 3, t0, t1, 0, conf, 1, -1, "u-" + name, [[t0, 0, 0, parent]], [t0, 1.0], -1, [], int(t0), None, "", cls, fl]
    U = [unit("Good Bureau", 1900.5), unit("Bad Order", 1950.5, 1940.5), unit("Cycle A", 1900.5, parent=3), unit("Cycle B", 1900.5, parent=2),
         unit("Records Span Office", 1700.5, fl=1 | 4), unit("Danish Thing", 1672.5, cls=3), unit("Good Bureau", 1910.5)]
    E = [[0, 9, 0, 1960.0, "1960", "", "", 1, "x", "", "", 0], [0, 0, 0, 1960.0, "1960", "", "", 1, "x", "", "", 0],
         [6, 0, 0, 1920.0, "1920", "", "", 1, "x", "Redesignated as Good Bureau by act of 1920.", "", 0]]
    H = {"meta": {"version": "test", "sha": "0", "nodes": 7, "edges": 3, "dropped": {}}, "U": U, "E": E, "B": [[1960.0, "founded", "x", [42], [], 0]]}
    hard, soft = check(H)
    want_hard = ["dangling_edge", "self_loop", "end_before_start", "parent_cycle", "beat_dangling_unit"]
    want_soft = ["start_is_records_span", "executive_dated_before_1789", "quarantined_non_federal_government", "rename_modeled_as_absorption", "duplicate_name_overlapping_life", "unreviewed_beat"]
    ok = True
    for k in want_hard: print(("PASS" if hard.get(k) else "FAIL") + " hard rule fires: " + k); ok &= bool(hard.get(k))
    for k in want_soft: print(("PASS" if soft.get(k) else "FAIL") + " caveat rule fires: " + k); ok &= bool(soft.get(k))
    clean = {"meta": H["meta"], "U": [U[0]], "E": [], "B": []}
    h2, _ = check(clean); print(("PASS" if not h2 else "FAIL") + " clean fixture has no hard errors"); ok &= not h2
    return ok


if __name__ == "__main__":
    if sys.argv[1:2] == ["--selftest"]: sys.exit(0 if selftest() else 1)
    H = load(sys.argv[1]); hard, soft = check(H); rep = summary(H, hard, soft)
    if len(sys.argv) > 2: write_docs(rep, sys.argv[2])
    print(json.dumps({"hard_errors": rep["hard_errors"], "caveats": rep["caveats"]}))
    sys.exit(1 if hard else 0)
