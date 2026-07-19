const fs = require('fs');
let html = fs.readFileSync('inse.html', 'utf8');

const newUrl = 'https://script.google.com/macros/s/AKfycbx266o-ea0OAT-xE_9kKSKChRk7MJo0sthjwWI7WUCbFzq3Y578sbD8HgZpWSb7v8H8Fw/exec';

// 1. Replace Registration Script URL (there's only one occurrence)
html = html.replace(
    /const NEW_REGISTRATION_SCRIPT = '.*?';/,
    `const NEW_REGISTRATION_SCRIPT = '${newUrl}';`
);

// 2. Replace Registration Payload
const oldFetchRegex = /await fetch\(NEW_REGISTRATION_SCRIPT,\s*\{\s*method:\s*'POST',\s*mode:\s*'no-cors',\s*headers:\s*\{\s*'Content-Type':\s*'application\/json'\s*\},\s*body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)\s*\}\);/m;

const newFetch = `await fetch(NEW_REGISTRATION_SCRIPT, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        nombre: name, 
                        email: email, 
                        telefono: phone,
                        empresa: document.getElementById('reg-organization-search').value,
                        especialidad: '',
                        cargo: '',
                        rol: 'INVITADO',
                        estado: 'PENDIENTE'
                    })
                });`;
html = html.replace(oldFetchRegex, newFetch);

// 3. Replace handleLogin Logic
const loginRegex = /const ROLES_SCRIPT_URL = '.*?';[\s\S]*?adminEmpresaId: window\.adminEmpresaId \|\| null\s*\};/m;

const newLoginLogic = `const ROLES_SCRIPT_URL = '${newUrl}';
                    const normalizedAccountEmail = account.username.trim().toLowerCase();
                    
                    let userProfile = null;
                    try {
                        const response = await fetch(ROLES_SCRIPT_URL);
                        const usersList = await response.json();
                        const dbUser = usersList.find(u => u.email === normalizedAccountEmail);
                        
                        if (!dbUser) {
                            alert('Tu correo no está registrado en el sistema. Por favor, crea una cuenta primero.');
                            sessionStorage.removeItem('userAccount');
                            localStorage.removeItem('userAccount');
                            return;
                        }
                        
                        if (dbUser.estado !== 'APROBADO' && dbUser.rol !== 'SUPER_ADMINISTRADOR') {
                            alert('Tu cuenta está en estado ' + (dbUser.estado || 'PENDIENTE') + '. Espera a que un administrador te apruebe el acceso.');
                            sessionStorage.removeItem('userAccount');
                            localStorage.removeItem('userAccount');
                            return;
                        }
                        
                        userProfile = {
                            name: dbUser.nombre || account.name,
                            username: dbUser.email,
                            role: dbUser.rol || 'INVITADO',
                            empresa: dbUser.empresa || '',
                            especialidad: dbUser.especialidad || '',
                            cargo: dbUser.cargo || '',
                            picture: window.tempGoogleUser?.picture || ''
                        };
                    } catch(e) {
                        console.error('Error de base de datos:', e);
                        alert('Error al conectar con la base de datos de usuarios.');
                        return;
                    }`;

html = html.replace(loginRegex, newLoginLogic);

fs.writeFileSync('inse.html', html);
console.log('inse.html cleanly patched');
