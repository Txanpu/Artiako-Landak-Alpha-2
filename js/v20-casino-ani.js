
// v20-casino-anim.js — Animaciones para Blackjack y Ruleta
// Cárgalo DESPUÉS de v20-part6.js. No toca tu economía; sólo UI/animación.

(function(){
  'use strict';

  const state    = (window.state    ||= {});
  const log      = window.log       || function(){ console.log.apply(console, arguments); };
  const transfer = window.transfer  || function(){};
  const ensureAlive = window.ensureAlive || function(){};
  const fmt      = window.fmtMoney  || (n => (n|0)+'€');

  // ===== CSS inyectado =====
  (function injectCSS(){
    const css = document.createElement('style');
    css.textContent = `
      #doubleOverlay.casino { align-items:center; justify-content:center; backdrop-filter: blur(2px); }
      .casinoBox{ width:min(680px,92vw); background:#0b1220; border:1px solid #334155; border-radius:16px; padding:16px; box-shadow:0 12px 32px rgba(0,0,0,.4); }
      .casinoHead{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px }
      .casinoHead .title{ font-weight:800; font-size:20px }
      .casinoHead .close{ background:#111827; border:1px solid #374151; color:#e5e7eb; border-radius:10px; padding:6px 10px; cursor:pointer }
      .muted{ color:#94a3b8; font-size:.9rem }

      /* Blackjack */
      .bjRows{ display:grid; gap:10px; margin-top:6px }
      .bjRow{ position:relative; display:flex; align-items:center; gap:10px; padding:10px; border:1px solid #1f2937; border-radius:12px; background:#0a1222; }
      .bjRow.dealer{ background:linear-gradient(180deg,#0a1222,#101a2e) }
      .bjName{ min-width:120px; font-weight:700 }
      .bjCards{ display:flex; gap:8px; flex-wrap:wrap; perspective:600px }
      .card{ width:46px; height:64px; border-radius:8px; background:#f8fafc; color:#0f172a; display:flex; align-items:center; justify-content:center; font-weight:800; border:2px solid #0f172a20; transform: translateY(-12px) rotateY(90deg) scale(.92); opacity:0; transform-style:preserve-3d; backface-visibility:hidden }
      .card.in{ transition: transform .35s ease, opacity .35s ease; transform: translateY(0) rotateY(0deg) scale(1); opacity:1 }
      .total{ margin-left:auto; font-weight:800 }
      .win{ outline:2px solid #22c55e; box-shadow:0 0 0 4px #22c55e25; }
      .lose{ outline:2px solid #ef4444; box-shadow:0 0 0 4px #ef444425; }
      @keyframes pulseWin { 0%{box-shadow:0 0 0 0 rgba(34,197,94,.45)} 100%{box-shadow:0 0 0 22px rgba(34,197,94,0)} }
      .win .bjName::after{ content:'✓'; margin-left:6px; color:#22c55e; animation:pulseWin 1s ease-out 2; }

      /* Ruleta */
      .rouletteWrap{ display:grid; grid-template-columns:180px 1fr; gap:16px; align-items:center; }
      .wheelBox{ position:relative; width:180px; height:180px; }
      .wheel{ position:absolute; inset:0; border-radius:50%; border:4px solid #111827;
              background: conic-gradient(#16a34a 0 10deg, #ef4444 10deg 190deg, #111827 190deg 200deg, #ef4444 200deg 380deg); }
      .wheel.spin{ animation: spin 1.8s cubic-bezier(.2,.8,.2,1) forwards }
      @keyframes spin{ to{ transform:rotate(900deg) } }
      .ball{ position:absolute; left:50%; top:10px; width:14px; height:14px; margin-left:-7px; background:#e5e7eb; border-radius:50%; box-shadow:0 2px 6px rgba(0,0,0,.35) }
      .ball.spin{ animation: ball 1.8s cubic-bezier(.2,.8,.2,1) forwards }
      @keyframes ball{ to{ transform: rotate(-1260deg) translateY(70px) } }
      .pin{ position:absolute; left:50%; top:-8px; width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-bottom:10px solid #fbbf24; transform:translateX(-50%) }
      .ruInfo{ display:flex; flex-direction:column; gap:10px }
      .outcome{ font-size:26px; font-weight:900 }
      .outcome.red{ color:#ef4444 } .outcome.black{ color:#e5e7eb } .outcome.green{ color:#22c55e }
      .small{ font-size:.95rem; color:#94a3b8 }
      .btn{ background:#111827; border:1px solid #374151; color:#e5e7eb; border-radius:10px; padding:8px 10px; cursor:pointer }
    `;
    document.head.appendChild(css);
  })();

  function overlay(){ return document.getElementById('doubleOverlay'); }
  function ovShow(html){
    const ov = overlay();
    if (!ov) { alert('Falta #doubleOverlay'); return null; }
    ov.classList.add('casino');
    ov.innerHTML = html;
    ov.style.display = 'flex';
    return ov;
  }
  function ovHide(){
    const ov = overlay();
    if (ov){ ov.style.display = 'none'; ov.classList.remove('casino'); }
  }
  const sleep = ms => new Promise(r=>setTimeout(r,ms));

  // === Util: reparte cartas "bonitas" a partir de un total aproximado
  function fakeCardsFor(total){
    // produce 2-3 cartas que suman ~ total (sin "figuras" reales).
    const cards = [];
    let remain = Math.max(4, total|0);
    while (remain > 10){
      const v = Math.min(10, 4 + Math.floor(Math.random()*7)); // 4..10
      cards.push(v); remain -= v;
    }
    cards.push(Math.max(2, Math.min(11, remain)));
    return cards.slice(0,3);
  }

  // === Blackjack con animación
  window.playBlackjack = async function(player, owner, tile){
    if (!owner || owner.alive === false){ log('El dueño no puede actuar.'); return; }
    if (window.Roles && Roles.isPowerOff && Roles.isPowerOff()) {
      alert('Apagón nacional: casino cerrado por 2 ticks');
      return;
    }

    // Misma lógica base que tu función original (sorteos y pagos)
    const players = (state.players||[]).filter(x=>x.alive && x.id!==owner.id);
    const draw = (min,max)=> min + Math.floor(Math.random()*(max-min+1));
    const dealer = draw(17,23);
    const results = players.map(pl=>{
      const me = draw(15,23);
      let dealerWins = (dealer<=21) && (me>21 || dealer>=me);

      try {
        if (window.Roles?.is?.(pl.id,'proxeneta')) {
          const wantWin = window.Roles.decideWin(0.5, pl, 'blackjack'); // aprox 50% base
          if (wantWin && dealerWins) dealerWins = false;
        }
      } catch {}

      return { pl, me, dealerWins };
    });
    const dealerAllWin = results.every(r=>r.dealerWins);

    // UI
    const ov = ovShow(`
      <div class="casinoBox">
        <div class="casinoHead">
          <div class="title">♠️ Blackjack — ${tile?.name || 'Casino'}</div>
          <button class="close" data-x>Salir</button>
        </div>
        <div class="muted">Reparte ${owner?.name || 'Dealer'} · pagos: dealer gana → todos pagan 30; gana jugador → cobra 15.</div>
        <div class="bjRows" id="bjRows"></div>
      </div>
    `);
    if (!ov) return;
    ov.querySelector('[data-x]')?.addEventListener('click', ovHide);

    const rows = document.getElementById('bjRows');

    // Dealer primero
    const dRow = document.createElement('div');
    dRow.className = 'bjRow dealer';
    dRow.innerHTML = `<div class="bjName">Dealer (${owner?.name || 'Dueño'})</div><div class="bjCards"></div><div class="total">0</div>`;
    rows.appendChild(dRow);
    await sleep(200);

    const dCards = fakeCardsFor(dealer);
    let dSum = 0;
    for (const v of dCards){
      const c = document.createElement('div'); c.className='card'; c.textContent=String(v);
      dRow.querySelector('.bjCards').appendChild(c);
      await sleep(40); c.classList.add('in'); dSum += v;
      dRow.querySelector('.total').textContent = String(dSum);
      await sleep(160);
    }

    // Jugadores
    for (const r of results){
      const row = document.createElement('div');
      row.className = 'bjRow';
      row.innerHTML = `<div class="bjName">${r.pl.name}</div><div class="bjCards"></div><div class="total">0</div>`;
      rows.appendChild(row);
      await sleep(120);

      const cards = fakeCardsFor(r.me);
      let sum = 0;
      for (const v of cards){
        const c = document.createElement('div'); c.className='card'; c.textContent=String(v);
        row.querySelector('.bjCards').appendChild(c);
        await sleep(40); c.classList.add('in'); sum += v;
        row.querySelector('.total').textContent = String(sum);
        await sleep(140);
      }
      if (r.dealerWins) row.classList.add('lose'); else row.classList.add('win');
    }

    // Resumen y pagos
    await sleep(400);
    if (dealerAllWin){
      for (const {pl} of results){ transfer(pl, owner, 30, {taxable:false, reason:`Casino Blackjack en ${tile?.name||'Casino'}`}); }
      log(`🎰 Dealer (${owner?.name||'Dueño'}) gana. Todos pagan 30.`);
    } else {
      const winners = results.filter(r=>!r.dealerWins).map(r=>r.pl);
      for (const w of winners){ transfer(owner, w, 15, {taxable:false, reason:`Casino Blackjack en ${tile?.name||'Casino'}`}); }
      log(`🎰 Ganan jugadores: ${results.filter(r=>!r.dealerWins).map(r=>r.pl.name).join(', ')||'ninguno'}. ${owner?.name||'Dueño'} paga 15 a cada ganador.`);
    }
    await sleep(900);
    ovHide();
  };

  // === Ruleta con animación
  window.playRoulette = async function(player, owner, tile){
    if (!owner || owner.alive === false){ log('El dueño no puede actuar.'); return; }
    if (window.Roles && Roles.isPowerOff && Roles.isPowerOff()) {
      alert('Apagón nacional: casino cerrado por 2 ticks');
      return;
    }
    const apuesta = prompt('Apuesta color (rojo/negro/verde) y cantidad. Ej: "rojo 50"');
    if(!apuesta) return;
    const m = apuesta.trim().toLowerCase().match(/(rojo|negro|verde)\s+(\d+)/);
    if(!m){ alert('Formato inválido'); return; }
    const color = m[1], amt = Math.max(1, parseInt(m[2],10));
    if ((player.money|0) < amt){ alert('No te llega.'); return; }

    // Sorteo (idéntico a tu lógica base)
    const reds = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
    let n = Math.floor(Math.random()*37); // 0..36
    let outcome = (n===0)?'verde':(reds.has(n)?'rojo':'negro');

    try {
      if (window.Roles?.is?.(player.id, 'proxeneta')) {
        const baseP = (color==='verde') ? (1/37) : (18/37);
        const wantWin = window.Roles.decideWin(baseP, player, 'roulette');
        const winsNow = (color === outcome);
        if (wantWin && !winsNow) {
          // fuerza victoria coherente con el color
          outcome = color;
          n = (color==='verde') ? 0 :
              (color==='rojo' ? 1 : 2); // número dummy para el log
        }
      }
    } catch {}

    const mult = (color==='verde')?35:1;

    // UI
    const ov = ovShow(`
      <div class="casinoBox">
        <div class="casinoHead">
          <div class="title">🎯 Ruleta — ${tile?.name || 'Casino'}</div>
          <button class="close" data-x>Salir</button>
        </div>
        <div class="rouletteWrap">
          <div class="wheelBox">
            <div class="pin"></div>
            <div class="wheel" id="wheel"></div>
            <div class="ball" id="ball"></div>
          </div>
          <div class="ruInfo">
            <div class="muted">Apuesta de ${player?.name || 'Jugador'}: <b>${color}</b> por <b>${fmt(amt)}</b></div>
            <div class="outcome small">Girando…</div>
            <div class="muted">Pagos: rojo/negro 1:1 · verde 35:1</div>
            <button class="btn" data-x>Cerrar</button>
          </div>
        </div>
      </div>
    `);
    if (!ov) return;
    ov.querySelectorAll('[data-x]').forEach(b=>b.addEventListener('click', ovHide));

    // Animación de giro
    const wheel = document.getElementById('wheel');
    const ball  = document.getElementById('ball');
    wheel.classList.add('spin');
    ball.classList.add('spin');
    const outEl = ov.querySelector('.outcome');
    await sleep(1850);

    outEl.textContent = `Sale ${n} — ${outcome.toUpperCase()}`;
    outEl.classList.add(outcome==='rojo'?'red':outcome==='negro'?'black':'green');

    // Pagos
    if (color === outcome){
      transfer(owner, player, amt*mult, {taxable:false, reason:`Ruleta (${outcome}) en ${tile?.name||'Casino'}`});
      log(`🎯 Ruleta: ${n} ${outcome}. Gana ${player?.name||'Jugador'} → cobra ${fmt(amt*mult)}.`);
    } else {
      transfer(player, owner, amt, {taxable:false, reason:`Ruleta (${outcome}) en ${tile?.name||'Casino'}`});
      ensureAlive(player);
      log(`🎯 Ruleta: ${n} ${outcome}. Pierde ${player?.name||'Jugador'} → paga ${fmt(amt)}.`);
    }

    await sleep(900);
    ovHide();
  };

})();
