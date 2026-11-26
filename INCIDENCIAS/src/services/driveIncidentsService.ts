import { Issue } from '../types';
import {
  FILES_GATEWAY_URL,
  resolveIncidentsProjectFolderId,
  listIncidentsFolderFiles,
  invalidateIncidentsFolderListCache,
  postToAppsScript
} from '../utils/googleDriveUtils';

const GATEWAY_URL = FILES_GATEWAY_URL || 'https://script.google.com/macros/s/AKfycbx2RAQx_8K4o22xE0Mw-ETc7K_58vIoi6-PgVi64u80inuiw144ks3cgWSdCtXqIgB02g/exec';

// BroadcastChannel for instant multi-tab sync without Firestore
const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('nora_incidents_sync') 
  : null;

function getContext(companyId?: string, projectId?: string) {
  let cId = companyId;
  let pId = projectId;
  if (!cId || !pId) {
    const urlParams = new URLSearchParams(window.location.search);
    pId = pId || urlParams.get('project') || 'default';
    cId = cId || urlParams.get('empresa') || 'default';
    if (cId === 'default') {
      const userAccountStr = sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount');
      if (userAccountStr) {
        try {
          cId = JSON.parse(userAccountStr).empresa || 'default';
        } catch (_) {}
      }
    }
  }
  return { companyId: cId || 'default', projectId: pId || 'default' };
}

/**
 * Resolves the Google Drive Project Folder ID inside INCIDENTS_DRIVE_FOLDER_ID:
 * 1-9SumRefiih81mc_eASsswy_W_U0-qe5 -> [Empresa] -> [Proyecto]
 */
export async function resolveProjectFolderId(companyId?: string, projectId?: string): Promise<string> {
  const { companyId: cId, projectId: pId } = getContext(companyId, projectId);
  return resolveIncidentsProjectFolderId(cId, pId);
}

/**
 * Returns cached incidents synchronously for instant 0ms rendering
 */
export function getCachedIncidents(companyId?: string, projectId?: string): Issue[] {
  const { companyId: cId, projectId: pId } = getContext(companyId, projectId);
  const key = `nora_incidents_${cId}_${pId}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  return [];
}

/**
 * Updates localStorage and notifies subscribers in current and other tabs
 */
export function updateLocalIncidentsCache(incidents: Issue[], companyId: string, projectId: string) {
  const key = `nora_incidents_${companyId}_${projectId}`;
  try {
    localStorage.setItem(key, JSON.stringify(incidents));
  } catch (_) {}

  window.dispatchEvent(new CustomEvent('nora_incidents_updated', {
    detail: { incidents, companyId, projectId }
  }));

  if (channel) {
    try {
      channel.postMessage({
        type: 'INCIDENTS_UPDATED',
        companyId,
        projectId,
        incidents
      });
    } catch (_) {}
  }
}

// In-memory deduplication for concurrent fetchIncidentsFromDrive calls
const activeFetchPromises = new Map<string, Promise<Issue[]>>();

/**
 * Fetches all incidents directly from the Google Drive project folder:
 * 1-9SumRefiih81mc_eASsswy_W_U0-qe5 -> [Empresa] -> [Proyecto]
 */
export async function fetchIncidentsFromDrive(companyId?: string, projectId?: string): Promise<Issue[]> {
  const { companyId: cId, projectId: pId } = getContext(companyId, projectId);
  const key = `${cId}_${pId}`;

  const inFlight = activeFetchPromises.get(key);
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      const allFiles = await listIncidentsFolderFiles(cId, pId);
      const files = allFiles.filter(
        (m: any) => m.name && m.name.startsWith('incidencia_') && m.name.endsWith('.json')
      );

      if (files.length === 0) {
        return getCachedIncidents(cId, pId);
      }

      // Deduplicate if multiple files share the same name (keep latest by lastUpdated)
      const latestFilesMap = new Map<string, any>();
      files.forEach((f: any) => {
        const existing = latestFilesMap.get(f.name);
        if (!existing || new Date(f.lastUpdated || 0).getTime() >= new Date(existing.lastUpdated || 0).getTime()) {
          latestFilesMap.set(f.name, f);
        }
      });

      const uniqueFiles = Array.from(latestFilesMap.values());
      const incidents: Issue[] = [];

      await Promise.all(uniqueFiles.map(async (f: any) => {
        const fileCacheKey = `nora_inc_file_${f.fileId}`;
        try {
          const cached = localStorage.getItem(fileCacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.lastUpdated === f.lastUpdated && parsed.data) {
              incidents.push(parsed.data);
              return;
            }
          }
        } catch (_) {}

        try {
          const textData = await postToAppsScript({ action: 'text', id: f.fileId });
          if (textData && textData.text) {
            const parsed = JSON.parse(textData.text);
            const inc: Issue = (parsed.record || parsed) as Issue;
            if (inc && inc.id) {
              incidents.push(inc);
              try {
                localStorage.setItem(fileCacheKey, JSON.stringify({
                  lastUpdated: f.lastUpdated,
                  data: inc
                }));
              } catch (_) {}
            }
          }
        } catch (err) {
          console.warn(`[driveIncidentsService] Error fetching file ${f.name}:`, err);
        }
      }));

      // Merge any very recently created local incidents that might still be uploading
      const sorted = incidents.sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      updateLocalIncidentsCache(sorted, cId, pId);
      return sorted;
    } catch (err) {
      console.error('[driveIncidentsService] Failed to load incidents from Drive:', err);
      return getCachedIncidents(cId, pId);
    } finally {
      activeFetchPromises.delete(key);
    }
  })();

  activeFetchPromises.set(key, promise);
  return promise;
}

/**
 * Saves or updates an incident as a single JSON file in Drive:
 * 1-9SumRefiih81mc_eASsswy_W_U0-qe5 / [Empresa] / [Proyecto] / incidencia_[id].json
 */
export async function saveIncidentToDrive(
  issue: Partial<Issue> & { id?: string },
  companyId?: string,
  projectId?: string
): Promise<string> {
  const { companyId: cId, projectId: pId } = getContext(companyId, projectId);

  const issueId = issue.id || ('iss_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
  const fullIssue: Issue = {
    ...issue,
    id: issueId,
    companyId: cId,
    projectId: pId,
    createdAt: issue.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    comments: issue.comments || [],
    attachments: issue.attachments || [],
    locations: issue.locations || { units: [], levels: [], spaces: [] }
  } as Issue;

  // 1. Optimistically update local cache & broadcast immediately (0ms UI latency)
  const existing = getCachedIncidents(cId, pId);
  const index = existing.findIndex(i => i.id === issueId);
  let updatedList: Issue[];
  if (index >= 0) {
    updatedList = [...existing];
    updatedList[index] = fullIssue;
  } else {
    updatedList = [fullIssue, ...existing];
  }
  updateLocalIncidentsCache(updatedList, cId, pId);

  // 2. Persist JSON file directly into 1-9SumRefiih81mc_eASsswy_W_U0-qe5 / [Empresa] / [Proyecto]
  try {
    const folderId = await resolveIncidentsProjectFolderId(cId, pId);

    // Sanitize issue to never persist private phone blob: URLs into Google Drive!
    const sanitizedIssueForDrive: Issue = {
      ...fullIssue,
      attachments: (fullIssue.attachments || []).map(att => {
        if (att.url && att.url.startsWith('blob:')) {
          return {
            ...att,
            url: '',
            isLocalPending: true
          };
        }
        return att;
      })
    };

    const jsonStr = JSON.stringify(sanitizedIssueForDrive, null, 2);
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < utf8Bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(utf8Bytes.subarray(i, i + chunkSize)));
    }
    const base64 = btoa(binary);

    const filename = `incidencia_${issueId}.json`;
    const res = await postToAppsScript({
      action: 'uploadFile',
      folderId: folderId,
      filename: filename,
      name: filename,
      contentType: 'application/json',
      mimeType: 'application/json',
      content: base64,
      base64: base64
    });

    if (res?.fileId) {
      try {
        localStorage.setItem(`nora_inc_file_${res.fileId}`, JSON.stringify({
          lastUpdated: new Date().toISOString(),
          data: fullIssue
        }));
      } catch (_) {}
    }

    invalidateIncidentsFolderListCache(cId, pId);
  } catch (uploadErr) {
    console.error('[driveIncidentsService] Error persisting incident JSON to Drive:', uploadErr);
  }

  return issueId;
}

/**
 * Deletes an incident JSON from Drive and local cache
 */
export async function deleteIncidentFromDrive(
  issueId: string,
  companyId?: string,
  projectId?: string
): Promise<boolean> {
  const { companyId: cId, projectId: pId } = getContext(companyId, projectId);

  // 1. Optimistic local cache removal
  const existing = getCachedIncidents(cId, pId);
  const updatedList = existing.filter(i => i.id !== issueId);
  updateLocalIncidentsCache(updatedList, cId, pId);

  // 2. Find and delete all matching files in projectFolderId
  try {
    const files = await listIncidentsFolderFiles(cId, pId, true);
    const targetFiles = files.filter(
      (m: any) => m.name === `incidencia_${issueId}.json`
    );
    await Promise.all(targetFiles.map(async (f: any) => {
      if (f && f.fileId) {
        await postToAppsScript({ action: 'deleteFile', fileId: f.fileId });
      }
    }));
    invalidateIncidentsFolderListCache(cId, pId);
  } catch (err) {
    console.warn('[driveIncidentsService] Error deleting incident on Drive:', err);
  }

  return true;
}

// Global listener for cross-tab sync
if (channel) {
  channel.onmessage = (event) => {
    if (event.data?.type === 'INCIDENTS_UPDATED' && event.data.incidents) {
      const { companyId, projectId, incidents } = event.data;
      const key = `nora_incidents_${companyId}_${projectId}`;
      try {
        localStorage.setItem(key, JSON.stringify(incidents));
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('nora_incidents_updated', {
        detail: { incidents, companyId, projectId }
      }));
    }
  };
}

/**
 * Saves user notification preferences directly into Google Drive:
 * 1-9SumRefiih81mc_eASsswy_W_U0-qe5 -> [Empresa] -> [Proyecto] -> notif_prefs_[user].json
 */
export async function saveNotificationPreferencesToDrive(
  prefs: any,
  userIdentifier: string,
  companyId?: string,
  projectId?: string
): Promise<void> {
  const { companyId: cId, projectId: pId } = getContext(companyId, projectId);
  const cleanUser = (userIdentifier || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const cacheKey = `nora_notif_prefs_${cleanUser}_${cId}_${pId}`;

  // 1. Optimistic instant local storage update
  try {
    localStorage.setItem(cacheKey, JSON.stringify(prefs));
    localStorage.setItem(`nora_notif_prefs_${cleanUser}`, JSON.stringify(prefs));
  } catch (_) {}

  // 2. Persist in Drive folder
  try {
    const folderId = await resolveIncidentsProjectFolderId(cId, pId);
    const payload = {
      ...prefs,
      userIdentifier,
      companyId: cId,
      projectId: pId,
      updatedAt: new Date().toISOString()
    };

    const jsonStr = JSON.stringify(payload, null, 2);
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < utf8Bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(utf8Bytes.subarray(i, i + chunkSize)));
    }
    const base64 = btoa(binary);

    const filename = `notif_prefs_${cleanUser}.json`;
    await postToAppsScript({
      action: 'uploadFile',
      folderId: folderId,
      filename: filename,
      name: filename,
      contentType: 'application/json',
      mimeType: 'application/json',
      content: base64,
      base64: base64
    });

    invalidateIncidentsFolderListCache(cId, pId);
  } catch (err) {
    console.warn('[driveIncidentsService] Error guardando preferencias en Drive:', err);
  }
}

/**
 * Loads user notification preferences from Google Drive:
 * 1-9SumRefiih81mc_eASsswy_W_U0-qe5 -> [Empresa] -> [Proyecto] -> notif_prefs_[user].json
 */
export async function fetchNotificationPreferencesFromDrive(
  userIdentifier: string,
  companyId?: string,
  projectId?: string
): Promise<any | null> {
  const { companyId: cId, projectId: pId } = getContext(companyId, projectId);
  const cleanUser = (userIdentifier || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const cacheKey = `nora_notif_prefs_${cleanUser}_${cId}_${pId}`;

  // 1. Check local storage first
  try {
    const cached = localStorage.getItem(cacheKey) || localStorage.getItem(`nora_notif_prefs_${cleanUser}`);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  // 2. Fetch from Drive
  try {
    const allFiles = await listIncidentsFolderFiles(cId, pId);
    const targetName = `notif_prefs_${cleanUser}.json`;
    const targetFile = allFiles.find((f: any) => f.name === targetName);
    if (targetFile && targetFile.fileId) {
      const textData = await postToAppsScript({ action: 'text', id: targetFile.fileId });
      if (textData && textData.text) {
        const parsed = JSON.parse(textData.text);
        if (parsed) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(parsed));
          } catch (_) {}
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('[driveIncidentsService] Error leyendo preferencias de Drive:', err);
  }

  return null;
}

