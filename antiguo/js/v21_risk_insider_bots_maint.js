/*
  v21-risk-insider-bots-maint.js
  Plug-in para tu stack v20/v21. Añade:
  - Margin calls en préstamos: si cash < umbral => venta forzosa de colateral.
  - Insider: carta que revela el siguiente evento económico y lo “fija” para todos.
  - IA “predador” + aprendizaje simple por color (ajuste de maxOverpay según ROI).
  - Mantenimiento dinámico: si tienes monopolio de color, sube el fee; si no, baja.

  Cargar DESPUÉS de:
    v20-part6.js
    auction+debt-market-v21.js
    (opcional) v21-extras-bundles-bots.js

  API rápida:
    GameRiskPlus.install({ state, margin:{ cashThreshold:120, graceTurns:1 }, maint:{ monoMult:1.5, nonMonoMult:0.7 } })
    // hooks
    GameRiskPlus.onTurnStart(playerId)   // revisa margin call + aprendizaje
    GameRiskPlus.onRent(tileIndex, amount, payerId, ownerId) // alimenta ROI por color

    // Insider
    GameRiskPlus.Insider.give(playerId)
    GameRiskPlus.Insider.use(playerId)   // muestra overlay y fija el próximo evento económico

    // Bots
    GameRiskPlus.Bots.predatorTick(botId) // si hay subasta activa, intenta reventar a rivales con estrés
*/

(function(global){
  'use strict';

  const GDM = global.GameDebtMarket;
  const GEX = global.GameExtras; // opcional

  const pick = (o,k,d)=> (o && k in o ? o[k] : d);
  const sum = a=> a.reduce((x,y)=> x+(+y||0), 0);
  const clamp = (x,a,b)=> Math.max(a, Math.min(b, x));
  const id = ()=>'r'+Math.random().toString(36).slice(2,10);

  function safe(fn, ...args){ try{ return fn && fn(...args); }catch(e){ console.warn('[RISK]',e); } }

  const Risk = {
    _cfg:null,

    install(cfg={}){
      const state = cfg.state || global.state || {};
      if (!state.meta) state.meta = {};
      if (!state.meta.aiLearn) state.meta.aiLearn = { colorAdj:{} };
      if (!state.margin) state.margin = {};
      if (!state._insider) state._insider = { inventory:{}, committed:null };

      this._cfg = {
        state,
        margin: Object.assign({ cashThreshold: 120, graceTurns: 1 }, cfg.margin||{}),
        maint:  Object.assign({ monoMult: 1.5, nonMonoMult: 0.7, basePct: 0.05, minFee: 1 }, cfg.maint||{})
      };

      // Patch onTurnStart para inyectar margin call
      const prevGDMStart = GDM?.onTurnStart?.bind(GDM);
      if (GDM){
        GDM.onTurnStart = (pid)=>{ if (prevGDMStart) prevGDMStart(pid); return this.onTurnStart(pid); };
      }

      // Patch finishAuction para aprendizaje por color (tiles)
      if (GDM && typeof GDM._finishAuction === 'function'){
        const prevFinish = GDM._finishAuction.bind(GDM);
        GDM._finishAuction = ()=>{
          const s=this._cfg.state; const a=s.auction;
          if (a && a.open && a.kind==='tile' && a.bestPlayer && a.bestBid>0){
            const t=this._getTile(a.assetId);
            this._learnOnPurchase(t, a.bestBid);
          }
          return prevFinish();
        };
      }

      return this;
    },

    // ====== TURN HOOK ======================================================
    onTurnStart(playerId){
      this._checkMarginCalls(playerId);
      // mantenimiento dinámico: aplica si tienes GEX o usa fallback propio
      const fee = this.applyMaintenanceDynamic(playerId);
      return fee;
    },

    // ====== MARGIN CALLS ===================================================
    _checkMarginCalls(playerId){
      const s=this._cfg.state; const cfg=this._cfg.margin;
      const p=(s.players||[]).find(x=> x.id===playerId); if (!p) return;
      const cash = p.money||0;
      if (cash >= cfg.cashThreshold) return; // no hay llamada

      for (const L of (s.loans||[])){
        if (L.borrowerId!==playerId) continue;
        if (L.status!=='active') continue;
        if (!Array.isArray(L.collateralTileIds) || !L.collateralTileIds.length) continue;
        // respetar gracia tras último trigger
        const last = L._lastMarginTurn ?? -9999;
        if ((s.turnCount||0) - last < (cfg.graceTurns||0)) continue;

        // activa margin call: subasta forzosa del primer colateral
        const tileId = L.collateralTileIds[0];
        if (tileId==null) continue;
        L._lastMarginTurn = s.turnCount||0;
        safe(GDM?.startAuctionForTile?.bind(GDM), tileId, { sealed:false });
        // tras forzar venta, marcamos para que el holder cobre el producto en finishAuction vía compra;
        // la lógica de adjudicación de tiles ya descuenta del comprador. Aquí solo dejamos rastro.
        L._marginActive = true;
        break; // una por turno máximo
      }
    },

    // ====== INSIDER ========================================================
    Insider: {
      give(playerId){ const S=Risk._cfg.state; S._insider.inventory[playerId]=(S._insider.inventory[playerId]||0)+1; return S._insider.inventory[playerId]; },
      usable(playerId){ const S=Risk._cfg.state; return (S._insider.inventory[playerId]||0)>0; },
      use(playerId){
        const S=Risk._cfg.state; if (!this.usable(playerId)) return false;
        // Elige y fija el siguiente evento económico sin consumirlo
        const next = Risk._peekNextEconomicEvent();
        if (!next){ Risk._overlay('No hay evento económico disponible.'); return false; }
        S._insider.inventory[playerId]--; S._insider.committed = next;
        Risk._overlay('Insider: próximo evento económico fijado → '+ (next.name||next.id||'[evento]'));
        return true;
      }
    },

    _peekNextEconomicEvent(){
      const s=this._cfg.state; const E = global.events || [];
      // Estrategia: preferir eventos con tag 'econ' o nombre que contenga 'econom'/'liquidez'/'mercado'
      const econ = E.filter(e=> /econ|mercado|liquid|inflac|tipos|crisis/i.test(e.name||e.id||''));
      const pickOne = (arr)=> arr[Math.floor(Math.random()*arr.length)];
      const chosen = (econ.length? pickOne(econ) : pickOne(E)) || null;
      return chosen ? { id: chosen.id, name: chosen.name, run: chosen.run } : null;
    },

    // En ejecución real, el motor que saque eventos debe respetar lo comprometido
    drawEventPatched(){
      const s=this._cfg.state; const committed = s._insider?.committed;
      if (committed){ s._insider.committed = null; return committed; }
      // fallback: elegir aleatorio del array global
      const E = global.events || []; if (!E.length) return null;
      return E[Math.floor(Math.random()*E.length)];
    },

    // ====== BOTS: PREDADOR + LEARNING =====================================
    Bots: {
      // Reventar subastas clave a rivales con estrés de liquidez
      predatorTick(botId){
        const s=Risk._cfg.state; const a=s.auction; if (!a||!a.open) return;
        const bot=(s.players||[]).find(x=>x.id===botId); if (!bot) return;
        const stressed = Risk._detectStressedPlayers();
        if (!stressed.size) return;
        // Si el mejor postor actual está estresado, sube la puja hasta un cap
        const targetId = a.bestPlayer; if (!targetId || !stressed.has(targetId)) return;
        const fair = Risk._estimateFair(a);
        const colorAdj = Risk._colorAdjForAuction(a);
        const cap = Math.floor(fair * (1.15 + colorAdj)); // agresivo pero con tope
        const step = Math.max(1, Math.ceil(fair*0.06));
        const next = Math.min(cap, Math.max(a.price, a.bestBid||0) + step);
        if ((bot.money||0) >= next && next > (a.bestBid||0)){
          if (typeof global.placeBid === 'function') return safe(global.placeBid, botId, next);
          a.bestBid = next; a.bestPlayer = botId; // fallback
        }
      }
    },

    _detectStressedPlayers(){
      const s=this._cfg.state; const set=new Set();
      for (const p of (s.players||[])){
        const need = this._maintenanceNext(p.id) + this._debtDueSoon(p.id);
        if ((p.money||0) < need) set.add(p.id);
      }
      return set;
    },

    _estimateFair(a){
      const s=this._cfg.state;
      if (a.kind==='tile'){ const t=this._getTile(a.assetId)||{}; return Math.max(1, t.price||1); }
      if (a.kind==='bundle'){ const tiles = (a.bundleTiles||[]).map(i=> this._getTile(i)||{price:1}); return Math.max(1, sum(tiles.map(t=> t.price||1))); }
      if (a.kind==='loan'){ const L=(s.loanListings||[]).find(x=> x.id===a.assetId)||{}; return Math.max(1, L.minPrice||1); }
      return Math.max(1, a.price||1);
    },

    _colorAdjForAuction(a){
      if (a.kind!=='tile') return 0;
      const t=this._getTile(a.assetId)||{}; const col=t.color||t.group||'__';
      const adj = pick(this._cfg.state.meta.aiLearn.colorAdj, col, 0);
      return clamp(adj, -0.2, 0.4); // -20%..+40%
    },

    // aprendizaje: al comprar una tile, baja o sube preferencia por color según ROI observado
    _learnOnPurchase(tile, price){
      if (!tile) return;
      const s=this._cfg.state; const col=tile.color||tile.group||'__';
      const m=s.meta.aiLearn;
      // Heurística barata: ROI proxy = renta base / precio
      const rent = Math.max(1, tile.rent||Math.ceil((tile.price||1)*0.12));
      const roi = rent / Math.max(1, price);
      const prev = m.colorAdj[col]||0;
      const target = clamp((roi-0.10)*2.0, -0.3, 0.5); // centro aprox 10%/turno
      m.colorAdj[col] = clamp(prev*0.7 + target*0.3, -0.3, 0.5);
    },

    onRent(tileIndex, amount /*, payerId, ownerId*/){
      // Puedes llamar esto desde tu motor cuando alguien paga renta para enriquecer aprendizaje
      const t=this._getTile(tileIndex); if (!t) return;
      const col=t.color||t.group||'__'; const s=this._cfg.state; const m=s.meta.aiLearn;
      const prev=m.colorAdj[col]||0; const impulse=clamp((amount/Math.max(1,t.price||1))-0.08, -0.1, 0.1);
      m.colorAdj[col] = clamp(prev + impulse*0.25, -0.3, 0.5);
    },

    // ====== MANTENIMIENTO DINÁMICO ========================================
    applyMaintenanceDynamic(playerId){
      const s=this._cfg.state; const p=(s.players||[]).find(x=>x.id===playerId); if(!p) return 0;
      const T=s.board||s.tiles||[]; const cfg=this._cfg.maint; let due=0;
      const groups=this._groupsByColor();
      for (const [color, idxs] of Object.entries(groups)){
        const own = idxs.filter(i=> T[i]?.owner===playerId);
        if (!own.length) continue;
        const mono = own.length===idxs.length;
        const mult = mono? cfg.monoMult : cfg.nonMonoMult;
        for (const i of own){
          const t=T[i]; const base = (typeof t.maintenance==='number' ? t.maintenance : Math.ceil((t.price||0)*cfg.basePct));
          const fee = Math.max(cfg.minFee, Math.ceil(base*mult));
          due += fee;
        }
      }
      if (due>0){ p.money = Math.max(0, (p.money||0) - due); }
      return due;
    },

    _maintenanceNext(playerId){
      // misma lógica pero solo calcula
      const s=this._cfg.state; const T=s.board||s.tiles||[]; const cfg=this._cfg.maint; let due=0;
      const groups=this._groupsByColor();
      for (const [color, idxs] of Object.entries(groups)){
        const own = idxs.filter(i=> T[i]?.owner===playerId); if (!own.length) continue;
        const mono = own.length===idxs.length; const mult = mono? cfg.monoMult : cfg.nonMonoMult;
        for (const i of own){ const t=T[i]; const base=(typeof t.maintenance==='number'? t.maintenance: Math.ceil((t.price||0)*cfg.basePct)); due += Math.max(cfg.minFee, Math.ceil(base*mult)); }
      }
      return due;
    },

    _debtDueSoon(playerId){
      const s=this._cfg.state; let due=0; for (const L of (s.loans||[])) if (L.borrowerId===playerId) due += (L.accrued||0); return due;
    },

    _groupsByColor(){
      const s=this._cfg.state; const T=s.board||s.tiles||[]; const out={};
      for (let i=0;i<T.length;i++){ const t=T[i]; if (!t || t.type!=='prop') continue; const c=t.color||t.group||'__'; (out[c]=out[c]||[]).push(i); }
      return out;
    },

    // ====== UI helpers =====================================================
    _overlay(text){
      let el=document.getElementById('risk-overlay');
      if (!el){ el=document.createElement('div'); el.id='risk-overlay'; Object.assign(el.style,{position:'fixed',inset:'0',display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.55)',color:'#fff',zIndex:99997,fontFamily:'system-ui,Segoe UI,Roboto',fontSize:'18px'}); el.addEventListener('click',()=> el.remove()); document.body.appendChild(el); }
      el.textContent = text||'';
    },

    // ====== utils ==========================================================
    _getTile(i){ const s=this._cfg.state; const T=s.board||s.tiles||[]; return T[i]||null; }
  };

  global.GameRiskPlus = Risk;

})(typeof window!=='undefined'? window : globalThis);
