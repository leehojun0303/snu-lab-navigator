(() => {
  'use strict';

  // Minimal compatibility hotfix for favorites-compare-fixed.js.
  // That script calls exactOneYearCount() while rendering the favorites dialog.
  // Keep the helper global so the existing code can resolve it without changing
  // any search, comparison, account, AI, collection, or detail behavior.
  if (typeof window.exactOneYearCount === 'function') return;

  window.exactOneYearCount = function exactOneYearCount(id) {
    const enrichment = (window.PRECOMPUTED_ENRICHMENT || {})[id] || {};
    const papers = Array.isArray(enrichment.recent_papers) ? enrichment.recent_papers : [];
    if (!papers.length) return { known: false, count: 0 };

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    let dated = 0;
    let count = 0;

    for (const paper of papers) {
      const raw = String(paper.date || paper.published_at || paper.publication_date || '').trim();
      if (raw) {
        const date = new Date(raw);
        if (!Number.isNaN(date.valueOf())) {
          dated += 1;
          if (date >= cutoff && date <= now) count += 1;
          continue;
        }
      }
      const year = Number(String(paper.year || '').match(/\b(20\d{2})\b/)?.[1]);
      if (Number.isFinite(year)) {
        dated += 1;
        if (year === now.getFullYear() || year === now.getFullYear() - 1) count += 1;
      }
    }

    return dated ? { known: true, count } : { known: false, count: 0 };
  };
})();
