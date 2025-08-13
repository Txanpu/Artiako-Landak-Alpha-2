/*
  v21-securitization.js
  Extiende GameDebtMarket con:
  - Fraccionamiento de préstamos en participaciones (shares) transferibles.
  - Pools/paquetes de deuda (securitización) con unidades vendibles.
  - Subastas/ventas de shares y de unidades de pool reutilizando el overlay del módulo.
  - Enrutado de cobros a shares o pools (pro-rata) y compatibilidad con impagos.

  Requisitos: cargar DESPUÉS de auction+debt-market-v21.js

  API principal:
  GameSecuritization.install({ state })
  GameSecuritization.splitLoan(loanId, [ { ownerId, bips } , ... ])
  GameSecuritization.listLoanShareForSale(loanId, shareId, { type:'auction'|'fixed', minPrice, buyNow, sealed })
  GameSecuritization.startAuctionForLoanShare(listingId, { sealed })

  GameSecuritization.createLoanPool({ name, loanIds, unitsTotal=1000, ownerId })
  GameSecuritization.listPoolUnitsForSale(poolId, { units, minPrice, type, sealed })
  GameSecuritization.startAuctionForPoolUnits(listingId, { sealed })
  GameSecuritization.distributePool(poolId)  // reparte pool.cash a tenedores pro-rata
*/

(function(global){
  'use strict';

  const GDM = global.GameDebtMarket;
  if (!GDM) { console.warn('[SEC] GameDebtMarket no encontrado'); }

  const pick = (o,k,d)=> (o && k in o ? o[k] : d);
  const id = ()=>'s'+Math.random().toString(36).slice(2,10);
  const sum = arr => arr.reduce((a,b)=> a+(+b||0), 0);

  function safe(fn, ...args){ try{ return fn && fn(...args); }catch(e){ console.warn('[SEC]', e); } }

  const SEC = {
    _cfg:null,

    install(cfg={}){
      const state = cfg.state || global.state || {};
      if (!state.loanShareListings) state.loanShareListings = [];
      if (!state.loanPools) state.loanPools = [];
      if (!state.poolUnitListings) state.poolUnitListings = [];

      this._cfg = { state };

      // Parchear cobro para enrutar a shares o pool
      if (GDM){
        // _tryCollect
        GDM._tryCollect = (l)=> this._tryCollectPatched(l);
        // onIncome (impagos)
        const prevOnIncome = GDM.onIncome?.bind(GDM);
        GDM.onIncome = (playerId, amount)=> this._onIncomePatched(prevOnIncome, playerId, amount);

        // Extender cierre de subasta para nuevos assets
        const prevFinish = GDM._finishAuction?.bind(GDM) || (()=>{});
        GDM._finishAuction = ()=>{
          const s=this._cfg.state; const a=s.auction; if (!a||!a.open) return prevFinish();
          if (a.kind==='loanShare'){
            a.open=false;
            if (a.bestPlayer && a.bestBid>0) this._buyLoanShare(a.assetId, a.bestPlayer, a.bestBid);
            return safe(GDM._closeAuctionOverlay?.bind(GDM));
          }
          if (a.kind==='poolUnit'){
            a.open=false;
            if (a.bestPlayer && a.bestBid>0) this._buyPoolUnits(a.assetId, a.bestPlayer, a.bestBid);
            return safe(GDM._closeAuctionOverlay?.bind(GDM));
          }
          return prevFinish();
        };
      }
      return this;
    },

    // ====== SHARES =========================================================
    splitLoan(loanId, shares){
      const s=this._cfg.state; const loan=s.loans?.find(l=> l.id===loanId); if(!loan) return null;
      const total = sum((shares||[]).map(x=> +x.bips||0));
      if (total!==10000) throw new Error('La suma de bips debe ser 10000');
      loan.shares = shares.map(x=> ({ id:id(), ownerId:x.ownerId, bips: Math.max(0, Math.min(10000, ~~x.bips)) }));
      loan.holderId = null; // ya no hay único tenedor
      return loan.shares.map(x=> x.id);
    },

    listLoanShareForSale(loanId, shareId, opts={}){
      const s=this._cfg.state; const loan=s.loans?.find(l=> l.id===loanId); if(!loan||!loan.shares) return null;
      const sh=loan.shares.find(x=> x.id===shareId); if(!sh) return null;
      const sellerId = sh.ownerId;
      const L={ id:id(), loanId, shareId, sellerId, type: opts.type==='auction'?'auction':'fixed', minPrice: Math.max(1, ~~(opts.minPrice||1)), sealed: !!opts.sealed, buyNow: opts.buyNow? Math.max(1, ~~opts.buyNow): undefined };
      s.loanShareListings.push(L);
      if (L.type==='auction') this.startAuctionForLoanShare(L.id, { sealed:L.sealed });
      return L.id;
    },

    startAuctionForLoanShare(listingId, opts={}){
      const s=this._cfg.state; const L=s.loanShareListings.find(x=> x.id===listingId); if(!L) return;
      s.auction = { kind:'loanShare', assetId: L.id, open:true, sealed: !!opts.sealed, bestBid:0, bestPlayer:null, price: Math.max(1, L.minPrice), active: new Set((s.players||[]).filter(p=>p?.alive!==false).map(p=>p.id)), bids: opts.sealed? {}: undefined, timer:null };
      safe(GDM && GDM._openAuctionOverlay?.bind(GDM), 'loanShare', L, { sealed:s.auction.sealed });
    },

    _buyLoanShare(listingId, buyerId, price){
      const s=this._cfg.state; const L=s.loanShareListings.find(x=> x.id===listingId); if(!L) return;
      const loan=s.loans?.find(l=> l.id===L.loanId); const sh=loan?.shares?.find(x=> x.id===L.shareId);
      const buyer=this._getPlayer(buyerId), seller=this._getPlayer(L.sellerId);
      if (!loan||!sh||!buyer||!seller) return;
      if ((buyer.money||0)<price) return;
      buyer.money -= price; seller.money = (seller.money||0) + price;
      sh.ownerId = buyerId;
      s.loanShareListings = s.loanShareListings.filter(x=> x.id!==listingId);
    },

    // ====== POOLS ==========================================================
    createLoanPool({ name, loanIds, unitsTotal=1000, ownerId }){
      const s=this._cfg.state; if(!Array.isArray(loanIds)||loanIds.length===0) return null;
      const P={ id:id(), name: name||('Pool '+id()), loanIds: loanIds.slice(), unitsTotal: Math.max(1, ~~unitsTotal), holdings: {}, cash:0 };
      P.holdings[ownerId] = P.unitsTotal; // MVP: todo para el creador; luego puede vender
      s.loanPools.push(P);
      // enlaza préstamos al pool
      for (const lid of loanIds){ const L=s.loans?.find(x=> x.id===lid); if (L){ L.poolId = P.id; } }
      return P.id;
    },

    listPoolUnitsForSale(poolId, { units, minPrice, type='auction', sealed=false, buyNow }){
      const s=this._cfg.state; const P=s.loanPools.find(p=> p.id===poolId); if(!P) return null;
      const sellerId = this._currentPlayer()?.id;
      if (!sellerId || (P.holdings[sellerId]||0) < units) return null;
      const L={ id:id(), poolId, sellerId, units: Math.max(1, ~~units), minPrice: Math.max(1, ~~minPrice), type, sealed: !!sealed, buyNow: buyNow? Math.max(1, ~~buyNow): undefined };
      s.poolUnitListings.push(L);
      if (type==='auction') this.startAuctionForPoolUnits(L.id, { sealed });
      return L.id;
    },

    startAuctionForPoolUnits(listingId, opts={}){
      const s=this._cfg.state; const L=s.poolUnitListings.find(x=> x.id===listingId); if(!L) return;
      s.auction = { kind:'poolUnit', assetId: L.id, open:true, sealed: !!opts.sealed, bestBid:0, bestPlayer:null, price: Math.max(1, L.minPrice), active: new Set((s.players||[]).filter(p=>p?.alive!==false).map(p=>p.id)), bids: opts.sealed? {}: undefined, timer:null };
      safe(GDM && GDM._openAuctionOverlay?.bind(GDM), 'poolUnit', L, { sealed:s.auction.sealed });
    },

    _buyPoolUnits(listingId, buyerId, price){
      const s=this._cfg.state; const L=s.poolUnitListings.find(x=> x.id===listingId); if(!L) return;
      const P=s.loanPools.find(p=> p.id===L.poolId); const buyer=this._getPlayer(buyerId), seller=this._getPlayer(L.sellerId);
      if(!P||!buyer||!seller) return; if ((buyer.money||0)<price) return;
      // transferir unidades
      const units=L.units; if ((P.holdings[seller.id]||0) < units) return;
      buyer.money -= price; seller.money = (seller.money||0) + price;
      P.holdings[seller.id] = (P.holdings[seller.id]||0) - units;
      P.holdings[buyer.id] = (P.holdings[buyer.id]||0) + units;
      s.poolUnitListings = s.poolUnitListings.filter(x=> x.id!==listingId);
    },

    distributePool(poolId){
      const s=this._cfg.state; const P=s.loanPools.find(p=> p.id===poolId); if(!P) return 0;
      const cash=P.cash||0; if (cash<=0) return 0;
      const totalUnits = Object.values(P.holdings).reduce((a,b)=> a+(+b||0), 0) || 1;
      let rem = cash;
      for (const [playerId, units] of Object.entries(P.holdings)){
        const p=this._getPlayer(playerId); if (!p) continue;
        const share = Math.floor(cash * (units/totalUnits));
        if (share>0){ p.money = (p.money||0) + share; rem -= share; }
      }
      // redondeo residual al primer holder
      const firstId = Object.keys(P.holdings)[0]; if (rem>0 && firstId){ const p=this._getPlayer(firstId); if (p) p.money=(p.money||0)+rem; rem=0; }
      P.cash = 0; return cash;
    },

    // ====== ROUTING ========================================================
    _tryCollectPatched(l){
      const s=this._cfg.state; if (!l || l.status!=='active') return;
      const debtor=this._getPlayer(l.borrowerId); const due=l.accrued||0; if(!debtor) return;
      if ((debtor.money||0) >= due && due>0){
        debtor.money -= due; l.accrued = 0;
        this._routeCollected(l, due);
      } else if (due>0){
        // impago: delega en lógica de default del módulo
        GDM._markDefault?.(l);
      }
    },

    _onIncomePatched(prev, playerId, amount){
      const s=this._cfg.state; let net = amount;
      for (const l of (s.loans||[])){
        if (l.status==='defaulted' && l.borrowerId===playerId){
          // en impago, el holder real cobra
          this._routeCollected(l, amount);
          l.accrued = Math.max(0, (l.accrued||0) - amount);
          net = 0;
          if (l.accrued<=0) l.status='active';
        }
      }
      return net;
    },

    _routeCollected(l, amount){
      if (l.poolId){
        const P=this._cfg.state.loanPools.find(p=> p.id===l.poolId); if (P) P.cash = (P.cash||0) + amount;
        return;
      }
      if (Array.isArray(l.shares) && l.shares.length){
        let rem=amount; const total=10000;
        for (const sh of l.shares){
          const p=this._getPlayer(sh.ownerId); if (!p) continue;
          const pay = Math.floor(amount * (sh.bips/total));
          if (pay>0){ p.money = (p.money||0) + pay; rem -= pay; }
        }
        if (rem>0){ const p=this._getPlayer(l.shares[0].ownerId); if (p) p.money = (p.money||0) + rem; }
        return;
      }
      // único tenedor
      const holder=this._getPlayer(l.holderId); if (holder) holder.money=(holder.money||0)+amount;
    },

    // ====== utils ==========================================================
    _getPlayer(id){
      const s=this._cfg.state; return (s.players||[]).find(p=> p && p.id===id) || null;
    },
    _currentPlayer(){ const s=this._cfg.state; const idx=s.currentPlayerIndex||0; return (s.players||[])[idx]||null; }
  };

  global.GameSecuritization = SEC;

})(typeof window!=='undefined'? window : globalThis);
