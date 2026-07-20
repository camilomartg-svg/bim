const fs = require('fs');
let html = fs.readFileSync('super-admin.html', 'utf8');

// 1. Add Favicon
html = html.replace('<meta charset="utf-8" />', '<meta charset="utf-8" />\n  <link rel="icon" type="image/png" href="https://i.postimg.cc/tR3YSryT/LOGO-NORA-NEGRO.png">');

// 2. Change text
html = html.replace('Aquí puedes gestionar los proyectos asociados a esta empresa. Para configuraciones avanzadas de un proyecto, usa el Configurador del CDE.', 'Haz clic sobre un proyecto para desplegar sus configuraciones avanzadas.');

// 3. Cache buster
html = html.replace('<script src="super-admin.js"></script>', '<script>\n    document.write(\'<script src="super-admin.js?v=\' + Date.now() + \'"><\\/script>\');\n  </script>');

fs.writeFileSync('super-admin.html', html, 'utf8');
