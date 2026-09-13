#!/usr/bin/env python3
"""Collect evidence-rich Arts/Music/Humanities samples without touching regular collector state."""
import json, os, re, sys, time
from pathlib import Path
from urllib.error import HTTPError
sys.path.insert(0, str(Path(__file__).resolve().parent))
import collector_entry as entry

ROOT=Path(__file__).resolve().parents[1]
# Navigation terms: reach college -> department/major -> faculty/professor pages before activity pages.
entry.collector.TERMS.setdefault('directory',('faculty','professor','professors','people','department','departments','major','majors','교수','교수진','교원','학과','전공','구성원'))
for key,terms in {
 'exhibition':('exhibition','exhibitions','solo','group','works','portfolio','전시','개인전','단체전','작품','작품활동'),
 'performance':('performance','performances','concert','recital','works','공연','연주','독주회','작품','창작'),
 'scholarship':('publication','publications','book','books','conference','project','research','저서','논문','학술','발표','연구과제')
}.items(): entry.collector.TERMS.setdefault(key,terms)

def discipline(u):
    c=str(u.get('college',''))
    if '미술' in c:return 'fine_arts'
    if '음악' in c:return 'music'
    if '인문' in c:return 'humanities'
    return ''

def score(kind,e):
    if kind=='fine_arts':return 5*len(e.get('recent_solo_exhibitions') or [])+4*len(e.get('recent_group_exhibitions') or [])+bool(e.get('education_summary'))
    if kind=='music':return 5*len(e.get('recent_performances') or [])+4*len(e.get('creative_works') or [])+bool(e.get('education_summary'))
    return 4*len(e.get('recent_papers') or [])+4*len(e.get('books') or [])+3*len(e.get('conference_presentations') or [])+3*len(e.get('research_projects') or [])

def verify_retry(key,model,u,raw,max_tries=4):
    # Fresh one-call budget per attempt because the regular verifier disables a budget after a 429.
    for attempt in range(max_tries):
        budget=entry.PacedBudget(1)
        enrichment,err=entry.verify_with_gemini(key,model,u,raw,budget)
        if err!='gemini_rate_limited':return enrichment,err
        wait=65+attempt*15
        print(f"Gemini quota wait for {u.get('name')}: {wait}s (attempt {attempt+1}/{max_tries})",flush=True)
        time.sleep(wait)
    return {},'gemini_rate_limited'

def candidate_priority(u):
    # Prefer records with a direct professor/profile URL, then homepage, then college/department URL.
    return (bool(entry.clean_url(u.get('profile'))),bool(entry.clean_url(u.get('homepage'))),bool(entry.clean_url(u.get('departmentUrl'))))

def main():
    units=entry.load_units_compatible()
    key=os.getenv('GEMINI_API_KEY','').strip();model=entry.model_for(key) if key else ''
    groups={k:[] for k in ('fine_arts','music','humanities')}
    for u in units:
        k=discipline(u)
        if k and any(entry.clean_url(u.get(x)) for x in ('profile','homepage','departmentUrl')):groups[k].append(u)
    for k in groups:groups[k].sort(key=candidate_priority,reverse=True)
    results=[];records={}
    # Inspect up to 6 candidates; stop early after two genuinely populated samples.
    for kind,candidates in groups.items():
        ranked=[]
        for u in candidates[:6]:
            uid=str(u.get('id',''))
            raw,scan_err=entry.collector.scan(u,'','',{},entry.collector.Budget(0))
            if not raw:
                ranked.append((0,u,{},scan_err or 'scan_failed'));continue
            enrichment,verr=verify_retry(key,model,u,raw) if model else ({},'gemini_unavailable')
            if enrichment:
                records[uid]={'_unit_id':uid,'fingerprint':raw.get('fingerprint',''),'activity':raw.get('activity') or {},'enrichment':enrichment}
            ranked.append((score(kind,enrichment),u,enrichment,verr or ''))
            if sum(1 for x in ranked if x[0]>0)>=2:break
        ranked.sort(key=lambda x:x[0],reverse=True)
        for s,u,e,err in ranked[:2]:
            results.append({'discipline':kind,'unit_id':u.get('id'),'professor':u.get('name'),'college':u.get('college'),'department':u.get('department'),'lab':u.get('labs'),'score':s,'ai_error':err,'counts':{'solo_exhibitions':len(e.get('recent_solo_exhibitions') or []),'group_exhibitions':len(e.get('recent_group_exhibitions') or []),'performances':len(e.get('recent_performances') or []),'creative_works':len(e.get('creative_works') or []),'papers':len(e.get('recent_papers') or []),'books':len(e.get('books') or []),'conferences':len(e.get('conference_presentations') or []),'projects':len(e.get('research_projects') or [])}})
    payload={'generated_at':entry.now(),'isolated_from_regular_collector':True,'results':results,'records':records}
    (ROOT/'data'/'report-targeted-results.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(results,ensure_ascii=False,indent=2),flush=True)

if __name__=='__main__':main()
