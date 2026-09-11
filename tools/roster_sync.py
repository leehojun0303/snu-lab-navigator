#!/usr/bin/env python3
"""Synchronize professor units from official SNU directory pages.

Policy: roster sources are a UNION, never an intersection. A professor is kept
when any trusted official source still supports the appointment. Removal is
conservative: absence from one page is not enough; a unit is removed only when
its known official profile/department evidence explicitly indicates a former or
ended appointment, or when it is absent from all tracked official directories
for two consecutive syncs.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
STATE = ROOT / "data" / "roster-sync-state.json"
CHUNKS = DIST / "data"
UA = "SNU-Lab-Navigator-Roster-Sync/1.0"
TIMEOUT = 15
MAX_BODY = 2_000_000
CHUNK_SIZE = 100

FORMER_RE = re.compile(r"(퇴직|명예교수|전임 종료|retired|emeritus|former faculty|former professor|no longer|이직|사직)", re.I)
FACULTY_RE = re.compile(r"(교수|professor|faculty|faculty member)", re.I)
NON_FACULTY_RE = re.compile(r"(학생|student|staff|직원|조교|assistant|연구원|postdoc|박사|석사|학부|동문|alumni)", re.I)


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


def parse_js_chunks() -> list[dict]:
    chunks = sorted(CHUNKS.glob("units-*.js"))
    if not chunks:
        data_js = DIST / "data.js"
        if not data_js.exists():
            return []
        text = data_js.read_text(encoding="utf-8")
        match = re.search(r"window\.RESEARCH_UNITS\s*=\s*(.+?)\s*;\s*$", text, re.S)
        return json.loads(match.group(1)) if match else []
    out = []
    for path in chunks:
        text = path.read_text(encoding="utf-8")
        match = re.search(r"window\.RESEARCH_UNITS(?:\.push\(\.\.\.)?\s*=??\s*(.+?)\s*\)?;\s*$", text, re.S)
        if not match:
            match = re.search(r"window\.RESEARCH_UNITS\.push\(\.\.\.(.+?)\);\s*$", text, re.S)
        if match:
            payload = match.group(1)
            out.extend(json.loads(payload))
    return out


def extract_json_units() -> list[dict]:
    # The chunk syntax is simple enough to parse directly with the patterns
    # emitted by tools/split_static_data.py.
    out = []
    for path in sorted(CHUNKS.glob("units-*.js")):
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


def directory_links(url: str) -> tuple[list[dict], str, bool]:
    try:
        final, html = fetch(url)
        parser = DirectoryParser(final)
        parser.feed(html)
        return parser.links, " ".join(parser.page_text), True
    except Exception:
        return [], "", False


def likely_person(link: dict, context: str) -> bool:
    label = re.sub(r"\s+", " ", str(link.get("text", ""))).strip()
    href = str(link.get("url", ""))
    blob = f"{label} {href}"
    if not FACULTY_RE.search(blob):
        return False
    if NON_FACULTY_RE.search(label) and not re.search(r"\b(professor|prof\.)\b|교수", label, re.I):
        return False
    if not label or len(label) > 120:
        return False
    return allowed(href)


def infer_name(link: dict) -> str:
    text = re.sub(r"\s+", " ", str(link.get("text", ""))).strip()
    text = re.sub(r"\([^)]*\)", " ", text).strip()
    text = re.sub(r"\b(Professor|Prof\.?|Associate Professor|Assistant Professor|Emeritus Professor)\b", " ", text, flags=re.I)
    text = re.sub(r"교수", " ", text)
    return re.sub(r"\s+", " ", text).strip(" -|:")


def normalize_unit(existing: dict) -> dict:
    item = dict(existing)
    item["id"] = item.get("id") or unit_id(str(item.get("college", "")), str(item.get("department", "")), str(item.get("name", "")))
    return item


def save_chunks(units: list[dict]) -> None:
    CHUNKS.mkdir(parents=True, exist_ok=True)
    for old in CHUNKS.glob("units-*.js"):
        old.unlink()
    for index in range(0, len(units), CHUNK_SIZE):
        block = units[index:index + CHUNK_SIZE]
        path = CHUNKS / f"units-{index // CHUNK_SIZE:03d}.js"
        path.write_text(
            "window.RESEARCH_UNITS = " + json.dumps(block, ensure_ascii=False, separators=(",", ":")) + ";\n",
            encoding="utf-8",
        )
    loader = DIST / "data-loader.js"
    tags = "".join(f'<script src="data/units-{i // CHUNK_SIZE:03d}.js"><\\/script>' for i in range(0, len(units), CHUNK_SIZE))
    loader.write_text(f"document.write('{tags}');\n", encoding="utf-8")


def save_state(state: dict) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-pages", type=int, default=100000)
    args = parser.parse_args()

    units = [normalize_unit(x) for x in extract_json_units()]
    if not units:
        raise RuntimeError("No current research units found")

    source_urls = []
    for unit in units:
        url = clean_url(unit.get("departmentUrl"))
        if url and allowed(url):
            source_urls.append(url)
    source_urls = list(dict.fromkeys(source_urls))[:args.max_pages]

    state = {"updated_at": now(), "sources_checked": [], "absent_streak": {}, "added": [], "confirmed": [], "removed": []}
    previous = {}
    if STATE.exists():
        try:
            previous = json.loads(STATE.read_text(encoding="utf-8"))
        except Exception:
            previous = {}
    previous_absent = previous.get("absent_streak", {})

    by_key = {}
    for unit in units:
        key = "|".join(str(unit.get(k, "")).strip() for k in ("college", "department", "name"))
        by_key[key] = unit

    observed_keys = set()
    observed_names_by_department = {}
    for url in source_urls:
        links, page_text, ok = directory_links(url)
        state["sources_checked"].append({"url": url, "ok": ok})
        if not ok:
            continue
        department_match = next((u for u in units if clean_url(u.get("departmentUrl")) == url), None)
        college = str(department_match.get("college", "")) if department_match else ""
        department = str(department_match.get("department", "")) if department_match else ""
        names = observed_names_by_department.setdefault((college, department), set())
        for link in links:
            if not likely_person(link, page_text):
                continue
            name = infer_name(link)
            if len(name) < 2 or len(name) > 80:
                continue
            key = "|".join([college, department, name])
            observed_keys.add(key)
            names.add(name)
            if key not in by_key:
                new_unit = {
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
                    "departmentUrl": url,
                    "guidance": "공식 학과/단과대 명단에서 확인된 교수",
                }
                by_key[key] = new_unit
                state["added"].append({"id": new_unit["id"], "name": name, "department": department, "source": url})

    # Conservative union policy for removals. If a known profile explicitly
    # says former/retired, remove. Otherwise require two consecutive absent
    # syncs from every tracked official directory before removal.
    final = []
    removed_ids = set()
    for key, unit in by_key.items():
        name = str(unit.get("name", ""))
        old_absent = int(previous_absent.get(str(unit.get("id", "")), 0))
        department = str(unit.get("department", ""))
        observed = key in observed_keys or name in observed_names_by_department.get((str(unit.get("college", "")), department), set())
        explicit_former = False
        profile = clean_url(unit.get("profile"))
        if profile and allowed(profile):
            try:
                _, profile_html = fetch(profile)
                explicit_former = bool(FORMER_RE.search(re.sub(r"\s+", " ", profile_html)))
            except Exception:
                explicit_former = False
        if observed:
            unit["roster_last_confirmed"] = now()
            state["confirmed"].append(unit.get("id"))
            state["absent_streak"][str(unit.get("id"))] = 0
        elif explicit_former:
            removed_ids.add(unit.get("id"))
            state["removed"].append({"id": unit.get("id"), "name": name, "reason": "explicit_former_status"})
            continue
        else:
            streak = old_absent + 1
            state["absent_streak"][str(unit.get("id"))] = streak
            # Do not remove on a single failed/missing directory observation.
            if streak >= 2 and profile:
                removed_ids.add(unit.get("id"))
                state["removed"].append({"id": unit.get("id"), "name": name, "reason": "absent_two_consecutive_syncs"})
                continue
        final.append(unit)

    final.sort(key=lambda x: str(x.get("id", "")))
    save_chunks(final)
    state["updated_at"] = now()
    state["unit_count_before"] = len(units)
    state["unit_count_after"] = len(final)
    state["removed_count"] = len(removed_ids)
    save_state(state)
    print(json.dumps({
        "unit_count_before": len(units),
        "unit_count_after": len(final),
        "added": len(state["added"]),
        "removed": len(state["removed"]),
        "sources_checked": len(source_urls),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
