(() => {
  'use strict';
  const progressUrl='https://raw.githubusercontent.com/leehojun0303/snu-lab-navigator/main/data/automation-progress.json';
  function localStatus(){
    const badge=document.querySelector('#automationBadge'),status=document.querySelector('#automationStatus'),coverage=document.querySelector('#automationCoverage');
    const meta=window.AUTOMATION_META||{};
    const validated=meta.snapshot_status==='validated'&&Boolean(meta.validated_at)&&Number(meta.enriched_units)>=0&&Number(meta.checked_units)>0;
    if(!validated){if(badge)badge.textContent='새 상세 형식 수집 대기';if(status)status.textContent='새 형식으로 수집을 시작하면 이번 실행의 처리 수를 표시합니다.';if(coverage)coverage.textContent='이번 형식 0개 처리';return false;}
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
      if(p.status==='running'||p.status==='starting'||p.status==='paused'){
        const checked=Number(p.checked)||0,total=Number(p.total)||0,enriched=Number(p.enriched)||0;
        const limited=p.ai_status==='rate_limited', paused=p.status==='paused';
        if(badge)badge.textContent=limited?'Gemini 한도 대기':(paused?'다음 수집 주기 대기':'새 상세 형식 수집 중');
        if(status)status.textContent=limited?`Gemini 한도 도달 · 다음 5시간 주기에 재개 · 이번 실행 ${checked.toLocaleString()}개 처리`:(paused?`이번 실행 ${checked.toLocaleString()}개 처리 완료 · 다음 5시간 주기 대기`:`이번 실행 · ${checked.toLocaleString()} / ${total.toLocaleString()}개 처리`);
        if(coverage)coverage.textContent=limited?`이번 형식 분석 ${enriched.toLocaleString()}개 · URL 수집은 계속`:`이번 형식 분석 ${enriched.toLocaleString()}개`;
      }else if(p.status==='completed'){
        const checked=Number(p.checked)||0,total=Number(p.total)||0,enriched=Number(p.enriched)||0;
        if(total>0&&checked>=total){
          if(badge)badge.textContent=`새 상세 형식 ${enriched.toLocaleString()}개 저장`;
          if(status)status.textContent=`이번 전체 수집 완료 · ${checked.toLocaleString()}개 처리`;
          if(coverage)coverage.textContent=`이번 형식 분석 ${enriched.toLocaleString()}개`;
        }
      }
    }catch(_){if(!fallbackValidated){}}
  }
  function start(){sync();setInterval(sync,30000);} 
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
