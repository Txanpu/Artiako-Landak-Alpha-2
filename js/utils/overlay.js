(function(global){
  function overlay(text='', opts={}){
    const { id, closeOnClick=false, duration=0 } = opts;
    const el = document.createElement('div');
    if (id) el.id = id;
    Object.assign(el.style, {
      position:'fixed', inset:'0', background:'rgba(0,0,0,.6)',
      color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:99999, fontFamily:'system-ui, sans-serif', fontSize:'20px'
    });
    el.textContent = text;
    document.body.appendChild(el);
    let intervalId = null;
    if (duration > 0) {
      const start = Date.now();
      intervalId = setInterval(()=>{
        if (Date.now() - start >= duration) unmount();
      }, 200);
    }
    const handler = (ev)=>{ if(ev.key==='Escape') unmount(); };
    document.addEventListener('keydown', handler);
    function unmount(){
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('keydown', handler);
      el.remove();
    }
    if (closeOnClick) el.addEventListener('click', unmount);
    return unmount;
  }
  const api = { overlay };
  global.utils = Object.assign(global.utils || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
