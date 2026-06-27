document.addEventListener('DOMContentLoaded', async () => {
  const CONFIG_URL = 'portal-config.json';
  const DRAFT_KEY = 'portal:pba-config-draft:v2';

  const TREVOLY_TEMPLATE = {
    eyebrow: 'Portal BIM',
    title: 'TREVOLY',
    subtitle: 'Accesos rápidos, seguimiento y contexto del proyecto.',
    actionEyebrow: 'Panel',
    actionTitle: 'Acciones',
    actionDescription: 'Atajos para publicaciones, solicitudes y equipo.',
    mapEyebrow: 'City Guide',
    cityLabel: 'BOGOTÁ',
    mapDescription: 'Portal de acceso al CDE del proyecto: centraliza modelos, planos y entregables, y facilita el seguimiento y la coordinación entre equipos con información vigente.',
    address: 'Calle 57H Sur con Carrera 72 (Autopista Sur).',
    logoUrl: 'https://i.postimg.cc/P5rsf8Yb/trevoly.png',
    portalLogoLight: 'https://i.postimg.cc/HjLYj9rD/LOGO-NORA-NEGRO.png',
    portalLogoDark: 'https://i.postimg.cc/rzpVzNDL/LOGO-NORA-BLANCO.png',
    map: {
      lat: 4.59742,
      lng: -74.16498,
      zoom: 17,
    },
  };

  const DEFAULT_CONFIG = {
    portal: {
      name: 'Portal BIM Alcabama',
      shortName: 'Portal BIM',
      footerText: '© 2026 Portal BIM Alcabama - Todos los derechos reservados.',
      heroImages: [],
      configPageUrl: 'portal-configurator.html',
      logoLight: 'https://i.postimg.cc/HjLYj9rD/LOGO-NORA-NEGRO.png',
      logoDark: 'https://i.postimg.cc/rzpVzNDL/LOGO-NORA-BLANCO.png',
      footerLogoLight: 'https://i.postimg.cc/HjLYj9rD/LOGO-NORA-NEGRO.png',
      footerLogoDark: 'https://i.postimg.cc/rzpVzNDL/LOGO-NORA-BLANCO.png',
      footerLogoSecondaryLight: 'https://i.postimg.cc/HjLYj9rD/LOGO-NORA-NEGRO.png',
      footerLogoSecondaryDark: 'https://i.postimg.cc/HjLYj9rD/LOGO-NORA-NEGRO.png',
    },
    projects: [],
    publicaciones: [],
    solicitudes: [],
    metricas: [],
    administracion: [],
  };

  const DEFAULT_PROJECT = {
    name: 'Nuevo proyecto',
    slug: 'nuevo-proyecto',
    homeUrl: '',
    city: 'Bogotá',
    type: 'Residencial',
    status: 'Planeacion',
    enabled: true,
    modules: {
      ifc: 'VSR_IFCA/',
      status: 'STATUS/',
      cantidades: 'CANTIDADES/',
      pdf: 'VSR_PDFA/',
      dwg: 'VSR_DWGA/',
    },
    actions: {
      publicaciones: 'Publicaciones.html',
      solicitudes: 'index.html',
      equipo: 'lista_usuarios.html',
    },
    dataSources: {
      driveFolderName: 'Nuevo proyecto',
      driveFolderId: '',
      driveScriptUrl: '',
      statusSheetId: '',
      statusScriptUrl: '',
      cantidadesSheetId: '',
      cantidadesScriptUrl: '',
    },
    landing: {
      enabled: true,
      eyebrow: 'Portal BIM',
      title: 'NUEVO PROYECTO',
      subtitle: 'Accesos rápidos, seguimiento y contexto del proyecto.',
      actionEyebrow: 'Panel',
      actionTitle: 'Acciones',
      actionDescription: 'Atajos para publicaciones, solicitudes y equipo.',
      mapEyebrow: 'City Guide',
      cityLabel: 'BOGOTÁ',
      mapDescription: 'Portal de acceso al CDE del proyecto.',
      address: '',
      logoUrl: 'assets/icons/portal-bim-favicon.png',
      portalLogoLight: 'https://i.postimg.cc/HjLYj9rD/LOGO-NORA-NEGRO.png',
      portalLogoDark: 'https://i.postimg.cc/rzpVzNDL/LOGO-NORA-BLANCO.png',
      map: {
        lat: 4.711,
        lng: -74.0721,
        zoom: 13,
      },
    },
  };

  const el = {
    sessionUser: document.getElementById('session-user'),
    statusBanner: document.getElementById('status-banner'),
    portalName: document.getElementById('portal-name'),
    portalShortName: document.getElementById('portal-short-name'),
    portalLogoLight: document.getElementById('portal-logo-light'),
    portalLogoDark: document.getElementById('portal-logo-dark'),
    portalLogoFooterLight: document.getElementById('portal-logo-footer-light'),
    portalLogoFooterDark: document.getElementById('portal-logo-footer-dark'),
    portalLogoFooterSecondaryLight: document.getElementById('portal-logo-footer-secondary-light'),
    portalLogoFooterSecondaryDark: document.getElementById('portal-logo-footer-secondary-dark'),
    portalFooter: document.getElementById('portal-footer'),
    portalConfigPageUrl: document.getElementById('portal-config-page-url'),
    portalHeroImages: document.getElementById('portal-hero-images'),
    projectList: document.getElementById('project-list'),
    editorProjectTitle: document.getElementById('editor-project-title'),
    projectName: document.getElementById('project-name'),
    projectSlug: document.getElementById('project-slug'),
    projectHomeUrl: document.getElementById('project-home-url'),
    projectCity: document.getElementById('project-city'),
    projectType: document.getElementById('project-type'),
    projectStatus: document.getElementById('project-status'),
    projectEnabled: document.getElementById('project-enabled'),
    projectLandingEnabled: document.getElementById('project-landing-enabled'),
    landingEyebrow: document.getElementById('landing-eyebrow'),
    landingTitle: document.getElementById('landing-title'),
    landingSubtitle: document.getElementById('landing-subtitle'),
    landingActionEyebrow: document.getElementById('landing-action-eyebrow'),
    landingActionTitle: document.getElementById('landing-action-title'),
    landingActionDescription: document.getElementById('landing-action-description'),
    landingLogoUrl: document.getElementById('landing-logo-url'),
    landingPortalLogoLight: document.getElementById('landing-portal-logo-light'),
    landingPortalLogoDark: document.getElementById('landing-portal-logo-dark'),
    landingMapEyebrow: document.getElementById('landing-map-eyebrow'),
    landingCityLabel: document.getElementById('landing-city-label'),
    landingMapDescription: document.getElementById('landing-map-description'),
    landingAddress: document.getElementById('landing-address'),
    landingMapLat: document.getElementById('landing-map-lat'),
    landingMapLng: document.getElementById('landing-map-lng'),
    landingMapZoom: document.getElementById('landing-map-zoom'),
    driveFolderName: document.getElementById('drive-folder-name'),
    driveFolderId: document.getElementById('drive-folder-id'),
    driveScriptUrl: document.getElementById('drive-script-url'),
    statusSheetId: document.getElementById('status-sheet-id'),
    statusScriptUrl: document.getElementById('status-script-url'),
    cantidadesSheetId: document.getElementById('cantidades-sheet-id'),
    cantidadesScriptUrl: document.getElementById('cantidades-script-url'),
    moduleIfc: document.getElementById('module-ifc'),
    moduleStatus: document.getElementById('module-status'),
    moduleCantidades: document.getElementById('module-cantidades'),
    modulePdf: document.getElementById('module-pdf'),
    moduleDwg: document.getElementById('module-dwg'),
    actionPublicaciones: document.getElementById('action-publicaciones'),
    actionSolicitudes: document.getElementById('action-solicitudes'),
    actionEquipo: document.getElementById('action-equipo'),
    summaryProjectCount: document.getElementById('summary-project-count'),
    summaryCurrentProject: document.getElementById('summary-current-project'),
    jsonPreview: document.getElementById('json-preview'),
    publishBtn: document.getElementById('publish-btn'),
    saveDraftBtn: document.getElementById('save-draft-btn'),
    restorePublishedBtn: document.getElementById('restore-published-btn'),
    copyJsonBtn: document.getElementById('copy-json-btn'),
    exportJsonBtn: document.getElementById('export-json-btn'),
    importJsonBtn: document.getElementById('import-json-btn'),
    importJsonInput: document.getElementById('import-json-input'),
    clearDraftBtn: document.getElementById('clear-draft-btn'),
    addProjectBtn: document.getElementById('add-project-btn'),
    duplicateProjectBtn: document.getElementById('duplicate-project-btn'),
    removeProjectBtn: document.getElementById('remove-project-btn'),
    applyTrevolyBtn: document.getElementById('apply-trevoly-btn'),
  };

  const userAccount = JSON.parse(sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount') || 'null');
  if (userAccount?.name) {
    el.sessionUser.textContent = `Hola, ${userAccount.name.split(' ')[0]}`;
  }

  let publishedConfig = clone(DEFAULT_CONFIG);
  let workingConfig = clone(DEFAULT_CONFIG);
  let selectedProjectIndex = 0;
  let configMap = null;
  let configMarker = null;
  let mapSilentUpdate = false;
  let slugManuallyEdited = false;

  function clone(value) {
    return JSON.parse(JSON.stringify(value || DEFAULT_CONFIG));
  }

  function slugify(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'nuevo-proyecto';
  }

  function extractDriveFolderId(val) {
    const trimmed = String(val || '').trim();
    const foldersMatch = trimmed.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    if (foldersMatch) return foldersMatch[1];
    const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (idMatch) return idMatch[1];
    return trimmed;
  }

  function showBanner(message, type) {
    const tones = {
      success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      warn: 'border-amber-200 bg-amber-50 text-amber-700',
      error: 'border-rose-200 bg-rose-50 text-rose-700',
      info: 'border-slate-200 bg-slate-50 text-slate-700',
    };
    el.statusBanner.className = `mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${tones[type] || tones.info}`;
    el.statusBanner.textContent = message;
    el.statusBanner.classList.remove('hidden');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeLinkItem(item, index) {
    return {
      id: String(item?.id || `item-${index + 1}`),
      label: String(item?.label || '').trim(),
      href: String(item?.href || '#').trim() || '#',
      allowedRoles: Array.isArray(item?.allowedRoles)
        ? item.allowedRoles.map((role) => String(role || '').trim()).filter(Boolean)
        : [],
    };
  }

  function normalizeProject(project) {
    const modules = project?.modules && typeof project.modules === 'object' ? project.modules : {};
    const actions = project?.actions && typeof project.actions === 'object' ? project.actions : {};
    const dataSources = project?.dataSources && typeof project.dataSources === 'object' ? project.dataSources : {};
    const landing = project?.landing && typeof project.landing === 'object' ? project.landing : {};
    const map = landing.map && typeof landing.map === 'object' ? landing.map : {};
    const safeName = String(project?.name || DEFAULT_PROJECT.name).trim() || DEFAULT_PROJECT.name;
    return {
      ...clone(DEFAULT_PROJECT),
      ...project,
      name: safeName,
      slug: String(project?.slug || slugify(safeName)).trim() || slugify(safeName),
      homeUrl: String(project?.homeUrl || '').trim(),
      city: String(project?.city || DEFAULT_PROJECT.city).trim(),
      type: String(project?.type || DEFAULT_PROJECT.type).trim(),
      status: String(project?.status || DEFAULT_PROJECT.status).trim(),
      enabled: project?.enabled !== false,
      modules: {
        ifc: String(modules.ifc || DEFAULT_PROJECT.modules.ifc).trim(),
        status: String(modules.status || DEFAULT_PROJECT.modules.status).trim(),
        cantidades: String(modules.cantidades || DEFAULT_PROJECT.modules.cantidades).trim(),
        pdf: String(modules.pdf || DEFAULT_PROJECT.modules.pdf).trim(),
        dwg: String(modules.dwg || DEFAULT_PROJECT.modules.dwg).trim(),
      },
      actions: {
        publicaciones: String(actions.publicaciones || DEFAULT_PROJECT.actions.publicaciones).trim(),
        solicitudes: String(actions.solicitudes || DEFAULT_PROJECT.actions.solicitudes).trim(),
        equipo: String(actions.equipo || DEFAULT_PROJECT.actions.equipo).trim(),
      },
      dataSources: {
        driveFolderName: String(dataSources.driveFolderName || safeName).trim(),
        driveFolderId: String(dataSources.driveFolderId || '').trim(),
        driveScriptUrl: String(dataSources.driveScriptUrl || '').trim(),
        statusSheetId: String(dataSources.statusSheetId || '').trim(),
        statusScriptUrl: String(dataSources.statusScriptUrl || '').trim(),
        cantidadesSheetId: String(dataSources.cantidadesSheetId || '').trim(),
        cantidadesScriptUrl: String(dataSources.cantidadesScriptUrl || '').trim(),
      },
      landing: {
        ...clone(DEFAULT_PROJECT.landing),
        ...landing,
        enabled: landing?.enabled !== false,
        eyebrow: String(landing?.eyebrow || DEFAULT_PROJECT.landing.eyebrow).trim(),
        title: String(landing?.title || safeName.toUpperCase()).trim(),
        subtitle: String(landing?.subtitle || DEFAULT_PROJECT.landing.subtitle).trim(),
        actionEyebrow: String(landing?.actionEyebrow || DEFAULT_PROJECT.landing.actionEyebrow).trim(),
        actionTitle: String(landing?.actionTitle || DEFAULT_PROJECT.landing.actionTitle).trim(),
        actionDescription: String(landing?.actionDescription || DEFAULT_PROJECT.landing.actionDescription).trim(),
        mapEyebrow: String(landing?.mapEyebrow || DEFAULT_PROJECT.landing.mapEyebrow).trim(),
        cityLabel: String(landing?.cityLabel || project?.city || DEFAULT_PROJECT.city).trim(),
        mapDescription: String(landing?.mapDescription || DEFAULT_PROJECT.landing.mapDescription).trim(),
        address: String(landing?.address || '').trim(),
        logoUrl: String(landing?.logoUrl || DEFAULT_PROJECT.landing.logoUrl).trim(),
        portalLogoLight: String(landing?.portalLogoLight || DEFAULT_PROJECT.landing.portalLogoLight).trim(),
        portalLogoDark: String(landing?.portalLogoDark || DEFAULT_PROJECT.landing.portalLogoDark).trim(),
        map: {
          lat: Number.isFinite(Number(map.lat)) ? Number(map.lat) : DEFAULT_PROJECT.landing.map.lat,
          lng: Number.isFinite(Number(map.lng)) ? Number(map.lng) : DEFAULT_PROJECT.landing.map.lng,
          zoom: Number.isFinite(Number(map.zoom)) ? Number(map.zoom) : DEFAULT_PROJECT.landing.map.zoom,
        },
      },
    };
  }

  function normalizeConfig(raw) {
    const safe = raw && typeof raw === 'object' ? raw : {};
    return {
      portal: {
        name: String(safe.portal?.name || DEFAULT_CONFIG.portal.name).trim(),
        shortName: String(safe.portal?.shortName || DEFAULT_CONFIG.portal.shortName).trim(),
        footerText: String(safe.portal?.footerText || DEFAULT_CONFIG.portal.footerText).trim(),
        heroImages: Array.isArray(safe.portal?.heroImages)
          ? safe.portal.heroImages.map((url) => String(url || '').trim()).filter(Boolean)
          : [],
        configPageUrl: String(safe.portal?.configPageUrl || DEFAULT_CONFIG.portal.configPageUrl).trim(),
        logoLight: String(safe.portal?.logoLight || DEFAULT_CONFIG.portal.logoLight).trim(),
        logoDark: String(safe.portal?.logoDark || DEFAULT_CONFIG.portal.logoDark).trim(),
        footerLogoLight: String(safe.portal?.footerLogoLight || DEFAULT_CONFIG.portal.footerLogoLight).trim(),
        footerLogoDark: String(safe.portal?.footerLogoDark || DEFAULT_CONFIG.portal.footerLogoDark).trim(),
        footerLogoSecondaryLight: String(safe.portal?.footerLogoSecondaryLight || DEFAULT_CONFIG.portal.footerLogoSecondaryLight).trim(),
        footerLogoSecondaryDark: String(safe.portal?.footerLogoSecondaryDark || DEFAULT_CONFIG.portal.footerLogoSecondaryDark).trim(),
      },
      projects: Array.isArray(safe.projects) ? safe.projects.map(normalizeProject) : [],
      publicaciones: Array.isArray(safe.publicaciones) ? safe.publicaciones.map(normalizeLinkItem) : [],
      solicitudes: Array.isArray(safe.solicitudes) ? safe.solicitudes.map(normalizeLinkItem) : [],
      metricas: Array.isArray(safe.metricas) ? safe.metricas.map(normalizeLinkItem) : [],
      administracion: Array.isArray(safe.administracion) ? safe.administracion.map(normalizeLinkItem) : [],
    };
  }

  function currentProject() {
    if (!workingConfig.projects.length) return null;
    if (selectedProjectIndex < 0) selectedProjectIndex = 0;
    if (selectedProjectIndex >= workingConfig.projects.length) selectedProjectIndex = workingConfig.projects.length - 1;
    return workingConfig.projects[selectedProjectIndex] || null;
  }

  function ensureProjects() {
    if (!Array.isArray(workingConfig.projects) || workingConfig.projects.length === 0) {
      workingConfig.projects = [normalizeProject(clone(DEFAULT_PROJECT))];
      selectedProjectIndex = 0;
    }
  }

  function fillPortalForm() {
    el.portalName.value = workingConfig.portal.name;
    el.portalShortName.value = workingConfig.portal.shortName;
    el.portalLogoLight.value = workingConfig.portal.logoLight || '';
    el.portalLogoDark.value = workingConfig.portal.logoDark || '';
    el.portalLogoFooterLight.value = workingConfig.portal.footerLogoLight || '';
    el.portalLogoFooterDark.value = workingConfig.portal.footerLogoDark || '';
    el.portalLogoFooterSecondaryLight.value = workingConfig.portal.footerLogoSecondaryLight || '';
    el.portalLogoFooterSecondaryDark.value = workingConfig.portal.footerLogoSecondaryDark || '';
    el.portalFooter.value = workingConfig.portal.footerText;
    el.portalConfigPageUrl.value = workingConfig.portal.configPageUrl;
    el.portalHeroImages.value = workingConfig.portal.heroImages.join('\n');
  }

  function fillProjectForm() {
    ensureProjects();
    const project = currentProject();
    if (!project) return;
    el.editorProjectTitle.textContent = project.name || 'Nuevo proyecto';
    el.projectName.value = project.name;
    el.projectSlug.value = project.slug;
    el.projectHomeUrl.value = project.homeUrl;
    el.projectCity.value = project.city;
    el.projectType.value = project.type;
    el.projectStatus.value = project.status;
    el.projectEnabled.checked = project.enabled;
    el.projectLandingEnabled.checked = project.landing.enabled !== false;
    el.landingEyebrow.value = project.landing.eyebrow;
    el.landingTitle.value = project.landing.title;
    el.landingSubtitle.value = project.landing.subtitle;
    el.landingActionEyebrow.value = project.landing.actionEyebrow;
    el.landingActionTitle.value = project.landing.actionTitle;
    el.landingActionDescription.value = project.landing.actionDescription;
    el.landingLogoUrl.value = project.landing.logoUrl;
    el.landingPortalLogoLight.value = project.landing.portalLogoLight;
    el.landingPortalLogoDark.value = project.landing.portalLogoDark;
    el.landingMapEyebrow.value = project.landing.mapEyebrow;
    el.landingCityLabel.value = project.landing.cityLabel;
    el.landingMapDescription.value = project.landing.mapDescription;
    el.landingAddress.value = project.landing.address;
    el.landingMapLat.value = String(project.landing.map.lat);
    el.landingMapLng.value = String(project.landing.map.lng);
    el.landingMapZoom.value = String(project.landing.map.zoom);
    el.driveFolderName.value = project.dataSources.driveFolderName;
    el.driveFolderId.value = project.dataSources.driveFolderId;
    el.driveScriptUrl.value = project.dataSources.driveScriptUrl;
    el.statusSheetId.value = project.dataSources.statusSheetId;
    el.statusScriptUrl.value = project.dataSources.statusScriptUrl;
    el.cantidadesSheetId.value = project.dataSources.cantidadesSheetId;
    el.cantidadesScriptUrl.value = project.dataSources.cantidadesScriptUrl;
    el.moduleIfc.value = project.modules.ifc;
    el.moduleStatus.value = project.modules.status;
    el.moduleCantidades.value = project.modules.cantidades;
    el.modulePdf.value = project.modules.pdf;
    el.moduleDwg.value = project.modules.dwg;
    el.actionPublicaciones.value = project.actions.publicaciones;
    el.actionSolicitudes.value = project.actions.solicitudes;
    el.actionEquipo.value = project.actions.equipo;
    el.summaryCurrentProject.textContent = project.name;
    slugManuallyEdited = false;
    refreshMapPreview();
  }

  function renderProjectList() {
    ensureProjects();
    el.projectList.innerHTML = workingConfig.projects.map((project, index) => {
      const activeClass = index === selectedProjectIndex
        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';
      return `
        <button type="button" data-index="${index}" class="project-item w-full rounded-2xl border px-4 py-3 text-left transition ${activeClass}">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-sm font-semibold">${escapeHtml(project.name)}</div>
              <div class="mt-1 text-xs ${index === selectedProjectIndex ? 'text-slate-200' : 'text-slate-500'}">${escapeHtml(project.city || 'Sin ciudad')} · ${escapeHtml(project.slug)}</div>
            </div>
            <div class="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${project.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}">${project.enabled ? 'Activo' : 'Oculto'}</div>
          </div>
        </button>
      `;
    }).join('');
  }

  function renderSummary() {
    const activeProjects = workingConfig.projects.filter((project) => project.enabled);
    el.summaryProjectCount.textContent = String(activeProjects.length);
    el.jsonPreview.textContent = JSON.stringify(workingConfig, null, 2);
    // Silent autosave to localStorage
    localStorage.setItem(DRAFT_KEY, JSON.stringify(workingConfig));
  }

  function syncUi() {
    fillPortalForm();
    renderProjectList();
    fillProjectForm();
    renderSummary();
  }

  function updateCurrentProject(mutator) {
    const project = currentProject();
    if (!project) return;
    mutator(project);
    renderProjectList();
    renderSummary();
    refreshMapPreview();
    el.editorProjectTitle.textContent = project.name || 'Nuevo proyecto';
    el.summaryCurrentProject.textContent = project.name || '-';
  }

  function refreshMapPreview() {
    const project = currentProject();
    if (!project || !window.L) return;
    const lat = Number(project.landing.map.lat);
    const lng = Number(project.landing.map.lng);
    const zoom = Number(project.landing.map.zoom) || 13;
    if (!configMap) {
      configMap = window.L.map('config-map');
      window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(configMap);
      configMarker = window.L.marker([lat, lng]).addTo(configMap);
      configMap.on('click', (e) => {
        mapSilentUpdate = true;
        el.landingMapLat.value = String(e.latlng.lat.toFixed(6));
        el.landingMapLng.value = String(e.latlng.lng.toFixed(6));
        updateCurrentProject((item) => {
          item.landing.map.lat = Number(e.latlng.lat.toFixed(6));
          item.landing.map.lng = Number(e.latlng.lng.toFixed(6));
        });
        mapSilentUpdate = false;
      });
    }
    configMarker.setLatLng([lat, lng]);
    configMap.setView([lat, lng], zoom);
    window.setTimeout(() => configMap.invalidateSize(), 50);
  }

  function saveDraft(message) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(workingConfig));
    showBanner(message || 'Borrador local guardado.', 'success');
  }

  async function loadPublishedConfig() {
    const response = await fetch(`${CONFIG_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`No se pudo leer ${CONFIG_URL}`);
    return normalizeConfig(await response.json());
  }

  function readDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? normalizeConfig(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  function bindPortalInputs() {
    [
      [el.portalName, (value) => { workingConfig.portal.name = value; }],
      [el.portalShortName, (value) => { workingConfig.portal.shortName = value; }],
      [el.portalLogoLight, (value) => { workingConfig.portal.logoLight = value; }],
      [el.portalLogoDark, (value) => { workingConfig.portal.logoDark = value; }],
      [el.portalLogoFooterLight, (value) => { workingConfig.portal.footerLogoLight = value; }],
      [el.portalLogoFooterDark, (value) => { workingConfig.portal.footerLogoDark = value; }],
      [el.portalLogoFooterSecondaryLight, (value) => { workingConfig.portal.footerLogoSecondaryLight = value; }],
      [el.portalLogoFooterSecondaryDark, (value) => { workingConfig.portal.footerLogoSecondaryDark = value; }],
      [el.portalFooter, (value) => { workingConfig.portal.footerText = value; }],
      [el.portalConfigPageUrl, (value) => { workingConfig.portal.configPageUrl = value; }],
    ].forEach(([input, apply]) => {
      input.addEventListener('input', () => {
        apply(input.value.trim());
        renderSummary();
      });
    });

    el.portalHeroImages.addEventListener('input', () => {
      workingConfig.portal.heroImages = el.portalHeroImages.value.split('\n').map((line) => line.trim()).filter(Boolean);
      renderSummary();
    });
  }

  function bindProjectInputs() {
    el.projectName.addEventListener('input', () => {
      updateCurrentProject((project) => {
        project.name = el.projectName.value.trim();
        if (!slugManuallyEdited || !project.slug) {
          project.slug = slugify(project.name);
          el.projectSlug.value = project.slug;
        }
        if (!project.landing.title || project.landing.title === project.landing.title.toUpperCase()) {
          project.landing.title = (project.name || 'Nuevo proyecto').toUpperCase();
          el.landingTitle.value = project.landing.title;
        }
      });
    });

    el.projectSlug.addEventListener('input', () => {
      slugManuallyEdited = true;
      updateCurrentProject((project) => {
        project.slug = slugify(el.projectSlug.value);
      });
      el.projectSlug.value = currentProject().slug;
    });

    [
      [el.projectHomeUrl, (project, value) => { project.homeUrl = value; }],
      [el.projectCity, (project, value) => {
        project.city = value;
        if (!project.landing.cityLabel || project.landing.cityLabel === project.city.toUpperCase()) {
          project.landing.cityLabel = value.toUpperCase();
          el.landingCityLabel.value = project.landing.cityLabel;
        }
      }],
      [el.projectType, (project, value) => { project.type = value; }],
      [el.projectStatus, (project, value) => { project.status = value; }],
      [el.landingEyebrow, (project, value) => { project.landing.eyebrow = value; }],
      [el.landingTitle, (project, value) => { project.landing.title = value; }],
      [el.landingSubtitle, (project, value) => { project.landing.subtitle = value; }],
      [el.landingActionEyebrow, (project, value) => { project.landing.actionEyebrow = value; }],
      [el.landingActionTitle, (project, value) => { project.landing.actionTitle = value; }],
      [el.landingActionDescription, (project, value) => { project.landing.actionDescription = value; }],
      [el.landingLogoUrl, (project, value) => { project.landing.logoUrl = value; }],
      [el.landingPortalLogoLight, (project, value) => { project.landing.portalLogoLight = value; }],
      [el.landingPortalLogoDark, (project, value) => { project.landing.portalLogoDark = value; }],
      [el.landingMapEyebrow, (project, value) => { project.landing.mapEyebrow = value; }],
      [el.landingCityLabel, (project, value) => { project.landing.cityLabel = value; }],
      [el.landingMapDescription, (project, value) => { project.landing.mapDescription = value; }],
      [el.landingAddress, (project, value) => { project.landing.address = value; }],
      [el.driveFolderName, (project, value) => { project.dataSources.driveFolderName = value; }],
      [el.driveFolderId, (project, value) => { project.dataSources.driveFolderId = extractDriveFolderId(value); }],
      [el.driveScriptUrl, (project, value) => { project.dataSources.driveScriptUrl = value; }],
      [el.statusSheetId, (project, value) => { project.dataSources.statusSheetId = value; }],
      [el.statusScriptUrl, (project, value) => { project.dataSources.statusScriptUrl = value; }],
      [el.cantidadesSheetId, (project, value) => { project.dataSources.cantidadesSheetId = value; }],
      [el.cantidadesScriptUrl, (project, value) => { project.dataSources.cantidadesScriptUrl = value; }],
      [el.moduleIfc, (project, value) => { project.modules.ifc = value; }],
      [el.moduleStatus, (project, value) => { project.modules.status = value; }],
      [el.moduleCantidades, (project, value) => { project.modules.cantidades = value; }],
      [el.modulePdf, (project, value) => { project.modules.pdf = value; }],
      [el.moduleDwg, (project, value) => { project.modules.dwg = value; }],
      [el.actionPublicaciones, (project, value) => { project.actions.publicaciones = value; }],
      [el.actionSolicitudes, (project, value) => { project.actions.solicitudes = value; }],
      [el.actionEquipo, (project, value) => { project.actions.equipo = value; }],
    ].forEach(([input, apply]) => {
      input.addEventListener('input', () => updateCurrentProject((project) => apply(project, input.value.trim())));
    });

    el.driveFolderId.addEventListener('blur', () => {
      const cleaned = extractDriveFolderId(el.driveFolderId.value);
      el.driveFolderId.value = cleaned;
    });

    el.projectEnabled.addEventListener('change', () => updateCurrentProject((project) => { project.enabled = el.projectEnabled.checked; }));
    el.projectLandingEnabled.addEventListener('change', () => updateCurrentProject((project) => { project.landing.enabled = el.projectLandingEnabled.checked; }));

    [el.landingMapLat, el.landingMapLng, el.landingMapZoom].forEach((input) => {
      input.addEventListener('input', () => {
        if (mapSilentUpdate) return;
        updateCurrentProject((project) => {
          project.landing.map.lat = Number(el.landingMapLat.value) || DEFAULT_PROJECT.landing.map.lat;
          project.landing.map.lng = Number(el.landingMapLng.value) || DEFAULT_PROJECT.landing.map.lng;
          project.landing.map.zoom = Number(el.landingMapZoom.value) || DEFAULT_PROJECT.landing.map.zoom;
        });
      });
    });
  }

  function bindProjectList() {
    el.projectList.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest('.project-item');
      if (!(button instanceof HTMLElement)) return;
      selectedProjectIndex = Number(button.getAttribute('data-index'));
      syncUi();
    });
  }

  function addProject() {
    const nextIndex = workingConfig.projects.length + 1;
    const fresh = normalizeProject({
      ...clone(DEFAULT_PROJECT),
      name: `Nuevo proyecto ${nextIndex}`,
      slug: `nuevo-proyecto-${nextIndex}`,
      landing: {
        ...clone(DEFAULT_PROJECT.landing),
        title: `NUEVO PROYECTO ${nextIndex}`,
      },
    });
    workingConfig.projects.push(fresh);
    selectedProjectIndex = workingConfig.projects.length - 1;
    syncUi();
    showBanner('Proyecto agregado. Completa la configuración de su landing.', 'success');
  }

  function duplicateProject() {
    const project = currentProject();
    if (!project) return;
    const copy = normalizeProject(clone(project));
    copy.name = `${project.name} copia`;
    copy.slug = slugify(`${project.slug}-copia`);
    workingConfig.projects.splice(selectedProjectIndex + 1, 0, copy);
    selectedProjectIndex += 1;
    syncUi();
    showBanner('Proyecto duplicado correctamente.', 'success');
  }

  function removeProject() {
    if (workingConfig.projects.length <= 1) {
      showBanner('Debe existir al menos un proyecto en la configuración.', 'warn');
      return;
    }
    workingConfig.projects.splice(selectedProjectIndex, 1);
    selectedProjectIndex = Math.max(0, selectedProjectIndex - 1);
    syncUi();
    showBanner('Proyecto eliminado.', 'warn');
  }

  function applyTrevolyBase() {
    updateCurrentProject((project) => {
      project.landing = {
        ...project.landing,
        ...clone(TREVOLY_TEMPLATE),
        title: project.name ? project.name.toUpperCase() : TREVOLY_TEMPLATE.title,
        cityLabel: project.city ? project.city.toUpperCase() : TREVOLY_TEMPLATE.cityLabel,
      };
      project.modules = {
        ...clone(DEFAULT_PROJECT.modules),
        ...project.modules,
      };
      project.actions = {
        ...clone(DEFAULT_PROJECT.actions),
        ...project.actions,
      };
    });
    fillProjectForm();
    showBanner('Se aplicó la base visual de Trevoly al proyecto seleccionado.', 'success');
  }

  function attachButtons() {
    el.addProjectBtn.addEventListener('click', addProject);
    el.duplicateProjectBtn.addEventListener('click', duplicateProject);
    el.removeProjectBtn.addEventListener('click', removeProject);
    el.applyTrevolyBtn.addEventListener('click', applyTrevolyBase);
    el.saveDraftBtn.addEventListener('click', () => saveDraft('Borrador local guardado.'));

    el.publishBtn.addEventListener('click', async () => {
      try {
        const jsonString = JSON.stringify(workingConfig, null, 2) + '\n';
        if (window.showSaveFilePicker) {
          const handle = await window.showSaveFilePicker({
            suggestedName: 'portal-config.json',
            types: [{
              description: 'JSON Files',
              accept: {'application/json': ['.json']},
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(jsonString);
          await writable.close();
          showBanner('Archivo guardado. ¡No olvides hacer commit y push en GitHub para publicarlo para todos!', 'success');
        } else {
          el.exportJsonBtn.click();
          showBanner('Archivo descargado. Reemplaza portal-config.json en tu carpeta y haz commit/push en GitHub.', 'success');
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          showBanner('Error al guardar el archivo: ' + err.message, 'error');
        }
      }
    });

    el.restorePublishedBtn.addEventListener('click', () => {
      workingConfig = clone(publishedConfig);
      selectedProjectIndex = 0;
      syncUi();
      showBanner('Se restauró la configuración publicada.', 'info');
    });

    el.clearDraftBtn.addEventListener('click', () => {
      localStorage.removeItem(DRAFT_KEY);
      workingConfig = clone(publishedConfig);
      selectedProjectIndex = 0;
      syncUi();
      showBanner('Se eliminó el borrador local.', 'warn');
    });

    el.exportJsonBtn.addEventListener('click', () => {
      const blob = new Blob([`${JSON.stringify(workingConfig, null, 2)}\n`], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'portal-config.json';
      a.click();
      URL.revokeObjectURL(url);
      showBanner('Se descargó `portal-config.json`.', 'success');
    });

    el.copyJsonBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(workingConfig, null, 2));
        showBanner('JSON copiado al portapapeles.', 'success');
      } catch {
        showBanner('No se pudo copiar el JSON.', 'error');
      }
    });

    el.importJsonBtn.addEventListener('click', () => el.importJsonInput.click());

    el.importJsonInput.addEventListener('change', async () => {
      const file = el.importJsonInput.files?.[0];
      if (!file) return;
      try {
        const imported = normalizeConfig(JSON.parse(await file.text()));
        workingConfig = imported;
        selectedProjectIndex = 0;
        syncUi();
        showBanner('Archivo importado correctamente.', 'success');
      } catch (error) {
        showBanner(`No se pudo importar el archivo: ${error instanceof Error ? error.message : 'JSON inválido'}`, 'error');
      } finally {
        el.importJsonInput.value = '';
      }
    });
  }

  try {
    publishedConfig = await loadPublishedConfig();
    workingConfig = readDraft() || clone(publishedConfig);
  } catch (error) {
    publishedConfig = clone(DEFAULT_CONFIG);
    workingConfig = readDraft() || clone(DEFAULT_CONFIG);
    showBanner(`No se pudo cargar la configuración publicada: ${error instanceof Error ? error.message : 'error desconocido'}`, 'error');
  }

  ensureProjects();
  bindPortalInputs();
  bindProjectInputs();
  bindProjectList();
  attachButtons();
  syncUi();

  if (el.statusBanner.classList.contains('hidden')) {
    showBanner('Configuración cargada. Edita el proyecto y exporta el JSON para publicarlo.', 'info');
  }
});
