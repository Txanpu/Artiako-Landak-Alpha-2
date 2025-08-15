'use strict';

/* v13 – Parte 6/7: efectos al caer y sistema de subastas */

// Utilidad: cuadro de diálogo personalizado que sustituye a window.prompt
function promptDialog(message, defaultValue = '') {
  return new Promise(resolve => {
    const dialog = document.getElementById('promptDialog');
    if (!dialog) {
      resolve(defaultValue);
      return;
    }
    const form = document.getElementById('promptForm');
    const msgEl = document.getElementById('promptMessage');
    const input = document.getElementById('promptInput');
    const cancelBtn = document.getElementById('promptCancel');
    msgEl.textContent = message;
    input.value = defaultValue || '';
    const handleClose = () => {
      dialog.removeEventListener('close', handleClose);
      resolve(dialog.returnValue === 'cancel' ? null : dialog.returnValue);
    };
    dialog.addEventListener('close', handleClose);
    form.addEventListener('submit', function onSubmit(e) {
      e.preventDefault();
      dialog.close(input.value);
      form.removeEventListener('submit', onSubmit);
    });
    cancelBtn.addEventListener('click', function onCancel() {
      dialog.close('cancel');
      cancelBtn.removeEventListener('click', onCancel);
    });
    dialog.showModal();
    input.select();
  });
}

// Menú de acciones al caer en banca corrupta
function showBankMenu(){
  return new Promise(resolve => {
    const dialog = document.getElementById('bankMenu');
    if (!dialog){ resolve(null); return; }
    const handleClose = () => {
      dialog.removeEventListener('close', handleClose);
      const val = dialog.returnValue;
      resolve(val && val !== 'cancel' ? val : null);
    };
    dialog.addEventListener('close', handleClose, { once:true });
    dialog.showModal();
  });
}

async function exerciseOption(p){
  if(!p) return;
  const propName = await promptDialog('Nombre propiedad a ejercer:', '');
  const idx = state.options.findIndex(o => o.property === propName && o.buyer === p.id);
  if (idx < 0) {
    alert('No posees opción sobre esa propiedad');
    return;
  }
  const optData = state.options[idx];
  const tile = TILES.find(t => t.name === optData.property);
  const getPlayerById = (id) => (id === 'E' || id === Estado) ? Estado : state.players[id];
  const seller = getPlayerById(optData.seller);
  const buyer  = getPlayerById(optData.buyer);
  if (optData.type === 'call') {
    if (!tile || tile.owner !== optData.seller) {
      alert('Propiedad no disponible para call');
    } else if (buyer.money < optData.strike) {
      alert('No tienes dinero para ejercer');
    } else {
      transfer(buyer, seller, optData.strike, { taxable:false, reason:`Ejercicio call ${tile.name}` });
      tile.owner = optData.buyer;
      state.options.splice(idx,1);
      log(`${buyer.name} ejerce call sobre ${tile.name}.`);
    }
  } else if (optData.type === 'put') {
    if (!tile || tile.owner !== optData.buyer) {
      alert('No posees la propiedad para ejercer put');
    } else if (seller.money < optData.strike) {
      alert('Vendedor sin fondos');
    } else {
      transfer(seller, buyer, optData.strike, { taxable:false, reason:`Ejercicio put ${tile.name}` });
      tile.owner = optData.seller;
      state.options.splice(idx,1);
      log(`${buyer.name} ejerce put sobre ${tile.name}.`);
    }
  }
}
window.exerciseOption = exerciseOption;

// === [PATCH] Ajuste de alquileres con eventos ===
function adjustRentForEvents(payer, tile, base){
  let rent = Math.max(0, Math.round(base||0));

  // Multiplicadores globales
  if (state.rentEventMul) rent = Math.round(rent * state.rentEventMul);
  if (state.rentFlatBonus) rent = Math.max(0, rent + state.rentFlatBonus);

  // Tope global de renta
  if (state.rentCap && state.rentCap.amount>0) {
    rent = Math.min(rent, state.rentCap.amount);
  }

  // Multiplicadores por propietario
  const ownerId = (tile.owner==='E') ? 'E' : tile.owner;
  if (state.ownerRentMul && state.ownerRentMul[ownerId]){
    rent = Math.round(rent * state.ownerRentMul[ownerId].mul);
  }

  // Multiplicadores por categoría (festival, industria, ocio, transporte)
  if (Array.isArray(state.rentFilters)) {
    for (const ef of state.rentFilters) {
      if (ef.turns<=0) continue;
      try { if (ef.match(tile)) rent = Math.round(rent * ef.mul); } catch {}
    }
  }

  // Nunca negativo
  return Math.max(0, rent|0);
}

// Casillas cubiertas por el Estado cuando gobierna la izquierda
const WELFARE_TILES = new Set([
  'Eskolie',
  'Baratze',
  'Farmazixe',
  'Medikue',
  'Frontoie',
  'Skateko Pistie',
  'Txarlin Pistie',
  'Artiako GYM-e',
  'Ereñoko GYM-e',
  'Frontoiko Bici estatikak',
  'Farolak'
]);

function isEstadoCovered(tile){
  if(!tile) return false;
  if(WELFARE_TILES.has(tile.name)) return true;
  if(['bus','rail','ferry','air'].includes(tile.subtype)) return true;
  return false;
}

// === Fiesta clandestina ===
const FIESTA_TILES = new Set([
  'Pipi´s Bar',
  'Artea',
  'Atxarre',
  'Casa Minte',
  'Cocina Pablo',
  'Garbigune',
  'Medikue',
  'Frontoie',
  'Kastillue'
]);

async function maybeFiestaClandestina(p){
  const tile = TILES[p.pos];
  if(!tile || !FIESTA_TILES.has(tile.name)) return false;
  if(Math.random() >= 0.30) return false;

  function tileIndex(name){ return TILES.findIndex(t=>t.name===name); }
  async function moveTo(name){
    const idx = tileIndex(name);
    if(idx >= 0){
      p.pos = idx;
      BoardUI.refreshTiles();
      await onLand(p, idx);
    }
  }

  const opts = [];
  opts.push(async()=>{ log('Se ha complicado la fiesta, vas de after al Txoko.'); await moveTo('Txokoa'); });
  if(p.gender === 'male'){
    opts.push(async()=>{ log('No has ligado, asiue al Fiore.'); await moveTo('Fiore'); });
  }
  opts.push(async()=>{ log('Mandibulie eskapa yatzu hainbesteko puestadiegaz: vas a Klinika Dental Arteaga.'); await moveTo('Klinika Dental Arteaga'); });
  opts.push(async()=>{ log('Has cogido el coche borracho y te has ostiado. Todo preocupado te escapas de la movida, y llamas al Padre de Jarein para que recoja el coche... en el siguiente turno apareces en Gruas Arego.'); p.pendingMove = tileIndex('Gruas Arego'); });
  opts.push(async()=>{ log('Se te ha complicado y te has roto una farola. Vas a Farolak.'); await moveTo('Farolak'); });
  opts.push(async()=>{
    log('Se te cruzan los cables y te pones a matar pájaros en el Bird Center.');
    if(Math.random() < 0.30){
      log('Te pillan: vas a la cárcel.');
      window.sendToJail?.(p);
    } else {
      await moveTo('Bird Center');
    }
  });

  const action = opts[Math.floor(Math.random()*opts.length)];
  await action();
  return true;
}

async function onLand(p, idx){
  const getPlayerById = (id) => (id === 'E' || id === Estado) ? Estado : state.players[id];
  const t = TILES[idx];
  if (!t) return;
  
  // v22: registrar aterrizaje (banca corrupta, farmazixe, etc.)
  try { Roles.onTileLanding(p.id, idx); } catch(e){}

  // [PATCH] UIX Heatmap tracking
  if (window.UIX?.track.onLand) UIX.track.onLand(idx);

  // Si es una casilla de banca corrupta: menú rápido
  if (t.type === 'bank') {
    try {
      const opt = await showBankMenu();
      if (opt === 'loan') {
        const A = Number(await promptDialog('Importe del préstamo:', '300'))||0;
        const Rr = Number(await promptDialog('Tipo (%, ej 20):', '20'))||0;
        const Tt = Number(await promptDialog('Ticks (<=30):', '12'))||0;
        const L = Roles.requestCorruptLoan({ playerId: p.id, amount: A, rate: Rr, ticks: Tt, tileId: idx });
        if (!L || !L.accepted) { alert((L && L.reason) ? L.reason : 'Rechazado'); }
        else {
          transfer(Estado, getPlayerById(p.id), A, { taxable:false, reason:'Préstamo corrupto' });
          log('Préstamo OK: devolver ' + L.dueAmount + ' en T' + L.dueTurn + '.');
        }
      } else if (opt === 'debt') {
        const principal = Number(await promptDialog('Principal préstamo deuda:', '300'))||0;
        const rate = Number(await promptDialog('Tipo (%):', '20'))||0;
        const term = Number(await promptDialog('Plazo (turnos):', '12'))||0;
        const L = GameDebtMarket.mkLoan({
          borrowerId: p.id,
          lenderId: 'E',
          principal,
          ratePct: rate,
          termTurns: term
        });
        GameDebtMarket.addLoan(L);
        transfer(Estado, getPlayerById(p.id), principal, { taxable:false, reason:'Préstamo mercado deuda' });
        log('Mercado deuda: préstamo ' + L.id + ' creado.');
      } else if (opt === 'titulize') {
        const loanId = await promptDialog('ID préstamo a titulizar:', '');
        if (loanId) {
          try {
            const shares = GameSecuritization.splitLoan(loanId, [
              { ownerId: p.id, bips: 5000 },
              { ownerId: 'E', bips: 5000 }
            ]);
            if (shares) {
              log('Titulización OK: ' + shares.join(','));
            } else {
              alert('No se pudo titulizar');
            }
          } catch (e) {
            alert('Error titulizando: ' + e.message);
          }
        }
      } else if (opt === 'options') {
        const action = (await promptDialog('Operación (sell/exercise):', 'sell') || '').toLowerCase();
        if (action === 'sell') {
          const propName = await promptDialog('Nombre propiedad:', '');
          const tile = TILES.find(t => t.name === propName && t.owner === p.id);
          if (!tile) {
            alert('No posees esa propiedad');
          } else {
            const typeOpt = (await promptDialog('Tipo (call/put):', 'call') || '').toLowerCase();
            const strike = Number(await promptDialog('Precio ejercicio:', '100')) || 0;
            const premium = Number(await promptDialog('Prima:', '10')) || 0;
            const buyerId = await promptDialog('ID comprador:', '');
            const buyer = state.players[buyerId];
            if (!buyer) {
              alert('Comprador inválido');
            } else if (buyer.money < premium) {
              alert('Comprador sin fondos');
            } else {
              transfer(buyer, getPlayerById(p.id), premium, { taxable:false, reason: `Prima opción ${typeOpt}` });
              state.options.push({ property: tile.name, type: typeOpt, strike, premium, seller: p.id, buyer: buyerId });
              log(`Opción ${typeOpt} sobre ${tile.name} vendida a ${buyer.name}.`);
            }
          }
        } else if (action === 'exercise') {
          await exerciseOption(p);
        }
      }
    } catch(e){}
  }

  switch(t.type){
    case 'start':
      log(`${p.name} descansa en SALIDA.`);
      break;

    case 'tax': {
      // v22: FBI cobra el bote si procede
      try {
        const fb = window.Roles?.onTaxTileLanding?.(p.id);
        if (fb?.payout > 0) {
          transfer(Estado, p, fb.payout, { taxable:false, reason:'Bote de impuestos (FBI)' });
        }
      } catch {}

      // 3.1 Regularización de IVA
      ensureVAT(p);
      const netIVA = Math.round((p.vatOut||0) - (p.vatIn||0));
      if (netIVA > 0){
        // Debe ingresar al Estado
        transfer(p, Estado, netIVA, { taxable:false, reason:'Regularización IVA (ingreso)' });
        try { window.Roles?.onTaxCollected?.(netIVA); } catch {}
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
      const taxMul = (window.Roles?.getTaxMultiplier?.() || 1) *
                     (window.Roles?.getPlayerTaxMultiplier?.(p.id) || 1);
      const base = Math.max(0, Math.round((p.taxBase || 0) * 0.33 * taxMul));
      if (base > 0){
        transfer(p, Estado, base, { taxable:false, reason:'Impuesto' });
        try { window.Roles?.onTaxCollected?.(base); } catch(e){}
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
      BoardUI?.refreshTiles?.();
      log(`🚔 ${p.name} va a la cárcel (máx 3 intentos).`);
      state.rolled = true; updateTurnButtons();
      break;

    case 'park':
      log(`${p.name} se relaja en el parque.`);
      break;

    case 'slots':
      playSlotsFree(p, t);
      break;

    case 'event': {
      const title = (t && t.name) ? t.name : 'Evento';
      log(`🃏 ${p.name} cae en ${title.toUpperCase()}.`);
      try { window.drawEvent?.(p, title); } catch (e) { log('Error al ejecutar evento.'); }
      break;
    }

    case 'prop': {
      if (await maybeFiestaClandestina(p)) break;
      if (t.subtype==='fiore' && window.Roles && Roles.shouldBlockGame && Roles.shouldBlockGame('fiore')){
        log('Fiore cerrado por el gobierno.');
        break;
      }
      if (t.owner === null){
        const gov = window.Roles?.getGovernment?.();
        if (gov === 'left') {
          log('Con un gobierno de izquierdas no se pueden comprar ni subastar propiedades.');
          return;
        } else if (gov === 'authoritarian') {
          const price = t.price || 0;
          if ((p.money || 0) >= price) {
            transfer(p, Estado, price, { taxable:false, reason:`Compra directa ${t.name}` });
            t.owner = p.id;
            t.mortgaged = false;
            try { recomputeProps?.(); BoardUI.refreshTiles?.(); } catch {}
            log(`${p.name} compra ${t.name} por ${price} sin subasta.`);
          } else {
            log(`${p.name} no tiene dinero para comprar ${t.name}.`);
          }
          return;
        }
        // [PATCH] Nueva gestión de subastas con Debt Market
        if (window.GameDebtMarket && window.GameDebtMarket.onLandProperty) {
          GameDebtMarket.onLandProperty(idx, t);
        } else {
          // Fallback a la lógica original si el módulo no carga
          showCard(idx,{canAuction:true});
          startAuctionFlow(idx, { sealed: false });
        }
        return;
      }
      if (t.owner === p.id){
        log(`${p.name} cae en su propia propiedad.`);
        if (['rail','ferry','air','bus'].includes(t.subtype)) await offerTransportHop(p, idx, t);
        if (t.subtype==='fiore'){
          const n = Number(await promptDialog('Trabajadores en Fiore (0-5):', t.workers||0));
          if (Number.isFinite(n) && n>=0 && n<=5){ t.workers = n; BoardUI.refreshTiles(); }
        }
      } else {
        // Gobierno liberal: el Estado se desprende de sus propiedades
        try {
          if (t.owner === 'E' && window.Roles?.getGovernment?.() === 'libertarian') {
            log(`\ud83c\udfdb\ufe0f Gobierno liberal subasta ${t.name}.`);
            t.owner = null;
            t.mortgaged = false;
            try { recomputeProps?.(); BoardUI.refreshTiles?.(); } catch {}
            if (window.GameDebtMarket?.onLandProperty) {
              window.GameDebtMarket.onLandProperty(idx, t);
            }
            showCard(idx, { canAuction: true });
            startAuctionFlow(idx, { sealed: false });
            return;
          }
        } catch {}

        // Casinos: solo si el dueño NO es el Estado (el Estado no puede ser dueño de casinos)
        if (t.subtype==='casino_bj' || t.subtype==='casino_roulette'){
          if (t.owner !== 'E'){
            const owner = state.players[t.owner];
            if (t.subtype==='casino_bj'){ await playBlackjack(p, owner, t); break; }
            if (t.subtype==='casino_roulette'){ await playRoulette(p, owner, t); break; }
          }
          // si llegase a ser del Estado (no debería), cae a pago de "alquiler" normal abajo
        }

        // v15-part6.js — en onLand(), rama case 'prop', justo antes del bloque de “PAGO DE ALQUILER…”
        if (t.subtype === 'fiore') {
          const workers = t.workers||0;
          const per     = t.workerRent||70;
          const baseTotal = workers * per;
          const payee   = t.mortgaged ? Estado : state.players[t.owner];

          if (baseTotal > 0 && payee) {
            const ivaMul = (window.Roles?.getRentIVAMultiplier?.() || 1) * (state.rentIVAMul || 1);
            const iva  = Math.max(0, Math.round(baseTotal * (ivaMul - 1)));

            transfer(p, payee, baseTotal, { taxable:false, deductible:true, reason:`Fiore ${workers}×${per}` });
            if (iva > 0){
              transfer(p, payee, iva, { taxable:false, deductible:true, reason:`IVA Fiore` });
              markIVAPaid(p, iva, ' (Fiore)');
              markIVACharged(payee===Estado? Estado : payee, iva, ' (Fiore)');
            }

            // v22: propina aleatoria al/los Proxeneta(s) (no descuenta a nadie)
            try {
              const totalPagado = (baseTotal||0) + (iva||0);
              const resTip = window.Roles?.onFiorePayment?.({ payerId: p.id, amount: totalPagado });
              if (resTip?.tips?.length) {
                resTip.tips.forEach(tp => {
                  const rec = state.players.find(x => x.id === tp.toId);
                  if (rec) transfer(Estado, rec, tp.amount, { taxable:false, reason:'Propina FIORE' });
                });
              }
            } catch {}
            ensureAlive(p);
          } else {
            log(`${p.name} no paga en Fiore (sin trabajadores o sin dueño válido).`);
          }
          break; // Importante: no seguir al bloque de alquiler genérico
        }
        // [PATCH] Sustituye el bloque de pago de alquiler con IVA y eventos
        const baseRent = (t.owner === 'E' && t.mortgaged) ? 0 : getRent(t);

        // ¿a quién se paga?
        let payee = null;
        if (t.owner === 'E') {
          payee = t.mortgaged ? null : Estado;
        } else if (t.mortgaged) {
          payee = Estado;
        } else {
          payee = state.players[t.owner];
        }

        // Aplicar modificadores de eventos
        const adjusted = adjustRentForEvents(p, t, baseRent);

        // [PATCH] UIX Heatmap tracking
        if (window.UIX?.track.onRent) UIX.track.onRent(idx, adjusted);

        // [PATCH] Hook de onRent para IA de aprendizaje
        try {
          if (window.GameRiskPlus?.onRent) {
            GameRiskPlus.onRent(idx, adjusted, p.id, t.owner);
          }
        } catch(e) { console.error("Error en hook onRent", e); }

        if (adjusted > 0 && payee) {
          // Rol Okupa: posibilidad de evadir el alquiler
          if (window.Roles?.shouldSkipRent?.(p.id)) {
            log(`${p.name} evita pagar alquiler.`);
          } else if (window.Roles?.shouldBlockRent?.()) {
            log('Huelga general: no se cobra alquiler.');
          } else if (window.Roles?.shouldZeroRentForGender?.(payee.id, p.id)) {
            log('YA SABRÁS POR QUÉ');
          } else {
            let redirectToEstado = false;
            let reason = `Alquiler en ${t.name}`;
            try {
              // Embargo por "Desahucio exprés" (redirige la renta de esta casilla)
              if (window.Roles?.shouldRedirectRentToEstado?.(idx)) {
                redirectToEstado = true;
                reason = 'Renta embargada';
              }
            } catch (e) {}

              const target = redirectToEstado ? Estado : payee;
              const ivaMul = (window.Roles?.getRentIVAMultiplier?.() || 1) * (state.rentIVAMul || 1);
              const govLeft = (()=>{ try{ return window.Roles?.exportState?.().government === 'left'; }catch{ return false; }})();
              const stateCovers = govLeft && isEstadoCovered(t);

              const iva = Math.max(0, Math.round(adjusted * (ivaMul - 1)));

              if (stateCovers) {
                transfer(Estado, target, adjusted, { taxable:false, reason: reason });
                if (iva > 0){
                  transfer(Estado, target, iva,  { taxable:false, reason: `IVA ${reason}` });
                  try { markIVAPaid(Estado, iva, ' (alquiler estatal)'); markIVACharged(target===Estado? Estado : target, iva, ' (alquiler estatal)'); } catch{}
                }
                log(`El Estado cubre el alquiler en ${t.name}.`);
              } else {
                transfer(p, target, adjusted, { taxable:false, deductible:true, reason: reason });
                if (iva > 0){
                  transfer(p, target, iva,  { taxable:false, deductible:true, reason: `IVA ${reason}` });
                  try { markIVAPaid(p, iva, ' (alquiler)'); markIVACharged(target===Estado? Estado : target, iva, ' (alquiler)'); } catch{}
                }
                ensureAlive(p);
              }
          }
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

// v22: Unifica la resolución de cartas y eventos
function resolverCarta(carta, jugador, idx) {
  const getPlayerById = (id) => (id === 'E' || id === Estado) ? Estado : state.players[id];

  // v22: carta/evento unificado
  const out = (window.Roles && Roles.triggerEvent)
    ? Roles.triggerEvent(carta && carta.nombre, { playerId: jugador.id, tileId: idx })
    : null;
  if (out && out.banner) { alert(out.banner); }

  // Aplica colas de pagos y movimientos
  const pays = (window.Roles && Roles.consumePendingPayments) ? Roles.consumePendingPayments() : [];
  for (let i = 0; i < pays.length; i++) {
    const pay = pays[i];
    if (pay.toType === 'estado') {
      transfer(getPlayerById(pay.fromId), Estado, pay.amount, { taxable:false, reason: pay.reason });
    } else if (pay.toType === 'opponents') {
      for (let j = 0; j < state.players.length; j++) {
        const pl = state.players[j];
        if (pl.id !== pay.toId) transfer(pl, getPlayerById(pay.toId), pay.amount, { taxable:false, reason: pay.reason });
      }
    } else if (pay.toType === 'tileOwner') {
      const t = TILES[pay.tileId], owner = t && t.owner;
      if (owner != null) transfer(getPlayerById(pay.fromId), getPlayerById(owner), pay.amount, { taxable:false, reason: pay.reason });
    }
  }
  const moves = (window.Roles && Roles.consumePendingMoves) ? Roles.consumePendingMoves() : [];
  for (let k = 0; k < moves.length; k++) {
    const mv = moves[k];
    if (mv.effect === 'jail')  sendToJail(getPlayerById(mv.playerId), mv.turns);
    if (mv.effect === 'skip')  addSkipTurn(getPlayerById(mv.playerId), mv.turns);
  }
}


/* ===== Subastas ===== */
function startAuctionFlow(tileIndex, opts = {}){
  const t = TILES[tileIndex];
  if (t.owner !== null || t.type!=='prop') return;

  // Blindaje extra: si por cualquier razón se llama con la carta abierta, la cerramos
  const ov = document.getElementById('overlay');
  if (ov) ov.style.display = 'none';
  if (window.state) window.state.pendingTile = null;

  const sealed = opts.sealed === true;

  const box = $('#auction');
  state.auction = {
    tile: tileIndex,
    price: Math.max(1, t.price||1),
    bestBid: 0,
    bestPlayer: null,   // pid numérico o 'E' para Estado
    active: new Set(state.players.filter(x=>x.alive).map(x=>x.id)),
    open: true, sealed: sealed,
    bids: sealed ? {} : undefined,
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

function maybeBotsAutoBid(){
  const a = state.auction; if(!a || !a.open) return;
  const t = TILES[a.tile];
  const sealed = !!a.sealed;

  try {
    for (const p of state.players){
      if (!p.isBot || !a.active.has(p.id)) continue;

      if (sealed){
        a.bids ||= {};
        if (a.bids[p.id]) continue; // ya pujó
        const max = Math.min(p.money||0, Math.round((t.price||1) * (0.9 + Math.random()*0.6)));
        if (max > 0){
          a.bids[p.id] = max;
        } else {
          a.active.delete(p.id);
        }
      } else {
        if (a.bestPlayer === p.id) continue; // ya va ganando
        const cap = Math.min(p.money||0, Math.round((t.price||1) * (1.1 + Math.random()*0.4)));
        if (a.bestBid >= cap){
          a.active.delete(p.id); // no puede superar
          continue;
        }
        const step = getNextStep(a.bestBid);
        const next = Math.min(cap, a.bestBid + step);
        if (next > a.bestBid){
          a.bestBid = next; a.bestPlayer = p.id;
        } else {
          a.active.delete(p.id);
        }
      }
    }

    // Hooks externos para IA avanzada
    if (!sealed && window.GameRiskPlus?.Bots?.predatorTick){
      for (const p of state.players){
        if (p.isBot && p.id !== a.bestPlayer){
          window.GameRiskPlus.Bots.predatorTick(p.id);
        }
      }
    }
  } catch(e){ console.error('Error en bot auto-bid', e); }
}

function maybeStateAutoBid(){
  const a = state.auction; if(!a || !a.open) return;

  const t = TILES[a.tile];
  if (t && ['casino_bj','casino_roulette','fiore'].includes(t.subtype)) return; // no puja esos

  const sealed = !!a.sealed;

  if (!(window.Roles && Roles.isEstadoAuctionBlocked && Roles.isEstadoAuctionBlocked())) {
    const cap = Math.max(0, Math.min(a.stateMax, Math.floor(Estado.money||0)));

    if (sealed){
      const currE = Math.max(0, (a.bids && a.bids['E']) || 0);
      const step = getNextStep(currE);
      const next = Math.min(cap, currE + step);
      if (next > currE){
        a.bids ||= {};
        a.bids['E'] = next;
      }
    } else {
      if (a.bestPlayer !== 'E' && a.bestBid < cap){
        const step = getNextStep(a.bestBid);
        const next = Math.min(cap, a.bestBid + step);
        if (next > a.bestBid){
          a.bestBid = next; a.bestPlayer = 'E';
        }
      }
    }
  } else {
    log('Estado no puja (bloqueado desde debug).');
  }

  maybeBotsAutoBid();

  drawAuction();

  clearTimeout(a.timer);
  const pendingSealed = sealed && [...a.active].some(pid => !(a.bids && a.bids[pid] > 0));
  if (!sealed && a.active.size <= 1) {
    a.timer = setTimeout(awardAuction, 850);
  } else if (sealed && !pendingSealed) {
    a.timer = setTimeout(awardAuction, 850);
  } else {
    a.timer = setTimeout(maybeStateAutoBid, sealed ? 600 : 850);
  }
}

function drawAuction(){
  const a = state.auction; const box = $('#auction'); if(!a||!box) return;
  const t = TILES[a.tile];
  const players = state.players.filter(p=>a.active.has(p.id));

  const sealed = !!a.sealed;

  let header = sealed
    ? `<div class="auctionHeader"><h3>Subasta (oculta): ${t.name}</h3><p>Valor: ${fmtMoney(t.price)}</p><p><em>Pujas ocultas activas. Nadie ve quién va ganando ni cantidades.</em></p></div>`
    : (()=> {
        const bestName = a.bestPlayer==='E'
          ? 'Estado'
          : (a.bestPlayer!=null ? state.players[a.bestPlayer].name : '-');
        return `<div class="auctionHeader"><h3>Subasta: ${t.name}</h3><p>Valor: ${fmtMoney(t.price)}</p><p class="bestBid">Mejor puja: <b>${bestName}</b> por <b>${fmtMoney(a.bestBid)}</b></p></div>`;
      })();

  box.innerHTML = `
    <div class="auctionBox">
      ${header}
      <div class="auctionPlayers">
        ${players.map(p=>`
          <div class="auctionPlayer btn-row ${(!sealed && a.bestPlayer===p.id) ? 'leader' : ''}" id="J${p.id+1}" data-p="${p.id}">
            <div class="name">${p.name}</div>
            <button data-act="bid" data-p="${p.id}" data-step="1">+1</button>
            <button data-act="bid" data-p="${p.id}" data-step="10">+10</button>
            <button data-act="bid" data-p="${p.id}" data-step="50">+50</button>
            <button data-act="bid" data-p="${p.id}" data-step="100">+100</button>
            <button data-act="pass" data-p="${p.id}">Pasar</button>
          </div>
        `).join('')}
      </div>
      <div class="auctionActions">
        <button id="awardAuction" class="primary">Adjudicar</button>
      </div>
    </div>
  `;

  box.querySelectorAll('button[data-act="bid"]').forEach(btn=>{
    btn.onclick = ()=>{
      const pid = parseInt(btn.getAttribute('data-p'),10);
      if (!a.active.has(pid)) return;
      const step= parseInt(btn.getAttribute('data-step'),10);
      const p = state.players[pid];

      if (sealed){
        a.bids ||= {};
        const curr = Math.max(0, a.bids[pid]||0);
        const nextBid = curr + step;
        if (p.money < nextBid){ log(`${p.name} no puede aumentar su puja.`); return; }
        a.bids[pid] = nextBid;
        // No mostramos nada: puja oculta
        drawAuction();
        clearTimeout(a.timer);
        a.timer = setTimeout(maybeStateAutoBid, 450);
      } else {
        // siguiente puja visible
        const nextBid = Math.max(a.bestBid + step, step);
        if (p.money < nextBid){ log(`${p.name} no puede pujar ${fmtMoney(nextBid)}.`); return; }
        a.bestBid = nextBid; a.bestPlayer = pid;
        drawAuction();
        clearTimeout(a.timer);
        a.timer = setTimeout(maybeStateAutoBid, 450);
      }
    };
  });
  box.querySelectorAll('button[data-act="pass"]').forEach(btn=>{
    btn.onclick = ()=>{
      const pid = parseInt(btn.getAttribute('data-p'),10);
      a.active.delete(pid);
      if (a.sealed && a.bids) delete a.bids[pid];
      log(`${state.players[pid].name} pasa.`);
      drawAuction();
    };
  });

  $('#awardAuction').onclick = ()=>{
    awardAuction();
  };
}

function awardAuction(){
  if (state._endingTurn) return; // ya se está terminando
  const a = state.auction; if(!a) return;
  const t = TILES[a.tile];

  const sealed = !!a.sealed;

  // Si no hay pujas: desierta
  if ((!sealed && a.bestPlayer == null) ||
      (sealed && (!a.bids || Object.keys(a.bids).length===0))) {
    log(sealed ? 'Subasta oculta desierta.' : 'Subasta desierta.');
    $('#auction').style.display = 'none';
    state.auction = null;
    const endTurnBtn = document.getElementById('endTurn');
    if (endTurnBtn) endTurnBtn.disabled = false;
    updateTurnButtons();
    return;
  }

  let winnerId = a.bestPlayer;
  let price    = a.bestBid;

  if (sealed){
    // Elegir la mayor puja
    const entries = Object.entries(a.bids||{});
    let bestK = null, bestV = 0;
    for (const [k,v] of entries){
      if (!Number.isFinite(v)) continue;
      if (v > bestV){ bestV = v; bestK = k; }
    }
    winnerId = (bestK === 'E') ? 'E' : parseInt(bestK,10);
    price    = bestV;
  }

  // La impugnación se limita a los intercambios: las subastas no pueden impugnarse

  // Ganó Estado
  if (winnerId==='E'){
    if ((Estado.money||0) < price){
      log('El Estado no tiene fondos suficientes para adjudicarse (se cancela).');
      return;
    }
    // Silenciar logs si es oculta para no mostrar cantidades de reparto
    let prevLog = null;
    if (sealed){ prevLog = window.log; window.log = function(){}; }

    // paga de su caja
    Estado.money = Math.max(0, Math.floor((Estado.money||0) - price));
    t.owner = 'E';

    // Reparto del gasto del Estado entre los demás jugadores vivos (no tributable)
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

    if (sealed && prevLog){ window.log = prevLog; }
    log(sealed ? `Subasta oculta adjudicada al Estado (${t.name}).` : `El Estado se adjudica ${t.name} por ${fmtMoney(price)}.`);

    clearTimeout(a.timer);
    $('#auction').style.display='none'; state.auction=null;
    BoardUI.refreshTiles(); renderPlayers();
    const endTurnBtn = document.getElementById('endTurn');
    if (endTurnBtn) endTurnBtn.disabled = false;
    updateTurnButtons?.();
    return;
  }

  // Ganó un jugador
  const buyer = state.players[winnerId];
  if (!buyer?.alive || buyer.money < price){ log('Adjudicación fallida.'); return; }

  // Silenciar logs si es oculta para no mostrar cantidad en el feed
  let prevLog = null;
  if (sealed){ prevLog = window.log; window.log = function(){}; }
  transfer(buyer, Estado, price, {taxable:false, reason:`Compra en subasta: ${t.name}`});
  if (sealed && prevLog){ window.log = prevLog; }
  t.owner = buyer.id;

  clearTimeout(a.timer);
  $('#auction').style.display='none'; state.auction=null;
  BoardUI.refreshTiles(); renderPlayers();

  const endTurnBtn = document.getElementById('endTurn');
  if (endTurnBtn) endTurnBtn.disabled = false;
  updateTurnButtons();

  // Mensaje final
  if (sealed){
    log(`Subasta oculta adjudicada a ${buyer.name} (${t.name}).`);
  }
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

  // v22: Botón de préstamo corrupto
  try {
    const btn = document.getElementById('corruptLoan');
    if (btn && window.Roles?.exportState) {
      const p = state.players[state.current];
      const landings = new Map(window.Roles.exportState().bankLandingAttempt || []);
      const landing = landings.get(p.id);
      const canTry = landing && landing.turn === state.turnCount && !landing.attempted;
      const isFlorentino = window.Roles?.get?.(p.id) === 'florentino';
      const bankOn = window.Roles?.isBankCorrupt?.();
      btn.style.display = (canTry || (isFlorentino && bankOn)) ? '' : 'none';
    }
  } catch {}
}
async function offerTransportHop(p, idx, t){
  if (state.usedTransportHop) return;
  const same = (x)=> x.type==='prop' && (
    (t.subtype==='rail'&& (x.subtype==='rail'||(window.BUS_COUNTS_WITH_METRO&&x.subtype==='bus'))) ||
    (t.subtype==='bus' && (x.subtype==='bus'||(window.BUS_COUNTS_WITH_METRO&&x.subtype==='rail'))) ||
    (t.subtype===x.subtype)
  );
  const owns = TILES.map((x,i)=>({x,i}))
    .filter(o=> same(o.x) && [p.id,'E'].includes(o.x.owner) && o.i!==idx);
  if (!owns.length) return;

  const niceNames = { rail: 'metro', bus: 'Bizkaibus', ferry: 'ferry', air: 'aéreo' };
  const nice = niceNames[t.subtype] || t.subtype;
  const list = owns.map((o,k)=>`${k+1}. ${o.x.name}`).join('\n');
  const sel = await promptDialog(`Moverte gratis a otro transporte (${nice}) tuyo o del Estado este turno:\n${list}\nElige número (o cancela)`);
  const n = parseInt(sel,10);
  if (!Number.isFinite(n) || n<1 || n>owns.length) return;

  const dest = owns[n-1];
  const from = p.pos;
  state.usedTransportHop = true; // reserva el “ticket” antes de animar
  animateTransportHop(p, from, dest.i, ()=>{
    p.pos = dest.i;
    BoardUI.refreshTiles();
    log(`${p.name} usa ${t.name} → ${dest.x.name}`);
    onLand(p, dest.i);
  });
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
async function playRoulette(player, owner, tile){
  if (!owner?.alive){ log('El dueño no puede actuar.'); return; }
  const apuesta = await promptDialog('Apuesta color (rojo/negro/verde) y cantidad. Ej: "rojo 50"');
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

// === Animación de transporte ===
function animateTransportHop(player, fromIdx, toIdx, done){
  try{
    const board = document.getElementById('board');
    const tiles = board.querySelectorAll('.tile');
    const fromEl = tiles[fromIdx], toEl = tiles[toIdx];
    if (!fromEl || !toEl) return done?.();

    const bRect = board.getBoundingClientRect();
    const f = fromEl.getBoundingClientRect();
    const t = toEl.getBoundingClientRect();

    const ghost = document.createElement('div');
    ghost.className = `chip p${player.id}`;
    ghost.style.position = 'absolute';
    ghost.style.left = (f.left - bRect.left + f.width - 26) + 'px';
    ghost.style.top  = (f.top  - bRect.top  + f.height - 26) + 'px';
    ghost.style.transition = 'transform .6s ease';
    ghost.style.pointerEvents = 'none';
    board.appendChild(ghost);

    // forzar reflow y animar
    requestAnimationFrame(()=>{
      const dx = (t.left - f.left);
      const dy = (t.top  - f.top );
      ghost.style.transform = `translate(${dx}px, ${dy}px)`;
    });

    ghost.addEventListener('transitionend', ()=>{
      ghost.remove();
      done?.();
    }, { once:true });
  } catch{ done?.(); }
}
