const fs = require('fs');
const code = fs.readFileSync('dist/assets/index-CiNSMtNb.js', 'utf8');

// Find all matches of web-ifc or wasm paths
const unpkgMatches = code.match(/https?:\/\/[^\s"'`)]*web-ifc[^\s"'`)]*/g);
console.log('Unpkg matches:', unpkgMatches);

// Search for autoSetWasm or wasm path default
const wasmMatches = code.match(/wasm\s*:\s*\{[^}]*\}/g);
console.log('wasm objects:', wasmMatches);

// Check web-ifc version strings
const versionMatches = code.match(/\d+\.\d+\.\d+/g);
console.log('Some versions:', [...new Set(versionMatches)].filter(v => v.startsWith('0.0.')));
