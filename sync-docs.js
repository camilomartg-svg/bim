const fs = require('fs');
const path = require('path');

const filesToSync = [
  'super-admin.html',
  'super-admin.js',
  'portal-configurator.js',
  'portal-configurator.html',
  'project-settings.js',
  'project-settings.html',
  'project-landing.html',
  'home.html',
  'inse.html',
  'equipo.js',
  'equipo.html',
  'empresas.html',
  'perfil.html',
  'upload.html',
  'manifest.json',
  'portal.webmanifest',
  'sw.js'
];

filesToSync.forEach(file => {
  const src = path.join(__dirname, file);
  const dest = path.join(__dirname, 'docs', file);
  
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} to docs/${file}`);
  } else {
    console.error(`Source file ${file} does not exist!`);
  }
});
