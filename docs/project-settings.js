(function () {
    // --- ESTADO GLOBAL ---
    let companyId = '';
    let projectSlug = '';
    let currentCompany = null;
    let configUrl = '';
    let fullConfig = null;
    let activeProject = null;
    let allDirectoryUsers = []; // Users loaded from Google Sheets (Nora Directory)
    
    // Central Google Apps Script Endpoint for Nora (Users, Companies, Teams & Drive)
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx2RAQx_8K4o22xE0Mw-ETc7K_58vIoi6-PgVi64u80inuiw144ks3cgWSdCtXqIgB02g/exec';

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
        teamsListContainer: document.getElementById('teams-list-container'),
        teamsMembersTableBody: document.getElementById('teams-members-table-body')
    };

    // --- BACK BUTTON: Register immediately (outside async init) ---
    (function() {
        const _params = new URLSearchParams(window.location.search);
        const _empresa = _params.get('empresa') || '';
        const _project = _params.get('project') || '';
        if (el.backBtn) {
            el.backBtn.addEventListener('click', () => {
                const dest = 'project-landing.html'
                    + '?project=' + encodeURIComponent(_project)
                    + '&empresa=' + encodeURIComponent(_empresa);
                window.location.href = dest;
            });
        }
    })();

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

    // --- SINCRONIZACIÓN AUTOMÁTICA CON GOOGLE SHEETS (APPS SCRIPT) ---
    async function syncTeamsToGoogle(silent = false) {
        if (!companyId || !projectSlug || !activeProject) return;
        try {
            const payload = {
                action: 'saveTeams',
                empresa: companyId,
                proyecto: projectSlug,
                teams: activeProject.equiposDeTarea || []
            };
            const res = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            if (res.ok && !silent) {
                console.log('Equipos de tarea sincronizados automáticamente con Google Sheets');
            }
        } catch (e) {
            console.warn('Error al sincronizar equipos con Google Sheets:', e);
        }
    }

    // --- INICIALIZACIÓN ---
    async function init() {
        const urlParams = new URLSearchParams(window.location.search);
        companyId = urlParams.get('empresa') || '';
        projectSlug = urlParams.get('project') || '';

        if (!companyId || !projectSlug) {
            window.showAlert('Faltan parámetros empresa/project en la URL.', 'error');
            return;
        }

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

        // 3. Cargar Directorio de Usuarios de Nora desde Google Sheets
        try {
            const usersRes = await fetch(GOOGLE_SCRIPT_URL);
            if (usersRes.ok) {
                allDirectoryUsers = await usersRes.json();
            }
        } catch (e) {
            console.warn('No se pudo cargar el directorio de usuarios de Nora.', e);
        }

        // 4. Cargar Equipos de Tarea desde Google Sheets automáticamente
        try {
            const teamsRes = await fetch(`${GOOGLE_SCRIPT_URL}?action=getTeams&empresa=${encodeURIComponent(companyId)}&proyecto=${encodeURIComponent(projectSlug)}&t=${Date.now()}`);
            if (teamsRes.ok) {
                const remoteTeams = await teamsRes.json();
                if (Array.isArray(remoteTeams) && remoteTeams.length > 0) {
                    remoteTeams.forEach(rt => {
                        const existing = activeProject.equiposDeTarea.find(lt => lt.name.toUpperCase().trim() === rt.name.toUpperCase().trim());
                        if (existing) {
                            const memberSet = new Set([...(existing.members || []), ...(rt.members || [])]);
                            existing.members = Array.from(memberSet);
                        } else {
                            activeProject.equiposDeTarea.push({
                                name: rt.name.toUpperCase().trim(),
                                members: rt.members || []
                            });
                        }
                    });
                }
            }
        } catch (err) {
            console.warn('No se pudieron obtener equipos desde Google Sheets:', err);
        }

        renderMembersTab();
        renderTeamsTab();

        // Register add-team button listener here, after activeProject is guaranteed to be loaded
        if (el.addTeamBtn) {
            el.addTeamBtn.addEventListener('click', () => {
                if (!activeProject) {
                    window.showAlert('El proyecto no está cargado. Recarga la página.', 'error');
                    return;
                }
                const name = (el.newTeamName.value || '').toUpperCase().trim();
                if (!name) {
                    window.showAlert('Por favor escribe un nombre para el Equipo de Tarea.', 'error');
                    return;
                }

                if (!activeProject.equiposDeTarea) activeProject.equiposDeTarea = [];

                if (activeProject.equiposDeTarea.some(t => t.name.toUpperCase().trim() === name)) {
                    window.showAlert(`El Equipo de Tarea "${name}" ya existe.`, 'error');
                    return;
                }

                activeProject.equiposDeTarea.push({ name: name, members: [] });
                el.newTeamName.value = '';
                renderTeamsTab();
                syncTeamsToGoogle();
                window.showAlert(`Equipo de Tarea "${name}" creado exitosamente.`, 'success');
            });
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
        el.projLogo.value = activeProject.landing.logo || '';
        el.projEyebrow.value = activeProject.landing.eyebrow || '';
        el.projTitle.value = activeProject.landing.title || '';
        el.projSubtitle.value = activeProject.landing.subtitle || '';

        // Map
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

        // Listeners for live update of activeProject
        const bindInput = (domEl, setter) => {
            domEl.addEventListener('input', (e) => {
                setter(e.target.value);
            });
        };

        bindInput(el.projName, v => activeProject.name = v);
        bindInput(el.projCity, v => activeProject.city = v);
        bindInput(el.projStatus, v => activeProject.status = v);
        bindInput(el.projLogo, v => activeProject.landing.logo = v);
        bindInput(el.projEyebrow, v => activeProject.landing.eyebrow = v);
        bindInput(el.projTitle, v => activeProject.landing.title = v);
        bindInput(el.projSubtitle, v => activeProject.landing.subtitle = v);
        bindInput(el.projAddress, v => activeProject.landing.address = v);

        bindInput(el.dsDriveFolderName, v => activeProject.dataSources.driveFolderName = v);
        bindInput(el.dsDriveFolderId, v => activeProject.dataSources.driveFolderId = v);
        bindInput(el.dsDriveScriptUrl, v => activeProject.dataSources.driveScriptUrl = v);
        bindInput(el.dsStatusSheetId, v => activeProject.dataSources.statusSheetId = v);
        bindInput(el.dsStatusScriptUrl, v => activeProject.dataSources.statusScriptUrl = v);
        bindInput(el.dsCantidadesSheetId, v => activeProject.dataSources.cantidadesSheetId = v);
        bindInput(el.dsCantidadesScriptUrl, v => activeProject.dataSources.cantidadesScriptUrl = v);

        // Update map on lat/lng text input change
        const updateMapFromInputs = () => {
            const lat = parseFloat(el.projLat.value);
            const lng = parseFloat(el.projLng.value);
            if (!isNaN(lat) && !isNaN(lng) && leafletMap && mapMarker) {
                const newPos = [lat, lng];
                leafletMap.setView(newPos, leafletMap.getZoom());
                mapMarker.setLatLng(newPos);
                activeProject.landing.map.lat = lat;
                activeProject.landing.map.lng = lng;
            }
        };

        el.projLat.addEventListener('change', updateMapFromInputs);
        el.projLng.addEventListener('change', updateMapFromInputs);
    }

    // --- MAPA LEAFLET ---
    function initMap() {
        if (typeof L === 'undefined') return;

        const coords = [activeProject.landing.map.lat, activeProject.landing.map.lng];
        const zoom = activeProject.landing.map.zoom || 13;

        leafletMap = L.map('settings-map').setView(coords, zoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(leafletMap);

        const customIcon = L.divIcon({
            className: 'custom-pin',
            html: `<div style="background-color:#171717; width:28px; height:28px; border-radius:50%; border:3px solid white; display:flex; align-items:center; justify-content:center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);">
                    <span class="material-symbols-outlined" style="font-size:16px; color:white;">apartment</span>
                   </div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });

        mapMarker = L.marker(coords, { draggable: true, icon: customIcon }).addTo(leafletMap);

        mapMarker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            const fixedLat = parseFloat(pos.lat.toFixed(6));
            const fixedLng = parseFloat(pos.lng.toFixed(6));
            el.projLat.value = fixedLat;
            el.projLng.value = fixedLng;
            activeProject.landing.map.lat = fixedLat;
            activeProject.landing.map.lng = fixedLng;
        });

        leafletMap.on('click', (e) => {
            const fixedLat = parseFloat(e.latlng.lat.toFixed(6));
            const fixedLng = parseFloat(e.latlng.lng.toFixed(6));
            mapMarker.setLatLng(e.latlng);
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
            syncTeamsToGoogle();
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

        // Render teams list pills
        if (activeProject.equiposDeTarea.length === 0) {
            el.teamsListContainer.innerHTML = `<div class="text-xs text-gray-400 italic py-2">Sin equipos de tarea creados.</div>`;
        } else {
            el.teamsListContainer.innerHTML = activeProject.equiposDeTarea.map((team, tIndex) => {
                return `
                    <div class="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-900/50 px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-wider">
                        <span>${escapeHtml(team.name)}</span>
                        <button onclick="deleteTeam(${tIndex})" class="text-indigo-400 hover:text-indigo-600 transition-colors flex items-center">
                            <span class="material-symbols-outlined text-[14px]">close</span>
                        </button>
                    </div>
                `;
            }).join('');
        }

        // Render project members team assignment table
        if (activeProject.members.length === 0) {
            el.teamsMembersTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="py-8 px-4 text-center text-xs text-gray-400 italic">
                        No hay personal asignado al proyecto. Asígnalos en la pestaña "Personal Proyecto".
                    </td>
                </tr>
            `;
            return;
        }

        el.teamsMembersTableBody.innerHTML = activeProject.members.map(email => {
            const cleanEmail = email.toLowerCase().trim();
            const matchedDirUser = allDirectoryUsers.find(du => du.email && du.email.toLowerCase().trim() === cleanEmail);
            
            const displayName = matchedDirUser ? matchedDirUser.nombre : cleanEmail.split('@')[0];
            const displayRole = matchedDirUser ? (matchedDirUser.especialidad || matchedDirUser.rol || 'Colaborador') : 'Colaborador';
            const displayCompany = matchedDirUser ? matchedDirUser.empresa : 'Empresa no definida';

            // Find which team this user is currently in (if any)
            let assignedTeamName = '';
            if (activeProject.equiposDeTarea) {
                const userTeam = activeProject.equiposDeTarea.find(team => 
                    team.members && team.members.some(m => m.toLowerCase().trim() === cleanEmail)
                );
                if (userTeam) {
                    assignedTeamName = userTeam.name.toUpperCase().trim();
                }
            }

            // Create team options
            const teamOptions = activeProject.equiposDeTarea.map(team => {
                const name = team.name.toUpperCase().trim();
                const isSelected = (name === assignedTeamName);
                return `<option value="${escapeHtml(name)}" ${isSelected ? 'selected' : ''}>${escapeHtml(name)}</option>`;
            }).join('');

            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td class="py-3 px-4">
                        <div class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">${escapeHtml(displayRole)}</div>
                        <div class="text-[10px] text-gray-400">${escapeHtml(displayCompany)}</div>
                    </td>
                    <td class="py-3 px-4 font-bold text-gray-900 dark:text-white">${escapeHtml(displayName)}</td>
                    <td class="py-3 px-4 text-xs font-mono text-gray-500">${escapeHtml(cleanEmail)}</td>
                    <td class="py-3 px-4">
                        <select onchange="changeUserTeam('${cleanEmail}', this.value)" class="w-full rounded-xl border-slate-200 dark:border-border-dark dark:bg-slate-800 text-xs py-1.5 font-semibold">
                            <option value="">-- SIN EQUIPO --</option>
                            ${teamOptions}
                        </select>
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.deleteTeam = function (index) {
        const team = activeProject.equiposDeTarea[index];
        if (!team) return;
        if (!confirm(`¿Estás seguro de que deseas eliminar el equipo de tarea "${team.name}"?`)) return;

        activeProject.equiposDeTarea.splice(index, 1);
        renderTeamsTab();
        syncTeamsToGoogle();
        window.showAlert('Equipo de Tarea eliminado.', 'info');
    };

    window.changeUserTeam = function (email, teamName) {
        const cleanEmail = email.toLowerCase().trim();
        const cleanTeamName = teamName.toUpperCase().trim();
        
        // Remove from all teams
        if (activeProject.equiposDeTarea) {
            activeProject.equiposDeTarea.forEach(team => {
                if (team.members) {
                    team.members = team.members.filter(m => m.toLowerCase().trim() !== cleanEmail);
                }
            });
            
            // Add to selected team if not empty
            if (cleanTeamName) {
                const targetTeam = activeProject.equiposDeTarea.find(t => t.name.toUpperCase().trim() === cleanTeamName);
                if (targetTeam) {
                    if (!targetTeam.members) targetTeam.members = [];
                    if (!targetTeam.members.includes(cleanEmail)) {
                        targetTeam.members.push(cleanEmail);
                    }
                }
            }
        }
        
        renderTeamsTab();
        syncTeamsToGoogle();
        window.showAlert('Asignación de equipo de tarea actualizada.', 'success');
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

        window.showAlert('Publicando cambios en GitHub y Google Sheets... Por favor espera.', 'info');

        // Sync teams with Google Sheets as well
        syncTeamsToGoogle();

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
                    message: `Update project ${activeProject.name} settings and task teams`,
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

            window.showAlert('Configuración publicada exitosamente en GitHub y Google Sheets.', 'success');
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
