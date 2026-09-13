#!/usr/bin/env python3
"""Run the stable collector with navigation-aware official-site discovery.

The wrapper preserves the collector's state/cursor, evidence, Gemini and quality
rules. It only improves discovery of official faculty profiles on nested sites.
"""
from urllib.parse import quote, urlparse
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


def _is_music(unit):
    return "음악대학" in str(unit.get("college", ""))


def _art_url(url):
    return (urlparse(str(url or "")).hostname or "").lower() == "art.snu.ac.kr"


def _music_url(url):
    return (urlparse(str(url or "")).hostname or "").lower() == "music.snu.ac.kr"


def _verified_profile(url, professor):
    try:
        candidate = collector.page(url, 0)
    except Exception:
        return ""
    text = collector.norm(candidate.text)
    if "/members/" in candidate.url and professor in text:
        return candidate.url
    return ""


def _find_art_profile(unit):
    """Find this professor's official SNU Art /members/ page without hardcoded people."""
    professor = collector.norm(unit.get("name"))
    if not professor:
        return ""
    slug = quote(professor, safe="")
    for url in (
        f"https://art.snu.ac.kr/members/{slug}/",
        f"https://art.snu.ac.kr/members/{slug}-2/",
    ):
        verified = _verified_profile(url, professor)
        if verified:
            return verified
    starts = []
    for key in ("profile", "departmentUrl", "homepage"):
        url = collector.clean_url(unit.get(key))
        if url and _art_url(url) and url not in starts:
            starts.append(url)
    if "https://art.snu.ac.kr/" not in starts:
        starts.append("https://art.snu.ac.kr/")
    queue = [(url, 0) for url in starts]
    seen = set()
    while queue and len(seen) < 24:
        url, depth = queue.pop(0)
        if url in seen or depth > 3:
            continue
        seen.add(url)
        try:
            page = collector.page(url, depth)
        except Exception:
            continue
        exact = [x for x in page.links if _art_url(x.get("url")) and collector.norm(x.get("title")) == professor]
        for link in exact:
            verified = _verified_profile(link["url"], professor)
            if verified:
                return verified
        member_links = [x for x in page.links if _art_url(x.get("url")) and "/members/" in x.get("url", "")]
        for link in member_links[:20]:
            verified = _verified_profile(link["url"], professor)
            if verified:
                return verified
        nav = []
        for link in page.links:
            if not _art_url(link.get("url")) or link.get("url") in seen:
                continue
            hint = collector.norm(link.get("title", "") + " " + link.get("url", "")).lower()
            if any(term in hint for term in ("faculty", "교수진", "교수", "major", "학과", "전공", "category/")):
                nav.append(link["url"])
        queue.extend((url, depth + 1) for url in list(dict.fromkeys(nav))[:12])
    return ""


def _verified_music_profile(url, professor):
    try:
        candidate = collector.page(url, 0)
    except Exception:
        return ""
    text = collector.norm(candidate.text)
    if _music_url(candidate.url) and professor in text and any(term in text for term in ("전공", "학력사항", "경력사항", "실적", "수상")):
        return candidate.url
    return ""


def _find_music_profile(unit):
    """Follow SNU Music faculty/detail links and verify the professor on the fetched page."""
    professor = collector.norm(unit.get("name"))
    if not professor:
        return ""
    starts = []
    for key in ("profile", "departmentUrl", "homepage"):
        url = collector.clean_url(unit.get(key))
        if url and _music_url(url) and url not in starts:
            starts.append(url)
    faculty = "https://music.snu.ac.kr/faculty"
    if faculty not in starts:
        starts.append(faculty)
    queue = [(url, 0) for url in starts]
    seen = set()
    while queue and len(seen) < 28:
        url, depth = queue.pop(0)
        if url in seen or depth > 3:
            continue
        seen.add(url)
        try:
            page = collector.page(url, depth)
        except Exception:
            continue
        # Prefer links whose visible card/detail text contains the exact professor name.
        exact = [x for x in page.links if _music_url(x.get("url")) and professor in collector.norm(x.get("title"))]
        for link in exact:
            verified = _verified_music_profile(link["url"], professor)
            if verified:
                return verified
        # Faculty detail links may have generic labels such as '상세히 보기'. Verify
        # each candidate page itself rather than relying on its URL shape.
        detail_links = []
        for link in page.links:
            if not _music_url(link.get("url")) or link.get("url") in seen:
                continue
            hint = collector.norm(link.get("title", "") + " " + link.get("url", "")).lower()
            if any(term in hint for term in ("상세히 보기", "detail", "view", "faculty")):
                detail_links.append(link["url"])
        for candidate_url in list(dict.fromkeys(detail_links))[:24]:
            verified = _verified_music_profile(candidate_url, professor)
            if verified:
                return verified
        nav = []
        for link in page.links:
            if not _music_url(link.get("url")) or link.get("url") in seen:
                continue
            hint = collector.norm(link.get("title", "") + " " + link.get("url", "")).lower()
            if any(term in hint for term in ("faculty", "교수진", "성악과", "작곡과", "음악학과", "피아노과", "관현악과", "국악과", "대학원 음악과")):
                nav.append(link["url"])
        queue.extend((u, depth + 1) for u in list(dict.fromkeys(nav))[:14])
    return ""


def navigation_scan(unit, key, model, prev, budget):
    profile = ""
    if _is_fine_arts(unit):
        profile = _find_art_profile(unit)
    elif _is_music(unit):
        profile = _find_music_profile(unit)
    else:
        return _original_scan(unit, key, model, prev, budget)
    if not profile:
        return _original_scan(unit, key, model, prev, budget)
    enriched_unit = dict(unit)
    enriched_unit["profile"] = profile
    enriched_unit["homepage"] = profile
    return _original_scan(enriched_unit, key, model, prev, budget)


collector.scan = navigation_scan

if __name__ == "__main__":
    try:
        entry.main()
    except Exception as exc:
        entry.write_failure_progress(exc)
        raise
