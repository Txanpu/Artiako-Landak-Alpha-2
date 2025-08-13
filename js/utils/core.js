(function(global){
  const assert = (cond, msg='Assert failed') => { if (!cond) throw new Error(msg); };

  const clamp = (x, min, max) => Math.min(max, Math.max(min, x));

  let _lock = false;
  async function nonReentrant(fn){
    if (_lock) throw new Error('Reentrancy');
    _lock = true;
    try { return await fn(); } finally { _lock = false; }
  }

  const toCents = (n) => (n==null?0:Math.round(Number(n)*100));
  const fromCents = (c) => Math.trunc(c || 0) / 100;
  const money = {
    add:(a,b)=>a+b,
    sub:(a,b)=>a-b,
    mul:(a,k)=>Math.round(a*k),
    div:(a,k)=>Math.round(a/k)
  };

  function makeLogger(cap=500){
    const buf = new Array(cap); let i=0, full=false;
    return {
      log:(...xs)=>{ buf[i]=[Date.now(), ...xs]; i=(i+1)%cap; if(i===0) full=true; },
      dump:()=> full ? buf.slice(i).concat(buf.slice(0,i)) : buf.slice(0,i),
      clear:()=>{ i=0; full=false; }
    };
  }

  const api = { assert, clamp, nonReentrant, toCents, fromCents, money, makeLogger };
  global.utils = Object.assign(global.utils || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
