(() => {
  'use strict';
  let last = '';
  function sync() {
    const button = document.querySelector('#accountOpen');
    const badge = document.querySelector('#accountStateBadge');
    const account = window.SnuAccount;
    const id = String(account?.getUsername?.() || '').trim();
    const logged = Boolean(account?.isLoggedIn?.() && id);
    const state = logged ? `logged:${id}` : 'logged:0';
    if (state === last) return;
    last = state;
    if (button) {
      button.textContent = logged ? `👤 ${id}` : '로그인';
      button.dataset.loggedIn = logged ? 'true' : 'false';
      button.title = logged ? `${id} 계정으로 로그인됨 · 클릭하면 ID 로그인 화면` : 'ID를 입력해 로그인';
      button.setAttribute('aria-label', logged ? `${id} 계정으로 로그인됨` : '로그인');
    }
    if (badge) {
      badge.textContent = logged ? `로그인됨 · ${id}` : '';
      badge.hidden = !logged;
    }
  }
  window.addEventListener('snu-account-changed', sync);
  document.addEventListener('DOMContentLoaded', () => {
    sync();
    [100, 300, 700, 1500, 3000].forEach(ms => setTimeout(sync, ms));
  });
  [0, 100, 300, 700, 1500, 3000].forEach(ms => setTimeout(sync, ms));
})();
