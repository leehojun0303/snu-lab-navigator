#!/usr/bin/env python3
"""Run the stable collector with navigation-aware official-site discovery.

This wrapper leaves collector state/cursor semantics untouched.  It only adds
navigation terms so same-host crawls can reach faculty pages hidden below
college -> department -> faculty menus before the existing evidence and Gemini
quality gates run.
"""
import collector_entry as entry

entry.collector.TERMS.setdefault("directory", (
    "faculty", "professor", "professors", "people", "members",
    "department", "departments", "major", "majors",
    "교수", "교수진", "교원", "학과", "전공", "구성원",
))

if __name__ == "__main__":
    try:
        entry.main()
    except Exception as exc:
        entry.write_failure_progress(exc)
        raise
