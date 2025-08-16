// v20-part8-fixed.js — eventos + cartas + mini‑juego de galgos (revisión)
// Cárgalo DESPUÉS de v20-part1..7.js en v20.html

/* ===============================
   MÓDULO: EVENTOS Y CARTAS
   =============================== */
(function(){
  'use strict';

  // --- Estado y dependencias suaves ---
  const state   = (window.state   ||= {});
  const TILES   = (window.TILES   ||= []);
  const BANK    = (window.BANK    ||= {});
  const Estado  = (window.Estado  ??  'E');

  const log         = window.log         || function(){ console.log.apply(console, arguments); };
  const headline    = window.headline    || function(msg){ log('==', msg); };
  const fmtMoney    = window.fmtMoney    || function(n){ return (n|0) + '€'; };
  const renderPlayers = window.renderPlayers || function(){};
  const BoardUI     = window.BoardUI     || {};
  const groupTiles  = window.groupTiles  || function(t){ return [{x:t}]; };
  const ownsFullGroup = window.ownsFullGroup || function(){ return false; };
  const canBuildEven  = window.canBuildEven  || function(){ return true; };

  // transfer/giveMoney con fallback a operación simple si tu engine no soporta opts
  const _transfer0 = window.transfer || function(from,to,amount){ (from.money-=amount); if(to && to.money!=null) to.money+=amount; };
  function transfer(from,to,amount,opts){ try{ return window.transfer ? window.transfer(from,to,amount,opts) : _transfer0(from,to,amount); }catch{ return _transfer0(from,to,amount); } }
  function giveMoney(to,amount,opts){ if (!to) return; try{ if (window.transfer) return window.transfer({money:0}, to, -amount, opts); }catch{}; (to.money ??= 0); to.money += amount; }

  // ====== Estado base para eventos ======
  state.ownerRentMul     ||= {};   // {pid|'E': {mul, turns}}
  state.rentFilters      ||= [];    // [{name, mul, turns, match(tile)}]
  state.rentCap          ||= null;  // {amount, turns}
  state.garnish          ||= {};    // {pid:{count, turns}}
  state.blockMortgage    ||= {};    // {pid: turns}
  state.blockBuildTurns  ||= 0;     // int
  state.sellBonusByOwner ||= {};    // {pid: mul}
  state.cement           ||= null;  // {taken, turns}

  // ====== Helpers ======
  function pickPlayer(exceptId=null){
    const pool = (state.players||[]).filter(p=>p.alive && p.id!==exceptId);
    if (!pool.length) return null;
    const s = prompt('Elige jugador (número):\n'+pool.map(p=>`${p.id+1}. ${p.name}`).join('\n'));
    const id = Number(s)-1;
    return state.players[id] && state.players[id].alive ? state.players[id] : null;
  }
  function pickOne(arr){ return arr[Math.floor(Math.random()*arr.length)] }
  function richestPlayer(){
    return (state.players||[]).filter(p=>p.alive).sort((a,b)=>(b.money||0)-(a.money||0))[0]||null;
  }
  function tilesOf(p, pred){
    return TILES.map((t,i)=>({t,i})).filter(o=>o.t.type==='prop' && o.t.owner===p.id && (!pred || pred(o.t,o.i)));
  }
  function isTransport(t){ return ['bus','rail','ferry','air'].includes(t.subtype); }
  function isLeisure(t){
    // ocio aproximado: color 'pink' o subtipos típicos de ocio
    return t.color==='pink' || ['casino_bj','casino_roulette','fiore'].includes(t.subtype);
  }
  function ownsMonopoly(p,t){ try{ return !!ownsFullGroup(p,t); }catch(_){ return false; } }
  function canAuctionIdx(i){ const t=TILES[i]; return t && t.type==='prop' && t.owner===null; }


  // ====== Ajuste de alquileres (si no existe) ======
  if (typeof window.adjustRentForEvents !== 'function'){
    window.adjustRentForEvents = function(payer, tile, base){
      let rent = Math.max(0, Math.round(base||0));
      // Multiplicadores por propietario
      const ownerId = (tile.owner==='E') ? 'E' : tile.owner;
      if (state.ownerRentMul && state.ownerRentMul[ownerId]){
        rent = Math.round(rent * state.ownerRentMul[ownerId].mul);
      }
      // Filtros por categoría
      if (Array.isArray(state.rentFilters)) {
        for (const ef of state.rentFilters) {
          if (ef.turns<=0) continue;
          try { if (ef.match(tile)) rent = Math.round(rent * ef.mul); } catch {}
        }
      }
      // Tope global
      if (state.rentCap && state.rentCap.amount>0) rent = Math.min(rent, state.rentCap.amount);
      return Math.max(0, rent|0);
    };
  }

  // ====== Wrapper de transfer para embargo de rentas ======
  if (!state.__eventsTransferWrapped && typeof window.transfer === 'function'){
    state.__eventsTransferWrapped = true;
    const _transfer2 = window.transfer;
    window.transfer = function(from,to,amount,opts){
      try{
        const isRent = /Alquiler|Fiore|IVA alquiler/i.test(opts?.reason||'');
        const toId = (to==='E'||to===Estado) ? 'E' : to?.id;
        if (isRent && toId!=null && state.garnish && state.garnish[toId] && state.garnish[toId].count>0){
          const g = state.garnish[toId];
          g.count--;
          log(`⚖️ Embargo: renta de ${fmtMoney(amount)} redirigida al Estado (quedan ${g.count}).`);
          return _transfer2.call(this, from, Estado, amount, Object.assign({}, opts, {reason: (opts?.reason||'')+' [embargada]'}));
        }
      }catch{}
      return _transfer2.apply(this, arguments);
    };
  }

  // ====== Bloqueos y bonus en acciones ======
  if (!state.__eventsMortgageWrapped && typeof window.mortgage === 'function'){
    state.__eventsMortgageWrapped = true;
    const _mortgage = window.mortgage;
    window.mortgage = function(){
      try{
        const p = (state.players||[])[state.current];
        if (state.blockMortgage && p && state.blockMortgage[p.id]>0){
          return log('🚫 Bloqueo de hipoteca activo: no puedes hipotecar este turno.');
        }
      }catch{}
      return _mortgage.apply(this, arguments);
    };
  }

  if (!state.__eventsBuildWrapped && typeof window.buildHouse === 'function'){
    state.__eventsBuildWrapped = true;
    const _buildHouse = window.buildHouse;
    window.buildHouse = function(){
      if ((state.blockBuildTurns||0) > 0){
        return log('🚫 Huelga de obras: nadie puede construir este turno.');
      }
      return _buildHouse.apply(this, arguments);
    };
  }

  if (!state.__eventsSellWrapped && typeof window.sellHouse === 'function'){
    state.__eventsSellWrapped = true;
    const _sellHouse = window.sellHouse;
    window.sellHouse = function(){
      const p = (state.players||[])[state.current];
      const mul = (state.sellBonusByOwner && p) ? (state.sellBonusByOwner[p.id]||1) : 1;
      const before = p ? p.money : null;
      const out = _sellHouse.apply(this, arguments);
      try{
        if (p && mul>1 && before!=null && p.money!=null && p.money<=before){
          const delta = Math.round((before - p.money) * (mul - 1));
          if (delta>0){ giveMoney(p, delta, {reason:'Bonus gentrificación'}); log(`Bonus de venta +${Math.round((mul-1)*100)}% aplicado: +${fmtMoney(delta)}.`); }
        }
      }catch{}
      return out;
    };
  }

  // ====== Ticks al final de turno ======
  function tickEvents(){
    // ownerRentMul
    if (state.ownerRentMul){
      for (const [pid, obj] of Object.entries(state.ownerRentMul)){
        if (!obj) continue;
        if ((obj.turns||0) > 0){ obj.turns--; if (!obj.turns) delete state.ownerRentMul[pid]; }
      }
    }
    // rentFilters
    if (Array.isArray(state.rentFilters)){
      state.rentFilters.forEach(ef => { if (ef.turns>0) ef.turns--; });
      state.rentFilters = state.rentFilters.filter(ef => ef.turns>0);
    }
    // rentCap
    if (state.rentCap && (state.rentCap.turns||0) > 0){
      state.rentCap.turns--; if (!state.rentCap.turns) state.rentCap = null;
    }
    // embargo
    if (state.garnish){
      for (const [pid, g] of Object.entries(state.garnish)){
        if (!g) continue;
        if ((g.turns||0) > 0){ g.turns--; if (!g.turns) delete state.garnish[pid]; }
      }
    }
    // bloqueo hipoteca
    if (state.blockMortgage){
      for (const [pid, t] of Object.entries(state.blockMortgage)){
        if (t>0){ state.blockMortgage[pid] = t-1; if (!state.blockMortgage[pid]) delete state.blockMortgage[pid]; }
      }
    }
    // huelga obras
    if ((state.blockBuildTurns||0) > 0){ state.blockBuildTurns--; }
    // cemento
    if (state.cement && state.cement.turns>0){
      state.cement.turns--;
      if (!state.cement.turns){
        BANK.housesAvail = Math.max(0, (BANK.housesAvail|0) + (state.cement.taken||0));
        state.cement = null;
        log('⏳ Fin racionamiento de cemento: se devuelve stock de casas.');
      }
    }
  }

  if (!state.__eventsTickInstalled && typeof window.endTurn === 'function'){
    state.__eventsTickInstalled = true;
    const _endTurn = window.endTurn;
    window.endTurn = function(){
      const r = _endTurn.apply(this, arguments);
      try{ tickEvents(); }catch(e){ console.error(e); }
      return r;
    };
  }

  // ====== Funciones auxiliares para cartas de construcción/IVA (si no existen) ======
  if (typeof window.news_build_cost !== 'function'){
    window.news_build_cost = function(perc, turns){
      state.buildEventMul = (state.buildEventMul||0) + perc;
      state.buildEventTurns = Math.max(state.buildEventTurns||0, turns||0);
      headline(`Construcción ${perc>0?'+':''}${perc}% durante ${turns} turno(s).`);
    };
  }
  if (typeof window.news_iva_build !== 'function'){
    window.news_iva_build = function(perc, turns){
      state.ivaBuildMul = (state.ivaBuildMul||0) + perc;
      state.ivaBuildTurns = Math.max(state.ivaBuildTurns||0, turns||0);
      headline(`IVA de obra ${perc>0?'+':''}${perc}% durante ${turns} turno(s).`);
    };
  }

  // === UI de carta de EVENTO (usa #doubleOverlay ya existente) ===
  (function ensureEventUI(){
    if (document.getElementById('event-css')) return;
    const css = document.createElement('style');
    css.id = 'event-css';
    css.textContent = `
      #doubleOverlay{align-items:center;justify-content:center}
      .eventCard{display:flex;flex-direction:column;gap:10px;align-items:center;
        background:#111827;border:1px solid #30363d;border-radius:14px;
        padding:18px 20px;max-width:360px;text-align:center;box-shadow:0 6px 30px rgba(0,0,0,.35)}
      .eventTitle{font-weight:900;font-size:1.05rem;letter-spacing:.3px}
      .eventText{opacity:.9}
      .eventBtn{margin-top:4px;padding:8px 12px;border-radius:10px;border:1px solid #30363d;background:#1f2937;color:#e6edf3;cursor:pointer}
    `;
    document.head.appendChild(css);
  })();
    function showEventCard(title, text){
      return new Promise((resolve)=>{
        const ov = document.getElementById('doubleOverlay');
        if (!ov) return resolve(); // fallback si no hay overlay
        ov.innerHTML = `<div class="eventCard">
          <div class="eventTitle">${title||'SUERTE'}</div>
          <div class="eventText">${text||''}</div>
          <button class="eventBtn" autofocus>Aceptar</button>
        </div>`;
        ov.style.display = 'flex';
        ov.style.pointerEvents = 'auto';
        ov.style.opacity = '1';
        ov.style.transition = 'opacity 0.2s';
        let closed = false;
        function close(){
          if(closed) return;
          closed = true;
          ov.style.opacity = '0';
          setTimeout(()=>{ ov.style.display='none'; ov.style.opacity=''; ov.style.pointerEvents=''; resolve(); }, 200);
        }
        ov.querySelector('.eventBtn').onclick = close;
        setTimeout(close, 700);
      });
    }

  // Mapa de descripciones (nombre → desc)
  const EVENT_DESCS = {
    'Deriva inflacionaria': 'Los costes de construcción suben un 25% durante 3 turnos.',
    'Pacto obligatorio temporal': 'Elige un rival: sus rentas se reducen al 50% durante 5 turnos.',
    'Duelo de dados': 'Tiras dados contra un rival; quien gane roba una propiedad sin hipoteca ni monopolio.',
    'Festival EDM': 'Alquileres de ocio +15% y transporte −10% durante 2 rondas.',
    'Subasta ciega en casilla libre': 'Se subasta a puja oculta una casilla libre (la primera disponible).',
    'Subida de IVA obra': 'El IVA o sobrecoste de construir sube un 20% durante 2 turnos.',
    'Desinflación': 'Bajan los costes de construcción un 15% durante 1 turno.',
    'Rescate exprés': 'Cobras 150 ahora; tus dos primeras rentas quedan embargadas durante 2 turnos.',
    'Auditoría': 'Pagas el 33% de tu base imponible; si no tienes, recibes 50.',
    'Venta forzosa': 'El jugador más rico pierde una propiedad sin edificios a subasta abierta.',
    'Boom ocio': 'Los alquileres de ocio suben un 25% durante 3 turnos.',
    'Recesión industria': 'Elige un color o familia: sus alquileres bajan un 25% durante 3 turnos.',
    'Gentrificación': 'Si tienes 3+ casas en todo un grupo: +10% alquiler y +10% al vender casas (3 turnos).',
    'Racionamiento de cemento': 'Se retiran hasta 5 casas del banco durante 3 turnos.',
    'Trueque obligado': 'Intercambia una propiedad sin edificios con otro jugador del mismo color (si hay pareja).',
    'Bloqueo de hipoteca': 'El rival elegido no puede hipotecar durante 1 turno.',
    'Blackjack de 50': 'Mini-juego: si terminas con 20–21, cobras 120; si no, pagas 50.',
    'Dardos amistosos': 'Mini-juego: todos lanzan dardos; el peor paga 50 al mejor.',
    'Congelar alquileres': 'Tope global de alquiler por cobro: 150 durante 2 turnos.',
    'Plan de obras': 'El Estado construye automáticamente casas en algunas de sus propiedades (si hay stock).',
    'Incendio leve': 'Pierdes 1 nivel de edificación en una propiedad (hotel pasa a 4 casas).',
    'Huelga de obras': 'Nadie puede construir durante el próximo turno.',
    'Subasta de Lote': 'Se subasta a puja oculta un lote de 2-3 propiedades contiguas libres.'
  };

  // ====== Cartas ======
  const EVENT_CARDS = [
    { name: 'Deriva inflacionaria', run(p){ window.news_build_cost?.(25, 3); } },
    { name: 'Pacto obligatorio temporal', run(p){
        const target = pickPlayer(p.id); if (!target) return log('Sin objetivo.');
        state.ownerRentMul[target.id] = { mul: 0.5, turns: 5 };
        headline(`Pacto temporal: rentas de ${target.name} al 50% durante 5 turnos.`);
    }},
    { name: 'Duelo de dados', run(p){
        const rival = pickPlayer(p.id); if (!rival) return log('Sin rival.');
        function roll(){
            if (window.RolesConfig?.dice0to9 && window.Roles?.rollDie0to9) {
                return Roles.rollDie0to9() + Roles.rollDie0to9();
            }
            return (1+Math.floor(Math.random()*6)) + (1+Math.floor(Math.random()*6));
        }
        let a=roll(), b=roll();
        log(`${p.name} tira ${a} vs ${rival.name} ${b}.`);
        while(a===b){ a=roll(); b=roll(); log(`Empate. Nueva tirada: ${a} vs ${b}.`); }
        const winner = a>b? p : rival; const loser = a>b? rival : p;
        const pool = tilesOf(loser, t=>!ownsMonopoly(loser,t) && !t.mortgaged);
        if (!pool.length) return log('No hay propiedades robables.');
        const choice = prompt('Elige índice a robar:\n'+pool.map((o,k)=>`${k+1}. ${o.t.name}`).join('\n'),'1');
        const pick = pool[Math.max(0, Math.min(pool.length-1, (Number(choice)||1)-1))];
        pick.t.owner = winner.id;
        log(`⚔️ Duelo: ${winner.name} roba ${pick.t.name} a ${loser.name}.`);
        BoardUI.refreshTiles?.(); renderPlayers();
    }},
    { name: 'Festival EDM', run(p){
        state.rentFilters.push({ name:'ocio+', mul:1.15, turns:2, match:isLeisure });
        state.rentFilters.push({ name:'transporte−', mul:0.90, turns:2, match:isTransport });
        headline('Festival EDM: ocio +15%, transporte −10% (2 rondas).');
    }},
    { name: 'Subasta ciega en casilla libre', run(p){
        const here = TILES[p.pos];
        let idx = (here && here.type==='prop' && here.owner===null) ? p.pos
                 : TILES.findIndex((t,i)=> t.type==='prop' && t.owner===null);
        if (idx<0) return log('No hay propiedades libres.');
        if (window.GameDebtMarket?.startAuctionForTile) {
          GameDebtMarket.startAuctionForTile(idx, { sealed: true });
        } else {
          window.startAuctionFlow?.(idx, { sealed: true });
        }
    }},
    { name: 'Subida de IVA obra', run(p){ window.news_iva_build?.(20, 2); } },
    { name: 'Desinflación', run(p){ window.news_build_cost?.(-15, 1); } },
    { name: 'Rescate exprés', run(p){
        giveMoney(p, 150, {taxable:false, reason:'Rescate exprés'});
        state.garnish[p.id] = { count: 2, turns: 2 };
        headline(`${p.name} recibe rescate exprés: embargadas sus 2 primeras rentas (2 turnos).`);
    }},
    { name: 'Auditoría', run(p){
        const due = Math.max(0, Math.round((p.taxBase||0) * 0.33));
        if (due>0){
          transfer(p, Estado, due, {taxable:false, reason:'Auditoría 33% base imponible'});
          p.taxBase = 0; renderPlayers();
        } else {
          giveMoney(p, 50, {taxable:false, reason:'Auditoría sin base → incentivo'});
        }
    }},
    { name: 'Venta forzosa', run(p){
        const rich = richestPlayer(); if (!rich) return;
        const pool = tilesOf(rich, t=> !t.houses && !t.hotel);
        if (!pool.length) return log('Venta forzosa: el más rico no tiene propiedades “limpias”.');
        const pick = pickOne(pool);
        pick.t.owner = null;
        log(`🔨 Venta forzosa: ${rich.name} pierde ${pick.t.name} a subasta abierta.`);
        BoardUI.refreshTiles?.(); renderPlayers();
        window.startAuctionFlow?.(pick.i, { sealed: false });
    }},
    { name: 'Boom ocio', run(p){
        state.rentFilters.push({ name:'boom-ocio', mul:1.25, turns:3, match:isLeisure });
        headline('Boom de ocio: +25% alquiler (3 turnos).');
    }},
    { name: 'Recesión industria', run(p){
        const fams = Array.from(new Set(TILES.filter(t=>t.type==='prop' && !t.subtype).map(t=>t.familia||t.color))).sort();
        if (!fams.length) return log('No hay familias.');
        const pick = prompt('Elige familia para recesión (texto exacto):\n'+fams.join(', '), fams[0]);
        if (!pick) return;
        state.rentFilters.push({ name:`recesion-${pick}`, mul:0.75, turns:3, match:(t)=> t.type==='prop' && (t.familia||t.color)===pick });
        headline(`Recesión en ${pick}: −25% alquiler (3 turnos).`);
    }},
    { name: 'Gentrificación', run(p){
        state.sellBonusByOwner[p.id] = 1.10;
        state.rentFilters.push({
          name:'gentrif',
          mul:1.10,
          turns:3,
          match:(t)=> t.type==='prop' && t.owner===p.id && t.houses>=3 && groupTiles(t).every(o=>o.x.houses>=3)
        });
        headline('Gentrificación: +10% renta y venta de casas durante 3 turnos.');
    }},
    { name: 'Racionamiento de cemento', run(p){
        if (state.cement){ log('Ya había racionamiento activo.'); return; }
        const take = Math.min(5, Math.max(0, BANK.housesAvail||0));
        BANK.housesAvail = (BANK.housesAvail|0) - take;
        state.cement = { taken: take, turns: 3 };
        headline(`Racionamiento de cemento: −${take} casas de stock durante 3 turnos.`);
    }},
    { name: 'Trueque obligado', run(p){
        const other = pickPlayer(p.id); if (!other) return;
        const mine = tilesOf(p, t=>!t.houses && !t.hotel);
        const theirs = tilesOf(other, t=>!t.houses && !t.hotel);
        for (const m of mine){
          const partner = theirs.find(o => (o.t.familia||o.t.color) === (m.t.familia||m.t.color));
          if (partner){
            const A=m.t, B=partner.t; const aOwner = A.owner, bOwner = B.owner;
            A.owner = bOwner; B.owner = aOwner;
            log(`♻️ Trueque: ${p.name} ↔ ${other.name} (grupo ${(A.familia||A.color)})`);
            BoardUI.refreshTiles?.(); renderPlayers();
            return;
          }
        }
        log('No hay pareja de mismo color sin edificios para trueque.');
    }},
    { name: 'Bloqueo de hipoteca', run(p){
        const rival = pickPlayer(p.id); if (!rival) return;
        state.blockMortgage[rival.id] = 1;
        log(`⛔ ${rival.name} no puede hipotecar 1 turno.`);
    }},
    { name: 'Blackjack de 50', run(p){
        function draw(){ return 2 + Math.floor(Math.random()*10); }
        let total = draw() + draw();
        while(total < 17){
          const ans = prompt(`Tienes ${total}. ¿Pides carta? (s/n)`,'s');
          if (!ans || ans.toLowerCase().startsWith('n')) break;
          total += draw();
        }
        if (total>=20 && total<=21){
          giveMoney(p, 120, {taxable:false, reason:'Blackjack de 50'});
          log(`🃏 Blackjack: ${p.name} se planta en ${total} → +120.`);
        } else {
          transfer(p, Estado, 50, {taxable:false, reason:'Blackjack de 50 (pierde)'});
          log(`🃏 Blackjack: ${p.name} termina en ${total} → paga 50.`);
        }
    }},
    { name: 'Dardos amistosos', run(p){
        const players = (state.players||[]).filter(pl=>pl.alive);
        if (players.length < 2) return log('Dardos: se necesitan al menos 2 jugadores.');
        const scores = players.map(pl=> ({ pl, score: Math.floor(Math.random()*181) }));
        scores.forEach(s=> log(`${s.pl.name} lanza y obtiene ${s.score} puntos.`));
        scores.sort((a,b)=> b.score - a.score);
        const best = scores.filter(s=> s.score === scores[0].score);
        const worst = scores.filter(s=> s.score === scores[scores.length-1].score);
        if (best.length === 1 && worst.length === 1 && best[0].pl.id !== worst[0].pl.id){
          transfer(worst[0].pl, best[0].pl, 50, {taxable:false, reason:'Dardos amistosos'});
          headline(`Dardos: ${best[0].pl.name} gana y recibe 50 de ${worst[0].pl.name}.`);
          renderPlayers();
        } else {
          log('Dardos: empate, sin pagos.');
        }
    }},
    { name: 'Congelar alquileres', run(p){
        state.rentCap = { amount: 150, turns: 2 };
        headline('Congelación: tope de renta 150 por cobro (2 turnos).');
    }},
    { name: 'Plan de obras', run(p){
        const props = TILES.map((t,i)=>({t,i})).filter(o=>o.t.type==='prop' && o.t.owner==='E' && !o.t.hotel && o.t.houses<=3);
        for(let pass=0; pass<4; pass++){
          for (const o of props){
            if ((BANK.housesAvail||0)<=0) { log('Sin stock para Plan de obras.'); break; }
            if (!canBuildEven(o.t, Estado)) continue;
            o.t.houses++; BANK.housesAvail--;
            log(`🏗️ Estado añade 1 casa en ${o.t.name}.`);
          }
        }
        BoardUI.refreshTiles?.(); renderPlayers();
    }},
    { name: 'Incendio leve', run(p){
        const withBuildings = tilesOf(p, t=>t.houses>0 || t.hotel);
        if (!withBuildings.length) return log('Incendio leve: no tienes edificios.');
        const pick = withBuildings[Math.floor(Math.random()*withBuildings.length)].t;
        if (pick.hotel){
          pick.hotel = false; pick.houses = 4; BANK.hotelsAvail = (BANK.hotelsAvail|0) + 1; BANK.housesAvail = Math.max(0, (BANK.housesAvail|0) - 4);
        } else {
          pick.houses--; BANK.housesAvail = (BANK.housesAvail|0) + 1;
        }
        log(`🔥 Incendio leve en ${pick.name}: pierdes 1 nivel.`);
        try{ if (pick.insured) giveMoney(p, 50, {taxable:false, reason:'Seguro'}); }catch{}
        BoardUI.refreshTiles?.(); renderPlayers();
    }},
    { name: 'Huelga de obras', run(p){
        state.blockBuildTurns = Math.max(state.blockBuildTurns||0, 1);
        headline('Huelga de obras: nadie construye el próximo turno.');
    }},
    { name: 'Subasta de Lote', run(p){
        if (!window.GameExtras) return log('Módulo de extras no cargado.');
        const bundles = GameExtras.findFreeBundles({ size: 2 }); // buscar lotes de 2
        if (bundles.length > 0) {
          GameExtras.startBundleAuctionFromEvent(bundles[0], { sealed: true });
        } else {
          log('No se encontraron lotes de propiedades libres para subastar.');
        }
    }},
    { name: 'Información Privilegiada', run(p){
        if (window.GameRiskPlus?.Insider) {
            const total = GameRiskPlus.Insider.give(p.id);
            log(`Insider: ${p.name} ahora tiene ${total} token(s).`);
        } else {
            log('Módulo de riesgo no cargado.');
        }
    }}
  ];

  // Inyecta descripciones y baraja
  function __injectEventDescs(){ (EVENT_CARDS||[]).forEach(c=>{ if(!c.desc) c.desc = EVENT_DESCS[c.name] || ''; }); }
  __injectEventDescs();
  // [PATCH] Exponer eventos para módulos externos
  window.events = EVENT_CARDS;

  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function ensureDeck(){ if (!state.eventDeck || !state.eventDeck.length) state.eventDeck = shuffle(EVENT_CARDS.slice()); }

  // Carta visible + ejecución del efecto
  window.drawEvent = function(p, titleOverride){
    let card = null;
    // [PATCH] Insider: usa el evento fijado si existe
    if (window.GameRiskPlus?.drawEventPatched) {
      card = GameRiskPlus.drawEventPatched();
    } else {
      ensureDeck();
      card = state.eventDeck.shift();
    }
    if (!card) { log('No hay eventos disponibles.'); return; }

    // El objeto card puede venir del deck o del patcher.
    // Buscamos la descripción en el mapa global.
    const text = card.desc || EVENT_DESCS[card.name] || '';
    const title = titleOverride || card.name;
    const body  = (titleOverride && titleOverride !== card.name)
      ? `${card.name}: ${text}`
      : text;
    log(`🃏 Evento: <b>${card.name}</b>`);
    showEventCard(title, body).then(()=>{
      try {
        if (typeof window.resolverCarta === 'function') {
          // v22: Lógica unificada de eventos y efectos
          resolverCarta(card, p, p.pos);
        } else {
          card.run(p); // Fallback a la lógica original
        }
      } catch(e) {
        console.error(e); log('Error al ejecutar evento.');
      }
    });
  };

  // Export mínimo
  // window.__events = { EVENT_CARDS }; // Deprecado en favor de window.events
})();

/* ==========================================
   MÓDULO: CARRERA DE GALGOS (apuestas + UI)
   ========================================== */
(function(){
  'use strict';

  // CSS de la actividad (idempotente)
  (function ensureGreyhoundCSS(){
    if (document.getElementById('greyhound-css')) return;
    const css = document.createElement('style');
    css.id = 'greyhound-css';
    css.textContent = `
      #doubleOverlay{align-items:center;justify-content:center}
      .gh-card,.gh-bet,.gh-result{
        background:#0f172a;border:1px solid #334155;border-radius:14px;
        padding:18px 20px;max-width:720px;color:#e5e7eb;box-shadow:0 8px 30px rgba(0,0,0,.35)
      }
      .gh-title{font-weight:900;font-size:1.05rem;margin-bottom:8px}
      .gh-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:center}
      .gh-btn{padding:8px 12px;border:1px solid #334155;border-radius:10px;background:#111827;cursor:pointer}
      .gh-btn[disabled]{opacity:.5;cursor:not-allowed}
      .gh-track{position:relative;width:720px;height:220px;background:#111827;border:1px dashed #475569;border-radius:12px;margin-top:10px;overflow:hidden}
      .gh-lane{position:absolute;left:0;right:0;height:44px;border-top:1px dashed #1f2937}
      .gh-dog{position:absolute;left:8px;top:0;width:44px;height:44px;border-radius:10px;background:#1f2937;display:flex;align-items:center;justify-content:center;font-size:22px}
      .gh-flag{position:absolute;right:8px;top:0;width:6px;height:44px;background:#eab308}
      .gh-pot{opacity:.9;margin:6px 0 2px}
    `;
    document.head.appendChild(css);
  })();

  // Config
  const GH_CONFIG = {
    DOGS: 5,
    ANTE: 50,
    TRACK_LEN: 640,
    MIN_SPD: 0.9,
    MAX_SPD: 2.2,
    VARIANCE: 0.25,
    TICK_MS: 16
  };

  // Utilidades (compatibles con el motor)
  const state = (window.state ||= {});
  function _playersAll(){
    if (state && Array.isArray(state.players)) return state.players;
    if (window.players && Array.isArray(window.players)) return window.players;
    throw new Error('No encuentro la lista de jugadores (state.players o window.players)');
  }
  function _log(msg){ try{ (window.log||console.log)(msg); }catch{ console.log(msg); } }
  function _headline(msg){ if (typeof window.headline==='function') window.headline(msg); else _log(`<b>${msg}</b>`); }
  function _render(){ if (typeof window.renderPlayers==='function') window.renderPlayers(); }
  function _pay(from, to, amt, reason){
    if (amt<=0) return;
    const bank = { name:'Banco', id:'bank' };
    const src = from || bank, dst = to || bank;
    if (typeof window.transfer==='function') return window.transfer(src, dst, amt, {reason});
    (src.money ??= 0); (dst.money ??= 0);
    src.money -= amt; dst.money += amt; _render();
  }
  function _give(to, amt, reason){ _pay(null, to, amt, reason); }
  const _fmt = window.fmtMoney || (n => (n|0)+'€');

  // Overlay helpers
  function ovShow(html){
    const ov = document.getElementById('doubleOverlay');
    if (!ov) throw new Error('Falta #doubleOverlay en el DOM');
    ov.innerHTML = html;
    ov.style.display = 'flex';
    ov.style.pointerEvents = 'auto';
    return ov;
  }
  function ovHide(){ const ov = document.getElementById('doubleOverlay'); if (ov) { ov.style.display = 'none'; ov.style.pointerEvents = ''; } }

  // Paso 1: recoger apuestas de TODOS los jugadores (secuencial, un overlay por jugador)
  function ghAskBetSequential(potRef){
    const ps = _playersAll().filter(x=>!x.botDisabled);
    const bets = new Map(); // key: playerId/name -> {player, dog}
    const DOGS = GH_CONFIG.DOGS;
    let idx = 0;

    return new Promise((resolve)=>{
      const next = ()=>{
        if (idx >= ps.length){ resolve(bets); return; }
        const p = ps[idx++];
        const dogBtns = Array.from({length:DOGS}, (_,i)=>`<button class="gh-btn" data-i="${i}">Galgo ${i+1}</button>`).join('');
        const html = `
          <div class="gh-bet">
            <div class="gh-title">Apuesta de ${p.name}</div>
            <div class="gh-pot">Bote actual: <b>${_fmt(potRef.value)}</b> — Apuesta fija: <b>${_fmt(GH_CONFIG.ANTE)}</b></div>
            <div class="gh-row">${dogBtns}</div>
            <div style="margin-top:8px;opacity:.85">Elige el galgo ganador.</div>
          </div>`;
        const ov = ovShow(html);
        ov.querySelectorAll('.gh-btn').forEach(b=>{
          b.onclick = ()=>{
            const choice = +b.dataset.i;
            bets.set(p.id ?? p.name, {player:p, dog:choice});
            _pay(p, null, GH_CONFIG.ANTE, 'Apuesta carrera de galgos');
            potRef.value += GH_CONFIG.ANTE;
            next();
          };
        });
      };
      next();
    });
  }

  // Paso 2: animación de carrera
  function ghRunRace(){
    const DOGS = GH_CONFIG.DOGS;
    const laneH = 44;
    const trackH = laneH * DOGS;
    const lanes = Array.from({length:DOGS}, (_,i)=>`<div class="gh-lane" style="top:${i*laneH}px"></div>`).join('');
    const dogs  = Array.from({length:DOGS}, (_,i)=>`<div class="gh-dog" id="gh-dog-${i}" style="top:${i*laneH}px">🐕</div><div class="gh-flag" style="top:${i*laneH}px"></div>`).join('');
    const html = `
      <div class="gh-card">
        <div class="gh-title">¡Carrera de galgos!</div>
        <div class="gh-track" id="gh-track" style="height:${trackH}px">
          ${lanes}${dogs}
        </div>
      </div>`;
    ovShow(html);

    const pos = new Array(DOGS).fill(0);
    const spd = new Array(DOGS).fill(0).map(()=> GH_CONFIG.MIN_SPD + Math.random()*(GH_CONFIG.MAX_SPD-GH_CONFIG.MIN_SPD));
    const el  = new Array(DOGS).fill(0).map((_,i)=> document.getElementById(`gh-dog-${i}`));
    const goal = GH_CONFIG.TRACK_LEN;
    let winner = -1, running = true;

    return new Promise((resolve)=>{
      const step = ()=>{
        if (!running) return;
        for(let i=0;i<DOGS;i++){
          spd[i] += (Math.random()*2-1)*GH_CONFIG.VARIANCE;
          if (spd[i] < GH_CONFIG.MIN_SPD) spd[i] = GH_CONFIG.MIN_SPD;
          if (spd[i] > GH_CONFIG.MAX_SPD) spd[i] = GH_CONFIG.MAX_SPD;
          pos[i] += spd[i];
          if (pos[i] >= goal && winner<0){ winner = i; running = false; break; }
          el[i].style.transform = `translateX(${pos[i]}px)`;
        }
        if (running) setTimeout(()=>requestAnimationFrame(step), GH_CONFIG.TICK_MS);
        else {
          for(let i=0;i<DOGS;i++) el[i].style.transform = `translateX(${Math.min(pos[i],goal)}px)`;
          setTimeout(()=>resolve(winner), 800);
        }
      };
      requestAnimationFrame(step);
    });
  }

  // Paso 3: orquestador
  async function startGreyhoundEvent(triggeredByPlayer){
    if (window.Roles && Roles.shouldBlockGame && Roles.shouldBlockGame('greyhounds')) {
      alert('El gobierno de izquierdas ha prohibido las apuestas de galgos');
      return;
    }
    if (window.Roles && Roles.isPowerOff && Roles.isPowerOff()) {
      alert('Apagón nacional: carreras de galgos canceladas');
      return;
    }
    const pot = { value: 0 };
    _headline('¡Carrera de galgos en SALIDA!');
    _log('🏁 Evento: Carrera de Galgos');

    const betsMap = await ghAskBetSequential(pot);
    let winnerDog = await ghRunRace();

    try {
      // Busca si algún Proxeneta ha apostado
      const entries = Array.from(betsMap.values?.() || []);
      const prox = entries.find(v => window.Roles?.is?.(v.player.id, 'proxeneta'));
      if (prox) {
        const baseP = 1 / (window.GH_CONFIG?.DOGS || 6);
        const wantWin = window.Roles.decideWin(baseP, prox.player, 'greyhounds');
        if (wantWin && prox.dog !== winnerDog) {
          // fuerza ganador al galgo apostado por el Proxeneta
          winnerDog = prox.dog;
        }
      }
    } catch {}

    const winners = [];
    betsMap.forEach((v)=>{ if (v.dog === winnerDog) winners.push(v.player); });

    ovShow(`<div class="gh-result">
      <div class="gh-title">Resultado</div>
      <div>Ganó el <b>Galgo ${winnerDog+1}</b>.</div>
      <div class="gh-pot" id="gh-payline"></div>
      <div class="gh-row"><button class="gh-btn" id="gh-close">Continuar</button></div>
    </div>`);

    if (winners.length === 0){
      document.getElementById('gh-payline').innerHTML = `Nadie acertó. El bote <b>${_fmt(pot.value)}</b> va al Banco.`;
    } else {
      const share = Math.floor(pot.value / winners.length);
      winners.forEach(w=> _give(w, share, 'Premio carrera de galgos'));
      document.getElementById('gh-payline').innerHTML =
        `Acertaron: <b>${winners.map(w=>w.name).join(', ')}</b>. Premio por cabeza: <b>${_fmt(share)}</b>.`;
    }
    _render();

    document.getElementById('gh-close').onclick = ()=> ovHide();
  }

  // Exponer API
  window.startGreyhoundEvent = startGreyhoundEvent;
})();
