const fs = require('fs');
let html = fs.readFileSync('inse.html', 'utf8');

const regex = /try\s*\{\s*const res = await fetch\('empresas\.json'\);\s*const empresasJson = await res\.json\(\);\s*empresasDisponibles = empresasJson\.map\(e => e\.name\);\s*\}\s*catch\(e\)\s*\{\s*console\.warn\("No se pudo cargar empresas\.json para autocomplete"\);\s*\}/m;

const replacement = `try {
                const res = await fetch(NEW_REGISTRATION_SCRIPT + '?action=getCompanies');
                const empresasJson = await res.json();
                empresasDisponibles = empresasJson.map(e => e.name);
            } catch(e) {
                console.warn("No se pudo cargar empresas desde Google Apps Script para autocomplete");
            }`;

html = html.replace(regex, replacement);
fs.writeFileSync('inse.html', html);
console.log('patched autocomplete in inse.html');
