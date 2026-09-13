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

  raw.forEach(unit => { if (unit && 'fields' in unit) unit.fields = cleanFields(unit.fields); });
  window.SnuAffiliationLabel = label;

  function fixDetail(unit) {
    const detail = document.querySelector('#detailContent');
    if (!detail || !unit) return;
    const expected = [label(unit), unit.rank].filter(Boolean).join(' · ');
    const affiliationMeta = [...detail.querySelectorAll('.meta')].find(el => /대학|학부|학과|대학원/.test(el.textContent || ''));
    if (affiliationMeta && affiliationMeta.textContent !== expected) affiliationMeta.textContent = expected;
  }

  // Fix only the card/detail involved in an actual user click. Do not observe
  // the whole document: rewriting .meta nodes from a MutationObserver can
  // recursively retrigger itself and lock the main thread.
  document.addEventListener('click', event => {
    const card = event.target.closest?.('.card[data-i]');
    if (!card) return;
    const unit = scopedUnits[Number(card.dataset.i)];
    if (!unit) return;
    const meta = card.querySelector('.meta');
    const expected = [label(unit), unit.rank].filter(Boolean).join(' · ');
    if (meta && meta.textContent !== expected) meta.textContent = expected;
    setTimeout(() => fixDetail(unit), 0);
  }, true);
})();
