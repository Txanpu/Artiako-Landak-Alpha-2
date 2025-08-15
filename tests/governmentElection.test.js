const test = require('node:test');
const assert = require('node:assert');

global.window = { RolesConfig: { ui: { banner: false } } };
global.document = { addEventListener: () => {} };
global.localStorage = { setItem: () => {}, getItem: () => null };

require('../js/v22_roles_politics.js');
const Roles = global.window.Roles;

test('government election selects majority vote', async () => {
  let i = 0;
  window.promptChoice = async () => ['left', 'right', 'left'][i++];
  await Roles.assign([{id:1},{id:2},{id:3}]);
  assert.strictEqual(Roles.getGovernment(), 'left');
});

test('government election tie resolved randomly', async () => {
  let i = 0;
  window.promptChoice = async () => ['left', 'right'][i++];
  const origRandom = Math.random;
  Math.random = () => 0;
  await Roles.assign([{id:1},{id:2}]);
  assert.strictEqual(Roles.getGovernment(), 'left');
  i = 0;
  window.promptChoice = async () => ['left', 'right'][i++];
  Math.random = () => 0.9;
  await Roles.openGovernmentElection();
  assert.strictEqual(Roles.getGovernment(), 'right');
  Math.random = origRandom;
});

test('automatic government election occurs every 7 ticks', async () => {
  const origRandom = Math.random;
  Math.random = () => 0.5;
  const votes = ['left', 'left', 'right', 'right', 'right', 'left'];
  let i = 0;
  window.promptChoice = async () => votes[i++];
  await Roles.assign([{id:1},{id:2},{id:3}]);
  assert.strictEqual(Roles.getGovernment(), 'left');
  for (let t = 0; t < 7; t++) {
    Roles.tickTurn();
    await new Promise(r => setImmediate(r));
  }
  assert.strictEqual(Roles.getGovernment(), 'right');
  Math.random = origRandom;
});
