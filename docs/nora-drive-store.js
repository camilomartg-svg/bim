/**
 * nora-drive-store.js
 * Motor cliente de almacenamiento JSON ultrarrápido en Google Drive para noraCDE.
 * Carpeta Maestra en Drive: https://drive.google.com/drive/u/0/folders/1ZyW39yfyecmD-G8cfb6UrhN9jsoL7rEx
 * Reemplaza los commits lentos a GitHub API manteniendo 100% de compatibilidad con todas las páginas y rutas.
 */
(function (global) {
  'use strict';

  if (global.NoraDriveStore && global.NoraDriveStore.__initialized) {
    return;
  }

  var API_URL = 'https://script.google.com/macros/s/AKfycbx2RAQx_8K4o22xE0Mw-ETc7K_58vIoi6-PgVi64u80inuiw144ks3cgWSdCtXqIgB02g/exec';
  var DRIVE_FOLDER_ID = '1ZyW39yfyecmD-G8cfb6UrhN9jsoL7rEx';
  var CACHE_PREFIX = 'nora_ds_v2_';
  var SEEDED_FLAG_KEY = 'nora_drive_json_seeded_v1';
  var SESSION_TTL_MS = 15000; // 15s de lectura instantánea (0ms) entre pestañas/vistas; cualquier escritura invalida al instante

  var originalFetch = global.fetch ? global.fetch.bind(global) : null;
  var memoryCache = {};
  var inFlightGets = {};
  var syncChannel = null;

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      syncChannel = new BroadcastChannel('nora_drive_store_sync_v1');
      syncChannel.onmessage = function (ev) {
        if (!ev || !ev.data) return;
        if (ev.data.type === 'invalidate') {
          clearLocalCacheInternal(ev.data.fileName || null);
        }
      };
    }
  } catch (e) {}

  function isSubfolderPage() {
    try {
      var p = String((global.location && global.location.pathname) || '');
      return /\/(VSR_[A-Za-z0-9_]+|CANTIDADES|STATUS|INCIDENCIAS)(\/|$)/i.test(p);
    } catch (e) {
      return false;
    }
  }

  function buildStaticFallbackUrl(fileName, preferredUrl) {
    if (preferredUrl && typeof preferredUrl === 'string') {
      var lower = preferredUrl.toLowerCase();
      if (lower.indexOf('script.google.com') === -1 && lower.indexOf('api.github.com') === -1) {
        if (lower.indexOf('raw.githubusercontent.com') !== -1) {
          var prefixRaw = isSubfolderPage() ? '../' : '';
          return prefixRaw + fileName + '?t=' + Date.now();
        }
        return preferredUrl;
      }
    }
    var prefix = isSubfolderPage() ? '../' : '';
    return prefix + fileName + '?t=' + Date.now();
  }

  function extractManagedJsonFileName(inputUrl) {
    if (!inputUrl) return '';
    var urlStr = '';
    if (typeof inputUrl === 'string') {
      urlStr = inputUrl;
    } else if (typeof Request !== 'undefined' && inputUrl instanceof Request) {
      urlStr = inputUrl.url || '';
    } else if (inputUrl && typeof inputUrl.url === 'string') {
      urlStr = inputUrl.url;
    }
    if (!urlStr) return '';

    var lower = urlStr.toLowerCase();
    if (
      lower.indexOf('script.google.com') !== -1 ||
      lower.indexOf('googleusercontent.com') !== -1 ||
      lower.indexOf('api.github.com') !== -1
    ) {
      return '';
    }

    var cleanPath = urlStr.split('?')[0].split('#')[0].trim();
    try { cleanPath = decodeURIComponent(cleanPath); } catch (e) {}
    var lastSlash = cleanPath.lastIndexOf('/');
    var baseName = lastSlash !== -1 ? cleanPath.substring(lastSlash + 1) : cleanPath;
    var normalizedBaseName = baseName.replace(/\s+/g, '_');

    if (/^(empresas\.json|portal-config\.json|usuarios\.json|config-[a-zA-Z0-9_.-]+\.json)$/i.test(normalizedBaseName)) {
      return normalizedBaseName;
    }
    return '';
  }

  function readLocalCache(fileName, maxAgeMs) {
    var ttl = typeof maxAgeMs === 'number' ? maxAgeMs : SESSION_TTL_MS;
    var now = Date.now();

    var mem = memoryCache[fileName];
    if (mem && now - mem.ts <= ttl) {
      try {
        return JSON.parse(mem.raw);
      } catch (e) {}
    }

    try {
      var rawEntry = global.sessionStorage.getItem(CACHE_PREFIX + fileName);
      if (rawEntry) {
        var parsedEntry = JSON.parse(rawEntry);
        if (parsedEntry && parsedEntry.raw && now - parsedEntry.ts <= ttl) {
          memoryCache[fileName] = parsedEntry;
          return JSON.parse(parsedEntry.raw);
        }
      }
    } catch (e) {}

    return undefined;
  }

  function readStaleLocalCache(fileName) {
    var mem = memoryCache[fileName];
    if (mem && mem.raw) {
      try { return JSON.parse(mem.raw); } catch (e) {}
    }
    try {
      var rawEntry = global.sessionStorage.getItem(CACHE_PREFIX + fileName);
      if (rawEntry) {
        var parsedEntry = JSON.parse(rawEntry);
        if (parsedEntry && parsedEntry.raw) {
          return JSON.parse(parsedEntry.raw);
        }
      }
    } catch (e) {}
    return undefined;
  }

  function writeLocalCache(fileName, data) {
    if (!fileName || data === undefined) return;
    try {
      var raw = JSON.stringify(data);
      var entry = { ts: Date.now(), raw: raw };
      memoryCache[fileName] = entry;
      global.sessionStorage.setItem(CACHE_PREFIX + fileName, JSON.stringify(entry));
    } catch (e) {}
  }

  function clearLocalCacheInternal(fileName) {
    if (fileName) {
      delete memoryCache[fileName];
      try { global.sessionStorage.removeItem(CACHE_PREFIX + fileName); } catch (e) {}
      return;
    }
    memoryCache = {};
    try {
      var keysToRemove = [];
      for (var i = 0; i < global.sessionStorage.length; i++) {
        var k = global.sessionStorage.key(i);
        if (k && k.indexOf(CACHE_PREFIX) === 0) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(function (k) {
        global.sessionStorage.removeItem(k);
      });
    } catch (e) {}
  }

  function invalidateCache(fileName) {
    clearLocalCacheInternal(fileName || null);
    try {
      if (syncChannel) {
        syncChannel.postMessage({ type: 'invalidate', fileName: fileName || null });
      }
    } catch (e) {}
  }

  async function fetchStaticJsonDirect(fileName, preferredUrl) {
    if (!originalFetch) throw new Error('fetch no disponible');
    var url = buildStaticFallbackUrl(fileName, preferredUrl);
    var res = await originalFetch(url, { cache: 'no-store', _noraStaticBypass: true });
    if (!res.ok) {
      var err = new Error('Archivo estático no encontrado: ' + fileName + ' (' + res.status + ')');
      err.status = res.status;
      throw err;
    }
    return await res.json();
  }

  async function fetchDriveJsonNetwork(cleanFile, forceRefresh, fallbackUrl) {
    if (!originalFetch) throw new Error('fetch no disponible');
    var qs = '?action=getDriveJson&file=' + encodeURIComponent(cleanFile) + (forceRefresh ? '&force=1' : '') + '&_t=' + Date.now();
    var res = await originalFetch(API_URL + qs, {
      method: 'GET',
      cache: 'no-store',
      _noraStaticBypass: true
    });

    if (!res.ok) {
      throw new Error('HTTP ' + res.status + ' leyendo Drive JSON');
    }

    var json = await res.json();

    // Si el Apps Script publicado aún no tiene source === 'drive_json', hacer fallback transparente al archivo estático
    if (!json || json.source !== 'drive_json') {
      var fallbackLegacy = await fetchStaticJsonDirect(cleanFile, fallbackUrl);
      writeLocalCache(cleanFile, fallbackLegacy);
      return fallbackLegacy;
    }

    if (json.status === 'success' && json.data !== undefined) {
      writeLocalCache(cleanFile, json.data);
      try { global.localStorage.setItem(SEEDED_FLAG_KEY, '1'); } catch (e) {}
      return json.data;
    }

    if (json.status === 'not_found') {
      // Intentar rescatar desde archivo estático del repositorio y sembrarlo en segundo plano en Drive
      try {
        var rescued = await fetchStaticJsonDirect(cleanFile, fallbackUrl);
        if (rescued !== undefined && rescued !== null) {
          writeLocalCache(cleanFile, rescued);
          saveJson(cleanFile, rescued, { _silentSeed: true }).catch(function () {});
          return rescued;
        }
      } catch (staticErr) {
        var notFoundErr = new Error('No encontrado en Drive ni estático: ' + cleanFile);
        notFoundErr.status = 404;
        throw notFoundErr;
      }
    }

    throw new Error((json && json.message) || 'Respuesta inválida de Drive JSON');
  }

  async function getJson(fileName, options) {
    var opts = options || {};
    var cleanFile = extractManagedJsonFileName(fileName) || String(fileName || '').trim();
    if (!cleanFile) {
      throw new Error('Nombre de archivo JSON no válido: ' + fileName);
    }

    var force = Boolean(opts.force);
    if (!force) {
      var cached = readLocalCache(cleanFile, opts.maxAgeMs);
      if (cached !== undefined) {
        return cached;
      }
    }

    var inflightKey = cleanFile + (force ? ':force' : ':std');
    if (inFlightGets[inflightKey]) {
      return inFlightGets[inflightKey];
    }

    var promise = (async function () {
      try {
        return await fetchDriveJsonNetwork(cleanFile, force, opts.fallbackUrl);
      } catch (err) {
        if (err && err.status === 404) {
          throw err;
        }
        var stale = readStaleLocalCache(cleanFile);
        if (stale !== undefined) {
          return stale;
        }
        return await fetchStaticJsonDirect(cleanFile, opts.fallbackUrl);
      } finally {
        delete inFlightGets[inflightKey];
      }
    })();

    inFlightGets[inflightKey] = promise;
    return promise;
  }

  async function getBootstrap(empresaId, options) {
    var opts = options || {};
    var force = Boolean(opts.force);
    var qs = '?action=getPlatformBootstrap' +
      (empresaId ? '&empresa=' + encodeURIComponent(empresaId) : '') +
      (force ? '&force=1' : '') +
      '&_t=' + Date.now();

    try {
      var res = await originalFetch(API_URL + qs, {
        method: 'GET',
        cache: 'no-store',
        _noraStaticBypass: true
      });
      if (res.ok) {
        var json = await res.json();
        if (json && json.source === 'drive_json' && json.status === 'success') {
          if (Array.isArray(json.empresas)) writeLocalCache('empresas.json', json.empresas);
          if (json.portalConfig) writeLocalCache('portal-config.json', json.portalConfig);
          if (Array.isArray(json.usuarios)) writeLocalCache('usuarios.json', json.usuarios);
          if (empresaId && json.companyConfig) {
            var empObj = Array.isArray(json.empresas) ? json.empresas.find(function (e) { return e && e.id === empresaId; }) : null;
            var cfgFile = (empObj && empObj.configUrl) || ('config-' + empresaId + '.json');
            writeLocalCache(cfgFile, json.companyConfig);
          }
          try { global.localStorage.setItem(SEEDED_FLAG_KEY, '1'); } catch (e) {}
          return json;
        }
      }
    } catch (e) {}

    // Fallback si el bootstrap aún no está disponible
    var empresas = await getJson('empresas.json', { force: force }).catch(function () { return []; });
    var portalConfig = await getJson('portal-config.json', { force: force }).catch(function () { return {}; });
    var companyConfig = null;
    if (empresaId) {
      var targetEmp = Array.isArray(empresas) ? empresas.find(function (e) { return e && e.id === empresaId; }) : null;
      var cFile = (targetEmp && targetEmp.configUrl) || ('config-' + empresaId + '.json');
      companyConfig = await getJson(cFile, { force: force }).catch(function () { return { projects: [] }; });
    }
    return {
      status: 'success',
      source: 'fallback',
      empresas: empresas,
      portalConfig: portalConfig,
      companyConfig: companyConfig
    };
  }

  async function postAction(payload) {
    if (!originalFetch) throw new Error('fetch no disponible');
    var bodyObj = payload || {};
    var res = await originalFetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(bodyObj),
      _noraStaticBypass: true
    });

    var text = await res.text();
    var json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      json = { status: res.ok ? 'success' : 'error', raw: text };
    }

    var act = String(bodyObj.action || '').trim();
    if (
      !act ||
      act === 'saveUser' ||
      act === 'deleteUser' ||
      act === 'createCompany' ||
      act === 'createUserAndCompany' ||
      act === 'deleteCompany'
    ) {
      invalidateCache('empresas.json');
      invalidateCache('usuarios.json');
    } else if (act === 'saveProjectConfig' || act === 'saveProject' || act === 'migrateStaticToDrive') {
      invalidateCache(null);
    }

    return json;
  }

  async function saveJson(fileName, data, extra) {
    var cleanFile = extractManagedJsonFileName(fileName) || String(fileName || '').trim();
    if (!cleanFile) throw new Error('Archivo JSON inválido: ' + fileName);

    var reqPayload = Object.assign({}, extra || {}, {
      action: 'saveDriveJson',
      file: cleanFile,
      data: data
    });

    var json = await postAction(reqPayload);
    if (!json || json.source !== 'drive_json' || json.status !== 'success') {
      throw new Error(
        (json && json.message) ||
        'El script de Google Drive aún no tiene habilitada la acción saveDriveJson. Actualiza la implementación de Directorio Global noraCDE.js en Google Apps Script.'
      );
    }

    writeLocalCache(cleanFile, data);
    try {
      if (syncChannel) syncChannel.postMessage({ type: 'invalidate', fileName: cleanFile });
    } catch (e) {}
    return json;
  }

  async function saveAdminBundle(bundle) {
    var payload = Object.assign({}, bundle || {}, {
      action: 'saveAdminBundle'
    });

    var json = await postAction(payload);
    if (!json || json.source !== 'drive_json' || json.status !== 'success') {
      throw new Error(
        (json && json.message) ||
        'El script de Google Drive aún no tiene habilitada la acción saveAdminBundle. Actualiza la implementación de Directorio Global noraCDE.js en Google Apps Script.'
      );
    }

    var finalEmpresas = Array.isArray(json.empresas) ? json.empresas : bundle.empresas;
    if (Array.isArray(finalEmpresas)) {
      writeLocalCache('empresas.json', finalEmpresas);
    }
    if (bundle.portalConfig && typeof bundle.portalConfig === 'object') {
      writeLocalCache('portal-config.json', bundle.portalConfig);
    }
    if (bundle.companyConfigs && typeof bundle.companyConfigs === 'object') {
      var serverConfigs = (json && json.companyConfigs && typeof json.companyConfigs === 'object') ? json.companyConfigs : {};
      Object.keys(bundle.companyConfigs).forEach(function (cfgKey) {
        var matchedEmp = Array.isArray(finalEmpresas)
          ? finalEmpresas.find(function (e) { return e && (e.id === cfgKey || e.configUrl === cfgKey); })
          : null;
        var cleanCfg = matchedEmp
          ? (matchedEmp.configUrl || ('config-' + matchedEmp.id + '.json'))
          : (extractManagedJsonFileName(cfgKey) || ('config-' + cfgKey + '.json'));
        var cfgVal = (matchedEmp && serverConfigs[matchedEmp.id]) || serverConfigs[cfgKey] || bundle.companyConfigs[cfgKey];
        if (cleanCfg && cfgVal) {
          writeLocalCache(cleanCfg, cfgVal);
        }
      });
    }
    invalidateCache('usuarios.json');
    try {
      if (syncChannel) syncChannel.postMessage({ type: 'invalidate', fileName: null });
      global.localStorage.setItem(SEEDED_FLAG_KEY, '1');
    } catch (e) {}

    return json;
  }

  async function migrateAllStaticToDrive(options) {
    var opts = options || {};
    var empresas = [];
    var portalConfig = {};
    var companyConfigs = {};

    try {
      empresas = await fetchStaticJsonDirect('empresas.json');
    } catch (e) {
      if (Array.isArray(opts.empresas)) empresas = opts.empresas;
    }

    try {
      portalConfig = await fetchStaticJsonDirect('portal-config.json');
    } catch (e) {
      if (opts.portalConfig) portalConfig = opts.portalConfig;
    }

    var configFilesMap = {
      'config-nora.json': true,
      'config-nueva-empresa.json': true
    };
    if (Array.isArray(empresas)) {
      empresas.forEach(function (emp) {
        if (!emp) return;
        var cUrl = emp.configUrl || (emp.id ? 'config-' + emp.id + '.json' : '');
        if (cUrl) configFilesMap[cUrl] = true;
      });
    }

    var cfgNames = Object.keys(configFilesMap);
    await Promise.all(
      cfgNames.map(async function (cfgName) {
        try {
          var cfgData = await fetchStaticJsonDirect(cfgName);
          if (cfgData && typeof cfgData === 'object') {
            companyConfigs[cfgName] = cfgData;
          }
        } catch (e) {
          if (opts.companyConfigs && opts.companyConfigs[cfgName]) {
            companyConfigs[cfgName] = opts.companyConfigs[cfgName];
          }
        }
      })
    );

    var res = await postAction({
      action: 'migrateStaticToDrive',
      onlyIfMissing: opts.forceOverwriteFromStatic === true ? false : true,
      empresas: empresas,
      portalConfig: portalConfig,
      companyConfigs: companyConfigs
    });

    if (res && res.source === 'drive_json' && res.status === 'success') {
      try { global.localStorage.setItem(SEEDED_FLAG_KEY, '1'); } catch (e) {}
      invalidateCache(null);
    }
    return res;
  }

  var seedCheckPromise = null;
  function ensureSeeded() {
    if (seedCheckPromise) return seedCheckPromise;
    try {
      if (global.localStorage.getItem(SEEDED_FLAG_KEY) === '1') {
        return Promise.resolve({ alreadySeeded: true });
      }
    } catch (e) {}

    seedCheckPromise = (async function () {
      try {
        var checkUrl = API_URL + '?action=getDriveJson&file=empresas.json&_t=' + Date.now();
        var checkRes = await originalFetch(checkUrl, { method: 'GET', cache: 'no-store', _noraStaticBypass: true });
        if (!checkRes.ok) return { skipped: true };
        var checkJson = await checkRes.json();
        if (!checkJson || checkJson.source !== 'drive_json') {
          return { skipped: true, reason: 'legacy_apps_script' };
        }
        if (checkJson.status === 'success' && Array.isArray(checkJson.data) && checkJson.data.length > 0) {
          writeLocalCache('empresas.json', checkJson.data);
          try { global.localStorage.setItem(SEEDED_FLAG_KEY, '1'); } catch (e) {}
          return { alreadySeeded: true };
        }
        return await migrateAllStaticToDrive({ onlyIfMissing: true });
      } catch (e) {
        return { skipped: true, error: String(e) };
      } finally {
        seedCheckPromise = null;
      }
    })();

    return seedCheckPromise;
  }

  // Interceptar de forma transparente lecturas GET a empresas.json, portal-config.json, usuarios.json y config-*.json
  if (originalFetch) {
    global.fetch = function (input, init) {
      try {
        if (init && init._noraStaticBypass) {
          return originalFetch(input, init);
        }
        var method = (init && init.method) || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET') || 'GET';
        if (String(method).toUpperCase() !== 'GET') {
          return originalFetch(input, init);
        }

        var managedFile = extractManagedJsonFileName(input);
        if (managedFile) {
          var rawUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');
          var forceFlag = Boolean(init && init._noraForceRefresh);
          return getJson(managedFile, {
            force: forceFlag,
            fallbackUrl: rawUrl
          }).then(function (data) {
            return new Response(JSON.stringify(data), {
              status: 200,
              statusText: 'OK',
              headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'X-Nora-Source': 'google-drive'
              }
            });
          }).catch(function (err) {
            if (err && err.status === 404) {
              return new Response(JSON.stringify({ error: 'Not Found', file: managedFile }), {
                status: 404,
                statusText: 'Not Found',
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
              });
            }
            return originalFetch(input, init);
          });
        }
      } catch (interceptErr) {
        return originalFetch(input, init);
      }
      return originalFetch(input, init);
    };
  }

  global.NoraDriveStore = {
    __initialized: true,
    API_URL: API_URL,
    DRIVE_FOLDER_ID: DRIVE_FOLDER_ID,
    originalFetch: originalFetch,
    getJson: getJson,
    getBootstrap: getBootstrap,
    saveJson: saveJson,
    saveAdminBundle: saveAdminBundle,
    postAction: postAction,
    migrateAllStaticToDrive: migrateAllStaticToDrive,
    ensureSeeded: ensureSeeded,
    invalidateCache: invalidateCache
  };
})(typeof window !== 'undefined' ? window : this);

// --- NORA NAVIGATION UNIFIED SAFEGUARD ---
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

    var btn = target.closest('button, a, [role="button"]') || target;
    var id = (btn.id || target.id || '').toLowerCase();
    var title = (btn.getAttribute('title') || target.getAttribute('title') || '').toLowerCase();
    var aria = (btn.getAttribute('aria-label') || target.getAttribute('aria-label') || '').toLowerCase();

    if (id === 'back-btn' || id === 'btn-header-back' || id === 'nav-back-btn') {
      return true;
    }
    if (title === 'volver' || title === 'regresar' || title === 'volver a la capa superior' || title === 'volver al proyecto' || title === 'volver al portal') {
      return true;
    }
    if (aria === 'volver' || aria === 'regresar') {
      return true;
    }

    // Chequear icono de flecha atrás en botones de cabecera
    var icon = btn.querySelector('.material-symbols-outlined, .material-icons, i.fa-arrow-left, i.fa-chevron-left');
    if (icon && (btn.id.includes('back') || (btn.classList && (btn.classList.contains('back-btn') || btn.classList.contains('sidebar-toggle-btn'))) || btn.closest('header, nav, .top-bar, .header'))) {
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
