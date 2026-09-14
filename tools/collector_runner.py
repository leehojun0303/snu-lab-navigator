#!/usr/bin/env python3
"""Run the stable collector with navigation-aware official-site discovery."""
import json
from urllib.parse import quote, urlparse
import collector_entry as entry

collector = entry.collector
collector.TERMS.setdefault("directory", ("faculty","professor","professors","people","members","department","departments","major","majors","교수","교수진","교원","학과","전공","구성원"))
_original_scan = collector.scan
_original_http_json = entry.http_json

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
                        "For each recent paper, use Google Search only after the paper is identified from the supplied professor/publication evidence.",
                        "Before writing a paper summary, verify the searched paper by exact or near-exact title AND that this professor is an author; also match publication year when the supplied evidence has a year.",
                        "Prefer a publicly visible abstract. If no abstract is available, a public full-text section or substantive scholarly description from a publisher, DOI landing page, PubMed, arXiv, institutional repository, or comparable scholarly metadata source may be used.",
                        "Write a concise Korean 1-2 sentence summary only from content actually visible in the verified source. Do not add claims beyond that source.",
                        "Never summarize from the title alone, general model knowledge, a search snippet without substantive paper content, or a different paper with a similar title.",
                        "Set summary_source to abstract_verified for an abstract, fulltext_verified for public full text, scholarly_metadata_verified for a substantive verified scholarly description, or empty when no adequate content source is available.",
                        "Prefer at most the three most recent papers already attributable to this professor; do not replace them with unrelated search results."
                    ]);parts[0]["text"]=json.dumps(prompt,ensure_ascii=False)
                    if not any("google_search" in t for t in tools):payload["tools"]=[*tools,{"google_search":{}}]
    except Exception as exc:print(f"Paper-summary grounding patch skipped: {type(exc).__name__}: {exc}",flush=True)
    return _original_http_json(url,key,payload,timeout)
entry.http_json=_paper_grounded_http_json

def _is_fine_arts(unit):return "미술대학" in str(unit.get("college",""))
def _is_music(unit):return "음악대학" in str(unit.get("college",""))
def _is_ere(unit):return "에너지자원공학" in (str(unit.get("department",""))+" "+str(unit.get("college","")))
def _art_url(url):return (urlparse(str(url or "")).hostname or "").lower()=="art.snu.ac.kr"
def _music_url(url):return (urlparse(str(url or "")).hostname or "").lower()=="music.snu.ac.kr"
def _ere_url(url):return (urlparse(str(url or "")).hostname or "").lower()=="ere.snu.ac.kr"

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
    """Find an ERE professor's board detail page by professor name; no person URL is hardcoded."""
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
