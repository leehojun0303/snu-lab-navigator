(() => {
  'use strict';
  const progressUrl='https://raw.githubusercontent.com/leehojun0303/snu-lab-navigator/main/data/automation-progress.json';
  function localStatus(){
    const badge=document.querySelector('#automationBadge'),status=document.querySelector('#automationStatus'),coverage=document.querySelector('#automationCoverage');
    const meta=window.AUTOMATION_META||{};
    const validated=meta.snapshot_status==='validated'&&Boolean(meta.validated_at)&&Number(meta.enriched_units)>=0&&Number(meta.checked_units)>0;
    if(!validated){if(badge)badge.textContent='새 상세 형식 수집 대기';if(status)status.textContent='자동 수집 진행상황을 확인합니다.';if(coverage)coverage.textContent='검증된 상세정보 집계 중';return false;}
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
      const checked=Math.max(0,Number(p.cycle_checked ?? p.checked)||0),total=Math.max(0,Number(p.total)||0),enriched=Math.max(0,Number(p.enriched)||0);
      if(p.status==='running'||p.status==='starting'||p.status==='paused'){
        const limited=p.ai_status==='rate_limited',paused=p.status==='paused';
        if(badge)badge.textContent=limited?`Gemini 한도 대기 · ${checked.toLocaleString()} / ${total.toLocaleString()}`:(paused?`다음 수집 주기 대기 · ${checked.toLocaleString()} / ${total.toLocaleString()}`:(total>0?`수집 중 · ${checked.toLocaleString()} / ${total.toLocaleString()}`:'자동 수집 준비 중'));
        if(status)status.textContent=limited?`Gemini 한도 대기 · ${checked.toLocaleString()} / ${total.toLocaleString()}개 확인`:(paused?`${checked.toLocaleString()} / ${total.toLocaleString()}개 확인 · 다음 수집 주기 대기`:`${checked.toLocaleString()} / ${total.toLocaleString()}개 확인`);
        if(coverage)coverage.textContent=`검증된 상세 분석 ${enriched.toLocaleString()}개 저장`;
      }else if(p.status==='completed'){
        if(badge)badge.textContent=`전체 수집 완료 · ${total.toLocaleString()} / ${total.toLocaleString()}`;
        if(status)status.textContent=`전체 순회 완료 · ${total.toLocaleString()}개 확인`;
        if(coverage)coverage.textContent=`검증된 상세 분석 ${enriched.toLocaleString()}개 저장`;
      }else if(p.status==='failed'){
        if(badge)badge.textContent='자동 수집 오류';if(status)status.textContent=p.message||'수집 중 오류가 발생했습니다.';if(coverage)coverage.textContent=`검증된 상세 분석 ${enriched.toLocaleString()}개 저장`;
      }
    }catch(_){if(!fallbackValidated){}}
  }
  function start(){sync();setInterval(sync,30000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
