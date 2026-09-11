/* Automatic showcase: choose the strongest currently available research-unit record. */
(() => {
  const getUnits = () => [...(window.RESEARCH_UNITS || []), ...(window.RESEARCH_UNIT_SUPPLEMENTS || [])];
  const enrich = id => (window.PRECOMPUTED_ENRICHMENT || {})[id] || {};
  const activity = id => (window.RESEARCH_ACTIVITY || {})[id] || {};
  const text = v => String(v || '').replace(/\s+/g, ' ').trim();
  function memberCount(e, a) {
    let n = Array.isArray(e.current_members) ? e.current_members.length : 0;
    n += Array.isArray(e.alumni) ? e.alumni.length : 0;
    if (!n && a.members && typeof a.members === 'object') for (const value of Object.values(a.members)) n += Array.isArray(value) ? value.length : 0;
    return n;
  }
  function score(unit) {
    const e = enrich(unit.id), a = activity(unit.id);
    const papers = Array.isArray(e.recent_papers) && e.recent_papers.length ? e.recent_papers : (Array.isArray(a.papers) ? a.papers : []);
    const pub = Array.isArray(e.verified_publication_pages) ? e.verified_publication_pages : [];
    const recruit = Array.isArray(e.verified_recruitment_pages) ? e.verified_recruitment_pages : [];
    const members = memberCount(e, a);
    const topics = Array.isArray(e.research_topics) ? e.research_topics.length : 0;
    const keywords = Array.isArray(e.recommendation_keywords) ? e.recommendation_keywords.length : 0;
    const sources = Array.isArray(e.source_urls_used) ? e.source_urls_used.length : (Array.isArray(a.sourcePagesScanned) ? a.sourcePagesScanned.length : 0);
    const summary = text(e.research_summary || unit.fields);
    const posterVerified = String(e.poster_status || '').toLowerCase() === 'verified';
    let total = summary.length >= 120 ? 25 : summary.length >= 50 ? 15 : summary ? 8 : 0;
    total += Math.min(topics, 8) * 3 + Math.min(keywords, 10) * 2;
    total += Math.min(papers.length, 10) * 4 + Math.min(pub.length, 4) * 3;
    total += Math.min(members, 20) * 1.5 + Math.min(recruit.length, 3) * 4;
    if (e.recruitment_summary) total += 10;
    if (posterVerified) total += 15;
    if (e.member_page_url || a.membersUrl) total += 5;
    total += Math.min(sources, 12) * 0.5;
    return total;
  }
  function chooseShowcase() {
    const ranked = getUnits().filter(x => text(x.name)).map(x => ({x, score: score(x)})).sort((a,b) => b.score-a.score || String(a.x.name).localeCompare(String(b.x.name),'ko'));
    return ranked[0]?.x || null;
  }
  function bind() {
    const button = document.querySelector('#showcaseOpen');
    if (!button) return;
    button.onclick = () => {
      const unit = chooseShowcase();
      if (!unit) {
        const status = document.querySelector('#aiStatus');
        if (status) status.textContent = '자동 수집된 대표 상세 예시가 아직 없습니다.';
        return;
      }
      const input = document.querySelector('#q');
      const old = input ? input.value : '';
      if (input) { input.value = String(unit.name || ''); input.dispatchEvent(new Event('input', {bubbles:true})); }
      setTimeout(() => {
        const lab = String(unit.labs || unit.title || '연구그룹').split(/[;|]/)[0].trim() || '연구그룹';
        const expected = `${String(unit.name || '교수명 미확인')} 교수 / ${lab}`;
        const heading = [...document.querySelectorAll('#results .card h2')].find(n => n.textContent.trim() === expected);
        const card = heading?.closest('.card');
        if (card) card.click();
        if (input) { input.value = old; input.dispatchEvent(new Event('input', {bubbles:true})); }
      }, 0);
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})();
