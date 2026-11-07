// =========================================================================
// SCRIPT DE GOOGLE APPS SCRIPT PARA NORA (USUARIOS Y EMPRESAS + GOOGLE DRIVE)
// =========================================================================

const DRIVE_ROOT_FOLDER_ID = "1aWUNnLgjWBkA6wdCM99XMY9SU7eSDP-H";
// Repositorio exclusivo del módulo de incidencias.
const INCIDENTS_ROOT_FOLDER_ID = "1-9SumRefiih81mc_eASsswy_W_U0-qe5";
// Repositorio exclusivo para configuración JSON (empresas.json, usuarios.json, config-empresa-*.json y Empresa -> Proyecto -> proyecto.json)
const PROJECTS_DRIVE_ROOT_FOLDER_ID = "1ZyW39yfyecmD-G8cfb6UrhN9jsoL7rEx";
const SPREADSHEET_ID = "1OczWRlaefMY5RQon8K3va91H8TInJlp9RuBJeTPLiiA";

const COMPANY_HEADERS = ['fecha', 'id', 'name', 'legalName', 'type', 'website', 'email', 'phone', 'country', 'state', 'city', 'zip', 'address', 'sectors', 'specialties', 'logoBase64', 'code', 'driveFolderId'];
const USER_HEADERS = ['fecha', 'nombre', 'email', 'telefono', 'empresa', 'especialidad', 'cargo', 'rol', 'estado'];
const TEAM_HEADERS = ['fecha', 'empresa', 'proyecto', 'nombreEquipo', 'miembros'];
const FILE_STATUS_HEADERS = ['rowId', 'fecha', 'fileId', 'jsonId', 'filename', 'project', 'status', 'changedAt', 'changedBy', 'changedByEmail', 'originalFileId', 'type', 'version', 'comments', 'deliveryTeams'];
const FILE_VERSION_HEADERS = ['versionId', 'fecha', 'fileId', 'jsonId', 'filename', 'project', 'status', 'version', 'comments', 'createdBy', 'createdByEmail', 'originalFileId', 'type', 'isCurrent', 'backupFileId'];

function ensureHeaders(sheet, expectedHeaders) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(expectedHeaders);
    return;
  }
  const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const headersToAdd = [];
  expectedHeaders.forEach(h => {
    if (existingHeaders.indexOf(h) === -1) {
      headersToAdd.push(h);
    }
  });
  if (headersToAdd.length > 0) {
    sheet.getRange(1, existingHeaders.length + 1, 1, headersToAdd.length).setValues([headersToAdd]);
  }
}

function getOrCreateFolder(parentFolder, name) {
  const folders = parentFolder.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(name);
}

function getOrCreateIncidentsSpreadsheet_(projectFolder) {
  const name = 'Configuración de Incidencias';
  const files = projectFolder.getFilesByName(name);
  if (files.hasNext()) return SpreadsheetApp.open(files.next());

  const spreadsheet = SpreadsheetApp.create(name);
  const file = DriveApp.getFileById(spreadsheet.getId());
  projectFolder.addFile(file);
  const parents = file.getParents();
  while (parents.hasNext()) {
    const parent = parents.next();
    if (parent.getId() !== projectFolder.getId()) parent.removeFile(file);
  }
  return spreadsheet;
}

function writeIncidentsLocations_(spreadsheet, units) {
  let sheet = spreadsheet.getSheetByName('Ubicaciones');
  if (!sheet) sheet = spreadsheet.insertSheet('Ubicaciones');
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 2).setValues([['ID de unidad', 'Ubicación JSON']]);
  const validUnits = Array.isArray(units) ? units.filter(function(unit) { return unit && unit.id && unit.name; }) : [];
  if (validUnits.length > 0) {
    sheet.getRange(2, 1, validUnits.length, 2).setValues(validUnits.map(function(unit) {
      return [String(unit.id), JSON.stringify(unit)];
    }));
  }
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
  return sheet;
}

function provisionIncidentsProject_(company, project, config) {
  const root = DriveApp.getFolderById(INCIDENTS_ROOT_FOLDER_ID);
  const companyName = String(company.name || company.id || 'Empresa sin nombre').trim();
  const projectName = String(project.name || project.slug || project.id || 'Proyecto sin nombre').trim();
  const companyFolder = getOrCreateFolder(root, companyName);
  const projectFolder = getOrCreateFolder(companyFolder, projectName);
  const spreadsheet = getOrCreateIncidentsSpreadsheet_(projectFolder);

  let sheet = spreadsheet.getSheetByName('Configuración');
  if (!sheet) {
    const sheets = spreadsheet.getSheets();
    sheet = sheets.length === 1 ? sheets[0] : spreadsheet.insertSheet('Configuración');
    sheet.setName('Configuración');
  }
  const configToStore = Object.assign({}, config || {});
  const locations = configToStore.locations;
  delete configToStore.locations;
  sheet.clear();
  sheet.getRange(1, 1, 1, 2).setValues([['Campo', 'Valor']]);
  sheet.getRange(2, 1, 4, 2).setValues([
    ['Actualizado', new Date().toISOString()],
    ['Empresa', companyName],
    ['Proyecto', projectName],
    ['Configuración JSON', JSON.stringify(configToStore)]
  ]);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
  if (Array.isArray(locations)) writeIncidentsLocations_(spreadsheet, locations);

  return {
    companyFolderId: companyFolder.getId(),
    projectFolderId: projectFolder.getId(),
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl()
  };
}

function getIncidentsProjectSpreadsheet_(company, project) {
  const root = DriveApp.getFolderById(INCIDENTS_ROOT_FOLDER_ID);
  const companyName = String(company.name || company.id || 'Empresa sin nombre').trim();
  const projectName = String(project.name || project.slug || project.id || 'Proyecto sin nombre').trim();
  return getOrCreateIncidentsSpreadsheet_(getOrCreateFolder(getOrCreateFolder(root, companyName), projectName));
}

function getIncidentsLocations_(data) {
  const company = data.company || { id: data.empresa, name: data.empresa };
  const project = data.project || { id: data.proyecto, slug: data.proyecto, name: data.proyecto };
  if (!company || !(company.name || company.id) || !project || !(project.name || project.slug || project.id)) return { status: 'error', message: 'Faltan los datos de empresa o proyecto para cargar las ubicaciones.' };
  const sheet = getIncidentsProjectSpreadsheet_(company, project).getSheetByName('Ubicaciones');
  if (!sheet || sheet.getLastRow() <= 1) return { status: 'success', units: [] };
  const units = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().map(function(row) {
    try { return JSON.parse(String(row[1] || '')); } catch (_) { return null; }
  }).filter(function(unit) { return unit && unit.id && unit.name; });
  return { status: 'success', units: units };
}

function saveIncidentsLocation_(data) {
  const company = data.company || { id: data.companyId, name: data.companyName };
  const project = data.project || { id: data.projectId, slug: data.projectId, name: data.projectName };
  const unit = data.unit || {};
  if (!company || !(company.name || company.id) || !project || !(project.name || project.slug || project.id) || !unit.id) return { status: 'error', message: 'Faltan datos para guardar la ubicación.' };
  const spreadsheet = getIncidentsProjectSpreadsheet_(company, project);
  let sheet = spreadsheet.getSheetByName('Ubicaciones');
  if (!sheet) sheet = writeIncidentsLocations_(spreadsheet, []);
  const lastRow = sheet.getLastRow();
  const ids = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(function(row) { return String(row[0]); }) : [];
  const row = ids.indexOf(String(unit.id));
  if (String(data.operation || 'upsert') === 'delete') {
    if (row >= 0) sheet.deleteRow(row + 2);
  } else {
    const value = [[String(unit.id), JSON.stringify(unit)]];
    if (row >= 0) sheet.getRange(row + 2, 1, 1, 2).setValues(value);
    else sheet.getRange(lastRow + 1, 1, 1, 2).setValues(value);
  }
  sheet.autoResizeColumns(1, 2);
  return { status: 'success', spreadsheetUrl: spreadsheet.getUrl() };
}

function saveIncidentsProjectConfig_(data) {
  const company = data.company || { id: data.companyId, name: data.companyName };
  const project = data.project || { id: data.projectId, slug: data.projectId, name: data.projectName };
  if (!company || !(company.name || company.id) || !project || !(project.name || project.slug || project.id)) {
    return { status: 'error', message: 'Faltan los datos de empresa o proyecto para guardar la configuración.' };
  }
  const storage = provisionIncidentsProject_(company, project, data.config || {});
  return { status: 'success', storage: storage };
}

// =========================================================================
// GESTIÓN DE CONFIGURACIÓN DE PROYECTOS EN GOOGLE DRIVE (JSON POR PROYECTO)
// Estructura: [Carpeta Raíz] -> [Carpeta Empresa] -> [Carpeta Proyecto] -> proyecto.json
// =========================================================================

function getOrCreateSubfolder_(parentFolder, targetName) {
  const cleanTarget = String(targetName || '').trim();
  if (!cleanTarget) return parentFolder;

  const folders = parentFolder.getFolders();
  while (folders.hasNext()) {
    const f = folders.next();
    if (f.getName().trim().toLowerCase() === cleanTarget.toLowerCase()) {
      return f;
    }
  }
  return parentFolder.createFolder(cleanTarget);
}

function findProjectFolderInCompany_(companyFolder, projectName, projectSlug) {
  const cleanName = String(projectName || '').trim().toLowerCase();
  const cleanSlug = String(projectSlug || '').trim().toLowerCase();

  const folders = companyFolder.getFolders();
  const list = [];
  while (folders.hasNext()) {
    const f = folders.next();
    const fName = f.getName().trim().toLowerCase();
    // 1. Coincidencia exacta o insensible a mayúsculas
    if (cleanName && fName === cleanName) return f;
    if (cleanSlug && fName === cleanSlug) return f;
    // 2. Contiene el slug o corchetes
    if (cleanSlug && (fName.includes(cleanSlug) || fName.includes("[" + cleanSlug + "]") || fName.includes("(" + cleanSlug + ")"))) {
      return f;
    }
    list.push(f);
  }

  // 3. Inspeccionar proyecto.json dentro de subcarpetas candidatas
  for (let i = 0; i < list.length; i++) {
    const candidate = list[i];
    const files = candidate.getFilesByName("proyecto.json");
    if (files.hasNext()) {
      try {
        const content = files.next().getBlob().getDataAsString();
        const json = JSON.parse(content);
        if (json) {
          const pName = String(json.name || json.title || '').trim().toLowerCase();
          const pSlug = String(json.slug || '').trim().toLowerCase();
          if ((cleanName && pName === cleanName) || (cleanSlug && pSlug === cleanSlug)) {
            return candidate;
          }
        }
      } catch (err) {}
    }
  }

  return null;
}

function saveProjectConfigToDrive_(payload) {
  try {
    const rootFolder = DriveApp.getFolderById(PROJECTS_DRIVE_ROOT_FOLDER_ID);
    if (!rootFolder) {
      return { status: 'error', message: 'No se encontró la carpeta raíz de proyectos en Google Drive (ID: ' + PROJECTS_DRIVE_ROOT_FOLDER_ID + ').' };
    }

    const companyName = String(payload.companyName || payload.empresa || payload.companyId || 'Empresa').trim();
    const projectData = payload.projectData || payload.config || payload.data || {};
    const projectName = String(payload.projectName || projectData.name || projectData.title || payload.proyecto || payload.projectSlug || 'Nuevo Proyecto').trim();
    const projectSlug = String(payload.projectSlug || projectData.slug || '').trim();

    if (!companyName || !projectName) {
      return { status: 'error', message: 'Se requiere especificar el nombre de la empresa y del proyecto.' };
    }

    // 1. Obtener o crear carpeta de la Empresa
    const companyFolder = getOrCreateSubfolder_(rootFolder, companyName);

    // 2. Obtener o crear carpeta del Proyecto al interior de la Empresa
    let projectFolder = findProjectFolderInCompany_(companyFolder, projectName, projectSlug);
    if (!projectFolder) {
      projectFolder = companyFolder.createFolder(projectName);
    } else {
      const currentFName = projectFolder.getName().trim();
      if (currentFName.toLowerCase() !== projectName.toLowerCase() && projectName.toLowerCase() !== 'nuevo proyecto') {
        try { projectFolder.setName(projectName); } catch(e) {}
      }
    }

    // 3. Preparar y guardar proyecto.json
    if (!projectData.name && projectName) projectData.name = projectName;
    if (!projectData.slug && projectSlug) projectData.slug = projectSlug;

    const jsonString = JSON.stringify(projectData, null, 2);
    const files = projectFolder.getFilesByName('proyecto.json');
    let jsonFile;

    if (files.hasNext()) {
      jsonFile = files.next();
      jsonFile.setContent(jsonString);
    } else {
      jsonFile = projectFolder.createFile('proyecto.json', jsonString, MimeType.PLAIN_TEXT);
    }

    // Permisos de lectura
    try {
      jsonFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {}
    try {
      if (!payload._skipCompanyConfigSync) {
        syncProjectIntoCompanyConfigInDrive_(rootFolder, payload.companyId || '', companyName, projectData);
      }
    } catch (e) {}

    return {
      status: 'success',
      message: 'Configuración guardada en Google Drive exitosamente.',
      fileId: jsonFile.getId(),
      fileUrl: jsonFile.getUrl(),
      projectFolderId: projectFolder.getId(),
      companyFolderId: companyFolder.getId(),
      projectName: projectName,
      companyName: companyName,
      updatedAt: new Date().toISOString()
    };
  } catch (err) {
    return {
      status: 'error',
      message: 'Error al guardar en Google Drive: ' + err.toString()
    };
  }
}

function getProjectConfigFromDrive_(params, postData) {
  try {
    const rootFolder = DriveApp.getFolderById(PROJECTS_DRIVE_ROOT_FOLDER_ID);
    if (!rootFolder) {
      return { status: 'error', message: 'Carpeta raíz no encontrada.' };
    }

    const p = Object.assign({}, params || {}, postData || {});
    const companyName = String(p.companyName || p.empresa || p.companyId || '').trim();
    const projectName = String(p.projectName || p.proyecto || p.projectSlug || '').trim();
    const projectSlug = String(p.projectSlug || p.slug || p.proyecto || '').trim();

    if (!projectName && !projectSlug) {
      return { status: 'error', message: 'Se requiere especificar el proyecto.' };
    }

    let companyFolder = null;
    if (companyName) {
      const folders = rootFolder.getFolders();
      while (folders.hasNext()) {
        const f = folders.next();
        if (f.getName().trim().toLowerCase() === companyName.toLowerCase()) {
          companyFolder = f;
          break;
        }
      }
    }

    let projectFolder = null;
    if (companyFolder) {
      projectFolder = findProjectFolderInCompany_(companyFolder, projectName, projectSlug);
    } else {
      const allComp = rootFolder.getFolders();
      while (allComp.hasNext()) {
        const cFolder = allComp.next();
        const found = findProjectFolderInCompany_(cFolder, projectName, projectSlug);
        if (found) {
          companyFolder = cFolder;
          projectFolder = found;
          break;
        }
      }
    }

    if (!projectFolder) {
      return { status: 'not_found', message: 'No se encontró la carpeta del proyecto en Google Drive.' };
    }

    const files = projectFolder.getFilesByName('proyecto.json');
    if (!files.hasNext()) {
      return { status: 'not_found', message: 'El archivo proyecto.json no existe aún en la carpeta.' };
    }

    const file = files.next();
    const content = file.getBlob().getDataAsString();
    const data = JSON.parse(content);

    return {
      status: 'success',
      data: data,
      fileId: file.getId(),
      folderId: projectFolder.getId(),
      companyFolderId: companyFolder ? companyFolder.getId() : null,
      updatedAt: file.getLastUpdated().toISOString()
    };
  } catch (err) {
    return {
      status: 'error',
      message: 'Error al consultar Google Drive: ' + err.toString()
    };
  }
}

function getCompanyProjectsFromDrive_(params, postData) {
  try {
    const rootFolder = DriveApp.getFolderById(PROJECTS_DRIVE_ROOT_FOLDER_ID);
    const p = Object.assign({}, params || {}, postData || {});
    const companyName = String(p.companyName || p.empresa || p.companyId || '').trim();

    if (!companyName) {
      return { status: 'error', message: 'Se requiere el nombre o ID de la empresa.' };
    }

    let companyFolder = null;
    const folders = rootFolder.getFolders();
    while (folders.hasNext()) {
      const f = folders.next();
      if (f.getName().trim().toLowerCase() === companyName.toLowerCase()) {
        companyFolder = f;
        break;
      }
    }

    if (!companyFolder) {
      return { status: 'success', projects: [] };
    }

    const pFolders = companyFolder.getFolders();
    const projects = [];
    while (pFolders.hasNext()) {
      const pf = pFolders.next();
      const files = pf.getFilesByName('proyecto.json');
      if (files.hasNext()) {
        try {
          const content = files.next().getBlob().getDataAsString();
          const json = JSON.parse(content);
          if (json && typeof json === 'object') {
            projects.push(json);
          }
        } catch (e) {}
      }
    }

    return { status: 'success', projects: projects };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

// =========================================================================
// MOTOR CENTRAL DE ALMACENAMIENTO JSON EN GOOGLE DRIVE (1ZyW39yfyecmD-G8cfb6UrhN9jsoL7rEx)
// Empresas (empresas.json), Usuarios (usuarios.json), Portal (portal-config.json)
// y Configuraciones por Empresa (config-empresa-*.json + [Empresa]/[Proyecto]/proyecto.json)
// =========================================================================

const DRIVE_JSON_CACHE_PREFIX_ = 'nora_dj_v1_';
const DRIVE_JSON_CACHE_CHUNK_SIZE_ = 75000;
const DRIVE_JSON_CACHE_MAX_CHUNKS_ = 12;
const DRIVE_JSON_CACHE_TTL_SEC_ = 1800;

function putCacheJson_(fileName, rawJsonStr, ttlSec) {
  try {
    if (!fileName || typeof rawJsonStr !== 'string') return;
    const totalLen = rawJsonStr.length;
    const numChunks = Math.ceil(totalLen / DRIVE_JSON_CACHE_CHUNK_SIZE_) || 1;
    if (numChunks > DRIVE_JSON_CACHE_MAX_CHUNKS_) return;

    const cache = CacheService.getScriptCache();
    const entries = {};
    for (let i = 0; i < numChunks; i++) {
      entries[DRIVE_JSON_CACHE_PREFIX_ + fileName + '_' + i] = rawJsonStr.substring(
        i * DRIVE_JSON_CACHE_CHUNK_SIZE_,
        (i + 1) * DRIVE_JSON_CACHE_CHUNK_SIZE_
      );
    }
    entries[DRIVE_JSON_CACHE_PREFIX_ + fileName + '_meta'] = JSON.stringify({
      n: numChunks,
      updatedAt: new Date().toISOString()
    });
    cache.putAll(entries, ttlSec || DRIVE_JSON_CACHE_TTL_SEC_);
  } catch (err) {
    Logger.log('putCacheJson_ warning: ' + err);
  }
}

function getCacheJson_(fileName) {
  try {
    if (!fileName) return null;
    const cache = CacheService.getScriptCache();
    const metaKey = DRIVE_JSON_CACHE_PREFIX_ + fileName + '_meta';
    const metaStr = cache.get(metaKey);
    if (!metaStr) return null;
    const meta = JSON.parse(metaStr);
    if (!meta || !meta.n || meta.n < 1 || meta.n > DRIVE_JSON_CACHE_MAX_CHUNKS_) return null;

    const keys = [];
    for (let i = 0; i < meta.n; i++) {
      keys.push(DRIVE_JSON_CACHE_PREFIX_ + fileName + '_' + i);
    }
    const partsMap = cache.getAll(keys);
    let combined = '';
    for (let i = 0; i < meta.n; i++) {
      const k = DRIVE_JSON_CACHE_PREFIX_ + fileName + '_' + i;
      if (partsMap[k] === undefined || partsMap[k] === null) return null;
      combined += partsMap[k];
    }
    return {
      data: JSON.parse(combined),
      raw: combined,
      updatedAt: meta.updatedAt || new Date().toISOString()
    };
  } catch (err) {
    return null;
  }
}

function removeCacheJson_(fileName) {
  try {
    if (!fileName) return;
    const cache = CacheService.getScriptCache();
    const keys = [DRIVE_JSON_CACHE_PREFIX_ + fileName + '_meta'];
    for (let i = 0; i < DRIVE_JSON_CACHE_MAX_CHUNKS_; i++) {
      keys.push(DRIVE_JSON_CACHE_PREFIX_ + fileName + '_' + i);
    }
    cache.removeAll(keys);
  } catch (err) {}
}

function sanitizeJsonFileName_(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  s = s.split('?')[0].split('#')[0].trim();
  s = s.replace(/^(\.\.\/|\.\/|\/)+/g, '');
  if (s.toLowerCase().indexOf('docs/') === 0) {
    s = s.substring(5);
  }
  const slashIdx = s.lastIndexOf('/');
  if (slashIdx !== -1) {
    s = s.substring(slashIdx + 1);
  }
  if (/^(empresas\.json|portal-config\.json|usuarios\.json|config-[a-zA-Z0-9_.-]+\.json)$/i.test(s)) {
    return s;
  }
  return '';
}

function cleanCompareText_(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function openMasterSpreadsheet_() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (err) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function readDriveJsonFileRaw_(rootFolder, fileName, useCache) {
  const cleanName = sanitizeJsonFileName_(fileName) || fileName;
  if (useCache !== false) {
    const cached = getCacheJson_(cleanName);
    if (cached && cached.data !== undefined) {
      return {
        exists: true,
        data: cached.data,
        raw: cached.raw,
        updatedAt: cached.updatedAt,
        fromCache: true
      };
    }
  }

  const filesIter = rootFolder.getFilesByName(cleanName);
  const matches = [];
  while (filesIter.hasNext()) {
    const f = filesIter.next();
    if (!f.isTrashed()) {
      matches.push(f);
    }
  }
  if (matches.length === 0) {
    return { exists: false };
  }

  matches.sort(function(a, b) {
    return b.getLastUpdated().getTime() - a.getLastUpdated().getTime();
  });

  const primary = matches[0];
  for (let i = 1; i < matches.length; i++) {
    try { matches[i].setTrashed(true); } catch (e) {}
  }

  const raw = primary.getBlob().getDataAsString('UTF-8');
  const parsed = JSON.parse(raw);
  const updatedAt = primary.getLastUpdated().toISOString();
  putCacheJson_(cleanName, raw, DRIVE_JSON_CACHE_TTL_SEC_);

  return {
    exists: true,
    file: primary,
    fileId: primary.getId(),
    data: parsed,
    raw: raw,
    updatedAt: updatedAt,
    fromCache: false
  };
}

function writeDriveJsonFileRaw_(rootFolder, fileName, dataObj) {
  const cleanName = sanitizeJsonFileName_(fileName) || fileName;
  const jsonString = JSON.stringify(dataObj, null, 2) + '\n';

  const filesIter = rootFolder.getFilesByName(cleanName);
  const matches = [];
  while (filesIter.hasNext()) {
    const f = filesIter.next();
    if (!f.isTrashed()) {
      matches.push(f);
    }
  }

  let targetFile = null;
  if (matches.length > 0) {
    matches.sort(function(a, b) {
      return b.getLastUpdated().getTime() - a.getLastUpdated().getTime();
    });
    targetFile = matches[0];
    targetFile.setContent(jsonString);
    for (let i = 1; i < matches.length; i++) {
      try { matches[i].setTrashed(true); } catch (e) {}
    }
  } else {
    targetFile = rootFolder.createFile(cleanName, jsonString, MimeType.PLAIN_TEXT);
  }

  try {
    targetFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {}

  putCacheJson_(cleanName, jsonString, DRIVE_JSON_CACHE_TTL_SEC_);

  return {
    fileId: targetFile.getId(),
    fileUrl: targetFile.getUrl(),
    updatedAt: new Date().toISOString()
  };
}

function mergeProjectObjects_(baseProj, newerProj) {
  const base = baseProj || {};
  const newer = newerProj || {};
  const merged = Object.assign({}, base, newer);

  if (base.landing || newer.landing) {
    merged.landing = Object.assign({}, base.landing || {}, newer.landing || {});
    if ((base.landing && base.landing.map) || (newer.landing && newer.landing.map)) {
      merged.landing.map = Object.assign({}, (base.landing && base.landing.map) || {}, (newer.landing && newer.landing.map) || {});
    }
  }
  if (base.modules || newer.modules) {
    merged.modules = Object.assign({}, base.modules || {}, newer.modules || {});
  }
  if (base.actions || newer.actions) {
    merged.actions = Object.assign({}, base.actions || {}, newer.actions || {});
  }

  const baseDS = base.dataSources || {};
  const newerDS = newer.dataSources || {};
  merged.dataSources = Object.assign({}, baseDS, newerDS);
  if (!merged.dataSources.driveFolderId && baseDS.driveFolderId) {
    merged.dataSources.driveFolderId = baseDS.driveFolderId;
  }
  if (!merged.dataSources.driveFolderName && baseDS.driveFolderName) {
    merged.dataSources.driveFolderName = baseDS.driveFolderName;
  }
  if (!merged.dataSources.driveScriptUrl && baseDS.driveScriptUrl) {
    merged.dataSources.driveScriptUrl = baseDS.driveScriptUrl;
  }

  // Conservar equipos ISO 19650, equiposDeTarea y fileVisibilityConfig si el objeto entrante venía sin ellos
  if (base.iso19650 && (!newer.iso19650 || (
    Array.isArray(newer.iso19650.deliveryTeams) && newer.iso19650.deliveryTeams.length === 0 &&
    Array.isArray(base.iso19650.deliveryTeams) && base.iso19650.deliveryTeams.length > 0 &&
    !newer._explicitIsoUpdate
  ))) {
    merged.iso19650 = base.iso19650;
  }
  if (Array.isArray(base.equiposDeTarea) && base.equiposDeTarea.length > 0 &&
      (!Array.isArray(newer.equiposDeTarea) || (newer.equiposDeTarea.length === 0 && !newer._explicitIsoUpdate))) {
    merged.equiposDeTarea = base.equiposDeTarea;
  }
  if (base.fileVisibilityConfig && Object.keys(base.fileVisibilityConfig).length > 0 &&
      (!newer.fileVisibilityConfig || Object.keys(newer.fileVisibilityConfig).length === 0)) {
    merged.fileVisibilityConfig = base.fileVisibilityConfig;
  }
  if (Array.isArray(base.members) && base.members.length > 0 &&
      (!Array.isArray(newer.members) || (newer.members.length === 0 && !newer._explicitMembersUpdate))) {
    merged.members = base.members;
  }

  delete merged._explicitIsoUpdate;
  delete merged._explicitMembersUpdate;
  return merged;
}

function syncProjectIntoCompanyConfigInDrive_(rootFolder, companyId, companyName, projectData) {
  if (!projectData || (!projectData.slug && !projectData.name)) return;
  const empFile = readDriveJsonFileRaw_(rootFolder, 'empresas.json', true);
  if (!empFile.exists || !Array.isArray(empFile.data)) return;

  const cleanCompName = cleanCompareText_(companyName);
  const emp = empFile.data.find(function(e) {
    if (!e || e.deleted) return false;
    if (companyId && e.id === companyId) return true;
    if (cleanCompName && (cleanCompareText_(e.name) === cleanCompName || cleanCompareText_(e.razonSocial) === cleanCompName || cleanCompareText_(e.id) === cleanCompName)) {
      return true;
    }
    return false;
  });
  if (!emp) return;

  const configFileName = sanitizeJsonFileName_(emp.configUrl || ('config-' + emp.id + '.json'));
  if (!configFileName) return;

  let configObj = { portal: { name: emp.name || 'nora CDE' }, projects: [] };
  const existingCfg = readDriveJsonFileRaw_(rootFolder, configFileName, false);
  if (existingCfg.exists && existingCfg.data && typeof existingCfg.data === 'object') {
    configObj = existingCfg.data;
    if (!Array.isArray(configObj.projects)) configObj.projects = [];
  }

  const pSlug = String(projectData.slug || '').trim().toLowerCase();
  const pName = cleanCompareText_(projectData.name || projectData.title || '');

  const idx = configObj.projects.findIndex(function(p) {
    if (!p) return false;
    if (pSlug && String(p.slug || '').trim().toLowerCase() === pSlug) return true;
    if (pName && cleanCompareText_(p.name || p.title || '') === pName) return true;
    return false;
  });

  const cleanProjCopy = Object.assign({}, projectData, { _explicitIsoUpdate: true, _explicitMembersUpdate: true });
  if (idx !== -1) {
    configObj.projects[idx] = mergeProjectObjects_(configObj.projects[idx], cleanProjCopy);
  } else {
    delete cleanProjCopy._explicitIsoUpdate;
    delete cleanProjCopy._explicitMembersUpdate;
    configObj.projects.push(cleanProjCopy);
  }

  writeDriveJsonFileRaw_(rootFolder, configFileName, configObj);
}

function syncCompanySubfolderAndProjects_(rootFolder, emp, configData, mergeFromExistingDriveProjects) {
  if (!emp || !emp.name) return configData;
  const companyFolder = getOrCreateSubfolder_(rootFolder, emp.name);

  // Guardar resumen empresa.json dentro de la carpeta de la empresa
  try {
    const empresaSummary = {
      id: emp.id,
      name: emp.name,
      razonSocial: emp.razonSocial || emp.name,
      code: emp.code || '',
      configUrl: emp.configUrl || ('config-' + emp.id + '.json'),
      driveFolderId: emp.driveFolderId || '',
      admins: emp.admins || [],
      members: emp.members || [],
      portal: (configData && configData.portal) || {},
      updatedAt: new Date().toISOString()
    };
    const empStr = JSON.stringify(empresaSummary, null, 2) + '\n';
    const eFiles = companyFolder.getFilesByName('empresa.json');
    if (eFiles.hasNext()) {
      eFiles.next().setContent(empStr);
    } else {
      companyFolder.createFile('empresa.json', empStr, MimeType.PLAIN_TEXT);
    }
  } catch (e) {}

  if (!configData || !Array.isArray(configData.projects)) return configData;

  const seenSlugs = {};
  for (let i = 0; i < configData.projects.length; i++) {
    let proj = configData.projects[i];
    if (!proj) continue;
    const projName = String(proj.name || proj.title || proj.slug || ('Proyecto-' + (i + 1))).trim();
    const projSlug = String(proj.slug || '').trim();

    let projectFolder = findProjectFolderInCompany_(companyFolder, projName, projSlug);
    if (!projectFolder) {
      projectFolder = companyFolder.createFolder(projName);
    } else {
      const curName = projectFolder.getName().trim();
      if (curName.toLowerCase() !== projName.toLowerCase() && projName.toLowerCase() !== 'nuevo proyecto') {
        try { projectFolder.setName(projName); } catch (e) {}
      }
    }

    const pFiles = projectFolder.getFilesByName('proyecto.json');
    let existingDriveProj = null;
    let existingFile = null;
    if (pFiles.hasNext()) {
      existingFile = pFiles.next();
      try {
        existingDriveProj = JSON.parse(existingFile.getBlob().getDataAsString('UTF-8'));
      } catch (e) {
        existingDriveProj = null;
      }
    }

    if (existingDriveProj) {
      if (mergeFromExistingDriveProjects) {
        // En migración inicial: los datos ya guardados en proyecto.json en Drive tienen prioridad sobre estáticos viejos
        proj = mergeProjectObjects_(proj, existingDriveProj);
      } else {
        // En guardado desde Admin/Configurador: se aplican los cambios nuevos preservando iso19650/visibilidad previos si venían vacíos
        proj = mergeProjectObjects_(existingDriveProj, proj);
      }
      configData.projects[i] = proj;
    }

    if (projSlug) seenSlugs[projSlug.toLowerCase()] = true;

    const projStr = JSON.stringify(proj, null, 2) + '\n';
    if (existingFile) {
      existingFile.setContent(projStr);
    } else {
      const created = projectFolder.createFile('proyecto.json', projStr, MimeType.PLAIN_TEXT);
      try { created.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    }
  }

  // En migración inicial, rescatar también cualquier subcarpeta de proyecto en Drive que no estuviera aún en config-empresa-*.json
  if (mergeFromExistingDriveProjects) {
    try {
      const subFolders = companyFolder.getFolders();
      while (subFolders.hasNext()) {
        const sf = subFolders.next();
        if (sf.isTrashed()) continue;
        const pfIter = sf.getFilesByName('proyecto.json');
        if (pfIter.hasNext()) {
          try {
            const extraProj = JSON.parse(pfIter.next().getBlob().getDataAsString('UTF-8'));
            if (extraProj && typeof extraProj === 'object') {
              const eSlug = String(extraProj.slug || '').trim().toLowerCase();
              const eName = cleanCompareText_(extraProj.name || extraProj.title || sf.getName());
              const alreadyIn = configData.projects.some(function(cp) {
                if (!cp) return false;
                if (eSlug && String(cp.slug || '').trim().toLowerCase() === eSlug) return true;
                if (eName && cleanCompareText_(cp.name || cp.title || '') === eName) return true;
                return false;
              });
              if (!alreadyIn) {
                if (!extraProj.name) extraProj.name = sf.getName();
                if (!extraProj.slug) extraProj.slug = sf.getName().toLowerCase().replace(/[^a-z0-9]+/g, '-');
                configData.projects.push(extraProj);
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  return configData;
}

function readUsersFromSheet_(doc) {
  const sheet = doc.getSheetByName('Usuarios');
  if (!sheet || sheet.getLastRow() <= 1) return [];
  ensureHeaders(sheet, USER_HEADERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(function(h) { return String(h).trim(); });
  const usuarios = [];
  for (let i = 1; i < data.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const val = data[i][j];
      obj[headers[j]] = (val instanceof Date) ? val.toISOString() : val;
    }
    if (obj.email && String(obj.email).trim() !== '') {
      usuarios.push(obj);
    }
  }
  return usuarios;
}

function readCompaniesFromSheet_(doc) {
  const sheet = doc.getSheetByName('Empresas');
  if (!sheet || sheet.getLastRow() <= 1) return [];
  ensureHeaders(sheet, COMPANY_HEADERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(function(h) { return String(h).trim(); });
  const empresas = [];
  for (let i = 1; i < data.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const val = data[i][j];
      obj[headers[j]] = (val instanceof Date) ? val.toISOString() : val;
    }
    if ((obj.id && String(obj.id).trim()) || (obj.name && String(obj.name).trim())) {
      empresas.push(obj);
    }
  }
  return empresas;
}

function syncUsuariosJsonFromSheet_(doc, rootFolder) {
  const folder = rootFolder || DriveApp.getFolderById(PROJECTS_DRIVE_ROOT_FOLDER_ID);
  const d = doc || openMasterSpreadsheet_();
  const usuarios = readUsersFromSheet_(d);
  writeDriveJsonFileRaw_(folder, 'usuarios.json', usuarios);
  return usuarios;
}

function upsertUsersBatchInSheet_(doc, usersList) {
  if (!Array.isArray(usersList) || usersList.length === 0) return;
  let userSheet = doc.getSheetByName('Usuarios');
  if (!userSheet) userSheet = doc.insertSheet('Usuarios');
  ensureHeaders(userSheet, USER_HEADERS);

  const allValues = userSheet.getDataRange().getValues();
  const headers = allValues[0].map(function(h) { return String(h).trim(); });
  const lowerHeaders = headers.map(function(h) { return h.toLowerCase(); });
  const emailIdx = lowerHeaders.indexOf('email');
  if (emailIdx === -1) return;

  const emailToRowIndex = {};
  for (let r = 1; r < allValues.length; r++) {
    const em = String(allValues[r][emailIdx] || '').toLowerCase().trim();
    if (em) emailToRowIndex[em] = r; // 0-based index in allValues
  }

  const rowsToAppend = [];
  let updatedExisting = false;
  const nowIso = new Date().toISOString();

  usersList.forEach(function(u) {
    if (!u || !u.email) return;
    const emailClean = String(u.email).toLowerCase().trim();
    if (!emailClean) return;

    const existingIdx = emailToRowIndex[emailClean];
    if (existingIdx !== undefined) {
      const rowArr = allValues[existingIdx];
      const setIfPresent = function(colName, val) {
        const cIdx = lowerHeaders.indexOf(colName.toLowerCase());
        if (cIdx !== -1 && val !== undefined && val !== null && val !== '') {
          if (String(rowArr[cIdx] || '') !== String(val)) {
            rowArr[cIdx] = val;
            updatedExisting = true;
          }
        }
      };
      if (u.nombre && String(u.nombre).trim().toLowerCase() !== 'nuevo usuario') {
        setIfPresent('nombre', u.nombre);
      }
      setIfPresent('telefono', u.telefono);
      setIfPresent('empresa', u.empresa);
      setIfPresent('especialidad', u.especialidad);
      setIfPresent('cargo', u.cargo);
      setIfPresent('rol', u.rol);
      setIfPresent('estado', u.estado);
    } else {
      const newRow = new Array(headers.length).fill('');
      const setCol = function(colName, val) {
        const cIdx = lowerHeaders.indexOf(colName.toLowerCase());
        if (cIdx !== -1 && val !== undefined && val !== null) newRow[cIdx] = val;
      };
      setCol('fecha', nowIso);
      setCol('nombre', u.nombre || emailClean.split('@')[0]);
      setCol('email', emailClean);
      setCol('telefono', u.telefono || '');
      setCol('empresa', u.empresa || '');
      setCol('especialidad', u.especialidad || '');
      setCol('cargo', u.cargo || '');
      setCol('rol', u.rol || 'MIEMBRO');
      setCol('estado', u.estado || 'APROBADO');
      rowsToAppend.push(newRow);
      emailToRowIndex[emailClean] = -1; // Prevent duplicates in same batch
    }
  });

  if (updatedExisting && allValues.length > 1) {
    userSheet.getRange(2, 1, allValues.length - 1, headers.length).setValues(allValues.slice(1));
  }
  if (rowsToAppend.length > 0) {
    userSheet.getRange(userSheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
  }
}

function syncSingleUserIntoEmpresasDrive_(rootFolder, userObj, mode) {
  try {
    const folder = rootFolder || DriveApp.getFolderById(PROJECTS_DRIVE_ROOT_FOLDER_ID);
    const empRes = readDriveJsonFileRaw_(folder, 'empresas.json', false);
    if (!empRes.exists || !Array.isArray(empRes.data)) return;

    const empresas = empRes.data;
    const emailClean = String((userObj && userObj.email) || '').toLowerCase().trim();
    if (!emailClean) return;

    let changed = false;

    if (mode === 'delete') {
      empresas.forEach(function(emp) {
        if (!emp) return;
        if (Array.isArray(emp.members)) {
          const prevLen = emp.members.length;
          emp.members = emp.members.filter(function(m) {
            return !m || !m.email || String(m.email).toLowerCase().trim() !== emailClean;
          });
          if (emp.members.length !== prevLen) changed = true;
        }
        if (Array.isArray(emp.admins)) {
          const prevAdminLen = emp.admins.length;
          emp.admins = emp.admins.filter(function(a) {
            return String(a || '').toLowerCase().trim() !== emailClean;
          });
          if (emp.admins.length !== prevAdminLen) changed = true;
        }
      });
    } else {
      const targetEmpClean = cleanCompareText_(userObj.empresa || '');
      const uRol = String(userObj.rol || 'INVITADO').trim();
      const uEstado = String(userObj.estado || '').toUpperCase().trim();
      const isApproved = (uEstado === 'APROBADO' || uRol === 'SUPER_ADMINISTRADOR' || uRol === 'ADMINISTRADOR_EMPRESA' || uRol === 'MIEMBRO');

      // Actualizar metadatos en empresas donde ya sea miembro
      empresas.forEach(function(emp) {
        if (!emp || emp.deleted || !Array.isArray(emp.members)) return;
        emp.members.forEach(function(m) {
          if (m && m.email && String(m.email).toLowerCase().trim() === emailClean) {
            if (userObj.nombre && String(userObj.nombre).trim() && String(userObj.nombre).trim().toLowerCase() !== 'nuevo usuario') {
              m.name = String(userObj.nombre).trim();
              changed = true;
            }
            if (userObj.especialidad !== undefined && userObj.especialidad !== '') {
              m.especialidad = userObj.especialidad;
              changed = true;
            }
            if (userObj.cargo !== undefined && userObj.cargo !== '') {
              m.cargo = userObj.cargo;
              changed = true;
            }
          }
        });
      });

      // Si tiene empresa asignada y está aprobado, asegurar membresía en esa empresa
      if (targetEmpClean && isApproved) {
        let matchedEmp = empresas.find(function(emp) {
          if (!emp || emp.deleted) return false;
          return cleanCompareText_(emp.name) === targetEmpClean ||
                 cleanCompareText_(emp.razonSocial) === targetEmpClean ||
                 cleanCompareText_(emp.id) === targetEmpClean;
        });

        if (matchedEmp) {
          if (!Array.isArray(matchedEmp.members)) matchedEmp.members = [];
          if (!Array.isArray(matchedEmp.admins)) matchedEmp.admins = [];

          const mIdx = matchedEmp.members.findIndex(function(m) {
            return m && m.email && String(m.email).toLowerCase().trim() === emailClean;
          });

          const memberEntry = {
            name: (userObj.nombre && String(userObj.nombre).trim()) || (mIdx > -1 ? matchedEmp.members[mIdx].name : emailClean.split('@')[0]),
            email: emailClean,
            role: uRol === 'SUPER_ADMINISTRADOR' ? 'ADMINISTRADOR_EMPRESA' : (uRol || 'MIEMBRO'),
            empresaUsuario: matchedEmp.name,
            especialidad: userObj.especialidad !== undefined && userObj.especialidad !== '' ? userObj.especialidad : (mIdx > -1 ? (matchedEmp.members[mIdx].especialidad || '') : ''),
            cargo: userObj.cargo !== undefined && userObj.cargo !== '' ? userObj.cargo : (mIdx > -1 ? (matchedEmp.members[mIdx].cargo || '') : '')
          };

          if (mIdx > -1) {
            matchedEmp.members[mIdx] = Object.assign({}, matchedEmp.members[mIdx], memberEntry);
          } else {
            matchedEmp.members.push(memberEntry);
          }

          if (memberEntry.role === 'ADMINISTRADOR_EMPRESA') {
            if (!matchedEmp.admins.some(function(a) { return String(a || '').toLowerCase().trim() === emailClean; })) {
              matchedEmp.admins.push(emailClean);
            }
          } else if (uRol !== 'SUPER_ADMINISTRADOR') {
            matchedEmp.admins = matchedEmp.admins.filter(function(a) { return String(a || '').toLowerCase().trim() !== emailClean; });
          }
          changed = true;
        }
      }
    }

    if (changed) {
      writeDriveJsonFileRaw_(folder, 'empresas.json', empresas);
    }
    return changed;
  } catch (err) {
    Logger.log('syncSingleUserIntoEmpresasDrive_ warning: ' + err);
  }
}

function syncCompanyChangeIntoEmpresasDrive_(rootFolder, compObj, mode) {
  try {
    const folder = rootFolder || DriveApp.getFolderById(PROJECTS_DRIVE_ROOT_FOLDER_ID);
    const empRes = readDriveJsonFileRaw_(folder, 'empresas.json', false);
    if (!empRes.exists || !Array.isArray(empRes.data)) return;

    const empresas = empRes.data;
    const compId = String((compObj && compObj.id) || '').trim();
    if (!compId) return;

    if (mode === 'delete') {
      let changed = false;
      empresas.forEach(function(e) {
        if (e && e.id === compId) {
          e.deleted = true;
          changed = true;
        }
      });
      if (changed) {
        writeDriveJsonFileRaw_(folder, 'empresas.json', empresas);
      }
      return changed;
    }

    const existingIdx = empresas.findIndex(function(e) {
      return e && (e.id === compId || (compObj.name && cleanCompareText_(e.name) === cleanCompareText_(compObj.name)));
    });

    const configUrl = compObj.configUrl || ('config-' + compId + '.json');
    const adminEmail = compObj.email ? String(compObj.email).toLowerCase().trim() : '';
    const admins = adminEmail ? [adminEmail] : [];
    const members = adminEmail ? [{
      name: compObj.adminName || adminEmail.split('@')[0],
      email: adminEmail,
      role: 'ADMINISTRADOR_EMPRESA',
      empresaUsuario: compObj.name,
      especialidad: '',
      cargo: 'Administrador de Empresa'
    }] : [];

    if (existingIdx === -1) {
      const newEmp = {
        id: compId,
        name: compObj.name || compObj.legalName || 'Nueva Empresa',
        code: compObj.code || 'EMP',
        admins: admins,
        zonaHoraria: 'America/Bogota',
        members: members,
        razonSocial: compObj.legalName || compObj.name || '',
        terminosAceptados: true,
        tratamientoDatos: true,
        image: compObj.logoBase64 || 'https://i.postimg.cc/02mTnnQv/21bd5ee9d2351270615280386caad1f3.jpg',
        location: compObj.city ? (compObj.city + ', ' + (compObj.country || 'Colombia')) : 'Bogotá, Colombia',
        configUrl: configUrl,
        driveFolderId: compObj.driveFolderId || ''
      };
      empresas.push(newEmp);
      writeDriveJsonFileRaw_(folder, 'empresas.json', empresas);

      const initialCfg = {
        portal: { name: newEmp.name },
        projects: []
      };
      writeDriveJsonFileRaw_(folder, configUrl, initialCfg);
      syncCompanySubfolderAndProjects_(folder, newEmp, initialCfg, false);
    }
  } catch (err) {
    Logger.log('syncCompanyChangeIntoEmpresasDrive_ warning: ' + err);
  }
}

function fetchPublicStaticJsonFallback_(fileName) {
  const clean = sanitizeJsonFileName_(fileName);
  if (!clean) return null;
  const urls = [
    'https://norabim.com/' + clean + '?t=' + Date.now(),
    'https://raw.githubusercontent.com/camilomartg-svg/bim/main/docs/' + clean + '?t=' + Date.now()
  ];
  for (let i = 0; i < urls.length; i++) {
    try {
      const res = UrlFetchApp.fetch(urls[i], { method: 'get', muteHttpExceptions: true });
      if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
        return JSON.parse(res.getContentText('UTF-8'));
      }
    } catch (e) {}
  }
  return null;
}

function migrateStaticToDrive_(seedPayload, onlyIfMissing) {
  const lock = LockService.getScriptLock();
  lock.tryLock(25000);
  try {
    const rootFolder = DriveApp.getFolderById(PROJECTS_DRIVE_ROOT_FOLDER_ID);
    if (!rootFolder) {
      return { status: 'error', message: 'No se encontró la carpeta de Drive ' + PROJECTS_DRIVE_ROOT_FOLDER_ID };
    }

    if (onlyIfMissing) {
      const checkEmp = readDriveJsonFileRaw_(rootFolder, 'empresas.json', true);
      if (checkEmp.exists && Array.isArray(checkEmp.data) && checkEmp.data.length > 0) {
        return { status: 'success', source: 'drive_json', alreadySeeded: true };
      }
    }

    const doc = openMasterSpreadsheet_();
    const sheetCompanies = readCompaniesFromSheet_(doc);
    const sheetUsers = readUsersFromSheet_(doc);

    // 1. Obtener empresas.json base (seedPayload -> Drive actual -> norabim.com)
    let empresas = null;
    if (seedPayload && Array.isArray(seedPayload.empresas) && seedPayload.empresas.length > 0) {
      empresas = seedPayload.empresas;
    } else {
      const existingEmp = readDriveJsonFileRaw_(rootFolder, 'empresas.json', false);
      if (existingEmp.exists && Array.isArray(existingEmp.data) && existingEmp.data.length > 0) {
        empresas = existingEmp.data;
      } else {
        empresas = fetchPublicStaticJsonFallback_('empresas.json') || [];
      }
    }
    if (!Array.isArray(empresas)) empresas = [];

    // 2. Fusionar empresas registradas en Google Sheets sin perder ninguna empresa ni miembro existente
    sheetCompanies.forEach(function(sc) {
      if (!sc || (!sc.id && !sc.name)) return;
      const scNameClean = cleanCompareText_(sc.name || sc.legalName);
      let existing = empresas.find(function(e) {
        return e && (e.id === sc.id || (scNameClean && (cleanCompareText_(e.name) === scNameClean || cleanCompareText_(e.razonSocial) === scNameClean)));
      });

      if (!existing) {
        const newId = sc.id || ('empresa-' + Date.now());
        existing = {
          id: newId,
          name: sc.name || sc.legalName || 'Empresa',
          code: sc.code || (sc.name ? String(sc.name).substring(0, 3).toUpperCase() : 'BIM'),
          admins: [],
          zonaHoraria: 'America/Bogota',
          members: [],
          razonSocial: sc.legalName || sc.name || '',
          terminosAceptados: true,
          tratamientoDatos: true,
          image: sc.logoBase64 || 'https://i.postimg.cc/02mTnnQv/21bd5ee9d2351270615280386caad1f3.jpg',
          location: sc.city ? (sc.city + ', ' + (sc.country || 'Colombia')) : 'Bogotá, Colombia',
          configUrl: 'config-' + newId + '.json',
          driveFolderId: sc.driveFolderId || ''
        };
        empresas.push(existing);
      } else if (!existing.driveFolderId && sc.driveFolderId) {
        existing.driveFolderId = sc.driveFolderId;
      }

      if (sc.email && String(sc.email).trim()) {
        const adminEmail = String(sc.email).toLowerCase().trim();
        if (!Array.isArray(existing.admins)) existing.admins = [];
        if (!existing.admins.some(function(a) { return String(a).toLowerCase().trim() === adminEmail; })) {
          existing.admins.push(adminEmail);
        }
        if (!Array.isArray(existing.members)) existing.members = [];
        if (!existing.members.some(function(m) { return m && m.email && String(m.email).toLowerCase().trim() === adminEmail; })) {
          existing.members.push({
            name: adminEmail.split('@')[0],
            email: adminEmail,
            role: 'ADMINISTRADOR_EMPRESA',
            empresaUsuario: existing.name,
            especialidad: '',
            cargo: 'Administrador de Empresa'
          });
        }
      }
    });

    // 3. Fusionar usuarios aprobados de Google Sheets hacia empresas.json (SIN borrar miembros existentes de empresas.json)
    sheetUsers.forEach(function(su) {
      if (!su || !su.email || !su.empresa) return;
      const emailClean = String(su.email).toLowerCase().trim();
      const suEmpClean = cleanCompareText_(su.empresa);
      const suEstado = String(su.estado || '').toUpperCase().trim();
      const suRol = String(su.rol || 'INVITADO').trim();
      if (suEstado !== 'APROBADO' && suRol !== 'ADMINISTRADOR_EMPRESA' && suRol !== 'MIEMBRO') return;

      const targetEmp = empresas.find(function(e) {
        if (!e || e.deleted) return false;
        return cleanCompareText_(e.name) === suEmpClean || cleanCompareText_(e.razonSocial) === suEmpClean;
      });
      if (!targetEmp) return;

      if (!Array.isArray(targetEmp.members)) targetEmp.members = [];
      if (!Array.isArray(targetEmp.admins)) targetEmp.admins = [];

      const mIdx = targetEmp.members.findIndex(function(m) {
        return m && m.email && String(m.email).toLowerCase().trim() === emailClean;
      });
      if (mIdx > -1) {
        if (su.nombre && (!targetEmp.members[mIdx].name || targetEmp.members[mIdx].name === 'Nuevo Usuario')) {
          targetEmp.members[mIdx].name = su.nombre;
        }
        if (su.especialidad && !targetEmp.members[mIdx].especialidad) {
          targetEmp.members[mIdx].especialidad = su.especialidad;
        }
        if (su.cargo && !targetEmp.members[mIdx].cargo) {
          targetEmp.members[mIdx].cargo = su.cargo;
        }
      } else {
        targetEmp.members.push({
          name: su.nombre || emailClean.split('@')[0],
          email: emailClean,
          role: suRol,
          empresaUsuario: targetEmp.name,
          especialidad: su.especialidad || '',
          cargo: su.cargo || ''
        });
      }
      if (suRol === 'ADMINISTRADOR_EMPRESA' && !targetEmp.admins.some(function(a) { return String(a).toLowerCase().trim() === emailClean; })) {
        targetEmp.admins.push(emailClean);
      }
    });

    // 4. Asegurar que todos los miembros de empresas.json también existan en la hoja Usuarios y usuarios.json (cero pérdida)
    const membersToEnsureInSheet = [];
    empresas.forEach(function(emp) {
      if (!emp || emp.deleted) return;
      (emp.members || []).forEach(function(m) {
        if (!m || !m.email) return;
        const em = String(m.email).toLowerCase().trim();
        if (!em) return;
        const isInternal = (m.role === 'ADMINISTRADOR_EMPRESA' || m.role === 'MIEMBRO');
        membersToEnsureInSheet.push({
          email: em,
          nombre: (m.name && m.name !== 'Nuevo Usuario') ? m.name : em.split('@')[0],
          empresa: isInternal ? emp.name : (m.empresaUsuario || ''),
          especialidad: m.especialidad || '',
          cargo: m.cargo || '',
          rol: m.role || 'MIEMBRO',
          estado: 'APROBADO'
        });
      });
    });
    upsertUsersBatchInSheet_(doc, membersToEnsureInSheet);
    const finalUsuarios = syncUsuariosJsonFromSheet_(doc, rootFolder);

    // 5. Guardar portal-config.json
    let portalConfig = (seedPayload && seedPayload.portalConfig) || null;
    if (!portalConfig) {
      const existingPortal = readDriveJsonFileRaw_(rootFolder, 'portal-config.json', false);
      if (existingPortal.exists && existingPortal.data) {
        portalConfig = existingPortal.data;
      } else {
        portalConfig = fetchPublicStaticJsonFallback_('portal-config.json') || {
          portal: { name: 'nora CDE', shortName: 'nora' },
          superAdmins: ['imagina3ddesign@gmail.com', 'mcmartinezg@unal.edu.co'],
          projects: []
        };
      }
    }
    writeDriveJsonFileRaw_(rootFolder, 'portal-config.json', portalConfig);

    // 6. Guardar empresas.json
    writeDriveJsonFileRaw_(rootFolder, 'empresas.json', empresas);

    // 7. Migrar y sincronizar todas las configuraciones de empresas y proyectos (config-empresa-*.json + proyecto.json)
    const filesWritten = ['empresas.json', 'usuarios.json', 'portal-config.json'];
    let totalProjectsCount = 0;
    const providedConfigs = (seedPayload && seedPayload.companyConfigs) || {};

    empresas.forEach(function(emp) {
      if (!emp || !emp.id) return;
      const cfgFile = sanitizeJsonFileName_(emp.configUrl || ('config-' + emp.id + '.json'));
      if (!cfgFile) return;
      emp.configUrl = cfgFile;

      let cfgData = providedConfigs[emp.id] || providedConfigs[cfgFile] || null;
      if (!cfgData) {
        const existingCfg = readDriveJsonFileRaw_(rootFolder, cfgFile, false);
        if (existingCfg.exists && existingCfg.data) {
          cfgData = existingCfg.data;
        } else {
          cfgData = fetchPublicStaticJsonFallback_(cfgFile);
        }
      }
      if (!cfgData || typeof cfgData !== 'object') {
        cfgData = { portal: { name: emp.name || 'nora CDE' }, projects: [] };
      }
      if (!Array.isArray(cfgData.projects)) cfgData.projects = [];
      if (!cfgData.portal) cfgData.portal = { name: emp.name || 'nora CDE' };

      // Fusionar con cualquier proyecto.json existente en Drive sin perder datos
      cfgData = syncCompanySubfolderAndProjects_(rootFolder, emp, cfgData, true);
      writeDriveJsonFileRaw_(rootFolder, cfgFile, cfgData);
      filesWritten.push(cfgFile);
      totalProjectsCount += cfgData.projects.length;
    });

    // Migrar también configuraciones adicionales pasadas en seedPayload que no estén en empresas activas
    Object.keys(providedConfigs).forEach(function(key) {
      const candidateFile = sanitizeJsonFileName_(key.indexOf('.json') !== -1 ? key : ('config-' + key + '.json'));
      if (candidateFile && filesWritten.indexOf(candidateFile) === -1) {
        writeDriveJsonFileRaw_(rootFolder, candidateFile, providedConfigs[key]);
        filesWritten.push(candidateFile);
      }
    });

    return {
      status: 'success',
      source: 'drive_json',
      message: 'Migración y sincronización en Google Drive completada sin pérdida de datos.',
      folderId: PROJECTS_DRIVE_ROOT_FOLDER_ID,
      companiesCount: empresas.filter(function(e) { return e && !e.deleted; }).length,
      projectsCount: totalProjectsCount,
      usersCount: finalUsuarios.length,
      filesWritten: filesWritten,
      updatedAt: new Date().toISOString()
    };
  } catch (err) {
    return {
      status: 'error',
      message: 'Error migrando datos JSON a Google Drive: ' + err.toString()
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// Función ejecutable manualmente desde el editor de Google Apps Script si se desea verificar
function migrarTodoADrive() {
  const res = migrateStaticToDrive_(null, false);
  Logger.log(JSON.stringify(res, null, 2));
  return res;
}

function getDriveJson_(params, postData) {
  try {
    const p = Object.assign({}, params || {}, postData || {});
    const rawFile = p.file || p.fileName || p.path || '';
    const cleanFile = sanitizeJsonFileName_(rawFile);
    if (!cleanFile) {
      return { status: 'error', source: 'drive_json', message: 'Archivo JSON inválido o no especificado: ' + rawFile };
    }

    const forceRefresh = String(p.noCache || p.force || '') === '1';
    if (!forceRefresh) {
      const cached = getCacheJson_(cleanFile);
      if (cached && cached.data !== undefined) {
        return {
          status: 'success',
          source: 'drive_json',
          file: cleanFile,
          data: cached.data,
          updatedAt: cached.updatedAt,
          cached: true
        };
      }
    }

    const rootFolder = DriveApp.getFolderById(PROJECTS_DRIVE_ROOT_FOLDER_ID);
    let readRes = readDriveJsonFileRaw_(rootFolder, cleanFile, !forceRefresh);

    // Auto-semilla automática en la primera lectura si la carpeta aún no tenía los JSON maestros
    if (!readRes.exists && (cleanFile === 'empresas.json' || cleanFile === 'portal-config.json' || cleanFile === 'usuarios.json')) {
      migrateStaticToDrive_(null, true);
      readRes = readDriveJsonFileRaw_(rootFolder, cleanFile, false);
    }

    // Si es un config-empresa-*.json que aún no está en la raíz, intentar rescatarlo de subcarpeta o repositorio público
    if (!readRes.exists && cleanFile.indexOf('config-') === 0) {
      const fallbackCfg = fetchPublicStaticJsonFallback_(cleanFile);
      if (fallbackCfg && typeof fallbackCfg === 'object') {
        writeDriveJsonFileRaw_(rootFolder, cleanFile, fallbackCfg);
        return {
          status: 'success',
          source: 'drive_json',
          file: cleanFile,
          data: fallbackCfg,
          updatedAt: new Date().toISOString(),
          seededOnRead: true
        };
      }
    }

    if (!readRes.exists) {
      return {
        status: 'not_found',
        source: 'drive_json',
        file: cleanFile,
        message: 'El archivo ' + cleanFile + ' aún no existe en Google Drive.'
      };
    }

    return {
      status: 'success',
      source: 'drive_json',
      file: cleanFile,
      data: readRes.data,
      updatedAt: readRes.updatedAt,
      cached: false
    };
  } catch (err) {
    return {
      status: 'error',
      source: 'drive_json',
      message: err.toString()
    };
  }
}

function getPlatformBootstrap_(params) {
  try {
    const p = params || {};
    const empresaId = String(p.empresa || p.companyId || '').trim();
    const force = String(p.force || '') === '1';

    const rootFolder = DriveApp.getFolderById(PROJECTS_DRIVE_ROOT_FOLDER_ID);
    let empRes = readDriveJsonFileRaw_(rootFolder, 'empresas.json', !force);
    if (!empRes.exists) {
      migrateStaticToDrive_(null, true);
      empRes = readDriveJsonFileRaw_(rootFolder, 'empresas.json', false);
    }

    const portalRes = readDriveJsonFileRaw_(rootFolder, 'portal-config.json', !force);
    let userRes = readDriveJsonFileRaw_(rootFolder, 'usuarios.json', !force);
    if (!userRes.exists) {
      const syncedUsers = syncUsuariosJsonFromSheet_(null, rootFolder);
      userRes = { exists: true, data: syncedUsers };
    }

    let companyConfig = null;
    if (empresaId && Array.isArray(empRes.data)) {
      const targetEmp = empRes.data.find(function(e) { return e && e.id === empresaId; });
      const cfgFile = sanitizeJsonFileName_((targetEmp && targetEmp.configUrl) || ('config-' + empresaId + '.json'));
      if (cfgFile) {
        const cfgRes = getDriveJson_({ file: cfgFile, force: force ? '1' : '0' }, null);
        if (cfgRes && cfgRes.status === 'success') {
          companyConfig = cfgRes.data;
        }
      }
    }

    return {
      status: 'success',
      source: 'drive_json',
      empresas: empRes.exists ? empRes.data : [],
      portalConfig: portalRes.exists ? portalRes.data : null,
      usuarios: userRes.exists ? userRes.data : [],
      companyConfig: companyConfig,
      updatedAt: new Date().toISOString()
    };
  } catch (err) {
    return { status: 'error', source: 'drive_json', message: err.toString() };
  }
}

function saveDriveJson_(payload) {
  const lock = LockService.getScriptLock();
  lock.tryLock(25000);
  try {
    const p = payload || {};
    const cleanFile = sanitizeJsonFileName_(p.file || p.fileName || p.path || '');
    if (!cleanFile) {
      return { status: 'error', source: 'drive_json', message: 'Nombre de archivo JSON inválido.' };
    }
    if (p.data === undefined) {
      return { status: 'error', source: 'drive_json', message: 'No se enviaron datos para guardar.' };
    }

    const rootFolder = DriveApp.getFolderById(PROJECTS_DRIVE_ROOT_FOLDER_ID);
    let dataToSave = p.data;

    // Si es un archivo de configuración de empresa, sincronizar también subcarpetas [Empresa]/[Proyecto]/proyecto.json
    if (cleanFile.indexOf('config-') === 0 && cleanFile !== 'config-nora.json') {
      const empRes = readDriveJsonFileRaw_(rootFolder, 'empresas.json', true);
      if (empRes.exists && Array.isArray(empRes.data)) {
        const matchedEmp = empRes.data.find(function(e) {
          if (!e) return false;
          if (p.companyId && e.id === p.companyId) return true;
          return sanitizeJsonFileName_(e.configUrl || ('config-' + e.id + '.json')) === cleanFile;
        });
        if (matchedEmp) {
          dataToSave = syncCompanySubfolderAndProjects_(rootFolder, matchedEmp, dataToSave, false);
        }
      }
    }

    const writeInfo = writeDriveJsonFileRaw_(rootFolder, cleanFile, dataToSave);
    return {
      status: 'success',
      source: 'drive_json',
      file: cleanFile,
      fileId: writeInfo.fileId,
      updatedAt: writeInfo.updatedAt,
      message: 'Archivo ' + cleanFile + ' guardado exitosamente en Google Drive.'
    };
  } catch (err) {
    return { status: 'error', source: 'drive_json', message: err.toString() };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function syncDriveFoldersFast_(doc, empresas, companyConfigs) {
  const modelsRoot = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
  let companySheet = doc.getSheetByName('Empresas');
  if (!companySheet) companySheet = doc.insertSheet('Empresas');
  ensureHeaders(companySheet, COMPANY_HEADERS);

  const sheetData = companySheet.getDataRange().getValues();
  const headers = sheetData.length > 0 ? sheetData[0].map(function(h) { return String(h).trim(); }) : COMPANY_HEADERS.slice();
  const idColIdx = headers.indexOf('id');
  const codeColIdx = headers.indexOf('code');
  const folderColIdx = headers.indexOf('driveFolderId');
  const existingSheetIds = {};
  for (let r = 1; r < sheetData.length; r++) {
    const rid = idColIdx !== -1 ? String(sheetData[r][idColIdx] || '').trim() : '';
    if (rid) existingSheetIds[rid] = r;
  }

  const foldersResult = {};
  const rowsToAppend = [];
  const nowIso = new Date().toISOString();

  (empresas || []).forEach(function(emp) {
    if (!emp || emp.deleted || !emp.id) return;
    const code = emp.code || (emp.name ? String(emp.name).replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 3) : 'EMP') || '000';
    const name = emp.name || 'Sin Nombre';

    let companyFolder = null;
    let compFolderId = String(emp.driveFolderId || '').trim();

    // Solo consultar/crear carpeta de empresa en Drive de Modelos si no tiene ID aún o si un proyecto nuevo necesita crearse dentro
    const cfgKeyByFile = emp.configUrl || ('config-' + emp.id + '.json');
    const cfg = (companyConfigs && (companyConfigs[emp.id] || companyConfigs[cfgKeyByFile])) || { projects: [] };
    const projects = Array.isArray(cfg.projects) ? cfg.projects : [];
    const anyProjectNeedsFolder = projects.some(function(p) {
      return p && (!(p.dataSources && p.dataSources.driveFolderId) || p._nameChanged);
    });

    if (!compFolderId || anyProjectNeedsFolder || emp._nameChanged) {
      if (compFolderId) {
        try { companyFolder = DriveApp.getFolderById(compFolderId); } catch (e) { companyFolder = null; }
      }
      if (!companyFolder) {
        try {
          companyFolder = getOrCreateFolder(modelsRoot, code + ' - ' + name);
          compFolderId = companyFolder.getId();
        } catch (e) {
          foldersResult[emp.id] = { error: e.toString(), projects: {} };
          return;
        }
      }
      emp.driveFolderId = compFolderId;
    }

    foldersResult[emp.id] = {
      driveFolderId: compFolderId,
      projects: {}
    };

    // Sincronizar fila en hoja Empresas si es nueva o le faltaba driveFolderId
    const sheetRowIdx = existingSheetIds[emp.id];
    if (sheetRowIdx !== undefined) {
      if (folderColIdx !== -1 && compFolderId && String(sheetData[sheetRowIdx][folderColIdx] || '') !== compFolderId) {
        companySheet.getRange(sheetRowIdx + 1, folderColIdx + 1).setValue(compFolderId);
      }
      if (codeColIdx !== -1 && code && !sheetData[sheetRowIdx][codeColIdx]) {
        companySheet.getRange(sheetRowIdx + 1, codeColIdx + 1).setValue(code);
      }
    } else {
      const newCompRow = new Array(headers.length).fill('');
      const setC = function(col, val) {
        const idx = headers.indexOf(col);
        if (idx !== -1 && val !== undefined && val !== null) newCompRow[idx] = val;
      };
      setC('fecha', nowIso);
      setC('id', emp.id);
      setC('name', name);
      setC('legalName', emp.razonSocial || name);
      setC('website', emp.sitioWeb || '');
      setC('email', (Array.isArray(emp.admins) && emp.admins[0]) || emp.correoGeneral || '');
      setC('phone', emp.telefonoCorporativo || '');
      setC('country', 'Colombia');
      setC('state', emp.departamento || '');
      setC('city', emp.ciudad || '');
      setC('address', emp.direccion || '');
      setC('code', code);
      setC('driveFolderId', compFolderId);
      rowsToAppend.push(newCompRow);
      existingSheetIds[emp.id] = -1;
    }

    // Sincronizar carpetas de modelos e incidencias SOLO para proyectos nuevos o renombrados
    projects.forEach(function(proj) {
      if (!proj || !proj.slug) return;
      if (!proj.dataSources) proj.dataSources = {};
      let projFolderId = String(proj.dataSources.driveFolderId || '').trim();

      if (!projFolderId || proj._nameChanged) {
        let projFolder = null;
        const expectedName = (proj.name || 'Proyecto') + ' [' + proj.slug + ']';
        if (projFolderId) {
          try {
            projFolder = DriveApp.getFolderById(projFolderId);
            if (projFolder.getName() !== expectedName) projFolder.setName(expectedName);
          } catch (e) {
            projFolder = null;
          }
        }
        if (!projFolder && companyFolder) {
          try {
            projFolder = findProjectFolder(companyFolder, proj.slug, proj.name, proj.name);
            if (projFolder) {
              if (projFolder.getName() !== expectedName) projFolder.setName(expectedName);
            } else {
              projFolder = getOrCreateFolder(companyFolder, expectedName);
            }
            projFolderId = projFolder.getId();
          } catch (e) {}
        }
        if (projFolderId) {
          proj.dataSources.driveFolderId = projFolderId;
          proj.dataSources.driveFolderName = proj.name || 'Sin Nombre';
        }
        // Provisionar hoja de incidencias únicamente cuando el proyecto es nuevo
        try {
          provisionIncidentsProject_(emp, proj, {});
        } catch (incErr) {}
      } else if (!proj.dataSources.driveFolderName && proj.name) {
        proj.dataSources.driveFolderName = proj.name;
      }

      delete proj._nameChanged;
      foldersResult[emp.id].projects[proj.slug] = projFolderId;
    });

    delete emp._nameChanged;
  });

  if (rowsToAppend.length > 0) {
    companySheet.getRange(companySheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
  }

  return foldersResult;
}

function saveAdminBundle_(payload) {
  const lock = LockService.getScriptLock();
  lock.tryLock(25000);
  try {
    const data = payload || {};
    const empresas = Array.isArray(data.empresas) ? data.empresas : null;
    if (!empresas) {
      return { status: 'error', source: 'drive_json', message: 'El listado de empresas es inválido.' };
    }

    const rootFolder = DriveApp.getFolderById(PROJECTS_DRIVE_ROOT_FOLDER_ID);
    const doc = openMasterSpreadsheet_();
    const companyConfigs = (data.companyConfigs && typeof data.companyConfigs === 'object') ? data.companyConfigs : {};
    const userRole = String(data.userRole || '').trim();
    const userEmail = String(data.userEmail || '').toLowerCase().trim();

    // Si quien guarda es ADMINISTRADOR_EMPRESA (y no SUPER_ADMINISTRADOR), proteger empresas ajenas en Drive
    let finalEmpresas = empresas;
    if (userRole !== 'SUPER_ADMINISTRADOR') {
      const existingEmpFile = readDriveJsonFileRaw_(rootFolder, 'empresas.json', false);
      if (existingEmpFile.exists && Array.isArray(existingEmpFile.data)) {
        const incomingById = {};
        empresas.forEach(function(e) { if (e && e.id) incomingById[e.id] = e; });
        finalEmpresas = existingEmpFile.data.map(function(origEmp) {
          const canAdminOrig = origEmp && (
            (Array.isArray(origEmp.admins) && origEmp.admins.some(function(a) { return String(a).toLowerCase().trim() === userEmail; })) ||
            (Array.isArray(origEmp.members) && origEmp.members.some(function(m) {
              return m && m.email && String(m.email).toLowerCase().trim() === userEmail && (m.role === 'ADMINISTRADOR_EMPRESA' || m.role === 'ADMINISTRADOR');
            }))
          );
          if (canAdminOrig && incomingById[origEmp.id]) {
            return incomingById[origEmp.id];
          }
          return origEmp;
        });
      }
    }

    // 1. Asegurar admins coherentes con members y recolectar usuarios para sincronizar en bloque
    const usersBatch = [];
    finalEmpresas.forEach(function(emp) {
      if (!emp || emp.deleted) return;
      if (!emp.configUrl) emp.configUrl = 'config-' + emp.id + '.json';
      if (!Array.isArray(emp.admins)) emp.admins = [];
      if (!Array.isArray(emp.members)) emp.members = [];

      emp.members.forEach(function(m) {
        if (!m || !m.email || !String(m.email).trim()) return;
        const em = String(m.email).toLowerCase().trim();
        m.email = em;
        if (m.role === 'ADMINISTRADOR_EMPRESA') {
          if (!emp.admins.some(function(a) { return String(a).toLowerCase().trim() === em; })) {
            emp.admins.push(em);
          }
        }
        const isInternal = (m.role === 'ADMINISTRADOR_EMPRESA' || m.role === 'MIEMBRO' || !m.role);
        if (isInternal) {
          usersBatch.push({
            email: em,
            nombre: (m.name && m.name !== 'Nuevo Usuario') ? m.name : '',
            empresa: emp.name,
            especialidad: m.especialidad || '',
            cargo: m.cargo || '',
            rol: m.role || 'MIEMBRO',
            estado: 'APROBADO'
          });
        } else if (m.role === 'INVITADO') {
          usersBatch.push({
            email: em,
            nombre: (m.name && m.name !== 'Nuevo Usuario') ? m.name : '',
            empresa: m.empresaUsuario || '',
            especialidad: m.especialidad || '',
            cargo: m.cargo || '',
            rol: 'INVITADO',
            estado: 'APROBADO'
          });
        }
      });
    });

    // 2. Sincronizar carpetas de modelos rápidamente (solo crea/abre cuando falta driveFolderId o cambió nombre)
    const foldersMap = syncDriveFoldersFast_(doc, finalEmpresas, companyConfigs);

    // 3. Sincronizar hoja Usuarios + usuarios.json en Drive en una sola pasada rápida
    if (usersBatch.length > 0) {
      upsertUsersBatchInSheet_(doc, usersBatch);
    }
    const usuariosActualizados = syncUsuariosJsonFromSheet_(doc, rootFolder);

    // 4. Guardar empresas.json en Drive
    writeDriveJsonFileRaw_(rootFolder, 'empresas.json', finalEmpresas);

    // 5. Guardar portal-config.json si aplica
    if (userRole === 'SUPER_ADMINISTRADOR' && data.portalConfig && typeof data.portalConfig === 'object') {
      writeDriveJsonFileRaw_(rootFolder, 'portal-config.json', data.portalConfig);
    }

    // 6. Guardar config-empresa-*.json y sincronizar subcarpetas [Empresa]/[Proyecto]/proyecto.json
    const savedConfigs = {};
    Object.keys(companyConfigs).forEach(function(cfgKey) {
      const emp = finalEmpresas.find(function(e) {
        return e && (e.id === cfgKey || e.configUrl === cfgKey || ('config-' + e.id + '.json') === cfgKey);
      });
      if (!emp) return;
      const empId = emp.id;

      if (userRole !== 'SUPER_ADMINISTRADOR') {
        const hasAccess = (Array.isArray(emp.admins) && emp.admins.some(function(a) { return String(a).toLowerCase().trim() === userEmail; })) ||
          (Array.isArray(emp.members) && emp.members.some(function(m) {
            return m && m.email && String(m.email).toLowerCase().trim() === userEmail && (m.role === 'ADMINISTRADOR_EMPRESA' || m.role === 'ADMINISTRADOR');
          }));
        if (!hasAccess) return;
      }

      const cfgFile = sanitizeJsonFileName_(emp.configUrl || ('config-' + empId + '.json'));
      if (!cfgFile) return;

      let cfgData = companyConfigs[cfgKey] || companyConfigs[empId] || { projects: [] };
      if (!cfgData.portal) cfgData.portal = { name: emp.name || 'nora CDE' };
      if (!Array.isArray(cfgData.projects)) cfgData.projects = [];

      cfgData = syncCompanySubfolderAndProjects_(rootFolder, emp, cfgData, false);
      writeDriveJsonFileRaw_(rootFolder, cfgFile, cfgData);
      savedConfigs[empId] = cfgData;
    });

    return {
      status: 'success',
      source: 'drive_json',
      message: 'Cambios guardados instantáneamente en Google Drive.',
      folders: foldersMap,
      empresas: finalEmpresas,
      companyConfigs: savedConfigs,
      usersCount: usuariosActualizados.length,
      updatedAt: new Date().toISOString()
    };
  } catch (err) {
    return {
      status: 'error',
      source: 'drive_json',
      message: 'Error guardando en Google Drive: ' + err.toString()
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function serializeDeliveryTeams_(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    const clean = value.map(function(team) {
      return String(team || '').trim();
    }).filter(Boolean);
    return clean.length ? JSON.stringify(clean) : '';
  }
  const str = String(value || '').trim();
  return str || '';
}

function findProjectFolder(parentFolder, slug, name, driveFolderName) {
  const folders = parentFolder.getFolders();
  const list = [];
  while (folders.hasNext()) {
    const f = folders.next();
    const fName = f.getName().trim();
    // 1. Check if name contains the unique slug in brackets/parentheses or exactly
    if (fName.includes("[" + slug + "]") || fName.includes("(" + slug + ")") || fName === slug) {
      return f;
    }
    list.push(f);
  }
  
  // 2. Fallback: exact match on name or driveFolderName (case insensitive)
  const cleanName = String(name || '').trim().toLowerCase();
  const cleanDFN = String(driveFolderName || '').trim().toLowerCase();
  
  for (let i = 0; i < list.length; i++) {
    const fName = list[i].getName().trim().toLowerCase();
    // Do not match generic names to avoid wrong association
    if (cleanName && fName === cleanName && cleanName !== 'nuevo proyecto' && cleanName !== 'sin nombre') {
      return list[i];
    }
    if (cleanDFN && fName === cleanDFN && cleanDFN !== 'nuevo proyecto' && cleanDFN !== 'sin nombre') {
      return list[i];
    }
  }
  
  return null;
}

function findProjectFolderRecursively(parentFolder, slug, driveFolderName) {
  const cleanSlug = String(slug || '').trim().toLowerCase();
  const cleanDFN = String(driveFolderName || '').trim().toLowerCase();
  
  // 1. First pass: try to find a folder matching/containing the slug in the current folder
  const subFolders = parentFolder.getFolders();
  const list = [];
  while (subFolders.hasNext()) {
    const sub = subFolders.next();
    const name = sub.getName().trim().toLowerCase();
    if (cleanSlug && (name.includes("[" + cleanSlug + "]") || name.includes("(" + cleanSlug + ")") || name === cleanSlug)) {
      return sub;
    }
    list.push(sub);
  }
  
  // 2. Second pass: check for exact match on driveFolderName, but IGNORE generic names like 'nuevo proyecto'
  if (cleanDFN && cleanDFN !== 'nuevo proyecto' && cleanDFN !== 'sin nombre') {
    for (let i = 0; i < list.length; i++) {
      const name = list[i].getName().trim().toLowerCase();
      if (name === cleanDFN) {
        return list[i];
      }
    }
  }
  
  // 3. Third pass: recurse into subfolders
  for (let i = 0; i < list.length; i++) {
    const found = findProjectFolderRecursively(list[i], slug, driveFolderName);
    if (found) return found;
  }
  
  return null;
}

function doPost(e) {
  try {
    let data = null;
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = null;
      }
    }
    
    let action = '';
    if (data && data.action) action = String(data.action).trim();
    if (!action && e && e.parameter && e.parameter.action) action = String(e.parameter.action).trim();

    const callback = String(e && e.parameter && e.parameter.callback || '').trim();

    if (action === 'list') {
      return output_(listModels_(e, data), callback);
    }
    if (action === 'chunk') {
      return output_(chunkFile_(e, data), callback);
    }
    if (action === 'text') {
      return output_(textFile_(e, data), callback);
    }
    if (action === 'uploadFile') {
      return output_(uploadFile_(e, data), callback);
    }
    if (action === 'saveIncidentsProjectConfig') {
      return output_(saveIncidentsProjectConfig_(data || {}), callback);
    }
    if (action === 'saveIncidentsLocation') {
      return output_(saveIncidentsLocation_(data || {}), callback);
    }
    if (action === 'saveProjectConfig' || action === 'saveProject') {
      return output_(saveProjectConfigToDrive_(data || e.parameter || {}), callback);
    }
    if (action === 'getProjectConfig' || action === 'getProject') {
      return output_(getProjectConfigFromDrive_(e.parameter || {}, data), callback);
    }
    if (action === 'getCompanyProjects') {
      return output_(getCompanyProjectsFromDrive_(e.parameter || {}, data), callback);
    }
    if (action === 'initResumableUpload') {
      return output_(initResumableUpload_(e, data), callback);
    }
    if (action === 'uploadResumableChunk') {
      return output_(uploadResumableChunk_(e, data), callback);
    }
    if (action === 'deleteFile' || action === 'deleteFiles') {
      return output_(deleteFile_(e, data), callback);
    }
    if (action === 'changeFileStatus') {
      return output_(changeFileStatus_(e, data), callback);
    }
    if (action === 'listStatus') {
      return output_(listStatus_(e, data), callback);
    }
    if (action === 'createVersion') {
      return output_(createVersion_(e, data), callback);
    }
    if (action === 'listVersions') {
      return output_(listVersions_(e, data), callback);
    }
    if (action === 'restoreVersion') {
      return output_(restoreVersion_(e, data), callback);
    }
    if (action === 'getDriveJson') {
      return output_(getDriveJson_(e.parameter || {}, data), callback);
    }
    if (action === 'getPlatformBootstrap') {
      return output_(getPlatformBootstrap_(Object.assign({}, e.parameter || {}, data || {})), callback);
    }
    if (action === 'saveDriveJson') {
      return output_(saveDriveJson_(data || {}), callback);
    }
    if (action === 'saveAdminBundle') {
      return output_(saveAdminBundle_(data || {}), callback);
    }
    if (action === 'migrateStaticToDrive') {
      return output_(migrateStaticToDrive_(data || {}, Boolean(data && data.onlyIfMissing)), callback);
    }
    if (action === 'wompiWebhook' || (data && data.event === 'transaction.updated')) {
      return output_(handleWompiWebhook_(e, data), callback);
    }

    let doc;
    try {
      doc = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (err) {
      doc = SpreadsheetApp.getActiveSpreadsheet();
    }
    const fecha = new Date().toISOString();

    if (action === 'deleteUser') {
      const email = String((data && data.email) || (e && e.parameter && e.parameter.email) || '').toLowerCase().trim();
      if (!email) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "El correo es obligatorio." })).setMimeType(ContentService.MimeType.JSON);
      }
      
      let userSheet = doc.getSheetByName('Usuarios');
      if (userSheet) {
        ensureHeaders(userSheet, USER_HEADERS);
        const headers = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
        const emailColIdx = headers.map(h => h.toLowerCase()).indexOf('email');
        if (emailColIdx !== -1) {
          const numRows = userSheet.getLastRow();
          if (numRows > 1) {
            const values = userSheet.getRange(2, emailColIdx + 1, numRows - 1, 1).getValues();
            let deletedAny = false;
            for (let i = values.length - 1; i >= 0; i--) {
              if (String(values[i][0]).toLowerCase().trim() === email) {
                userSheet.deleteRow(i + 2);
                deletedAny = true;
              }
            }
            if (deletedAny) {
              try {
                syncUsuariosJsonFromSheet_(doc, null);
                syncSingleUserIntoEmpresasDrive_(null, { email: email }, 'delete');
              } catch (syncErr) {}
              return ContentService.createTextOutput(JSON.stringify({ status: "success", source: "drive_json", message: "Usuario eliminado exitosamente" })).setMimeType(ContentService.MimeType.JSON);
            }
          }
        }
      }
      let removedFromDrive = false;
      try {
        syncUsuariosJsonFromSheet_(doc, null);
        removedFromDrive = Boolean(syncSingleUserIntoEmpresasDrive_(null, { email: email }, 'delete'));
      } catch (syncErr) {}
      if (removedFromDrive) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", source: "drive_json", message: "Usuario eliminado de Drive exitosamente" })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Usuario no encontrado" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'deleteCompany') {
      const companyId = String((data && data.id) || (e && e.parameter && e.parameter.id) || '').trim();
      if (!companyId) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "El ID de la empresa es obligatorio." })).setMimeType(ContentService.MimeType.JSON);
      }
      
      let companySheet = doc.getSheetByName('Empresas');
      if (companySheet) {
        ensureHeaders(companySheet, COMPANY_HEADERS);
        const headers = companySheet.getRange(1, 1, 1, companySheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
        const idColIdx = headers.map(h => h.toLowerCase()).indexOf('id');
        const nameColIdx = headers.map(h => h.toLowerCase()).indexOf('name');
        if (idColIdx !== -1) {
          const numRows = companySheet.getLastRow();
          if (numRows > 1) {
            const values = companySheet.getRange(2, idColIdx + 1, numRows - 1, 1).getValues();
            let companyName = "";
            let rowToDelete = -1;
            for (let i = 0; i < values.length; i++) {
              if (String(values[i][0]).trim() === companyId) {
                rowToDelete = i + 2;
                if (nameColIdx !== -1) {
                  companyName = String(companySheet.getRange(rowToDelete, nameColIdx + 1).getValue()).trim();
                }
                break;
              }
            }
            if (rowToDelete !== -1) {
              companySheet.deleteRow(rowToDelete);
              
              // Also update Users sheet to clear association
              if (companyName) {
                let userSheet = doc.getSheetByName('Usuarios');
                if (userSheet) {
                  ensureHeaders(userSheet, USER_HEADERS);
                  const uHeaders = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
                  const empColIdx = uHeaders.map(h => h.toLowerCase()).indexOf('empresa');
                  if (empColIdx !== -1) {
                    const uNumRows = userSheet.getLastRow();
                    if (uNumRows > 1) {
                      const uValues = userSheet.getRange(2, empColIdx + 1, uNumRows - 1, 1).getValues();
                      for (let j = 0; j < uValues.length; j++) {
                        if (String(uValues[j][0]).trim().toLowerCase() === companyName.toLowerCase()) {
                          userSheet.getRange(j + 2, empColIdx + 1).setValue("");
                        }
                      }
                    }
                  }
                }
              }
              try {
                syncCompanyChangeIntoEmpresasDrive_(null, { id: companyId }, 'delete');
                syncUsuariosJsonFromSheet_(doc, null);
              } catch (syncErr) {}
              return ContentService.createTextOutput(JSON.stringify({ status: "success", source: "drive_json", message: "Empresa eliminada exitosamente" })).setMimeType(ContentService.MimeType.JSON);
            }
          }
        }
      }
      let deletedCompanyInDrive = false;
      try {
        deletedCompanyInDrive = Boolean(syncCompanyChangeIntoEmpresasDrive_(null, { id: companyId }, 'delete'));
        syncUsuariosJsonFromSheet_(doc, null);
      } catch (syncErr) {}
      if (deletedCompanyInDrive) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", source: "drive_json", message: "Empresa eliminada en Drive exitosamente" })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Empresa no encontrada" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (data && data.action === 'createUserAndCompany') {
      let companySheet = doc.getSheetByName('Empresas');
      if (!companySheet) {
        companySheet = doc.insertSheet('Empresas');
      }
      ensureHeaders(companySheet, COMPANY_HEADERS);
      
      const companyId = 'empresa-' + Date.now();
      
      // Auto-generate code
      let name = data.companyData.name || "Nueva Empresa";
      const cleanName = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      let code = cleanName.substring(0, 3);
      if (code.length < 3) {
        code = (code + "EMP").substring(0, 3);
      }
      
      // Create Google Drive Folder
      let driveFolderId = "";
      try {
        const rootFolder = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
        const folderName = `${code} - ${name}`;
        const folder = getOrCreateFolder(rootFolder, folderName);
        driveFolderId = folder.getId();
      } catch (err) {
        Logger.log("Error creating Drive folder: " + err);
      }

      // Map values to expected headers
      const headers = companySheet.getRange(1, 1, 1, companySheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
      const row = new Array(headers.length).fill("");
      
      const setVal = (headerName, value) => {
        const idx = headers.indexOf(headerName);
        if (idx !== -1) row[idx] = value;
      };
      
      setVal('fecha', fecha);
      setVal('id', companyId);
      setVal('name', name);
      setVal('legalName', data.companyData.legalName || name);
      setVal('type', data.companyData.type || '');
      setVal('website', data.companyData.website || '');
      setVal('email', data.companyData.email || '');
      setVal('phone', data.companyData.phone || '');
      setVal('country', data.companyData.country || '');
      setVal('state', data.companyData.state || '');
      setVal('city', data.companyData.city || '');
      setVal('zip', data.companyData.zip || '');
      setVal('address', data.companyData.address || '');
      setVal('sectors', Array.isArray(data.companyData.sectors) ? data.companyData.sectors.join(', ') : (data.companyData.sectors || ''));
      setVal('specialties', Array.isArray(data.companyData.specialties) ? data.companyData.specialties.join(', ') : (data.companyData.specialties || ''));
      setVal('logoBase64', data.companyData.logoBase64 || '');
      setVal('code', code);
      setVal('driveFolderId', driveFolderId);
      
      companySheet.appendRow(row);
      
      let userSheet = doc.getSheetByName('Usuarios');
      if (!userSheet) {
        userSheet = doc.insertSheet('Usuarios');
      }
      ensureHeaders(userSheet, USER_HEADERS);
      
      const uHeaders = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
      
      const emailColIdx = uHeaders.indexOf('email');
      let existingRowIdx = -1;
      if (emailColIdx !== -1) {
        const numRows = userSheet.getLastRow();
        if (numRows > 1) {
          const values = userSheet.getRange(2, emailColIdx + 1, numRows - 1, 1).getValues();
          const targetEmail = String(data.userData.email).toLowerCase().trim();
          for (let i = 0; i < values.length; i++) {
            if (String(values[i][0]).toLowerCase().trim() === targetEmail) {
              existingRowIdx = i + 2;
              break;
            }
          }
        }
      }

      if (existingRowIdx !== -1) {
        const rowRange = userSheet.getRange(existingRowIdx, 1, 1, uHeaders.length);
        const currentRow = rowRange.getValues()[0];
        const setValExist = (headerName, value) => {
          const idx = uHeaders.indexOf(headerName);
          if (idx !== -1 && value !== undefined && value !== null && value !== '') {
            currentRow[idx] = value;
          }
        };
        setValExist('nombre', data.userData.nombre);
        setValExist('telefono', data.userData.telefono);
        setValExist('empresa', data.userData.empresa);
        setValExist('especialidad', data.userData.especialidad);
        setValExist('cargo', data.userData.cargo);
        setValExist('rol', data.userData.rol);
        setValExist('estado', data.userData.estado);
        rowRange.setValues([currentRow]);
      } else {
        const uRow = new Array(uHeaders.length).fill("");
        const setUVal = (headerName, value) => {
          const idx = uHeaders.indexOf(headerName);
          if (idx !== -1) uRow[idx] = value;
        };
        setUVal('fecha', fecha);
        setUVal('nombre', data.userData.nombre || '');
        setUVal('email', data.userData.email);
        setUVal('telefono', data.userData.telefono || '');
        setUVal('empresa', data.userData.empresa || '');
        setUVal('especialidad', data.userData.especialidad || '');
        setUVal('cargo', data.userData.cargo || '');
        setUVal('rol', data.userData.rol || 'INVITADO');
        setUVal('estado', data.userData.estado || 'PENDIENTE');
        userSheet.appendRow(uRow);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        id: (function() {
          try {
            syncCompanyChangeIntoEmpresasDrive_(null, {
              id: companyId,
              name: name,
              legalName: data.companyData.legalName || name,
              email: data.userData.email || data.companyData.email || '',
              adminName: data.userData.nombre || '',
              city: data.companyData.city || '',
              country: data.companyData.country || '',
              logoBase64: data.companyData.logoBase64 || '',
              code: code,
              driveFolderId: driveFolderId
            }, 'upsert');
            const syncedUsers = syncUsuariosJsonFromSheet_(doc, null);
            const targetEmail = String(data.userData.email || '').toLowerCase().trim();
            const mergedUser = (Array.isArray(syncedUsers) && syncedUsers.find(function(u) { return String(u.email || '').toLowerCase().trim() === targetEmail; })) || data.userData;
            syncSingleUserIntoEmpresasDrive_(null, mergedUser, 'upsert');
          } catch (syncErr) {}
          return companyId;
        })(),
        source: "drive_json",
        message: "Empresa y usuario creados exitosamente",
        driveFolderId: driveFolderId,
        code: code
      })).setMimeType(ContentService.MimeType.JSON);

    } else if (data.action === 'createCompany') {
      let companySheet = doc.getSheetByName('Empresas');
      if (!companySheet) {
        companySheet = doc.insertSheet('Empresas');
      }
      ensureHeaders(companySheet, COMPANY_HEADERS);
      
      let name = data.name || "Nueva Empresa";
      const cleanName = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      let code = cleanName.substring(0, 3);
      if (code.length < 3) {
        code = (code + "EMP").substring(0, 3);
      }
      
      let driveFolderId = "";
      try {
        const rootFolder = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
        const folderName = `${code} - ${name}`;
        const folder = getOrCreateFolder(rootFolder, folderName);
        driveFolderId = folder.getId();
      } catch (err) {
        Logger.log("Error creating Drive folder: " + err);
      }
      
      const headers = companySheet.getRange(1, 1, 1, companySheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
      const row = new Array(headers.length).fill("");
      const setVal = (headerName, value) => {
        const idx = headers.indexOf(headerName);
        if (idx !== -1) row[idx] = value;
      };
      
      setVal('fecha', fecha);
      const newCompanyId = String(data.id || ('empresa-' + Date.now())).trim();
      setVal('id', newCompanyId);
      setVal('name', name);
      setVal('legalName', data.legalName || name);
      setVal('type', data.type || '');
      setVal('website', data.website || '');
      setVal('email', data.email || '');
      setVal('phone', data.phone || '');
      setVal('country', data.country || '');
      setVal('state', data.state || '');
      setVal('city', data.city || '');
      setVal('zip', data.zip || '');
      setVal('address', data.address || '');
      setVal('sectors', Array.isArray(data.sectors) ? data.sectors.join(', ') : (data.sectors || ''));
      setVal('specialties', Array.isArray(data.specialties) ? data.specialties.join(', ') : (data.specialties || ''));
      setVal('logoBase64', data.logoBase64 || '');
      setVal('code', code);
      setVal('driveFolderId', driveFolderId);
      
      companySheet.appendRow(row);
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        id: (function() {
          try {
            syncCompanyChangeIntoEmpresasDrive_(null, {
              id: newCompanyId,
              name: name,
              legalName: data.legalName || name,
              email: data.email || '',
              city: data.city || '',
              country: data.country || '',
              logoBase64: data.logoBase64 || '',
              code: code,
              driveFolderId: driveFolderId
            }, 'upsert');
          } catch (syncErr) {}
          return newCompanyId;
        })(),
        source: "drive_json",
        message: "Empresa creada exitosamente",
        driveFolderId: driveFolderId,
        code: code
      })).setMimeType(ContentService.MimeType.JSON);
      
    } else if (data.action === 'syncDriveFolders') {
      const rootFolder = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
      const companySheet = doc.getSheetByName('Empresas');
      if (companySheet) {
        ensureHeaders(companySheet, COMPANY_HEADERS);
      }
      
      const responseFolders = {};
      const sheetData = companySheet ? companySheet.getDataRange().getValues() : [];
      const headers = sheetData.length > 0 ? sheetData[0].map(h => String(h).trim()) : [];
      const idColIdx = headers.indexOf('id');
      const codeColIdx = headers.indexOf('code');
      const folderColIdx = headers.indexOf('driveFolderId');
      
      const requestedCompanies = data.companies || [];
      
      requestedCompanies.forEach(comp => {
        let code = comp.code || '000';
        let name = comp.name || 'Sin Nombre';
        
        // 1. Get or create company folder
        let companyFolder = null;
        if (comp.driveFolderId) {
          try {
            companyFolder = DriveApp.getFolderById(comp.driveFolderId);
          } catch (e) {
            Logger.log("Error getting folder by ID: " + e.toString());
          }
        }
        
        if (!companyFolder) {
          const companyFolderName = `${code} - ${name}`;
          try {
            companyFolder = getOrCreateFolder(rootFolder, companyFolderName);
          } catch (e) {
            responseFolders[comp.id] = {
              error: e.toString()
            };
            return;
          }
        }
        
        const compFolderId = companyFolder.getId();
        responseFolders[comp.id] = {
          driveFolderId: compFolderId,
          projects: {}
        };
        
        // Update Spreadsheet row for this company if spreadsheet exists
        if (companySheet && idColIdx !== -1) {
          for (let r = 1; r < sheetData.length; r++) {
            if (sheetData[r][idColIdx] === comp.id) {
              if (codeColIdx !== -1 && !sheetData[r][codeColIdx]) {
                companySheet.getRange(r + 1, codeColIdx + 1).setValue(code);
              }
              if (folderColIdx !== -1) {
                companySheet.getRange(r + 1, folderColIdx + 1).setValue(compFolderId);
              }
              break;
            }
          }
        }
        
        // 2. Sync projects
        const projects = comp.projects || [];
        projects.forEach(proj => {
          let projFolderId = proj.driveFolderId || "";
          let projFolder = null;
          
          if (projFolderId) {
            // Verify it exists, else recreate
            try {
              projFolder = DriveApp.getFolderById(projFolderId);
              // Ensure name is correct and contains slug
              const expectedName = proj.name + " [" + proj.slug + "]";
              if (projFolder.getName() !== expectedName) {
                projFolder.setName(expectedName);
              }
            } catch (err) {
              projFolder = null;
            }
          }
          
          if (!projFolder) {
            try {
              // Try finding by slug or name in the company folder
              projFolder = findProjectFolder(companyFolder, proj.slug, proj.name, proj.name);
              if (projFolder) {
                const expectedName = proj.name + " [" + proj.slug + "]";
                if (projFolder.getName() !== expectedName) {
                  projFolder.setName(expectedName);
                }
              } else {
                // Create folder with unique format
                const folderName = proj.name + " [" + proj.slug + "]";
                projFolder = getOrCreateFolder(companyFolder, folderName);
              }
              projFolderId = projFolder.getId();
            } catch (e) {
              responseFolders[comp.id].projects[proj.slug] = "error: " + e.toString();
            }
          }
          
          if (projFolderId) {
            responseFolders[comp.id].projects[proj.slug] = projFolderId;
          }
          // Incidencias has its own Drive tree and a Google Sheet per project.
          try {
            const incidentsStorage = provisionIncidentsProject_(comp, proj, {});
            responseFolders[comp.id].incidents = responseFolders[comp.id].incidents || {};
            responseFolders[comp.id].incidents[proj.slug] = incidentsStorage;
          } catch (incidentsError) {
            responseFolders[comp.id].incidents = responseFolders[comp.id].incidents || {};
            responseFolders[comp.id].incidents[proj.slug] = { error: incidentsError.toString() };
          }
        });
      });
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        folders: responseFolders 
      })).setMimeType(ContentService.MimeType.JSON);
      
    } else if (data && data.action === 'saveTeams') {
      let teamSheet = doc.getSheetByName('EquiposDeTarea');
      if (!teamSheet) {
        teamSheet = doc.insertSheet('EquiposDeTarea');
      }
      ensureHeaders(teamSheet, TEAM_HEADERS);
      
      const targetEmpresa = String(data.empresa || '').trim();
      const targetProyecto = String(data.proyecto || '').trim();
      const teams = Array.isArray(data.teams) ? data.teams : [];
      
      const tHeaders = teamSheet.getRange(1, 1, 1, teamSheet.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase());
      const empCol = tHeaders.indexOf('empresa');
      const projCol = tHeaders.indexOf('proyecto');
      
      const numRows = teamSheet.getLastRow();
      if (numRows > 1 && empCol !== -1 && projCol !== -1) {
        const values = teamSheet.getRange(2, 1, numRows - 1, tHeaders.length).getValues();
        for (let i = values.length - 1; i >= 0; i--) {
          const rowEmp = String(values[i][empCol]).trim();
          const rowProj = String(values[i][projCol]).trim();
          if (rowEmp.toLowerCase() === targetEmpresa.toLowerCase() && rowProj.toLowerCase() === targetProyecto.toLowerCase()) {
            teamSheet.deleteRow(i + 2);
          }
        }
      }
      
      teams.forEach(team => {
        const row = new Array(tHeaders.length).fill("");
        const setTVal = (headerName, value) => {
          const idx = tHeaders.indexOf(headerName.toLowerCase());
          if (idx !== -1) row[idx] = value;
        };
        setTVal('fecha', fecha);
        setTVal('empresa', targetEmpresa);
        setTVal('proyecto', targetProyecto);
        setTVal('nombreequipo', team.name || '');
        setTVal('miembros', Array.isArray(team.members) ? team.members.join(', ') : String(team.members || ''));
        teamSheet.appendRow(row);
      });
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "Equipos de tarea guardados exitosamente",
        count: teams.length 
      })).setMimeType(ContentService.MimeType.JSON);
      
    } else {
      // Guardar Usuario (Comportamiento por defecto)
      const email = String((data && data.email) || (e && e.parameter && e.parameter.email) || '').toLowerCase().trim();
      if (!email) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "El correo es obligatorio." })).setMimeType(ContentService.MimeType.JSON);
      }
      
      let userSheet = doc.getSheetByName('Usuarios');
      if (!userSheet) {
        userSheet = doc.insertSheet('Usuarios');
      }
      ensureHeaders(userSheet, USER_HEADERS);
      
      const headers = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
      const lowerHeaders = headers.map(h => h.toLowerCase());
      
      const emailColIdx = lowerHeaders.indexOf('email');
      let existingRowIdx = -1;
      if (emailColIdx !== -1) {
        const numRows = userSheet.getLastRow();
        if (numRows > 1) {
          const values = userSheet.getRange(2, emailColIdx + 1, numRows - 1, 1).getValues();
          for (let i = 0; i < values.length; i++) {
            if (String(values[i][0]).toLowerCase().trim() === email) {
              existingRowIdx = i + 2;
              break;
            }
          }
        }
      }

      const getVal = (field) => {
        return (data && data[field] !== undefined) ? data[field] : (e && e.parameter && e.parameter[field] !== undefined ? e.parameter[field] : '');
      };

      if (existingRowIdx !== -1) {
        const rowRange = userSheet.getRange(existingRowIdx, 1, 1, headers.length);
        const currentRow = rowRange.getValues()[0];
        const setValExist = (headerName, value) => {
          const idx = lowerHeaders.indexOf(headerName.toLowerCase());
          if (idx !== -1 && value !== undefined && value !== null && value !== '') {
            currentRow[idx] = value;
          }
        };
        setValExist('nombre', getVal('nombre'));
        setValExist('telefono', getVal('telefono'));
        setValExist('empresa', getVal('empresa'));
        setValExist('especialidad', getVal('especialidad'));
        setValExist('cargo', getVal('cargo'));
        setValExist('rol', getVal('rol'));
        setValExist('estado', getVal('estado'));
        rowRange.setValues([currentRow]);
      } else {
        const row = new Array(headers.length).fill("");
        const setVal = (headerName, value) => {
          const idx = lowerHeaders.indexOf(headerName.toLowerCase());
          if (idx !== -1) row[idx] = value;
        };
        setVal('fecha', fecha);
        setVal('nombre', getVal('nombre'));
        setVal('email', email);
        setVal('telefono', getVal('telefono'));
        setVal('empresa', getVal('empresa'));
        setVal('especialidad', getVal('especialidad'));
        setVal('cargo', getVal('cargo'));
        setVal('rol', getVal('rol') || 'INVITADO');
        setVal('estado', getVal('estado') || 'PENDIENTE');
        userSheet.appendRow(row);
      }
      
      try {
        const syncedUsers = syncUsuariosJsonFromSheet_(doc, null);
        const mergedUser = (Array.isArray(syncedUsers) && syncedUsers.find(function(u) { return String(u.email || '').toLowerCase().trim() === email; })) || {
          email: email,
          nombre: getVal('nombre'),
          telefono: getVal('telefono'),
          empresa: getVal('empresa'),
          especialidad: getVal('especialidad'),
          cargo: getVal('cargo'),
          rol: getVal('rol') || 'INVITADO',
          estado: getVal('estado') || 'PENDIENTE'
        };
        syncSingleUserIntoEmpresasDrive_(null, mergedUser, 'upsert');
      } catch (syncErr) {}
      return ContentService.createTextOutput(JSON.stringify({ status: "success", source: "drive_json", message: "Usuario guardado exitosamente" })).setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const action = String(e && e.parameter && e.parameter.action || '').trim();
    const callback = String(e && e.parameter && e.parameter.callback || '').trim();

    if (action === 'list') {
      return output_(listModels_(e, null), callback);
    }
    if (action === 'chunk') {
      return output_(chunkFile_(e, null), callback);
    }
    if (action === 'text') {
      return output_(textFile_(e, null), callback);
    }
    if (action === 'deleteFile' || action === 'deleteFiles') {
      return output_(deleteFile_(e, null), callback);
    }
    if (action === 'changeFileStatus') {
      return output_(changeFileStatus_(e, null), callback);
    }
    if (action === 'listStatus') {
      return output_(listStatus_(e, null), callback);
    }
    if (action === 'getDriveJson') {
      return output_(getDriveJson_(e.parameter || {}, null), callback);
    }
    if (action === 'getPlatformBootstrap') {
      return output_(getPlatformBootstrap_(e.parameter || {}), callback);
    }
    if (action === 'migrateStaticToDrive') {
      return output_(migrateStaticToDrive_(null, String((e.parameter && e.parameter.onlyIfMissing) || '') === '1'), callback);
    }
    if ((action === 'getUsers' || action === '') && String((e && e.parameter && e.parameter.force) || '') !== '1') {
      const cachedUsers = getCacheJson_('usuarios.json');
      if (cachedUsers && Array.isArray(cachedUsers.data) && cachedUsers.data.length > 0) {
        return output_(cachedUsers.data, callback);
      }
    }
    if (action === 'getIncidentsLocations') {
      return output_(getIncidentsLocations_({ empresa: e.parameter.empresa, proyecto: e.parameter.proyecto }), callback);
    }
    if (action === 'getProjectConfig' || action === 'getProject') {
      return output_(getProjectConfigFromDrive_(e.parameter || {}, null), callback);
    }
    if (action === 'getCompanyProjects') {
      return output_(getCompanyProjectsFromDrive_(e.parameter || {}, null), callback);
    }
    if (action === 'saveProjectConfig' || action === 'saveProject') {
      return output_(saveProjectConfigToDrive_(e.parameter || {}), callback);
    }

    let doc;
    try {
      doc = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (err) {
      doc = SpreadsheetApp.getActiveSpreadsheet();
    }
    
    if (action === 'getCompanies') {
      const sheet = doc.getSheetByName('Empresas');
      if (!sheet) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
      ensureHeaders(sheet, COMPANY_HEADERS);
      
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim());
      const empresas = [];
      
      for (let i = 1; i < data.length; i++) {
        let obj = {};
        for (let j = 0; j < headers.length; j++) {
          obj[headers[j]] = data[i][j];
        }
        empresas.push(obj);
      }
      return ContentService.createTextOutput(JSON.stringify(empresas)).setMimeType(ContentService.MimeType.JSON);
      
    } else if (action === 'getTeams') {
      const sheet = doc.getSheetByName('EquiposDeTarea');
      if (!sheet) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
      ensureHeaders(sheet, TEAM_HEADERS);
      
      const targetEmpresa = String(e && e.parameter && (e.parameter.empresa || e.parameter.companyId) || '').trim();
      const targetProyecto = String(e && e.parameter && (e.parameter.proyecto || e.parameter.project) || '').trim();
      
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim().toLowerCase());
      const teams = [];
      
      for (let i = 1; i < data.length; i++) {
        let obj = {};
        for (let j = 0; j < headers.length; j++) {
          obj[headers[j]] = data[i][j];
        }
        const rowEmp = String(obj.empresa || '').trim();
        const rowProj = String(obj.proyecto || '').trim();
        
        if ((!targetEmpresa || rowEmp.toLowerCase() === targetEmpresa.toLowerCase()) && (!targetProyecto || rowProj.toLowerCase() === targetProyecto.toLowerCase())) {
          let membersList = [];
          if (obj.miembros) {
            membersList = String(obj.miembros).split(',').map(m => m.trim()).filter(Boolean);
          }
          teams.push({
            name: obj.nombreequipo || '',
            empresa: rowEmp,
            proyecto: rowProj,
            members: membersList,
            fecha: obj.fecha || ''
          });
        }
      }
      return ContentService.createTextOutput(JSON.stringify(teams)).setMimeType(ContentService.MimeType.JSON);
      
    } else {
      const sheet = doc.getSheetByName('Usuarios');
      if (!sheet) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
      ensureHeaders(sheet, USER_HEADERS);
      
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim());
      const usuarios = [];
      
      for (let i = 1; i < data.length; i++) {
        let obj = {};
        for (let j = 0; j < headers.length; j++) {
          obj[headers[j]] = data[i][j];
        }
        usuarios.push(obj);
      }
      try { putCacheJson_('usuarios.json', JSON.stringify(usuarios), 180); } catch (cacheErr) {}
      return ContentService.createTextOutput(JSON.stringify(usuarios)).setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function autorizarDrive() {
  const root = DriveApp.getFolderById("1aWUNnLgjWBkA6wdCM99XMY9SU7eSDP-H");
  const temp = root.createFolder("TEMPORAL_BORRAR_LUEGO");
  temp.setTrashed(true);
}

// Ejecutar una vez desde el editor de Apps Script tras incorporar la carga reanudable.
// Solicita el permiso externo requerido por UrlFetchApp para enviar fragmentos a Drive.
function autorizarCargaReanudable() {
  UrlFetchApp.fetch('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest', {
    method: 'get',
    muteHttpExceptions: true
  });
}

function output_(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function findFolderRecursively(parentFolder, targetName) {
  const cleanTarget = String(targetName).trim().toLowerCase();
  
  // Try exact/case-insensitive match in current folder
  const subFolders = parentFolder.getFolders();
  const list = [];
  while (subFolders.hasNext()) {
    const sub = subFolders.next();
    const name = sub.getName().trim().toLowerCase();
    if (name === cleanTarget) {
      return sub;
    }
    list.push(sub);
  }
  
  // Recursively search subfolders
  for (let i = 0; i < list.length; i++) {
    const found = findFolderRecursively(list[i], targetName);
    if (found) return found;
  }
  
  return null;
}

function resolveProjectRootFolder_(folderId, project, driveFolderName) {
  var root = null;
  var fid = String(folderId || '').trim();
  if (fid && fid !== 'undefined' && fid !== 'null') {
    try {
      root = DriveApp.getFolderById(fid);
    } catch (eF) {
      root = null;
    }
  }
  if (!root || fid === DRIVE_ROOT_FOLDER_ID || fid === '1fn1umYzIYsxymmwbmap6YbjTB33XJrG8' || fid === '1aWUNnLgjWBkA6wdCM99XMY9SU7eSDP-H') {
    try {
      var base = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
      var target = findProjectFolderRecursively(base, project, driveFolderName);
      if (target) root = target;
      else if (!root) root = base;
    } catch (eR) {
      if (!root) {
        try {
          root = DriveApp.getRootFolder();
        } catch (eRoot) {}
      }
    }
  }
  return root;
}

function listModels_(e, body) {
  let folderId = String(((body && body.folderId) || (e && e.parameter && e.parameter.folderId) || DRIVE_ROOT_FOLDER_ID) ?? '').trim();
  if (!folderId) return { error: 'Falta folderId' };
  const driveFolderName = String(((body && body.driveFolderName) || (e && e.parameter && e.parameter.driveFolderName) || '') ?? '').trim();
  const projectSlug = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
  
  let root = resolveProjectRootFolder_(folderId, projectSlug, driveFolderName);
  
  // Dynamic resolution if we are at the root level or default
  if (folderId === '1aWUNnLgjWBkA6wdCM99XMY9SU7eSDP-H' || folderId === '1fn1umYzIYsxymmwbmap6YbjTB33XJrG8') {
    const driveFolderName = String(((body && body.driveFolderName) || (e && e.parameter && e.parameter.driveFolderName) || '') ?? '').trim();
    const projectSlug = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
    
    let targetFolder = findProjectFolderRecursively(root, projectSlug, driveFolderName);
    
    if (targetFolder) {
      root = targetFolder;
    } else if (driveFolderName || projectSlug) {
      return { models: [], dwgs: [], pdfs: [] };
    }
  }

  const frags = [];
  const jsonByBase = {};
  const dwgs = [];
  const pdfs = [];
  const allModels = []; // All 3D file types combined

  const normalizeBase_ = (name) => String(name || '').trim().toLowerCase();

  // List of all supported 3D file extensions (case-insensitive)
  const SUPPORTED_EXTENSIONS = [
    '.frag', '.ifc', '.json', '.landxml', '.citygml',
    '.rvt', '.rfa', '.rte', '.pln', '.pla', '.mod',
    '.imodel', '.vwx', '.ndw', '.cyp',
    '.nwc', '.nwf', '.nwd', '.smc',
    '.e57', '.pts', '.xyz', '.las', '.laz',
    '.rcp', '.rcs', '.dwg', '.dxf'
  ];

  const isSupportedFile_ = (filename) => {
    const lower = String(filename || '').toLowerCase();
    return SUPPORTED_EXTENSIONS.some(ext => lower.endsWith(ext));
  };

  const getFileExtension_ = (filename) => {
    const lower = String(filename || '').toLowerCase();
    for (const ext of SUPPORTED_EXTENSIONS) {
      if (lower.endsWith(ext)) return ext;
    }
    return '';
  };

  const walk_ = (folder, currentRelativePath) => {
    const it = folder.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      const name = f.getName();
      const lower = String(name).toLowerCase();
      const fileId = f.getId();
      const lastUpdated = f.getLastUpdated().toISOString();

      let ownerEmail = '';
      let ownerName = '';
      try {
        const owner = f.getOwner();
        if (owner) {
          ownerEmail = owner.getEmail() || '';
          ownerName = owner.getName() || '';
        }
      } catch (e) {
        // ignore
      }

      if (lower.endsWith('.frag')) {
        frags.push({ 
          name: name, 
          fragId: fileId, 
          folder: currentRelativePath || '',
          lastUpdated: lastUpdated,
          ownerEmail: ownerEmail,
          ownerName: ownerName
        });
        allModels.push({
          name: name,
          fileId: fileId,
          folder: currentRelativePath || '',
          lastUpdated: lastUpdated,
          extension: '.frag',
          ownerEmail: ownerEmail,
          ownerName: ownerName
        });
        continue;
      }

      if (lower.endsWith('.json')) {
        const base = normalizeBase_(name.slice(0, -5));
        jsonByBase[base] = fileId;
        allModels.push({
          name: name,
          fileId: fileId,
          folder: currentRelativePath || '',
          lastUpdated: lastUpdated,
          extension: '.json',
          ownerEmail: ownerEmail,
          ownerName: ownerName
        });
        continue;
      }

      if (lower.endsWith('.dwg') || lower.endsWith('.dxf')) {
        dwgs.push({ 
          name: name, 
          fileId: fileId, 
          folder: currentRelativePath || '',
          lastUpdated: lastUpdated,
          ownerEmail: ownerEmail,
          ownerName: ownerName
        });
        continue;
      }

      if (lower.endsWith('.pdf')) {
        pdfs.push({ 
          name: name, 
          fileId: fileId, 
          folder: currentRelativePath || '',
          lastUpdated: lastUpdated,
          ownerEmail: ownerEmail,
          ownerName: ownerName
        });
        continue;
      }

      // Check for other supported 3D file types
      if (isSupportedFile_(name)) {
        const ext = getFileExtension_(name);
        allModels.push({
          name: name,
          fileId: fileId,
          folder: currentRelativePath || '',
          lastUpdated: lastUpdated,
          extension: ext,
          ownerEmail: ownerEmail,
          ownerName: ownerName
        });
      }
    }

    const sub = folder.getFolders();
    while (sub.hasNext()) {
      const subFolder = sub.next();
      const sName = subFolder.getName();
      // Skip hidden / internal system directories like .estados, .versiones
      if (sName.startsWith('.')) {
        continue;
      }
      const nextRelativePath = currentRelativePath 
        ? currentRelativePath + '/' + sName 
        : sName;
      walk_(subFolder, nextRelativePath);
    }
  };

  walk_(root, '');

  // Helper to deduplicate files by path + name so only the latest/current active version is returned
  const dedupeByLatest_ = function(list) {
    const map = {};
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const key = ((item.folder ? item.folder + '/' : '') + String(item.name || '').toLowerCase()).trim();
      if (!map[key] || new Date(item.lastUpdated).getTime() > new Date(map[key].lastUpdated).getTime()) {
        map[key] = item;
      }
    }
    const result = [];
    for (let k in map) {
      if (map.hasOwnProperty(k)) {
        result.push(map[k]);
      }
    }
    return result;
  };

  const uniqueFrags = dedupeByLatest_(frags);
  const uniqueDwgs = dedupeByLatest_(dwgs);
  const uniquePdfs = dedupeByLatest_(pdfs);

  const models = uniqueFrags
    .map((m) => {
      const base = normalizeBase_(m.name.slice(0, -5));
      const jsonId = jsonByBase[base] || null;
      return { 
        name: m.name, 
        fragId: m.fragId, 
        jsonId: jsonId, 
        folder: m.folder,
        lastUpdated: m.lastUpdated,
        ownerEmail: m.ownerEmail,
        ownerName: m.ownerName
      };
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));

  const sortedDwgs = uniqueDwgs.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
  const sortedPdfs = uniquePdfs.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));

  // Deduplicate and format all 3D models for unified display
  const dedupeAllModels_ = function(list) {
    const map = {};
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const key = ((item.folder ? item.folder + '/' : '') + String(item.name || '').toLowerCase()).trim();
      if (!map[key] || new Date(item.lastUpdated).getTime() > new Date(map[key].lastUpdated).getTime()) {
        map[key] = item;
      }
    }
    const result = [];
    for (let k in map) {
      if (map.hasOwnProperty(k)) {
        result.push(map[k]);
      }
    }
    return result;
  };

  const uniqueAllModels = dedupeAllModels_(allModels).sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
  
  return { 
    models: models,
    dwgs: sortedDwgs,
    pdfs: sortedPdfs,
    // Includes every supported 3D/geospatial/point-cloud source with its Drive id.
    allModels: uniqueAllModels
  };
}

function chunkFile_(e, body) {
  const id = String(((body && body.id) || (e && e.parameter && e.parameter.id) || '') ?? '').trim();
  if (!id) return { error: 'Falta id' };

  const offset = Math.max(0, Number(((body && body.offset) || (e && e.parameter && e.parameter.offset) || 0) ?? 0) || 0);
  const limit = Math.min(
    2 * 1024 * 1024,
    Math.max(1, Number(((body && body.limit) || (e && e.parameter && e.parameter.limit) || (2 * 1024 * 1024)) ?? (2 * 1024 * 1024)) || (2 * 1024 * 1024)),
  );

  const file = DriveApp.getFileById(id);
  const bytes = file.getBlob().getBytes();
  const total = bytes.length;

  const end = Math.min(total, offset + limit);
  const slice = bytes.slice(offset, end);

  const nextOffset = end;
  const done = nextOffset >= total;

  return {
    total: total,
    nextOffset: nextOffset,
    done: done,
    data: Utilities.base64Encode(slice)
  };
}

function textFile_(e, body) {
  const id = String(((body && body.id) || (e && e.parameter && e.parameter.id) || '') ?? '').trim();
  if (!id) return { error: 'Falta id' };

  const file = DriveApp.getFileById(id);
  const text = file.getBlob().getDataAsString('UTF-8');
  return { text: text };
}

function resolveUploadFolder_(e, body) {
  let folderId = String(((body && body.folderId) || (e && e.parameter && e.parameter.folderId) || DRIVE_ROOT_FOLDER_ID) ?? '').trim();
  if (!folderId) throw new Error('Falta folderId');
  const driveFolderName = String(((body && body.driveFolderName) || (e && e.parameter && e.parameter.driveFolderName) || '') ?? '').trim();
  const projectSlug = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
  let root = resolveProjectRootFolder_(folderId, projectSlug, driveFolderName);
  if (folderId === DRIVE_ROOT_FOLDER_ID || folderId === '1fn1umYzIYsxymmwbmap6YbjTB33XJrG8') {
    const driveFolderName = String(((body && body.driveFolderName) || (e && e.parameter && e.parameter.driveFolderName) || '') ?? '').trim();
    const projectSlug = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
    const targetFolder = findProjectFolderRecursively(root, projectSlug, driveFolderName);
    if (targetFolder) root = targetFolder;
  }
  return root;
}

function initResumableUpload_(e, body) {
  const filename = String((body && body.filename) || '').trim();
  const contentType = String((body && body.contentType) || 'application/octet-stream').trim();
  const totalBytes = Number((body && body.totalBytes) || 0);
  if (!filename || !totalBytes) return { status: 'error', message: 'Faltan nombre o tamaño del archivo.' };

  try {
    const folder = resolveUploadFolder_(e, body);
    const token = ScriptApp.getOAuthToken();
    const response = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + token,
        'X-Upload-Content-Type': contentType,
        'X-Upload-Content-Length': String(totalBytes)
      },
      payload: JSON.stringify({ name: filename, parents: [folder.getId()], mimeType: contentType }),
      muteHttpExceptions: true
    });
    const status = response.getResponseCode();
    const headers = response.getAllHeaders();
    const sessionUrl = headers.Location || headers.location;
    if ((status < 200 || status >= 300) || !sessionUrl) {
      return { status: 'error', message: 'No se pudo iniciar la carga reanudable: ' + status + ' ' + response.getContentText() };
    }
    return { status: 'success', sessionUrl: sessionUrl };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function uploadResumableChunk_(e, body) {
  const sessionUrl = String((body && body.sessionUrl) || '').trim();
  const content = String((body && body.content) || '').replace(/[\s\n\r]/g, '');
  const start = Number((body && body.start) || 0);
  const totalBytes = Number((body && body.totalBytes) || 0);
  const contentType = String((body && body.contentType) || 'application/octet-stream').trim();
  if (!sessionUrl || !content || !totalBytes) return { status: 'error', message: 'Fragmento de carga incompleto.' };

  try {
    const bytes = Utilities.base64Decode(content);
    const end = start + bytes.length - 1;
    const response = UrlFetchApp.fetch(sessionUrl, {
      method: 'put',
      contentType: contentType,
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
        'Content-Range': 'bytes ' + start + '-' + end + '/' + totalBytes
      },
      payload: Utilities.newBlob(bytes, contentType),
      muteHttpExceptions: true
    });
    const code = response.getResponseCode();
    if (code !== 308 && (code < 200 || code >= 300)) {
      return { status: 'error', message: 'Drive rechazó el fragmento: ' + code + ' ' + response.getContentText() };
    }

    const complete = code >= 200 && code < 300;
    let fileId = '';
    if (complete) {
      try { fileId = JSON.parse(response.getContentText()).id || ''; } catch (ignore) {}
      if (fileId) {
        try {
          const targetFolder = resolveUploadFolder_(e, body);
          const existingFiles = targetFolder.getFilesByName(String(body.filename || '').trim());
          while (existingFiles.hasNext()) {
            const extFile = existingFiles.next();
            if (extFile.getId() !== fileId) {
              extFile.setTrashed(true);
            }
          }
        } catch (trashErr) {
          // non-fatal
        }
        try {
          if (!body.skipStatusRegister) {
            registerFileStatus_(fileId, String(body.jsonId || ''), String(body.filename || ''), String(body.project || ''), 'EN_PROGRESO', String(body.changedBy || ''), String(body.changedByEmail || ''), String(body.originalFileId || fileId), String(body.fileType || ''), String(body.version || ''), String(body.comments || ''), body.deliveryTeams);
          }
        } catch (statusErr) {
          // Trash the completed file to avoid orphaning it in Drive
          try {
            DriveApp.getFileById(fileId).setTrashed(true);
          } catch (trashErr) {}
          return { status: 'error', message: 'No se pudo registrar el estado en el Spreadsheet: ' + statusErr.toString() };
        }
      }
    }
    return { status: 'success', complete: complete, nextOffset: end + 1, fileId: fileId };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function uploadFile_(e, body) {
  let folderId = String(((body && body.folderId) || (e && e.parameter && e.parameter.folderId) || DRIVE_ROOT_FOLDER_ID) ?? '').trim();
  if (!folderId) return { error: 'Falta folderId' };
  const driveFolderName = String(((body && body.driveFolderName) || (e && e.parameter && e.parameter.driveFolderName) || '') ?? '').trim();
  const projectSlug = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
  
  let root = resolveProjectRootFolder_(folderId, projectSlug, driveFolderName);
  
  // Dynamic resolution if we are at the root level or default
  if (folderId === '1aWUNnLgjWBkA6wdCM99XMY9SU7eSDP-H' || folderId === '1fn1umYzIYsxymmwbmap6YbjTB33XJrG8') {
    const driveFolderName = String(((body && body.driveFolderName) || (e && e.parameter && e.parameter.driveFolderName) || '') ?? '').trim();
    const projectSlug = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
    
    let targetFolder = findProjectFolderRecursively(root, projectSlug, driveFolderName);
    if (targetFolder) {
      root = targetFolder;
    }
  }
  
  const filename = String(((body && body.filename) || (e && e.parameter && e.parameter.filename) || '') ?? '').trim();
  if (!filename) return { error: 'Falta filename' };
  
  // Strip whitespace and newlines from base64 content (browsers can inject them)
  const rawContent = String(((body && body.content) || (e && e.parameter && e.parameter.content) || '') ?? '');
  const content = rawContent.replace(/[\s\n\r]/g, '');
  if (!content) return { error: 'Falta content' };
  
  const contentType = String(((body && body.contentType) || (e && e.parameter && e.parameter.contentType) || 'application/octet-stream') ?? '').trim();
  
  let newFileId;
  try {
    // Trash existing files with the same name to avoid duplicates
    const existingFiles = root.getFilesByName(filename);
    while (existingFiles.hasNext()) {
      existingFiles.next().setTrashed(true);
    }
    
    // Create new file
    const decoded = Utilities.base64Decode(content);
    const blob = Utilities.newBlob(decoded, contentType, filename);
    const file = root.createFile(blob);
    newFileId = file.getId();
  } catch (createErr) {
    return { status: 'error', message: 'No se pudo crear el archivo en Drive: ' + createErr.toString() };
  }

  try {
    const project = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
    const changedBy = String(((body && body.changedBy) || (e && e.parameter && e.parameter.changedBy) || '') ?? '').trim();
    const changedByEmail = String(((body && body.changedByEmail) || (e && e.parameter && e.parameter.changedByEmail) || '') ?? '').trim();
    const fileType = String(((body && body.fileType) || (e && e.parameter && e.parameter.fileType) || '') ?? '').trim();
    const jsonId = String(((body && body.jsonId) || (e && e.parameter && e.parameter.jsonId) || '') ?? '').trim();
    if (project) {
      registerFileStatus_(newFileId, jsonId, filename, project, 'EN_PROGRESO', changedBy, changedByEmail, newFileId, fileType, '', '', body && body.deliveryTeams);
    }
  } catch(statusErr) {
    // Trash the uploaded file to avoid orphaning it in Drive
    try {
      if (newFileId) {
        DriveApp.getFileById(newFileId).setTrashed(true);
      }
    } catch (trashErr) {}
    return { status: 'error', message: 'No se pudo registrar el estado en el Spreadsheet: ' + statusErr.toString() };
  }

  return { status: 'success', fileId: newFileId, name: filename };
}

function registerFileStatus_(fileId, jsonId, filename, project, status, changedBy, changedByEmail, originalFileId, type, version, comments, deliveryTeams) {
  let doc;
  try {
    doc = SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (err) {
    doc = SpreadsheetApp.getActiveSpreadsheet();
  }
  if (!doc) {
    throw new Error("No se pudo abrir la hoja de cálculo de configuración (ID: " + SPREADSHEET_ID + "). Verifica que el script de Google tenga permisos y que la hoja exista.");
  }
  let sheet = doc.getSheetByName('EstadosArchivos');
  if (!sheet) sheet = doc.insertSheet('EstadosArchivos');
  ensureHeaders(sheet, FILE_STATUS_HEADERS);
  const rowId = 'sr-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
  const now = new Date().toISOString();
  const rowData = FILE_STATUS_HEADERS.map(function(h) {
    if (h === 'rowId') return rowId;
    if (h === 'fecha') return now;
    if (h === 'fileId') return fileId || '';
    if (h === 'jsonId') return jsonId || '';
    if (h === 'filename') return filename || '';
    if (h === 'project') return project || '';
    if (h === 'status') return status || 'EN_PROGRESO';
    if (h === 'changedAt') return now;
    if (h === 'changedBy') return changedBy || '';
    if (h === 'changedByEmail') return changedByEmail || '';
    if (h === 'originalFileId') return originalFileId || fileId || '';
    if (h === 'type') return type || '';
    if (h === 'version') return version || 'v1.0';
    if (h === 'comments') return comments || '';
    if (h === 'deliveryTeams') return serializeDeliveryTeams_(deliveryTeams);
    return '';
  });
  sheet.appendRow(rowData);
  return rowId;
}

function listStatus_(e, body) {
  const project = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
  let doc;
  try { doc = SpreadsheetApp.openById(SPREADSHEET_ID); } catch (err) { doc = SpreadsheetApp.getActiveSpreadsheet(); }
  const sheet = doc.getSheetByName('EstadosArchivos');
  if (!sheet || sheet.getLastRow() <= 1) return { entries: [] };
  ensureHeaders(sheet, FILE_STATUS_HEADERS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).trim(); });
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const idx = {};
  FILE_STATUS_HEADERS.forEach(function(h) { idx[h] = headers.indexOf(h); });
  const entries = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var rowProject = String(row[idx['project']] || '').trim();
    if (project && rowProject !== project) continue;
    var changedAt = row[idx['changedAt']];
    entries.push({
      rowId: String(row[idx['rowId']] || '').trim(),
      fileId: String(row[idx['fileId']] || '').trim(),
      jsonId: String(row[idx['jsonId']] || '').trim(),
      filename: String(row[idx['filename']] || '').trim(),
      project: rowProject,
      status: String(row[idx['status']] || 'EN_PROGRESO').trim(),
      changedAt: (changedAt instanceof Date) ? changedAt.toISOString() : String(changedAt || ''),
      changedBy: String(row[idx['changedBy']] || '').trim(),
      changedByEmail: String(row[idx['changedByEmail']] || '').trim(),
      originalFileId: String(row[idx['originalFileId']] || '').trim(),
      type: String(row[idx['type']] || '').trim(),
      version: String(row[idx['version']] || 'v1.0').trim(),
      comments: String(row[idx['comments']] || '').trim(),
      deliveryTeams: String(row[idx['deliveryTeams']] || '').trim()
    });
  }
  return { entries: entries };
}

function changeFileStatus_(e, body) {
  const fileId = String(((body && body.fileId) || (e && e.parameter && e.parameter.fileId) || '') ?? '').trim();
  const jsonId = String(((body && body.jsonId) || (e && e.parameter && e.parameter.jsonId) || '') ?? '').trim();
  const filename = String(((body && body.filename) || (e && e.parameter && e.parameter.filename) || '') ?? '').trim();
  const newStatus = String(((body && body.newStatus) || (e && e.parameter && e.parameter.newStatus) || '') ?? '').trim().toUpperCase();
  const project = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
  var folderId = String(((body && body.folderId) || (e && e.parameter && e.parameter.folderId) || DRIVE_ROOT_FOLDER_ID) ?? '').trim();
  const driveFolderName = String(((body && body.driveFolderName) || (e && e.parameter && e.parameter.driveFolderName) || '') ?? '').trim();
  const originalFileId = String(((body && body.originalFileId) || (e && e.parameter && e.parameter.originalFileId) || fileId) ?? '').trim();
  const type = String(((body && body.type) || (e && e.parameter && e.parameter.type) || '') ?? '').trim();
  const changedBy = String(((body && body.changedBy) || (e && e.parameter && e.parameter.changedBy) || '') ?? '').trim();
  const changedByEmail = String(((body && body.changedByEmail) || (e && e.parameter && e.parameter.changedByEmail) || '') ?? '').trim();
  const version = String(((body && body.version) || (e && e.parameter && e.parameter.version) || 'v1.0') ?? '').trim();
  const comments = String(((body && body.comments) || (e && e.parameter && e.parameter.comments) || ('Promovido a ' + newStatus)) ?? '').trim();
  const deliveryTeams = (body && body.deliveryTeams) || (e && e.parameter && e.parameter.deliveryTeams) || '';

  if (!fileId) return { status: 'error', message: 'Falta fileId' };
  if (['COMPARTIDO', 'PUBLICADO'].indexOf(newStatus) === -1) return { status: 'error', message: 'Estado invalido' };

  try {
    var root = resolveProjectRootFolder_(folderId, project, driveFolderName);
    if (folderId === DRIVE_ROOT_FOLDER_ID || folderId === '1fn1umYzIYsxymmwbmap6YbjTB33XJrG8') {
      var targetFolder = findProjectFolderRecursively(root, project, driveFolderName);
      if (targetFolder) root = targetFolder;
    }
    // Get/create .estados/{status} subfolder
    var estadosFolder;
    var ef = root.getFoldersByName('.estados');
    estadosFolder = ef.hasNext() ? ef.next() : root.createFolder('.estados');
    var subFolderName = newStatus.toLowerCase();
    var sf = estadosFolder.getFoldersByName(subFolderName);
    var subFolder = sf.hasNext() ? sf.next() : estadosFolder.createFolder(subFolderName);
    // Copy main file
    var sourceFile = DriveApp.getFileById(fileId);
    var copiedFile = sourceFile.makeCopy(filename, subFolder);
    var copiedFileId = copiedFile.getId();
    // Copy json if present
    var copiedJsonId = '';
    if (jsonId) {
      try {
        var sourceJson = DriveApp.getFileById(jsonId);
        var jsonFilename = filename.replace(/\.frag$/i, '.json');
        copiedJsonId = sourceJson.makeCopy(jsonFilename, subFolder).getId();
      } catch(je) { /* non-fatal */ }
    }
    var now = new Date().toISOString();
    registerFileStatus_(copiedFileId, copiedJsonId, filename, project, newStatus, changedBy, changedByEmail, originalFileId, type, version, comments, deliveryTeams);
    
    // Mark previous versions as not current in VersionesArchivos
    try {
      let doc;
      try { doc = SpreadsheetApp.openById(SPREADSHEET_ID); } catch (err) { doc = SpreadsheetApp.getActiveSpreadsheet(); }
      let vSheet = doc.getSheetByName('VersionesArchivos');
      if (!vSheet) vSheet = doc.insertSheet('VersionesArchivos');
      ensureHeaders(vSheet, FILE_VERSION_HEADERS);
      markPreviousVersionsNotCurrent_(vSheet, project, filename, originalFileId);

      const vId = 'ver-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
      const vRow = FILE_VERSION_HEADERS.map(function(h) {
        if (h === 'versionId') return vId;
        if (h === 'fecha') return now;
        if (h === 'fileId') return copiedFileId;
        if (h === 'jsonId') return copiedJsonId;
        if (h === 'filename') return filename;
        if (h === 'project') return project;
        if (h === 'status') return newStatus;
        if (h === 'version') return version;
        if (h === 'comments') return comments;
        if (h === 'createdBy') return changedBy;
        if (h === 'createdByEmail') return changedByEmail;
        if (h === 'originalFileId') return originalFileId;
        if (h === 'type') return type;
        if (h === 'isCurrent') return 'true';
        if (h === 'backupFileId') return copiedFileId;
        return '';
      });
      vSheet.appendRow(vRow);
    } catch(vErr) { /* non-fatal */ }

    return { status: 'success', newStatus: newStatus, copiedFileId: copiedFileId, copiedJsonId: copiedJsonId, filename: filename, changedAt: now, changedBy: changedBy, version: version };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function markPreviousVersionsNotCurrent_(vSheet, project, filename, originalFileId) {
  if (!vSheet || vSheet.getLastRow() <= 1) return;
  ensureHeaders(vSheet, FILE_VERSION_HEADERS);
  const headers = vSheet.getRange(1, 1, 1, vSheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).trim(); });
  const isCurrentIdx = headers.indexOf('isCurrent');
  const projectIdx = headers.indexOf('project');
  const filenameIdx = headers.indexOf('filename');
  const origIdIdx = headers.indexOf('originalFileId');
  if (isCurrentIdx === -1) return;

  const numRows = vSheet.getLastRow() - 1;
  const range = vSheet.getRange(2, 1, numRows, vSheet.getLastColumn());
  const values = range.getValues();
  let modified = false;

  var cleanP1 = project ? project.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  var f1 = filename ? filename.toLowerCase().trim() : '';

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowProj = String(row[projectIdx] || '').trim();
    const rowFile = String(row[filenameIdx] || '').trim().toLowerCase();
    const rowOrig = String(row[origIdIdx] || '').trim();

    var cleanP2 = rowProj.toLowerCase().replace(/[^a-z0-9]/g, '');
    var matchProj = (!project) || (!rowProj) || (cleanP1 === cleanP2) || (rowProj.toLowerCase() === project.toLowerCase());
    var matchFile = (f1 && rowFile === f1) || (originalFileId && rowOrig === originalFileId);

    if (matchProj && matchFile) {
      if (String(row[isCurrentIdx]).trim() === 'true') {
        values[i][isCurrentIdx] = 'false';
        modified = true;
      }
    }
  }

  if (modified) {
    range.setValues(values);
  }
}

function createVersion_(e, body) {
  const fileId = String(((body && body.fileId) || (e && e.parameter && e.parameter.fileId) || '') ?? '').trim();
  const jsonId = String(((body && body.jsonId) || (e && e.parameter && e.parameter.jsonId) || '') ?? '').trim();
  const filename = String(((body && body.filename) || (e && e.parameter && e.parameter.filename) || '') ?? '').trim();
  const project = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
  const status = String(((body && body.status) || (e && e.parameter && e.parameter.status) || 'EN_PROGRESO') ?? '').trim().toUpperCase();
  const version = String(((body && body.version) || (e && e.parameter && e.parameter.version) || 'v1.0') ?? '').trim();
  const comments = String(((body && body.comments) || (e && e.parameter && e.parameter.comments) || '') ?? '').trim();
  const createdBy = String(((body && body.changedBy) || (body && body.createdBy) || (e && e.parameter && e.parameter.changedBy) || '') ?? '').trim();
  const createdByEmail = String(((body && body.changedByEmail) || (body && body.createdByEmail) || (e && e.parameter && e.parameter.changedByEmail) || '') ?? '').trim();
  const originalFileId = String(((body && body.originalFileId) || (e && e.parameter && e.parameter.originalFileId) || fileId) ?? '').trim();
  const type = String(((body && body.type) || (e && e.parameter && e.parameter.type) || '') ?? '').trim();
  var folderId = String(((body && body.folderId) || (e && e.parameter && e.parameter.folderId) || DRIVE_ROOT_FOLDER_ID) ?? '').trim();
  const driveFolderName = String(((body && body.driveFolderName) || (e && e.parameter && e.parameter.driveFolderName) || '') ?? '').trim();
  
  // Optional new file upload content
  const content = String(((body && body.content) || (e && e.parameter && e.parameter.content) || '') ?? '').trim();
  const contentType = String(((body && body.contentType) || (e && e.parameter && e.parameter.contentType) || 'application/octet-stream') ?? '').trim();
  const uploadedFileId = String(((body && body.uploadedFileId) || (e && e.parameter && e.parameter.uploadedFileId) || '') ?? '').trim();

  if (!fileId && !content && !uploadedFileId) return { status: 'error', message: 'Falta fileId, contenido o ID del archivo cargado' };

  try {
    var root = resolveProjectRootFolder_(folderId, project, driveFolderName);
    if (folderId === DRIVE_ROOT_FOLDER_ID || folderId === '1fn1umYzIYsxymmwbmap6YbjTB33XJrG8') {
      var targetFolder = findProjectFolderRecursively(root, project, driveFolderName);
      if (targetFolder) root = targetFolder;
    }

    // Destination for backup: root/.versiones/{cleanFilename}/
    var cleanBaseName = filename.replace(/\.[^/.]+$/, "");
    var versionesFolder;
    var vf = root.getFoldersByName('.versiones');
    versionesFolder = vf.hasNext() ? vf.next() : root.createFolder('.versiones');
    
    var fileVersFolder;
    var fvf = versionesFolder.getFoldersByName(cleanBaseName);
    fileVersFolder = fvf.hasNext() ? fvf.next() : versionesFolder.createFolder(cleanBaseName);

    var backupFileId = '';
    var activeFileId = fileId;

    // 1. Copy the current file into the backup version folder
    if (fileId) {
      try {
        var sourceFile = DriveApp.getFileById(fileId);
        var backupName = version + '_' + filename;
        var backupFile = sourceFile.makeCopy(backupName, fileVersFolder);
        backupFileId = backupFile.getId();
      } catch (be) { /* non-fatal */ }
    }

    // 2. If an already uploaded file ID is provided, use it, otherwise check content
    var destFolder = root;
    if (status === 'COMPARTIDO' || status === 'PUBLICADO') {
      var ef = root.getFoldersByName('.estados');
      var estadosFolder = ef.hasNext() ? ef.next() : root.createFolder('.estados');
      var sf = estadosFolder.getFoldersByName(status.toLowerCase());
      destFolder = sf.hasNext() ? sf.next() : estadosFolder.createFolder(status.toLowerCase());
    }

    // Fallback: if backupFileId could not be obtained by fileId, search existing file in destFolder
    if (!backupFileId) {
      try {
        var existingForBackup = destFolder.getFilesByName(filename);
        while (existingForBackup.hasNext()) {
          var cand = existingForBackup.next();
          if (cand.getId() !== uploadedFileId) {
            var backupName = version + '_' + filename;
            var backupFile = cand.makeCopy(backupName, fileVersFolder);
            backupFileId = backupFile.getId();
            break;
          }
        }
      } catch (beFallback) {}
    }

    if (uploadedFileId) {
      activeFileId = uploadedFileId;

      // Ensure the file is in the destFolder
      try {
        var fileToMove = DriveApp.getFileById(uploadedFileId);
        var parents = fileToMove.getParents();
        var alreadyInDest = false;
        while (parents.hasNext()) {
          if (parents.next().getId() === destFolder.getId()) {
            alreadyInDest = true;
            break;
          }
        }
        if (!alreadyInDest) {
          destFolder.addFile(fileToMove);
          try {
            root.removeFile(fileToMove);
          } catch (e) {}
        }
        try { fileToMove.setName(filename); } catch (eName) {}
      } catch (moveErr) {}

      // Trash older copies in destFolder
      var existing = destFolder.getFilesByName(filename);
      while (existing.hasNext()) {
        var oldF = existing.next();
        if (oldF.getId() !== backupFileId && oldF.getId() !== activeFileId) {
          oldF.setTrashed(true);
        }
      }
    } else if (content) {
      var existing = destFolder.getFilesByName(filename);
      while (existing.hasNext()) {
        var oldF = existing.next();
        if (oldF.getId() !== backupFileId) {
          oldF.setTrashed(true);
        }
      }

      const decoded = Utilities.base64Decode(content);
      const blob = Utilities.newBlob(decoded, contentType, filename);
      const newActive = destFolder.createFile(blob);
      activeFileId = newActive.getId();
    }

    // 3. Register in VersionesArchivos
    let doc;
    try { doc = SpreadsheetApp.openById(SPREADSHEET_ID); } catch (err) { doc = SpreadsheetApp.getActiveSpreadsheet(); }
    let vSheet = doc.getSheetByName('VersionesArchivos');
    if (!vSheet) vSheet = doc.insertSheet('VersionesArchivos');
    ensureHeaders(vSheet, FILE_VERSION_HEADERS);

    // Check if any version already existed for this file in VersionesArchivos
    var hasPriorVersions = false;
    if (vSheet.getLastRow() > 1) {
      var existingData = vSheet.getRange(2, 1, vSheet.getLastRow() - 1, vSheet.getLastColumn()).getValues();
      var fIdx = FILE_VERSION_HEADERS.indexOf('filename');
      var pIdx = FILE_VERSION_HEADERS.indexOf('project');
      var oIdx = FILE_VERSION_HEADERS.indexOf('originalFileId');
      for (var k = 0; k < existingData.length; k++) {
        var rF = String(existingData[k][fIdx] || '').trim().toLowerCase();
        var rP = String(existingData[k][pIdx] || '').trim().toLowerCase();
        var rO = String(existingData[k][oIdx] || '').trim();
        if ((!project || rP === project.toLowerCase()) && (rF === filename.toLowerCase() || (originalFileId && rO === originalFileId))) {
          hasPriorVersions = true;
          break;
        }
      }
    }

    // If this is the first replacement (e.g. moving from v1.0 to v1.1),
    // record the base v1.0 version as an initial history entry
    if (!hasPriorVersions && (backupFileId || fileId)) {
      var baseVersionId = 'ver-' + (Date.now() - 2000) + '-' + Math.floor(Math.random() * 9999);
      var baseRow = FILE_VERSION_HEADERS.map(function(h) {
        if (h === 'versionId') return baseVersionId;
        if (h === 'fecha') return new Date(Date.now() - 2000).toISOString();
        if (h === 'fileId') return fileId || backupFileId;
        if (h === 'jsonId') return jsonId || '';
        if (h === 'filename') return filename || '';
        if (h === 'project') return project || '';
        if (h === 'status') return status || 'EN_PROGRESO';
        if (h === 'version') return 'v1.0';
        if (h === 'comments') return 'Versión inicial';
        if (h === 'createdBy') return createdBy || 'CDE NORA';
        if (h === 'createdByEmail') return createdByEmail || '';
        if (h === 'originalFileId') return originalFileId || fileId || '';
        if (h === 'type') return type || '';
        if (h === 'isCurrent') return 'false';
        if (h === 'backupFileId') return backupFileId || fileId || '';
        return '';
      });
      vSheet.appendRow(baseRow);
    }

    markPreviousVersionsNotCurrent_(vSheet, project, filename, originalFileId);

    const versionId = 'ver-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
    const now = new Date().toISOString();

    const rowData = FILE_VERSION_HEADERS.map(function(h) {
      if (h === 'versionId') return versionId;
      if (h === 'fecha') return now;
      if (h === 'fileId') return activeFileId || '';
      if (h === 'jsonId') return jsonId || '';
      if (h === 'filename') return filename || '';
      if (h === 'project') return project || '';
      if (h === 'status') return status || 'EN_PROGRESO';
      if (h === 'version') return version || 'v1.0';
      if (h === 'comments') return comments || '';
      if (h === 'createdBy') return createdBy || '';
      if (h === 'createdByEmail') return createdByEmail || '';
      if (h === 'originalFileId') return originalFileId || activeFileId || '';
      if (h === 'type') return type || '';
      if (h === 'isCurrent') return 'true';
      if (h === 'backupFileId') return backupFileId || activeFileId || '';
      return '';
    });
    vSheet.appendRow(rowData);

    // Also register state in EstadosArchivos
    registerFileStatus_(activeFileId, jsonId, filename, project, status, createdBy, createdByEmail, originalFileId, type, version, comments);

    return {
      status: 'success',
      versionId: versionId,
      version: version,
      fileId: activeFileId,
      backupFileId: backupFileId,
      comments: comments,
      createdAt: now
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function listVersions_(e, body) {
  const project = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
  const projectName = String(((body && body.projectName) || (e && e.parameter && e.parameter.projectName) || '') ?? '').trim();
  const filename = String(((body && body.filename) || (e && e.parameter && e.parameter.filename) || '') ?? '').trim();
  const originalFileId = String(((body && body.originalFileId) || (e && e.parameter && e.parameter.originalFileId) || '') ?? '').trim();

  let doc;
  try { doc = SpreadsheetApp.openById(SPREADSHEET_ID); } catch (err) { doc = SpreadsheetApp.getActiveSpreadsheet(); }
  const sheet = doc.getSheetByName('VersionesArchivos');
  if (!sheet || sheet.getLastRow() <= 1) return { versions: [] };
  ensureHeaders(sheet, FILE_VERSION_HEADERS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).trim(); });
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const idx = {};
  FILE_VERSION_HEADERS.forEach(function(h) { idx[h] = headers.indexOf(h); });

  const cleanP1 = project ? project.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const cleanPName = projectName ? projectName.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const f1 = filename ? filename.toLowerCase().trim() : '';

  const versions = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var rowProject = String(row[idx['project']] || '').trim();
    if (project && rowProject) {
      var cleanP2 = rowProject.toLowerCase().replace(/[^a-z0-9]/g, '');
      var matchP = (!cleanP1) || (!cleanP2) || (cleanP1 === cleanP2) || (cleanPName && cleanPName === cleanP2) ||
                   (rowProject.toLowerCase() === project.toLowerCase()) ||
                   (projectName && rowProject.toLowerCase() === projectName.toLowerCase());
      if (!matchP) {
        continue;
      }
    }

    var rowFilename = String(row[idx['filename']] || '').trim();
    var rowOrigId = String(row[idx['originalFileId']] || '').trim();
    var rowFileId = String(row[idx['fileId']] || '').trim();

    var matchFile = f1 && (rowFilename.toLowerCase().trim() === f1);
    var matchId = originalFileId && (rowOrigId === originalFileId || rowFileId === originalFileId);

    if (filename && !matchFile && !matchId) {
      continue;
    }

    var fecha = row[idx['fecha']];
    versions.push({
      versionId: String(row[idx['versionId']] || '').trim(),
      fecha: (fecha instanceof Date) ? fecha.toISOString() : String(fecha || ''),
      fileId: rowFileId,
      jsonId: String(row[idx['jsonId']] || '').trim(),
      filename: rowFilename,
      project: rowProject,
      status: String(row[idx['status']] || 'EN_PROGRESO').trim(),
      version: String(row[idx['version']] || 'v1.0').trim(),
      comments: String(row[idx['comments']] || '').trim(),
      createdBy: String(row[idx['createdBy']] || '').trim(),
      createdByEmail: String(row[idx['createdByEmail']] || '').trim(),
      originalFileId: rowOrigId,
      type: String(row[idx['type']] || '').trim(),
      isCurrent: String(row[idx['isCurrent']] || '').trim() === 'true',
      backupFileId: String(row[idx['backupFileId']] || rowFileId || '').trim()
    });
  }

  versions.sort(function(a, b) {
    return new Date(b.fecha) - new Date(a.fecha);
  });

  return { versions: versions };
}

function restoreVersion_(e, body) {
  const backupFileId = String(((body && body.backupFileId) || (e && e.parameter && e.parameter.backupFileId) || '') ?? '').trim();
  const filename = String(((body && body.filename) || (e && e.parameter && e.parameter.filename) || '') ?? '').trim();
  const targetVersion = String(((body && body.version) || (e && e.parameter && e.parameter.version) || '') ?? '').trim();
  const project = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
  const status = String(((body && body.status) || (e && e.parameter && e.parameter.status) || 'EN_PROGRESO') ?? '').trim().toUpperCase();
  var folderId = String(((body && body.folderId) || (e && e.parameter && e.parameter.folderId) || DRIVE_ROOT_FOLDER_ID) ?? '').trim();
  const driveFolderName = String(((body && body.driveFolderName) || (e && e.parameter && e.parameter.driveFolderName) || '') ?? '').trim();
  const originalFileId = String(((body && body.originalFileId) || (e && e.parameter && e.parameter.originalFileId) || '') ?? '').trim();
  const changedBy = String(((body && body.changedBy) || (e && e.parameter && e.parameter.changedBy) || '') ?? '').trim();
  const changedByEmail = String(((body && body.changedByEmail) || (e && e.parameter && e.parameter.changedByEmail) || '') ?? '').trim();
  const type = String(((body && body.type) || (e && e.parameter && e.parameter.type) || '') ?? '').trim();
  const deliveryTeams = (body && body.deliveryTeams) || (e && e.parameter && e.parameter.deliveryTeams) || '';

  if (!backupFileId) return { status: 'error', message: 'Falta backupFileId para restaurar' };

  try {
    var root = resolveProjectRootFolder_(folderId, project, driveFolderName);
    if (folderId === DRIVE_ROOT_FOLDER_ID || folderId === '1fn1umYzIYsxymmwbmap6YbjTB33XJrG8') {
      var targetFolder = findProjectFolderRecursively(root, project, driveFolderName);
      if (targetFolder) root = targetFolder;
    }

    var destFolder = root;
    if (status === 'COMPARTIDO' || status === 'PUBLICADO') {
      var ef = root.getFoldersByName('.estados');
      var estadosFolder = ef.hasNext() ? ef.next() : root.createFolder('.estados');
      var sf = estadosFolder.getFoldersByName(status.toLowerCase());
      destFolder = sf.hasNext() ? sf.next() : estadosFolder.createFolder(status.toLowerCase());
    }

    // Trash any existing active files with same name in destFolder to avoid duplicate file items in Drive
    var existing = destFolder.getFilesByName(filename);
    while (existing.hasNext()) {
      var oldF = existing.next();
      if (oldF.getId() !== backupFileId) {
        oldF.setTrashed(true);
      }
    }

    var backupFile = DriveApp.getFileById(backupFileId);
    var restoredCopy = backupFile.makeCopy(filename, destFolder);
    var newActiveFileId = restoredCopy.getId();

    var restoredVersionLabel = targetVersion ? (targetVersion + ' (Restaurada)') : 'Restaurada';
    var comment = 'Versión restaurada desde ' + targetVersion;

    let doc;
    try { doc = SpreadsheetApp.openById(SPREADSHEET_ID); } catch (err) { doc = SpreadsheetApp.getActiveSpreadsheet(); }
    let vSheet = doc.getSheetByName('VersionesArchivos');
    if (!vSheet) vSheet = doc.insertSheet('VersionesArchivos');
    ensureHeaders(vSheet, FILE_VERSION_HEADERS);

    markPreviousVersionsNotCurrent_(vSheet, project, filename, originalFileId);

    const newVersionId = 'ver-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
    const now = new Date().toISOString();

    const rowData = FILE_VERSION_HEADERS.map(function(h) {
      if (h === 'versionId') return newVersionId;
      if (h === 'fecha') return now;
      if (h === 'fileId') return newActiveFileId || '';
      if (h === 'jsonId') return '';
      if (h === 'filename') return filename || '';
      if (h === 'project') return project || '';
      if (h === 'status') return status || 'EN_PROGRESO';
      if (h === 'version') return restoredVersionLabel;
      if (h === 'comments') return comment;
      if (h === 'createdBy') return changedBy || '';
      if (h === 'createdByEmail') return changedByEmail || '';
      if (h === 'originalFileId') return originalFileId || newActiveFileId;
      if (h === 'type') return type || '';
      if (h === 'isCurrent') return 'true';
      if (h === 'backupFileId') return backupFileId;
      return '';
    });
    vSheet.appendRow(rowData);

    registerFileStatus_(newActiveFileId, '', filename, project, status, changedBy, changedByEmail, originalFileId || newActiveFileId, type, restoredVersionLabel, comment, deliveryTeams);

    return {
      status: 'success',
      restoredFileId: newActiveFileId,
      version: restoredVersionLabel,
      message: 'Versión restaurada con éxito.'
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function deleteFile_(e, body) {
  let fileIds = [];
  if (body && Array.isArray(body.fileIds)) {
    fileIds = body.fileIds.map(function(id) { return String(id || '').trim(); }).filter(Boolean);
  }
  
  const singleId = String(((body && (body.fileId || body.id)) || (e && e.parameter && (e.parameter.fileId || e.parameter.id))) ?? '').trim();
  if (singleId && fileIds.indexOf(singleId) === -1) {
    fileIds.push(singleId);
  }

  const fragId = String(((body && body.fragId) || (e && e.parameter && e.parameter.fragId)) ?? '').trim();
  const jsonId = String(((body && body.jsonId) || (e && e.parameter && e.parameter.jsonId)) ?? '').trim();
  if (fragId && fileIds.indexOf(fragId) === -1) fileIds.push(fragId);
  if (jsonId && fileIds.indexOf(jsonId) === -1) fileIds.push(jsonId);

  if (fileIds.length === 0) {
    return { status: 'error', message: 'Faltan IDs de archivo para eliminar.' };
  }

  const deleted = [];
  const errors = [];

  for (let i = 0; i < fileIds.length; i++) {
    const id = fileIds[i];
    try {
      const file = DriveApp.getFileById(id);
      const name = file.getName();
      file.setTrashed(true);
      deleted.push({ id: id, name: name });
    } catch (err) {
      errors.push({ id: id, error: err.toString() });
    }
  }

  if (deleted.length > 0) {
    return { status: 'success', message: 'Archivo(s) eliminado(s) exitosamente.', deleted: deleted, errors: errors };
  } else {
    return { status: 'error', message: 'No se pudo eliminar el archivo.', errors: errors };
  }
}

function wipeAndInitDatabase() {
  let doc;
  try {
    doc = SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (err) {
    doc = SpreadsheetApp.getActiveSpreadsheet();
  }
  
  // Clear Empresas
  let companySheet = doc.getSheetByName('Empresas');
  if (companySheet) {
    companySheet.clearContents();
    ensureHeaders(companySheet, COMPANY_HEADERS);
  }
  
  // Clear Usuarios and add the two superAdmins
  let userSheet = doc.getSheetByName('Usuarios');
  if (userSheet) {
    userSheet.clearContents();
    ensureHeaders(userSheet, USER_HEADERS);
    
    // Append the two super admins
    const uHeaders = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const fecha = new Date().toISOString();
    
    const admins = [
      { nombre: "Super Administrador", email: "mcmartinezg@unal.edu.co", rol: "SUPER_ADMINISTRADOR", estado: "APROBADO" },
      { nombre: "Super Administrador", email: "imagina3ddesign@gmail.com", rol: "SUPER_ADMINISTRADOR", estado: "APROBADO" }
    ];
    
    admins.forEach(admin => {
      const row = new Array(uHeaders.length).fill("");
      const setVal = (headerName, value) => {
        const idx = uHeaders.indexOf(headerName);
        if (idx !== -1) row[idx] = value;
      };
      setVal('fecha', fecha);
      setVal('nombre', admin.nombre);
      setVal('email', admin.email);
      setVal('rol', admin.rol);
      setVal('estado', admin.estado);
      userSheet.appendRow(row);
    });
  }
  
  Logger.log("Base de datos limpia e inicializada con los Super Administradores.");
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTROL Y REGISTRO DE WEBHOOKS WOMPI (PASARELA DE PAGOS)
// ─────────────────────────────────────────────────────────────────────────────
const WOMPI_HEADERS = ['fecha', 'transactionId', 'reference', 'status', 'amountInCents', 'currency', 'paymentMethod', 'customerEmail'];

function handleWompiWebhook_(e, data) {
  try {
    let doc;
    try {
      doc = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (err) {
      doc = SpreadsheetApp.getActiveSpreadsheet();
    }

    let sheet = doc.getSheetByName('TransaccionesWompi');
    if (!sheet) {
      sheet = doc.insertSheet('TransaccionesWompi');
    }
    ensureHeaders(sheet, WOMPI_HEADERS);

    const payload = data || {};
    const tx = (payload.data && payload.data.transaction) ? payload.data.transaction : payload;
    const fecha = new Date().toISOString();

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const row = new Array(headers.length).fill("");

    const setVal = (headerName, value) => {
      const idx = headers.indexOf(headerName);
      if (idx !== -1) row[idx] = value;
    };

    setVal('fecha', fecha);
    setVal('transactionId', tx.id || tx.transactionId || '');
    setVal('reference', tx.reference || '');
    setVal('status', tx.status || '');
    setVal('amountInCents', tx.amount_in_cents || tx.amountInCents || 0);
    setVal('currency', tx.currency || 'COP');
    setVal('paymentMethod', tx.payment_method_type || '');
    setVal('customerEmail', tx.customer_email || (tx.customer_data ? tx.customer_data.email : ''));

    sheet.appendRow(row);

    return {
      status: "success",
      message: "Notificación de transacción Wompi registrada correctamente",
      transactionId: tx.id || tx.reference
    };
  } catch (err) {
    return {
      status: "error",
      message: err.toString()
    };
  }
}