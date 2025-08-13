(function(global){
  const { assert, clamp } = global.utils || {};

  function validateState(state, TILES){
    const errs = [];
    try {
      if (!Array.isArray(state.players)) errs.push('players no es array');
      state.players?.forEach((p,idx)=>{
        if (typeof p.money!=='number') errs.push(`p${idx}.money inválido`);
        if (p.pos<0 || p.pos>=TILES.length) errs.push(`p${idx}.pos fuera de rango`);
      });
      TILES.forEach((t,i)=>{
        if (t.owner!=null && (t.owner<0 || t.owner>=state.players.length))
          errs.push(`tile${i}.owner inválido`);
        if (t.houses!=null && (t.houses<0 || t.houses>5)) errs.push(`tile${i}.houses inválido`);
      });
      const owners = new Map();
      TILES.forEach((t,i)=>{
        if (t.owner!=null){
          const k = `${t.owner}:${t.family||t.color||'na'}:${i}`;
          if (owners.has(k)) errs.push(`tile duplicada ${i}`); else owners.set(k,true);
        }
      });
    } catch(e){ errs.push('Excepción en validate: '+e.message); }
    return errs;
  }

  function repairState(state, TILES){
    state.players.forEach(p=>{
      if (!isFinite(p.money)) p.money = 0;
      p.pos = clamp(Math.trunc(p.pos || 0), 0, TILES.length-1);
      p.alive = !!p.alive;
      if (p.jail!=null) p.jail = clamp(Math.trunc(p.jail || 0), 0, 10);
    });
    TILES.forEach(t=>{
      if (t.owner!=null && (t.owner<0 || t.owner>=state.players.length)) t.owner=null;
      if (t.houses!=null) t.houses = clamp(Math.trunc(t.houses || 0), 0, 5);
      if (t.mortgaged!=null) t.mortgaged = !!t.mortgaged;
    });
    recomputeDerived(state, TILES);
    return state;
  }

  function recomputeDerived(state, TILES){
    const families = {};
    TILES.forEach((t,i)=>{
      const fam = t.family || t.color || 'na';
      families[fam] ??= { count:0, ownedBy: new Map() };
      families[fam].count++;
      if (t.owner!=null) families[fam].ownedBy.set(t.owner, (families[fam].ownedBy.get(t.owner)||0)+1);
    });
    state.players.forEach((p,pi)=>{
      p.monopolies = [];
      Object.entries(families).forEach(([fam,info])=>{
        if (info.ownedBy.get(pi) === info.count) p.monopolies.push(fam);
      });
      p.netWorth = Math.trunc(p.money || 0) + TILES.reduce((s,t)=> s + (t.owner===pi ? (t.basePrice||0) + (t.houses||0)*(t.housePrice||0) : 0), 0);
    });
  }

  const api = { validateState, repairState, recomputeDerived };
  global.utils = Object.assign(global.utils || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
