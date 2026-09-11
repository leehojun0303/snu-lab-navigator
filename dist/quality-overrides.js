/* Quality layer for stored AI enrichment.
 * Keeps verified facts separate from raw link-discovery candidates and uses
 * stored research keywords/topics to reduce repeated Gemini recommendation work.
 */
(() => {
  const meta = window.AUTOMATION_META || {};
  const enrichmentForQuality = (x) => {
    const live = window.PRECOMPUTED_ENRICHMENT || {};
    if (live[x.id]) return live[x.id];
    try {
      const key = `snu-lab-enrichment-v2:${x.id}`;
      return JSON.parse(localStorage.getItem(key) || 'null') || {};
    } catch (_) { return {}; }
  };

  const text = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const terms = (x) => {
    const e = enrichmentForQuality(x);
    return text([
      x.name, x.title, x.labs, x.fields, x.keywords,
      e.research_summary, ...(e.research_topics || []),
      ...(e.recommendation_keywords || [])
    ].join(' ')).toLowerCase();
  };
  const words = (value) => text(value).toLowerCase().split(/[\s,;]+/).filter(Boolean);
  const hitScore = (haystack, queryWords) => queryWords.reduce((sum, w) => {
    if (w.length < 2) return sum;
    if (haystack.includes(w)) return sum + (w.length >= 4 ? 5 : 2);
    return sum;
  }, 0);

  function recommendationKey(query, collegeValue, departmentValue) {
    const base = `${meta.updated_at || 'no-meta'}|${query.trim().toLowerCase()}|${collegeValue || ''}|${departmentValue || ''}`;
    let hash = 2166136261;
    for (let i = 0; i < base.length; i++) hash = Math.imul(hash ^ base.charCodeAt(i), 16777619);
    return `snu-lab-ai-recommend-v3:${(hash >>> 0).toString(16)}`;
  }

  function groupedMembers(current, alumni) {
    const buckets = {
      '교수·연구원': [],
      '박사과정': [],
      '석사과정': [],
      '학부연구생': [],
      '기타 구성원': [],
      'Alumni': []
    };
    const seen = new Set();
    const normalize = (role) => {
      const r = text(role).toLowerCase();
      if (/(phd|doctoral|doctor|박사)/.test(r)) return '박사과정';
      if (/(master|석사)/.test(r)) return '석사과정';
      if (/(undergraduate|undergrad|학부)/.test(r)) return '학부연구생';
      if (/(professor|faculty|교수|research fellow|researcher|연구원)/.test(r)) return '교수·연구원';
      return '기타 구성원';
    };
    for (const item of current || []) {
      if (!item?.name || !item?.role) continue;
      const key = text(item.name).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      buckets[normalize(item.role)].push(item);
    }
    for (const item of alumni || []) {
      if (!item?.name) continue;
      const key = `alumni|${text(item.name).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      buckets.Alumni.push(item);
    }
    return buckets;
  }

  function membersHtmlQuality(x, activity, enrichment) {
    const current = Array.isArray(enrichment.current_members) ? enrichment.current_members : [];
    const alumni = Array.isArray(enrichment.alumni) ? enrichment.alumni : [];
    if (!current.length && !alumni.length) {
      return '<p class="activity-empty">AI 검증을 통과한 구성원 명단이 아직 없습니다.</p>';
    }
    const buckets = groupedMembers(current, alumni);
    const order = ['교수·연구원', '박사과정', '석사과정', '학부연구생', '기타 구성원', 'Alumni'];
    return order.filter(group => buckets[group].length).map(group => {
      const names = buckets[group].map(item => escapeHtml(`${item.name}${item.role ? ` (${item.role})` : ''}`)).join(' · ');
      return `<div class="member-group"><strong>${escapeHtml(group)} ${buckets[group].length}명</strong><span>${names}</span></div>`;
    }).join('');
  }

  window.activityHtml = function(x) {
    const activity = (window.RESEARCH_ACTIVITY || {})[x.id] || {};
    const enrichment = enrichmentForQuality(x) || {};
    const papers = Array.isArray(enrichment.recent_papers) ? enrichment.recent_papers : [];
    const pubPages = Array.isArray(enrichment.verified_publication_pages) ? enrichment.verified_publication_pages : [];
    const recruitPages = Array.isArray(enrichment.verified_recruitment_pages) ? enrichment.verified_recruitment_pages : [];
    const posterVerified = String(enrichment.poster_status || '').toLowerCase() === 'verified';
    const posterImage = posterVerified ? safeUrl(enrichment.poster_image_url) : '';
    const posterSource = posterVerified ? safeUrl(enrichment.poster_source_url) : '';
    const visibleCount = Number.isFinite(Number(enrichment.paper_count_visible)) ? Number(enrichment.paper_count_visible) : (papers.length || null);
    const summary = text(enrichment.research_summary || x.fields);

    const paperHtml = papers.length
      ? `<ul class="activity-list">${papers.map(item => `<li><div>${item.url ? `<a target="_blank" rel="noreferrer" href="${escapeHtml(safeUrl(item.url))}">${escapeHtml(item.title || '논문')}</a>` : `<span>${escapeHtml(item.title || '논문')}</span>`}${item.venue ? `<small>${escapeHtml(item.venue)}</small>` : ''}</div>${item.year ? `<span>${escapeHtml(item.year)}</span>` : ''}</li>`).join('')}</ul>`
      : pubPages.length
        ? evidencePageLinks(pubPages, 'AI가 연구실 관련 공식 연구성과 페이지로 검증한 출처입니다. 논문별 제목은 별도 확인된 항목만 표시합니다.')
        : '<p class="activity-empty">AI가 연구실의 논문·연구성과를 아직 확인하지 못했습니다.</p>';

    const recruitmentHtml = enrichment.recruitment_summary
      ? `<p class="activity-ai-text">${escapeHtml(enrichment.recruitment_summary)}</p>${recruitPages.length ? evidencePageLinks(recruitPages, 'AI가 현재 연구실 모집과 관련된 공식 출처로 검증했습니다.') : ''}`
      : '<p class="activity-empty">AI가 현재 연구실 모집 공고를 확인하지 못했습니다.</p>';

    const poster = posterImage
      ? `<a class="poster-found" target="_blank" rel="noreferrer" href="${escapeHtml(posterSource || posterImage)}"><img src="${escapeHtml(posterImage)}" alt="${escapeHtml(enrichment.poster_title || '연구실 포스터')}"><strong>${escapeHtml(enrichment.poster_title || '포스터 원문 보기')}</strong></a>`
      : `<div class="poster-empty" aria-label="포스터 미확인"><span>POSTER</span><p>${posterVerified ? escapeHtml(enrichment.poster_title || '연구 포스터는 확인되었지만 표시용 이미지가 없습니다.') : 'AI 검증을 통과한 연구실 포스터가 아직 없습니다.'}</p></div>`;

    const sourceUrl = safeUrl(enrichment.member_page_url);
    return `<section class="activity-wrap"><div class="activity-title"><div><h3>연구실 활동</h3><p>AI 검증과 공식 출처 확인을 통과한 항목만 표시합니다. 확인되지 않은 정보는 추정하지 않습니다.</p></div>${visibleCount !== null ? `<span>확인 논문 ${visibleCount}편</span>` : ''}</div>${summary ? `<p class="output-summary">${escapeHtml(summary)}</p>` : ''}<div class="activity-grid"><article class="activity-card papers"><h4>논문·연구성과</h4>${paperHtml}</article><article class="activity-card poster"><h4>포스터</h4>${poster}</article><article class="activity-card recruitment"><h4>모집</h4>${recruitmentHtml}</article><article class="activity-card members"><h4>구성원·동문</h4>${membersHtmlQuality(x, activity, enrichment)}${sourceUrl ? `<a class="small-link" target="_blank" rel="noreferrer" href="${escapeHtml(sourceUrl)}">AI 검증 구성원 근거 페이지</a>` : ''}</article></div></section>`;
  };

  window.runAiRecommendation = async function() {
    const userInterest = q.value.trim();
    if (!userInterest) {
      sort.value = 'match'; q.focus();
      aiStatus.textContent = '먼저 관심 분야를 문장이나 여러 키워드로 입력해 주세요.';
      return;
    }
    if (!geminiKey) {
      recommendAfterKey = true; aiKeyDialog.showModal(); return;
    }

    const filterUnits = units.filter(x => (!college.value || x.college === college.value) && (!department.value || x.department === department.value));
    const queryWords = words(userInterest);
    const ranked = filterUnits.map(x => ({x, score: hitScore(terms(x), queryWords)})).sort((a, b) => b.score - a.score);
    const strong = ranked.filter(item => item.score > 0).slice(0, 150);
    const fallback = strong.length ? strong : ranked.slice(0, 80);
    const candidates = fallback.map(({x}) => {
      const e = enrichmentForQuality(x);
      return {
        id: x.id,
        professor: x.name,
        lab: x.labs || x.title,
        college: x.college,
        department: x.department,
        research: text(x.fields).slice(0, 180),
        stored_research_summary: text(e.research_summary).slice(0, 500),
        stored_topics: (e.research_topics || []).slice(0, 12),
        stored_keywords: (e.recommendation_keywords || []).slice(0, 24)
      };
    }).filter(item => item.research || item.lab);
    if (!candidates.length) {
      aiStatus.textContent = '현재 필터 범위에는 AI가 비교할 연구 정보가 없습니다.';
      return;
    }

    const cacheKey = recommendationKey(userInterest, college.value, department.value);
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached?.recommendations?.length) {
        aiResultIds = cached.recommendations.map(item => item.id).filter(id => unitById.has(id));
        aiReasons = new Map(cached.recommendations.map(item => [item.id, item.reason]));
        sort.value = 'ai'; render();
        aiStatus.textContent = `저장된 AI 추천 결과를 사용했습니다. Gemini 재호출 없음 · 후보 ${candidates.length.toLocaleString()}개`; 
        return;
      }
    } catch (_) { /* stale or malformed cache */ }

    aiButton.disabled = true; aiButton.textContent = 'AI가 분석 중…';
    aiStatus.textContent = `저장된 연구 키워드로 후보를 ${filterUnits.length.toLocaleString()}개 → ${candidates.length.toLocaleString()}개로 먼저 줄인 뒤 Gemini가 비교합니다.`;
    try {
      const {payload, model} = await callGemini({
        systemInstruction: {parts: [{text: 'You are a university research-lab recommender. Candidate records include stored AI-derived research topics/keywords. Treat them as factual evidence already extracted from official sources, but do not invent unsupported facts. Recommend only IDs present in candidates. Compare research fit and explain concrete overlaps in Korean.'}]},
        contents: [{role: 'user', parts: [{text: JSON.stringify({task: '관심사에 가장 적합한 연구 단위 최대 12개를 적합도 순으로 추천', user_interest: userInterest, candidates})}]}],
        generationConfig: {temperature: 0.2, maxOutputTokens: 3000, responseMimeType: 'application/json', responseSchema: {type: 'OBJECT', properties: {recommendations: {type: 'ARRAY', items: {type: 'OBJECT', properties: {id: {type: 'STRING'}, reason: {type: 'STRING'}}, required: ['id', 'reason']}}}, required: ['recommendations']}}
      });
      const parsed = parseJsonResponse(payload);
      const recommendations = (parsed.recommendations || []).filter(item => unitById.has(item.id)).slice(0, 12);
      if (!recommendations.length) throw new Error('추천 결과가 비어 있습니다');
      aiResultIds = recommendations.map(item => item.id);
      aiReasons = new Map(recommendations.map(item => [item.id, item.reason]));
      sort.value = 'ai'; render();
      localStorage.setItem(cacheKey, JSON.stringify({saved_at: new Date().toISOString(), model, recommendations}));
      aiStatus.textContent = `AI 추천 완료 · ${model} · 저장된 분석 키워드를 활용한 상위 ${recommendations.length}개`;
    } catch (error) {
      aiStatus.textContent = error?.message || 'Gemini 추천 중 오류가 발생했습니다.';
    } finally {
      aiButton.disabled = false; aiButton.textContent = 'Gemini AI 추천 받기';
    }
  };

  const aiButtonElement = document.querySelector('#aiRecommend');
  if (aiButtonElement) aiButtonElement.onclick = window.runAiRecommendation;
})();
