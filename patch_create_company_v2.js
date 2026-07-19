const fs = require('fs');
let html = fs.readFileSync('inse.html', 'utf8');

const target = /<p class="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">\s*¿No tienes una cuenta\? <a href="#" id="register-link" onclick="showRegistrationForm\(null\); return false;" class="font-semibold text-primary dark:text-white hover:underline">Regístrate<\/a>\s*<\/p>/;

const replacement = `<p class="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    ¿No tienes una cuenta? <a href="#" id="register-link" onclick="showRegistrationForm(null); return false;" class="font-semibold text-primary dark:text-white hover:underline">Regístrate</a>
                </p>
                <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 text-center">
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                        ¿Quieres usar nora para tu organización?
                    </p>
                    <button onclick="showCreateCompanyForm('')" class="mt-4 w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-2.5 px-4 rounded-lg shadow-md hover:bg-slate-800 dark:hover:bg-gray-200 transition duration-300">
                        <span class="material-symbols-outlined text-sm">domain_add</span>
                        Registrar Nueva Empresa
                    </button>
                </div>`;

html = html.replace(target, replacement);

fs.writeFileSync('inse.html', html);
console.log('Successfully replaced footer in inse.html');
