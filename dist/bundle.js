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
      chips.className = 'chips' + (here.length > 2 ? ' grid' : '');
      const pos = [
        { row:2, col:1 },
        { row:2, col:2 },
        { row:1, col:1 },
        { row:1, col:2 }
      ];
      here.forEach((p, idx) => {
        const c = document.createElement('div');
        c.className = `chip p${p.id}`;
        c.textContent = (p.id + 1);
        if (here.length > 2) {
          const {row, col} = pos[idx] || pos[0];
          c.style.gridRow = row;
          c.style.gridColumn = col;
        }
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
const COLORS = {
  brown:'#78350f', cyan:'#06b6d4', pink:'#db2777', orange:'#f97316',
  red:'#ef4444', yellow:'#eab308', green:'#22c55e', blue:'#3b82f6',
  util:'#a3a3a3', rail:'#6d28d9', ferry:'#0ea5e9', air:'#facc15',
  park:'#4ade80'
};

/* ===== Familias → colores =====
   Opcional: si quieres forzar el color de alguna familia, ponlo aquí.
   Si NO lo pones, se asigna automáticamente siempre al mismo color base.
   Valores válidos: 'brown','cyan','pink','orange','red','yellow','green','blue'
*/
const FAMILIA_COLORES = {
  // 'Marrón':'brown',
  // 'Azul':'blue',
};
const _FAM_PALETTE = ['brown','cyan','pink','orange','red','yellow','green','blue'];
function _hash(s){ let h=0; for (let i=0;i<s.length;i++) h=(h*31 + s.charCodeAt(i))|0; return Math.abs(h); }
function familyToColorKey(f){
  if (!f) return 'brown';
  if (FAMILIA_COLORES[f]) return FAMILIA_COLORES[f];
  return _FAM_PALETTE[_hash(String(f)) % _FAM_PALETTE.length];
}

/* ===== Constructor de propiedades ===== */
function prop(name, colorKey, price, familia){
  return {
    type:'prop', name, color:colorKey, price,
    baseRent:Math.round((price||0)*0.3),
    houseCost:Math.round((price||0)*0.5),
    houseRent:Math.round((price||0)*0.25),
    owner:null, houses:0, hotel:false,
    subtype:null, mortgaged:false,
    familia: (familia ?? colorKey)
  };
}

/* ===== Shorthands para que edites SOLO nombres/familias/precios ===== */
function p(nombre, familia, precio){
  const colorKey = familyToColorKey(familia);
  const t = prop(nombre, colorKey, precio, familia);
  return t;
}
function rail(nombre='Metro', precio=200){ return Object.assign(prop(nombre,'rail',precio), { subtype:'rail' }); }
function bus (nombre='Bizkaibus', precio=200){ return Object.assign(prop(nombre,'rail',precio), { subtype:'bus' }); }
function ferry(nombre='Ferry', precio=180){ return Object.assign(prop(nombre,'ferry',precio), { subtype:'ferry' }); }
function air  (nombre='Aeródromo', precio=260){ return Object.assign(prop(nombre,'air',precio), { subtype:'air' }); }
function agua (nombre='Compañía de Aguas', precio=150){ return Object.assign(prop(nombre,'util',precio), { subtype:'utility' }); }
function luz  (nombre='Compañía Eléctrica', precio=150){ return Object.assign(prop(nombre,'util',precio), { subtype:'utility' }); }

/* ===== Define tu tablero AQUÍ (orden libre) =====
   Cambia SOLO los strings y los precios de las líneas p(...), rail(...), etc.
   "familia" es el grupo que decide casas/hotel (misma palabra = mismo grupo).
*/
const TILES_DEF = [
  // === Layout grande y balanceado ===
  // Transporte fijo: 5 metros, 4 buses, 2 ferries, 2 aeropuertos
  // Utilities: SOLO 2 en total
  // Impuestos: 10 repartidos
  // GOTOJAIL: 4 repartidos
  // Casinos y Fiore: separados y fuera de grupos de casas

  ['start','SALIDA'],

  // === Grupo TXAKOLI (casas) ===
  ['prop', p('San Lorenzo ermitie','Txakoli',60)],
  ['prop', p('Santa Maria Elizie','Txakoli',70)],
  // Especiales
  ['prop', rail('Metro Zelaieta Sur',200)], 
  ['tax','Impuesto 33%'], // 1/10

  // === Grupo PINTXO (casas) ===
  ['prop', p('Pipi´s Bar','Pintxo',80)],
  ['prop', p('Artea','Pintxo',90)],
  // Especiales
  ['prop', bus('Bizkaibus Herriko Enparantza',200)],
  ['prop', agua('Iberduero Aguas')], // 1/2 utilities

  // === Grupo KALEA (casas) ===
  ['prop', p('Perrukeria','Kalea',100)],
  ['prop', p('Veterinario','Kalea',110)],
  // Especiales
  ['prop', ferry('Ferris Laida',180)],
  ['tax','Impuesto 33%'], // 2/10

  // === Grupo MENDI (casas) ===
  ['prop', p('Atxarre','Mendi',120)],
  ['prop', p('San Miguel','Mendi',130)],
  ['prop', p('Omako Basoa','Mendi',140)],
  // Especiales
  ['gotojail','Ir a la cárcel'], // 1/4

  // === Grupo ITSASO (casas) ===
  ['prop', p('Gruas Arego','Itsaso',150)],
  ['prop', p('Talleres Arteaga','Itsaso',160)],
  // Especiales
  ['prop', rail('Metro Arteaga Urias',200)],
  ['tax','Impuesto 33%'], // 3/10
  ['event','Suerte'],

  // === Grupo ARRANTZALE (casas) ===
  ['prop', p('Casa Rural Ozollo','Arrantzale',170)],
  ['prop', p('Aberasturi','Arrantzale',180)],
  // Especiales
  ['prop', luz('IberdueroLuz')], // 2/2 utilities
  ['prop', bus('Bizkaibus Mendialdua',200)],

  ['jail','Cárcel'],

  // === Grupo GUGGEN (casas) ===
  ['prop', p('Bird Center','Guggen',190)],
  ['prop', p('Autokarabanak','Guggen',200)],
  // Especiales
  ['tax','Impuesto 33%'], // 4/10
  ['prop', Object.assign(p('Casino Blackjack','Rosa',300), { subtype:'casino_bj' })],

  // === Grupo ROJO (casas) ===
  ['prop', p('Txokoa','Rojo',210)],
  ['prop', p('Cocina Pablo','Rojo',220)],
  ['prop', p('Casa Minte','Rojo',230)],
  // Especiales
  ['prop', rail('Metro Islas',200)],
  ['tax','Impuesto 33%'], // 5/10

  ['park','Parkie'],

  // === Grupo NARANJA (casas) ===
  ['prop', p('Marko Pollo','Naranja',240)],
  ['prop', p('Arketas','Naranja',250)],
  // Especiales
  ['prop', ferry('Ferris Mundaka',180)],
  ['gotojail','Ir a la cárcel'], // 2/4
  ['event','Suerte'],

  // === Grupo AMARILLO (casas) ===
  ['prop', p('Joshua´s','Amarillo',260)],
  ['prop', p('Santana Esnekiak','Amarillo',270)],
  ['prop', p('Klinika Dental Arteaga','Amarillo',280)],
  // Especiales
  ['prop', bus('Bizkaibus Muruetagane',200)],
  ['tax','Impuesto 33%'], // 6/10

  // === Grupo VERDE (casas) ===
  ['prop', p('Kanala Bitch','Verde',290)],
  ['prop', p('Kanaleko Tabernie','Verde',300)],
  // Especiales
  ['prop', air('Loiu',260)],
  ['prop', rail('Metro Portuas',200)],
  ['event','Suerte'],

  // === Grupo AZUL (casas) ===
  ['prop', p('Baratze','Azul',310)],
  ['prop', p('Eskolie','Azul',320)],
  // Especiales
  ['tax','Impuesto 33%'], // 7/10
  ['prop', Object.assign(p('Fiore','Verde',240), { subtype:'fiore', workers:0, wagePer:7, workerRent:70 })],

  // === Grupo CIAN (casas) ===
  ['prop', p('Garbigune','Cian',330)],
  ['prop', p('Padura','Cian',340)],
  ['prop', p('Santanako Desaguie','Cian',350)],
  // Especiales
  ['prop', bus('Bizkaibus Ibarrekozubi',200)],
  ['tax','Impuesto 33%'], // 8/10

  // === Grupo ROSA (casas) ===
  ['prop', p('Farmazixe','Rosa',360)],
  ['prop', p('Medikue','Rosa',370)],
  // Especiales
  ['prop', air('Ozolloko Aireportue',260)],
  ['gotojail','Ir a la cárcel'], // 3/4
  ['event','Suerte'],

  // === Grupo BASERRI (casas) ===
  ['prop', p('Frontoie','Baserri',380)],
  ['prop', p('Skateko Pistie','Baserri',390)],
  ['prop', p('Txarlin Pistie','Baserri',400)],
  // Especiales
  ['prop', rail('Metro Ozollo',200)],
  ['tax','Impuesto 33%'], // 9/10

  // === Grupo SIRIMIRI (casas) ===
  ['prop', p('Txopebenta','Sirimiri',410)],
  ['prop', p('Jaunsolo Molino','Sirimiri',420)],
  // Especiales
  ['prop', Object.assign(p('Casino Ruleta','Rosa',300),   { subtype:'casino_roulette' })],

  // === Grupo BILBO (casas) ===
  ['prop', p('Lezika','Bilbo',430)],
  ['prop', p('Bernaetxe','Bilbo',440)],
  ['prop', p('Baserri Maitea','Bilbo',450)],
  // Especiales
  ['gotojail','Ir a la cárcel'], // 4/4
  ['tax','Impuesto 33%'], // 10/10
  ['event','Suerte'],

  // === Grupo GAZTELUGATXE (casas) ===
  ['prop', p('Artiako Kanterie','Gaztelugatxe',460)],
  ['prop', p('Ereñokoa Ez Dan Kanterie','Gaztelugatxe',470)],

  // === Grupo NERVIÓN (casas) ===
  ['prop', p('Artiako GYM-e','Nervión',480)],
  ['prop', p('Ereñoko GYM-e','Nervión',490)],
  ['prop', p('Frontoiko Bici estatikak','Nervión',500)],


  ['event','Suerte'],
  // === Grupo TXISTORRA (casas) ===
  ['prop', p('Solabe','Txistorra',510)],
  ['prop', p('Katxitxone','Txistorra',520)],

  // === Grupo SAGARDOA (casas) ===
  ['prop', p('San Antolin','Sagardoa',530)],
  ['prop', p('Farolak','Sagardoa',540)],

  // === Grupo KAIKU (casas) ===
  ['prop', p('Santi Mamiñe','Kaiku',550)],
  ['prop', p('Portuaseko Kobazuloa','Kaiku',560)],

  // === Grupo ZORIONAK (casas) ===
  ['prop', p('Hemingway Etxea','Zorionak',570)],
  ['prop', p('Etxealaia','Zorionak',580)],

  ['park','Parkie'],

  // === Grupo LOIU (casas) ===
  ['prop', p('Kastillue','Loiu',590)],
  ['prop', p('Errota','Loiu',600)],

  // Especiales
  ['gotojail','Ir a la cárcel'], // 4/4
  
];

/* ===== Builder seguro (convierte TILES_DEF en TILES reales) ===== */
function buildTiles(def){
  const out = [];
  for (const item of def){
    const [kind, payload] = item;
    if (kind === 'prop') {
      out.push(payload);
    } else if (kind === 'start') {
      out.push({ type:'start', name:String(payload||'SALIDA') });
    } else if (kind === 'tax') {
      out.push({ type:'tax', name:String(payload||'Impuesto 33%') });
    } else if (kind === 'jail') {
      out.push({ type:'jail', name:String(payload||'Cárcel') });
    } else if (kind === 'gotojail') {
      out.push({ type:'gotojail', name:String(payload||'Ir a la cárcel') });
    } else if (kind === 'park') {
      out.push({ type:'park', name:String(payload||'Parque') });
    } else if (kind === 'event') {
      out.push({ type:'event', name:String(payload||'Suerte') });
    }
  }
  return out;
}

const TILES = buildTiles(TILES_DEF);
window.TILES = TILES;

// === Casillas especiales: Tragaperras x2 (en límites de grupo) ===
(function(){
  const isNormal = t => t && t.type==='prop' && !t.subtype; // casas
  function isBoundary(i){
    const L = TILES[i-1], R = TILES[i];
    if (!L || !R) return true; // bordes
    if (!isNormal(L) || !isNormal(R)) return true; // algo especial en medio
    return (L.familia||'') !== (R.familia||''); // cambia de familia
  }
  function nearestBoundary(target){
    let best = 1, bestD = Infinity;
    for (let i=1;i<=TILES.length;i++){
      if (!isBoundary(i)) continue;
      const d = Math.abs(i - target);
      if (d < bestD){ best = i; bestD = d; }
    }
    return best;
  }
  const pos1 = nearestBoundary(Math.floor(TILES.length/4));
  TILES.splice(pos1, 0, { type:'slots', name:'Tragape 1' });
  const pos2 = nearestBoundary(Math.floor(3*TILES.length/4));
  TILES.splice(pos2, 0, { type:'slots', name:'Tragape 2' });
})();

// === Casillas especiales: Banca corrupta x4 equidistantes ===
(function(){
  const count = 4;
  const finalLen = TILES.length + count;
  const step = Math.floor(finalLen / count);
  const positions = [];
  for(let i=0;i<count;i++){
    positions.push(Math.floor(step/2) + i*step);
  }
  positions.forEach(pos=> TILES.splice(pos, 0, { type:'bank', name:'Banca corrupta' }));
  window.CORRUPT_BANK_TILE_IDS = positions;
})();

/* ===== Nombres placeholder (por si dejas alguno vacío) ===== */
window.assignPlaceholderNamesAZ = function(){
  const isNormal = x => x && x.type==='prop' && !x.subtype;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let li = 0, counters = {};
  TILES.forEach(t=>{
    if(!isNormal(t)) return;
    const L = letters[li % letters.length];
    counters[L] = (counters[L]||0)+1;
    if (!t.name || !t.name.trim()) t.name = `${L}${counters[L]}`;
    li++;
  });
};
window.assignPlaceholderNamesAZ();

/* ===== Estado de partida ===== */
const Estado = { name:'Estado', money: 100, id:'E' }; // banca central
window.Estado = Estado;
const state = { players: [], current: 0, rolled: false, auction: null, pendingTile: null, loans: [], lastRoll: 0, _endingTurn: false };
window.state = state;

/* ===== Utilidades ===== */
function log(m){ const el=document.getElementById('log'); if (!el) return; el.innerHTML+=m+'<br>'; el.scrollTop=el.scrollHeight; }
function fmtMoney(n){ return `$${Math.max(0, Math.round(n||0))}`; }

/* ===== Cálculo de alquiler (rentas) ===== */
function getRent(tile){
  if (!tile) return 0;

  // Estado con hipoteca: no cobra alquiler
  if (tile.owner === 'E' && tile.mortgaged) return 0;
  if (tile.subtype === 'bus') {
    const owner = tile.owner==='E' ? 'E' : tile.owner;
    const n = TILES.filter(t=>t.type==='prop' && t.subtype==='bus' && t.owner===owner).length;
    const table = [0,25,50,100,200,300];
    return table[Math.max(0, Math.min(n, 5))];
  }
  if (tile.subtype === 'casino_bj' || tile.subtype === 'casino_roulette' || tile.subtype === 'fiore') return 0;
  if (tile.subtype === 'utility'){
    const owner = tile.owner==='E' ? 'E' : tile.owner;
    const owned = TILES.filter(t=>t.type==='prop' && t.subtype==='utility' && t.owner===owner).length;
    const mult = (owned >= 2) ? 10 : 3;
    const dice = state.lastRoll || 0;
    return dice * mult;
  }
  if (tile.subtype === 'rail'){
    const owner = tile.owner==='E' ? 'E' : tile.owner;
    const n = TILES.filter(t=>t.type==='prop' && t.subtype==='rail' && t.owner===owner).length;
    const table = [0,25,50,100,200,300];
    return table[Math.max(0, Math.min(n, 5))];
  }
  if (tile.subtype === 'ferry'){
    const owner = tile.owner==='E' ? 'E' : tile.owner;
    const n = TILES.filter(t=>t.type==='prop' && t.subtype==='ferry' && t.owner===owner).length;
    return [0,30,70][Math.max(0, Math.min(n, 2))];
  }
  if (tile.subtype === 'air'){
    const owner = tile.owner==='E' ? 'E' : tile.owner;
    const n = TILES.filter(t=>t.type==='prop' && t.subtype==='air' && t.owner===owner).length;
    return [0,120][Math.max(0, Math.min(n, 1))];
  }
  const base = tile.baseRent ?? Math.round((tile.price||0)*0.3);
  if (tile.hotel) return base + 5 * (tile.houseRent ?? Math.round(tile.price*0.25));
  if (tile.houses>0) return base + tile.houses * (tile.houseRent ?? Math.round(tile.price*0.25));
  return base;
}
window.getRent = getRent;

/* ===== Carta de propiedad (modal) ===== */
const overlay = document.getElementById('overlay');
const cardBand = document.getElementById('cardBand');
const cardName = document.getElementById('cardName');
const cardPrice= document.getElementById('cardPrice');
const cardRent = document.getElementById('cardRent');
const cardRoi  = document.getElementById('cardRoi');
if (cardRoi && cardRoi.parentElement) cardRoi.parentElement.style.display = 'none';

// Permitir cerrar la carta clicando fuera del contenido
if (overlay){
  overlay.addEventListener('click', (ev)=>{
    if (ev.target === overlay){
      overlay.style.display = 'none';
      if (window.state) window.state.pendingTile = null;
    }
  });
}

const rentsBox = document.getElementById('cardRentsBox');
const bankWarn = document.getElementById('bankWarn');
const startAuctionBtn = document.getElementById('startAuction');
const cancelAuctionBtn= document.getElementById('cancelAuction');

// ==== Nombres custom de propiedades (autosave/autoload) ====
const PROP_NAMES_KEY = 'propNames.v15';
function loadPropNames(){ try { return JSON.parse(localStorage.getItem(PROP_NAMES_KEY)||'{}'); } catch { return {}; } }
function savePropName(idx, name){ const map = loadPropNames(); if (name && name.trim()) map[idx] = name.trim(); else delete map[idx]; localStorage.setItem(PROP_NAMES_KEY, JSON.stringify(map)); }
function applySavedPropNames(){ const map = loadPropNames(); (TILES||[]).forEach((t,i)=>{ if (t?.type==='prop' && map[i]) t.name = map[i]; }); BoardUI?.refreshTiles?.(); }
try{ applySavedPropNames(); }catch{}
document.addEventListener('DOMContentLoaded', ()=>{ try{ applySavedPropNames(); }catch{} });
window.addEventListener('storage', (e)=>{ if (e.key === PROP_NAMES_KEY) applySavedPropNames(); });

// ===== Modelo de rentas para la carta =====
function buildRentModel(t){
  if (t.subtype === 'bus') { const total = TILES.filter(x=>x.type==='prop' && x.subtype==='bus').length; const table = [0,25,50,100,200,300]; return Array.from({length: total}, (_,i)=>({ label:i+1, rent:table[Math.min(i+1,5)] })); }
  if (['casino_bj','casino_roulette','fiore'].includes(t.subtype)) return [];
  if (t.subtype === 'utility'){ const total = TILES.filter(x=>x.type==='prop' && x.subtype==='utility').length; return Array.from({length: total}, (_,i)=>{ const n = i+1, mult = (n>=2)?10:3; return { label:n, rent:`dado × ${mult}` }; }); }
  if (t.subtype === 'rail'){ const total = TILES.filter(x=>x.type==='prop' && x.subtype==='rail').length; const table = [0,25,50,100,200,300]; return Array.from({length: total}, (_,i)=>({ label:i+1, rent:table[Math.min(i+1,5)] })); }
  if (t.subtype === 'ferry'){ const total = TILES.filter(x=>x.type==='prop' && x.subtype==='ferry').length; const table = [0,30,70]; return Array.from({length: total}, (_,i)=>({ label:i+1, rent:table[Math.min(i+1,2)] })); }
  if (t.subtype === 'air'){ const total = TILES.filter(x=>x.type==='prop' && x.subtype==='air').length; const table = [0,120]; return Array.from({length: total}, (_,i)=>({ label:i+1, rent:table[Math.min(i+1,1)] })); }
  const base = t.baseRent ?? Math.round((t.price||0)*0.3);
  const step = t.houseRent ?? Math.round((t.price||0)*0.25);
  return Array.from({length:6},(_,i)=>({ label: i===5 ? 'Hotel' : i, rent: i===5 ? base + 5*step : base + i*step, houses: i }));
}

function showCard(tileIndex, {canAuction=false}={}) {
  if (cardName){
    cardName.style.display = 'none';   // no mostramos el duplicado
    cardName.textContent = '';         // evitamos que “se herede” el último nombre
    cardName.oninput = cardName.onkeydown = cardName.onblur = null;
  }

  const t = TILES[tileIndex]; state.pendingTile = tileIndex;
  const noBuildings = (t.subtype && !['utility','rail','ferry','air','bus'].includes(t.subtype)) || ['casino_bj','casino_roulette','fiore'].includes(t.subtype);

  cardBand.style.background = t.type==='prop' ? COLORS[t.color] : '#374151';
  cardBand.textContent = t.name;

  const cardPriceRow = document.getElementById('cardPrice')?.parentElement;
  const cardRentRow  = document.getElementById('cardRent')?.parentElement;
  const rentsBox     = document.getElementById('cardRentsBox');
  const startBtn     = document.getElementById('startAuction');

  if (t.type === 'prop') {
    cardBand.onclick = ()=>{
      const nuevo = prompt('Nuevo nombre de la propiedad:', t.name||'');
      if (nuevo && nuevo.trim()){
        t.name = nuevo.trim();
        savePropName(tileIndex, t.name);
        cardBand.textContent = t.name;
        BoardUI.refreshTile(tileIndex);
      }
    };

    // vehículos y utilities: ocultar “Renta base”, pero mostrar tabla
const isVehicleOrUtil = ['utility','rail','bus','ferry','air'].includes(t.subtype);
const isNoBuildings   = ['casino_bj','casino_roulette','fiore'].includes(t.subtype);

if (cardPriceRow) cardPriceRow.style.display = 'flex';
if (cardRentRow)  cardRentRow.style.display  = (isVehicleOrUtil || isNoBuildings) ? 'none' : 'flex';

cardPrice.textContent = fmtMoney(t.price);

// siempre que haya modelo, mostrar tabla (incluye vehículos)
const model = buildRentModel(t);
rentsBox.innerHTML = (Array.isArray(model) && model.length) ? renderRentsTable(model) : '';

if (!isVehicleOrUtil && !isNoBuildings){
  cardRent.textContent = fmtMoney(t.baseRent ?? Math.round((t.price||0)*0.3));
}

    // v15-part3.js — dentro de showCard, si es Fiore
    if (t.subtype === 'fiore') {
      bankWarn.className = '';
      bankWarn.innerHTML = `Fiore: <b>${t.workers||0}</b> zenbat langile?`;
      const me = state.players[state.current];
      if (me && t.owner === me.id) {
        const btn = document.createElement('button');
        btn.textContent = 'Kontratatu (0–5)';
        btn.onclick = () => {
          const n = Number(prompt('Trabajadores en Fiore (0–5):', t.workers||0));
          if (Number.isFinite(n) && n>=0 && n<=5){ t.workers = n; BoardUI.refreshTiles(); }
        };
        bankWarn.appendChild(document.createElement('br'));
        bankWarn.appendChild(btn);
      }
    }
  } else {
    cardBand.onclick = null;
    if (cardPriceRow) cardPriceRow.style.display = 'none';
    if (cardRentRow)  cardRentRow.style.display  = 'none';
    if (startBtn) startBtn.style.display = 'none';
    const msg = FUNNY[t.type] || '';
    bankWarn.className = 'muted';
    bankWarn.textContent = msg;
    rentsBox.innerHTML = '';
  }
  overlay.style.display = 'flex';
}

if (typeof renderRentsTable !== 'function'){
  function renderRentsTable(model){
    const rows = model.map(r=>{ const label = ('label' in r) ? r.label : (r.houses===5 ? 'Hotel' : r.houses); const rent  = (typeof r.rent === 'number') ? `$${Math.max(0, Math.round(r.rent||0))}` : r.rent; return `<tr><td>${label}</td><td style="text-align:right">${rent}</td></tr>`; }).join('');
    return `<table><thead><tr><th>Nº</th><th>Alquiler</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
}

window.showCard = showCard;
if (cancelAuctionBtn) cancelAuctionBtn.onclick = ()=>{ overlay.style.display='none'; state.pendingTile=null; };
if (startAuctionBtn && !startAuctionBtn.__wired) {
  startAuctionBtn.__wired = true;
  startAuctionBtn.onclick = ()=>{
    const ti = window.state?.pendingTile; console.log('[auction] click', { ti, hasFlow: typeof window.startAuctionFlow });
    overlay.style.display='none'; window.state && (window.state.pendingTile = null);
    if (ti==null) return;
    if (typeof window.startAuctionFlow === 'function') return window.startAuctionFlow(ti);
    if (typeof window.startAuction === 'function')     return window.startAuction(ti);
    alert('No hay handler de subasta (startAuctionFlow/startAuction)');
  };
}

const FUNNY = {
  start:    'Salida, como tu madre',
  tax:      'Putillas y coca',
  jail:     'Buen sitio pa hacer Networking?',
  gotojail: 'A la cárcel, a la cárcel, a la cárcel, a la cárcel, a la cárcel…',
  park:     'Buen sitio pa fumar porros… o mirar palomas.',
  slots: 'GANA GANA GANA!!!'
};

window.dispatchEvent(new Event('game-core-ready'));

/* ==== Shuffle de especiales con regla: transportes no adyacentes ==== */
(function(){
  const FIXED_TYPES = new Set(['start','jail','gotojail','park']);
  const isTransport = t => t && t.type==='prop' && ['rail','bus','ferry','air'].includes(t.subtype);
  const isNormalProp = t => t && t.type==='prop' && !t.subtype;
  const isSpecial = t => t && !FIXED_TYPES.has(t.type) && !isNormalProp(t);
  function neighborsTransportFree(i){ const N = TILES.length; const L = (i-1+N)%N, R = (i+1)%N; return !isTransport(TILES[L]) && !isTransport(TILES[R]); }
  window.randomizeSpecials = function(){
    const idxs = TILES.map((t,i)=> isSpecial(t) ? i : -1).filter(i=>i>=0);
    const pool = idxs.map(i=>TILES[i]);
    for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
    idxs.forEach((i,k)=>{ TILES[i] = pool[k]; });
    let tries = 0;
    while (tries++ < 500){
      let ok = true;
      for (const i of idxs){
        if (isTransport(TILES[i]) && !neighborsTransportFree(i)){
          const j = idxs.find(j => !isTransport(TILES[j]) && neighborsTransportFree(j));
          if (j==null) return;
          [TILES[i], TILES[j]] = [TILES[j], TILES[i]];
          ok = false;
        }
      }
      if (ok) break;
    }
  };
})();

/* ==== Añadir más propiedades comunes (desactivado por defecto) ==== */
(function addMoreCommonProps(n=0){
  const colors = ['brown','cyan','pink','orange','red','yellow','green','blue'];
  let base = 60;
  for (let i=0;i<n;i++){
    const color = colors[i % colors.length];
    const price = base + 10*((i%12)+Math.floor(i/12));
    const t = prop('', color, price, null);
    TILES.push(t);
  }
  if (typeof window.assignPlaceholderNamesAZ === 'function') window.assignPlaceholderNamesAZ();
})();

document.addEventListener('DOMContentLoaded', ()=>{
  try {
    window.BoardUI?.attach?.({ tiles: window.TILES || [], state: window.state });
    window.BoardUI?.renderBoard?.();
  } catch {}
});

/* v13 – Parte 4/7 (patched): setup, panel jugadores, utilidades de dinero
   — Esta versión mantiene TODA la economía y turnos aquí (fuente de verdad).
   — Muestra también el Estado (banca) al final del panel.
*/

/* ===== Helpers de UI ===== */
const $  = (q)=>document.querySelector(q);
const $$ = (q)=>Array.from(document.querySelectorAll(q));

/* ===== Estado económico y eventos ===== */
function giveMoney(player, amount, {taxable=true, reason=''}={}){
  if(!player || !Number.isFinite(amount)) return;
  player.money = Math.round((player.money||0) + amount);
  if (taxable && amount>0) player.taxBase = Math.round((player.taxBase||0) + amount);
  log(`${player.name} ${amount>=0? 'recibe':'paga'} ${fmtMoney(Math.abs(amount))}${reason? ' — '+reason:''}`);
  renderPlayers();
}
function transfer(from, to, amount, {taxable=false, reason=''}={}) {
  amount = Math.max(0, Math.floor(amount||0));
  if (amount <= 0) return;

  // Debitar
  if (from === Estado) {
    Estado.money = Math.max(0, Math.round((Estado.money||0) - amount));
  } else if (from) {
    giveMoney(from, -amount, {taxable, reason});
  }

  // Acreditar
  if (to === Estado) {
    Estado.money = Math.round((Estado.money||0) + amount);
  } else if (to) {
    giveMoney(to, amount, {taxable:false, reason});
  }

  renderPlayers?.();
}

// ==== IVA helpers (soportado y repercutido) ====
function ensureVAT(ent){
  if (!ent) return;
  ent.vatIn  = Math.max(0, Math.round(ent.vatIn  || 0));  // IVA soportado (pagado)
  ent.vatOut = Math.max(0, Math.round(ent.vatOut || 0));  // IVA repercutido (cobrado)
}
function markIVAPaid(who, amount, note=''){
  const a = Math.max(0, Math.round(amount||0));
  if (!who || !a) return;
  ensureVAT(who);
  who.vatIn += a;
  try { log(`IVA soportado +${fmtMoney(a)}${note} → ${(who.name||'Estado')}`); } catch {}
}
function markIVACharged(who, amount, note=''){
  const a = Math.max(0, Math.round(amount||0));
  if (!who || !a) return;
  ensureVAT(who);
  who.vatOut += a;
  try { log(`IVA repercutido +${fmtMoney(a)}${note} → ${(who.name||'Estado')}`); } catch {}
}

// Exponer a global
window.ensureVAT      = ensureVAT;
window.markIVAPaid    = markIVAPaid;
window.markIVACharged = markIVACharged;

function ensureAlive(player){
  if (!player || player===Estado) return;
  if (player.money >= 0) return;
  // Eliminación simple: todo al Estado
  player.alive = false;
  log(`☠️ ${player.name} queda eliminado por deuda.`);
  // Propiedades pasan al Estado, se limpian hipotecas
  TILES.forEach(t=>{
    if (t.type==='prop' && t.owner === player.id){
      t.owner = 'E';
      t.mortgaged = false;
      t.houses = 0; t.hotel = false;
    }
  });
  if (state.current === player.id) endTurn(); // pasa turno si el activo muere
  BoardUI.refreshTiles();
  renderPlayers();
}

/* ===== Panel de jugadores (incluye Estado) ===== */
function renderPlayers(){
  const wrap = $('#players'); if (!wrap) return;
  wrap.innerHTML = '';

  const COLORS = ['#ef4444','#22c55e','#3b82f6','#f59e0b','#a855f7','#14b8a6'];

  state.players.forEach(p=>{
    const b = document.createElement('div');
    b.className = 'badge player' + (p.id===state.current ? ' active' : '');
    const color = COLORS[p.id % COLORS.length];
    b.style.borderColor = color;
    b.innerHTML = `<span class="dot" style="background:${color}"></span>${p.name}: <span class="money">${fmtMoney(p.money)}</span>${p.alive?'':' (OUT)'}`;
    wrap.appendChild(b);
  });

  // Estado (banca) al final
  const e = document.createElement('div');
  e.className = 'badge state';
  e.innerHTML = `Estado: <span class="money">${fmtMoney(Estado.money||0)}</span>`;
  wrap.appendChild(e);

  // visible solo cuando hay partida
  wrap.style.display = state.players.length ? 'flex' : 'none';

  // [PATCH] Mostrar/ocultar botón Insider
  try {
    const insiderBtn = document.getElementById('insider');
    if (insiderBtn && window.GameRiskPlus?.Insider) {
      const canUse = GameRiskPlus.Insider.usable(state.current);
      insiderBtn.style.display = canUse ? '' : 'none';
      if (canUse) {
        const count = state._insider?.inventory?.[state.current] || 0;
        insiderBtn.textContent = `Insider (${count})`;
      }
    }
  } catch(e) { console.warn('Error updating insider button', e); }
}

/* ===== Dados (pips y animación) ===== */
function diceHTML(n){
  const spots = { 1:[5], 2:[1,9], 3:[1,5,9], 4:[1,3,7,9], 5:[1,3,5,7,9], 6:[1,3,4,6,7,9] };
  const cells = (spots[n]||[]).map(idx=>{
    const r = Math.ceil(idx/3), c = ((idx-1)%3)+1;
    return `<div class="pip" style="grid-row:${r};grid-column:${c}"></div>`;
  }).join('');
  return `<div class="die">${cells}</div>`;
}
function renderDice(d1, d2, meta=''){
  const d = $('#dice'); if(!d) return;
  d.innerHTML = `<div class="die shaker">${diceHTML(d1)}</div><div class="die shaker">${diceHTML(d2)}</div><div class="diceMeta">${meta}</div>`;
  setTimeout(()=> $$('#dice .die').forEach(el=>el.classList.remove('shaker')), 450);
}

/* ===== Nueva partida ===== */
function newGame(){
Estado.money = 0;
  const n = Math.max(2, Math.min(6, parseInt($('#numPlayers').value||'3',10)));
  const startMoney = Math.max(100, parseInt($('#startMoney').value||'500',10));

  state.players = Array.from({length:n},(_,i)=>({
    id:i, name:`J${i+1}`, money:startMoney, pos:0, alive:true,
    jail:0, taxBase:0, doubleStreak:0
  }));

  // v22: roles y casillas especiales
  if (window.Roles) {
    Roles.assign(state.players.map(p => ({ id: p.id, name: p.name })));

    // Activa banca corrupta y registra casillas equidistantes
    Roles.setBankCorrupt(true);
    Roles.registerCorruptBankTiles(window.CORRUPT_BANK_TILE_IDS || []);

    // Farmazixe con fentanilo (pon IDs de las farmacias)
    Roles.configureFentanyl({ tileIds: [62, 63], chance: 0.15, fee: 15 });
  }
  
  // dentro de newGame(), tras crear jugadores:
  state.players.forEach(p => { p.taxBase = 0; p.vatIn = 0; p.vatOut = 0; });
  Estado.vatIn = 0; Estado.vatOut = 0;

  state.current = 0; state.rolled = false; state.auction = null; state.pendingTile=null; state.lastRoll=0; state.turnCount = 0;
  state.usedTransportHop = false; // <- añade esto

  // Limpiar tablero económico
  TILES.forEach(t=>{
    if (t.type==='prop'){
      t.owner=null; t.houses=0; t.hotel=false; t.mortgaged=false;
      if (t.subtype==='fiore') t.workers = 0; // ← NUEVO
    }
  });

  // barajar especiales en cada nueva partida
  if (typeof window.randomizeSpecials === 'function') window.randomizeSpecials();

  if (typeof applySavedPropNames === 'function') applySavedPropNames(); // ← aquí

  BoardUI.attach({ tiles:TILES, state });
  BoardUI.renderBoard();
  renderPlayers();
  $('#log').innerHTML = '';
  log('Nueva partida creada.');
  updateTurnButtons();
  document.body.classList.add('playing');   // <- esto debe estar
  renderPlayers(); // asegúrate de llamarlo después de setear el estado
}
document.addEventListener('DOMContentLoaded', ()=>{
  $('#newGame')?.addEventListener('click', newGame);
  renderPlayers();
});

function updateTurnButtons() {
  const rollBtn = document.getElementById('roll');
  const endTurnBtn = document.getElementById('endTurn');
  // Only hide/show these two buttons!
  if (state.auction && state.auction.open) {
    if (rollBtn) rollBtn.style.display = 'none';
    if (endTurnBtn) endTurnBtn.style.display = 'none';
    return;
  }
  if (rollBtn) rollBtn.style.display = state.rolled ? 'none' : '';
  if (endTurnBtn) endTurnBtn.style.display = state.rolled ? '' : 'none';
}

/* Exponer lo necesario:
   — giveMoney / transfer / ensureAlive / renderPlayers / newGame
   — renderDice si otras partes lo quisieran usar
*/
window.renderPlayers = renderPlayers;
window.giveMoney     = giveMoney;
window.transfer      = transfer;
window.ensureAlive   = ensureAlive;
window.renderDice    = renderDice;
window.newGame       = newGame;
// <- FIN DE ARCHIVO
/* v13 – Parte 5/7: dados, movimiento, SALIDA, turnos */

function addSkipTurn(player, turns = 1) {
  if (!player) return;
  player.skipTurns = (player.skipTurns || 0) + turns;
  log(`${player.name} pierde ${turns} turno(s).`);
}

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
  // pasar por salida (paga el Estado si tiene fondos)
  while (np >= total){
    np -= total;

    // v22 — Huelga: sin ayudas este tick
    if (window.Roles?.shouldBlockWelfare?.()) {
      log('Huelga general: sin ayudas este tick.');
      continue; // Salta el pago de esta vuelta
    }

    const SALARIO = 200;
    if ((Estado.money || 0) >= SALARIO){
      // Debita del Estado y acredita al jugador (contabiliza en taxBase)
      Estado.money = Math.max(0, Math.round((Estado.money || 0) - SALARIO));
      giveMoney(p, SALARIO, { taxable:true, reason:'Salario del Estado por pasar SALIDA' });
      renderPlayers?.();
    } else {
      log(`💸 ${p.name} pasa por SALIDA, pero el Estado no tiene fondos (${fmtMoney(Estado.money||0)}). No se paga salario.`);
    }
  }
  p.pos = np;
  BoardUI?.refreshTiles?.(); // <-- Esto es clave
  log(`${p.name} avanza ${steps} hasta #${np} (${TILES[np].name || TILES[np].type})`);
  onLand(p, np);
}

function roll(){
  const p = state.players[state.current]; if(!p || !p.alive) return;
  if (p.skipTurns && p.skipTurns > 0) {
    p.skipTurns--;
    log(`${p.name} pierde el turno.`);
    endTurn();
    return;
  }
  if (state.rolled){ log('Ya has tirado este turno.'); return; }
  if (p.jail > 0){
    // Elegir: pagar o intentar dobles
    let choice = prompt(`Estás en la cárcel (${p.jail} turno(s)). Escribe "pagar" para salir por $50 o "tirar" para intentar dobles.`, 'tirar');
    choice = (choice||'').trim().toLowerCase();

    let paid = false;
    if (choice.startsWith('p')) {
      if (p.money < 50) {
        alert('No te llega para pagar 50. Debes intentar dobles.');
      } else {
        transfer(p, Estado, 50, {taxable:false, reason:'Fianza cárcel'});
        ensureAlive(p);
        p.jail = 0; // libre
        paid = true;
      }
    }

    // Tirada (si pagó, sale y tira normal; si no, intenta dobles)
    let d1, d2;
    if (window.RolesConfig?.dice0to9 && window.Roles?.rollDie0to9) {
      d1 = Roles.rollDie0to9();
      d2 = Roles.rollDie0to9();
    } else {
      d1 = 1 + Math.floor(Math.random()*6);
      d2 = 1 + Math.floor(Math.random()*6);
    }
    const sum = d1 + d2;
    state.lastRoll = sum;
    renderDice(d1, d2, `Total: ${sum}${d1===d2?' — Dobles':''}`);

    if (paid || d1===d2){
      if (!paid && d1===d2) log(`${p.name} saca dobles y sale de la cárcel.`);
      p.jail = 0;
      movePlayer(p, sum);
      state.rolled = true; updateTurnButtons(); return;
    } else {
      // Fallo intentando dobles
      p.jail--;
      if (p.jail === 0){
        log(`${p.name} falla el 3º intento. Paga $50 y sale.`);
        transfer(p, Estado, 50, {taxable:false, reason:'Fianza tras 3 intentos'});
        ensureAlive(p);
        movePlayer(p, sum);           // te mueves con la tirada del 3º intento
        state.rolled = true; updateTurnButtons(); return;
      }
      log(`${p.name} no saca dobles. Le quedan ${p.jail} turno(s) en la cárcel.`);
      state.rolled = true; renderPlayers(); updateTurnButtons(); return;
    }
  }

  let d1, d2;
  if (window.RolesConfig?.dice0to9 && window.Roles?.rollDie0to9) {
    d1 = Roles.rollDie0to9();
    d2 = Roles.rollDie0to9();
  } else {
    d1 = 1 + Math.floor(Math.random()*6);
    d2 = 1 + Math.floor(Math.random()*6);
  }

  if (window.Roles && Roles.maybeEditDie) {
    var ed = Roles.maybeEditDie({ playerId: p.id, d1: d1, d2: d2 });
    if (ed && typeof ed.d1 === 'number') d1 = ed.d1;
    if (ed && typeof ed.d2 === 'number') d2 = ed.d2;
  }

  // v22: especiales 0–9 (no afecta a dobles actuales si dice0to9=false)
  try {
    const sp = window.Roles?.handleDiceSpecials?.({ d1, d2, playerId: p.id }) || {};
    if (sp.repeatTile) {
      log('⟳ Regla 0–0: repites la casilla y resuelves de nuevo.');
      onLand(p, p.pos);
    }
    if (sp.gotoNearestFiore) {
      const total = TILES.length;
      let i = (p.pos + 1) % total;
      while (!(TILES[i]?.type==='prop' && TILES[i]?.subtype==='fiore')) {
        i = (i + 1) % total;
        if (i === p.pos) break;
      }
      log('➡️  Regla 6 y 9: vas al FIORE más cercano.');
      p.pos = i; BoardUI?.refreshTiles?.(); onLand(p, i);
      // evita doble resolución inmediata del movimiento normal
      return;
    }
  } catch {}

  const sum = d1 + d2;
  state.lastRoll = sum;
  const isDouble = d1===d2;
  const isSnake  = d1===1 && d2===1;
  p.doubleStreak = isDouble ? (p.doubleStreak||0)+1 : 0;

  renderDice(d1, d2, `Total: ${sum}${isDouble?' — Dobles':''}`);

  // Doble 1: imagen + cárcel inmediata
  if (isSnake){
    log(`${p.name} dobles de 1 → cárcel directa (sin repetir).`);
    showDoublesOverlay();
    window.sendToJail?.(p);
    p.doubleStreak = 0;        // ← evita estados raros
    return;                     // endTurn ya lo hace sendToJail
  }

  movePlayer(p, sum);

  // Dobles normales: hasta 3 tiradas, luego cárcel
  if (isDouble){
    document.getElementById('doubleOverlay').style.display='block';
    setTimeout(()=>{ document.getElementById('doubleOverlay').style.display='none'; }, 900);

    if (p.doubleStreak >= 3){
      log(`${p.name} saca 3 dobles seguidos → cárcel.`);
      window.sendToJail?.(p);
      p.doubleStreak = 0;
      state.rolled = true; updateTurnButtons(); return;
    }
    log(`${p.name} dobles #${p.doubleStreak}: tiras otra vez.`);
    state.rolled = false; updateTurnButtons(); return;
  }

  // Tirada normal
  state.rolled = true; updateTurnButtons();
}

function applyFiorePayroll(player){
  const tiles = TILES.filter(t=>t.type==='prop' && t.subtype==='fiore' && t.owner===player.id);
  tiles.forEach(t=>{
    const pay = (t.workers||0) * (t.wagePer||1);
    if (pay>0){ transfer(player, Estado, pay, {taxable:false, deductible:true, reason:`Salarios Fiore (${t.workers}×${t.wagePer})`}); ensureAlive(player); }
  });
}

function endTurn() {
  if (state._endingTurn) return;
  state._endingTurn = true;
  try {
    if (state.auction && state.auction.open) { alert('No puedes terminar el turno mientras hay una subasta en curso.'); return; }
    applyLoansAtTurnEnd?.();
    applyFiorePayroll?.(state.players[state.current]);
    // NUEVO: construir automático del Estado
    window.stateAutoBuildHotels?.();

    // Tick de modificadores de eventos
    if ((state.rentEventTurns||0) > 0){ state.rentEventTurns--; if (!state.rentEventTurns) { state.rentEventMul = 1; log('⏳ Fin de modificador de rentas.'); } }
    if ((state.buildEventTurns||0) > 0){ state.buildEventTurns--; if (!state.buildEventTurns) { state.buildEventMul = 1; log('⏳ Fin de modificador de construcción.'); } }
    if ((state.rentFlatTurns||0)  > 0){ state.rentFlatTurns--;  if (!state.rentFlatTurns)  { state.rentFlatBonus = 0; log('⏳ Fin de alquiler +1.'); } }
    if ((state.ivaRentTurns||0) > 0){ state.ivaRentTurns--; if (!state.ivaRentTurns){ state.rentIVAMul = 1; log('⏳ Fin de IVA en rentas.'); } }
    if ((state.ivaBuildTurns||0) > 0){ state.ivaBuildTurns--; if (!state.ivaBuildTurns){ state.buildIVAMul = 1; log('⏳ Fin de IVA en construcción.'); } }

    // === [PATCH] Ticks de efectos nuevos ===
    // ownerRentMul (multiplicador por propietario)
    if (state.ownerRentMul){
      for (const [pid, obj] of Object.entries(state.ownerRentMul)){
        if (!obj) continue;
        if ((obj.turns||0) > 0){ obj.turns--; if (!obj.turns) delete state.ownerRentMul[pid]; }
      }
    }
    // rentFilters (efectos por categoría)
    if (Array.isArray(state.rentFilters)){
      state.rentFilters.forEach(ef => { if (ef.turns>0) ef.turns--; });
      state.rentFilters = state.rentFilters.filter(ef => ef.turns>0);
    }
    // rentCap
    if (state.rentCap && (state.rentCap.turns||0) > 0){
      state.rentCap.turns--; if (!state.rentCap.turns) state.rentCap = null;
    }
    // embargo de rentas
    if (state.garnish){
      for (const [pid, g] of Object.entries(state.garnish)){
        if (!g) continue;
        if ((g.turns||0) > 0){ g.turns--; if (!g.turns) delete state.garnish[pid]; }
      }
    }
    // bloqueo hipoteca (por jugador)
    if (state.blockMortgage){
      for (const [pid, t] of Object.entries(state.blockMortgage)){
        if (t>0){ state.blockMortgage[pid] = t-1; if (!state.blockMortgage[pid]) delete state.blockMortgage[pid]; }
      }
    }
    // huelga de obras
    if ((state.blockBuildTurns||0) > 0){ state.blockBuildTurns--; }
    // racionamiento cemento: devolver stock al final
    if (state.cement && state.cement.turns>0){
      state.cement.turns--;
      if (!state.cement.turns){
        BANK.housesAvail += (state.cement.taken||0);
        state.cement = null;
        log('⏳ Fin del racionamiento de cemento: se devuelve stock de casas.');
      }
    }

    state.rolled = false;
    updateTurnButtons?.();
    state.current = nextAlive(state.current);
    state.turnCount = (state.turnCount || 0) + 1;
    if (window.UIX?.track.onTurn) UIX.track.onTurn(state.turnCount);

    // v22: ciclo de gobierno, vencimientos préstamos corruptos, etc.
    try { window.Roles?.tickTurn(); } catch {}

    // Aplica cobros periódicos (fentanilo, etc.) y movimientos pendientes si los hay
    try {
      const getPlayerById = (id) => (id === 'E' || id === Estado) ? Estado : state.players[id];

      for (const pay of pays) {
        if (pay.toType === 'tileOwner') {
          const t = TILES[pay.tileId];
          const owner = t?.owner;
          if (owner != null) {
            transfer( getPlayerById(pay.fromId), getPlayerById(owner),
              pay.amount, { taxable:false, reason: pay.reason || 'Estado' }
            );
          }
        }
      }
    } catch(e) { console.error('Error procesando pagos pendientes de Roles:', e); }

    renderPlayers();
    log(`— Turno de ${state.players[state.current].name} —`);

    // [PATCH] Hooks de inicio de turno para módulos
    try {
      const p = state.players[state.current];
      // GDM.onTurnStart está parcheado por GameRiskPlus para incluir su propia lógica (margin calls, mantenimiento)
      if (window.GameDebtMarket?.onTurnStart) {
        const maintFee = GameDebtMarket.onTurnStart(p.id) || 0;
        if (maintFee > 0) {
          log(`💸 Mantenimiento dinámico: ${p.name} paga ${window.fmtMoney?.(maintFee) || maintFee}.`);
        }
      }
    } catch(e) { console.error("Error en hooks de inicio de turno", e); }
  } finally {
    state._endingTurn = false;
  }
}

function showDoublesOverlay() {
  const overlay = document.getElementById('doubleOverlay');
  if (!overlay) return;
  overlay.innerHTML = '<img src="img/doubles.jpg" alt="Dobles">';
  overlay.style.display = 'flex';
  setTimeout(()=>{ overlay.style.display='none'; }, 2200);
}

document.addEventListener('DOMContentLoaded', ()=>{
  const rollBtn = document.getElementById('roll');
  if (rollBtn && !rollBtn.__wired){
    rollBtn.__wired = true;
    rollBtn.addEventListener('click', roll);
  }

  const endBtn = document.getElementById('endTurn');
  if (endBtn && !endBtn.__wired){
    endBtn.__wired = true;
    endBtn.addEventListener('click', endTurn);
  }
});
window.roll = roll;
window.endTurn = endTurn;

state.usedTransportHop = false;

// === GUARDAR / CARGAR ===
function saveGame(slot='slot1'){
  const data = {
    v: 15,
    ts: Date.now(),
    players: state.players.map(p=>({
      id: p.id, name: p.name, money: p.money, pos: p.pos,
      alive: !!p.alive, jail: p.jail||0, taxBase: p.taxBase||0,
      doubleStreak:p.doubleStreak||0
    })),
    estado: { money: Math.floor(Estado.money||0) },
    owners: TILES.map(t => t.type==='prop' ? (t.owner ?? null) : null),
    current: state.current||0,
    rolled: state.rolled || false,    
    extras: TILES.map(t => (t.type==='prop' && t.subtype==='fiore') ? {workers:t.workers||0} : null),
    usedTransportHop: !!state.usedTransportHop
  };
  localStorage.setItem(`mono:${slot}`, JSON.stringify(data));
  log('💾 Partida guardada.');
}

function loadGame(slot='slot1'){
  const raw = localStorage.getItem(`mono:${slot}`);
  if (!raw){ log('No hay partida guardada.'); return; }
  const data = JSON.parse(raw);

  Estado.money = Math.floor(data?.estado?.money || 0);

  if (data.players) {
    state.players.forEach(p=>{
      const src = data.players.find(x=>x.id===p.id);
      if (src) Object.assign(p, src);
    });
  }

  if (data.owners) {
    TILES.forEach((t,i)=>{
      if (t.type==='prop') t.owner = data.owners[i];
    });
  }

  if (data.extras){
    TILES.forEach((t,i)=>{
      if (t && t.type==='prop' && t.subtype==='fiore' && data.extras[i]) t.workers = data.extras[i].workers||0;
    });
  }

  state.current = data.current||0;
  state.rolled = data.rolled||false;
  state.pendingTile = null;
  state.usedTransportHop = !!data.usedTransportHop;
  state.auction = null;
  const box = document.getElementById('auction');
  if (box) box.style.display = 'none';

  BoardUI?.refreshTiles?.();
  renderPlayers();
  if (typeof updateTurnButtons === 'function') updateTurnButtons();

  log('✅ Partida cargada.');
}

function downloadSave(slot='slot1'){
  const raw = localStorage.getItem(`mono:${slot}`) || '{}';
  const blob = new Blob([raw], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `partida_${slot}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importSaveFile(file, slot='slot1'){
  const r = new FileReader();
  r.onload = e => {
    localStorage.setItem(`mono:${slot}`, e.target.result);
    loadGame(slot);
  };
  r.readAsText(file);
}

window.addEventListener('beforeunload', ()=>saveGame('autosave'));

// ===== Noticias económicas (titulares) =====
function headline(msg){ log(`🗞️ <b>${msg}</b>`); }

function news_build_cost(pct=10, turns=3){
  state.buildEventMul  = Math.max(0, 1 + pct/100);
  state.buildEventTurns = Math.max(1, Math.floor(turns));
  headline(`El ayuntamiento aprueba una nueva ley de construcción. ¡El coste de las casas sube un ${pct}% durante ${turns} turnos!`);
}

function news_rent_mul(pct=10, turns=3){
  state.rentEventMul   = Math.max(0, 1 + pct/100);
  state.rentEventTurns = Math.max(1, Math.floor(turns));
  headline(`Boom de demanda: los alquileres suben un ${pct}% durante ${turns} turnos.`);
}

function news_rent_flat(amount=10, turns=3){
  state.rentFlatBonus  = Math.floor(amount);
  state.rentFlatTurns  = Math.max(1, Math.floor(turns));
  headline(`Subvención temporal: +${amount} a cada alquiler durante ${turns} turnos.`);
}

function news_iva_rent(pct=21, turns=3){
  state.rentIVAMul   = Math.max(1, 1 + pct/100);
  state.ivaRentTurns = Math.max(1, Math.floor(turns));
  headline(`Hacienda aplica IVA del ${pct}% a los alquileres durante ${turns} turnos.`);
}

function news_iva_build(pct=21, turns=3){
  state.buildIVAMul   = Math.max(1, 1 + pct/100);
  state.ivaBuildTurns = Math.max(1, Math.floor(turns));
  headline(`IVA del ${pct}% en construcción durante ${turns} turnos.`);
}

// Exponer por consola si quieres probar rápido:
Object.assign(window, { headline, news_build_cost, news_rent_mul, news_rent_flat, news_iva_rent, news_iva_build });

/* v13 – Parte 6/7: efectos al caer y sistema de subastas */

// === [PATCH] Ajuste de alquileres con eventos ===
function adjustRentForEvents(payer, tile, base){
  let rent = Math.max(0, Math.round(base||0));

  // Multiplicadores globales
  if (state.rentEventMul) rent = Math.round(rent * state.rentEventMul);
  if (state.rentFlatBonus) rent = Math.max(0, rent + state.rentFlatBonus);

  // Tope global de renta
  if (state.rentCap && state.rentCap.amount>0) {
    rent = Math.min(rent, state.rentCap.amount);
  }

  // Multiplicadores por propietario
  const ownerId = (tile.owner==='E') ? 'E' : tile.owner;
  if (state.ownerRentMul && state.ownerRentMul[ownerId]){
    rent = Math.round(rent * state.ownerRentMul[ownerId].mul);
  }

  // Multiplicadores por categoría (festival, industria, ocio, transporte)
  if (Array.isArray(state.rentFilters)) {
    for (const ef of state.rentFilters) {
      if (ef.turns<=0) continue;
      try { if (ef.match(tile)) rent = Math.round(rent * ef.mul); } catch {}
    }
  }

  // Nunca negativo
  return Math.max(0, rent|0);
}

function onLand(p, idx){
  const getPlayerById = (id) => (id === 'E' || id === Estado) ? Estado : state.players[id];
  const t = TILES[idx];
  if (!t) return;
  
  // v22: registrar aterrizaje (banca corrupta, farmazixe, etc.)
  try { Roles.onTileLanding(p.id, idx); } catch(e){}

  // [PATCH] UIX Heatmap tracking
  if (window.UIX?.track.onLand) UIX.track.onLand(idx);

  // Si es una casilla de banca corrupta: menú rápido
  try {
    var st = Roles.exportState ? Roles.exportState() : null;
    var cbt = st && st.corruptBankTiles || [];
    if (Array.isArray(cbt) && cbt.indexOf(idx) !== -1) {
      var opt = window.prompt(
        'Banca corrupta:\n1) Préstamo corrupto\n2) Securitizar alquileres (' +
        (Roles && RolesConfig ? (RolesConfig.securiTicks||3) : 3) + ' ticks, anticipo ' +
        (Roles && RolesConfig ? (RolesConfig.securiAdvance||150) : 150) + ')\n(Enter = nada)',
        ''
      );
      if (opt === '1') {
        var A = Number(window.prompt('Importe del préstamo:', '300'))||0;
        var Rr = Number(window.prompt('Tipo (%, ej 20):', '20'))||0;
        var Tt = Number(window.prompt('Ticks (<=30):', '12'))||0;
        var L = Roles.requestCorruptLoan({ playerId: p.id, amount: A, rate: Rr, ticks: Tt, tileId: idx });
        if (!L || !L.accepted) { alert((L && L.reason) ? L.reason : 'Rechazado'); }
        else {
          // abona el principal al jugador (dinero “sale” del Estado si quieres reflejarlo)
          transfer(Estado, getPlayerById(p.id), A, { taxable:false, reason:'Préstamo corrupto' });
          log('Préstamo OK: devolver ' + L.dueAmount + ' en T' + L.dueTurn + '.');
        }
      } else if (opt === '2') {
        var S = Roles.corruptBankSecuritize({ playerId: p.id });
        if (!S || !S.ok) { alert((S && S.reason) ? S.reason : 'No se pudo securitizar'); }
        else {
          // anticipo al jugador y a partir de ahora sus alquileres van al Estado por S.ticks
          transfer(Estado, getPlayerById(p.id), S.advance, { taxable:false, reason:'Securitización corrupta' });
          log('Securitización: cobras ' + S.advance + ' ahora; durante ' + S.ticks + ' ticks tus alquileres van al Estado.');
        }
      }
    }
  } catch(e){}

  switch(t.type){
    case 'start':
      log(`${p.name} descansa en SALIDA.`);
      break;

    case 'tax': {
      // v22: FBI cobra el bote si procede
      try {
        const fb = window.Roles?.onTaxTileLanding?.(p.id);
        if (fb?.payout > 0) {
          transfer(Estado, p, fb.payout, { taxable:false, reason:'Bote de impuestos (FBI)' });
        }
      } catch {}

      // 3.1 Regularización de IVA
      ensureVAT(p);
      const netIVA = Math.round((p.vatOut||0) - (p.vatIn||0));
      if (netIVA > 0){
        // Debe ingresar al Estado
        transfer(p, Estado, netIVA, { taxable:false, reason:'Regularización IVA (ingreso)' });
        try { window.Roles?.onTaxCollected?.(netIVA); } catch {}
        log(`IVA neto a ingresar: ${fmtMoney(netIVA)}.`);
      } else if (netIVA < 0){
        // Devolución del Estado
        transfer(Estado, p, -netIVA, { taxable:false, reason:'Regularización IVA (devolución)' });
        log(`IVA neto a devolver: ${fmtMoney(-netIVA)}.`);
      } else {
        log('IVA neto: 0. Sin movimientos.');
      }
      p.vatOut = 0; p.vatIn = 0;

      // 3.2 Impuesto sobre la renta (33%) sobre taxBase
      var taxMul = (window.Roles?.getTaxMultiplier?.() || 1) *
                   (window.Roles?.getPlayerTaxMultiplier?.(p.id) || 1);
      var base = Math.max(0, Math.round((p.taxBase || 0) * 0.33 * taxMul));
      if (base > 0){
        transfer(p, Estado, base, { taxable:false, reason:'Impuesto' });
        try { window.Roles?.onTaxCollected?.(base); } catch(e){}
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
      p.jail = 3; // hasta 3 intentos
      BoardUI?.refreshTiles?.();
      log(`🚔 ${p.name} va a la cárcel (máx 3 intentos).`);
      state.rolled = true; updateTurnButtons();
      break;

    case 'park':
      log(`${p.name} se relaja en el parque.`);
      break;

    case 'slots':
      playSlotsFree(p, t);
      break;

    case 'event':
      log(`🃏 ${p.name} cae en EVENTO.`);
      try{ window.drawEvent?.(p); }catch(e){ log('Error al ejecutar evento.'); }
      break;

    case 'prop': {
      if (t.owner === null){
        // [PATCH] Nueva gestión de subastas con Debt Market
        if (window.GameDebtMarket && window.GameDebtMarket.onLandProperty) {
          GameDebtMarket.onLandProperty(idx, t);
        } else {
          // Fallback a la lógica original si el módulo no carga
          showCard(idx,{canAuction:true});
          startAuctionFlow(idx, { sealed: false });
        }
        return;
      }
      if (t.owner === p.id){
        log(`${p.name} cae en su propia propiedad.`);
        if (['rail','ferry','air','bus'].includes(t.subtype)) offerTransportHop(p, idx, t);
        if (t.subtype==='fiore'){
          const n = Number(prompt('Trabajadores en Fiore (0-5):', t.workers||0));
          if (Number.isFinite(n) && n>=0 && n<=5){ t.workers = n; BoardUI.refreshTiles(); }
        }
      } else {
        // Casinos: solo si el dueño NO es el Estado (el Estado no puede ser dueño de casinos)
        if (t.subtype==='casino_bj' || t.subtype==='casino_roulette'){
          if (t.owner !== 'E'){
            const owner = state.players[t.owner];
            if (t.subtype==='casino_bj'){ playBlackjack(p, owner, t); break; }
            if (t.subtype==='casino_roulette'){ playRoulette(p, owner, t); break; }
          }
          // si llegase a ser del Estado (no debería), cae a pago de "alquiler" normal abajo
        }

        // v15-part6.js — en onLand(), rama case 'prop', justo antes del bloque de “PAGO DE ALQUILER…”
        if (t.subtype === 'fiore') {
          const workers = t.workers||0;
          const per     = t.workerRent||70;
          const total   = workers * per;
          const payee   = t.mortgaged ? Estado : state.players[t.owner];

          if (total > 0 && payee) {
            const ivaMul = state.rentIVAMul || 1;
            const base = (ivaMul > 1) ? Math.round(total / ivaMul) : total;
            const iva  = Math.max(0, total - base);

            transfer(p, payee, base, { taxable:false, deductible:true, reason:`Fiore ${workers}×${per}` });
            if (iva > 0){
              transfer(p, payee, iva, { taxable:false, deductible:true, reason:`IVA Fiore` });
              markIVAPaid(p, iva, ' (Fiore)');
              markIVACharged(payee===Estado? Estado : payee, iva, ' (Fiore)');
            }

            // v22: propina aleatoria al/los Proxeneta(s) (no descuenta a nadie)
            try {
              const totalPagado = (base||0) + (iva||0);
              const resTip = window.Roles?.onFiorePayment?.({ payerId: p.id, amount: totalPagado });
              if (resTip?.tips?.length) {
                resTip.tips.forEach(tp => {
                  const rec = state.players.find(x => x.id === tp.toId);
                  if (rec) transfer(Estado, rec, tp.amount, { taxable:false, reason:'Propina FIORE' });
                });
              }
            } catch {}
            ensureAlive(p);
          } else {
            log(`${p.name} no paga en Fiore (sin trabajadores o sin dueño válido).`);
          }
          break; // Importante: no seguir al bloque de alquiler genérico
        }
        // [PATCH] Sustituye el bloque de pago de alquiler con IVA y eventos
        const baseRent = (t.owner === 'E' && t.mortgaged) ? 0 : getRent(t);

        // ¿a quién se paga?
        let payee = null;
        if (t.owner === 'E') {
          payee = t.mortgaged ? null : Estado;
        } else if (t.mortgaged) {
          payee = Estado;
        } else {
          payee = state.players[t.owner];
        }

        // Aplicar modificadores de eventos
        const adjusted = adjustRentForEvents(p, t, baseRent);

        // [PATCH] UIX Heatmap tracking
        if (window.UIX?.track.onRent) UIX.track.onRent(idx, adjusted);

        // [PATCH] Hook de onRent para IA de aprendizaje
        try {
          if (window.GameRiskPlus?.onRent) {
            GameRiskPlus.onRent(idx, adjusted, p.id, t.owner);
          }
        } catch(e) { console.error("Error en hook onRent", e); }

        if (adjusted > 0 && payee) {
          // v22 — Huelga + Embargo/Securitización (redirige rentas al Estado)
          if (window.Roles?.shouldBlockRent?.()) {
            log('Huelga general: no se cobra alquiler.');
          } else {
            let redirectToEstado = false;
            let reason = `Alquiler en ${t.name}`;
            try {
              // Embargo por "Desahucio exprés" (redirige la renta de esta casilla)
              if (window.Roles?.shouldRedirectRentToEstado?.(idx)) {
                redirectToEstado = true;
                reason = 'Renta embargada';
              }
              // Securitización del PROPIETARIO (redirige TODAS sus rentas durante X ticks)
              const ownerId = t.owner;
              if (!redirectToEstado && window.Roles?.shouldRedirectRentToEstadoForOwner?.(ownerId)) {
                redirectToEstado = true;
                reason = 'Renta securitizada';
              }
            } catch (e) {}

            const target = redirectToEstado ? Estado : payee;
            const ivaMul = state.rentIVAMul || 1;
            if (ivaMul > 1){
              const base = Math.round(adjusted / ivaMul);
              const iva  = Math.max(0, adjusted - base);
              transfer(p, target, base, { taxable:false, deductible:true, reason: reason });
              transfer(p, target, iva,  { taxable:false, deductible:true, reason: `IVA ${reason}` });
              try { markIVAPaid(p, iva, ' (alquiler)'); markIVACharged(target===Estado? Estado : target, iva, ' (alquiler)'); } catch{}
            } else {
              transfer(p, target, adjusted, { taxable:false, deductible:true, reason: reason });
            }
            ensureAlive(p);
          }
        } else {
          log(`${p.name} no paga alquiler (sin dueño válido o alquiler 0).`);
        }
      }
      break;
    }

    default:
      log(`${p.name} cae en ${t.name || t.type}.`);
  }
}

// v22: Unifica la resolución de cartas y eventos
function resolverCarta(carta, jugador, idx) {
  const getPlayerById = (id) => (id === 'E' || id === Estado) ? Estado : state.players[id];

  // v22: carta/evento unificado
  var out = (window.Roles && Roles.triggerEvent)
    ? Roles.triggerEvent(carta && carta.nombre, { playerId: jugador.id, tileId: idx })
    : null;
  if (out && out.banner) { alert(out.banner); }

  // Aplica colas de pagos y movimientos
  var pays = (window.Roles && Roles.consumePendingPayments) ? Roles.consumePendingPayments() : [];
  for (var i = 0; i < pays.length; i++) {
    var pay = pays[i];
    if (pay.toType === 'estado') {
      transfer(getPlayerById(pay.fromId), Estado, pay.amount, { taxable:false, reason: pay.reason });
    } else if (pay.toType === 'opponents') {
      for (var j = 0; j < state.players.length; j++) {
        var pl = state.players[j];
        if (pl.id !== pay.toId) transfer(pl, getPlayerById(pay.toId), pay.amount, { taxable:false, reason: pay.reason });
      }
    } else if (pay.toType === 'tileOwner') {
      var t = TILES[pay.tileId], owner = t && t.owner;
      if (owner != null) transfer(getPlayerById(pay.fromId), getPlayerById(owner), pay.amount, { taxable:false, reason: pay.reason });
    }
  }
  var moves = (window.Roles && Roles.consumePendingMoves) ? Roles.consumePendingMoves() : [];
  for (var k = 0; k < moves.length; k++) {
    var mv = moves[k];
    if (mv.effect === 'jail')  sendToJail(getPlayerById(mv.playerId), mv.turns);
    if (mv.effect === 'skip')  addSkipTurn(getPlayerById(mv.playerId), mv.turns);
  }
}


/* ===== Subastas ===== */
function startAuctionFlow(tileIndex, opts = {}){
  // [PATCH] Veto de subasta: si existe y el iniciador NO es el poseedor del veto, cancela una vez
  try{
    const holder = state.auctionVeto && state.auctionVeto.holderId;
    if (holder != null && holder !== state.players[state.current]?.id){
      log('🛑 Veto de subasta ejercido. Se cancela la subasta.');
      state.auctionVeto = null;
      return;
    }
  }catch{}

  const t = TILES[tileIndex];
  if (t.owner !== null || t.type!=='prop') return;

  // Blindaje extra: si por cualquier razón se llama con la carta abierta, la cerramos
  const ov = document.getElementById('overlay');
  if (ov) ov.style.display = 'none';
  if (window.state) window.state.pendingTile = null;

  const sealed = opts.sealed === true;

  const box = $('#auction');
  state.auction = {
    tile: tileIndex,
    price: Math.max(1, t.price||1),
    bestBid: 0,
    bestPlayer: null,   // pid numérico o 'E' para Estado
    active: new Set(state.players.filter(x=>x.alive).map(x=>x.id)),
    open: true, sealed: sealed,
    bids: sealed ? {} : undefined,
    // Tope Estado: 0 en casino/fiore → no puja
    stateMax: (['casino_bj','casino_roulette','fiore'].includes(t.subtype))
              ? 0
              : Math.max(0, Math.min(Math.round((t.price||0)*1.30), Math.floor(Estado.money||0))),
    timer: null
  };

  box.style.display = 'block';
  drawAuction();
  // Arrancar puja automática del Estado
  maybeStateAutoBid();

  const endTurnBtn = document.getElementById('endTurn');
  if (endTurnBtn) endTurnBtn.disabled = true;
  updateTurnButtons();
}

function getNextStep(current){
  // Pasos “humanos” y conservadores
  if (current < 50) return 10;
  if (current < 200) return 20;
  if (current < 500) return 50;
  return 100;
}

function maybeStateAutoBid(){
  const a = state.auction; if(!a || !a.open) return;

  const t = TILES[a.tile];
  if (t && ['casino_bj','casino_roulette','fiore'].includes(t.subtype)) return; // no puja esos

  if (window.Roles && Roles.isEstadoAuctionBlocked && Roles.isEstadoAuctionBlocked()) {
    log('Estado no puja (bloqueado desde debug).');
    // salta la puja del Estado y sigue con la lógica del resto
  } else {
    const sealed = !!a.sealed;

    // Si ya alcanzó su tope o no hay dinero, no puja
    const cap = Math.max(0, Math.min(a.stateMax, Math.floor(Estado.money||0)));

    if (sealed){
      const currE = Math.max(0, (a.bids && a.bids['E']) || 0);
      if (currE >= cap) return;

      const step = getNextStep(currE);
      const next = Math.min(cap, currE + step);
      if (next <= currE) return;

      a.bids ||= {};
      a.bids['E'] = next;
      drawAuction();

      clearTimeout(a.timer);
      a.timer = setTimeout(maybeStateAutoBid, 600);
      return;
    }

    if (a.bestPlayer === 'E') return; // visible: si ya va ganando, no re-puja
    if (a.bestBid >= cap) return;

    // Calcular siguiente puja del Estado
    const step = getNextStep(a.bestBid);
    const next = Math.min(cap, a.bestBid + step);
    if (next <= a.bestBid) return;

    a.bestBid = next;
    a.bestPlayer = 'E';
    drawAuction();

    // [PATCH] Bot AI Ticks during auction (only for non-sealed)
    if (!a.sealed) {
      try {
        if (window.GameRiskPlus?.Bots?.predatorTick) {
          // Itera sobre todos los jugadores para que los bots puedan actuar.
          // La lógica del bot (predatorTick) decide si debe pujar o no.
          (state.players || []).forEach(p => {
            // Para que un bot actúe, se podría comprobar una flag como `p.isBot`.
            // Por ahora, se llama para todos los jugadores vivos que no sean el postor actual.
            if (p.alive && p.id !== a.bestPlayer) {
               GameRiskPlus.Bots.predatorTick(p.id);
            }
          });
          // Vuelve a dibujar la subasta por si un bot ha pujado
          drawAuction();
        }
      } catch(e) { console.error("Error en bot tick de subasta", e); }
    }

    clearTimeout(a.timer);
    a.timer = setTimeout(maybeStateAutoBid, 850); // Delay para dar tiempo a ver las pujas
  }
}

function drawAuction(){
  const a = state.auction; const box = $('#auction'); if(!a||!box) return;
  const t = TILES[a.tile];
  const players = state.players.filter(p=>a.active.has(p.id));

  const sealed = !!a.sealed;

  let header = sealed
    ? `<strong>Subasta (oculta): ${t.name}</strong> — Valor: ${fmtMoney(t.price)}<br><em>Pujas ocultas activas. Nadie ve quién va ganando ni cantidades.</em>`
    : (()=> {
        const bestName = a.bestPlayer==='E'
          ? 'Estado'
          : (a.bestPlayer!=null ? state.players[a.bestPlayer].name : '-');
        return `<strong>Subasta: ${t.name}</strong> — Valor: ${fmtMoney(t.price)}<br>
                Mejor puja: <b>${bestName}</b> por <b>${fmtMoney(a.bestBid)}</b>`;
      })();

  box.innerHTML = `
    ${header}
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
      <button id="awardAuction" class="primary">Adjudicar</button>
    </div>
  `;

  box.querySelectorAll('button[data-act="bid"]').forEach(btn=>{
    btn.onclick = ()=>{
      const pid = parseInt(btn.getAttribute('data-p'),10);
      if (!a.active.has(pid)) return;
      const step= parseInt(btn.getAttribute('data-step'),10);
      const p = state.players[pid];

      if (sealed){
        a.bids ||= {};
        const curr = Math.max(0, a.bids[pid]||0);
        const nextBid = curr + step;
        if (p.money < nextBid){ log(`${p.name} no puede aumentar su puja.`); return; }
        a.bids[pid] = nextBid;
        // No mostramos nada: puja oculta
        drawAuction();
        clearTimeout(a.timer);
        a.timer = setTimeout(maybeStateAutoBid, 450);
      } else {
        // siguiente puja visible
        const nextBid = Math.max(a.bestBid + step, step);
        if (p.money < nextBid){ log(`${p.name} no puede pujar ${fmtMoney(nextBid)}.`); return; }
        a.bestBid = nextBid; a.bestPlayer = pid;
        drawAuction();
        clearTimeout(a.timer);
        a.timer = setTimeout(maybeStateAutoBid, 450);
      }
    };
  });
  box.querySelectorAll('button[data-act="pass"]').forEach(btn=>{
    btn.onclick = ()=>{
      const pid = parseInt(btn.getAttribute('data-p'),10);
      a.active.delete(pid);
      if (a.sealed && a.bids) delete a.bids[pid];
      log(`${state.players[pid].name} pasa.`);
      drawAuction();
    };
  });

  $('#awardAuction').onclick = ()=>{
    awardAuction();
  };
}

function awardAuction(){
  if (state._endingTurn) return; // ya se está terminando
  const a = state.auction; if(!a) return;
  const t = TILES[a.tile];

  const sealed = !!a.sealed;

  // Si no hay pujas: desierta
  if ((!sealed && a.bestPlayer == null) ||
      (sealed && (!a.bids || Object.keys(a.bids).length===0))) {
    log(sealed ? 'Subasta oculta desierta.' : 'Subasta desierta.');
    $('#auction').style.display = 'none';
    state.auction = null;
    const endTurnBtn = document.getElementById('endTurn');
    if (endTurnBtn) endTurnBtn.disabled = false;
    updateTurnButtons();
    return;
  }

  let winnerId = a.bestPlayer;
  let price    = a.bestBid;

  if (sealed){
    // Elegir la mayor puja
    const entries = Object.entries(a.bids||{});
    let bestK = null, bestV = 0;
    for (const [k,v] of entries){
      if (!Number.isFinite(v)) continue;
      if (v > bestV){ bestV = v; bestK = k; }
    }
    winnerId = (bestK === 'E') ? 'E' : parseInt(bestK,10);
    price    = bestV;
  }

  // Ganó Estado
  if (winnerId==='E'){
    if ((Estado.money||0) < price){
      log('El Estado no tiene fondos suficientes para adjudicarse (se cancela).');
      return;
    }
    // Silenciar logs si es oculta para no mostrar cantidades de reparto
    let prevLog = null;
    if (sealed){ prevLog = window.log; window.log = function(){}; }

    // paga de su caja
    Estado.money = Math.max(0, Math.floor((Estado.money||0) - price));
    t.owner = 'E';

    // Reparto del gasto del Estado entre los demás jugadores vivos (no tributable)
    const vivos = state.players.filter(p=>p.alive);
    if (vivos.length > 0){
      const base = Math.floor(price / vivos.length);
      let resto = price - base * vivos.length;
      vivos.forEach((p, i)=>{
        const extra = i < resto ? 1 : 0;
        const amt = base + extra;
        if (amt > 0) giveMoney(p, amt, { taxable:false, reason:`Reparto por compra del Estado: ${t.name}` });
      });
    }

    if (sealed && prevLog){ window.log = prevLog; }
    log(sealed ? `Subasta oculta adjudicada al Estado (${t.name}).` : `El Estado se adjudica ${t.name} por ${fmtMoney(price)}.`);

    clearTimeout(a.timer);
    $('#auction').style.display='none'; state.auction=null;
    BoardUI.refreshTiles(); renderPlayers();
    const endTurnBtn = document.getElementById('endTurn');
    if (endTurnBtn) endTurnBtn.disabled = false;
    updateTurnButtons?.();
    return;
  }

  // Ganó un jugador
  const buyer = state.players[winnerId];
  if (!buyer?.alive || buyer.money < price){ log('Adjudicación fallida.'); return; }

  // Silenciar logs si es oculta para no mostrar cantidad en el feed
  let prevLog = null;
  if (sealed){ prevLog = window.log; window.log = function(){}; }
  transfer(buyer, Estado, price, {taxable:false, reason:`Compra en subasta: ${t.name}`});
  if (sealed && prevLog){ window.log = prevLog; }
  t.owner = buyer.id;

  clearTimeout(a.timer);
  $('#auction').style.display='none'; state.auction=null;
  BoardUI.refreshTiles(); renderPlayers();

  const endTurnBtn = document.getElementById('endTurn');
  if (endTurnBtn) endTurnBtn.disabled = false;
  updateTurnButtons();

  // Mensaje final
  if (sealed){
    log(`Subasta oculta adjudicada a ${buyer.name} (${t.name}).`);
  }
}

// v15-part6.js — reemplazar función entera
function updateTurnButtons() {
  const rollBtn = document.getElementById('roll');
  const endTurnBtn = document.getElementById('endTurn');
  const a = state.auction;

  // Durante subasta: ocultar ambos y deshabilitar por si acaso
  if (a && a.open) {
    if (rollBtn) rollBtn.style.display = 'none';
    if (endTurnBtn) {
      endTurnBtn.style.display = 'none';
      endTurnBtn.disabled = true;
    }
    return;
  }

  // Fuera de subasta: UI normal
  if (rollBtn) rollBtn.style.display = state.rolled ? 'none' : '';
  if (endTurnBtn) {
    endTurnBtn.style.display = state.rolled ? '' : 'none';
    endTurnBtn.disabled = false;
  }

  // v22: Botón de préstamo corrupto
  try {
    const btn = document.getElementById('corruptLoan');
    if (btn && window.Roles?.exportState) {
      const p = state.players[state.current];
      const landings = new Map(window.Roles.exportState().bankLandingAttempt || []);
      const landing = landings.get(p.id);
      const canTry = landing && landing.turn === state.turnCount && !landing.attempted;
      btn.style.display = canTry ? '' : 'none';
    }
  } catch {}
}
function offerTransportHop(p, idx, t){
  if (state.usedTransportHop) return;
  const same = (x)=> x.type==='prop' && (
    (t.subtype==='rail'&& (x.subtype==='rail'||(window.BUS_COUNTS_WITH_METRO&&x.subtype==='bus'))) ||
    (t.subtype==='bus' && (x.subtype==='bus'||(window.BUS_COUNTS_WITH_METRO&&x.subtype==='rail'))) ||
    (t.subtype===x.subtype)
  );
  const owns = TILES.map((x,i)=>({x,i})).filter(o=> same(o.x) && o.x.owner===p.id && o.i!==idx);
  if (!owns.length) return;

  const niceNames = { rail: 'metro', bus: 'Bizkaibus', ferry: 'ferry', air: 'aéreo' };
  const nice = niceNames[t.subtype] || t.subtype;
  const list = owns.map((o,k)=>`${k+1}. ${o.x.name}`).join('\n');
  const sel = prompt(`Moverte gratis a otro transporte (${nice}) tuyo este turno:\n${list}\nElige número (o cancela)`);
  const n = parseInt(sel,10);
  if (!Number.isFinite(n) || n<1 || n>owns.length) return;

  const dest = owns[n-1];
  const from = p.pos;
  state.usedTransportHop = true; // reserva el “ticket” antes de animar
  animateTransportHop(p, from, dest.i, ()=>{
    p.pos = dest.i;
    BoardUI.refreshTiles();
    log(`${p.name} usa ${t.name} → ${dest.x.name}`);
    onLand(p, dest.i);
  });
}

// Cerrar carta para que se vea la subasta
const ov = document.getElementById('overlay');
if (ov) ov.style.display = 'none';

function applyAuctionButtons() {
  const a = state.auction;
  const box = $('#auction');
  if (!a || !box) return;

  // Habilitar o deshabilitar los botones según el estado de la subasta
  box.querySelectorAll('button[data-act="bid"]').forEach(btn=>{
    const pid = parseInt(btn.getAttribute('data-p'),10);
    btn.disabled = !a.active.has(pid);
  });
  box.querySelectorAll('button[data-act="pass"]').forEach(btn=>{
    const pid = parseInt(btn.getAttribute('data-p'),10);
    btn.disabled = !a.active.has(pid);
  });
  const endTurnBtn = document.getElementById('endTurn');
  if (endTurnBtn) endTurnBtn.disabled = a.open;
}

// === Casino: Blackjack (una mano, dueño es dealer)
function playBlackjack(player, owner, tile){
  if (!owner?.alive){ log('El dueño no puede actuar.'); return; }
  // [Inferencia] si gana el dealer, cada otro jugador paga 30; si gana un jugador, el dueño paga 15 al ganador.
  const players = state.players.filter(x=>x.alive && x.id!==owner.id);
  // simulación sencilla: dealer 17-23, cada jugador 15-23; >21 = se pasa
  const draw = (min,max)=> min + Math.floor(Math.random()*(max-min+1));
  const dealer = draw(17,23);
  const results = players.map(pl=>{
    const me = draw(15,23);
    const dealerWins = (dealer<=21) && (me>21 || dealer>=me);
    return {pl, dealerWins};
  });
  const dealerAllWin = results.every(r=>r.dealerWins);
  if (dealerAllWin){
    const pay = 30;
    results.forEach(({pl})=> transfer(pl, owner, pay, {taxable:false, reason:`Casino Blackjack en ${tile.name}`}));
    log(`🎰 Dealer (${owner.name}) gana. Todos pagan 30.`);
  } else {
    const winners = results.filter(r=>!r.dealerWins).map(r=>r.pl);
    winners.forEach(w=> transfer(owner, w, 15, {taxable:false, reason:`Casino Blackjack en ${tile.name}`}));
    log(`🎰 Ganan jugadores: ${winners.map(w=>w.name).join(', ')||'ninguno'}. ${owner.name} paga 15 a cada ganador.`);
  }
}

// === Casino: Ruleta (rojo/negro/verde)
function playRoulette(player, owner, tile){
  if (!owner?.alive){ log('El dueño no puede actuar.'); return; }
  const apuesta = prompt('Apuesta color (rojo/negro/verde) y cantidad. Ej: "rojo 50"');
  if(!apuesta) return;
  const m = apuesta.trim().toLowerCase().match(/(rojo|negro|verde)\s+(\d+)/);
  if(!m){ alert('Formato inválido'); return; }
  const color = m[1], amt = Math.max(1, parseInt(m[2],10));
  if (player.money < amt){ alert('No te llega.'); return; }

  const reds = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const n = Math.floor(Math.random()*37); // 0..36
  const outcome = (n===0)?'verde':(reds.has(n)?'rojo':'negro');

  // [Inferencia] pagos estándar: rojo/negro 1:1, verde 35:1
  const mult = (color==='verde')?35:1;
  if (color === outcome){
    transfer(owner, player, amt*mult, {taxable:false, reason:`Ruleta (${outcome}) en ${tile.name}`});
    log(`🎯 Ruleta: ${n} ${outcome}. Gana ${player.name} → cobra ${amt*mult}.`);
  } else {
    transfer(player, owner, amt, {taxable:false, reason:`Ruleta (${outcome}) en ${tile.name}`});
    ensureAlive(player);
    log(`🎯 Ruleta: ${n} ${outcome}. Pierde ${player.name} → paga ${amt}.`);
  }
}

// === Animación de transporte ===
function animateTransportHop(player, fromIdx, toIdx, done){
  try{
    const board = document.getElementById('board');
    const tiles = board.querySelectorAll('.tile');
    const fromEl = tiles[fromIdx], toEl = tiles[toIdx];
    if (!fromEl || !toEl) return done?.();

    const bRect = board.getBoundingClientRect();
    const f = fromEl.getBoundingClientRect();
    const t = toEl.getBoundingClientRect();

    const ghost = document.createElement('div');
    ghost.className = `chip p${player.id}`;
    ghost.style.position = 'absolute';
    ghost.style.left = (f.left - bRect.left + f.width - 26) + 'px';
    ghost.style.top  = (f.top  - bRect.top  + f.height - 26) + 'px';
    ghost.style.transition = 'transform .6s ease';
    ghost.style.pointerEvents = 'none';
    board.appendChild(ghost);

    // forzar reflow y animar
    requestAnimationFrame(()=>{
      const dx = (t.left - f.left);
      const dy = (t.top  - f.top );
      ghost.style.transform = `translate(${dx}px, ${dy}px)`;
    });

    ghost.addEventListener('transitionend', ()=>{
      ghost.remove();
      done?.();
    }, { once:true });
  } catch{ done?.(); }
}

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
        liquidez: { maxOverpay: 0.95, bidStep: 0.03 }
      },
      estimateFair(kind, meta){
        if (kind==='tile') return Math.max(1, meta.price||1);
        if (kind==='bundle') return Math.max(1, sum(meta.tiles.map(i=> (GameExtras._getTile(i)?.price)||1)));
        if (kind==='loan') return Math.max(1, pick(meta,'minPrice', 1));
        return 1;
      },
      maybeBid(profileName, playerId){
        const s=GameExtras._cfg.state; const a=s.auction; if (!a || !a.open) return;
        const prof=this.profiles[profileName||'value']; const p=(s.players||[]).find(x=>x.id===playerId); if(!p) return;
        // Meta para fair value
        const meta = (a.kind==='bundle') ? { tiles:a.bundleTiles } : (a.kind==='tile' ? GameExtras._getTile(a.assetId) : (a.kind==='loan' ? (s.loanListings||[]).find(x=>x.id===a.assetId): {}));
        const fair=this.estimateFair(a.kind, meta);
        const cap = Math.floor(fair * prof.maxOverpay);
        const next = Math.min(cap, Math.max(a.price, (a.bestBid||0)) + Math.ceil(fair*prof.bidStep));
        if (next> (a.bestBid||0) && (p.money||0)>=next){
          // usa tu función real de pujas si existe
          if (typeof global.placeBid === 'function') return safe(global.placeBid, playerId, next);
          // fallback: manipula estado (no recomendado en producción)
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
      }
    },

    _metricSeries(kind, pid){ // genera serie dummy de 10 puntos con ruido leve; reemplaza con tu telemetría
      const p=this._player(pid)||{}; const base={ cash:p.money||0, debt:this.balance._debtNet(pid), maint:this.balance._maintNext(pid), roi:this.balance._roiAvg(pid) }[kind]||0;
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
      .bjCards{ display:flex; gap:8px; flex-wrap:wrap }
      .card{ width:46px; height:64px; border-radius:8px; background:#f8fafc; color:#0f172a; display:flex; align-items:center; justify-content:center; font-weight:800; border:2px solid #0f172a20; transform: translateY(-12px) scale(.92); opacity:0 }
      .card.in{ transition: transform .35s ease, opacity .35s ease; transform: translateY(0) scale(1); opacity:1 }
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

/* v13 – Parte 7/7 (patched): construir, vender, hipoteca, préstamos
   — Sólo acciones del propietario + utilidades (applyTax, sendToJail).
   — NO redefine ni transfer, ni renderPlayers, ni newGame (eso queda en part4).
*/

// Stock por defecto si no existe un BANK global
window.BANK = window.BANK || { housesAvail: 32, hotelsAvail: 12 };

/* =================== PRESTS + TRADE + BANKRUPTCY + ESTADO IA (Mejorado) =================== */
/* Utilidades de seguridad (no-op si no existen en tu versión) */
function renderAll(){ try{ BoardUI?.refreshTiles?.(); renderPlayers?.(); }catch{} }
function getName(p){ return (p===Estado||p==='E') ? 'Estado' : (p?.name ?? '¿?'); }
function moneyOf(x){ return (x==='E'||x===Estado) ? (Estado.money||0) : (state.players[x?.id ?? x]?.money||0); }
function playerById(id){ return id==='E' ? Estado : state.players[id]; }
function _distribuirGastoEstado(monto, reason){
  const vivos = state.players.filter(p => p.alive);
  if (!vivos.length || monto <= 0) return;
  const base = Math.floor(monto / vivos.length);
  let resto = monto - base * vivos.length;
  vivos.forEach((p,i)=>{
    const extra = i < resto ? 1 : 0;
    giveMoney(p, base + extra, { taxable:false, reason });
  });
}

const isNormalProp = t => t && t.type==='prop' && !t.subtype;
function groupTiles(t) {
  const key = t.familia ?? t.color;
  return TILES.map((x, i) => ({ x, i }))
    .filter(o => isNormalProp(o.x) && ((o.x.familia ?? o.x.color) === key));
}
function ownsFullGroup(p,t){ const g=groupTiles(t); return g.length && g.every(o=>o.x.owner===p.id); }
function anyMortgaged(g){ return g.some(o=>o.x.mortgaged); }
function levelOf(x){ return x.hotel ? 5 : x.houses||0; } // 0..5 (5=hotel)
function canBuildEven(t,p){
  const g = groupTiles(t);
  const min = Math.min(...g.map(o=>levelOf(o.x)));
  return levelOf(t)===min && !anyMortgaged(g);
}
function canBuildHotel(t,p){
  const g = groupTiles(t);
  return t.houses===4 && g.every(o=>o.x.houses===4 || o.x.hotel);
}
function canSellEven(t,p){
  const g = groupTiles(t);
  const max = Math.max(...g.map(o=>levelOf(o.x)));
  return levelOf(t)===max;
}

function stateAutoBuildHotels(){
  const normal = t => t && t.type==='prop' && !t.subtype;
  const costOf = t => t.houseCost ?? Math.round((t.price||0)*0.5);
  const familias = [...new Set(TILES.filter(t => normal(t) && (t.familia ?? t.color))
                                  .map(t => t.familia ?? t.color))];

  familias.forEach(fam => {
    const group = TILES.map((x,i)=>({x,i}))
      .filter(o => normal(o.x) && ((o.x.familia ?? o.x.color) === fam));
    if (!group.length) return;
    if (!group.every(o=>o.x.owner==='E')) return;
    if (group.some(o=>o.x.mortgaged)) return;

    // Casas parejo hasta 4
    while (true){
      const lvls = group.map(o=> o.x.hotel ? 5 : (o.x.houses||0));
      const min = Math.min(...lvls), max = Math.max(...lvls);
      if (max>=4 && min>=4) break;
      const target = group.find(o=> (o.x.houses||0) < 4 && !o.x.hotel && (o.x.houses||0)===min);
      if (!target) break;
      const c = costOf(target.x);
      if (BANK.housesAvail<=0 || (Estado.money||0) < c) break;
      BANK.housesAvail--; target.x.houses = (target.x.houses||0)+1;
      Estado.money = Math.max(0, Math.floor((Estado.money||0) - c));
      _distribuirGastoEstado(c, `Reparto por obra del Estado: ${target.x.name}`);
      log(`🏠 Estado construye casa en ${target.x.name} por ${fmtMoney(c)}.`);
    }

    // Hoteles
    group.forEach(o=>{
      const t = o.x; if (t.hotel) return;
      if (t.houses===4 && BANK.hotelsAvail>0){
        const c = costOf(t);
        if ((Estado.money||0) >= c){
          BANK.hotelsAvail--; BANK.housesAvail += 4;
          t.houses = 0; t.hotel = true;
          Estado.money = Math.max(0, Math.floor((Estado.money||0) - c));
          _distribuirGastoEstado(c, `Reparto por obra del Estado: ${t.name}`);
          log(`🏨 Estado construye hotel en ${t.name} por ${fmtMoney(c)}.`);
        }
      }
    });
  });

  BoardUI?.refreshTiles?.(); renderPlayers?.();
}
window.stateAutoBuildHotels = stateAutoBuildHotels;

function assertOwnerCanAct(t, p){
  if (!t || t.type!=='prop'){ log('No es una propiedad.'); return false; }
  if (!p || t.owner !== p.id){ log('No eres el dueño.'); return false; }
  if (!p.alive){ log('Jugador eliminado.'); return false; }
  return true;
}

/* Asegura arrays de propiedades coherentes con TILES */
function recomputeProps(){
  state.players.forEach(p=>p.props=[]);
  Estado.props = Estado.props||[];
  Estado.props.length = 0;
  (TILES||[]).forEach((t,i)=>{
    if(t.type!=='prop') return;
    if(t.owner==='E'){ Estado.props.push(i); return; }
    if (Number.isInteger(t.owner) && state.players[t.owner]){
      state.players[t.owner].props ??= [];
      state.players[t.owner].props.push(i);
    }
  });
}


/* ===== Construir ===== */
function buildHouse(){
  const p = state.players[state.current]; if(!p) return;

  // [PATCH] Huelga de obras
  if ((state.blockBuildTurns||0) > 0){
    return log('🚫 Huelga de obras: nadie puede construir este turno.');
  }

  const idx = state.pendingTile ?? p.pos;
  const t = TILES[idx];
  if (!isNormalProp(t)) { log('En esta casilla no se construye.'); return; }
  if (!ownsFullGroup(p,t)) { log('Necesitas el set completo del color.'); return; }
  if (t.mortgaged){ log('No puedes construir en hipoteca.'); return; }
  if (!canBuildEven(t,p)){ log('Ley de propiedad horizontal: construye parejo en el grupo.'); return; }

  const baseCost  = t.houseCost ?? Math.round((t.price||0)*0.5);
  const costNoIVA = Math.max(1, Math.round(baseCost * (state.buildEventMul||1)));   // sin IVA
  const finalCost = Math.max(1, Math.round(costNoIVA * (state.buildIVAMul||1)));    // con IVA
  const ivaPart   = Math.max(0, finalCost - costNoIVA);
  if (t.hotel){ log('Ya tiene hotel.'); return; }
  if (p.money < finalCost){ log('No te llega el dinero para construir.'); return; }

  if (t.houses < 4) {
    if (BANK.housesAvail <= 0) { alert('No hay casas disponibles en el banco.'); return; }
    BANK.housesAvail--;
    t.houses++;
  } else {
    if (!canBuildHotel(t,p)) { log('Para hotel: todas las del grupo con 4 casas.'); return; }
    if (BANK.hotelsAvail <= 0) { alert('No hay hoteles disponibles en el banco.'); return; }
    BANK.hotelsAvail--;
    BANK.housesAvail += 4; // se devuelven al banco
    t.hotel = true; t.houses = 0;
  }

  // El jugador paga el coste total (con IVA) al Estado.
  transfer(p, Estado, finalCost, {taxable:false, reason:`Construcción en ${t.name}`});
  // La parte del IVA se marca como "soportado" para la futura liquidación.
  if (ivaPart > 0) markIVAPaid(p, ivaPart, ' (construcción)');
  log(`🏠 Construido en ${t.name}.`);
  BoardUI.refreshTiles(); renderPlayers();
}

/* ===== Vender casa/hotel ===== */
function sellHouse(){
  const p = state.players[state.current]; if(!p) return;
  const idx = state.pendingTile ?? p.pos;
  const t = TILES[idx];
  if (!isNormalProp(t)) { log('Aquí no hay edificios que vender.'); return; }
  if (!canSellEven(t,p)){ log('Vende de forma pareja dentro del grupo.'); return; }

  // [PATCH] Bonus de gentrificación al vender
  let sellBonus = 1;
  try{
    if (state.sellBonusByOwner && state.sellBonusByOwner[p.id]) sellBonus = Math.max(0, state.sellBonusByOwner[p.id]);
  }catch{}

  const price = t.houseCost ?? Math.round((t.price||0)*0.5);
  if (t.hotel){
    const pago = Math.round(price * 0.5 * sellBonus);
    if ((Estado.money||0) < pago){ log('El Estado no tiene fondos para comprarte el hotel.'); return; }
    t.hotel = false; t.houses = 4;
    BANK.hotelsAvail++;
    BANK.housesAvail = Math.max(0, BANK.housesAvail - 4);
    transfer(Estado, p, pago, { taxable:false, reason:`Compra estatal de hotel desmontado en ${t.name}` });
    log(`Se desmonta hotel en ${t.name} → 4 casas.`);
  } else if (t.houses>0){
    const pago = Math.round(price * 0.5 * sellBonus);
    if ((Estado.money||0) < pago){ log('El Estado no tiene fondos para comprarte la casa.'); return; }
    t.houses--;
    BANK.housesAvail++;
    transfer(Estado, p, pago, { taxable:false, reason:`Compra estatal de casa en ${t.name}` });
    log(`Venta de casa en ${t.name}.`);
  } else {
    log('No hay casas que vender.');
  }
  BoardUI.refreshTiles(); renderPlayers();
}

// Helpers para elegir propiedad propia por prompt
function pickMyProperty(p, {onlyMortgaged=null, allowWithBuildings=true}={}){
  const pool = TILES.map((t,i)=>({t,i}))
    .filter(x => x.t.type==='prop' && x.t.owner===p.id)
    .filter(x => onlyMortgaged===true  ?  x.t.mortgaged
                 : onlyMortgaged===false ? !x.t.mortgaged
                 : true)
    .filter(x => allowWithBuildings ? true : (!x.t.houses && !x.t.hotel));

  if (!pool.length){
    log(onlyMortgaged===true ? 'No tienes propiedades hipotecadas.'
                             : 'No tienes propiedades elegibles.');
    return null;
  }
  const lines = pool.map(x=>`${x.i}: ${x.t.name}${x.t.mortgaged?' [HIPOTECADA]':''} — ${fmtMoney(x.t.price)}`).join('\n');
  const raw = prompt(`Elige el índice de tu propiedad:\n${lines}`);
  if (raw==null) return null;
  const idx = parseInt(raw,10);
  const ok = pool.some(x=>x.i===idx);
  return ok ? idx : (alert('Índice no válido.'), null);
}

function ownerGuard(t, p){
  if (!t || t.type!=='prop'){ log('No es una propiedad.'); return false; }
  if (t.owner !== p.id){ log('Esa propiedad no es tuya.'); return false; }
  if (!p.alive){ log('Jugador eliminado.'); return false; }
  return true;
}

// % y recargo configurables
state.mortgagePct    ??= 0.50; // te dan 50% del precio
state.mortgageFeePct ??= 0.10; // recargo 10% al levantar

function mortgage(){
  const p = state.players[state.current]; if (!p) return;

  // [PATCH] Bloqueo de hipoteca 1 turno
  if (state.blockMortgage && state.blockMortgage[p.id]>0){
    return log('🚫 Bloqueo de hipoteca activo: no puedes hipotecar este turno.');
  }

  // eliges una de tus propiedades NO hipotecadas y sin edificios
  const idx = pickMyProperty(p, {onlyMortgaged:false, allowWithBuildings:false});
  if (idx == null) return;

  const t = TILES[idx];
  if (!ownerGuard(t,p)) return;
  if (t.mortgaged) return uiToast('Ya está hipotecada.');

  const principal = Math.round((t.price||0) * state.mortgagePct);

  // Estado paga; si no tiene dinero, no se puede
  if ((Estado.money||0) < principal){
    return uiToast(`El Estado no tiene fondos (${fmtMoney?.(Estado.money||0)})`);
  }

  t.mortgaged = true;
  t.mortgagePrincipal = principal; // para calcular el coste al levantar
  transfer(Estado, p, principal, {taxable:false, reason:`Hipoteca ${t.name||''}`});

  BoardUI?.refreshTiles?.(); renderPlayers?.();
}

function unmortgage(){
  const p = state.players[state.current]; if (!p) return;
  // eliges una de tus hipotecadas
  const idx = pickMyProperty(p, {onlyMortgaged:true});
  if (idx == null) return;

  const t = TILES[idx];
  if (!ownerGuard(t,p)) return;
  if (!t.mortgaged) return uiToast('No está hipotecada.');

  const base = t.mortgagePrincipal ?? Math.round((t.price||0) * state.mortgagePct);
  const cost = Math.round(base * (1 + state.mortgageFeePct)); // devuelves al Estado

  if ((p.money||0) < cost) return uiToast('No tienes saldo para levantarla.');
  transfer(p, Estado, cost, {taxable:false, reason:`Levantar hipoteca ${t.name||''}`});

  t.mortgaged = false;
  delete t.mortgagePrincipal;

  BoardUI?.refreshTiles?.(); renderPlayers?.();
}

// ======== IA Estado: hipoteca estratégica ========
function stateMortgageProperty(idx){
  const t = TILES[idx];
  if (!t || t.type!=='prop' || t.owner!=='E') return false;
  if (t.mortgaged || t.houses>0 || t.hotel) return false; // evitar edificios
  const principal = Math.round((t.price||0) * (state.mortgagePct ?? 0.50));
  t.mortgaged = true;
  t.mortgagePrincipal = principal;
  giveMoney(Estado, principal, { taxable:false, reason:`Hipoteca Estado: ${t.name}` });
  log(`🏛️ Estado hipoteca ${t.name} → +${fmtMoney(principal)}.`);
  BoardUI?.refreshTiles?.(); renderPlayers?.();
  return true;
}

// [Inferencia] índice de “baja rentabilidad”: rentabilidad ~ renta/valor (robusto con subtipos)
function _yieldFor(t){
  if (!t || t.type!=='prop') return Infinity;
  if (t.houses>0 || t.hotel) return 9999;  // nunca elegir con edificios
  if (t.mortgaged) return 9999;            // ya hipotecada
  const rent = (typeof getRent==='function') ? Math.max(0, getRent(t)||0)
              : Math.max(0, (t.baseRent ?? Math.round((t.price||0)*0.3)));
  const price = Math.max(1, t.price||1);
  return rent / price; // menor = peor rendimiento
}

function stateEnsureLiquidity(targetCash) {
  recomputeProps?.(); // Rellena Estado.props
  if ((Estado.money || 0) >= targetCash) return true; // Ya tiene suficiente liquidez

  const need = Math.max(0, Math.round(targetCash - (Estado.money || 0)));
  log(`🏛️ Estado necesita ${fmtMoney(need)} para alcanzar liquidez objetivo.`);

  // Obtener propiedades del Estado que se pueden hipotecar
  const mortgageableProps = (Estado.props || [])
    .map(idx => ({ t: TILES[idx], i: idx }))
    .filter(o => o.t && o.t.type === 'prop' && !o.t.mortgaged && !o.t.houses && !o.t.hotel)
    .sort((a, b) => _yieldFor(a.t) - _yieldFor(b.t)); // Ordenar por menor rentabilidad primero

  for (const prop of mortgageableProps) {
    if ((Estado.money || 0) >= targetCash) break; // Detenerse si ya se alcanzó el objetivo
    stateMortgageProperty(prop.i);
  }

  const met = (Estado.money || 0) >= targetCash;
  if (!met) log(`🏛️ Estado no pudo alcanzar la liquidez objetivo de ${fmtMoney(targetCash)}.`);
  return met;
}

// ================= PRÉSTAMO PERSONAL P2P (ticks globales) =================
state.loans = state.loans || [];

function requestLoan(){
  const lender = state.players[state.current];
  if (!lender) return log?.('Sin jugador activo.');

  // 1) ¿Cuánto prestar?
  let amt = prompt('DAR (principal):', '200'); if (amt==null) return;
  amt = Math.round(+amt);
  if (!(amt > 0)) return log('Importe inválido.');
  if ((lender.money||0) < amt) return log(`${lender.name} no tiene saldo para prestar ${fmtMoney?.(amt)}.`);

  // 2) ¿A qué jugador prestar?
  const toId = prompt('Prestar a jugador (número):'); if (toId==null) return;
  if (String(toId).trim().toUpperCase()==='E'){ alert('No se puede prestar al Estado.'); return; }
  const borrowerId = Number(toId)-1;
  const borrower = state.players[borrowerId];
  if (!borrower || borrower===lender || !borrower.alive){ log('Destino no válido.'); return; }

  // 3) ¿Cuánto por tick?
  let per = prompt('DEVOLVER por turno (cuota):', String(Math.ceil(amt/6))); if (per==null) return;
  per = Math.round(+per);
  if (!(per > 0)) return log('Cuota inválida.');

  // 4) ¿Cuántos ticks (globales)?
  let turns = prompt('Nº de turnos (ticks globales):', '6'); if (turns==null) return;
  turns = Math.round(+turns);
  if (!(turns > 0)) return log('Plazo inválido.');

  const totalSched = Math.round(per * turns);
  if (totalSched < amt){ alert('perTurn × turns no puede ser menor que el principal.'); return; }

  // Mover el dinero
  transfer(lender, borrower, amt, { taxable:false });

  // Registrar préstamo (amortiza principal primero, luego interés; interés tributa)
  state.loans.push({
    from: lender.id, to: borrowerId,
    principal: amt,
    principalRemaining: amt,
    perTurn: per,
    interestRemaining: totalSched - amt,
    remainingTurns: turns,
    open: true
  });

  // [PATCH] UIX: mostrar ticket visual del préstamo
  try {
    if (window.UIX?.debt.ticket) {
      const newLoan = state.loans[state.loans.length - 1];
      const ticketEl = UIX.debt.ticket(newLoan);
      ticketEl.addEventListener('click', () => ticketEl.remove());
      document.body.appendChild(ticketEl);
    }
  } catch(e) { console.warn('Error al crear ticket de préstamo UIX', e); }

  const ratePct = Math.round(((totalSched-amt)/amt)*1000)/10;
  log(`${lender.name} presta ${fmtMoney?.(amt)} a ${getName?.(borrower)} → pagará ${fmtMoney?.(per)} × ${turns} (${ratePct}% interés total).`);
  renderAll?.();
}
window.askLoan = requestLoan;

// ================= COBRO AL FINAL DE CADA TURNO (tick global) =================
function applyLoansAtTurnEnd(){
  const remaining = [];
  recomputeProps?.(); // por si hay cambios de dueño antes del cobro

  for (const loan of state.loans){
    if (!loan.open) continue;

    // TICK GLOBAL
    loan.remainingTurns = Math.max(0, (loan.remainingTurns||0) - 1);

    const borrower = state.players[loan.to];
    const lender   = state.players[loan.from];
    if (!borrower || !lender){ log('Préstamo inválido, se descarta.'); continue; }

    const due = Math.max(0, Math.round(loan.perTurn||0));

    if (due > 0){
      if ((borrower.money||0) >= due){
        // principal primero, luego interés
        const principalPart = Math.min(loan.principalRemaining||0, due);
        const interestPart  = Math.max(0, due - principalPart);

        if (principalPart > 0) transfer(borrower, lender, principalPart, { taxable:false });
        if (interestPart  > 0) transfer(borrower, lender, interestPart,  { taxable:true,  reason:'Interés de préstamo' });

        loan.principalRemaining = Math.max(0, (loan.principalRemaining||0) - principalPart);
        loan.interestRemaining  = Math.max(0, (loan.interestRemaining||0) - interestPart);

        log(`${getName?.(borrower)} paga ${fmtMoney?.(due)} a ${getName?.(lender)} (${loan.remainingTurns} turno(s) restantes).`);
      } else {
        // IMPAGO TOTAL → ejecución inmediata
        ejecutarImpagoCompleto(loan, borrower, lender);
        continue; // no reponer este préstamo
      }
    }

    const deuda = (loan.principalRemaining||0) + (loan.interestRemaining||0);

    if (deuda <= 0){
      log(`✅ Préstamo ${getName?.(borrower)} → ${getName?.(lender)} liquidado.`);
      continue;
    }

    // Si se acabaron los ticks y aún hay deuda, ejecutar
    if ((loan.remainingTurns||0) <= 0){
      ejecutarImpagoCompleto(loan, borrower, lender, {motivo:'Vencido con deuda'});
      continue;
    }

    remaining.push(loan);
  }

  state.loans = remaining;
  renderAll?.();
}

function ejecutarImpagoCompleto(loan, borrower, lender, opts={}){
  const props = (borrower.props||[]).slice();
  let moved = 0;
  props.forEach(i=>{
    const t = TILES[i];
    if (!t || t.type !== 'prop') return;
    t.owner = lender.id; // Pasa la titularidad al prestamista
    moved++;
  });
  recomputeProps?.();
  log(`💥 IMPAGO: propiedades de ${getName?.(borrower)} → ${getName?.(lender)}${moved?` (${moved})`:''}${opts.motivo?` [${opts.motivo}]`:''}.`);
}
/* =================== INTERCAMBIO DE PROPIEDADES =================== */
function trade(){
  const me = state.players[state.current];
  const otherIdx = Number(prompt(`¿Con quién intercambias? (1..${state.players.length}, distinto de ${me.id+1})`))-1;
  if (isNaN(otherIdx)||otherIdx===me.id||!state.players[otherIdx]||!state.players[otherIdx].alive){return;}
  const other = state.players[otherIdx];

  recomputeProps();
  const myProps = me.props||[];
  const theirProps = other.props||[];

  const list = (arr)=>arr.map(i=>`${i}:${TILES[i].name}`).join(', ')||'—';
  const offerMine   = prompt(`Tus props [idx]: ${list(myProps)}\nÍndices que OFRECES (coma):`,'');
  const offerTheirs = prompt(`Props de ${other.name} [idx]: ${list(theirProps)}\nÍndices que PIDES (coma):`,'');

  const give = Number(prompt('Dinero que DAS:','0'))||0;
  const take = Number(prompt('Dinero que PIDES:','0'))||0;

  const parse = (txt,pool)=>(txt||'')
    .split(',')
    .map(s=>Number(s.trim()))
    .filter(i=>Number.isInteger(i)&&pool.includes(i));

  const selMine   = parse(offerMine,   myProps);
  const selTheirs = parse(offerTheirs, theirProps);

  if(!confirm(`Confirmar intercambio:\nDas: ${selMine.map(i=>TILES[i].name).join(', ')||'—'} + ${fmtMoney(give)}\nRecibes: ${selTheirs.map(i=>TILES[i].name).join(', ')||'—'} + ${fmtMoney(take)}`)) return;

      // — Base imponible = ganancia neta frente al valor-tablero (t.price)
      const sumPrice = arr => arr.reduce((s,i)=> s + (TILES[i]?.price || 0), 0);

      const myOut  = sumPrice(selMine)   + give; // lo que yo entrego (props a precio de tablero + dinero)
      const myIn   = sumPrice(selTheirs) + take; // lo que yo recibo (props a precio de tablero + dinero)
      const myGain = Math.max(0, Math.round(myIn - myOut));      // ganancia neta mía
      const otGain = Math.max(0, Math.round(myOut - myIn));      // ganancia neta del otro (simétrica)

      // Pregunta aceptación del otro
      let accepted = confirm(`¿${other.name} acepta?`);
      if (!accepted) {
        const forced = window.Roles?.maybeForceTradeAcceptance?.({ initiatorId: me.id, counterpartyId: other.id });
        if (forced) {
          log('🤝 Florentino fuerza la aceptación.');
          accepted = true;
        } else {
          alert('Intercambio cancelado.'); return;
        }
      }

      // Impugnación por un tercero antes de ejecutar el trato
      const who = prompt('Impugnación del J3/J4… (ID de jugador) o vacío para seguir', '');
      if (who) {
        const byId = Number(who)-1;
        // desbalance (0..1) según ganancia neta
        const denom   = Math.max(1, Math.abs(myGain)+Math.abs(otGain));
        const imbalance = Math.min(1, Math.abs(myGain-otGain)/denom);
        const res = window.Roles?.challengeDeal?.({ byId, imbalance }) || { annulled:false };
        if (res.annulled) { alert('⚖️ Juez IA anula el trato.'); return; }
      }

  if (give>0 && me.money<give){ alert('No tienes suficiente dinero.'); return; }
  if (take>0 && other.money<take){ alert(`${other.name} no tiene suficiente dinero.`); return; }

  selMine.forEach(i=>{ TILES[i].owner = other.id; });
  selTheirs.forEach(i=>{ TILES[i].owner = me.id; });
  recomputeProps();

  // Dinero del intercambio: NO tributa directamente
  if (give > 0) { debit(me, give,   { taxable:false }); credit(other, give,   { taxable:false }); }
  if (take > 0) { debit(other, take, { taxable:false }); credit(me,   take,    { taxable:false }); }

  // Marca la base imponible SIN alterar el saldo final:
  // (credit taxable para subir taxBase y luego debit neutro para dejar el dinero igual)
  if (myGain  > 0) { credit(me,    myGain, { taxable:true,  reason:'Ganancia por intercambio' }); debit(me,    myGain, { taxable:false }); }
  if (otGain  > 0) { credit(other, otGain, { taxable:true,  reason:'Ganancia por intercambio' }); debit(other, otGain, { taxable:false }); }

  log(`${me.name} ⇄ ${other.name} | Das: [${selMine.map(i=>TILES[i].name).join(', ')||'—'}], ${fmtMoney(give)} | Recibes: [${selTheirs.map(i=>TILES[i].name).join(', ')||'—'}], ${fmtMoney(take)}.`);
  // (Opcional) log de transparencia
  log(`Base imponible por intercambio → ${me.name}: ${fmtMoney(myGain)}, ${other.name}: ${fmtMoney(otGain)}.`);
  renderAll();
}

function ensureTradeButton(){
  const loanBtn = document.getElementById('loan'); if(!loanBtn) return;
  if(document.getElementById('trade')) return;
  const btn = document.createElement('button');
  btn.id = 'trade';
  btn.textContent = 'Intercambiar';
  btn.onclick = trade;
  loanBtn.parentNode.insertBefore(btn, loanBtn.nextSibling);
}
document.addEventListener('DOMContentLoaded', ensureTradeButton);

/* =================== BANCARROTA =================== */
function checkBankrupt(p){
  if(!p || p.money>=0 || !p.alive) return;
  p.alive = false;
  // Vaciar edificios e “independizar” propiedades (quedan libres)
  (p.props||[]).forEach(i=>{
    const t=TILES[i]; if(!t) return;
    t.owner=null; t.houses=0; t.hotel=false; t.mortgaged=false;
  });
  p.props=[];
  log(`${p.name} entra en QUIEBRA.`);
  renderAll();
}
function everyoneLoses(){
  alert('El ESTADO ha eliminado a un jugador. Todos pierden.');
  location.reload();
}

/* =================== IA del ESTADO (ligera) =================== */
function estadoAct(){
  recomputeProps();

  // 1) Intento de compra de la propiedad libre más barata (si tiene saldo)
  const free = TILES.map((t,i)=>({t,i}))
    .filter(x=>x.t.type==='prop' && x.t.owner==null)
    .sort((a,b)=> (a.t.price||0) - (b.t.price||0));

  if (free.length){
    const pick = free[0];
    if ((Estado.money||0) >= (pick.t.price||0)){
      debit(Estado, pick.t.price, {taxable:false});
      pick.t.owner='E';
      Estado.props = Estado.props||[]; Estado.props.push(pick.i);
      log(`Estado compra ${pick.t.name} por ${fmtMoney(pick.t.price)}.`);
    }
  }

  // 2) Si hay jugadores apurados, intentar compra directa de 1 propiedad
  const needy = state.players.filter(p=>p.alive && (p.money||0)<100 && (p.props||[]).length);
  if (needy.length){
    const p=needy[Math.floor(Math.random()*needy.length)];
    const pi=(p.props||[])[0]; const t=TILES[pi];
    const offer = Math.floor((t.price||0)*1.2);
    if ((Estado.money||0) >= offer){
      if (confirm(`Estado ofrece ${fmtMoney(offer)} por ${t.name} a ${p.name}. ¿Aceptar?`)){
        debit(Estado, offer, {taxable:false});
        credit(p, offer, {taxable:true});
        t.owner='E';
        recomputeProps();
        log(`Estado compra ${t.name} a ${p.name} por ${fmtMoney(offer)}.`);
      }
    }
  }
}

/* =================== DADOS / TURNOS: pequeños ajustes de robustez =================== */
document.addEventListener('DOMContentLoaded', function(){
  const rollBtn = document.getElementById('roll');
  const endBtn = document.getElementById('endTurn');
  if (rollBtn && !rollBtn.__wired){
    rollBtn.__wired = true;
    rollBtn.onclick = ()=>{ window.roll?.(); };
  }
  if (endBtn && !endBtn.__wired){
    endBtn.__wired = true;
    endBtn.onclick = ()=>{ window.endTurn?.(); };
  }
});


/* ===== Utilidades del árbitro ===== */
function applyTax(player = state.players[state.current]){
  if (!player || !player.alive) return;
  const base = Math.max(0, Math.round((player.taxBase||0) * 0.33));
  if (base > 0){
    transfer(player, Estado, base, {taxable:false, reason:'Impuesto 33% (aplicado manualmente)'});
    log(`💸 ${player.name} paga ${fmtMoney(base)} de impuesto (33% de ganancias).`);
    player.taxBase = 0;
  } else {
    log(`${player.name} no tiene ganancias acumuladas. No paga impuesto.`);
  }
}

// ===== Logger extra de impuestos (caer en casillas y razones tipo "impuesto") =====
;(() => {
  const looksLikeTaxTile = (t)=> !!t && (t.type==='tax' || /impuesto|tax/i.test(t?.name||''));
  const isEstado = (x)=> x===Estado || x==='E' || x?.id==='E';
  const curTile = ()=>{ try{ const p=state.players[state.current]; return TILES[p?.pos]; }catch{} return null; };

  // wrap transfer
  if (typeof window.transfer === 'function'){
    const _transfer = window.transfer;
    window.transfer = function(from,to,amount,opts){
      const out = _transfer.apply(this, arguments);
      try{
        const payer    = typeof from==='object'? from : playerById?.(from);
        const receiver = typeof to==='object'  ? to   : playerById?.(to);
        const tile = curTile();
        const taxish = looksLikeTaxTile(tile) || /impuesto|tax/i.test(opts?.reason||'');
        if (payer?.name && isEstado(receiver) && amount>0 && taxish){
          log(`💸 ${getName?.(payer)} paga ${fmtMoney?.(amount)} de impuestos${tile?.name?` en ${tile.name}`:''}.`);
        }
      }catch{}
      return out;
    };
  }

  // wrap debit/credit pareados (por si el pago de impuestos no usa transfer)
  state.__taxLog = state.__taxLog || null;
  if (typeof window.debit === 'function'){
    const _debit = window.debit;
    window.debit = function(p, amount, opts){
      const out = _debit.apply(this, arguments);
      try{
        const tile = curTile();
        if ((looksLikeTaxTile(tile) || /impuesto|tax/i.test(opts?.reason||'')) && p?.alive){
          state.__taxLog = { pid:p.id, amt:amount, tile:tile?.name||'', t:Date.now() };
        }
      }catch{}
      return out;
    };
  }
  if (typeof window.credit === 'function'){
    const _credit = window.credit;
    window.credit = function(p, amount, opts){
      const out = _credit.apply(this, arguments);
      try{
        const s = state.__taxLog;
        if (isEstado(p) && s && amount>=s.amt*0.9 && Date.now()-s.t<2000){
          const pl = state.players?.[s.pid];
          log(`💸 ${pl?.name||'Jugador'} paga ${fmtMoney?.(s.amt)} de impuestos${s.tile?` en ${s.tile}`:''}.`);
          state.__taxLog = null;
        }
      }catch{}
      return out;
    };
  }
})();

  // === Tragaperras gratis: animación grande en overlay ===
function playSlotsFree(player, tile){
  const overlay = document.getElementById('doubleOverlay');
  if (!overlay){ log('No hay overlay para slots.'); return; }

  // CSS una sola vez
  if (!document.getElementById('slots-css')){
    const css = document.createElement('style');
    css.id = 'slots-css';
    css.textContent = `
      .slotsWrap{display:flex;flex-direction:column;align-items:center;gap:18px;
        background:rgba(17,24,39,.92);padding:24px 28px;border-radius:16px;
        box-shadow:0 10px 40px rgba(0,0,0,.6)}
      .reels{display:flex;gap:18px}
      .reel{width:128px;height:128px;border-radius:18px;background:#0b1220;
        border:2px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;
        font-size:82px;line-height:1;box-shadow:inset 0 0 0 2px rgba(255,255,255,.08)}
      .slotsMsg{font-size:20px;opacity:.9}
      @keyframes bump{0%{transform:scale(1)}70%{transform:scale(1.25)}100%{transform:scale(1)}}
      .win{animation:bump .5s ease}
    `;
    document.head.appendChild(css);
  }

  const symbols = ['🍒','🍋','🔔','⭐','7️⃣','🍉','🍇','🍀'];
  overlay.innerHTML = `
    <div class="slotsWrap" role="dialog" aria-label="Tragaperras">
      <div class="reels">
        <div class="reel" id="reel1">❔</div>
        <div class="reel" id="reel2">❔</div>
        <div class="reel" id="reel3">❔</div>
      </div>
      <div class="slotsMsg" id="slotsMsg">Girando…</div>
    </div>`;
  overlay.style.display = 'flex';

  const pick = ()=> symbols[Math.floor(Math.random()*symbols.length)];
  function spin(el, duration, final){
    const start = performance.now();
    const tick = (t)=>{
      if (t - start < duration){
        el.textContent = pick();
        requestAnimationFrame(tick);
      } else {
        el.textContent = final;
      }
    };
    requestAnimationFrame(tick);
  }

  const r1 = document.getElementById('reel1');
  const r2 = document.getElementById('reel2');
  const r3 = document.getElementById('reel3');

  let finals = [pick(), pick(), pick()];
  try {
    if (window.Roles?.is?.(player.id,'proxeneta')) {
      const baseP = 1/25; // 5 símbolos uniformes → 1/5^2 extra para las otras dos ruedas
      const wantWin = window.Roles.decideWin(baseP, player, 'slots');
      const winsNow = finals[0]===finals[1] && finals[1]===finals[2];
      if (wantWin && !winsNow) finals = [finals[0], finals[0], finals[0]];
    }
  } catch {}

  spin(r1, 900,  finals[0]);
  setTimeout(()=> spin(r2, 1100, finals[1]), 120);
  setTimeout(()=>{
    spin(r3, 1300, finals[2]);
    setTimeout(()=>{
      const win = finals[0]===finals[1] && finals[1]===finals[2];
      const msg = document.getElementById('slotsMsg');
      if (win){
        msg.textContent = '¡Premio $100!';
        r1.classList.add('win'); r2.classList.add('win'); r3.classList.add('win');
        // “Dinero impreso”: pago directo al jugador (no tributable). 
        // Si prefieres que salga del Estado, cambia a transfer(Estado, player, 100, {taxable:false}).
        giveMoney(player, 100, { taxable:false, reason:'Tragaperras gratis' });
      } else {
        msg.textContent = 'Nada…';
      }
      renderPlayers?.();
      state.rolled = true; updateTurnButtons?.();
      setTimeout(()=>{ overlay.style.display='none'; }, 1200);
    }, 1350);
  }, 240);

}

function tryCorruptLoan() {
  const p = state.players[state.current];
  if (!p) return;
  const idx = p.pos;

  const A = Number(prompt('Importe préstamo corrupto:', '300'))||0;
  if (A <= 0) return;
  const R = Number(prompt('Tipo (%, ej 20):', '20'))||0;
  const T = Number(prompt('Ticks (<=30):', '12'))||0;
  const res = window.Roles?.requestCorruptLoan?.({
    playerId: p.id,
    amount: A,
    rate: R,
    ticks: T,
    tileId: idx
  });
  if (!res?.accepted) {
    alert((res?.reason || 'Préstamo rechazado.') + (res?.pAccept!=null ? ` (p≈${(res.pAccept*100|0)}%)` : ''));
  } else {
    giveMoney(p, A, { taxable:false, reason:'Préstamo corrupto' });
    log(`Debe devolver ${fmtMoney(res.dueAmount)} al Estado en el turno ${res.dueTurn}.`);
  }
};
function sendToJail(player = state.players[state.current]) {
  if (!player || !player.alive) return;
  const jailIdx = TILES.findIndex(t => t.type === 'jail');
  if (jailIdx < 0) return;

  player.pos = jailIdx;
  player.jail = 3; // 3 intentos como ya usas
  BoardUI.refreshTiles();

  log(`🚔 ${player.name} va a la cárcel (máx 3 intentos).`);

  try {
    state.pendingTile = null;
    const box = document.getElementById('auction');
    if (state.auction && state.auction.open) {
      try { clearTimeout(state.auction.timer); } catch (e) {}
      if (box) box.style.display = 'none';
      state.auction.open = false;
      state.auction = null;
      log('⚠️ Subasta cancelada por ir a la cárcel.');
    }
    const overlay = document.getElementById('overlay');
    if (overlay?.style) overlay.style.display = 'none';
  } catch (e) {}

  state.rolled = true;
  updateTurnButtons?.();
  window.endTurn?.();
}
/* ===== Enlazar botones ===== */
document.addEventListener('DOMContentLoaded', ()=>{
  $('#build')?.addEventListener('click', buildHouse);
  $('#sell')?.addEventListener('click', sellHouse);
  $('#mortgage')?.addEventListener('click', mortgage);
  $('#unmortgage')?.addEventListener('click', unmortgage);
  $('#corruptLoan')?.addEventListener('click', tryCorruptLoan);
  // $('#loan')?.addEventListener('click', requestLoan); // ← antes era askLoan
  (() => {
    const btn = document.getElementById('loan');
    if (btn){
      const clone = btn.cloneNode(true);
      btn.replaceWith(clone);
      clone.addEventListener('click', requestLoan);
    }
  })();
});

/* ===== Exportar utilidades ===== */
window.applyTax   = applyTax;
window.sendToJail = sendToJail;

/* ======== SafeBug: forzar fin de turno si se queda colgado ======== */
(function(){
  const SafeBug = {
    lastBeat: Date.now(),
    armSec: 180,   // 3 minutos
    timer: null
  };

  function beat(){ SafeBug.lastBeat = Date.now(); }

  // Teclas rápidas: F9 = forzar fin de turno
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'F9'){ forceEndTurn(); }
  });

  // Si hay errores JS o promesas rechazadas, marcamos actividad para no disparar falso positivo
  window.addEventListener('error', beat);
  window.addEventListener('unhandledrejection', beat);

  // Mostrar “Forzar turno” cuando detecte inactividad prolongada
  function watchdogTick(){
    const idleMs = Date.now() - SafeBug.lastBeat;
    const stuck = idleMs > SafeBug.armSec*1000;
    const endBtn = document.getElementById('endTurn');
    if (!endBtn) return;

    if (stuck){
      endBtn.style.display = '';      // que se vea aunque la UI normal lo oculte
      endBtn.disabled = false;        // clicable
      if (!endBtn.dataset.safebug){
        endBtn.dataset.safebug = '1';
        endBtn.dataset.oldLabel = endBtn.textContent || '';
        endBtn.textContent = 'Forzar turno (F9)';
        endBtn.title = 'Desbloqueo de emergencia';
        endBtn.onclick = ()=>forceEndTurn(); // clic = forzar
      }
    } else if (endBtn.dataset.safebug){
      // volver al estado normal cuando hay actividad
      endBtn.textContent = endBtn.dataset.oldLabel || 'Terminar turno';
      endBtn.removeAttribute('data-safebug');
      endBtn.title = '';
      // la lógica normal de visibilidad vuelve a tomar control vía updateTurnButtons()
    }
  }

  // Parchear funciones para latidos (“actividad”)
  document.addEventListener('DOMContentLoaded', ()=>{
    // 1) log(): cada mensaje cuenta como actividad
    if (typeof window.log === 'function'){
      const _log = window.log;
      window.log = function(...args){ try{ return _log.apply(this, args); } finally { beat(); } };
    }
    // 2) BoardUI.refreshTiles(): cada refresco cuenta como actividad
    if (window.BoardUI?.refreshTiles){
      const _rt = window.BoardUI.refreshTiles;
      window.BoardUI.refreshTiles = function(){ try{ return _rt.apply(this, arguments); } finally { beat(); } };
    }
    // 3) Arrancar el vigilante
    SafeBug.timer = setInterval(watchdogTick, 1000);
  });

  // Forzar fin de turno (cierra subastas si estuvieran atascadas)
  window.forceEndTurn = function(){
    try{
      // Si hay subasta abierta, la cerramos para no bloquear endTurn
      if (state.auction && state.auction.open){
        try{ clearTimeout(state.auction.timer); }catch{}
        const box = document.getElementById('auction');
        if (box) box.style.display = 'none';
        state.auction = null;
        log('⚠️ SafeBug: subasta cerrada por emergencia.');
      }
      // Limpiezas ligeras de estado transitorio
      state.pendingTile = null;
      state.usedTransportHop = false;
    }catch{}
    log('⛑️ SafeBug: turno forzado.');
    // Llama al endTurn estándar (con nóminas, préstamos, etc.)
    window.endTurn?.();
    beat();
  };
})();

// [PATCH] Interceptar rentas embargadas y tope
if (typeof window.transfer === 'function'){
  const _transfer2 = window.transfer;
  window.transfer = function(from,to,amount,opts){
    // Desvío por embargo de rentas
    try{
      const isRent = /Alquiler|Fiore|IVA alquiler/i.test(opts?.reason||'');
      const toId = (to==='E'||to===Estado) ? 'E' : to?.id;
      if (isRent && toId!=null && state.garnish && state.garnish[toId] && state.garnish[toId].count>0){
        // Cobro va al Estado en su lugar
        const g = state.garnish[toId];
        g.count--;
        log(`⚖️ Embargo: renta de ${fmtMoney?.(amount)} redirigida al Estado (quedan ${g.count}).`);
        return _transfer2.call(this, from, Estado, amount, Object.assign({}, opts, {reason: (opts?.reason||'')+' [embargada]'}));
      }
    }catch{}
    return _transfer2.apply(this, arguments);
  };
}

// v20-part8-fixed.js — eventos + cartas + mini‑juego de galgos (revisión)
// Cárgalo DESPUÉS de v20-part1..7.js en v20.html

/* ===============================
   MÓDULO: EVENTOS Y CARTAS
   =============================== */
(function(){
  'use strict';

  // --- Estado y dependencias suaves ---
  const state   = (window.state   ||= {});
  const TILES   = (window.TILES   ||= []);
  const BANK    = (window.BANK    ||= {});
  const Estado  = (window.Estado  ??  'E');

  const log         = window.log         || function(){ console.log.apply(console, arguments); };
  const headline    = window.headline    || function(msg){ log('==', msg); };
  const fmtMoney    = window.fmtMoney    || function(n){ return (n|0) + '€'; };
  const renderPlayers = window.renderPlayers || function(){};
  const BoardUI     = window.BoardUI     || {};
  const groupTiles  = window.groupTiles  || function(t){ return [{x:t}]; };
  const ownsFullGroup = window.ownsFullGroup || function(){ return false; };
  const canBuildEven  = window.canBuildEven  || function(){ return true; };

  // transfer/giveMoney con fallback a operación simple si tu engine no soporta opts
  const _transfer0 = window.transfer || function(from,to,amount){ (from.money-=amount); if(to && to.money!=null) to.money+=amount; };
  function transfer(from,to,amount,opts){ try{ return window.transfer ? window.transfer(from,to,amount,opts) : _transfer0(from,to,amount); }catch{ return _transfer0(from,to,amount); } }
  function giveMoney(to,amount,opts){ if (!to) return; try{ if (window.transfer) return window.transfer({money:0}, to, -amount, opts); }catch{}; (to.money ??= 0); to.money += amount; }

  // ====== Estado base para eventos ======
  state.ownerRentMul     ||= {};   // {pid|'E': {mul, turns}}
  state.rentFilters      ||= [];    // [{name, mul, turns, match(tile)}]
  state.rentCap          ||= null;  // {amount, turns}
  state.garnish          ||= {};    // {pid:{count, turns}}
  state.auctionVeto      ||= null;  // {holderId}
  state.blockMortgage    ||= {};    // {pid: turns}
  state.blockBuildTurns  ||= 0;     // int
  state.sellBonusByOwner ||= {};    // {pid: mul}
  state.cement           ||= null;  // {taken, turns}

  // ====== Helpers ======
  function pickPlayer(exceptId=null){
    const pool = (state.players||[]).filter(p=>p.alive && p.id!==exceptId);
    if (!pool.length) return null;
    const s = prompt('Elige jugador (número):\n'+pool.map(p=>`${p.id+1}. ${p.name}`).join('\n'));
    const id = Number(s)-1;
    return state.players[id] && state.players[id].alive ? state.players[id] : null;
  }
  function pickOne(arr){ return arr[Math.floor(Math.random()*arr.length)] }
  function richestPlayer(){
    return (state.players||[]).filter(p=>p.alive).sort((a,b)=>(b.money||0)-(a.money||0))[0]||null;
  }
  function tilesOf(p, pred){
    return TILES.map((t,i)=>({t,i})).filter(o=>o.t.type==='prop' && o.t.owner===p.id && (!pred || pred(o.t,o.i)));
  }
  function isTransport(t){ return ['bus','rail','ferry','air'].includes(t.subtype); }
  function isLeisure(t){
    // ocio aproximado: color 'pink' o subtipos típicos de ocio
    return t.color==='pink' || ['casino_bj','casino_roulette','fiore'].includes(t.subtype);
  }
  function ownsMonopoly(p,t){ try{ return !!ownsFullGroup(p,t); }catch(_){ return false; } }
  function canAuctionIdx(i){ const t=TILES[i]; return t && t.type==='prop' && t.owner===null; }


  // ====== Ajuste de alquileres (si no existe) ======
  if (typeof window.adjustRentForEvents !== 'function'){
    window.adjustRentForEvents = function(payer, tile, base){
      let rent = Math.max(0, Math.round(base||0));
      // Multiplicadores por propietario
      const ownerId = (tile.owner==='E') ? 'E' : tile.owner;
      if (state.ownerRentMul && state.ownerRentMul[ownerId]){
        rent = Math.round(rent * state.ownerRentMul[ownerId].mul);
      }
      // Filtros por categoría
      if (Array.isArray(state.rentFilters)) {
        for (const ef of state.rentFilters) {
          if (ef.turns<=0) continue;
          try { if (ef.match(tile)) rent = Math.round(rent * ef.mul); } catch {}
        }
      }
      // Tope global
      if (state.rentCap && state.rentCap.amount>0) rent = Math.min(rent, state.rentCap.amount);
      return Math.max(0, rent|0);
    };
  }

  // ====== Wrapper de transfer para embargo de rentas ======
  if (!state.__eventsTransferWrapped && typeof window.transfer === 'function'){
    state.__eventsTransferWrapped = true;
    const _transfer2 = window.transfer;
    window.transfer = function(from,to,amount,opts){
      try{
        const isRent = /Alquiler|Fiore|IVA alquiler/i.test(opts?.reason||'');
        const toId = (to==='E'||to===Estado) ? 'E' : to?.id;
        if (isRent && toId!=null && state.garnish && state.garnish[toId] && state.garnish[toId].count>0){
          const g = state.garnish[toId];
          g.count--;
          log(`⚖️ Embargo: renta de ${fmtMoney(amount)} redirigida al Estado (quedan ${g.count}).`);
          return _transfer2.call(this, from, Estado, amount, Object.assign({}, opts, {reason: (opts?.reason||'')+' [embargada]'}));
        }
      }catch{}
      return _transfer2.apply(this, arguments);
    };
  }

  // ====== Veto de subasta (wrapper) ======
  if (!state.__eventsAuctionWrapped && typeof window.startAuctionFlow === 'function'){
    state.__eventsAuctionWrapped = true;
    const _startAuction = window.startAuctionFlow;
    window.startAuctionFlow = function(){
      try{
        const current = (state.players||[])[state.current];
        const holder = state.auctionVeto && state.auctionVeto.holderId;
        if (holder != null && current && holder !== current.id){
          log('🛑 Veto de subasta ejercido. Se cancela la subasta.');
          state.auctionVeto = null;
          return;
        }
      }catch{}
      return _startAuction.apply(this, arguments);
    };
  }

  // ====== Bloqueos y bonus en acciones ======
  if (!state.__eventsMortgageWrapped && typeof window.mortgage === 'function'){
    state.__eventsMortgageWrapped = true;
    const _mortgage = window.mortgage;
    window.mortgage = function(){
      try{
        const p = (state.players||[])[state.current];
        if (state.blockMortgage && p && state.blockMortgage[p.id]>0){
          return log('🚫 Bloqueo de hipoteca activo: no puedes hipotecar este turno.');
        }
      }catch{}
      return _mortgage.apply(this, arguments);
    };
  }

  if (!state.__eventsBuildWrapped && typeof window.buildHouse === 'function'){
    state.__eventsBuildWrapped = true;
    const _buildHouse = window.buildHouse;
    window.buildHouse = function(){
      if ((state.blockBuildTurns||0) > 0){
        return log('🚫 Huelga de obras: nadie puede construir este turno.');
      }
      return _buildHouse.apply(this, arguments);
    };
  }

  if (!state.__eventsSellWrapped && typeof window.sellHouse === 'function'){
    state.__eventsSellWrapped = true;
    const _sellHouse = window.sellHouse;
    window.sellHouse = function(){
      const p = (state.players||[])[state.current];
      const mul = (state.sellBonusByOwner && p) ? (state.sellBonusByOwner[p.id]||1) : 1;
      const before = p ? p.money : null;
      const out = _sellHouse.apply(this, arguments);
      try{
        if (p && mul>1 && before!=null && p.money!=null && p.money<=before){
          const delta = Math.round((before - p.money) * (mul - 1));
          if (delta>0){ giveMoney(p, delta, {reason:'Bonus gentrificación'}); log(`Bonus de venta +${Math.round((mul-1)*100)}% aplicado: +${fmtMoney(delta)}.`); }
        }
      }catch{}
      return out;
    };
  }

  // ====== Ticks al final de turno ======
  function tickEvents(){
    // ownerRentMul
    if (state.ownerRentMul){
      for (const [pid, obj] of Object.entries(state.ownerRentMul)){
        if (!obj) continue;
        if ((obj.turns||0) > 0){ obj.turns--; if (!obj.turns) delete state.ownerRentMul[pid]; }
      }
    }
    // rentFilters
    if (Array.isArray(state.rentFilters)){
      state.rentFilters.forEach(ef => { if (ef.turns>0) ef.turns--; });
      state.rentFilters = state.rentFilters.filter(ef => ef.turns>0);
    }
    // rentCap
    if (state.rentCap && (state.rentCap.turns||0) > 0){
      state.rentCap.turns--; if (!state.rentCap.turns) state.rentCap = null;
    }
    // embargo
    if (state.garnish){
      for (const [pid, g] of Object.entries(state.garnish)){
        if (!g) continue;
        if ((g.turns||0) > 0){ g.turns--; if (!g.turns) delete state.garnish[pid]; }
      }
    }
    // bloqueo hipoteca
    if (state.blockMortgage){
      for (const [pid, t] of Object.entries(state.blockMortgage)){
        if (t>0){ state.blockMortgage[pid] = t-1; if (!state.blockMortgage[pid]) delete state.blockMortgage[pid]; }
      }
    }
    // huelga obras
    if ((state.blockBuildTurns||0) > 0){ state.blockBuildTurns--; }
    // cemento
    if (state.cement && state.cement.turns>0){
      state.cement.turns--;
      if (!state.cement.turns){
        BANK.housesAvail = Math.max(0, (BANK.housesAvail|0) + (state.cement.taken||0));
        state.cement = null;
        log('⏳ Fin racionamiento de cemento: se devuelve stock de casas.');
      }
    }
  }

  if (!state.__eventsTickInstalled && typeof window.endTurn === 'function'){
    state.__eventsTickInstalled = true;
    const _endTurn = window.endTurn;
    window.endTurn = function(){
      const r = _endTurn.apply(this, arguments);
      try{ tickEvents(); }catch(e){ console.error(e); }
      return r;
    };
  }

  // ====== Funciones auxiliares para cartas de construcción/IVA (si no existen) ======
  if (typeof window.news_build_cost !== 'function'){
    window.news_build_cost = function(perc, turns){
      state.buildEventMul = (state.buildEventMul||0) + perc;
      state.buildEventTurns = Math.max(state.buildEventTurns||0, turns||0);
      headline(`Construcción ${perc>0?'+':''}${perc}% durante ${turns} turno(s).`);
    };
  }
  if (typeof window.news_iva_build !== 'function'){
    window.news_iva_build = function(perc, turns){
      state.ivaBuildMul = (state.ivaBuildMul||0) + perc;
      state.ivaBuildTurns = Math.max(state.ivaBuildTurns||0, turns||0);
      headline(`IVA de obra ${perc>0?'+':''}${perc}% durante ${turns} turno(s).`);
    };
  }

  // === UI de carta de EVENTO (usa #doubleOverlay ya existente) ===
  (function ensureEventUI(){
    if (document.getElementById('event-css')) return;
    const css = document.createElement('style');
    css.id = 'event-css';
    css.textContent = `
      #doubleOverlay{align-items:center;justify-content:center}
      .eventCard{display:flex;flex-direction:column;gap:10px;align-items:center;
        background:#111827;border:1px solid #30363d;border-radius:14px;
        padding:18px 20px;max-width:360px;text-align:center;box-shadow:0 6px 30px rgba(0,0,0,.35)}
      .eventTitle{font-weight:900;font-size:1.05rem;letter-spacing:.3px}
      .eventText{opacity:.9}
      .eventBtn{margin-top:4px;padding:8px 12px;border-radius:10px;border:1px solid #30363d;background:#1f2937;color:#e6edf3;cursor:pointer}
    `;
    document.head.appendChild(css);
  })();
  function showEventCard(title, text){
    return new Promise((resolve)=>{
      const ov = document.getElementById('doubleOverlay');
      if (!ov) return resolve(); // fallback si no hay overlay
      ov.innerHTML = `<div class="eventCard">
        <div class="eventTitle">${title||'SUERTE'}</div>
        <div class="eventText">${text||''}</div>
        <button class="eventBtn" autofocus>Aceptar</button>
      </div>`;
      ov.style.display = 'flex';
      ov.querySelector('.eventBtn').onclick = ()=>{ ov.style.display='none'; resolve(); };
    });
  }

  // Mapa de descripciones (nombre → desc)
  const EVENT_DESCS = {
    'Deriva inflacionaria': 'Los costes de construcción suben un 25% durante 3 turnos.',
    'Pacto obligatorio temporal': 'Elige un rival: sus rentas se reducen al 50% durante 5 turnos.',
    'Duelo de dados': 'Tiras dados contra un rival; quien gane roba una propiedad sin hipoteca ni monopolio.',
    'Festival EDM': 'Alquileres de ocio +15% y transporte −10% durante 2 rondas.',
    'Subasta ciega en casilla libre': 'Se subasta a puja oculta una casilla libre (la primera disponible).',
    'Subida de IVA obra': 'El IVA o sobrecoste de construir sube un 20% durante 2 turnos.',
    'Desinflación': 'Bajan los costes de construcción un 15% durante 1 turno.',
    'Rescate exprés': 'Cobras 150 ahora; tus dos primeras rentas quedan embargadas durante 2 turnos.',
    'Auditoría': 'Pagas el 33% de tu base imponible; si no tienes, recibes 50.',
    'Venta forzosa': 'El jugador más rico pierde una propiedad sin edificios a subasta abierta.',
    'Boom ocio': 'Los alquileres de ocio suben un 25% durante 3 turnos.',
    'Recesión industria': 'Elige un color o familia: sus alquileres bajan un 25% durante 3 turnos.',
    'Gentrificación': 'Si tienes 3+ casas en todo un grupo: +10% alquiler y +10% al vender casas (3 turnos).',
    'Racionamiento de cemento': 'Se retiran hasta 5 casas del banco durante 3 turnos.',
    'Veto de subasta': 'Obtienes un veto para cancelar la próxima subasta iniciada por otro jugador.',
    'Trueque obligado': 'Intercambia una propiedad sin edificios con otro jugador del mismo color (si hay pareja).',
    'Bloqueo de hipoteca': 'El rival elegido no puede hipotecar durante 1 turno.',
    'Blackjack de 50': 'Mini-juego: si terminas con 20–21, cobras 120; si no, pagas 50.',
    'Congelar alquileres': 'Tope global de alquiler por cobro: 150 durante 2 turnos.',
    'Plan de obras': 'El Estado construye automáticamente casas en algunas de sus propiedades (si hay stock).',
    'Incendio leve': 'Pierdes 1 nivel de edificación en una propiedad (hotel pasa a 4 casas).',
    'Huelga de obras': 'Nadie puede construir durante el próximo turno.',
    'Subasta de Lote': 'Se subasta a puja oculta un lote de 2-3 propiedades contiguas libres.'
  };

  // ====== Cartas ======
  const EVENT_CARDS = [
    { name: 'Deriva inflacionaria', run(p){ window.news_build_cost?.(25, 3); } },
    { name: 'Pacto obligatorio temporal', run(p){
        const target = pickPlayer(p.id); if (!target) return log('Sin objetivo.');
        state.ownerRentMul[target.id] = { mul: 0.5, turns: 5 };
        headline(`Pacto temporal: rentas de ${target.name} al 50% durante 5 turnos.`);
    }},
    { name: 'Duelo de dados', run(p){
        const rival = pickPlayer(p.id); if (!rival) return log('Sin rival.');
        function roll(){ return (1+Math.floor(Math.random()*6)) + (1+Math.floor(Math.random()*6)); }
        let a=roll(), b=roll();
        log(`${p.name} tira ${a} vs ${rival.name} ${b}.`);
        while(a===b){ a=roll(); b=roll(); log(`Empate. Nueva tirada: ${a} vs ${b}.`); }
        const winner = a>b? p : rival; const loser = a>b? rival : p;
        const pool = tilesOf(loser, t=>!ownsMonopoly(loser,t) && !t.mortgaged);
        if (!pool.length) return log('No hay propiedades robables.');
        const choice = prompt('Elige índice a robar:\n'+pool.map((o,k)=>`${k+1}. ${o.t.name}`).join('\n'),'1');
        const pick = pool[Math.max(0, Math.min(pool.length-1, (Number(choice)||1)-1))];
        pick.t.owner = winner.id;
        log(`⚔️ Duelo: ${winner.name} roba ${pick.t.name} a ${loser.name}.`);
        BoardUI.refreshTiles?.(); renderPlayers();
    }},
    { name: 'Festival EDM', run(p){
        state.rentFilters.push({ name:'ocio+', mul:1.15, turns:2, match:isLeisure });
        state.rentFilters.push({ name:'transporte−', mul:0.90, turns:2, match:isTransport });
        headline('Festival EDM: ocio +15%, transporte −10% (2 rondas).');
    }},
    { name: 'Subasta ciega en casilla libre', run(p){
        const here = TILES[p.pos];
        let idx = (here && here.type==='prop' && here.owner===null) ? p.pos
                 : TILES.findIndex((t,i)=> t.type==='prop' && t.owner===null);
        if (idx<0) return log('No hay propiedades libres.');
        if (window.GameDebtMarket?.startAuctionForTile) {
          GameDebtMarket.startAuctionForTile(idx, { sealed: true });
        } else {
          window.startAuctionFlow?.(idx, { sealed: true });
        }
    }},
    { name: 'Subida de IVA obra', run(p){ window.news_iva_build?.(20, 2); } },
    { name: 'Desinflación', run(p){ window.news_build_cost?.(-15, 1); } },
    { name: 'Rescate exprés', run(p){
        giveMoney(p, 150, {taxable:false, reason:'Rescate exprés'});
        state.garnish[p.id] = { count: 2, turns: 2 };
        headline(`${p.name} recibe rescate exprés: embargadas sus 2 primeras rentas (2 turnos).`);
    }},
    { name: 'Auditoría', run(p){
        const due = Math.max(0, Math.round((p.taxBase||0) * 0.33));
        if (due>0){
          transfer(p, Estado, due, {taxable:false, reason:'Auditoría 33% base imponible'});
          p.taxBase = 0; renderPlayers();
        } else {
          giveMoney(p, 50, {taxable:false, reason:'Auditoría sin base → incentivo'});
        }
    }},
    { name: 'Venta forzosa', run(p){
        const rich = richestPlayer(); if (!rich) return;
        const pool = tilesOf(rich, t=> !t.houses && !t.hotel);
        if (!pool.length) return log('Venta forzosa: el más rico no tiene propiedades “limpias”.');
        const pick = pickOne(pool);
        pick.t.owner = null;
        log(`🔨 Venta forzosa: ${rich.name} pierde ${pick.t.name} a subasta abierta.`);
        BoardUI.refreshTiles?.(); renderPlayers();
        window.startAuctionFlow?.(pick.i, { sealed: false });
    }},
    { name: 'Boom ocio', run(p){
        state.rentFilters.push({ name:'boom-ocio', mul:1.25, turns:3, match:isLeisure });
        headline('Boom de ocio: +25% alquiler (3 turnos).');
    }},
    { name: 'Recesión industria', run(p){
        const fams = Array.from(new Set(TILES.filter(t=>t.type==='prop' && !t.subtype).map(t=>t.familia||t.color))).sort();
        if (!fams.length) return log('No hay familias.');
        const pick = prompt('Elige familia para recesión (texto exacto):\n'+fams.join(', '), fams[0]);
        if (!pick) return;
        state.rentFilters.push({ name:`recesion-${pick}`, mul:0.75, turns:3, match:(t)=> t.type==='prop' && (t.familia||t.color)===pick });
        headline(`Recesión en ${pick}: −25% alquiler (3 turnos).`);
    }},
    { name: 'Gentrificación', run(p){
        state.sellBonusByOwner[p.id] = 1.10;
        state.rentFilters.push({
          name:'gentrif',
          mul:1.10,
          turns:3,
          match:(t)=> t.type==='prop' && t.owner===p.id && t.houses>=3 && groupTiles(t).every(o=>o.x.houses>=3)
        });
        headline('Gentrificación: +10% renta y venta de casas durante 3 turnos.');
    }},
    { name: 'Racionamiento de cemento', run(p){
        if (state.cement){ log('Ya había racionamiento activo.'); return; }
        const take = Math.min(5, Math.max(0, BANK.housesAvail||0));
        BANK.housesAvail = (BANK.housesAvail|0) - take;
        state.cement = { taken: take, turns: 3 };
        headline(`Racionamiento de cemento: −${take} casas de stock durante 3 turnos.`);
    }},
    { name: 'Veto de subasta', run(p){ state.auctionVeto = { holderId: p.id }; log(`🛡️ ${p.name} obtiene un veto a la próxima subasta de otro.`); } },
    { name: 'Trueque obligado', run(p){
        const other = pickPlayer(p.id); if (!other) return;
        const mine = tilesOf(p, t=>!t.houses && !t.hotel);
        const theirs = tilesOf(other, t=>!t.houses && !t.hotel);
        for (const m of mine){
          const partner = theirs.find(o => (o.t.familia||o.t.color) === (m.t.familia||m.t.color));
          if (partner){
            const A=m.t, B=partner.t; const aOwner = A.owner, bOwner = B.owner;
            A.owner = bOwner; B.owner = aOwner;
            log(`♻️ Trueque: ${p.name} ↔ ${other.name} (grupo ${(A.familia||A.color)})`);
            BoardUI.refreshTiles?.(); renderPlayers();
            return;
          }
        }
        log('No hay pareja de mismo color sin edificios para trueque.');
    }},
    { name: 'Bloqueo de hipoteca', run(p){
        const rival = pickPlayer(p.id); if (!rival) return;
        state.blockMortgage[rival.id] = 1;
        log(`⛔ ${rival.name} no puede hipotecar 1 turno.`);
    }},
    { name: 'Blackjack de 50', run(p){
        function draw(){ return 2 + Math.floor(Math.random()*10); }
        let total = draw() + draw();
        while(total < 17){
          const ans = prompt(`Tienes ${total}. ¿Pides carta? (s/n)`,'s');
          if (!ans || ans.toLowerCase().startsWith('n')) break;
          total += draw();
        }
        if (total>=20 && total<=21){
          giveMoney(p, 120, {taxable:false, reason:'Blackjack de 50'});
          log(`🃏 Blackjack: ${p.name} se planta en ${total} → +120.`);
        } else {
          transfer(p, Estado, 50, {taxable:false, reason:'Blackjack de 50 (pierde)'});
          log(`🃏 Blackjack: ${p.name} termina en ${total} → paga 50.`);
        }
    }},
    { name: 'Congelar alquileres', run(p){
        state.rentCap = { amount: 150, turns: 2 };
        headline('Congelación: tope de renta 150 por cobro (2 turnos).');
    }},
    { name: 'Plan de obras', run(p){
        const props = TILES.map((t,i)=>({t,i})).filter(o=>o.t.type==='prop' && o.t.owner==='E' && !o.t.hotel && o.t.houses<=3);
        for(let pass=0; pass<4; pass++){
          for (const o of props){
            if ((BANK.housesAvail||0)<=0) { log('Sin stock para Plan de obras.'); break; }
            if (!canBuildEven(o.t, Estado)) continue;
            o.t.houses++; BANK.housesAvail--;
            log(`🏗️ Estado añade 1 casa en ${o.t.name}.`);
          }
        }
        BoardUI.refreshTiles?.(); renderPlayers();
    }},
    { name: 'Incendio leve', run(p){
        const withBuildings = tilesOf(p, t=>t.houses>0 || t.hotel);
        if (!withBuildings.length) return log('Incendio leve: no tienes edificios.');
        const pick = withBuildings[Math.floor(Math.random()*withBuildings.length)].t;
        if (pick.hotel){
          pick.hotel = false; pick.houses = 4; BANK.hotelsAvail = (BANK.hotelsAvail|0) + 1; BANK.housesAvail = Math.max(0, (BANK.housesAvail|0) - 4);
        } else {
          pick.houses--; BANK.housesAvail = (BANK.housesAvail|0) + 1;
        }
        log(`🔥 Incendio leve en ${pick.name}: pierdes 1 nivel.`);
        try{ if (pick.insured) giveMoney(p, 50, {taxable:false, reason:'Seguro'}); }catch{}
        BoardUI.refreshTiles?.(); renderPlayers();
    }},
    { name: 'Huelga de obras', run(p){
        state.blockBuildTurns = Math.max(state.blockBuildTurns||0, 1);
        headline('Huelga de obras: nadie construye el próximo turno.');
    }},
    { name: 'Subasta de Lote', run(p){
        if (!window.GameExtras) return log('Módulo de extras no cargado.');
        const bundles = GameExtras.findFreeBundles({ size: 2 }); // buscar lotes de 2
        if (bundles.length > 0) {
          GameExtras.startBundleAuctionFromEvent(bundles[0], { sealed: true });
        } else {
          log('No se encontraron lotes de propiedades libres para subastar.');
        }
    }},
    { name: 'Información Privilegiada', run(p){
        if (window.GameRiskPlus?.Insider) {
            const total = GameRiskPlus.Insider.give(p.id);
            log(`Insider: ${p.name} ahora tiene ${total} token(s).`);
        } else {
            log('Módulo de riesgo no cargado.');
        }
    }}
  ];

  // Inyecta descripciones y baraja
  function __injectEventDescs(){ (EVENT_CARDS||[]).forEach(c=>{ if(!c.desc) c.desc = EVENT_DESCS[c.name] || ''; }); }
  __injectEventDescs();
  // [PATCH] Exponer eventos para módulos externos
  window.events = EVENT_CARDS;

  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function ensureDeck(){ if (!state.eventDeck || !state.eventDeck.length) state.eventDeck = shuffle(EVENT_CARDS.slice()); }

  // Carta visible + ejecución del efecto
  window.drawEvent = function(p){
    let card = null;
    // [PATCH] Insider: usa el evento fijado si existe
    if (window.GameRiskPlus?.drawEventPatched) {
      card = GameRiskPlus.drawEventPatched();
    } else {
      ensureDeck();
      card = state.eventDeck.shift();
    }
    if (!card) { log('No hay eventos disponibles.'); return; }

    // El objeto card puede venir del deck o del patcher.
    // Buscamos la descripción en el mapa global.
    const text = card.desc || EVENT_DESCS[card.name] || '';
    log(`🃏 Evento: <b>${card.name}</b>`);
    showEventCard(card.name, text).then(()=>{
      try {
        if (typeof window.resolverCarta === 'function') {
          // v22: Lógica unificada de eventos y efectos
          resolverCarta(card, p, p.pos);
        } else {
          card.run(p); // Fallback a la lógica original
        }
      } catch(e) {
        console.error(e); log('Error al ejecutar evento.');
      }
    });
  };

  // Export mínimo
  // window.__events = { EVENT_CARDS }; // Deprecado en favor de window.events
})();

/* ==========================================
   MÓDULO: CARRERA DE GALGOS (apuestas + UI)
   ========================================== */
(function(){
  'use strict';

  // CSS de la actividad (idempotente)
  (function ensureGreyhoundCSS(){
    if (document.getElementById('greyhound-css')) return;
    const css = document.createElement('style');
    css.id = 'greyhound-css';
    css.textContent = `
      #doubleOverlay{align-items:center;justify-content:center}
      .gh-card,.gh-bet,.gh-result{
        background:#0f172a;border:1px solid #334155;border-radius:14px;
        padding:18px 20px;max-width:720px;color:#e5e7eb;box-shadow:0 8px 30px rgba(0,0,0,.35)
      }
      .gh-title{font-weight:900;font-size:1.05rem;margin-bottom:8px}
      .gh-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:center}
      .gh-btn{padding:8px 12px;border:1px solid #334155;border-radius:10px;background:#111827;cursor:pointer}
      .gh-btn[disabled]{opacity:.5;cursor:not-allowed}
      .gh-track{position:relative;width:720px;height:220px;background:#111827;border:1px dashed #475569;border-radius:12px;margin-top:10px;overflow:hidden}
      .gh-lane{position:absolute;left:0;right:0;height:44px;border-top:1px dashed #1f2937}
      .gh-dog{position:absolute;left:8px;top:0;width:44px;height:44px;border-radius:10px;background:#1f2937;display:flex;align-items:center;justify-content:center;font-size:22px}
      .gh-flag{position:absolute;right:8px;top:0;width:6px;height:44px;background:#eab308}
      .gh-pot{opacity:.9;margin:6px 0 2px}
    `;
    document.head.appendChild(css);
  })();

  // Config
  const GH_CONFIG = {
    DOGS: 5,
    ANTE: 50,
    TRACK_LEN: 640,
    MIN_SPD: 0.9,
    MAX_SPD: 2.2,
    VARIANCE: 0.25,
    TICK_MS: 16
  };

  // Utilidades (compatibles con el motor)
  const state = (window.state ||= {});
  function _playersAll(){
    if (state && Array.isArray(state.players)) return state.players;
    if (window.players && Array.isArray(window.players)) return window.players;
    throw new Error('No encuentro la lista de jugadores (state.players o window.players)');
  }
  function _log(msg){ try{ (window.log||console.log)(msg); }catch{ console.log(msg); } }
  function _headline(msg){ if (typeof window.headline==='function') window.headline(msg); else _log(`<b>${msg}</b>`); }
  function _render(){ if (typeof window.renderPlayers==='function') window.renderPlayers(); }
  function _pay(from, to, amt, reason){
    if (amt<=0) return;
    const bank = { name:'Banco', id:'bank' };
    const src = from || bank, dst = to || bank;
    if (typeof window.transfer==='function') return window.transfer(src, dst, amt, {reason});
    (src.money ??= 0); (dst.money ??= 0);
    src.money -= amt; dst.money += amt; _render();
  }
  function _give(to, amt, reason){ _pay(null, to, amt, reason); }
  const _fmt = window.fmtMoney || (n => (n|0)+'€');

  // Overlay helpers
  function ovShow(html){
    const ov = document.getElementById('doubleOverlay');
    if (!ov) throw new Error('Falta #doubleOverlay en el DOM');
    ov.innerHTML = html;
    ov.style.display = 'flex';
    return ov;
  }
  function ovHide(){ const ov = document.getElementById('doubleOverlay'); if (ov) ov.style.display = 'none'; }

  // Paso 1: recoger apuestas de TODOS los jugadores (secuencial, un overlay por jugador)
  function ghAskBetSequential(potRef){
    const ps = _playersAll().filter(x=>!x.botDisabled);
    const bets = new Map(); // key: playerId/name -> {player, dog}
    const DOGS = GH_CONFIG.DOGS;
    let idx = 0;

    return new Promise((resolve)=>{
      const next = ()=>{
        if (idx >= ps.length){ resolve(bets); return; }
        const p = ps[idx++];
        const dogBtns = Array.from({length:DOGS}, (_,i)=>`<button class="gh-btn" data-i="${i}">Galgo ${i+1}</button>`).join('');
        const html = `
          <div class="gh-bet">
            <div class="gh-title">Apuesta de ${p.name}</div>
            <div class="gh-pot">Bote actual: <b>${_fmt(potRef.value)}</b> — Apuesta fija: <b>${_fmt(GH_CONFIG.ANTE)}</b></div>
            <div class="gh-row">${dogBtns}</div>
            <div style="margin-top:8px;opacity:.85">Elige el galgo ganador.</div>
          </div>`;
        const ov = ovShow(html);
        ov.querySelectorAll('.gh-btn').forEach(b=>{
          b.onclick = ()=>{
            const choice = +b.dataset.i;
            bets.set(p.id ?? p.name, {player:p, dog:choice});
            _pay(p, null, GH_CONFIG.ANTE, 'Apuesta carrera de galgos');
            potRef.value += GH_CONFIG.ANTE;
            next();
          };
        });
      };
      next();
    });
  }

  // Paso 2: animación de carrera
  function ghRunRace(){
    const DOGS = GH_CONFIG.DOGS;
    const laneH = 44;
    const trackH = laneH * DOGS;
    const lanes = Array.from({length:DOGS}, (_,i)=>`<div class="gh-lane" style="top:${i*laneH}px"></div>`).join('');
    const dogs  = Array.from({length:DOGS}, (_,i)=>`<div class="gh-dog" id="gh-dog-${i}" style="top:${i*laneH}px">🐕</div><div class="gh-flag" style="top:${i*laneH}px"></div>`).join('');
    const html = `
      <div class="gh-card">
        <div class="gh-title">¡Carrera de galgos!</div>
        <div class="gh-track" id="gh-track" style="height:${trackH}px">
          ${lanes}${dogs}
        </div>
      </div>`;
    ovShow(html);

    const pos = new Array(DOGS).fill(0);
    const spd = new Array(DOGS).fill(0).map(()=> GH_CONFIG.MIN_SPD + Math.random()*(GH_CONFIG.MAX_SPD-GH_CONFIG.MIN_SPD));
    const el  = new Array(DOGS).fill(0).map((_,i)=> document.getElementById(`gh-dog-${i}`));
    const goal = GH_CONFIG.TRACK_LEN;
    let winner = -1, running = true;

    return new Promise((resolve)=>{
      const step = ()=>{
        if (!running) return;
        for(let i=0;i<DOGS;i++){
          spd[i] += (Math.random()*2-1)*GH_CONFIG.VARIANCE;
          if (spd[i] < GH_CONFIG.MIN_SPD) spd[i] = GH_CONFIG.MIN_SPD;
          if (spd[i] > GH_CONFIG.MAX_SPD) spd[i] = GH_CONFIG.MAX_SPD;
          pos[i] += spd[i];
          if (pos[i] >= goal && winner<0){ winner = i; running = false; break; }
          el[i].style.transform = `translateX(${pos[i]}px)`;
        }
        if (running) setTimeout(()=>requestAnimationFrame(step), GH_CONFIG.TICK_MS);
        else {
          for(let i=0;i<DOGS;i++) el[i].style.transform = `translateX(${Math.min(pos[i],goal)}px)`;
          setTimeout(()=>resolve(winner), 800);
        }
      };
      requestAnimationFrame(step);
    });
  }

  // Paso 3: orquestador
  async function startGreyhoundEvent(triggeredByPlayer){
    const pot = { value: 0 };
    _headline('¡Carrera de galgos en SALIDA!');
    _log('🏁 Evento: Carrera de Galgos');

    const betsMap = await ghAskBetSequential(pot);
    let winnerDog = await ghRunRace();

    try {
      // Busca si algún Proxeneta ha apostado
      const entries = Array.from(betsMap.values?.() || []);
      const prox = entries.find(v => window.Roles?.is?.(v.player.id, 'proxeneta'));
      if (prox) {
        const baseP = 1 / (window.GH_CONFIG?.DOGS || 6);
        const wantWin = window.Roles.decideWin(baseP, prox.player, 'greyhounds');
        if (wantWin && prox.dog !== winnerDog) {
          // fuerza ganador al galgo apostado por el Proxeneta
          winnerDog = prox.dog;
        }
      }
    } catch {}

    const winners = [];
    betsMap.forEach((v)=>{ if (v.dog === winnerDog) winners.push(v.player); });

    ovShow(`<div class="gh-result">
      <div class="gh-title">Resultado</div>
      <div>Ganó el <b>Galgo ${winnerDog+1}</b>.</div>
      <div class="gh-pot" id="gh-payline"></div>
      <div class="gh-row"><button class="gh-btn" id="gh-close">Continuar</button></div>
    </div>`);

    if (winners.length === 0){
      document.getElementById('gh-payline').innerHTML = `Nadie acertó. El bote <b>${_fmt(pot.value)}</b> va al Banco.`;
    } else {
      const share = Math.floor(pot.value / winners.length);
      winners.forEach(w=> _give(w, share, 'Premio carrera de galgos'));
      document.getElementById('gh-payline').innerHTML =
        `Acertaron: <b>${winners.map(w=>w.name).join(', ')}</b>. Premio por cabeza: <b>${_fmt(share)}</b>.`;
    }
    _render();

    document.getElementById('gh-close').onclick = ()=> ovHide();
  }

  // Exponer API
  window.startGreyhoundEvent = startGreyhoundEvent;
})();

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

    const n = state.players.length;
    const roleP = Math.max(0, Math.min(1, cfg.roleProbability||0.20));
    let fbiAssigned = false;
    state.players.forEach(p=>{
      let r = ROLE.CIVIL;
      if(rand.chance(roleP)){
        const pool = fbiAssigned ? [ROLE.PROXENETA, ROLE.FLORENTINO] : [ROLE.PROXENETA, ROLE.FLORENTINO, ROLE.FBI];
        r = rand.pick(pool);
        if(r===ROLE.FBI) fbiAssigned = true;
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
      c = window.confirm('¿ITV sin pasar? A: irte al monte (pierdes turno). B: ayudar (cárcel para ti y el de la izquierda).
Aceptar=A, Cancelar=B') ? 'A' : 'B';
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

  document.addEventListener('DOMContentLoaded', ()=>{ $1
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


// v20-rename.js — Renombrar jugadores (J1, J2, J3...) en vivo + persistencia
// Cárgalo DESPUÉS de v20-part4.js (puede ir al final).
// No toca economía ni reglas; sólo UI y state.players[i].name

(function(){
  'use strict';

  const KEY = 'v20.playerNames';

  function loadMap(){
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
    catch { return {}; }
  }
  function saveMap(map){
    try { localStorage.setItem(KEY, JSON.stringify(map||{})); } catch {}
  }

  // Guarda el nombre actual de todos los jugadores
  function persistNames(){
    const map = {};
    (window.state?.players || []).forEach(p=>{ if(p) map[p.id] = p.name; });
    saveMap(map);
  }

  // Aplica los nombres guardados (si existen) a la partida actual
  function applySavedNames(){
    const map = loadMap();
    (window.state?.players || []).forEach(p=>{
      if (map && Object.prototype.hasOwnProperty.call(map, p.id)) {
        const v = (map[p.id]||'').toString().trim();
        if (v) p.name = v;
      }
    });
  }

  // === UI: añadir botón de editar a cada badge de jugador
  function decoratePlayersPanel(){
    const panel = document.getElementById('players');
    if (!panel) return;
    // Evitar añadir botones duplicados
    panel.querySelectorAll('.badge.player').forEach(badge=>{
      if (badge.querySelector('.editName')) return;
      const btn = document.createElement('button');
      btn.className = 'editName';
      btn.title = 'Renombrar';
      btn.textContent = '✎';
      btn.style.cssText = 'margin-left:8px;background:#111827;border:1px solid #374151;color:#e5e7eb;border-radius:8px;padding:0 6px;cursor:pointer;line-height:18px;height:20px;';
      btn.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        const idx = Array.from(panel.querySelectorAll('.badge.player')).indexOf(badge);
        const p = window.state?.players?.[idx];
        if (!p) return;
        const current = p.name || `J${p.id+1}`;
        const v = prompt(`Nuevo nombre para J${p.id+1}:`, current);
        if (!v) return;
        const name = v.trim().slice(0,24);
        if (!name) return;
        p.name = name;
        persistNames();
        try{ window.renderPlayers(); }catch{}
      });
      badge.appendChild(btn);
    });
  }

  // === Hooks sobre funciones existentes ===
  const _renderPlayers = window.renderPlayers;
  window.renderPlayers = function(){
    try { _renderPlayers?.(); } catch {}
    try { decoratePlayersPanel(); } catch {}
  };

  const _newGame = window.newGame;
  window.newGame = function(){
    // Ejecuta newGame original para crear jugadores
    const ret = _newGame?.apply(this, arguments);
    // Aplica nombres guardados y vuelve a renderizar
    try { applySavedNames(); } catch {}
    try { window.renderPlayers(); } catch {}
    return ret;
  };

  // Si ya hay partida cargada, aplica inmediatamente
  document.addEventListener('DOMContentLoaded', ()=>{
    try { applySavedNames(); } catch {}
    try { window.renderPlayers?.(); } catch {}
  });

})();


/* v20-debug.js — Debug Mode overlay, logging and hooks
   Drop this AFTER all other v20-part*.js scripts.
   Toggle:
    • URL ?debug=1
    • localStorage.DEBUG="1"
    • Press "D" to toggle panel
   Features:
    • Live state viewer (player, tile, flags)
    • In‑page log console (captured from window.log)
    • Error banner for window.onerror / unhandledrejection
    • Quick actions: Force End Turn, Roll, Step +1, +100/−100 money
    • Hooks with timings for: roll, movePlayer, onLand, playSlotsFree, offerTransportHop, endTurn, BoardUI.refreshTiles
*/
(function(){
  'use strict';

  // Avoid double install
  if (window.__V20_DEBUG_INSTALLED__) return; window.__V20_DEBUG_INSTALLED__ = true;

  // ==== Utilities ====
  const $ = (sel, root=document) => root.querySelector(sel);
  const $all = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const el = (tag, attrs={}) => Object.assign(document.createElement(tag), attrs);

  const now = () => performance.now();
  const ts  = () => new Date().toLocaleTimeString();

  const DBG = window.DEBUG = window.DEBUG || {
    enabled: false,
    phases: [],
    history: [],
    hooks: {},
    lastError: null,
    config: { maxLog: 400 }
  };

  function persist(){ try { localStorage.setItem('DEBUG', DBG.enabled ? '1':''); } catch(e){} }
  function enabledFromEnv(){
    try{
      const url = new URL(location.href);
      if (url.searchParams.get('debug') === '1') return true;
      const ls  = localStorage.getItem('DEBUG');
      return ls === '1';
    }catch{ return false; }
  }

  // ==== UI ====
  const panel = el('div', { id:'debugPanel' });
  panel.style.cssText = [
    'position:fixed','right:10px','bottom:10px','z-index:999999',
    'font:12px/1.25 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    'color:#111','user-select:text'].join(';');
  const toggleBtn = el('button', { id:'debugToggle', textContent:'🐞 Debug' });
  toggleBtn.style.cssText = [
    'padding:6px 10px','border-radius:10px','border:1px solid #aaa',
    'background:#fff','cursor:pointer','box-shadow:0 2px 8px rgba(0,0,0,.15)','color:#111'].join(';');

  const card = el('div', { id:'debugCard' });
  card.style.cssText = [
    'display:none','margin-top:8px','width:320px','max-height:55vh','overflow:auto',
    'background:#fff','border:1px solid #ccc','border-radius:12px','padding:8px',
    'box-shadow:0 12px 28px rgba(0,0,0,.25)'].join(';');

  const tabs = el('div', { className:'tabs' });
  const tabState = el('button', { textContent:'State' });
  const tabLog   = el('button', { textContent:'Log' });
  const tabRoles = el('button', { textContent:'Roles' });
  [tabState, tabLog, tabRoles].forEach(b => b.style.cssText='margin-right:6px;padding:4px 8px;border:1px solid #ddd;background:#f8fafc;border-radius:8px;cursor:pointer;color:#111');
  const secState = el('div');
  const secLog   = el('div'); secLog.style.display = 'none';
  const secRoles = el('div'); secRoles.style.display = 'none';

  const grid = el('div'); grid.style.cssText='display:grid;grid-template-columns:110px 1fr;gap:4px 8px;margin-top:6px';
  function row(k,v){ const a=el('div',{textContent:k,style:'color:#555'}), b=el('div',{textContent:v||''}); grid.append(a,b); }
  const actions = el('div'); actions.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-top:8px';
  function action(label, fn){ const b=el('button',{textContent:label}); b.style.cssText='padding:4px 8px;border:1px solid #ddd;background:#eef;border-radius:8px;cursor:pointer;color:#111'; b.onclick=fn; actions.appendChild(b); return b; }

  const logBox = el('div'); logBox.style.cssText='margin-top:8px;border:1px solid #eee;background:#fff;color:#111;border-radius:8px;padding:6px;min-height:140px;white-space:pre-wrap';

  // Roles tab content
  const rolesBox = el('div');
  rolesBox.style.cssText='margin-top:8px;border:1px solid #eee;background:#fff;color:#111;border-radius:8px;padding:6px;min-height:120px;white-space:pre-wrap';
  const rolesActions = el('div');
  rolesActions.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-top:8px';
  const btnEstadoBid = el('button', { textContent:'Bloquear Estado' });
  btnEstadoBid.style.cssText='padding:4px 8px;border:1px solid #ddd;background:#fee;border-radius:8px;cursor:pointer;color:#111';
  rolesActions.appendChild(btnEstadoBid);
  secRoles.appendChild(rolesBox);
  secRoles.appendChild(rolesActions);

  function _roleNice(r){
    if (r==='proxeneta') return 'Proxeneta';
    if (r==='florentino') return 'Florentino Pérez';
    if (r==='fbi') return 'FBI';
    return 'Sin rol';
  }

  function renderRoles(){
    try{
      if (!window.Roles){
        rolesBox.textContent = 'Roles no cargado.';
        btnEstadoBid.disabled = true;
        return;
      }
      const list = (Roles.listAssignments && Roles.listAssignments()) ||
                   ((window.state?.players)||[]).map(p=>({id:p.id, name:p.name, role:'?'}));
      const lines = list.map(r => `${r.name||r.id} — ${_roleNice(r.role)}`).join('\n') || 'Sin jugadores';
      rolesBox.textContent = lines;

      if (Roles.isEstadoAuctionBlocked){
        const blocked = !!Roles.isEstadoAuctionBlocked();
        btnEstadoBid.textContent = blocked ? 'Permitir Estado' : 'Bloquear Estado';
        btnEstadoBid.disabled = false;
      }
    } catch(e){
      rolesBox.textContent = '(error al renderizar roles)';
    }
  }

  btnEstadoBid.onclick = () => {
    try {
      if (window.Roles?.setEstadoAuctionBlocked && window.Roles?.isEstadoAuctionBlocked){
        Roles.setEstadoAuctionBlocked(!Roles.isEstadoAuctionBlocked());
        renderRoles();
      }
    } catch{}
  };

  secState.appendChild(grid); secState.appendChild(actions);
  secLog.appendChild(logBox);

  tabs.append(tabState, tabLog, tabRoles);
  card.appendChild(tabs);
  card.appendChild(secState);
  card.appendChild(secLog);
  card.appendChild(secRoles);
  panel.appendChild(toggleBtn);
  panel.appendChild(card);
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(panel));

  function selectTab(which){
    if (which==='log'){
      secState.style.display='none';
      secLog.style.display='block';
      secRoles.style.display='none';
      tabLog.style.background='#fff';
      tabState.style.background='#f8fafc';
      tabRoles.style.background='#f8fafc';
    } else if (which==='roles'){
      secState.style.display='none';
      secLog.style.display='none';
      secRoles.style.display='block';
      tabRoles.style.background='#fff';
      tabState.style.background='#f8fafc';
      tabLog.style.background='#f8fafc';
      renderRoles();
    } else {
      secState.style.display='block';
      secLog.style.display='none';
      secRoles.style.display='none';
      tabState.style.background='#fff';
      tabLog.style.background='#f8fafc';
      tabRoles.style.background='#f8fafc';
    }
  }
  tabState.onclick = () => selectTab('state');
  tabLog.onclick   = () => selectTab('log');
  tabRoles.onclick = () => selectTab('roles');

  toggleBtn.onclick = () => {
    DBG.enabled = !DBG.enabled;
    card.style.display = DBG.enabled ? 'block' : 'none';
    toggleBtn.style.background = DBG.enabled ? '#ffe8a3' : '#fff';
    persist();
  };

  // Keyboard toggle
  document.addEventListener('keydown', (ev)=>{
    if ((ev.key==='d' || ev.key==='D') && !ev.altKey && !ev.metaKey && !ev.ctrlKey){
      toggleBtn.click(); ev.preventDefault();
    }
  });

  // ==== In‑page logger ====
  const nativeConsoleLog = console.log.bind(console);
  let _log = window.log || nativeConsoleLog;
  function dbgLog(){ 
    try{
      const msg = Array.from(arguments).map(x => typeof x==='string'?x:JSON.stringify(x)).join(' ');
      nativeConsoleLog('[DBG]', msg);
      DBG.history.push(`[${ts()}] ${msg}`);
      if (DBG.history.length > DBG.config.maxLog) DBG.history.splice(0, DBG.history.length - DBG.config.maxLog);
      if (DBG.enabled) render();
    }catch(e){}
  }
  // Wrap window.log to capture messages
  if (typeof window.log === 'function'){
    const prev = window.log;
    window.log = function(){
      try{ dbgLog.apply(null, arguments); }catch{}
      return prev.apply(this, arguments);
    };
  } else {
    window.log = function(){ dbgLog.apply(null, arguments); _log.apply(null, arguments); };
  }

  // Periodic flush of log box
  function renderLog(){
    logBox.textContent = DBG.history.join('\n');
  }

  // ==== Errors banner ====
  const errBanner = el('div');
  errBanner.style.cssText = 'display:none;position:fixed;left:10px;bottom:10px;z-index:999999;background:#fee2e2;border:1px solid #ef4444;color:#7f1d1d;padding:8px 12px;border-radius:10px;box-shadow:0 10px 20px rgba(0,0,0,.2)';
  const errText = el('div');
  const errCopy = el('button', { textContent:'Copiar error' });
  errCopy.style.cssText='margin-left:8px;padding:4px 8px;border:1px solid #ef4444;background:#fff;border-radius:8px;cursor:pointer';
  errCopy.onclick = () => { try { navigator.clipboard.writeText(errText.textContent||''); } catch(e){} };
  errBanner.append(errText, errCopy);
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(errBanner));

  function showErrorBanner(msg){
    errText.textContent = msg;
    errBanner.style.display = 'block';
    setTimeout(()=>{ errBanner.style.display = 'none'; }, 8000);
  }

  // === Contexto del último hook + snapshot de estado ===
  DBG.lastCtx = { hook:null, args:[], when:null, snap:null };

  function _snapshotState(){
    try{
      const st = window.state || {};
      const T  = window.TILES || [];
      const cur = st.players?.[st.current];
      const tile = (cur && Number.isFinite(cur.pos)) ? T[cur.pos] : null;
      return {
        player: cur ? { id:cur.id, name:cur.name, money:cur.money, pos:cur.pos, jail:cur.jail } : null,
        tile:   tile && cur ? { i:cur.pos, name:tile.name, type:tile.type, subtype:tile.subtype } : null,
        state:  { current:st.current, rolled:!!st.rolled, auction:!!(st.auction&&st.auction.open), lastRoll:st.lastRoll }
      };
    }catch{ return {}; }
  }

  function _fmtArgs(a){
    return (a||[]).map(v=>{
      try{
        if (v && typeof v==='object' && 'name' in v && 'money' in v) return `[Player:${v.name}]`;
        if (typeof v==='object') return JSON.stringify(v).slice(0,80);
        return String(v);
      }catch{ return '?'; }
    }).join(', ');
  }

  function _diagnose(err){
    const hints = [];
    const msg = String(err && (err.message || err)).toLowerCase();
    const stack = String((err && err.stack) || '');
    const lc = DBG.lastCtx || {};
    const snap = lc.snap || {};
    const add = s => hints.push('• ' + s);

    // TypeErrors comunes
    if (/cannot read (properties|property) of undefined/.test(msg)) {
      if (/money|name|pos|jail/.test(msg)) add('El jugador actual es undefined o state.current apunta mal.');
      if (/owner|price|rent|group|houses|hotel/.test(msg)) add('La casilla es undefined: TILES[pos] no existe o pos fuera de rango.');
    }
    if (/cannot set (properties|property) of null/.test(msg) || /reading 'textcontent'/.test(msg)) {
      add('Falta un elemento del DOM: selector/ID incorrecto en la UI.');
    }
    if (/closest is not a function|classlist/.test(msg)) add('El target del evento no es un Element: listener colocado demasiado arriba o evento sintético.');
    if (/is not iterable|spread/.test(msg)) add('Se itera algo no iterable. Valida tipos antes de usar ... o for..of.');
    if (/invalid array length|out of range/.test(msg)) add('Tamaño/índice de array inválido (p.ej., movimiento de ficha fuera del tablero).');
    if (/assignment to constant variable/.test(msg)) add('Se reasigna una const.');
    if (/await is only valid/.test(msg)) add('await fuera de una función async.');
    if (/converting circular structure to json/.test(msg)) add('JSON.stringify con referencias circulares (usa replacer o copia segura).');

    // Pistas por archivo (afinando áreas)
    if (/v20-part5\.js/.test(stack)) add('Área movePlayer/animación: revisa cálculo de pos y límites.');
    if (/v20-part6\.js/.test(stack)) add('Área onLand/compra: tile u owner pueden ser undefined.');
    if (/v20\.html/.test(stack))     add('Markup: puede faltar #game o IDs que espera la UI.');

    if (!hints.length) add('Sin heurística clara. Usa el stack y el contexto de arriba.');
    return hints.join('\n');
  }
  function _buildReport(kind, err) {
    const stack = (err && (err.stack||err.message)) || String(err);
    const head  = String(stack).split('\n')[0] || String(err);
    const lc = DBG.lastCtx || {};
    const snap = lc.snap || {};
    const lines = [];
    lines.push(`${kind}: ${head}`);
    if (lc.hook) lines.push(`En: ${lc.hook}(${_fmtArgs(lc.args)}) @ ${lc.when}`);
    if (snap.player) lines.push(`Jugador: ${snap.player.name} (#${snap.player.id}) $${snap.player.money} pos=${snap.player.pos}`);
    if (snap.tile)   lines.push(`Casilla: #${snap.tile.i} ${snap.tile.name} [${snap.tile.type}${snap.tile.subtype?'/'+snap.tile.subtype:''}]`);
    if (snap.state)  lines.push(`Flags: rolled=${snap.state.rolled} auction=${snap.state.auction} lastRoll=${snap.state.lastRoll}`);
    lines.push('Stack:');
    lines.push(String(stack).split('\n').slice(0,8).join('\n'));
    // NUEVO: heurística
    try {
      const dx = _diagnose(err);
      if (dx) {
        lines.push('Diagnóstico probable:');
        lines.push(dx);
      }
    } catch {}
    return lines.join('\n');
  }

  function _detectScriptError(e){
    const isScriptErr = e && String(e.message) === 'Script error.' && !e.error;
    const onFile = location.protocol === 'file:';
    const suspects = Array.from(document.scripts)
      .map(s => s.src).filter(Boolean)
      .map(src => new URL(src, location.href))
      .filter(u => u.origin !== location.origin) // fuera de tu origen
      .map(u => u.href);
    return { isScriptErr, onFile, suspects };
  }

  window.addEventListener('error', (e)=>{
    try{
      const dx = _detectScriptError(e);
      if (dx.isScriptErr){
        const tips = [];
        tips.push('Causa probable: error en script de OTRO ORIGEN o página abierta con file://');
        if (dx.onFile) tips.push('Estás en file:// → usa un servidor local (python/http-server).');
        if (dx.suspects.length) tips.push('Scripts externos: ' + dx.suspects.join(', '));
        tips.push('Solución: mismo origen o <script crossorigin="anonymous"> + CORS en el servidor.');
        errText.textContent = (_buildReport('JS Error', e) + '\n' + 'Diagnóstico probable:\n• ' + tips.join('\n• '));
        showErrorBanner('⚠️ Script error (origen cruzado)');
        dbgLog('ERROR detail:', tips.join(' | '));
        return; // evitamos el flujo normal, ya hemos puesto el informe enriquecido
      }

      const report = _buildReport('JS Error', e?.error || e);
      DBG.lastError = report;
      showErrorBanner('⚠️ JS Error — pulsa “Copiar error”');
      errText.textContent = report; // así el botón copia el informe completo
      dbgLog('ERROR:', report);
    }catch(ex){
      dbgLog('ERROR handler failed:', ex);
    }
  });

  window.addEventListener('unhandledrejection', (e)=>{
    try{
      const reason = e?.reason;
      const report = _buildReport('Promise rejection', reason);
      DBG.lastError = report;
      showErrorBanner('⚠️ Promise rejection — pulsa “Copiar error”');
      errText.textContent = report;
      dbgLog('UNHANDLED:', report);
    }catch(ex){
      dbgLog('UNHANDLED handler failed:', ex);
    }
  });

  window.addEventListener('securitypolicyviolation', e => {
    dbgLog('CSP violación:', e.blockedURI, e.violatedDirective);
  });

  // ==== Hooks & timings ====
  function wrap(obj, key){
    const ref = (typeof obj==='function') ? { fn: obj } : obj;
    const fn  = ref[key] || (typeof obj==='function' ? obj : undefined);
    if (!fn || fn.__wrapped) return;
    function wrapped() {
      const start = now();
      // Guarda contexto anterior al call
      try {
        DBG.lastCtx.hook = key;
        DBG.lastCtx.args = Array.from(arguments);
        DBG.lastCtx.when = new Date().toISOString();
        DBG.lastCtx.snap = _snapshotState();
      } catch {}
      dbgLog(`▶ ${key}()`, arguments);
      try {
        const r = fn.apply(this, arguments);
        if (r && typeof r.then === 'function') {
          return r.then(v => { dbgLog(`✔ ${key}() ✓ ${Math.round(now() - start)}ms`); return v; })
            .catch(err => { dbgLog(`✖ ${key}() error:`, err); throw err; });
        } else {
          dbgLog(`✔ ${key}() ✓ ${Math.round(now() - start)}ms`);
          return r;
        }
      } catch (err) {
        dbgLog(`✖ ${key}() error:`, err && (err.stack || err.message || String(err)));
        throw err;
      }
    }
    wrapped.__wrapped = true;
    if (typeof obj==='function'){ return wrapped; }
    else { ref[key] = wrapped; }
  }

  function tryWrapGlobal(name){
    try{
      const fn = window[name];
      if (typeof fn === 'function'){
        window[name] = wrap(fn, 'fn') || wrap({fn}, 'fn');
        dbgLog(`hooked ${name}()`);
      }
    }catch(e){}
  }

  // Specific targets
  function installHooks(){
    // simple functions
    ['roll','onLand','endTurn','playSlotsFree','offerTransportHop'].forEach(tryWrapGlobal);
    // movePlayer is inside part5
    if (typeof window.movePlayer === 'function'){
      window.movePlayer = wrap(window.movePlayer, 'fn') || window.movePlayer;
      dbgLog('hooked movePlayer()');
    }
    // BoardUI.refreshTiles is a method
    if (window.BoardUI && typeof window.BoardUI.refreshTiles === 'function'){
      const o = window.BoardUI;
      wrap(o, 'refreshTiles');         // ← NO reasignes el retorno
      dbgLog('hooked BoardUI.refreshTiles()');
    }
  }
  document.addEventListener('DOMContentLoaded', installHooks);

  // ==== Quick Actions ====
  function cp(){ try { return window.state?.players?.[window.state?.current]; } catch{ return null; } }
  action('Force End', ()=>{ (window.forceEndTurn||window.endTurn)?.(); });
  action('Roll', ()=>{ window.roll?.(); });
  action('Step +1', ()=>{ const p=cp(); if(p) window.movePlayer?.(p,1); });
  action('+100€', ()=>{ const p=cp(); if(p){ p.money=(p.money||0)+100; window.renderPlayers?.(); window.log?.(`DEBUG: ${p.name}+100€`);} });
  action('−100€', ()=>{ const p=cp(); if(p){ p.money=(p.money||0)-100; window.renderPlayers?.(); window.log?.(`DEBUG: ${p.name}−100€`);} });
  action('Show Tile', ()=>{
    try{
      const i = window.state?.players?.[window.state?.current]?.pos;
      const el = document.querySelector(`.tile:nth-child(${(i|0)+1})`);
      el?.scrollIntoView({behavior:'smooth', block:'center', inline:'center'});
      el && (el.style.outline='3px solid #f59e0b', setTimeout(()=>el.style.outline='', 1200));
    }catch{}
  });

  // ==== Live State render ====
  function render(){
    try{
      grid.innerHTML = '';
      const st = window.state || {};
      const T = window.TILES || [];
      const cur = st.players?.[st.current];
      const tile = (cur && Number.isFinite(cur.pos)) ? T[cur.pos] : null;

      row('hora', ts());
      row('rolled', String(!!st.rolled));
      row('turn', String(st.current));
      row('players', String((st.players||[]).length));
      row('alive', String((st.players||[]).filter(p=>p.alive).length));
      row('player', cur ? `${cur.name} (#${cur.id})` : '—');
      row('pos', cur ? `${cur.pos}` : '—');
      row('tile', tile ? (tile.name || tile.type || '') : '—');
      row('auction', st.auction && st.auction.open ? 'open' : '—');
      row('miniGame', st._miniGameOpen ? 'open' : '—');
      if (window.SafeBug?.lastActivityAt){
        const sec = Math.round((Date.now() - window.SafeBug.lastActivityAt)/1000);
        row('last activity', `${sec}s ago`);
      }
      renderLog();
    }catch(e){}
  }

  // Periodic refresh when panel open
  setInterval(()=>{
    if (DBG.enabled){
      render();
      if (secRoles.style.display === 'block') renderRoles();
    }
  }, 500);

  // Start open if env says so
  document.addEventListener('DOMContentLoaded', ()=>{
    DBG.enabled = enabledFromEnv();
    card.style.display = DBG.enabled ? 'block' : 'none';
    toggleBtn.style.background = DBG.enabled ? '#ffe8a3' : '#fff';
    if (DBG.enabled) render();
  });

})();
