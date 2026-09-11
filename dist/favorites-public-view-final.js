(() => {
  'use strict';

  // Keep the public favorites view limited to descriptive information only.
  // Do not expose counts that can be read as research-performance rankings.
  function refresh() {
    const dialog = document.querySelector('#favDialog');
    if (!dialog) return;
    const table = dialog.querySelector('table');
    if (!table) return;
    const header = table.querySelector('thead tr');
    if (!header) return;

    // favorites-compare-fixed builds: Professor / Lab / Keywords / recent papers.
    // Remove the fourth column completely so the public favorites list stays
    // descriptive rather than performance-oriented.
    while (header.children.length > 3) header.lastElementChild.remove();
    dialog.querySelectorAll('tbody tr').forEach(row => {
      while (row.children.length > 3) row.lastElementChild.remove();
    });
  }

  document.addEventListener('click', event => {
    if (event.target.closest?.('#favShow')) {
      setTimeout(refresh, 0);
      setTimeout(refresh, 80);
      setTimeout(refresh, 250);
    }
  }, true);
  window.addEventListener('snu-account-changed', () => setTimeout(refresh, 0));
})();
