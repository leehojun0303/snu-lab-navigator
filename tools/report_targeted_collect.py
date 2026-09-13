#!/usr/bin/env python3
"""Collect a few evidence-rich Arts/Music/Humanities units without moving the regular cursor."""
import json, os, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import collector_entry as entry

ROOT=Path(__file__).resolve().parents[1]
entry.collector.TERMS.setdefault('directory',('faculty','professor','professors','people','department','departments','major','majors','교수','교수진','교원','학과','전공','구성원'))

def discipline(u):
    c=str(u.get('college',''))
    if '미술' in c: return 'fine_arts'
    if '음악' in c: return 'music'
    if '인문' in c: return 'humanities'
    return ''

def score(kind,e):
    if kind=='fine_arts': return 5*len(e.get('recent_solo_exhibitions') or [])+4*len(e.get('recent_group_exhibitions') or [])+bool(e.get('education_summary'))
    if kind=='music': return 5*len(e.get('recent_performances') or [])+4*len(e.get('creative_works') or [])+bool(e.get('education_summary'))
    return 4*len(e.get('recent_papers') or [])+4*len(e.get('books') or [])+3*len(e.get('conference_presentations') or [])+3*len(e.get('research_projects') or [])

def main():
    units=entry.load_units_compatible(); state=entry.collector.load_state(); state.setdefault('records',{}); state.setdefault('failures',{})
    original_cursor=state.get('cursor',0)
    key=os.getenv('GEMINI_API_KEY','').strip(); model=entry.model_for(key) if key else ''
    budget=entry.PacedBudget(30 if model else 0)
    groups={k:[] for k in ('fine_arts','music','humanities')}
    for u in units:
        k=discipline(u)
        if k and any(entry.clean_url(u.get(x)) for x in ('profile','homepage','departmentUrl')): groups[k].append(u)
    results=[]
    # Try up to five candidates per discipline; keep the best evidence-rich two.
    for kind,candidates in groups.items():
        ranked=[]
        for u in candidates[:5]:
            uid=str(u.get('id','')); prev=state['records'].get(uid,{})
            raw,err=entry.collector.scan(u,'','',prev,entry.collector.Budget(0))
            if not raw: continue
            enrichment,verr=entry.verify_with_gemini(key,model,u,raw,budget) if model else (raw.get('enrichment') or {},None)
            if enrichment:
                raw['_unit_id']=uid; raw['enrichment']=enrichment
                raw['activity']['publicationPages']=enrichment.get('verified_publication_pages',[])
                raw['activity']['recruitmentPages']=enrichment.get('verified_recruitment_pages',[])
                raw['activity']['membersUrl']=enrichment.get('member_page_url','')
                raw['activity']['posterStatus']=enrichment.get('poster_status','none_detected')
                raw['activity'].pop('posterCandidates',None)
                state['records'][uid]=raw
            ranked.append((score(kind,enrichment),u,enrichment,verr))
        ranked.sort(key=lambda x:x[0],reverse=True)
        for s,u,e,err in ranked[:2]:
            results.append({'discipline':kind,'unit_id':u.get('id'),'professor':u.get('name'),'college':u.get('college'),'department':u.get('department'),'lab':u.get('labs'),'score':s,'ai_error':err or '', 'counts':{'solo_exhibitions':len(e.get('recent_solo_exhibitions') or []),'group_exhibitions':len(e.get('recent_group_exhibitions') or []),'performances':len(e.get('recent_performances') or []),'creative_works':len(e.get('creative_works') or []),'papers':len(e.get('recent_papers') or []),'books':len(e.get('books') or []),'conferences':len(e.get('conference_presentations') or []),'projects':len(e.get('research_projects') or [])}})
    state['cursor']=original_cursor
    entry.collector.write(state,units,0,'report-targeted',budget.used)
    out=ROOT/'data'/'report-targeted-results.json'; out.write_text(json.dumps({'generated_at':entry.now(),'regular_cursor_preserved':original_cursor,'results':results},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(results,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
