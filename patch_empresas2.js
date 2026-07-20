const fs = require('fs');
let html = fs.readFileSync('empresas.html', 'utf8');

const regex = /<script>\s*document\.addEventListener\('DOMContentLoaded', async \(\) => \{([\s\S]*?)<\/script>/;

const scriptCode = `
            const container = document.getElementById('scroll-container');
            const list = document.getElementById('companies-list');
            const countEl = document.getElementById('company-count');
            const cursor = document.getElementById('custom-cursor');
            const authContainer = document.getElementById('auth-container');
            const superAdminLink = document.getElementById('super-admin-link');

            let userAccount = null;
            try {
                userAccount = JSON.parse(sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount'));
            } catch(e) {
                console.error('Error parsing user account:', e);
            }

            let companies = [];
            
            try {
                const url = 'https://script.google.com/macros/s/AKfycbzdclwrLaL7k30waIlgoWhQMc4toeaomWFeHBXi5HLhnfPPrpHJFIOSveGa_oavtmqV5w/exec';
                
                // Fetch ALL companies and users concurrently for max speed
                const [compRes, userRes] = await Promise.all([
                    fetch(url + '?action=getCompanies'),
                    fetch(url)
                ]);
                
                const allCompanies = await compRes.json();
                const users = await userRes.json();

                // Validate and update User
                if (userAccount && userAccount.username) {
                    if (userAccount.username === 'imagina3ddesign@gmail.com' && userAccount.role === 'SUPER_ADMINISTRADOR') {
                        // Bypass validation for the hardcoded super admin
                    } else {
                        const dbUser = users.find(u => u.email === userAccount.username.toLowerCase().trim());
                        if (!dbUser || (dbUser.estado !== 'APROBADO' && dbUser.rol !== 'SUPER_ADMINISTRADOR')) {
                            alert('Tu acceso ha sido revocado o está pendiente. Cerrando sesión.');
                            sessionStorage.removeItem('userAccount');
                            localStorage.removeItem('userAccount');
                            window.location.replace('https://norabim.com/inse.html');
                            return; // Stop execution
                        } else {
                            // Use fresh DB user data
                            userAccount.role = dbUser.rol;
                            userAccount.empresa = dbUser.empresa;
                            
                            // Update cache
                            const cacheLocation = localStorage.getItem('userAccount') ? 'localStorage' : 'sessionStorage';
                            window[cacheLocation].setItem('userAccount', JSON.stringify(userAccount));
                        }
                    }
                }

                // Render Auth UI
                if (userAccount) {
                    authContainer.innerHTML = \`
                    <span class="text-[10px] uppercase tracking-wider font-medium text-text-light dark:text-white">Hola, \${userAccount.name.split(' ')[0]}</span>
                    <button id="logout-button" class="text-text-light dark:text-white hover:text-primary text-[10px] uppercase tracking-wider font-medium">Cerrar sesión</button>
                    \`;
                    document.getElementById('logout-button').addEventListener('click', () => {
                        sessionStorage.removeItem('userAccount');
                        localStorage.removeItem('userAccount');
                        window.location.reload();
                    });

                    // UNHIDE SUPER ADMIN LINK
                    if (userAccount.role === 'SUPER_ADMINISTRADOR') {
                        if (superAdminLink) superAdminLink.classList.remove('hidden');
                        
                        // Delete duplicate companies to avoid visual spam (Group by exact name)
                        const uniqueCompaniesMap = new Map();
                        allCompanies.forEach(c => {
                            if (!uniqueCompaniesMap.has(c.name)) {
                                uniqueCompaniesMap.set(c.name, c);
                            }
                        });
                        const uniqueCompanies = Array.from(uniqueCompaniesMap.values());

                        companies = uniqueCompanies.map(c => ({
                            id: c.id || 'company-' + Date.now(),
                            name: c.name || c.legalName,
                            location: c.city ? c.city + ', ' + c.country : 'Sede Principal',
                            image: c.logoBase64 || 'https://i.postimg.cc/fbwgkrDd/r-ciien.png',
                            code: (c.name ? c.name.substring(0,3).toUpperCase() : 'BIM'),
                            configUrl: 'portal-config.json'
                        }));
                    } else {
                        // Filter for user's company
                        const myComp = allCompanies.find(c => c.name && userAccount.empresa && c.name.toLowerCase().trim() === userAccount.empresa.toLowerCase().trim());
                        if (myComp) {
                            companies.push({
                                id: myComp.id || 'company-' + Date.now(),
                                name: myComp.name,
                                location: myComp.city ? myComp.city + ', ' + myComp.country : 'Sede Principal',
                                image: myComp.logoBase64 || 'https://i.postimg.cc/fbwgkrDd/r-ciien.png',
                                code: (myComp.name ? myComp.name.substring(0,3).toUpperCase() : 'BIM'),
                                configUrl: 'portal-config.json'
                            });
                        } else if (userAccount.empresa) {
                            // If company doesn't exist in DB but user has it (fallback)
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
                }
            } catch(e) {
                console.error('Failed to load companies:', e);
            }

            countEl.textContent = \`(\${companies.length})\`;

            if (companies.length === 0) {
                list.innerHTML = \`
                    <div class="flex flex-col items-center justify-center w-full h-full text-center p-12 mx-auto" style="width: 100%;">
                        <span class="material-symbols-outlined text-4xl text-gray-400 mb-4">domain_disabled</span>
                        <h3 class="text-lg font-medium text-gray-900 mb-2">Sin Empresas Asignadas</h3>
                        <p class="text-sm text-gray-500 max-w-sm">Tu cuenta fue creada exitosamente, pero aún no has sido asignado a ninguna empresa o proyecto. Por favor contacta al administrador.</p>
                    </div>
                \`;
            } else {
                list.innerHTML = companies.map(c => \`
                    <a href="home.html?empresa=\${c.id}" class="card-hover flex-none w-[260px] md:w-[320px] lg:w-[360px] group transition-transform duration-500 block">
                        <div class="flex justify-between items-end mb-4 border-b border-gray-300 pb-2">
                            <div class="flex flex-col">
                                <span class="text-[9px] font-bold text-gray-400 mb-1">\${c.code}</span>
                                <span class="text-xs font-bold uppercase tracking-wider text-gray-800">\${c.name}</span>
                            </div>
                            <span class="text-[9px] font-semibold text-gray-500 uppercase tracking-widest text-right">\${c.location}</span>
                        </div>
                        <div class="w-full aspect-[4/5] bg-gray-200 overflow-hidden relative">
                            <div class="w-full h-full card-image-wrapper">
                                <img src="\${c.image}" alt="\${c.name}" class="w-full h-full object-cover filter brightness-95 contrast-105" />
                            </div>
                        </div>
                    </a>
                \`).join('');
            }

            let isDown = false;
            let startX;
            let scrollLeft;

            container.addEventListener('mousedown', (e) => {
                isDown = true;
                startX = e.pageX - container.offsetLeft;
                scrollLeft = container.scrollLeft;
            });
            container.addEventListener('mouseleave', () => {
                isDown = false;
                cursor.style.opacity = '0';
            });
            container.addEventListener('mouseup', () => {
                isDown = false;
            });
            container.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - container.offsetLeft;
                const walk = (x - startX) * 2;
                container.scrollLeft = scrollLeft - walk;
            });

            document.addEventListener('mousemove', (e) => {
                const rect = container.getBoundingClientRect();
                const isHoveringContainer = (
                    e.clientY >= rect.top &&
                    e.clientY <= rect.bottom
                );
                if (isHoveringContainer) {
                    cursor.style.opacity = '1';
                    cursor.style.left = e.clientX + 'px';
                    cursor.style.top = e.clientY + 'px';
                } else {
                    cursor.style.opacity = '0';
                }
            });
            
            const links = document.querySelectorAll('.card-hover');
            links.forEach(l => {
                l.addEventListener('mouseenter', () => cursor.style.opacity = '0');
                l.addEventListener('mouseleave', () => cursor.style.opacity = '1');
            });
`;

// Syntax validation
try {
    new Function('async function test() { ' + scriptCode + ' }');
    console.log('Syntax is VALID!');
} catch (e) {
    console.error('SYNTAX ERROR:', e);
    process.exit(1);
}

const newScript = '<script>\n        document.addEventListener(\'DOMContentLoaded\', async () => {\n' + scriptCode + '\n        });\n    </script>';
html = html.replace(regex, newScript);
fs.writeFileSync('empresas.html', html);
console.log('File written!');
