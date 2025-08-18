const test = require('node:test');
const assert = require('node:assert');

// Minimal environment stubs
global.window = { Roles: {
  triggerEvent: () => null,
  consumePendingPayments: () => [],
  consumePendingMoves: () => []
}};

global.Roles = global.window.Roles;

global.state = { players: [{ id: 1 }] };
global.Estado = {};

global.document = { getElementById: () => null };

const { resolverCarta } = require('../js/v20-part6.js');

test('resolverCarta ejecuta run por defecto si Roles no maneja', () => {
  let ran = false;
  const card = { name: 'Test', run: () => { ran = true; } };
  const player = { id: 1 };
  resolverCarta(card, player, 0);
  assert.strictEqual(ran, true);
});
