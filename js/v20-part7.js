/* v13 – Parte 7/7 (patched): construir, vender, hipoteca, préstamos
   — Sólo acciones del propietario + utilidades (applyTax, sendToJail).
   — NO redefine ni transfer, ni renderPlayers, ni newGame (eso queda en part4).
*/

// Stock por defecto si no existe un BANK global
window.BANK = window.BANK || { housesAvail: 32, hotelsAvail: 12 };

/* =================== PRESTS + TRADE + BANKRUPTCY + ESTADO IA (Mejorado) =================== */
/* Utilidades de seguridad (no-op si no existen en tu versión) */
function renderAll(){ try{ BoardUI?.refreshTiles?.(); renderPlayers?.(); }catch{} }
function getName(p){ return (p===Estado||p==='E') ? 'Estado' : (p?.name ?? '¿?'); }
function moneyOf(x){ return (x==='E'||x===Estado) ? (Estado.money||0) : (state.players[x?.id ?? x]?.money||0); }
function playerById(id){ return id==='E' ? Estado : state.players[id]; }
function _distribuirGastoEstado(monto, reason){
  const vivos = state.players.filter(p => p.alive);
  if (!vivos.length || monto <= 0) return;
  const base = Math.floor(monto / vivos.length);
  let resto = monto - base * vivos.length;
  vivos.forEach((p,i)=>{
    const extra = i < resto ? 1 : 0;
    giveMoney(p, base + extra, { taxable:false, reason });
  });
}

const isNormalProp = t => t && t.type==='prop' && !t.subtype;
function groupTiles(t) {
  const key = t.familia ?? t.color;
  return TILES.map((x, i) => ({ x, i }))
    .filter(o => isNormalProp(o.x) && ((o.x.familia ?? o.x.color) === key));
}
function ownsFullGroup(p,t){ const g=groupTiles(t); return g.length && g.every(o=>o.x.owner===p.id); }
function anyMortgaged(g){ return g.some(o=>o.x.mortgaged); }
function levelOf(x){ return x.hotel ? 5 : x.houses||0; } // 0..5 (5=hotel)
function canBuildEven(t,p){
  const g = groupTiles(t);
  const min = Math.min(...g.map(o=>levelOf(o.x)));
  return levelOf(t)===min && !anyMortgaged(g);
}
function canBuildHotel(t,p){
  const g = groupTiles(t);
  return t.houses===4 && g.every(o=>o.x.houses===4 || o.x.hotel);
}
function canSellEven(t,p){
  const g = groupTiles(t);
  const max = Math.max(...g.map(o=>levelOf(o.x)));
  return levelOf(t)===max;
}

function stateAutoBuildHotels(){
  const normal = t => t && t.type==='prop' && !t.subtype;
  const costOf = t => t.houseCost ?? Math.round((t.price||0)*0.5);
  const familias = [...new Set(TILES.filter(t => normal(t) && (t.familia ?? t.color))
                                  .map(t => t.familia ?? t.color))];

  familias.forEach(fam => {
    const group = TILES.map((x,i)=>({x,i}))
      .filter(o => normal(o.x) && ((o.x.familia ?? o.x.color) === fam));
    if (!group.length) return;
    if (!group.every(o=>o.x.owner==='E')) return;
    if (group.some(o=>o.x.mortgaged)) return;

    // Casas parejo hasta 4
    while (true){
      const lvls = group.map(o=> o.x.hotel ? 5 : (o.x.houses||0));
      const min = Math.min(...lvls), max = Math.max(...lvls);
      if (max>=4 && min>=4) break;
      const target = group.find(o=> (o.x.houses||0) < 4 && !o.x.hotel && (o.x.houses||0)===min);
      if (!target) break;
      const c = costOf(target.x);
      if (BANK.housesAvail<=0 || (Estado.money||0) < c) break;
      BANK.housesAvail--; target.x.houses = (target.x.houses||0)+1;
      Estado.money = Math.max(0, Math.floor((Estado.money||0) - c));
      _distribuirGastoEstado(c, `Reparto por obra del Estado: ${target.x.name}`);
      log(`🏠 Estado construye casa en ${target.x.name} por ${fmtMoney(c)}.`);
    }

    // Hoteles
    group.forEach(o=>{
      const t = o.x; if (t.hotel) return;
      if (t.houses===4 && BANK.hotelsAvail>0){
        const c = costOf(t);
        if ((Estado.money||0) >= c){
          BANK.hotelsAvail--; BANK.housesAvail += 4;
          t.houses = 0; t.hotel = true;
          Estado.money = Math.max(0, Math.floor((Estado.money||0) - c));
          _distribuirGastoEstado(c, `Reparto por obra del Estado: ${t.name}`);
          log(`🏨 Estado construye hotel en ${t.name} por ${fmtMoney(c)}.`);
        }
      }
    });
  });

  BoardUI?.refreshTiles?.(); renderPlayers?.();
}
window.stateAutoBuildHotels = stateAutoBuildHotels;

function assertOwnerCanAct(t, p){
  if (!t || t.type!=='prop'){ log('No es una propiedad.'); return false; }
  if (!p || t.owner !== p.id){ log('No eres el dueño.'); return false; }
  if (!p.alive){ log('Jugador eliminado.'); return false; }
  return true;
}

/* Asegura arrays de propiedades coherentes con TILES */
function recomputeProps(){
  state.players.forEach(p=>p.props=[]);
  Estado.props = Estado.props||[];
  Estado.props.length = 0;
  (TILES||[]).forEach((t,i)=>{
    if(t.type!=='prop') return;
    if(t.owner==='E'){ Estado.props.push(i); return; }
    if (Number.isInteger(t.owner) && state.players[t.owner]){
      state.players[t.owner].props ??= [];
      state.players[t.owner].props.push(i);
    }
  });
}


/* ===== Construir ===== */
function buildHouse(){
  const p = state.players[state.current]; if(!p) return;

  // [PATCH] Huelga de obras
  if ((state.blockBuildTurns||0) > 0){
    return log('🚫 Huelga de obras: nadie puede construir este turno.');
  }

  const idx = state.pendingTile ?? p.pos;
  const t = TILES[idx];
  if (!isNormalProp(t)) { log('En esta casilla no se construye.'); return; }
  if (!ownsFullGroup(p,t)) { log('Necesitas el set completo del color.'); return; }
  if (t.mortgaged){ log('No puedes construir en hipoteca.'); return; }
  if (!canBuildEven(t,p)){ log('Ley de propiedad horizontal: construye parejo en el grupo.'); return; }

  const baseCost  = t.houseCost ?? Math.round((t.price||0)*0.5);
  const costNoIVA = Math.max(1, Math.round(baseCost * (state.buildEventMul||1)));   // sin IVA
  const finalCost = Math.max(1, Math.round(costNoIVA * (state.buildIVAMul||1)));    // con IVA
  const ivaPart   = Math.max(0, finalCost - costNoIVA);
  if (t.hotel){ log('Ya tiene hotel.'); return; }
  if (p.money < finalCost){ log('No te llega el dinero para construir.'); return; }

  if (t.houses < 4) {
    if (BANK.housesAvail <= 0) { alert('No hay casas disponibles en el banco.'); return; }
    BANK.housesAvail--;
    t.houses++;
  } else {
    if (!canBuildHotel(t,p)) { log('Para hotel: todas las del grupo con 4 casas.'); return; }
    if (BANK.hotelsAvail <= 0) { alert('No hay hoteles disponibles en el banco.'); return; }
    BANK.hotelsAvail--;
    BANK.housesAvail += 4; // se devuelven al banco
    t.hotel = true; t.houses = 0;
  }

  // El jugador paga el coste total (con IVA) al Estado.
  transfer(p, Estado, finalCost, {taxable:false, reason:`Construcción en ${t.name}`});
  // La parte del IVA se marca como "soportado" para la futura liquidación.
  if (ivaPart > 0) markIVAPaid(p, ivaPart, ' (construcción)');
  log(`🏠 Construido en ${t.name}.`);
  BoardUI.refreshTiles(); renderPlayers();
}

/* ===== Vender casa/hotel ===== */
function sellHouse(){
  const p = state.players[state.current]; if(!p) return;
  const idx = state.pendingTile ?? p.pos;
  const t = TILES[idx];
  if (!isNormalProp(t)) { log('Aquí no hay edificios que vender.'); return; }
  if (!canSellEven(t,p)){ log('Vende de forma pareja dentro del grupo.'); return; }

  // [PATCH] Bonus de gentrificación al vender
  let sellBonus = 1;
  try{
    if (state.sellBonusByOwner && state.sellBonusByOwner[p.id]) sellBonus = Math.max(0, state.sellBonusByOwner[p.id]);
  }catch{}

  const price = t.houseCost ?? Math.round((t.price||0)*0.5);
  if (t.hotel){
    const pago = Math.round(price * 0.5 * sellBonus);
    if ((Estado.money||0) < pago){ log('El Estado no tiene fondos para comprarte el hotel.'); return; }
    t.hotel = false; t.houses = 4;
    BANK.hotelsAvail++;
    BANK.housesAvail = Math.max(0, BANK.housesAvail - 4);
    transfer(Estado, p, pago, { taxable:false, reason:`Compra estatal de hotel desmontado en ${t.name}` });
    log(`Se desmonta hotel en ${t.name} → 4 casas.`);
  } else if (t.houses>0){
    const pago = Math.round(price * 0.5 * sellBonus);
    if ((Estado.money||0) < pago){ log('El Estado no tiene fondos para comprarte la casa.'); return; }
    t.houses--;
    BANK.housesAvail++;
    transfer(Estado, p, pago, { taxable:false, reason:`Compra estatal de casa en ${t.name}` });
    log(`Venta de casa en ${t.name}.`);
  } else {
    log('No hay casas que vender.');
  }
  BoardUI.refreshTiles(); renderPlayers();
}

// Helpers para elegir propiedad propia por prompt
function pickMyProperty(p, {onlyMortgaged=null, allowWithBuildings=true}={}){
  const pool = TILES.map((t,i)=>({t,i}))
    .filter(x => x.t.type==='prop' && x.t.owner===p.id)
    .filter(x => onlyMortgaged===true  ?  x.t.mortgaged
                 : onlyMortgaged===false ? !x.t.mortgaged
                 : true)
    .filter(x => allowWithBuildings ? true : (!x.t.houses && !x.t.hotel));

  if (!pool.length){
    log(onlyMortgaged===true ? 'No tienes propiedades hipotecadas.'
                             : 'No tienes propiedades elegibles.');
    return null;
  }
  const lines = pool.map(x=>`${x.i}: ${x.t.name}${x.t.mortgaged?' [HIPOTECADA]':''} — ${fmtMoney(x.t.price)}`).join('\n');
  const raw = prompt(`Elige el índice de tu propiedad:\n${lines}`);
  if (raw==null) return null;
  const idx = parseInt(raw,10);
  const ok = pool.some(x=>x.i===idx);
  return ok ? idx : (alert('Índice no válido.'), null);
}

function ownerGuard(t, p){
  if (!t || t.type!=='prop'){ log('No es una propiedad.'); return false; }
  if (t.owner !== p.id){ log('Esa propiedad no es tuya.'); return false; }
  if (!p.alive){ log('Jugador eliminado.'); return false; }
  return true;
}

// % y recargo configurables
state.mortgagePct    ??= 0.50; // te dan 50% del precio
state.mortgageFeePct ??= 0.10; // recargo 10% al levantar

function mortgage(){
  const p = state.players[state.current]; if (!p) return;

  // [PATCH] Bloqueo de hipoteca 1 turno
  if (state.blockMortgage && state.blockMortgage[p.id]>0){
    return log('🚫 Bloqueo de hipoteca activo: no puedes hipotecar este turno.');
  }

  // eliges una de tus propiedades NO hipotecadas y sin edificios
  const idx = pickMyProperty(p, {onlyMortgaged:false, allowWithBuildings:false});
  if (idx == null) return;

  const t = TILES[idx];
  if (!ownerGuard(t,p)) return;
  if (t.mortgaged) return uiToast('Ya está hipotecada.');

  const principal = Math.round((t.price||0) * state.mortgagePct);

  // Estado paga; si no tiene dinero, no se puede
  if ((Estado.money||0) < principal){
    return uiToast(`El Estado no tiene fondos (${fmtMoney?.(Estado.money||0)})`);
  }

  t.mortgaged = true;
  t.mortgagePrincipal = principal; // para calcular el coste al levantar
  transfer(Estado, p, principal, {taxable:false, reason:`Hipoteca ${t.name||''}`});

  BoardUI?.refreshTiles?.(); renderPlayers?.();
}

function unmortgage(){
  const p = state.players[state.current]; if (!p) return;
  // eliges una de tus hipotecadas
  const idx = pickMyProperty(p, {onlyMortgaged:true});
  if (idx == null) return;

  const t = TILES[idx];
  if (!ownerGuard(t,p)) return;
  if (!t.mortgaged) return uiToast('No está hipotecada.');

  const base = t.mortgagePrincipal ?? Math.round((t.price||0) * state.mortgagePct);
  const cost = Math.round(base * (1 + state.mortgageFeePct)); // devuelves al Estado

  if ((p.money||0) < cost) return uiToast('No tienes saldo para levantarla.');
  transfer(p, Estado, cost, {taxable:false, reason:`Levantar hipoteca ${t.name||''}`});

  t.mortgaged = false;
  delete t.mortgagePrincipal;

  BoardUI?.refreshTiles?.(); renderPlayers?.();
}

// ======== IA Estado: hipoteca estratégica ========
function stateMortgageProperty(idx){
  const t = TILES[idx];
  if (!t || t.type!=='prop' || t.owner!=='E') return false;
  if (t.mortgaged || t.houses>0 || t.hotel) return false; // evitar edificios
  const principal = Math.round((t.price||0) * (state.mortgagePct ?? 0.50));
  t.mortgaged = true;
  t.mortgagePrincipal = principal;
  giveMoney(Estado, principal, { taxable:false, reason:`Hipoteca Estado: ${t.name}` });
  log(`🏛️ Estado hipoteca ${t.name} → +${fmtMoney(principal)}.`);
  BoardUI?.refreshTiles?.(); renderPlayers?.();
  return true;
}

// [Inferencia] índice de “baja rentabilidad”: rentabilidad ~ renta/valor (robusto con subtipos)
function _yieldFor(t){
  if (!t || t.type!=='prop') return Infinity;
  if (t.houses>0 || t.hotel) return 9999;  // nunca elegir con edificios
  if (t.mortgaged) return 9999;            // ya hipotecada
  const rent = (typeof getRent==='function') ? Math.max(0, getRent(t)||0)
              : Math.max(0, (t.baseRent ?? Math.round((t.price||0)*0.3)));
  const price = Math.max(1, t.price||1);
  return rent / price; // menor = peor rendimiento
}

function stateEnsureLiquidity(targetCash) {
  recomputeProps?.(); // Rellena Estado.props
  if ((Estado.money || 0) >= targetCash) return true; // Ya tiene suficiente liquidez

  const need = Math.max(0, Math.round(targetCash - (Estado.money || 0)));
  log(`🏛️ Estado necesita ${fmtMoney(need)} para alcanzar liquidez objetivo.`);

  // Obtener propiedades del Estado que se pueden hipotecar
  const mortgageableProps = (Estado.props || [])
    .map(idx => ({ t: TILES[idx], i: idx }))
    .filter(o => o.t && o.t.type === 'prop' && !o.t.mortgaged && !o.t.houses && !o.t.hotel)
    .sort((a, b) => _yieldFor(a.t) - _yieldFor(b.t)); // Ordenar por menor rentabilidad primero

  for (const prop of mortgageableProps) {
    if ((Estado.money || 0) >= targetCash) break; // Detenerse si ya se alcanzó el objetivo
    stateMortgageProperty(prop.i);
  }

  const met = (Estado.money || 0) >= targetCash;
  if (!met) log(`🏛️ Estado no pudo alcanzar la liquidez objetivo de ${fmtMoney(targetCash)}.`);
  return met;
}

// ================= PRÉSTAMO PERSONAL P2P (ticks globales) =================
state.loans = state.loans || [];

function requestLoan(){
  const lender = state.players[state.current];
  if (!lender) return log?.('Sin jugador activo.');

  // 1) ¿Cuánto prestar?
  let amt = prompt('DAR (principal):', '200'); if (amt==null) return;
  amt = Math.round(+amt);
  if (!(amt > 0)) return log('Importe inválido.');
  if ((lender.money||0) < amt) return log(`${lender.name} no tiene saldo para prestar ${fmtMoney?.(amt)}.`);

  // 2) ¿A qué jugador prestar?
  const toId = prompt('Prestar a jugador (número):'); if (toId==null) return;
  if (String(toId).trim().toUpperCase()==='E'){ alert('No se puede prestar al Estado.'); return; }
  const borrowerId = Number(toId)-1;
  const borrower = state.players[borrowerId];
  if (!borrower || borrower===lender || !borrower.alive){ log('Destino no válido.'); return; }

  // 3) ¿Cuánto por tick?
  let per = prompt('DEVOLVER por turno (cuota):', String(Math.ceil(amt/6))); if (per==null) return;
  per = Math.round(+per);
  if (!(per > 0)) return log('Cuota inválida.');

  // 4) ¿Cuántos ticks (globales)?
  let turns = prompt('Nº de turnos (ticks globales):', '6'); if (turns==null) return;
  turns = Math.round(+turns);
  if (!(turns > 0)) return log('Plazo inválido.');

  const totalSched = Math.round(per * turns);
  if (totalSched < amt){ alert('perTurn × turns no puede ser menor que el principal.'); return; }

  // Mover el dinero
  transfer(lender, borrower, amt, { taxable:false });

  // Registrar préstamo (amortiza principal primero, luego interés; interés tributa)
  state.loans.push({
    from: lender.id, to: borrowerId,
    principal: amt,
    principalRemaining: amt,
    perTurn: per,
    interestRemaining: totalSched - amt,
    remainingTurns: turns,
    open: true
  });

  // [PATCH] UIX: mostrar ticket visual del préstamo
  try {
    if (window.UIX?.debt.ticket) {
      const newLoan = state.loans[state.loans.length - 1];
      const ticketEl = UIX.debt.ticket(newLoan);
      ticketEl.addEventListener('click', () => ticketEl.remove());
      document.body.appendChild(ticketEl);
    }
  } catch(e) { console.warn('Error al crear ticket de préstamo UIX', e); }

  const ratePct = Math.round(((totalSched-amt)/amt)*1000)/10;
  log(`${lender.name} presta ${fmtMoney?.(amt)} a ${getName?.(borrower)} → pagará ${fmtMoney?.(per)} × ${turns} (${ratePct}% interés total).`);
  renderAll?.();
}
window.askLoan = requestLoan;

// ================= COBRO AL FINAL DE CADA TURNO (tick global) =================
function applyLoansAtTurnEnd(){
  const remaining = [];
  recomputeProps?.(); // por si hay cambios de dueño antes del cobro

  for (const loan of state.loans){
    if (!loan.open) continue;

    // TICK GLOBAL
    loan.remainingTurns = Math.max(0, (loan.remainingTurns||0) - 1);

    const borrower = state.players[loan.to];
    const lender   = state.players[loan.from];
    if (!borrower || !lender){ log('Préstamo inválido, se descarta.'); continue; }

    const due = Math.max(0, Math.round(loan.perTurn||0));

    if (due > 0){
      if ((borrower.money||0) >= due){
        // principal primero, luego interés
        const principalPart = Math.min(loan.principalRemaining||0, due);
        const interestPart  = Math.max(0, due - principalPart);

        if (principalPart > 0) transfer(borrower, lender, principalPart, { taxable:false });
        if (interestPart  > 0) transfer(borrower, lender, interestPart,  { taxable:true,  reason:'Interés de préstamo' });

        loan.principalRemaining = Math.max(0, (loan.principalRemaining||0) - principalPart);
        loan.interestRemaining  = Math.max(0, (loan.interestRemaining||0) - interestPart);

        log(`${getName?.(borrower)} paga ${fmtMoney?.(due)} a ${getName?.(lender)} (${loan.remainingTurns} turno(s) restantes).`);
      } else {
        // IMPAGO TOTAL → ejecución inmediata
        ejecutarImpagoCompleto(loan, borrower, lender);
        continue; // no reponer este préstamo
      }
    }

    const deuda = (loan.principalRemaining||0) + (loan.interestRemaining||0);

    if (deuda <= 0){
      log(`✅ Préstamo ${getName?.(borrower)} → ${getName?.(lender)} liquidado.`);
      continue;
    }

    // Si se acabaron los ticks y aún hay deuda, ejecutar
    if ((loan.remainingTurns||0) <= 0){
      ejecutarImpagoCompleto(loan, borrower, lender, {motivo:'Vencido con deuda'});
      continue;
    }

    remaining.push(loan);
  }

  state.loans = remaining;
  renderAll?.();
}

function ejecutarImpagoCompleto(loan, borrower, lender, opts={}){
  const props = (borrower.props||[]).slice();
  let moved = 0;
  props.forEach(i=>{
    const t = TILES[i];
    if (!t || t.type !== 'prop') return;
    t.owner = lender.id; // Pasa la titularidad al prestamista
    moved++;
  });
  recomputeProps?.();
  log(`💥 IMPAGO: propiedades de ${getName?.(borrower)} → ${getName?.(lender)}${moved?` (${moved})`:''}${opts.motivo?` [${opts.motivo}]`:''}.`);
}
/* =================== INTERCAMBIO DE PROPIEDADES =================== */
function trade(){
  const me = state.players[state.current];
  const otherIdx = Number(prompt(`¿Con quién intercambias? (1..${state.players.length}, distinto de ${me.id+1})`))-1;
  if (isNaN(otherIdx)||otherIdx===me.id||!state.players[otherIdx]||!state.players[otherIdx].alive){return;}
  const other = state.players[otherIdx];

  recomputeProps();
  const myProps = me.props||[];
  const theirProps = other.props||[];

  const list = (arr)=>arr.map(i=>`${i}:${TILES[i].name}`).join(', ')||'—';
  const offerMine   = prompt(`Tus props [idx]: ${list(myProps)}\nÍndices que OFRECES (coma):`,'');
  const offerTheirs = prompt(`Props de ${other.name} [idx]: ${list(theirProps)}\nÍndices que PIDES (coma):`,'');

  const give = Number(prompt('Dinero que DAS:','0'))||0;
  const take = Number(prompt('Dinero que PIDES:','0'))||0;

  const parse = (txt,pool)=>(txt||'')
    .split(',')
    .map(s=>Number(s.trim()))
    .filter(i=>Number.isInteger(i)&&pool.includes(i));

  const selMine   = parse(offerMine,   myProps);
  const selTheirs = parse(offerTheirs, theirProps);

  if(!confirm(`Confirmar intercambio:\nDas: ${selMine.map(i=>TILES[i].name).join(', ')||'—'} + ${fmtMoney(give)}\nRecibes: ${selTheirs.map(i=>TILES[i].name).join(', ')||'—'} + ${fmtMoney(take)}`)) return;

      // — Base imponible = ganancia neta frente al valor-tablero (t.price)
      const sumPrice = arr => arr.reduce((s,i)=> s + (TILES[i]?.price || 0), 0);

      const myOut  = sumPrice(selMine)   + give; // lo que yo entrego (props a precio de tablero + dinero)
      const myIn   = sumPrice(selTheirs) + take; // lo que yo recibo (props a precio de tablero + dinero)
      const myGain = Math.max(0, Math.round(myIn - myOut));      // ganancia neta mía
      const otGain = Math.max(0, Math.round(myOut - myIn));      // ganancia neta del otro (simétrica)

      // Pregunta aceptación del otro
      let accepted = confirm(`¿${other.name} acepta?`);
      if (!accepted) {
        const forced = window.Roles?.maybeForceTradeAcceptance?.({ initiatorId: me.id, counterpartyId: other.id });
        if (forced) {
          log('🤝 Florentino fuerza la aceptación.');
          accepted = true;
        } else {
          alert('Intercambio cancelado.'); return;
        }
      }

      // Impugnación por un tercero antes de ejecutar el trato
      const who = prompt('Impugnación del J3/J4… (ID de jugador) o vacío para seguir', '');
      if (who) {
        const byId = Number(who)-1;
        // desbalance (0..1) según ganancia neta
        const denom   = Math.max(1, Math.abs(myGain)+Math.abs(otGain));
        const imbalance = Math.min(1, Math.abs(myGain-otGain)/denom);
        const res = window.Roles?.challengeDeal?.({ byId, imbalance }) || { annulled:false };
        if (res.annulled) { alert('⚖️ Juez IA anula el trato.'); return; }
      }

  if (give>0 && me.money<give){ alert('No tienes suficiente dinero.'); return; }
  if (take>0 && other.money<take){ alert(`${other.name} no tiene suficiente dinero.`); return; }

  selMine.forEach(i=>{ TILES[i].owner = other.id; });
  selTheirs.forEach(i=>{ TILES[i].owner = me.id; });
  recomputeProps();

  // Dinero del intercambio: NO tributa directamente
  if (give > 0) { debit(me, give,   { taxable:false }); credit(other, give,   { taxable:false }); }
  if (take > 0) { debit(other, take, { taxable:false }); credit(me,   take,    { taxable:false }); }

  // Marca la base imponible SIN alterar el saldo final:
  // (credit taxable para subir taxBase y luego debit neutro para dejar el dinero igual)
  if (myGain  > 0) { credit(me,    myGain, { taxable:true,  reason:'Ganancia por intercambio' }); debit(me,    myGain, { taxable:false }); }
  if (otGain  > 0) { credit(other, otGain, { taxable:true,  reason:'Ganancia por intercambio' }); debit(other, otGain, { taxable:false }); }

  log(`${me.name} ⇄ ${other.name} | Das: [${selMine.map(i=>TILES[i].name).join(', ')||'—'}], ${fmtMoney(give)} | Recibes: [${selTheirs.map(i=>TILES[i].name).join(', ')||'—'}], ${fmtMoney(take)}.`);
  // (Opcional) log de transparencia
  log(`Base imponible por intercambio → ${me.name}: ${fmtMoney(myGain)}, ${other.name}: ${fmtMoney(otGain)}.`);
  renderAll();
}

function ensureTradeButton(){
  const loanBtn = document.getElementById('loan'); if(!loanBtn) return;
  if(document.getElementById('trade')) return;
  const btn = document.createElement('button');
  btn.id = 'trade';
  btn.textContent = 'Intercambiar';
  btn.onclick = trade;
  loanBtn.parentNode.insertBefore(btn, loanBtn.nextSibling);
}
document.addEventListener('DOMContentLoaded', ensureTradeButton);

/* =================== BANCARROTA =================== */
function checkBankrupt(p){
  if(!p || p.money>=0 || !p.alive) return;
  p.alive = false;
  // Vaciar edificios e “independizar” propiedades (quedan libres)
  (p.props||[]).forEach(i=>{
    const t=TILES[i]; if(!t) return;
    t.owner=null; t.houses=0; t.hotel=false; t.mortgaged=false;
  });
  p.props=[];
  log(`${p.name} entra en QUIEBRA.`);
  renderAll();
}
function everyoneLoses(){
  alert('El ESTADO ha eliminado a un jugador. Todos pierden.');
  location.reload();
}

/* =================== IA del ESTADO (ligera) =================== */
function estadoAct(){
  recomputeProps();

  // 1) Intento de compra de la propiedad libre más barata (si tiene saldo)
  const free = TILES.map((t,i)=>({t,i}))
    .filter(x=>x.t.type==='prop' && x.t.owner==null)
    .sort((a,b)=> (a.t.price||0) - (b.t.price||0));

  if (free.length){
    const pick = free[0];
    if ((Estado.money||0) >= (pick.t.price||0)){
      debit(Estado, pick.t.price, {taxable:false});
      pick.t.owner='E';
      Estado.props = Estado.props||[]; Estado.props.push(pick.i);
      log(`Estado compra ${pick.t.name} por ${fmtMoney(pick.t.price)}.`);
    }
  }

  // 2) Si hay jugadores apurados, intentar compra directa de 1 propiedad
  const needy = state.players.filter(p=>p.alive && (p.money||0)<100 && (p.props||[]).length);
  if (needy.length){
    const p=needy[Math.floor(Math.random()*needy.length)];
    const pi=(p.props||[])[0]; const t=TILES[pi];
    const offer = Math.floor((t.price||0)*1.2);
    if ((Estado.money||0) >= offer){
      if (confirm(`Estado ofrece ${fmtMoney(offer)} por ${t.name} a ${p.name}. ¿Aceptar?`)){
        debit(Estado, offer, {taxable:false});
        credit(p, offer, {taxable:true});
        t.owner='E';
        recomputeProps();
        log(`Estado compra ${t.name} a ${p.name} por ${fmtMoney(offer)}.`);
      }
    }
  }
}

/* =================== DADOS / TURNOS: pequeños ajustes de robustez =================== */
document.addEventListener('DOMContentLoaded', function(){
  const rollBtn = document.getElementById('roll');
  const endBtn = document.getElementById('endTurn');
  if (rollBtn && !rollBtn.__wired){
    rollBtn.__wired = true;
    rollBtn.onclick = ()=>{ window.roll?.(); };
  }
  if (endBtn && !endBtn.__wired){
    endBtn.__wired = true;
    endBtn.onclick = ()=>{ window.endTurn?.(); };
  }
});


/* ===== Utilidades del árbitro ===== */
function applyTax(player = state.players[state.current]){
  if (!player || !player.alive) return;
  const base = Math.max(0, Math.round((player.taxBase||0) * 0.33));
  if (base > 0){
    transfer(player, Estado, base, {taxable:false, reason:'Impuesto 33% (aplicado manualmente)'});
    log(`💸 ${player.name} paga ${fmtMoney(base)} de impuesto (33% de ganancias).`);
    player.taxBase = 0;
  } else {
    log(`${player.name} no tiene ganancias acumuladas. No paga impuesto.`);
  }
}

// ===== Logger extra de impuestos (caer en casillas y razones tipo "impuesto") =====
;(() => {
  const looksLikeTaxTile = (t)=> !!t && (t.type==='tax' || /impuesto|tax/i.test(t?.name||''));
  const isEstado = (x)=> x===Estado || x==='E' || x?.id==='E';
  const curTile = ()=>{ try{ const p=state.players[state.current]; return TILES[p?.pos]; }catch{} return null; };

  // wrap transfer
  if (typeof window.transfer === 'function'){
    const _transfer = window.transfer;
    window.transfer = function(from,to,amount,opts){
      const out = _transfer.apply(this, arguments);
      try{
        const payer    = typeof from==='object'? from : playerById?.(from);
        const receiver = typeof to==='object'  ? to   : playerById?.(to);
        const tile = curTile();
        const taxish = looksLikeTaxTile(tile) || /impuesto|tax/i.test(opts?.reason||'');
        if (payer?.name && isEstado(receiver) && amount>0 && taxish){
          log(`💸 ${getName?.(payer)} paga ${fmtMoney?.(amount)} de impuestos${tile?.name?` en ${tile.name}`:''}.`);
        }
      }catch{}
      return out;
    };
  }

  // wrap debit/credit pareados (por si el pago de impuestos no usa transfer)
  state.__taxLog = state.__taxLog || null;
  if (typeof window.debit === 'function'){
    const _debit = window.debit;
    window.debit = function(p, amount, opts){
      const out = _debit.apply(this, arguments);
      try{
        const tile = curTile();
        if ((looksLikeTaxTile(tile) || /impuesto|tax/i.test(opts?.reason||'')) && p?.alive){
          state.__taxLog = { pid:p.id, amt:amount, tile:tile?.name||'', t:Date.now() };
        }
      }catch{}
      return out;
    };
  }
  if (typeof window.credit === 'function'){
    const _credit = window.credit;
    window.credit = function(p, amount, opts){
      const out = _credit.apply(this, arguments);
      try{
        const s = state.__taxLog;
        if (isEstado(p) && s && amount>=s.amt*0.9 && Date.now()-s.t<2000){
          const pl = state.players?.[s.pid];
          log(`💸 ${pl?.name||'Jugador'} paga ${fmtMoney?.(s.amt)} de impuestos${s.tile?` en ${s.tile}`:''}.`);
          state.__taxLog = null;
        }
      }catch{}
      return out;
    };
  }
})();

  // === Tragaperras gratis: animación grande en overlay ===
function playSlotsFree(player, tile){
  const overlay = document.getElementById('doubleOverlay');
  if (!overlay){ log('No hay overlay para slots.'); return; }

  // CSS una sola vez
  if (!document.getElementById('slots-css')){
    const css = document.createElement('style');
    css.id = 'slots-css';
    css.textContent = `
      .slotsWrap{display:flex;flex-direction:column;align-items:center;gap:18px;
        background:rgba(17,24,39,.92);padding:24px 28px;border-radius:16px;
        box-shadow:0 10px 40px rgba(0,0,0,.6)}
      .reels{display:flex;gap:18px}
      .reel{width:128px;height:128px;border-radius:18px;background:#0b1220;
        border:2px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;
        font-size:82px;line-height:1;box-shadow:inset 0 0 0 2px rgba(255,255,255,.08)}
      .slotsMsg{font-size:20px;opacity:.9}
      @keyframes bump{0%{transform:scale(1)}70%{transform:scale(1.25)}100%{transform:scale(1)}}
      .win{animation:bump .5s ease}
    `;
    document.head.appendChild(css);
  }

  const symbols = ['🍒','🍋','🔔','⭐','7️⃣','🍉','🍇','🍀'];
  overlay.innerHTML = `
    <div class="slotsWrap" role="dialog" aria-label="Tragaperras">
      <div class="reels">
        <div class="reel" id="reel1">❔</div>
        <div class="reel" id="reel2">❔</div>
        <div class="reel" id="reel3">❔</div>
      </div>
      <div class="slotsMsg" id="slotsMsg">Girando…</div>
    </div>`;
  overlay.style.display = 'flex';

  const pick = ()=> symbols[Math.floor(Math.random()*symbols.length)];
  function spin(el, duration, final){
    const start = performance.now();
    const tick = (t)=>{
      if (t - start < duration){
        el.textContent = pick();
        requestAnimationFrame(tick);
      } else {
        el.textContent = final;
      }
    };
    requestAnimationFrame(tick);
  }

  const r1 = document.getElementById('reel1');
  const r2 = document.getElementById('reel2');
  const r3 = document.getElementById('reel3');

  let finals = [pick(), pick(), pick()];
  try {
    if (window.Roles?.is?.(player.id,'proxeneta')) {
      const baseP = 1/25; // 5 símbolos uniformes → 1/5^2 extra para las otras dos ruedas
      const wantWin = window.Roles.decideWin(baseP, player, 'slots');
      const winsNow = finals[0]===finals[1] && finals[1]===finals[2];
      if (wantWin && !winsNow) finals = [finals[0], finals[0], finals[0]];
    }
  } catch {}

  spin(r1, 900,  finals[0]);
  setTimeout(()=> spin(r2, 1100, finals[1]), 120);
  setTimeout(()=>{
    spin(r3, 1300, finals[2]);
    setTimeout(()=>{
      const win = finals[0]===finals[1] && finals[1]===finals[2];
      const msg = document.getElementById('slotsMsg');
      if (win){
        msg.textContent = '¡Premio $100!';
        r1.classList.add('win'); r2.classList.add('win'); r3.classList.add('win');
        // “Dinero impreso”: pago directo al jugador (no tributable). 
        // Si prefieres que salga del Estado, cambia a transfer(Estado, player, 100, {taxable:false}).
        giveMoney(player, 100, { taxable:false, reason:'Tragaperras gratis' });
      } else {
        msg.textContent = 'Nada…';
      }
      renderPlayers?.();
      state.rolled = true; updateTurnButtons?.();
      setTimeout(()=>{ overlay.style.display='none'; }, 1200);
    }, 1350);
  }, 240);

}

function tryCorruptLoan() {
  const p = state.players[state.current];
  if (!p) return;
  const idx = p.pos;

  const A = Number(prompt('Importe préstamo corrupto:', '300'))||0;
  if (A <= 0) return;
  const R = Number(prompt('Tipo (%, ej 20):', '20'))||0;
  const T = Number(prompt('Ticks (<=30):', '12'))||0;
  const res = window.Roles?.requestCorruptLoan?.({
    playerId: p.id,
    amount: A,
    rate: R,
    ticks: T,
    tileId: idx
  });
  if (!res?.accepted) {
    alert((res?.reason || 'Préstamo rechazado.') + (res?.pAccept!=null ? ` (p≈${(res.pAccept*100|0)}%)` : ''));
  } else {
    giveMoney(p, A, { taxable:false, reason:'Préstamo corrupto' });
    log(`Debe devolver ${fmtMoney(res.dueAmount)} al Estado en el turno ${res.dueTurn}.`);
  }
};
function sendToJail(player = state.players[state.current]) {
  if (!player || !player.alive) return;
  const jailIdx = TILES.findIndex(t => t.type === 'jail');
  if (jailIdx < 0) return;

  player.pos = jailIdx;
  player.jail = 3; // 3 intentos como ya usas
  BoardUI.refreshTiles();

  log(`🚔 ${player.name} va a la cárcel (máx 3 intentos).`);

  try {
    state.pendingTile = null;
    const box = document.getElementById('auction');
    if (state.auction && state.auction.open) {
      try { clearTimeout(state.auction.timer); } catch (e) {}
      if (box) box.style.display = 'none';
      state.auction.open = false;
      state.auction = null;
      log('⚠️ Subasta cancelada por ir a la cárcel.');
    }
    const overlay = document.getElementById('overlay');
    if (overlay?.style) overlay.style.display = 'none';
  } catch (e) {}

  state.rolled = true;
  updateTurnButtons?.();
  window.endTurn?.();
}
/* ===== Enlazar botones ===== */
document.addEventListener('DOMContentLoaded', ()=>{
  $('#build')?.addEventListener('click', buildHouse);
  $('#sell')?.addEventListener('click', sellHouse);
  $('#mortgage')?.addEventListener('click', mortgage);
  $('#unmortgage')?.addEventListener('click', unmortgage);
  $('#corruptLoan')?.addEventListener('click', tryCorruptLoan);
  // $('#loan')?.addEventListener('click', requestLoan); // ← antes era askLoan
  (() => {
    const btn = document.getElementById('loan');
    if (btn){
      const clone = btn.cloneNode(true);
      btn.replaceWith(clone);
      clone.addEventListener('click', requestLoan);
    }
  })();
});

/* ===== Exportar utilidades ===== */
window.applyTax   = applyTax;
window.sendToJail = sendToJail;

/* ======== SafeBug: forzar fin de turno si se queda colgado ======== */
(function(){
  const SafeBug = {
    lastBeat: Date.now(),
    armSec: 180,   // 3 minutos
    timer: null
  };

  function beat(){ SafeBug.lastBeat = Date.now(); }

  // Teclas rápidas: F9 = forzar fin de turno
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'F9'){ forceEndTurn(); }
  });

  // Si hay errores JS o promesas rechazadas, marcamos actividad para no disparar falso positivo
  window.addEventListener('error', beat);
  window.addEventListener('unhandledrejection', beat);

  // Mostrar “Forzar turno” cuando detecte inactividad prolongada
  function watchdogTick(){
    const idleMs = Date.now() - SafeBug.lastBeat;
    const stuck = idleMs > SafeBug.armSec*1000;
    const endBtn = document.getElementById('endTurn');
    if (!endBtn) return;

    if (stuck){
      endBtn.style.display = '';      // que se vea aunque la UI normal lo oculte
      endBtn.disabled = false;        // clicable
      if (!endBtn.dataset.safebug){
        endBtn.dataset.safebug = '1';
        endBtn.dataset.oldLabel = endBtn.textContent || '';
        endBtn.textContent = 'Forzar turno (F9)';
        endBtn.title = 'Desbloqueo de emergencia';
        endBtn.onclick = ()=>forceEndTurn(); // clic = forzar
      }
    } else if (endBtn.dataset.safebug){
      // volver al estado normal cuando hay actividad
      endBtn.textContent = endBtn.dataset.oldLabel || 'Terminar turno';
      endBtn.removeAttribute('data-safebug');
      endBtn.title = '';
      // la lógica normal de visibilidad vuelve a tomar control vía updateTurnButtons()
    }
  }

  // Parchear funciones para latidos (“actividad”)
  document.addEventListener('DOMContentLoaded', ()=>{
    // 1) log(): cada mensaje cuenta como actividad
    if (typeof window.log === 'function'){
      const _log = window.log;
      window.log = function(...args){ try{ return _log.apply(this, args); } finally { beat(); } };
    }
    // 2) BoardUI.refreshTiles(): cada refresco cuenta como actividad
    if (window.BoardUI?.refreshTiles){
      const _rt = window.BoardUI.refreshTiles;
      window.BoardUI.refreshTiles = function(){ try{ return _rt.apply(this, arguments); } finally { beat(); } };
    }
    // 3) Arrancar el vigilante
    SafeBug.timer = setInterval(watchdogTick, 1000);
  });

  // Forzar fin de turno (cierra subastas si estuvieran atascadas)
  window.forceEndTurn = function(){
    try{
      // Si hay subasta abierta, la cerramos para no bloquear endTurn
      if (state.auction && state.auction.open){
        try{ clearTimeout(state.auction.timer); }catch{}
        const box = document.getElementById('auction');
        if (box) box.style.display = 'none';
        state.auction = null;
        log('⚠️ SafeBug: subasta cerrada por emergencia.');
      }
      // Limpiezas ligeras de estado transitorio
      state.pendingTile = null;
      state.usedTransportHop = false;
    }catch{}
    log('⛑️ SafeBug: turno forzado.');
    // Llama al endTurn estándar (con nóminas, préstamos, etc.)
    window.endTurn?.();
    beat();
  };
})();

// [PATCH] Interceptar rentas embargadas y tope
if (typeof window.transfer === 'function'){
  const _transfer2 = window.transfer;
  window.transfer = function(from,to,amount,opts){
    // Desvío por embargo de rentas
    try{
      const isRent = /Alquiler|Fiore|IVA alquiler/i.test(opts?.reason||'');
      const toId = (to==='E'||to===Estado) ? 'E' : to?.id;
      if (isRent && toId!=null && state.garnish && state.garnish[toId] && state.garnish[toId].count>0){
        // Cobro va al Estado en su lugar
        const g = state.garnish[toId];
        g.count--;
        log(`⚖️ Embargo: renta de ${fmtMoney?.(amount)} redirigida al Estado (quedan ${g.count}).`);
        return _transfer2.call(this, from, Estado, amount, Object.assign({}, opts, {reason: (opts?.reason||'')+' [embargada]'}));
      }
    }catch{}
    return _transfer2.apply(this, arguments);
  };
}
