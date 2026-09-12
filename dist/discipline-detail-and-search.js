/* College-aware detail views and automatic AI fallback search. */
(() => {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean = v => String(v || '').replace(/\s+/g, ' ').trim();
  const displayValue = v => { const value = clean(v); return /^(n\/?a|na|없음|미상|unknown|null|undefined|-+)$/i.test(value) ? '' : value; };
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
  function verifiedItems(items, empty, withSummary = false) {
    const list = (Array.isArray(items) ? items : []).filter(item => item && clean(item.title || item.name));
    if (!list.length) return '<p class="activity-empty">' + esc(empty) + '</p>';
    return '<ul class="activity-list compact-list">' + list.slice(0, 3).map(item => {
      const label = displayValue(item.title || item.name);
      const note = displayValue(item.venue || item.organization || item.role || item.description);
      const date = displayValue(item.date || item.year);
      const summary = withSummary ? displayValue(item.summary) : '';
      const link = safeUrl(item.url);
      return '<li><div>' + (link ? '<a target="_blank" rel="noreferrer" href="' + esc(link) + '">' + esc(label) + '</a>' : '<span>' + esc(label) + '</span>') + (note ? '<small>' + esc(note) + '</small>' : '') + (summary ? '<p class="item-summary">' + esc(summary) + '</p>' : (withSummary ? '<p class="item-summary pending-summary">논문 요약 수집 중</p>' : '')) + '</div>' + (date ? '<span>' + esc(date) + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function sourceLink() {
    return '';
  }
  function posterCard(e, a = {}) {
    const verified = String(e.poster_status || a.posterStatus || '').toLowerCase() === 'verified';
    const image = verified ? safeUrl(e.poster_image_url) : '';
    const source = verified ? safeUrl(e.poster_source_url) : '';
    if (!image) return '';
    return '<div class="activity-grid poster-grid"><article class="activity-card poster"><h4>연구 포스터</h4><a class="poster-found" target="_blank" rel="noreferrer" href="' + esc(source || image) + '"><img src="' + esc(image) + '" alt="' + esc(e.poster_title || '연구 포스터') + '"><strong>' + esc(e.poster_title || '포스터 원문 보기') + '</strong></a></article></div>';
  }
  function creativeActivityHtml(x, type) {
    const e = enrichment(x);
    const a = activity(x);
    const isMusic = type === 'music';
    const title = isMusic ? '음악 활동' : '예술 활동';
    const subtitle = isMusic
      ? '공식 출처에서 확인된 공연·작품·교육 활동을 핵심 항목만 보여줍니다.'
      : '개인전·단체전은 날짜가 확인된 최근 1년 활동만, 최대 3건씩 보여줍니다.';
    const cards = isMusic ? [
      ['최근 공연·발표', verifiedItems(e.recent_performances, '최근 공연·발표 실적을 아직 확인하지 못했습니다.')],
      ['작품·창작 실적', verifiedItems(e.creative_works, '확인된 작품·창작 실적이 아직 없습니다.')],
      ['전공·교육 활동', '<p class="activity-ai-text">' + esc(clean(e.education_summary || e.research_summary || x.fields) || '공식 소개의 전공·교육 활동 설명을 수집 중입니다.') + '</p>']
    ] : [
      ['최근 1년 개인전', verifiedItems(e.recent_solo_exhibitions, '최근 1년 개인전이 공식 출처에서 확인되지 않았습니다.')],
      ['최근 1년 단체전', verifiedItems(e.recent_group_exhibitions, '최근 1년 단체전이 공식 출처에서 확인되지 않았습니다.')],
      ['전공·교육 활동', '<p class="activity-ai-text">' + esc(clean(e.education_summary || e.research_summary || x.fields) || '공식 소개의 전공·교육 활동 설명을 수집 중입니다.') + '</p>']
    ];
    return '<section class="activity-wrap discipline-activity ' + type + '"><div class="activity-title"><div><h3>' + title + '</h3><p>' + subtitle + '</p></div></div><div class="activity-grid">' + cards.map(([heading, body]) => '<article class="activity-card"><h4>' + heading + '</h4>' + body + '</article>').join('') + '</div>' + posterCard(e, a) + sourceLink(e) + '</section>';
  }
  function humanitiesActivityHtml(x) {
    const e = enrichment(x);
    const a = activity(x);
    const papers = Array.isArray(e.recent_papers) && e.recent_papers.length ? e.recent_papers : (a.papers || []);
    return '<section class="activity-wrap discipline-activity humanities"><div class="activity-title"><div><h3>학술 활동</h3><p>공식 출처에서 확인된 핵심 학술 활동만, 항목별 최대 3건으로 보여줍니다.</p></div></div><div class="activity-grid">' +
      '<article class="activity-card"><h4>최근 논문</h4>' + verifiedItems(papers, '확인된 논문 목록이 아직 없습니다.', true) + '</article>' +
      '<article class="activity-card"><h4>저서·편저</h4>' + verifiedItems(e.books, '확인된 저서·편저 목록이 아직 없습니다.') + '</article>' +
      '<article class="activity-card"><h4>연구과제·학술발표</h4>' + verifiedItems([...(e.research_projects || []), ...(e.conference_presentations || [])], '확인된 연구과제·학술발표가 아직 없습니다.') + '</article></div>' + posterCard(e, a) + sourceLink(e) + '</section>';
  }
  function paperStatsHtml(e) {
    const total = Number.isInteger(e.recent_year_paper_count) ? e.recent_year_paper_count : null;
    const groups = (Array.isArray(e.recent_year_papers_by_venue) ? e.recent_year_papers_by_venue : [])
      .filter(item => item && clean(item.venue) && Number.isInteger(item.count) && item.count > 0).slice(0, 6);
    if (total === null && !groups.length) return '<p class="paper-stats pending-summary">최근 1년 논문 수·게재처별 통계 수집 중</p>';
    return '<div class="paper-stats">' + (total !== null ? '<p>최근 1년 논문 <strong>총 ' + esc(total) + '편</strong></p>' : '') +
      (groups.length ? '<p class="paper-venues">게재처별: ' + groups.map(item => esc(clean(item.venue) + ' ' + item.count + '편')).join(' · ') + '</p>' : '') + '</div>';
  }
  function academicActivityHtml(x) {
    const e = enrichment(x), a = activity(x);
    const papers = Array.isArray(e.recent_papers) && e.recent_papers.length ? e.recent_papers : (a.papers || []);
    const people = Array.isArray(e.current_members) ? e.current_members : [];
    const recruitmentUrl = safeUrl(e.recruitment_source_url) || safeUrl((e.verified_recruitment_pages || [])[0]?.url);
    const groups = people.reduce((acc, person) => {
      const role = clean(person.role);
      const key = /박사/.test(role) ? '박사과정' : /석사/.test(role) ? '석사과정' : /학부/.test(role) ? '학부연구생' : /교수|연구원|postdoc/i.test(role) ? '교수·연구원' : '기타';
      acc[key] = (acc[key] || 0) + 1; return acc;
    }, {});
    const memberText = Object.entries(groups).map(([name, count]) => name + ' ' + count + '명').join(' · ');
    return '<section class="activity-wrap discipline-activity scholarly"><div class="activity-title"><div><h3>연구실 핵심 정보</h3></div></div><div class="activity-grid">' +
      '<article class="activity-card"><h4>최신 논문 3편</h4>' + paperStatsHtml(e) + verifiedItems(papers, '확인된 최근 논문이 아직 없습니다.', true) + '</article>' +
      '<article class="activity-card"><h4>모집 현황</h4><p class="activity-ai-text">' + esc(clean(e.recruitment_summary) || '현재 모집으로 검증된 공식 안내가 없습니다.') + '</p>' + (recruitmentUrl ? '<a class="small-link" target="_blank" rel="noreferrer" href="' + esc(recruitmentUrl) + '">모집 공식 안내</a>' : '') + '</article>' +
      '<article class="activity-card"><h4>구성</h4><p class="activity-ai-text">' + esc(memberText || '확인된 구성원 현황이 아직 없습니다.') + '</p></article></div>' + posterCard(e, a) + sourceLink(e) + '</section>';
  }
  window.activityHtml = function(x) {
    const kind = profile(x);
    if (kind === 'music' || kind === 'fine_arts') return creativeActivityHtml(x, kind);
    if (kind === 'humanities') return humanitiesActivityHtml(x);
    return academicActivityHtml(x);
  };

  const input = document.querySelector('#q');
  const status = document.querySelector('#aiStatus');
  const results = document.querySelector('#results');
  const sort = document.querySelector('#sort');
  const aiButton = document.querySelector('#aiRecommend');
  const aiOption = sort && [...sort.options].find(option => option.value === 'ai');
  if (aiOption) aiOption.remove();
  if (aiButton) aiButton.remove();
  document.querySelector('.ai-actions')?.classList.add('automatic-ai-status');
  if (status) status.textContent = '일반 검색 결과는 입력과 동시에 표시됩니다. 일치 결과가 없을 때만 Enter 또는 AI 유사 검색을 눌러 추천을 요청할 수 있습니다.';

  const searchButton = document.createElement('button');
  searchButton.id = 'aiSearchRun';
  searchButton.type = 'button';
  searchButton.className = 'ai-search-run';
  searchButton.setAttribute('aria-label', 'AI 유사 검색 실행');
  searchButton.innerHTML = '<span aria-hidden="true">→</span>';
  if (input?.parentElement) {
    const row = document.createElement('div');
    row.className = 'ai-search-row';
    input.parentElement.insertBefore(row, input);
    row.append(input, searchButton);
  }
  const style = document.createElement('style');
  style.textContent = '.ai-search-row{position:relative;display:block}.ai-search-row #q{box-sizing:border-box;padding-right:58px}.ai-search-run{position:absolute;right:8px;top:50%;transform:translateY(-50%);min-height:36px;width:38px;padding:0;border:0;border-radius:9px;background:#135fbe;color:#fff;font:700 .78rem system-ui,-apple-system,"Noto Sans KR",sans-serif;cursor:pointer;white-space:nowrap}.ai-search-run:disabled{opacity:.6;cursor:wait}@media(max-width:430px){.ai-search-row #q{padding-right:52px}.ai-search-run{right:6px;width:36px;padding:0;font-size:1rem}}.item-summary{margin:4px 0 0;color:#64748b;font-size:.8rem;line-height:1.45}.pending-summary{color:#7c6a48}.paper-stats{margin:0 0 10px;padding:8px 9px;border-radius:8px;background:#f6f8fc;color:#475569;font-size:.78rem;line-height:1.45}.paper-stats p{margin:0}.paper-venues{margin-top:3px!important}.compare-focus{display:block;margin-top:5px;color:#5b4a7b;font-size:.78rem;line-height:1.45}';
  document.head.appendChild(style);
  let activeKey = '', lastShownKey = '';

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
    return 'snu-lab-no-match-ai-v2:' + (hash >>> 0).toString(16);
  }
  function renderAi(items) {
    results.innerHTML = items.map(item => {
      const x = item.unit, photo = safeUrl(String(x.photo || '').split(/[;,|]/)[0]);
      const avatar = photo ? '<span class="avatar avatar-stack"><img class="avatar-photo loaded" src="' + esc(photo) + '" alt="' + esc(x.name) + ' 교수 사진" loading="lazy"><span class="avatar-initial" hidden>' + esc(String(x.name || '?')[0]) + '</span></span>' : '<span class="avatar fallback">' + esc(String(x.name || '?')[0]) + '</span>';
      const lab = clean(String(x.labs || x.title || '연구그룹').split(/[;|]/)[0]);
      const affiliation = typeof window.SnuAffiliationLabel === 'function'
        ? window.SnuAffiliationLabel(x)
        : [x.college, x.department].filter(Boolean).join(' ');
      return '<button class="card" data-i="' + allUnits().indexOf(x) + '">' + avatar + '<span class="card-copy"><h2>' + esc(x.name + ' 교수 / ' + lab) + '</h2><span class="meta">' + esc([affiliation, x.rank].filter(Boolean).join(' · ')) + '</span><span class="ai-reason"><strong>AI 유사 추천 이유</strong>' + esc(item.reason) + '</span></span></button>';
    }).join('') || '<p class="empty">AI가 공식 저장 정보에서 적합한 후보를 찾지 못했습니다.</p>';
  }
  async function runAiFallback() {
    const query = clean(input?.value);
    if (!query) { input?.focus(); if (status) status.textContent = '먼저 검색어를 입력해 주세요.'; return; }
    if (document.querySelectorAll('#results .card').length) {
      if (status) status.textContent = '직접 일치하는 결과를 실시간으로 표시하고 있습니다. AI 유사 검색은 일치 결과가 없을 때 사용합니다.';
      return;
    }
    const college = document.querySelector('#college')?.value || '';
    const department = document.querySelector('#department')?.value || '';
    const key = cacheKey(query, college, department);
    if (activeKey === key || lastShownKey === key) return;
    if (!window.SnuAccount?.isLoggedIn?.()) {
      if (status) status.textContent = '일치하는 결과가 없습니다. AI 유사 검색을 사용하려면 로그인해 주세요.';
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
    searchButton.disabled = true; searchButton.textContent = '검색 중…';
    try {
      const cached = JSON.parse(localStorage.getItem(key) || 'null');
      let recommendations = cached?.recommendations;
      if (!recommendations) {
        if (status) status.textContent = '일치 결과가 없어 저장된 공식 연구 정보를 바탕으로 AI가 유사한 연구 단위를 찾고 있습니다…';
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
      const message = String(error?.message || '');
      if (status) status.textContent = /(^|\\D)401(\\D|$)|authentication|unauthorized/i.test(message)
        ? 'AI 서버 인증 오류입니다. 앱 검색 문제가 아니라 Gemini 프록시 배포·서버 키 설정을 점검해야 합니다.'
        : 'AI 유사 추천을 완료하지 못했습니다: ' + (message || '알 수 없는 오류');
    } finally {
      activeKey = ''; searchButton.disabled = false; searchButton.innerHTML = '<span aria-hidden="true">→</span>';
    }
  }
  function simplifyDetailLinks() {
    const dialog = document.querySelector('#detail');
    if (!dialog?.open) return;
    dialog.querySelectorAll('.research-section .ai-sources').forEach(node => node.remove());
    dialog.querySelectorAll('.actions a').forEach(link => {
      if (clean(link.textContent) !== '연구실 홈페이지') link.remove();
    });
  }
  const detailObserver = new MutationObserver(simplifyDetailLinks);
  detailObserver.observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['open']});

  searchButton.addEventListener('click', runAiFallback);
  input?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); runAiFallback(); } });

})();