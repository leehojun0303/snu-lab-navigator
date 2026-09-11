/* College-aware detail views and automatic AI fallback search. */
(() => {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean = v => String(v || '').replace(/\s+/g, ' ').trim();
  const safeUrl = v => { try { const u = new URL(String(v || '')); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (_) { return ''; } };
  const allUnits = () => [...(window.RESEARCH_UNITS || []), ...(window.RESEARCH_UNIT_SUPPLEMENTS || [])];
  const enrichment = x => (window.PRECOMPUTED_ENRICHMENT || {})[x.id] || {};
  const activity = x => (window.RESEARCH_ACTIVITY || {})[x.id] || {};
  const fallbackActivityHtml = window.activityHtml;

  function profile(x) {
    const college = clean(x.college);
    if (/음악대학/.test(college)) return 'music';
    if (/미술대학/.test(college)) return 'fine_arts';
    if (/인문대학/.test(college)) return 'humanities';
    return 'scholarly';
  }
  function verifiedItems(items, empty) {
    const list = (Array.isArray(items) ? items : []).filter(item => item && clean(item.title || item.name));
    if (!list.length) return '<p class="activity-empty">' + esc(empty) + '</p>';
    return '<ul class="activity-list">' + list.slice(0, 12).map(item => {
      const label = clean(item.title || item.name);
      const note = clean(item.venue || item.organization || item.role || item.description);
      const date = clean(item.date || item.year);
      const link = safeUrl(item.url);
      return '<li><div>' + (link ? '<a target="_blank" rel="noreferrer" href="' + esc(link) + '">' + esc(label) + '</a>' : '<span>' + esc(label) + '</span>') + (note ? '<small>' + esc(note) + '</small>' : '') + '</div>' + (date ? '<span>' + esc(date) + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function sourceLink(e) {
    const urls = [...new Set((e.source_urls_used || []).map(safeUrl).filter(Boolean))].slice(0, 4);
    return urls.length ? '<div class="ai-sources"><strong>공식 확인 출처</strong>' + urls.map((u, i) => '<a target="_blank" rel="noreferrer" href="' + esc(u) + '">공식 페이지 ' + (i + 1) + '</a>').join('') + '</div>' : '';
  }
  function creativeActivityHtml(x, type) {
    const e = enrichment(x);
    const a = activity(x);
    const isMusic = type === 'music';
    const title = isMusic ? '음악 활동' : '예술 활동';
    const subtitle = isMusic
      ? '공식 출처에서 확인된 연주·작품·수상·교육 활동만 표시합니다.'
      : '개인전·단체전은 공식 출처에서 날짜가 확인된 최근 1년 활동만 표시합니다.';
    const cards = isMusic ? [
      ['최근 공연·발표', verifiedItems(e.recent_performances, '최근 공연·발표 실적을 아직 확인하지 못했습니다.')],
      ['작품·음반·창작 실적', verifiedItems(e.creative_works, '확인된 작품·음반·창작 실적이 아직 없습니다.')],
      ['수상·주요 실적', verifiedItems(e.awards, '확인된 수상·주요 실적이 아직 없습니다.')],
      ['전공·교육 활동', '<p class="activity-ai-text">' + esc(clean(e.education_summary || e.research_summary || x.fields) || '공식 소개의 전공·교육 활동 설명을 수집 중입니다.') + '</p>']
    ] : [
      ['최근 1년 개인전', verifiedItems(e.recent_solo_exhibitions, '최근 1년 개인전이 공식 출처에서 확인되지 않았습니다.')],
      ['최근 1년 단체전', verifiedItems(e.recent_group_exhibitions, '최근 1년 단체전이 공식 출처에서 확인되지 않았습니다.')],
      ['작품·수상', verifiedItems([...(e.creative_works || []), ...(e.awards || [])], '확인된 작품·수상 실적이 아직 없습니다.')],
      ['전공·교육 활동', '<p class="activity-ai-text">' + esc(clean(e.education_summary || e.research_summary || x.fields) || '공식 소개의 전공·교육 활동 설명을 수집 중입니다.') + '</p>']
    ];
    return '<section class="activity-wrap discipline-activity ' + type + '"><div class="activity-title"><div><h3>' + title + '</h3><p>' + subtitle + '</p></div></div><div class="activity-grid">' + cards.map(([heading, body]) => '<article class="activity-card"><h4>' + heading + '</h4>' + body + '</article>').join('') + '</div>' + sourceLink(e) + '</section>';
  }
  function humanitiesActivityHtml(x) {
    const e = enrichment(x);
    const a = activity(x);
    const papers = Array.isArray(e.recent_papers) && e.recent_papers.length ? e.recent_papers : (a.papers || []);
    return '<section class="activity-wrap discipline-activity humanities"><div class="activity-title"><div><h3>학술 활동</h3><p>공식 출처에서 확인된 논문·저서·학술발표·연구과제만 표시합니다.</p></div></div><div class="activity-grid">' +
      '<article class="activity-card"><h4>논문</h4>' + verifiedItems(papers, '확인된 논문 목록이 아직 없습니다.') + '</article>' +
      '<article class="activity-card"><h4>저서·편저</h4>' + verifiedItems(e.books, '확인된 저서·편저 목록이 아직 없습니다.') + '</article>' +
      '<article class="activity-card"><h4>학술발표</h4>' + verifiedItems(e.conference_presentations, '확인된 학술발표 목록이 아직 없습니다.') + '</article>' +
      '<article class="activity-card"><h4>연구과제</h4>' + verifiedItems(e.research_projects, '확인된 연구과제가 아직 없습니다.') + '</article></div>' + sourceLink(e) + '</section>';
  }
  window.activityHtml = function(x) {
    const kind = profile(x);
    if (kind === 'music' || kind === 'fine_arts') return creativeActivityHtml(x, kind);
    if (kind === 'humanities') return humanitiesActivityHtml(x);
    return fallbackActivityHtml ? fallbackActivityHtml(x) : '';
  };

  const input = document.querySelector('#q');
  const status = document.querySelector('#aiStatus');
  const results = document.querySelector('#results');
  const sort = document.querySelector('#sort');
  const aiButton = document.querySelector('#aiRecommend');
  const aiOption = sort && [...sort.options].find(option => option.value === 'ai');
  if (aiOption) aiOption.remove();
  if (aiButton) aiButton.closest('.ai-actions')?.remove();
  let timer = 0, activeKey = '', lastShownKey = '';

  function scoreCandidate(unit, query) {
    const e = enrichment(unit);
    const terms = [unit.name, unit.title, unit.labs, unit.fields, unit.keywords, e.research_summary, ...(e.research_topics || []), ...(e.recommendation_keywords || [])].map(v => clean(v).toLowerCase()).join(' ');
    const tokens = query.toLowerCase().split(/[\s,;]+/).filter(Boolean);
    let score = tokens.reduce((sum, token) => sum + (terms.includes(token) ? Math.min(20, token.length * 2) : 0), 0);
    const compact = terms.replace(/\s/g, '');
    for (const token of tokens) {
      const t = token.replace(/\s/g, '');
      if (t.length >= 2 && compact.includes(t)) score += t.length;
    }
    return score;
  }
  function cacheKey(query, college, department) {
    const raw = [window.AUTOMATION_META?.updated_at || 'static', query.toLowerCase(), college, department].join('|');
    let hash = 2166136261; for (let i = 0; i < raw.length; i++) hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619);
    return 'snu-lab-no-match-ai-v1:' + (hash >>> 0).toString(16);
  }
  function renderAi(items) {
    results.innerHTML = items.map(item => {
      const x = item.unit, e = enrichment(x), photo = safeUrl(String(x.photo || '').split(/[;,|]/)[0]);
      const avatar = photo ? '<span class="avatar avatar-stack"><img class="avatar-photo loaded" src="' + esc(photo) + '" alt="' + esc(x.name) + ' 교수 사진" loading="lazy"><span class="avatar-initial" hidden>' + esc(String(x.name || '?')[0]) + '</span></span>' : '<span class="avatar fallback">' + esc(String(x.name || '?')[0]) + '</span>';
      const lab = clean(String(x.labs || x.title || '연구그룹').split(/[;|]/)[0]);
      return '<button class="card" data-i="' + allUnits().indexOf(x) + '">' + avatar + '<span class="card-copy"><h2>' + esc(x.name + ' 교수 / ' + lab) + '</h2><span class="meta">' + esc([x.college, x.department, x.rank].filter(Boolean).join(' · ')) + '</span><span class="ai-reason"><strong>AI 추천 이유</strong>' + esc(item.reason) + '</span></span></button>';
    }).join('') || '<p class="empty">AI가 공식 저장 정보에서 적합한 후보를 찾지 못했습니다.</p>';
  }
  async function recommendWhenNoMatch() {
    const query = clean(input?.value);
    if (!query || document.querySelectorAll('#results .card').length) return;
    const college = document.querySelector('#college')?.value || '';
    const department = document.querySelector('#department')?.value || '';
    const key = cacheKey(query, college, department);
    if (activeKey === key || lastShownKey === key) return;
    if (!window.SnuAccount?.isLoggedIn?.()) {
      if (status) status.textContent = '일치하는 교수·연구실·키워드가 없어 AI로 유사 연구 단위를 찾으려면 로그인해 주세요.';
      window.SnuAccount?.open?.();
      return;
    }
    const pool = allUnits().filter(x => (!college || x.college === college) && (!department || x.department === department));
    const candidates = pool.map(x => ({x, score: scoreCandidate(x, query)})).sort((a,b) => b.score - a.score || String(a.x.name).localeCompare(String(b.x.name), 'ko')).slice(0, 160).map(({x}) => {
      const e = enrichment(x);
      return {id:x.id, professor:x.name, lab:x.labs || x.title, college:x.college, department:x.department, research_summary:clean(e.research_summary || x.fields).slice(0,500), topics:(e.research_topics || []).slice(0,12), keywords:(e.recommendation_keywords || []).slice(0,18)};
    }).filter(x => x.research_summary || x.lab);
    if (!candidates.length) return;
    activeKey = key;
    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null');
      let recommendations = cached?.recommendations;
      if (!recommendations) {
        if (status) status.textContent = '일치하는 결과가 없어 저장된 공식 연구 정보를 바탕으로 AI가 유사한 연구 단위를 찾고 있습니다…';
        const response = await window.SnuAccount.callGemini({
          systemInstruction:{parts:[{text:'서울대학교 연구실 추천자. 검색어와 후보 데이터만 사용한다. 후보에 없는 ID를 만들지 않는다. 검색어의 의미를 해석해 가장 가까운 후보만 한국어로 짧게 추천하고, 근거 없는 사실은 쓰지 않는다.'}]},
          contents:[{role:'user',parts:[{text:JSON.stringify({task:'검색 결과가 0개일 때 가장 가까운 서울대학교 교수·연구실 최대 12개 추천',search_query:query,candidates})}]}],
          generationConfig:{temperature:0.15,maxOutputTokens:2600,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:{recommendations:{type:'ARRAY',items:{type:'OBJECT',properties:{id:{type:'STRING'},reason:{type:'STRING'}},required:['id','reason']}}},required:['recommendations']}}
        });
        const raw = response.payload?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '{}';
        recommendations = (JSON.parse(raw.replace(/^\`\`\`json\s*/i, '').replace(/\s*\`\`\`$/, '')).recommendations || []).filter(item => allUnits().some(x => x.id === item.id)).slice(0, 12);
        localStorage.setItem(key, JSON.stringify({saved_at:new Date().toISOString(), recommendations}));
      }
      const byId = new Map(allUnits().map(x => [x.id, x]));
      renderAi(recommendations.map(item => ({unit:byId.get(item.id), reason:clean(item.reason)})).filter(item => item.unit));
      if (status) status.textContent = '직접 일치 결과는 없지만, 저장된 공식 정보 기준으로 AI가 유사한 연구 단위를 추천했습니다.';
      lastShownKey = key;
    } catch (error) {
      if (status) status.textContent = 'AI 유사 추천을 완료하지 못했습니다: ' + (error?.message || '알 수 없는 오류');
    } finally { activeKey = ''; }
  }
  input?.addEventListener('input', () => { clearTimeout(timer); lastShownKey = ''; timer = setTimeout(recommendWhenNoMatch, 650); });
})();