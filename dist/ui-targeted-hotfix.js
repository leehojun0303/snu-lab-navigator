(() => {
  'use strict';

  const clean = v => String(v || '').replace(/\s+/g, ' ').trim();

  function currentUnits() {
    const raw=[...(window.RESEARCH_UNITS||[]),...(window.RESEARCH_UNIT_SUPPLEMENTS||[])];
    return [...new Map(raw.map(x=>[[x.college,x.department,x.name].join('|'),x])).values()];
  }

  function unitAffiliation(x) {
    const college=clean(x?.college),department=clean(x?.department);
    return college&&department&&college!==department?`${college} ${department}`:(college||department);
  }

  function selectedDetailUnit(units) {
    const detail=document.querySelector('#detail');
    if(!detail?.open)return null;
    const heading=clean(detail.querySelector('h2,h1')?.textContent);
    const name=(heading.match(/^(.+?)\s*교수\s*\//)||[])[1];
    if(!name)return null;
    const candidates=units.filter(x=>clean(x.name)===clean(name));
    if(candidates.length===1)return candidates[0];
    const lab=(heading.split('/').slice(1).join('/')).trim();
    return candidates.find(x=>clean(String(x.labs||'').split(/[;|]/)[0])===lab)||null;
  }

  function fixAffiliations() {
    const units=currentUnits();
    document.querySelectorAll('#results .card[data-i]').forEach(card=>{
      const x=units[Number(card.dataset.i)];
      const meta=card.querySelector('.meta');
      if(!x||!meta)return;
      const correct=[unitAffiliation(x),clean(x.rank)].filter(Boolean).join(' · ');
      if(correct&&clean(meta.textContent)!==correct)meta.textContent=correct;
    });
    const x=selectedDetailUnit(units);
    if(x){
      const detail=document.querySelector('#detail');
      const heading=detail.querySelector('h2,h1');
      const meta=heading?.parentElement?.querySelector('.meta');
      if(meta){
        const correct=[unitAffiliation(x),clean(x.rank)].filter(Boolean).join(' · ');
        if(correct&&clean(meta.textContent)!==correct)meta.textContent=correct;
      }
    }
    window.SnuAffiliationLabel=unitAffiliation;
  }

  function updateHomeCopy() {
    const eyebrow = document.querySelector('header .eyebrow');
    const heading = document.querySelector('header h1');
    const intro = document.querySelector('header .intro');
    if (eyebrow && clean(eyebrow.textContent) !== '서울대학교 교수/연구실 탐색') {
      const mark = eyebrow.querySelector('.snulab-brand-mark');
      eyebrow.textContent = '서울대학교 교수/연구실 탐색';
      if (mark) eyebrow.prepend(mark);
    }
    if (heading && heading.textContent !== '어떤 분야에 관심이 있나요?') heading.textContent = '어떤 분야에 관심이 있나요?';
    if (intro && intro.textContent !== '관심 주제로 교수와 연구실을 찾아보세요.') intro.textContent = '관심 주제로 교수와 연구실을 찾아보세요.';
  }

  function hideDetailCollectionStatus() {
    const detail = document.querySelector('#detail');
    if (!detail) return;
    detail.querySelectorAll('.pending-summary,.paper-stats,.activity-metrics span,*').forEach(el => {
      if (el.children.length) return;
      const text = clean(el.textContent);
      if ((/수집\s*중/.test(text) || text === '저장된 AI 분석') && el.style.display !== 'none') el.style.display = 'none';
    });
  }

  function compareRows(dialog) {
    const rows = [...dialog.querySelectorAll('.stable-scroll tbody tr')];
    const byLabel = label => rows.find(row => clean(row.querySelector('th')?.textContent) === label);
    return {core:byLabel('핵심 분야'),keywords:byLabel('키워드'),paper:byLabel('논문 기반 최근 관심 분야')};
  }

  function trimSeparatedCell(cell, max = 3) {
    if (!cell) return;
    const raw = clean(cell.textContent);
    if (!raw || raw === '확인 필요') return;
    const parts = raw.split(/\s*[·|]\s*/).map(clean).filter(Boolean);
    if (parts.length > max) cell.textContent = parts.slice(0, max).join(' · ');
  }

  function refineCompare(dialog) {
    if (!dialog?.open) return;
    const table = dialog.querySelector('.stable-scroll table');
    if (!table) return;
    table.classList.add('equal-professor-columns');
    const {core,keywords,paper} = compareRows(dialog);
    [...(core?.querySelectorAll('td') || [])].forEach(cell => trimSeparatedCell(cell,3));
    [...(keywords?.querySelectorAll('td') || [])].forEach(cell => trimSeparatedCell(cell,3));
    const paperCells = [...(paper?.querySelectorAll('td') || [])];
    paperCells.forEach(cell => {if (!cell.dataset.focusReady && clean(cell.textContent) !== '확인 필요') cell.textContent = '확인 필요';});
    const aiRows = [...dialog.querySelectorAll('#stableCompareAi .stable-ai-rows p, #stableCompareAi > p')];
    const focuses = aiRows.map(row => {const focus=row.querySelector('.compare-focus');return focus?clean(focus.textContent).replace(/^논문 기반 최근 관심 분야:\s*/,''):'';}).filter(Boolean);
    focuses.slice(0,paperCells.length).forEach((focus,i)=>{if(clean(paperCells[i].textContent)!==focus)paperCells[i].textContent=focus;paperCells[i].dataset.focusReady='1';});
  }

  function install() {
    updateHomeCopy();fixAffiliations();
    const style=document.createElement('style');
    style.textContent=`#stableCompareDialog .stable-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}#stableCompareDialog table.equal-professor-columns{table-layout:fixed;width:max-content;min-width:100%}#stableCompareDialog table.equal-professor-columns th:first-child{width:92px;min-width:92px;max-width:92px}#stableCompareDialog table.equal-professor-columns th:not(:first-child),#stableCompareDialog table.equal-professor-columns td{width:280px;min-width:280px;max-width:280px;white-space:normal;overflow-wrap:break-word;word-break:normal}@media(max-width:600px){#stableCompareDialog{width:calc(100% - 18px);padding:18px 14px}#stableCompareDialog table.equal-professor-columns th:first-child{width:76px;min-width:76px;max-width:76px}#stableCompareDialog table.equal-professor-columns th:not(:first-child),#stableCompareDialog table.equal-professor-columns td{width:220px;min-width:220px;max-width:220px}}`;
    document.head.appendChild(style);
    let queued=false;
    const apply=()=>{queued=false;updateHomeCopy();fixAffiliations();hideDetailCollectionStatus();refineCompare(document.querySelector('#stableCompareDialog'));};
    const observer=new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(apply);}});
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
    apply();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
