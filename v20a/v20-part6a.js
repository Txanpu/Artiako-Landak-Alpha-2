/* v13 – Parte 6/7: efectos al caer y sistema de subastas */

function onLand(p, idx){
  const t = TILES[idx];
  if (!t) return;

  switch(t.type){
    case 'start':
      log(`${p.name} descansa en SALIDA.`);
      break;

    case 'tax': {
      // 3.1 Regularización de IVA
      ensureVAT(p);
      const netIVA = Math.round((p.vatOut||0) - (p.vatIn||0));
      if (netIVA > 0){
        // Debe ingresar al Estado
        transfer(p, Estado, netIVA, { taxable:false, reason:'Regularización IVA (ingreso)' });
        log(`IVA neto a ingresar: ${fmtMoney(netIVA)}.`);
      } else if (netIVA < 0){
        // Devolución del Estado
        transfer(Estado, p, -netIVA, { taxable:false, reason:'Regularización IVA (devolución)' });
        log(`IVA neto a devolver: ${fmtMoney(-netIVA)}.`);
      } else {
        log('IVA neto: 0. Sin movimientos.');
      }
      p.vatOut = 0; p.vatIn = 0;

      // 3.2 Impuesto sobre la renta (33%) sobre taxBase
      const base = Math.max(0, Math.round((p.taxBase||0) * 0.33));
      if (base>0){
        transfer(p, Estado, base, {taxable:false, reason:'Impuesto 33% (ganancias acumuladas)'});
        p.taxBase = 0;
      } else {
        log(`${p.name} no tiene ganancias acumuladas. No paga impuesto.`);
      }
      break;
    }

    case 'jail':
      log(`${p.name} está de visita en la cárcel.`);
      break;

    case 'gotojail':
      p.pos = TILES.findIndex(x=>x.type==='jail');
      p.jail = 3; // hasta 3 intentos
      BoardUI.refreshTiles();
      log(`🚔 ${p.name} va a la cárcel (máx 3 intentos).`);
      state.rolled = true; updateTurnButtons();
      break;

    case 'park':
      log(`${p.name} se relaja en el parque.`);
      break;

    case 'slots':
      playSlotsFree(p, t);
      break;

    case 'event':
      log(`🃏 ${p.name} cae en EVENTO.`);
      try{ window.drawEvent?.(p); }catch(e){ log('Error al ejecutar evento.'); }
      break;

    case 'prop': {
      if (t.owner === null){ showCard(idx,{canAuction:true}); startAuctionFlow(idx); }
      else if (t.owner === p.id){
        log(`${p.name} cae en su propia propiedad.`);
        if (['rail','ferry','air','bus'].includes(t.subtype)) offerTransportHop(p, idx, t);
        if (t.subtype==='fiore'){
          const n = Number(prompt('Trabajadores en Fiore (0-5):', t.workers||0));
          if (Number.isFinite(n) && n>=0 && n<=5){ t.workers = n; BoardUI.refreshTiles(); }
        }
      } else {
        // Casinos: solo si el dueño NO es el Estado (el Estado no puede ser dueño de casinos)
        if (t.subtype==='casino_bj' || t.subtype==='casino_roulette'){
          if (t.owner !== 'E'){
            const owner = state.players[t.owner];
            if (t.subtype==='casino_bj'){ playBlackjack(p, owner, t); break; }
            if (t.subtype==='casino_roulette'){ playRoulette(p, owner, t); break; }
          }
          // si llegase a ser del Estado (no debería), cae a pago de "alquiler" normal abajo
        }

        // v15-part6.js — en onLand(), rama case 'prop', justo antes del bloque de “PAGO DE ALQUILER…”
        if (t.subtype === 'fiore') {
          const workers = t.workers||0;
          const per     = t.workerRent||70;
          const total   = workers * per;
          const payee   = t.mortgaged ? Estado : state.players[t.owner];

          if (total > 0 && payee) {
            const ivaMul = state.rentIVAMul || 1;
            const base = (ivaMul > 1) ? Math.round(total / ivaMul) : total;
            const iva  = Math.max(0, total - base);

            transfer(p, payee, base, { taxable:false, deductible:true, reason:`Fiore ${workers}×${per}` });
            if (iva > 0){
              transfer(p, payee, iva, { taxable:false, deductible:true, reason:`IVA Fiore` });
              markIVAPaid(p, iva, ' (Fiore)');
              markIVACharged(payee===Estado? Estado : payee, iva, ' (Fiore)');
            }
            ensureAlive(p);
          } else {
            log(`${p.name} no paga en Fiore (sin trabajadores o sin dueño válido).`);
          }
          break; // Importante: no seguir al bloque de alquiler genérico
        }
        // Alquiler: mortgaged o dueño=Estado → paga al Estado; si no, al dueño
        // total a pagar (0 si el Estado tiene la propiedad hipotecada)
        const total = (t.owner === 'E' && t.mortgaged) ? 0 : getRent(t);
        // ¿a quién se paga?
        let payee = null;
        if (t.owner === 'E') {
          payee = t.mortgaged ? null : Estado;     // Estado cobra solo si no está hipotecada
        } else if (t.mortgaged) {
          payee = Estado;                           // hipotecadas de terceros → cobra Estado
        } else {
          payee = state.players[t.owner];           // dueño normal
        }

        if (total > 0 && payee) {
          transfer(p, payee, total, { taxable:false, deductible:true, reason:`Alquiler en ${t.name}` });
          ensureAlive(p);
        } else {
          log(`${p.name} no paga alquiler (sin dueño válido o alquiler 0).`);
        }
      }
      break;
    }

    default:
      log(`${p.name} cae en ${t.name || t.type}.`);
  }
}


/* ===== Subastas ===== */
function startAuctionFlow(tileIndex){
  const t = TILES[tileIndex];
  if (t.owner !== null || t.type!=='prop') return;

  const box = $('#auction');
  state.auction = {
    tile: tileIndex,
    price: Math.max(1, t.price||1),
    bestBid: 0,
    bestPlayer: null,   // pid numérico o 'E' para Estado
    active: new Set(state.players.filter(x=>x.alive).map(x=>x.id)),
    open: true,
    // Tope Estado: 0 en casino/fiore → no puja
    stateMax: (['casino_bj','casino_roulette','fiore'].includes(t.subtype))
              ? 0
              : Math.max(0, Math.min(Math.round((t.price||0)*1.30), Math.floor(Estado.money||0))),
    timer: null
  };

  box.style.display = 'block';
  drawAuction();
  // Arrancar puja automática del Estado
  maybeStateAutoBid();

  const endTurnBtn = document.getElementById('endTurn');
  if (endTurnBtn) endTurnBtn.disabled = true;
  updateTurnButtons();
}

function getNextStep(current){
  // Pasos “humanos” y conservadores
  if (current < 50) return 10;
  if (current < 200) return 20;
  if (current < 500) return 50;
  return 100;
}

function maybeStateAutoBid(){
  const a = state.auction; if(!a || !a.open) return;

  const t = TILES[a.tile];
  if (t && ['casino_bj','casino_roulette','fiore'].includes(t.subtype)) return; // no puja esos
  if (a.bestPlayer === 'E') return; // si ya va ganando, no re-puja

  // Si ya alcanzó su tope o no hay dinero, no puja
  const cap = Math.max(0, Math.min(a.stateMax, Math.floor(Estado.money||0)));
  if (a.bestBid >= cap) return;

  // Calcular siguiente puja del Estado
  const step = getNextStep(a.bestBid);
  const next = Math.min(cap, a.bestBid + step);
  if (next <= a.bestBid) return;

  a.bestBid = next;
  a.bestPlayer = 'E';
  drawAuction();

  if (a.bestBid < cap){
    clearTimeout(a.timer);
    a.timer = setTimeout(maybeStateAutoBid, 500 + Math.random()*600);
  }
}

function drawAuction(){
  const a = state.auction; const box = $('#auction'); if(!a||!box) return;
  const t = TILES[a.tile];
  const players = state.players.filter(p=>a.active.has(p.id));

  const bestName = a.bestPlayer==='E'
    ? 'Estado'
    : (a.bestPlayer!=null ? state.players[a.bestPlayer].name : '-');

  box.innerHTML = `
    <strong>Subasta: ${t.name}</strong> — Valor: ${fmtMoney(t.price)}<br>
    Mejor puja: <b>${bestName}</b> por <b>${fmtMoney(a.bestBid)}</b>
    <div class="row" style="margin-top:8px">
      ${players.map(p=>`
        <div class="badge" data-p="${p.id}">
          ${p.name} (${fmtMoney(p.money)})
          <div class="row" style="margin-top:6px">
            <button data-act="bid" data-step="10" data-p="${p.id}">+10</button>
            <button data-act="bid" data-step="50" data-p="${p.id}">+50</button>
            <button data-act="bid" data-step="100" data-p="${p.id}">+100</button>
            <button data-act="pass" data-p="${p.id}">Pasar</button>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="row" style="margin-top:8px">
      <button id="awardAuction" class="primary">Adjudicar</button>
    </div>
  `;

  box.querySelectorAll('button[data-act="bid"]').forEach(btn=>{
    btn.onclick = ()=>{
      const pid = parseInt(btn.getAttribute('data-p'),10);
      if (!a.active.has(pid)) return;
      const step= parseInt(btn.getAttribute('data-step'),10);
      const p = state.players[pid];

      // siguiente puja válida
      const nextBid = Math.max(a.bestBid + step, step);
      if (p.money < nextBid){ log(`${p.name} no puede pujar ${fmtMoney(nextBid)}.`); return; }

      a.bestBid = nextBid; a.bestPlayer = pid;
      drawAuction();

      // si un humano supera al Estado, el Estado vuelve a intentarlo (si tiene margen)
      clearTimeout(a.timer);
      a.timer = setTimeout(maybeStateAutoBid, 450);
    };
  });

  box.querySelectorAll('button[data-act="pass"]').forEach(btn=>{
    btn.onclick = ()=>{
      const pid = parseInt(btn.getAttribute('data-p'),10);
      a.active.delete(pid);
      log(`${state.players[pid].name} pasa.`);
      drawAuction();
    };
  });

  $('#awardAuction').onclick = ()=>{
    awardAuction();
  };
}

function awardAuction(){
  const a = state.auction; if(!a) return;
  const t = TILES[a.tile];
  const price = a.bestBid;

  // Si no hay pujas: desierta
  if (a.bestPlayer == null) {
    log('Subasta desierta.');
    $('#auction').style.display = 'none';
    state.auction = null;
    const endTurnBtn = document.getElementById('endTurn');
    if (endTurnBtn) endTurnBtn.disabled = false;
    updateTurnButtons();
    return;
  }

  // Ganó Estado
  if (a.bestPlayer==='E'){
    if ((Estado.money||0) < price){
      log('El Estado no tiene fondos suficientes para adjudicarse (se cancela).');
      return;
    }
    // paga de su caja
    Estado.money = Math.max(0, Math.floor((Estado.money||0) - price));
    t.owner = 'E';

    // NUEVO → repartir el gasto del Estado entre los demás jugadores vivos (no tributable)
    const vivos = state.players.filter(p=>p.alive);
    if (vivos.length > 0){
      const base = Math.floor(price / vivos.length);
      let resto = price - base * vivos.length;
      vivos.forEach((p, i)=>{
        const extra = i < resto ? 1 : 0;
        const amt = base + extra;
        if (amt > 0) giveMoney(p, amt, { taxable:false, reason:`Reparto por compra del Estado: ${t.name}` });
      });
    }

    log(`El Estado se adjudica ${t.name} por ${fmtMoney(price)}.`);
    clearTimeout(a.timer);
    $('#auction').style.display='none'; state.auction=null;
    BoardUI.refreshTiles(); renderPlayers();
    const endTurnBtn = document.getElementById('endTurn');
    if (endTurnBtn) endTurnBtn.disabled = false;
    updateTurnButtons?.();
    return;
  }

  // Ganó un jugador
  const buyer = state.players[a.bestPlayer];
  if (!buyer?.alive || buyer.money < price){ log('Adjudicación fallida.'); return; }
  transfer(buyer, Estado, price, {taxable:false, reason:`Compra en subasta: ${t.name}`});
  t.owner = buyer.id;

  clearTimeout(a.timer);
  $('#auction').style.display='none'; state.auction=null;
  BoardUI.refreshTiles(); renderPlayers();

  const endTurnBtn = document.getElementById('endTurn');
  if (endTurnBtn) endTurnBtn.disabled = false;
  updateTurnButtons();
}

// v15-part6.js — reemplazar función entera
function updateTurnButtons() {
  const rollBtn = document.getElementById('roll');
  const endTurnBtn = document.getElementById('endTurn');
  const a = state.auction;

  // Durante subasta: ocultar ambos y deshabilitar por si acaso
  if (a && a.open) {
    if (rollBtn) rollBtn.style.display = 'none';
    if (endTurnBtn) {
      endTurnBtn.style.display = 'none';
      endTurnBtn.disabled = true;
    }
    return;
  }

  // Fuera de subasta: UI normal
  if (rollBtn) rollBtn.style.display = state.rolled ? 'none' : '';
  if (endTurnBtn) {
    endTurnBtn.style.display = state.rolled ? '' : 'none';
    endTurnBtn.disabled = false;
  }
}
function offerTransportHop(p, idx, t){
  if (state.usedTransportHop) return;
  const same = (x)=> x.type==='prop' && (
    (t.subtype==='rail'&& (x.subtype==='rail'||(window.BUS_COUNTS_WITH_METRO&&x.subtype==='bus'))) ||
    (t.subtype==='bus' && (x.subtype==='bus'||(window.BUS_COUNTS_WITH_METRO&&x.subtype==='rail'))) ||
    (t.subtype===x.subtype)
  );
  const owns = TILES.map((x,i)=>({x,i})).filter(o=> same(o.x) && o.x.owner===p.id && o.i!==idx);
  if (!owns.length) return;

  const niceNames = { rail: 'metro', bus: 'Bizkaibus', ferry: 'ferry', air: 'aéreo' };
  const nice = niceNames[t.subtype] || t.subtype;
  const list = owns.map((o,k)=>`${k+1}. ${o.x.name}`).join('\n');
  const sel = prompt(`Moverte gratis a otro transporte (${nice}) tuyo este turno:\n${list}\nElige número (o cancela)`);
  const n = parseInt(sel,10);
  if (!Number.isFinite(n) || n<1 || n>owns.length) return;

  const dest = owns[n-1];
  p.pos = dest.i;
  BoardUI.refreshTiles();
  log(`🚇 ${p.name} usa su red de ${nice}s y va a ${dest.x.name}.`);
  state.usedTransportHop = true;
  onLand(p, dest.i);
}

// Cerrar carta para que se vea la subasta
const ov = document.getElementById('overlay');
if (ov) ov.style.display = 'none';

function applyAuctionButtons() {
  const a = state.auction;
  const box = $('#auction');
  if (!a || !box) return;

  // Habilitar o deshabilitar los botones según el estado de la subasta
  box.querySelectorAll('button[data-act="bid"]').forEach(btn=>{
    const pid = parseInt(btn.getAttribute('data-p'),10);
    btn.disabled = !a.active.has(pid);
  });
  box.querySelectorAll('button[data-act="pass"]').forEach(btn=>{
    const pid = parseInt(btn.getAttribute('data-p'),10);
    btn.disabled = !a.active.has(pid);
  });
  const endTurnBtn = document.getElementById('endTurn');
  if (endTurnBtn) endTurnBtn.disabled = a.open;
}

// === Casino: Blackjack (una mano, dueño es dealer)
function playBlackjack(player, owner, tile){
  if (!owner?.alive){ log('El dueño no puede actuar.'); return; }
  // [Inferencia] si gana el dealer, cada otro jugador paga 30; si gana un jugador, el dueño paga 15 al ganador.
  const players = state.players.filter(x=>x.alive && x.id!==owner.id);
  // simulación sencilla: dealer 17-23, cada jugador 15-23; >21 = se pasa
  const draw = (min,max)=> min + Math.floor(Math.random()*(max-min+1));
  const dealer = draw(17,23);
  const results = players.map(pl=>{
    const me = draw(15,23);
    const dealerWins = (dealer<=21) && (me>21 || dealer>=me);
    return {pl, dealerWins};
  });
  const dealerAllWin = results.every(r=>r.dealerWins);
  if (dealerAllWin){
    const pay = 30;
    results.forEach(({pl})=> transfer(pl, owner, pay, {taxable:false, reason:`Casino Blackjack en ${tile.name}`}));
    log(`🎰 Dealer (${owner.name}) gana. Todos pagan 30.`);
  } else {
    const winners = results.filter(r=>!r.dealerWins).map(r=>r.pl);
    winners.forEach(w=> transfer(owner, w, 15, {taxable:false, reason:`Casino Blackjack en ${tile.name}`}));
    log(`🎰 Ganan jugadores: ${winners.map(w=>w.name).join(', ')||'ninguno'}. ${owner.name} paga 15 a cada ganador.`);
  }
}

// === Casino: Ruleta (rojo/negro/verde)
function playRoulette(player, owner, tile){
  if (!owner?.alive){ log('El dueño no puede actuar.'); return; }
  const apuesta = prompt('Apuesta color (rojo/negro/verde) y cantidad. Ej: "rojo 50"');
  if(!apuesta) return;
  const m = apuesta.trim().toLowerCase().match(/(rojo|negro|verde)\s+(\d+)/);
  if(!m){ alert('Formato inválido'); return; }
  const color = m[1], amt = Math.max(1, parseInt(m[2],10));
  if (player.money < amt){ alert('No te llega.'); return; }

  const reds = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const n = Math.floor(Math.random()*37); // 0..36
  const outcome = (n===0)?'verde':(reds.has(n)?'rojo':'negro');

  // [Inferencia] pagos estándar: rojo/negro 1:1, verde 35:1
  const mult = (color==='verde')?35:1;
  if (color === outcome){
    transfer(owner, player, amt*mult, {taxable:false, reason:`Ruleta (${outcome}) en ${tile.name}`});
    log(`🎯 Ruleta: ${n} ${outcome}. Gana ${player.name} → cobra ${amt*mult}.`);
  } else {
    transfer(player, owner, amt, {taxable:false, reason:`Ruleta (${outcome}) en ${tile.name}`});
    ensureAlive(player);
    log(`🎯 Ruleta: ${n} ${outcome}. Pierde ${player.name} → paga ${amt}.`);
  }
}
