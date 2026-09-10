#!/usr/bin/env python3
"""Incrementally refresh SNU lab detail data from official sources.

The job is intentionally bounded: every run advances a cursor instead of trying to
crawl the whole university in one process. Facts are published only when supported
by an official/affiliated URL. Gemini is optional and only summarizes fetched text.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
STATE_PATH = ROOT / "data" / "automation-state.json"
OUTPUT_PATH = DIST / "automation-data.js"
UA = "SNU-Lab-Navigator/1.0 (+academic prototype; respectful incremental monitor)"
TIMEOUT = (5, 12)
MAX_TEXT = 18_000

PAGE_KINDS = {
    "publication": ("publication", "publications", "paper", "papers", "논문", "연구성과", "업적"),
    "member": ("member", "people", "student", "구성원", "연구원", "학생", "alumni", "졸업생"),
    "recruitment": ("recruit", "join", "opening", "position", "모집", "채용"),
    "poster": ("poster", "포스터"),
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_js_json(path: Path, variable: str) -> Any:
    text = path.read_text(encoding="utf-8")
    match = re.search(rf"window\.{re.escape(variable)}\s*=\s*(.+?)\s*;\s*$", text, re.S)
    if not match:
        raise RuntimeError(f"Cannot parse {variable} from {path}")
    return json.loads(match.group(1))


def load_units() -> list[dict[str, Any]]:
    if (DIST / "data.js").exists():
        units = read_js_json(DIST / "data.js", "RESEARCH_UNITS")
    else:
        units = []
        for index, path in enumerate(sorted((DIST / "data").glob("units-*.js"))):
            text = path.read_text(encoding="utf-8")
            pattern = r"window\.RESEARCH_UNITS\s*=\s*(.+?)\s*;\s*$" if index == 0 else r"window\.RESEARCH_UNITS\.push\(\.\.\.(.+?)\);\s*$"
            match = re.search(pattern, text, re.S)
            if not match:
                raise RuntimeError(f"Cannot parse research-unit chunk {path}")
            units.extend(json.loads(match.group(1)))
    supplements = read_js_json(DIST / "roster-supplements.js", "RESEARCH_UNIT_SUPPLEMENTS")
    merged: dict[str, dict[str, Any]] = {}
    for item in [*units, *supplements]:
        key = "|".join(str(item.get(k, "")).strip() for k in ("college", "department", "name"))
        merged[key] = item
    return sorted(merged.values(), key=lambda x: str(x.get("id", "")))


def load_state() -> dict[str, Any]:
    if not STATE_PATH.exists():
        return {"cursor": 0, "records": {}, "failures": {}}
    try:
        value = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {"cursor": 0, "records": {}, "failures": {}}
    except (OSError, json.JSONDecodeError):
        return {"cursor": 0, "records": {}, "failures": {}}


def clean_url(value: Any) -> str:
    match = re.search(r"https?://[^\s;,|]+", str(value or ""))
    return match.group(0).rstrip(").]}") if match else ""


def allowed_source(url: str, unit: dict[str, Any]) -> bool:
    host = (urlparse(url).hostname or "").lower()
    if not host:
        return False
    official = host == "snu.ac.kr" or host.endswith(".snu.ac.kr") or host == "snu.elsevierpure.com"
    supplied_hosts = {
        (urlparse(clean_url(unit.get(field))).hostname or "").lower()
        for field in ("homepage", "profile", "departmentUrl")
        if clean_url(unit.get(field))
    }
    return official or host in supplied_hosts


def get(url: str) -> tuple[str, str]:
    request = Request(url, headers={"User-Agent": UA})
    with urlopen(request, timeout=TIMEOUT[1]) as response:
        content_type = response.headers.get("content-type", "").lower()
        final_url = response.geturl()
        body = response.read(1_500_000)
    if "text/html" not in content_type and "text/plain" not in content_type:
        return final_url, ""
    charset = "utf-8"
    match = re.search(r"charset=([^;\s]+)", content_type)
    if match:
        charset = match.group(1).strip("\"'")
    try:
        source = body.decode(charset, errors="replace")
    except LookupError:
        source = body.decode("utf-8", errors="replace")
    return final_url, source


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.text: list[str] = []
        self.links: list[tuple[str, str]] = []
        self.anchor_href = ""
        self.anchor_text: list[str] = []
        self.capture_tag = ""
        self.capture_text: list[str] = []
        self.candidates: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in {"script", "style", "noscript", "svg"}:
            self.skip += 1
            return
        if self.skip:
            return
        values = dict(attrs)
        if tag == "a":
            self.anchor_href = values.get("href") or ""
            self.anchor_text = []
        if tag in {"h1", "h2", "h3", "li"}:
            self.capture_tag = tag
            self.capture_text = []

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in {"script", "style", "noscript", "svg"} and self.skip:
            self.skip -= 1
            return
        if self.skip:
            return
        if tag == "a" and self.anchor_href:
            self.links.append((" ".join(self.anchor_text).strip(), self.anchor_href))
            self.anchor_href = ""
            self.anchor_text = []
        if tag == self.capture_tag:
            value = re.sub(r"\s+", " ", " ".join(self.capture_text)).strip()
            if 18 <= len(value) <= 240 and value not in self.candidates:
                self.candidates.append(value)
            self.capture_tag = ""
            self.capture_text = []

    def handle_data(self, data: str) -> None:
        if self.skip:
            return
        value = data.strip()
        if not value:
            return
        self.text.append(value)
        if self.anchor_href:
            self.anchor_text.append(value)
        if self.capture_tag:
            self.capture_text.append(value)


def parse_page(source: str) -> PageParser:
    parser = PageParser()
    parser.feed(source)
    return parser


def classify_links(base_url: str, page: PageParser, unit: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    found = {kind: [] for kind in PAGE_KINDS}
    seen: set[tuple[str, str]] = set()
    for raw_label, href in page.links:
        label = re.sub(r"\s+", " ", raw_label).strip()
        url = urljoin(base_url, href)
        haystack = f"{label} {url}".lower()
        if not allowed_source(url, unit):
            continue
        for kind, words in PAGE_KINDS.items():
            if any(word in haystack for word in words) and (kind, url) not in seen:
                found[kind].append({"title": label or kind, "url": url})
                seen.add((kind, url))
    return {kind: rows[:3] for kind, rows in found.items()}


def title_candidates(page: PageParser, limit: int = 8) -> list[str]:
    return page.candidates[:limit]


def http_json(url: str, *, headers: dict[str, str], payload: dict[str, Any] | None = None, timeout: int = 45) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    request = Request(url, data=body, headers=headers, method="POST" if body is not None else "GET")
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def choose_gemini_model(key: str) -> str:
    listing = http_json(
        "https://generativelanguage.googleapis.com/v1beta/models?pageSize=100",
        headers={"x-goog-api-key": key}, timeout=12,
    )
    usable = []
    for item in listing.get("models", []):
        name = str(item.get("name", "")).removeprefix("models/")
        if "generateContent" in item.get("supportedGenerationMethods", []) and "flash-lite" in name.lower():
            usable.append(name)
    if not usable:
        raise RuntimeError("No generateContent Flash-Lite model is available for this key")
    return usable[0]


def gemini_summary(key: str, model: str, unit: dict[str, Any], pages: list[dict[str, str]]) -> dict[str, Any]:
    evidence = [{"url": p["url"], "text": p["text"][:9_000]} for p in pages if p.get("text")]
    if not evidence:
        return {}
    prompt = {
        "task": "공식 페이지 근거만 사용해 연구실 상세정보를 한국어 JSON으로 추출",
        "rules": [
            "보이지 않는 사실은 추정하지 말 것", "논문 수는 제공된 텍스트에서 제목이 명확한 항목만 셀 것",
            "구성원은 이름과 역할이 명시된 경우만 포함", "모집은 현재 모집임이 명시된 경우만 포함",
        ],
        "unit": {k: unit.get(k, "") for k in ("name", "college", "department", "labs", "fields")},
        "official_pages": evidence,
        "schema": {
            "research_summary": "string", "research_topics": ["string"],
            "recent_papers": [{"title": "string", "year": "string", "url": "string", "venue": "string"}],
            "recruitment_summary": "string", "current_members": [{"name": "string", "role": "string"}],
            "alumni": [{"name": "string", "role": "string"}],
        },
    }
    response = http_json(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        headers={"x-goog-api-key": key, "content-type": "application/json"}, timeout=45,
        payload={
            "contents": [{"role": "user", "parts": [{"text": json.dumps(prompt, ensure_ascii=False)}]}],
            "generationConfig": {"temperature": 0, "responseMimeType": "application/json", "maxOutputTokens": 3000},
        },
    )
    text = "".join(part.get("text", "") for part in response.get("candidates", [{}])[0].get("content", {}).get("parts", []))
    result = json.loads(re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.I).strip())
    if not isinstance(result, dict):
        return {}
    result["source_urls_used"] = [p["url"] for p in pages]
    result["paper_count_visible"] = len(result.get("recent_papers") or [])
    result["paper_count_scope"] = "이번 자동 수집에서 공식 페이지 텍스트로 제목이 확인된 항목"
    result["_model"] = model
    result["_saved_at"] = utc_now()
    result["_batch_saved"] = True
    return result


@dataclass
class ScanResult:
    unit_id: str
    record: dict[str, Any] | None
    error: str = ""


def scan_unit(unit: dict[str, Any], api_key: str, model: str, previous: dict[str, Any]) -> ScanResult:
    unit_id = str(unit.get("id", ""))
    roots = []
    for field in ("homepage", "profile", "departmentUrl"):
        url = clean_url(unit.get(field))
        if url and url not in roots and allowed_source(url, unit):
            roots.append(url)
    if not roots:
        return ScanResult(unit_id, None, "no_official_url")
    pages: list[dict[str, str]] = []
    links = {kind: [] for kind in PAGE_KINDS}
    for root in roots[:2]:
        try:
            final_url, source = get(root)
            if not source:
                continue
            page = parse_page(source)
            pages.append({"url": final_url, "text": re.sub(r"\s+", " ", " ".join(page.text)).strip()[:MAX_TEXT]})
            discovered = classify_links(final_url, page, unit)
            for kind in PAGE_KINDS:
                links[kind].extend(discovered[kind])
        except Exception:
            continue
    extra = []
    for kind in ("publication", "member", "recruitment", "poster"):
        extra.extend(links[kind][:1])
    for item in extra[:3]:
        if any(p["url"] == item["url"] for p in pages):
            continue
        try:
            final_url, source = get(item["url"])
            if source:
                page = parse_page(source)
                pages.append({"url": final_url, "text": re.sub(r"\s+", " ", " ".join(page.text)).strip()[:MAX_TEXT]})
                if item in links["publication"]:
                    item["titles"] = title_candidates(page)
        except Exception:
            continue
    if not pages:
        return ScanResult(unit_id, None, "fetch_failed")
    fingerprint = hashlib.sha256("\n".join(p["url"] + "\n" + p["text"] for p in pages).encode()).hexdigest()
    if previous.get("fingerprint") == fingerprint and previous.get("enrichment"):
        enrichment = previous["enrichment"]
    elif api_key and model:
        enrichment = gemini_summary(api_key, model, unit, pages)
    elif previous.get("enrichment"):
        enrichment = dict(previous["enrichment"])
        enrichment["_stale"] = True
    else:
        enrichment = {}
    record = {
        "fingerprint": fingerprint,
        "checked_at": utc_now(),
        "activity": {
            "publicationPages": [{"title": item["title"], "url": item["url"]} for item in links["publication"][:3]],
            "recruitmentPages": [{"title": item["title"], "url": item["url"]} for item in links["recruitment"][:2]],
            "membersUrl": (links["member"][0]["url"] if links["member"] else ""),
            "posterStatus": "공식 페이지에서 연구실 귀속 포스터를 자동 확인하지 못했습니다.",
        },
        "enrichment": enrichment,
    }
    return ScanResult(unit_id, record)


def write_outputs(state: dict[str, Any], checked_this_run: int, mode: str) -> None:
    activity = {}
    enrichment = {}
    for unit_id, record in state.get("records", {}).items():
        if record.get("activity"):
            activity[unit_id] = record["activity"]
        if record.get("enrichment"):
            enrichment[unit_id] = record["enrichment"]
    meta = {
        "updated_at": utc_now(), "checked_units": len(state.get("records", {})),
        "enriched_units": len(enrichment), "checked_this_run": checked_this_run,
        "cursor": state.get("cursor", 0), "mode": mode,
    }
    payload = (
        "window.AUTOMATION_META = " + json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + ";\n"
        "window.RESEARCH_ACTIVITY = Object.assign(window.RESEARCH_ACTIVITY || {}, "
        + json.dumps(activity, ensure_ascii=False, separators=(",", ":")) + ");\n"
        "window.PRECOMPUTED_ENRICHMENT = Object.assign(window.PRECOMPUTED_ENRICHMENT || {}, "
        + json.dumps(enrichment, ensure_ascii=False, separators=(",", ":")) + ");\n"
    )
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUTPUT_PATH.write_text(payload, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-units", type=int, default=int(os.getenv("MAX_UNITS", "80")))
    parser.add_argument("--workers", type=int, default=6)
    args = parser.parse_args()
    units = load_units()
    state = load_state()
    cursor = int(state.get("cursor", 0)) % max(1, len(units))
    batch = [units[(cursor + i) % len(units)] for i in range(min(args.max_units, len(units)))]
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model = ""
    if api_key:
        try:
            model = choose_gemini_model(api_key)
        except Exception as exc:
            print(f"Gemini disabled for this run: {exc}", flush=True)
    started = time.monotonic()
    results: list[ScanResult] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(args.workers, 8))) as pool:
        futures = [
            pool.submit(scan_unit, unit, api_key, model, state.get("records", {}).get(str(unit.get("id", "")), {}))
            for unit in batch
        ]
        for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
            try:
                result = future.result()
            except Exception as exc:
                result = ScanResult("unknown", None, type(exc).__name__)
            results.append(result)
            print(f"[{index}/{len(batch)}] {result.unit_id}: {'ok' if result.record else result.error}", flush=True)
    state.setdefault("records", {})
    state.setdefault("failures", {})
    for result in results:
        if result.record:
            previous = state["records"].get(result.unit_id, {})
            if previous.get("fingerprint") == result.record.get("fingerprint") and previous.get("enrichment") and not result.record.get("enrichment"):
                result.record["enrichment"] = previous["enrichment"]
            state["records"][result.unit_id] = result.record
            state["failures"].pop(result.unit_id, None)
        elif result.unit_id != "unknown":
            state["failures"][result.unit_id] = {"reason": result.error, "checked_at": utc_now()}
    state["cursor"] = (cursor + len(batch)) % max(1, len(units))
    state["last_run"] = {"at": utc_now(), "checked": len(batch), "seconds": round(time.monotonic() - started, 2), "gemini": bool(model)}
    write_outputs(state, len(batch), "gemini" if model else "collector-only")
    print(json.dumps(state["last_run"], ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
