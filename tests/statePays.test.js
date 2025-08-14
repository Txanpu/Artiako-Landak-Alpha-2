const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('node:vm');

test('Estado solo paga lo que tiene', () => {
  const code = fs.readFileSync(require.resolve('../js/v20-part4.js'), 'utf8');
  const sandbox = {
    document: {
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      getElementById: () => null
    },
    log: () => {},
    renderPlayers: () => {},
    TILES: [],
    Estado: { money: 50 },
    fmtMoney: x => String(x),
    addEventListener: () => {}
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const player = { money: 0, name: 'P' };
  sandbox.transfer(sandbox.Estado, player, 100, { taxable:false });
  assert.strictEqual(player.money, 50);
  assert.strictEqual(sandbox.Estado.money, 0);
});
