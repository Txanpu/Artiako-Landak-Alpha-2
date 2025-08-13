(function(global){
  function makeHistory(max=30){
    const stack=[]; let idx=-1;
    return {
      snapshot(state){
        const snap = structuredClone(state);
        stack.splice(idx+1);
        stack.push(snap);
        if (stack.length>max) { stack.shift(); } else { idx++; }
      },
      canUndo(){ return idx>0; },
      canRedo(){ return idx < stack.length-1; },
      undo(){ if (idx>0) return structuredClone(stack[--idx]); },
      redo(){ if (idx<stack.length-1) return structuredClone(stack[++idx]); },
      peek(){ return structuredClone(stack[idx]); }
    };
  }

  function withTransaction(history, state, fn){
    history.snapshot(state);
    try {
      fn();
      return { ok:true };
    } catch(e){
      const prev = history.undo();
      Object.assign(state, prev);
      return { ok:false, error:e };
    }
  }

  const api = { makeHistory, withTransaction };
  global.utils = Object.assign(global.utils || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
