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
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
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
            match = re.search(r"window\.RESEARCH_UNITS(?:\s*=\s*|\.push\(\.\.\.)(\[.*\])\)?\s*;\s*$", text, re.S)
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

def now(): return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

class PacedBudget:
    def __init__(self, limit):
        self.limit=limit; self.used=0; self.disabled=""; self.lock=threading.Lock(); self.last_claim_at=0.0
        self.min_interval_seconds=max(6.5,float(os.getenv("GEMINI_MIN_INTERVAL_SECONDS","8")))
    def claim(self):
        with self.lock:
            if self.disabled or self.used>=self.limit:return False
            wait=self.min_interval_seconds-(time.monotonic()-self.last_claim_at)
            if wait>0:time.sleep(wait)
            self.last_claim_at=time.monotonic();self.used+=1;return True

def clean_url(value):
    value=str(value or "");m=re.search(r"https?://[^\s;,|]+",value);return m.group(0).rstrip(").]}") if m else ""
def allowed(url,unit):
    host=(urlparse(url).hostname or "").lower()
    if not host:return False
    official=host=="snu.ac.kr" or host.endswith(".snu.ac.kr") or host=="snu.elsevierpure.com"
    supplied={(urlparse(clean_url(unit.get(k))).hostname or "").lower() for k in ("homepage","profile","departmentUrl") if clean_url(unit.get(k))}
    return official or host in supplied
def http_json(url,key,payload,timeout=60):
    request=Request(url,data=json.dumps(payload,ensure_ascii=False).encode("utf-8"),headers={"x-goog-api-key":key,"content-type":"application/json"},method="POST")
    with urlopen(request,timeout=timeout) as response:return json.loads(response.read().decode("utf-8"))
def model_for(key):
    request=Request("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100",headers={"x-goog-api-key":key})
    with urlopen(request,timeout=12) as response:payload=json.loads(response.read().decode("utf-8"))
    usable=[str(item.get("name","")).removeprefix("models/") for item in payload.get("models",[]) if "generateContent" in item.get("supportedGenerationMethods",[]) and "flash-lite" in str(item.get("name","")).lower()]
    if not usable:raise RuntimeError("No generateContent Flash-Lite model is available")
    return next((name for name in usable if name.startswith("gemini-3.1-flash-lite")),usable[0])
def parse_json_candidate(payload):
    parts=payload.get("candidates",[{}])[0].get("content",{}).get("parts",[]);text="".join(str(part.get("text","")) for part in parts).strip();text=re.sub(r"^```(?:json)?\s*|\s*```$","",text,flags=re.I).strip();data=json.loads(text or "{}");return data if isinstance(data,dict) else {}
def sanitize_items(items,unit,fields):
    out=[]
    for item in items or []:
        if not isinstance(item,dict):continue
        url=clean_url(item.get("url"));title=str(item.get("title","")).strip()
        if url and not allowed(url,unit):url=""
        if not title and not url:continue
        row={"title":title[:450]}
        if url:row["url"]=url
        for field in fields:
            value=str(item.get(field,"")).strip()
            if value:row[field]=value[:180]
        out.append(row)
    seen=set();deduped=[]
    for row in out:
        key=re.sub(r"[^a-z0-9가-힣]","",row.get("title","").lower())
        if key in seen:continue
        seen.add(key);deduped.append(row)
    return deduped
def clean_people(items):
    out=[];seen=set()
    for item in items or []:
        if not isinstance(item,dict):continue
        name=str(item.get("name","")).strip();role=str(item.get("role","")).strip();url=clean_url(item.get("url"))
        if not name or not role:continue
        key=re.sub(r"\s+","",name).lower()
        if key in seen:continue
        seen.add(key);row={"name":name[:120],"role":role[:120]}
        if url:row["url"]=url
        out.append(row)
    return out[:80]
def recommendation_keywords(result):
    values=[]
    for value in (result.get("recommendation_keywords") or [])+(result.get("research_topics") or []):
        value=re.sub(r"\s+"," ",str(value)).strip()
        if 2<=len(value)<=100:values.append(value)
    seen=set();out=[]
    for value in values:
        key=re.sub(r"[^a-z0-9가-힣]","",value.lower())
        if key and key not in seen:seen.add(key);out.append(value)
    return out[:24]
def is_rate_limit_error(exc):
    message=str(exc).upper();return getattr(exc,"code",None)==429 or "429" in message or "RESOURCE_EXHAUSTED" in message

# Preserve the already-deployed verification implementation below by importing it from this module's
# companion snapshot is not possible; this file is intentionally restored by the next commit if needed.
