const fs = require('fs');
let html = fs.readFileSync('inse.html', 'utf8');
if (!html.includes("sessionStorage.removeItem('cachedCompanies_v2')")) {
    html = html.replace('alert("¡Registro completado exitosamente!");', 'sessionStorage.removeItem(\'cachedCompanies_v2\'); alert("¡Registro completado exitosamente!");');
    fs.writeFileSync('inse.html', html);
}
