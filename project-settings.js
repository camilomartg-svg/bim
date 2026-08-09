(function () {
    // --- ESTADO GLOBAL ---
    let companyId = '';
    let projectSlug = '';
    let currentCompany = null;
    let configUrl = '';
    let fullConfig = { portal: { name: 'nora CDE' }, projects: [] };
    let activeProject = { slug: '', name: 'Proyecto', equiposDeTarea: [], members: [], dataSources: {}, landing: { map: { lat: 4.711, lng: -74.0721, zoom: 13 } } };
    let allDirectoryUsers = []; // Users loaded from Google Sheets (Nora Directory)
    let allCompaniesList = []; // All companies loaded from empresas.json (Super Admin)
    
    // Central Google Apps Script Endpoint for Nora (Users, Companies, Teams & Drive)
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx2RAQx_8K4o22xE0Mw-ETc7K_58vIoi6-PgVi64u80inuiw144ks3cgWSdCtXqIgB02g/exec';

    // Helper: Resuelve la empresa exacta registrada para un usuario en el panel Super Admin
    function getUserRegisteredCompany(email) {
        if (!email) return 'Empresa';
        const cleanEmail = email.toLowerCase().trim();

        // 1. Prioridad: Empresa configurada explícitamente para este miembro en la empresa actual
        const companyMembers = Array.isArray(currentCompany?.members) ? currentCompany.members : [];
        const curCompMember = companyMembers.find(cm => cm.email && cm.email.toLowerCase().trim() === cleanEmail);
        if (curCompMember && curCompMember.empresaUsuario && curCompMember.empresaUsuario.trim() !== '') {
            return curCompMember.empresaUsuario.trim();
        }

        // 2. Prioridad: Buscar en todas las empresas de Super Admin (empresas.json)
        if (Array.isArray(allCompaniesList)) {
            // 2a. Buscar asignación explícita de 'empresaUsuario' en cualquier empresa
            for (const comp of allCompaniesList) {
                if (comp.deleted) continue;
                if (Array.isArray(comp.members)) {
                    const found = comp.members.find(m => m.email && m.email.toLowerCase().trim() === cleanEmail);
                    if (found && found.empresaUsuario && found.empresaUsuario.trim() !== '') {
                        return found.empresaUsuario.trim();
                    }
                }
            }

            // 2b. Buscar si es administrador o empleado interno en alguna empresa
            for (const comp of allCompaniesList) {
                if (comp.deleted) continue;
                if (Array.isArray(comp.admins) && comp.admins.some(a => a.toLowerCase().trim() === cleanEmail)) {
                    return comp.name;
                }
                if (Array.isArray(comp.members)) {
                    const found = comp.members.find(m => m.email && m.email.toLowerCase().trim() === cleanEmail && (m.role === 'ADMINISTRADOR_EMPRESA' || !m.empresaUsuario || m.empresaUsuario.trim() === comp.name.trim()));
                    if (found) {
                        return comp.name;
                    }
                }
            }
        }

        // 3. Prioridad: Directorio maestro de usuarios en Google Sheets (sincronizado con Super Admin)
        if (Array.isArray(allDirectoryUsers)) {
            const dirUser = allDirectoryUsers.find(du => du.email && du.email.toLowerCase().trim() === cleanEmail);
            if (dirUser && dirUser.empresa && dirUser.empresa.trim() !== '') {
                return dirUser.empresa.trim();
            }
        }

        // 4. Fallback: Empresa actual
        if (curCompMember) {
            return currentCompany?.name || 'Empresa';
        }

        return currentCompany?.name || 'Empresa';
    }

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
        teamsMembersSearch: document.getElementById('teams-members-search'),
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
                    + (_empresa ? '&empresa=' + encodeURIComponent(_empresa) : '');
                window.location.href = dest;
            });
        }
    })();

    // --- ALERTS DE INTERFAZ ---
    window.showAlert = function (message, type = 'info') {
        if (!el.alertBanner || !el.alertMessage) return;
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
        if (!el.alertBanner) return;
        el.alertBanner.className = "fixed bottom-6 right-6 z-50 transform translate-y-20 opacity-0 transition-all duration-300 max-w-md w-full rounded-2xl p-4 shadow-xl flex items-start gap-3";
    };

    // --- MODAL DE GITHUB TOKEN ---
    window.closeTokenModal = function () {
        if (el.tokenModal) el.tokenModal.classList.add('hidden');
    };

    window.saveGithubToken = function () {
        const val = el.githubPatInput ? el.githubPatInput.value.trim() : '';
        if (val) {
            localStorage.setItem('github_pat', val);
            window.showAlert('Token de GitHub guardado localmente.', 'success');
        } else {
            localStorage.removeItem('github_pat');
            window.showAlert('Token de GitHub eliminado.', 'info');
        }
        window.closeTokenModal();
    };

    if (el.githubTokenBtn) {
        el.githubTokenBtn.addEventListener('click', () => {
            if (el.githubPatInput) el.githubPatInput.value = localStorage.getItem('github_pat') || '';
            if (el.tokenModal) el.tokenModal.classList.remove('hidden');
        });
    }

    // --- MANEJO DE TEMA ---
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            if (el.themeToggle) el.themeToggle.querySelector('.material-symbols-outlined').textContent = 'light_mode';
        } else {
            document.documentElement.classList.remove('dark');
            if (el.themeToggle) el.themeToggle.querySelector('.material-symbols-outlined').textContent = 'dark_mode';
        }
    };
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme);
    if (el.themeToggle) {
        el.themeToggle.addEventListener('click', () => {
            const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
        });
    }

    // --- MANEJO DE TABS ---
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.remove('active', 'bg-primary', 'text-white', 'dark:bg-white', 'dark:text-black', 'shadow-sm');
                b.classList.add('text-gray-600', 'dark:text-gray-400', 'hover:bg-gray-100', 'dark:hover:bg-slate-800/50');
            });
            btn.classList.add('active', 'bg-primary', 'text-white', 'dark:bg-white', 'dark:text-black', 'shadow-sm');
            btn.classList.remove('text-gray-600', 'dark:text-gray-400', 'hover:bg-gray-100', 'dark:hover:bg-slate-800/50');
            
            const targetTab = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
            const panel = document.getElementById(`tab-content-${targetTab}`);
            if (panel) panel.classList.remove('hidden');

            if (targetTab === 'general' && leafletMap) {
                setTimeout(() => leafletMap.invalidateSize(), 150);
            }
        });
    });

    // --- RECOGER / EXPANDIR MENÚ LATERAL ---
    const sidebarMenu = document.getElementById('sidebar-menu');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const toggleSidebarIcon = document.getElementById('toggle-sidebar-icon');

    function applySidebarState(isCollapsed) {
        if (!sidebarMenu) return;
        if (isCollapsed) {
            sidebarMenu.classList.add('collapsed');
            if (toggleSidebarIcon) toggleSidebarIcon.textContent = 'menu';
        } else {
            sidebarMenu.classList.remove('collapsed');
            if (toggleSidebarIcon) toggleSidebarIcon.textContent = 'menu_open';
        }
    }

    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', () => {
            const isCollapsed = sidebarMenu && sidebarMenu.classList.contains('collapsed');
            const newState = !isCollapsed;
            localStorage.setItem('sidebar_collapsed', newState ? 'true' : 'false');
            applySidebarState(newState);
            if (leafletMap) setTimeout(() => leafletMap.invalidateSize(), 200);
        });

        // Initialize state from localStorage
        const savedCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
        if (savedCollapsed) {
            applySidebarState(true);
        }
    }

    // --- SINCRONIZACIÓN AUTOMÁTICA CON GOOGLE SHEETS (APPS SCRIPT) ---
    async function syncTeamsToGoogle(silent = false) {
        const emp = companyId || 'general';
        const proj = projectSlug || (activeProject && activeProject.slug) || 'general';
        if (!activeProject) return;
        try {
            const payload = {
                action: 'saveTeams',
                empresa: emp,
                proyecto: proj,
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

    // --- CREAR EQUIPO DE TAREA (GLOBAL Y DISPONIBLE DE INMEDIATO) ---
    window.addTeam = function () {
        if (!activeProject) {
            activeProject = { slug: projectSlug || 'proyecto', name: 'Proyecto', equiposDeTarea: [], members: [] };
        }
        if (!activeProject.equiposDeTarea) {
            activeProject.equiposDeTarea = [];
        }

        const input = document.getElementById('new-team-name') || el.newTeamName;
        const name = (input ? input.value : '').toUpperCase().trim();
        if (!name) {
            window.showAlert('Por favor escribe un nombre para el Equipo de Tarea.', 'error');
            return;
        }

        if (activeProject.equiposDeTarea.some(t => (t.name || '').toUpperCase().trim() === name)) {
            window.showAlert(`El Equipo de Tarea "${name}" ya existe.`, 'error');
            return;
        }

        activeProject.equiposDeTarea.push({ name: name, members: [] });
        if (input) input.value = '';
        renderTeamsTab();
        syncTeamsToGoogle();
        window.showAlert(`Equipo de Tarea "${name}" creado exitosamente.`, 'success');
    };

    // Bind add team button & Enter key immediately
    if (el.addTeamBtn) {
        el.addTeamBtn.addEventListener('click', window.addTeam);
    }
    if (el.newTeamName) {
        el.newTeamName.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.addTeam();
            }
        });
    }

    // --- INICIALIZACIÓN ---
    async function init() {
        const urlParams = new URLSearchParams(window.location.search);
        companyId = urlParams.get('empresa') || '';
        projectSlug = urlParams.get('project') || '';

        // 1. Cargar Empresas y resolver Empresa si no está presente
        let companies = [];
        try {
            const empRes = await fetch('empresas.json?t=' + Date.now());
            if (empRes.ok) {
                companies = await empRes.json();
                allCompaniesList = companies;
            }
        } catch (e) {
            console.warn('Error al cargar empresas.json:', e);
        }

        // Si no viene empresa en la URL, intentar resolverla por slug o por usuario autenticado
        if (!companyId && projectSlug) {
            const ua = JSON.parse(sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount') || 'null');
            if (ua && ua.adminEmpresaId) {
                companyId = ua.adminEmpresaId;
            } else {
                for (const c of companies) {
                    if (!c.deleted && c.configUrl) {
                        try {
                            const testRes = await fetch(c.configUrl + '?t=' + Date.now());
                            if (testRes.ok) {
                                const testConf = await testRes.json();
                                if (testConf.projects && testConf.projects.some(p => p.slug === projectSlug)) {
                                    companyId = c.id;
                                    break;
                                }
                            }
                        } catch (err) {}
                    }
                }
            }
            if (!companyId) {
                const firstActive = companies.find(c => !c.deleted) || companies[0];
                companyId = firstActive ? firstActive.id : 'empresa3';
            }
        }

        currentCompany = companies.find(c => c.id === companyId) || { id: companyId || 'nora', name: 'Nora CDE', configUrl: 'portal-config.json' };
        if (el.breadcrumbEmpresa) {
            el.breadcrumbEmpresa.textContent = (currentCompany.name || 'EMPRESA').toUpperCase();
            el.breadcrumbEmpresa.parentElement.setAttribute('href', `home.html?empresa=${companyId}`);
        }
        configUrl = currentCompany.configUrl || 'portal-config.json';

        // 2. Cargar Configuración de Empresa
        try {
            const confRes = await fetch(configUrl + '?t=' + Date.now());
            if (confRes.ok) {
                fullConfig = await confRes.json();
            }
        } catch (e) {
            console.warn('Error al cargar configuración de empresa, usando estructura por defecto.', e);
        }

        if (!fullConfig || typeof fullConfig !== 'object') {
            fullConfig = { portal: { name: 'nora CDE' }, projects: [] };
        }
        if (!Array.isArray(fullConfig.projects)) {
            fullConfig.projects = [];
        }

        activeProject = fullConfig.projects.find(p => p.slug === projectSlug);
        if (!activeProject) {
            // Inicializar proyecto nuevo si no existe todavía en el archivo
            activeProject = {
                name: (projectSlug ? projectSlug.replace(/[-_]/g, ' ') : 'Proyecto').toUpperCase(),
                slug: projectSlug || 'nuevo-proyecto',
                city: 'Bogotá',
                status: 'Activo',
                equiposDeTarea: [],
                members: [],
                dataSources: {},
                landing: { map: { lat: 4.711, lng: -74.0721, zoom: 13 } }
            };
            fullConfig.projects.push(activeProject);
        }

        if (el.breadcrumbProyecto) {
            el.breadcrumbProyecto.textContent = (activeProject.name || projectSlug || 'PROYECTO').toUpperCase();
        }
        
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
    }

    // --- LLENAR INPUTS ---
    function fillInputs() {
        if (!activeProject) return;

        // General info
        if (el.projName) el.projName.value = activeProject.name || '';
        if (el.projSlug) el.projSlug.value = activeProject.slug || '';
        if (el.projCity) el.projCity.value = activeProject.city || '';
        if (el.projStatus) el.projStatus.value = activeProject.status || '';

        // Branding
        if (el.projLogo) el.projLogo.value = activeProject.landing.logo || '';
        if (el.projEyebrow) el.projEyebrow.value = activeProject.landing.eyebrow || '';
        if (el.projTitle) el.projTitle.value = activeProject.landing.title || '';
        if (el.projSubtitle) el.projSubtitle.value = activeProject.landing.subtitle || '';

        // Map
        if (el.projAddress) el.projAddress.value = activeProject.landing.address || '';
        if (el.projLat) el.projLat.value = activeProject.landing.map.lat || 4.711;
        if (el.projLng) el.projLng.value = activeProject.landing.map.lng || -74.0721;

        // Datasources
        if (el.dsDriveFolderName) el.dsDriveFolderName.value = activeProject.dataSources.driveFolderName || '';
        if (el.dsDriveFolderId) el.dsDriveFolderId.value = activeProject.dataSources.driveFolderId || '';
        if (el.dsDriveScriptUrl) el.dsDriveScriptUrl.value = activeProject.dataSources.driveScriptUrl || '';
        if (el.dsStatusSheetId) el.dsStatusSheetId.value = activeProject.dataSources.statusSheetId || '';
        if (el.dsStatusScriptUrl) el.dsStatusScriptUrl.value = activeProject.dataSources.statusScriptUrl || '';
        if (el.dsCantidadesSheetId) el.dsCantidadesSheetId.value = activeProject.dataSources.cantidadesSheetId || '';
        if (el.dsCantidadesScriptUrl) el.dsCantidadesScriptUrl.value = activeProject.dataSources.cantidadesScriptUrl || '';

        // Listeners for live update of activeProject
        const bindInput = (domEl, setter) => {
            if (!domEl) return;
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

        if (el.projLat) el.projLat.addEventListener('change', updateMapFromInputs);
        if (el.projLng) el.projLng.addEventListener('change', updateMapFromInputs);
    }

    // --- MAPA LEAFLET ---
    function initMap() {
        const mapContainer = document.getElementById('settings-map');
        if (typeof L === 'undefined' || !mapContainer) return;

        const coords = [activeProject.landing.map.lat, activeProject.landing.map.lng];
        const zoom = activeProject.landing.map.zoom || 13;

        try {
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
                if (el.projLat) el.projLat.value = fixedLat;
                if (el.projLng) el.projLng.value = fixedLng;
                activeProject.landing.map.lat = fixedLat;
                activeProject.landing.map.lng = fixedLng;
            });

            leafletMap.on('click', (e) => {
                const fixedLat = parseFloat(e.latlng.lat.toFixed(6));
                const fixedLng = parseFloat(e.latlng.lng.toFixed(6));
                mapMarker.setLatLng(e.latlng);
                if (el.projLat) el.projLat.value = fixedLat;
                if (el.projLng) el.projLng.value = fixedLng;
                activeProject.landing.map.lat = fixedLat;
                activeProject.landing.map.lng = fixedLng;
            });

            leafletMap.on('zoomend', () => {
                activeProject.landing.map.zoom = leafletMap.getZoom();
            });
        } catch (e) {
            console.warn('Leaflet map error:', e);
        }
    }

    // --- TAB: GESTIÓN DE MIEMBROS ---
    function renderMembersTab() {
        if (!el.projectMembersCount || !el.directoryTableBody) return;
        el.projectMembersCount.textContent = `${(activeProject.members || []).length} Miembros Asignados`;
        const query = (el.directorySearch ? el.directorySearch.value : '').toLowerCase().trim();
        
        // Build list of users strictly belonging to this company from currentCompany.members
        const companyMembers = Array.isArray(currentCompany?.members) ? currentCompany.members : [];
        const userMap = new Map();

        // 1. Add all members configured in the company
        companyMembers.forEach(m => {
            if (!m.email) return;
            const email = m.email.toLowerCase().trim();
            userMap.set(email, {
                nombre: m.name || email.split('@')[0],
                email: email,
                empresa: getUserRegisteredCompany(email),
                rol: m.role || 'INVITADO',
                especialidad: m.especialidad || '',
                cargo: m.cargo || ''
            });
        });

        // 2. Enrich with allDirectoryUsers metadata if available, OR if activeProject.members has an already assigned user
        if (Array.isArray(allDirectoryUsers)) {
            allDirectoryUsers.forEach(du => {
                if (!du.email) return;
                const email = du.email.toLowerCase().trim();
                if (userMap.has(email)) {
                    const existing = userMap.get(email);
                    userMap.set(email, {
                        ...existing,
                        nombre: du.nombre || existing.nombre,
                        empresa: getUserRegisteredCompany(email),
                        rol: du.rol || existing.rol,
                        especialidad: du.especialidad || existing.especialidad,
                        cargo: du.cargo || existing.cargo
                    });
                } else if ((activeProject.members || []).some(pm => pm.toLowerCase().trim() === email)) {
                    // Only include if already explicitly assigned to this project
                    userMap.set(email, {
                        nombre: du.nombre || email.split('@')[0],
                        email: email,
                        empresa: getUserRegisteredCompany(email),
                        rol: du.rol || 'INVITADO',
                        especialidad: du.especialidad || '',
                        cargo: du.cargo || ''
                    });
                }
            });
        }

        // 3. Ensure any member in activeProject.members has an entry even if not in directory
        (activeProject.members || []).forEach(pm => {
            const email = pm.toLowerCase().trim();
            if (!userMap.has(email)) {
                userMap.set(email, {
                    nombre: email.split('@')[0],
                    email: email,
                    empresa: getUserRegisteredCompany(email),
                    rol: 'Colaborador',
                    especialidad: '',
                    cargo: ''
                });
            }
        });

        const availableUsers = Array.from(userMap.values());

        // Filter users by search query
        const filtered = availableUsers.filter(u => {
            const matchName = (u.nombre || '').toLowerCase().includes(query);
            const matchEmail = (u.email || '').toLowerCase().includes(query);
            const matchEmpresa = (u.empresa || '').toLowerCase().includes(query);
            return matchName || matchEmail || matchEmpresa;
        });

        if (filtered.length === 0) {
            el.directoryTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="py-8 px-4 text-center text-xs text-gray-400 italic">
                        No se encontraron usuarios de ${escapeHtml(currentCompany ? currentCompany.name : 'la empresa')} en el directorio.
                    </td>
                </tr>
            `;
            return;
        }

        el.directoryTableBody.innerHTML = filtered.map(u => {
            const email = u.email.toLowerCase().trim();
            const isAssigned = (activeProject.members || []).some(m => m.toLowerCase().trim() === email);

            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td class="py-3 px-4">
                        <div class="font-bold text-gray-900 dark:text-white">${escapeHtml(u.nombre || 'Sin Nombre')}</div>
                        <div class="text-xs text-gray-500">${escapeHtml(u.empresa || currentCompany?.name || 'Empresa')}</div>
                    </td>
                    <td class="py-3 px-4 text-xs font-mono">
                        <div class="text-gray-700 dark:text-gray-300">${escapeHtml(email)}</div>
                        <span class="inline-block mt-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-700 font-sans font-semibold text-gray-600 dark:text-gray-300 text-[10px] uppercase tracking-wider">${escapeHtml(u.cargo || u.especialidad || 'Sin Cargo')}</span>
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
        if (!activeProject.members) activeProject.members = [];
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

    if (el.directorySearch) {
        el.directorySearch.addEventListener('input', renderMembersTab);
    }

    // --- TAB: EQUIPOS DE TAREA ---
    let currentTeamsGroupBy = 'none';

    window.setTeamsGroupBy = function(groupType) {
        currentTeamsGroupBy = groupType;
        
        const btns = {
            none: document.getElementById('btn-tgroup-none'),
            team: document.getElementById('btn-tgroup-team'),
            role: document.getElementById('btn-tgroup-role'),
            company: document.getElementById('btn-tgroup-company')
        };
        
        Object.keys(btns).forEach(key => {
            const btn = btns[key];
            if (!btn) return;
            if (key === groupType) {
                btn.className = 'px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white transition-all font-bold';
            } else {
                btn.className = 'px-2.5 py-1 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all';
            }
        });

        renderTeamsTab();
    };

    if (el.teamsMembersSearch) {
        el.teamsMembersSearch.addEventListener('input', renderTeamsTab);
    }

    function renderTeamsTab() {
        if (!activeProject) return;
        if (!activeProject.equiposDeTarea) {
            activeProject.equiposDeTarea = [];
        }

        // Render teams list pills
        if (el.teamsListContainer) {
            if (activeProject.equiposDeTarea.length === 0) {
                el.teamsListContainer.innerHTML = `<div class="text-xs text-gray-400 italic py-2">Sin equipos de tarea creados.</div>`;
            } else {
                el.teamsListContainer.innerHTML = activeProject.equiposDeTarea.map((team, tIndex) => {
                    return `
                        <div class="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-900/50 px-3 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-sm">
                            <span>${escapeHtml(team.name)}</span>
                            <button onclick="deleteTeam(${tIndex})" class="text-indigo-400 hover:text-rose-600 transition-colors flex items-center" title="Eliminar equipo">
                                <span class="material-symbols-outlined text-[14px]">close</span>
                            </button>
                        </div>
                    `;
                }).join('');
            }
        }

        // Render project members team assignment table
        if (!el.teamsMembersTableBody) return;
        if (!activeProject.members || activeProject.members.length === 0) {
            el.teamsMembersTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="py-8 px-4 text-center text-xs text-gray-400 italic">
                        No hay personal asignado al proyecto. Asígnalos en la pestaña "Personal Proyecto".
                    </td>
                </tr>
            `;
            return;
        }

        const query = (el.teamsMembersSearch ? el.teamsMembersSearch.value : (document.getElementById('teams-members-search')?.value || '')).toLowerCase().trim();
        const companyMembers = Array.isArray(currentCompany?.members) ? currentCompany.members : [];

        // Build member objects
        const memberList = activeProject.members.map(email => {
            const cleanEmail = email.toLowerCase().trim();
            
            // Check company members first for rich metadata
            const compMember = companyMembers.find(cm => cm.email && cm.email.toLowerCase().trim() === cleanEmail);
            // Then directory users
            const dirUser = allDirectoryUsers.find(du => du.email && du.email.toLowerCase().trim() === cleanEmail);

            const displayName = compMember?.name || dirUser?.nombre || cleanEmail.split('@')[0];
            const displayRole = compMember?.cargo || compMember?.role || dirUser?.cargo || dirUser?.especialidad || dirUser?.rol || 'Colaborador';
            const displayCompany = getUserRegisteredCompany(cleanEmail);

            // Find assigned team
            let assignedTeamName = '';
            if (activeProject.equiposDeTarea) {
                const userTeam = activeProject.equiposDeTarea.find(team => 
                    team.members && team.members.some(m => m.toLowerCase().trim() === cleanEmail)
                );
                if (userTeam) {
                    assignedTeamName = userTeam.name.toUpperCase().trim();
                }
            }

            return {
                email: cleanEmail,
                name: displayName,
                role: displayRole,
                company: displayCompany,
                teamName: assignedTeamName
            };
        });

        // Filter by search query
        const filteredMembers = memberList.filter(m => {
            const matchName = (m.name || '').toLowerCase().includes(query);
            const matchEmail = (m.email || '').toLowerCase().includes(query);
            const matchRole = (m.role || '').toLowerCase().includes(query);
            const matchCompany = (m.company || '').toLowerCase().includes(query);
            const matchTeam = (m.teamName || '').toLowerCase().includes(query);
            return matchName || matchEmail || matchRole || matchCompany || matchTeam;
        });

        if (filteredMembers.length === 0) {
            el.teamsMembersTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="py-8 px-4 text-center text-xs text-gray-400 italic">
                        No se encontraron miembros que coincidan con la búsqueda.
                    </td>
                </tr>
            `;
            return;
        }

        // Helper to render a member row
        const renderRow = (m) => {
            const teamOptions = (activeProject.equiposDeTarea || []).map(team => {
                const name = team.name.toUpperCase().trim();
                const isSelected = (name === m.teamName);
                return `<option value="${escapeHtml(name)}" ${isSelected ? 'selected' : ''}>${escapeHtml(name)}</option>`;
            }).join('');

            return `
                <tr class="hover:bg-gray-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td class="py-3 px-4 text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">${escapeHtml(m.role)}</td>
                    <td class="py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-400">${escapeHtml(m.company)}</td>
                    <td class="py-3 px-4 font-bold text-gray-900 dark:text-white">${escapeHtml(m.name)}</td>
                    <td class="py-3 px-4 text-xs font-mono text-gray-500 dark:text-gray-400">${escapeHtml(m.email)}</td>
                    <td class="py-3 px-4">
                        <select onchange="changeUserTeam('${m.email}', this.value)" class="w-full rounded-xl border-slate-200 dark:border-border-dark dark:bg-slate-800 text-xs py-1.5 font-semibold focus:ring-2 focus:ring-primary">
                            <option value="">-- SIN EQUIPO --</option>
                            ${teamOptions}
                        </select>
                    </td>
                </tr>
            `;
        };

        // Render according to grouping
        if (currentTeamsGroupBy === 'none') {
            el.teamsMembersTableBody.innerHTML = filteredMembers.map(renderRow).join('');
        } else {
            // Grouping logic
            const groups = {};
            filteredMembers.forEach(m => {
                let g = 'Otros';
                if (currentTeamsGroupBy === 'team') {
                    g = m.teamName ? m.teamName : 'SIN EQUIPO DE TAREA';
                } else if (currentTeamsGroupBy === 'role') {
                    g = m.role ? m.role.toUpperCase() : 'SIN CARGO / ROL';
                } else if (currentTeamsGroupBy === 'company') {
                    g = m.company ? m.company.toUpperCase() : 'SIN EMPRESA';
                }
                if (!groups[g]) groups[g] = [];
                groups[g].push(m);
            });

            const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
                if (a.startsWith('SIN ')) return 1;
                if (b.startsWith('SIN ')) return -1;
                return a.localeCompare(b);
            });

            let html = '';
            sortedGroupKeys.forEach(g => {
                const count = groups[g].length;
                html += `
                    <tr class="bg-gray-100/90 dark:bg-slate-800/90 border-y border-border-light dark:border-border-dark">
                        <td colspan="5" class="py-2 px-4">
                            <div class="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                <span>${escapeHtml(g)}</span>
                                <span class="text-[10px] px-2 py-0.5 rounded-full bg-white dark:bg-slate-700 text-gray-500 dark:text-gray-300 font-semibold shadow-sm">${count} ${count === 1 ? 'persona' : 'personas'}</span>
                            </div>
                        </td>
                    </tr>
                `;
                html += groups[g].map(renderRow).join('');
            });

            el.teamsMembersTableBody.innerHTML = html;
        }
    }

    window.deleteTeam = function (index) {
        if (!activeProject || !activeProject.equiposDeTarea) return;
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
    if (el.copyJsonBtn) {
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
    }

    if (el.downloadJsonBtn) {
        el.downloadJsonBtn.addEventListener('click', () => {
            try {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullConfig, null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", configUrl || 'portal-config.json');
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
                window.showAlert('Configuración descargada localmente.', 'success');
            } catch (e) {
                window.showAlert('Error al descargar JSON: ' + e.message, 'error');
            }
        });
    }

    if (el.saveGithubBtn) {
        el.saveGithubBtn.addEventListener('click', async () => {
            let token = localStorage.getItem('github_pat');
            if (!token) {
                if (el.githubPatInput) el.githubPatInput.value = '';
                if (el.tokenModal) el.tokenModal.classList.remove('hidden');
                window.showAlert('Se requiere un Token de acceso para guardar cambios en la nube.', 'error');
                return;
            }

            const repo = 'camilomartg-svg/bim';
            const branch = 'main';
            const fileTarget = configUrl || 'portal-config.json';
            const files = [fileTarget, `docs/${fileTarget}`];
            const content = JSON.stringify(fullConfig, null, 2);

            window.showAlert('Guardando cambios en la nube... Por favor espera.', 'info');

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
                            throw new Error('Token inválido o expirado. Ingrésalo nuevamente.');
                        }
                        throw new Error(`Error actualizando ${path}: ${putRes.statusText}`);
                    }
                }

                window.showAlert('Configuración guardada exitosamente.', 'success');
            } catch (err) {
                window.showAlert(err.message, 'error');
            }
        });
    }

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
