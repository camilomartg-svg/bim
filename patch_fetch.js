const fs = require('fs');
let html = fs.readFileSync('inse.html', 'utf8');

const regex = /async function fetchEmpresas\(\) \{[\s\S]*?try \{[\s\S]*?const res = await fetch\('empresas\.json'\);[\s\S]*?if\(res\.ok\) \{[\s\S]*?window\.empresasList = await res\.json\(\);[\s\S]*?\}[\s\S]*?\} catch\(e\) \{[\s\S]*?console\.error\("Error fetching empresas", e\);[\s\S]*?\}[\s\S]*?\}/m;

const replacement = `async function fetchEmpresas() {
            try {
                const res = await fetch(NEW_REGISTRATION_SCRIPT + '?action=getCompanies');
                if(res.ok) {
                    const companies = await res.json();
                    window.empresasList = companies.map(c => ({ name: c.name || c.empresa }));
                }
            } catch(e) {
                console.error("Error fetching empresas from Apps Script", e);
            }
        }`;

html = html.replace(regex, replacement);

const submitRegex = /const country = document\.getElementById\('reg-country'\)\.value;[\s\S]*?const city = document\.getElementById\('reg-city'\)\.value\.trim\(\);/;

const submitReplacement = `const country = document.getElementById('reg-country').value;
            const city = document.getElementById('reg-city').value.trim();
            const orgValue = document.getElementById('reg-organization-search').value.trim();
            
            // Validar que la empresa exista o sea nueva
            if (orgValue && (!window.newCompanyData || window.newCompanyData.name !== orgValue)) {
                if (!window.empresasList.some(e => e.name.toLowerCase() === orgValue.toLowerCase())) {
                    alert("Por favor, selecciona una empresa de la lista desplegable. Si tu empresa no existe, usa el botón 'Registrar Nueva Empresa' en la pantalla de inicio.");
                    return;
                }
            }`;

html = html.replace(submitRegex, submitReplacement);
fs.writeFileSync('inse.html', html);
console.log('patched fetchEmpresas and validation in inse.html');
