/*
  v21-extras-bundles-bots.js
  Complemento para tu stack v20/v21:
  - Subastas de BUNDLE (2–3 casillas contiguas) disparadas por EVENTO (ocultas/"selladas").
  - Costes de mantenimiento para tiles "premium".
  - Anti-abuso: detección de colusión básica + cooldowns de reventa.
  - Bots con perfiles (agresivo, value, liquidez) – stubs listos para integrar con tu función global `placeBid`.
  - Panel "Mi balance" (cash, deuda neta, propiedades, mantenimiento próximo).

  Carga después de:
    <script src="v20-part6.js"></script>
    <script src="auction+debt-market-v21.js"></script>
    <script src="v21-extras-bundles-bots.js"></script>
*/

(function (global) {
  'use strict';

  const GDM = global.GameDebtMarket; // módulo previo
  const pick = (o,k,d)=> (o && k in o ? o[k] : d);
  const sum = (arr)=> arr.reduce((a,b)=> a+(+b||0), 0);
  const id = ()=>'b'+Math.random().toString(36).slice(2,10);

  function safe(fn, ...args){ try { return fn && fn(...args); } catch(e){ console.warn('[extras]', e); } }

  const GameExtras = {
    _cfg:null,

    install(cfg={}){
      const state = cfg.state || global.state || {};
      if (!state.flags) state.flags = { collusion: [] };
      if (!state.cooldowns) state.cooldowns = {}; // key -> { lastPair:"seller>buyer", until:turn }
      if (!state.bundleListings) state.bundleListings = [];
      this._cfg = { state, cooldownTurns: cfg.cooldownTurns ?? 6, maintenanceKey: 'premium' };

      // Extiende finishAuction de GameDebtMarket para soportar 'bundle'
      if (GDM && typeof GDM._finishAuction === 'function') {
        const prev = GDM._finishAuction.bind(GDM);
        GDM._finishAuction = ()=>{
          const s = this._cfg.state; const a = s.auction;
          if (a && a.kind === 'bundle' && a.open){
            a.open = false;
            if (a.bestPlayer && a.bestBid > 0){
              const buyer = (s.players||[]).find(p=>p.id===a.bestPlayer);
              if (buyer && (buyer.money||0) >= a.bestBid){
                // Enforce cooldowns para cada tile
                for (const tIdx of a.bundleTiles){
                  if (!this._enforceCooldown('tile', tIdx, a.sellerId, buyer.id)){
                    console.warn('[bundle] cooldown bloquea venta de tile', tIdx); return GDM._closeAuctionOverlay();
                  }
                }
                buyer.money -= a.bestBid;
                for (const tIdx of a.bundleTiles){
                  const t = this._getTile(tIdx); if (t) {
                    const prevOwner = t.owner ?? null;
                    t.owner = buyer.id;
                    this._recordTransfer('tile', tIdx, prevOwner, buyer.id, Math.round(a.bestBid / a.bundleTiles.length));
                  }
                }
              }
            }
            return GDM._closeAuctionOverlay();
          }
          return prev();
        };
      }

      return this;
    },

    // ====== BUNDLES ========================================================
    // Encuentra bundles contiguos de tamaño 2 o 3 que estén libres (owner==null)
    findFreeBundles({ size=2, onlyProps=true }={}){
      const s = this._cfg.state; const T = s.board || s.tiles || [];
      const ok = (i)=> T[i] && (!onlyProps || T[i].type==='prop') && (T[i].owner==null);
      const out=[];
      for (let i=0;i<T.length;i++){
        if (ok(i)){
          // contigüidad lineal en índice (asume tablero circular)
          const seq=[i];
          for (let k=1; k<size; k++){
            const j=(i+k)%T.length; if (!ok(j)){ seq.length=0; break; } seq.push(j);
          }
          if (seq.length===size) out.push(seq);
        }
      }
      return out;
    },

    // Lanza subasta sellada de un bundle desde EVENTO
    startBundleAuctionFromEvent(bundleIdxs, opts={}){
      const s=this._cfg.state; if (!Array.isArray(bundleIdxs) || !bundleIdxs.length) return;
      const tiles = bundleIdxs.map(i=> this._getTile(i)).filter(Boolean);
      const base = Math.max(1, sum(tiles.map(t=> t.price||1)));
      const listing = { id:id(), tiles: bundleIdxs.slice(), minPrice: Math.ceil(base*0.6) };
      s.bundleListings.push(listing);

      // Construye auction state compatible con GDM
      s.auction = {
        kind:'bundle', assetId: listing.id,
        bundleTiles: listing.tiles.slice(),
        sellerId: null, // banco/evento
        open:true, sealed: opts.sealed!==false, bids: opts.sealed? {}: undefined,
        bestBid:0, bestPlayer:null, price: listing.minPrice,
        active: new Set((s.players||[]).filter(p=>p?.alive!==false).map(p=>p.id)),
        timer:null
      };
      safe(GDM && GDM._openAuctionOverlay?.bind(GDM), 'bundle', listing, { sealed: s.auction.sealed });
    },

    // ====== MANTENIMIENTO ==================================================
    // Marca tiles como premium: { maintenance: 20 } o flag booleano
    applyMaintenanceFees(playerId){
      const s=this._cfg.state; const T=s.board||s.tiles||[]; const p=(s.players||[]).find(x=>x.id===playerId); if(!p) return 0;
      let due=0;
      for (let i=0;i<T.length;i++){
        const t=T[i]; if (!t || t.owner!==playerId) continue;
        const fee = (typeof t.maintenance==='number' ? t.maintenance : (t[this._cfg.maintenanceKey]? Math.ceil((t.price||0)*0.05): 0));
        if (fee>0){ due+=fee; }
      }
      if (due>0){ p.money = Math.max(0, (p.money||0) - due); }
      return due;
    },

    // ====== ANTI-ABUSO =====================================================
    _recordTransfer(kind, assetId, fromId, toId, price){
      const s=this._cfg.state; const now=s.turnCount||0;
      s.flags.collusion.push({ turn:now, kind, assetId, from:fromId, to:toId, price });
      if (s.flags.collusion.length>200) s.flags.collusion.splice(0, s.flags.collusion.length-200);
      // fija cooldown de reventa al MISMO comprador desde el mismo vendedor
      if (fromId!=null && toId!=null){
        const key = `${kind}:${assetId}`; s.cooldowns[key]={ pair:`${fromId}>${toId}`, until: now + (this._cfg.cooldownTurns||6) };
      }
    },

    _enforceCooldown(kind, assetId, fromId, toId){
      const s=this._cfg.state; const key=`${kind}:${assetId}`; const cd=s.cooldowns[key]; const now=s.turnCount||0;
      if (!cd) return true;
      if (cd.pair===`${fromId}>${toId}` && now<cd.until){ return false; }
      return true;
    },

    scanCollusion({ windowTurns=16, repeatThreshold=3, underFactor=0.6 }={}){
      const s=this._cfg.state; const rec=s.flags.collusion||[]; const now=s.turnCount||0;
      const recent=rec.filter(r=> r.turn>=now-windowTurns);
      const key=(r)=> `${r.from}>${r.to}`;
      const map=new Map();
      for (const r of recent){
        const k=key(r); const arr=map.get(k)||[]; arr.push(r); map.set(k, arr);
      }
      const susp=[];
      for (const [pair, arr] of map){
        // valor justo aproximado
        const under = arr.filter(r=> this._belowFair(r, underFactor));
        if (under.length>=repeatThreshold) susp.push({ pair, count:under.length, samples: under.slice(0,3) });
      }
      return susp;
    },

    _belowFair(r, factor){
      const s=this._cfg.state;
      if (r.kind==='tile'){
        const t=this._getTile(r.assetId); const fair= Math.max(1, (t?.price||1));
        return r.price < fair*factor;
      }
      if (r.kind==='loan'){
        const L=(s.loans||[]).find(x=>x.id===r.assetId) || {};
        const fair= Math.max(1, (L.principal||1) + (L.accrued||0) - Math.ceil((L.termTurns||1)/4));
        return r.price < fair*factor;
      }
      return false;
    },

    // ====== BOTS (stubs) ===================================================
    BotManager: {
      profiles: {
        agresivo: { maxOverpay: 1.35, bidStep: 0.08 },
        value:    { maxOverpay: 1.05, bidStep: 0.05 },
        liquidez: { maxOverpay: 0.95, bidStep: 0.03 },
        dios:     { maxOverpay: 2.00, bidStep: 0.10 }
      },
      estimateFair(kind, meta, playerId){
        let base=1;
        if (kind==='tile') base=Math.max(1, meta.price||1);
        if (kind==='bundle') base=Math.max(1, sum(meta.tiles.map(i=> (GameExtras._getTile(i)?.price)||1)));
        if (kind==='loan') base=Math.max(1, pick(meta,'minPrice', 1));
        return Math.floor(base * this._synergyMult(kind, meta, playerId));
      },
      _synergyMult(kind, meta, playerId){
        const s=GameExtras._cfg.state||{}; const T=s.board||s.tiles||[]; if(!playerId) return 1;
        if (kind==='tile'){
          const group=meta.color||meta.group; if(!group) return 1;
          const tiles=T.filter(t=> t&&t.type==='prop'&&(t.color===group||t.group===group));
          const owned=tiles.filter(t=> t.owner===playerId).length;
          const after=owned+1;
          if(after===tiles.length) return 1.6;
          if(after===tiles.length-1) return 1.3;
          return 1;
        }
        if (kind==='bundle'){
          const groups={};
          for(const i of meta.tiles||[]){ const t=T[i]; if(!t) continue; const g=t.color||t.group; if(!g) continue; groups[g]=(groups[g]||0)+1; }
          let mult=1;
          for(const [g,count] of Object.entries(groups)){
            const tiles=T.filter(t=> t&&t.type==='prop'&&(t.color===g||t.group===g));
            const owned=tiles.filter(t=> t.owner===playerId).length;
            const after=owned+count;
            if(after===tiles.length) mult=Math.max(mult,1.6);
            else if(after===tiles.length-1) mult=Math.max(mult,1.3);
          }
          return mult;
        }
        return 1;
      },
      maybeBid(profileName, playerId){
        const s=GameExtras._cfg.state; const a=s.auction; if (!a || !a.open) return;
        if (a.bestPlayer===playerId) return; // ya vamos ganando, no pujar de nuevo
        const prof=this.profiles[profileName||'value']; const p=(s.players||[]).find(x=>x.id===playerId); if(!p) return;
        const meta = (a.kind==='bundle') ? { tiles:a.bundleTiles } : (a.kind==='tile' ? GameExtras._getTile(a.assetId) : (a.kind==='loan' ? (s.loanListings||[]).find(x=>x.id===a.assetId): {}));
        const fair=this.estimateFair(a.kind, meta, playerId);
        const cap = Math.floor(fair * prof.maxOverpay);
        const next = Math.min(cap, Math.max(a.price, (a.bestBid||0)) + Math.ceil(fair*prof.bidStep));
        if (next> (a.bestBid||0) && (p.money||0)>=next){
          if (typeof global.placeBid === 'function') return safe(global.placeBid, playerId, next);
          a.bestBid = next; a.bestPlayer = playerId;
        }
      }
    },

    // ====== UI: Mi Balance ================================================
    showMyBalance(playerId){
      const s=this._cfg.state; const p=(s.players||[]).find(x=>x.id===playerId)||{};
      const debts = (s.loans||[]).filter(l=> l.borrowerId===playerId);
      const credits = (s.loans||[]).filter(l=> l.holderId===playerId);
      const debtNet = sum(debts.map(l=> (l.principal + (l.accrued||0)))) - sum(credits.map(l=> (l.principal + (l.accrued||0))));
      const props = (s.board||s.tiles||[]).reduce((n,t)=> n + (t?.owner===playerId?1:0), 0);
      const nextFee = this._estimateMaintenanceNext(playerId);

      let el=document.getElementById('my-balance');
      if(!el){ el=document.createElement('div'); el.id='my-balance'; document.body.appendChild(el);
        Object.assign(el.style,{position:'fixed', right:'12px', bottom:'12px', minWidth:'260px', padding:'12px 14px',
          background:'rgba(14,14,18,.92)', color:'#fff', borderRadius:'14px', boxShadow:'0 6px 20px rgba(0,0,0,.35)', fontFamily:'system-ui,Segoe UI,Roboto,Apple Color Emoji', fontSize:'14px', zIndex:99998});
      }
      el.innerHTML = `
        <div style="font-weight:700;font-size:16px;margin-bottom:6px;">Mi balance</div>
        <div>Cash: <b>${p.money??0}</b></div>
        <div>Deuda neta: <b>${debtNet}</b></div>
        <div>Propiedades: <b>${props}</b></div>
        <div>Mantenimiento próximo: <b>${nextFee}</b></div>
        <div style="margin-top:8px;display:flex;gap:6px;">
          <button id="mb-close" style="flex:1;padding:6px 8px;border-radius:10px;border:0;cursor:pointer">Cerrar</button>
          <button id="mb-refresh" style="flex:1;padding:6px 8px;border-radius:10px;border:0;cursor:pointer">Actualizar</button>
        </div>`;
      el.querySelector('#mb-close').onclick=()=> el.remove();
      el.querySelector('#mb-refresh').onclick=()=> this.showMyBalance(playerId);
    },

    _estimateMaintenanceNext(playerId){
      const s=this._cfg.state; const T=s.board||s.tiles||[]; let due=0;
      for (let i=0;i<T.length;i++){ const t=T[i]; if (t?.owner===playerId){
        const fee = (typeof t.maintenance==='number' ? t.maintenance : (t[this._cfg.maintenanceKey]? Math.ceil((t.price||0)*0.05): 0));
        due += fee;
      }}
      return due;
    },

    // ====== helpers ========================================================
    _getTile(i){ const s=this._cfg.state; const T=s.board||s.tiles||[]; return T[i]||null; }
  };

  global.GameExtras = GameExtras;

})(typeof window!=='undefined' ? window : globalThis);
