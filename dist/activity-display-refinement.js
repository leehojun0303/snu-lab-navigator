(() => {
  'use strict';
  function refineDetail() {
    const dialog = document.querySelector('#detail');
    if (!dialog?.open) return;
    dialog.querySelectorAll('*').forEach(el => {
      if (el.children.length) return;
      const text = el.textContent || '';
      const next = text
        .replace(/최근\s*1년\s*0편\s*\(연도 기준\)/g, '최근 1년 확인 필요')
        .replace(/최근\s*1년\s*0편/g, '최근 1년 확인 필요')
        .replace(/확인\s*논문\s*0편/g, '확인 논문 수 확인 필요')
        .replace(/0편\s*\(연도 기준\)/g, '확인 필요');
      if (next !== text) el.textContent = next;
    });
  }
  function install() {
    const root = document.body;
    if (!root) return;
    const observer = new MutationObserver(refineDetail);
    observer.observe(root, {childList: true, subtree: true, attributes: true, attributeFilter: ['open']});
    refineDetail();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
