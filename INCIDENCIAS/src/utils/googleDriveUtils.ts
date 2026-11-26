/**
 * Google Drive integration utilities via secure Google Apps Script Gateway.
 * Everything is stored under INCIDENTS_DRIVE_FOLDER_ID (1-9SumRefiih81mc_eASsswy_W_U0-qe5) -> [Empresa] -> [Proyecto]
 */

interface DriveUploadResult {
  id: string;
  webViewLink: string;
  url: string;
}

export type StoredStructuralUnit = {
  id: string;
  name: string;
  levels: Array<{ id: string; name: string }>;
  spaces: Array<{ id: string; name: string; levelName?: string }>;
};

// Nora Google Apps Script Gateway (Shared Drive storage engine)
export const FILES_GATEWAY_URL = "https://script.google.com/macros/s/AKfycbx2RAQx_8K4o22xE0Mw-ETc7K_58vIoi6-PgVi64u80inuiw144ks3cgWSdCtXqIgB02g/exec";
export const INCIDENCES_CONFIG_SCRIPT_URL = import.meta.env.VITE_INCIDENCIAS_CONFIG_SCRIPT_URL?.trim() || FILES_GATEWAY_URL;
const APPS_SCRIPT_TIMEOUT_MS = 25_000;

export const INCIDENTS_DRIVE_FOLDER_ID = '1-9SumRefiih81mc_eASsswy_W_U0-qe5';

// Known Company ID -> Official Name mapping from empresas.json
const KNOWN_COMPANIES_MAP: Record<string, string> = {
  'empresa-1786128422720': 'Mesh Estudio SAS',
  'empresa-1786449580850': 'HIDROSANITARIO SAS',
  'empresa-1786449656145': 'ELECTRICOS SAS',
  'empresa-1793619605466': 'GLITCH',
  'EMPRESA_PRUEBA': 'Nueva Empresa'
};

export function registerCompanyName(companyId: string, companyName: string) {
  if (!companyId || !companyName) return;
  KNOWN_COMPANIES_MAP[companyId] = companyName.trim();
  try {
    const raw = localStorage.getItem('nora_companies_map');
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[companyId] = companyName.trim();
    localStorage.setItem('nora_companies_map', JSON.stringify(parsed));
  } catch (_) {}
}

export function getHumanCompanyAndProject(companyId: string, projectId: string): { companyName: string; projectName: string } {
  let companyName = companyId || 'Empresa';
  let projectName = projectId || 'Proyecto';

  // Specific hardcoded mappings for standard empresas & test projects
  if (companyId === 'empresa-1786449580850' || companyId?.includes('1786449580850')) {
    companyName = 'HIDROSANITARIO SAS';
  } else if (companyId === 'empresa-1786128422720') {
    companyName = 'Mesh Estudio SAS';
  } else if (companyId === 'empresa-1786449656145') {
    companyName = 'ELECTRICOS SAS';
  } else if (companyId === 'empresa-1793619605466') {
    companyName = 'GLITCH';
  }

  if (projectId === 'nuevo-proyecto-1794663364994' || projectId?.includes('1794663364994')) {
    projectName = 'PROYECTO PARA ENSAYOS DE HS';
  }

  try {
    // 1. Resolve Company Name by companyId (NEVER overwrite with logged-in user's personal company!)
    if (KNOWN_COMPANIES_MAP[companyId]) {
      companyName = KNOWN_COMPANIES_MAP[companyId];
    } else {
      const rawMap = localStorage.getItem('nora_companies_map');
      if (rawMap) {
        const parsedMap = JSON.parse(rawMap);
        if (parsedMap[companyId]) {
          companyName = parsedMap[companyId];
        }
      }
    }

    if (companyName === companyId) {
      const rawComp = sessionStorage.getItem('currentCompany') || localStorage.getItem('currentCompany');
      if (rawComp) {
        const c = JSON.parse(rawComp);
        if (c && (c.id === companyId || !companyId || companyId === 'default') && c.name && c.name.trim()) {
          companyName = c.name.trim();
          registerCompanyName(companyId, companyName);
        }
      }
    }

    // 2. Resolve Project Name
    const urlParams = new URLSearchParams(window.location.search);
    const driveFolderName = urlParams.get('driveFolderName');
    if (driveFolderName && driveFolderName.trim()) {
      projectName = decodeURIComponent(driveFolderName).replace(/\+/g, ' ').trim();
    } else {
      const rawProj = sessionStorage.getItem('activeProject') || localStorage.getItem('activeProject') || localStorage.getItem('cached_project_iso_data');
      if (rawProj) {
        const p = JSON.parse(rawProj);
        if (p && (p.slug === projectId || p.id === projectId || !projectId || projectId === 'default' || p.projectSlug === projectId)) {
          const pName = p.dataSources?.driveFolderName || p.driveFolderName || p.name || p.title;
          if (pName && pName.trim()) {
            projectName = pName.trim();
          }
        }
      }
    }
  } catch (e) {
    console.warn('Error obtaining human company and project names:', e);
  }

  return { companyName, projectName };
}

export async function postToAppsScript(payload: unknown, timeoutMs = APPS_SCRIPT_TIMEOUT_MS): Promise<any> {
  const targetUrl = INCIDENCES_CONFIG_SCRIPT_URL || FILES_GATEWAY_URL;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Google Drive respondió con código ${response.status}.`);
    return await response.json();
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('Drive tardó demasiado en responder.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function utf8ToBase64(str: string): string {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < utf8Bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(utf8Bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

// In-memory deduplication for folder resolution
const folderResolvePromises = new Map<string, Promise<string>>();

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      resolve(res ? res.split(',')[1] : '');
    };
    reader.onerror = () => reject(new Error('Fallo al leer datos del archivo para envío.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Resolves the exact Google Drive Project Folder ID inside INCIDENTS_DRIVE_FOLDER_ID:
 * 1-9SumRefiih81mc_eASsswy_W_U0-qe5 -> [Empresa] -> [Proyecto]
 * Never uses URL driveFolderId (which belongs to the 3D/2D CDE models folder).
 */
export async function resolveIncidentsProjectFolderId(companyId: string, projectId: string): Promise<string> {
  const { companyName, projectName } = getHumanCompanyAndProject(companyId, projectId);
  const cacheKey = `nora_inc_folder_v3_${companyName}_${projectName}`;
  const projCacheKey = `nora_inc_folder_proj_${projectId}`;

  try {
    const cached = localStorage.getItem(cacheKey) || localStorage.getItem(projCacheKey) || localStorage.getItem('cached_project_folder_id');
    if (cached && cached.trim().length > 10 && cached.trim() !== INCIDENTS_DRIVE_FOLDER_ID) {
      return cached.trim();
    }
  } catch (_) {}

  // Fixed mapping for PROYECTO PARA ENSAYOS DE HS
  if (projectId === 'nuevo-proyecto-1794663364994' || projectId?.includes('1794663364994') || projectName === 'PROYECTO PARA ENSAYOS DE HS') {
    const knownFolder = '1Gotb8NKYre22k1p5LrvcuG23z79TvAMI';
    try {
      localStorage.setItem(cacheKey, knownFolder);
      localStorage.setItem(projCacheKey, knownFolder);
    } catch (_) {}
    return knownFolder;
  }

  const existingPromise = folderResolvePromises.get(cacheKey);
  if (existingPromise) return existingPromise;

  const promise = (async () => {
    try {
      const data = await postToAppsScript({
        action: 'saveIncidentsProjectConfig',
        company: { id: companyId, name: companyName },
        companyName,
        project: { id: projectId, slug: projectId, name: projectName },
        projectName
      });
      const folderId = data?.storage?.projectFolderId || data?.projectFolderId;
      if (folderId && String(folderId).trim().length > 10 && String(folderId).trim() !== INCIDENTS_DRIVE_FOLDER_ID) {
        const cleanId = String(folderId).trim();
        try {
          localStorage.setItem(cacheKey, cleanId);
          localStorage.setItem(projCacheKey, cleanId);
        } catch (_) {}
        return cleanId;
      }
    } catch (err2) {
      console.warn('[googleDriveUtils] Fallback folder resolution failed:', err2);
    } finally {
      folderResolvePromises.delete(cacheKey);
    }
    return INCIDENTS_DRIVE_FOLDER_ID;
  })();

  folderResolvePromises.set(cacheKey, promise);
  return promise;
}

// Short-lived cache for folder file listings so config, locations, and incidents share 1 list call
const listFolderCache = new Map<string, { timestamp: number; promise: Promise<any[]> }>();

export async function listIncidentsFolderFiles(companyId: string, projectId: string, forceRefresh = false): Promise<any[]> {
  const folderId = await resolveIncidentsProjectFolderId(companyId, projectId);
  const now = Date.now();
  const cached = listFolderCache.get(folderId);
  if (!forceRefresh && cached && (now - cached.timestamp < 2500)) {
    return cached.promise;
  }

  const promise = (async () => {
    try {
      const listData = await postToAppsScript({
        action: 'list',
        folderId
      });
      return Array.isArray(listData?.allModels) ? listData.allModels : [];
    } catch (err) {
      console.warn('[googleDriveUtils] Error listing folder files:', err);
      return [];
    }
  })();

  listFolderCache.set(folderId, { timestamp: now, promise });
  return promise;
}

export function invalidateIncidentsFolderListCache(companyId: string, projectId: string) {
  listFolderCache.clear();
}

/**
 * Saves the full Incidencias project configuration (including locations) as config_incidencias.json
 * inside 1-9SumRefiih81mc_eASsswy_W_U0-qe5 -> [Empresa] -> [Proyecto]
 */
export async function saveIncidentsConfigToSheet(
  config: unknown,
  companyId: string,
  projectId: string
): Promise<{ spreadsheetUrl?: string; projectFolderId?: string; fileId?: string }> {
  const { companyName, projectName } = getHumanCompanyAndProject(companyId, projectId);
  
  // Save directly via saveIncidentsProjectConfig: this action trashes any existing config_incidencias.json,
  // creates the single updated config_incidencias.json, updates the spreadsheet, and returns the projectFolderId!
  let res: any = null;
  try {
    res = await postToAppsScript({
      action: 'saveIncidentsProjectConfig',
      company: { id: companyId, name: companyName },
      companyId,
      companyName,
      project: { id: projectId, slug: projectId, name: projectName },
      projectId,
      projectSlug: projectId,
      projectName,
      config
    });
  } catch (apiErr) {
    console.warn('[googleDriveUtils] saveIncidentsProjectConfig returned error, trying fallback:', apiErr);
  }

  const projectFolderId = res?.storage?.projectFolderId || res?.projectFolderId;
  if (projectFolderId) {
    const cacheKey = `nora_inc_folder_v3_${companyName}_${projectName}`;
    try {
      localStorage.setItem(cacheKey, String(projectFolderId).trim());
    } catch (_) {}
  }

  // Fallback if needed
  if (!res || res.status === 'error' || res.error) {
    const folderId = projectFolderId || await resolveIncidentsProjectFolderId(companyId, projectId);
    const jsonStr = JSON.stringify(config, null, 2);
    const base64 = utf8ToBase64(jsonStr);
    const uploadRes = await postToAppsScript({
      action: 'uploadFile',
      folderId,
      filename: 'config_incidencias.json',
      name: 'config_incidencias.json',
      contentType: 'application/json',
      mimeType: 'application/json',
      content: base64,
      base64
    });
    invalidateIncidentsFolderListCache(companyId, projectId);
    return {
      projectFolderId: folderId,
      fileId: uploadRes?.fileId || uploadRes?.id
    };
  }

  invalidateIncidentsFolderListCache(companyId, projectId);

  return {
    projectFolderId: projectFolderId,
    fileId: res?.fileId,
    spreadsheetUrl: res?.storage?.spreadsheetUrl || res?.fileUrl
  };
}

/**
 * Loads config_incidencias.json from 1-9SumRefiih81mc_eASsswy_W_U0-qe5 -> [Empresa] -> [Proyecto]
 */
export async function loadIncidentsConfigFromSheet(companyId: string, projectId: string): Promise<any | null> {
  try {
    const files = await listIncidentsFolderFiles(companyId, projectId);
    const configFiles = files
      .filter((f: any) => f.name === 'config_incidencias.json')
      .sort((a: any, b: any) => new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime());

    if (configFiles.length === 0) return null;
    const latestFile = configFiles[0];

    const fileCacheKey = `nora_cfg_file_${latestFile.fileId}`;
    try {
      const cachedRaw = localStorage.getItem(fileCacheKey);
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw);
        if (parsed && parsed.lastUpdated === latestFile.lastUpdated && parsed.data) {
          return parsed.data;
        }
      }
    } catch (_) {}

    const textData = await postToAppsScript({
      action: 'text',
      id: latestFile.fileId
    });

    if (textData && textData.text) {
      const parsedConfig = JSON.parse(textData.text);
      try {
        localStorage.setItem(fileCacheKey, JSON.stringify({
          lastUpdated: latestFile.lastUpdated,
          data: parsedConfig
        }));
      } catch (_) {}
      return parsedConfig;
    }
  } catch (e) {
    console.warn('Could not load config_incidencias.json from Google Drive:', e);
  }
  return null;
}

/**
 * Locations are kept directly inside config_incidencias.json.
 * No separate ubicaciones_incidencias.json files are created!
 */
export async function saveIncidentsLocationsToSheet(
  operation: 'upsert' | 'delete',
  unit: StoredStructuralUnit | { id: string },
  companyId: string,
  projectId: string,
  _allUnits?: StoredStructuralUnit[]
): Promise<void> {
  // Sync to spreadsheet without creating extra JSON files
  const { companyName, projectName } = getHumanCompanyAndProject(companyId, projectId);
  postToAppsScript({
    action: 'saveIncidentsLocation',
    operation,
    unit,
    company: { id: companyId, name: companyName },
    companyId,
    companyName,
    project: { id: projectId, slug: projectId, name: projectName },
    projectId,
    projectSlug: projectId,
    projectName
  }).catch(() => {});
}

export async function loadIncidentsLocationsFromSheet(companyId: string, projectId: string): Promise<StoredStructuralUnit[]> {
  // 1. Try reading directly from config_incidencias.json
  try {
    const cfg = await loadIncidentsConfigFromSheet(companyId, projectId);
    if (cfg && Array.isArray(cfg.locations) && cfg.locations.length > 0) {
      return cfg.locations;
    }
  } catch (err) {
    console.warn('Could not load locations from config_incidencias.json:', err);
  }

  // 2. Fallback: spreadsheet getIncidentsLocations
  const targetUrl = INCIDENCES_CONFIG_SCRIPT_URL || FILES_GATEWAY_URL;
  if (!targetUrl) return [];
  const { companyName, projectName } = getHumanCompanyAndProject(companyId, projectId);
  try {
    const url = new URL(targetUrl);
    url.searchParams.set('action', 'getIncidentsLocations');
    url.searchParams.set('empresa', companyName);
    url.searchParams.set('proyecto', projectName);
    url.searchParams.set('companyId', companyId);
    url.searchParams.set('projectId', projectId);
    const response = await fetch(url.toString());
    if (!response.ok) return [];
    const result = await response.json();
    if (result?.status === 'success' && Array.isArray(result.units)) {
      return result.units;
    }
  } catch (_) {}
  return [];
}

/**
 * Gets or creates a folder on Google Drive.
 */
export async function getOrCreateFolder(
  folderName: string,
  accessToken?: string
): Promise<string> {
  const urlParams = new URLSearchParams(window.location.search);
  const cId = urlParams.get('empresa') || 'default';
  const pId = urlParams.get('project') || 'default';
  return resolveIncidentsProjectFolderId(cId, pId);
}

/**
 * Uploads an attachment (Blob) directly into the project's folder in Google Drive:
 * 1-9SumRefiih81mc_eASsswy_W_U0-qe5 -> [Empresa] -> [Proyecto]
 */
export async function uploadFileToDrive(
  fileBlob: Blob,
  fileName: string,
  fileType: string,
  folderId?: string,
  accessToken?: string,
  extraMetadata?: Record<string, any>
): Promise<DriveUploadResult> {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const cId = extraMetadata?.companyId || urlParams.get('empresa') || 'default';
    const pId = extraMetadata?.project || extraMetadata?.projectId || urlParams.get('project') || 'default';
    const { companyName, projectName } = getHumanCompanyAndProject(cId, pId);

    // Always resolve the exact [Empresa] -> [Proyecto] folder inside 1-9SumRefiih81mc_eASsswy_W_U0-qe5
    let targetFolderId = folderId;
    if (!targetFolderId || targetFolderId === INCIDENTS_DRIVE_FOLDER_ID || targetFolderId === '1Bym51TtKVSzDsweJaMAh0VxCAAQQbU3w') {
      targetFolderId = await resolveIncidentsProjectFolderId(cId, pId);
    }

    const cleanContentType = fileType || (fileName.endsWith('.mp4') ? 'video/mp4' : (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) ? 'image/jpeg' : 'application/octet-stream');

    // For files > 3.5 MB (e.g. videos or high-resolution images), use Google Drive resumable upload
    // to avoid payload limits, timeouts, and mobile browser crashes
    if (fileBlob.size > 3.5 * 1024 * 1024) {
      console.log(`[Drive Upload] Archivo grande (${(fileBlob.size / 1024 / 1024).toFixed(1)} MB). Usando subida reanudable por bloques...`);
      const initRes = await postToAppsScript({
        action: 'initResumableUpload',
        folderId: targetFolderId,
        filename: fileName,
        contentType: cleanContentType,
        totalBytes: fileBlob.size
      }, 45_000);

      if (!initRes || !initRes.sessionUrl) {
        throw new Error(initRes?.message || 'No se pudo iniciar la carga reanudable en Google Drive.');
      }

      // 1 MB chunks (multiple of 256KB: 4 * 256KB) to speed up video uploads and reduce HTTP roundtrips
      const CHUNK_SIZE = 1024 * 1024;
      let offset = 0;
      let uploadedFileId = '';

      while (offset < fileBlob.size) {
        const slice = fileBlob.slice(offset, Math.min(offset + CHUNK_SIZE, fileBlob.size));
        const chunkBase64 = await blobToBase64(slice);
        console.log(`[Drive Upload] Subiendo bloque ${(offset / 1024 / 1024).toFixed(1)} MB / ${(fileBlob.size / 1024 / 1024).toFixed(1)} MB...`);
        const chunkRes = await postToAppsScript({
          action: 'uploadResumableChunk',
          sessionUrl: initRes.sessionUrl,
          content: chunkBase64,
          start: offset,
          totalBytes: fileBlob.size,
          contentType: cleanContentType,
          filename: fileName,
          folderId: targetFolderId,
          skipStatusRegister: true
        }, 60_000);

        if (chunkRes?.status === 'error') {
          throw new Error(chunkRes.message || 'Error en bloque de subida a Drive.');
        }

        if (chunkRes?.fileId) {
          uploadedFileId = chunkRes.fileId;
        }

        offset += slice.size;
      }

      if (!uploadedFileId) {
        throw new Error('La carga reanudable finalizó sin retornar ID de archivo.');
      }

      const webViewLink = `https://drive.google.com/file/d/${uploadedFileId}/view`;
      const isImage = cleanContentType.startsWith('image/');
      const renderUrl = isImage
        ? `https://drive.google.com/thumbnail?id=${uploadedFileId}&sz=w1600`
        : webViewLink;

      return {
        id: uploadedFileId,
        webViewLink,
        url: renderUrl
      };
    }

    // Standard upload for files <= 3.5 MB
    const base64 = await blobToBase64(fileBlob);

    const bodyPayload = {
      action: 'uploadFile',
      content: base64,
      base64: base64,
      contentType: cleanContentType,
      mimeType: cleanContentType,
      filename: fileName,
      name: fileName,
      folderId: targetFolderId
      // NOTE: Do NOT pass project here because Directorio Global noraCDE.js
      // registerFileStatus_ will attempt to write to EstadosArchivos and trashes the file on failure!
    };

    const res = await fetch(FILES_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(bodyPayload)
    });

    if (!res.ok) {
      throw new Error(`El gateway respondió con código ${res.status}`);
    }

    const payload = await res.json();
    if (payload.status === "error" || payload.error) {
      throw new Error(payload.message || payload.error || "Error devuelto por Google Apps Script.");
    }

    const fileId = payload.id || payload.fileId;
    if (!fileId) throw new Error(payload.message || 'El gateway no devolvió el ID del archivo guardado.');

    const webViewLink = payload.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
    const isImage = cleanContentType.startsWith('image/');
    const renderUrl = isImage
      ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`
      : webViewLink;

    return {
      id: fileId,
      webViewLink,
      url: renderUrl
    };
  } catch (err: any) {
    console.error(`[Drive Gateway Upload] Error uploading via Apps Script:`, err);
    throw new Error(`Google Drive Gateway Error: ${err.message || String(err)}`);
  }
}

/**
 * Legacy helper kept for compatibility; does not create scattered files.
 */
export async function archiveIncidentsRecord(
  kind: 'configuracion' | 'incidencia' | 'chat',
  record: unknown,
  id: string,
  companyId?: string,
  projectId?: string
): Promise<DriveUploadResult> {
  return {
    id: String(id || ''),
    webViewLink: '',
    url: ''
  };
}

/**
 * Resolves any Google Drive proxy or file URL so it works both locally and on GitHub Pages (norabim.com).
 */
export function getAuthenticatedDriveUrl(url: string | undefined, token?: string | null): string {
  if (!url) return '';
  if (url.startsWith('/api/drive-image/')) {
    const fileId = url.replace('/api/drive-image/', '').split('?')[0].trim();
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
    }
  }
  if (url.startsWith('/api/drive-download') || url.startsWith('/api/drive-file') || url.startsWith('/api/drive/')) {
    const match = url.match(/[?&]id=([^&]+)/) || url.match(/\/api\/drive(?:\/|-file\/)([^/?&]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/file/d/${match[1]}/view`;
    }
  }
  return url;
}
