const test = require('node:test');
const assert = require('node:assert');

const { createLogger } = require('../utils/logger.js');

test('logger respects log levels', () => {
  const calls = [];
  const mock = {
    debug: (...a) => calls.push(['debug', ...a]),
    info:  (...a) => calls.push(['info', ...a]),
    warn:  (...a) => calls.push(['warn', ...a]),
    error: (...a) => calls.push(['error', ...a])
  };
  const log = createLogger(mock, 'info');
  log.debug('d');
  log.info('i');
  log.setLevel('warn');
  log.info('i2');
  log.warn('w');
  log.error('e');
  assert.deepStrictEqual(calls, [ ['info','i'], ['warn','w'], ['error','e'] ]);
});
