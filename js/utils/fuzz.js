(function(global){
  const { makeRNG } = global.utils || {};
  const { validateState } = global.utils || {};

  function runFuzz({ state, TILES, turns=200, seed=12345, actPerTurn=3, actions }){
    const rng = makeRNG ? makeRNG(seed) : null; const errors=[];
    for (let t=0; t<turns; t++){
      for (let k=0;k<actPerTurn;k++){
        const a = rng ? rng.pick(actions) : actions[Math.floor(Math.random()*actions.length)];
        try { a(state, TILES, rng); } catch(e){ errors.push({turn:t, action:a.name||'anon', error:e.message}); }
        const errs = validateState ? validateState(state, TILES) : [];
        if (errs.length) errors.push({turn:t, action:a.name||'anon', errs});
      }
    }
    return errors;
  }
  const sampleActions = [
    function moveRand(s,T,rng){ const p = s.players[rng.int(0,s.players.length-1)]; p.pos = (p.pos + rng.int(1,6)) % T.length; },
    function payRent(s,T,rng){ const p = s.players[rng.int(0,s.players.length-1)]; p.money -= rng.int(10,200); }
  ];

  const api = { runFuzz, sampleActions };
  global.utils = Object.assign(global.utils || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
