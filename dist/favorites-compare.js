(() => {
  'use strict';
  const FAV_KEY = 'snu-lab-favorites-v1';
  const COMPARE_MAX = 4;
  let compare = new Set();
  let compareDialogOpen = false;
  const getUnits = () => [...(window.RESEARCH_UNITS || []), ...(window.RESEARCH_UNIT_SUPPLEMENTS || [])];
  const getUnit = id => getUnits().find(x => String(x.id) === String(id));
  const getSaved = () => { try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); } catch (_) { return new Set(); } };
  const save = s => localStorage.setItem(FAV_KEY, JSON.stringify([...s]));
  const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const enrichment = id => (window.PRECOMPUTED_ENRICHMENT || {})[id] || {};
  const activity = id => (window.RESEARCH_ACTIVITY || {})[id] || {};
  const account = () => window.SnuAccount || null;
  const papers = id => { const e=enrichment(id), a=activity(id); return (Array.isArray(e.recent_papers)&&e.recent_papers.length?e.recent_papers:(a.papers||[])).filter(Boolean); };
  const keywords = id => [...new Set([...(enrichment(id).recommendation_keywords||[]), ...(enrichment(id).research_topics||[]), ...String(getUnit(id)?.keywords||'').split(/[;,|]/)].map(x=>String(x).trim()).filter(Boolean))].slice(0,8);
  const exactOneYearCount = id => {
    const e = enrichment(id);
    const stored = Number(e.recent_one_year_paper_count);
    if (Number.isFinite(stored) && stored >= 0) return {count: stored, exact: true};
    const now = new Date();
    const cutoff = new Date(now.getTime() - 365*24*60*60*1000);
    let exact = 0, yearFallback = 0;
    for (const p of papers(id)) {
      const raw = p.date || p.published_at || p.publication_date || p.publishedAt;
      if (raw) { const d = new Date(raw); if (!Number.isNaN(d.getTime()) && d >= cutoff && d <= now) exact++; continue; }
      const y = Number(String(p.year || '').match(/20\d{2}/)?.[0] || 0);
      if (y === now.getFullYear() || y === now.getFullYear()-1) yearFallback++;
    }
    return {count: exact || yearFallback, exact: exact > 0};
  };
  const roleCounts = id => {
    const e=enrichment(id), a=activity(id);
    const c={교수:0,박사후연구원:0,연구원:0,박사:0,석사:0,학부연구생:0,대학원생:0,기타:0,동문:0};
    for(const p of (e.current_members||[])){
      const r=String(p.member_group||p.role||'').toLowerCase();
      if(/ph\.?d|doctoral|박사과정|박사/.test(r))c.박사++;
      else if(/postdoc|post-doctoral|postdoctoral|research fellow|박사후/.test(r))c.박사후연구원++;
      else if(/master|석사과정|석사/.test(r))c.석사++;
      else if(/undergraduate|undergrad|학부연구생|학부생/.test(r))c.학부연구생++;
      else if(/graduate student|graduate researcher|대학원생/.test(r))c.대학원생++;
      else if(/professor|faculty|교수/.test(r))c.교수++;
      else if(/researcher|scientist|연구원/.test(r))c.연구원++;
      else c.기타++;
    }
    if(!e.current_members?.length&&a.members){
      for(const [g,n] of Object.entries(a.members)){const r=String(g).toLowerCase();const count=Array.isArray(n)?n.length:Number(n)||0;if(/ph\.?d|doctoral|박사/.test(r))c.박사+=count;else if(/master|석사/.test(r))c.석사+=count;else if(/undergraduate|학부/.test(r))c.학부연구생+=count;else if(/postdoc|post-doctoral|박사후/.test(r))c.박사후연구원+=count;else if(/professor|faculty|교수/.test(r))c.교수+=count;else if(/researcher|연구원/.test(r))c.연구원+=count;else c.기타+=count;}
    }
    c.동문=Array.isArray(e.alumni)?e.alumni.length:0;
    return c;
  };
  const compactMembers = id => {
    const c=roleCounts(id), out=[];
    for(const [k,label] of [['교수','교수'],['박사후연구원','박사후'],['연구원','연구원'],['박사','박사'],['석사','석사'],['학부연구생','학부'],['대학원생','대학원생'],['기타','기타'],['동문','동문']]) if(c[k]) out.push(`${label} ${c[k]}명`);
    return out.join(' · ') || '확인 전';
  };
  const css = document.createElement('style'); css.textContent = `.fav-compare-tools{display:flex;gap:6px;margin-left:auto;flex:0 0 auto}.fav-compare-tool{border:1px solid #d8e3ef;background:#fff;color:#2d5377;border-radius:9px;min-width:34px;height:32px;font-size:17px;cursor:pointer}.fav-compare-tool.active{background:#f3ecff;color:#6b43c6;border-color:#cbb9ef}.fav-panel{margin:12px 0;padding:12px 14px;border:1px solid var(--line,#d9e4ef);border-radius:14px;background:#f8fbff;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.fav-panel strong{color:#135fbe}.fav-panel button{border:0;border-radius:9px;padding:8px 11px;background:#135fbe;color:white;font-weight:800;cursor:pointer}.fav-panel button.secondary{background:white;color:#135fbe;border:1px solid #c7d7e8}.fav-dialog{width:min(1050px,calc(100% - 28px));max-height:88vh;border:0;border-radius:18px;padding:24px}.fav-dialog table{width:100%;border-collapse:collapse;font-size:.8rem}.fav-dialog th,.fav-dialog td{border-bottom:1px solid #e1e9f1;padding:10px;vertical-align:top;text-align:left}.fav-dialog small{display:block;color:#6b7f93;font-weight:500;margin-top:3px}.fav-overall{padding:10px 12px;margin:12px 0;border-radius:10px;background:#f3efff;color:#4e3b82;font-size:.82rem}.fav-compare-note{margin:10px 0 0;color:#5f7288;font-size:.8rem}.fav-ai-summary{margin-top:12px;padding:11px 13px;border-left:3px solid #6b43c6;background:#faf7ff;border-radius:8px;font-size:.84rem}`; document.head.appendChild(css);
  function injectPanel(){ if(document.querySelector('#favComparePanel'))return; const panel=document.createElement('div'); panel.id='favComparePanel'; panel.className='fav-panel'; panel.innerHTML='<strong>즐겨찾기</strong><span id="favCount">0개</span><button id="favShow" type="button">즐겨찾기 보기</button><span id="cmpCount">0개 선택</span><button id="cmpOpen" type="button">선택 연구실 비교</button><button id="cmpClear" class="secondary" type="button">비교 선택 해제</button>'; const target=document.querySelector('.summary')||document.querySelector('.search'); target?.after(panel); document.querySelector('#favShow').onclick=showFavorites; document.querySelector('#cmpOpen').onclick=showCompare; document.querySelector('#cmpClear').onclick=()=>{compare.clear();decorateCards();}; refreshPanel(); }
  function refreshPanel(){ const s=getSaved(); document.querySelector('#favCount')?.replaceChildren(document.createTextNode(`${s.size}개`)); document.querySelector('#cmpCount')?.replaceChildren(document.createTextNode(`${compare.size}개 선택`)); const btn=document.querySelector('#cmpOpen'); if(btn)btn.disabled=compare.size<2; }
  function decorateCards(){ injectPanel(); const saved=getSaved(); document.querySelectorAll('#results .card').forEach(card=>{ const i=Number(card.dataset.i); const unit=getUnits()[i]; if(!unit)return; let tools=card.querySelector('.fav-compare-tools'); if(!tools){tools=document.createElement('span');tools.className='fav-compare-tools';card.appendChild(tools);} const f=saved.has(unit.id), c=compare.has(unit.id); tools.innerHTML=`<button class="fav-compare-tool ${f?'active':''}" type="button" title="즐겨찾기">${f?'★':'☆'}</button><button class="fav-compare-tool ${c?'active':''}" type="button" title="비교 선택">${c?'✓':'＋'}</button>`; tools.querySelector('button').onclick=async e=>{e.stopPropagation();const x=getSaved();const enabled=!f;enabled?x.add(unit.id):x.delete(unit.id);save(x);if(account()?.isLoggedIn?.()){try{await account().setFavorite(unit.id,enabled);}catch(err){if(window.showToast)window.showToast('계정 동기화에 실패했습니다. 브라우저 저장은 유지됩니다.');}}decorateCards();}; tools.querySelectorAll('button')[1].onclick=e=>{e.stopPropagation();if(c)compare.delete(unit.id);else if(compare.size<COMPARE_MAX)compare.add(unit.id);else if(window.showToast)window.showToast(`비교는 최대 ${COMPARE_MAX}개까지 선택할 수 있습니다.`);decorateCards();}; }); refreshPanel(); }
  function observe(){ const r=document.querySelector('#results'); if(!r)return; new MutationObserver(decorateCards).observe(r,{childList:true}); decorateCards(); }
  function showFavorites(){ const s=[...getSaved()].map(getUnit).filter(Boolean); const d=document.querySelector('#favDialog')||document.body.appendChild(Object.assign(document.createElement('dialog'),{id:'favDialog',className:'fav-dialog'})); d.innerHTML=`<button type="button" class="fav-close">×</button><h2>즐겨찾기</h2>${s.length?'<table><thead><tr><th>교수</th><th>연구실</th><th>핵심 키워드</th><th>최근 1년 논문</th></tr></thead><tbody>'+s.map(u=>{const one=exactOneYearCount(u.id);return `<tr><th>${escapeHtml(u.name)}</th><td>${escapeHtml(u.labs||u.title||'연구그룹')}</td><td>${escapeHtml(keywords(u.id).join(' · ')||'확인 전')}</td><td>${one.exact?one.count+'편':one.count+'편 (연도 기준)'}</td></tr>`;}).join('')+'</tbody></table>':'<p>저장된 연구실이 없습니다.</p>'}`; d.querySelector('.fav-close').onclick=()=>d.close(); if(!d.open)d.showModal(); }
  function showCompare(){ if(compare.size<2)return; compareDialogOpen=true; const items=[...compare].map(getUnit).filter(Boolean).slice(0,COMPARE_MAX); const d=document.querySelector('#compareDialog')||document.body.appendChild(Object.assign(document.createElement('dialog'),{id:'compareDialog',className:'fav-dialog'})); d.innerHTML=`<button type="button" class="fav-close">×</button><h2>연구실 비교</h2><p>저장된 AI 요약·키워드와 최근 1년 논문 수를 이용한 간결 비교입니다.</p><table><thead><tr><th>항목</th>${items.map(u=>`<th>${escapeHtml(u.name)}<small>${escapeHtml(u.labs||u.title||'연구그룹')}</small></th>`).join('')}</tr></thead><tbody><tr><th>핵심 분야</th>${items.map(u=>`<td>${escapeHtml((enrichment(u.id).research_summary||u.fields||'').slice(0,220))}</td>`).join('')}</tr><tr><th>키워드</th>${items.map(u=>`<td>${escapeHtml(keywords(u.id).join(' · ')||'확인 전')}</td>`).join('')}</tr><tr><th>최근 1년 논문</th>${items.map(u=>{const one=exactOneYearCount(u.id);return `<td>${one.exact?one.count+'편':one.count+'편 (연도 기준)'}</td>`;}).join('')}</tr><tr><th>구성원</th>${items.map(u=>`<td>${escapeHtml(compactMembers(u.id))}</td>`).join('')}</tr><tr><th>모집</th>${items.map(u=>`<td>${escapeHtml(enrichment(u.id).recruitment_summary||'확인 전')}</td>`).join('')}</tr></tbody></table><div id="compareAiBox"><p class="fav-compare-note">저장된 정보에서 핵심 차이를 정리하는 중…</p></div>`; d.querySelector('.fav-close').onclick=()=>{compareDialogOpen=false;d.close();}; if(!d.open)d.showModal(); autoAiCompare(items,d); }
  async function autoAiCompare(items,d){
    const box=d.querySelector('#compareAiBox');
    const svc=account();
    if(!svc?.isLoggedIn?.()){ box.innerHTML='<p class="fav-compare-note">로그인하면 표 아래에서 저장된 AI 분석을 바탕으로 Gemini가 핵심 차이를 자동으로 정리합니다.</p>'; return; }
    box.innerHTML='<p class="fav-compare-note">Gemini가 핵심 차이만 정리하고 있습니다…</p>';
    try {
      const {payload}=await svc.callGemini({contents:[{role:'user',parts:[{text:JSON.stringify({task:'다음 연구실들을 아주 짧게 비교한다. 표 아래에 표시할 핵심 차이만 한국어로 작성한다.',labs:items.map(u=>({id:u.id,name:u.name,summary:(enrichment(u.id).research_summary||u.fields||'').slice(0,300),keywords:keywords(u.id),recent_one_year_paper_count:exactOneYearCount(u.id).count,recent_papers:papers(u.id).slice(0,12).map(p=>({title:p.title,year:p.year,date:p.date}))})),rules:['제공된 데이터만 사용','연구실 간 차이를 우선','최근 1년 논문 수와 제공된 논문 제목/주제를 참고','한 문장 overall + 연구실별 1문장 이내','장황한 설명 금지','정보가 없으면 확인 전이라고 표시']})}]}],generationConfig:{temperature:.1,maxOutputTokens:700,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{overall:{type:'STRING'},rows:{type:'ARRAY',items:{type:'OBJECT',properties:{id:{type:'STRING'},difference:{type:'STRING'}},required:['id','difference']}}},required:['overall','rows']}}});
      const txt=payload?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'{}';
      const r=JSON.parse(txt.replace(/^```json\s*/i,'').replace(/\s*```$/,''));
      const validRows=(r.rows||[]).filter(x=>items.some(u=>u.id===x.id)).slice(0,COMPARE_MAX);
      box.innerHTML=`<div class="fav-ai-summary"><strong>핵심 차이</strong><div>${escapeHtml(r.overall||'')}</div>${validRows.length?`<table><tbody>${validRows.map(x=>`<tr><th>${escapeHtml(getUnit(x.id)?.name||x.id)}</th><td>${escapeHtml(String(x.difference||'').slice(0,180))}</td></tr>`).join('')}</tbody></table>`:''}</div>`;
    } catch(e){ box.innerHTML=`<p class="fav-compare-note">AI 핵심 차이는 일시적으로 생성하지 못했습니다. 위 표의 저장 데이터는 그대로 사용할 수 있습니다.</p>`; }
  }
  window.addEventListener('snu-account-changed',()=>{ if(compareDialogOpen){ const d=document.querySelector('#compareDialog'); if(d?.open){ const items=[...compare].map(getUnit).filter(Boolean).slice(0,COMPARE_MAX); if(items.length>=2) autoAiCompare(items,d); } } decorateCards(); });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
})();
