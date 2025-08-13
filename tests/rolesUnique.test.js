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

// Approximately 50% of players should receive a role
test('assigns ~50% roles', () => {
  window.RolesConfig.roleProbability = 0.5;
  const players = Array.from({length:8}, (_,i) => ({id:i+1}));
  Roles.assign(players);
  const assigned = Roles.listAssignments().filter(r => r.role !== 'civil');
  assert.strictEqual(assigned.length, 4);
});

// When probability allows assigning every role, all roles should appear
test('all roles present when probability is 100%', () => {
  window.RolesConfig.roleProbability = 1;
  const players = Array.from({length:4}, (_,i) => ({id:i+1}));
  Roles.assign(players);
  const roles = new Set(Roles.listAssignments().map(r => r.role));
  ['proxeneta', 'florentino', 'fbi', 'okupa'].forEach(role => {
    assert.ok(roles.has(role));
  });
});

// Role assignment should not always pick the same role when only one is needed
test('assign picks random role from pool when limited', () => {
  window.RolesConfig.roleProbability = 0.2; // 4 players -> 1 role
  const players = [{id:1},{id:2},{id:3},{id:4}];
  const origRandom = Math.random;
  Math.random = () => 0; // deterministic shuffle
  Roles.assign(players);
  Math.random = origRandom;
  const roles = Roles.listAssignments().map(r => r.role).filter(r => r !== 'civil');
  assert.strictEqual(roles.length, 1);
  // With Math.random mocked to 0, first role becomes 'florentino'
  assert.strictEqual(roles[0], 'florentino');
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
