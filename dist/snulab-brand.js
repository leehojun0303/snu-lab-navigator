(() => {
  'use strict';
  function install(){
    const eyebrow=document.querySelector('header .eyebrow');
    if(!eyebrow||eyebrow.querySelector('.snulab-brand-mark'))return;
    const mark=document.createElement('img');
    mark.src='snulab-mark.svg?v=20260913-01';
    mark.alt='스누랩';
    mark.className='snulab-brand-mark';
    eyebrow.prepend(mark);
    const style=document.createElement('style');
    style.textContent='.snulab-brand-mark{width:42px;height:42px;object-fit:contain;vertical-align:middle;margin-right:10px;border-radius:10px}.eyebrow{display:flex;align-items:center}';
    document.head.appendChild(style);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
