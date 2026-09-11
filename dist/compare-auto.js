(() => {
  'use strict';

  function isLoggedIn() {
    try { return Boolean(window.SnuAccount?.isLoggedIn?.()); } catch (_) { return false; }
  }

  function triggerIfReady() {
    const dialog = document.querySelector('#compareDialog');
    if (!dialog || !dialog.open) return;
    const button = dialog.querySelector('#compareAiRun');
    const box = dialog.querySelector('#compareAiBox');
    if (!button || !box) return;

    // Keep the comparison compact and automatic. The existing bridge owns the
    // actual Gemini request and cache; this layer only removes the unnecessary
    // second click after the user has authenticated.
    button.hidden = true;
    button.setAttribute('aria-hidden', 'true');
    if (isLoggedIn()) {
      if (!box.dataset.autoStarted && !box.querySelector('.auto-compare-status')) {
        box.dataset.autoStarted = '1';
        box.innerHTML = '<p class="auto-compare-status">Gemini가 저장된 요약·키워드·최근 논문 정보를 기준으로 핵심 차이만 정리하는 중…</p>';
        setTimeout(() => {
          // account-ai-bridge listens for the click and handles caching/errors.
          button.click();
        }, 0);
      }
    } else if (!box.dataset.accountHint) {
      box.dataset.accountHint = '1';
      box.innerHTML = '<p class="auto-compare-status">로그인하면 표 아래에 Gemini 핵심 차이가 자동으로 표시됩니다.</p>';
    }
  }

  function observe() {
    const root = document.body;
    if (!root) return;
    const observer = new MutationObserver(() => triggerIfReady());
    observer.observe(root, {childList: true, subtree: true, attributes: true, attributeFilter: ['open']});
    window.addEventListener('snu-account-changed', () => {
      const dialog = document.querySelector('#compareDialog');
      if (dialog?.open && isLoggedIn()) {
        const button = dialog.querySelector('#compareAiRun');
        if (button) {
          const box = dialog.querySelector('#compareAiBox');
          if (box) { delete box.dataset.accountHint; delete box.dataset.autoStarted; }
          triggerIfReady();
        }
      }
    });
    triggerIfReady();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe);
  else observe();
})();
