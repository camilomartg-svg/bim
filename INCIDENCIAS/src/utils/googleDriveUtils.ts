/**
 * Google Drive integration utilities via secure Google Apps Script Gateway.
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

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx2RAQx_8K4o22xE0Mw-ETc7K_58vIoi6-PgVi64u80inuiw144ks3cgWSdCtXqIgB02g/exec";

// Shared project repository. The Apps Script gateway owns the Drive access,
// so each user can save records without connecting a personal Google account.
export const INCIDENTS_DRIVE_FOLDER_ID =
  '1-9SumRefiih81mc_eASsswy_W_U0-qe5';

export async function saveIncidentsConfigToSheet(
  config: unknown,
  companyId: string,
  projectId: string
): Promise<{ spreadsheetUrl: string }> {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'saveIncidentsProjectConfig',
      company: { id: companyId, name: companyId },
      project: { id: projectId, slug: projectId, name: projectId },
      config
    })
  });
  if (!response.ok) throw new Error(`Google Drive respondió con código ${response.status}.`);
  const result = await response.json();
  if (result.status !== 'success') throw new Error(result.message || 'No se pudo guardar la configuración en Drive.');
  return result.storage;
}

/** Keeps the location hierarchy in the project's Drive spreadsheet as a durable fallback. */
export async function saveIncidentsLocationsToSheet(
  operation: 'upsert' | 'delete',
  unit: StoredStructuralUnit | { id: string },
  companyId: string,
  projectId: string
): Promise<void> {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'saveIncidentsLocation', operation, unit,
      company: { id: companyId, name: companyId },
      project: { id: projectId, slug: projectId, name: projectId }
    })
  });
  if (!response.ok) throw new Error(`Google Drive respondió con código ${response.status}.`);
  const result = await response.json();
  if (result.status !== 'success') throw new Error(result.message || 'No se pudo guardar la ubicación en Drive.');
}

export async function loadIncidentsLocationsFromSheet(companyId: string, projectId: string): Promise<StoredStructuralUnit[]> {
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', 'getIncidentsLocations');
  url.searchParams.set('empresa', companyId);
  url.searchParams.set('proyecto', projectId);
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Google Drive respondió con código ${response.status}.`);
  const result = await response.json();
  if (result.status !== 'success') throw new Error(result.message || 'No se pudieron cargar las ubicaciones desde Drive.');
  return Array.isArray(result.units) ? result.units : [];
}

/**
 * Gets or creates a folder on Google Drive.
 * Stubbed to use your pre-configured folder ID.
 */
export async function getOrCreateFolder(
  folderName: string,
  accessToken?: string
): Promise<string> {
  console.log(`[Drive Folder] Utilizing pre-configured folder gateway. returning default folder.`);
  return '1Bym51TtKVSzDsweJaMAh0VxCAAQQbU3w';
}

/**
 * Uploads a file (Blob) to Google Drive using the secure Google Apps Script Gateway.
 * Bypasses OAuth, popups, and manual syncing!
 */
export async function uploadFileToDrive(
  fileBlob: Blob,
  fileName: string,
  fileType: string,
  folderId?: string,
  accessToken?: string
): Promise<DriveUploadResult> {
  console.log(`[Drive Gateway Upload] Initializing upload for: ${fileName} (${fileType}, ${fileBlob.size} bytes)`);

  try {
    // 1. Convert Blob to Base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const resultString = reader.result as string;
        const base64Data = resultString.split(',')[1]; // Extracts the clean raw base64 after the data: part
        resolve(base64Data || '');
      };
      reader.onerror = (err) => {
        reject(new Error("Fallo al leer los bytes del archivo para el envío."));
      };
      reader.readAsDataURL(fileBlob);
    });

    // 2. Post to the local backend proxy first (which is 100% immune to iframe/browser CORS restrictions)
    let res: Response;
    let fallbackToDirect = false;

    try {
      res = await fetch("/api/upload-to-drive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: 'uploadFile',
          content: base64,
          contentType: fileType,
          filename: fileName,
          folderId: folderId || INCIDENTS_DRIVE_FOLDER_ID
        })
      });

      if (!res.ok) {
        throw new Error(`Server proxy error status: ${res.status}`);
      }
    } catch (proxyErr) {
      console.warn("[Drive Gateway Upload] Proxy endpoint failed or bypassed, falling back to direct CORS request:", proxyErr);
      fallbackToDirect = true;
    }

    if (fallbackToDirect) {
      res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          action: 'uploadFile',
          content: base64,
          contentType: fileType,
          filename: fileName,
          folderId: folderId || INCIDENTS_DRIVE_FOLDER_ID
        })
      });
    }

    if (!res!.ok) {
      throw new Error(`El gateway respondió con código ${res!.status}`);
    }

    const payload = await res!.json();
    if (payload.status === "error") {
      throw new Error(payload.message || "Error desconocido devuelto por Google Apps Script.");
    }

    const fileId = payload.id || payload.fileId;
    if (!fileId) throw new Error(payload.message || 'El gateway no devolvió el ID del archivo guardado.');
    console.log(`[Drive Gateway Upload] Completed successfully! File ID: ${fileId}`);

    // Create immediate renderable thumbnail/image link using our secure Node.js proxy endpoint
    const renderUrl = `/api/drive-image/${fileId}`;

    return {
      id: fileId,
      webViewLink: payload.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
      url: renderUrl
    };

  } catch (err: any) {
    console.error(`[Drive Gateway Upload] Error uploading via Apps Script:`, err);
    throw new Error(`Google Drive Gateway Error: ${err.message || String(err)}`);
  }
}

/** Stores a JSON snapshot of an Incidencias record in the shared Drive folder. */
export async function archiveIncidentsRecord(
  kind: 'configuracion' | 'incidencia',
  record: unknown,
  id: string
): Promise<DriveUploadResult> {
  const safeId = String(id || 'sin-id').replace(/[^a-zA-Z0-9_-]/g, '_');
  const payload = JSON.stringify({
    schema: 'nora-incidencias/v1',
    kind,
    archivedAt: new Date().toISOString(),
    record
  }, null, 2);
  return uploadFileToDrive(
    new Blob([payload], { type: 'application/json' }),
    `${kind}_${safeId}_${Date.now()}.json`,
    'application/json',
    INCIDENTS_DRIVE_FOLDER_ID
  );
}

/**
 * Extends any Google Drive proxy images with an active Bearer Token to access 100% private Google Drive files server-side.
 */
export function getAuthenticatedDriveUrl(url: string | undefined, token: string | null): string {
  if (!url) return '';
  if (url.startsWith('/api/drive-image/')) {
    const activeToken = token || localStorage.getItem('google_drive_token');
    if (activeToken) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}token=${encodeURIComponent(activeToken)}`;
    }
  }
  return url;
}
