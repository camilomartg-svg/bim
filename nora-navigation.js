/**
 * nora-navigation.js
 * Sistema de Navegación Jerárquica Unificada para nora CDE.
 * 
 * Reglas de comportamiento:
 * 1. Comportamiento consistente y predecible en todo el sitio.
 * 2. La flecha hacia la izquierda (<--) siempre te lleva a la CAPA SUPERIOR
 *    según el árbol organizacional (NUNCA a un proyecto distinto, NUNCA window.history.back):
 *      - Nivel 3 (Módulos de Proyecto: VSR_IFCA, VSR_PDFA, VSR_DWGA, STATUS, CANTIDADES, INCIDENCIAS, equipo, ajustes, etc.)
 *          ==> Capa superior: Landing del Proyecto (project-landing.html?project=...&empresa=...)
 *      - Nivel 2 (Landing del Proyecto: project-landing.html)
 *          ==> Capa superior: Home de la Empresa (home.html?empresa=...)
 *      - Nivel 1 (Home de la Empresa: home.html)
 *          ==> Capa superior: Home de Empresas de nora (empresas.html)
 *      - Páginas generales (super-admin.html, perfil.html sin empresa)
 *          ==> Capa superior: empresas.html
 * 3. El logo de nora:
 *      - En el Home de la Empresa (home.html):
 *          ==> Te lleva al Home de Empresas de nora (empresas.html) donde ves todas tus empresas.
 *      - En cualquier otra página (project-landing.html, VSR_IFCA, equipo, etc.):
 *          ==> Te lleva al Home de la empresa en la que estés trabajando (home.html?empresa=...)
 *      - En empresas.html:
 *          ==> Se mantiene en empresas.html.
 * 4. SEGURIDAD:
 *      - NUNCA interceptar clics en tarjetas de empresa o de proyectos.
 *      - NUNCA sobreescribir los enlaces de tarjetas de empresas en empresas.html.
 */
(function (global) {
  'use strict';

  if (global.__NoraNavInitialized) return;
  global.__NoraNavInitialized = true;

  function isSubfolderPage() {
    try {
      var p = String((global.location && global.location.pathname) || '');
      return /\/(VSR_[A-Za-z0-9_]+|CANTIDADES|STATUS|INCIDENCIAS|ANIHOME|BANNER_VIEWER|CARGA_SIMPLIFICADA)(\/|$)/i.test(p);
    } catch (e) {
      return false;
    }
  }

  function getRootPrefix() {
    return isSubfolderPage() ? '../' : '';
  }

  function getCleanParam(params, keys) {
    if (!params) return '';
    for (var i = 0; i < keys.length; i++) {
      var v = params.get(keys[i]);
      if (v && String(v).trim() !== '' && String(v).trim().toLowerCase() !== 'null' && String(v).trim().toLowerCase() !== 'undefined') {
        try {
          return decodeURIComponent(String(v).trim());
        } catch (e) {
          return String(v).trim();
        }
      }
    }
    return '';
  }

  function getNavigationContext() {
    var params = null;
    try {
      params = new URLSearchParams(global.location.search || '');
    } catch (e) {}

    var empresa = getCleanParam(params, ['empresa', 'empresaId', 'company', 'companyId']);
    var project = getCleanParam(params, ['project', 'proj', 'slug', 'projectSlug']);

    // Persistir en sessionStorage si vienen en la URL
    try {
      if (empresa) global.sessionStorage.setItem('currentEmpresa', empresa);
      if (project) global.sessionStorage.setItem('currentProject', project);
    } catch (e) {}

    // Si falta en la URL, rescatar de sessionStorage o cuenta de usuario
    if (!empresa) {
      try {
        empresa = global.sessionStorage.getItem('currentEmpresa') ||
                  global.localStorage.getItem('currentEmpresa') ||
                  global.sessionStorage.getItem('empresa') || '';
      } catch (e) {}
    }

    if (!empresa) {
      try {
        var rawUa = global.sessionStorage.getItem('userAccount') || global.localStorage.getItem('userAccount');
        if (rawUa) {
          var ua = JSON.parse(rawUa);
          empresa = ua.adminEmpresaId || ua.empresa || '';
        }
      } catch (e) {}
    }

    if (!project) {
      try {
        project = global.sessionStorage.getItem('currentProject') || '';
      } catch (e) {}
    }

    return {
      empresa: empresa || '',
      project: project || '',
      prefix: getRootPrefix()
    };
  }

  function getUpperLayerUrl() {
    var ctx = getNavigationContext();
    var p = String((global.location && global.location.pathname) || '').toLowerCase();
    var prefix = ctx.prefix;
    var empresa = ctx.empresa;
    var project = ctx.project;

    // Nivel 1: home.html -> Capa superior es empresas.html
    if (p.endsWith('/home.html') || p.endsWith('home.html') || p.endsWith('/home') || p.endsWith('home')) {
      return prefix + 'empresas.html';
    }

    // Nivel 2: project-landing.html -> Capa superior es el Home de la Empresa
    if (p.includes('project-landing.html') || p.includes('project-landing')) {
      return prefix + 'home.html' + (empresa ? '?empresa=' + encodeURIComponent(empresa) : '');
    }

    // Nivel 0: empresas.html -> Ya está en la raíz
    if (p.endsWith('/empresas.html') || p.endsWith('empresas.html')) {
      return prefix + 'empresas.html';
    }

    // super-admin.html -> Capa superior es empresas.html
    if (p.includes('super-admin.html')) {
      return prefix + 'empresas.html';
    }

    // portal-configurator.html -> Capa superior es home.html
    if (p.includes('portal-configurator.html')) {
      return prefix + 'home.html' + (empresa ? '?empresa=' + encodeURIComponent(empresa) : '');
    }

    // perfil.html -> Capa superior
    if (p.includes('perfil.html')) {
      try {
        var searchParams = new URLSearchParams(global.location.search);
        var from = searchParams.get('from') || '';
        if (from === 'project' && project) {
          return prefix + 'project-landing.html?project=' + encodeURIComponent(project) + (empresa ? '&empresa=' + encodeURIComponent(empresa) : '');
        }
        if (from === 'home' && empresa) {
          return prefix + 'home.html?empresa=' + encodeURIComponent(empresa);
        }
      } catch (e) {}
      if (empresa) {
        return prefix + 'home.html?empresa=' + encodeURIComponent(empresa);
      }
      return prefix + 'empresas.html';
    }

    // Nivel 3: Módulos de Proyecto (VSR_IFCA, VSR_PDFA, VSR_DWGA, STATUS, CANTIDADES, INCIDENCIAS, equipo, project-settings, Publicaciones, CARGA_SIMPLIFICADA, etc.)
    if (project) {
      return prefix + 'project-landing.html?project=' + encodeURIComponent(project) + (empresa ? '&empresa=' + encodeURIComponent(empresa) : '');
    }

    // Si no hay proyecto pero hay empresa:
    if (empresa) {
      return prefix + 'home.html?empresa=' + encodeURIComponent(empresa);
    }

    return prefix + 'empresas.html';
  }

  function getNoraLogoUrl() {
    var ctx = getNavigationContext();
    var p = String((global.location && global.location.pathname) || '').toLowerCase();
    var prefix = ctx.prefix;
    var empresa = ctx.empresa;

    // Regla 3: En el home de la empresa, te lleva a la selección de empresas (empresas.html)
    if (p.endsWith('/home.html') || p.endsWith('home.html') || p.endsWith('/home') || p.endsWith('home')) {
      return prefix + 'empresas.html';
    }

    // En empresas.html permanece en empresas.html
    if (p.endsWith('/empresas.html') || p.endsWith('empresas.html')) {
      return prefix + 'empresas.html';
    }

    // Regla 3: En cualquier otra página, te lleva al home de la empresa actual
    return prefix + 'home.html' + (empresa ? '?empresa=' + encodeURIComponent(empresa) : '');
  }

  function navigateUpper() {
    var target = getUpperLayerUrl();
    try {
      global.location.href = target;
    } catch (e) {
      global.location.assign(target);
    }
  }

  function navigateCompanyHome() {
    var target = getNoraLogoUrl();
    try {
      global.location.href = target;
    } catch (e) {
      global.location.assign(target);
    }
  }

  function isBackButtonElement(target) {
    if (!target || target === document.body || target === document.documentElement) return false;

    // NUNCA interceptar tarjetas de empresas o proyectos
    if (target.closest('.company-card, .card-hover, #empresas-container, #companies-container, #projects-list, #projects-container, #project-tools-container, #project-quick-links')) {
      return false;
    }

    var btn = target.closest('button, a, [role="button"]');
    if (!btn) return false; // Solo aplica si se hace clic explícitamente dentro de un botón o enlace

    var id = (btn.id || '').toLowerCase();
    var title = (btn.getAttribute('title') || '').toLowerCase();
    var aria = (btn.getAttribute('aria-label') || '').toLowerCase();

    if (id === 'back-btn' || id === 'btn-header-back' || id === 'nav-back-btn') {
      return true;
    }
    if (title === 'volver' || title === 'regresar' || title === 'volver a la capa superior' || title === 'volver al proyecto' || title === 'volver al portal') {
      return true;
    }
    if (aria === 'volver' || aria === 'regresar') {
      return true;
    }

    if (btn.classList && (btn.classList.contains('back-btn') || btn.classList.contains('btn-back'))) {
      return true;
    }

    // Chequear icono de flecha atrás estrictamente dentro del botón
    var icon = btn.querySelector('.material-symbols-outlined, .material-icons, i.fa-arrow-left, i.fa-chevron-left');
    if (icon) {
      var text = (icon.textContent || '').trim().toLowerCase();
      if (text === 'arrow_back' || text === 'arrow_left' || text === 'arrow_back_ios') {
        return true;
      }
      if (icon.classList && (icon.classList.contains('fa-arrow-left') || icon.classList.contains('fa-chevron-left'))) {
        return true;
      }
    }

    return false;
  }

  function isNoraLogoElement(target) {
    if (!target || target === document.body || target === document.documentElement) return false;

    // NUNCA interceptar clics dentro de tarjetas de empresas o proyectos
    var isInsideCard = target.closest('.company-card, .card-hover, #empresas-container, #companies-container, #projects-list, #projects-container, #project-tools-container, #project-quick-links');
    if (isInsideCard && !target.closest('#logo-img, #logo-link, #portal-logo-light, #portal-logo-dark, #project-portal-logo-link')) {
      return false;
    }

    var el = target.closest('a, button, [role="button"]') || target;
    var id = (el.id || target.id || '').toLowerCase();
    var src = (target.getAttribute('src') || el.getAttribute('src') || '').toLowerCase();
    var alt = (target.getAttribute('alt') || el.getAttribute('alt') || '').toLowerCase();
    var title = (el.getAttribute('title') || target.getAttribute('title') || '').toLowerCase();

    // IDs explícitos de logo
    if (id === 'logo-img' || id === 'logo-link' || id === 'portal-logo-light' || id === 'portal-logo-dark' || id === 'portal-logo-nora' || id === 'project-portal-logo-light' || id === 'project-portal-logo-dark' || id === 'project-portal-logo-link') {
      return true;
    }

    // Imágenes cuyo origen sea un logo de Nora
    if (src.indexOf('logo-nora') !== -1 || src.indexOf('logo_nora') !== -1 || src.indexOf('favicon-nora') !== -1 || src.indexOf('logo-texto-nora') !== -1 || src.indexOf('logo-solo') !== -1) {
      return true;
    }

    if (alt === 'nora cde' || alt === 'nora' || alt === 'logo de amarillo') {
      return true;
    }

    if (title === 'volver al home de la empresa' || title === 'ir al home de la empresa' || title === 'cambiar de empresa') {
      return true;
    }

    // Enlaces de cabecera que contienen explícitamente el logo de Nora
    if (el.tagName === 'A' && el.querySelector('#logo-img, #portal-logo-light, #portal-logo-dark, [src*="LOGO-NORA"], [src*="logo-texto-nora"], [src*="LOGO_NORA"], [src*="Logo-NORA"]')) {
      return true;
    }

    return false;
  }

  // Interceptor global en fase de captura (capture: true):
  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target) return;

    if (isBackButtonElement(target)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      navigateUpper();
      return false;
    }

    if (isNoraLogoElement(target)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      navigateCompanyHome();
      return false;
    }
  }, true);

  // Sincronizar enlaces y atributos en el DOM
  function syncDomNavigation() {
    var upperUrl = getUpperLayerUrl();
    var logoUrl = getNoraLogoUrl();

    // Actualizar ÚNICAMENTE los enlaces que envuelven logos de Nora
    var logoSelectors = '#logo-link, #project-portal-logo-link, a.logo-link, a[title="Cambiar de empresa"], a[title="Ir al Home de la Empresa"], a[title="Volver al Home de la Empresa"]';
    document.querySelectorAll(logoSelectors).forEach(function (a) {
      if (a && a.tagName === 'A') {
        a.href = logoUrl;
      }
    });

    // Asegurar enlaces de imágenes de logo específicas (sin tocar tarjetas)
    document.querySelectorAll('#logo-img, #portal-logo-light, #portal-logo-dark, #portal-logo-nora').forEach(function (img) {
      var parentLink = img.closest('a');
      if (parentLink && !parentLink.closest('.company-card, .card-hover, #empresas-container, #companies-container, #projects-list')) {
        parentLink.href = logoUrl;
      }
    });

    // Actualizar botones de volver
    var backBtns = document.querySelectorAll('#back-btn, #btn-header-back');
    backBtns.forEach(function (btn) {
      if (btn) {
        if (btn.tagName === 'A') {
          btn.href = upperUrl;
        }
        btn.setAttribute('title', 'Volver a la capa superior');
      }
    });

    // Si estamos en empresas.html (raíz), ocultar back-btn si existe
    var p = String((global.location && global.location.pathname) || '').toLowerCase();
    if (p.endsWith('/empresas.html') || p.endsWith('empresas.html')) {
      var rootBack = document.getElementById('back-btn');
      if (rootBack) rootBack.style.display = 'none';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncDomNavigation);
  } else {
    syncDomNavigation();
  }

  // Re-sincronizar de forma ultra-ligera y con debounce (máximo una vez cada 350ms)
  var syncDebounceTimer = null;
  function debouncedSyncDomNavigation() {
    if (syncDebounceTimer) return;
    syncDebounceTimer = setTimeout(function () {
      syncDebounceTimer = null;
      syncDomNavigation();
    }, 350);
  }

  try {
    var navTarget = document.querySelector('header, nav, .top-bar, .header') || document.body;
    if (navTarget) {
      var obs = new MutationObserver(debouncedSyncDomNavigation);
      obs.observe(navTarget, { childList: true, subtree: false });
    }
  } catch (e) {}

  global.NoraNav = {
    getNavigationContext: getNavigationContext,
    getUpperLayerUrl: getUpperLayerUrl,
    getNoraLogoUrl: getNoraLogoUrl,
    navigateUpper: navigateUpper,
    navigateCompanyHome: navigateCompanyHome,
    syncDomNavigation: syncDomNavigation
  };

})(typeof window !== 'undefined' ? window : this);
