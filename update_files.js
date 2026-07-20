const fs = require('fs');

const oldFavicon = 'https://i.postimg.cc/tR3YSryT/LOGO-NORA-NEGRO.png';
const newFavicon = 'https://i.postimg.cc/W3trgjZX/FAVICON-NORA-NEGRO.png';

['index.html', 'home.html', 'super-admin.html'].forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // 1. Replace favicon
    content = content.replace(oldFavicon, newFavicon);

    if (file === 'index.html') {
        // 2. Fix iframe path
        content = content.replace('docs/ANIHOME/dist/index.html', 'ANIHOME/dist/index.html');
    }
    
    if (file === 'super-admin.html') {
        // 3. Fix text in super-admin
        content = content.replace('Aquí puedes gestionar los proyectos asociados a esta empresa. Para configuraciones avanzadas de un proyecto, usa el Configurador del CDE.', 'Haz clic sobre un proyecto para desplegar sus configuraciones avanzadas.');
        
        // 4. Cache buster for super-admin.js
        content = content.replace('<script src="super-admin.js"></script>', '<script>\n    document.write(\'<script src="super-admin.js?v=\' + Date.now() + \'"><\\/script>\');\n  </script>');
    }
    
    fs.writeFileSync(file, content, 'utf8');
});
