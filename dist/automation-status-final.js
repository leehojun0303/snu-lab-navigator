(() => {
  'use strict';
  const progressUrl='https://raw.githubusercontent.com/leehojun0303/snu-lab-navigator/main/data/automation-progress.json';
  const stateUrl='https://raw.githubusercontent.com/leehojun0303/snu-lab-navigator/main/data/automation-state.json';
  function localStatus(){
    const badge=document.querySelector('#automationBadge'),status=document.querySelector('#automationStatus'),coverage=document.querySelector('#automationCoverage');
    const meta=window.AUTOMATION_META||{};
    const validated=meta.snapshot_status==='validated'&&Boolean(meta.validated_at)&&Number(meta.enriched_units)>=0&&Number(meta.checked_units)>0;
    if(!validated){if(badge)badge.textContent='새 상세 형식 수집 대기';if(status)status.textContent='새 형식으로 수집을 시작하면 전체 순회 진행도를 표시합니다.';if(coverage)coverage.textContent='이번 형식 0개 처리';return false;}
    const enriched=Number(meta.enriched_units),checked=Number(meta.checked_units);
    if(badge)badge.textContent=`자동 수집 ${Math.max(0,enriched).toLocaleString()}개 저장`;
    if(status)status.textContent='검증 완료';
    if(coverage)coverage.textContent=`${Math.max(0,enriched).toLocaleString()}개 분석 · ${Math.max(0,checked).toLocaleString()}개 확인`;
    return true;
  }
  async function cumulative(total,runChecked){
    try{
      const r=await fetch(`${stateUrl}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)return runChecked;
      const s=await r.json();
      const cursor=Number(s.cursor);
      if(!Number.isFinite(cursor)||cursor<0||!total)return runChecked;
      if(cursor===0&&runChecked>0)return total;
      return Math.min(cursor,total);
    }catch(_){return runChecked;}
  }
  async function sync(){
    const fallbackValidated=localStatus();
    try{
      const r=await fetch(`${progressUrl}?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)return;
      const p=await r.json();
      const badge=document.querySelector('#automationBadge'),status=document.querySelector('#automationStatus'),coverage=document.querySelector('#automationCoverage');
      if(p.status==='idle'){
        try{
          const activeResponse=await fetch('https://api.github.com/repos/leehojun0303/snu-lab-navigator/actions/runs?per_page=10',{cache:'no-store'});
          const activeRuns=(await activeResponse.json()).workflow_runs||[];
          const active=activeRuns.find(run=>run.status==='in_progress'&&(/Start compact-detail collection now|Refresh official SNU lab data/.test(run.name)));
          if(active){if(badge)badge.textContent='새 상세 형식 준비 중';if(status)status.textContent='공식 교수 명단을 동기화하고 있습니다.';if(coverage)coverage.textContent='명단 동기화 단계';}
        }catch(_){}
      }else if(p.status==='running'||p.status==='starting'||p.status==='paused'){
        const runChecked=Number(p.checked)||0,total=Number(p.total)||0,enriched=Number(p.enriched)||0;
        const checked=await cumulative(total,runChecked);
        const limited=p.ai_status==='rate_limited',paused=p.status==='paused';
        if(badge)badge.textContent=limited?`Gemini 한도 대기 · ${checked.toLocaleString()} / ${total.toLocaleString()}`:(paused?`다음 수집 주기 대기 · ${checked.toLocaleString()} / ${total.toLocaleString()}`:(total>0?`수집 중 · ${checked.toLocaleString()} / ${total.toLocaleString()}`:'새 상세 형식 수집 중'));
        if(status)status.textContent=limited?`Gemini 한도 대기 · 전체 순회 ${checked.toLocaleString()} / ${total.toLocaleString()}`:(paused?`전체 순회 ${checked.toLocaleString()} / ${total.toLocaleString()} · 다음 수집 주기 대기`:`전체 순회 · ${checked.toLocaleString()} / ${total.toLocaleString()}개 확인`);
        if(coverage)coverage.textContent=`이번 형식 분석 ${enriched.toLocaleString()}개`;
      }else if(p.status==='completed'){
        const total=Number(p.total)||0,enriched=Number(p.enriched)||0;
        if(badge)badge.textContent=`전체 수집 완료 · ${total.toLocaleString()} / ${total.toLocaleString()}`;
        if(status)status.textContent=`전체 순회 완료 · ${total.toLocaleString()}개 확인`;
        if(coverage)coverage.textContent=`이번 형식 분석 ${enriched.toLocaleString()}개`;
      }else if(p.status==='failed'){
        if(badge)badge.textContent='자동 수집 오류';if(status)status.textContent=p.message||'수집 시작 전 오류가 발생했습니다. 다음 실행에서 재시도합니다.';if(coverage)coverage.textContent='이번 실행은 데이터 저장 전 중단됨';
      }
    }catch(_){if(!fallbackValidated){}}
  }
  function start(){sync();setInterval(sync,30000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
