/* v13 – Parte 6/7: efectos al caer y sistema de subastas */

function onLand(p, idx){
  const t = TILES[idx];
  if (!t) return;

  switch(t.type){
    case 'start':
      log(`${p.name} descansa en SALIDA.`);
      break;

    case 'tax': {
      const base = Math.max(0, Math.round((p.taxBase||0) * 0.03));
      if (base>0){
        transfer(p, Estado, base, {taxable:false, reason:'Impuesto 3% (ganancias acumuladas)'});
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
      p.jail = 2; // dos turnos sin tirar
      BoardUI.refreshTiles();
      log(`🚔 ${p.name} va a la cárcel (2 turnos).`);
      break;

    case 'park':
      log(`${p.name} se relaja en el parque.`);
      break;

    case 'prop': {
      if (t.owner === null){
        // propiedad libre → posibilidad de subasta
        showCard(idx, { canAuction:true });
        startAuctionFlow(idx);
      } else if (t.owner === 'E'){
        // propiedad del Estado: no cobra alquiler
        log(`${p.name} cae en propiedad del Estado. No hay alquiler.`);
      } else if (t.owner === p.id){
        log(`${p.name} cae en su propia propiedad.`);
      } else {
        // pagar alquiler
        const due = getRent(t);
        const owner = state.players[t.owner];
        if (due>0 && owner && owner.alive){
          transfer(p, owner, due, {taxable:false, reason:`Alquiler en ${t.name}`});
          ensureAlive(p);
        } else {
          log(`${p.name} no paga alquiler (hipoteca o sin dueño válido).`);
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
  if (t.owner !== null || t.type!=='prop'){ return; }

  const box = $('#auction');
  state.auction = {
    tile: tileIndex,
    price: Math.max(1, t.price||1),
    bestBid: 0,
    bestPlayer: null,
    active: new Set(state.players.filter(x=>x.alive).map(x=>x.id)),
    open: true
  };

  box.style.display = 'block';
  drawAuction();

  $('#startAuction')?.addEventListener('click', ()=>{
    overlay.style.display='none';
  }, { once:true });
  $('#cancelAuction')?.addEventListener('click', ()=>{
    // cerrar carta, pero subasta continúa visible
    overlay.style.display='none';
  }, { once:true });
}

function drawAuction(){
  const a = state.auction; const box = $('#auction'); if(!a||!box) return;
  const t = TILES[a.tile];
  const players = state.players.filter(p=>a.active.has(p.id));

  box.innerHTML = `
    <strong>Subasta: ${t.name}</strong> — Valor: ${fmtMoney(t.price)}<br>
    Mejor puja: <b>${a.bestPlayer!=null? state.players[a.bestPlayer].name : '-'}</b> por <b>${fmtMoney(a.bestBid)}</b>
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
      <button id="closeAuction">Cerrar subasta</button>
      <button id="awardAuction" class="primary">Adjudicar</button>
    </div>
  `;

  box.querySelectorAll('button[data-act="bid"]').forEach(btn=>{
    btn.onclick = ()=>{
      const pid = parseInt(btn.getAttribute('data-p'),10);
      const step= parseInt(btn.getAttribute('data-step'),10);
      if (!a.active.has(pid)) return;
      const p = state.players[pid];
      const nextBid = Math.max(a.bestBid + step, step);
      if (p.money < nextBid){ log(`${p.name} no puede pujar ${fmtMoney(nextBid)}.`); return; }
      a.bestBid = nextBid; a.bestPlayer = pid;
      drawAuction();
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

  $('#closeAuction').onclick = ()=>{
    box.style.display='none';
    state.auction = null;
  };
  $('#awardAuction').onclick = ()=>{
    if (a.bestPlayer==null){ log('No hay pujas. Subasta desierta.'); return; }
    awardAuction();
  };
}

function awardAuction(){
  const a = state.auction; if(!a) return;
  const t = TILES[a.tile];
  const buyer = state.players[a.bestPlayer];
  const price = a.bestBid;
  if (!buyer.alive || buyer.money < price){ log('Adjudicación fallida.'); return; }

  transfer(buyer, Estado, price, {taxable:false, reason:`Compra en subasta: ${t.name}`});
  t.owner = buyer.id;
  $('#auction').style.display='none';
  state.auction = null;
  BoardUI.refreshTiles();
  renderPlayers();
}

