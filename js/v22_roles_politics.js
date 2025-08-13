/*
 * v22-roles-politics.js
 * Add-on de roles ocultos, banca corrupta, gobierno, juez IA y dados 0–9 opcional.
 * Integración no intrusiva: expone API en window.Roles. No toca tu core si no llamas a los hooks.
 *
 * —— Integración mínima sugerida ——
 * 1) Al iniciar partida o cargar jugadores: Roles.assign(playersArray)
 *    - playersArray: [{id, name}, ...]
 * 2) En cada juego de azar cuando decidas el resultado:
 *    - const win = Roles.decideWin(baseWinProb, player, gameType)
 *      gameType ∈ {"slots","roulette","blackjack","greyhounds"}
 * 3) Cuando alguien paga en una casilla FIORE:
 *    - Roles.onFiorePayment({payerId, amount})
 *      (el dueño cobra como siempre en tu core; aquí solo gestionamos propinas del Proxeneta)
 * 4) Impuestos:
 *    - Roles.onTaxCollected(amount)
 *    - Cuando un jugador cae en casilla de impuesto: Roles.onTaxTileLanding(playerId)
 * 5) Trades y préstamos:
 *    - const forced = Roles.maybeForceTradeAcceptance({initiatorId, counterpartyId})
 *      (si forced===true, procede el trade aunque la otra parte dijera NO; se descuenta uso de Florentino)
 *    - const adj = Roles.adjustLoanTerms({playerId, baseRate, baseLTV})
 *      => {rate, LTV}
 * 6) Juez IA (impugnación):
 *    - const res = Roles.challengeDeal({byId, fee=undefined, imbalance=0})
 *      => {annulled:boolean, feeCharged:number, pNoAnnul:number}
 * 7) Gobierno:
 *    - Llama Roles.tickTurn() al cerrar cada turno.
 *    - Para fijar resultado de votación: Roles.setGovernment('left'|'right')
 *    - Multiplicadores disponibles: Roles.getTaxMultiplier(), Roles.getWelfareMultiplier(), Roles.getInterestMultiplier()
 * 8) Dados 0–9 (sin romper lo actual):
 *    - Si activas window.RolesConfig.dice0to9=true, puedes usar Roles.rollDie0to9() por dado.
 *    - Tras tirar dos dados d1,d2: const act = Roles.handleDiceSpecials({d1,d2,playerId})
 *      => {repeatTile?:true, gotoNearestFiore?:true}
 *
 * —— Config por defecto (puedes sobreescribir window.RolesConfig ANTES de cargar este script) ——
 *   winTarget:0.70, fioreTipMin:0.05, fioreTipMax:0.25,
 *   florentinoForceP:0.13, florentinoForceMax:5,
 *   judgeFee:50, judgeNoAnnulFloor:0.33,
 *   govPeriod:8, govDuration:8,
 *   govLeft:{tax:0.25, interest:0.10, welfare:0.30},
 *   govRight:{tax:-0.20, welfare:-0.30, interest:0},
 *   dice0to9:false,
 *   ui:{banner:true}
 */
(function(){
  'use strict';

  const R = {};
  const ROLE = {
    PROXENETA: 'proxeneta',
    FLORENTINO: 'florentino',
    FBI: 'fbi',
    CIVIL: 'civil'
  };

  const defaultConfig = {$1dice0to9: false,
    securiAdvance: 150,
    securiTicks: 3,
    bankMaxTicks: 30,
    ui: { banner: true }
  };

  const cfg = window.RolesConfig = Object.assign({}, defaultConfig, window.RolesConfig||{});

  // Estado interno
  const state = {
    players: [],
    assignments: new Map(), // playerId -> ROLE.*
    fbiGuesses: new Map(),   // fbiId -> Map<targetId, guessedRole>
    fbiAllKnownReady: false,
    taxPot: 0,
    florentinoUsesLeft: new Map(), // playerId -> remaining
    bankCorrupt: false,
    turnCounter: 0,
    government: null, // 'left'|'right'|null
    governmentTurnsLeft: 0,$1loans: [],
    securitizations: new Map(),
    powerOffTicks: 0,
    strikeTicks: 0,
    estadoAuctionBlocked: false,
    embargoes: new Map(),
    fbiDieEditsLeft: new Map(),
    fbiTaxBoostChargesLeft: new Map(),
    // efectos y estados
    fentanyl: { tiles: new Set(), chance: 0.15, fee: 15 },
    statuses: new Map(), // playerId -> { fentanyl?: { tileId, fee, active:true } }
    pendingPayments: [],
    pendingMoves: []
  };

  // Utilidades
  const rand = {
    pick(a){ return a[Math.floor(Math.random()*a.length)] },
    int(min, max){ return Math.floor(Math.random()*(max-min+1))+min },
    real(min, max){ return Math.random()*(max-min)+min },
    chance(p){ return Math.random() < p }
  };

  function playerById(id){ return state.players.find(p=> (p.id===id || p===id)); }
  function roleOf(id){ return state.assignments.get(id) || ROLE.CIVIL; }
  function setRole(id, role){ state.assignments.set(id, role); }

  function normalizeRoleGuess(x){
    if(x && typeof x === 'object' && Object.values(ROLE).includes(x)) return x;
    if(x==null) return null;
    const s = String(x).toLowerCase().trim();
    if(s==='proxeneta') return ROLE.PROXENETA;
    if(s==='florentino' || s==='florentino perez' || s==='florentino pérez') return ROLE.FLORENTINO;
    if(s==='fbi') return ROLE.FBI;
    if(s==='civil' || s==='ninguno' || s==='ningún' || s==='ningun' || s==='none' || s==='no role' || s==='sin rol' || s==='ningun rol' || s==='ningún rol') return ROLE.CIVIL;
    return x;
  }

  function normalizeRate(r){
    let x = Number(r||0);
    if(x>1) x = x/100; // permitir porcentaje tipo 20 => 0.20
    x = Math.max(0, x);
    return x;
  }

  function ensureFlorentinoUses(){
    state.players.forEach(p=>{
      if(roleOf(p.id)===ROLE.FLORENTINO && !state.florentinoUsesLeft.has(p.id)){
        state.florentinoUsesLeft.set(p.id, cfg.florentinoForceMax);
      }
      if(roleOf(p.id)!==ROLE.FLORENTINO){
        state.florentinoUsesLeft.delete(p.id);
      }
    });
  }

  // —— Asignación de roles ——
  R.assign = function(players){
    state.players = (players||[]).map(p=> ({id: p.id, name: p.name||('P'+p.id)}));
    state.assignments.clear();
    state.fbiGuesses.clear();
    state.taxPot = 0;
    state.fbiAllKnownReady = false;

    const roleP = Math.max(0, Math.min(1, cfg.roleProbability||0.20));
    const available = [ROLE.PROXENETA, ROLE.FLORENTINO, ROLE.FBI];
    state.players.forEach(p=>{
      let r = ROLE.CIVIL;
      if(rand.chance(roleP) && available.length){
        const idx = Math.floor(Math.random() * available.length);
        r = available.splice(idx,1)[0];
      }
      setRole(p.id, r);
    });

    ensureFlorentinoUses();
    saveState();
    uiUpdate();
  };

  R.get = function(player){ const id = (player&&player.id)||player; return roleOf(id); };
  R.is = function(player, role){ return R.get(player)===role; };

  R.reshuffle = function(){
    const players = [...state.players];
    R.assign(players);
    state.fbiAllKnownReady = false;
    state.fbiGuesses.clear();
    saveState();
    uiLog('🔀 Rehacer roles');
  };

  R.debugPeek = function(){
    const obj = {};
    state.players.forEach(p=>{ obj[p.name||p.id] = roleOf(p.id); });
    console.table(obj);
    return obj;
  };

  // —— Azar: decisión de victoria con rol Proxeneta ——
  // baseWinProb: probabilidad base [0,1] que tenía tu juego. gameType informativo.
  R.decideWin = function(baseWinProb, player, gameType){
    const id = (player&&player.id)||player;
    let p = baseWinProb;
    if(roleOf(id)===ROLE.PROXENETA){ p = Math.max(p, cfg.winTarget); }
    return rand.chance(p);
  };

  // —— FIORE: propina aleatoria al Proxeneta ——
  R.onFiorePayment = function({payerId, amount}){
    if(!amount || amount<=0) return {tips: []};
    const proxenetas = state.players.filter(p=> roleOf(p.id)===ROLE.PROXENETA);
    if(proxenetas.length===0) return {tips: []};
    const tipRate = rand.real(cfg.fioreTipMin, cfg.fioreTipMax);
    const tipTotal = Math.max(0, Math.round(amount * tipRate));
    if(tipTotal<=0) return {tips: []};
    const recipients = proxenetas; // si hay más de uno, repartir equitativamente
    const per = Math.floor(tipTotal / recipients.length);
    const tips = recipients.map(r=> ({toId:r.id, amount:per}));
    // si sobra por división, dárselo al primero
    const rem = tipTotal - per*recipients.length;
    if(rem>0) tips[0].amount += rem;
    uiLog(`💸 Propina FIORE: ${tipTotal} (→ ${recipients.length} proxeneta/s)`);
    return {tips, tipRate};
  };

  // —— Impuestos & FBI ——
  R.onTaxCollected = function(amount){
    if(amount>0){ state.taxPot += amount; saveState(); uiUpdate(); }
    return state.taxPot;
  };

  R.onTaxTileLanding = function(player){
    const id = (player&&player.id)||player;
    if(roleOf(id)!==ROLE.FBI) return {payout:0, reshuffled:false};
    if(!state.fbiAllKnownReady) return {payout:0, reshuffled:false};
    const payout = state.taxPot; state.taxPot = 0; saveState();
    uiLog(`🕵️‍♂️ FBI cobra bote de impuestos: ${payout}`);
    // Al cobrar, se resortean roles
    R.reshuffle();
    return {payout, reshuffled:true};
  };

  R.fbiGuessRole = function({fbiId, targetId, guessedRole}){
    if(roleOf(fbiId)!==ROLE.FBI) return {ok:false, correct:false, ready:false};
    const gr = normalizeRoleGuess(guessedRole);
    if(!state.fbiGuesses.has(fbiId)) state.fbiGuesses.set(fbiId, new Map());
    const map = state.fbiGuesses.get(fbiId);
    map.set(targetId, gr);
    const correct = (roleOf(targetId)===gr);
    if(!correct){
      state.fbiAllKnownReady = false;
      saveState();
      return {ok:true, correct:false, ready:false};
    }
    const others = state.players.filter(p=> p.id!==fbiId);
    const allKnown = others.every(p=> map.get(p.id)===roleOf(p.id));
    state.fbiAllKnownReady = !!allKnown;
    saveState();
    return {ok:true, correct:true, ready:state.fbiAllKnownReady};
  };

  // —— Carta de Suerte: Rehacer roles ——
  R.onLuckReshuffleRoles = function(){ R.reshuffle(); return true; };

  // —— Banca corrupta ——
  R.setBankCorrupt = function(flag){ state.bankCorrupt = !!flag; saveState(); uiUpdate(); };
  R.isBankCorrupt = function(){ return !!state.bankCorrupt; };

  // —— Banca corrupta en casillas: solicitud de préstamo ——
  R.registerCorruptBankTiles = function(tileIds){
    if(!Array.isArray(tileIds)) return false;
    state.corruptBankTiles = new Set(tileIds);
    saveState(); uiUpdate();
    uiLog(`🏦 Registradas ${state.corruptBankTiles.size} casillas de banca corrupta`);
    return true;
  };
  R.onCorruptBankTileLanding = function(player, tileId){
    const id = (player&&player.id)||player;
    state.bankLandingAttempt.set(id, { turn: state.turnCounter, attempted: false, tileId });
    saveState();
    uiLog(`🏦 ${id} ha caído en banca corrupta (tile ${tileId}) turno ${state.turnCounter}`);
  };
  R.requestCorruptLoan = function({playerId, amount, rate, ticks, tileId}){
    const id = (playerId&&playerId.id)||playerId;
    if(!state.bankLandingAttempt.has(id)) { return {accepted:false, reason:'Solo en casilla de préstamo corrupto.'}; }
    const entry = state.bankLandingAttempt.get(id);
    if(entry.turn!==state.turnCounter){ return {accepted:false, reason:'Solo en el mismo turno.'}; }
    if(entry.attempted){ return {accepted:false, reason:'Ya hiciste una operación en esta caída.'}; }
    if(!entry.tileId || (typeof tileId!=='undefined' && entry.tileId!==tileId)){
      return {accepted:false, reason:'Debes pedirlo desde esa casilla.'};
    }
    entry.attempted = true;

    const A = Number(amount||0); if(!(A>0)) return {accepted:false, reason:'Importe inválido.'};
    const maxT = cfg.bankMaxTicks||30; let T = Math.min(Number(ticks||maxT), maxT); if(T<=0) T=1;
    let r = normalizeRate(rate); const pAccept = Math.max(0, Math.min(1, r/2));
    if(roleOf(id)===ROLE.FLORENTINO){ r = Math.max(0, r*(1-0.20)); }
    const accepted = Math.random() < pAccept; if(!accepted){ saveState(); return {accepted:false, pAccept, reason:'Rechazado.'}; }
    const loanId = 'cb-'+Date.now()+'-'+Math.floor(Math.random()*1e6);
    const dueTurn = state.turnCounter + T; const dueAmount = Math.round(A * (1 + r));
    const loan = { id: loanId, playerId: id, principal: A, rate: r, ticksMax: T, startTurn: state.turnCounter, dueTurn, dueAmount, paid: 0, overdue: false, tileId: entry.tileId };
    state.loans.push(loan);
    saveState(); uiUpdate(); uiLog(`🏦✅ Préstamo corrupto aceptado: ${A} a ${(r*100).toFixed(1)}% (vence en T+${T})`);
    return {accepted:true, pAccept, loanId, dueAmount, dueTurn};
  };
  R.repayCorruptLoan = function({loanId, amount}){
    const i = state.loans.findIndex(l=> l.id===loanId);
    if(i<0) return {ok:false, reason:'No existe el préstamo'};
    const l = state.loans[i];
    const pay = Math.max(0, Number(amount||0));
    l.paid = Math.min(l.dueAmount, (l.paid||0) + pay);
    const remaining = Math.max(0, l.dueAmount - l.paid);
    if(remaining===0){ uiLog(`🏦✔️ Préstamo ${loanId} saldado`); }
    saveState(); uiUpdate();
    return {ok:true, remaining};
  };
  R.listCorruptLoans = function(filter){
    const arr = state.loans.slice();
    if(filter && filter.playerId){ return arr.filter(l=> l.playerId===filter.playerId); }
    return arr;
  };

  // —— Securitización en casilla de banca corrupta ——
  R.corruptBankSecuritize = function({playerId, advance, ticks}){
    const id = (playerId&&playerId.id)||playerId;
    if(!state.bankLandingAttempt.has(id)) { return {ok:false, reason:'Solo en casilla de banca corrupta.'}; }
    const entry = state.bankLandingAttempt.get(id);
    if(entry.turn!==state.turnCounter){ return {ok:false, reason:'Solo en el mismo turno.'}; }
    if(entry.attempted){ return {ok:false, reason:'Ya hiciste una operación en esta caída.'}; }
    entry.attempted = true;
    const adv = Math.max(0, Number(advance||cfg.securiAdvance||150));
    let T = Number(ticks||cfg.securiTicks||3); if(T<=0) T=1;
    const until = state.turnCounter + T;
    state.securitizations.set(id, until);
    saveState(); uiUpdate();
    return {ok:true, advance:adv, untilTurn:until, ticks:T};
  };

  // —— Florentino: forzar trades + perks en préstamos ——
  R.getFlorentinoUsesLeft = function(player){ const id=(player&&player.id)||player; return state.florentinoUsesLeft.get(id)||0; };

  R.maybeForceTradeAcceptance = function({initiatorId, counterpartyId}){
    if(roleOf(initiatorId)!==ROLE.FLORENTINO) return false;
    const left = R.getFlorentinoUsesLeft(initiatorId);
    if(left<=0) return false;
    const ok = rand.chance(cfg.florentinoForceP);
    if(ok){
      state.florentinoUsesLeft.set(initiatorId, left-1);
      saveState(); uiLog(`🤝 Florentino fuerza aceptación (quedan ${left-1})`);
    }
    return ok;
  };

  R.adjustLoanTerms = function({playerId, baseRate, baseLTV}){
    let rate = baseRate, LTV = baseLTV;
    if(state.bankCorrupt && roleOf(playerId)===ROLE.FLORENTINO){
      rate = (rate||0) * (1-0.20);
      LTV = (LTV||0) + 10;
      uiLog(`🏦 Préstamo VIP (banca corrupta + Florentino)`);
    }
    return {rate, LTV};
  };

  // —— Juez IA: impugnaciones ——
  R.challengeDeal = function({byId, fee, imbalance}){
    const feeCharged = (typeof fee === 'number') ? fee : cfg.judgeFee;
    // Prob de NO anular al menos floor
    const floor = Math.max(0, Math.min(1, cfg.judgeNoAnnulFloor));
    // Heurística: si el trato está muy desequilibrado (imbalance alto), sube prob de anular.
    // Interpretamos imbalance ∈ [0,1] donde 0 = equilibrado, 1 = muy injusto contra quien impugna.
    const x = Math.max(0, Math.min(1, imbalance||0));
    const pAnnul = Math.min(1, 1 - floor + x*(floor)); // más x ⇒ más anulación, acotado
    const roll = Math.random();
    const annulled = (roll < pAnnul);
    const pNoAnnul = 1 - pAnnul;
    uiLog(`⚖️ Impugnación: ${annulled? 'ANULADO' : 'NO anulado'} (pNoAnular≈${pNoAnnul.toFixed(2)})`);
    return {annulled, feeCharged, pNoAnnul};
  };

  // —— Gobierno: ciclos y multiplicadores ——
  R.tickTurn = function(){
    state.turnCounter++;
    // Vencimientos de préstamos corruptos
    (state.loans||[]).forEach(l=>{
      if(!l.overdue && state.turnCounter>l.dueTurn){
        l.overdue = true; uiLog(`⏰ Préstamo corrupto vencido (${l.id}) de jugador ${l.playerId}: quedan ${Math.max(0,l.dueAmount-(l.paid||0))}`);
      }
    });
    // Cobros periódicos por estados (p.ej. fentanilo)
    (state.statuses||new Map()).forEach((st, pid)=>{
      if(st?.fentanyl?.active){
        const tileId = st.fentanyl.tileId;
        const fee = st.fentanyl.fee||15;
        state.pendingPayments.push({ fromId: pid, toType:'tileOwner', tileId, amount: fee, reason: 'Fentanilo' });
      }
    });
    if(state.governmentTurnsLeft>0){
      state.governmentTurnsLeft--;
      if(state.governmentTurnsLeft===0){ state.government=null; uiLog('🏛️ Fin del ciclo de gobierno'); }
    }
    if(state.turnCounter % cfg.govPeriod === 0){
      uiLog('🗳️ Votación de gobierno abierta');
    }
    saveState(); uiUpdate();
  };

  R.setGovernment = function(side){
    if(side!=="left" && side!=="right"){ return false; }
    state.government = side;
    state.governmentTurnsLeft = cfg.govDuration;
    saveState(); uiUpdate();
    uiLog(`🏛️ Gobierno ${side==='left'?'de izquierdas':'de derechas'} (${cfg.govDuration} turnos)`);
    return true;
  };

  R.getTaxMultiplier = function(){
    if(state.government==='left') return 1 + (cfg.govLeft.tax||0);
    if(state.government==='right') return 1 + (cfg.govRight.tax||0);
    return 1;
  };
  R.getWelfareMultiplier = function(){
    if(state.government==='left') return 1 + (cfg.govLeft.welfare||0);
    if(state.government==='right') return 1 + (cfg.govRight.welfare||0);
    return 1;
  };
  R.getInterestMultiplier = function(){
    if(state.government==='left') return 1 + (cfg.govLeft.interest||0);
    if(state.government==='right') return 1 + (cfg.govRight.interest||0);
    return 1;
  };

  // —— Dados 0–9 (opt-in, no rompe tu lógica actual) ——
  R.rollDie0to9 = function(){ return rand.int(0,9); };
  R.handleDiceSpecials = function({d1, d2, playerId}){
    const out = {};
    if(d1===0 && d2===0){ out.repeatTile = true; }
    const s = new Set([d1,d2]);
    if(s.has(6) && s.has(9)){ out.gotoNearestFiore = true; }
    return out;
  };

  // —— Persistencia básica (localStorage) ——
  const LS_KEY = 'roles-politics-state-v22';
  function saveState(){
    try{
      const plain = {
        players: state.players,
        assignments: Array.from(state.assignments.entries()),
        fbiGuesses: Array.from(state.fbiGuesses.entries()).map(([k,v])=>[k, Array.from(v.entries())]),
        fbiAllKnownReady: state.fbiAllKnownReady,
        taxPot: state.taxPot,
        florentinoUsesLeft: Array.from(state.florentinoUsesLeft.entries()),
        bankCorrupt: state.bankCorrupt,
        turnCounter: state.turnCounter,
        government: state.government,
        governmentTurnsLeft: state.governmentTurnsLeft,$1pendingPayments: state.pendingPayments||[],
      securitizations: Array.from(state.securitizations||new Map()),
        securitizations: Array.from(state.securitizations||new Map()),
        pendingMoves: state.pendingMoves||[]
      };
      localStorage.setItem(LS_KEY, JSON.stringify(plain));
    }catch(e){ /* noop */ }
  }
  function loadState(){
    try{
      const raw = localStorage.getItem(LS_KEY); if(!raw) return;
      const plain = JSON.parse(raw);
      state.players = plain.players||[];
      state.assignments = new Map(plain.assignments||[]);
      const fg = new Map();
      (plain.fbiGuesses||[]).forEach(([k,arr])=> fg.set(k, new Map(arr)));
      state.fbiGuesses = fg;
      state.fbiAllKnownReady = !!plain.fbiAllKnownReady;
      state.taxPot = plain.taxPot||0;
      state.florentinoUsesLeft = new Map(plain.florentinoUsesLeft||[]);
      state.bankCorrupt = !!plain.bankCorrupt;
      state.turnCounter = plain.turnCounter||0;
      state.government = plain.government||null;
      state.governmentTurnsLeft = plain.governmentTurnsLeft||0;$1state.pendingPayments = plain.pendingPayments||[];
      state.securitizations = new Map(plain.securitizations||[]);
      state.pendingMoves = plain.pendingMoves||[];
    }catch(e){ /* noop */ }
  }

  R.exportState = function(){
    return {
      players: state.players,
      assignments: Array.from(state.assignments.entries()),
      fbiGuesses: Array.from(state.fbiGuesses.entries()).map(([k,v])=>[k, Array.from(v.entries())]),
      fbiAllKnownReady: state.fbiAllKnownReady,
      taxPot: state.taxPot,
      florentinoUsesLeft: Array.from(state.florentinoUsesLeft.entries()),
      bankCorrupt: state.bankCorrupt,
      turnCounter: state.turnCounter,
      government: state.government,
      governmentTurnsLeft: state.governmentTurnsLeft,
      corruptBankTiles: Array.from(state.corruptBankTiles||[]),
      bankLandingAttempt: Array.from(state.bankLandingAttempt||[]),
      loans: state.loans||[],
      fentanyl: { tiles: Array.from(state.fentanyl.tiles||[]), chance: state.fentanyl.chance, fee: state.fentanyl.fee },
      statuses: Array.from(state.statuses||new Map()),
      pendingPayments: state.pendingPayments||[],
      pendingMoves: state.pendingMoves||[]
    };
  };
  R.importState = function(obj){
    if(!obj) return false;
    try{
      state.players = obj.players||[];
      state.assignments = new Map(obj.assignments||[]);
      const fg = new Map();
      (obj.fbiGuesses||[]).forEach(([k,arr])=> fg.set(k, new Map(arr)));
      state.fbiGuesses = fg;
      state.fbiAllKnownReady = !!obj.fbiAllKnownReady;
      state.taxPot = obj.taxPot||0;
      state.florentinoUsesLeft = new Map(obj.florentinoUsesLeft||[]);
      state.bankCorrupt = !!obj.bankCorrupt;
      state.turnCounter = obj.turnCounter||0;
      state.government = obj.government||null;
      state.governmentTurnsLeft = obj.governmentTurnsLeft||0;$1state.pendingPayments = obj.pendingPayments||[];
      state.securitizations = new Map(obj.securitizations||[]);
      state.pendingMoves = obj.pendingMoves||[];
      saveState(); uiUpdate();
      return true;
    }catch(e){ return false; }
  };

  // —— UI mínima ——
  let bannerEl = null;
  function uiUpdate(){ if(cfg.ui && cfg.ui.banner) renderBanner(); }
  function uiLog(msg){ try{ console.log('[Roles]', msg); }catch(e){} }

  function renderBanner(){
    if (window.__V20_DEBUG_INSTALLED__) { if (bannerEl) bannerEl.remove(); return; }
    if(!document || !document.body) return;
    if(!bannerEl){
      bannerEl = document.createElement('div');
      bannerEl.style.position='fixed';
      bannerEl.style.left='10px';
      bannerEl.style.bottom='10px';
      bannerEl.style.zIndex='99999';
      bannerEl.style.padding='8px 10px';
      bannerEl.style.borderRadius='12px';
      bannerEl.style.boxShadow='0 4px 12px rgba(0,0,0,0.25)';
      bannerEl.style.fontFamily='system-ui, sans-serif';
      bannerEl.style.fontSize='12px';
      bannerEl.style.background='#ffffff';
      bannerEl.style.color='#111111';
      bannerEl.style.border='1px solid #cbd5e1';
      document.body.appendChild(bannerEl);
    }
    const gov = state.government ? (state.government==='left'?'Izquierda':'Derecha') : '—';
    const turns = state.government ? `${state.governmentTurnsLeft}` : '0';
    const taxPot = state.taxPot||0;
    bannerEl.innerHTML = `🏛️ Gobierno: <b>${gov}</b> (${turns}) · 🏦 Banca corrupta: <b>${state.bankCorrupt?'ON':'OFF'}</b> · 💰 Bote impuestos: <b>${taxPot}</b> · 📄 Préstamos: <b>${(state.loans||[]).length}</b> · 🚫 Estado puja: <b>${state.estadoAuctionBlocked?'OFF':'ON'}</b> <button id="rolesToggleBtn" style="margin-left:6px;">Roles</button> <button id="estadoBidToggleBtn" style="margin-left:6px;">${state.estadoAuctionBlocked?'Permitir Estado':'Bloquear Estado'}</button>`;
    try {
      const b1 = bannerEl.querySelector('#rolesToggleBtn');
      const b2 = bannerEl.querySelector('#estadoBidToggleBtn');
      if (b1) b1.onclick = function(){
        const evt = new CustomEvent('roles:toggle');
        window.dispatchEvent(evt);
      };
      if (b2) b2.onclick = function(){
        R.setEstadoAuctionBlocked(!state.estadoAuctionBlocked);
      };
    } catch(e){}
  }

  // —— Efectos por casilla ——
  // Registro simple para "farmazixe" → adicción a fentanilo
  R.configureFentanyl = function({ tileIds, chance, fee }){
    if(Array.isArray(tileIds)) state.fentanyl.tiles = new Set(tileIds);
    if(typeof chance==='number') state.fentanyl.chance = Math.max(0, Math.min(1, chance));
    if(typeof fee==='number') state.fentanyl.fee = Math.max(0, Math.round(fee));
    saveState(); uiUpdate();
  };

  R.onTileLanding = function(player, tileId){
    const id = (player&&player.id)||player;
    // 1) marcar intento de banca corrupta si es casilla válida
    if(state.corruptBankTiles && state.corruptBankTiles.has(tileId)){
      R.onCorruptBankTileLanding(id, tileId);
    }
    // 2) efecto Fentanilo (farmazixe)
    if(state.fentanyl.tiles && state.fentanyl.tiles.has(tileId)){
      const has = (state.statuses.get(id)||{}).fentanyl?.active;
      if(!has && Math.random() < (state.fentanyl.chance||0)){
        const st = state.statuses.get(id)||{};
        st.fentanyl = { active:true, tileId, fee: state.fentanyl.fee||15 };
        state.statuses.set(id, st);
        try{ alert('⚠️ Enganchado al fentanilo: pagarás '+st.fentanyl.fee+' por tick a la farmacia'); }catch(e){}
        uiLog(`🧪 ${id} enganchado al fentanilo (tile ${tileId})`);
        saveState(); uiUpdate();
      }
    }
  };

  R.clearStatus = function(playerId, key){
    const st = state.statuses.get(playerId)||{};
    if(st[key]){ delete st[key]; state.statuses.set(playerId, st); saveState(); uiUpdate(); return true; }
    return false;
  };
  R.listStatuses = function(playerId){ return Object.assign({}, state.statuses.get(playerId)||{}); };

  R.consumePendingPayments = function(){
    const out = state.pendingPayments.slice();
    state.pendingPayments.length = 0;
    saveState(); return out;
  };

  // —— Movimientos pendientes (cárcel, saltar turno) ——
  R.consumePendingMoves = function(){
    const out = (state.pendingMoves||[]).slice();
    state.pendingMoves.length = 0;
    saveState(); return out;
  };

  // —— Cartas personalizadas ——
  function queuePayEstado(fromId, amount, reason){
    state.pendingPayments.push({ fromId, toType:'estado', amount: Math.max(0, amount|0), reason: reason||'Carta' });
  }
  function queuePayFromOpponents(toId, amount, reason){
    state.pendingPayments.push({ toId, toType:'opponents', amount: Math.max(0, amount|0), reason: reason||'Carta' });
  }
  function queueJail(playerId, turns){
    state.pendingMoves.push({ playerId, effect:'jail', turns: Math.max(1, turns|0) });
  }
  function queueSkip(playerId, turns){
    state.pendingMoves.push({ playerId, effect:'skip', turns: Math.max(1, turns|0) });
  }
  function leftNeighborId(ofId){
    const i = state.players.findIndex(p=> p.id===ofId);
    if(i<0 || state.players.length===0) return null;
    const j = (i - 1 + state.players.length) % state.players.length;
    return state.players[j].id;
  }

  // 1) ¿Eres el padre de Jarein?
  R.card_JAREIN = function({ playerId }){
    const id = (playerId&&playerId.id)||playerId;
    queuePayEstado(id, 100, '¿Eres el padre de Jarein?');
    saveState();
    return { banner: '¿Eres el padre de Jarein? — Pagas 100 al Estado.' };
  };

  // 2) JAVI.
  R.card_JAVI = function({ playerId }){
    const id = (playerId&&playerId.id)||playerId;
    queuePayFromOpponents(id, 10, 'JAVI');
    saveState();
    return { banner: 'JAVI — cada rival te paga 10.' };
  };

  // 3) ITV motos (choice: 'A'|'B')
  R.card_ITV = function({ playerId, choice }){
    const id = (playerId&&playerId.id)||playerId;
    let c = choice;
    if(!c && typeof window!=='undefined'){
      c = window.confirm('¿ITV sin pasar? A: irte al monte (pierdes turno). B: ayudar (cárcel para ti y el de la izquierda).\nAceptar=A, Cancelar=B') ? 'A' : 'B';
    }
    if(c==='A'){
      queueSkip(id, 1);
      saveState();
      return { banner: 'Te vas al monte: pasas tu próximo turno.' };
    } else {
      const leftId = leftNeighborId(id);
      queueJail(id, 1);
      if(leftId!=null) queueJail(leftId, 1);
      saveState();
      return { banner: 'LA MOTO SE LE HA CALENTADO Y LE PILLAN: tú y el de la izquierda vais a la cárcel.' };
    }
  };

  document.addEventListener('DOMContentLoaded', ()=>{

    // listener simple para toggle de panel de roles
    try {
      window.addEventListener('roles:toggle', function(){
        var el = document.getElementById('rolesDebugPanel');
        if (!el) {
          el = document.createElement('div');
          el.id = 'rolesDebugPanel';
          el.style.position='fixed'; el.style.right='10px'; el.style.bottom='10px'; el.style.zIndex='99999';
          el.style.padding='10px 12px'; el.style.borderRadius='12px'; el.style.boxShadow='0 4px 12px rgba(0,0,0,0.25)';
          el.style.fontFamily='system-ui, sans-serif'; el.style.fontSize='12px';
          el.style.background='#ffffff'; el.style.color='#111111'; el.style.border='1px solid #cbd5e1';
          document.body.appendChild(el);
        }
        if (el.style.display==='none' || !el.dataset.visible) {
          var rows = (state.players||[]).map(function(p){ return '<tr><td style="padding:2px 6px;">'+(p.name||p.id)+'</td><td style="padding:2px 6px; font-weight:600;">'+(roleOf(p.id))+'</td></tr>'; }).join('');
          el.innerHTML = '<div style="margin-bottom:6px; font-weight:700;">Roles (debug)</div><table>'+rows+'</table>';
          el.dataset.visible = '1'; el.style.display='block';
        } else {
          el.dataset.visible = ''; el.style.display='none';
        }
      });
    } catch(e){}
  });

  // Exponer API
  // === CARTAS NUEVAS Y EFECTOS GLOBALES ===
  R.card_REF = function({side}){
    var s = side;
    if(!s && typeof window!=='undefined'){
      s = window.prompt('Gobierno: left / right','left');
    }
    if(s!=='left' && s!=='right') return {banner:'Voto cancelado'};
    R.setGovernment(s);
    return {banner: 'Referéndum: Gobierno '+(s==='left'?'de izquierdas':'de derechas')+' aplicado'};
  };

  // Apagón nacional: 2 ticks sin casino
  R.card_BLACKOUT = function(){ state.powerOffTicks = 2; saveState(); return {banner:'Apagón nacional: 2 ticks sin ruleta, slots ni galgos'}; };
  R.isPowerOff = function(){ return (state.powerOffTicks||0) > 0; };

  // Huelga general: 1 tick sin alquileres ni ayudas
  R.card_STRIKE = function(){ state.strikeTicks = 1; saveState(); return {banner:'Huelga general: 1 tick sin alquileres ni ayudas'}; };
  R.shouldBlockRent = function(){ return (state.strikeTicks||0) > 0; };
  R.shouldBlockWelfare = function(){ return (state.strikeTicks||0) > 0; };

  // Inspección de Hacienda: multa 60 y +10% impuestos 2 ticks (solo jugador)
  R.card_AUDIT = function({playerId}){
    var id = (playerId&&playerId.id)||playerId;
    state.pendingPayments.push({ fromId:id, toType:'estado', amount:60, reason:'Inspección de Hacienda' });
    var st = state.statuses.get(id)||{};
    st.auditMul = { extra: 0.10, ticks: 2 };
    state.statuses.set(id, st);
    saveState();
    return {banner:'Inspección de Hacienda: pagas 60 al Estado y +10% impuestos por 2 ticks'};
  };

  // Desahucio exprés: embargo 3 ticks (rentas a Estado)
  R.card_EVICT = function({playerId, tileId, ticks}){
    var id = (playerId&&playerId.id)||playerId;
    var T = (typeof ticks==='number' && ticks>0)? ticks : 3;
    var tid = tileId;
    try{
      if(tid==null && Array.isArray(window.TILES)){
        var myProps = [];
        for(var i=0;i<window.TILES.length;i++){
          var t = window.TILES[i];
          if(t && (t.owner===id)) myProps.push(i);
        }
        if(myProps.length>0) tid = myProps[Math.floor(Math.random()*myProps.length)];
      }
      if(tid==null && typeof window!=='undefined'){
        tid = Number(window.prompt('ID de propiedad a embargar (3 ticks):','0'))||0;
      }
    }catch(e){}
    if(tid==null) return {banner:'Desahucio: sin propiedad'};
    var until = state.turnCounter + T;
    state.embargoes.set(tid, until);
    saveState(); uiUpdate();
    return {banner:'Desahucio exprés: propiedad '+tid+' embargada '+T+' ticks'};
  };
  R.isEmbargoed = function(tileId){
    var u = state.embargoes.get(tileId);
    return !!u && state.turnCounter <= u;
  };
  R.shouldRedirectRentToEstado = function(tileId){ return R.isEmbargoed(tileId); };
  R.shouldRedirectRentToEstadoForOwner = function(ownerId){
    const until = state.securitizations.get(ownerId);
    return !!until && state.turnCounter <= until;
  };

  // Auditoría de subvención: si Gobierno=izquierda, pagas 50 al Estado
  R.card_SUBV_AUDIT = function({playerId}){
    if(state.government==='left'){
      var id = (playerId&&playerId.id)||playerId;
      state.pendingPayments.push({ fromId:id, toType:'estado', amount:50, reason:'Auditoría de subvención' });
      saveState();
      return {banner:'Auditoría de subvención: pagas 50 al Estado'};
    }
    return {banner:'Auditoría de subvención: sin efecto (gobierno de derechas)'};
  };

  // FBI: editar dados 2 veces por partida, y ventajas fiscales con gobierno de izquierdas
  R.maybeEditDie = function({playerId, d1, d2}){
    var id = (playerId&&playerId.id)||playerId;
    if(roleOf(id)!==ROLE.FBI) return {d1:d1, d2:d2, used:false};
    var left = state.fbiDieEditsLeft.get(id)||0;
    if(left<=0) return {d1:d1, d2:d2, used:false};
    try{
      var ask = window.prompt('Editar dado? (1=editar d1, 2=editar d2, otra cosa=no)','');
      if(ask==='1' || ask==='2'){
        var max = (cfg.dice0to9? 9 : 6);
        var min = (cfg.dice0to9? 0 : 1);
        var nv = Number(window.prompt('Nuevo valor entre '+min+' y '+max+':',''+min));
        if(!isNaN(nv) && nv>=min && nv<=max){
          if(ask==='1') d1 = nv; else d2 = nv;
          state.fbiDieEditsLeft.set(id, left-1);
          saveState();
          return {d1:d1, d2:d2, used:true};
        }
      }
    }catch(e){}
    return {d1:d1, d2:d2, used:false};
  };

  R.useFBITaxBoost = function({playerId}){
    var id = (playerId&&playerId.id)||playerId;
    if(roleOf(id)!==ROLE.FBI) return {ok:false};
    var left = state.fbiTaxBoostChargesLeft.get(id)||0;
    if(left<=0) return {ok:false};
    var st = state.statuses.get(id)||{};
    st.taxBoostOnce = true; // se consumirá en el próximo cálculo de impuesto
    state.statuses.set(id, st);
    state.fbiTaxBoostChargesLeft.set(id, left-1);
    saveState();
    return {ok:true, left:left-1};
  };

  R.getPlayerTaxMultiplier = function(playerId){
    var id = (playerId&&playerId.id)||playerId;
    var mul = 1;
    var st = state.statuses.get(id)||{};
    if(st.auditMul && st.auditMul.ticks>0){ mul *= (1 + (st.auditMul.extra||0)); }
    // Bonus FBI con gobierno de izquierdas: -15%
    if(state.government==='left' && roleOf(id)===ROLE.FBI){ mul *= 0.85; }
    if(st.taxBoostOnce){ mul *= 0.75; st.taxBoostOnce=false; state.statuses.set(id, st); }
    return mul;
  };

  // Reducir contadores en cada tick (ya en tickTurn)
  var _origTick = R.tickTurn;
  R.tickTurn = function(){
    _origTick();
    if(state.powerOffTicks>0) state.powerOffTicks--;
    if(state.strikeTicks>0) state.strikeTicks--;
    // bajar duración de auditorías por jugador
    (state.statuses||new Map()).forEach(function(s, pid){
      if(s.auditMul && s.auditMul.ticks>0){ s.auditMul.ticks--; if(s.auditMul.ticks<=0) delete s.auditMul; state.statuses.set(pid, s); }
    });
    // limpiar embargos caducados
    Array.from(state.embargoes.entries()).forEach(function(ent){
      var tid = ent[0], until = ent[1];
      if(state.turnCounter>until) state.embargoes.delete(tid);
    });
    // limpiar securitizaciones caducadas
    Array.from(state.securitizations.entries()).forEach(function(ent){
      var pid = ent[0], until = ent[1];
      if(state.turnCounter>until) state.securitizations.delete(pid);
    });
    saveState(); uiUpdate();
  };

  R.setEstadoAuctionBlocked = function(flag){ state.estadoAuctionBlocked = !!flag; saveState(); uiUpdate(); };
  R.isEstadoAuctionBlocked = function(){ return !!state.estadoAuctionBlocked; };
  R.listAssignments = function(){ return (state.players||[]).map(p=>({ id:p.id, name:p.name, role: roleOf(p.id) })); };
  R.setRole = function(playerId, role){
    var id = (playerId&&playerId.id)||playerId;
    var r = normalizeRoleGuess(role);
    if(r !== ROLE.CIVIL){
      state.assignments.forEach((val, key)=>{
        if(val===r && key!==id){ setRole(key, ROLE.CIVIL); }
      });
    }
    setRole(id, r);
    ensureFlorentinoUses();
    saveState();
    uiUpdate();
  };
  R.ROLES = Object.assign({}, ROLE);

  // === Eventos/CARTAS unificados ===
// Llamas con el nombre que uses en tu mazo o en tus triggers de casilla.
R.triggerEvent = function(name, opts){
  var n = (name||'').toLowerCase();
  var o = opts || {};
  // Normaliza playerId por si te llega el objeto jugador
  if (o.playerId && o.playerId.id) o.playerId = o.playerId.id;

  // ITV: acepta "itv..." con más texto
  if (n.indexOf('itv') === 0 && R.card_ITV) return R.card_ITV(o);

  switch(n){
    case '¿eres el padre de jarein?': if(R.card_JAREIN) return R.card_JAREIN(o); break;
    case 'javi.': if(R.card_JAVI) return R.card_JAVI(o); break;

    case 'referéndum exprés':
    case 'referendum expres':
      if(R.card_REF) return R.card_REF(o); break;

    case 'apagón nacional':
    case 'apagon nacional':
      if(R.card_BLACKOUT) return R.card_BLACKOUT(o); break;

    case 'huelga general':
      if(R.card_STRIKE) return R.card_STRIKE(o); break;

    case 'inspección de hacienda':
    case 'inspeccion de hacienda':
      if(R.card_AUDIT) return R.card_AUDIT(o); break;

    case 'desahucio exprés':
    case 'desahucio expres':
      if(R.card_EVICT) return R.card_EVICT(o); break;

    case 'auditoría de subvención':
    case 'auditoria de subvencion':
      if(R.card_SUBV_AUDIT) return R.card_SUBV_AUDIT(o); break;
  }
  return { banner: '(evento sin efecto)' };
};

// (Opcional) Lista de eventos soportados por el módulo
R.eventsList = [
  '¿Eres el padre de Jarein?',
  'JAVI.',
  'ITV ...',
  'Referéndum exprés',
  'Apagón nacional',
  'Huelga general',
  'Inspección de Hacienda',
  'Desahucio exprés',
  'Auditoría de subvención'
];

  window.Roles = Object.freeze(R);
})();
