(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const units = () => [...(window.RESEARCH_UNITS || []), ...(window.RESEARCH_UNIT_SUPPLEMENTS || [])];
  const unit = id => units().find(x => String(x.id) === String(id));
  const enrich = id => (window.PRECOMPUTED_ENRICHMENT || {})[id] || {};
  const activity = id => (window.RESEARCH_ACTIVITY || {})[id] || {};
  const storedKeywords = id => [...new Set([
    ...(enrich(id).recommendation_keywords || []),
    ...(enrich(id).research_topics || []),
    ...String(unit(id)?.keywords || '').split(/[;,|]/)
  ].map(x => String(x).trim()).filter(Boolean))].slice(0, 10);
  const recentPapers = id => {
    const e = enrich(id), a = activity(id);
    return (Array.isArray(e.recent_papers) && e.recent_papers.length ? e.recent_papers : (a.papers || [])).filter(Boolean).slice(0, 10);
  };
  const paperTrend = id => {
    const years = {};
    recentPapers(id).forEach(p => { const m = String(p.year || '').match(/20\d{2}/); if (m) years[m[0]] = (years[m[0]] || 0) + 1; });
    return Object.entries(years).sort((a,b) => b[0].localeCompare(a[0])).map(([y,n]) => `${y} ${n}편`).join(' · ') || '연도 정보 없음';
  };

  function requireAccount() {
    if (window.SnuAccount?.isLoggedIn?.()) return true;
    window.SnuAccount?.open?.();
    return false;
  }

  function localCacheKey(interest, college, department) {
    const meta = window.AUTOMATION_META || {};
    const raw = `${meta.updated_at || 'static'}|${interest.trim().toLowerCase()}|${college}|${department}`;
    let hash = 2166136261;
    for (let i = 0; i < raw.length; i++) hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619);
    return `snu-lab-ai-recommend-v4:${(hash >>> 0).toString(16)}`;
  }

  function renderRecommendation(ids, reasons) {
    const all = units();
    const found = ids.map(id).filter(Boolean);
    const results = $('#results');
    if (!results) return;
    results.innerHTML = found.map((x, index) => {
      const avatar = x.photo ? `<img class="avatar" src="${esc(String(x.photo).split(/[,;|]/)[0])}" alt="${esc(x.name)} 교수 사진" loading="lazy" onerror="this.hidden=true">` : `<span class="avatar fallback" aria-hidden="true">${esc(String(x.name || '?').slice(0,1))}</span>`;
      const e = enrich(x.id);
      const reason = reasons.get(x.id) || '';
      const lab = String(x.labs || x.title || '연구그룹').split(/[;|]/)[0].trim() || '연구그룹';
      const papers = Number.isFinite(Number(e.paper_count_visible)) ? `공식 페이지 확인 ${Number(e.paper_count_visible)}편` : '';
      return `<button class="card" data-i="${all.indexOf(x)}"><span>${avatar}</span><span class="card-copy"><h2>${esc(`${x.name || '교수명 미확인'} 교수 / ${lab}`)}</h2><span class="meta">${esc([x.college,x.department,x.rank].filter(Boolean).join(' · '))}</span>${papers ? `<span class="paper-count">${papers}</span>` : ''}${reason ? `<span class="ai-reason"><strong>AI 추천 이유</strong>${esc(reason)}</span>` : ''}</span></button>`;
    }).join('') || '<p class="empty">AI 추천 결과가 없습니다.</p>';
    window.scrollTo({top: results.getBoundingClientRect().top + window.scrollY - 20, behavior: 'smooth'});
  }

  async function recommend(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const q = $('#q'), status = $('#aiStatus'), button = $('#aiRecommend');
    const interest = q?.value.trim() || '';
    if (!interest) { q?.focus(); if(status)status.textContent='먼저 관심 분야를 입력해 주세요.'; return; }
    if (!requireAccount()) return;

    const college = $('#college')?.value || '';
    const department = $('#department')?.value || '';
    const pool = units().filter(x => (!college || x.college === college) && (!department || x.department === department));
    const words = interest.toLowerCase().split(/[\s,;]+/).filter(Boolean);
    const ranked = pool.map(x => {
      const e=enrich(x.id);
      const text=[x.name,x.title,x.labs,x.fields,x.keywords,e.research_summary,...(e.research_topics||[]),...(e.recommendation_keywords||[])].join(' ').toLowerCase();
      const score=words.reduce((s,w)=>s+(w.length>1 && text.includes(w) ? (w.length>=4?5:2):0),0);
      return {x,score};
    }).sort((a,b)=>b.score-a.score).slice(0,150);
    const candidates=ranked.map(({x})=>{const e=enrich(x.id);return {id:x.id,professor:x.name,lab:x.labs||x.title,college:x.college,department:x.department,research_summary:String(e.research_summary||x.fields||'').slice(0,500),topics:(e.research_topics||[]).slice(0,12),keywords:(e.recommendation_keywords||[]).slice(0,24)}});
    if(!candidates.length){if(status)status.textContent='비교할 연구 정보가 없습니다.';return;}

    const key=localCacheKey(interest,college,department);
    let cached=null;
    try{cached=JSON.parse(localStorage.getItem(key)||'null')}catch(_){cached=null}
    if(cached?.recommendations?.length){
      const ids=cached.recommendations.map(x=>x.id).filter(id=>unit(id));
      renderRecommendation(ids,new Map(cached.recommendations.map(x=>[x.id,x.reason])));
      if(status)status.textContent='저장된 AI 추천 결과를 사용했습니다. Gemini 재호출 없음.';
      return;
    }

    if(button){button.disabled=true;button.textContent='AI가 분석 중…';}
    if(status)status.textContent=`저장된 AI 연구분야를 이용해 ${candidates.length}개 후보만 서버 Gemini에 보냅니다.`;
    try{
      const response=await window.SnuAccount.callGemini({
        systemInstruction:{parts:[{text:'서울대학교 연구실 추천. 제공된 후보 데이터만 사용한다. 후보 ID를 변형하지 않는다. 저장된 AI 요약/주제/키워드를 근거로 관심사와 연구 적합도를 판단한다. 한국어로 매우 간결하게 추천 이유를 작성한다.'}]},
        contents:[{role:'user',parts:[{text:JSON.stringify({task:'관심사에 가장 적합한 연구실 최대 12개를 추천하고 각 이유를 한두 문장으로 설명',interest,candidates})}]}],
        generationConfig:{temperature:0.15,maxOutputTokens:2600,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{recommendations:{type:'ARRAY',items:{type:'OBJECT',properties:{id:{type:'STRING'},reason:{type:'STRING'}},required:['id','reason']}}},required:['recommendations']}}
      });
      const text=response.payload?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'{}';
      const result=JSON.parse(text.replace(/^```json\s*/i,'').replace(/\s*```$/,''));
      const recs=(result.recommendations||[]).filter(r=>unit(r.id)).slice(0,12);
      if(!recs.length)throw new Error('추천 결과가 없습니다.');
      localStorage.setItem(key,JSON.stringify({saved_at:new Date().toISOString(),recommendations:recs}));
      renderRecommendation(recs.map(r=>r.id),new Map(recs.map(r=>[r.id,r.reason])));
      if(status)status.textContent=`AI 추천 완료 · 저장 분석 ${candidates.length}개 후보 활용 · 재추천 시 cache 사용`;
    }catch(e){if(status)status.textContent=`AI 추천 실패: ${e.message}`;}
    finally{if(button){button.disabled=false;button.textContent='Gemini AI 추천 받기';}}
  }

  function comparisonFromDialog(dialog) {
    const headers=$$('thead th',dialog).slice(1);
    return headers.map(th=>{
      const name=(th.firstChild?.textContent || th.textContent || '').trim();
      const lab=th.querySelector('small')?.textContent?.trim() || '';
      const match=units().find(x=>String(x.name||'').trim()===name && String(x.labs||x.title||'').includes(lab));
      return match || units().find(x=>String(x.name||'').trim()===name) || null;
    }).filter(Boolean).slice(0,4);
  }

  async function compareAi(event) {
    event.preventDefault(); event.stopImmediatePropagation();
    const button=event.target.closest('#compareAiRun'), dialog=button?.closest('dialog');
    if(!dialog || !requireAccount()) return;
    const items=comparisonFromDialog(dialog);
    if(items.length<2)return;
    const box=$('#compareAiBox',dialog);
    const cacheKey=`snu-lab-compare-ai-v2:${items.map(x=>x.id).sort().join(',')}:${window.AUTOMATION_META?.updated_at||'static'}`;
    let cached=null; try{cached=JSON.parse(localStorage.getItem(cacheKey)||'null')}catch(_){}
    if(cached){box.innerHTML=renderCompare(cached);return;}
    box.innerHTML='<p>AI 비교 중…</p>';
    try{
      const response=await window.SnuAccount.callGemini({
        systemInstruction:{parts:[{text:'연구실 비교자. 제공된 데이터만 사용한다. 매우 짧게 한국어로 비교한다. 최근 논문 trend는 입력된 논문 연도/제목에서만 판단한다.'}]},
        contents:[{role:'user',parts:[{text:JSON.stringify({task:'연구실을 표 형태로 매우 간결하게 비교',labs:items.map(x=>({id:x.id,professor:x.name,lab:x.labs||x.title,summary:String(enrich(x.id).research_summary||x.fields||'').slice(0,350),keywords:storedKeywords(x.id),recent_paper_trend:paperTrend(x.id),recruitment:String(enrich(x.id).recruitment_summary||'').slice(0,150)}))})}]}],
        generationConfig:{temperature:0.1,maxOutputTokens:900,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{overall:{type:'STRING'},rows:{type:'ARRAY',items:{type:'OBJECT',properties:{id:{type:'STRING'},focus:{type:'STRING'},trend:{type:'STRING'},difference:{type:'STRING'}},required:['id','focus','trend','difference']}}},required:['overall','rows']}}
      });
      const text=response.payload?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'{}';
      const result=JSON.parse(text.replace(/^```json\s*/i,'').replace(/\s*```$/,''));
      const safe={overall:String(result.overall||'').slice(0,250),rows:(result.rows||[]).filter(r=>items.some(x=>x.id===r.id)).slice(0,4).map(r=>({id:r.id,focus:String(r.focus||'').slice(0,100),trend:String(r.trend||'').slice(0,100),difference:String(r.difference||'').slice(0,120)}))};
      localStorage.setItem(cacheKey,JSON.stringify(safe));box.innerHTML=renderCompare(safe);
    }catch(e){box.innerHTML=`<p>AI 비교 실패: ${esc(e.message)}</p>`;}
  }

  function renderCompare(result){
    return `<div class="fav-overall">${esc(result.overall||'')}</div><table><thead><tr><th>연구실</th><th>핵심 초점</th><th>최근 논문 흐름</th><th>주요 차이</th></tr></thead><tbody>${(result.rows||[]).map(r=>{const u=unit(r.id);return `<tr><th>${esc(u?.name||r.id)}<small>${esc(u?.labs||'')}</small></th><td>${esc(r.focus)}</td><td>${esc(r.trend)}</td><td>${esc(r.difference)}</td></tr>`}).join('')}</tbody></table>`;
  }

  document.addEventListener('click', async event => {
    const rec=event.target.closest?.('#aiRecommend');
    if(rec){await recommend(event);return;}
    const connect=event.target.closest?.('#connectAiOpen,#saveGeminiKey,#welcomeConnect');
    if(connect && window.SnuAccount?.open){event.preventDefault();event.stopImmediatePropagation();document.querySelector('#welcomeDialog')?.close();document.querySelector('#aiKeyDialog')?.close();window.SnuAccount.open();return;}
    const cmp=event.target.closest?.('#compareAiRun');
    if(cmp){await compareAi(event);return;}
  }, true);
})();
