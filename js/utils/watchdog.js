(function(global){
  function makeWatchdog(ms=3000){
    let timer=null;
    return {
      arm(tag='op'){
        clearTimeout(timer);
        timer = setTimeout(()=>{ console.error('Watchdog timeout:', tag); throw new Error('Timeout '+tag); }, ms);
      },
      disarm(){ clearTimeout(timer); timer=null; }
    };
  }

  const api = { makeWatchdog };
  global.utils = Object.assign(global.utils || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
