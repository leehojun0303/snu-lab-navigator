#!/usr/bin/env python3
"""Stable entrypoint for the current collector.

The published dataset is chunked under dist/data/units-*.js. The current v2
collector expects dist/data.js, so this entrypoint supplies a compatibility
loader before delegating to the existing collector main().
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import automated_enrichment_v2 as collector


def load_units_compatible():
    data_js = collector.DIST / "data.js"
    units = []
    if data_js.exists():
        units = collector.js(data_js, "RESEARCH_UNITS")
    else:
        chunks = sorted((collector.DIST / "data").glob("units-*.js"))
        if not chunks:
            raise RuntimeError("No dist/data.js or dist/data/units-*.js found")
        for index, path in enumerate(chunks):
            text = path.read_text(encoding="utf-8")
            pattern = (r"window\.RESEARCH_UNITS\s*=\s*(.+?)\s*;\s*$"
                       if index == 0 else
                       r"window\.RESEARCH_UNITS\.push\(\.\.\.(.+?)\);\s*$")
            match = re.search(pattern, text, re.S)
            if not match:
                raise RuntimeError(f"Cannot parse research-unit chunk {path.name}")
            units.extend(json.loads(match.group(1)))

    supplement_path = collector.DIST / "roster-supplements.js"
    supplements = (collector.js(supplement_path, "RESEARCH_UNIT_SUPPLEMENTS")
                   if supplement_path.exists() else [])
    merged = {}
    for item in [*units, *supplements]:
        key = "|".join(str(item.get(k, "")).strip() for k in ("college", "department", "name"))
        merged[key] = item
    return sorted(merged.values(), key=lambda item: str(item.get("id", "")))


collector.load_units = load_units_compatible

if __name__ == "__main__":
    collector.main()
