const test = require('node:test');
const assert = require('node:assert');

global.window = { RolesConfig: { ui: { banner: false } } };
global.document = { addEventListener: () => {} };
global.localStorage = { setItem: () => {}, getItem: () => null };

require('../js/v22_roles_politics.js');
const Roles = global.window.Roles;

// Evita diálogos durante las pruebas
window.promptChoice = async () => 'left';

// Ensure all special roles are unique when assigned
 test('assign no dup roles', async () => {
  window.RolesConfig.roleProbability = 1;
  await Roles.assign([{id:1},{id:2},{id:3},{id:4}]);
  const roles = Roles.listAssignments().map(r => r.role).filter(r => r !== 'civil');
  const unique = new Set(roles);
  assert.strictEqual(roles.length, unique.size);
});

// Approximately 20% of players should receive a role
test('assigns ~20% roles', async () => {
  window.RolesConfig.roleProbability = 0.2;
  const players = Array.from({length:10}, (_,i) => ({id:i+1}));
  await Roles.assign(players);
  const assigned = Roles.listAssignments().filter(r => r.role !== 'civil');
  assert.strictEqual(assigned.length, 2);
});

// When there are enough players, all roles should appear
test('all roles present with many players', async () => {
  window.RolesConfig.roleProbability = 0.2;
  const players = Array.from({length:15}, (_,i) => ({id:i+1}));
  await Roles.assign(players);
  const roles = new Set(Roles.listAssignments().map(r => r.role));
  ['proxeneta', 'florentino', 'fbi'].forEach(role => {
    assert.ok(roles.has(role));
  });
});

// Setting a role to a player should clear it from others
 test('setRole removes duplicate', async () => {
  await Roles.assign([{id:1},{id:2}]);
  Roles.setRole(1, 'proxeneta');
  Roles.setRole(2, 'proxeneta');
  const list = Roles.listAssignments();
  const prox = list.filter(r => r.role === 'proxeneta');
  assert.strictEqual(prox.length, 1);
});
