
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
