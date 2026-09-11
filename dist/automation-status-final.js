(() => {
  'use strict';

  function sync() {
    const badge = document.querySelector('#automationBadge');
    const status = document.querySelector('#automationStatus');
    const coverage = document.querySelector('#automationCoverage');
    const meta = window.AUTOMATION_META || {};
    const validated = meta.snapshot_status === 'validated' && Boolean(meta.validated_at) && Number(meta.enriched_units) >= 0 && Number(meta.checked_units) > 0;

    if (!validated) {
      if (badge) badge.textContent = '자동 수집 검증 중';
      if (status) status.textContent = '최신 자동 수집 결과 검증 중';
      if (coverage) coverage.textContent = '검증 완료 후 표시';
      return;
    }

    const enriched = Number(meta.enriched_units);
    const checked = Number(meta.checked_units);
    if (badge) badge.textContent = `자동 수집 ${Math.max(0,enriched).toLocaleString()}개 저장`;
    if (status) {
      const when = meta.validated_at;
      const date = when ? new Date(when) : null;
      status.textContent = date && !Number.isNaN(date.valueOf())
        ? `검증 완료 · ${date.toLocaleString('ko-KR',{dateStyle:'medium',timeStyle:'short'})}`
        : '검증 완료';
    }
    if (coverage) coverage.textContent = `${Math.max(0,enriched).toLocaleString()}개 분석 · ${Math.max(0,checked).toLocaleString()}개 확인`;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => {
    sync();
    [100,300,700,1500,3000].forEach(ms=>setTimeout(sync,ms));
  });
  [0,100,300,700,1500,3000,8000].forEach(ms=>setTimeout(sync,ms));
  window.addEventListener('automation-snapshot-updated', sync);
})();
