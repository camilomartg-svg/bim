// =========================================================================
// GESTOR DE EQUIPOS DEL PROYECTO (ESTÁNDAR ISO 19650-2) - NORA CDE
// =========================================================================

(function () {
  'use strict';

  // --- ESTADO GLOBAL ---
  let companyId = '';
  let projectSlug = '';
  let currentCompany = null;
  let configUrl = '';
  let fullConfig = { portal: { name: 'nora CDE' }, projects: [] };
  let activeProject = null;
  
  let currentUser = null;
  let userRoleType = 'VIEWER'; // 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'PROJECT_ADMIN' | 'DELIVERY_LEAD' | 'MEMBER' | 'VIEWER'
  let canManageProjectAdmins = false;
  let canManageProjectStructure = false;

  let allDirectoryUsers = [];
  let allCompaniesList = [];

  // --- ESTADO DEL DIAGRAMA (ZOOM, PAN Y VISTAS) ---
  let diagramViewMode = 'radial'; // 'radial' | 'cards'
  let zoomScale = 1.0;
  const MIN_ZOOM = 0.3;
  const MAX_ZOOM = 3.0;
  const ZOOM_STEP = 0.1;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx2RAQx_8K4o22xE0Mw-ETc7K_58vIoi6-PgVi64u80inuiw144ks3cgWSdCtXqIgB02g/exec';

  // --- SELECCIÓN DE ELEMENTOS DOM ---
  const el = {
    backBtn: document.getElementById('back-btn'),
    breadcrumbEmpresa: document.getElementById('breadcrumb-empresa'),
    breadcrumbProyecto: document.getElementById('breadcrumb-proyecto'),
    userRoleBadge: document.getElementById('user-role-badge'),
    userDisplayName: document.getElementById('user-display-name'),
    userDisplayRole: document.getElementById('user-display-role'),
    themeToggle: document.getElementById('theme-toggle'),
    saveBtn: document.getElementById('save-btn'),
    githubTokenBtn: document.getElementById('github-token-btn'),
    githubPatInput: document.getElementById('github-pat-input'),
    
    // Metrics
    metricTotalMembers: document.getElementById('metric-total-members'),
    metricProjectAdmins: document.getElementById('metric-project-admins'),
    metricDeliveryTeams: document.getElementById('metric-delivery-teams'),
    metricTaskTeams: document.getElementById('metric-task-teams'),

    // Governance banner
    governanceTitle: document.getElementById('governance-title'),
    governanceDesc: document.getElementById('governance-desc'),
    userPermissionPill: document.getElementById('user-permission-pill'),

    // Diagram stage
    diagramDeliveryClusters: document.getElementById('diagram-delivery-clusters'),
    diagramAdminName: document.getElementById('diagram-admin-name'),
    diagramAdminCount: document.getElementById('diagram-admin-count'),
    isoDiagramCanvas: document.getElementById('iso-diagram-canvas'),
    isoDiagramSvg: document.getElementById('iso-diagram-svg'),
    isoDiagramNodes: document.getElementById('iso-diagram-nodes'),
    isoDiagramRadialView: document.getElementById('iso-diagram-radial-view'),
    isoDiagramCardView: document.getElementById('iso-diagram-card-view'),
    isoDiagramViewportWrapper: document.getElementById('iso-diagram-viewport-wrapper'),
    diagramRadialControls: document.getElementById('diagram-radial-controls'),

    // Tab panels & containers
    projectAdminsContainer: document.getElementById('project-admins-container'),
    adminActionControls: document.getElementById('admin-action-controls'),
    deliveryTeamsContainer: document.getElementById('delivery-teams-container'),
    deliveryActionControls: document.getElementById('delivery-action-controls'),
    taskTeamsContainer: document.getElementById('task-teams-container'),
    taskActionControls: document.getElementById('task-action-controls'),
    
    // Directory
    directorySearchInput: document.getElementById('directory-search-input'),
    directoryRoleFilter: document.getElementById('directory-role-filter'),
    directoryTableBody: document.getElementById('directory-table-body'),
    addMemberBtn: document.getElementById('add-member-btn'),
    exportExcelBtn: document.getElementById('export-excel-btn'),

    // Toast
    toastBanner: document.getElementById('toast-banner'),
    toastIcon: document.getElementById('toast-icon'),
    toastMessage: document.getElementById('toast-message')
  };

  // --- HELPERS DE USUARIOS Y EMPRESAS ---
  function getUserRegisteredCompany(email) {
    if (!email) return 'Sin Empresa';
    const clean = email.toLowerCase().trim();

    const companyMembers = Array.isArray(currentCompany?.members) ? currentCompany.members : [];
    const curCompMember = companyMembers.find(cm => cm.email && cm.email.toLowerCase().trim() === clean);
    if (curCompMember) {
      if (curCompMember.empresaUsuario && curCompMember.empresaUsuario.trim()) return curCompMember.empresaUsuario.trim();
      if (curCompMember.role === 'ADMINISTRADOR_EMPRESA' || curCompMember.role === 'MIEMBRO') return currentCompany?.name || 'Empresa';
    }

    if (Array.isArray(allCompaniesList)) {
      for (const comp of allCompaniesList) {
        if (comp.deleted) continue;
        if (Array.isArray(comp.members)) {
          const found = comp.members.find(m => m.email && m.email.toLowerCase().trim() === clean);
          if (found && found.empresaUsuario && found.empresaUsuario.trim()) return found.empresaUsuario.trim();
        }
      }
      for (const comp of allCompaniesList) {
        if (comp.deleted) continue;
        if (Array.isArray(comp.admins) && comp.admins.some(a => a.toLowerCase().trim() === clean)) {
          return comp.name;
        }
      }
    }
    return 'Sin Empresa';
  }

  function getUserRegisteredName(email) {
    if (!email) return '';
    const clean = email.toLowerCase().trim();

    if (Array.isArray(allDirectoryUsers)) {
      const dirUser = allDirectoryUsers.find(du => du.email && du.email.toLowerCase().trim() === clean);
      if (dirUser && dirUser.nombre && dirUser.nombre.trim() && dirUser.nombre.trim().toLowerCase() !== 'nuevo usuario') {
        return dirUser.nombre.trim();
      }
    }

    const companyMembers = Array.isArray(currentCompany?.members) ? currentCompany.members : [];
    const curCompMember = companyMembers.find(cm => cm.email && cm.email.toLowerCase().trim() === clean);
    if (curCompMember && curCompMember.name && curCompMember.name.trim() && curCompMember.name.trim().toLowerCase() !== 'nuevo usuario') {
      return curCompMember.name.trim();
    }

    if (Array.isArray(allCompaniesList)) {
      for (const comp of allCompaniesList) {
        if (comp.deleted) continue;
        if (Array.isArray(comp.members)) {
          const found = comp.members.find(m => m.email && m.email.toLowerCase().trim() === clean);
          if (found && found.name && found.name.trim() && found.name.trim().toLowerCase() !== 'nuevo usuario') {
            return found.name.trim();
          }
        }
      }
    }

    return clean.split('@')[0];
  }

  function getUserMetadata(email) {
    const clean = (email || '').toLowerCase().trim();
    const name = getUserRegisteredName(clean);
    const company = getUserRegisteredCompany(clean);
    
    // Directory details
    const dirUser = Array.isArray(allDirectoryUsers) ? allDirectoryUsers.find(du => du.email && du.email.toLowerCase().trim() === clean) : null;
    const compMember = Array.isArray(currentCompany?.members) ? currentCompany.members.find(m => m.email && m.email.toLowerCase().trim() === clean) : null;

    const cargo = compMember?.cargo || dirUser?.cargo || dirUser?.especialidad || 'Participante';
    const especialidad = dirUser?.especialidad || compMember?.especialidad || '';

    return { email: clean, name, company, cargo, especialidad };
  }

  // --- NOTIFICACIONES TOAST ---
  window.showToast = function (message, type = 'info') {
    if (!el.toastBanner || !el.toastMessage) return;
    el.toastMessage.textContent = message;
    el.toastBanner.className = 'fixed bottom-6 right-6 z-50 rounded-2xl p-4 shadow-xl flex items-start gap-3 transition-all duration-300 transform translate-y-0 opacity-100 max-w-md w-full border';
    
    if (type === 'success') {
      el.toastBanner.classList.add('bg-emerald-50', 'text-emerald-800', 'border-emerald-200', 'dark:bg-emerald-950/90', 'dark:text-emerald-200', 'dark:border-emerald-800');
      if (el.toastIcon) el.toastIcon.textContent = 'check_circle';
    } else if (type === 'error') {
      el.toastBanner.classList.add('bg-rose-50', 'text-rose-800', 'border-rose-200', 'dark:bg-rose-950/90', 'dark:text-rose-200', 'dark:border-rose-800');
      if (el.toastIcon) el.toastIcon.textContent = 'error';
    } else {
      el.toastBanner.classList.add('bg-blue-50', 'text-blue-800', 'border-blue-200', 'dark:bg-slate-900/90', 'dark:text-blue-200', 'dark:border-slate-800');
      if (el.toastIcon) el.toastIcon.textContent = 'info';
    }

    setTimeout(window.hideToast, 4500);
  };

  window.hideToast = function () {
    if (!el.toastBanner) return;
    el.toastBanner.className = 'fixed bottom-6 right-6 z-50 transform translate-y-20 opacity-0 transition-all duration-300 max-w-md w-full rounded-2xl p-4 shadow-xl flex items-start gap-3';
  };

  // --- TEMA CLARO / OSCURO ---
  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      if (el.themeToggle) el.themeToggle.querySelector('.material-symbols-outlined').textContent = 'light_mode';
    } else {
      document.documentElement.classList.remove('dark');
      if (el.themeToggle) el.themeToggle.querySelector('.material-symbols-outlined').textContent = 'dark_mode';
    }
  }

  const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(savedTheme);
  if (el.themeToggle) {
    el.themeToggle.addEventListener('click', () => {
      const nextTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
      localStorage.setItem('theme', nextTheme);
      applyTheme(nextTheme);
    });
  }

  // --- NAVEGACIÓN ENTRE TABS ---
  window.switchTab = function (targetTab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === targetTab) {
        btn.classList.add('active', 'bg-slate-900', 'text-white', 'dark:bg-white', 'dark:text-slate-900', 'shadow-sm');
        btn.classList.remove('text-slate-600', 'dark:text-slate-400', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
      } else {
        btn.classList.remove('active', 'bg-slate-900', 'text-white', 'dark:bg-white', 'dark:text-slate-900', 'shadow-sm');
        btn.classList.add('text-slate-600', 'dark:text-slate-400', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
      }
    });

    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.add('hidden'));
    const activePanel = document.getElementById(`tab-content-${targetTab}`);
    if (activePanel) activePanel.classList.remove('hidden');
  };

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      window.switchTab(target);
    });
  });

  // --- MODALES (OPEN / CLOSE) ---
  window.openModal = function (modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove('hidden');
  };

  window.closeModal = function (modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.add('hidden');
  };

  // --- EVALUACIÓN DE ROLES Y PERMISOS ISO 19650 ---
  function evaluatePermissions() {
    currentUser = JSON.parse(sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount') || 'null');
    const email = (currentUser?.username || currentUser?.email || currentUser?.userAccount || '').toLowerCase().trim();

    const superAdmins = ['imagina3ddesign@gmail.com', 'mcmartinezg@unal.edu.co'];
    const isSuperAdmin = superAdmins.includes(email) || currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'SUPER_ADMINISTRADOR';

    const companyAdmins = Array.isArray(currentCompany?.admins) ? currentCompany.admins.map(a => a.toLowerCase().trim()) : [];
    const memberMatch = Array.isArray(currentCompany?.members) ? currentCompany.members.find(m => m.email && m.email.toLowerCase().trim() === email) : null;
    const isMemberAdmin = memberMatch && (memberMatch.role === 'ADMINISTRADOR_EMPRESA' || memberMatch.role === 'ADMINISTRADOR');

    const isCompanyAdmin = isSuperAdmin || companyAdmins.includes(email) || isMemberAdmin || (currentUser?.adminEmpresaId && currentUser?.adminEmpresaId === companyId && (currentUser?.role === 'ADMINISTRADOR_EMPRESA' || currentUser?.role === 'SUPER_ADMINISTRADOR' || currentUser?.role === 'SUPER_ADMIN'));

    const projectAdmins = Array.isArray(activeProject?.iso19650?.projectAdmins)
      ? activeProject.iso19650.projectAdmins.map(a => a.toLowerCase().trim())
      : [];
    const isProjectAdmin = isCompanyAdmin || projectAdmins.includes(email);

    // Is Lead in any Delivery Team?
    const isDeliveryLead = (activeProject?.iso19650?.deliveryTeams || []).some(dt => (dt.leadEmail || '').toLowerCase().trim() === email);

    // Check project member
    const isMember = (activeProject?.members || []).map(m => m.toLowerCase().trim()).includes(email);

    if (isSuperAdmin) userRoleType = 'SUPER_ADMIN';
    else if (isCompanyAdmin) userRoleType = 'COMPANY_ADMIN';
    else if (isProjectAdmin) userRoleType = 'PROJECT_ADMIN';
    else if (isDeliveryLead) userRoleType = 'DELIVERY_LEAD';
    else if (isMember) userRoleType = 'MEMBER';
    else userRoleType = 'VIEWER';

    // Governance capabilities
    canManageProjectAdmins = isSuperAdmin || isCompanyAdmin;
    canManageProjectStructure = isSuperAdmin || isCompanyAdmin || isProjectAdmin;

    // Update UI headers & badges
    if (el.userDisplayName) el.userDisplayName.textContent = getUserRegisteredName(email) || email || 'Invitado';
    if (el.userDisplayRole) {
      if (isSuperAdmin) el.userDisplayRole.textContent = 'Super Administrador';
      else if (isCompanyAdmin) el.userDisplayRole.textContent = 'Admin Empresa';
      else if (isProjectAdmin) el.userDisplayRole.textContent = 'Admin Proyecto (Adjudicador A)';
      else if (isDeliveryLead) el.userDisplayRole.textContent = 'Líder Entrega (Principal B)';
      else if (isMember) el.userDisplayRole.textContent = 'Miembro Proyecto';
      else el.userDisplayRole.textContent = 'Visitante / Lector';
    }

    if (el.userPermissionPill) {
      if (canManageProjectAdmins) {
        el.userPermissionPill.textContent = 'CONTROL TOTAL (EMPRESA)';
        el.userPermissionPill.className = 'shrink-0 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      } else if (canManageProjectStructure) {
        el.userPermissionPill.textContent = 'ADMIN PROYECTO (ADJUDICADOR)';
        el.userPermissionPill.className = 'shrink-0 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-sky-500/20 text-sky-300 border border-sky-500/30';
      } else {
        el.userPermissionPill.textContent = 'MODO LECTURA';
        el.userPermissionPill.className = 'shrink-0 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/10 text-slate-300 border border-white/10';
      }
    }
    // Toggle Action Controls visibility
    if (el.adminActionControls) el.adminActionControls.style.display = canManageProjectAdmins ? 'flex' : 'none';
    if (el.deliveryActionControls) el.deliveryActionControls.style.display = canManageProjectStructure ? 'flex' : 'none';
    if (el.taskActionControls) el.taskActionControls.style.display = (canManageProjectStructure || isDeliveryLead) ? 'flex' : 'none';
    if (el.addMemberBtn) el.addMemberBtn.style.display = canManageProjectStructure ? 'inline-flex' : 'none';
    if (el.saveBtn) el.saveBtn.style.display = (canManageProjectStructure || isDeliveryLead) ? 'inline-flex' : 'none';
  }

  // --- INICIALIZACIÓN DE LA ESTRUCTURA ISO 19650 ---
  function normalizeProjectIsoStructure() {
    if (!activeProject) return;

    if (!Array.isArray(activeProject.members)) {
      activeProject.members = [];
    }

    if (!activeProject.iso19650 || typeof activeProject.iso19650 !== 'object') {
      activeProject.iso19650 = {
        projectAdmins: [],
        deliveryTeams: []
      };
    }

    if (!Array.isArray(activeProject.iso19650.projectAdmins)) {
      activeProject.iso19650.projectAdmins = [];
    }

    if (!Array.isArray(activeProject.iso19650.deliveryTeams)) {
      activeProject.iso19650.deliveryTeams = [];
    }

    // Sincronizar/migrar desde activeProject.equiposDeTarea (creados en Configuración del Proyecto)
    if (Array.isArray(activeProject.equiposDeTarea) && activeProject.equiposDeTarea.length > 0) {
      activeProject.equiposDeTarea.forEach((t, idx) => {
        if (!t.name) return;
        const nameUpper = t.name.toUpperCase().trim();
        const tMembers = Array.isArray(t.members) ? t.members.map(m => m.toLowerCase().trim()) : [];

        // Buscar si ya existe un Equipo de Entrega con este nombre
        const normalizeName = str => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
        const normTarget = normalizeName(nameUpper);

        let dt = activeProject.iso19650.deliveryTeams.find(d => normalizeName(d.name || '') === normTarget);
        if (!dt) {
          dt = {
            id: 'deliv-' + idx + '-' + Date.now(),
            name: t.name.trim(),
            leadEmail: tMembers[0] || '',
            description: 'Equipo de entrega asignado a la producción de información.',
            members: [...tMembers],
            taskTeams: []
          };
          activeProject.iso19650.deliveryTeams.push(dt);
        } else {
          // Si ya existe, aseguramos que contenga todos los miembros asignados en la configuración
          tMembers.forEach(m => {
            if (!dt.members.map(dm => dm.toLowerCase().trim()).includes(m)) {
              dt.members.push(m);
            }
          });
          if (!dt.leadEmail && tMembers.length > 0) {
            dt.leadEmail = tMembers[0];
          }
        }

        // Asegurar que los miembros estén agregados a activeProject.members para evitar inconsistencias
        tMembers.forEach(m => {
          if (!activeProject.members.map(pm => pm.toLowerCase().trim()).includes(m)) {
            activeProject.members.push(m);
          }
        });
      });
    }

    // Automate Task Team members (all delivery team members except the leader, project/company/super admins)
    const superAdmins = ['imagina3ddesign@gmail.com', 'mcmartinezg@unal.edu.co'];
    const companyAdmins = Array.isArray(currentCompany?.admins) ? currentCompany.admins.map(a => a.toLowerCase().trim()) : [];
    const projectAdmins = Array.isArray(activeProject?.iso19650?.projectAdmins)
      ? activeProject.iso19650.projectAdmins.map(a => a.toLowerCase().trim())
      : [];

    (activeProject.iso19650.deliveryTeams || []).forEach(dt => {
      const lead = (dt.leadEmail || '').toLowerCase().trim();
      const ttMembers = (dt.members || []).filter(m => {
        const clean = m.toLowerCase().trim();
        const isLead = clean === lead;
        const isSuper = superAdmins.includes(clean);
        const isCompAdmin = companyAdmins.includes(clean);
        const isProjAdmin = projectAdmins.includes(clean);
        
        const memberMatch = Array.isArray(currentCompany?.members) 
          ? currentCompany.members.find(cm => cm.email && cm.email.toLowerCase().trim() === clean) 
          : null;
        const isMemberAdmin = memberMatch && (memberMatch.role === 'ADMINISTRADOR_EMPRESA' || memberMatch.role === 'ADMINISTRADOR');

        return !isLead && !isSuper && !isCompAdmin && !isProjAdmin && !isMemberAdmin;
      });
      (dt.taskTeams || []).forEach(tt => {
        tt.members = [...ttMembers];
      });
    });
  }

  // Mantener equiposDeTarea sincronizado de vuelta para compatibilidad con la configuración del proyecto
  function syncBackToEquiposDeTarea() {
    if (!activeProject || !activeProject.iso19650 || !Array.isArray(activeProject.iso19650.deliveryTeams)) return;
    
    activeProject.equiposDeTarea = activeProject.iso19650.deliveryTeams.map(dt => ({
      name: dt.name,
      members: [...(dt.members || [])]
    }));
  }

  // --- CARGA DE DATOS ---
  async function init() {
    const params = new URLSearchParams(window.location.search);
    companyId = params.get('empresa') || '';
    projectSlug = params.get('project') || '';

    // 1. Cargar Empresas
    let companies = [];
    try {
      const empRes = await fetch('empresas.json?t=' + Date.now());
      if (empRes.ok) {
        companies = await empRes.json();
        allCompaniesList = companies;
      }
    } catch (e) {
      console.warn('Error cargando empresas.json:', e);
    }

    if (!companyId && projectSlug) {
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
      if (!companyId) {
        const firstActive = companies.find(c => !c.deleted) || companies[0];
        companyId = firstActive ? firstActive.id : 'empresa3';
      }
    }

    currentCompany = companies.find(c => c.id === companyId) || { id: companyId || 'nora', name: 'Nora CDE', configUrl: 'portal-config.json' };
    configUrl = currentCompany.configUrl || 'portal-config.json';

    // 2. Breadcrumbs
    if (el.breadcrumbEmpresa) el.breadcrumbEmpresa.textContent = (currentCompany.name || 'EMPRESA').toUpperCase();
    if (el.backBtn) {
      el.backBtn.addEventListener('click', () => {
        const dest = `project-landing.html?project=${encodeURIComponent(projectSlug)}${companyId ? `&empresa=${encodeURIComponent(companyId)}` : ''}`;
        window.location.href = dest;
      });
    }

    // 3. Cargar Portal Config
    try {
      const confRes = await fetch(configUrl + '?t=' + Date.now());
      if (confRes.ok) {
        fullConfig = await confRes.json();
      }
    } catch (e) {
      console.warn('Error cargando portal config:', e);
    }

    if (!fullConfig || typeof fullConfig !== 'object') {
      fullConfig = { portal: { name: 'nora CDE' }, projects: [] };
    }
    if (!Array.isArray(fullConfig.projects)) fullConfig.projects = [];

    activeProject = fullConfig.projects.find(p => p.slug === projectSlug);
    if (!activeProject) {
      activeProject = {
        name: (projectSlug ? projectSlug.replace(/[-_]/g, ' ') : 'Proyecto').toUpperCase(),
        slug: projectSlug || 'nuevo-proyecto',
        members: [],
        iso19650: {
          projectAdmins: [],
          deliveryTeams: []
        }
      };
      fullConfig.projects.push(activeProject);
    }

    if (el.breadcrumbProyecto) el.breadcrumbProyecto.textContent = (activeProject.name || projectSlug || 'PROYECTO').toUpperCase();

    // 4. Cargar Directorio de Nora desde Google Apps Script
    try {
      const dirRes = await fetch(GOOGLE_SCRIPT_URL);
      if (dirRes.ok) {
        allDirectoryUsers = await dirRes.json();
      }
    } catch (e) {
      console.warn('Directorio Nora no disponible:', e);
    }

    // 5. Cargar Equipos de Tarea desde Google Sheets automáticamente
    try {
      const teamsRes = await fetch(`${GOOGLE_SCRIPT_URL}?action=getTeams&empresa=${encodeURIComponent(companyId)}&proyecto=${encodeURIComponent(projectSlug)}&t=${Date.now()}`);
      if (teamsRes.ok) {
        const remoteTeams = await teamsRes.json();
        if (Array.isArray(remoteTeams) && remoteTeams.length > 0) {
          if (!Array.isArray(activeProject.equiposDeTarea)) {
            activeProject.equiposDeTarea = [];
          }
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

    normalizeProjectIsoStructure();
    evaluatePermissions();
    renderAllViews();
    setupDiagramInteractions();
  }

  // --- RENDERIZADO GENERAL ---
  function renderAllViews() {
    normalizeProjectIsoStructure();
    updateMetrics();
    renderDiagramStage();
    renderProjectAdminsTab();
    renderDeliveryTeamsTab();
    renderDirectoryTab();
  }

  // --- 1. MÉTRICAS ---
  function updateMetrics() {
    if (!activeProject) return;
    const totalMembers = (activeProject.members || []).length;
    const totalAdmins = (activeProject.iso19650?.projectAdmins || []).length;
    const totalDelivery = (activeProject.iso19650?.deliveryTeams || []).length;
    
    let totalTasks = 0;
    (activeProject.iso19650?.deliveryTeams || []).forEach(dt => {
      totalTasks += (dt.taskTeams || []).length;
    });

    if (el.metricTotalMembers) el.metricTotalMembers.textContent = totalMembers;
    if (el.metricProjectAdmins) el.metricProjectAdmins.textContent = totalAdmins;
    if (el.metricDeliveryTeams) el.metricDeliveryTeams.textContent = totalDelivery;
    if (el.metricTaskTeams) el.metricTaskTeams.textContent = totalTasks;
  }

  // --- 2. DIAGRAMA VISUAL INTERACTIVO ISO 19650 ---
  function renderDiagramStage() {
    if (!activeProject) return;

    const projectAdmins = activeProject.iso19650?.projectAdmins || [];
    if (el.diagramAdminCount) {
      el.diagramAdminCount.textContent = `${projectAdmins.length} ${projectAdmins.length === 1 ? 'Administrador designado' : 'Administradores designados'}`;
    }
    if (el.diagramAdminName) {
      if (projectAdmins.length === 0) {
        el.diagramAdminName.textContent = 'Sin Administrador Asignado';
      } else if (projectAdmins.length === 1) {
        el.diagramAdminName.textContent = getUserRegisteredName(projectAdmins[0]);
      } else {
        el.diagramAdminName.textContent = `${getUserRegisteredName(projectAdmins[0])} (+${projectAdmins.length - 1})`;
      }
    }

    // Toggle view elements in DOM
    if (diagramViewMode === 'cards') {
      if (el.isoDiagramRadialView) el.isoDiagramRadialView.classList.add('hidden');
      if (el.isoDiagramCardView) el.isoDiagramCardView.classList.remove('hidden');
      if (el.diagramRadialControls) el.diagramRadialControls.classList.add('hidden');

      // Update toolbar segmented button classes
      const btnRadial = document.getElementById('btn-view-radial');
      const btnCards = document.getElementById('btn-view-cards');
      if (btnRadial) {
        btnRadial.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
      }
      if (btnCards) {
        btnCards.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm';
      }

      renderCardViewStage();
      return;
    } else {
      if (el.isoDiagramRadialView) el.isoDiagramRadialView.classList.remove('hidden');
      if (el.isoDiagramCardView) el.isoDiagramCardView.classList.add('hidden');
      if (el.diagramRadialControls) el.diagramRadialControls.classList.remove('hidden');

      // Update toolbar segmented button classes
      const btnRadial = document.getElementById('btn-view-radial');
      const btnCards = document.getElementById('btn-view-cards');
      if (btnRadial) {
        btnRadial.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm';
      }
      if (btnCards) {
        btnCards.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
      }
    }

    if (!el.isoDiagramNodes || !el.isoDiagramSvg) return;

    // Clear SVG canvas (preserving defs)
    const defs = el.isoDiagramSvg.querySelector('defs');
    el.isoDiagramSvg.innerHTML = '';
    if (defs) el.isoDiagramSvg.appendChild(defs);

    // Clear HTML nodes container
    el.isoDiagramNodes.innerHTML = '';

    const deliveryTeams = activeProject.iso19650?.deliveryTeams || [];

    const centerX = 450;
    const centerY = 325;

    // Helper: Draw offset double-headed arrow line in SVG
    function drawOffsetLine(x1, y1, x2, y2, offset1, offset2, color = '#94a3b8', isDashed = false) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) return;
      const ux = dx / dist;
      const uy = dy / dist;
      const sx = x1 + offset1 * ux;
      const sy = y1 + offset1 * uy;
      const ex = x2 - offset2 * ux;
      const ey = y2 - offset2 * uy;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', sx);
      line.setAttribute('y1', sy);
      line.setAttribute('x2', ex);
      line.setAttribute('y2', ey);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '1.5');
      if (isDashed) {
        line.setAttribute('stroke-dasharray', '3,3');
      }
      line.setAttribute('marker-end', 'url(#arrow-bi)');
      line.setAttribute('marker-start', 'url(#arrow-bi)');
      el.isoDiagramSvg.appendChild(line);
    }

    // Fichas siempre visibles: reemplazan los tooltips para leer el organigrama sin pasar el cursor.
    function addNodeInfo(title, detail, x, y, width = 150) {
      const label = document.createElement('div');
      label.className = 'absolute rounded-lg border border-slate-200/90 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-2 py-1 shadow-sm z-20 pointer-events-none text-[9px] leading-tight text-slate-500 dark:text-slate-400';
      label.style.left = `${x}px`;
      label.style.top = `${y}px`;
      label.style.width = `${width}px`;
      label.innerHTML = `<div class="font-black text-slate-800 dark:text-white truncate">${escapeHtml(title)}</div><div class="mt-0.5 truncate">${escapeHtml(detail)}</div>`;
      el.isoDiagramNodes.appendChild(label);
    }

    // Se conserva la firma para los nodos existentes, pero ya no se muestran tooltips al pasar el cursor.
    function setupTooltip() {}

    // 1. Draw Outer Circle: "1. Equipo de Proyecto"
    const projectCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    projectCircle.setAttribute('cx', centerX);
    projectCircle.setAttribute('cy', centerY);
    projectCircle.setAttribute('r', '290');
    projectCircle.setAttribute('stroke', '#cbd5e1');
    projectCircle.setAttribute('stroke-width', '2');
    projectCircle.setAttribute('stroke-dasharray', '5,5');
    projectCircle.setAttribute('fill', 'none');
    projectCircle.setAttribute('class', 'dark:stroke-slate-700/60');
    el.isoDiagramSvg.appendChild(projectCircle);

    // Label for Outer Circle
    const outerCircleLabel = document.createElement('div');
    outerCircleLabel.className = 'absolute px-3 py-0.5 rounded-full bg-slate-800/90 text-white font-mono text-[9px] font-black uppercase tracking-wider shadow-sm z-30 pointer-events-none';
    outerCircleLabel.style.left = `${centerX}px`;
    outerCircleLabel.style.top = '22px';
    outerCircleLabel.style.transform = 'translateX(-50%)';
    outerCircleLabel.innerHTML = '1. Equipo de Proyecto';
    el.isoDiagramNodes.appendChild(outerCircleLabel);

    // 2. Draw Central Hub: A. Adjudicador (Administrador)
    const nodeA = document.createElement('div');
    nodeA.className = 'absolute rounded-full bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white font-black flex items-center justify-center cursor-pointer shadow-lg shadow-sky-500/20 hover:scale-110 transition-transform border-4 border-white dark:border-slate-800 z-30 select-none';
    nodeA.style.left = `${centerX - 28}px`;
    nodeA.style.top = `${centerY - 28}px`;
    nodeA.style.width = '56px';
    nodeA.style.height = '56px';
    nodeA.innerHTML = '<span class="text-base">A</span>';

    setupTooltip(nodeA, () => {
      const names = projectAdmins.map(email => getUserRegisteredName(email));
      const listHtml = names.map(name => `<li>• ${escapeHtml(name)}</li>`).join('');
      return `
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="px-1.5 py-0.5 rounded bg-sky-500 text-white text-[9px] font-black uppercase">Rol A</span>
            <span class="font-bold text-slate-200">Adjudicador</span>
          </div>
          <div class="text-slate-300 text-[10px]">Administradores de Proyecto:</div>
          <ul class="text-[10px] text-slate-400 space-y-0.5 list-none pl-0">
            ${listHtml || '<li>• Sin administradores designados</li>'}
          </ul>
          <div class="text-[9px] text-indigo-400 mt-2 italic border-t border-slate-800 pt-1.5">Haz clic para ir a la pestaña de Administradores</div>
        </div>
      `;
    });

    addNodeInfo(
      'A · Administrador de Proyecto',
      projectAdmins.map(email => getUserRegisteredName(email)).join(', ') || 'Sin administrador asignado',
      centerX + 38,
      centerY - 22,
      180
    );

    nodeA.addEventListener('click', () => {
      window.switchTab('admins');
    });
    el.isoDiagramNodes.appendChild(nodeA);

    // Empty state if no delivery teams
    if (deliveryTeams.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'absolute text-center text-xs text-slate-400 italic bg-white/40 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700/60 p-4 w-72';
      emptyState.style.left = `${centerX - 144}px`;
      emptyState.style.top = `${centerY + 70}px`;
      emptyState.innerHTML = 'No hay Equipos de Entrega configurados.<br>Haz clic en "2. Equipos de Entrega" para agregar el primero.';
      el.isoDiagramNodes.appendChild(emptyState);
      updateDiagramTransform();
      return;
    }

    const N = deliveryTeams.length;
    const R_dist = 195;

    // Coordination ring connecting all B nodes
    if (N >= 2) {
      const coordCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      coordCircle.setAttribute('cx', centerX);
      coordCircle.setAttribute('cy', centerY);
      coordCircle.setAttribute('r', R_dist.toString());
      coordCircle.setAttribute('stroke', '#94a3b8');
      coordCircle.setAttribute('stroke-width', '1.5');
      coordCircle.setAttribute('stroke-dasharray', '4,4');
      coordCircle.setAttribute('fill', 'none');
      coordCircle.setAttribute('class', 'dark:stroke-slate-700/50');
      el.isoDiagramSvg.appendChild(coordCircle);
    }

    // Render radial Delivery Team Clusters (2) and members (C) / task teams (3)
    deliveryTeams.forEach((dt, i) => {
      const angle = (2 * Math.PI * i) / N - Math.PI / 2;
      const X_di = centerX + R_dist * Math.cos(angle);
      const Y_di = centerY + R_dist * Math.sin(angle);

      // Draw connection A <-> B
      drawOffsetLine(centerX, centerY, X_di, Y_di, 28, 22, '#3b82f6');

      // Delivery Team Circle (2) enclosing B and C
      const bubble2 = document.createElement('div');
      bubble2.className = 'absolute rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100/30 dark:bg-slate-900/30 shadow-inner z-10 pointer-events-none transition-all duration-300';
      bubble2.style.left = `${X_di - 80}px`;
      bubble2.style.top = `${Y_di - 80}px`;
      bubble2.style.width = '160px';
      bubble2.style.height = '160px';
      el.isoDiagramNodes.appendChild(bubble2);

      // Label "2"
      const badge2 = document.createElement('div');
      badge2.className = 'absolute h-5 w-5 rounded-full bg-slate-500/80 text-white font-mono text-[9px] font-black flex items-center justify-center shadow-sm z-30 pointer-events-none';
      badge2.style.left = `${X_di - 76}px`;
      badge2.style.top = `${Y_di - 76}px`;
      badge2.innerHTML = '2';
      el.isoDiagramNodes.appendChild(badge2);

      // B: Líder node (radius 21)
      const nodeB = document.createElement('div');
      nodeB.className = 'absolute rounded-full bg-blue-600 hover:bg-blue-700 text-white font-black flex items-center justify-center cursor-pointer shadow-md hover:scale-110 transition-transform border-2 border-white dark:border-slate-800 z-30 select-none';
      nodeB.style.left = `${X_di - 21}px`;
      nodeB.style.top = `${Y_di - 21}px`;
      nodeB.style.width = '42px';
      nodeB.style.height = '42px';
      nodeB.innerHTML = '<span class="text-sm">B</span>';

      const leadMeta = getUserMetadata(dt.leadEmail);
      setupTooltip(nodeB, () => `
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="px-1.5 py-0.5 rounded bg-blue-500 text-white text-[9px] font-black uppercase">Rol B</span>
            <span class="font-bold text-slate-200">Líder de Entrega</span>
          </div>
          <div class="text-slate-300 text-xs font-bold">${escapeHtml(dt.name)}</div>
          <div class="border-t border-slate-800 pt-1 space-y-0.5 text-[10px] text-slate-400">
            <div><strong>Líder:</strong> ${escapeHtml(leadMeta.name || 'Sin Líder Asignado')}</div>
            <div><strong>Email:</strong> ${escapeHtml(leadMeta.email || '-')}</div>
            <div><strong>Empresa:</strong> ${escapeHtml(leadMeta.company || '-')}</div>
          </div>
          <div class="text-[9px] text-indigo-400 mt-2 italic border-t border-slate-800 pt-1.5">Haz clic para ir a los Equipos de Entrega</div>
        </div>
      `);

      addNodeInfo(`B · ${dt.name}`, `Líder: ${leadMeta.name || 'Sin asignar'}`, X_di + 28, Y_di - 18, 155);

      nodeB.addEventListener('click', () => {
        window.switchTab('delivery');
        setTimeout(() => {
          const card = document.getElementById(`delivery-team-card-${dt.id}`);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.classList.add('ring-4', 'ring-purple-500');
            setTimeout(() => card.classList.remove('ring-4', 'ring-purple-500'), 2500);
          }
        }, 100);
      });
      el.isoDiagramNodes.appendChild(nodeB);

      // C: Member nodes
      const members = dt.members || [];
      const nonLeaderEmails = members.filter(m => (m || '').toLowerCase().trim() !== (dt.leadEmail || '').toLowerCase().trim());
      const M = nonLeaderEmails.length;

      if (M > 0) {
        const r_dist = 52;
        nonLeaderEmails.forEach((mEmail, j) => {
          const subAngle = (2 * Math.PI * j) / M - Math.PI / 2;
          const X_mj = X_di + r_dist * Math.cos(subAngle);
          const Y_mj = Y_di + r_dist * Math.sin(subAngle);

          // Draw connection B <-> C
          drawOffsetLine(X_di, Y_di, X_mj, Y_mj, 21, 15, '#c084fc');

          // C node
          const nodeC = document.createElement('div');
          nodeC.className = 'absolute rounded-full bg-purple-600 hover:bg-purple-700 text-white font-black flex items-center justify-center cursor-pointer shadow-sm hover:scale-110 transition-transform border-2 border-white dark:border-slate-800 z-30 select-none';
          nodeC.style.left = `${X_mj - 15}px`;
          nodeC.style.top = `${Y_mj - 15}px`;
          nodeC.style.width = '30px';
          nodeC.style.height = '30px';
          nodeC.innerHTML = '<span class="text-xs">C</span>';

          const mMeta = getUserMetadata(mEmail);
          const memberTeams = (dt.taskTeams || []).filter(tt => (tt.members || []).some(m => m.toLowerCase().trim() === mEmail.toLowerCase().trim()));

          // Green badge "3" if member of task teams (disciplines)
          if (memberTeams.length > 0) {
            const badge3 = document.createElement('div');
            badge3.className = 'absolute h-4 w-4 rounded-full bg-emerald-600 text-white font-mono text-[8px] font-black flex items-center justify-center border border-white dark:border-slate-800 shadow-sm z-40';
            badge3.style.left = `${X_mj + 5}px`;
            badge3.style.top = `${Y_mj - 15}px`;
            badge3.innerHTML = '3';
            el.isoDiagramNodes.appendChild(badge3);
          }

          setupTooltip(nodeC, () => {
            const teamListHtml = memberTeams.map(t => `<span class="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[9px] font-bold">${escapeHtml(t.name)}</span>`).join(' ');
            return `
              <div class="space-y-1.5">
                <div class="flex items-center gap-2">
                  <span class="px-1.5 py-0.5 rounded bg-purple-500 text-white text-[9px] font-black uppercase">Rol C</span>
                  <span class="font-bold text-slate-200">Adjudicatario (Miembro)</span>
                </div>
                <div class="border-t border-slate-800 pt-1 space-y-0.5 text-[10px] text-slate-400">
                  <div><strong>Nombre:</strong> ${escapeHtml(mMeta.name || 'Usuario')}</div>
                  <div><strong>Email:</strong> ${escapeHtml(mMeta.email || mEmail)}</div>
                  <div><strong>Empresa:</strong> ${escapeHtml(mMeta.company || '-')}</div>
                </div>
                ${memberTeams.length > 0 ? `
                  <div class="border-t border-slate-800 pt-1.5 space-y-1">
                    <div class="text-[9px] uppercase font-bold text-emerald-400">3. Equipos de Tarea (Especialidad):</div>
                    <div class="flex flex-wrap gap-1">${teamListHtml}</div>
                  </div>
                ` : ''}
              </div>
            `;
          });

          addNodeInfo('C · Adjudicatario', mMeta.name || mEmail, X_mj + 18, Y_mj - 13, 125);

          nodeC.addEventListener('click', () => {
            window.switchTab('delivery');
            setTimeout(() => {
              const card = document.getElementById(`delivery-team-card-${dt.id}`);
              if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.classList.add('ring-4', 'ring-purple-500');
                setTimeout(() => card.classList.remove('ring-4', 'ring-purple-500'), 2500);
              }
            }, 100);
          });

          el.isoDiagramNodes.appendChild(nodeC);
        });
      }
    });

    updateDiagramTransform();
  }

  function renderCardViewStage() {
    if (!el.diagramDeliveryClusters || !activeProject) return;

    const deliveryTeams = activeProject.iso19650?.deliveryTeams || [];

    if (deliveryTeams.length === 0) {
      el.diagramDeliveryClusters.innerHTML = `
        <div class="col-span-full py-12 text-center text-xs text-slate-400 italic bg-white/40 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          No hay Equipos de Entrega configurados.
        </div>
      `;
      return;
    }

    el.diagramDeliveryClusters.innerHTML = deliveryTeams.map(dt => {
      const leadMeta = getUserMetadata(dt.leadEmail);
      const members = dt.members || [];
      const nonLeaderEmails = members.filter(m => (m || '').toLowerCase().trim() !== (dt.leadEmail || '').toLowerCase().trim());
      const taskTeams = dt.taskTeams || [];

      const membersHtml = nonLeaderEmails.map(mEmail => {
        const mMeta = getUserMetadata(mEmail);
        return `
          <div class="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px]">
            <span class="h-5 w-5 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold text-[9px] shrink-0">
              C
            </span>
            <div class="truncate">
              <div class="font-bold text-slate-800 dark:text-slate-200 truncate">${escapeHtml(mMeta.name)}</div>
              <div class="text-slate-400 font-mono text-[9px] truncate">${escapeHtml(mEmail)}</div>
            </div>
          </div>
        `;
      }).join('') || `<div class="text-[10px] text-slate-400 italic py-1">Sin otros miembros asignados</div>`;

      const tasksHtml = taskTeams.map(tt => {
        return `
          <div class="flex items-center gap-1.5 py-1 px-2 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-medium border border-emerald-100 dark:border-emerald-900/40">
            <span class="material-symbols-outlined text-[12px]">task_alt</span>
            <span>${escapeHtml(tt.name)}</span>
          </div>
        `;
      }).join('');

      return `
        <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow">
          
          <!-- Team Name & Designation number 2 -->
          <div class="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div class="flex items-center gap-2 min-w-0">
              <span class="h-7 w-7 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-300 flex items-center justify-center font-black text-xs border border-purple-200 dark:border-purple-800 shrink-0">
                2
              </span>
              <h4 class="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider truncate">${escapeHtml(dt.name)}</h4>
            </div>
            <span class="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono uppercase tracking-wider shrink-0">Equipo B</span>
          </div>

          <!-- B: Lead -->
          <div class="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/45 border border-blue-100 dark:border-blue-900/40 space-y-1">
            <div class="text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <span class="material-symbols-outlined text-[12px]">stars</span> Adjudicatario Principal (Líder B)
            </div>
            <div class="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">${escapeHtml(leadMeta.name || 'Sin Líder Asignado')}</div>
            <div class="text-[9px] text-slate-400 font-mono truncate">${escapeHtml(leadMeta.email || '-')}</div>
            <div class="text-[9px] text-slate-400 truncate">${escapeHtml(leadMeta.company)} • ${escapeHtml(leadMeta.cargo)}</div>
          </div>

          <!-- C: Members List -->
          <div class="space-y-1.5">
            <div class="text-[9px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Miembros del Equipo (C)</div>
            <div class="grid grid-cols-1 gap-1.5 max-h-[140px] overflow-y-auto pr-1">
              ${membersHtml}
            </div>
          </div>

          <!-- 3: Tasks list -->
          ${tasksHtml ? `
            <div class="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
              <div class="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">3. Equipos de Tarea / Disciplinas</div>
              <div class="flex flex-wrap gap-1.5">${tasksHtml}</div>
            </div>
          ` : ''}
          
        </div>
      `;
    }).join('');
  }

  function updateDiagramTransform() {
    if (!el.isoDiagramViewportWrapper || !el.isoDiagramCanvas) return;
    const fitScale = Math.min(
      el.isoDiagramCanvas.clientWidth / 900,
      el.isoDiagramCanvas.clientHeight / 650
    );
    el.isoDiagramViewportWrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${fitScale * zoomScale})`;
    const zoomIndicator = document.getElementById('zoom-indicator');
    if (zoomIndicator) {
      zoomIndicator.textContent = `${Math.round(zoomScale * 100)}%`;
    }
  }

  function setupDiagramInteractions() {
    if (!el.isoDiagramCanvas) return;

    // Mouse drag (pan) events on canvas
    el.isoDiagramCanvas.addEventListener('mousedown', (e) => {
      // Only pan on left click
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      el.isoDiagramCanvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      updateDiagramTransform();
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        if (el.isoDiagramCanvas) {
          el.isoDiagramCanvas.style.cursor = 'grab';
        }
      }
    });

    // Zoom on wheel (scroll)
    el.isoDiagramCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = 1.1;
      let newScale = zoomScale;
      if (e.deltaY < 0) {
        newScale = Math.min(MAX_ZOOM, zoomScale * zoomFactor);
      } else {
        newScale = Math.max(MIN_ZOOM, zoomScale / zoomFactor);
      }
      zoomScale = newScale;
      updateDiagramTransform();
    }, { passive: false });

    // Toolbar Zoom Button handlers
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomReset = document.getElementById('btn-zoom-reset');

    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        zoomScale = Math.min(MAX_ZOOM, zoomScale + ZOOM_STEP);
        updateDiagramTransform();
      });
    }

    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        zoomScale = Math.max(MIN_ZOOM, zoomScale - ZOOM_STEP);
        updateDiagramTransform();
      });
    }

    if (btnZoomReset) {
      btnZoomReset.addEventListener('click', () => {
        zoomScale = 1.0;
        panX = 0;
        panY = 0;
        updateDiagramTransform();
      });
    }

    // View toggles
    const btnViewRadial = document.getElementById('btn-view-radial');
    const btnViewCards = document.getElementById('btn-view-cards');

    if (btnViewRadial) {
      btnViewRadial.addEventListener('click', () => {
        diagramViewMode = 'radial';
        renderDiagramStage();
      });
    }

    if (btnViewCards) {
      btnViewCards.addEventListener('click', () => {
        diagramViewMode = 'cards';
        renderDiagramStage();
      });
    }

    // Fullscreen Mode Toggle
    const btnFullscreen = document.getElementById('btn-fullscreen-toggle');
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => {
        toggleFullscreen();
      });
    }

    window.addEventListener('resize', updateDiagramTransform);
  }

  function toggleFullscreen() {
    if (!el.isoDiagramCanvas) return;
    const isFs = el.isoDiagramCanvas.classList.contains('diagram-fullscreen');
    const fsIcon = document.querySelector('.id-fs-icon');

    if (isFs) {
      el.isoDiagramCanvas.classList.remove('diagram-fullscreen');
      if (fsIcon) fsIcon.textContent = 'fullscreen';
      // Reset view to avoid drawing issues
      zoomScale = 1.0;
      panX = 0;
      panY = 0;
      updateDiagramTransform();
    } else {
      el.isoDiagramCanvas.classList.add('diagram-fullscreen');
      if (fsIcon) fsIcon.textContent = 'fullscreen_exit';
      // Center and scale slightly up inside fullscreen view
      zoomScale = 1.15;
      panX = 0;
      panY = 0;
      updateDiagramTransform();
      window.showToast('Presiona ESC o haz clic en el botón para salir de pantalla completa.', 'info');
    }
  }

  // Escape key to exit fullscreen
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (el.isoDiagramCanvas && el.isoDiagramCanvas.classList.contains('diagram-fullscreen')) {
        toggleFullscreen();
      }
    }
  });

  // --- 3. PESTAÑA: 1. ADMINISTRADORES DE PROYECTO (ADJUDICADORES) ---
  function renderProjectAdminsTab() {
    if (!el.projectAdminsContainer || !activeProject) return;
    const projectAdmins = activeProject.iso19650?.projectAdmins || [];

    if (projectAdmins.length === 0) {
      el.projectAdminsContainer.innerHTML = `
        <div class="col-span-full py-12 text-center text-xs text-slate-400 italic bg-white/40 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          No hay ningún Administrador de Proyecto (Adjudicador) designado actualmente.
        </div>
      `;
      return;
    }

    el.projectAdminsContainer.innerHTML = projectAdmins.map(email => {
      const meta = getUserMetadata(email);
      return `
        <div class="rounded-2xl p-5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm relative group hover:border-blue-400 transition-all flex flex-col justify-between">
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-mono text-[10px] font-bold uppercase">
                <span class="material-symbols-outlined text-[13px]">shield_person</span> Adjudicador (A)
              </span>
              ${canManageProjectAdmins ? `
                <button onclick="removeProjectAdmin('${email}')" class="text-slate-400 hover:text-rose-600 transition-colors p-1" title="Remover rol de Administrador de Proyecto">
                  <span class="material-symbols-outlined text-[18px]">person_remove</span>
                </button>
              ` : ''}
            </div>

            <div>
              <h4 class="font-bold text-sm text-slate-900 dark:text-white">${escapeHtml(meta.name)}</h4>
              <p class="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5 truncate">${escapeHtml(meta.email)}</p>
            </div>

            <div class="pt-2 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <div><strong class="text-slate-400 text-[10px] uppercase tracking-wider">Empresa:</strong> ${escapeHtml(meta.company)}</div>
              <div><strong class="text-slate-400 text-[10px] uppercase tracking-wider">Cargo:</strong> ${escapeHtml(meta.cargo)}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.openAddProjectAdminModal = function () {
    if (!canManageProjectAdmins) {
      window.showToast('Solo los Administradores de Empresa pueden nombrar Administradores de Proyecto.', 'error');
      return;
    }

    const select = document.getElementById('select-project-admin-user');
    if (!select) return;

    // Available users from Company & Directory
    const companyMembers = Array.isArray(currentCompany?.members) ? currentCompany.members : [];
    const existingAdmins = (activeProject.iso19650?.projectAdmins || []).map(a => a.toLowerCase().trim());

    const options = companyMembers
      .filter(m => m.email && !existingAdmins.includes(m.email.toLowerCase().trim()))
      .map(m => {
        const name = getUserRegisteredName(m.email);
        return `<option value="${escapeHtml(m.email)}">${escapeHtml(name)} (${escapeHtml(m.email)})</option>`;
      });

    if (options.length === 0) {
      select.innerHTML = '<option value="">No hay usuarios disponibles en la empresa</option>';
    } else {
      select.innerHTML = options.join('');
    }

    window.openModal('modal-project-admin');
  };

  window.confirmAddProjectAdmin = function () {
    const select = document.getElementById('select-project-admin-user');
    const email = (select?.value || '').toLowerCase().trim();
    if (!email) {
      window.showToast('Por favor selecciona un usuario.', 'error');
      return;
    }

    if (!activeProject.iso19650) activeProject.iso19650 = { projectAdmins: [], deliveryTeams: [] };
    if (!activeProject.iso19650.projectAdmins) activeProject.iso19650.projectAdmins = [];

    if (!activeProject.iso19650.projectAdmins.includes(email)) {
      activeProject.iso19650.projectAdmins.push(email);
    }

    // Ensure member is in project.members
    if (!activeProject.members.includes(email)) {
      activeProject.members.push(email);
    }

    window.closeModal('modal-project-admin');
    evaluatePermissions();
    renderAllViews();
    syncTeams();
    window.showToast('Administrador de Proyecto (Adjudicador) designado con éxito.', 'success');
  };

  window.removeProjectAdmin = function (email) {
    if (!canManageProjectAdmins) return;
    const clean = email.toLowerCase().trim();
    if (!confirm(`¿Estás seguro de remover el rol de Administrador de Proyecto para ${clean}?`)) return;

    if (activeProject?.iso19650?.projectAdmins) {
      activeProject.iso19650.projectAdmins = activeProject.iso19650.projectAdmins.filter(a => a.toLowerCase().trim() !== clean);
    }

    evaluatePermissions();
    renderAllViews();
    syncTeams();
    window.showToast('Administrador de Proyecto removido.', 'info');
  };

  // --- 4. PESTAÑA: 2. EQUIPOS DE ENTREGA ---
  function renderDeliveryTeamsTab() {
    if (!el.deliveryTeamsContainer || !activeProject) return;
    const deliveryTeams = activeProject.iso19650?.deliveryTeams || [];

    if (deliveryTeams.length === 0) {
      el.deliveryTeamsContainer.innerHTML = `
        <div class="py-12 text-center text-xs text-slate-400 italic bg-white/40 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          No hay Equipos de Entrega configurados.
        </div>
      `;
      return;
    }

    el.deliveryTeamsContainer.innerHTML = deliveryTeams.map((dt, dtIndex) => {
      const leadMeta = getUserMetadata(dt.leadEmail);
      const members = dt.members || [];
      const taskTeams = dt.taskTeams || [];

      // Render members rows
      const userEmail = (currentUser?.username || currentUser?.email || currentUser?.userAccount || '').toLowerCase().trim();
      const isCurrentLeader = (dt.leadEmail || '').toLowerCase().trim() === userEmail;
      const nonLeaderMembers = members.filter(mEmail => mEmail.toLowerCase().trim() !== (dt.leadEmail || '').toLowerCase().trim());
      const nonLeaderMembersListHtml = nonLeaderMembers.map(mEmail => {
        const mMeta = getUserMetadata(mEmail);
        return `
          <div class="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-xs">
            <div class="flex items-center gap-2.5">
              <span class="h-6 w-6 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 flex items-center justify-center font-bold text-[10px]">
                C
              </span>
              <div>
                <div class="font-bold text-slate-900 dark:text-white">${escapeHtml(mMeta.name)}</div>
                <div class="text-[10px] text-slate-400 font-mono">${escapeHtml(mEmail)} • ${escapeHtml(mMeta.company)}</div>
              </div>
            </div>
            ${(canManageProjectStructure || isCurrentLeader) ? `
              <div class="flex items-center gap-1">
                <button onclick="setDeliveryTeamLead('${dt.id}', '${mEmail}')" class="px-2 py-1 rounded-lg text-[10px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors" title="Nombrar como Líder de Entrega (B)">
                  Nombrar Líder
                </button>
                <button onclick="removeDeliveryTeamMember('${dt.id}', '${mEmail}')" class="p-1 text-slate-400 hover:text-rose-600 transition-colors" title="Remover de este equipo">
                  <span class="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      return `
        <div class="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm space-y-5">
          
          <!-- Header -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
            <div class="flex items-center gap-3">
              <span class="h-10 w-10 rounded-2xl bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-300 flex items-center justify-center font-black text-sm border border-purple-200 dark:border-purple-800">
                2
              </span>
              <div>
                <h3 class="text-base font-black text-slate-900 dark:text-white">${escapeHtml(dt.name)}</h3>
                <p class="text-xs text-slate-400">${escapeHtml(dt.description || 'Equipo de entrega asignado a la producción de información.')}</p>
              </div>
            </div>

            ${(canManageProjectStructure || isCurrentLeader) ? `
              <div class="flex items-center gap-2">
                <button onclick="openEditDeliveryTeamModal('${dt.id}')" class="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  Editar
                </button>
                ${canManageProjectStructure ? `
                  <button onclick="deleteDeliveryTeam('${dt.id}')" class="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors">
                    Eliminar
                  </button>
                ` : ''}
              </div>
            ` : ''}
          </div>

          <!-- Lead Card (Full Width) -->
          <div class="p-4 rounded-2xl bg-gradient-to-br from-blue-50/60 to-indigo-50/30 dark:from-blue-950/40 dark:to-indigo-950/20 border border-blue-100 dark:border-blue-900/50 space-y-2">
            <div class="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              <span class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">stars</span> Adjudicatario Principal (Líder B)
              </span>
            </div>
            <div class="font-bold text-sm text-slate-900 dark:text-white">${escapeHtml(leadMeta.name || 'Sin Líder Asignado')}</div>
            <div class="text-xs text-slate-500 dark:text-slate-400 font-mono">${escapeHtml(leadMeta.email || '-')}</div>
            <div class="text-[11px] text-slate-400">${escapeHtml(leadMeta.company)} • ${escapeHtml(leadMeta.cargo)}</div>
          </div>

          <!-- 3. Equipo de Tarea Section -->
          <div class="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <div class="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span class="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-emerald-700 dark:text-emerald-300">
                <span class="material-symbols-outlined text-[16px]">task_alt</span> 3. Equipo de Tarea (Miembros C) (${nonLeaderMembers.length})
              </span>
              <div class="flex items-center gap-2">
                ${canManageProjectStructure ? `
                  <button onclick="openCreateTaskTeamModal('${dt.id}')" class="text-[10px] font-bold text-emerald-600 hover:underline flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">add</span> Añadir Disciplina
                  </button>
                  <span class="text-slate-300 dark:text-slate-600">|</span>
                ` : ''}
                ${(canManageProjectStructure || isCurrentLeader) ? `
                  <button onclick="openAddMemberToDeliveryTeamModal('${dt.id}')" class="text-[10px] font-bold text-purple-600 hover:underline flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">person_add</span> Miembro
                  </button>
                ` : ''}
              </div>
            </div>

            <!-- Disciplines / Sub-teams List (If any exist) -->
            ${taskTeams.length > 0 ? `
              <div class="flex flex-wrap gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/40">
                <span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 w-full mb-1">Disciplinas / Sub-equipos:</span>
                ${taskTeams.map(tt => `
                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                    <span class="material-symbols-outlined text-[13px]">check_box</span> ${escapeHtml(tt.name)} (${escapeHtml(tt.discipline || 'General')})
                    ${canManageProjectStructure ? `
                      <button onclick="deleteTaskTeam('${dt.id}', '${tt.id}')" class="text-emerald-600 dark:text-emerald-400 hover:text-rose-600 ml-1 transition-colors flex items-center" title="Eliminar disciplina">
                        <span class="material-symbols-outlined text-[12px] font-bold">close</span>
                      </button>
                    ` : ''}
                  </span>
                `).join('')}
              </div>
            ` : ''}

            <!-- Non-leader Members List -->
            <div class="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              ${nonLeaderMembersListHtml || '<div class="text-xs text-slate-400 italic py-2">Sin miembros asignados en el equipo de tarea (C).</div>'}
            </div>
          </div>

        </div>
      `;
    }).join('');
  }

  window.openCreateDeliveryTeamModal = function () {
    if (!canManageProjectStructure) return;
    document.getElementById('modal-delivery-title').textContent = 'Crear Equipo de Entrega';
    document.getElementById('delivery-team-edit-id').value = '';
    document.getElementById('delivery-team-name').value = '';
    document.getElementById('delivery-team-desc').value = '';

    const leadSelect = document.getElementById('delivery-team-lead-select');
    const memberOptions = (activeProject.members || []).map(m => {
      const name = getUserRegisteredName(m);
      return `<option value="${escapeHtml(m)}">${escapeHtml(name)} (${escapeHtml(m)})</option>`;
    });
    leadSelect.innerHTML = '<option value="">-- Seleccionar Líder de Entrega (B) --</option>' + memberOptions.join('');

    window.openModal('modal-delivery-team');
  };

  window.openEditDeliveryTeamModal = function (deliveryId) {
    const dt = (activeProject.iso19650?.deliveryTeams || []).find(d => d.id === deliveryId);
    if (!dt) return;

    const userEmail = (currentUser?.username || currentUser?.email || currentUser?.userAccount || '').toLowerCase().trim();
    const isCurrentLeader = (dt.leadEmail || '').toLowerCase().trim() === userEmail;

    if (!canManageProjectStructure && !isCurrentLeader) {
      window.showToast('No tienes permisos para editar este equipo.', 'error');
      return;
    }

    document.getElementById('modal-delivery-title').textContent = 'Editar Equipo de Entrega';
    document.getElementById('delivery-team-edit-id').value = dt.id;
    document.getElementById('delivery-team-name').value = dt.name || '';
    document.getElementById('delivery-team-desc').value = dt.description || '';

    const leadSelect = document.getElementById('delivery-team-lead-select');
    const memberOptions = (activeProject.members || []).map(m => {
      const name = getUserRegisteredName(m);
      const isSel = (m.toLowerCase().trim() === (dt.leadEmail || '').toLowerCase().trim()) ? 'selected' : '';
      return `<option value="${escapeHtml(m)}" ${isSel}>${escapeHtml(name)} (${escapeHtml(m)})</option>`;
    });
    leadSelect.innerHTML = '<option value="">-- Seleccionar Líder de Entrega (B) --</option>' + memberOptions.join('');

    window.openModal('modal-delivery-team');
  };

  window.confirmSaveDeliveryTeam = function () {
    const editId = document.getElementById('delivery-team-edit-id').value;
    const name = document.getElementById('delivery-team-name').value.trim();
    const leadEmail = document.getElementById('delivery-team-lead-select').value.toLowerCase().trim();
    const desc = document.getElementById('delivery-team-desc').value.trim();

    if (editId) {
      const dt = activeProject.iso19650.deliveryTeams.find(d => d.id === editId);
      if (!dt) return;
      const userEmail = (currentUser?.username || currentUser?.email || currentUser?.userAccount || '').toLowerCase().trim();
      const isCurrentLeader = (dt.leadEmail || '').toLowerCase().trim() === userEmail;
      if (!canManageProjectStructure && !isCurrentLeader) {
        window.showToast('No tienes permisos para guardar cambios en este equipo.', 'error');
        return;
      }
    } else {
      if (!canManageProjectStructure) {
        window.showToast('No tienes permisos para crear equipos de entrega.', 'error');
        return;
      }
    }

    if (!name) {
      window.showToast('Por favor escribe un nombre para el equipo de entrega.', 'error');
      return;
    }
    if (!leadEmail) {
      window.showToast('Debe asignarse un Líder de Entrega (B).', 'error');
      return;
    }

    if (!activeProject.iso19650) activeProject.iso19650 = { projectAdmins: [], deliveryTeams: [] };
    if (!activeProject.iso19650.deliveryTeams) activeProject.iso19650.deliveryTeams = [];

    if (editId) {
      const dt = activeProject.iso19650.deliveryTeams.find(d => d.id === editId);
      if (dt) {
        dt.name = name;
        dt.leadEmail = leadEmail;
        dt.description = desc;
        if (leadEmail && !dt.members.includes(leadEmail)) {
          dt.members.push(leadEmail);
        }
      }
    } else {
      const newDt = {
        id: 'deliv-' + Date.now(),
        name: name,
        leadEmail: leadEmail,
        description: desc,
        members: leadEmail ? [leadEmail] : [],
        taskTeams: []
      };
      activeProject.iso19650.deliveryTeams.push(newDt);
    }

    window.closeModal('modal-delivery-team');
    renderAllViews();
    syncTeams();
    window.showToast('Equipo de Entrega guardado exitosamente.', 'success');
  };

  window.deleteDeliveryTeam = function (deliveryId) {
    if (!canManageProjectStructure) return;
    if (!confirm('¿Estás seguro de eliminar este Equipo de Entrega y sus configuraciones?')) return;

    if (activeProject?.iso19650?.deliveryTeams) {
      activeProject.iso19650.deliveryTeams = activeProject.iso19650.deliveryTeams.filter(d => d.id !== deliveryId);
    }

    renderAllViews();
    syncTeams();
    window.showToast('Equipo de Entrega eliminado.', 'info');
  };

  window.setDeliveryTeamLead = function (deliveryId, email) {
    const dt = (activeProject.iso19650?.deliveryTeams || []).find(d => d.id === deliveryId);
    if (!dt) return;

    const userEmail = (currentUser?.username || currentUser?.email || currentUser?.userAccount || '').toLowerCase().trim();
    const isCurrentLeader = (dt.leadEmail || '').toLowerCase().trim() === userEmail;

    if (!canManageProjectStructure && !isCurrentLeader) {
      window.showToast('No tienes permisos para cambiar el líder de este equipo.', 'error');
      return;
    }

    if (!email) {
      window.showToast('Debe asignarse un Líder de Entrega (B).', 'error');
      return;
    }

    dt.leadEmail = email.toLowerCase().trim();
    if (!dt.members.includes(dt.leadEmail)) {
      dt.members.push(dt.leadEmail);
    }

    evaluatePermissions();
    renderAllViews();
    syncTeams();
    window.showToast(`Nuevo Líder de Entrega asignado: ${getUserRegisteredName(email)}`, 'success');
  };

  window.removeDeliveryTeamMember = function (deliveryId, email) {
    const dt = (activeProject.iso19650?.deliveryTeams || []).find(d => d.id === deliveryId);
    if (!dt) return;

    const userEmail = (currentUser?.username || currentUser?.email || currentUser?.userAccount || '').toLowerCase().trim();
    const isCurrentLeader = (dt.leadEmail || '').toLowerCase().trim() === userEmail;

    if (!canManageProjectStructure && !isCurrentLeader) {
      window.showToast('No tienes permisos para remover miembros de este equipo.', 'error');
      return;
    }

    const clean = email.toLowerCase().trim();
    if (dt.leadEmail && dt.leadEmail.toLowerCase().trim() === clean) {
      window.showToast('No es posible remover al líder de entrega. Primero asigna un nuevo líder.', 'error');
      return;
    }

    dt.members = dt.members.filter(m => m.toLowerCase().trim() !== clean);

    // Also remove from task teams inside this delivery team
    (dt.taskTeams || []).forEach(tt => {
      if (Array.isArray(tt.members)) {
        tt.members = tt.members.filter(m => m.toLowerCase().trim() !== clean);
      }
    });

    renderAllViews();
    syncTeams();
    window.showToast('Miembro removido del equipo de entrega.', 'info');
  };

  window.openAddMemberToDeliveryTeamModal = function (deliveryId) {
    const dt = (activeProject.iso19650?.deliveryTeams || []).find(d => d.id === deliveryId);
    if (!dt) return;

    const userEmail = (currentUser?.username || currentUser?.email || currentUser?.userAccount || '').toLowerCase().trim();
    const isCurrentLeader = (dt.leadEmail || '').toLowerCase().trim() === userEmail;

    if (!canManageProjectStructure && !isCurrentLeader) {
      window.showToast('No tienes permisos para añadir miembros a este equipo.', 'error');
      return;
    }

    const availableMembers = (activeProject.members || []).filter(m => !dt.members.includes(m.toLowerCase().trim()));
    if (availableMembers.length === 0) {
      window.showToast('Todos los participantes del proyecto ya están en este equipo.', 'info');
      return;
    }

    const memberPrompt = prompt(`Ingresa el correo del participante a integrar al equipo "${dt.name}":\nOpciones disponibles:\n` + availableMembers.join('\n'));
    if (!memberPrompt) return;

    const clean = memberPrompt.toLowerCase().trim();
    if (activeProject.members.includes(clean)) {
      if (!dt.members.includes(clean)) {
        dt.members.push(clean);
        renderAllViews();
        syncTeams();
        window.showToast('Miembro añadido al equipo de entrega.', 'success');
      }
    } else {
      window.showToast('El usuario no pertenece al proyecto. Intégralo primero en el Directorio.', 'error');
    }
  };

  // --- 5. PESTAÑA: 3. EQUIPOS DE TAREA ---


  window.openCreateTaskTeamModal = function (preselectedDeliveryId = '') {
    if (!canManageProjectStructure) {
      window.showToast('No tienes permisos para crear equipos de tarea.', 'error');
      return;
    }

    const deliveryTeams = activeProject.iso19650?.deliveryTeams || [];
    if (deliveryTeams.length === 0) {
      window.showToast('Primero debes crear al menos un Equipo de Entrega.', 'error');
      window.switchTab('delivery');
      return;
    }

    document.getElementById('modal-task-title').textContent = 'Crear Equipo de Tarea';
    document.getElementById('task-team-edit-id').value = '';
    document.getElementById('task-team-name').value = '';
    document.getElementById('task-team-discipline').value = '';

    const delivSelect = document.getElementById('task-team-delivery-select');
    delivSelect.innerHTML = deliveryTeams.map(d => {
      const isSel = (d.id === preselectedDeliveryId) ? 'selected' : '';
      return `<option value="${escapeHtml(d.id)}" ${isSel}>${escapeHtml(d.name)}</option>`;
    }).join('');

    window.openModal('modal-task-team');
  };

  window.confirmSaveTaskTeam = function () {
    if (!canManageProjectStructure) {
      window.showToast('No tienes permisos para crear equipos de tarea.', 'error');
      return;
    }

    const name = document.getElementById('task-team-name').value.trim();
    const deliveryId = document.getElementById('task-team-delivery-select').value;
    const discipline = document.getElementById('task-team-discipline').value.trim();

    if (!name) {
      window.showToast('Por favor ingresa un nombre para el equipo de tarea.', 'error');
      return;
    }

    const dt = (activeProject.iso19650?.deliveryTeams || []).find(d => d.id === deliveryId);
    if (!dt) {
      window.showToast('Equipo de Entrega no válido.', 'error');
      return;
    }

    if (!Array.isArray(dt.taskTeams)) dt.taskTeams = [];
    dt.taskTeams.push({
      id: 'task-' + Date.now(),
      name: name,
      discipline: discipline || 'General',
      members: []
    });

    window.closeModal('modal-task-team');
    renderAllViews();
    syncTeams();
    window.showToast('Equipo de Tarea creado con éxito.', 'success');
  };

  window.deleteTaskTeam = function (deliveryId, taskId) {
    if (!canManageProjectStructure) {
      window.showToast('No tienes permisos para eliminar equipos de tarea.', 'error');
      return;
    }

    const dt = (activeProject.iso19650?.deliveryTeams || []).find(d => d.id === deliveryId);
    if (!dt) return;

    if (!confirm('¿Deseas eliminar este equipo de tarea?')) return;

    dt.taskTeams = dt.taskTeams.filter(t => t.id !== taskId);

    renderAllViews();
    syncTeams();
    window.showToast('Equipo de Tarea eliminado.', 'info');
  };

  // --- 6. PESTAÑA: DIRECTORIO DE PARTICIPANTES ---
  function renderDirectoryTab() {
    if (!el.directoryTableBody || !activeProject) return;
    const query = (el.directorySearchInput ? el.directorySearchInput.value : '').toLowerCase().trim();
    const filterRole = el.directoryRoleFilter ? el.directoryRoleFilter.value : 'ALL';

    const projectAdmins = activeProject.iso19650?.projectAdmins || [];
    const deliveryTeams = activeProject.iso19650?.deliveryTeams || [];
    const members = activeProject.members || [];

    if (members.length === 0) {
      el.directoryTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="py-8 px-4 text-center text-xs text-slate-400 italic">
            No hay participantes asignados al proyecto. Haz clic en "Integrar Miembro" para añadir el primero.
          </td>
        </tr>
      `;
      return;
    }

    // Build directory rows
    const rowsData = members.map(email => {
      const meta = getUserMetadata(email);
      const clean = email.toLowerCase().trim();

      // Check ISO role
      const isAdmin = projectAdmins.some(a => a.toLowerCase().trim() === clean);
      const leadInTeams = deliveryTeams.filter(dt => (dt.leadEmail || '').toLowerCase().trim() === clean);
      const memberInTeams = deliveryTeams.filter(dt => (dt.members || []).some(m => m.toLowerCase().trim() === clean));

      let isoRoleCode = 'MEMBER';
      let isoRoleLabel = 'Otro Adjudicatario (C)';
      let isoRoleBadgeClass = 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800';

      if (isAdmin) {
        isoRoleCode = 'ADMIN';
        isoRoleLabel = 'Adjudicador (A)';
        isoRoleBadgeClass = 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      } else if (leadInTeams.length > 0) {
        isoRoleCode = 'LEAD';
        isoRoleLabel = 'Adjudicatario Principal (B)';
        isoRoleBadgeClass = 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      } else if (memberInTeams.length === 0) {
        isoRoleCode = 'UNASSIGNED';
        isoRoleLabel = 'Sin Equipo';
        isoRoleBadgeClass = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
      }

      const assignedDeliveryNames = memberInTeams.map(d => d.name).join(', ') || 'Sin Asignar';
      
      // Find Task teams
      const taskNames = [];
      deliveryTeams.forEach(dt => {
        (dt.taskTeams || []).forEach(tt => {
          if ((tt.members || []).some(m => m.toLowerCase().trim() === clean)) {
            taskNames.push(tt.name);
          }
        });
      });
      const assignedTaskNames = taskNames.join(', ') || '-';

      return {
        email: clean,
        name: meta.name,
        company: meta.company,
        cargo: meta.cargo,
        especialidad: meta.especialidad,
        isoRoleCode,
        isoRoleLabel,
        isoRoleBadgeClass,
        assignedDeliveryNames,
        assignedTaskNames
      };
    });

    // Apply Filter & Search
    const filtered = rowsData.filter(r => {
      if (filterRole !== 'ALL' && r.isoRoleCode !== filterRole) return false;
      const matchSearch = r.name.toLowerCase().includes(query) ||
                          r.email.toLowerCase().includes(query) ||
                          r.company.toLowerCase().includes(query) ||
                          r.cargo.toLowerCase().includes(query) ||
                          r.assignedDeliveryNames.toLowerCase().includes(query);
      return matchSearch;
    });

    if (filtered.length === 0) {
      el.directoryTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="py-8 px-4 text-center text-xs text-slate-400 italic">
            No se encontraron participantes que coincidan con la búsqueda.
          </td>
        </tr>
      `;
      return;
    }

    el.directoryTableBody.innerHTML = filtered.map(r => {
      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
          <td class="py-3.5 px-4">
            <div class="font-bold text-slate-900 dark:text-white">${escapeHtml(r.name)}</div>
            <div class="text-[11px] font-mono text-slate-400">${escapeHtml(r.email)}</div>
          </td>
          <td class="py-3.5 px-4 text-slate-600 dark:text-slate-300">
            <div class="font-semibold text-xs">${escapeHtml(r.company)}</div>
            <div class="text-[10px] text-slate-400">${escapeHtml(r.cargo)}</div>
          </td>
          <td class="py-3.5 px-4">
            <span class="inline-flex items-center px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider ${r.isoRoleBadgeClass}">
              ${escapeHtml(r.isoRoleLabel)}
            </span>
          </td>
          <td class="py-3.5 px-4 text-xs font-medium text-slate-600 dark:text-slate-300">
            ${escapeHtml(r.assignedDeliveryNames)}
          </td>
          <td class="py-3.5 px-4 text-xs font-mono text-slate-500">
            ${escapeHtml(r.assignedTaskNames)}
          </td>
          <td class="py-3.5 px-4 text-right">
            ${canManageProjectStructure ? `
              <button onclick="removeProjectMember('${r.email}')" class="p-1 text-slate-400 hover:text-rose-600 transition-colors" title="Remover del Proyecto">
                <span class="material-symbols-outlined text-[18px]">person_remove</span>
              </button>
            ` : '-'}
          </td>
        </tr>
      `;
    }).join('');
  }

  if (el.directorySearchInput) el.directorySearchInput.addEventListener('input', renderDirectoryTab);
  if (el.directoryRoleFilter) el.directoryRoleFilter.addEventListener('change', renderDirectoryTab);

  window.openAddProjectMemberModal = function () {
    if (!canManageProjectStructure) return;
    const select = document.getElementById('select-available-user');
    const delivSelect = document.getElementById('select-member-delivery-team');
    if (!select || !delivSelect) return;

    const companyMembers = Array.isArray(currentCompany?.members) ? currentCompany.members : [];
    const currentMembers = (activeProject.members || []).map(m => m.toLowerCase().trim());

    // Users not yet in project
    const availableUsers = companyMembers.filter(m => m.email && !currentMembers.includes(m.email.toLowerCase().trim()));

    if (availableUsers.length === 0) {
      select.innerHTML = '<option value="">Todos los usuarios de la empresa ya están asignados</option>';
    } else {
      select.innerHTML = availableUsers.map(u => {
        const name = getUserRegisteredName(u.email);
        return `<option value="${escapeHtml(u.email)}">${escapeHtml(name)} (${escapeHtml(u.email)})</option>`;
      }).join('');
    }

    const deliveryTeams = activeProject.iso19650?.deliveryTeams || [];
    delivSelect.innerHTML = '<option value="">-- Sin Asignar a Equipo de Entrega --</option>' +
      deliveryTeams.map(d => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`).join('');

    window.openModal('modal-add-member');
  };

  window.confirmAddProjectMember = function () {
    const email = (document.getElementById('select-available-user')?.value || '').toLowerCase().trim();
    const deliveryId = document.getElementById('select-member-delivery-team')?.value;

    if (!email) {
      window.showToast('Por favor selecciona un usuario para integrar.', 'error');
      return;
    }

    if (!activeProject.members.includes(email)) {
      activeProject.members.push(email);
    }

    if (deliveryId) {
      const dt = (activeProject.iso19650?.deliveryTeams || []).find(d => d.id === deliveryId);
      if (dt && !dt.members.includes(email)) {
        dt.members.push(email);
      }
    }

    window.closeModal('modal-add-member');
    renderAllViews();
    syncTeams();
    window.showToast('Participante integrado exitosamente al proyecto.', 'success');
  };

  window.removeProjectMember = function (email) {
    if (!canManageProjectStructure) return;
    const clean = email.toLowerCase().trim();

    // Prevent removing a leader of any delivery team
    const deliveryTeams = activeProject.iso19650?.deliveryTeams || [];
    const leadInTeams = deliveryTeams.filter(dt => (dt.leadEmail || '').toLowerCase().trim() === clean);
    if (leadInTeams.length > 0) {
      const teamNames = leadInTeams.map(t => `"${t.name}"`).join(', ');
      window.showToast(`No es posible remover a este participante porque es el líder de los siguientes equipos: ${teamNames}. Primero asigna otro líder a esos equipos.`, 'error');
      return;
    }

    if (!confirm(`¿Remover a ${clean} del proyecto y de todos sus equipos asignados?`)) return;

    activeProject.members = (activeProject.members || []).filter(m => m.toLowerCase().trim() !== clean);
    
    // Remove from project admins
    if (activeProject.iso19650?.projectAdmins) {
      activeProject.iso19650.projectAdmins = activeProject.iso19650.projectAdmins.filter(a => a.toLowerCase().trim() !== clean);
    }

    // Remove from delivery teams
    (activeProject.iso19650?.deliveryTeams || []).forEach(dt => {
      dt.members = (dt.members || []).filter(m => m.toLowerCase().trim() !== clean);
      if (dt.leadEmail && dt.leadEmail.toLowerCase().trim() === clean) {
        dt.leadEmail = '';
      }
      (dt.taskTeams || []).forEach(tt => {
        tt.members = (tt.members || []).filter(m => m.toLowerCase().trim() !== clean);
      });
    });

    evaluatePermissions();
    renderAllViews();
    syncTeams();
    window.showToast('Participante removido del proyecto.', 'info');
  };

  // --- 7. EXPORTACIÓN EXCEL ---
  if (el.exportExcelBtn) {
    el.exportExcelBtn.addEventListener('click', () => {
      if (!activeProject) return;
      const members = activeProject.members || [];
      const projectAdmins = activeProject.iso19650?.projectAdmins || [];
      const deliveryTeams = activeProject.iso19650?.deliveryTeams || [];

      const exportData = members.map(email => {
        const meta = getUserMetadata(email);
        const clean = email.toLowerCase().trim();

        const isAdmin = projectAdmins.some(a => a.toLowerCase().trim() === clean);
        const leadInTeams = deliveryTeams.filter(dt => (dt.leadEmail || '').toLowerCase().trim() === clean);
        const memberInTeams = deliveryTeams.filter(dt => (dt.members || []).some(m => m.toLowerCase().trim() === clean));

        let roleIso = 'Otro Adjudicatario (Miembro C)';
        if (isAdmin) roleIso = 'Adjudicador (Administrador de Proyecto A)';
        else if (leadInTeams.length > 0) roleIso = 'Adjudicatario Principal (Líder Entrega B)';

        return {
          'Nombre': meta.name,
          'Correo': meta.email,
          'Empresa': meta.company,
          'Cargo': meta.cargo,
          'Rol ISO 19650': roleIso,
          'Equipos de Entrega': memberInTeams.map(d => d.name).join('; ') || 'Sin Asignar'
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws, "Equipos ISO 19650");
      XLSX.writeFile(wb, `Equipos_ISO19650_${activeProject.slug || 'Proyecto'}.xlsx`);
      window.showToast('Directorio exportado a Excel exitosamente.', 'success');
    });
  }

  // --- 8. SINCRONIZACIÓN Y GUARDADO ---
  async function syncTeams() {
    if (!activeProject) return;
    
    // Sincronizar de vuelta a la estructura simplificada equiposDeTarea
    syncBackToEquiposDeTarea();
    
    try {
      const payload = {
        action: 'saveTeams',
        empresa: companyId || 'general',
        proyecto: projectSlug || activeProject.slug || 'general',
        teams: activeProject.equiposDeTarea || []
      };
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn('Sync Google Sheets warning:', e);
    }
  }

  // Modal GitHub Token
  window.saveGithubToken = function () {
    const val = el.githubPatInput ? el.githubPatInput.value.trim() : '';
    if (val) {
      localStorage.setItem('github_pat', val);
      window.showToast('Token de GitHub guardado exitosamente.', 'success');
    } else {
      localStorage.removeItem('github_pat');
      window.showToast('Token de GitHub eliminado.', 'info');
    }
    window.closeModal('modal-token');
  };

  if (el.githubTokenBtn) {
    el.githubTokenBtn.addEventListener('click', () => {
      if (el.githubPatInput) el.githubPatInput.value = localStorage.getItem('github_pat') || '';
      window.openModal('modal-token');
    });
  }

  // Save to GitHub
  if (el.saveBtn) {
    el.saveBtn.addEventListener('click', async () => {
      let token = localStorage.getItem('github_pat');
      if (!token) {
        if (el.githubPatInput) el.githubPatInput.value = '';
        window.openModal('modal-token');
        window.showToast('Ingresa tu Token de GitHub para sincronizar con la nube.', 'error');
        return;
      }

      const repo = 'camilomartg-svg/bim';
      const branch = 'main';
      const fileTarget = configUrl || 'portal-config.json';
      const files = [fileTarget, `docs/${fileTarget}`];
      syncBackToEquiposDeTarea();
      const content = JSON.stringify(fullConfig, null, 2);

      window.showToast('Guardando configuración de equipos en la nube...', 'info');
      syncTeams();

      try {
        for (const path of files) {
          let sha = null;
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
            console.warn(`File ${path} sha check:`, e);
          }

          const body = {
            message: `Update ISO 19650 Project Teams for ${activeProject.name}`,
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
              throw new Error('Token inválido o expirado.');
            }
            throw new Error(`Error actualizando ${path}: ${putRes.statusText}`);
          }
        }

        window.showToast('Equipos guardados exitosamente en GitHub.', 'success');
      } catch (err) {
        window.showToast(err.message, 'error');
      }
    });
  }

  // --- INICIALIZAR ---
  function escapeHtml(val) {
    return String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  init();
})();
