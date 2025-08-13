/* v13 – Parte 4/7: setup, panel jugadores, utilidades de dinero */

/* ===== Helpers de UI ===== */
const $ = (q)=>document.querySelector(q);
const $$= (q)=>Array.from(document.querySelectorAll(q));

/* ===== Estado económico y eventos ===== */
function giveMoney(player, amount, {taxable=true, reason=''}={}){
  if(!player || !Number.isFinite(amount)) return;
  player.money = Math.round((player.money||0) + amount);
  if (taxable && amount>0) player.taxBase = Math.round((player.taxBase||0) + amount);
  log(`${player.name} ${amount>=0? 'recibe':'paga'} ${fmtMoney(Math.abs(amount))}${reason? ' — '+reason:''}`);
  renderPlayers();
}
function transfer(from, to, amount, opts={}){
  if(!from||!to) return;
  giveMoney(from, -amount, opts);
  giveMoney(to, amount, opts);
}

function ensureAlive(player){
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

/* ===== Panel de jugadores ===== */
function renderPlayers(){
  const wrap = $('#players'); if (!wrap) return;
  wrap.innerHTML = '';
  state.players.forEach(p=>{
    const b = document.createElement('div');
    b.className = 'badge' + (p.id===state.current ? ' active' : '');
    b.textContent = `${p.name}: ${fmtMoney(p.money)}${p.alive?'':' (OUT)'}`;
    wrap.appendChild(b);
  });
}

/* ===== Dados (pips y animación) ===== */
function diceHTML(n){
  const p = (i)=>`<div class="pip" style="grid-area:${i}"></div>`;
  // áreas 1..9
  const spots = {
    1:[5],
    2:[1,9],
    3:[1,5,9],
    4:[1,3,7,9],
    5:[1,3,5,7,9],
    6:[1,3,4,6,7,9]
  };
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
  const n = Math.max(2, Math.min(6, parseInt($('#numPlayers').value||'3',10)));
  const startMoney = Math.max(100, parseInt($('#startMoney').value||'500',10));

  state.players = Array.from({length:n},(_,i)=>({
    id:i, name:`J${i+1}`, money:startMoney, pos:0, alive:true, jail:0, taxBase:0
  }));
  state.current = 0; state.rolled = false; state.auction = null; state.pendingTile=null; state.lastRoll=0;

  // Limpiar tablero económico
  TILES.forEach(t=>{
    if (t.type==='prop'){ t.owner=null; t.houses=0; t.hotel=false; t.mortgaged=false; }
  });

  BoardUI.attach({ tiles:TILES, state });
  BoardUI.renderBoard();
  renderPlayers();
  $('#log').innerHTML = '';
  log('Nueva partida creada.');
}
document.addEventListener('DOMContentLoaded', ()=>{
  $('#newGame')?.addEventListener('click', newGame);
  renderPlayers();
});
