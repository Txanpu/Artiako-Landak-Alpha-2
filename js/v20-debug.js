
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
    'background:#fff','cursor:pointer','box-shadow:0 2px 8px rgba(0,0,0,.15)'].join(';');

  const card = el('div', { id:'debugCard' });
  card.style.cssText = [
    'display:none','margin-top:8px','width:320px','max-height:55vh','overflow:auto',
    'background:#fff','border:1px solid #ccc','border-radius:12px','padding:8px',
    'box-shadow:0 12px 28px rgba(0,0,0,.25)'].join(';');

  const tabs = el('div', { className:'tabs' });
  const tabState = el('button', { textContent:'State' });
  const tabLog   = el('button', { textContent:'Log' });
  [tabState, tabLog].forEach(b => b.style.cssText='margin-right:6px;padding:4px 8px;border:1px solid #ddd;background:#f8fafc;border-radius:8px;cursor:pointer');
  const secState = el('div'); const secLog = el('div'); secLog.style.display = 'none';

  const grid = el('div'); grid.style.cssText='display:grid;grid-template-columns:110px 1fr;gap:4px 8px;margin-top:6px';
  function row(k,v){ const a=el('div',{textContent:k,style:'color:#555'}), b=el('div',{textContent:v||''}); grid.append(a,b); }
  const actions = el('div'); actions.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-top:8px';
  function action(label, fn){ const b=el('button',{textContent:label}); b.style.cssText='padding:4px 8px;border:1px solid #ddd;background:#eef;border-radius:8px;cursor:pointer'; b.onclick=fn; actions.appendChild(b); return b; }

  const logBox = el('div'); logBox.style.cssText='margin-top:8px;border:1px solid #eee;background:#0a0a0a;color:#e5e7eb;border-radius:8px;padding:6px;min-height:140px;white-space:pre-wrap';

  secState.appendChild(grid); secState.appendChild(actions);
  secLog.appendChild(logBox);

  tabs.append(tabState, tabLog);
  card.appendChild(tabs);
  card.appendChild(secState);
  card.appendChild(secLog);
  panel.appendChild(toggleBtn);
  panel.appendChild(card);
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(panel));

  function selectTab(which){
    if (which==='log'){ secState.style.display='none'; secLog.style.display='block'; tabLog.style.background='#fff'; tabState.style.background='#f8fafc'; }
    else { secState.style.display='block'; secLog.style.display='none'; tabState.style.background='#fff'; tabLog.style.background='#f8fafc'; }
  }
  tabState.onclick = () => selectTab('state');
  tabLog.onclick   = () => selectTab('log');

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
  setInterval(()=>{ if (DBG.enabled) render(); }, 500);

  // Start open if env says so
  document.addEventListener('DOMContentLoaded', ()=>{
    DBG.enabled = enabledFromEnv();
    card.style.display = DBG.enabled ? 'block' : 'none';
    toggleBtn.style.background = DBG.enabled ? '#ffe8a3' : '#fff';
    if (DBG.enabled) render();
  });

})();
