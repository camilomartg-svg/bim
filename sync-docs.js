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
  'index.html',
  'inse.html',
  'equipo.js',
  'equipo.html',
  'empresas.html',
  'perfil.html',
  'upload.html',
  'manifest.json',
  'portal.webmanifest',
  'sw.js',
  'pwa-helper.js',
  'wompi-integration.js'
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

// Sync CONVERTIR_FRAG/index.html
const fragSrc = path.join(__dirname, 'CONVERTIR_FRAG', 'index.html');
const fragDest = path.join(__dirname, 'docs', 'CONVERTIR_FRAG', 'index.html');
if (fs.existsSync(fragSrc)) {
  fs.mkdirSync(path.dirname(fragDest), { recursive: true });
  fs.copyFileSync(fragSrc, fragDest);
  console.log('Copied CONVERTIR_FRAG/index.html to docs/CONVERTIR_FRAG/index.html');
}
