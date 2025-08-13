(function(){
  const ua = navigator.userAgent || '';
  const isIPhone = /iPhone/i.test(ua);
  const isAndroidPhone = /Android/i.test(ua) && /Mobile/i.test(ua);
  const isIpad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isPhone = (isIPhone || isAndroidPhone) && !isIpad;
  const root = document.documentElement;
  if (isPhone) {
    root.classList.add('mobile');
  } else {
    root.classList.add('desktop');
    if (isIpad) {
      root.classList.add('tablet');
    }
  }
})();
