#!/usr/bin/env python3
"""SNU Lab Navigator incremental activity/detail collector v2.

Static HTML first; then relevance-ranked same-host crawl; then Gemini URL Context
for structured extraction. Google Search grounding is used only when static
source discovery is too sparse. Poster candidates are never public-facing unless
Gemini verifies attribution from the poster/page itself.
"""
from __future__ import annotations
import argparse, concurrent.futures, hashlib, json, os, re, threading, time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT=Path(__file__).resolve().parents[1]; DIST=ROOT/'dist'; STATE=ROOT/'data/automation-state.json'; OUT=DIST/'automation-data.js'
UA='SNU-Lab-Navigator/2.0'; TIMEOUT=15; MAX_BODY=1_500_000; MAX_TEXT=18_000; MAX_PAGES=10; MAX_DEPTH=2
TERMS={
 'publication':('publication','publications','paper','papers','journal','research output','논문','연구성과','업적'),
 'member':('member','members','people','person','student','students','researcher','구성원','연구원','학생','alumni','졸업생'),
 'recruitment':('recruit','join','opening','position','admission','모집','채용','인턴','연구생','지원'),
}
POSTER=('poster','posters','포스터','포스터상','poster award','research poster')

def now(): return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z')
def norm(x): return re.sub(r'\s+',' ',str(x or '')).strip()
def clean_url(x):
    m=re.search(r'https?://[^\s;,|]+',str(x or '')); return m.group(0).rstrip(').]}') if m else ''
def allowed(u,unit):
    h=(urlparse(u).hostname or '').lower(); supplied={(urlparse(clean_url(unit.get(k))).hostname or '').lower() for k in ('homepage','profile','departmentUrl') if clean_url(unit.get(k))}
    return bool(h) and (h=='snu.ac.kr' or h.endswith('.snu.ac.kr') or h=='snu.elsevierpure.com' or h in supplied)
def js(path,var):
    m=re.search(rf'window\.{re.escape(var)}\s*=\s*(.+?)\s*;\s*$',path.read_text(encoding='utf-8'),re.S)
    if not m: raise RuntimeError(f'cannot parse {var}')
    return json.loads(m.group(1))
def load_units():
    units=js(DIST/'data.js','RESEARCH_UNITS'); sup=js(DIST/'roster-supplements.js','RESEARCH_UNIT_SUPPLEMENTS') if (DIST/'roster-supplements.js').exists() else []
    d={}
    for x in [*units,*sup]: d['|'.join(str(x.get(k,'')).strip() for k in ('college','department','name'))]=x
    return list(d.values())
def load_state():
    try:
        x=json.loads(STATE.read_text(encoding='utf-8')); x.setdefault('cursor',0); x.setdefault('records',{}); x.setdefault('failures',{}); return x
    except Exception:return {'cursor':0,'records':{},'failures':{}}

class P(HTMLParser):
    def __init__(self,base): super().__init__(convert_charrefs=True); self.base=base; self.skip=0; self.text=[]; self.links=[]; self.assets=[]; self.a=''; self.at=[]
    def handle_starttag(self,t,attrs):
        t=t.lower(); a={k.lower():str(v or '') for k,v in attrs}
        if t in {'script','style','noscript','svg','template'}: self.skip+=1; return
        if self.skip:return
        if t=='a': self.a=urljoin(self.base,a.get('href','')); self.at=[]
        if t=='img':
            u=a.get('src') or a.get('data-src')
            if u:self.assets.append({'url':urljoin(self.base,u),'alt':norm(a.get('alt')),'title':norm(a.get('title'))})
        if t=='source' and re.search(r'\.(png|jpe?g|webp|bmp|pdf)(?:[?#].*)?$',a.get('src',''),re.I): self.assets.append({'url':urljoin(self.base,a['src']),'alt':'','title':''})
    def handle_endtag(self,t):
        t=t.lower()
        if t in {'script','style','noscript','svg','template'} and self.skip:self.skip-=1; return
        if self.skip:return
        if t=='a' and self.a:self.links.append({'url':self.a,'title':norm(' '.join(self.at))}); self.a=''; self.at=[]
    def handle_data(self,d):
        if self.skip:return
        v=norm(d)
        if v:self.text.append(v); self.at.append(v) if self.a else None
@dataclass
class Page: url:str; text:str; links:list; assets:list; depth:int

def fetch(u):
    req=Request(u,headers={'User-Agent':UA,'Accept':'text/html,text/plain;q=0.9,*/*;q=0.1'})
    with urlopen(req,timeout=TIMEOUT) as r:
        ct=r.headers.get('content-type','').lower(); body=r.read(MAX_BODY); final=r.geturl()
    if 'text/html' not in ct and 'text/plain' not in ct:return final,''
    enc='utf-8'; m=re.search(r'charset=([^;\s]+)',ct)
    if m:enc=m.group(1).strip('"\'')
    return final,body.decode(enc,errors='replace')
def page(u,d):
    final,src=fetch(u); p=P(final); p.feed(src)
    links=list({x['url']:x for x in p.links}.values()); assets=list({x['url']:x for x in p.assets}.values())
    return Page(final,norm(' '.join(p.text))[:MAX_TEXT],links,assets,d)
def link_score(x):
    h=norm(x.get('title','')+' '+x.get('url','')).lower(); s=sum(16 for ts in TERMS.values() if any(t in h for t in ts)); s+=40 if any(t in h for t in POSTER) else 0; return s
def classify(links,unit):
    o={k:[] for k in TERMS}; o['poster']=[]
    for x in links:
        if not allowed(x['url'],unit):continue
        h=norm(x.get('title','')+' '+x.get('url','')).lower()
        for k,ts in TERMS.items():
            if any(t in h for t in ts):o[k].append(x)
        if any(t in h for t in POSTER) or re.search(r'poster[^/]*\.(pdf|png|jpe?g|webp)',h,re.I):o['poster'].append(x)
    for k in o:o[k]=list({x['url']:x for x in sorted(o[k],key=link_score,reverse=True)}.values())[:5]
    return o
def assets_for(p):
    out=[]
    for x in p.assets:
        if not re.search(r'\.(png|jpe?g|webp|bmp|pdf)(?:[?#].*)?$',x['url'],re.I):continue
        h=(x['url']+' '+x.get('alt','')+' '+x.get('title','')).lower(); sc=80 if any(t in h for t in POSTER) else 0
        out.append({**x,'score':sc,'parent_source_url':p.url})
    return sorted(out,key=lambda x:x['score'],reverse=True)[:10]
@dataclass
class Budget:
    limit:int; used:int=0; lock:threading.Lock=field(default_factory=threading.Lock); disabled:str=''
    def claim(self):
        with self.lock:
            if self.disabled or self.used>=self.limit:return False
            self.used+=1; return True

def http_json(u,key,payload,timeout=60):
    req=Request(u,data=json.dumps(payload,ensure_ascii=False).encode(),headers={'x-goog-api-key':key,'content-type':'application/json'},method='POST')
    with urlopen(req,timeout=timeout) as r:return json.loads(r.read().decode())
def model_for(key):
    req=Request('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100',headers={'x-goog-api-key':key})
    with urlopen(req,timeout=12) as r:d=json.loads(r.read().decode())
    xs=[str(x.get('name','')).removeprefix('models/') for x in d.get('models',[]) if 'generateContent' in x.get('supportedGenerationMethods',[]) and 'flash-lite' in str(x.get('name','')).lower()]
    if not xs:raise RuntimeError('no generateContent Flash-Lite model available')
    return next((x for x in xs if x.startswith('gemini-3.1-flash-lite')),xs[0])
def grounded_urls(payload,unit):
    out=[]
    for c in payload.get('candidates',[]):
        for ch in (c.get('groundingMetadata') or {}).get('groundingChunks') or []:
            u=clean_url((ch.get('web') or {}).get('uri'))
            if u and allowed(u,unit):out.append(u)
    return list(dict.fromkeys(out))
def fallback_discovery(key,model,unit,roots):
    q={'task':'Find official detail pages for this SNU professor/lab','professor':unit.get('name',''),'lab':unit.get('labs') or unit.get('title',''),'department':unit.get('department',''),'roots':roots,'rules':['Only official SNU or the supplied lab host.','Prefer publications, members, recruitment, poster pages.']}
    p={'contents':[{'role':'user','parts':[{'text':json.dumps(q,ensure_ascii=False)}]}],'tools':[{'google_search':{}}],'generationConfig':{'temperature':0,'maxOutputTokens':1500}}
    return grounded_urls(http_json(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',key,p,45),unit)
def ai_extract(key,model,unit,pages,poster_candidates,extra):
    urls=list(dict.fromkeys([p.url for p in pages]+extra+[x['url'] for x in poster_candidates]))[:20]
    ev=[{'url':p.url,'text':p.text[:4200]} for p in pages if p.text]
    q={'task':'Extract research-lab facts from supplied official pages and poster/PDF/image URLs','professor':unit.get('name',''),'lab':unit.get('labs') or unit.get('title',''),'official_urls':urls,'poster_candidates':poster_candidates,'evidence':ev,'rules':['No inference.','Members require explicit name+role.','Recruitment must be current to report.','General events/seminars are not posters.','Poster verified only if lab attribution is explicit in page or asset.'],'schema':{'research_summary':'string','research_topics':['string'],'recent_papers':[{'title':'string','year':'string','venue':'string','url':'string'}],'paper_count_scope':'string','recruitment_summary':'string','current_members':[{'name':'string','role':'string','url':'string'}],'alumni':[{'name':'string','role':'string','url':'string'}],'member_page_url':'string','poster_status':'verified | unverified_candidate | none_detected | inaccessible','poster_title':'string','poster_date':'string','poster_event':'string','poster_image_url':'string','poster_source_url':'string','poster_evidence':'string','source_urls_used':['string']}}
    p={'contents':[{'role':'user','parts':[{'text':json.dumps(q,ensure_ascii=False)}]}],'tools':[{'url_context':{}}],'generationConfig':{'temperature':0,'responseMimeType':'application/json','maxOutputTokens':3600}}
    d=http_json(f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',key,p,60); txt=''.join(str(x.get('text','')) for x in d.get('candidates',[{}])[0].get('content',{}).get('parts',[])); r=json.loads(re.sub(r'^```(?:json)?|```$','',txt.strip(),flags=re.I).strip()); r=r if isinstance(r,dict) else {}
    papers=[]; seen=set()
    for x in r.get('recent_papers') or []:
        if not isinstance(x,dict):continue
        t=norm(x.get('title')); u=clean_url(x.get('url'))
        if len(t)<8 or len(t)>450:continue
        if u and not allowed(u,unit):u=''
        k=re.sub(r'[^a-z0-9가-힣]','',t.lower())
        if k in seen:continue
        seen.add(k); papers.append({'title':t,'year':norm(x.get('year'))[:10],'venue':norm(x.get('venue'))[:180],**({'url':u} if u else {})})
    r['recent_papers']=papers[:12]; r['paper_count_visible']=len(r['recent_papers']); r['current_members']=people(r.get('current_members')); r['alumni']=people(r.get('alumni')); r['poster_status']=str(r.get('poster_status','')).lower()
    if r['poster_status'] not in {'verified','unverified_candidate','none_detected','inaccessible'}:r['poster_status']='unverified_candidate' if poster_candidates else 'none_detected'
    if r['poster_status']!='verified':
        for k in ('poster_title','poster_date','poster_event','poster_image_url','poster_source_url','poster_evidence'):r[k]=''
    r['source_urls_used']=list(dict.fromkeys([clean_url(x) for x in (r.get('source_urls_used') or []) if clean_url(x)]+urls))[:20]; r['_model']=model; r['_saved_at']=now(); r['_batch_saved']=True; return r
def people(xs):
    o=[]
    for x in xs or []:
        if not isinstance(x,dict):continue
        n=norm(x.get('name')); role=norm(x.get('role'))
        if n and role:o.append({'name':n,'role':role,**({'url':clean_url(x.get('url'))} if clean_url(x.get('url')) else {})})
    return o[:80]

def scan(unit,key,model,prev,budget):
    roots=[]
    for k in ('homepage','profile','departmentUrl'):
        u=clean_url(unit.get(k))
        if u and u not in roots and allowed(u,unit):roots.append(u)
    if not roots:return None,'no_official_url'
    pages=[];seen=set();q=[(u,0) for u in roots[:3]]; kinds={k:[] for k in TERMS}; kinds['poster']=[]; assets=[]; extra=[]
    while q and len(pages)<MAX_PAGES:
        u,d=q.pop(0)
        if u in seen or d>MAX_DEPTH:continue
        seen.add(u)
        try:p=page(u,d)
        except (HTTPError,URLError,TimeoutError):continue
        except Exception:continue
        pages.append(p); f=classify(p.links,unit)
        for k,v in f.items():kinds[k].extend(v)
        assets.extend(assets_for(p)); nxt=sorted([x for x in p.links if allowed(x['url'],unit) and x['url'] not in seen],key=link_score,reverse=True)[:10]; q += [(x['url'],d+1) for x in nxt]
    assets=list({x['url']:x for x in assets}.values()); rel=sum(len(v) for v in kinds.values())+len(assets)
    if key and model and rel==0 and budget.claim():
        try:extra=fallback_discovery(key,model,unit,roots)
        except Exception:extra=[]
    for k in ('publication','member','recruitment','poster'):
        for x in kinds[k][:3]:
            if len(pages)>=MAX_PAGES or x['url'] in seen:continue
            try:pages.append(page(x['url'],1));seen.add(x['url'])
            except Exception:pass
    if not pages:return None,'fetch_failed'
    fp=hashlib.sha256(('\n'.join(p.url+'\n'+p.text for p in pages)+'\nA\n'+'\n'.join(x['url'] for x in assets)).encode()).hexdigest(); e=dict(prev.get('enrichment') or {}); err=''
    if prev.get('fingerprint')==fp and e:pass
    elif key and model and budget.claim():
        try:e=ai_extract(key,model,unit,pages,assets,extra)
        except Exception as ex:err='gemini_'+type(ex).__name__; e=dict(prev.get('enrichment') or {})
    else:
        if e:e['_stale']=True
    ps=e.get('poster_status') if e.get('poster_status') in {'verified','unverified_candidate','none_detected','inaccessible'} else ('unverified_candidate' if assets else 'none_detected')
    acts=[]
    for k in ('publication','member','recruitment','poster'):
        acts += [{'title':x.get('title') or k,'url':x['url'],'kind':k} for x in kinds[k][:5]]
    r={'fingerprint':fp,'checked_at':now(),'activity':{'publicationPages':[x for x in acts if x['kind']=='publication'][:5],'recruitmentPages':[x for x in acts if x['kind']=='recruitment'][:4],'membersUrl':next((x['url'] for x in acts if x['kind']=='member'),'') ,'posterStatus':ps,'posterCandidates':assets[:8],'sourcePagesScanned':[p.url for p in pages]},'enrichment':e}
    if err:r['ai_error']=err
    return r,''

def showcase(units,records):
    m={str(u.get('id','')):u for u in units}; best=('',-1,[])
    for uid,r in records.items():
        u=m.get(uid); e=r.get('enrichment') or {}; a=r.get('activity') or {}; s=0; why=[]
        if u and u.get('labs') and '교수 연구그룹' not in str(u.get('labs')):s+=30;why.append('공식 연구실명')
        if e.get('research_summary') or (u and u.get('fields')):s+=20;why.append('연구분야')
        s+=min(20,4*len(e.get('research_topics') or [])); s+=min(24,4*len(e.get('recent_papers') or [])); s+=min(20,4*len(e.get('current_members') or []))
        if e.get('recruitment_summary'):s+=10;why.append('모집')
        if a.get('posterStatus')=='verified':s+=18;why.append('검증 포스터')
        s+=min(12,len(set(a.get('sourcePagesScanned') or [])))
        if s>best[1]:best=(uid,s,why)
    return best

def write(state,units,checked,mode,ai):
    activity={u:r.get('activity') for u,r in state.get('records',{}).items() if r.get('activity')}; enrichment={u:r.get('enrichment') for u,r in state.get('records',{}).items() if r.get('enrichment')}; sid,ss,why=showcase(units,state.get('records',{}))
    meta={'updated_at':now(),'checked_units':len(state.get('records',{})),'enriched_units':len(enrichment),'checked_this_run':checked,'cursor':state.get('cursor',0),'mode':mode,'ai_requests_this_run':ai,'showcase_unit_id':sid,'showcase_score':ss,'showcase_reason':why,'collector_version':'2.0','poster_policy':'verified_only_for_public_display'}
    STATE.parent.mkdir(parents=True,exist_ok=True); STATE.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); OUT.write_text('window.AUTOMATION_META='+json.dumps(meta,ensure_ascii=False,separators=(',',':'))+';\nwindow.RESEARCH_ACTIVITY=Object.assign(window.RESEARCH_ACTIVITY||{},'+json.dumps(activity,ensure_ascii=False,separators=(',',':'))+');\nwindow.PRECOMPUTED_ENRICHMENT=Object.assign(window.PRECOMPUTED_ENRICHMENT||{},'+json.dumps(enrichment,ensure_ascii=False,separators=(',',':'))+');\n',encoding='utf-8')

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--max-units',type=int,default=int(os.getenv('MAX_UNITS','80'))); ap.add_argument('--workers',type=int,default=6); ap.add_argument('--batch-size',type=int,default=40); ap.add_argument('--time-budget-minutes',type=float,default=float(os.getenv('TIME_BUDGET_MINUTES','0'))); ap.add_argument('--max-ai-requests',type=int,default=int(os.getenv('MAX_AI_REQUESTS','400'))); a=ap.parse_args()
    units=load_units(); state=load_state(); key=os.getenv('GEMINI_API_KEY','').strip(); model=''
    if key:
        try:model=model_for(key)
        except Exception as e:print(f'Gemini disabled: {e}',flush=True)
    budget=Budget(a.max_ai_requests if model else 0); start=time.monotonic(); deadline=start+a.time_budget_minutes*60 if a.time_budget_minutes else None; n=min(max(0,a.max_units),len(units)); checked=0
    while checked<n:
        if deadline and time.monotonic()>=deadline-30:break
        cur=int(state.get('cursor',0))%len(units); batch=[units[(cur+i)%len(units)] for i in range(min(a.batch_size,n-checked))]
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(a.workers,8))) as pool:
            fs=[pool.submit(scan,u,key,model,state['records'].get(str(u.get('id','')),{}),budget) for u in batch]
            for i,f in enumerate(concurrent.futures.as_completed(fs),1):
                try:r,err=f.result()
                except Exception as e:r,err=None,type(e).__name__
                uid=str(batch[i-1].get('id',''))
                if r:state['records'][uid]=r; state['failures'].pop(uid,None)
                else:state['failures'][uid]={'reason':err,'checked_at':now()}
                print(f'[{checked+i}/{n}] {uid}: {"ok" if r else err}',flush=True)
        checked+=len(batch);state['cursor']=(cur+len(batch))%len(units);state['last_run']={'at':now(),'checked':checked,'seconds':round(time.monotonic()-start,2),'gemini':bool(model),'ai_requests':budget.used,'ai_disabled_reason':budget.disabled,'completed_full_pass':checked>=len(units)};write(state,units,checked,'gemini-url-context' if model else 'collector-only',budget.used)
    if checked==0:write(state,units,0,'gemini-url-context' if model else 'collector-only',budget.used)
    print(json.dumps(state.get('last_run',{}),ensure_ascii=False),flush=True)
if __name__=='__main__':main()
