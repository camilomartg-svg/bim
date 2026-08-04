/**
 * Google Drive integration utilities via secure Google Apps Script Gateway.
 */

interface DriveUploadResult {
  id: string;
  webViewLink: string;
  url: string;
}

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyyLCpq_hpHt5Bwj6OL3LNDORhQDGLJGHXYM0Cacyqv0Y9T3tShij6-QCVLMPBleKOn/exec";

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
          base64: base64,
          mimeType: fileType,
          name: fileName
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
          base64: base64,
          mimeType: fileType,
          name: fileName
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

    const fileId = payload.id;
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


