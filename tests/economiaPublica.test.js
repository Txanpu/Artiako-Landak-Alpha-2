const test = require('node:test');
const assert = require('node:assert');
const { EstadoEconomico } = require('../js/utils/economiaPublica.js');

test('recaudar y gastar comparten la misma bolsa', () => {
  const e = new EstadoEconomico(100);
  e.recaudar(50);
  const ok = e.gastar(30);
  assert.strictEqual(ok, true);
  assert.strictEqual(e.fondos, 120);
});

test('ejecutarEvento ajusta fondos y suerte', () => {
  const e = new EstadoEconomico(200);
  e.ejecutarEvento({ costo: 40, beneficio: 10, efectoSuerte: 5, descripcion: 'Prueba' });
  assert.strictEqual(e.fondos, 170);
  assert.strictEqual(e.suerte, 5);
  assert.deepStrictEqual(e.eventos, ['Prueba']);
});
