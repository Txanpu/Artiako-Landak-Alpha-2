const test = require('node:test');
const assert = require('node:assert');

global.window = { RolesConfig: { ui: { banner: false } } };
global.document = { addEventListener: () => {} };
global.localStorage = { setItem: () => {}, getItem: () => null };

require('../js/v22_roles_politics.js');
const Roles = global.window.Roles;

// Prevent any potential prompts during tests
window.promptChoice = async () => 'left';

test('reshuffles roles every configured period', async () => {
  await Roles.assign([{id:1},{id:2}]);
  for (let i = 0; i < 19; i++) Roles.tickTurn();
  assert.strictEqual(Roles.exportState().turnCounter, 19);
  Roles.tickTurn();
  await new Promise(r => setImmediate(r));
  assert.strictEqual(Roles.exportState().turnCounter, 0);
  for (let i = 0; i < 20; i++) Roles.tickTurn();
  await new Promise(r => setImmediate(r));
  assert.strictEqual(Roles.exportState().turnCounter, 0);
});
