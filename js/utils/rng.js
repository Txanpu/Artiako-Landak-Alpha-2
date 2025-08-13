(function(global){
  function seedFromString(s){
    let h=1779033703^s.length;
    for(let i=0;i<s.length;i++){ h=Math.imul(h^s.charCodeAt(i),3432918353); h=h<<13|h>>>19; }
    return h>>>0;
  }
  function mulberry32(a){ return function(){ let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function makeRNG(seed){ const r = mulberry32(seed>>>0); return {
    next:()=>r(), int:(min,max)=>Math.floor(r()*(max-min+1))+min, pick:(arr)=>arr[Math.floor(r()*arr.length)]
  };}
  const rollDice = (rng)=> [rng.int(1,6), rng.int(1,6)];

  const api = { seedFromString, mulberry32, makeRNG, rollDice };
  global.utils = Object.assign(global.utils || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
