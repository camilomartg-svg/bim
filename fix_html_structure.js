const fs = require('fs');
let html = fs.readFileSync('super-admin.html', 'utf8');

const searchBlock = `  </script>
      </div>
    <!-- FIN CONTENEDOR PRINCIPAL -->`;

if (html.includes(searchBlock)) {
    html = html.replace(searchBlock, `  </script>
    <!-- FIN CONTENEDOR PRINCIPAL -->`);
    console.log('Removed stray closing div');
}

html = html.replace(`<script src="super-admin.js?v=7"></script>`, `  </div>
<script src="super-admin.js?v=7"></script>`);
console.log('Added closing div at the end');

fs.writeFileSync('super-admin.html', html);
