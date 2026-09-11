(() => {
  'use strict';
  const cfg = window.SUPABASE_CONFIG || {};
  const ready = Boolean(cfg.url && cfg.anonKey && window.supabase?.createClient);
  const supa = ready ? window.supabase.createClient(cfg.url, cfg.anonKey) : null;
  const RECENT_IDS = 'snu-lab-recent-usernames-v7';
  let currentUser = null;
  let currentUsername = '';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const validUsername = v => /^[A-Za-z0-9_.-]{3,40}$/.test(v);

  function setHeader(){ const b = $('#accountOpen'); if (b) b.textContent = '로그인'; }
  function recentIds(){ try { const v = JSON.parse(localStorage.getItem(RECENT_IDS) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } }
  function saveRecentId(id){ const list = recentIds().filter(x => x !== id); list.unshift(id); localStorage.setItem(RECENT_IDS, JSON.stringify(list.slice(0,5))); }
  async function getSession(){ if (!supa) return null; const {data,error} = await supa.auth.getSession(); if (error) throw error; return data.session || null; }

  async function sessionUsername(session){
    if (!session?.user) return '';
    const {data,error} = await supa.from('profiles').select('username').eq('id',session.user.id).maybeSingle();
    if (error) throw error;
    return String(data?.username || session.user.user_metadata?.username || '').toLowerCase();
  }

  async function claimUsername(username){
    const {data,error} = await supa.rpc('claim_username',{p_username:username});
    if (error) {
      const message = String(error.message || '');
      if (/not_authenticated/i.test(message)) throw new Error('Supabase 인증 세션을 만들지 못했습니다. Anonymous Sign-Ins 설정을 확인해 주세요.');
      if (/invalid_username/i.test(message)) throw new Error('ID는 영문·숫자·._- 조합 3~40자로 입력해 주세요.');
      if (/duplicate|unique/i.test(message)) throw new Error('이미 사용 중인 ID입니다. 다른 ID를 입력해 주세요.');
      throw new Error(`ID 등록에 실패했습니다: ${message || error.code || 'Supabase RPC 오류'}`);
    }
    if (!data) throw new Error('이미 사용 중인 ID입니다. 다른 ID를 입력해 주세요.');
    return true;
  }

  async function finishSession(session, username){
    currentUser = session?.user || null;
    currentUsername = String(username || '').toLowerCase();
    if (!currentUser || !currentUsername) throw new Error('계정 정보를 확인하지 못했습니다.');
    saveRecentId(currentUsername);
    setHeader();
    await loadFavorites().catch(() => {});
    window.dispatchEvent(new Event('snu-account-changed'));
  }

  async function loadFavorites(){
    if (!supa || !currentUser) return [];
    const {data,error} = await supa.from('favorites').select('lab_id').eq('user_id',currentUser.id);
    if (error) throw error;
    const ids = (data || []).map(r => r.lab_id);
    localStorage.setItem('snu-lab-favorites-v1', JSON.stringify(ids));
    window.dispatchEvent(new Event('snu-favorites-changed'));
    return ids;
  }

  async function createAccount(username){
    if (!ready) throw new Error('Supabase 연결이 완료되지 않았습니다.');
    username = username.trim().toLowerCase();
    if (!validUsername(username)) throw new Error('ID는 영문·숫자·._- 조합 3~40자로 입력해 주세요.');

    const session = await getSession();
    if (session?.user) {
      const existing = await sessionUsername(session).catch(() => '');
      throw new Error(`현재 브라우저에 이미 ${existing || '기존'} 계정 세션이 있습니다. 먼저 로그아웃한 뒤 새 계정을 만들 수 있습니다.`);
    }

    const {data,error} = await supa.auth.signInAnonymously({options:{data:{username}}});
    if (error) throw new Error(`계정 생성에 실패했습니다: ${error.message}`);
    if (!data?.session?.user) throw new Error('익명 계정 생성에 실패했습니다. Supabase Anonymous Sign-Ins를 확인해 주세요.');
    try {
      await claimUsername(username);
      await finishSession(data.session, username);
      $('#accountDialog')?.close();
    } catch (e) {
      await supa.auth.signOut().catch(() => {});
      currentUser = null; currentUsername = '';
      throw e;
    }
  }

  async function loginById(username){
    if (!ready) throw new Error('Supabase 연결이 완료되지 않았습니다.');
    username = username.trim().toLowerCase();
    if (!validUsername(username)) throw new Error('ID는 영문·숫자·._- 조합 3~40자로 입력해 주세요.');

    const session = await getSession();
    if (!session?.user) {
      throw new Error('이 브라우저에 로그인할 계정 세션이 없습니다. 같은 브라우저에서 가입한 계정이면 기존 세션을 로그아웃하지 말고 사용해 주세요. 다른 브라우저에서 ID만으로 기존 계정을 복구하는 기능은 제공하지 않습니다.');
    }
    const existing = (await sessionUsername(session)).toLowerCase();
    if (existing !== username) {
      throw new Error(`입력한 ID와 현재 브라우저 계정이 다릅니다. 현재 세션: ${existing || '확인 불가'}`);
    }
    await finishSession(session, existing);
    $('#accountDialog')?.close();
  }

  async function logout(){
    if (supa) await supa.auth.signOut().catch(() => {});
    currentUser = null;
    currentUsername = '';
    setHeader();
    window.dispatchEvent(new Event('snu-account-changed'));
  }

  async function callGemini(body,model='gemini-3.1-flash-lite'){
    if (!currentUser || !supa) throw new Error('ID 계정으로 로그인해 주세요.');
    const session = await getSession();
    if (!session) throw new Error('로그인 세션이 없습니다. ID를 입력해 다시 로그인해 주세요.');
    const base = String(cfg.functionsBase || `${cfg.url.replace(/\/$/,'')}/functions/v1`).replace(/\/$/,'');
    const response = await fetch(`${base}/gemini-proxy`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({model,body})});
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Gemini 서버 오류 ${response.status}`);
    return {payload,model};
  }

  function renderAccountDialog(mode='login', notice=''){
    if (!$('#accountDialog')) document.body.insertAdjacentHTML('beforeend','<dialog id="accountDialog" class="account-dialog"><button class="close" id="accountClose" type="button">×</button><div id="accountBody"></div></dialog>');
    const dialog = $('#accountDialog');
    const recent = recentIds();
    const body = $('#accountBody');
    const isSignup = mode === 'signup';
    body.innerHTML = `<h2>${isSignup?'회원가입':'로그인'}</h2><p class="account-note">개인정보와 비밀번호를 요구하지 않습니다. ${isSignup?'새로운 고유 ID를 정하면 익명 계정이 만들어집니다.':'가입할 때 만든 ID를 입력해 로그인합니다.'}</p>${notice?`<p class="status">${esc(notice)}</p>`:''}<label>ID<input id="accountIdInput" autocomplete="off" placeholder="예: labfinder27"></label><button id="accountPrimaryGo" class="primary" type="button">${isSignup?'이 ID로 회원가입':'이 ID로 로그인'}</button><button id="accountSwitch" class="secondary" type="button">${isSignup?'로그인으로 돌아가기':'회원가입'}</button><button id="accountLogoutGo" class="secondary" type="button" ${currentUser?'':'hidden'}>현재 세션 로그아웃</button><p id="accountStatus" class="status"></p>${!isSignup&&recent.length?`<div class="recent-title">최근 사용 ID</div><div class="recent-users">${recent.map(id=>`<button class="recent-user" type="button" data-id="${esc(id)}">${esc(id)}</button>`).join('')}</div>`:''}`;
    $('#accountClose').onclick=()=>dialog.close();
    $('#accountSwitch').onclick=()=>renderAccountDialog(isSignup?'login':'signup');
    $('#accountLogoutGo').onclick=async()=>{await logout();renderAccountDialog('login','로그아웃했습니다. ID를 다시 입력해 로그인할 수 있습니다.');};
    body.querySelectorAll('.recent-user').forEach(btn=>btn.onclick=()=>{$('#accountIdInput').value=btn.dataset.id;$('#accountIdInput').focus();});
    $('#accountPrimaryGo').onclick=async()=>{
      const status=$('#accountStatus'); const id=$('#accountIdInput').value.trim().toLowerCase();
      status.textContent=isSignup?'새 계정을 만드는 중…':'로그인 확인 중…';
      try{if(isSignup){await createAccount(id);}else{await loginById(id);}}catch(e){status.textContent=e.message;$('#accountIdInput').focus();}
    };
    dialog.showModal();
    setTimeout(()=>$('#accountIdInput')?.focus(),0);
  }

  function openAccount(){
    if(!ready){alert('계정 기능은 Supabase 연결 후 사용할 수 있습니다.');return;}
    renderAccountDialog('login');
  }

  async function init(){
    // Do not auto-login in the UI. The user explicitly enters an ID when opening the login flow.
    setHeader();
    if(supa) supa.auth.onAuthStateChange(async(_event,session)=>{
      if(!session){currentUser=null;currentUsername='';setHeader();window.dispatchEvent(new Event('snu-account-changed'));}
    });
    const button=$('#accountOpen');
    if(button)button.onclick=openAccount;
    ['#saveGeminiKey','#welcomeConnect'].forEach(selector=>document.querySelector(selector)?.addEventListener('click',e=>{e.preventDefault();document.querySelector('#welcomeDialog')?.close();document.querySelector('#aiKeyDialog')?.close();openAccount();}));
    window.SnuAccount={isConfigured:()=>ready,isLoggedIn:()=>Boolean(currentUser&&currentUsername),isAuthReady:()=>Boolean(true),open:openAccount,logout,setFavorite,loadFavorites,callGemini,getUser:()=>currentUser,getUsername:()=>currentUsername};
  }

  async function setFavorite(labId,enabled){
    if(!supa||!currentUser)throw new Error('ID로 로그인해 주세요.');
    const result=enabled?await supa.from('favorites').upsert({user_id:currentUser.id,lab_id:labId}):await supa.from('favorites').delete().eq('user_id',currentUser.id).eq('lab_id',labId);
    if(result.error)throw result.error;
    await loadFavorites();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
