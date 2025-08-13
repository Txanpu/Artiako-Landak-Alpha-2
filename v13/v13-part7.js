/* v13 – Parte 7/7: construir, vender, hipoteca, préstamos */

// === AUTOSTART: crea J1/J2/J3 y asegura Estado ===
document.addEventListener('DOMContentLoaded', () => {
  // Asegura banca/Estado (sin redeclarar si ya existe)
  window.Estado = window.Estado || { id:'E', name:'Estado', money:5000, alive:true };

  // Asegura objeto de estado base (si no vino de otra parte)
  if (!window.state) {
    window.state = {
      players: [],
      current: 0,
      rolled: false,
      auction: null,
      pendingTile: null,
      loans: [],
      lastRoll: 0
    };
  }

  // Si no hay jugadores, crea J1–J3 de prueba
  if (!Array.isArray(state.players) || state.players.length === 0) {
    state.players = [
      { id:0, name:'J1', money:1500, pos:0, alive:true, jail:0, taxBase:0 },
      { id:1, name:'J2', money:1500, pos:0, alive:true, jail:0, taxBase:0 },
      { id:2, name:'J3', money:1500, pos:0, alive:true, jail:0, taxBase:0 }
    ];
    state.current = 0;
  }

  // Pinta tablero y panel
  BoardUI.attach({ tiles: window.TILES || [], state });
  BoardUI.renderBoard();
  if (typeof renderPlayers === 'function') renderPlayers();
  if (typeof log === 'function') log('Autostart: J1/J2/J3 creados y Estado activo.');
});

function assertOwnerCanAct(t, p){
  if (t.type!=='prop'){ log('No es una propiedad.'); return false; }
  if (t.owner !== p.id){ log('No eres el dueño.'); return false; }
  if (!p.alive){ log('Jugador eliminado.'); return false; }
  return true;
}

/* ===== Construir ===== */
function buildHouse(){
  const p = state.players[state.current]; if(!p) return;
  const idx = state.pendingTile ?? p.pos;
  const t = TILES[idx];
  if (!assertOwnerCanAct(t,p)) return;
  if (t.mortgaged){ log('No puedes construir en hipoteca.'); return; }

  const cost = t.houseCost ?? Math.round((t.price||0)*0.5);
  if (t.hotel){ log('Ya tiene hotel.'); return; }
  if (p.money < cost){ log('No te llega el dinero para construir.'); return; }

  if (t.houses < 4){
    t.houses++;
    transfer(p, Estado, cost, {taxable:false, reason:`Construcción en ${t.name}`});
    log(`🏠 Construido en ${t.name} (casas: ${t.houses}).`);
  } else {
    // promover a hotel
    t.houses = 0;
    t.hotel = true;
    transfer(p, Estado, cost, {taxable:false, reason:`Hotel en ${t.name}`});
    log(`🏨 Hotel en ${t.name}.`);
  }
  BoardUI.refreshTiles(); renderPlayers();
}

/* ===== Vender casa/hotel ===== */
function sellHouse(){
  const p = state.players[state.current]; if(!p) return;
  const idx = state.pendingTile ?? p.pos;
  const t = TILES[idx];
  if (!assertOwnerCanAct(t,p)) return;

  const price = t.houseCost ?? Math.round((t.price||0)*0.5);
  if (t.hotel){
    t.hotel = false; t.houses = 4;
    giveMoney(p, Math.round(price*0.5), {taxable:false, reason:`Venta parcial hotel ${t.name}`});
    log(`Se desmonta hotel en ${t.name} → 4 casas.`);
  } else if (t.houses>0){
    t.houses--;
    giveMoney(p, Math.round(price*0.5), {taxable:false, reason:`Venta casa en ${t.name}`});
    log(`Venta de casa en ${t.name} (quedan ${t.houses}).`);
  } else {
    log('No hay casas que vender.');
  }
  BoardUI.refreshTiles(); renderPlayers();
}

/* ===== Hipotecar / Deshipotecar ===== */
function mortgage(){
  const p = state.players[state.current]; if(!p) return;
  const idx = state.pendingTile ?? p.pos;
  const t = TILES[idx];
  if (!assertOwnerCanAct(t,p)) return;
  if (t.houses>0 || t.hotel){ log('Vende edificios antes de hipotecar.'); return; }
  if (t.mortgaged){ log('Ya está hipotecada.'); return; }

  const cash = Math.round((t.price||0)*0.5);
  t.mortgaged = true;
  giveMoney(p, cash, {taxable:false, reason:`Hipoteca ${t.name}`});
  BoardUI.refreshTiles(); renderPlayers();
}

function unmortgage(){
  const p = state.players[state.current]; if(!p) return;
  const idx = state.pendingTile ?? p.pos;
  const t = TILES[idx];
  if (!assertOwnerCanAct(t,p)) return;
  if (!t.mortgaged){ log('No está hipotecada.'); return; }

  const cost = Math.round((t.price||0)*0.55); // 10% de interés
  if (p.money < cost){ log('No te llega para levantar hipoteca.'); return; }
  transfer(p, Estado, cost, {taxable:false, reason:`Levantar hipoteca ${t.name}`});
  t.mortgaged = false;
  BoardUI.refreshTiles(); renderPlayers();
}

/* ===== Préstamo simple (del Estado) ===== */
function askLoan(){
  const p = state.players[state.current]; if(!p) return;
  const raw = prompt('Cantidad a solicitar al Estado'); 
  const amt = Math.max(0, Math.round(parseInt(raw||'0',10)));
  if (!amt) return;
  state.loans.push({ player:p.id, amount:amt, rate:0.1 });
  giveMoney(p, amt, {taxable:false, reason:'Préstamo del Estado'});
  renderPlayers();
}

// ===== Impuesto directo (misma mecánica que al caer en TAX) =====
function applyTax(player = state.players[state.current]){
  if (!player || !player.alive) return;
  const base = Math.max(0, Math.round((player.taxBase||0) * 0.03));
  if (base > 0){
    transfer(player, Estado, base, {taxable:false, reason:'Impuesto 3% (aplicado manualmente)'});
    player.taxBase = 0;
  } else {
    log(`${player.name} no tiene ganancias acumuladas. No paga impuesto.`);
  }
}

// ===== Enviar a la cárcel (2 turnos sin tirar) =====
function sendToJail(player = state.players[state.current]){
  if (!player || !player.alive) return;
  const jailIdx = TILES.findIndex(t => t.type==='jail');
  if (jailIdx >= 0){
    player.pos = jailIdx;
    player.jail = 2;
    BoardUI.refreshTiles();
    log(`🚔 ${player.name} va a la cárcel (2 turnos).`);
  }
}

/* ===== Enlazar botones ===== */
document.addEventListener('DOMContentLoaded', ()=>{
  $('#build')?.addEventListener('click', buildHouse);
  $('#sell')?.addEventListener('click', sellHouse);
  $('#mortgage')?.addEventListener('click', mortgage);
  $('#unmortgage')?.addEventListener('click', unmortgage);
  $('#loan')?.addEventListener('click', askLoan);
});

function credit(player, amount, {taxable=true, reason=''}={}){
  player.money = (player.money||0) + amount;
  if (taxable){
    const prev = state.taxBase.get(player.id)||0;
    state.taxBase.set(player.id, prev + Math.max(0, amount));
  }
  if (reason) log(`${player.name} recibe ${fmtMoney(amount)}${reason?` · ${reason}`:''}`);
}
function debit(player, amount, {taxable=false, reason=''}={}){
  player.money = (player.money||0) - amount;
  if (taxable){
    const prev = state.taxBase.get(player.id)||0;
    state.taxBase.set(player.id, Math.max(0, prev - Math.max(0, amount)));
  }
  if (reason) log(`${player.name} paga ${fmtMoney(amount)}${reason?` · ${reason}`:''}`);
}

/* transferencia con comprobaciones */
function transfer(from, to, amount, {taxable=false, reason=''}={}){
  amount = Math.max(0, Math.floor(amount||0));
  if (amount<=0) return;
  if (from && from!==Estado) debit(from, amount, {taxable, reason});
  if (to   && to!==Estado)   credit(to,   amount, {taxable:false, reason});
  ensureAlive(from);
  ensureAlive(to);
  renderPlayers?.();
}

/* elimina jugador si queda negativo (pasa todo al Estado) */
function ensureAlive(p){
  if (!p || p===Estado) return;
  if (p.money >= 0) return;
  p.alive = false;
  log(`${p.name} ha quebrado. Propiedades al Estado.`);
  (window.TILES||[]).forEach(t=>{
    if (t.owner===p.id){
      t.owner = 'E';
      t.houses = 0; t.hotel = 0; t.mortgaged=false;
    }
  });
  BoardUI.refreshTiles();
}

/* ===== render de jugadores (etiquetas de la UI) ===== */
function renderPlayers(){
  const wrap = $('#players'); if(!wrap) return;
  wrap.innerHTML = '';
  state.players.forEach(p=>{
    const div = document.createElement('div');
    div.className = 'badge' + (state.current===p.id?' active':'');
    div.textContent = `${p.name}: ${fmtMoney(p.money)}`;
    wrap.appendChild(div);
  });
}

/* ===== NUEVA PARTIDA (mínimo viable, el setup completo puede estar en otras partes) ===== */
function newGame(num=3, start=500){
  // jugadores
  state.players = [];
  for (let i=0;i<num;i++){
    state.players.push({ id:i, name:`J${i+1}`, money:start, pos:0, alive:true });
    state.taxBase.set(i, 0);
  }
  state.current = 0; state.doubles = 0; state.auction = null; state.started = true;

  // reset de casillas
  (window.TILES||[]).forEach(t=>{
    if (t.type==='prop'){ t.owner=null; t.houses=0; t.hotel=0; t.mortgaged=false; }
  });

  BoardUI.attach({ tiles:TILES, state });
  BoardUI.renderBoard();
  renderPlayers();
  log('Nueva partida lista.');
}

/* ===== hooks de UI básicos ===== */
$('#newGame')?.addEventListener('click', ()=>{
  const n = parseInt($('#numPlayers').value,10)||3;
  const s = parseInt($('#startMoney').value,10)||500;
  newGame(n,s);
});

/* exporta helpers a global (usados por otras partes que ya tienes) */
window.credit = credit;
window.debit = debit;
window.transfer = transfer;
window.renderPlayers = renderPlayers;
window.newGame = newGame;
window.applyTax = applyTax;
window.sendToJail = sendToJail;