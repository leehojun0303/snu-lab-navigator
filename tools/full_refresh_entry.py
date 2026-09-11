#!/usr/bin/env python3
"""Run a clean, resumable full enrichment pass in professor-name order.

The base roster is preserved. Derived activity/enrichment state is reset so the
pass rebuilds research/member/paper/recruitment/poster data from scratch without
allowing stale legacy activity data to leak into the public UI.
"""
from __future__ import annotations

import json
from pathlib import Path

import collector_entry as entry

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / "data" / "automation-state.json"
OUT = ROOT / "dist" / "automation-data.js"
LEGACY_ACTIVITY = ROOT / "dist" / "activity-data.js"

_original_loader = entry.load_units_compatible


def alphabetical_units():
    units = _original_loader()
    return sorted(
        units,
        key=lambda x: (
            str(x.get("name", "")).strip().lower(),
            str(x.get("college", "")).strip().lower(),
            str(x.get("department", "")).strip().lower(),
            str(x.get("id", "")),
        ),
    )


def reset_derived_state():
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(
        json.dumps(
            {
                "cursor": 0,
                "records": {},
                "failures": {},
                "last_run": {},
                "reset_reason": "full_refresh_alphabetical_rebuild_2026-09-11",
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    OUT.write_text("", encoding="utf-8")
    # activity-data.js was an older static activity cache. Leaving it populated
    # would make unrefreshed professors display stale papers/recruitment/members.
    LEGACY_ACTIVITY.write_text("window.RESEARCH_ACTIVITY = {};\n", encoding="utf-8")


entry.load_units_compatible = alphabetical_units


def main():
    reset_derived_state()
    entry.main()


if __name__ == "__main__":
    main()
