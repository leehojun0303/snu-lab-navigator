/*
 * Automatic showcase bridge.
 *
 * app.js historically assigned a Song Jaejoon handler directly. This file keeps
 * the existing app bundle compatible while replacing that behavior at runtime:
 * the button opens the unit selected by the latest automation snapshot.
 */
(() => {
  const getUnits = () => [
    ...(window.RESEARCH_UNITS || []),
    ...(window.RESEARCH_UNIT_SUPPLEMENTS || [])
  ];

  const bind = () => {
    const button = document.querySelector('#showcaseOpen');
    if (!button) return;
    const automatedId = () => String((window.AUTOMATION_META || {}).showcase_unit_id || '').trim();

    button.onclick = () => {
      const id = automatedId();
      const units = getUnits();
      const unit = units.find(item => String(item.id || '') === id);
      if (!unit) {
        const status = document.querySelector('#aiStatus');
        if (status) status.textContent = '자동 수집된 대표 상세 예시가 아직 없습니다. 다음 수집 결과에서 자동 선정됩니다.';
        return;
      }

      // app.js keeps openDetail() private. Reuse the result-card path so the
      // automatic showcase receives exactly the same detail UI.
      const input = document.querySelector('#q');
      const oldValue = input ? input.value : '';
      if (input) {
        input.value = String(unit.name || '');
        input.dispatchEvent(new Event('input', {bubbles: true}));
      }
      setTimeout(() => {
        const index = units.indexOf(unit);
        const card = [...document.querySelectorAll('#results [data-i]')]
          .find(node => Number(node.dataset.i) === index);
        if (card) card.click();
        if (input) {
          input.value = oldValue;
          input.dispatchEvent(new Event('input', {bubbles: true}));
        }
      }, 0);
    };
  };

  setTimeout(bind, 0);
})();
