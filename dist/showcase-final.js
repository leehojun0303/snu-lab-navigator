(() => {
  'use strict';
  const units = () => [...(window.RESEARCH_UNITS || []), ...(window.RESEARCH_UNIT_SUPPLEMENTS || [])];
  const enrich = id => (window.PRECOMPUTED_ENRICHMENT || {})[id] || {};
  const activity = id => (window.RESEARCH_ACTIVITY || {})[id] || {};
  const text = v => String(v || '').replace(/\s+/g, ' ').trim();
  const countMembers = (e,a) => {
    const current = Array.isArray(e.current_members) ? e.current_members.length : 0;
    const alumni = Array.isArray(e.alumni) ? e.alumni.length : 0;
    if (current + alumni) return current + alumni;
    let n = 0;
    if (a.members && typeof a.members === 'object') for (const v of Object.values(a.members)) n += Array.isArray(v) ? v.length : 0;
    return n;
  };
  const score = x => {
    const e = enrich(x.id), a = activity(x.id);
    const papers = Array.isArray(e.recent_papers) && e.recent_papers.length ? e.recent_papers : (Array.isArray(a.papers) ? a.papers : []);
    const memberCount = countMembers(e,a);
    const summary = text(e.research_summary);
    const topics = Array.isArray(e.research_topics) ? e.research_topics.length : 0;
    const keywords = Array.isArray(e.recommendation_keywords) ? e.recommendation_keywords.length : 0;
    const pub = Array.isArray(e.verified_publication_pages) ? e.verified_publication_pages.length : 0;
    const recruit = Array.isArray(e.verified_recruitment_pages) ? e.verified_recruitment_pages.length : 0;
    const sources = Array.isArray(e.source_urls_used) ? e.source_urls_used.length : 0;
    let s = 0;
    s += summary.length >= 160 ? 30 : summary.length >= 100 ? 22 : summary.length >= 40 ? 12 : summary ? 5 : 0;
    s += Math.min(topics,10) * 3;
    s += Math.min(keywords,12) * 2;
    s += Math.min(papers.length,12) * 4;
    s += Math.min(pub,5) * 3;
    s += Math.min(memberCount,20) * 1.5;
    s += Math.min(recruit,4) * 4;
    s += e.member_page_url ? 5 : 0;
    s += String(e.poster_status || '').toLowerCase() === 'verified' ? 15 : 0;
    s += Math.min(sources,15) * 0.5;
    return s;
  };
  function strongest() {
    return units().filter(x => text(x.name)).map(x => ({x,s:score(x)})).sort((a,b)=>b.s-a.s || String(a.x.name).localeCompare(String(b.x.name),'ko'))[0]?.x || null;
  }
  function openShowcase() {
    const x = strongest();
    if (!x) return;
    const q = document.querySelector('#q');
    const old = q ? q.value : '';
    if (q) { q.value = String(x.name || ''); q.dispatchEvent(new Event('input',{bubbles:true})); q.dispatchEvent(new Event('change',{bubbles:true})); }
    setTimeout(() => {
      const lab = String(x.labs || x.title || '연구그룹').split(/[;|]/)[0].trim() || '연구그룹';
      const expected = `${String(x.name || '')} 교수 / ${lab}`;
      const card = [...document.querySelectorAll('#results .card')].find(c => c.querySelector('h2')?.textContent.trim() === expected);
      if (card) card.click();
      else if (typeof window.openDetail === 'function') window.openDetail(x);
      if (q) { q.value = old; q.dispatchEvent(new Event('input',{bubbles:true})); }
    }, 80);
  }
  const bind = () => {
    const b = document.querySelector('#showcaseOpen');
    if (!b) return;
    b.onclick = openShowcase;
    b.dataset.showcaseMode = 'dynamic-completeness';
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(bind,0));
  else setTimeout(bind,0);
})();
