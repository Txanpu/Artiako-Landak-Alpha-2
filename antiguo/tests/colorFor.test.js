const test = require('node:test');
const assert = require('node:assert');

global.window = {};
global.document = { addEventListener: () => {} };

require('../js/v20-part2.js');
const { colorFor } = global.window.BoardUI;

test('colorFor devuelve gris por defecto cuando falta color', () => {
  assert.strictEqual(colorFor({}), '#475569');
});

test('colorFor devuelve el color correcto para casillas rojas', () => {
  assert.strictEqual(colorFor({ color: 'red' }), '#ef4444');
});
