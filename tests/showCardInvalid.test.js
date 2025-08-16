const test = require('node:test');
const assert = require('node:assert');

test('showCard handles invalid tile index gracefully', () => {
  // Minimal window/document stubs required by the module
  global.window = {
    addEventListener: () => {},
    dispatchEvent: () => {}
  };
  global.document = {
    addEventListener: () => {},
    getElementById: () => null
  };

  // Load the module which defines window.showCard
  require('../js/v20-part3.js');

  assert.doesNotThrow(() => {
    window.showCard(9999);
  });

  // cleanup globals to not affect other tests
  delete global.window;
  delete global.document;
});
