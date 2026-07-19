const fs = require('fs');
let html = fs.readFileSync('inse.html', 'utf8');

const regex = /\/\/ Post to Google Apps Script\s+await fetch\(NEW_REGISTRATION_SCRIPT, \{[\s\S]*?body: JSON\.stringify\(\{[\s\S]*?\}\)\s*\}\);/m;

const replacement = `// Post to Google Apps Script para crear empresa si aplica
                if (window.newCompanyData && document.getElementById('reg-organization-search').value === window.newCompanyData.name) {
                    await fetch(NEW_REGISTRATION_SCRIPT, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(Object.assign({ action: 'createCompany' }, window.newCompanyData))
                    });
                }
                
                // Post to Google Apps Script para crear usuario
                await fetch(NEW_REGISTRATION_SCRIPT, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: 'createUser',
                        nombre: name, 
                        email: email, 
                        telefono: phone,
                        empresa: document.getElementById('reg-organization-search').value,
                        especialidad: '',
                        cargo: '',
                        rol: (window.newCompanyData && document.getElementById('reg-organization-search').value === window.newCompanyData.name) ? 'ADMINISTRADOR_EMPRESA' : 'INVITADO',
                        estado: (window.newCompanyData && document.getElementById('reg-organization-search').value === window.newCompanyData.name) ? 'APROBADO' : 'PENDIENTE'
                    })
                });`;

html = html.replace(regex, replacement);
fs.writeFileSync('inse.html', html);
console.log('patched inse.html successfully');
