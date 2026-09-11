#!/usr/bin/env python3
"""Sync professor units from trusted SNU directory pages.

Roster sources are a UNION, never an intersection. A professor is kept when
any successful trusted official source supports the person. Absence from one
college/department page is never enough to remove a professor.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
STATE = ROOT / "data" / "roster-sync-state.json"
CHUNKS = DIST / "data"
UA = "SNU-Lab-Navigator-Roster-Sync/2.1"
TIMEOUT = 15
MAX_BODY = 2_000_000
CHUNK_SIZE = 100
FORMER_RE = re.compile(r"(퇴직|명예교수|전임\s*종료|retired|emeritus|former\s+(?:faculty|professor)|no\s+longer\s+(?:with|at)|이직|사직)", re.I)
FACULTY_HINT_RE = re.compile(r"(교수|professor|faculty|prof\.?|faculty-member|faculty/|professor/|people/)", re.I)
NON_FACULTY_RE = re.compile(r"(학생|student|staff|직원|조교|assistant|연구원|researcher|postdoc|박사|석사|학부|동문|alumni)", re.I)


def now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clean_url(value):
    m = re.search(r"https?://[^\s;,|]+", str(value or ""))
    return m.group(0).rstrip(").]}") if m else ""


def allowed(url):
    host = (urlparse(url).hostname or "").lower()
    return host == "snu.ac.kr" or host.endswith(".snu.ac.kr") or host == "snu.elsevierpure.com"


def make_id(college, department, name):
    digest = hashlib.sha1("|".join([college.strip(), department.strip(), name.strip()]).encode("utf-8")).hexdigest().upper()[:14]
    return f"SNU-RU-{digest}"


def extract_units():
    out = []
    paths = sorted(CHUNKS.glob("units-*.js"))
    for path in paths:
        text = path.read_text(encoding="utf-8")
        m = re.search(r"window\.RESEARCH_UNITS\s*=\s*(.+?)\s*;\s*$", text, re.S)
        if not m:
            m = re.search(r"window\.RESEARCH_UNITS\.push\(\.\.\.(.+?)\);\s*$", text, re.S)
        if m:
            out.extend(json.loads(m.group(1)))
    if out:
        return out
    data_js = DIST / "data.js"
    if data_js.exists():
        m = re.search(r"window\.RESEARCH_UNITS\s*=\s*(.+?)\s*;\s*$", data_js.read_text(encoding="utf-8"), re.S)
        if m:
            return json.loads(m.group(1))
    return []


class DirectoryParser(HTMLParser):
    def __init__(self, base):
        super().__init__(convert_charrefs=True)
        self.base = base
        self.skip = 0
        self.anchor = ""
        self.anchor_text = []
        self.links = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower(); attrs = {str(k).lower(): str(v or "") for k, v in attrs}
        if tag in {"script", "style", "noscript", "svg", "template"}:
            self.skip += 1; return
        if self.skip: return
        if tag == "a":
            self.anchor = urljoin(self.base, attrs.get("href", ""))
            self.anchor_text = []

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in {"script", "style", "noscript", "svg", "template"} and self.skip:
            self.skip -= 1; return
        if self.skip: return
        if tag == "a" and self.anchor:
            self.links.append({"url": self.anchor, "text": " ".join(self.anchor_text)})
            self.anchor = ""; self.anchor_text = []

    def handle_data(self, data):
        if self.skip: return
        text = re.sub(r"\s+", " ", data or "").strip()
        if text and self.anchor: self.anchor_text.append(text)


def fetch(url):
    request = Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*;q=0.8"})
    with urlopen(request, timeout=TIMEOUT) as response:
        body = response.read(MAX_BODY)
        content_type = response.headers.get("content-type", "").lower()
        final = response.geturl()
    if "text/html" not in content_type and "text/plain" not in content_type:
        return final, ""
    encoding = "utf-8"
    m = re.search(r"charset=([^;\s]+)", content_type)
    if m: encoding = m.group(1).strip("\"'")
    return final, body.decode(encoding, errors="replace")


def scan_source(url):
    try:
        final, html = fetch(url)
        parser = DirectoryParser(final); parser.feed(html)
        return {"url": url, "final_url": final, "ok": True, "links": parser.links}
    except Exception as exc:
        return {"url": url, "final_url": url, "ok": False, "links": [], "error": type(exc).__name__}


def faculty_link(link):
    label = re.sub(r"\s+", " ", str(link.get("text", ""))).strip()
    href = str(link.get("url", ""))
    if not label or len(label) > 100 or not allowed(href):
        return False
    if NON_FACULTY_RE.search(label) and not re.search(r"교수|professor|prof\.?", label, re.I):
        return False
    return bool(FACULTY_HINT_RE.search(f"{label} {href}"))


def infer_name(link):
    value = re.sub(r"\([^)]*\)", " ", str(link.get("text", "")))
    value = re.sub(r"\b(?:assistant|associate|full|distinguished|visiting|emeritus)?\s*professor\b", " ", value, flags=re.I)
    value = re.sub(r"\bprof\.?\b", " ", value, flags=re.I)
    value = re.sub(r"교수", " ", value)
    return re.sub(r"\s+", " ", value).strip(" -|:,;·")


def write_chunks(units):
    CHUNKS.mkdir(parents=True, exist_ok=True)
    for old in CHUNKS.glob("units-*.js"): old.unlink()
    for i in range(0, len(units), CHUNK_SIZE):
        block = units[i:i + CHUNK_SIZE]
        (CHUNKS / f"units-{i // CHUNK_SIZE:03d}.js").write_text(
            "window.RESEARCH_UNITS = " + json.dumps(block, ensure_ascii=False, separators=(",", ":")) + ";\n",
            encoding="utf-8")
    tags = "".join(f'<script src="data/units-{i // CHUNK_SIZE:03d}.js"><\\/script>' for i in range(0, len(units), CHUNK_SIZE))
    (DIST / "data-loader.js").write_text(f"document.write('{tags}');\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=12)
    parser.add_argument("--max-pages", type=int, default=100000)
    args = parser.parse_args()
    units = extract_units()
    if not units: raise RuntimeError("No current research units found")

    # Every distinct official department/college URL represented by the
    # current dataset is a source in the UNION. A professor only needs to be
    # confirmed by one successful source; there is no intersection requirement.
    source_map = {}
    for unit in units:
        url = clean_url(unit.get("departmentUrl"))
        if url and allowed(url):
            source_map.setdefault(url, set()).add((str(unit.get("college", "")), str(unit.get("department", ""))))
    source_urls = list(source_map)[:args.max_pages]
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        scanned = list(pool.map(scan_source, source_urls))
    successful = [x for x in scanned if x.get("ok")]

    # Build observations by scope. A source may represent a college or several
    # departments; every successful source observation contributes to the union.
    observed_by_scope = {}
    observed_global = set()
    profile_by_scope = {}
    existing = {}
    for unit in units:
        key = (str(unit.get("college", "")), str(unit.get("department", "")), str(unit.get("name", "")).strip())
        existing[key] = dict(unit)
        profile_by_scope.setdefault((key[0], key[1]), []).append(unit)

    added = []
    for result in successful:
        scopes = source_map.get(result["url"], set())
        names = set()
        for link in result["links"]:
            if not faculty_link(link): continue
            name = infer_name(link)
            if len(name) < 2 or len(name) > 80: continue
            names.add(name); observed_global.add(name)
        for scope in scopes:
            observed_by_scope.setdefault(scope, set()).update(names)
            college, department = scope
            for name in names:
                key = (college, department, name)
                if key not in existing:
                    item = {
                        "id": make_id(college, department, name), "name": name, "title": name,
                        "college": college, "department": department, "rank": "", "type": "",
                        "naming": "official-roster-sync", "labs": "", "fields": "", "keywords": "",
                        "profile": next((x["url"] for x in result["links"] if faculty_link(x) and infer_name(x) == name), ""),
                        "homepage": "", "photo": "", "departmentUrl": result["url"],
                        "guidance": "공식 서울대학교 명단에서 확인된 교수",
                    }
                    existing[key] = item
                    added.append({"id": item["id"], "name": name, "college": college, "department": department, "source": result["url"]})

    previous = {}
    if STATE.exists():
        try: previous = json.loads(STATE.read_text(encoding="utf-8"))
        except Exception: previous = {}
    old_streak = previous.get("absent_streak", {})
    new_streak = {}
    removed = []
    final = []
    successful_urls = {x["url"] for x in successful}

    for key, unit in existing.items():
        college, department, name = key
        # A unit is relevant to every source that represents the same college
        # or exact department. Presence in ANY such source is sufficient.
        relevant_scopes = {scope for url, scopes in source_map.items() if url in successful_urls for scope in scopes
                           if (scope[0] == college and (not department or not scope[1] or scope[1] == department))}
        observed_any = any(name in observed_by_scope.get(scope, set()) for scope in relevant_scopes)
        if observed_any:
            unit["roster_last_confirmed"] = now(); new_streak[str(unit.get("id"))] = 0; final.append(unit); continue

        # Profile confirmation is only used for a unit absent from roster pages.
        profile = clean_url(unit.get("profile")); profile_ok = False; explicit_former = False
        if profile and allowed(profile):
            try:
                _, profile_html = fetch(profile)
                profile_ok = bool(profile_html)
                explicit_former = bool(FORMER_RE.search(re.sub(r"\s+", " ", profile_html)))
            except Exception:
                profile_ok = False
        if profile_ok and not explicit_former:
            unit["roster_last_confirmed"] = now(); new_streak[str(unit.get("id"))] = 0; final.append(unit); continue
        if explicit_former:
            removed.append({"id": unit.get("id"), "name": name, "reason": "explicit_former_status"}); continue

        streak = int(old_streak.get(str(unit.get("id")), 0)) + 1
        new_streak[str(unit.get("id"))] = streak
        # No source may have confirmed this unit. Never remove on the first miss.
        if streak >= 2 and relevant_scopes:
            removed.append({"id": unit.get("id"), "name": name, "reason": "absent_from_all_relevant_union_sources_for_two_successful_syncs"}); continue
        final.append(unit)

    final.sort(key=lambda x: str(x.get("id", "")))
    write_chunks(final)
    state = {
        "version": 3, "updated_at": now(), "sources_checked": scanned,
        "successful_source_count": len(successful), "source_count": len(source_urls),
        "unit_count_before": len(units), "unit_count_after": len(final),
        "added": added, "removed": removed, "absent_streak": new_streak,
        "policy": "UNION: one successful trusted official source is sufficient for current inclusion; single-source absence never removes a professor; explicit former status or two consecutive all-relevant-source absences can remove.",
    }
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"before": len(units), "after": len(final), "added": len(added), "removed": len(removed), "successful_sources": len(successful)}, ensure_ascii=False))


if __name__ == "__main__": main()
