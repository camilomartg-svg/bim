const fs = require('fs');
let js = fs.readFileSync('super-admin.js', 'utf8');
js = js.replace('\\\\n    }).join(\\'\\');', '\\n    }).join(\\'\\');');
fs.writeFileSync('super-admin.js', js, 'utf8');
