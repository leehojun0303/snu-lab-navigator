(() => {
  'use strict';
  // Standalone account model is intentionally simple: lab_accounts is the
  // persistent identity registry; Supabase Anonymous Auth is only a short-lived
  // bearer session for authenticated Edge Function calls.
  const cfg = window.SUPABASE_CONFIG || {};
  const ready = Boolean(cfg.url && cfg.anonKey && window.supabase?.createClient);
  const supa = ready ? window.supabase.createClient(cfg.url, cfg.anonKey) : null;
  const RECENT = 'snu-lab-recent-usernames-v8';
  let username = '';
  let user = null;

  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const valid = v => /^[a-z0-9_.-]{3,40}$/.test(v);
  const getRecent = () => { try { const x = JSON.parse(localStorage.getItem(RECENT) || '[]'); return Array.isArray(x) ? x : []; } catch (_) { return []; } };
  const saveRecent = id => { const x = [id, ...getRecent().filter(v => v !== id)].slice(0, 5); localStorage.setItem(RECENT, JSON.stringify(x)); };
  const getSession = async () => { if (!supa) return null; const {data,error}=await supa.auth.getSession(); if(error)throw error; return data.session||null; };
  const clearSession = async () => { if (supa) await supa.auth.signOut().catch(()=>{}); user=null; username=''; };

  async function sessionFor(id){
    await clearSession();
    const {data,error}=await supa.auth.signInAnonymously({options:{data:{username:id}}});
    if(error) throw new Error(`인증 세션을 만들지 못했습니다: ${error.message}`);
    if(!data?.session?.user) throw new Error('익명 인증 세션 생성에 실패했습니다. Supabase Anonymous Sign-Ins를 확인해 주세요.');
    return data.session;
  }

  async function checkAccountExists(id){
    const {data,error}=await supa.rpc('login_lab_account',{p_username:id});
    if(error) {
      if(/invalid_username/i.test(error.message||'')) throw new Error('ID는 영문·숫자·._- 조합 3~40자로 입력해 주세요.');
      throw new Error(`로그인 확인에 실패했습니다: ${error.message || error.code || 'Supabase 오류'}`);
    }
    return Boolean(data);
  }

  async function login(id){
    if(!ready) throw new Error('Supabase 연결이 완료되지 않았습니다.');
    id=id.trim().toLowerCase();
    if(!valid(id)) throw new Error('ID는 영문·숫자·._- 조합 3~40자로 입력해 주세요.');
    const session=await sessionFor(id);
    try {
      const exists=await checkAccountExists(id);
      if(!exists) { await clearSession(); throw new Error('가입된 ID가 아닙니다. 먼저 회원가입을 해 주세요.'); }
      user=session.user; username=id; saveRecent(id);
      localStorage.setItem('snu-lab-current-username',id);
      window.dispatchEvent(new Event('snu-account-changed'));
      return true;
    } catch(e) { await clearSession(); throw e; }
  }

  async function signup(id){
    if(!ready) throw new Error('Supabase 연결이 완료되지 않았습니다.');
    id=id.trim().toLowerCase();
    if(!valid(id)) throw new Error('ID는 영문·숫자·._- 조합 3~40자로 입력해 주세요.');
    const session=await sessionFor(id);
    try {
      const {data,error}=await supa.rpc('create_lab_account',{p_username:id});
      if(error) {
        if(/invalid_username/i.test(error.message||'')) throw new Error('ID는 영문·숫자·._- 조합 3~40자로 입력해 주세요.');
        throw new Error(`회원가입에 실패했습니다: ${error.message || error.code || 'Supabase 오류'}`);
      }
      if(!data) { await clearSession(); throw new Error('이미 사용 중인 ID입니다. 다른 ID를 선택해 주세요.'); }
      user=session.user; username=id; saveRecent(id); localStorage.setItem('snu-lab-current-username',id);
      window.dispatchEvent(new Event('snu-account-changed'));
      return true;
    } catch(e) { await clearSession(); throw e; }
  }

  async function logout(){ await clearSession(); localStorage.removeItem('snu-lab-current-username'); window.dispatchEvent(new Event('snu-account-changed')); }

  async function loadFavorites(){
    if(!ready || !username) return [];
    const {data,error}=await supa.rpc('get_lab_favorites',{p_username:username});
    if(error) throw error;
    const ids=(data||[]).map(x=>x.lab_id);
    localStorage.setItem('snu-lab-favorites-v2',JSON.stringify(ids));
    window.dispatchEvent(new Event('snu-favorites-changed'));
    return ids;
  }

  async function setFavorite(labId,enabled){
    if(!username) throw new Error('ID로 로그인해 주세요.');
    const {data,error}=await supa.rpc('set_lab_favorite',{p_username:username,p_lab_id:labId,p_enabled:Boolean(enabled)});
    if(error||!data) throw new Error(error?.message||'즐겨찾기 저장에 실패했습니다.');
    await loadFavorites();
  }

  async function callGemini(body,model='gemini-3.1-flash-lite'){
    if(!username || !user) throw new Error('ID로 로그인해 주세요.');
    const session=await getSession();
    if(!session) throw new Error('인증 세션이 없습니다. ID로 다시 로그인해 주세요.');
    const base=String(cfg.functionsBase || `${cfg.url.replace(/\/$/,'')}/functions/v1`).replace(/\/$/,'');
    const response=await fetch(`${base}/gemini-proxy`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({model,body})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(payload.error||`Gemini 서버 오류 ${response.status}`);
    return {payload,model};
  }

  function render(){
    if(!document.querySelector('#accountDialog')) document.body.insertAdjacentHTML('beforeend','<dialog id="accountDialog" class="account-dialog"><button class="close" id="accountClose" type="button">×</button><div id="accountBody"></div></dialog>');
    const d=document.querySelector('#accountDialog'); const body=document.querySelector('#accountBody'); const recent=getRecent();
    body.innerHTML=`<h2>연구실 탐색 로그인</h2><p class="account-note">개인정보와 비밀번호를 요구하지 않습니다. 가입한 고유 ID를 입력하면 로그인합니다.</p><label>ID<input id="accountIdInput" autocomplete="off" placeholder="예: labfinder27"></label><button id="accountLoginGo" class="primary" type="button">로그인</button><button id="accountSignupGo" class="secondary" type="button">회원가입</button><button id="accountLogoutGo" class="secondary" type="button" ${username?'':'hidden'}>로그아웃</button><p id="accountStatus" class="status"></p>${recent.length?`<div class="recent-title">최근 사용 ID</div><div class="recent-users">${recent.map(x=>`<button class="recent-user" type="button" data-id="${esc(x)}">${esc(x)}</button>`).join('')}</div>`:''}`;
    document.querySelector('#accountClose').onclick=()=>d.close();
    document.querySelector('#accountLoginGo').onclick=async()=>{const s=document.querySelector('#accountStatus');s.textContent='로그인 중…';try{await login(document.querySelector('#accountIdInput').value);d.close();}catch(e){s.textContent=e.message;}};
    document.querySelector('#accountSignupGo').onclick=()=>renderSignup(d);
    document.querySelector('#accountLogoutGo').onclick=async()=>{await logout();render();};
    body.querySelectorAll('.recent-user').forEach(b=>b.onclick=()=>{document.querySelector('#accountIdInput').value=b.dataset.id;document.querySelector('#accountIdInput').focus();});
    if(!d.open)d.showModal(); setTimeout(()=>document.querySelector('#accountIdInput')?.focus(),0);
  }

  function renderSignup(d){
    const body=document.querySelector('#accountBody'); body.innerHTML=`<h2>회원가입</h2><p class="account-note">원하는 고유 ID를 정합니다. 이미 존재하는 ID는 사용할 수 없습니다.</p><label>새 ID<input id="accountIdInput" autocomplete="off" placeholder="예: labfinder27"></label><button id="accountSignupGo" class="primary" type="button">이 ID로 회원가입</button><button id="accountBack" class="secondary" type="button">로그인으로 돌아가기</button><p id="accountStatus" class="status"></p>`;
    document.querySelector('#accountBack').onclick=()=>render();
    document.querySelector('#accountSignupGo').onclick=async()=>{const s=document.querySelector('#accountStatus');s.textContent='회원가입 중…';try{await signup(document.querySelector('#accountIdInput').value);d.close();}catch(e){s.textContent=e.message;}};
    setTimeout(()=>document.querySelector('#accountIdInput')?.focus(),0);
  }

  function init(){
    if(!ready)return;
    const button=document.querySelector('#accountOpen'); if(button)button.onclick=render;
    if(supa)supa.auth.onAuthStateChange(()=>{ /* UI account state is controlled explicitly by ID login. */ });
    window.SnuAccount={isConfigured:()=>ready,isLoggedIn:()=>Boolean(username&&user),isAuthReady:()=>true,open:render,login,signup,logout,setFavorite,loadFavorites,callGemini,getUser:()=>user,getUsername:()=>username};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
