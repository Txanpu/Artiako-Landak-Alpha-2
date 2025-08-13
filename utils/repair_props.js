(function(global){
  function repairProps(state, TILES, log=console.log){
    const refunds = [];
    if(!state || !Array.isArray(state.players) || !Array.isArray(TILES)) return refunds;
    TILES.forEach((t,i)=>{
      if(t && t.mortgaged && (t.houses||0) > 0){
        const refund = (t.houses||0) * (t.housePrice||0);
        const owner = t.owner!=null ? state.players[t.owner] : null;
        if(owner) owner.money = (owner.money||0) + refund;
        refunds.push({ index:i, refund });
        try { log(`refund ${refund} to player ${t.owner} for tile ${i}`); } catch(e){}
        t.houses = 0;
      }
    });
    return refunds;
  }
  const api = { repairProps };
  global.utils = Object.assign(global.utils || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
