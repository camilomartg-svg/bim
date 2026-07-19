const fs = require('fs');
let html = fs.readFileSync('inse.html', 'utf8');

// 1. Add link on main screen
const oldFooter = `<p class="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    ¿No tienes una cuenta? <a href="#" id="register-link" onclick="showRegistrationForm(null); return false;" class="font-semibold text-primary dark:text-white hover:underline">Regístrate</a>
                </p>`;

const newFooter = `<p class="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    ¿No tienes una cuenta? <a href="#" id="register-link" onclick="showRegistrationForm(null); return false;" class="font-semibold text-primary dark:text-white hover:underline">Regístrate</a>
                </p>
                <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 text-center">
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        ¿Quieres usar nora para tu organización?
                    </p>
                    <button onclick="showCreateCompanyForm('')" class="mt-2 w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-2.5 px-4 rounded-lg shadow-md hover:bg-slate-800 dark:hover:bg-gray-200 transition duration-300">
                        <span class="material-symbols-outlined text-sm">domain_add</span>
                        Registrar Nueva Empresa
                    </button>
                </div>`;

html = html.replace(oldFooter, newFooter);

// 2. Remove the inline button in registration form
const inlineBtn = `<div class="mt-2 flex justify-end">
                                        <button type="button" onclick="showCreateCompanyForm(document.getElementById('reg-organization-search').value)" class="text-xs text-primary dark:text-white font-bold hover:underline flex items-center transition-colors">
                                            <span class="material-symbols-outlined text-[16px] mr-1">add_circle</span> Registrar nueva empresa
                                        </button>
                                    </div>`;
html = html.replace(inlineBtn, '');

// 3. Remove 'Crear empresa' from dropdown
const dropdownLogic = `                    // Add 'Crear empresa' option at the end
                    const createDiv = document.createElement('div');
                    createDiv.className = 'px-4 py-3 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm font-semibold text-primary dark:text-white border-t border-gray-200 dark:border-gray-600 flex items-center';
                    createDiv.innerHTML = '<span class="material-symbols-outlined text-sm mr-2">add_circle</span> Crear empresa';
                    createDiv.onclick = () => {
                        orgResults.classList.add('hidden');
                        showCreateCompanyForm(orgSearchInput.value);
                    };
                    orgResults.appendChild(createDiv);`;
html = html.replace(dropdownLogic, '');

// 4. Update showCreateCompanyForm
const oldShow = `        window.showCreateCompanyForm = function(initialName = '') {
            document.getElementById('registration-section').classList.add('hidden');
            document.getElementById('create-company-section').classList.remove('hidden');`;
const newShow = `        window.showCreateCompanyForm = function(initialName = '') {
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('registration-section').classList.add('hidden');
            document.getElementById('create-company-section').classList.remove('hidden');`;
html = html.replace(oldShow, newShow);

// 5. Update hideCreateCompanyForm to go back to login
const oldHide = `        window.hideCreateCompanyForm = function() {
            document.getElementById('create-company-section').classList.add('hidden');
            document.getElementById('registration-section').classList.remove('hidden');
        }`;
const newHide = `        window.hideCreateCompanyForm = function() {
            document.getElementById('create-company-section').classList.add('hidden');
            document.getElementById('login-section').classList.remove('hidden');
        }`;
html = html.replace(oldHide, newHide);

// 6. Update handleCreateCompany back button behavior
const oldBack = `            // Update registration form UI
            orgSearchInput.value = window.newCompanyData.name;
            orgIdInput.value = 'NEW_COMPANY';
            
            // Go back to registration
            hideCreateCompanyForm();`;
const newBack = `            // Update registration form UI
            orgSearchInput.value = window.newCompanyData.name;
            orgIdInput.value = 'NEW_COMPANY';
            
            // Continue to user registration to finish linking
            document.getElementById('create-company-section').classList.add('hidden');
            document.getElementById('registration-section').classList.remove('hidden');`;
html = html.replace(oldBack, newBack);

// 7. Update back button in create company form to say "Volver" instead of "Volver al registro"
const oldBackText = `<span class="material-symbols-outlined text-sm mr-1">arrow_back</span> Volver al registro`;
const newBackText = `<span class="material-symbols-outlined text-sm mr-1">arrow_back</span> Volver al Inicio de Sesión`;
html = html.replace(oldBackText, newBackText);

fs.writeFileSync('inse.html', html);
console.log('patched inse.html successfully');
