/* v13 – Parte 3/7: núcleo (constantes, TILES, estado, rentas, carta) */

/* ===== Colores (coinciden con tus sets previos) ===== */
const COLORS = {
  brown:'#78350f', cyan:'#06b6d4', pink:'#db2777', orange:'#f97316',
  red:'#ef4444', yellow:'#eab308', green:'#22c55e', blue:'#3b82f6',
  util:'#a3a3a3', rail:'#6d28d9', ferry:'#0ea5e9', air:'#facc15',
  park:'#4ade80'
};

/* ===== Constructor de propiedades ===== */
function prop(name, color, price){
  return {
    type:'prop', name, color, price,
    baseRent:Math.round(price*0.3),
    houseCost:Math.round(price*0.5),
    houseRent:Math.round(price*0.25),
    owner:null, houses:0, hotel:false,
    subtype: null, mortgaged:false
  };
}

/* ===== “Specials” (agua/luz, transportes) ===== */
const agua = Object.assign(prop('Compañía de Aguas','util',150), { subtype:'utility' });
const luz  = Object.assign(prop('Compañía Eléctrica','util',150), { subtype:'utility' });

const m1 = Object.assign(prop('Metro Norte','rail',200), { subtype:'rail' });
const m2 = Object.assign(prop('Metro Sur','rail',200), { subtype:'rail' });
const m3 = Object.assign(prop('Metro Este','rail',200), { subtype:'rail' });
const m4 = Object.assign(prop('Metro Oeste','rail',200), { subtype:'rail' });
const m5 = Object.assign(prop('Metro Central','rail',200), { subtype:'rail' });

const f1 = Object.assign(prop('Ferry A','ferry',180), { subtype:'ferry' });
const f2 = Object.assign(prop('Ferry B','ferry',180), { subtype:'ferry' });

const a1 = Object.assign(prop('Aeródromo','air',260), { subtype:'air' });

/* ===== Definición del tablero (de v12, visible como v11) ===== */
const TILES = [
  { type:'start', name:'SALIDA' },

  // Marrón (2)
  prop('Kanala auzoa','brown',60),
  { type:'tax', name:'Impuesto 3%' },
  prop('Zelaieta auzoa','brown',70),

  // Utility 1
  agua,

  // Cyan (3)
  prop('Frontoie','cyan',80),
  { type:'tax', name:'Impuesto 3%' },
  prop('Txokoa','cyan',90),
  prop('Goiko Etxe','cyan',100),

  // Metro 1
  m1,

  // Rosa (3)
  prop('Pipi´s Bar','pink',100),
  prop('Artea','pink',110),
  prop('Iturri','pink',120),

  // Naranja (3)
  prop('Ozollo','orange',120),

  // Luz
  luz,

  prop('Andra Mari','orange',140),

  // Rojo (3)
  prop('San Inazio','red',160),
  m2,
  prop('San Miguel','red',170),
  prop('Santa María','red',180),

  // Amarillo (3)
  prop('Arrieta','yellow',180),
  f1,
  prop('Kalea Nagusia','yellow',190),
  prop('Herriko Plaza','yellow',200),

  // Verde (3)
  prop('Ibarra','green',220),
  { type:'jail', name:'Cárcel' },
  prop('Kortezubi','green',230),
  prop('Ajangiz','green',240),

  // Azul (2) + transportes
  m3,
  prop('Gernika','blue',260),
  a1,
  prop('Bilbao','blue',320),

  // Transportes y varios
  m4,
  f2,
  m5,
  { type:'park', name:'Parque' },

  // Algunos impuestos extra y “ir a la cárcel”
  { type:'tax', name:'Impuesto 3%' },
  { type:'gotojail', name:'Ir a la cárcel' },
];
window.TILES = TILES;

/* ===== Estado de partida ===== */
const Estado = { name:'Estado', money: 5000, id:'E' }; // banca central
const state = {
  players: [],
  current: 0,
  rolled: false,
  auction: null,
  pendingTile: null,
  loans: [],
  lastRoll: 0
};

/* ===== Utilidades ===== */
function log(m){
  const el=document.getElementById('log');
  if (!el) return;
  el.innerHTML+=m+'<br>';
  el.scrollTop=el.scrollHeight;
}
function fmtMoney(n){ return `$${Math.max(0, Math.round(n||0))}`; }

/* ===== Cálculo de alquiler (rentas) ===== */
function getRent(tile){
  if (!tile || tile.mortgaged) return 0;

  // Utilities: dado×3 si posees 1, dado×10 si posees ambas
  if (tile.subtype === 'utility') {
    const owner = tile.owner==='E' ? 'E' : tile.owner;
    const owned = TILES.filter(t=>t.type==='prop' && t.subtype==='utility' && t.owner===owner).length;
    const mult = (owned >= 2) ? 10 : 3;
    const dice = state.lastRoll || 0;
    return dice * mult;
  }

  // Metro: escala por nº poseído
  if (tile.subtype === 'rail') {
    const owner = tile.owner==='E' ? 'E' : tile.owner;
    const n = TILES.filter(t=>t.type==='prop' && t.subtype==='rail' && t.owner===owner).length;
    const table = [0,25,50,100,200,300]; // hasta 5
    return table[Math.max(0, Math.min(n, 5))];
  }

  // Ferry: progresivo suave
  if (tile.subtype === 'ferry') {
    const owner = tile.owner==='E' ? 'E' : tile.owner;
    const n = TILES.filter(t=>t.type==='prop' && t.subtype==='ferry' && t.owner===owner).length;
    return [0,30,70][Math.max(0, Math.min(n, 2))];
  }

  // Air: premium
  if (tile.subtype === 'air') {
    const owner = tile.owner==='E' ? 'E' : tile.owner;
    const n = TILES.filter(t=>t.type==='prop' && t.subtype==='air' && t.owner===owner).length;
    return [0,120][Math.max(0, Math.min(n, 1))];
  }

  // Propiedad normal con casas/hotel
  const base = tile.baseRent ?? Math.round((tile.price||0)*0.3);
  if (tile.hotel) return base + 5 * (tile.houseRent ?? Math.round(tile.price*0.25));
  if (tile.houses>0) return base + tile.houses * (tile.houseRent ?? Math.round(tile.price*0.25));
  return base;
}

/* ===== Carta de propiedad (modal) ===== */
const overlay = document.getElementById('overlay');
const cardBand = document.getElementById('cardBand');
const cardName = document.getElementById('cardName');
const cardPrice= document.getElementById('cardPrice');
const cardRent = document.getElementById('cardRent');
const cardRoi  = document.getElementById('cardRoi');
const rentsBox = document.getElementById('cardRentsBox');
const bankWarn = document.getElementById('bankWarn');
const startAuctionBtn = document.getElementById('startAuction');
const cancelAuctionBtn= document.getElementById('cancelAuction');

function buildRentModel(t){
  const base = t.baseRent ?? Math.round((t.price||0)*0.3);
  const step = t.houseRent ?? Math.round((t.price||0)*0.25);
  return Array.from({length:6},(_,i)=>({houses:i, rent:i===5? base+5*step : base+i*step}));
}

function showCard(tileIndex,{canAuction=false}={}){
  const t = TILES[tileIndex]; state.pendingTile = tileIndex;

  // cabecera
  cardBand.style.background = t.type==='prop' ? COLORS[t.color] : '#374151';
  cardBand.textContent = t.name;
  cardName.textContent = '';

  if (t.type==='prop'){
    cardPrice.textContent = fmtMoney(t.price);
    const rent0 = t.baseRent ?? Math.round((t.price||0)*0.3);
    cardRent.textContent  = fmtMoney(rent0);
    const roi = Math.round((rent0/t.price)*1000)/10;
    cardRoi.textContent = `${isFinite(roi)?roi:0}% por caída`;
  } else {
    cardPrice.textContent = cardRent.textContent = cardRoi.textContent = '—';
  }

  // tabla rentas
  rentsBox.innerHTML = '';
  if (t.type==='prop'){
    const model = buildRentModel(t);
    const table = document.createElement('table');
    table.innerHTML = `
      <thead><tr><th>Nº casas</th><th>Alquiler</th></tr></thead>
      <tbody>
        ${model.map(r=>`<tr><td>${r.houses===5?'Hotel':r.houses}</td><td style="text-align:right">${fmtMoney(r.rent)}</td></tr>`).join('')}
      </tbody>`;
    rentsBox.appendChild(table);

    bankWarn.className = 'muted';
    bankWarn.textContent = t.mortgaged ? 'Hipotecada: no cobra alquiler.' : '';
  } else {
    bankWarn.textContent = '';
  }

  startAuctionBtn.style.display = (canAuction && t.type==='prop' && t.owner===null) ? 'inline-block' : 'none';

  overlay.style.display = 'flex';
}
window.showCard = showCard;
cancelAuctionBtn.onclick = ()=>{ overlay.style.display='none'; state.pendingTile=null; };

/* ===== Arranque mínimo + UI hook ===== */
