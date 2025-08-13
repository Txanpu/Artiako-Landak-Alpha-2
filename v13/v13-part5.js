/* v13 – Parte 5/7: dados, movimiento, SALIDA, turnos */

function nextAlive(from){
  const n = state.players.length; if(!n) return 0;
  for (let k=1;k<=n;k++){
    const idx = (from + k) % n;
    if (state.players[idx].alive) return idx;
  }
  return from;
}

function movePlayer(p, steps){
  if(!p.alive) return;
  const total = TILES.length;
  let old = p.pos;
  let np = old + steps;
  // pasar por salida
  while (np >= total){
    np -= total;
    giveMoney(p, 200, {reason:'SALIDA', taxable:true});
  }
  p.pos = np;
  BoardUI.refreshTiles();
  log(`${p.name} avanza ${steps} hasta #${np} (${TILES[np].name || TILES[np].type})`);
  onLand(p, np);
}

function roll(){
  const p = state.players[state.current]; if(!p || !p.alive) return;
  if (state.rolled){ log('Ya has tirado este turno.'); return; }
  if (p.jail>0){
    p.jail--;
    log(`${p.name} está en la cárcel (${p.jail} turnos restantes).`);
    state.rolled = true; renderPlayers(); return;
  }

  const d1 = 1+Math.floor(Math.random()*6);
  const d2 = 1+Math.floor(Math.random()*6);
  const sum = d1 + d2;
  state.lastRoll = sum;
  renderDice(d1,d2, `Total: ${sum}${d1===d2?' — Dobles':''}`);

  movePlayer(p, sum);
  state.rolled = true;

  // si dobles, permitir un segundo movimiento automático tras End Turn? aquí solo informamos
  if (d1===d2){
    $('#doubleOverlay')?.setAttribute('aria-hidden','false');
    $('#doubleOverlay').style.display='block';
    setTimeout(()=>{ $('#doubleOverlay').style.display='none'; }, 900);
  }
}

function endTurn(){
  state.rolled = false;
  state.current = nextAlive(state.current);
  renderPlayers();
  log(`— Turno de ${state.players[state.current].name} —`);
}

document.addEventListener('DOMContentLoaded', ()=>{
  $('#roll')?.addEventListener('click', roll);
  $('#endTurn')?.addEventListener('click', endTurn);
});
