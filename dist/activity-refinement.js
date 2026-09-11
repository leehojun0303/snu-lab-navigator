(() => {
  'use strict';
  const text = v => String(v || '').replace(/\s+/g, ' ').trim();
  const eFor = x => (window.PRECOMPUTED_ENRICHMENT || {})[x.id] || {};
  const aFor = x => (window.RESEARCH_ACTIVITY || {})[x.id] || {};
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const url = v => { try { const u = new URL(String(v || '')); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (_) { return ''; } };

  function memberGroup(role) {
    const r = text(role).toLowerCase();
    // Order matters: generic "researcher" must not turn a graduate-student
    // entry such as "Graduate Student Researcher" into a research-staff entry.
    if (/(graduate student|graduate researcher|graduate research student|대학원생)/.test(r)) {
      if (/(ph\.?d|doctoral|박사과정|박사)/.test(r)) return '박사과정';
      if (/(master|석사과정|석사)/.test(r)) return '석사과정';
      return '대학원생(세부과정 미확인)';
    }
    if (/(postdoc|post-doctoral|postdoctoral|research fellow|박사후연구원|박사후)/.test(r)) return '박사후연구원';
    if (/(ph\.?d|doctoral|doctor of philosophy|박사과정|박사)/.test(r)) return '박사과정';
    if (/(master|석사과정|석사)/.test(r)) return '석사과정';
    if (/(undergraduate|undergrad|학부연구생|학부생)/.test(r)) return '학부연구생';
    if (/(principal investigator|professor|faculty|교수)/.test(r)) return '교수';
    if (/(research scientist|scientist|researcher|연구원)/.test(r)) return '연구원';
    return '기타 구성원';
  }

  function grouped(current, alumni) {
    const order = ['교수','박사후연구원','연구원','박사과정','석사과정','학부연구생','대학원생(세부과정 미확인)','기타 구성원','Alumni'];
    const buckets = Object.fromEntries(order.map(k => [k, []]));
    const seen = new Set();
    for (const p of current || []) {
      if (!p?.name) continue;
      const key = text(p.name).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      buckets[memberGroup(p.member_group || p.role)].push(p);
    }
    for (const p of alumni || []) {
      if (!p?.name) continue;
      const key = `alumni|${text(p.name).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      buckets.Alumni.push(p);
    }
    return buckets;
  }

  function recentOneYearCount(x) {
    const e = eFor(x), a = aFor(x);
    for (const key of ['recent_one_year_paper_count','recentOneYearPaperCount']) {
      const n = Number(e[key] ?? a[key]);
      if (Number.isFinite(n) && n >= 0) return {count:n, exact:true};
    }
    const papers = Array.isArray(e.recent_papers) && e.recent_papers.length ? e.recent_papers : (a.papers || []);
    const now = new Date();
    const cutoff = new Date(now.getTime() - 365*24*60*60*1000);
    let exact = 0, year = 0;
    for (const p of papers) {
      const raw = p.date || p.published_at || p.publication_date || p.publishedAt;
      if (raw) {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime()) && d >= cutoff && d <= now) exact++;
      } else {
        const y = Number(String(p.year || '').match(/20\d{2}/)?.[0] || 0);
        if (y === now.getFullYear() || y === now.getFullYear()-1) year++;
      }
    }
    return {count: exact || year, exact: exact > 0};
  }

  window.activityHtml = function(x) {
    const a = aFor(x), e = eFor(x);
    const papers = Array.isArray(e.recent_papers) && e.recent_papers.length ? e.recent_papers : (a.papers || []);
    const pages = Array.isArray(e.verified_publication_pages) ? e.verified_publication_pages : (a.publicationPages || []);
    const recruit = Array.isArray(e.verified_recruitment_pages) ? e.verified_recruitment_pages : (a.recruitmentPages || []);
    const members = Array.isArray(e.current_members) ? e.current_members : [];
    const alumni = Array.isArray(e.alumni) ? e.alumni : [];
    const oneYear = recentOneYearCount(x);
    const paperVisible = Number(e.paper_count_visible);
    const countLabel = Number.isFinite(paperVisible) ? paperVisible : papers.length;
    const paperHtml = papers.length ? `<ul class="activity-list">${papers.slice(0,12).map(p => { const u=url(p.url); return `<li><div>${u?`<a target="_blank" rel="noreferrer" href="${esc(u)}">${esc(p.title || '논문')}</a>`:`<span>${esc(p.title || '논문')}</span>`}${p.venue?`<small>${esc(p.venue)}</small>`:''}</div>${p.year?`<span>${esc(p.year)}</span>`:''}</li>`; }).join('')}</ul>` : (pages.length ? evidencePageLinks(pages,'AI가 연구실 관련 공식 연구성과 페이지로 검증한 출처입니다. 논문별 제목은 별도 확인된 항목만 표시합니다.') : '<p class="activity-empty">AI가 연구실의 논문·연구성과를 아직 확인하지 못했습니다.</p>');
    const recruitHtml = e.recruitment_summary ? `<p class="activity-ai-text">${esc(e.recruitment_summary)}</p>${recruit.length?evidencePageLinks(recruit,'AI가 현재 연구실 모집과 관련된 공식 출처로 검증했습니다.'):''}` : '<p class="activity-empty">AI가 현재 연구실 모집 공고를 확인하지 못했습니다.</p>';
    const posterVerified = String(e.poster_status || a.posterStatus || '').toLowerCase() === 'verified';
    const posterImage = posterVerified ? url(e.poster_image_url) : '';
    const posterSource = posterVerified ? url(e.poster_source_url) : '';
    const poster = posterImage ? `<a class="poster-found" target="_blank" rel="noreferrer" href="${esc(posterSource || posterImage)}"><img src="${esc(posterImage)}" alt="${esc(e.poster_title || '연구실 포스터')}"><strong>${esc(e.poster_title || '포스터 원문 보기')}</strong></a>` : '<div class="poster-empty" aria-label="포스터 미확인"><span>POSTER</span><p>AI 검증을 통과한 연구실 포스터가 아직 없습니다.</p></div>';
    const buckets = grouped(members, alumni);
    const memberHtml = Object.entries(buckets).filter(([,list]) => list.length).map(([group,list]) => `<div class="member-group"><strong>${esc(group)} ${list.length}명</strong><span>${list.map(p => esc(`${p.name}${p.role ? ` (${p.role})` : ''}`)).join(' · ')}</span></div>`).join('') || '<p class="activity-empty">AI 검증을 통과한 구성원 명단이 아직 없습니다.</p>';
    const memberSource = url(e.member_page_url);
    const summary = text(e.research_summary || x.fields);
    return `<section class="activity-wrap"><div class="activity-title"><div><h3>연구실 활동</h3><p>AI 검증과 공식 출처 확인을 통과한 항목만 표시합니다. 확인되지 않은 정보는 추정하지 않습니다.</p></div><div class="activity-metrics"><span>확인 논문 ${countLabel}편</span><span>최근 1년 ${oneYear.count}편${oneYear.exact ? '' : ' (연도 기준)'}</span></div></div>${summary?`<p class="output-summary">${esc(summary)}</p>`:''}<div class="activity-grid"><article class="activity-card papers"><h4>논문·연구성과</h4>${paperHtml}</article><article class="activity-card poster"><h4>포스터</h4>${poster}</article><article class="activity-card recruitment"><h4>모집</h4>${recruitHtml}</article><article class="activity-card members"><h4>구성원·동문</h4>${memberHtml}${memberSource?`<a class="small-link" target="_blank" rel="noreferrer" href="${esc(memberSource)}">AI 검증 구성원 근거 페이지</a>`:''}</article></div></section>`;
  };

  const style = document.createElement('style');
  style.textContent = '.activity-metrics{display:flex;gap:8px;flex-wrap:wrap}.activity-metrics span{padding:7px 10px;border-radius:999px;background:#f2f7fc;color:#31516f;font-size:.78rem;font-weight:700}.member-group{display:flex;flex-direction:column;gap:2px;margin:9px 0}.member-group strong{font-size:.9rem}.member-group span{color:#5f7288;line-height:1.55}';
  document.head.appendChild(style);
})();
