/* v13 – Parte 4/7 (patched): setup, panel jugadores, utilidades de dinero
   — Esta versión mantiene TODA la economía y turnos aquí (fuente de verdad).
   — Muestra también el Estado (banca) al final del panel.
*/

/* ===== Helpers de UI ===== */
const $  = (q)=>document.querySelector(q);
const $$ = (q)=>Array.from(document.querySelectorAll(q));

/* ===== Estado económico y eventos ===== */
function giveMoney(player, amount, {taxable=true, reason=''}={}){
  if(!player || !Number.isFinite(amount)) return;
  player.money = Math.round((player.money||0) + amount);
  if (taxable && amount>0) player.taxBase = Math.round((player.taxBase||0) + amount);
  log(`${player.name} ${amount>=0? 'recibe':'paga'} ${fmtMoney(Math.abs(amount))}${reason? ' — '+reason:''}`);
  renderPlayers();
}
function transfer(from, to, amount, {taxable=false, reason=''}={}) {
  amount = Math.max(0, Math.floor(amount||0));
  if (amount <= 0) return;

  // Debitar
  if (from === Estado) {
    Estado.money = Math.max(0, Math.round((Estado.money||0) - amount));
  } else if (from) {
    giveMoney(from, -amount, {taxable, reason});
  }

  // Acreditar
  if (to === Estado) {
    Estado.money = Math.round((Estado.money||0) + amount);
  } else if (to) {
    giveMoney(to, amount, {taxable:false, reason});
  }

  renderPlayers?.();
}

// ==== IVA helpers (soportado y repercutido) ====
function ensureVAT(ent){
  if (!ent) return;
  ent.vatIn  = Math.max(0, Math.round(ent.vatIn  || 0));  // IVA soportado (pagado)
  ent.vatOut = Math.max(0, Math.round(ent.vatOut || 0));  // IVA repercutido (cobrado)
}
function markIVAPaid(who, amount, note=''){
  const a = Math.max(0, Math.round(amount||0));
  if (!who || !a) return;
  ensureVAT(who);
  who.vatIn += a;
  try { log(`IVA soportado +${fmtMoney(a)}${note} → ${(who.name||'Estado')}`); } catch {}
}
function markIVACharged(who, amount, note=''){
  const a = Math.max(0, Math.round(amount||0));
  if (!who || !a) return;
  ensureVAT(who);
  who.vatOut += a;
  try { log(`IVA repercutido +${fmtMoney(a)}${note} → ${(who.name||'Estado')}`); } catch {}
}

// Exponer a global
window.ensureVAT      = ensureVAT;
window.markIVAPaid    = markIVAPaid;
window.markIVACharged = markIVACharged;

function ensureAlive(player){
  if (!player || player===Estado) return;
  if (player.money >= 0) return;
  // Eliminación simple: todo al Estado
  player.alive = false;
  log(`☠️ ${player.name} queda eliminado por deuda.`);
  // Propiedades pasan al Estado, se limpian hipotecas
  TILES.forEach(t=>{
    if (t.type==='prop' && t.owner === player.id){
      t.owner = 'E';
      t.mortgaged = false;
      t.houses = 0; t.hotel = false;
    }
  });
  if (state.current === player.id) endTurn(); // pasa turno si el activo muere
  BoardUI.refreshTiles();
  renderPlayers();
}

/* ===== Panel de jugadores (incluye Estado) ===== */
function renderPlayers(){
  const wrap = $('#players'); if (!wrap) return;
  wrap.innerHTML = '';

  const COLORS = ['#ef4444','#22c55e','#3b82f6','#f59e0b','#a855f7','#14b8a6'];

  state.players.forEach(p=>{
    const b = document.createElement('div');
    b.className = 'badge player' + (p.id===state.current ? ' active' : '');
    const color = COLORS[p.id % COLORS.length];
    b.style.borderColor = color;
    b.innerHTML = `<span class="dot" style="background:${color}"></span>${p.name}: ${fmtMoney(p.money)}${p.alive?'':' (OUT)'}`;
    wrap.appendChild(b);
  });

  // Estado (banca) al final
  const e = document.createElement('div');
  e.className = 'badge state';
  e.textContent = `Estado: ${fmtMoney(Estado.money||0)}`;
  wrap.appendChild(e);

  // visible solo cuando hay partida
  wrap.style.display = state.players.length ? 'flex' : 'none';

  // [PATCH] Mostrar/ocultar botón Insider
  try {
    const insiderBtn = document.getElementById('insider');
    if (insiderBtn && window.GameRiskPlus?.Insider) {
      const canUse = GameRiskPlus.Insider.usable(state.current);
      insiderBtn.style.display = canUse ? '' : 'none';
      if (canUse) {
        const count = state._insider?.inventory?.[state.current] || 0;
        insiderBtn.textContent = `Insider (${count})`;
      }
    }
  } catch(e) { console.warn('Error updating insider button', e); }
}

/* ===== Dados (pips y animación) ===== */
function diceHTML(n){
  const spots = { 1:[5], 2:[1,9], 3:[1,5,9], 4:[1,3,7,9], 5:[1,3,5,7,9], 6:[1,3,4,6,7,9] };
  const cells = (spots[n]||[]).map(idx=>{
    const r = Math.ceil(idx/3), c = ((idx-1)%3)+1;
    return `<div class="pip" style="grid-row:${r};grid-column:${c}"></div>`;
  }).join('');
  return `<div class="die">${cells}</div>`;
}
function renderDice(d1, d2, meta=''){
  const d = $('#dice'); if(!d) return;
  d.innerHTML = `<div class="die shaker">${diceHTML(d1)}</div><div class="die shaker">${diceHTML(d2)}</div><div class="diceMeta">${meta}</div>`;
  setTimeout(()=> $$('#dice .die').forEach(el=>el.classList.remove('shaker')), 450);
}

/* ===== Nueva partida ===== */
function newGame(){
Estado.money = 0;
  const n = Math.max(2, Math.min(6, parseInt($('#numPlayers').value||'3',10)));
  const startMoney = Math.max(100, parseInt($('#startMoney').value||'500',10));

  state.players = Array.from({length:n},(_,i)=>({
    id:i, name:`J${i+1}`, money:startMoney, pos:0, alive:true,
    jail:0, taxBase:0, doubleStreak:0
  }));

  // v22: roles y casillas especiales
  if (window.Roles) {
    Roles.assign(state.players.map(p => ({ id: p.id, name: p.name })));

    // Activa banca corrupta y registra las 3 casillas (pon tus IDs)
    Roles.setBankCorrupt(true);
    Roles.registerCorruptBankTiles([12, 28, 42]);

    // Farmazixe con fentanilo (pon IDs de las farmacias)
    Roles.configureFentanyl({ tileIds: [62, 63], chance: 0.15, fee: 15 });
  }
  
  // dentro de newGame(), tras crear jugadores:
  state.players.forEach(p => { p.taxBase = 0; p.vatIn = 0; p.vatOut = 0; });
  Estado.vatIn = 0; Estado.vatOut = 0;

  state.current = 0; state.rolled = false; state.auction = null; state.pendingTile=null; state.lastRoll=0; state.turnCount = 0;
  state.usedTransportHop = false; // <- añade esto

  // Limpiar tablero económico
  TILES.forEach(t=>{
    if (t.type==='prop'){
      t.owner=null; t.houses=0; t.hotel=false; t.mortgaged=false;
      if (t.subtype==='fiore') t.workers = 0; // ← NUEVO
    }
  });

  // barajar especiales en cada nueva partida
  if (typeof window.randomizeSpecials === 'function') window.randomizeSpecials();

  if (typeof applySavedPropNames === 'function') applySavedPropNames(); // ← aquí

  BoardUI.attach({ tiles:TILES, state });
  BoardUI.renderBoard();
  renderPlayers();
  $('#log').innerHTML = '';
  log('Nueva partida creada.');
  updateTurnButtons();
  document.body.classList.add('playing');   // <- esto debe estar
  renderPlayers(); // asegúrate de llamarlo después de setear el estado
}
document.addEventListener('DOMContentLoaded', ()=>{
  $('#newGame')?.addEventListener('click', newGame);
  renderPlayers();
});

function updateTurnButtons() {
  const rollBtn = document.getElementById('roll');
  const endTurnBtn = document.getElementById('endTurn');
  // Only hide/show these two buttons!
  if (state.auction && state.auction.open) {
    if (rollBtn) rollBtn.style.display = 'none';
    if (endTurnBtn) endTurnBtn.style.display = 'none';
    return;
  }
  if (rollBtn) rollBtn.style.display = state.rolled ? 'none' : '';
  if (endTurnBtn) endTurnBtn.style.display = state.rolled ? '' : 'none';
}

/* Exponer lo necesario:
   — giveMoney / transfer / ensureAlive / renderPlayers / newGame
   — renderDice si otras partes lo quisieran usar
*/
window.renderPlayers = renderPlayers;
window.giveMoney     = giveMoney;
window.transfer      = transfer;
window.ensureAlive   = ensureAlive;
window.renderDice    = renderDice;
window.newGame       = newGame;
// <- FIN DE ARCHIVO