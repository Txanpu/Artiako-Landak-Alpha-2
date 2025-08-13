const test = require('node:test');
const assert = require('node:assert');

const { repairProps } = require('../utils/repair_props.js');

test('refund houses on mortgaged properties', () => {
  const state = { players:[{money:100}] };
  const tiles = [{ owner:0, mortgaged:true, houses:2, housePrice:30 }];
  const events = repairProps(state, tiles, ()=>{});
  assert.strictEqual(state.players[0].money, 160);
  assert.strictEqual(tiles[0].houses, 0);
  assert.deepStrictEqual(events, [{ index:0, refund:60 }]);
});

