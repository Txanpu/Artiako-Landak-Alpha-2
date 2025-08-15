(function(global){
  const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

  function createLogger(consoleObj = console, level = process.env.LOG_LEVEL || 'info'){
    let current = LEVELS[level] ?? LEVELS.info;
    function setLevel(l){
      if(!(l in LEVELS)) throw new Error('invalid level');
      current = LEVELS[l];
    }
    function should(level){
      return LEVELS[level] >= current;
    }
    function debug(...args){ if(should('debug')) consoleObj.debug(...args); }
    function info(...args){ if(should('info')) consoleObj.info(...args); }
    function warn(...args){ if(should('warn')) consoleObj.warn(...args); }
    function error(...args){ if(should('error')) consoleObj.error(...args); }
    return { setLevel, debug, info, warn, error };
  }

  const api = createLogger();
  api.createLogger = createLogger;
  global.utils = Object.assign(global.utils || {}, { logger: api });
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
