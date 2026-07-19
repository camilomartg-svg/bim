const fs = require('fs');
let html = fs.readFileSync('inse.html', 'utf8');

const buttonRegex = /<div class="mt-2 flex justify-end">[\s\S]*?<button type="button" onclick="showCreateCompanyForm\(document\.getElementById\('reg-organization-search'\)\.value\)"[\s\S]*?Registrar nueva empresa\s*<\/button>\s*<\/div>/m;
html = html.replace(buttonRegex, '');

fs.writeFileSync('inse.html', html);
console.log('Removed inline button');
