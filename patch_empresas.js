const fs = require('fs');
let html = fs.readFileSync('empresas.html', 'utf8');

const validationRegex = /if \(ua\.role !== dbUser\.rol\) \{[\s\S]*?\}\s*\}/;
const validationReplacement = `let updated = false;
                        if (ua.role !== dbUser.rol) {
                            ua.role = dbUser.rol;
                            updated = true;
                        }
                        if (ua.empresa !== dbUser.empresa) {
                            ua.empresa = dbUser.empresa;
                            updated = true;
                        }
                        if (updated) {
                            const cacheLocation = localStorage.getItem('userAccount') ? 'localStorage' : 'sessionStorage';
                            window[cacheLocation].setItem('userAccount', JSON.stringify(ua));
                        }`;
html = html.replace(validationRegex, validationReplacement);

const filterRegex = /if \(userAccount\.role === 'SUPER_ADMINISTRADOR'\) \{[\s\S]*?\}\s*\} else \{/m;
const filterReplacement = `if (userAccount.role === 'SUPER_ADMINISTRADOR') {
                            companies = allCompanies;
                        } else {
                            companies = allCompanies.filter(c => c.name && userAccount.empresa && c.name.toLowerCase().trim() === userAccount.empresa.toLowerCase().trim());
                            if (userAccount.empresa && companies.length === 0) {
                                companies.push({
                                    id: 'dynamic-' + Date.now(),
                                    name: userAccount.empresa,
                                    location: 'Pendiente',
                                    image: 'https://i.postimg.cc/fbwgkrDd/r-ciien.png',
                                    code: 'NEW',
                                    configUrl: 'portal-config.json'
                                });
                            }
                        }
                    } else {`;
html = html.replace(filterRegex, filterReplacement);

fs.writeFileSync('empresas.html', html);
console.log('patched empresas.html');
