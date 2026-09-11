(() => {
  'use strict';
  const update = () => {
    const button = document.querySelector('#accountOpen');
    const account = window.SnuAccount;
    if (!button || !account) return;
    if (account.isLoggedIn?.()) {
      const id = String(account.getUsername?.() || '').trim();
      button.textContent = id ? `👤 ${id}` : '로그인';
      button.title = id ? `${id} 계정으로 로그인됨. 클릭하면 ID 입력 로그인 화면을 엽니다.` : '로그인';
      button.setAttribute('aria-label', id ? `${id} 계정으로 로그인됨` : '로그인');
    } else {
      button.textContent = '로그인';
      button.title = 'ID를 입력해 로그인';
      button.setAttribute('aria-label', '로그인');
    }
  };
  window.addEventListener('snu-account-changed', update);
  document.addEventListener('DOMContentLoaded', () => {
    update();
    setTimeout(update, 250);
    setTimeout(update, 1000);
  });
  setTimeout(update, 0);
})();
