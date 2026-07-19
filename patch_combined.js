const fs = require('fs');
let html = fs.readFileSync('inse.html', 'utf8');

const regex = /\/\/ Post to Google Apps Script para crear empresa si aplica[\s\S]*?body: JSON\.stringify\(\{ \n\s*action: 'createUser',[\s\S]*?estado: \(window\.newCompanyData && document\.getElementById\('reg-organization-search'\)\.value === window\.newCompanyData\.name\) \? 'APROBADO' : 'PENDIENTE'\n\s*\}\)\n\s*\}\);/m;

const replacement = `// Post to Google Apps Script (crear empresa y usuario en 1 paso si aplica)
                if (window.newCompanyData && document.getElementById('reg-organization-search').value === window.newCompanyData.name) {
                    await fetch(NEW_REGISTRATION_SCRIPT, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'createUserAndCompany',
                            companyData: window.newCompanyData,
                            userData: {
                                nombre: name, 
                                email: email, 
                                telefono: phone,
                                empresa: document.getElementById('reg-organization-search').value,
                                especialidad: '',
                                cargo: '',
                                rol: 'ADMINISTRADOR_EMPRESA',
                                estado: 'APROBADO'
                            }
                        })
                    });
                } else {
                    // Solo crear usuario
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
                            rol: 'INVITADO',
                            estado: 'PENDIENTE'
                        })
                    });
                }

                // Esperar un segundo para asegurar que Google Sheets termine de procesar antes de recargar
                await new Promise(resolve => setTimeout(resolve, 1500));`;

html = html.replace(regex, replacement);
fs.writeFileSync('inse.html', html);
console.log('patched inse.html with combined action');
