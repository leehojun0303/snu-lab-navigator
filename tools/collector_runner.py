#!/usr/bin/env python3
"""Run the stable collector with navigation-aware official-site discovery."""
import json
from urllib.parse import quote, urlparse
import collector_entry as entry

collector = entry.collector
collector.TERMS.setdefault("directory", ("faculty","professor","professors","people","members","department","departments","major","majors","교수","교수진","교원","학과","전공","구성원"))
_original_scan = collector.scan
_original_http_json = entry.http_json
_original_load_units = entry.load_units_compatible
_original_load_state = collector.load_state

# Free-tier safe paper summaries: keep URL Context, but never attach Google Search.
# If a supplied verified page exposes enough paper content, Gemini may summarize it;
# otherwise the summary remains empty and cannot block the professor detail scan.
def _paper_grounded_http_json(url,key,payload,timeout=60):
    try:
        tools=payload.get("tools") or []
        if any("url_context" in t for t in tools):
            contents=payload.get("contents") or [];parts=(contents[0].get("parts") or []) if contents else []
            if parts and isinstance(parts[0].get("text"),str):
                prompt=json.loads(parts[0]["text"]);schema=prompt.get("output_schema") or {};papers=schema.get("recent_papers")
                if isinstance(papers,list) and papers and isinstance(papers[0],dict):
                    papers[0].update({"authors":"string","doi":"string","summary":"string","summary_source":"abstract_verified | fulltext_verified | scholarly_metadata_verified | empty"})
                    prompt.setdefault("rules",[]).extend([
                        "Paper summaries must not require Google Search or any unsupported paid-only search tool.",
                        "Before writing a paper summary, verify the paper from the supplied URL Context by title and this professor's authorship; match year when available.",
                        "Prefer a visible abstract; otherwise use substantive full text or scholarly metadata only when it is actually visible in a supplied verified URL.",
                        "Write a concise Korean 1-2 sentence summary only from visible verified content. Never summarize from title alone or general model knowledge.",
                        "Set summary_source to abstract_verified, fulltext_verified, scholarly_metadata_verified, or empty. If adequate content is unavailable, leave summary empty rather than failing the professor scan."
                    ]);parts[0]["text"]=json.dumps(prompt,ensure_ascii=False)
                    payload["tools"]=[t for t in tools if "google_search" not in t]
    except Exception as exc:print(f"Paper-summary free-tier patch skipped: {type(exc).__name__}: {exc}",flush=True)
    return _original_http_json(url,key,payload,timeout)
entry.http_json=_paper_grounded_http_json

def _is_fine_arts(unit):return "미술대학" in str(unit.get("college",""))
def _is_music(unit):return "음악대학" in str(unit.get("college",""))
def _is_ere(unit):return "에너지자원공학" in (str(unit.get("department",""))+" "+str(unit.get("college","")))
def _art_url(url):return (urlparse(str(url or "")).hostname or "").lower()=="art.snu.ac.kr"
def _music_url(url):return (urlparse(str(url or "")).hostname or "").lower()=="music.snu.ac.kr"
def _ere_url(url):return (urlparse(str(url or "")).hostname or "").lower()=="ere.snu.ac.kr"

# One-time bootstrap ordering: preserve all existing records, but start the remaining
# initial pass with Fine Arts and ERE so their verified detail adapters are exercised first.
def _priority_units():
    units=_original_load_units()
    indexed=list(enumerate(units))
    indexed.sort(key=lambda pair:(0 if _is_fine_arts(pair[1]) else 1 if _is_ere(pair[1]) else 2,pair[0]))
    return [unit for _,unit in indexed]
entry.load_units_compatible=_priority_units

def _priority_state():
    state=_original_load_state()
    if not state.get("priority_bootstrap_art_ere_v1") and not state.get("initial_collection_complete"):
        state["cursor"]=0
        state["priority_bootstrap_art_ere_v1"]=True
        print("Priority bootstrap enabled: Fine Arts -> ERE -> remaining units; existing enrichment preserved.",flush=True)
    return state
collector.load_state=_priority_state

def _verified_profile(url,professor):
    try:candidate=collector.page(url,0)
    except Exception:return ""
    return candidate.url if "/members/" in candidate.url and professor in collector.norm(candidate.text) else ""
def _find_art_profile(unit):
    professor=collector.norm(unit.get("name"));
    if not professor:return ""
    slug=quote(professor,safe="")
    for url in (f"https://art.snu.ac.kr/members/{slug}/",f"https://art.snu.ac.kr/members/{slug}-2/"):
        verified=_verified_profile(url,professor)
        if verified:return verified
    starts=[]
    for key in ("profile","departmentUrl","homepage"):
        url=collector.clean_url(unit.get(key))
        if url and _art_url(url) and url not in starts:starts.append(url)
    if "https://art.snu.ac.kr/" not in starts:starts.append("https://art.snu.ac.kr/")
    queue=[(url,0) for url in starts];seen=set()
    while queue and len(seen)<24:
        url,depth=queue.pop(0)
        if url in seen or depth>3:continue
        seen.add(url)
        try:page=collector.page(url,depth)
        except Exception:continue
        for link in [x for x in page.links if _art_url(x.get("url")) and collector.norm(x.get("title"))==professor]:
            verified=_verified_profile(link["url"],professor)
            if verified:return verified
        for link in [x for x in page.links if _art_url(x.get("url")) and "/members/" in x.get("url","")][:20]:
            verified=_verified_profile(link["url"],professor)
            if verified:return verified
        nav=[link["url"] for link in page.links if _art_url(link.get("url")) and link.get("url") not in seen and any(term in collector.norm(link.get("title","")+" "+link.get("url","")).lower() for term in ("faculty","교수진","교수","major","학과","전공","category/"))]
        queue.extend((u,depth+1) for u in list(dict.fromkeys(nav))[:12])
    return ""

def _verified_music_profile(url,professor):
    try:candidate=collector.page(url,0)
    except Exception:return ""
    text=collector.norm(candidate.text)
    return candidate.url if _music_url(candidate.url) and professor in text and any(term in text for term in ("전공","학력사항","경력사항","실적","수상")) else ""
def _find_music_profile(unit):
    professor=collector.norm(unit.get("name"));
    if not professor:return ""
    starts=[]
    for key in ("profile","departmentUrl","homepage"):
        url=collector.clean_url(unit.get(key))
        if url and _music_url(url) and url not in starts:starts.append(url)
    if "https://music.snu.ac.kr/faculty" not in starts:starts.append("https://music.snu.ac.kr/faculty")
    queue=[(url,0) for url in starts];seen=set()
    while queue and len(seen)<28:
        url,depth=queue.pop(0)
        if url in seen or depth>3:continue
        seen.add(url)
        try:page=collector.page(url,depth)
        except Exception:continue
        for link in [x for x in page.links if _music_url(x.get("url")) and professor in collector.norm(x.get("title"))]:
            verified=_verified_music_profile(link["url"],professor)
            if verified:return verified
        detail=[link["url"] for link in page.links if _music_url(link.get("url")) and link.get("url") not in seen and any(term in collector.norm(link.get("title","")+" "+link.get("url","")).lower() for term in ("상세히 보기","detail","view","faculty"))]
        for candidate_url in list(dict.fromkeys(detail))[:24]:
            verified=_verified_music_profile(candidate_url,professor)
            if verified:return verified
        nav=[link["url"] for link in page.links if _music_url(link.get("url")) and link.get("url") not in seen and any(term in collector.norm(link.get("title","")+" "+link.get("url","")).lower() for term in ("faculty","교수진","성악과","작곡과","음악학과","피아노과","관현악과","국악과","대학원 음악과"))]
        queue.extend((u,depth+1) for u in list(dict.fromkeys(nav))[:14])
    return ""

def _verified_ere_profile(url,professor):
    try:candidate=collector.page(url,0)
    except Exception:return ""
    text=collector.norm(candidate.text);parsed=urlparse(candidate.url)
    is_detail=_ere_url(candidate.url) and "bo_table=sub2_1" in parsed.query and "wr_id=" in parsed.query
    return candidate.url if is_detail and professor in text else ""
def _find_ere_profile(unit):
    professor=collector.norm(unit.get("name"));
    if not professor:return ""
    starts=[]
    for key in ("profile","departmentUrl","homepage"):
        url=collector.clean_url(unit.get(key))
        if url and _ere_url(url) and url not in starts:starts.append(url)
    listing="https://ere.snu.ac.kr/bbs/board.php?bo_table=sub2_1"
    if listing not in starts:starts.append(listing)
    queue=[(url,0) for url in starts];seen=set()
    while queue and len(seen)<20:
        url,depth=queue.pop(0)
        if url in seen or depth>2:continue
        seen.add(url)
        try:page=collector.page(url,depth)
        except Exception:continue
        candidates=[]
        for link in page.links:
            link_url=link.get("url","")
            if not _ere_url(link_url):continue
            hint=collector.norm(link.get("title","")+" "+link_url)
            if professor in hint or ("bo_table=sub2_1" in link_url and "wr_id=" in link_url):candidates.append(link_url)
        for candidate_url in list(dict.fromkeys(candidates))[:20]:
            verified=_verified_ere_profile(candidate_url,professor)
            if verified:return verified
        nav=[link.get("url") for link in page.links if _ere_url(link.get("url")) and "bo_table=sub2_1" in link.get("url","") and link.get("url") not in seen]
        queue.extend((u,depth+1) for u in list(dict.fromkeys(nav))[:12])
    return ""

def navigation_scan(unit,key,model,prev,budget):
    if _is_fine_arts(unit):profile=_find_art_profile(unit)
    elif _is_music(unit):profile=_find_music_profile(unit)
    elif _is_ere(unit):profile=_find_ere_profile(unit)
    else:return _original_scan(unit,key,model,prev,budget)
    if not profile:return _original_scan(unit,key,model,prev,budget)
    enriched=dict(unit);enriched["profile"]=profile;enriched["homepage"]=profile
    return _original_scan(enriched,key,model,prev,budget)
collector.scan=navigation_scan
if __name__=="__main__":
    try:entry.main()
    except Exception as exc:entry.write_failure_progress(exc);raise
