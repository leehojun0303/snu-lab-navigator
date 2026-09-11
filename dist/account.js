(() => {
  'use strict';
  const cfg = window.SUPABASE_CONFIG || {};
  const ready = Boolean(cfg.url && cfg.anonKey && window.supabase?.createClient);
  const supa = ready ? window.supabase.createClient(cfg.url, cfg.anonKey) : null;
  const RECENT_IDS = 'snu-lab-recent-usernames-v9';
  let currentUser = null;
  let currentUsername = '';
  const $ = (s,r=document)=>r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const valid = v => /^[a-z0-9_.-]{3,40}$/.test(v);
  const recentIds = () => { try { const x=JSON.parse(localStorage.getItem(RECENT_IDS)||'[]'); return Array.isArray(x)?x:[]; } catch(_){ return []; } };
  const saveRecent = id => localStorage.setItem(RECENT_IDS,JSON.stringify([id,...recentIds().filter(x=>x!==id)].slice(0,5)));
  const getSession = async()=>{ if(!supa)return null; const {data,error}=await supa.auth.getSession(); if(error)throw error; return data.session||null; };

  async function rpcLogin(id){
    const {data,error}=await supa.rpc('login_lab_account',{p_username:id});
    if(error){ if(/invalid_username/i.test(error.message||''))throw new Error('ID는 영문·숫자·._- 조합 3~40자로 입력해 주세요.'); throw new Error(`로그인 확인에 실패했습니다: ${error.message||error.code||'Supabase 오류'}`); }
    return Boolean(data);
  }
  async function rpcSignup(id){
    const {data,error}=await supa.rpc('create_lab_account',{p_username:id});
    if(error){ if(/invalid_username/i.test(error.message||''))throw new Error('ID는 영문·숫자·._- 조합 3~40자로 입력해 주세요.'); throw new Error(`회원가입에 실패했습니다: ${error.message||error.code||'Supabase 오류'}`); }
    return Boolean(data);
  }
  async function attachAuth(id){
    if(!supa)throw new Error('Supabase 연결이 완료되지 않았습니다.');
    await supa.auth.signOut().catch(()=>{});
    const {data,error}=await supa.auth.signInAnonymously({options:{data:{username:id}}});
    if(error)throw new Error(`인증 세션을 만들지 못했습니다: ${error.message}`);
    if(!data?.session?.user)throw new Error('익명 인증 세션 생성에 실패했습니다. Supabase Anonymous Sign-Ins를 확인해 주세요.');
    currentUser=data.session.user; currentUsername=id; saveRecent(id); window.dispatchEvent(new Event('snu-account-changed')); return data.session;
  }
  async function login(id){
    id=id.trim().toLowerCase();
    if(!ready)throw new Error('Supabase 연결이 완료되지 않았습니다.');
    if(!valid(id))throw new Error('ID는 영문·숫자·._- 조합 3~40자로 입력해 주세요.');
    const exists=await rpcLogin(id);
    if(!exists)throw new Error('가입된 ID가 아닙니다. 먼저 회원가입을 해 주세요.');
    await attachAuth(id); await loadFavorites(); return true;
  }
  async function signup(id){
    id=id.trim().toLowerCase();
    if(!ready)throw new Error('Supabase 연결이 완료되지 않았습니다.');
    if(!valid(id))throw new Error('ID는 영문·숫자·._- 조합 3~40자로 입력해 주세요.');
    const created=await rpcSignup(id);
    if(!created)throw new Error('이미 사용 중인 ID입니다. 다른 ID를 선택해 주세요.');
    await attachAuth(id); await loadFavorites(); return true;
  }
  async function logout(){
    if(supa)await supa.auth.signOut().catch(()=>{});
    currentUser=null; currentUsername=''; localStorage.removeItem('snu-lab-current-username');
    window.dispatchEvent(new Event('snu-account-changed'));
  }
  async function loadFavorites(){
    if(!supa||!currentUsername)return [];
    const {data,error}=await supa.rpc('get_lab_favorites',{p_username:currentUsername});
    if(error)throw error;
    const ids=(data||[]).map(x=>x.lab_id);
    localStorage.setItem('snu-lab-favorites-v1',JSON.stringify(ids));
    window.dispatchEvent(new Event('snu-favorites-changed'));
    return ids;
  }
  async function setFavorite(labId,enabled){
    if(!currentUsername)throw new Error('ID로 로그인해 주세요.');
    const {data,error}=await supa.rpc('set_lab_favorite',{p_username:currentUsername,p_lab_id:labId,p_enabled:Boolean(enabled)});
    if(error||!data)throw new Error(error?.message||'즐겨찾기 저장에 실패했습니다.');
    await loadFavorites();
  }
  async function callGemini(body,model='gemini-3.1-flash-lite'){
    if(!currentUser||!currentUsername)throw new Error('ID로 로그인해 주세요.');
    const session=await getSession(); if(!session)throw new Error('인증 세션이 없습니다. ID로 다시 로그인해 주세요.');
    const base=String(cfg.functionsBase||`${cfg.url.replace(/\/$/,'')}/functions/v1`).replace(/\/$/,'');
    const r=await fetch(`${base}/gemini-proxy`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({model,body})});
    const payload=await r.json().catch(()=>({})); if(!r.ok)throw new Error(payload.error||`Gemini 서버 오류 ${r.status}`); return {payload,model};
  }
  function render(mode='login',notice=''){
    if(!$('#accountDialog'))document.body.insertAdjacentHTML('beforeend','<dialog id="accountDialog" class="account-dialog"><button class="close" id="accountClose" type="button">×</button><div id="accountBody"></div></dialog>');
    const d=$('#accountDialog'),body=$('#accountBody'); const signupMode=mode==='signup';
    body.innerHTML=`<h2>${signupMode?'회원가입':'로그인'}</h2><p class="account-note">개인정보와 비밀번호를 요구하지 않습니다. ${signupMode?'새로운 고유 ID를 등록합니다.':'회원가입한 ID를 입력하면 로그인됩니다.'}</p>${notice?`<p class="status notice-text">${esc(notice)}</p>`:''}<label>ID<input id="accountIdInput" autocomplete="off" placeholder="예: labfinder27"></label><button id="accountPrimaryGo" class="primary" type="button">${signupMode?'회원가입':'로그인'}</button><button id="accountSwitch" class="secondary" type="button">${signupMode?'로그인으로 돌아가기':'회원가입'}</button>${currentUsername?'<button id="accountLogoutGo" class="secondary" type="button">로그아웃</button>':''}<p id="accountStatus" class="status"></p>${!signupMode&&recentIds().length?`<div class="recent-title">최근 사용 ID</div><div class="recent-users">${recentIds().map(id=>`<button class="recent-user" type="button" data-id="${esc(id)}">${esc(id)}</button>`).join('')}</div>`:''}`;
    $('#accountClose').onclick=()=>d.close();
    $('#accountSwitch').onclick=()=>render(signupMode?'login':'signup');
    $('#accountLogoutGo')?.addEventListener('click',async()=>{await logout();render('login','로그아웃했습니다. 다시 ID를 입력해 로그인할 수 있습니다.');});
    body.querySelectorAll('.recent-user').forEach(b=>b.onclick=()=>{$('#accountIdInput').value=b.dataset.id;$('#accountIdInput').focus();});
    $('#accountPrimaryGo').onclick=async()=>{const s=$('#accountStatus');const id=$('#accountIdInput').value;s.textContent=signupMode?'회원가입 중…':'로그인 중…';try{await (signupMode?signup:login)(id);d.close();}catch(e){s.textContent=e.message;$('#accountIdInput').focus();}};
    if(!d.open)d.showModal();setTimeout(()=>$('#accountIdInput')?.focus(),0);
  }
  function init(){
    if(!ready)return;
    // Do not restore the app login state automatically. The ID is entered every time.
    const button=$('#accountOpen'); if(button)button.onclick=()=>render('login');
    if(supa)supa.auth.onAuthStateChange(()=>{});
    window.SnuAccount={isConfigured:()=>ready,isLoggedIn:()=>Boolean(currentUser&&currentUsername),isAuthReady:()=>true,open:()=>render('login'),login,signup,logout,setFavorite,loadFavorites,callGemini,getUser:()=>currentUser,getUsername:()=>currentUsername};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
