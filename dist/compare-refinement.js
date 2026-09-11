(() => {
  'use strict';

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function cleanCompareDialog(dialog) {
    if (!dialog) return;
    // The table already contains the recent-one-year paper count. Do not repeat
    // it in the AI prose; the AI comparison should focus on representative
    // papers/topics and concrete differences.
    dialog.querySelectorAll('td, p, div, span').forEach(el => {
      if (!el.children.length) {
        el.textContent = el.textContent
          .replace(/\s*\(연도 기준\)/g, '')
          .replace(/최근 1년 논문(?:\s*수)?\s*[:：]?\s*\d+편\.?/g, '');
      }
    });
  }

  function observeCompare() {
    const root = document.body;
    if (!root) return;
    const observer = new MutationObserver(() => {
      const dialog = document.querySelector('#compareDialog');
      if (dialog?.open) cleanCompareDialog(dialog);
    });
    observer.observe(root, {childList: true, subtree: true, attributes: true, attributeFilter: ['open']});
    document.addEventListener('click', event => {
      if (event.target.closest('#cmpOpen, #compareOpen')) {
        setTimeout(() => cleanCompareDialog(document.querySelector('#compareDialog')), 50);
      }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeCompare);
  else observeCompare();
})();
