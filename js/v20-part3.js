'use strict';

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
const cardBuild= document.getElementById('cardBuild');
const cardRoi  = document.getElementById('cardRoi');
const cardPriceRow = cardPrice ? cardPrice.parentElement : null;
const cardRentRow  = cardRent  ? cardRent.parentElement  : null;
const cardBuildRow = cardBuild ? cardBuild.parentElement : null;
if (cardRoi && cardRoi.parentElement) cardRoi.parentElement.style.display = 'none';
if (cardBuildRow) cardBuildRow.style.display = 'none';

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

  const t = TILES[tileIndex];
  const st = window.state;
  if (st) st.pendingTile = tileIndex;


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
if (cardPriceRow) cardPriceRow.style.display = 'flex';
if (cardRentRow)  cardRentRow.style.display  = (isVehicleOrUtil || isNoBuildings) ? 'none' : 'flex';
if (cardBuildRow) cardBuildRow.style.display = (!isVehicleOrUtil && !isNoBuildings) ? 'flex' : 'none';

cardPrice.textContent = fmtMoney(t.price);

// siempre que haya modelo, mostrar tabla (incluye vehículos)
const model = buildRentModel(t);
rentsBox.innerHTML = (Array.isArray(model) && model.length) ? renderRentsTable(model) : '';

if (!isVehicleOrUtil && !isNoBuildings){
  cardRent.textContent = fmtMoney(t.baseRent ?? Math.round((t.price||0)*0.3));
  const cost = t.houseCost ?? Math.round((t.price||0)*0.5);
  if (cardBuild) cardBuild.textContent = `Casa ${fmtMoney(cost)} · Hotel ${fmtMoney(cost)}`;
}


    const msg = FUNNY[t.type] || FUNNY.default;
    bankWarn.className = 'muted';
    bankWarn.textContent = msg;
    rentsBox.innerHTML = '';
  }
  overlay.style.display = 'flex';
}

if (typeof window.renderRentsTable !== 'function'){
  window.renderRentsTable = function renderRentsTable(model){
    const rows = model
      .map(r => {
        const label = ('label' in r) ? r.label : (r.houses === 5 ? 'Hotel' : r.houses);
        const rent  = (typeof r.rent === 'number') ? `$${Math.max(0, Math.round(r.rent || 0))}` : r.rent;
        return `<tr><td>${label}</td><td style="text-align:right">${rent}</td></tr>`;
      })
      .join('');
    return `<table><thead><tr><th>Nº</th><th>Alquiler</th></tr></thead><tbody>${rows}</tbody></table>`;
  };
}

window.showCard = showCard;
if (cancelAuctionBtn) cancelAuctionBtn.onclick = ()=>{ overlay.style.display='none'; if (window.state) window.state.pendingTile=null; };
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
  start:    'salidas como tu madre.',
  tax:      'dinerito pal politiko',
  jail:     'Buen sitio pa hacer Networking?',
  gotojail: 'A la cárcel, a la cárcel, a la cárcel, a la cárcel, a la cárcel…',
  park:     'buen sitio pa fumar porros',
  slots:    'GANA GANA GANA!!!',
  bank:     'Banca corrupta: pide préstamo o securitiza tus deudas.',
  default:  'Sin info, como tu madre...'
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
