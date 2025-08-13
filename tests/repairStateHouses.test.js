const test = require('node:test');
const assert = require('node:assert');

require('../js/utils/core.js');
const { repairState } = require('../js/utils/state_sanitize.js');

test('repairState clamps houses to 5', () => {
  const state = { players: [{ money: 0, pos: 0 }] };
  const tiles = [{ owner: 0, houses: 99, basePrice: 100, housePrice: 50 }];
  repairState(state, tiles);
  assert.strictEqual(tiles[0].houses, 5);
});
