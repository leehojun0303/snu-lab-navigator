/* Keep affiliation and topic display scoped to the selected professor-affiliation unit. */
(() => {
  'use strict';
  const raw = [...(window.RESEARCH_UNITS || []), ...(window.RESEARCH_UNIT_SUPPLEMENTS || [])];
  const scopedUnits = [...new Map(raw.map(x => [[x.college, x.department, x.name].join('|'), x])).values()];
  const label = x => {
    const college = String(x?.college || '').trim();
    const department = String(x?.department || '').trim();
    return college && department && college !== department ? `${college} ${department}` : (college || department);
  };
  const cleanFields = value => String(value || '').split(/[;|]/).map(v => v.trim()).filter(v => v && !/^(안내|확인 필요|미확인|unknown|n\/?a)$/i.test(v)).join('; ');

  // The app's unit objects share these source object references, so sanitize
  // placeholder topic tokens before a detail view is opened.
  raw.forEach(unit => { if (unit && 'fields' in unit) unit.fields = cleanFields(unit.fields); });

  window.SnuAffiliationLabel = label;
  let selected = null;

  function fixCards(root = document) {
    root.querySelectorAll?.('.card[data-i]').forEach(card => {
      const unit = scopedUnits[Number(card.dataset.i)];
      const meta = card.querySelector('.meta');
      if (!unit || !meta) return;
      meta.textContent = [label(unit), unit.rank].filter(Boolean).join(' · ');
    });
  }

  function fixDetail() {
    if (!selected) return;
    const detail = document.querySelector('#detailContent');
    if (!detail) return;
    const expected = [label(selected), selected.rank].filter(Boolean).join(' · ');
    const metas = [...detail.querySelectorAll('.meta')];
    const affiliationMeta = metas.find(el => /대학|학부|학과|대학원/.test(el.textContent || ''));
    if (affiliationMeta) affiliationMeta.textContent = expected;
  }

  document.addEventListener('click', event => {
    const card = event.target.closest?.('.card[data-i]');
    if (!card) return;
    selected = scopedUnits[Number(card.dataset.i)] || null;
    setTimeout(fixDetail, 0);
  }, true);

  const observer = new MutationObserver(() => {
    fixCards();
    if (document.querySelector('#detail[open]')) fixDetail();
  });
  observer.observe(document.documentElement, {subtree: true, childList: true});
  fixCards();
})();
