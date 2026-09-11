(() => {
  'use strict';

  const MAX = 4;
  const units = () => [...(window.RESEARCH_UNITS || []), ...(window.RESEARCH_UNIT_SUPPLEMENTS || [])];
  const unit = id => units().find(x => String(x.id) === String(id));
  const enrich = id => (window.PRECOMPUTED_ENRICHMENT || {})[id] || {};
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  function selectedUnits() {
    const out = [];
    document.querySelectorAll('#results .card').forEach(card => {
      const tool = card.querySelector('.fav-compare-tool:nth-of-type(2)');
      if (!tool?.classList.contains('active')) return;
      const u = units()[Number(card.dataset.i)];
      if (u && !out.some(x => x.id === u.id)) out.push(u);
    });
    return out.slice(0, MAX);
  }

  function oneYearCount(u) {
    const e = enrich(u.id);
    const stored = Number(e.recent_one_year_paper_count);
    if (Number.isFinite(stored) && stored >= 0) return `${stored}편`;
    const papers = Array.isArray(e.recent_papers) ? e.recent_papers : [];
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
    return exact ? `${exact}편` : yearFallback ? `${yearFallback}편` : '확인 필요';
  }

  function keywords(u) {
    const e = enrich(u.id);
    return [...new Set([...(e.recommendation_keywords || []), ...(e.research_topics || []), ...String(u.keywords || '').split(/[;,|]/)].map(x => String(x).trim()).filter(Boolean))].slice(0, 7).join(' · ') || '확인 필요';
  }

  function memberSummary(u) {
    const e = enrich(u.id);
    const counts = {교수:0, 박사후연구원:0, 연구원:0, 박사과정:0, 석사과정:0, 학부연구생:0, 대학원생:0, 기타:0, Alumni: Array.isArray(e.alumni) ? e.alumni.length : 0};
    for (const p of e.current_members || []) {
      const r = String(p.member_group || p.role || '').toLowerCase();
      if (/postdoc|post-doctoral|postdoctoral|research fellow|박사후/.test(r)) counts.박사후연구원++;
      else if (/ph\.?d|doctoral|박사과정|박사/.test(r)) counts.박사과정++;
      else if (/master|석사과정|석사/.test(r)) counts.석사과정++;
      else if (/undergraduate|undergrad|학부연구생|학부생/.test(r)) counts.학부연구생++;
      else if (/graduate student|graduate researcher|대학원생/.test(r)) counts.대학원생++;
      else if (/professor|faculty|교수/.test(r)) counts.교수++;
      else if (/researcher|scientist|연구원/.test(r)) counts.연구원++;
      else counts.기타++;
    }
    return Object.entries(counts).filter(([,n]) => n > 0).map(([k,n]) => `${k} ${n}명`).join(' · ') || '확인 필요';
  }

  function buildDialog(items) {
    let d = document.querySelector('#stableCompareDialog');
    if (!d) {
      d = document.createElement('dialog');
      d.id = 'stableCompareDialog';
      d.className = 'fav-dialog';
      document.body.appendChild(d);
    }
    d.innerHTML = `<button type="button" class="fav-close" aria-label="닫기">×</button><h2>연구실 비교</h2><p>저장된 AI 요약·키워드와 최근 1년 논문 정보를 기준으로 비교합니다.</p><div class="stable-compare-table"><table><thead><tr><th>항목</th>${items.map(u => `<th>${esc(u.name)}<small>${esc(u.labs || u.title || '연구그룹')}</small></th>`).join('')}</tr></thead><tbody><tr><th>핵심 분야</th>${items.map(u => `<td>${esc(String(enrich(u.id).research_summary || u.fields || '확인 필요').slice(0, 260))}</td>`).join('')}</tr><tr><th>키워드</th>${items.map(u => `<td>${esc(keywords(u))}</td>`).join('')}</tr><tr><th>최근 1년 논문</th>${items.map(u => `<td>${esc(oneYearCount(u))}</td>`).join('')}</tr><tr><th>구성원</th>${items.map(u => `<td>${esc(memberSummary(u))}</td>`).join('')}</tr><tr><th>모집</th>${items.map(u => `<td>${esc(String(enrich(u.id).recruitment_summary || '확인 필요').slice(0, 180))}</td>`).join('')}</tr></tbody></table></div><div id="stableCompareAi" class="fav-ai-summary"><span>로그인되어 있으면 Gemini가 핵심 차이를 자동으로 정리합니다.</span></div>`;
    d.querySelector('.fav-close').onclick = () => d.close();
    if (!d.open) d.showModal();
    return d;
  }

  async function runAi(items, d) {
    const box = d.querySelector('#stableCompareAi');
    const svc = window.SnuAccount;
    if (!svc?.isLoggedIn?.()) return;
    box.innerHTML = '<span>Gemini가 연구 방향의 핵심 차이만 정리하는 중…</span>';
    try {
      const payload = {
        systemInstruction: {parts: [{text: '서울대학교 연구실 비교. 제공된 데이터만 사용한다. 최근 1년 논문 수를 다시 말하지 않는다. 각 연구실의 연구 방향, 대표적으로 확인된 연구 주제/논문, 차별점을 매우 짧게 작성한다. 정보가 없으면 확인 필요라고 한다.'}]},
        contents: [{role:'user', parts:[{text: JSON.stringify({task:'연구실 간 핵심 차이만 간결하게 비교', labs: items.map(u => { const e=enrich(u.id); return {id:u.id, name:u.name, lab:u.labs||u.title, summary:String(e.research_summary||u.fields||'').slice(0,350), keywords:keywords(u), papers:(e.recent_papers||[]).slice(0,8).map(p=>({title:p.title,year:p.year,date:p.date}))}; })})}]}],
        generationConfig: {temperature:0.1,maxOutputTokens:600,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{overall:{type:'STRING'},rows:{type:'ARRAY',items:{type:'OBJECT',properties:{id:{type:'STRING'},difference:{type:'STRING'}},required:['id','difference']}}},required:['overall','rows']}}
      };
      const result = await svc.callGemini(payload);
      const text = result.payload?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('') || '{}';
      const json = JSON.parse(text.replace(/^```json\s*/i,'').replace(/\s*```$/,''));
      const rows = (json.rows || []).filter(r => items.some(u => u.id === r.id)).slice(0,MAX);
      box.innerHTML = `<strong>핵심 차이</strong><div>${esc(json.overall || '')}</div>${rows.length ? `<div class="stable-ai-rows">${rows.map(r => `<p><strong>${esc(unit(r.id)?.name || r.id)}</strong> ${esc(r.difference || '')}</p>`).join('')}</div>` : ''}`;
    } catch (e) {
      box.innerHTML = '<span>핵심 차이 AI 분석을 완료하지 못했습니다. 위 비교표는 계속 사용할 수 있습니다.</span>';
    }
  }

  function install() {
    const style = document.createElement('style');
    style.textContent = '#stableCompareDialog{width:min(1100px,calc(100% - 24px));max-height:90vh}.stable-compare-table{overflow:auto}.stable-compare-table table{width:100%;border-collapse:collapse;font-size:.84rem}.stable-compare-table th,.stable-compare-table td{border-bottom:1px solid #dfe7ef;padding:11px;vertical-align:top;text-align:left}.stable-compare-table th:first-child{width:125px}.stable-compare-table small{display:block;color:#72849a;font-weight:500;margin-top:4px}.stable-ai-rows{margin-top:8px}.stable-ai-rows p{margin:7px 0}.fav-dialog .fav-ai-summary{margin-top:12px;padding:12px;border-left:3px solid #6b43c6;background:#faf7ff;border-radius:8px}';
    document.head.appendChild(style);
    document.addEventListener('click', event => {
      const btn = event.target.closest?.('#cmpOpen');
      if (!btn) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const items = selectedUnits();
      if (items.length < 2) return;
      const d = buildDialog(items);
      runAi(items,d);
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();
