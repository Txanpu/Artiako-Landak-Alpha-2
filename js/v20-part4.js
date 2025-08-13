'use strict';

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

function updatePropertyButtons(){
  const buildBtn = document.getElementById('build');
  const sellBtn = document.getElementById('sell');
  const unmortgageBtn = document.getElementById('unmortgage');
  const p = state.players[state.current];

  const hideAll = ()=>{
    if (buildBtn) buildBtn.style.display = 'none';
    if (sellBtn) sellBtn.style.display = 'none';
    if (unmortgageBtn) unmortgageBtn.style.display = 'none';
  };
  if (!p){ hideAll(); return; }

  const idx = state.pendingTile ?? p.pos;
  const t = TILES[idx];

  let canBuild = false;
  try{
    const baseCost  = t?.houseCost ?? Math.round((t?.price||0)*0.5);
    const costNoIVA = Math.max(1, Math.round(baseCost * (state.buildEventMul||1)));
    const finalCost = Math.max(1, Math.round(costNoIVA * (state.buildIVAMul||1)));
    canBuild = isNormalProp?.(t) && t.owner===p.id && !t.mortgaged
      && ownsFullGroup?.(p,t) && canBuildEven?.(t,p) && !t.hotel
      && ((t.houses<4 && (BANK.housesAvail||0)>0) || (t.houses===4 && (BANK.hotelsAvail||0)>0))
      && (p.money||0) >= finalCost
      && (state.blockBuildTurns||0) <= 0;
  } catch{}
  if (buildBtn) buildBtn.style.display = canBuild ? '' : 'none';

  let canSell = false;
  try{
    canSell = isNormalProp?.(t) && t.owner===p.id && (t.hotel || t.houses>0)
      && canSellEven?.(t,p);
  } catch{}
  if (sellBtn) sellBtn.style.display = canSell ? '' : 'none';

  let canUnmortgage = false;
  try{
    for (const tile of TILES){
      if (tile.type!=='prop' || tile.owner!==p.id || !tile.mortgaged) continue;
      const base = tile.mortgagePrincipal ?? Math.round((tile.price||0) * (state.mortgagePct ?? 0.50));
      const cost = Math.round(base * (1 + (state.mortgageFeePct ?? 0.10)));
      if ((p.money||0) >= cost){ canUnmortgage = true; break; }
    }
  } catch{}
  if (unmortgageBtn) unmortgageBtn.style.display = canUnmortgage ? '' : 'none';
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
    b.innerHTML = `<span class="dot" style="background:${color}"></span>${p.name}: <span class="money">${fmtMoney(p.money)}</span>${p.alive?'':' (OUT)'}`;
    wrap.appendChild(b);
  });

  // Estado (banca) al final
  const e = document.createElement('div');
  e.className = 'badge state';
  e.innerHTML = `Estado: <span class="money">${fmtMoney(Estado.money||0)}</span>`;
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

  try { updatePropertyButtons(); } catch(e){ console.warn('Error updating property buttons', e); }
}

/* ===== Dados (pips y animación) ===== */
function diceHTML(n){
  const spots = { 1:[5], 2:[1,9], 3:[1,5,9], 4:[1,3,7,9], 5:[1,3,5,7,9], 6:[1,3,4,6,7,9] };
  if (!spots[n]) {
    return `<div class="die num">${n}</div>`;
  }
  const cells = spots[n].map(idx=>{
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
  let humans = Math.max(0, Math.min(6, parseInt($('#numHumans').value||'2',10)));
  let bots   = Math.max(0, Math.min(6, parseInt($('#numBots').value||'0',10)));
  let total  = humans + bots;
  if (total < 2){ bots = Math.max(0, 2 - humans); total = humans + bots; }
  if (total > 6){ bots = Math.max(0, 6 - humans); total = humans + bots; }
  const startMoney = Math.max(100, parseInt($('#startMoney').value||'500',10));

  state.players = [];
  for (let i=0;i<humans;i++){
    state.players.push({ id: state.players.length, name:`J${i+1}`, money:startMoney, pos:0, alive:true,
      jail:0, taxBase:0, doubleStreak:0 });
  }
  for (let i=0;i<bots;i++){
    state.players.push({ id: state.players.length, name:`Bot${i+1}`, money:startMoney, pos:0, alive:true,
      jail:0, taxBase:0, doubleStreak:0, isBot:true });
  }

  // v22: roles y casillas especiales
  if (window.Roles) {
    Roles.assign(state.players.map(p => ({ id: p.id, name: p.name })));

    // Activa banca corrupta y registra casillas equidistantes
    Roles.setBankCorrupt(true);
    Roles.registerCorruptBankTiles(window.CORRUPT_BANK_TILE_IDS || []);

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
  document.body.classList.add('playing');   // <- esto debe estar

  BoardUI.attach({ tiles:TILES, state });
  BoardUI.renderBoard();
  renderPlayers();
  $('#log').innerHTML = '';
  log('Nueva partida creada.');
  updateTurnButtons();
  if (state.players[state.current]?.isBot) botAutoPlay?.();
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