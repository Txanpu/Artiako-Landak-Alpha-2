/*
  v21-ui-graphics.js
  UI pack: tablero 2D + heatmap, estados por borde/color, iconos SDF con microglow,
  tickets visuales de deuda, panel "Mi balance" con sparklines, toggle "Zonas calientes".

  Diseñado como add-on no intrusivo. No depende de frameworks. Trabaja con:
  - state.tiles / state.board (propiedades con {type:'prop', owner, price, rent, color, mortgaged, collateral})
  - state.players (con {id, money})
  - GameDebtMarket (opcional) para leer loans
  - GameRiskPlus (opcional) para umbral de margin call y mantenimiento dinámico

  Uso mínimo:
    UIX.install({ state, map:{ fromDOM: '.tile' } });
    // o pásale tu map: { tileBounds:(i)=>({x,y,w,h}) }

    // Heatmap vivo
    UIX.track.onLand(tileIndex);
    UIX.track.onRent(tileIndex, amount);
    UIX.heatmap.toggle({ metric:'landings', windowTurns:20 });

    // Estados por borde + iconos
    UIX.board.paintStates();

    // Ticket de préstamo (DOM node)
    const el = UIX.debt.ticket(loanObject);
    document.body.appendChild(el);

    // Panel Mi balance
    UIX.balance.show(playerId);
*/

(function(global){
  'use strict';

  const pick=(o,k,d)=> (o && k in o ? o[k] : d);
  const clamp=(x,a,b)=> Math.max(a, Math.min(b,x));
  const sum = arr=> arr.reduce((a,b)=> a+(+b||0), 0);

  const UIX={
    _cfg:null,
    _els:{},
    _theme:'neon',
    _metrics:{
      history:[], // [{turn, landings:Map<idx,count>, rents:Map<idx,amount>}] por vuelta
      landings: new Map(),
      rents: new Map()
    },

    install(cfg={}){
      const state = cfg.state || global.state || {};
      const map = cfg.map || {};
      this._cfg={ state, map };
      this._theme = cfg.theme || 'neon';
      this._injectCSS();
      if (map.fromDOM) this._mapFromDOM(map.fromDOM);
      this._ensureHeatCanvas();
      return this;
    },

    // ========== MAPPING ====================================================
    _mapFromDOM(selector){
      const nodes=[...document.querySelectorAll(selector)];
      const bounds = nodes.map(n=> ({ el:n, rect:n.getBoundingClientRect() }));
      const page = document.documentElement;
      const scrollX = window.scrollX||page.scrollLeft||0;
      const scrollY = window.scrollY||page.scrollTop||0;
      const view={ left:scrollX, top:scrollY };
      this._cfg.map.tileBounds = (i)=>{
        const b=bounds[i]?.rect; if (!b) return { x: 40+i*20, y: 40, w: 40, h: 40 };
        return { x: b.left+view.left, y: b.top+view.top, w: b.width, h: b.height };
      };
    },

    _defaultBounds(i){ // fallback: anillo rectangular simple para N tiles
      const T=this._tiles(); const N=T.length||40; const side=Math.ceil(N/4);
      const cell=36; const pad=12; const W=(side+2)*cell, H=(side+2)*cell; const offX=20, offY=20;
      const idx=(i%N+N)%N;
      const sideIdx=Math.floor(idx/side), pos=idx%side;
      let x=offX+pad, y=offY+pad;
      if (sideIdx===0){ x+= cell*pos; y+=0; }
      else if (sideIdx===1){ x+= cell*(side-1); y+= cell*pos; }
      else if (sideIdx===2){ x+= cell*(side-1-pos); y+= cell*(side-1); }
      else { x+=0; y+= cell*(side-1-pos); }
      return { x, y, w: cell, h: cell };
    },

    _bounds(i){ return (this._cfg.map.tileBounds && this._cfg.map.tileBounds(i)) || this._defaultBounds(i); },

    _tiles(){ return this._cfg.state.board || this._cfg.state.tiles || []; },

    // ========== HEATMAP ====================================================
    _ensureHeatCanvas(){
      let c=document.getElementById('uix-heat'); if (!c){
        c=document.createElement('canvas'); c.id='uix-heat';
        Object.assign(c.style,{ position:'absolute', left:0, top:0, pointerEvents:'none', zIndex: 9990 });
        document.body.appendChild(c);
        const resize=()=>{ c.width=window.innerWidth; c.height=window.innerHeight; this.heatmap.render(); };
        window.addEventListener('resize', resize); resize();
      }
      this._els.heat=c;
    },

    track:{
      onTurn(turn){ const S=UIX._metrics; S.history.push({ turn, landings:new Map(), rents:new Map() }); if (S.history.length>100) S.history.shift(); },
      onLand(i){ const S=UIX._metrics; S.landings.set(i, (S.landings.get(i)||0)+1); const h=S.history.at(-1); if (h) h.landings.set(i, (h.landings.get(i)||0)+1); },
      onRent(i, amt){ const S=UIX._metrics; S.rents.set(i, (S.rents.get(i)||0)+amt); const h=S.history.at(-1); if (h) h.rents.set(i, (h.rents.get(i)||0)+amt); }
    },

    heatmap:{
      visible:false,
      opts:{ metric:'landings', windowTurns:20 },
      toggle(opts){ this.visible = !this.visible; if (opts) Object.assign(this.opts, opts); UIX.heatmap.render(); },
      render(){ const c=UIX._els.heat; if (!c) return; const g=c.getContext('2d'); g.clearRect(0,0,c.width,c.height); if (!this.visible) return;
        const m=this.opts.metric; const N=UIX._tiles().length;
        // construye series según ventana
        const S=UIX._metrics; const hist=S.history.slice(-this.opts.windowTurns);
        const agg=new Map();
        for (const h of hist){ const mm=(m==='rents'? h.rents : h.landings); for (const [k,v] of mm) agg.set(k, (agg.get(k)||0)+v); }
        const max= Math.max(1, ...agg.values());
        for (let i=0;i<N;i++){
          const val=agg.get(i)||0; if (val<=0) continue;
          const t=UIX._bounds(i); const alpha= clamp(val/max, 0.06, 1);
          const grad=g.createRadialGradient(t.x+t.w/2, t.y+t.h/2, 0, t.x+t.w/2, t.y+t.h/2, Math.max(t.w,t.h)/1.1);
          grad.addColorStop(0, `rgba(255, 80, 0, ${0.35*alpha})`);
          grad.addColorStop(1, `rgba(255, 80, 0, 0)`);
          g.fillStyle=grad; g.fillRect(t.x, t.y, t.w, t.h);
        }
      }
    },

    // ========== BOARD STATES ==============================================
    board:{
      paintStates(){
        const N=UIX._tiles().length; const layer=UIX._ensureStateLayer(); const g=layer.getContext('2d');
        g.clearRect(0,0,layer.width,layer.height);
        for (let i=0;i<N;i++){
          const t=UIX._tiles()[i]; if (!t || t.type!=='prop') continue;
          const b=UIX._bounds(i);
          const st = UIX.board._stateForTile(i, t);
          // fondo tenue por propietario
          if (st.fill){ g.fillStyle = st.fill; g.globalAlpha=0.10; g.fillRect(b.x+1, b.y+1, b.w-2, b.h-2); g.globalAlpha=1; }
          // borde
          g.lineWidth = 3; g.strokeStyle = st.stroke || '#888';
          g.strokeRect(b.x+1.5, b.y+1.5, b.w-3, b.h-3);
          // icono
          const ic=UIX.icons.pick(st.icon); if (ic) UIX.icons.draw(g, ic, b.x+b.w/2, b.y+b.h/2, Math.min(b.w,b.h)*0.44, st.iconGlow);
        }
      },
      _stateForTile(i,t){
        const owner = t.owner; const me = UIX._currentPlayerId();
        const base = { fill:null, stroke:'#666', icon:null, iconGlow:false };
        if (owner==null){ return { ...base, stroke:'#AAB', icon:'event' }; }
        const same = owner===me; const col = same? '#37E2B3' : '#E95F5F';
        let stroke=col, fill= same? '#37E2B3' : '#E95F5F';
        let icon='rent';
        if (t.mortgaged){ stroke='#B09BF4'; icon='debt'; }
        if (t.collateral){ stroke='#F5A524'; icon='debt'; }
        if (UIX._isInAuction(i)){ stroke='#FFD166'; icon='auction'; }
        return { fill, stroke, icon, iconGlow:true };
      }
    },

    _ensureStateLayer(){ let c=document.getElementById('uix-state'); if (!c){ c=document.createElement('canvas'); c.id='uix-state'; Object.assign(c.style,{ position:'absolute', left:0, top:0, pointerEvents:'none', zIndex: 9988 }); document.body.appendChild(c); const resize=()=>{ c.width=window.innerWidth; c.height=window.innerHeight; }; window.addEventListener('resize', resize); resize(); } this._els.state=c; return c; },

    _isInAuction(i){ const s=this._cfg.state; const a=s.auction; return !!(a && a.open && ((a.kind==='tile' && a.assetId===i) || (a.kind==='bundle' && a.bundleTiles?.includes(i)))); },

    // ========== ICONOS =====================================================
    icons:{
      pick(name){ return this._defs[name]||null; },
      draw(g, def, cx, cy, size, glow){ g.save(); g.translate(cx,cy); g.scale(size/24, size/24); g.beginPath(); for (const cmd of def){ const [op,...p]=cmd; if(op==='M') g.moveTo(p[0],p[1]); else if(op==='L') g.lineTo(p[0],p[1]); else if(op==='B') g.bezierCurveTo(p[0],p[1],p[2],p[3],p[4],p[5]); } g.closePath(); g.fillStyle='rgba(240,240,255,0.85)'; g.fill(); if (glow){ g.shadowColor='rgba(120,180,255,0.6)'; g.shadowBlur=8; g.fill(); } g.restore(); },
      _defs:{
        rent:   [['M',12,5],['L',21,12],['L',12,19],['L',3,12]],
        event:  [['M',12,3],['L',21,21],['L',3,21]],
        debt:   [['M',6,6],['L',18,6],['L',18,18],['L',6,18]],
        auction:[['M',4,20],['L',20,20],['L',12,4]]
      }
    },

    // ========== DEUDA: TICKET =============================================
    debt:{
      ticket(loan){ const d=document.createElement('div'); d.className='uix-ticket'; const icon=(svg)=> `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">${svg}</svg>`;
        const collat = (loan.collateralTileIds||[]).map(i=> `<span class="tag">#${i}</span>`).join('');
        d.innerHTML=`
          <div class="row head"><span class="k">Préstamo</span><span class="v">${loan.id||''}</span></div>
          <div class="row"><span class="k">Principal</span><span class="v">${loan.principal}</span></div>
          <div class="row"><span class="k">Interés</span><span class="v">${loan.ratePct}%</span></div>
          <div class="row"><span class="k">Vence</span><span class="v">T${loan.dueTurn}</span></div>
          <div class="row"><span class="k">Devengado</span><span class="v">${loan.accrued||0}</span></div>
          <div class="row"><span class="k">Colateral</span><span class="v">${collat||'<i>ninguno</i>'}</span></div>`;
        return d; }
    },

    // ========== BALANCE PANEL =============================================
    balance:{
      show(playerId){ const p=UIX._player(playerId)||{}; let el=document.getElementById('uix-balance'); if(!el){ el=document.createElement('div'); el.id='uix-balance'; document.body.appendChild(el); }
        el.className='uix-balance'; el.innerHTML=`
          <div class="title">Mi balance</div>
          <div class="cards">
            <div class="card"><div class="k">Cash</div><div class="v" id="v-cash">${p.money||0}</div><canvas id="sp-cash" width="120" height="28"></canvas></div>
            <div class="card"><div class="k">Deuda neta</div><div class="v" id="v-debt">${UIX.balance._debtNet(playerId)}</div><canvas id="sp-debt" width="120" height="28"></canvas></div>
            <div class="card"><div class="k">Mantenimiento</div><div class="v" id="v-maint">${UIX.balance._maintNext(playerId)}</div><canvas id="sp-maint" width="120" height="28"></canvas></div>
            <div class="card"><div class="k">Propiedades</div><div class="v" id="v-props">${UIX.balance._propsCount(playerId)}</div><canvas id="sp-props" width="120" height="28"></canvas></div>
            <div class="card"><div class="k">Patrimonio</div><div class="v" id="v-net">${UIX.balance._netWorth(playerId)}</div><canvas id="sp-net" width="120" height="28"></canvas></div>
            <div class="card"><div class="k">ROI medio</div><div class="v" id="v-roi">${UIX.balance._roiAvg(playerId).toFixed(2)}%</div><canvas id="sp-roi" width="120" height="28"></canvas></div>
          </div>
          <div class="risk"><div class="label">Riesgo de liquidez</div><div class="bar"><div class="fill" id="risk-fill"></div></div></div>
          <div class="actions"><button id="uix-balance-close">Cerrar</button><button id="uix-balance-refresh">Actualizar</button></div>`;
        el.querySelector('#uix-balance-close').onclick=()=> el.remove();
        el.querySelector('#uix-balance-refresh').onclick=()=> UIX.balance.show(playerId);
        // sparklines dummy: usa historial de metricas en memoria
        UIX._spark('sp-cash', UIX._metricSeries('cash', playerId));
        UIX._spark('sp-debt', UIX._metricSeries('debt', playerId));
        UIX._spark('sp-maint', UIX._metricSeries('maint', playerId));
        UIX._spark('sp-props', UIX._metricSeries('props', playerId));
        UIX._spark('sp-net', UIX._metricSeries('net', playerId));
        UIX._spark('sp-roi', UIX._metricSeries('roi', playerId));
        // riesgo
        const thr = pick(global.GameRiskPlus?._cfg?.margin, 'cashThreshold', 100);
        const ratio = clamp((p.money||0) / Math.max(1,thr), 0, 1);
        el.querySelector('#risk-fill').style.width = (ratio*100).toFixed(0)+'%';
      },
      _debtNet(pid){ const s=UIX._cfg.state; const debts=(s.loans||[]).filter(l=> l.borrowerId===pid); const credits=(s.loans||[]).filter(l=> l.holderId===pid); return sum(debts.map(l=> l.principal+(l.accrued||0))) - sum(credits.map(l=> l.principal+(l.accrued||0))); },
      _maintNext(pid){ if (global.GameRiskPlus) return global.GameRiskPlus._maintenanceNext(pid); const s=UIX._cfg.state; const T=s.board||s.tiles||[]; let due=0; for (let i=0;i<T.length;i++){ const t=T[i]; if (t?.owner===pid){ const base=Math.ceil((t.price||0)*0.05); due+=base; } } return due; },
      _roiAvg(pid){ // proxy: total rentas últimas 10 / valor de compra estimado
        const s=UIX._cfg.state; const rents=0; // plug real si tienes histórico
        const owned=(s.board||s.tiles||[]).filter(t=> t?.owner===pid);
        const base=sum(owned.map(t=> t.price||0)); if (!base) return 0; return (rents/base)*100;
      },
      _propsCount(pid){ const p=UIX._player(pid)||{}; return (p.props||[]).length; },
      _netWorth(pid){ const p=UIX._player(pid)||{}; const s=UIX._cfg.state; const T=s.board||s.tiles||[]; const props=sum((p.props||[]).map(i=>T[i]?.price||0)); return (p.money||0)+props-UIX.balance._debtNet(pid); }
    },

    _metricSeries(kind, pid){ // genera serie dummy de 10 puntos con ruido leve; reemplaza con tu telemetría
      const p=this._player(pid)||{}; const base={ cash:p.money||0, debt:this.balance._debtNet(pid), maint:this.balance._maintNext(pid), roi:this.balance._roiAvg(pid), props:this.balance._propsCount(pid), net:this.balance._netWorth(pid) }[kind]||0;
      const arr=new Array(10).fill(0).map((_,i)=> base + Math.round((Math.random()-0.5)*base*0.1));
      return arr;
    },

    _spark(idOrCanvas, series){ const c = (typeof idOrCanvas==='string')? document.getElementById(idOrCanvas): idOrCanvas; if(!c) return; const g=c.getContext('2d'); g.clearRect(0,0,c.width,c.height); const n=series.length; const min=Math.min(...series), max=Math.max(...series); const w=c.width, h=c.height; g.beginPath(); for (let i=0;i<n;i++){ const x=i*(w/(n-1)); const y=h - (h*((series[i]-min)/Math.max(1,(max-min)))); if (i===0) g.moveTo(x,y); else g.lineTo(x,y); } g.strokeStyle='rgba(250,250,255,.9)'; g.lineWidth=1.5; g.stroke(); },

    // ========== CSS ========================================================
    _injectCSS(){ if (document.getElementById('uix-css')) return; const s=document.createElement('style'); s.id='uix-css'; s.textContent=`
      #uix-balance{position:fixed;right:14px;bottom:14px;min-width:280px;padding:12px 14px;border-radius:14px;background:rgba(12,14,22,.95);color:#fff;z-index:9996;font:14px/1.4 system-ui,Segoe UI,Roboto}
      #uix-balance .title{font-weight:700;font-size:16px;margin-bottom:8px}
      #uix-balance .cards{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      #uix-balance .card{background:rgba(255,255,255,.05);border-radius:12px;padding:8px}
      #uix-balance .k{opacity:.8;font-size:12px}
      #uix-balance .v{font-size:18px;font-weight:700;margin-bottom:4px}
      #uix-balance .risk{margin-top:10px}
      #uix-balance .risk .bar{height:10px;border-radius:8px;background:rgba(255,255,255,.08);overflow:hidden}
      #uix-balance .risk .fill{height:10px;background:linear-gradient(90deg,#4ade80,#facc15,#f97316,#ef4444)}
      #uix-balance .actions{display:flex;gap:8px;margin-top:10px}
      #uix-balance .actions button{flex:1;padding:6px 8px;border:0;border-radius:10px;cursor:pointer}

      .uix-ticket{--bg:rgba(255,255,255,.06);--bd:rgba(255,255,255,.12);position:relative;display:inline-block;min-width:220px;padding:10px 12px;margin:6px;border-radius:12px;background:var(--bg);border:1px solid var(--bd);color:#fff;font:13px/1.4 system-ui}
      .uix-ticket .row{display:flex;justify-content:space-between;gap:10px;margin:4px 0}
      .uix-ticket .row.head{font-weight:700}
      .uix-ticket .tag{display:inline-block;background:rgba(255,255,255,.12);border-radius:8px;padding:2px 6px;margin-left:4px}
    `; document.head.appendChild(s); },

    // ========== HELPERS ====================================================
    _player(id){ const s=this._cfg.state; return (s.players||[]).find(p=> p && p.id===id) || null; },
    _currentPlayerId(){ const s=this._cfg.state; const idx=s.currentPlayerIndex||0; return (s.players||[])[idx]?.id; }
  };

  global.UIX = UIX;

})(typeof window!=='undefined'? window : globalThis);
