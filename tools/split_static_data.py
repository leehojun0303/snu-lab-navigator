#!/usr/bin/env python3
"""Split the large research-unit payload into GitHub/API-friendly browser chunks."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
SOURCE = DIST / "data.js"
OUT_DIR = DIST / "data"
CHUNK_SIZE = 90


def main() -> None:
    text = SOURCE.read_text(encoding="utf-8")
    match = re.search(r"window\.RESEARCH_UNITS\s*=\s*(.+?)\s*;\s*$", text, re.S)
    if not match:
        raise RuntimeError("Cannot parse window.RESEARCH_UNITS")
    rows = json.loads(match.group(1))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("units-*.js"):
        old.unlink()
    names = []
    for index, start in enumerate(range(0, len(rows), CHUNK_SIZE)):
        name = f"units-{index:03d}.js"
        names.append(name)
        payload = json.dumps(rows[start:start + CHUNK_SIZE], ensure_ascii=False, separators=(",", ":"))
        prefix = "window.RESEARCH_UNITS = " if index == 0 else "window.RESEARCH_UNITS.push(..."
        suffix = ";\n" if index == 0 else ");\n"
        (OUT_DIR / name).write_text(prefix + payload + suffix, encoding="utf-8")
    tags = "".join(f'<script src="data/{name}"><\\/script>' for name in names)
    (DIST / "data-loader.js").write_text(f"document.write('{tags}');\n", encoding="utf-8")
    print(f"Wrote {len(names)} chunks for {len(rows)} research units")


if __name__ == "__main__":
    main()
