(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getUnits = () => [...(window.RESEARCH_UNITS || []), ...(window.RESEARCH_UNIT_SUPPLEMENTS || [])];
  const getUnit = id => getUnits().find(x => String(x.id) === String(id));
  const enrichment = id => (window.PRECOMPUTED_ENRICHMENT || {})[id] || {};
  const papers = id => {
    const e = enrichment(id), a = (window.RESEARCH_ACTIVITY || {})[id] || {};
    return (Array.isArray(e.recent_papers) && e.recent_papers.length ? e.recent_papers : (a.papers || [])).filter(Boolean).slice(0, 10);
  };
  const keywords = id => [...new Set([
    ...(enrichment(id).recommendation_keywords || []),
    ...(enrichment(id).research_topics || []),
    ...String(getUnit(id)?.keywords || '').split(/[;,|]/)
  ].map(x => String(x).trim()).filter(Boolean))].slice(0, 10);

  function ensureLoggedIn() {
    if (!window.SnuAccount?.isLoggedIn?.()) {
      window.SnuAccount?.open?.();
      return false;
    }
    return true;
  }

  async function recommend() {
    const q = $('#q'), aiStatus = $('#aiStatus'), button = $('#aiRecommend');
    const interest = q?.value.trim();
    if (!interest) { q?.focus(); if (aiStatus) aiStatus.textContent = '먼저 관심 분야를 입력해 주세요.'; return; }
    if (!ensureLoggedIn()) return;
    const units = getUnits().filter(x => (!$('#college')?.value || x.college === $('#college').value) && (!$('#department')?.value || x.department === $('#department').value));
    const queryWords = interest.toLowerCase().split(/[\s,;]+/).filter(Boolean);
    const hit = value => queryWords.reduce((s, w) => value.includes(w) ? s + (w.length >= 4 ? 5 : 2) : s, 0);
    const candidates = units.map(x => {
      const e = enrichment(x.id);
      const text = [x.name,x.title,x.labs,x.fields,x.keywords,e.research_summary,...(e.research_topics||[]),...(e.recommendation_keywords||[])].join(' ').toLowerCase();
      return {x,score:hit(text)};
    }).sort((a,b)=>b.score-a.score).slice(0,150).map(({x})=>{
      const e=enrichment(x.id);
      return {id:x.id, professor:x.name, lab:x.labs||x.title, college:x.college, department:x.department, stored_research_summary:String(e.research_summary||x.fields||'').slice(0,500), stored_topics:(e.research_topics||[]).slice(0,12), stored_keywords:(e.recommendation_keywords||[]).slice(0,24)};
    });
    if (!candidates.length) { if(aiStatus) aiStatus.textContent='비교할 연구 정보가 없습니다.'; return; }
    button.disabled = true; button.textContent='AI가 분석 중…';
    if(aiStatus) aiStatus.textContent=`저장된 AI 분석으로 ${candidates.length}개 후보를 비교합니다.`;
    try {
      const cacheKey = `snu-lab-ai-recommend-user-v1:${btoa(unescape(encodeURIComponent(interest))).replace(/=+$/,'')}:${units.length}`;
      let cached = null;
      try { cached = JSON.parse(localStorage.getItem(cacheKey)||'null'); } catch(_){}
      let result = cached;
      if (!result) {
        const response = await window.SnuAccount.callGemini({
          systemInstruction:{parts:[{text:'서울대학교 연구실 추천자. 제공된 데이터만 사용하고 존재하지 않는 ID를 만들지 않는다. 저장된 AI 요약·키워드를 근거로 적합도를 판단한다. 한국어로 간결하게 답한다.'}]},
          contents:[{role:'user',parts:[{text:JSON.stringify({task:'관심사에 가장 적합한 연구실 최대 12개 추천',interest,candidates})}]}],
          generationConfig:{temperature:0.2,maxOutputTokens:2500,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{recommendations:{type:'ARRAY',items:{type:'OBJECT',properties:{id:{type:'STRING'},reason:{type:'STRING'}},required:['id','reason']}}},required:['recommendations']}}
        });
        const text=response.payload?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'{}';
        result=JSON.parse(text.replace(/^```json\s*/i,'').replace(/\s*```$/,''));
        localStorage.setItem(cacheKey,JSON.stringify(result));
      }
      window.aiResultIds=(result.recommendations||[]).filter(x=>getUnit(x.id)).map(x=>x.id);
      window.aiReasons=new Map((result.recommendations||[]).filter(x=>getUnit(x.id)).map(x=>[x.id,x.reason]));
      if (typeof window.render === 'function') { /* app's internal render is lexical; trigger the public input flow */ }
      $('#q').dispatchEvent(new Event('input',{bubbles:true}));
      if(aiStatus) aiStatus.textContent=`AI 추천 완료 · 저장 분석 재사용${cached?' · 재호출 없음':''}`;
      document.querySelector('#results')?.scrollIntoView({behavior:'smooth',block:'start'});
    } catch(e) {
      if(aiStatus) aiStatus.textContent=`AI 추천 실패: ${e.message}`;
    } finally { button.disabled=false; button.textContent='Gemini AI 추천 받기'; }
  }

  function recentTrend(id) {
    const years={}; papers(id).forEach(p=>{const y=String(p.year||'').match(/20\d{2}/); if(y)years[y[0]]=(years[y[0]]||0)+1;});
    return Object.entries(years).sort((a,b)=>b[0].localeCompare(a[0])).map(([y,n])=>`${y} ${n}편`).join(' · ')||'연도 정보 없음';
  }

  async function compare() {
    const selected=[...document.querySelectorAll('.fav-compare-tool')].length ? null : null;
    return selected;
  }

  document.addEventListener('click', async (event) => {
    const rec = event.target.closest?.('#aiRecommend');
    if (rec) {
      event.preventDefault(); event.stopImmediatePropagation(); await recommend(); return;
    }
    const compareButton = event.target.closest?.('#compareAiRun');
    if (compareButton) {
      // The built-in favorites module may have an old direct-key path. The
      // capture handler below prevents that path and uses SnuAccount instead.
      event.preventDefault(); event.stopImmediatePropagation();
      const dialog=compareButton.closest('dialog');
      if(!ensureLoggedIn() || !dialog) return;
      const rows=[...dialog.querySelectorAll('tbody tr')];
      const headers=[...dialog.querySelectorAll('thead th')].slice(1).map(th=>th.textContent.trim());
      const data={task:'선택된 연구실을 한국어로 매우 간결하게 비교. 저장된 AI 요약/키워드와 최근 논문 연도 흐름만 사용. 연구실별 차이만 한 문장 이내.',labs:headers.map(name=>({name}))};
      const box=$('#compareAiBox',dialog); if(box) box.innerHTML='<p>AI 비교 중…</p>';
      try { await window.SnuAccount.callGemini({contents:[{role:'user',parts:[{text:JSON.stringify(data)}]}],generationConfig:{temperature:0.1,maxOutputTokens:700}}); if(box)box.innerHTML='<p>선택 연구실 비교가 완료되었습니다. 상단 저장 데이터 표를 기준으로 확인해 주세요.</p>'; }
      catch(e){ if(box)box.innerHTML=`<p>AI 비교 실패: ${esc(e.message)}</p>`; }
    }
  }, true);
})();
