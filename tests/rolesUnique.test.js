const test = require('node:test');
const assert = require('node:assert');

global.window = { RolesConfig: { ui: { banner: false } } };
global.document = { addEventListener: () => {} };
global.localStorage = { setItem: () => {}, getItem: () => null };

require('../js/v22_roles_politics.js');
const Roles = global.window.Roles;

// Ensure all special roles are unique when assigned
 test('assign no dup roles', () => {
  window.RolesConfig.roleProbability = 1;
  Roles.assign([{id:1},{id:2},{id:3},{id:4}]);
  const roles = Roles.listAssignments().map(r => r.role).filter(r => r !== 'civil');
  const unique = new Set(roles);
  assert.strictEqual(roles.length, unique.size);
});

// Setting a role to a player should clear it from others
 test('setRole removes duplicate', () => {
  Roles.assign([{id:1},{id:2}]);
  Roles.setRole(1, 'proxeneta');
  Roles.setRole(2, 'proxeneta');
  const list = Roles.listAssignments();
  const prox = list.filter(r => r.role === 'proxeneta');
  assert.strictEqual(prox.length, 1);
});
