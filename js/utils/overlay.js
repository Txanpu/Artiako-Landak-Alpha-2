(function(global){
  /**
   * Enable toggling of the main overlay element via keyboard.
   * During an active auction the overlay is left untouched to
   * avoid interfering with the auction UI.
   *
   * @param {string} [toggleKey="F2"] - Key that toggles visibility.
   */
  function initOverlay(toggleKey = 'F2'){
    const overlay = global.document?.getElementById('overlay');
    if (!overlay) return;

    document.addEventListener('keydown', (ev)=>{
      if (ev.key !== toggleKey) return;
      // Do not toggle overlay while an auction is running
      if (global.state?.auction?.open) return;

      const visible = getComputedStyle(overlay).display !== 'none';
      overlay.style.display = visible ? 'none' : 'flex';
    });
  }

  const api = { initOverlay };
  global.utils = Object.assign(global.utils || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
