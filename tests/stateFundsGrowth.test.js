const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');

async function runScenario(vote, ticks, startMoney = 100) {
  const code = fs.readFileSync(require.resolve('../js/v22_roles_politics.js'), 'utf8');
  const sandbox = {
    window: { RolesConfig: { ui: { banner: false } } },
    document: { addEventListener: () => {} },
    localStorage: { setItem: () => {}, getItem: () => null },
    Estado: { money: startMoney }
  };
  sandbox.Math = Object.create(Math);
  sandbox.Math.random = () => 0.5;
  sandbox.window.promptChoice = async () => vote;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const Roles = sandbox.window.Roles;
  await Roles.assign([{ id: 1 }]);
  for (let i = 0; i < ticks; i++) {
    Roles.tickTurn();
  }
  return sandbox.Estado.money;
}

test('state funds evolve with government type', async () => {
  assert.strictEqual(await runScenario('left', 1, 100), 103);
  assert.strictEqual(await runScenario('right', 1, 100), 103);
  assert.strictEqual(await runScenario('authoritarian', 3, 100), 150);
  assert.strictEqual(await runScenario('anarchy', 1, 100), 100);
});
