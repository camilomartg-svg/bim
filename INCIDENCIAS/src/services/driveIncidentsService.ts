import { Issue } from '../types';
import { getHumanCompanyAndProject, FILES_GATEWAY_URL } from '../utils/googleDriveUtils';

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
 * Resolves the Google Drive Project Folder ID inside INCIDENTS_ROOT_FOLDER_ID
 * Structure: 1-9SumRefiih81mc_eASsswy_W_U0-qe5 -> [Empresa] -> [Proyecto]
 */
export async function resolveProjectFolderId(companyId?: string, projectId?: string): Promise<string> {
  const { companyId: cId, projectId: pId } = getContext(companyId, projectId);
  
  // 1. From URL param
  const urlParams = new URLSearchParams(window.location.search);
  const fromUrl = urlParams.get('driveFolderId');
  if (fromUrl && fromUrl.trim().length > 10) {
    return fromUrl.trim();
  }

  // 2. From LocalStorage Cache
  const cacheKey = `nora_drive_folder_${cId}_${pId}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached && cached.trim().length > 10) {
    return cached.trim();
  }

  // 3. Resolve via Google Apps Script Gateway (saveIncidentsProjectConfig auto-provisions company and project folders)
  const { companyName, projectName } = getHumanCompanyAndProject(cId, pId);
  try {
    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveIncidentsProjectConfig',
        company: { id: cId, name: companyName },
        companyName: companyName,
        project: { id: pId, slug: pId, name: projectName },
        projectName: projectName
      })
    });
    const data = await res.json();
    const folderId = data?.storage?.projectFolderId || data?.projectFolderId;
    if (folderId) {
      localStorage.setItem(cacheKey, folderId);
      return folderId;
    }
  } catch (err) {
    console.warn('[driveIncidentsService] Error resolving projectFolderId from gateway:', err);
  }

  // Fallback default folder
  return '1Gotb8NKYre22k1p5LrvcuG23z79TvAMl';
}

/**
 * Returns cached incidents synchronously for instant rendering
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
function updateLocalIncidentsCache(incidents: Issue[], companyId: string, projectId: string) {
  const key = `nora_incidents_${companyId}_${projectId}`;
  try {
    localStorage.setItem(key, JSON.stringify(incidents));
  } catch (_) {}

  // Local window event
  window.dispatchEvent(new CustomEvent('nora_incidents_updated', {
    detail: { incidents, companyId, projectId }
  }));

  // Cross-tab broadcast
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

/**
 * Fetches all incidents directly from the Google Drive project folder
 */
export async function fetchIncidentsFromDrive(companyId?: string, projectId?: string): Promise<Issue[]> {
  const { companyId: cId, projectId: pId } = getContext(companyId, projectId);
  const { companyName, projectName } = getHumanCompanyAndProject(cId, pId);

  // Attempt 1: Direct batch getIncidents
  try {
    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'getIncidents',
        company: { id: cId, name: companyName },
        companyName: companyName,
        project: { id: pId, slug: pId, name: projectName },
        projectName: projectName
      })
    });
    const data = await res.json();
    if (data && data.status === 'success' && Array.isArray(data.incidents)) {
      const sorted = (data.incidents as Issue[]).sort((a, b) => 
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      updateLocalIncidentsCache(sorted, cId, pId);
      return sorted;
    }
  } catch (directErr) {
    console.warn('[driveIncidentsService] getIncidents batch call fallback:', directErr);
  }

  // Attempt 2: List files in projectFolderId and fetch text
  try {
    const folderId = await resolveProjectFolderId(cId, pId);
    const listRes = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'list',
        folderId: folderId
      })
    });
    const listData = await listRes.json();
    const files = (listData.allModels || []).filter(
      (m: any) => m.name && m.name.startsWith('incidencia_') && m.name.endsWith('.json')
    );

    if (files.length === 0) {
      // If none found in project folder, keep cached or return empty
      return getCachedIncidents(cId, pId);
    }

    const incidents: Issue[] = [];
    await Promise.all(files.map(async (f: any) => {
      // Check cache by fileId + lastUpdated
      const fileCacheKey = `nora_inc_file_${f.fileId}`;
      const cached = localStorage.getItem(fileCacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.lastUpdated === f.lastUpdated && parsed.data) {
            incidents.push(parsed.data);
            return;
          }
        } catch (_) {}
      }

      try {
        const textRes = await fetch(GATEWAY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'text', id: f.fileId })
        });
        const textData = await textRes.json();
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

    const sorted = incidents.sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    updateLocalIncidentsCache(sorted, cId, pId);
    return sorted;
  } catch (err) {
    console.error('[driveIncidentsService] Failed to load incidents from Drive:', err);
    return getCachedIncidents(cId, pId);
  }
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
  const { companyName, projectName } = getHumanCompanyAndProject(cId, pId);

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

  // 1. Optimistically update local cache & broadcast
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

  // 2. Persist to Drive
  try {
    // Attempt dedicated saveIncident
    const saveRes = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'saveIncident',
        company: { id: cId, name: companyName },
        companyName,
        project: { id: pId, slug: pId, name: projectName },
        projectName,
        incident: fullIssue
      })
    });
    const saveData = await saveRes.json();
    if (saveData && saveData.status === 'success') {
      return issueId;
    }
  } catch (_) {}

  // Fallback: uploadFile to projectFolderId
  try {
    const folderId = await resolveProjectFolderId(cId, pId);
    const jsonStr = JSON.stringify(fullIssue, null, 2);
    // Base64 encode UTF-8 cleanly
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const base64 = btoa(binary);

    await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'uploadFile',
        folderId: folderId,
        filename: `incidencia_${issueId}.json`,
        contentType: 'application/json',
        content: base64
      })
    });
  } catch (uploadErr) {
    console.error('[driveIncidentsService] Error persisting incident to Drive:', uploadErr);
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
  const { companyName, projectName } = getHumanCompanyAndProject(cId, pId);

  // 1. Optimistic local cache removal
  const existing = getCachedIncidents(cId, pId);
  const updatedList = existing.filter(i => i.id !== issueId);
  updateLocalIncidentsCache(updatedList, cId, pId);

  // 2. Delete on Drive
  try {
    await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'deleteIncident',
        company: { id: cId, name: companyName },
        companyName,
        project: { id: pId, slug: pId, name: projectName },
        projectName,
        incidentId: issueId,
        id: issueId
      })
    });
    return true;
  } catch (err) {
    console.warn('[driveIncidentsService] Error deleting incident on Drive:', err);
  }

  // Fallback: list projectFolder files and delete
  try {
    const folderId = await resolveProjectFolderId(cId, pId);
    const listRes = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'list', folderId })
    });
    const listData = await listRes.json();
    const targetFile = (listData.allModels || []).find(
      (m: any) => m.name === `incidencia_${issueId}.json`
    );
    if (targetFile && targetFile.fileId) {
      await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'deleteFile', fileId: targetFile.fileId })
      });
    }
  } catch (_) {}

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
