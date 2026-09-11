(() => {
  'use strict';
  const cfg = window.SUPABASE_CONFIG || {};
  const ready = Boolean(cfg.url && cfg.anonKey && window.supabase?.createClient);
  const syntheticEmail = username => `${username.toLowerCase()}@users.snu-lab-navigator.app`;
  const supa = ready ? window.supabase.createClient(cfg.url, cfg.anonKey) : null;
  const fallbackUserKey = 'snu-lab-fallback-user';
  let currentUser = null;
  let backendStatus = ready ? 'ready' : 'not-configured';

  const $ = (s, r = document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validUsername = v => /^[A-Za-z0-9_.-]{3,40}$/.test(v);
  const functionsBase = () => String(cfg.functionsBase || (cfg.url ? `${cfg.url.replace(/\/$/, '')}/functions/v1` : '')).replace(/\/$/, '');

  const renderDialog = () => `<dialog id="accountDialog" class="account-dialog"><button class="close" id="accountClose" type="button">×</button><div id="accountBody"></div></dialog>`;
  function ensureDialog() {
    if ($('#accountDialog')) return;
    document.body.insertAdjacentHTML('beforeend', renderDialog());
    $('#accountClose').onclick = () => $('#accountDialog').close();
  }
  function localState() { try { return JSON.parse(localStorage.getItem(fallbackUserKey) || '{}'); } catch (_) { return {}; } }
  function saveLocal(data) { localStorage.setItem(fallbackUserKey, JSON.stringify(data)); }
  function setHeaderLabel(label) { const b=$('#accountOpen'); if(b)b.textContent=label; }
  async function getSession() { if(!supa)return null; const {data}=await supa.auth.getSession(); return data.session || null; }
  async function postFunction(path, body) {
    const session = await getSession(); if(!session) throw new Error('로그인 세션이 없습니다.');
    const res = await fetch(`${functionsBase()}/${path}`, {method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(body)});
    const payload = await res.json().catch(()=>({})); if(!res.ok) throw new Error(payload.error || `서버 오류 ${res.status}`); return payload;
  }
  async function loadFavorites() {
    if(!supa || !currentUser) return JSON.parse(localStorage.getItem('snu-lab-favorites-v1') || '[]');
    const {data,error}=await supa.from('favorites').select('lab_id').eq('user_id',currentUser.id); if(error)throw error;
    const ids=(data||[]).map(r=>r.lab_id); localStorage.setItem('snu-lab-favorites-v1',JSON.stringify(ids)); window.dispatchEvent(new Event('snu-favorites-changed')); return ids;
  }
  async function setFavorite(labId, enabled) {
    if(!currentUser || !supa){const state=localState();const f=new Set(state.favorites||[]);enabled?f.add(labId):f.delete(labId);state.favorites=[...f];saveLocal(state);return;}
    if(enabled){const {error}=await supa.from('favorites').upsert({user_id:currentUser.id,lab_id:labId});if(error)throw error;}
    else {const {error}=await supa.from('favorites').delete().eq('user_id',currentUser.id).eq('lab_id',labId);if(error)throw error;}
    await loadFavorites();
  }
  async function signup(username,password,apiKey){
    if(!ready)throw new Error('Supabase가 아직 연결되지 않았습니다. 관리자 설정이 필요합니다.');
    if(!validUsername(username))throw new Error('아이디는 영문·숫자·._- 조합 3~40자로 입력해 주세요.');
    if(password.length<8)throw new Error('비밀번호는 8자 이상이어야 합니다.');
    if(apiKey.trim().length<20)throw new Error('Gemini API 키를 입력해 주세요.');
    const {data,error}=await supa.auth.signUp({email:syntheticEmail(username),password,options:{data:{username}}});
    if(error)throw error;
    if(!data.session)throw new Error('회원가입은 되었지만 이메일 확인이 활성화되어 있습니다. Supabase Auth에서 이메일 확인을 끄거나 계정 확인을 완료해 주세요.');
    currentUser=data.user; await postFunction('user-secret',{action:'set',apiKey:apiKey.trim()}); await loadFavorites();
    sessionStorage.setItem('snu-lab-account-user',username); setHeaderLabel(`👤 ${username}`); window.dispatchEvent(new Event('snu-favorites-changed')); $('#accountDialog').close();
  }
  async function restoreGeminiKey(){
    if(!currentUser || !supa)return;
    try{const data=await postFunction('user-secret',{action:'get'}); if(data.apiKey)sessionStorage.setItem('snu-lab-gemini-key',data.apiKey);}catch(_){/* key may not yet be configured */}
  }
  async function login(username,password){
    if(!ready)throw new Error('Supabase가 아직 연결되지 않았습니다.');
    if(!validUsername(username))throw new Error('저장된 계정 아이디를 선택하거나 올바른 아이디를 입력해 주세요.');
    const {data,error}=await supa.auth.signInWithPassword({email:syntheticEmail(username),password}); if(error)throw new Error('아이디 또는 비밀번호가 맞지 않습니다.');
    currentUser=data.user; await restoreGeminiKey(); try{await loadFavorites();}catch(_){ } sessionStorage.setItem('snu-lab-account-user',username); setHeaderLabel(`👤 ${username}`); window.dispatchEvent(new Event('snu-favorites-changed')); $('#accountDialog').close();
  }
  async function logout(){if(supa)await supa.auth.signOut();currentUser=null;sessionStorage.removeItem('snu-lab-gemini-key');sessionStorage.removeItem('snu-lab-account-user');setHeaderLabel('로그인');}
  async function callGemini(body,model='gemini-3.1-flash-lite'){
    if(currentUser&&supa)return {payload:await postFunction('gemini-proxy',{model,body}),model};
    throw new Error('로그인 후 AI 기능을 사용할 수 있습니다.');
  }
  function recentUsers(){try{return JSON.parse(localStorage.getItem('snu-lab-recent-usernames')||'[]');}catch(_){return[];}}
  function saveRecentUsername(username){const list=recentUsers().filter(x=>x!==username);list.unshift(username);localStorage.setItem('snu-lab-recent-usernames',JSON.stringify(list.slice(0,5)));}
  async function openAccount(){
    ensureDialog();const users=recentUsers();const body=$('#accountBody');
    body.innerHTML=`<h2>SNU Lab Navigator 계정</h2><p class="account-note">아이디·비밀번호는 Supabase Auth에서 관리하고 Gemini API 키는 서버에서 암호화해 계정에 연결합니다. 이 브라우저에는 최근 사용한 아이디만 기억합니다.</p><div class="account-tabs"><button type="button" data-tab="login" class="active">로그인</button><button type="button" data-tab="signup">회원가입</button></div><section id="accountLogin"><label>아이디${users.length?`<div class="recent-users">${users.map(u=>`<button type="button" class="recent-user" data-user="${esc(u)}">${esc(u)}</button>`).join('')}</div>`:''}<input id="accountLoginUser" autocomplete="username" value="${esc(users[0]||'')}"></label><label>비밀번호<input id="accountLoginPass" type="password" autocomplete="current-password"></label><button id="accountLoginGo" class="primary" type="button">로그인</button><button id="accountLogout" class="secondary" type="button" ${currentUser?'':'hidden'}>로그아웃</button><p id="accountLoginStatus" class="status"></p></section><section id="accountSignup" hidden><label>아이디<input id="accountSignupUser" autocomplete="username"></label><label>비밀번호<input id="accountSignupPass" type="password" autocomplete="new-password"></label><label>Gemini API 키<input id="accountSignupKey" type="password" autocomplete="off" placeholder="AIza…"></label><button id="accountSignupGo" class="primary" type="button">회원가입</button><p id="accountSignupStatus" class="status"></p></section>`;
    body.querySelectorAll('[data-tab]').forEach(btn=>btn.onclick=()=>{body.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===btn));$('#accountLogin').hidden=btn.dataset.tab!=='login';$('#accountSignup').hidden=btn.dataset.tab!=='signup';});
    body.querySelectorAll('.recent-user').forEach(btn=>btn.onclick=()=>{$('#accountLoginUser').value=btn.dataset.user;$('#accountLoginPass').focus();});
    $('#accountLoginGo').onclick=async()=>{const s=$('#accountLoginStatus');s.textContent='로그인 중…';try{const u=$('#accountLoginUser').value.trim();await login(u,$('#accountLoginPass').value);saveRecentUsername(u);}catch(e){s.textContent=e.message;}};
    $('#accountLogout').onclick=async()=>{await logout();$('#accountDialog').close();};
    $('#accountSignupGo').onclick=async()=>{const s=$('#accountSignupStatus');s.textContent='가입 중…';try{const u=$('#accountSignupUser').value.trim();await signup(u,$('#accountSignupPass').value,$('#accountSignupKey').value);saveRecentUsername(u);}catch(e){s.textContent=e.message;}};
    if(!ready)body.querySelectorAll('.status')[0].textContent='관리자가 Supabase URL/anon key와 Edge Function을 연결하면 계정 기능이 활성화됩니다.';
    $('#accountDialog').showModal();
  }
  function wireUi(){
    ensureDialog(); $('#accountOpen').onclick=openAccount; $('#connectAiOpen').onclick=()=>{if(ready)openAccount();else document.querySelector('#aiKeyDialog')?.showModal();};
    const welcome=document.querySelector('#welcomeConnect'); if(welcome){welcome.textContent='회원가입 / 로그인';welcome.onclick=e=>{e.preventDefault();document.querySelector('#welcomeDialog')?.close();openAccount();};}
    const keyInput=document.querySelector('#welcomeGeminiKey'); if(keyInput)keyInput.hidden=true;
    const keyStatus=document.querySelector('#welcomeKeyStatus'); if(keyStatus)keyStatus.textContent='계정을 만들고 Gemini API 키를 연결하면 다음 로그인부터 비밀번호만 입력해 사용할 수 있습니다.';
  }
  async function init(){
    ensureDialog();
    if(supa){const session=await getSession();currentUser=session?.user||null;if(currentUser){const name=currentUser.user_metadata?.username||sessionStorage.getItem('snu-lab-account-user')||recentUsers()[0]||currentUser.email?.split('@')[0]||'계정';saveRecentUsername(name);setHeaderLabel(`👤 ${name}`);await restoreGeminiKey();try{await loadFavorites();}catch(_){}}supa.auth.onAuthStateChange((_event,s)=>{currentUser=s?.user||null;if(!currentUser){sessionStorage.removeItem('snu-lab-gemini-key');setHeaderLabel('로그인');}});}
    window.SnuAccount={isConfigured:()=>ready,isLoggedIn:()=>Boolean(currentUser),open:openAccount,setFavorite,loadFavorites,callGemini,getUser:()=>currentUser,backendStatus:()=>backendStatus};
    wireUi();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
