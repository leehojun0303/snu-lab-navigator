/* Automatic showcase: selected by the latest collector snapshot. */
(() => {
  const getUnits = () => [...(window.RESEARCH_UNITS || []), ...(window.RESEARCH_UNIT_SUPPLEMENTS || [])];
  const bind = () => {
    const button = document.querySelector('#showcaseOpen');
    if (!button) return;
    button.onclick = () => {
      const id = String((window.AUTOMATION_META || {}).showcase_unit_id || '').trim();
      const unit = getUnits().find(x => String(x.id || '') === id);
      if (!unit) {
        const status = document.querySelector('#aiStatus');
        if (status) status.textContent = '자동 수집된 대표 상세 예시가 아직 없습니다. 다음 수집 결과에서 자동 선정됩니다.';
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
  };
  setTimeout(bind, 0);
})();
