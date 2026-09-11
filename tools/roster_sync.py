#!/usr/bin/env python3
"""Sync the current professor roster from trusted SNU directory pages.

Important policy: roster sources are a UNION, never an intersection. A professor
is active when at least one successful official source still supports the person.
Missing from one college/department page therefore never removes the professor.
Removal requires an explicit former/retired signal or absence from every
successful tracked source for two consecutive syncs.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import concurrent.futures
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
STATE = ROOT / "data" / "roster-sync-state.json"
CHUNKS = DIST / "data"
UA = "SNU-Lab-Navigator-Roster-Sync/2.0"
TIMEOUT = 15
MAX_BODY = 2_000_000
CHUNK_SIZE = 100

FORMER_RE = re.compile(r"(퇴직|명예교수|전임\s*종료|retired|emeritus|former\s+(?:faculty|professor)|no\s+longer\s+(?:with|at)|이직|사직)", re.I)
FACULTY_HINT_RE = re.compile(r"(교수|professor|faculty|prof\.?|faculty-member|people/|faculty/|professor/)", re.I)
NON_FACULTY_RE = re.compile(r"(학생|student|staff|직원|조교|assistant|연구원|researcher|postdoc|박사|석사|학부|동문|alumni)", re.I)


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clean_url(value: str) -> str:
    match = re.search(r"https?://[^\s;,|]+", str(value or ""))
    return match.group(0).rstrip(").]}") if match else ""


def allowed(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host == "snu.ac.kr" or host.endswith(".snu.ac.kr") or host == "snu.elsevierpure.com"


def unit_id(college: str, department: str, name: str) -> str:
    digest = hashlib.sha1("|".join([college.strip(), department.strip(), name.strip()]).encode("utf-8")).hexdigest().upper()[:14]
    return f"SNU-RU-{digest}"


def extract_units() -> list[dict]:
    out: list[dict] = []
    chunks = sorted(CHUNKS.glob("units-*.js"))
    for path in chunks:
        text = path.read_text(encoding="utf-8")
        m = re.search(r"window\.RESEARCH_UNITS\s*=\s*(.+?)\s*;\s*$", text, re.S)
        if m:
            out.extend(json.loads(m.group(1)))
            continue
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
    def __init__(self, base_url: str):
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.skip = 0
        self.anchor_url = ""
        self.anchor_text: list[str] = []
        self.links: list[dict] = []
        self.page_text: list[str] = []

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        attrs = {str(k).lower(): str(v or "") for k, v in attrs}
        if tag in {"script", "style", "noscript", "svg", "template"}:
            self.skip += 1
            return
        if self.skip:
            return
        if tag == "a":
            self.anchor_url = urljoin(self.base_url, attrs.get("href", ""))
            self.anchor_text = []

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in {"script", "style", "noscript", "svg", "template"} and self.skip:
            self.skip -= 1
            return
        if self.skip:
            return
        if tag == "a" and self.anchor_url:
            self.links.append({"url": self.anchor_url, "text": " ".join(self.anchor_text)})
            self.anchor_url = ""
            self.anchor_text = []

    def handle_data(self, data):
        if self.skip:
            return
        value = re.sub(r"\s+", " ", data or "").strip()
        if value:
            self.page_text.append(value)
            if self.anchor_url:
                self.anchor_text.append(value)


def fetch(url: str) -> tuple[str, str]:
    request = Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*;q=0.8"})
    with urlopen(request, timeout=TIMEOUT) as response:
        body = response.read(MAX_BODY)
        content_type = response.headers.get("content-type", "").lower()
        final = response.geturl()
    if "text/html" not in content_type and "text/plain" not in content_type:
        return final, ""
    encoding = "utf-8"
    match = re.search(r"charset=([^;\s]+)", content_type)
    if match:
        encoding = match.group(1).strip("\"'")
    return final, body.decode(encoding, errors="replace")


def scan_source(url: str) -> dict:
    try:
        final, html = fetch(url)
        parser = DirectoryParser(final)
        parser.feed(html)
        return {"url": url, "final_url": final, "ok": True, "links": parser.links, "text": " ".join(parser.page_text)}
    except Exception as exc:
        return {"url": url, "final_url": url, "ok": False, "links": [], "text": "", "error": type(exc).__name__}


def clean_name(text: str) -> str:
    text = re.sub(r"\([^)]*\)", " ", text)
    text = re.sub(r"\b(?:full|assistant|associate|distinguished|emeritus|research|visiting)?\s*professor\b", " ", text, flags=re.I)
    text = re.sub(r"\bprof\.?\b", " ", text, flags=re.I)
    text = re.sub(r"교수", " ", text)
    text = re.sub(r"\s+", " ", text).strip(" -|:,;·")
    return text


def likely_faculty(link: dict) -> bool:
    label = re.sub(r"\s+", " ", str(link.get("text", ""))).strip()
    href = str(link.get("url", ""))
    if not label or len(label) > 100 or not allowed(href):
        return False
    blob = f"{label} {href}"
    if NON_FACULTY_RE.search(label) and not re.search(r"교수|professor|prof\.?&quot;", label, re.I):
        return False
    return bool(FACULTY_HINT_RE.search(blob))


def infer_name(link: dict) -> str:
    label = re.sub(r"\s+", " ", str(link.get("text", ""))).strip()
    # Drop common role annotations while preserving Korean/English names.
    name = clean_name(label)
    return name


def write_chunks(units: list[dict]) -> None:
    CHUNKS.mkdir(parents=True, exist_ok=True)
    for path in CHUNKS.glob("units-*.js"):
        path.unlink()
    for index in range(0, len(units), CHUNK_SIZE):
        block = units[index:index + CHUNK_SIZE]
        (CHUNKS / f"units-{index // CHUNK_SIZE:03d}.js").write_text(
            "window.RESEARCH_UNITS = " + json.dumps(block, ensure_ascii=False, separators=(",", ":")) + ";\n",
            encoding="utf-8",
        )
    tags = "".join(f'<script src="data/units-{i // CHUNK_SIZE:03d}.js"><\\/script>' for i in range(0, len(units), CHUNK_SIZE))
    (DIST / "data-loader.js").write_text(f"document.write('{tags}');\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=12)
    parser.add_argument("--max-pages", type=int, default=100000)
    args = parser.parse_args()

    units = extract_units()
    if not units:
        raise RuntimeError("No current research units found")

    # Build the official source UNION from every distinct department/college
    # URL already represented in the dataset. There is intentionally no
    # requirement for a professor to occur in every source.
    source_map: dict[str, set[tuple[str, str]]] = {}
    for unit in units:
        url = clean_url(unit.get("departmentUrl"))
        if url and allowed(url):
            source_map.setdefault(url, set()).add((str(unit.get("college", "")), str(unit.get("department", ""))))
    source_urls = list(source_map)[:args.max_pages]

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        scanned = list(pool.map(scan_source, source_urls))

    successful = [item for item in scanned if item.get("ok")]
    source_observations: dict[tuple[str, str], set[str]] = {}
    global_observed_names: set[str] = set()
    new_items: dict[tuple[str, str, str], dict] = {}

    for result in successful:
        scopes = source_map.get(result["url"], set())
        local_names: set[str] = set()
        for link in result["links"]:
            if not likely_faculty(link):
                continue
            name = infer_name(link)
            if len(name) < 2 or len(name) > 80:
                continue
            local_names.add(name)
            global_observed_names.add(name)
            for college, department in scopes:
                key = (college, department)
                source_observations.setdefault(key, set()).add(name)
                existing = next((u for u in units if str(u.get("name", "")).strip() == name and str(u.get("college", "")) == college and str(u.get("department", "")) == department), None)
                if existing is None:
                    new_items[(college, department, name)] = {
                        "id": unit_id(college, department, name),
                        "name": name,
                        "title": name,
                        "college": college,
                        "department": department,
                        "rank": "",
                        "type": "",
                        "naming": "official-roster-sync",
                        "labs": "",
                        "fields": "",
                        "keywords": "",
                        "profile": link["url"],
                        "homepage": "",
                        "photo": "",
                        "departmentUrl": result["url"],
                        "guidance": "공식 서울대학교 명단에서 확인된 교수",
                    }

    combined = {"|".join(str(u.get(k, "")).strip() for k in ("college", "department", "name")): dict(u) for u in units}
    added = []
    for key, item in new_items.items():
        if "|" not in key:
            continue
        combined[key] = item
        added.append({"id": item["id"], "name": item["name"], "college": item["college"], "department": item["department"], "source": item["departmentUrl"]})

    previous = {}
    if STATE.exists():
        try:
            previous = json.loads(STATE.read_text(encoding="utf-8"))
        except Exception:
            previous = {}
    old_absent = previous.get("absent_streak", {})
    new_absent: dict[str, int] = {}
    removed = []
    final = []
    successful_source_urls = {item["url"] for item in successful}

    for key, unit in combined.items():
        college = str(unit.get("college", ""))
        department = str(unit.get("department", ""))
        name = str(unit.get("name", "")).strip()
        relevant_sources = [url for url, scopes in source_map.items() if url in successful_source_urls and any(
            (c == college and d == department) or (c == college and not department) or (not college and not department)
            for c, d in scopes
        )]
        observed_any = any(name in source_observations.get(scope, set()) for scope in source_map.get(relevant_sources[0], set())) if relevant_sources else (name in global_observed_names and not college and not department)
        # Also preserve a unit if its own official profile still works and does
        # not say former/retired. This protects cross-listed faculty that do not
        # appear on every department page.
        profile = clean_url(unit.get("profile"))
        explicit_former = False
        profile_ok = False
        if profile and allowed(profile):
            try:
                _, profile_html = fetch(profile)
                profile_ok = bool(profile_html)
                explicit_former = bool(FORMER_RE.search(re.sub(r"\s+", " ", profile_html)))
            except Exception:
                profile_ok = False

        if observed_any or (profile_ok and not explicit_former):
            unit["roster_last_confirmed"] = now()
            new_absent[str(unit.get("id"))] = 0
            final.append(unit)
            continue
        if explicit_former:
            removed.append({"id": unit.get("id"), "name": name, "reason": "explicit_former_status"})
            continue
        streak = int(old_absent.get(str(unit.get("id")), 0)) + 1
        new_absent[str(unit.get("id"))] = streak
        # A single absence is never enough. This is deliberately conservative.
        if streak >= 2 and relevant_sources:
            removed.append({"id": unit.get("id"), "name": name, "reason": "absent_from_union_for_two_successful_syncs"})
            continue
        final.append(unit)

    final.sort(key=lambda item: str(item.get("id", "")))
    write_chunks(final)
    state = {
        "version": 2,
        "updated_at": now(),
        "sources_checked": scanned,
        "successful_source_count": len(successful),
        "source_count": len(source_urls),
        "unit_count_before": len(units),
        "unit_count_after": len(final),
        "added": added,
        "removed": removed,
        "absent_streak": new_absent,
        "policy": "UNION: professor present in any trusted successful official source is kept; removal needs explicit former signal or two consecutive all-source absences.",
    }
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"before": len(units), "after": len(final), "added": len(added), "removed": len(removed), "successful_sources": len(successful)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
