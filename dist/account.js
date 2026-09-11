(() => {
  'use strict';
  const cfg = window.SUPABASE_CONFIG || {};
  const ready = Boolean(cfg.url && cfg.anonKey && window.supabase?.createClient);
  const supa = ready ? window.supabase.createClient(cfg.url, cfg.anonKey) : null;
  const RECENT_IDS = 'snu-lab-recent-usernames-v2';
  const LOCAL_FALLBACK = 'snu-lab-local-account-v2';
  let currentUser = null;
  let currentUsername = '';

  const $ = (s, r = document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validUsername = v => /^[A-Za-z0-9_.-]{3,40}$/.test(v);

  function setHeader() {
    const button = $('#accountOpen');
    if (button) button.textContent = currentUsername ? `👤 ${currentUsername}` : '로그인';
  }
  function recentIds() { try { return JSON.parse(localStorage.getItem(RECENT_IDS) || '[]'); } catch (_) { return []; } }
  function saveRecentId(id) { const list = recentIds().filter(x => x !== id); list.unshift(id); localStorage.setItem(RECENT_IDS, JSON.stringify(list.slice(0, 5))); }
  function localAccount() { try { return JSON.parse(localStorage.getItem(LOCAL_FALLBACK) || '{}'); } catch (_) { return {}; } }
  function saveLocalAccount(data) { localStorage.setItem(LOCAL_FALLBACK, JSON.stringify(data)); }

  async function getSession() {
    if (!supa) return null;
    const { data } = await supa.auth.getSession();
    return data.session || null;
  }
  async function claimUsername(username) {
    if (!supa || !currentUser) return true;
    const { data, error } = await supa.rpc('claim_username', { p_username: username });
    if (error) throw new Error('아이디를 사용할 수 없습니다. 다른 아이디를 입력해 주세요.');
    if (!data) throw new Error('이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.');
    return true;
  }
  async function loadUsername() {
    if (!supa || !currentUser) return '';
    const { data, error } = await supa.from('profiles').select('username').eq('id', currentUser.id).maybeSingle();
    if (error) throw error;
    return data?.username || '';
  }
  async function loadFavorites() {
    if (!supa || !currentUser) return JSON.parse(localStorage.getItem('snu-lab-favorites-v1') || '[]');
    const { data, error } = await supa.from('favorites').select('lab_id').eq('user_id', currentUser.id);
    if (error) throw error;
    const ids = (data || []).map(r => r.lab_id);
    localStorage.setItem('snu-lab-favorites-v1', JSON.stringify(ids));
    window.dispatchEvent(new Event('snu-favorites-changed'));
    return ids;
  }
  async function setFavorite(labId, enabled) {
    if (!currentUser || !supa) {
      const state = localAccount(); const ids = new Set(state.favorites || []);
      enabled ? ids.add(labId) : ids.delete(labId); state.favorites = [...ids]; saveLocalAccount(state); return;
    }
    const result = enabled
      ? await supa.from('favorites').upsert({ user_id: currentUser.id, lab_id: labId })
      : await supa.from('favorites').delete().eq('user_id', currentUser.id).eq('lab_id', labId);
    if (result.error) throw result.error;
    await loadFavorites();
  }
  async function startAnonymousAccount(username) {
    if (!ready) throw new Error('계정 기능이 아직 연결되지 않았습니다. 관리자 설정이 필요합니다.');
    if (!validUsername(username)) throw new Error('아이디는 영문·숫자·._- 조합 3~40자로 입력해 주세요.');
    const { data, error } = await supa.auth.signInAnonymously({ options: { data: { username: username.toLowerCase() } } });
    if (error) throw new Error(`계정 생성에 실패했습니다: ${error.message}`);
    currentUser = data.user;
    try { await claimUsername(username); }
    catch (error) { await supa.auth.signOut(); currentUser = null; throw error; }
    currentUsername = username.toLowerCase();
    saveRecentId(currentUsername);
    localStorage.setItem('snu-lab-favorites-v1', '[]');
    setHeader();
    await loadFavorites();
    $('#accountDialog')?.close();
    window.dispatchEvent(new Event('snu-account-changed'));
  }
  async function resumeAnonymousAccount() {
    const session = await getSession();
    if (!session?.user) return false;
    currentUser = session.user;
    currentUsername = await loadUsername().catch(() => '') || session.user.user_metadata?.username || recentIds()[0] || '';
    if (!currentUsername) return false;
    saveRecentId(currentUsername);
    setHeader();
    await loadFavorites().catch(() => {});
    return true;
  }
  async function logout() {
    if (supa) await supa.auth.signOut();
    currentUser = null; currentUsername = '';
    setHeader();
    window.dispatchEvent(new Event('snu-account-changed'));
  }
  async function callGemini(body, model='gemini-3.1-flash-lite') {
    if (!currentUser || !supa) throw new Error('ID 로그인 후 AI 기능을 사용할 수 있습니다.');
    const session = await getSession();
    if (!session) throw new Error('로그인 세션이 없습니다.');
    const base = String(cfg.functionsBase || `${cfg.url.replace(/\/$/, '')}/functions/v1`).replace(/\/$/, '');
    const response = await fetch(`${base}/gemini-proxy`, {method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}`}, body:JSON.stringify({model,body})});
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Gemini 서버 오류 ${response.status}`);
    return {payload, model};
  }
  async function openAccount() {
    if (!supa) {
      alert('계정 기능은 Supabase 연결 후 사용할 수 있습니다.');
      return;
    }
    if (currentUser && currentUsername) {
      if (confirm(`${currentUsername} 계정에서 로그아웃할까요?`)) await logout();
      return;
    }
    if (!$('#accountDialog')) document.body.insertAdjacentHTML('beforeend', '<dialog id="accountDialog" class="account-dialog"><button class="close" id="accountClose" type="button">×</button><div id="accountBody"></div></dialog>');
    const dialog = $('#accountDialog');
    const body = $('#accountBody');
    const recent = recentIds();
    body.innerHTML = `<h2>연구실 탐색 계정</h2><p class="account-note">개인정보를 요구하지 않습니다. 원하는 고유 ID 하나만 정해두면 이 브라우저에서 즐겨찾기와 비교 기능을 이어서 사용할 수 있습니다.</p><p class="account-note">※ ID만으로 별도 기기에서 계정을 복구하는 인증은 제공하지 않습니다. 브라우저의 익명 로그인 세션이 계정의 실제 인증 수단입니다.</p><label>새 ID<input id="accountIdInput" autocomplete="off" placeholder="예: labfinder27"></label><button id="accountCreateGo" class="primary" type="button">이 ID로 시작하기</button><p id="accountStatus" class="status"></p>${recent.length ? `<div class="recent-title">최근 사용 ID</div><div class="recent-users">${recent.map(id => `<button class="recent-user" type="button" data-id="${esc(id)}">${esc(id)}</button>`).join('')}</div>` : ''}`;
    $('#accountClose').onclick = () => dialog.close();
    body.querySelectorAll('.recent-user').forEach(btn => btn.onclick = () => { $('#accountIdInput').value = btn.dataset.id; $('#accountIdInput').focus(); });
    $('#accountCreateGo').onclick = async () => {
      const status = $('#accountStatus'); const id = $('#accountIdInput').value.trim().toLowerCase();
      status.textContent = '계정 확인 중…';
      try { await startAnonymousAccount(id); } catch (e) { status.textContent = e.message; }
    };
    dialog.showModal();
  }
  async function init() {
    if (supa) {
      await resumeAnonymousAccount().catch(() => {});
      supa.auth.onAuthStateChange(async (_event, session) => {
        currentUser = session?.user || null;
        if (!currentUser) { currentUsername = ''; setHeader(); return; }
        currentUsername = await loadUsername().catch(() => '') || currentUser.user_metadata?.username || recentIds()[0] || '';
        if (currentUsername) saveRecentId(currentUsername);
        setHeader();
      });
    }
    const button = $('#accountOpen');
    if (button) button.onclick = openAccount;
    window.SnuAccount = {isConfigured:() => ready, isLoggedIn:() => Boolean(currentUser), open:openAccount, logout, setFavorite, loadFavorites, callGemini, getUser:() => currentUser, getUsername:() => currentUsername};
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
