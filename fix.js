const fs = require('fs');
let js = fs.readFileSync('super-admin.js', 'utf8');
const badString = `\\n    }).join('');`;
const goodString = `    }).join('');`;
js = js.replace(badString, goodString);
fs.writeFileSync('super-admin.js', js, 'utf8');
