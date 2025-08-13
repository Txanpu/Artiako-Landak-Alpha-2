(function(global){
  /**
   * Enable toggling of the "overlay" element via keyboard.
   * @param {string} [toggleKey="F2"] - Key that triggers overlay visibility.
   */
  function initOverlay(toggleKey = 'F2'){
    const overlay = document.getElementById('overlay');
    if (!overlay) return;
    document.addEventListener('keydown', (ev)=>{
      if (ev.key === toggleKey){
        overlay.style.display = overlay.style.display === 'none' ? 'flex' : 'none';
      }
    });
  }

  const api = { initOverlay };
  global.utils = Object.assign(global.utils || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
