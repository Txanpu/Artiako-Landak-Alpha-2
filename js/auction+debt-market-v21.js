/*
  auction+debt-market-v21.js
  Drop-in módulo para:
  1) Arreglar subasta al caer en propiedad sin dueño (visible).
  2) Mantener subasta sellada SOLO para eventos.
  3) Añadir Mercado de Deuda (préstamos P2P transferibles) con ventas fijas y subastas (visibles u ocultas).

  Uso rápido:
  - Carga este script DESPUÉS de tu core (v20-part6.js).
  - Llama a GameDebtMarket.install({ state, ui, fixPropertyAuction: true }).
  - En tu onLand de propiedad, llama a GameDebtMarket.onLandProperty(tileIndex, tileObj).
  - Para EVENTOS con subasta oculta: GameDebtMarket.startAuctionForTile(tileIndex, { sealed:true })
    o para préstamos: GameDebtMarket.startAuctionForLoan(listingId, { sealed:true })

  No asume un framework concreto: detecta funciones globales (showCard, startAuctionFlow, etc.) si existen.
*/

(function (global) {
  'use strict';

  const pick = (o, k, d) => (o && k in o ? o[k] : d);
  const nowId = () => 'x' + Math.random().toString(36).slice(2, 10);

  function safeGet(globalName) { return typeof global[globalName] !== 'undefined' ? global[globalName] : undefined; }

  const GameDebtMarket = {
    _cfg: null,

    install(cfg = {}) {
      // cfg: { state, ui, fixPropertyAuction }
      const state = cfg.state || safeGet('state') || {};
      const ui = cfg.ui || {};

      if (!state.loans) state.loans = [];
      if (!state.loanListings) state.loanListings = [];

      this._cfg = { state, ui, fixPropertyAuction: !!cfg.fixPropertyAuction };

      // parchear startAuctionFlow para aceptar opts.sealed y exponer asset-kind
      this._patchAuctions();

      return this;
    },

    // ===== AUCTIONS =========================================================
    _patchAuctions() {
      const state = this._cfg.state;

      // Base: si existe startAuctionFlow original, lo envainamos para tiles.
      const originalStartAuction = safeGet('startAuctionFlow');

      // API pública unificada
      this.startAuctionForTile = (tileIndex, opts = {}) => {
        const sealed = this._resolveSealed(opts);
        if (typeof originalStartAuction === 'function') {
          // Llamamos a la versión del juego si existe. Se espera que lea "opts.sealed".
          try { originalStartAuction(tileIndex, { sealed }); return; } catch (_) {}
        }
        // Fallback: nuestro flujo genérico
        this._startAuctionFlowAsset('tile', tileIndex, { sealed });
      };

      this.startAuctionForLoan = (listingId, opts = {}) => {
        const sealed = this._resolveSealed(opts);
        this._startAuctionFlowAsset('loan', listingId, { sealed });
      };

      this.finishAuction = () => this._finishAuction();
    },

    _resolveSealed(opts) {
      const state = this._cfg.state;
      if (typeof opts.sealed === 'boolean') return opts.sealed;
      // Por defecto: visible salvo que un EVENTO marque _eventAuction
      return !!state._eventAuction;
    },

    _startAuctionFlowAsset(kind, assetId, opts = {}) {
      const state = this._cfg.state;
      const sealed = !!opts.sealed;

      const meta = (kind === 'tile')
        ? this._getTile(assetId)
        : (kind === 'loan')
          ? state.loanListings.find(x => x && x.id === assetId)
          : null;
      if (!meta) { console.warn('[DM] asset no encontrado para subasta', kind, assetId); return; }

      const basePrice = (kind === 'tile') ? Math.max(1, meta.price || 1)
                      : (kind === 'loan') ? Math.max(1, pick(meta, 'minPrice', 1))
                      : 1;

      state.auction = {
        kind,
        assetId,
        open: true,
        sealed,
        bestBid: 0,
        bestPlayer: null,
        active: new Set((state.players || []).filter(p => p && p.alive !== false).map(p => p.id)),
        price: basePrice,
        bids: sealed ? {} : undefined,
        timer: null
      };

      this._openAuctionOverlay(kind, meta, { sealed });
    },

    _finishAuction() {
      const state = this._cfg.state;
      const a = state.auction;
      if (!a || !a.open) return;
      a.open = false;

      if (a.bestPlayer && a.bestBid > 0) {
        if (a.kind === 'tile') {
          this._assignTileTo(a.assetId, a.bestPlayer, a.bestBid);
        } else if (a.kind === 'loan') {
          this._buyLoan(a.assetId, a.bestPlayer, a.bestBid);
        }
      }
      this._closeAuctionOverlay();
    },

    // ===== PROPERTY LANDING FIX ============================================
    onLandProperty(tileIndex, tileObj) {
      const state = this._cfg.state;
      const t = tileObj || this._getTile(tileIndex);
      if (!t) return;
      if (t.owner == null) {
        // Mostrar carta si existe API
        const showCard = safeGet('showCard');
        try { if (typeof showCard === 'function') showCard(tileIndex, { canAuction: true }); } catch (_) {}
        // Subasta visible al caer
        this.startAuctionForTile(tileIndex, { sealed: false });
        return;
      }
      // si tiene dueño: no tocamos tu lógica
    },

    // ===== DEBT MARKET ======================================================
    mkLoan(params) {
      const state = this._cfg.state;
      const {
        borrowerId, lenderId,
        principal, ratePct, termTurns,
        collateralTileIds = []
      } = params;
      return {
        id: nowId(),
        borrowerId, lenderId, holderId: lenderId,
        principal: Math.max(1, ~~principal),
        ratePct: Math.max(0, +ratePct || 0),
        termTurns: Math.max(1, ~~termTurns),
        startTurn: state.turnCount || 0,
        dueTurn: (state.turnCount || 0) + Math.max(1, ~~termTurns),
        accrued: 0,
        lastAccrualTurn: state.turnCount || 0,
        collateralTileIds: Array.isArray(collateralTileIds) ? collateralTileIds.slice(0, 4) : [],
        status: 'active',
        history: []
      };
    },

    addLoan(loan) {
      const state = this._cfg.state;
      state.loans.push(loan);
      return loan.id;
    },

    listLoanForSale(loanId, opts) {
      const state = this._cfg.state;
      const loan = state.loans.find(l => l.id === loanId);
      const current = this._currentPlayer();
      if (!loan || !current || loan.holderId !== current.id) return null;
      const listing = {
        id: nowId(),
        loanId, sellerId: current.id,
        type: opts?.type === 'auction' ? 'auction' : 'fixed',
        minPrice: Math.max(1, ~~(opts?.minPrice || 1)),
        buyNow: opts?.buyNow ? Math.max(opts.buyNow, 1) : undefined,
        expiresTurn: (this._cfg.state.turnCount || 0) + (opts?.ttlTurns || 8),
        sealed: !!opts?.sealed
      };
      state.loanListings.push(listing);

      if (listing.type === 'auction') {
        this.startAuctionForLoan(listing.id, { sealed: listing.sealed });
      } else {
        this._openMarketOverlay('loan', listing);
      }
      return listing.id;
    },

    cancelLoanListing(listingId) {
      const state = this._cfg.state;
      state.loanListings = state.loanListings.filter(x => x.id !== listingId);
    },

    // ===== TURN HOOKS =======================================================
    onTurnStart(playerId) {
      const state = this._cfg.state;
      state.loans.forEach(l => { this._accrueLoan(l); if (l.borrowerId === playerId) this._tryCollect(l); });
    },

    onTurnEnd(playerId) {
      const state = this._cfg.state;
      state.loans.forEach(l => {
        if (l.status === 'defaulted' && l.borrowerId === playerId && (state.turnCount || 0) >= (l.defaultUntil || 0)) {
          // Ejecutar colateral mínimo viable: subasta forzosa de la primera tile
          const tileId = (l.collateralTileIds || [])[0];
          if (tileId != null) this.startAuctionForTile(tileId, { sealed: false });
        }
      });
    },

    // Si tu motor ya tiene un hook de ingresos, llama a esta función y devuelve el neto
    onIncome(playerId, amount) {
      const state = this._cfg.state;
      let net = amount;
      state.loans.forEach(l => {
        if (l.status === 'defaulted' && l.borrowerId === playerId) {
          const holder = this._getPlayer(l.holderId);
          if (holder) holder.money = (holder.money || 0) + amount;
          l.accrued = Math.max(0, (l.accrued || 0) - amount);
          net = 0;
          if (l.accrued <= 0) l.status = 'active';
        }
      });
      return net;
    },

    // ===== Internals: loans ================================================
    _accrueLoan(l) {
      const state = this._cfg.state;
      const dt = (state.turnCount || 0) - (l.lastAccrualTurn || 0);
      if (dt <= 0 || l.status !== 'active') return;
      // Interés lineal por turnos (simple). Ajusta a tu fórmula.
      const add = Math.ceil(l.principal * (l.ratePct / 100) * dt / Math.max(1, l.termTurns));
      l.accrued = (l.accrued || 0) + add;
      l.lastAccrualTurn = (state.turnCount || 0);
    },

    _tryCollect(l) {
      if (l.status !== 'active') return;
      const debtor = this._getPlayer(l.borrowerId);
      const due = l.accrued || 0;
      if (!debtor) return;
      if ((debtor.money || 0) >= due && due > 0) {
        debtor.money -= due;
        const holder = this._getPlayer(l.holderId);
        if (holder) holder.money = (holder.money || 0) + due;
        l.accrued = 0;
      } else if (due > 0) {
        this._markDefault(l);
      }
    },

    _markDefault(l) {
      if (l.status !== 'active') return;
      l.status = 'defaulted';
      l.defaultUntil = (this._cfg.state.turnCount || 0) + 4; // embargo 4 turnos
    },

    _buyLoan(listingId, buyerId, price) {
      const state = this._cfg.state;
      const L = state.loanListings.find(x => x.id === listingId);
      if (!L) return;
      const loan = state.loans.find(x => x.id === L.loanId);
      const buyer = this._getPlayer(buyerId);
      const seller = this._getPlayer(L.sellerId);
      if (!loan || !buyer || !seller) return;
      if ((buyer.money || 0) < price) return;
      buyer.money -= price;
      seller.money = (seller.money || 0) + price;
      loan.history.push({ turn: state.turnCount || 0, from: seller.id, to: buyer.id, price });
      loan.holderId = buyer.id;
      state.loanListings = state.loanListings.filter(x => x.id !== listingId);
    },

    // ===== Utilities: game adapters ========================================
    _getTile(idx) {
      const state = this._cfg.state;
      if (Array.isArray(state.board) && state.board[idx]) return state.board[idx];
      if (Array.isArray(state.tiles) && state.tiles[idx]) return state.tiles[idx];
      return null;
    },

    _assignTileTo(tileIndex, playerId, price) {
      const state = this._cfg.state;
      const t = this._getTile(tileIndex);
      const p = this._getPlayer(playerId);
      if (!t || !p) return;
      t.owner = playerId;
      p.money = (p.money || 0) - price;
    },

    _getPlayer(id) {
      const state = this._cfg.state;
      const byId = (state.players || []).find(p => p && p.id === id);
      if (byId) return byId;
      const Estado = safeGet('Estado');
      if (Estado && Estado.players) return Estado.players.find(p => p && p.id === id);
      return null;
    },

    _currentPlayer() {
      const state = this._cfg.state;
      const idx = state.currentPlayerIndex || (state.turn && state.turn.playerIndex) || 0;
      return (state.players || [])[idx];
    },

    // ===== UI shims =========================================================
    _openAuctionOverlay(kind, meta, { sealed }) {
      // Si tu juego ya tiene overlay, úsalo. Si no, creamos uno básico.
      const openAuctionOverlay = safeGet('openAuctionOverlay');
      if (typeof openAuctionOverlay === 'function') { try { openAuctionOverlay(kind, meta, { sealed }); return; } catch (_) {} }
      this._basicOverlay(`Subasta ${kind}${sealed ? ' (oculta)' : ''}`);
    },

    _closeAuctionOverlay() {
      const closeAuctionOverlay = safeGet('closeAuctionOverlay');
      if (typeof closeAuctionOverlay === 'function') { try { closeAuctionOverlay(); return; } catch (_) {} }
      this._basicOverlayClose();
    },

    _openMarketOverlay(kind, listing) {
      const openMarketOverlay = safeGet('openMarketOverlay');
      if (typeof openMarketOverlay === 'function') { try { openMarketOverlay(kind, listing); return; } catch (_) {} }
      this._basicOverlay('Mercado: préstamo listado.');
    },

    _basicOverlay(text) {
      let el = document.getElementById('dm-overlay');
      if (!el) {
        el = document.createElement('div'); el.id = 'dm-overlay';
        Object.assign(el.style, { position: 'fixed', inset: '0', background: 'rgba(0,0,0,.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, fontFamily: 'system-ui, sans-serif', fontSize: '20px' });
        el.addEventListener('click', () => this._basicOverlayClose());
        document.body.appendChild(el);
      }
      el.textContent = text || '...';
      el.style.display = 'flex';
    },

    _basicOverlayClose() {
      const el = document.getElementById('dm-overlay'); if (el) el.style.display = 'none';
    }
  };

  // Exponer global
  global.GameDebtMarket = GameDebtMarket;

})(typeof window !== 'undefined' ? window : globalThis);
