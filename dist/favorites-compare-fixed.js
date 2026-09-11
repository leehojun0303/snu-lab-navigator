(() => {
  'use strict';

  const FAV_KEY = 'snu-lab-favorites-v2';
  const MAX_COMPARE = 4;
  const units = () => [...(window.RESEARCH_UNITS || []), ...(window.RESEARCH_UNIT_SUPPLEMENTS || [])];
  const unit = id => units().find(x => String(x.id) === String(id));
  const enrichment = id => (window.PRECOMPUTED_ENRICHMENT || {})[id] || {};
  const getActivity = id => (window.RESEARCH_ACTIVITY || {})[id] || {};
  const account = () => window.SnuAccount || null;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let compareSet = new Set();
  let busy = false;

  function savedFavorites() {
    try {
      const raw = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
      return new Set(Array.isArray(raw) ? raw : []);
    } catch (_) { return new Set(); }
  }

  function writeFavorites(set) {
    localStorage.setItem(FAV_KEY, JSON.stringify([...set]));
  }

  function updatePanel() {
    const fav = savedFavorites();
    const favCount = document.querySelector('#favCount');
    const compareCount = document.querySelector('#cmpCount');
    const compareButton = document.querySelector('#cmpOpen');
    if (favCount) favCount.textContent = `${fav.size}개`;
    if (compareCount) compareCount.textContent = `${compareSet.size}개 선택`;
    if (compareButton) compareButton.disabled = compareSet.size < 2;
  }

  function injectPanel() {
    if (document.querySelector('#favComparePanel')) return;
    const panel = document.createElement('div');
    panel.id = 'favComparePanel';
    panel.className = 'fav-panel';
    panel.innerHTML = '<strong>즐겨찾기</strong><span id="favCount">0개</span><button id="favShow" type="button">즐겨찾기 보기</button><span id="cmpCount">0개 선택</span><button id="cmpOpen" type="button" disabled>선택 연구실 비교</button><button id="cmpClear" class="secondary" type="button">비교 선택 해제</button>';
    const target = document.querySelector('.summary') || document.querySelector('.search');
    if (target) target.after(panel);
    panel.addEventListener('click', event => {
      if (event.target.closest('#favShow')) showFavorites();
      if (event.target.closest('#cmpOpen')) showCompare();
      if (event.target.closest('#cmpClear')) { compareSet.clear(); decorateVisibleCards(); }
    });
    updatePanel();
  }

  function decorateVisibleCards() {
    const fav = savedFavorites();
    document.querySelectorAll('#results .card').forEach(card => {
      const idx = Number(card.dataset.i);
      const item = units()[idx];
      if (!item) return;
      let tools = card.querySelector('.fav-compare-tools');
      if (!tools) {
        tools = document.createElement('span');
        tools.className = 'fav-compare-tools';
        card.appendChild(tools);
      }
      const f = fav.has(item.id);
      const c = compareSet.has(item.id);
      tools.innerHTML = `<button type="button" class="fav-compare-tool ${f ? 'active' : ''}" data-fav="1" title="즐겨찾기">${f ? '★' : '☆'}</button><button type="button" class="fav-compare-tool ${c ? 'active' : ''}" data-compare="1" title="비교 선택">${c ? '✓' : '＋'}</button>`;
    });
    updatePanel();
  }

  function exactOneYearCount(id) {
    const e = enrichment(id);
    const stored = Number(e.recent_one_year_paper_count);
    if (Number.isFinite(stored) && stored >= 0) return {count: stored, known: true};
    const papers = Array.isArray(e.recent_papers) && e.recent_papers.length ? e.recent_papers : (getActivity(id).papers || []);
    if (!papers.length) return {count: null, known: false};
    const now = new Date();
    const cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    let exact = 0;
    let yearFallback = 0;
    for (const p of papers) {
      const raw = p.date || p.published_at || p.publication_date || p.publishedAt;
      if (raw) {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime()) && d >= cutoff && d <= now) exact++;
      } else {
        const y = Number(String(p.year || '').match(/20\d{2}/)?.[0] || 0);
        if (y === now.getFullYear() || y === now.getFullYear() - 1) yearFallback++;
      }
    }
    return exact ? {count: exact, known: true} : yearFallback ? {count: yearFallback, known: true} : {count: null, known: false};
  }

  function memberSummary(id) {
    const e = enrichment(id);
    const c = {교수:0, 박사후연구원:0, 연구원:0, 박사과정:0, 석사과정:0, 학부연구생:0, 대학원생:0, 기타:0, 동문:Array.isArray(e.alumni) ? e.alumni.length : 0};
    for (const p of e.current_members || []) {
      const r = String(p.member_group || p.role || '').toLowerCase();
      if (/postdoc|post-doctoral|postdoctoral|research fellow|박사후/.test(r)) c.박사후연구원++;
      else if (/ph\.?d|doctoral|박사과정|박사/.test(r)) c.박사과정++;
      else if (/master|석사과정|석사/.test(r)) c.석사과정++;
      else if (/undergraduate|undergrad|학부연구생|학부생/.test(r)) c.학부연구생++;
      else if (/graduate student|graduate researcher|대학원생/.test(r)) c.대학원생++;
      else if (/professor|faculty|교수/.test(r)) c.교수++;
      else if (/researcher|scientist|연구원/.test(r)) c.연구원++;
      else c.기타++;
    }
    return Object.entries(c).filter(([,n]) => n > 0).map(([k,n]) => `${k} ${n}명`).join(' · ') || '확인 필요';
  }

  function paperTitles(id) {
    const e = enrichment(id), a = getActivity(id);
    const papers = Array.isArray(e.recent_papers) && e.recent_papers.length ? e.recent_papers : (a.papers || []);
    return papers.slice(0, 8).map(p => ({title:String(p.title || ''), year:String(p.year || ''), date:String(p.date || '')}));
  }

  function keywords(id) {
    const e = enrichment(id), u = unit(id);
    return [...new Set([...(e.recommendation_keywords || []), ...(e.research_topics || []), ...String(u?.keywords || '').split(/[;,|]/)].map(x => String(x).trim()).filter(Boolean))].slice(0, 8);
  }

  function buildCompare(items) {
    const d = document.querySelector('#stableCompareDialog') || document.body.appendChild(Object.assign(document.createElement('dialog'), {id:'stableCompareDialog', className:'fav-dialog'}));
    d.innerHTML = `<button type="button" class="fav-close" aria-label="닫기">×</button><h2>연구실 비교</h2><p>저장된 AI 요약·키워드와 최근 1년 논문 정보를 기준으로 비교합니다.</p><div class="stable-scroll"><table><thead><tr><th>항목</th>${items.map(u => `<th>${escapeHtml(u.name)}<small>${escapeHtml(u.labs || u.title || '연구그룹')}</small></th>`).join('')}</tr></thead><tbody><tr><th>핵심 분야</th>${items.map(u => `<td>${escapeHtml(String(enrichment(u.id).research_summary || u.fields || '확인 필요').slice(0,260))}</td>`).join('')}</tr><tr><th>키워드</th>${items.map(u => `<td>${escapeHtml(keywords(u.id).join(' · ') || '확인 필요')}</td>`).join('')}</tr><tr><th>최근 1년 논문</th>${items.map(u => { const p=exactOneYearCount(u.id); return `<td>${p.known ? `${p.count}편` : '확인 필요'}</td>`; }).join('')}</tr><tr><th>구성원</th>${items.map(u => `<td>${escapeHtml(memberSummary(u.id))}</td>`).join('')}</tr><tr><th>모집</th>${items.map(u => `<td>${escapeHtml(String(enrichment(u.id).recruitment_summary || '확인 필요').slice(0,180))}</td>`).join('')}</tr></tbody></table></div><div id="stableCompareAi" class="fav-ai-summary"><span>로그인한 경우 Gemini가 연구 방향과 대표 연구의 차이만 자동으로 정리합니다.</span></div>`;
    d.querySelector('.fav-close').onclick = () => d.close();
    if (!d.open) d.showModal();
    runAiCompare(items,d);
  }

  async function runAiCompare(items,d) {
    const box=d.querySelector('#stableCompareAi');
    const svc=account();
    if(!svc?.isLoggedIn?.()) return;
    if(busy)return;
    busy=true;
    box.innerHTML='<span>Gemini가 핵심 차이만 정리하고 있습니다…</span>';
    try{
      const response=await svc.callGemini({
        systemInstruction:{parts:[{text:'서울대학교 연구실 비교자. 제공 데이터만 사용한다. 최근 1년 논문 수를 반복하지 않는다. 각 연구실의 연구 방향, 대표적으로 확인된 연구 주제/논문, 차별점을 매우 짧게 정리한다. 정보가 없으면 확인 필요라고 한다.'}]},
        contents:[{role:'user',parts:[{text:JSON.stringify({task:'연구실 간 핵심 차이만 간결하게 비교',labs:items.map(u=>({id:u.id,name:u.name,lab:u.labs||u.title,summary:String(enrichment(u.id).research_summary||u.fields||'').slice(0,350),keywords:keywords(u),papers:paperTitles(u.id)}))})}]}],
        generationConfig:{temperature:0.1,maxOutputTokens:600,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{overall:{type:'STRING'},rows:{type:'ARRAY',items:{type:'OBJECT',properties:{id:{type:'STRING'},difference:{type:'STRING'}},required:['id','difference']}}},required:['overall','rows']}}
      });
      const text=response.payload?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'{}';
      const result=JSON.parse(text.replace(/^```json\s*/i,'').replace(/\s*```$/,''));
      const rows=(result.rows||[]).filter(r=>items.some(u=>u.id===r.id)).slice(0,MAX_COMPARE);
      box.innerHTML=`<strong>핵심 차이</strong><div>${escapeHtml(result.overall||'')}</div>${rows.map(r=>`<p><strong>${escapeHtml(unit(r.id)?.name||r.id)}</strong> ${escapeHtml(r.difference||'')}</p>`).join('')}`;
    }catch(e){box.innerHTML='<span>AI 비교를 완료하지 못했습니다. 비교표는 계속 사용할 수 있습니다.</span>';}
    finally{busy=false;}
  }

  function showCompare(){
    const items=[...compareSet].map(unit).filter(Boolean).slice(0,MAX_COMPARE);
    if(items.length<2)return;
    buildCompare(items);
  }

  function showFavorites(){
    const items=[...savedFavorites()].map(unit).filter(Boolean);
    const d=document.querySelector('#favDialog') || document.body.appendChild(Object.assign(document.createElement('dialog'), {id:'favDialog', className:'fav-dialog'}));
    d.innerHTML=`<button type="button" class="fav-close" aria-label="닫기">×</button><h2>즐겨찾기</h2>${items.length?`<div class="stable-scroll"><table><thead><tr><th>교수</th><th>연구실</th><th>키워드</th><th>최근 1년 논문</th></tr></thead><tbody>${items.map(u=>{const p=exactOneYearCount(u.id);return `<tr><th>${escapeHtml(u.name)}</th><td>${escapeHtml(u.labs||u.title||'연구그룹')}</td><td>${escapeHtml(keywords(u.id).join(' · ')||'확인 필요')}</td><td>${p.known?p.count+'편':'확인 필요'}</td></tr>`;}).join('')}</tbody></table></div>`:'<p>저장된 연구실이 없습니다.</p>'}`;
    d.querySelector('.fav-close').onclick=()=>d.close();
    if(!d.open)d.showModal();
  }

  async function toggleFavorite(id,enabled){
    const current=savedFavorites();
    if(enabled)current.add(id);else current.delete(id);
    writeFavorites(current);
    const svc=account();
    if(svc?.isLoggedIn?.() && svc.setFavorite){
      try{await svc.setFavorite(id,enabled);}catch(_){/* local favorite remains available */}
    }
    decorateVisibleCards();
  }

  function install(){
    const style=document.createElement('style');
    style.textContent='.fav-panel{margin:12px 0;padding:12px 14px;border:1px solid var(--line,#d9e4ef);border-radius:14px;background:#f8fbff;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.fav-panel button{border:0;border-radius:9px;padding:8px 11px;background:#135fbe;color:#fff;font-weight:800;cursor:pointer}.fav-panel button.secondary{background:#fff;color:#135fbe;border:1px solid #c7d7e8}.fav-compare-tools{display:flex;gap:6px;margin-left:auto;flex:0 0 auto}.fav-compare-tool{border:1px solid #d8e3ef;background:#fff;color:#2d5377;border-radius:9px;min-width:34px;height:32px;font-size:17px;cursor:pointer}.fav-compare-tool.active{background:#f3ecff;color:#6b43c6;border-color:#cbb9ef}.fav-compare-tools button{pointer-events:auto}.fav-dialog{width:min(1080px,calc(100% - 28px));max-height:90vh;border:0;border-radius:18px;padding:24px}.fav-dialog table{width:100%;border-collapse:collapse;font-size:.82rem}.fav-dialog th,.fav-dialog td{border-bottom:1px solid #e1e8f0;padding:10px;vertical-align:top;text-align:left}.fav-dialog small{display:block;color:#718399;font-weight:500;margin-top:3px}.fav-ai-summary{margin-top:12px;padding:12px;border-left:3px solid #6b43c6;background:#faf7ff;border-radius:8px;font-size:.84rem}.stable-scroll{overflow:auto}';
    document.head.appendChild(style);
    injectPanel();
    document.addEventListener('click', async event => {
      const fav=event.target.closest?.('#results .fav-compare-tool[data-fav]');
      if(fav){event.preventDefault();event.stopPropagation();const card=fav.closest('.card');const u=card&&units()[Number(card.dataset.i)];if(u){await toggleFavorite(u.id,!savedFavorites().has(u.id));}return;}
      const cmp=event.target.closest?.('#results .fav-compare-tool[data-compare]');
      if(cmp){event.preventDefault();event.stopPropagation();const card=cmp.closest('.card');const u=card&&units()[Number(card.dataset.i)];if(u){if(compareSet.has(u.id))compareSet.delete(u.id);else if(compareSet.size<MAX_COMPARE)compareSet.add(u.id);decorateVisibleCards();}return;}
    }, true);
    const results=document.querySelector('#results');
    if(results){
      new MutationObserver(()=>{ window.requestAnimationFrame(()=>decorateVisibleCards()); }).observe(results,{childList:true});
      decorateVisibleCards();
    }
    window.addEventListener('snu-account-changed',()=>{loadAccountFavorites();decorateVisibleCards();});
  }

  async function loadAccountFavorites(){
    const svc=account();
    if(!svc?.isLoggedIn?.()||!svc.loadFavorites)return;
    try{const ids=await svc.loadFavorites();writeFavorites(new Set(ids));}catch(_){/* local fallback */}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
