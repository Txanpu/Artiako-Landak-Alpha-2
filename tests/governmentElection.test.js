const test = require('node:test');
const assert = require('node:assert');

global.window = { RolesConfig: { ui: { banner: false } } };
global.document = { addEventListener: () => {} };
global.localStorage = { setItem: () => {}, getItem: () => null };

require('../js/v22_roles_politics.js');
const Roles = global.window.Roles;

test('government election selects majority vote', () => {
  let i = 0;
  window.prompt = () => ['left', 'right', 'left'][i++];
  Roles.assign([{id:1},{id:2},{id:3}]);
  assert.strictEqual(Roles.getGovernment(), 'left');
});

test('government election tie resolved randomly', () => {
  let i = 0;
  window.prompt = () => ['left', 'right'][i++];
  const origRandom = Math.random;
  Math.random = () => 0;
  Roles.assign([{id:1},{id:2}]);
  assert.strictEqual(Roles.getGovernment(), 'left');
  i = 0;
  window.prompt = () => ['left', 'right'][i++];
  Math.random = () => 0.9;
  Roles.openGovernmentElection();
  assert.strictEqual(Roles.getGovernment(), 'right');
  Math.random = origRandom;
});
