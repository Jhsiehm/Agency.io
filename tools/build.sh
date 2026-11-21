#!/bin/sh
# src.html + hist.js + full.js + sim.js + report.js -> app.html (artifact body) -> index.html (standalone page)
cd "$(dirname "$0")"
python3 -I - <<'PY'
s = open("src.html").read()
s = s.replace("/*@@HIST@@*/", open("hist.js").read().rstrip("\n")).replace("/*@@FULL@@*/", open("full.js").read()).replace("/*@@SIM@@*/", open("sim.js").read()).replace("/*@@REPORT@@*/", open("report.js").read())
open("app.html", "w").write(s)
PY
{ printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'; sed -n '1,/^<\/style>/p' app.html; printf '</head>\n<body>\n'; sed -n '/^<\/style>/,$p' app.html | tail -n +2; printf '</body>\n</html>\n'; } > index.html
