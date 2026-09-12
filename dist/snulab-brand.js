(() => {
  'use strict';
  function addMark(target,cls){
    if(!target||target.querySelector('.snulab-brand-mark'))return;
    const mark=document.createElement('img');
    mark.src='snulab-mark.svg?v=20260913-01';
    mark.alt='스누랩';
    mark.className='snulab-brand-mark '+cls;
    target.prepend(mark);
  }
  function install(){
    addMark(document.querySelector('header .eyebrow'),'snulab-header-mark');
    addMark(document.querySelector('#welcomeDialog .eyebrow'),'snulab-welcome-mark');
    const style=document.createElement('style');
    style.textContent='.snulab-brand-mark{object-fit:contain;vertical-align:middle;border-radius:10px;flex:0 0 auto}.snulab-header-mark{width:42px;height:42px;margin-right:10px}.snulab-welcome-mark{width:36px;height:36px;margin-right:9px}header .eyebrow,#welcomeDialog .eyebrow{display:flex;align-items:center}';
    document.head.appendChild(style);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
