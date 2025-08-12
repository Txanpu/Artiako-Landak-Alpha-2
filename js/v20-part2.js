/* v13 – Parte 2/7: motor de UI (tablero + casillas visibles tipo v11) */

const V13_COLORS = {
  brown:'#8b5a2b', cyan:'#22d3ee', pink:'#f472b6', orange:'#fb923c',
  red:'#ef4444', yellow:'#eab308', green:'#22c55e', blue:'#3b82f6', slots:'#d946ef',
  bank:'#b91c1c', event:'#a855f7', util:'#64748b', rail:'#94a3b8', ferry:'#60a5fa', air:'#0ea5e9',
  start:'#10b981', tax:'#f59e0b', park:'#22c55e', gotojail:'#ef4444', jail:'#111827'
};
function colorFor(tile){ if(!tile) return '#475569'; const k=(tile.color||tile.subtype||tile.type||'').toLowerCase(); return V13_COLORS[k]||'#475569'; }

const V13 = { tiles:[], state:null, els:[], boardEl:null };

/* ==== CONFIG editable ==== */
const HCOUNT = 10;     // nº de casillas por lado horizontal (incluye esquinas)
const PAD_PX = 12;     // margen interior
const GAP_PX = 4;      // separación entre casillas
const MIN_TILE = 48;   // tamaño mínimo de casilla en px

/* ==== Creación de casilla (estructura v11) ==== */
function createTileElement(tile, index){
  const el = document.createElement('div'); el.className='tile';
  const band=document.createElement('div'); band.className='band'; band.style.background=colorFor(tile);
  const head=document.createElement('div'); head.className='head';
  const name=document.createElement('div'); name.className='name'; name.textContent=tile?.name||''; head.appendChild(name);
  const idTag=document.createElement('div'); idTag.className='internal-id'; idTag.textContent=`#${index}`;
  const badges=document.createElement('div'); badges.className='badges';
  const meta=document.createElement('div'); meta.className='meta';
  const left=document.createElement('div'); left.className='left';
  const right=document.createElement('div'); right.className='right';
  meta.appendChild(left); meta.appendChild(right);

  el.addEventListener('click', ()=>{
    const current = V13.tiles[index];
    if (current && typeof window.showCard === 'function'){
      // Permitir iniciar subasta desde el click, si la propiedad está libre.
      window.showCard(index); // por defecto canAuction=false
    }
  });

  el.appendChild(band); el.appendChild(head); el.appendChild(idTag); el.appendChild(badges); el.appendChild(meta);
  return el;
}

/* ==== Refresco de una casilla ==== */
function refreshTile(i){
  const t = V13.tiles[i], el = V13.els[i]; if(!t||!el) return;
  // Borde dorado si está hipotecada
  el.classList.toggle('mortgaged', !!(t && t.type==='prop' && t.mortgaged));
  el.querySelector('.name').textContent = t.name || '';
  el.querySelector('.band').style.background = colorFor(t);

  const left = el.querySelector('.meta .left');
  if(t.type==='prop'){
    if(t.owner===null) left.textContent=t.price?`$${t.price}`:'—';
    else { const ownerName=(t.owner==='E')?'Estado':(`J${(t.owner+1 ?? t.owner)}`); left.textContent=`Dueño: ${ownerName}`; }
  } else if (t.type==='tax') left.textContent='Impuesto';
  else if (t.type==='jail') left.textContent='Solo visitas';
  else if (t.type==='gotojail') left.textContent='Ir a la cárcel';
  else if (t.type==='slots') left.textContent='Tragaperras';
  else if (t.type==='bank') left.textContent='Banca corrupta';
  else if (t.type==='park') left.textContent='Parque';
  else if (t.type==='event'){ left.textContent='Evento'; }
  else left.textContent='';

  const right = el.querySelector('.meta .right');
  if(t.type==='prop' && typeof window.getRent==='function'){
    try{ right.textContent=`Renta: $${window.getRent(t)}`; }catch{ right.textContent=''; }
  } else right.textContent='';

  const badges = el.querySelector('.badges'); badges.innerHTML = '';
  if(t.type==='prop'){
    if(t.hotel){ const b=document.createElement('span'); b.className='badge'; b.textContent='🏨 Hotel'; badges.appendChild(b); }
    if(t.houses>0){ const b=document.createElement('span'); b.className='badge'; b.textContent=`🏠 x${t.houses}`; badges.appendChild(b); }
    if(t.mortgaged){ const b=document.createElement('span'); b.className='badge'; b.textContent='💸 Hipotecada'; badges.appendChild(b); }
    if(t.subtype){ const b=document.createElement('span'); b.className='badge'; b.textContent=({
      utility:'⚙️ Utility', rail:'🚇 Metro', ferry:'⛴️ Ferry', air:'✈️ Aeropuerto',
      bus:'🚌 Bizkaibus', casino_bj:'♠️ Casino BJ', casino_roulette:'🎯 Ruleta', fiore:'🌼 Fiore'
    }[t.subtype]||t.subtype); badges.appendChild(b); }
  }

  // Remove old chips if any
  const old = el.querySelector('.chips');
  if (old) old.remove();

  // --- PLAYER CHIPS ---
  if (V13.state && Array.isArray(V13.state.players)) {
    const here = V13.state.players.filter(p => p.alive && p.pos === i);
    if (here.length) {
      const chips = document.createElement('div');
      chips.className = 'chips';
      here.forEach(p => {
        const c = document.createElement('div');
        c.className = `chip p${p.id}`;
        c.textContent = (p.id + 1);
        chips.appendChild(c);
      });
      el.appendChild(chips);
    }
  }
}
function refreshTiles(){
  for(let i=0;i<V13.tiles.length;i++) refreshTile(i);
  // [PATCH] UIX: repintar estados del tablero (bordes, iconos)
  if (window.UIX?.board.paintStates) {
    setTimeout(()=> UIX.board.paintStates(), 50);
  }
}

/* ==== Render ==== */
function renderBoard(){
  const board=document.getElementById('board'); V13.boardEl=board;
  const total=V13.tiles.length;
  board.style.display='block'; board.innerHTML=''; V13.els=[];
  for(let i=0;i<total;i++){ const el=createTileElement(V13.tiles[i],i); board.appendChild(el); V13.els.push(el); }

  layoutPerimeterScroll();
  refreshTiles();
  window.removeEventListener('resize', layoutPerimeterScroll);
  window.addEventListener('resize', layoutPerimeterScroll);
}

/* ==== Layout: horizontales fijas, verticales crecen; solo scroll vertical ==== */
function layoutPerimeterScroll(){
  const board=V13.boardEl; if(!board||!V13.els.length) return;

  const N=V13.els.length;
  const W=Math.max(1, board.clientWidth || board.getBoundingClientRect().width);

  // tamaño de casilla cuadrada en función del ancho disponible y HCOUNT
  const tile = Math.max(MIN_TILE, Math.floor((W - 2*PAD_PX - (HCOUNT-1)*GAP_PX) / HCOUNT));
  const stride = tile + GAP_PX;

  // horizontales: HCOUNT incluye las 2 esquinas en cada lado → tramo intermedio por lado:
  const hInner = Math.max(0, HCOUNT - 2);

  // base del anillo fijo: BL + hInner + BR + (verticales entre esquinas) + TR + hInner + TL
  // los verticales entre esquinas serán dinámicos (rightCount/leftCount)
  const baseUsed = 4 + 2*hInner; // sin contar verticales
  const remaining = Math.max(0, N - baseUsed);

  const rightCount = Math.ceil(remaining / 2);
  const leftCount  = Math.floor(remaining / 2);

  // altura necesaria (solo vertical): top fila + laterales + bottom fila + márgenes
  const innerHeight = PAD_PX + tile + Math.max(leftCount, rightCount)*stride + tile + PAD_PX;

  // fijamos tamaño del tablero: ancho 100%, alto calculado. Evitamos scroll horizontal.
  board.style.height = innerHeight + 'px';
  board.style.minWidth = '0px'; // por si acaso en layouts flex
  // las casillas se posicionan en px y no exceden W → no habrá overflow-x

  // helpers
  function placePx(i,x,y,w,h){
    const el=V13.els[i]; if(!el) return;
    el.style.position='absolute';
    el.style.left=(x)+'px';
    el.style.top =(y)+'px';
    el.style.width = w+'px';
    el.style.height= h+'px';
  }

  let k=0;
  const leftX  = PAD_PX;
  const rightX = PAD_PX + (HCOUNT-1)*stride; // columna derecha alineada por casillas
  const topY   = PAD_PX;
  const botY   = innerHeight - PAD_PX - tile;

  // 1) BL (esquina inferior-izquierda)
  if(k<N) placePx(k++, leftX, botY, tile, tile);

  // 2) borde inferior L→R (sin esquinas)
  for(let c=0;c<hInner && k<N;c++,k++){
    const x = leftX + stride*(c+1);
    placePx(k, x, botY, tile, tile);
  }

  // 3) BR (esquina inferior-derecha)
  if(k<N) placePx(k++, rightX, botY, tile, tile);

  // 4) borde derecho B→T (sin esquinas)
  for(let r=0;r<rightCount && k<N;r++,k++){
    const y = botY - stride*(r+1);
    placePx(k, rightX, y, tile, tile);
  }

  // 5) TR (esquina superior-derecha)
  if(k<N) placePx(k++, rightX, topY, tile, tile);

  // 6) borde superior R→L (sin esquinas)
  for(let c=0;c<hInner && k<N;c++,k++){
    const x = leftX + stride*(hInner - c);
    placePx(k, x, topY, tile, tile);
  }

  // 7) TL (esquina superior-izquierda)
  if(k<N) placePx(k++, leftX, topY, tile, tile);

  // 8) borde izquierdo T→B (sin esquinas)
  for(let r=0;r<leftCount && k<N;r++,k++){
    const y = topY + stride*(r+1);
    placePx(k, leftX, y, tile, tile);
  }
}

/* ==== API pública ==== */
window.BoardUI = {
  attach({tiles, state}){ V13.tiles = tiles||[]; V13.state = state||null; },
  renderBoard, refreshTile, refreshTiles, colorFor
};

/* ==== Auto-init ==== */
document.addEventListener('DOMContentLoaded', ()=>{
  const tiles = window.TILES || [];
  const state = window.state || null;
  window.BoardUI.attach({ tiles, state });
  if (tiles.length){ window.BoardUI.renderBoard(); }
});