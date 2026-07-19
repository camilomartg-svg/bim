const fs = require('fs');
let html = fs.readFileSync('inse.html', 'utf8');

// 1. Remove the 'Crear empresa' from dropdown
const dropdownRegex = /\/\/ Add 'Crear empresa' option at the end[\s\S]*?orgResults\.appendChild\(createDiv\);/m;
html = html.replace(dropdownRegex, '');

// 2. Remove 'required' and asterisk from organization input
html = html.replace('<label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Organización a la que pertenece <span class="text-red-500">*</span></label>', '<label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Organización a la que pertenece <span class="text-gray-400 font-normal">(Opcional)</span></label>');
html = html.replace('<input type="text" id="reg-organization-search" required placeholder="Busca tu empresa..."', '<input type="text" id="reg-organization-search" placeholder="Busca tu empresa..."');

// 3. Fix handleCompleteRegistration to use ADMINISTRADOR_EMPRESA
const oldFetch = `body: JSON.stringify({ 
                        nombre: name, 
                        email: email, 
                        telefono: phone,
                        empresa: document.getElementById('reg-organization-search').value,
                        especialidad: '',
                        cargo: '',
                        rol: 'INVITADO',
                        estado: 'PENDIENTE'
                    })`;
const newFetch = `body: JSON.stringify({ 
                        nombre: name, 
                        email: email, 
                        telefono: phone,
                        empresa: document.getElementById('reg-organization-search').value,
                        especialidad: '',
                        cargo: '',
                        rol: (window.newCompanyData && document.getElementById('reg-organization-search').value === window.newCompanyData.name) ? 'ADMINISTRADOR_EMPRESA' : 'INVITADO',
                        estado: (window.newCompanyData && document.getElementById('reg-organization-search').value === window.newCompanyData.name) ? 'APROBADO' : 'PENDIENTE'
                    })`;
html = html.replace(oldFetch, newFetch);

// Fix the role in localStorage
const oldRole = `role: 'INVITADO',`;
const newRole = `role: (window.newCompanyData && document.getElementById('reg-organization-search').value === window.newCompanyData.name) ? 'ADMINISTRADOR_EMPRESA' : 'INVITADO',`;
html = html.replace(oldRole, newRole);

fs.writeFileSync('inse.html', html);
console.log('patched inse.html with requested fixes');
