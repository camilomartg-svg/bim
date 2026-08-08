(function () {
    // --- ESTADO GLOBAL ---
    let companyId = '';
    let projectSlug = '';
    let currentCompany = null;
    let configUrl = '';
    let fullConfig = null;
    let activeProject = null;
    let allDirectoryUsers = []; // Users loaded from Google Sheets (Nora Directory)
    
    // Leaflet map vars
    let leafletMap = null;
    let mapMarker = null;

    // --- SELECCIÓN DE DOM ---
    const el = {
        backBtn: document.getElementById('back-btn'),
        themeToggle: document.getElementById('theme-toggle'),
        breadcrumbEmpresa: document.getElementById('breadcrumb-empresa'),
        breadcrumbProyecto: document.getElementById('breadcrumb-proyecto'),
        githubTokenBtn: document.getElementById('github-token-btn'),
        saveGithubBtn: document.getElementById('save-github-btn'),
        downloadJsonBtn: document.getElementById('download-json-btn'),
        copyJsonBtn: document.getElementById('copy-json-btn'),
        
        // Alert banner
        alertBanner: document.getElementById('alert-banner'),
        alertIcon: document.getElementById('alert-icon'),
        alertMessage: document.getElementById('alert-message'),
        
        // Modal PAT
        tokenModal: document.getElementById('token-modal'),
        githubPatInput: document.getElementById('github-pat-input'),

        // Inputs General
        projName: document.getElementById('proj-name'),
        projSlug: document.getElementById('proj-slug'),
        projCity: document.getElementById('proj-city'),
        projStatus: document.getElementById('proj-status'),
        projLogo: document.getElementById('proj-logo'),
        projEyebrow: document.getElementById('proj-eyebrow'),
        projTitle: document.getElementById('proj-title'),
        projSubtitle: document.getElementById('proj-subtitle'),
        projAddress: document.getElementById('proj-address'),
        projLat: document.getElementById('proj-lat'),
        projLng: document.getElementById('proj-lng'),

        // Inputs Datasources
        dsDriveFolderName: document.getElementById('ds-drive-folder-name'),
        dsDriveFolderId: document.getElementById('ds-drive-folder-id'),
        dsDriveScriptUrl: document.getElementById('ds-drive-script-url'),
        dsStatusSheetId: document.getElementById('ds-status-sheet-id'),
        dsStatusScriptUrl: document.getElementById('ds-status-script-url'),
        dsCantidadesSheetId: document.getElementById('ds-cantidades-sheet-id'),
        dsCantidadesScriptUrl: document.getElementById('ds-cantidades-script-url'),

        // Tab Members
        projectMembersCount: document.getElementById('project-members-count'),
        directorySearch: document.getElementById('directory-search'),
        directoryTableBody: document.getElementById('directory-table-body'),

        // Tab Teams
        newTeamName: document.getElementById('new-team-name'),
        addTeamBtn: document.getElementById('add-team-btn'),
        teamsContainer: document.getElementById('teams-container')
    };

    // --- ALERTS DE INTERFAZ ---
    window.showAlert = function (message, type = 'info') {
        el.alertMessage.textContent = message;
        el.alertBanner.className = "fixed bottom-6 right-6 z-50 rounded-2xl p-4 shadow-xl flex items-start gap-3 transition-all duration-300 transform translate-y-0 opacity-100 max-w-md w-full border";
        
        if (type === 'success') {
            el.alertBanner.classList.add('bg-emerald-50', 'text-emerald-800', 'border-emerald-200', 'dark:bg-emerald-950/80', 'dark:text-emerald-200', 'dark:border-emerald-800');
            el.alertIcon.textContent = 'check_circle';
        } else if (type === 'error') {
            el.alertBanner.classList.add('bg-rose-50', 'text-rose-800', 'border-rose-200', 'dark:bg-rose-950/80', 'dark:text-rose-200', 'dark:border-rose-800');
            el.alertIcon.textContent = 'error';
        } else {
            el.alertBanner.classList.add('bg-blue-50', 'text-blue-800', 'border-blue-200', 'dark:bg-slate-900/80', 'dark:text-blue-200', 'dark:border-slate-800');
            el.alertIcon.textContent = 'info';
        }
        
        setTimeout(window.hideAlert, 5000);
    };

    window.hideAlert = function () {
        el.alertBanner.className = "fixed bottom-6 right-6 z-50 transform translate-y-20 opacity-0 transition-all duration-300 max-w-md w-full rounded-2xl p-4 shadow-xl flex items-start gap-3";
    };

    // --- MODAL DE GITHUB TOKEN ---
    window.closeTokenModal = function () {
        el.tokenModal.classList.add('hidden');
    };

    window.saveGithubToken = function () {
        const val = el.githubPatInput.value.trim();
        if (val) {
            localStorage.setItem('github_pat', val);
            window.showAlert('Token de GitHub guardado localmente.', 'success');
        } else {
            localStorage.removeItem('github_pat');
            window.showAlert('Token de GitHub eliminado.', 'info');
        }
        window.closeTokenModal();
    };

    el.githubTokenBtn.addEventListener('click', () => {
        el.githubPatInput.value = localStorage.getItem('github_pat') || '';
        el.tokenModal.classList.remove('hidden');
    });

    // --- MANEJO DE TEMA ---
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            el.themeToggle.querySelector('.material-symbols-outlined').textContent = 'light_mode';
        } else {
            document.documentElement.classList.remove('dark');
            el.themeToggle.querySelector('.material-symbols-outlined').textContent = 'dark_mode';
        }
    };
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme);
    el.themeToggle.addEventListener('click', () => {
        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    // --- MANEJO DE TABS ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.className = "tab-btn flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold tracking-wide transition-all w-full text-left text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800/50";
            });
            btn.className = "tab-btn active flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold tracking-wide transition-all w-full text-left bg-primary text-white dark:bg-white dark:text-black shadow-sm";
            
            const targetTab = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
            const panel = document.getElementById(`tab-content-${targetTab}`);
            if (panel) panel.classList.remove('hidden');

            if (targetTab === 'general' && leafletMap) {
                setTimeout(() => leafletMap.invalidateSize(), 150);
            }
        });
    });

    // --- INICIALIZACIÓN ---
    async function init() {
        const urlParams = new URLSearchParams(window.location.search);
        companyId = urlParams.get('empresa') || '';
        projectSlug = urlParams.get('project') || '';

        if (!companyId || !projectSlug) {
            window.showAlert('Faltan parámetros empresa/project en la URL.', 'error');
            return;
        }

        // Setup back button redirection
        el.backBtn.addEventListener('click', () => {
            window.location.href = `project-landing.html?project=${projectSlug}&empresa=${companyId}`;
        });

        // 1. Cargar Empresas
        try {
            const empRes = await fetch('empresas.json');
            if (!empRes.ok) throw new Error('No se pudo leer empresas.json');
            const companies = await empRes.json();
            currentCompany = companies.find(c => c.id === companyId);
            if (!currentCompany) {
                window.showAlert('Empresa no encontrada en empresas.json', 'error');
                return;
            }
            el.breadcrumbEmpresa.textContent = currentCompany.name.toUpperCase();
            el.breadcrumbEmpresa.parentElement.setAttribute('href', `home.html?empresa=${companyId}`);
            configUrl = currentCompany.configUrl || 'portal-config.json';
        } catch (e) {
            console.error(e);
            window.showAlert('Error al cargar metadatos de empresa.', 'error');
            return;
        }

        // 2. Cargar Configuración de Empresa
        try {
            const confRes = await fetch(configUrl + '?t=' + Date.now());
            if (!confRes.ok) throw new Error(`No se pudo leer ${configUrl}`);
            fullConfig = await confRes.json();
            activeProject = fullConfig.projects.find(p => p.slug === projectSlug);
            if (!activeProject) {
                window.showAlert('Proyecto no encontrado en la configuración de la empresa.', 'error');
                return;
            }
            el.breadcrumbProyecto.textContent = activeProject.name.toUpperCase();
            
            // Inicializar arreglos si no existen
            if (!activeProject.members) activeProject.members = [];
            if (!activeProject.equiposDeTarea) activeProject.equiposDeTarea = [];
            if (!activeProject.dataSources) activeProject.dataSources = {};
            if (!activeProject.landing) activeProject.landing = {};
            if (!activeProject.landing.map) {
                activeProject.landing.map = { lat: 4.711, lng: -74.0721, zoom: 13 };
            }

            fillInputs();
            initMap();
        } catch (e) {
            console.error(e);
            window.showAlert('Error al cargar la configuración del proyecto.', 'error');
            return;
        }

        // 3. Cargar Directorio de Usuarios de Nora
        try {
            const usersRes = await fetch('https://script.google.com/macros/s/AKfycbx4NEpE6EyrC2ggk8To0F0TP5P9y0YnaxiWzCbcIhSR7-KRSy4Wu0PM9hYyNY5y72Q/exec');
            if (usersRes.ok) {
                allDirectoryUsers = await usersRes.json();
                renderMembersTab();
                renderTeamsTab();
            }
        } catch (e) {
            console.warn('No se pudo cargar el directorio de usuarios de Nora.', e);
        }
    }

    // --- LLENAR INPUTS ---
    function fillInputs() {
        // General info
        el.projName.value = activeProject.name || '';
        el.projSlug.value = activeProject.slug || '';
        el.projCity.value = activeProject.city || '';
        el.projStatus.value = activeProject.status || '';

        // Branding
        el.projLogo.value = activeProject.landing.logoUrl || '';
        el.projEyebrow.value = activeProject.landing.eyebrow || '';
        el.projTitle.value = activeProject.landing.title || '';
        el.projSubtitle.value = activeProject.landing.subtitle || '';

        // Location
        el.projAddress.value = activeProject.landing.address || '';
        el.projLat.value = activeProject.landing.map.lat || 4.711;
        el.projLng.value = activeProject.landing.map.lng || -74.0721;

        // Datasources
        el.dsDriveFolderName.value = activeProject.dataSources.driveFolderName || '';
        el.dsDriveFolderId.value = activeProject.dataSources.driveFolderId || '';
        el.dsDriveScriptUrl.value = activeProject.dataSources.driveScriptUrl || '';
        el.dsStatusSheetId.value = activeProject.dataSources.statusSheetId || '';
        el.dsStatusScriptUrl.value = activeProject.dataSources.statusScriptUrl || '';
        el.dsCantidadesSheetId.value = activeProject.dataSources.cantidadesSheetId || '';
        el.dsCantidadesScriptUrl.value = activeProject.dataSources.cantidadesScriptUrl || '';

        // Setup input change synchronization
        bindInputSync();
    }

    function bindInputSync() {
        const bind = (inputEl, updater) => {
            inputEl.addEventListener('input', (e) => {
                updater(e.target.value);
            });
        };

        bind(el.projName, (v) => { activeProject.name = v; });
        bind(el.projCity, (v) => { activeProject.city = v; });
        bind(el.projStatus, (v) => { activeProject.status = v; });
        bind(el.projLogo, (v) => { activeProject.landing.logoUrl = v; });
        bind(el.projEyebrow, (v) => { activeProject.landing.eyebrow = v; });
        bind(el.projTitle, (v) => { activeProject.landing.title = v; });
        bind(el.projSubtitle, (v) => { activeProject.landing.subtitle = v; });
        bind(el.projAddress, (v) => { activeProject.landing.address = v; });

        bind(el.dsDriveFolderName, (v) => { activeProject.dataSources.driveFolderName = v; });
        bind(el.dsDriveFolderId, (v) => { activeProject.dataSources.driveFolderId = v; });
        bind(el.dsDriveScriptUrl, (v) => { activeProject.dataSources.driveScriptUrl = v; });
        bind(el.dsStatusSheetId, (v) => { activeProject.dataSources.statusSheetId = v; });
        bind(el.dsStatusScriptUrl, (v) => { activeProject.dataSources.statusScriptUrl = v; });
        bind(el.dsCantidadesSheetId, (v) => { activeProject.dataSources.cantidadesSheetId = v; });
        bind(el.dsCantidadesScriptUrl, (v) => { activeProject.dataSources.cantidadesScriptUrl = v; });

        // Lat & Lng input sync
        const updateCoords = () => {
            const lat = Number(el.projLat.value) || 4.711;
            const lng = Number(el.projLng.value) || -74.0721;
            activeProject.landing.map.lat = lat;
            activeProject.landing.map.lng = lng;
            if (leafletMap && mapMarker) {
                mapMarker.setLatLng([lat, lng]);
                leafletMap.setView([lat, lng], leafletMap.getZoom());
            }
        };
        el.projLat.addEventListener('change', updateCoords);
        el.projLng.addEventListener('change', updateCoords);
    }

    // --- INICIALIZAR MAPA ---
    function initMap() {
        if (!window.L) return;
        const lat = activeProject.landing.map.lat || 4.711;
        const lng = activeProject.landing.map.lng || -74.0721;
        const zoom = activeProject.landing.map.zoom || 13;

        leafletMap = window.L.map('settings-map').setView([lat, lng], zoom);
        window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 20,
            attribution: '&copy; OpenStreetMap contributors',
        }).addTo(leafletMap);

        mapMarker = window.L.marker([lat, lng], { draggable: true }).addTo(leafletMap);

        // Marker dragend
        mapMarker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            const fixedLat = Number(pos.lat.toFixed(6));
            const fixedLng = Number(pos.lng.toFixed(6));
            el.projLat.value = fixedLat;
            el.projLng.value = fixedLng;
            activeProject.landing.map.lat = fixedLat;
            activeProject.landing.map.lng = fixedLng;
        });

        // Click map
        leafletMap.on('click', (e) => {
            const fixedLat = Number(e.latlng.lat.toFixed(6));
            const fixedLng = Number(e.latlng.lng.toFixed(6));
            mapMarker.setLatLng([fixedLat, fixedLng]);
            el.projLat.value = fixedLat;
            el.projLng.value = fixedLng;
            activeProject.landing.map.lat = fixedLat;
            activeProject.landing.map.lng = fixedLng;
        });

        leafletMap.on('zoomend', () => {
            activeProject.landing.map.zoom = leafletMap.getZoom();
        });
    }

    // --- TAB: GESTIÓN DE MIEMBROS ---
    function renderMembersTab() {
        el.projectMembersCount.textContent = `${activeProject.members.length} Miembros Asignados`;
        const query = el.directorySearch.value.toLowerCase().trim();
        
        // Filter users
        const filtered = allDirectoryUsers.filter(u => {
            if (!u.email) return false;
            const matchName = (u.nombre || '').toLowerCase().includes(query);
            const matchEmail = (u.email || '').toLowerCase().includes(query);
            const matchEmpresa = (u.empresa || '').toLowerCase().includes(query);
            return matchName || matchEmail || matchEmpresa;
        });

        el.directoryTableBody.innerHTML = filtered.map(u => {
            const email = u.email.toLowerCase().trim();
            const isAssigned = activeProject.members.some(m => m.toLowerCase().trim() === email);

            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td class="py-3 px-4">
                        <div class="font-bold text-gray-900 dark:text-white">${escapeHtml(u.nombre || 'Sin Nombre')}</div>
                        <div class="text-xs text-gray-500">${escapeHtml(u.empresa || 'Empresa No Definida')}</div>
                    </td>
                    <td class="py-3 px-4 text-xs font-mono">
                        <div class="text-gray-700 dark:text-gray-300">${escapeHtml(email)}</div>
                        <span class="inline-block mt-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-700 font-sans font-semibold text-gray-600 dark:text-gray-300 text-[10px] uppercase tracking-wider">${escapeHtml(u.especialidad || 'Sin Especialidad')}</span>
                    </td>
                    <td class="py-3 px-4 text-xs text-gray-500 font-semibold uppercase tracking-wider">${escapeHtml(u.rol || 'Colaborador')}</td>
                    <td class="py-3 px-4 text-center">
                        ${isAssigned 
                            ? `<button onclick="toggleMember('${email}', false)" class="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all">
                                <span class="material-symbols-outlined text-[16px]">person_remove</span>
                                <span>Remover</span>
                               </button>`
                            : `<button onclick="toggleMember('${email}', true)" class="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all">
                                <span class="material-symbols-outlined text-[16px]">person_add</span>
                                <span>Asignar</span>
                               </button>`
                        }
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.toggleMember = function (email, assign) {
        const cleanEmail = email.toLowerCase().trim();
        if (assign) {
            if (!activeProject.members.some(m => m.toLowerCase().trim() === cleanEmail)) {
                activeProject.members.push(cleanEmail);
            }
        } else {
            activeProject.members = activeProject.members.filter(m => m.toLowerCase().trim() !== cleanEmail);
            
            // Si removemos del proyecto, también removemos de todos los equipos de tarea del proyecto
            if (activeProject.equiposDeTarea) {
                activeProject.equiposDeTarea.forEach(team => {
                    if (team.members) {
                        team.members = team.members.filter(m => m.toLowerCase().trim() !== cleanEmail);
                    }
                });
            }
        }
        renderMembersTab();
        renderTeamsTab();
    };

    el.directorySearch.addEventListener('input', renderMembersTab);

    // --- TAB: EQUIPOS DE TAREA ---
    function renderTeamsTab() {
        if (!activeProject.equiposDeTarea) {
            activeProject.equiposDeTarea = [];
        }

        if (activeProject.equiposDeTarea.length === 0) {
            el.teamsContainer.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center p-12 text-center border border-dashed border-border-light dark:border-border-dark rounded-3xl">
                    <span class="material-symbols-outlined text-4xl text-gray-400 mb-2">groups_3</span>
                    <h3 class="font-bold text-gray-700 dark:text-gray-300">Sin Equipos de Tarea</h3>
                    <p class="text-xs text-gray-500 mt-1">Crea tu primer equipo de tarea (Ej: ESTRUCTURAS, ARQUITECTURA) usando el formulario de arriba.</p>
                </div>
            `;
            return;
        }

        el.teamsContainer.innerHTML = activeProject.equiposDeTarea.map((team, tIndex) => {
            const teamName = team.name.toUpperCase().trim();
            const membersList = team.members || [];
            
            // Options to add: project members who are NOT already in this team
            const assignableMembers = activeProject.members.filter(mEmail => {
                return !membersList.some(tmEmail => tmEmail.toLowerCase().trim() === mEmail.toLowerCase().trim());
            });

            const membersHtml = membersList.map(mEmail => {
                const cleanEmail = mEmail.toLowerCase().trim();
                const matchedDirUser = allDirectoryUsers.find(du => du.email && du.email.toLowerCase().trim() === cleanEmail);
                const displayName = matchedDirUser ? matchedDirUser.nombre : cleanEmail.split('@')[0];
                return `
                    <div class="flex items-center justify-between bg-gray-50 dark:bg-slate-800/40 border border-border-light dark:border-border-dark rounded-xl px-3 py-2 text-xs">
                        <div class="flex flex-col">
                            <span class="font-bold text-gray-900 dark:text-white">${escapeHtml(displayName)}</span>
                            <span class="text-[10px] text-gray-500 font-mono">${escapeHtml(cleanEmail)}</span>
                        </div>
                        <button onclick="removeTeamMember(${tIndex}, '${cleanEmail}')" class="text-gray-400 hover:text-rose-600 transition-colors">
                            <span class="material-symbols-outlined text-[16px] block">close</span>
                        </button>
                    </div>
                `;
            }).join('');

            const selectOptions = assignableMembers.map(email => {
                const cleanEmail = email.toLowerCase().trim();
                const matchedDirUser = allDirectoryUsers.find(du => du.email && du.email.toLowerCase().trim() === cleanEmail);
                const label = matchedDirUser ? `${matchedDirUser.nombre} (${cleanEmail})` : cleanEmail;
                return `<option value="${cleanEmail}">${escapeHtml(label)}</option>`;
            }).join('');

            return `
                <div class="bg-white dark:bg-slate-900 border border-border-light dark:border-border-dark rounded-3xl p-5 shadow-sm flex flex-col gap-4">
                    <div class="flex items-center justify-between border-b border-border-light dark:border-border-dark pb-3">
                        <div class="flex flex-col">
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Equipo de Tarea</span>
                            <span class="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">${escapeHtml(teamName)}</span>
                        </div>
                        <button onclick="deleteTeam(${tIndex})" class="text-gray-400 hover:text-rose-600 border border-transparent hover:border-rose-100 hover:bg-rose-50 dark:hover:bg-rose-950/20 p-2 rounded-xl transition-all">
                            <span class="material-symbols-outlined text-[20px] block">delete</span>
                        </button>
                    </div>

                    <div class="space-y-2 flex-grow overflow-y-auto max-h-48 pr-1">
                        ${membersHtml || `<div class="text-xs text-gray-400 italic text-center py-4">Sin colaboradores asignados</div>`}
                    </div>

                    ${selectOptions.length > 0 
                        ? `
                        <div class="flex gap-2">
                            <select id="team-select-${tIndex}" class="flex-1 rounded-xl border-slate-200 dark:border-border-dark dark:bg-slate-800 text-xs py-2">
                                <option value="">-- Seleccionar Colaborador --</option>
                                ${selectOptions}
                            </select>
                            <button onclick="addTeamMember(${tIndex})" class="bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-white px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm">Agregar</button>
                        </div>
                        `
                        : `<p class="text-[10px] text-gray-400 text-center font-semibold uppercase tracking-wider">Todos los miembros del proyecto han sido asignados</p>`
                    }
                </div>
            `;
        }).join('');
    }

    el.addTeamBtn.addEventListener('click', () => {
        const name = el.newTeamName.value.toUpperCase().trim();
        if (!name) {
            window.showAlert('Por favor escribe un nombre para el Equipo de Tarea.', 'error');
            return;
        }

        if (!activeProject.equiposDeTarea) activeProject.equiposDeTarea = [];
        
        if (activeProject.equiposDeTarea.some(t => t.name.toUpperCase().trim() === name)) {
            window.showAlert(`El Equipo de Tarea "${name}" ya existe.`, 'error');
            return;
        }

        activeProject.equiposDeTarea.push({
            name: name,
            members: []
        });

        el.newTeamName.value = '';
        renderTeamsTab();
        window.showAlert(`Equipo de Tarea "${name}" creado exitosamente.`, 'success');
    });

    window.deleteTeam = function (index) {
        const team = activeProject.equiposDeTarea[index];
        if (!team) return;
        if (!confirm(`¿Estás seguro de que deseas eliminar el equipo de tarea "${team.name}"?`)) return;

        activeProject.equiposDeTarea.splice(index, 1);
        renderTeamsTab();
        window.showAlert('Equipo de Tarea eliminado.', 'info');
    };

    window.addTeamMember = function (teamIndex) {
        const select = document.getElementById(`team-select-${teamIndex}`);
        const email = select ? select.value : '';
        if (!email) return;

        const team = activeProject.equiposDeTarea[teamIndex];
        if (!team) return;

        if (!team.members) team.members = [];
        if (!team.members.some(m => m.toLowerCase().trim() === email.toLowerCase().trim())) {
            team.members.push(email.toLowerCase().trim());
        }

        renderTeamsTab();
        window.showAlert('Colaborador asignado al equipo.', 'success');
    };

    window.removeTeamMember = function (teamIndex, email) {
        const team = activeProject.equiposDeTarea[teamIndex];
        if (!team) return;

        team.members = team.members.filter(m => m.toLowerCase().trim() !== email.toLowerCase().trim());
        renderTeamsTab();
        window.showAlert('Colaborador removido del equipo.', 'info');
    };

    // --- ACCIONES DE GUARDADO / SERIALIZACIÓN ---
    el.copyJsonBtn.addEventListener('click', () => {
        try {
            const dataStr = JSON.stringify(fullConfig, null, 2);
            navigator.clipboard.writeText(dataStr).then(() => {
                window.showAlert('Configuración JSON copiada al portapapeles.', 'success');
            });
        } catch (e) {
            window.showAlert('Error al copiar JSON: ' + e.message, 'error');
        }
    });

    el.downloadJsonBtn.addEventListener('click', () => {
        try {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullConfig, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", configUrl);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            window.showAlert('Configuración descargada localmente.', 'success');
        } catch (e) {
            window.showAlert('Error al descargar JSON: ' + e.message, 'error');
        }
    });

    el.saveGithubBtn.addEventListener('click', async () => {
        let token = localStorage.getItem('github_pat');
        if (!token) {
            el.githubPatInput.value = '';
            el.tokenModal.classList.remove('hidden');
            window.showAlert('Se requiere un token de GitHub para publicar cambios en la nube.', 'error');
            return;
        }

        const repo = 'camilomartg-svg/bim';
        const branch = 'main';
        const files = [configUrl, `docs/${configUrl}`];
        const content = JSON.stringify(fullConfig, null, 2);

        window.showAlert('Publicando cambios en GitHub... Por favor espera.', 'info');

        try {
            for (const path of files) {
                let sha = null;
                // Intentar leer el SHA existente
                try {
                    const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`, {
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    });
                    if (getRes.ok) {
                        const data = await getRes.json();
                        sha = data.sha;
                    }
                } catch (e) {
                    console.warn(`File ${path} not found or api error:`, e);
                }

                const body = {
                    message: `Update project ${activeProject.name} settings from settings panel`,
                    content: btoa(unescape(encodeURIComponent(content))),
                    branch: branch
                };
                if (sha) body.sha = sha;

                const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });

                if (!putRes.ok) {
                    if (putRes.status === 401) {
                        localStorage.removeItem('github_pat');
                        throw new Error('Token de GitHub inválido o expirado. Ingrésalo nuevamente.');
                    }
                    throw new Error(`Error actualizando ${path}: ${putRes.statusText}`);
                }
            }

            window.showAlert('Configuración publicada exitosamente en GitHub. Los cambios se aplicarán en un minuto.', 'success');
        } catch (err) {
            window.showAlert(err.message, 'error');
        }
    });

    // --- AUXILIARES ---
    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Inicializar
    init();

})();
