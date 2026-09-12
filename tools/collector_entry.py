#!/usr/bin/env python3
"""Stable entrypoint and quality gate for the SNU Lab Navigator collector."""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

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
        for path in chunks:
            text = path.read_text(encoding="utf-8")
            # Roster sync may emit every chunk as push(...), including units-001.js.
            match = re.search(
                r"window\.RESEARCH_UNITS(?:\s*=\s*|\.push\(\.\.\.)(\[.*\])\)?\s*;\s*$",
                text,
                re.S,
            )
            if not match:
                raise RuntimeError(f"Cannot parse research-unit chunk {path.name}")
            units.extend(json.loads(match.group(1)))
    supplement_path = collector.DIST / "roster-supplements.js"
    supplements = collector.js(supplement_path, "RESEARCH_UNIT_SUPPLEMENTS") if supplement_path.exists() else []
    merged = {}
    for item in [*units, *supplements]:
        key = "|".join(str(item.get(k, "")).strip() for k in ("college", "department", "name"))
        merged[key] = item
    return list(merged.values())


collector.load_units = load_units_compatible


def now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clean_url(value):
    value = str(value or "")
    match = re.search(r"https?://[^\s;,|]+", value)
    return match.group(0).rstrip(").]}") if match else ""


def allowed(url, unit):
    host = (urlparse(url).hostname or "").lower()
    if not host:
        return False
    official = host == "snu.ac.kr" or host.endswith(".snu.ac.kr") or host == "snu.elsevierpure.com"
    supplied = {
        (urlparse(clean_url(unit.get(k))).hostname or "").lower()
        for k in ("homepage", "profile", "departmentUrl")
        if clean_url(unit.get(k))
    }
    return official or host in supplied


def http_json(url, key, payload, timeout=60):
    request = Request(url, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                      headers={"x-goog-api-key": key, "content-type": "application/json"}, method="POST")
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def model_for(key):
    request = Request("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100",
                      headers={"x-goog-api-key": key})
    with urlopen(request, timeout=12) as response:
        payload = json.loads(response.read().decode("utf-8"))
    usable = [str(item.get("name", "")).removeprefix("models/")
              for item in payload.get("models", [])
              if "generateContent" in item.get("supportedGenerationMethods", [])
              and "flash-lite" in str(item.get("name", "")).lower()]
    if not usable:
        raise RuntimeError("No generateContent Flash-Lite model is available")
    return next((name for name in usable if name.startswith("gemini-3.1-flash-lite")), usable[0])


def parse_json_candidate(payload):
    parts = payload.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "".join(str(part.get("text", "")) for part in parts).strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.I).strip()
    data = json.loads(text or "{}")
    return data if isinstance(data, dict) else {}


def sanitize_items(items, unit, fields):
    out = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        url = clean_url(item.get("url"))
        title = str(item.get("title", "")).strip()
        if url and not allowed(url, unit):
            url = ""
        if not title and not url:
            continue
        row = {"title": title[:450]}
        if url:
            row["url"] = url
        for field in fields:
            value = str(item.get(field, "")).strip()
            if value:
                row[field] = value[:180]
        out.append(row)
    seen = set(); deduped = []
    for row in out:
        key = re.sub(r"[^a-z0-9가-힣]", "", row.get("title", "").lower())
        if key in seen: continue
        seen.add(key); deduped.append(row)
    return deduped


def clean_people(items):
    out = []; seen = set()
    for item in items or []:
        if not isinstance(item, dict): continue
        name = str(item.get("name", "")).strip(); role = str(item.get("role", "")).strip()
        url = clean_url(item.get("url"))
        if not name or not role: continue
        key = re.sub(r"\s+", "", name).lower()
        if key in seen: continue
        seen.add(key)
        row = {"name": name[:120], "role": role[:120]}
        if url: row["url"] = url
        out.append(row)
    return out[:80]


def recommendation_keywords(result):
    values = []
    for value in (result.get("recommendation_keywords") or []) + (result.get("research_topics") or []):
        value = re.sub(r"\s+", " ", str(value)).strip()
        if 2 <= len(value) <= 100: values.append(value)
    seen = set(); out = []
    for value in values:
        key = re.sub(r"[^a-z0-9가-힣]", "", value.lower())
        if key and key not in seen: seen.add(key); out.append(value)
    return out[:24]


def is_rate_limit_error(exc):
    message = str(exc).upper()
    return getattr(exc, "code", None) == 429 or "429" in message or "RESOURCE_EXHAUSTED" in message


def verify_with_gemini(key, model, unit, raw_record, budget):
    if not key or not model or not budget.claim():
        return dict(raw_record.get("enrichment") or {}), None
    activity = raw_record.get("activity") or {}
    source_urls = list(dict.fromkeys(
        [clean_url(u) for u in activity.get("sourcePagesScanned", []) if clean_url(u)]
        + [clean_url(x.get("url")) for x in activity.get("publicationPages", []) if clean_url(x.get("url"))]
        + [clean_url(x.get("url")) for x in activity.get("recruitmentPages", []) if clean_url(x.get("url"))]
        + ([clean_url(activity.get("membersUrl"))] if clean_url(activity.get("membersUrl")) else [])
    ))[:24]
    poster_candidates = []
    for item in activity.get("posterCandidates", [])[:12]:
        if not isinstance(item, dict): continue
        text = " ".join(str(item.get(k, "")) for k in ("url", "alt", "title")).lower()
        if any(token in text for token in ("icon", "logo", "btn-", "avatar", "profile", "facebook", "twitter", "kakao", "youtube")): continue
        poster_candidates.append(item)
    source_urls += [clean_url(x.get("url")) for x in poster_candidates if clean_url(x.get("url"))]
    source_urls = list(dict.fromkeys([u for u in source_urls if allowed(u, unit)]))[:30]
    prompt = {
        "task": "Verify and extract facts for this specific SNU professor/lab. Use supplied official URLs as evidence.",
        "today_kst": datetime.now().astimezone().strftime("%Y-%m-%d"),
        "unit": {k: unit.get(k, "") for k in ("id", "name", "college", "department", "labs", "fields", "keywords")},
        "candidate_urls": source_urls,
        "raw_candidates": {"publication_pages": activity.get("publicationPages", [])[:6], "recruitment_pages": activity.get("recruitmentPages", [])[:6], "member_url": activity.get("membersUrl", ""), "poster_assets": poster_candidates},
        "rules": [
            "No inference. Every reported fact must be supported by an inspected official URL.",
            "Publication verification: accept direct lab/professor publication lists or a paper page explicitly attributable to this professor/lab. Reject generic SNU/department research-highlights, press/news, other professors' awards, and unrelated thesis/admission pages.",
            "Recruitment verification: accept current lab/team recruitment for this professor/lab. Reject university/department graduate admissions, general hiring, course registration, scholarships, dormitory, student-support, and generic entrance portals.",
            "Members: only explicit named people from the professor/lab member page. Classify current people as PhD, Master, Undergraduate, or Other from the stated role. Put former members separately as Alumni.",
            "Poster verification: a professor portrait, logo, icon, social-share image, or generic site image is never a poster. Verify only an actual research poster clearly attributable to this professor/lab. If attribution is unclear, use unverified_candidate rather than verified.",
            "Research topics and recommendation keywords may be summarized from the verified research description, but must not introduce unsupported topics.",
            "For each recent paper, write one Korean sentence of at most 120 characters only when its official title, abstract, or page supports that summary; otherwise return an empty summary.",
            "For music, extract only explicitly supported recent performances, creative works, and concise education activity. Do not extract awards.",
            "For fine arts, extract solo/group exhibitions only if their official date is within the last 12 months. Do not extract awards.",
            "For humanities, distinguish papers, books, conference presentations, and research projects.",
        ],
        "output_schema": {
            "research_summary": "string", "research_topics": ["string"], "recommendation_keywords": ["string"],
            "recent_papers": [{"title": "string", "year": "string", "venue": "string", "summary": "string", "url": "string"}],
            "books": [{"title": "string", "year": "string", "venue": "string", "url": "string"}],
            "conference_presentations": [{"title": "string", "date": "string", "venue": "string", "url": "string"}],
            "research_projects": [{"title": "string", "date": "string", "organization": "string", "url": "string"}],
            "recent_performances": [{"title": "string", "date": "string", "venue": "string", "url": "string"}],
            "creative_works": [{"title": "string", "year": "string", "venue": "string", "url": "string"}],
            "recent_solo_exhibitions": [{"title": "string", "date": "string", "venue": "string", "url": "string"}],
            "recent_group_exhibitions": [{"title": "string", "date": "string", "venue": "string", "url": "string"}],
            "education_summary": "string",
            "verified_publication_pages": [{"title": "string", "url": "string"}],
            "recruitment_summary": "string", "verified_recruitment_pages": [{"title": "string", "url": "string"}],
            "recruitment_source_url": "string", "current_members": [{"name": "string", "role": "string", "url": "string"}],
            "alumni": [{"name": "string", "role": "string", "url": "string"}], "member_page_url": "string",
            "poster_status": "verified | unverified_candidate | none_detected | inaccessible", "poster_title": "string", "poster_date": "string", "poster_event": "string", "poster_image_url": "string", "poster_source_url": "string", "poster_evidence": "string", "source_urls_used": ["string"],
        },
    }
    payload = {"contents": [{"role": "user", "parts": [{"text": json.dumps(prompt, ensure_ascii=False)}]}], "tools": [{"url_context": {}}], "generationConfig": {"temperature": 0, "responseMimeType": "application/json", "maxOutputTokens": 4200}}
    try:
        response = http_json(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent", key, payload, 75)
        result = parse_json_candidate(response)
        result["recent_papers"] = sanitize_items(result.get("recent_papers"), unit, ["year", "venue", "summary"])[:3]
        for item in result["recent_papers"]:
            item["summary"] = str(item.get("summary", "")).strip()[:120]
        result["books"] = sanitize_items(result.get("books"), unit, ["year", "venue"])[:3]
        result["conference_presentations"] = sanitize_items(result.get("conference_presentations"), unit, ["date", "venue"])[:3]
        result["research_projects"] = sanitize_items(result.get("research_projects"), unit, ["date", "organization"])[:3]
        result["recent_performances"] = sanitize_items(result.get("recent_performances"), unit, ["date", "venue"])[:3]
        result["creative_works"] = sanitize_items(result.get("creative_works"), unit, ["year", "venue"])[:3]
        result["recent_solo_exhibitions"] = sanitize_items(result.get("recent_solo_exhibitions"), unit, ["date", "venue"])[:3]
        result["recent_group_exhibitions"] = sanitize_items(result.get("recent_group_exhibitions"), unit, ["date", "venue"])[:3]
        result["education_summary"] = str(result.get("education_summary", "")).strip()[:500]
        result["verified_publication_pages"] = sanitize_items(result.get("verified_publication_pages"), unit, [])[:6]
        result["verified_recruitment_pages"] = sanitize_items(result.get("verified_recruitment_pages"), unit, [])[:4]
        source = clean_url(result.get("recruitment_source_url")); result["recruitment_source_url"] = source if source and allowed(source, unit) else ""
        member_url = clean_url(result.get("member_page_url")); result["member_page_url"] = member_url if member_url and allowed(member_url, unit) else ""
        result["current_members"] = clean_people(result.get("current_members")); result["alumni"] = clean_people(result.get("alumni")); result["recommendation_keywords"] = recommendation_keywords(result)
        result["paper_count_visible"] = len(result["recent_papers"])
        result["paper_count_scope"] = "AI가 공식 페이지에서 직접 확인한 논문 제목"
        result["poster_status"] = str(result.get("poster_status", "none_detected")).lower()
        if result["poster_status"] not in {"verified", "unverified_candidate", "none_detected", "inaccessible"}: result["poster_status"] = "unverified_candidate" if poster_candidates else "none_detected"
        poster_image = clean_url(result.get("poster_image_url")); unit_photo = clean_url(unit.get("photo"))
        if result["poster_status"] == "verified" and (not poster_image or poster_image == unit_photo): result["poster_status"] = "unverified_candidate" if poster_candidates else "none_detected"
        if result["poster_status"] != "verified":
            for field in ("poster_title", "poster_date", "poster_event", "poster_image_url", "poster_source_url", "poster_evidence"): result[field] = ""
        else:
            result["poster_image_url"] = poster_image
            source_url = clean_url(result.get("poster_source_url")); result["poster_source_url"] = source_url if source_url and allowed(source_url, unit) else poster_image
        result["source_urls_used"] = list(dict.fromkeys([clean_url(x) for x in (result.get("source_urls_used") or []) if clean_url(x) and allowed(clean_url(x), unit)] + source_urls))[:30]
        result["_unit_id"] = str(unit.get("id", "")); result["_model"] = model; result["_saved_at"] = now(); result["_batch_saved"] = True; result["_quality_gate"] = "ai_verified_v2_compact_detail"
        return result, None
    except Exception as exc:
        budget.used = max(0, budget.used - 1)
        if is_rate_limit_error(exc):
            with budget.lock:
                budget.disabled = "rate_limited"
            return {}, "gemini_rate_limited"
        return {}, f"verify_{type(exc).__name__}"


def append_output_metadata(units, state, checked, mode, ai_used):
    output = collector.OUT
    text = output.read_text(encoding="utf-8") if output.exists() else ""
    trusted = {uid: record for uid, record in state.get("records", {}).items() if record.get("_unit_id") == uid}
    sid, score, why = collector.showcase(units, trusted)
    meta = {"updated_at": now(), "checked_units": len(state.get("records", {})), "enriched_units": sum(1 for r in state.get("records", {}).values() if r.get("enrichment", {}).get("_unit_id")), "checked_this_run": checked, "cursor": state.get("cursor", 0), "mode": mode, "ai_requests_this_run": ai_used, "showcase_unit_id": sid, "showcase_score": score, "showcase_reason": why, "collector_version": "2.2", "detail_schema": "compact_detail_v2", "quality_gate": "future_completion_order_safe + ai_activity_verification", "poster_policy": "verified_only_for_public_display", "snapshot_status": "in_progress", "validated_at": ""}
    lines = text.splitlines()
    first = "window.AUTOMATION_META=" + json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + ";"
    if lines and lines[0].startswith("window.AUTOMATION_META="): lines[0] = first
    else: lines.insert(0, first)
    output.write_text("\n".join(lines) + "\n", encoding="utf-8")


def publish_live_progress():
    """Publish only the tiny progress file during a GitHub Actions run."""
    if os.getenv("PUBLISH_PROGRESS") != "1":
        return
    try:
        subprocess.run(["git", "add", "data/automation-progress.json"], cwd=ROOT, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        staged = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if staged.returncode == 0:
            return
        subprocess.run(["git", "commit", "-m", "Update live collection progress"], cwd=ROOT, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(["git", "push"], cwd=ROOT, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as exc:
        print(f"Live progress publish skipped: {type(exc).__name__}", flush=True)


def write_live_progress(units, state, checked, target, mode, done=False, paused=False, ai_status="ready"):
    path = ROOT / "data" / "automation-progress.json"
    total = len(units)
    enriched = sum(1 for r in state.get("records", {}).values() if r.get("enrichment", {}).get("_unit_id"))
    status = "completed" if done else ("paused" if paused else ("running" if checked > 0 else "starting"))
    payload = {
        "status": status,
        "checked": int(min(checked, total)),
        "target": int(target),
        "total": int(total),
        "enriched": int(enriched),
        "updated_at": now(),
        "mode": mode,
        "ai_status": ai_status,
        "message": ("Gemini 호출 한도 도달 · 다음 5시간 주기에 재개" if ai_status == "rate_limited" else f"{min(checked,total):,} / {total:,}개 소속 단위 확인")
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-units", type=int, default=int(os.getenv("MAX_UNITS", "80")))
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--batch-size", type=int, default=int(os.getenv("BATCH_SIZE", "40")))
    parser.add_argument("--time-budget-minutes", type=float, default=float(os.getenv("TIME_BUDGET_MINUTES", "0")))
    parser.add_argument("--max-ai-requests", type=int, default=int(os.getenv("MAX_AI_REQUESTS", "100000")))
    args = parser.parse_args()
    units = load_units_compatible(); state = collector.load_state(); state.setdefault("records", {}); state.setdefault("failures", {})
    if not units: raise RuntimeError("No research units found")
    key = os.getenv("GEMINI_API_KEY", "").strip(); model = ""
    if key:
        try: model = model_for(key)
        except Exception as exc: print(f"Gemini disabled: {exc}", flush=True)
    budget = collector.Budget(args.max_ai_requests if model else 0); started = time.monotonic(); deadline = started + args.time_budget_minutes * 60 if args.time_budget_minutes else None; target = min(max(0, args.max_units), len(units)); checked = 0
    write_live_progress(units, state, 0, target, "gemini-url-context-verified" if model else "collector-only", ai_status="ready" if model else "unavailable")
    publish_live_progress()
    while checked < target:
        if deadline and time.monotonic() >= deadline - 30: print("Time budget reached; saving resumable progress.", flush=True); break
        cursor = int(state.get("cursor", 0)) % len(units); batch = [units[(cursor + i) % len(units)] for i in range(min(max(1, args.batch_size), target - checked))]
        future_to_unit = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(args.workers, 8))) as pool:
            for unit in batch:
                uid = str(unit.get("id", "")); previous = state["records"].get(uid, {}); future_to_unit[pool.submit(collector.scan, unit, "", "", previous, collector.Budget(0))] = unit
            for index, future in enumerate(concurrent.futures.as_completed(future_to_unit), 1):
                unit = future_to_unit[future]; uid = str(unit.get("id", ""))
                try:
                    raw, error = future.result()
                    if raw:
                        previous = state["records"].get(uid, {})
                        existing = raw.get("enrichment") or {}
                        needs_ai = (
                            previous.get("fingerprint") != raw.get("fingerprint")
                            or existing.get("_quality_gate") != "ai_verified_v2_compact_detail"
                        )
                        enrichment, verify_error = (verify_with_gemini(key, model, unit, raw, budget) if needs_ai else (existing, None))
                        raw["_unit_id"] = uid
                        if enrichment:
                            raw["enrichment"] = enrichment; raw["activity"]["publicationPages"] = enrichment.get("verified_publication_pages", []); raw["activity"]["recruitmentPages"] = enrichment.get("verified_recruitment_pages", []); raw["activity"]["membersUrl"] = enrichment.get("member_page_url", ""); raw["activity"]["posterStatus"] = enrichment.get("poster_status", "none_detected"); raw["activity"].pop("posterCandidates", None)
                        if verify_error: raw["verify_error"] = verify_error
                        state["records"][uid] = raw; state["failures"].pop(uid, None); print(f"[{checked + index}/{target}] {uid}: ok", flush=True)
                    else:
                        state["failures"][uid] = {"reason": error or "fetch_failed", "checked_at": now()}; print(f"[{checked + index}/{target}] {uid}: {error or 'fetch_failed'}", flush=True)
                except Exception as exc:
                    state["failures"][uid] = {"reason": type(exc).__name__, "checked_at": now()}; print(f"[{checked + index}/{target}] {uid}: {type(exc).__name__}", flush=True)
        checked += len(batch); state["cursor"] = (cursor + len(batch)) % len(units)
        state["last_run"] = {"at": now(), "checked": checked, "seconds": round(time.monotonic() - started, 2), "gemini": bool(model), "ai_requests": budget.used, "completed_full_pass": checked >= len(units)}
        collector.write(state, units, checked, "gemini-url-context-verified" if model else "collector-only", budget.used); append_output_metadata(units, state, checked, "gemini-url-context-verified" if model else "collector-only", budget.used)
        write_live_progress(units, state, checked, target, "gemini-url-context-verified" if model else "collector-only", ai_status=(getattr(budget, "disabled", "") or ("ready" if model else "unavailable")))
        if checked % max(1, int(os.getenv("PROGRESS_PUBLISH_EVERY", "80"))) == 0:
            publish_live_progress()
    if checked == 0:
        collector.write(state, units, 0, "gemini-url-context-verified" if model else "collector-only", budget.used); append_output_metadata(units, state, 0, "gemini-url-context-verified" if model else "collector-only", budget.used)
    write_live_progress(units, state, checked, target, "gemini-url-context-verified" if model else "collector-only", done=(checked >= target), paused=(checked < target), ai_status=(getattr(budget, "disabled", "") or ("ready" if model else "unavailable")))
    publish_live_progress()
    print(json.dumps(state.get("last_run", {}), ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
