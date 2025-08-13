const fs = require('fs');
const path = require('path');

const files = [
  'js/v20-part2.js',
  'js/v20-part3.js',
  'js/v20-part4.js',
  'js/v20-part5.js',
  'js/v20-part6.js',
  'js/auction+debt-market-v21.js',
  'js/v21_extras_bundles_bots.js',
  'js/v21_securitization.js',
  'js/v21_risk_insider_bots_maint.js',
  'js/v21_ui_graphics.js',
  'js/v20-casino-ani.js',
  'js/v20-part7.js',
  'js/v20-part8.js',
  'js/v22_roles_politics.js',
  'js/v20-rename.js',
  'js/v20-debug.js'
];

const outFile = path.join('dist', 'bundle.js');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
const out = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
fs.writeFileSync(outFile, out);
console.log(`Bundled ${files.length} files into ${outFile}`);
