(() => {
  'use strict';

  const units = () => [...(window.RESEARCH_UNITS || []), ...(window.RESEARCH_UNIT_SUPPLEMENTS || [])];
  const enrichment = id => (window.PRECOMPUTED_ENRICHMENT || {})[id] || {};
  const esc = v => String(v ?? '').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  function memberSummary(id) {
    const e = enrichment(id);
    const counts = {교수:0, 박사후연구원:0, 연구원:0, 박사과정:0, 석사과정:0, 학부연구생:0, 대학원생:0, 기타:0, 동문: Array.isArray(e.alumni) ? e.alumni.length : 0};
    for (const p of e.current_members || []) {
      const r = String(p.member_group || p.role || '').toLowerCase();
      if (/postdoc|post-doctoral|postdoctoral|research fellow|박사후/.test(r)) counts.박사후연구원++;
      else if (/ph\.?d|doctoral|박사과정|박사/.test(r)) counts.박사과정++;
      else if (/master|석사과정|석사/.test(r)) counts.석사과정++;
      else if (/undergraduate|undergrad|학부연구생|학부생/.test(r)) counts.학부연구생++;
      else if (/graduate student|graduate researcher|대학원생/.test(r)) counts.대학원생++;
      else if (/professor|faculty|교수/.test(r)) counts.교수++;
      else if (/researcher|scientist|연구원/.test(r)) counts.연구원++;
      else counts.기타++;
    }
    const text = Object.entries(counts).filter(([,n])=>n>0).map(([k,n])=>`${k} ${n}명`).join(' · ');
    return text || '공식 페이지에서 구성 확인 필요';
  }

  function refresh() {
    const dialog = document.querySelector('#favDialog');
    if (!dialog) return;
    const table = dialog.querySelector('table');
    if (!table) return;
    const header = table.querySelector('thead tr');
    const rows = [...table.querySelectorAll('tbody tr')];
    if (!header || !rows.length) return;
    const headers = [...header.children];
    const paperIndex = headers.findIndex(cell => /최근 1년 논문/.test(cell.textContent || ''));
    if (paperIndex < 0) return;
    headers[paperIndex].textContent = '구성원 구성';
    const data = rows.map(row => {
      const professor = String(row.querySelector('th')?.textContent || '').trim();
      const u = units().find(x => String(x.name || '').trim() === professor);
      return {row, u};
    });
    for (const {row,u} of data) {
      const cell = row.children[paperIndex];
      if (cell) cell.textContent = u ? memberSummary(u.id) : '공식 페이지에서 구성 확인 필요';
    }
  }

  document.addEventListener('click', event => {
    if (event.target.closest?.('#favShow')) {
      setTimeout(refresh, 0);
      setTimeout(refresh, 80);
    }
  }, true);
  window.addEventListener('snu-account-changed', () => setTimeout(refresh, 0));
})();
