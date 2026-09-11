(() => {
  'use strict';
  const progressUrl='https://raw.githubusercontent.com/leehojun0303/snu-lab-navigator/main/data/automation-progress.json';
  function localStatus(){
    const badge=document.querySelector('#automationBadge'),status=document.querySelector('#automationStatus'),coverage=document.querySelector('#automationCoverage');
    const meta=window.AUTOMATION_META||{};
    const validated=meta.snapshot_status==='validated'&&Boolean(meta.validated_at)&&Number(meta.enriched_units)>=0&&Number(meta.checked_units)>0;
    if(!validated){if(badge)badge.textContent='자동 수집 검증 중';if(status)status.textContent='최신 자동 수집 결과 검증 중';if(coverage)coverage.textContent='검증 완료 후 표시';return false;}
    const enriched=Number(meta.enriched_units),checked=Number(meta.checked_units);
    if(badge)badge.textContent=`자동 수집 ${Math.max(0,enriched).toLocaleString()}개 저장`;
    if(status)status.textContent='검증 완료';
    if(coverage)coverage.textContent=`${Math.max(0,enriched).toLocaleString()}개 분석 · ${Math.max(0,checked).toLocaleString()}개 확인`;
    return true;
  }
  async function sync(){
    const fallbackValidated=localStatus();
    try{
      const r=await fetch(`${progressUrl}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)return;
      const p=await r.json();
      const badge=document.querySelector('#automationBadge'),status=document.querySelector('#automationStatus'),coverage=document.querySelector('#automationCoverage');
      if(p.status==='running'||p.status==='starting'){
        const checked=Number(p.checked)||0,total=Number(p.total)||0,enriched=Number(p.enriched)||0;
        if(badge)badge.textContent='자동 수집 검증 중';
        if(status)status.textContent=`수집 중 · ${checked.toLocaleString()} / ${total.toLocaleString()}개 확인`;
        if(coverage)coverage.textContent=`현재 분석 ${enriched.toLocaleString()}개`;
      }else if(p.status==='completed'){
        const checked=Number(p.checked)||0,total=Number(p.total)||0,enriched=Number(p.enriched)||0;
        if(total>0&&checked>=total){
          if(badge)badge.textContent=`자동 수집 ${enriched.toLocaleString()}개 저장`;
          if(status)status.textContent='전체 수집 완료 · 최종 검증 대기';
          if(coverage)coverage.textContent=`${enriched.toLocaleString()}개 분석 · ${checked.toLocaleString()}개 확인`;
        }
      }
    }catch(_){if(!fallbackValidated){}}
  }
  function start(){sync();setInterval(sync,30000);} 
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
