/**
 * nora-navigation.js
 * Sistema de Navegación Jerárquica Unificada para nora CDE.
 * 
 * Reglas de comportamiento:
 * 1. Comportamiento consistente y predecible en todo el sitio.
 * 2. La flecha hacia la izquierda (<--) siempre te lleva a la CAPA SUPERIOR
 *    según el árbol organizacional (NUNCA a un proyecto distinto, NUNCA window.history.back):
 *      - Nivel 3 (Módulos de Proyecto: VSR_IFCA, VSR_PDFA, VSR_DWGA, STATUS, CANTIDADES, INCIDENCIAS, equipo, ajustes, publicaciones, etc.)
 *          ==> Capa superior: Landing del Proyecto (project-landing.html?project=...&empresa=...)
 *      - Nivel 2 (Landing del Proyecto: project-landing.html)
 *          ==> Capa superior: Home de la Empresa (home.html?empresa=...)
 *      - Nivel 1 (Home de la Empresa: home.html)
 *          ==> Capa superior: Home de Empresas de nora (empresas.html)
 *      - Páginas generales (super-admin.html, perfil.html sin empresa)
 *          ==> Capa superior: empresas.html
 * 3. El logo de nora:
 *      - En el Home de la Empresa (home.html, Imagen 4):
 *          ==> Te lleva al Home de Empresas de nora (empresas.html) donde ves todas tus empresas.
 *      - En cualquier otra página (project-landing.html, VSR_IFCA, equipo, etc.):
 *          ==> Te lleva al Home de la empresa en la que estés trabajando (home.html?empresa=...)
 *      - En empresas.html:
 *          ==> Se mantiene en empresas.html.
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
        return String(v).trim();
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

    // Regla 3: "y el home de la empresa, imagen 4, te lleva al home de empresas de nora donde vez todas las empresas a las que has sido asignado"
    if (p.endsWith('/home.html') || p.endsWith('home.html') || p.endsWith('/home') || p.endsWith('home')) {
      return prefix + 'empresas.html';
    }

    // En empresas.html permanece en empresas.html
    if (p.endsWith('/empresas.html') || p.endsWith('empresas.html')) {
      return prefix + 'empresas.html';
    }

    // Regla 3: "El logo de nora te debe llevar al home de la empresa en la que estes trabajando"
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

    var btn = target.closest('button, a, [role="button"]') || target;
    var id = (btn.id || target.id || '').toLowerCase();
    var title = (btn.getAttribute('title') || target.getAttribute('title') || '').toLowerCase();
    var aria = (btn.getAttribute('aria-label') || target.getAttribute('aria-label') || '').toLowerCase();

    if (id === 'back-btn' || id === 'btn-header-back' || id === 'nav-back-btn') {
      return true;
    }
    if (title.indexOf('volver') !== -1 || title.indexOf('regresar') !== -1) {
      return true;
    }
    if (aria.indexOf('volver') !== -1 || aria.indexOf('regresar') !== -1) {
      return true;
    }

    // Chequear icono de flecha atrás en el botón
    var icon = btn.querySelector('.material-symbols-outlined, .material-icons, i.fa-arrow-left, i.fa-chevron-left, svg');
    if (icon) {
      var text = (icon.textContent || '').trim().toLowerCase();
      if (text === 'arrow_back' || text === 'arrow_left' || text === 'arrow_back_ios' || text === 'arrow_upward') {
        return true;
      }
      if (icon.classList && (icon.classList.contains('fa-arrow-left') || icon.classList.contains('fa-chevron-left'))) {
        return true;
      }
    }

    var targetText = (target.textContent || '').trim().toLowerCase();
    if (targetText === 'arrow_back' || targetText === 'arrow_left') {
      return true;
    }

    return false;
  }

  function isNoraLogoElement(target) {
    if (!target || target === document.body || target === document.documentElement) return false;

    var el = target.closest('a, button, [role="button"]') || target;
    var id = (el.id || target.id || '').toLowerCase();
    var src = (target.getAttribute('src') || el.getAttribute('src') || '').toLowerCase();
    var alt = (target.getAttribute('alt') || el.getAttribute('alt') || '').toLowerCase();
    var title = (el.getAttribute('title') || target.getAttribute('title') || '').toLowerCase();
    var href = (el.getAttribute('href') || '').toLowerCase();

    if (id === 'logo-img' || id === 'logo-link' || id === 'portal-logo-light' || id === 'portal-logo-dark' || id === 'portal-logo-nora' || id === 'project-portal-logo-light' || id === 'project-portal-logo-dark' || id === 'project-portal-logo-link') {
      return true;
    }

    if (src.indexOf('logo-nora') !== -1 || src.indexOf('logo_nora') !== -1 || src.indexOf('favicon-nora') !== -1 || src.indexOf('logo-texto-nora') !== -1 || src.indexOf('logo-(1).jpg') !== -1 || src.indexOf('logo-solo') !== -1) {
      return true;
    }

    if (alt === 'nora cde' || alt === 'logo de amarillo' || alt === 'nora' || (alt === 'nora' && target.tagName === 'IMG')) {
      return true;
    }

    if (title.indexOf('volver al home') !== -1 || title.indexOf('ir al home') !== -1 || title.indexOf('cambiar de empresa') !== -1) {
      return true;
    }

    // Si es un enlace a home.html en la barra superior/header (y no es empresas.html)
    if (el.tagName === 'A' && (href.endsWith('home.html') || href.includes('home.html?')) && !href.includes('empresas.html')) {
      return true;
    }

    // Si es un enlace que contiene dentro una imagen con logo de nora
    if (el.tagName === 'A' && el.querySelector('#logo-img, #portal-logo-light, #portal-logo-dark, [src*="LOGO-NORA"], [src*="logo-texto-nora"], [src*="LOGO_NORA"], [src*="Logo-NORA"]')) {
      return true;
    }

    return false;
  }

  // Interceptor global en fase de captura (capture: true):
  // Se ejecuta ANTES que cualquier listener minificado de React/Vue (evita que se ejecute window.history.back)
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

    // Actualizar enlaces de logo en el DOM
    var logoLinks = document.querySelectorAll('a[title*="Home"], a[title*="home"], #logo-link, #project-portal-logo-link, a[href*="home.html"]');
    logoLinks.forEach(function (a) {
      if (a && a.tagName === 'A') {
        var href = a.getAttribute('href') || '';
        if (!href.startsWith('http://') && !href.startsWith('https://') || href.includes('norabim.com')) {
          a.href = logoUrl;
        }
      }
    });

    // Actualizar botones y enlaces de volver
    var backBtns = document.querySelectorAll('#back-btn, #btn-header-back, [aria-label="Volver"]');
    backBtns.forEach(function (btn) {
      if (btn) {
        if (btn.tagName === 'A') {
          btn.href = upperUrl;
        }
        btn.setAttribute('title', 'Volver a la capa superior');
      }
    });

    // Si estamos en empresas.html (raíz), ocultar back-btn si existe para no confundir
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

  // Re-sincronizar periódicamente y con MutationObserver para React/Vue SPAs
  try {
    var obs = new MutationObserver(function () {
      syncDomNavigation();
    });
    obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
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
