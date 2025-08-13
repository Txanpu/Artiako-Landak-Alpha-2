'use strict';

/* v13 – Parte 5/7: dados, movimiento, SALIDA, turnos */

function addSkipTurn(player, turns = 1) {
  if (!player) return;
  player.skipTurns = (player.skipTurns || 0) + turns;
  log(`${player.name} pierde ${turns} turno(s).`);
}

function nextAlive(from){
  const n = state.players.length; if(!n) return 0;
  for (let k=1;k<=n;k++){
    const idx = (from + k) % n;
    if (state.players[idx].alive) return idx;
  }
  return from;
}

function botEndTurnWhenIdle(){
  const p = state.players[state.current];
  if (!p?.isBot) return;
  // Esperar a que no haya subastas ni acciones pendientes
  if (!state.rolled) { setTimeout(botEndTurnWhenIdle, 500); return; }
  if (state.auction && state.auction.open) { setTimeout(botEndTurnWhenIdle, 500); return; }
  if (state.pendingTile != null) { setTimeout(botEndTurnWhenIdle, 500); return; }
  const overlay = document.getElementById('overlay');
  if (overlay && overlay.style.display !== 'none') { setTimeout(botEndTurnWhenIdle, 500); return; }
  const auctionBox = document.getElementById('auction');
  if (auctionBox && auctionBox.style.display !== 'none') { setTimeout(botEndTurnWhenIdle, 500); return; }
  endTurn();
}

function botAutoPlay(){
  const p = state.players[state.current];
  if (!p?.isBot) return;
  setTimeout(()=>{
    if (!state.rolled) roll();
    // Revisa periódicamente si puede finalizar el turno
    setTimeout(botEndTurnWhenIdle, 600);
  }, 600);
}

function movePlayer(p, steps){
  if(!p.alive) return;
  const total = TILES.length;
  let old = p.pos;
  let np = old + steps;
  // pasar por salida (paga el Estado si tiene fondos)
  while (np >= total){
    np -= total;

    // v22 — Huelga: sin ayudas este tick
    if (window.Roles?.shouldBlockWelfare?.()) {
      log('Huelga general: sin ayudas este tick.');
      continue; // Salta el pago de esta vuelta
    }

    if (window.Roles?.shouldBlockSalary?.(p.id)) {
      log('Techo de cristal');
      continue;
    }

    const SALARIO = 200;
    if ((Estado.money || 0) >= SALARIO){
      // Debita del Estado y acredita al jugador (contabiliza en taxBase)
      Estado.money = Math.max(0, Math.round((Estado.money || 0) - SALARIO));
      giveMoney(p, SALARIO, { taxable:true, reason:'Salario del Estado por pasar SALIDA' });
      renderPlayers?.();
    } else {
      log(`💸 ${p.name} pasa por SALIDA, pero el Estado no tiene fondos (${fmtMoney(Estado.money||0)}). No se paga salario.`);
    }
  }
  p.pos = np;
  BoardUI?.refreshTiles?.(); // <-- Esto es clave
  log(`${p.name} avanza ${steps} hasta #${np} (${TILES[np].name || TILES[np].type})`);
  // Usa window.onLand con optional chaining para evitar errores si falta la función
  // (por ejemplo, si el bundle no incluye v20-part6.js).
  window.onLand?.(p, np);
}

function roll(){
  const p = state.players[state.current]; if(!p || !p.alive) return;
  if (p.skipTurns && p.skipTurns > 0) {
    p.skipTurns--;
    log(`${p.name} pierde el turno.`);
    endTurn();
    return;
  }
  if (state.rolled){ log('Ya has tirado este turno.'); return; }
    if (p.jail > 0){
      // Elegir: pagar o intentar dobles
      let choice = prompt(`Estás en la cárcel (${p.jail} turno(s)). Escribe "pagar" para salir por $50 o "tirar" para intentar dobles.`, 'tirar');
      choice = (choice||'').trim().toLowerCase();

      let paid = false;
      if (choice.startsWith('p')) {
        if (p.money < 50) {
          alert('No te llega para pagar 50. Debes intentar dobles.');
        } else {
          transfer(p, Estado, 50, {taxable:false, reason:'Fianza cárcel'});
          ensureAlive(p);
          p.jail = 0; // libre
          paid = true;
        }
      }

      // Tirada (si pagó, sale y tira normal; si no, intenta dobles)
      let d1, d2;
      if (Roles?.rollDie0to9) {
        d1 = Roles.rollDie0to9();
        d2 = Roles.rollDie0to9();
      } else {
        d1 = Math.floor(Math.random()*10);
        d2 = Math.floor(Math.random()*10);
      }
      const sum = d1 + d2;
      state.lastRoll = sum;
      renderDice(d1, d2, `Total: ${sum}${d1===d2?' — Dobles':''}`);

      // Regla 6 y 9: ir al FIORE más cercano
      if ((d1===6 && d2===9) || (d1===9 && d2===6)) {
        p.jail = 0;
        const total = TILES.length;
        let i = (p.pos + 1) % total;
        while (!(TILES[i]?.type==='prop' && TILES[i]?.subtype==='fiore')) {
          i = (i + 1) % total;
          if (i === p.pos) break;
        }
        log('➡️  Regla 6 y 9: vas al FIORE más cercano.');
        p.pos = i; BoardUI?.refreshTiles?.(); onLand(p, i);
        state.rolled = true; updateTurnButtons(); return;
      }

      if (paid || d1===d2){
        if (!paid && d1===d2) log(`${p.name} saca dobles y sale de la cárcel.`);
        p.jail = 0;
        movePlayer(p, sum);
        state.rolled = true; updateTurnButtons(); return;
      } else {
        // Fallo intentando dobles
        p.jail--;
        if (p.jail === 0){
          log(`${p.name} falla el 3º intento. Paga $50 y sale.`);
          transfer(p, Estado, 50, {taxable:false, reason:'Fianza tras 3 intentos'});
          ensureAlive(p);
          movePlayer(p, sum);           // te mueves con la tirada del 3º intento
          state.rolled = true; updateTurnButtons(); return;
        }
        log(`${p.name} no saca dobles. Le quedan ${p.jail} turno(s) en la cárcel.`);
        state.rolled = true; renderPlayers(); updateTurnButtons(); return;
      }
    }

    let d1, d2;
    if (Roles?.rollDie0to9) {
      d1 = Roles.rollDie0to9();
      d2 = Roles.rollDie0to9();
    } else {
      d1 = Math.floor(Math.random()*10);
      d2 = Math.floor(Math.random()*10);
    }

  if (window.Roles && Roles.maybeEditDie) {
    var ed = Roles.maybeEditDie({ playerId: p.id, d1: d1, d2: d2 });
    if (ed && typeof ed.d1 === 'number') d1 = ed.d1;
    if (ed && typeof ed.d2 === 'number') d2 = ed.d2;
  }

    // Regla 6 y 9: ir al FIORE más cercano
    if ((d1===6 && d2===9) || (d1===9 && d2===6)) {
      const total = TILES.length;
      let i = (p.pos + 1) % total;
      while (!(TILES[i]?.type==='prop' && TILES[i]?.subtype==='fiore')) {
        i = (i + 1) % total;
        if (i === p.pos) break;
      }
      log('➡️  Regla 6 y 9: vas al FIORE más cercano.');
      p.pos = i; BoardUI?.refreshTiles?.(); onLand(p, i);
      state.rolled = true; updateTurnButtons();
      return;
    }

    // Especiales adicionales (p.ej. 0–0 repite) si Roles lo define
    try {
      const sp = window.Roles?.handleDiceSpecials?.({ d1, d2, playerId: p.id }) || {};
      if (sp.repeatTile && !(d1===0 && d2===0)) {
        log('⟳ Regla 0–0: repites la casilla y resuelves de nuevo.');
        onLand(p, p.pos);
      }
      if (sp.gotoNearestFiore) {
        const total = TILES.length;
        let i = (p.pos + 1) % total;
        while (!(TILES[i]?.type==='prop' && TILES[i]?.subtype==='fiore')) {
          i = (i + 1) % total;
          if (i === p.pos) break;
        }
        log('➡️  Regla 6 y 9: vas al FIORE más cercano.');
        p.pos = i; BoardUI?.refreshTiles?.(); onLand(p, i);
        return;
      }
    } catch {}

  const sum = d1 + d2;
  state.lastRoll = sum;
  const isDouble = d1===d2;
  const isSnake  = d1===1 && d2===1;
  p.doubleStreak = isDouble ? (p.doubleStreak||0)+1 : 0;

  renderDice(d1, d2, `Total: ${sum}${isDouble?' — Dobles':''}`);

  if (d1===0 && d2===0){
    log(`${p.name} saca 0–0 y se queda en la misma casilla.`);
    onLand(p, p.pos);
  } else if (isSnake){
    log(`${p.name} dobles de 1 → cárcel directa (sin repetir).`);
    showDoublesOverlay();
    window.sendToJail?.(p);
    p.doubleStreak = 0;        // ← evita estados raros
    return;                     // endTurn ya lo hace sendToJail
  } else {
    movePlayer(p, sum);
  }

  // Dobles normales: hasta 3 tiradas, luego cárcel
  if (isDouble){
    document.getElementById('doubleOverlay').style.display='block';
    setTimeout(()=>{ document.getElementById('doubleOverlay').style.display='none'; }, 900);

    if (p.doubleStreak >= 3){
      log(`${p.name} saca 3 dobles seguidos → cárcel.`);
      window.sendToJail?.(p);
      p.doubleStreak = 0;
      state.rolled = true; updateTurnButtons(); return;
    }
    log(`${p.name} dobles #${p.doubleStreak}: tiras otra vez.`);
    state.rolled = false; updateTurnButtons(); return;
  }

  // Tirada normal
  state.rolled = true; updateTurnButtons();
}

function applyFiorePayroll(player){
  const tiles = TILES.filter(t=>t.type==='prop' && t.subtype==='fiore' && t.owner===player.id);
  tiles.forEach(t=>{
    const pay = (t.workers||0) * (t.wagePer||1);
    if (pay>0){ transfer(player, Estado, pay, {taxable:false, deductible:true, reason:`Salarios Fiore (${t.workers}×${t.wagePer})`}); ensureAlive(player); }
  });
}

function endTurn() {
  if (state._endingTurn) return;
  state._endingTurn = true;
  try {
    if (state.auction && state.auction.open) { alert('No puedes terminar el turno mientras hay una subasta en curso.'); return; }
    applyLoansAtTurnEnd?.();
    applyFiorePayroll?.(state.players[state.current]);
    // NUEVO: construir automático del Estado
    window.stateAutoBuildHotels?.();

    // Tick de modificadores de eventos
    if ((state.rentEventTurns||0) > 0){ state.rentEventTurns--; if (!state.rentEventTurns) { state.rentEventMul = 1; log('⏳ Fin de modificador de rentas.'); } }
    if ((state.buildEventTurns||0) > 0){ state.buildEventTurns--; if (!state.buildEventTurns) { state.buildEventMul = 1; log('⏳ Fin de modificador de construcción.'); } }
    if ((state.rentFlatTurns||0)  > 0){ state.rentFlatTurns--;  if (!state.rentFlatTurns)  { state.rentFlatBonus = 0; log('⏳ Fin de alquiler +1.'); } }
    if ((state.ivaRentTurns||0) > 0){ state.ivaRentTurns--; if (!state.ivaRentTurns){ state.rentIVAMul = 1; log('⏳ Fin de IVA en rentas.'); } }
    if ((state.ivaBuildTurns||0) > 0){ state.ivaBuildTurns--; if (!state.ivaBuildTurns){ state.buildIVAMul = 1; log('⏳ Fin de IVA en construcción.'); } }

    // === [PATCH] Ticks de efectos nuevos ===
    // ownerRentMul (multiplicador por propietario)
    if (state.ownerRentMul){
      for (const [pid, obj] of Object.entries(state.ownerRentMul)){
        if (!obj) continue;
        if ((obj.turns||0) > 0){ obj.turns--; if (!obj.turns) delete state.ownerRentMul[pid]; }
      }
    }
    // rentFilters (efectos por categoría)
    if (Array.isArray(state.rentFilters)){
      state.rentFilters.forEach(ef => { if (ef.turns>0) ef.turns--; });
      state.rentFilters = state.rentFilters.filter(ef => ef.turns>0);
    }
    // rentCap
    if (state.rentCap && (state.rentCap.turns||0) > 0){
      state.rentCap.turns--; if (!state.rentCap.turns) state.rentCap = null;
    }
    // embargo de rentas
    if (state.garnish){
      for (const [pid, g] of Object.entries(state.garnish)){
        if (!g) continue;
        if ((g.turns||0) > 0){ g.turns--; if (!g.turns) delete state.garnish[pid]; }
      }
    }
    // bloqueo hipoteca (por jugador)
    if (state.blockMortgage){
      for (const [pid, t] of Object.entries(state.blockMortgage)){
        if (t>0){ state.blockMortgage[pid] = t-1; if (!state.blockMortgage[pid]) delete state.blockMortgage[pid]; }
      }
    }
    // huelga de obras
    if ((state.blockBuildTurns||0) > 0){ state.blockBuildTurns--; }
    // racionamiento cemento: devolver stock al final
    if (state.cement && state.cement.turns>0){
      state.cement.turns--;
      if (!state.cement.turns){
        BANK.housesAvail += (state.cement.taken||0);
        state.cement = null;
        log('⏳ Fin del racionamiento de cemento: se devuelve stock de casas.');
      }
    }

    state.rolled = false;
    updateTurnButtons?.();
    state.current = nextAlive(state.current);
    state.turnCount = (state.turnCount || 0) + 1;
    if (window.UIX?.track.onTurn) UIX.track.onTurn(state.turnCount);

    // v22: ciclo de gobierno, vencimientos préstamos corruptos, etc.
    try { window.Roles?.tickTurn(); } catch {}

    // Aplica cobros periódicos (fentanilo, etc.) y movimientos pendientes si los hay
    try {
      const getPlayerById = (id) => (id === 'E' || id === Estado) ? Estado : state.players[id];

      for (const pay of pays) {
        if (pay.toType === 'tileOwner') {
          const t = TILES[pay.tileId];
          const owner = t?.owner;
          if (owner != null) {
            transfer( getPlayerById(pay.fromId), getPlayerById(owner),
              pay.amount, { taxable:false, reason: pay.reason || 'Estado' }
            );
          }
        }
      }
    } catch(e) { console.error('Error procesando pagos pendientes de Roles:', e); }

    renderPlayers();
    const p = state.players[state.current];
    log(`— Turno de ${p.name} —`);
    try { window.Roles?.onTurnStart?.(p); } catch{}
    botAutoPlay();

    // [PATCH] Hooks de inicio de turno para módulos
    try {
      // GDM.onTurnStart está parcheado por GameRiskPlus para incluir su propia lógica (margin calls, mantenimiento)
      if (window.GameDebtMarket?.onTurnStart) {
        const maintFee = GameDebtMarket.onTurnStart(p.id) || 0;
        if (maintFee > 0) {
          log(`💸 Mantenimiento dinámico: ${p.name} paga ${window.fmtMoney?.(maintFee) || maintFee}.`);
        }
      }
    } catch(e) { console.error("Error en hooks de inicio de turno", e); }
  } finally {
    state._endingTurn = false;
  }
}

function showDoublesOverlay() {
  const overlay = document.getElementById('doubleOverlay');
  if (!overlay) return;
  overlay.innerHTML = '<img src="img/doubles.jpg" alt="Dobles">';
  overlay.style.display = 'flex';
  setTimeout(()=>{ overlay.style.display='none'; }, 2200);
}

document.addEventListener('DOMContentLoaded', ()=>{
  const rollBtn = document.getElementById('roll');
  if (rollBtn && !rollBtn.__wired){
    rollBtn.__wired = true;
    rollBtn.addEventListener('click', roll);
  }

  const endBtn = document.getElementById('endTurn');
  if (endBtn && !endBtn.__wired){
    endBtn.__wired = true;
    endBtn.addEventListener('click', endTurn);
  }
});
window.roll = roll;
window.endTurn = endTurn;

state.usedTransportHop = false;

// === GUARDAR / CARGAR ===
function saveGame(slot='slot1'){
  const data = {
    v: 15,
    ts: Date.now(),
    players: state.players.map(p=>({
      id: p.id, name: p.name, money: p.money, pos: p.pos,
      alive: !!p.alive, jail: p.jail||0, taxBase: p.taxBase||0,
      doubleStreak:p.doubleStreak||0
    })),
    estado: { money: Math.floor(Estado.money||0) },
    owners: TILES.map(t => t.type==='prop' ? (t.owner ?? null) : null),
    current: state.current||0,
    rolled: state.rolled || false,    
    extras: TILES.map(t => (t.type==='prop' && t.subtype==='fiore') ? {workers:t.workers||0} : null),
    usedTransportHop: !!state.usedTransportHop
  };
  localStorage.setItem(`mono:${slot}`, JSON.stringify(data));
  log('💾 Partida guardada.');
}

function loadGame(slot='slot1'){
  const raw = localStorage.getItem(`mono:${slot}`);
  if (!raw){ log('No hay partida guardada.'); return; }
  const data = JSON.parse(raw);

  Estado.money = Math.floor(data?.estado?.money || 0);

  if (data.players) {
    state.players.forEach(p=>{
      const src = data.players.find(x=>x.id===p.id);
      if (src) Object.assign(p, src);
    });
  }

  if (data.owners) {
    TILES.forEach((t,i)=>{
      if (t.type==='prop') t.owner = data.owners[i];
    });
  }

  if (data.extras){
    TILES.forEach((t,i)=>{
      if (t && t.type==='prop' && t.subtype==='fiore' && data.extras[i]) t.workers = data.extras[i].workers||0;
    });
  }

  state.current = data.current||0;
  state.rolled = data.rolled||false;
  state.pendingTile = null;
  state.usedTransportHop = !!data.usedTransportHop;
  state.auction = null;
  const box = document.getElementById('auction');
  if (box) box.style.display = 'none';

  BoardUI?.refreshTiles?.();
  renderPlayers();
  if (typeof updateTurnButtons === 'function') updateTurnButtons();

  log('✅ Partida cargada.');
}

function downloadSave(slot='slot1'){
  const raw = localStorage.getItem(`mono:${slot}`) || '{}';
  const blob = new Blob([raw], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `partida_${slot}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importSaveFile(file, slot='slot1'){
  const r = new FileReader();
  r.onload = e => {
    localStorage.setItem(`mono:${slot}`, e.target.result);
    loadGame(slot);
  };
  r.readAsText(file);
}

window.addEventListener('beforeunload', ()=>saveGame('autosave'));

// ===== Keyboard shortcuts =====
document.addEventListener('keydown', (e) => {
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  switch (e.key.toLowerCase()) {
    case 'r':
      document.getElementById('roll')?.click();
      break;
    case 'e':
      document.getElementById('endTurn')?.click();
      break;
    case 'a':
      document.getElementById('startAuction')?.click();
      break;
    case 'l':
      if (typeof loadGame === 'function') loadGame();
      break;
    case 's':
      if (typeof saveGame === 'function') saveGame();
      break;
  }
});

// ===== Noticias económicas (titulares) =====
function headline(msg){ log(`🗞️ <b>${msg}</b>`); }

function news_build_cost(pct=10, turns=3){
  state.buildEventMul  = Math.max(0, 1 + pct/100);
  state.buildEventTurns = Math.max(1, Math.floor(turns));
  headline(`El ayuntamiento aprueba una nueva ley de construcción. ¡El coste de las casas sube un ${pct}% durante ${turns} turnos!`);
}

function news_rent_mul(pct=10, turns=3){
  state.rentEventMul   = Math.max(0, 1 + pct/100);
  state.rentEventTurns = Math.max(1, Math.floor(turns));
  headline(`Boom de demanda: los alquileres suben un ${pct}% durante ${turns} turnos.`);
}

function news_rent_flat(amount=10, turns=3){
  state.rentFlatBonus  = Math.floor(amount);
  state.rentFlatTurns  = Math.max(1, Math.floor(turns));
  headline(`Subvención temporal: +${amount} a cada alquiler durante ${turns} turnos.`);
}

function news_iva_rent(pct=21, turns=3){
  state.rentIVAMul   = Math.max(1, 1 + pct/100);
  state.ivaRentTurns = Math.max(1, Math.floor(turns));
  headline(`Hacienda aplica IVA del ${pct}% a los alquileres durante ${turns} turnos.`);
}

function news_iva_build(pct=21, turns=3){
  state.buildIVAMul   = Math.max(1, 1 + pct/100);
  state.ivaBuildTurns = Math.max(1, Math.floor(turns));
  headline(`IVA del ${pct}% en construcción durante ${turns} turnos.`);
}

// Exponer por consola si quieres probar rápido:
Object.assign(window, { headline, news_build_cost, news_rent_mul, news_rent_flat, news_iva_rent, news_iva_build });
