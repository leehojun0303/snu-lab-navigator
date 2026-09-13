#!/usr/bin/env python3
"""Run the stable collector with navigation-aware official-site discovery.

The wrapper preserves the collector's state/cursor, evidence, Gemini and quality
rules. It only improves discovery of official faculty profiles on nested sites.
"""
from urllib.parse import urlparse
import collector_entry as entry

collector = entry.collector
collector.TERMS.setdefault("directory", (
    "faculty", "professor", "professors", "people", "members",
    "department", "departments", "major", "majors",
    "교수", "교수진", "교원", "학과", "전공", "구성원",
))

_original_scan = collector.scan


def _is_fine_arts(unit):
    return "미술대학" in str(unit.get("college", ""))


def _art_url(url):
    return (urlparse(str(url or "")).hostname or "").lower() == "art.snu.ac.kr"


def _find_art_profile(unit):
    """Find the current professor's official /members/ page without storing names/URLs."""
    professor = collector.norm(unit.get("name"))
    if not professor:
        return ""
    starts = []
    for key in ("profile", "departmentUrl", "homepage"):
        url = collector.clean_url(unit.get(key))
        if url and _art_url(url) and url not in starts:
            starts.append(url)
    queue = [(url, 0) for url in starts]
    seen = set()
    while queue and len(seen) < 18:
        url, depth = queue.pop(0)
        if url in seen or depth > 3:
            continue
        seen.add(url)
        try:
            page = collector.page(url, depth)
        except Exception:
            continue
        # Exact visible professor-name links are strongest evidence.
        exact = [x for x in page.links if _art_url(x.get("url")) and collector.norm(x.get("title")) == professor]
        if exact:
            return exact[0]["url"]
        # SNU Art individual profiles use /members/; only accept a fetched page
        # when the target professor name is actually present in that page text.
        member_links = [x for x in page.links if _art_url(x.get("url")) and "/members/" in x.get("url", "")]
        for link in member_links[:16]:
            try:
                candidate = collector.page(link["url"], depth + 1)
            except Exception:
                continue
            if professor in collector.norm(candidate.text):
                return candidate.url
        nav = []
        for link in page.links:
            if not _art_url(link.get("url")) or link.get("url") in seen:
                continue
            hint = collector.norm(link.get("title", "") + " " + link.get("url", "")).lower()
            if any(term in hint for term in ("faculty", "교수진", "교수", "major", "학과", "전공", "category/")):
                nav.append(link["url"])
        queue.extend((url, depth + 1) for url in list(dict.fromkeys(nav))[:12])
    return ""


def navigation_scan(unit, key, model, prev, budget):
    if not _is_fine_arts(unit):
        return _original_scan(unit, key, model, prev, budget)
    profile = _find_art_profile(unit)
    if not profile:
        return _original_scan(unit, key, model, prev, budget)
    enriched_unit = dict(unit)
    enriched_unit["profile"] = profile
    return _original_scan(enriched_unit, key, model, prev, budget)


collector.scan = navigation_scan

if __name__ == "__main__":
    try:
        entry.main()
    except Exception as exc:
        entry.write_failure_progress(exc)
        raise
