/**
 * IncidenciasPanel - Panel lateral derecho de incidencias para visores 3D de nora
 * Incluye vista compacta de tarjetas y vista expandida con panel deslizable de dos pestañas:
 *  1. Detalles y Gestión (Acciones, datos completos, documentación y evidencia)
 *  2. Chat y Trazabilidad (Mensajes, notas de voz con micrófono, fotos y trazabilidad)
 */

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  category: "file" | "image" | "video" | "audio" | "bim_model" | "bim_view" | "plan_pdf" | "plan_dwg";
  driveFileId?: string;
  webViewLink?: string;
  isLocalPending?: boolean;
  viewpointData?: any;
  metadata?: any;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  attachments?: Attachment[];
}

export interface Issue {
  id: string;
  code: string;
  title: string;
  type: string;
  degreeOfAction?: "inmediata" | "urgente" | "pronta" | "posterior" | "menor" | "mayor" | "critica" | "no_aplica";
  impact?: string[];
  description: string;
  status: "ACTIVO" | "RESPONDIDA" | "RESUELTA" | "VENCIDA" | "RECHAZADA" | "ACUERDO" | "ANULADA" | "REVISION_RESPONSABLE";
  specialty?: string;
  suggestedAction?: string;
  projectImpact?: string;
  assignedPosition?: string;
  assignedName?: string;
  assignedEmail?: string;
  assignedTeam?: string;
  reviewers?: string[];
  reviewerEmails?: string[];
  creatorId?: string;
  creatorName?: string;
  creatorPosition?: string;
  creatorTeam?: string;
  authorEmail?: string;
  createdAt: string;
  updatedAt?: string;
  dueDate?: string;
  agreementDate?: string;
  rejectionReason?: string;
  attachments?: Attachment[];
  comments?: Comment[];
  redirectedTo?: {
    name: string;
    position: string;
    email: string;
    team?: string;
    at: string;
  };
  executor?: {
    name: string;
    position: string;
    email: string;
    team?: string;
    at: string;
    approved?: boolean;
    approvedAt?: string;
  };
  collaborators?: Array<{
    name: string;
    position?: string;
    email: string;
    at?: string;
  }>;
}

export type RoleFilter = 'responsible' | 'author' | 'reviewer' | 'all';
export type DrawerTab = 'details' | 'chat';

export interface IncidenciasPanelOptions {
  container: HTMLElement;
  companyId?: string;
  projectId?: string;
  driveFolderName?: string;
  currentUser?: any;
  getCompanyMembers?: () => any[];
  onLocateElement?: (issue: Issue) => void;
  onRestoreViewpoint?: (viewpointData: any) => void;
  captureCurrentView?: () => { name: string; thumbnail: string; viewpointData: any } | null;
  getSavedViews?: () => Array<{ id: string; title: string; previewImage?: string; viewpointData: any }>;
}

const DRIVE_GATEWAY_URL = 'https://script.google.com/macros/s/AKfycbx2RAQx_8K4o22xE0Mw-ETc7K_58vIoi6-PgVi64u80inuiw144ks3cgWSdCtXqIgB02g/exec';

// Global cache of resolved audio blob: URLs by driveFileId or attachmentId
const driveAudioBlobCache = new Map<string, string>();
const inFlightAudioDownloads = new Map<string, Promise<string>>();

export function extractDriveFileId(att: any): string {
  if (!att) return '';
  if (att.driveFileId && typeof att.driveFileId === 'string' && att.driveFileId.trim().length > 10) {
    return att.driveFileId.trim();
  }
  const candidates = [att.webViewLink, att.url, att.id].filter(Boolean) as string[];
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    const dMatch = raw.match(/\/file\/d\/([a-zA-Z0-9_-]{15,})/);
    if (dMatch && dMatch[1]) return dMatch[1];
    const idMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
    if (idMatch && idMatch[1]) return idMatch[1];
    if (raw.startsWith('/api/drive-image/')) {
      const part = raw.replace('/api/drive-image/', '').split('?')[0].trim();
      if (part.length > 10) return part;
    }
  }
  return '';
}

function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/[\s\r\n]/g, '');
  const binary = atob(clean);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function isPlayableDirectly(url?: string): boolean {
  if (!url) return false;
  if (url.startsWith('data:audio/')) return true;
  if (url.startsWith('blob:')) {
    for (const cached of driveAudioBlobCache.values()) {
      if (cached === url) return true;
    }
    return false;
  }
  if (url.includes('drive.google.com')) return false;
  if (/\.(mp3|wav|webm|m4a|ogg)(\?|$)/i.test(url)) return true;
  return false;
}

async function postToAppsScript(payload: any, timeoutMs = 45000): Promise<any> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(DRIVE_GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`Drive Gateway HTTP ${res.status}`);
    return await res.json();
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchDriveAudioAsBlobUrl(fileId: string, mimeType: string): Promise<string> {
  const cached = driveAudioBlobCache.get(fileId);
  if (cached) return cached;

  const existing = inFlightAudioDownloads.get(fileId);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const CHUNK_LIMIT = 3 * 1024 * 1024;
      let offset = 0;
      let total = 0;
      const parts: Uint8Array[] = [];

      while (true) {
        const res = await postToAppsScript({
          action: 'chunk',
          id: fileId,
          offset,
          limit: CHUNK_LIMIT
        }, 45000);

        if (!res || res.error || res.status === 'error' || !res.data) {
          throw new Error(res?.error || res?.message || 'No se pudo descargar el audio desde Drive.');
        }

        const chunkBytes = base64ToUint8Array(res.data);
        parts.push(chunkBytes);
        total = Number(res.total) || offset + chunkBytes.length;
        offset = Number(res.nextOffset) || offset + chunkBytes.length;

        if (res.done || offset >= total || chunkBytes.length === 0) {
          break;
        }
      }

      const cleanMime = (mimeType || 'audio/webm').split(';')[0].trim();
      const blob = new Blob(parts, { type: cleanMime });
      const blobUrl = URL.createObjectURL(blob);
      driveAudioBlobCache.set(fileId, blobUrl);
      return blobUrl;
    } finally {
      inFlightAudioDownloads.delete(fileId);
    }
  })();

  inFlightAudioDownloads.set(fileId, promise);
  return promise;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      resolve(res ? res.split(',')[1] : '');
    };
    reader.onerror = () => reject(new Error('Fallo al leer datos del archivo'));
    reader.readAsDataURL(blob);
  });
}

const folderResolvePromises = new Map<string, Promise<string>>();

async function resolveProjectFolderId(companyId: string, projectId: string, driveFolderName?: string): Promise<string> {
  if (projectId === 'nuevo-proyecto-1794663364994' || projectId?.includes('1794663364994') || (driveFolderName && driveFolderName.includes('ENSAYOS DE HS'))) {
    return '1Gotb8NKYre22k1p5LrvcuG23z79TvAMl';
  }

  const cacheKey = `nora_inc_folder_v3_${companyId}_${projectId}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached && cached.trim().length > 10) return cached.trim();
  } catch (_) {}

  const existing = folderResolvePromises.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await postToAppsScript({
        action: 'saveIncidentsProjectConfig',
        company: { id: companyId, name: companyId },
        companyName: companyId,
        project: { id: projectId, slug: projectId, name: driveFolderName || projectId },
        projectName: driveFolderName || projectId
      });
      const folderId = res?.storage?.projectFolderId || res?.projectFolderId;
      if (folderId && String(folderId).trim().length > 10) {
        const cleanId = String(folderId).trim();
        try { localStorage.setItem(cacheKey, cleanId); } catch (_) {}
        return cleanId;
      }
    } catch (err) {
      console.warn('[IncidenciasPanel] Error resolviendo carpeta de Drive:', err);
    }
    return '1Gotb8NKYre22k1p5LrvcuG23z79TvAMl';
  })();

  folderResolvePromises.set(cacheKey, promise);
  return promise;
}

async function uploadFileToDrive(
  file: File | Blob,
  fileName: string,
  fileType: string,
  folderId: string
): Promise<{ id: string; url: string; webViewLink: string }> {
  const cleanContentType = fileType || (fileName.endsWith('.mp4') ? 'video/mp4' : (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) ? 'image/jpeg' : 'application/octet-stream');

  // Large files (> 500 KB or videos): resumable upload session
  if (file.size > 500 * 1024 || cleanContentType.startsWith('video/')) {
    console.log(`[Drive Upload] Subiendo archivo grande ${fileName} (${(file.size / 1024 / 1024).toFixed(2)} MB)...`);
    const initRes = await postToAppsScript({
      action: 'initResumableUpload',
      folderId,
      filename: fileName,
      contentType: cleanContentType,
      totalBytes: file.size
    }, 45000);

    if (!initRes || !initRes.sessionUrl) {
      throw new Error(initRes?.message || 'No se pudo iniciar sesión resumible en Drive.');
    }

    let uploadedFileId = '';

    // Direct binary PUT attempt
    try {
      await fetch(`${initRes.sessionUrl}&%24httpMethod=PUT`, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: file
      });

      const lastSlice = file.slice(Math.max(0, file.size - 1), file.size);
      const lastBase64 = await blobToBase64(lastSlice);
      const finRes = await postToAppsScript({
        action: 'uploadResumableChunk',
        sessionUrl: initRes.sessionUrl,
        content: lastBase64,
        start: Math.max(0, file.size - 1),
        totalBytes: file.size,
        contentType: cleanContentType,
        filename: fileName,
        folderId,
        skipStatusRegister: true
      }, 45000);

      if (finRes?.fileId) {
        uploadedFileId = finRes.fileId;
      }
    } catch (e) {
      console.warn('[Drive Upload] Fallback a bloques resumibles:', e);
    }

    // Chunked fallback if direct binary didn't return fileId
    if (!uploadedFileId) {
      const fallbackInit = await postToAppsScript({
        action: 'initResumableUpload',
        folderId,
        filename: fileName,
        contentType: cleanContentType,
        totalBytes: file.size
      }, 45000);

      if (!fallbackInit || !fallbackInit.sessionUrl) {
        throw new Error('No se pudo reiniciar sesión resumible en Drive.');
      }

      const CHUNK_SIZE = 2 * 1024 * 1024;
      let offset = 0;
      while (offset < file.size) {
        const slice = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size));
        const chunkBase64 = await blobToBase64(slice);
        const chunkRes = await postToAppsScript({
          action: 'uploadResumableChunk',
          sessionUrl: fallbackInit.sessionUrl,
          content: chunkBase64,
          start: offset,
          totalBytes: file.size,
          contentType: cleanContentType,
          filename: fileName,
          folderId,
          skipStatusRegister: true
        }, 60000);

        if (chunkRes?.status === 'error') {
          throw new Error(chunkRes.message || 'Error en bloque de subida');
        }
        if (chunkRes?.fileId) {
          uploadedFileId = chunkRes.fileId;
        }
        offset += slice.size;
      }
    }

    if (!uploadedFileId) {
      throw new Error('Carga finalizada sin fileId.');
    }

    const webViewLink = `https://drive.google.com/file/d/${uploadedFileId}/view`;
    const isImage = cleanContentType.startsWith('image/');
    const renderUrl = isImage ? `https://drive.google.com/thumbnail?id=${uploadedFileId}&sz=w1600` : webViewLink;
    return { id: uploadedFileId, webViewLink, url: renderUrl };
  }

  // Small files <= 500 KB: direct base64 upload
  const base64 = await blobToBase64(file);
  const res = await postToAppsScript({
    action: 'uploadFile',
    content: base64,
    base64: base64,
    contentType: cleanContentType,
    mimeType: cleanContentType,
    filename: fileName,
    name: fileName,
    folderId
  }, 45000);

  if (!res || res.status === 'error' || res.error || !res.id) {
    throw new Error(res?.message || res?.error || 'Error subiendo archivo a Drive');
  }

  const webViewLink = res.webViewLink || `https://drive.google.com/file/d/${res.id}/view`;
  const isImage = cleanContentType.startsWith('image/');
  const renderUrl = isImage ? `https://drive.google.com/thumbnail?id=${res.id}&sz=w1600` : webViewLink;
  return { id: res.id, webViewLink, url: renderUrl };
}

function mergeAttachmentsList(localAtts: Attachment[] = [], remoteAtts: Attachment[] = []): Attachment[] {
  if (!localAtts.length) return remoteAtts;
  if (!remoteAtts.length) return localAtts;

  const map = new Map<string, Attachment>();
  for (const r of remoteAtts) {
    if (!r) continue;
    const key = r.id || r.name;
    map.set(key, { ...r });
  }
  for (const l of localAtts) {
    if (!l) continue;
    const key = l.id || l.name;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...l });
    } else {
      const merged: Attachment = {
        ...existing,
        ...l,
        driveFileId: l.driveFileId || existing.driveFileId,
        webViewLink: l.webViewLink || existing.webViewLink,
        url: (l.driveFileId && l.url && !l.url.startsWith('blob:'))
          ? l.url
          : (existing.url && !existing.url.startsWith('blob:'))
          ? existing.url
          : (l.url || existing.url),
        isLocalPending: (l.driveFileId || existing.driveFileId) ? false : Boolean(l.isLocalPending && existing.isLocalPending)
      };
      map.set(key, merged);
    }
  }
  return Array.from(map.values());
}

function mergeCommentsList(localComments: Comment[] = [], remoteComments: Comment[] = []): Comment[] {
  if (!localComments.length) return remoteComments;
  if (!remoteComments.length) return localComments;

  const map = new Map<string, Comment>();
  for (const r of remoteComments) {
    if (!r || !r.id) continue;
    map.set(r.id, { ...r });
  }
  for (const l of localComments) {
    if (!l || !l.id) continue;
    const existing = map.get(l.id);
    if (!existing) {
      map.set(l.id, { ...l });
    } else {
      map.set(l.id, {
        ...existing,
        ...l,
        attachments: mergeAttachmentsList(l.attachments || [], existing.attachments || [])
      });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  );
}

function mergeIssueWithLocalCache(localIssue: Issue | undefined, remoteIssue: Issue): Issue {
  if (!localIssue) return remoteIssue;

  const localTime = new Date(localIssue.updatedAt || localIssue.createdAt || 0).getTime();
  const remoteTime = new Date(remoteIssue.updatedAt || remoteIssue.createdAt || 0).getTime();
  const preferLocalBase = localTime > remoteTime;

  const base = preferLocalBase ? { ...remoteIssue, ...localIssue } : { ...localIssue, ...remoteIssue };
  const mergedComments = mergeCommentsList(localIssue.comments || [], remoteIssue.comments || []);
  const mergedAttachments = mergeAttachmentsList(localIssue.attachments || [], remoteIssue.attachments || []);

  return {
    ...base,
    comments: mergedComments,
    attachments: mergedAttachments
  };
}

export class IncidenciasPanel {
  private options: IncidenciasPanelOptions;
  private container: HTMLElement;
  private iframeMessageBound: boolean = false;
  private companyId: string;
  private projectId: string;
  private driveFolderName: string;
  private currentUser: any;
  private issues: Issue[] = [];
  private activeRole: RoleFilter = 'responsible';
  private searchTerm: string = '';
  private statusFilter: string = 'all';
  private selectedIssue: Issue | null = null;
  private activeDrawerTab: DrawerTab = 'details';
  private isExpanded: boolean = false;
  private isSyncing: boolean = false;
  private syncChannel: BroadcastChannel | null = null;
  private getCompanyMembers?: () => any[];
  private lastListScrollTop: number = 0;

  // Voice recording state
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioStream: MediaStream | null = null;
  private recordingTimer: number | null = null;
  private recordingSeconds: number = 0;
  private isRecording: boolean = false;

  constructor(options: IncidenciasPanelOptions) {
    this.options = options;
    this.container = options.container;
    this.companyId = options.companyId || '';
    this.projectId = options.projectId || '';
    this.driveFolderName = options.driveFolderName || '';
    this.currentUser = options.currentUser || this.resolveCurrentUser();
    this.getCompanyMembers = options.getCompanyMembers;

    this.resolveUrlContext();
    this.initBroadcastSync();
    this.loadFromLocalStorage();
    this.render();
  }

  public updateContext(companyId?: string, projectId?: string, driveFolderName?: string, user?: any) {
    if (companyId) this.companyId = companyId;
    if (projectId) this.projectId = projectId;
    if (driveFolderName) this.driveFolderName = driveFolderName;
    if (user) this.currentUser = user;
    this.loadFromLocalStorage();
    if (this.selectedIssue) {
      const refreshed = this.issues.find(i => i.id === this.selectedIssue!.id);
      if (refreshed) this.selectedIssue = refreshed;
    }
    this.render();
  }

  private openCreateIssueModal() {
    try {
      const u = this.currentUser || this.options.currentUser;
      if (u) {
        localStorage.setItem('userAccount', JSON.stringify(u));
      }
    } catch (e) {
      console.warn('[IncidenciasPanel] Could not sync userAccount to localStorage:', e);
    }

    let overlay = document.getElementById('nora-create-issue-modal-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'nora-create-issue-modal-overlay';
    overlay.className = 'nora-create-issue-overlay';
    overlay.innerHTML = `
      <div class="nora-create-issue-backdrop">
        <div class="nora-create-issue-container">
          <iframe id="nora-create-issue-iframe" 
                  src="../INCIDENCIAS/?empresa=${encodeURIComponent(this.companyId)}&project=${encodeURIComponent(this.projectId)}&driveFolderName=${encodeURIComponent(this.driveFolderName)}&embed=true&action=new&t=${Date.now()}"
                  allow="microphone; camera; display-capture"
                  class="nora-create-issue-iframe">
          </iframe>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    if (!this.iframeMessageBound) {
      this.iframeMessageBound = true;
      window.addEventListener('message', (event: MessageEvent) => {
        if (!event.data || typeof event.data !== 'object') return;

        if (event.data.type === 'NORA_CLOSE_CREATE_ISSUE') {
          const ov = document.getElementById('nora-create-issue-modal-overlay');
          if (ov) {
            ov.classList.add('closing');
            setTimeout(() => ov.remove(), 200);
          }
        } else if (event.data.type === 'NORA_REQUEST_BIM_VIEW') {
          const iframe = document.getElementById('nora-create-issue-iframe') as HTMLIFrameElement;
          if (iframe && iframe.contentWindow) {
            const currentView = this.options.captureCurrentView ? this.options.captureCurrentView() : null;
            const savedViews = this.options.getSavedViews ? this.options.getSavedViews() : [];
            iframe.contentWindow.postMessage({
              type: 'NORA_RECEIVE_BIM_VIEW',
              currentView,
              savedViews
            }, '*');
          }
        } else if (event.data.type === 'NORA_ISSUE_CREATED') {
          const ov = document.getElementById('nora-create-issue-modal-overlay');
          if (ov) {
            ov.classList.add('closing');
            setTimeout(() => ov.remove(), 200);
          }
          this.syncWithDrive();
          this.showToast('✅ Hallazgo emitido y registrado exitosamente');
          if (event.data.issue?.id) {
            setTimeout(() => {
              const created = this.issues.find(i => i.id === event.data.issue.id) || event.data.issue;
              this.selectedIssue = created;
              this.isExpanded = true;
              this.render();
            }, 600);
          }
        }
      });
    }
  }

  private resolveUrlContext() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (!this.companyId) this.companyId = params.get('empresa') || params.get('companyId') || '';
      if (!this.projectId) this.projectId = params.get('project') || params.get('projectId') || '';
      if (!this.driveFolderName) this.driveFolderName = params.get('driveFolderName') || params.get('projectName') || '';
    } catch (_) {}
  }

  private resolveCurrentUser(): any {
    try {
      const raw = sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount');
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  private mergeIncomingIncidents(incomingList: Issue[]) {
    const updated = incomingList.map(remote => {
      const local = this.issues.find(i => i.id === remote.id);
      if (!local) return remote;
      return mergeIssueWithLocalCache(local, remote);
    });

    for (const local of this.issues) {
      if (!updated.some(u => u.id === local.id)) {
        updated.push(local);
      }
    }

    this.issues = updated;
    if (this.selectedIssue) {
      const refreshed = this.issues.find(i => i.id === this.selectedIssue!.id);
      if (refreshed) this.selectedIssue = refreshed;
    }
    this.render();
  }

  private initBroadcastSync() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.syncChannel = new BroadcastChannel('nora_incidents_sync');
        this.syncChannel.onmessage = (event) => {
          if (event.data && (!event.data.companyId || event.data.companyId === this.companyId)) {
            if (Array.isArray(event.data.incidents)) {
              this.mergeIncomingIncidents(event.data.incidents);
            }
          }
        };
      }

      window.addEventListener('nora_incidents_updated', (e: any) => {
        if (e.detail && Array.isArray(e.detail.incidents)) {
          this.mergeIncomingIncidents(e.detail.incidents);
        } else {
          this.loadFromLocalStorage();
          this.render();
        }
      });
    } catch (err) {
      console.warn('[IncidenciasPanel] Sync channel init warning:', err);
    }
  }

  public loadFromLocalStorage() {
    if (!this.companyId || !this.projectId) this.resolveUrlContext();
    const key = `nora_incidents_${this.companyId}_${this.projectId}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.issues = parsed;
          return;
        }
      }
    } catch (_) {}

    // Fallback: search any nora_incidents_ key
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('nora_incidents_')) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              this.issues = parsed;
              return;
            }
          }
        }
      }
    } catch (_) {}
  }

  private persistAndBroadcast(updatedIssues: Issue[], currentIssue?: Issue) {
    this.issues = updatedIssues;
    if (currentIssue) this.selectedIssue = currentIssue;

    const key = `nora_incidents_${this.companyId}_${this.projectId}`;
    try {
      localStorage.setItem(key, JSON.stringify(this.issues));
    } catch (_) {}

    try {
      if (this.syncChannel) {
        this.syncChannel.postMessage({
          companyId: this.companyId,
          projectId: this.projectId,
          incidents: this.issues
        });
      }
      window.dispatchEvent(new CustomEvent('nora_incidents_updated', {
        detail: { incidents: this.issues, companyId: this.companyId, projectId: this.projectId }
      }));
    } catch (_) {}

    // Sync in background to Drive if issue updated
    if (currentIssue) {
      this.syncIncidentToDrive(currentIssue);
    }
  }

  private async syncIncidentToDrive(issue: Issue) {
    try {
      const folderId = await resolveProjectFolderId(this.companyId, this.projectId, this.driveFolderName);
      // Clean issue of any giant base64 data URLs in case one slipped in
      const sanitized = {
        ...issue,
        updatedAt: new Date().toISOString(),
        attachments: (issue.attachments || []).map(att => {
          if (att.url && att.url.startsWith('data:') && att.url.length > 50000) {
            return { ...att, url: att.webViewLink || (att.driveFileId ? `https://drive.google.com/file/d/${att.driveFileId}/view` : '') };
          }
          return att;
        }),
        comments: (issue.comments || []).map(cmt => ({
          ...cmt,
          attachments: (cmt.attachments || []).map(att => {
            if (att.url && att.url.startsWith('data:') && att.url.length > 50000) {
              return { ...att, url: att.webViewLink || (att.driveFileId ? `https://drive.google.com/file/d/${att.driveFileId}/view` : '') };
            }
            return att;
          })
        }))
      };

      const jsonStr = JSON.stringify(sanitized, null, 2);
      const utf8Bytes = new TextEncoder().encode(jsonStr);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < utf8Bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, Array.from(utf8Bytes.subarray(i, i + chunkSize)));
      }
      const base64 = btoa(binary);
      const filename = `incidencia_${issue.id}.json`;

      await postToAppsScript({
        action: 'uploadFile',
        folderId,
        filename,
        name: filename,
        contentType: 'application/json',
        mimeType: 'application/json',
        content: base64,
        base64: base64
      }, 35000);
    } catch (err) {
      console.warn('[IncidenciasPanel] Remote background sync error:', err);
    }
  }

  public async syncWithDrive() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.render();

    try {
      const params = new URLSearchParams({
        action: 'listIncidents',
        companyId: this.companyId,
        projectId: this.projectId,
        driveFolderName: this.driveFolderName
      });

      const res = await fetch(`${DRIVE_GATEWAY_URL}?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.incidents)) {
          this.issues = data.incidents;
          const key = `nora_incidents_${this.companyId}_${this.projectId}`;
          try {
            localStorage.setItem(key, JSON.stringify(this.issues));
          } catch (_) {}
          if (this.selectedIssue) {
            const refreshed = this.issues.find(i => i.id === this.selectedIssue!.id);
            if (refreshed) this.selectedIssue = refreshed;
          }
        }
      }
    } catch (err) {
      console.warn('[IncidenciasPanel] Remote sync warning, using local cache:', err);
    } finally {
      this.isSyncing = false;
      this.render();
    }
  }

  private filterByRole(issue: Issue, role: RoleFilter): boolean {
    const user = this.currentUser;
    const userEmail = (user?.email || user?.username || '').toLowerCase().trim();
    const userName = (user?.name || '').toLowerCase().trim();
    const userPosUpper = (user?.position || '').trim().toUpperCase();

    if (role === 'all') return true;

    if (role === 'author') {
      const matchEmail = Boolean(userEmail && issue.authorEmail && issue.authorEmail.toLowerCase().trim() === userEmail);
      const matchId = Boolean(user?.id && issue.creatorId && issue.creatorId === user.id);
      const matchName = Boolean(userName && issue.creatorName && issue.creatorName.toLowerCase().trim() === userName);
      return matchEmail || matchId || matchName;
    }

    if (role === 'responsible') {
      const issuePosUpper = (issue.assignedPosition || '').trim().toUpperCase();
      const isDirDeObraUser = userPosUpper.includes('DIRECTOR DE OBRA');
      const isDirDeObraIssue = issuePosUpper.includes('DIRECTOR DE OBRA');

      const matchEmail = Boolean(userEmail && (
        (issue.assignedEmail && issue.assignedEmail.toLowerCase().trim() === userEmail) ||
        (issue.redirectedTo?.email && issue.redirectedTo.email.toLowerCase().trim() === userEmail) ||
        (issue.executor?.email && issue.executor.email.toLowerCase().trim() === userEmail)
      ));

      const matchPos = Boolean(userPosUpper && issuePosUpper === userPosUpper) || (isDirDeObraUser && isDirDeObraIssue);
      const matchName = Boolean(userName && issue.assignedName && issue.assignedName.toLowerCase().trim() === userName);

      return matchEmail || matchPos || matchName;
    }

    if (role === 'reviewer') {
      const matchReviewerEmail = Boolean(userEmail && issue.reviewerEmails && issue.reviewerEmails.some(e => e.toLowerCase().trim() === userEmail));
      const matchReviewerList = Boolean(Array.isArray(issue.reviewers) && issue.reviewers.some(r => {
        const rLower = (r || '').toLowerCase().trim();
        return (userEmail && rLower === userEmail) || (userPosUpper && r.toUpperCase() === userPosUpper);
      }));

      return matchReviewerEmail || matchReviewerList;
    }

    return true;
  }

  private getCounts(): Record<RoleFilter, number> {
    const counts: Record<RoleFilter, number> = { responsible: 0, author: 0, reviewer: 0, all: 0 };
    for (const issue of this.issues) {
      if (issue.status === 'ANULADA') continue;
      counts.all++;
      if (this.filterByRole(issue, 'responsible')) counts.responsible++;
      if (this.filterByRole(issue, 'author')) counts.author++;
      if (this.filterByRole(issue, 'reviewer')) counts.reviewer++;
    }
    return counts;
  }

  private getFilteredIssues(): Issue[] {
    const q = this.searchTerm.toLowerCase().trim();
    return this.issues.filter(issue => {
      if (issue.status === 'ANULADA' && this.statusFilter !== 'ANULADA') return false;
      if (!this.filterByRole(issue, this.activeRole)) return false;

      if (this.statusFilter !== 'all') {
        if (this.statusFilter === 'ACTIVAS') {
          if (issue.status !== 'ACTIVO' && issue.status !== 'RESPONDIDA' && issue.status !== 'REVISION_RESPONSABLE') return false;
        } else if (issue.status !== this.statusFilter) {
          return false;
        }
      }

      if (q) {
        const codeMatch = issue.code?.toLowerCase().includes(q);
        const titleMatch = issue.title?.toLowerCase().includes(q);
        const descMatch = (issue.description || '').toLowerCase().includes(q);
        const specMatch = (issue.specialty || '').toLowerCase().includes(q);
        const posMatch = (issue.assignedPosition || '').toLowerCase().includes(q);
        const nameMatch = (issue.assignedName || '').toLowerCase().includes(q);
        if (!codeMatch && !titleMatch && !descMatch && !specMatch && !posMatch && !nameMatch) return false;
      }
      return true;
    });
  }

  private formatDate(isoString?: string): string {
    if (!isoString) return '--/--';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month} ${hours}:${mins}`;
    } catch (_) {
      return isoString;
    }
  }

  private formatDueDate(dueStr?: string): { text: string; colorClass: string; icon: string } {
    if (!dueStr) return { text: 'SIN VENCIMIENTO', colorClass: 'text-slate', icon: 'event' };
    try {
      const due = new Date(dueStr);
      if (isNaN(due.getTime())) return { text: dueStr, colorClass: 'text-slate', icon: 'event' };
      const now = new Date();
      const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const day = String(due.getDate()).padStart(2, '0');
      const month = String(due.getMonth() + 1).padStart(2, '0');
      const year = String(due.getFullYear()).slice(-2);

      if (diffDays < 0) {
        return { text: `VENCE ${day}/${month}/${year} (VENCIDA)`, colorClass: 'text-danger', icon: 'error' };
      } else if (diffDays <= 2) {
        return { text: `VENCE ${day}/${month}/${year} (${diffDays}d)`, colorClass: 'text-warning', icon: 'schedule' };
      } else {
        return { text: `VENCE ${day}/${month}/${year}`, colorClass: 'text-success', icon: 'check_circle' };
      }
    } catch (_) {
      return { text: dueStr, colorClass: 'text-slate', icon: 'event' };
    }
  }

  private getDegreeBadge(degree?: string): { label: string; dotColor: string; textColor: string } {
    const d = (degree || '').toLowerCase();
    switch (d) {
      case 'inmediata':
      case 'critica':
        return { label: 'INMEDIATA', dotColor: '#ef4444', textColor: '#dc2626' };
      case 'urgente':
      case 'mayor':
        return { label: 'URGENTE', dotColor: '#f59e0b', textColor: '#d97706' };
      case 'pronta':
        return { label: 'PRONTA', dotColor: '#3b82f6', textColor: '#2563eb' };
      case 'posterior':
      case 'menor':
        return { label: 'POSTERIOR', dotColor: '#10b981', textColor: '#059669' };
      default:
        return { label: (degree || 'NORMAL').toUpperCase(), dotColor: '#94a3b8', textColor: '#64748b' };
    }
  }

  private getStatusBadge(status?: string): { label: string; bg: string; text: string; border: string } {
    switch (status) {
      case 'ACTIVO':
        return { label: 'ACTIVO', bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' };
      case 'RESPONDIDA':
      case 'REVISION_RESPONSABLE':
        return { label: 'RESPONDIDA', bg: '#fef3c7', text: '#b45309', border: '#fde68a' };
      case 'RESUELTA':
        return { label: 'RESUELTA', bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' };
      case 'VENCIDA':
        return { label: 'VENCIDA', bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' };
      case 'RECHAZADA':
        return { label: 'RECHAZADA', bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff' };
      case 'ACUERDO':
        return { label: 'ACUERDO', bg: '#ffedd5', text: '#c2410c', border: '#fed7aa' };
      case 'ANULADA':
        return { label: 'ANULADA', bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' };
      default:
        return { label: status || 'ACTIVO', bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
    }
  }

  public render() {
    if (!this.container) return;

    // Preserve scroll position before wiping innerHTML
    const currentList = this.container.querySelector<HTMLElement>('#nora-inc-list-container');
    if (currentList) {
      this.lastListScrollTop = currentList.scrollTop;
    }

    const counts = this.getCounts();
    const filtered = this.getFilteredIssues();
    const hasSelection = Boolean(this.selectedIssue);

    // Synchronize container and properties-panel class for expanded width
    const rightPanel = document.getElementById('properties-panel');
    if (rightPanel) {
      if (hasSelection || this.isExpanded) {
        rightPanel.classList.add('incidencias-expanded');
      } else {
        rightPanel.classList.remove('incidencias-expanded');
      }
    }

    this.container.innerHTML = `
      <div class="nora-inc-split-container ${hasSelection ? 'has-drawer' : ''}">
        <!-- Left Pane: Cards List -->
        <div class="nora-inc-list-pane">
          <div class="nora-inc-header">
            <div class="nora-inc-title-row">
              <div class="nora-inc-title">
                <span class="material-symbols-outlined" style="color: #f59e0b; font-size: 20px;">assignment_late</span>
                <span>Incidencias</span>
              </div>
              <div class="nora-inc-actions">
                <button class="nora-inc-btn-icon ${this.isSyncing ? 'spinning' : ''}" id="btn-inc-sync" title="Sincronizar con Drive">
                  <span class="material-symbols-outlined" style="font-size: 17px;">sync</span>
                </button>
                <button class="nora-inc-btn-icon" id="btn-inc-toggle-expand" title="${this.isExpanded ? 'Contraer panel' : 'Expandir panel'}">
                  <span class="material-symbols-outlined" style="font-size: 17px;">${this.isExpanded ? 'close_fullscreen' : 'open_in_full'}</span>
                </button>
                <button type="button" 
                        class="nora-inc-new-btn" 
                        id="btn-inc-new-hallazgo" 
                        title="Registrar nuevo hallazgo en el visor">
                  <span class="material-symbols-outlined" style="font-size: 16px;">add</span>
                  <span>Hallazgo</span>
                </button>
              </div>
            </div>

            <!-- Role Subtabs (AUTOR | RESPONSABLE | REVISOR | TODAS) -->
            <div class="nora-inc-role-tabs">
              <button class="nora-inc-role-tab ${this.activeRole === 'responsible' ? 'active' : ''}" data-role="responsible">
                <span>RESPONSABLE</span>
                <span class="nora-inc-tab-badge">${counts.responsible}</span>
              </button>
              <button class="nora-inc-role-tab ${this.activeRole === 'author' ? 'active' : ''}" data-role="author">
                <span>AUTOR</span>
                <span class="nora-inc-tab-badge">${counts.author}</span>
              </button>
              <button class="nora-inc-role-tab ${this.activeRole === 'reviewer' ? 'active' : ''}" data-role="reviewer">
                <span>REVISOR</span>
                <span class="nora-inc-tab-badge">${counts.reviewer}</span>
              </button>
              <button class="nora-inc-role-tab ${this.activeRole === 'all' ? 'active' : ''}" data-role="all" title="Ver todas las incidencias">
                <span>TODAS</span>
                <span class="nora-inc-tab-badge">${counts.all}</span>
              </button>
            </div>

            <!-- Search and Filter bar -->
            <div class="nora-inc-search-bar">
              <div class="nora-inc-input-wrapper">
                <span class="material-symbols-outlined" style="font-size: 17px; color: #94a3b8;">search</span>
                <input type="text" id="nora-inc-search" placeholder="Buscar código, título, especialidad..." value="${escapeHtml(this.searchTerm)}" />
                ${this.searchTerm ? `<button type="button" id="nora-inc-clear-search" class="nora-inc-clear-btn">✕</button>` : ''}
              </div>
              <select id="nora-inc-status-select" class="nora-inc-select">
                <option value="all" ${this.statusFilter === 'all' ? 'selected' : ''}>Todos</option>
                <option value="ACTIVAS" ${this.statusFilter === 'ACTIVAS' ? 'selected' : ''}>Activas</option>
                <option value="ACTIVO" ${this.statusFilter === 'ACTIVO' ? 'selected' : ''}>Activo</option>
                <option value="RESPONDIDA" ${this.statusFilter === 'RESPONDIDA' ? 'selected' : ''}>Respondida</option>
                <option value="RESUELTA" ${this.statusFilter === 'RESUELTA' ? 'selected' : ''}>Resuelta</option>
                <option value="VENCIDA" ${this.statusFilter === 'VENCIDA' ? 'selected' : ''}>Vencida</option>
                <option value="RECHAZADA" ${this.statusFilter === 'RECHAZADA' ? 'selected' : ''}>Rechazada</option>
                <option value="ACUERDO" ${this.statusFilter === 'ACUERDO' ? 'selected' : ''}>Acuerdo</option>
              </select>
            </div>
          </div>

          <!-- Cards List -->
          <div class="nora-inc-list" id="nora-inc-list-container">
            ${filtered.length === 0 ? this.renderEmptyState() : filtered.map(issue => this.renderIssueCard(issue)).join('')}
          </div>
        </div>

        <!-- Right Sliding Drawer: Details & Chat -->
        <div class="nora-inc-detail-drawer ${hasSelection ? 'open' : ''}" id="nora-inc-detail-drawer">
          ${this.selectedIssue ? this.renderDetailDrawer(this.selectedIssue) : this.renderDrawerPlaceholder()}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderEmptyState(): string {
    const roleNames: Record<RoleFilter, string> = {
      responsible: 'como Responsable',
      author: 'como Autor',
      reviewer: 'como Revisor',
      all: 'en este proyecto'
    };

    return `
      <div class="nora-inc-empty">
        <div class="nora-inc-empty-icon">
          <span class="material-symbols-outlined" style="font-size: 38px; color: #94a3b8;">assignment_turned_in</span>
        </div>
        <div class="nora-inc-empty-title">Sin incidencias ${roleNames[this.activeRole]}</div>
        <div class="nora-inc-empty-desc">
          ${this.searchTerm || this.statusFilter !== 'all' 
            ? 'No hay registros que coincidan con los filtros de búsqueda aplicados.' 
            : 'No tienes incidencias pendientes asociadas bajo este rol en este momento.'}
        </div>
        <button type="button" class="nora-inc-refresh-btn" id="btn-inc-empty-refresh">
          <span class="material-symbols-outlined" style="font-size: 16px;">refresh</span>
          <span>Actualizar datos</span>
        </button>
      </div>
    `;
  }

  private renderDrawerPlaceholder(): string {
    return `
      <div class="nora-inc-drawer-empty">
        <span class="material-symbols-outlined" style="font-size: 48px; color: #cbd5e1;">chrome_reader_mode</span>
        <div style="font-size: 14px; font-weight: 700; color: #475569;">Selecciona una Incidencia</div>
        <div style="font-size: 12px; color: #94a3b8; max-width: 240px; text-align: center;">
          Haz clic en cualquier tarjeta de la izquierda para ver sus detalles, gestionar acciones o abrir el chat.
        </div>
      </div>
    `;
  }

  private renderIssueCard(issue: Issue): string {
    const statusB = this.getStatusBadge(issue.status);
    const degreeB = this.getDegreeBadge(issue.degreeOfAction);
    const dueInfo = this.formatDueDate(issue.dueDate);
    const createdStr = this.formatDate(issue.createdAt);
    const attCount = issue.attachments?.length || 0;
    const cmtCount = issue.comments?.length || 0;
    const isSelected = this.selectedIssue?.id === issue.id;
    const processOrSpec = issue.specialty || issue.assignedTeam || 'PROCESO AUDITADO';

    return `
      <div class="nora-inc-card ${isSelected ? 'selected' : ''}" data-issue-id="${escapeHtml(issue.id)}">
        <!-- Top Tags Row -->
        <div class="nora-inc-card-tags">
          <div class="nora-inc-code-badge" title="Código de incidencia">${escapeHtml(issue.code || 'GEN')}</div>
          
          <div class="nora-inc-status-badge" style="background: ${statusB.bg}; color: ${statusB.text}; border-color: ${statusB.border};">
            ${escapeHtml(statusB.label)}
          </div>

          ${issue.type ? `
            <div class="nora-inc-type-badge" title="${escapeHtml(issue.type)}">
              ${escapeHtml(issue.type)}
            </div>
          ` : ''}

          <div class="nora-inc-degree-badge" style="color: ${degreeB.textColor};" title="Grado de acción: ${escapeHtml(degreeB.label)}">
            <span class="nora-inc-dot" style="background: ${degreeB.dotColor};"></span>
            <span>${escapeHtml(degreeB.label)}</span>
          </div>
        </div>

        <!-- Title -->
        <div class="nora-inc-card-title">${escapeHtml(issue.title || 'Incidencia sin título')}</div>

        <!-- Description Snippet -->
        ${issue.description ? `
          <div class="nora-inc-card-desc">${escapeHtml(issue.description)}</div>
        ` : ''}

        <!-- Meta Information -->
        <div class="nora-inc-card-meta">
          <div class="nora-inc-meta-item">
            <span class="material-symbols-outlined" style="font-size: 15px; color: #64748b;">person</span>
            <div class="nora-inc-meta-text">
              <span class="nora-inc-meta-label">${escapeHtml(issue.assignedName || issue.assignedPosition || 'Sin asignar')}</span>
              <span class="nora-inc-meta-sub">${escapeHtml(processOrSpec)}</span>
            </div>
          </div>

          <div class="nora-inc-meta-row-times">
            <div class="nora-inc-time-chip" title="Fecha de creación">
              <span class="material-symbols-outlined" style="font-size: 14px;">schedule</span>
              <span>${createdStr}</span>
            </div>
            
            <div class="nora-inc-time-chip ${dueInfo.colorClass}" title="${dueInfo.text}">
              <span class="material-symbols-outlined" style="font-size: 14px;">${dueInfo.icon}</span>
              <span>${dueInfo.text}</span>
            </div>
          </div>
        </div>

        <!-- Footer Actions & Evidence counts -->
        <div class="nora-inc-card-footer">
          <div class="nora-inc-evidence-counts">
            ${attCount > 0 ? `
              <span class="nora-inc-count-pill" title="${attCount} adjuntos (fotos/videos/archivos)">
                <span class="material-symbols-outlined" style="font-size: 13px;">attach_file</span>
                <span>${attCount}</span>
              </span>
            ` : ''}
            ${cmtCount > 0 ? `
              <span class="nora-inc-count-pill" title="${cmtCount} notas o mensajes en chat">
                <span class="material-symbols-outlined" style="font-size: 13px;">chat</span>
                <span>${cmtCount}</span>
              </span>
            ` : ''}
          </div>

          <div class="nora-inc-card-btns">
            <button type="button" class="nora-inc-manage-btn" data-issue-id="${escapeHtml(issue.id)}" title="Gestionar incidencia en panel deslizable">
              <span>Gestionar</span>
              <span class="material-symbols-outlined" style="font-size: 14px;">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderDetailDrawer(issue: Issue): string {
    const statusB = this.getStatusBadge(issue.status);
    const degreeB = this.getDegreeBadge(issue.degreeOfAction);
    const openUrl = `../INCIDENCIAS/?empresa=${encodeURIComponent(this.companyId)}&project=${encodeURIComponent(this.projectId)}&driveFolderName=${encodeURIComponent(this.driveFolderName)}&issueId=${encodeURIComponent(issue.id)}`;
    const comments = issue.comments || [];

    return `
      <div class="nora-inc-drawer-inner">
        <!-- Drawer Header -->
        <div class="nora-inc-drawer-header">
          <div class="nora-inc-drawer-top-bar">
            <button type="button" class="nora-inc-drawer-back-btn" id="btn-drawer-close" title="Cerrar detalle">
              <span class="material-symbols-outlined" style="font-size: 18px;">arrow_back</span>
              <span class="drawer-back-text">Volver</span>
            </button>
            <div class="nora-inc-drawer-badges">
              <div class="nora-inc-code-badge">${escapeHtml(issue.code || 'GEN')}</div>
              <div class="nora-inc-status-badge" style="background: ${statusB.bg}; color: ${statusB.text}; border-color: ${statusB.border};">
                ${escapeHtml(statusB.label)}
              </div>
              <div class="nora-inc-degree-badge" style="color: ${degreeB.textColor};">
                <span class="nora-inc-dot" style="background: ${degreeB.dotColor};"></span>
                <span>${escapeHtml(degreeB.label)}</span>
              </div>
            </div>
            <a href="${openUrl}" target="_blank" class="nora-inc-btn-icon" title="Abrir en pestaña completa de Incidencias">
              <span class="material-symbols-outlined" style="font-size: 16px;">open_in_new</span>
            </a>
          </div>

          <div class="nora-inc-drawer-title">${escapeHtml(issue.title || 'Incidencia')}</div>

          <!-- Drawer Two Main Tabs: DETALLES Y GESTIÓN vs CHAT Y TRAZABILIDAD -->
          <div class="nora-inc-drawer-tabs">
            <button class="nora-inc-drawer-tab ${this.activeDrawerTab === 'details' ? 'active' : ''}" data-dtab="details">
              <span class="material-symbols-outlined" style="font-size: 16px;">tune</span>
              <span>DETALLES Y GESTIÓN</span>
            </button>
            <button class="nora-inc-drawer-tab ${this.activeDrawerTab === 'chat' ? 'active' : ''}" data-dtab="chat">
              <span class="material-symbols-outlined" style="font-size: 16px;">forum</span>
              <span>CHAT Y TRAZABILIDAD</span>
              ${comments.length > 0 ? `<span class="nora-inc-tab-badge">${comments.length}</span>` : ''}
            </button>
          </div>
        </div>

        <!-- Drawer Body -->
        <div class="nora-inc-drawer-body">
          ${this.activeDrawerTab === 'details' ? this.renderDetailsTab(issue) : this.renderChatTab(issue)}
        </div>
      </div>
    `;
  }

  private renderDetailsTab(issue: Issue): string {
    const dueInfo = this.formatDueDate(issue.dueDate);
    const createdStr = this.formatDate(issue.createdAt);
    const attachments = issue.attachments || [];

    return `
      <div class="nora-inc-tab-content">
        <!-- 1. GESTIÓN DE ACCIONES (Botones idénticos a los de afuera) -->
        <div class="nora-inc-section">
          <div class="nora-inc-section-title">
            <span class="material-symbols-outlined" style="font-size: 15px; color: #2563eb;">flash_on</span>
            <span>GESTIÓN DE ACCIONES</span>
          </div>

          <div class="nora-inc-actions-grid">
            <button type="button" class="nora-act-btn act-colab" data-act="colab" title="Agregar colaborador a la incidencia">
              <span class="material-symbols-outlined" style="font-size: 14px;">group_add</span>
              <span>AGREGAR COLABORADOR</span>
            </button>

            <button type="button" class="nora-act-btn act-exec" data-act="exec" title="Redirigir incidencia a ejecutor">
              <span class="material-symbols-outlined" style="font-size: 14px;">swap_horiz</span>
              <span>REDIRIGIR A EJECUTOR</span>
            </button>

            <button type="button" class="nora-act-btn act-resp" data-act="resp" title="Reasignar responsable de la incidencia">
              <span class="material-symbols-outlined" style="font-size: 14px;">person_outline</span>
              <span>REASIGNAR RESPONSABLE</span>
            </button>

            <button type="button" class="nora-act-btn act-finish" data-act="finish" title="Finalizar respuesta técnica">
              <span class="material-symbols-outlined" style="font-size: 14px;">verified</span>
              <span>FINALIZAR RESPUESTA TÉCNICA</span>
            </button>

            <button type="button" class="nora-act-btn act-resolve" data-act="resolve" title="Cerrar y marcar como resuelta">
              <span class="material-symbols-outlined" style="font-size: 14px;">check_circle</span>
              <span>RESUELTA Y CERRADA</span>
            </button>

            <button type="button" class="nora-act-btn act-reject" data-act="reject" title="Rechazar respuesta de la incidencia">
              <span class="material-symbols-outlined" style="font-size: 14px;">cancel</span>
              <span>RECHAZAR RESPUESTA</span>
            </button>

            <button type="button" class="nora-act-btn act-agreement" data-act="agreement" title="Establecer fecha de acuerdo">
              <span class="material-symbols-outlined" style="font-size: 14px;">handshake</span>
              <span>ESTABLECER ACUERDO</span>
            </button>

            <button type="button" class="nora-act-btn act-cancel" data-act="cancel" title="Anular incidencia">
              <span class="material-symbols-outlined" style="font-size: 14px;">block</span>
              <span>ANULAR INCIDENCIA</span>
            </button>
          </div>
        </div>

        <!-- 2. DATOS COMPLETOS -->
        <div class="nora-inc-section">
          <div class="nora-inc-section-title">
            <span class="material-symbols-outlined" style="font-size: 15px; color: #475569;">info</span>
            <span>INFORMACIÓN COMPLETA</span>
          </div>

          <div class="nora-inc-info-card">
            <div class="nora-inc-info-row">
              <span class="nora-inc-info-lbl">Descripción:</span>
              <span class="nora-inc-info-val">${escapeHtml(issue.description || 'Sin descripción')}</span>
            </div>

            ${issue.suggestedAction ? `
              <div class="nora-inc-info-row">
                <span class="nora-inc-info-lbl">Acción Correctiva Sugerida:</span>
                <span class="nora-inc-info-val">${escapeHtml(issue.suggestedAction)}</span>
              </div>
            ` : ''}

            ${issue.projectImpact ? `
              <div class="nora-inc-info-row">
                <span class="nora-inc-info-lbl">Afectación del Proyecto:</span>
                <span class="nora-inc-info-val">${escapeHtml(issue.projectImpact)}</span>
              </div>
            ` : ''}

            <div class="nora-inc-info-row">
              <span class="nora-inc-info-lbl">Proceso Auditado / Especialidad:</span>
              <span class="nora-inc-info-val">${escapeHtml(issue.specialty || issue.assignedTeam || 'General')}</span>
            </div>

            <div class="nora-inc-info-row">
              <span class="nora-inc-info-lbl">Responsable Asignado:</span>
              <span class="nora-inc-info-val">${escapeHtml(issue.assignedName || issue.assignedPosition || 'Sin asignar')} (${escapeHtml(issue.assignedEmail || 'Sin correo')})</span>
            </div>

            <div class="nora-inc-info-row">
              <span class="nora-inc-info-lbl">Autor / Creador:</span>
              <span class="nora-inc-info-val">${escapeHtml(issue.creatorName || issue.authorEmail || 'Autor')}</span>
            </div>

            <div class="nora-inc-info-row">
              <span class="nora-inc-info-lbl">Fecha de Creación:</span>
              <span class="nora-inc-info-val">${createdStr}</span>
            </div>

            <div class="nora-inc-info-row">
              <span class="nora-inc-info-lbl">Vencimiento:</span>
              <span class="nora-inc-info-val ${dueInfo.colorClass}">${dueInfo.text}</span>
            </div>
          </div>
        </div>

        <!-- 3. DOCUMENTACIÓN Y EVIDENCIA (Soporte Técnico y Anexos) -->
        <div class="nora-inc-section">
          <div class="nora-inc-section-title-row">
            <div class="nora-inc-section-title">
              <span class="material-symbols-outlined" style="font-size: 15px; color: #059669;">attachment</span>
              <span>DOCUMENTACIÓN Y EVIDENCIA (${attachments.length})</span>
            </div>
            <label class="nora-inc-upload-btn" title="Cargar foto, video o documento local">
              <span class="material-symbols-outlined" style="font-size: 14px;">upload_file</span>
              <span>+ Cargar Local</span>
              <input type="file" id="nora-doc-file-input" style="display: none;" multiple accept="image/*,video/*,audio/*,application/pdf" />
            </label>
          </div>

          <div class="nora-inc-docs-grid">
            ${attachments.length === 0 ? `
              <div class="nora-inc-no-docs">
                <span class="material-symbols-outlined" style="font-size: 26px; color: #cbd5e1;">folder_open</span>
                <span>Sin documentación vinculada actualmente</span>
              </div>
            ` : attachments.map(att => this.renderAttachmentItem(att)).join('')}
          </div>
        </div>
      </div>
    `;
  }

  private renderAttachmentItem(att: Attachment): string {
    const isBimView = att.category === 'bim_view' || !!(att as any).viewpointData;
    const isImage = !isBimView && (att.category === 'image' || att.type?.includes('image'));
    const isVideo = !isBimView && (att.category === 'video' || att.type?.includes('video'));
    const isAudio = !isBimView && (att.category === 'audio' || att.type?.includes('audio') || (att.name && /\.(mp3|wav|webm|m4a|ogg)$/i.test(att.name)));
    const url = att.url || att.webViewLink || (att.driveFileId ? `https://drive.google.com/file/d/${att.driveFileId}/view` : '#');
    const fileId = extractDriveFileId(att);
    const cachedBlob = (fileId && driveAudioBlobCache.get(fileId)) || (att.id && driveAudioBlobCache.get(att.id));
    const directPlayable = cachedBlob || (isPlayableDirectly(att.url) ? att.url : '');

    let previewContent = '';
    if (isBimView) {
      previewContent = `
        <div class="nora-att-bim-thumb" data-att-id="${escapeHtml(att.id)}" title="Clic para restaurar vista en el modelo">
          ${att.url ? `<img src="${escapeHtml(att.url)}" alt="${escapeHtml(att.name)}" class="nora-att-img" />` : `<span class="material-symbols-outlined" style="font-size: 32px; color: #f59e0b;">view_in_ar</span>`}
          <div class="nora-att-bim-overlay">
            <span class="nora-att-bim-tag">VISTA 3D BIM</span>
          </div>
        </div>
      `;
    } else if (isImage) {
      previewContent = `<img src="${escapeHtml(url)}" alt="${escapeHtml(att.name)}" class="nora-att-img" />`;
    } else if (isVideo) {
      previewContent = `
        <video controls class="nora-att-video" preload="metadata">
          <source src="${escapeHtml(url)}" type="${escapeHtml(att.type || 'video/mp4')}">
        </video>
      `;
    } else if (isAudio) {
      previewContent = `
        <div class="nora-att-audio-wrap" data-att-id="${escapeHtml(att.id)}">
          <audio controls class="nora-att-audio" preload="none" 
                 data-att-id="${escapeHtml(att.id)}" 
                 data-file-id="${escapeHtml(fileId)}" 
                 data-mime="${escapeHtml(att.type || 'audio/webm')}"
                 ${directPlayable ? `src="${escapeHtml(directPlayable)}"` : ''}>
          </audio>
          <div class="nora-audio-status" id="status-${escapeHtml(att.id)}" style="${directPlayable ? 'display: none;' : ''}">
            <span class="material-symbols-outlined" style="font-size: 13px; color: #f59e0b;">graphic_eq</span>
            <span>${fileId ? 'Cargando audio...' : 'Audio local'}</span>
          </div>
        </div>
      `;
    } else {
      previewContent = `
        <div class="nora-att-doc-placeholder">
          <span class="material-symbols-outlined" style="font-size: 24px; color: #3b82f6;">description</span>
          <span class="nora-att-doc-name">${escapeHtml(att.name)}</span>
        </div>
      `;
    }

    return `
      <div class="nora-att-card ${isAudio ? 'nora-att-card-audio' : ''}">
        <div class="nora-att-preview">${previewContent}</div>
        <div class="nora-att-meta">
          <span class="nora-att-name" title="${escapeHtml(att.name)}">${escapeHtml(att.name)}</span>
          ${att.isLocalPending ? `
            <span class="nora-att-uploading-badge" title="Subiendo a Google Drive">
              <span class="material-symbols-outlined spinning" style="font-size: 11px;">sync</span>
              <span>Subiendo</span>
            </span>
          ` : isBimView ? `
            <button type="button" class="nora-att-view-3d-btn" data-att-id="${escapeHtml(att.id)}" title="Aplicar vista en el modelo 3D">
              <span class="material-symbols-outlined" style="font-size: 14px;">visibility</span>
              <span>Ver 3D</span>
            </button>
          ` : isAudio ? `
            <span class="nora-att-audio-chip" title="Reproducción directa en visor">
              <span class="material-symbols-outlined" style="font-size: 13px;">mic</span>
              <span>Audio</span>
            </span>
          ` : `
            <a href="${escapeHtml(url)}" target="_blank" class="nora-att-link" title="Abrir archivo">
              <span class="material-symbols-outlined" style="font-size: 14px;">open_in_new</span>
            </a>
          `}
        </div>
      </div>
    `;
  }

  private renderChatTab(issue: Issue): string {
    const comments = issue.comments || [];

    return `
      <div class="nora-inc-chat-wrapper">
        <!-- Messages Feed -->
        <div class="nora-inc-chat-feed" id="nora-inc-chat-feed">
          ${comments.length === 0 ? `
            <div class="nora-inc-chat-empty">
              <span class="material-symbols-outlined" style="font-size: 36px; color: #cbd5e1;">chat_bubble_outline</span>
              <span>No hay comentarios ni trazabilidad aún. Escribe el primer mensaje abajo.</span>
            </div>
          ` : comments.map(c => this.renderCommentMessage(c)).join('')}
        </div>

        <!-- Recording Banner (when microphone active) -->
        ${this.isRecording ? `
          <div class="nora-inc-recording-banner">
            <span class="nora-recording-dot"></span>
            <span>Grabando audio: ${this.formatRecordingTime(this.recordingSeconds)}</span>
            <button type="button" id="btn-cancel-voice" class="nora-rec-cancel-btn">Cancelar</button>
          </div>
        ` : ''}

        <!-- Chat Input Bar -->
        <div class="nora-inc-chat-input-bar">
          <input type="file" id="nora-chat-file-input" style="display: none;" accept="image/*,video/*,audio/*,application/pdf" />

          <button type="button" class="nora-chat-btn-icon" id="btn-chat-attach" title="Adjuntar archivo o imagen">
            <span class="material-symbols-outlined" style="font-size: 18px;">attach_file</span>
          </button>

          <button type="button" class="nora-chat-btn-icon ${this.isRecording ? 'recording' : ''}" id="btn-chat-mic" title="${this.isRecording ? 'Detener y enviar audio' : 'Grabar nota de voz con micrófono'}">
            <span class="material-symbols-outlined" style="font-size: 18px;">${this.isRecording ? 'stop_circle' : 'mic'}</span>
          </button>

          <textarea id="nora-chat-textarea" placeholder="Escribe un mensaje de trazabilidad..." rows="1"></textarea>

          <button type="button" class="nora-chat-send-btn" id="btn-chat-send" title="Enviar mensaje">
            <span class="material-symbols-outlined" style="font-size: 16px;">send</span>
          </button>
        </div>
      </div>
    `;
  }

  private renderCommentMessage(c: Comment): string {
    const timeStr = this.formatDate(c.createdAt);
    const hasAttachments = c.attachments && c.attachments.length > 0;
    const isMe = this.currentUser?.email && c.userId && (c.userId.toLowerCase() === this.currentUser.email.toLowerCase() || c.userName === this.currentUser.name);

    return `
      <div class="nora-comment-row ${isMe ? 'me' : 'other'}">
        <div class="nora-comment-avatar" title="${escapeHtml(c.userName)}">
          ${escapeHtml((c.userName || 'U').slice(0, 2).toUpperCase())}
        </div>
        <div class="nora-comment-bubble">
          <div class="nora-comment-header">
            <span class="nora-comment-author">${escapeHtml(c.userName || 'Usuario')}</span>
            <span class="nora-comment-time">${timeStr}</span>
          </div>
          ${c.text ? `<div class="nora-comment-text">${escapeHtml(c.text)}</div>` : ''}

          ${hasAttachments ? `
            <div class="nora-comment-attachments">
              ${c.attachments!.map(att => {
                if (att.category === 'audio' || att.type?.includes('audio') || (att.name && /\.(mp3|wav|webm|m4a|ogg)$/i.test(att.name))) {
                  const fileId = extractDriveFileId(att);
                  const cachedBlob = (fileId && driveAudioBlobCache.get(fileId)) || (att.id && driveAudioBlobCache.get(att.id));
                  const directPlayable = cachedBlob || (isPlayableDirectly(att.url) ? att.url : '');

                  return `
                    <div class="nora-audio-msg" data-att-id="${escapeHtml(att.id)}">
                      <audio controls preload="none" 
                             data-att-id="${escapeHtml(att.id)}" 
                             data-file-id="${escapeHtml(fileId)}" 
                             data-mime="${escapeHtml(att.type || 'audio/webm')}"
                             ${directPlayable ? `src="${escapeHtml(directPlayable)}"` : ''}>
                      </audio>
                      <div class="nora-audio-status" id="status-${escapeHtml(att.id)}" style="${directPlayable ? 'display: none;' : ''}">
                        <span class="material-symbols-outlined" style="font-size: 13px; color: #f59e0b;">graphic_eq</span>
                        <span>${fileId ? 'Cargando nota de voz...' : 'Nota de voz'}</span>
                      </div>
                      ${att.isLocalPending ? `<span class="nora-chat-pending"><span class="material-symbols-outlined spinning" style="font-size:11px;">sync</span> Subiendo nota de voz a Drive...</span>` : ''}
                    </div>
                  `;
                }
                if (att.category === 'bim_view' || (att as any).viewpointData) {
                  return `
                    <div class="nora-bim-view-msg-wrap">
                      <div class="nora-bim-view-card" data-att-id="${escapeHtml(att.id)}">
                        ${att.url ? `<img src="${escapeHtml(att.url)}" alt="${escapeHtml(att.name)}" class="nora-bim-view-thumb" />` : `<span class="material-symbols-outlined" style="font-size: 28px; color: #f59e0b;">view_in_ar</span>`}
                        <div class="nora-bim-view-info">
                          <span class="nora-bim-view-tag">VISTA 3D BIM</span>
                          <span class="nora-bim-view-title">${escapeHtml(att.name)}</span>
                          <button type="button" class="nora-att-view-3d-btn" data-att-id="${escapeHtml(att.id)}" title="Ver en 3D">
                            <span class="material-symbols-outlined" style="font-size: 13px;">visibility</span>
                            <span>Ver 3D</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  `;
                }
                if (att.category === 'video' || att.type?.includes('video') || (att.name && /\.(mp4|webm|mov|mkv)$/i.test(att.name))) {
                  return `
                    <div class="nora-video-msg">
                      <video controls preload="metadata" src="${escapeHtml(att.url)}" class="nora-chat-video"></video>
                      ${att.isLocalPending ? `<span class="nora-chat-pending"><span class="material-symbols-outlined spinning" style="font-size:11px;">sync</span> Subiendo video a Drive...</span>` : ''}
                    </div>
                  `;
                }
                if (att.category === 'image' || att.type?.includes('image')) {
                  return `
                    <div class="nora-img-msg-wrap">
                      <a href="${escapeHtml(att.url)}" target="_blank" class="nora-img-msg">
                        <img src="${escapeHtml(att.url)}" alt="${escapeHtml(att.name)}" />
                      </a>
                      ${att.isLocalPending ? `<span class="nora-chat-pending"><span class="material-symbols-outlined spinning" style="font-size:11px;">sync</span> Subiendo foto a Drive...</span>` : ''}
                    </div>
                  `;
                }
                return `
                  <div class="nora-file-msg-wrap">
                    <a href="${escapeHtml(att.url)}" target="_blank" class="nora-file-msg">
                      <span class="material-symbols-outlined" style="font-size: 15px;">description</span>
                      <span>${escapeHtml(att.name)}</span>
                    </a>
                    ${att.isLocalPending ? `<span class="nora-chat-pending"><span class="material-symbols-outlined spinning" style="font-size:11px;">sync</span> Subiendo archivo a Drive...</span>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private formatRecordingTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  private bindEvents() {
    // Role filter tabs
    const roleTabs = this.container.querySelectorAll<HTMLButtonElement>('.nora-inc-role-tab');
    roleTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const role = tab.getAttribute('data-role') as RoleFilter;
        if (role && this.activeRole !== role) {
          this.activeRole = role;
          this.render();
        }
      });
    });

    // Expand/Collapse panel toggle
    const toggleExpandBtn = this.container.querySelector<HTMLButtonElement>('#btn-inc-toggle-expand');
    if (toggleExpandBtn) {
      toggleExpandBtn.addEventListener('click', () => {
        this.isExpanded = !this.isExpanded;
        this.render();
      });
    }

    // Search input
    const searchInput = this.container.querySelector<HTMLInputElement>('#nora-inc-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = (e.target as HTMLInputElement).value;
        const list = this.container.querySelector('#nora-inc-list-container');
        if (list) {
          const filtered = this.getFilteredIssues();
          list.innerHTML = filtered.length === 0 ? this.renderEmptyState() : filtered.map(i => this.renderIssueCard(i)).join('');
          this.bindCardClicks();
        }
      });
    }

    // Clear search
    const clearBtn = this.container.querySelector<HTMLButtonElement>('#nora-inc-clear-search');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.searchTerm = '';
        this.render();
      });
    }

    // Status filter select
    const statusSelect = this.container.querySelector<HTMLSelectElement>('#nora-inc-status-select');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.statusFilter = (e.target as HTMLSelectElement).value;
        this.render();
      });
    }

    // New Hallazgo button
    const newHallazgoBtn = this.container.querySelector<HTMLButtonElement>('#btn-inc-new-hallazgo');
    if (newHallazgoBtn) {
      newHallazgoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openCreateIssueModal();
      });
    }

    // Sync button
    const syncBtn = this.container.querySelector<HTMLButtonElement>('#btn-inc-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.syncWithDrive();
      });
    }

    // Refresh button in empty state
    const emptyRefresh = this.container.querySelector<HTMLButtonElement>('#btn-inc-empty-refresh');
    if (emptyRefresh) {
      emptyRefresh.addEventListener('click', () => this.syncWithDrive());
    }

    // Restore and track scroll position of the list container
    const listContainer = this.container.querySelector<HTMLElement>('#nora-inc-list-container');
    if (listContainer) {
      if (this.lastListScrollTop > 0) {
        listContainer.scrollTop = this.lastListScrollTop;
      }
      listContainer.addEventListener('scroll', () => {
        this.lastListScrollTop = listContainer.scrollTop;
      }, { passive: true });
    }

    this.bindCardClicks();
    this.bindDrawerEvents();
  }

  private bindCardClicks() {
    const saveScroll = () => {
      const list = this.container.querySelector<HTMLElement>('#nora-inc-list-container');
      if (list) this.lastListScrollTop = list.scrollTop;
    };

    const cards = this.container.querySelectorAll<HTMLElement>('.nora-inc-card');
    cards.forEach(card => {
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('a') || target.closest('button')) return; // ignore native link clicks
        saveScroll();
        const issueId = card.getAttribute('data-issue-id');
        if (issueId) {
          const match = this.issues.find(i => i.id === issueId);
          if (match) {
            this.selectedIssue = match;
            this.isExpanded = true;
            this.render();
          }
        }
      });
    });

    const manageBtns = this.container.querySelectorAll<HTMLButtonElement>('.nora-inc-manage-btn');
    manageBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        saveScroll();
        const issueId = btn.getAttribute('data-issue-id');
        if (issueId) {
          const match = this.issues.find(i => i.id === issueId);
          if (match) {
            this.selectedIssue = match;
            this.isExpanded = true;
            this.render();
          }
        }
      });
    });
  }

  private bindDrawerEvents() {
    // Close drawer / Back button
    const backBtn = this.container.querySelector<HTMLButtonElement>('#btn-drawer-close');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.selectedIssue = null;
        this.isExpanded = false;
        this.render();
      });
    }

    // Drawer Tabs: details vs chat
    const drawerTabs = this.container.querySelectorAll<HTMLButtonElement>('.nora-inc-drawer-tab');
    drawerTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const dtab = tab.getAttribute('data-dtab') as DrawerTab;
        if (dtab && this.activeDrawerTab !== dtab) {
          this.activeDrawerTab = dtab;
          this.render();
        }
      });
    });

    // Action buttons in Details tab
    const actionBtns = this.container.querySelectorAll<HTMLButtonElement>('.nora-act-btn');
    actionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.getAttribute('data-act');
        if (act && this.selectedIssue) {
          this.handleIssueAction(act, this.selectedIssue);
        }
      });
    });

    // Upload local file in Documentation section
    const docInput = this.container.querySelector<HTMLInputElement>('#nora-doc-file-input');
    if (docInput) {
      docInput.addEventListener('change', (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0 && this.selectedIssue) {
          this.handleUploadFiles(files, this.selectedIssue, false);
        }
      });
    }

    // Chat actions
    const sendBtn = this.container.querySelector<HTMLButtonElement>('#btn-chat-send');
    const textarea = this.container.querySelector<HTMLTextAreaElement>('#nora-chat-textarea');
    if (sendBtn && textarea) {
      sendBtn.addEventListener('click', () => {
        const text = textarea.value.trim();
        if (text && this.selectedIssue) {
          this.sendChatMessage(text, this.selectedIssue);
          textarea.value = '';
        }
      });
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const text = textarea.value.trim();
          if (text && this.selectedIssue) {
            this.sendChatMessage(text, this.selectedIssue);
            textarea.value = '';
          }
        }
      });
    }

    // Chat attach button
    const attachBtn = this.container.querySelector<HTMLButtonElement>('#btn-chat-attach');
    const chatFileInput = this.container.querySelector<HTMLInputElement>('#nora-chat-file-input');
    if (attachBtn && chatFileInput) {
      attachBtn.addEventListener('click', () => chatFileInput.click());
      chatFileInput.addEventListener('change', (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0 && this.selectedIssue) {
          this.handleUploadFiles(files, this.selectedIssue, true);
        }
      });
    }

    // Voice recording with microphone
    const micBtn = this.container.querySelector<HTMLButtonElement>('#btn-chat-mic');
    if (micBtn) {
      micBtn.addEventListener('click', () => {
        if (!this.isRecording) {
          this.startVoiceRecording();
        } else {
          this.stopVoiceRecording(true);
        }
      });
    }

    const cancelVoiceBtn = this.container.querySelector<HTMLButtonElement>('#btn-cancel-voice');
    if (cancelVoiceBtn) {
      cancelVoiceBtn.addEventListener('click', () => {
        this.stopVoiceRecording(false);
      });
    }

    // 3D View restore buttons in drawer and chat
    const view3dBtns = this.container.querySelectorAll<HTMLElement>('.nora-att-view-3d-btn, .nora-att-bim-thumb');
    view3dBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const attId = btn.getAttribute('data-att-id');
        if (!attId || !this.selectedIssue) return;
        const allAtts = [
          ...(this.selectedIssue.attachments || []),
          ...(this.selectedIssue.comments || []).flatMap(c => c.attachments || [])
        ];
        const att = allAtts.find(a => a.id === attId);
        if (att && (att as any).viewpointData) {
          this.options.onRestoreViewpoint?.((att as any).viewpointData);
          this.showToast('👁️ Vista 3D restaurada en el modelo');
        } else {
          this.showToast('⚠️ No se encontraron datos de cámara para esta vista');
        }
      });
    });

    // Wire up inline audio players for direct playback
    this.bindAudioPlayers();

    // Scroll chat to bottom
    const chatFeed = this.container.querySelector('#nora-inc-chat-feed');
    if (chatFeed) {
      chatFeed.scrollTop = chatFeed.scrollHeight;
    }
  }

  private bindAudioPlayers() {
    const audioEls = this.container.querySelectorAll<HTMLAudioElement>('audio[data-file-id]');
    audioEls.forEach(audio => {
      const fileId = audio.getAttribute('data-file-id') || '';
      const attId = audio.getAttribute('data-att-id') || '';
      const mime = audio.getAttribute('data-mime') || 'audio/webm';
      const statusEl = this.container.querySelector<HTMLElement>(`#status-${attId}`);

      const ensureAudioSource = async (): Promise<boolean> => {
        if (audio.src && isPlayableDirectly(audio.src)) {
          if (statusEl) statusEl.style.display = 'none';
          return true;
        }
        if (!fileId) {
          if (statusEl) {
            statusEl.style.display = 'flex';
            statusEl.textContent = 'Audio local';
          }
          return false;
        }
        try {
          if (statusEl) {
            statusEl.style.display = 'flex';
            statusEl.innerHTML = `<span class="material-symbols-outlined spinning" style="font-size:13px; color:#f59e0b;">sync</span><span>Descargando audio...</span>`;
          }
          const blobUrl = await fetchDriveAudioAsBlobUrl(fileId, mime);
          if (attId) driveAudioBlobCache.set(attId, blobUrl);
          audio.src = blobUrl;
          if (statusEl) {
            statusEl.style.display = 'none';
          }
          return true;
        } catch (err) {
          console.warn('[IncidenciasPanel] Error al obtener audio de Drive:', err);
          if (statusEl) {
            statusEl.style.display = 'flex';
            statusEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:13px; color:#ef4444;">error</span><span style="color:#ef4444;">No disponible</span>`;
          }
          return false;
        }
      };

      // Auto-resolve audio in background if not already playable
      if (fileId && (!audio.src || !isPlayableDirectly(audio.src))) {
        ensureAudioSource();
      }

      // Intercept play event if clicked before background download completes
      audio.addEventListener('play', async (e) => {
        if (!audio.src || !isPlayableDirectly(audio.src)) {
          e.preventDefault();
          audio.pause();
          const ok = await ensureAudioSource();
          if (ok) {
            try {
              await audio.play();
            } catch (_) {}
          }
        }
      });
    });
  }

  // --- Voice Recording Logic ---
  private async startVoiceRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Tu navegador no permite acceso al micrófono.');
      return;
    }
    try {
      this.audioChunks = [];
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
      else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';

      try {
        this.mediaRecorder = new MediaRecorder(this.audioStream, { mimeType });
      } catch (_) {
        this.mediaRecorder = new MediaRecorder(this.audioStream);
      }

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.recordingSeconds = 0;
      this.isRecording = true;
      this.render();

      this.recordingTimer = window.setInterval(() => {
        this.recordingSeconds++;
        const banner = this.container.querySelector('.nora-inc-recording-banner span:nth-child(2)');
        if (banner) banner.textContent = `Grabando audio: ${this.formatRecordingTime(this.recordingSeconds)}`;
      }, 1000);

      this.mediaRecorder.start(250);
    } catch (err) {
      console.error('Error starting voice recording:', err);
      alert('No se pudo acceder al micrófono. Por favor verifica los permisos.');
    }
  }

  private async stopVoiceRecording(save: boolean) {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }

    if (!this.mediaRecorder) {
      this.isRecording = false;
      this.render();
      return;
    }

    this.mediaRecorder.onstop = async () => {
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(t => t.stop());
        this.audioStream = null;
      }
      this.isRecording = false;

      if (save && this.audioChunks.length > 0 && this.selectedIssue) {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const isMp4 = mimeType.includes('mp4');
        const ext = isMp4 ? '.m4a' : '.webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });
        const name = `Nota_Voz_${Date.now()}${ext}`;
        const localBlobUrl = URL.createObjectURL(blob);
        const attId = 'att_audio_' + Date.now();
        driveAudioBlobCache.set(attId, localBlobUrl);

        const newAtt: Attachment = {
          id: attId,
          name,
          type: mimeType,
          url: localBlobUrl,
          category: 'audio',
          isLocalPending: true
        };

        const newComment: Comment = {
          id: 'cmt_' + Date.now(),
          userId: this.currentUser?.email || 'user',
          userName: this.currentUser?.name || this.currentUser?.email || 'Usuario',
          text: '🎤 Nota de voz grabada',
          createdAt: new Date().toISOString(),
          attachments: [newAtt]
        };

        const updatedIssue: Issue = {
          ...this.selectedIssue!,
          attachments: [...(this.selectedIssue!.attachments || []), newAtt],
          comments: [...(this.selectedIssue!.comments || []), newComment],
          updatedAt: new Date().toISOString()
        };

        const updatedIssues = this.issues.map(i => i.id === updatedIssue.id ? updatedIssue : i);
        this.persistAndBroadcast(updatedIssues, updatedIssue);
        this.render();

        // Background upload to Drive
        this.uploadAttachmentToDrive(blob, newAtt, updatedIssue.id);
      } else {
        this.render();
      }
      this.mediaRecorder = null;
      this.audioChunks = [];
    };

    if (this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  // --- File Upload Logic ---
  private async handleUploadFiles(files: FileList, issue: Issue, isForChat: boolean) {
    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const localBlobUrl = URL.createObjectURL(file);
      let cat: Attachment['category'] = 'file';
      if (file.type.startsWith('image/')) cat = 'image';
      else if (file.type.startsWith('video/')) cat = 'video';
      else if (file.type.startsWith('audio/')) cat = 'audio';

      const attId = 'att_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2, 6);
      if (cat === 'audio') {
        driveAudioBlobCache.set(attId, localBlobUrl);
      }

      newAttachments.push({
        id: attId,
        name: file.name,
        type: file.type || 'application/octet-stream',
        url: localBlobUrl,
        category: cat,
        isLocalPending: true
      });
    }

    let updatedIssue: Issue;
    if (isForChat) {
      const newComment: Comment = {
        id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        userId: this.currentUser?.email || 'user',
        userName: this.currentUser?.name || this.currentUser?.email || 'Usuario',
        text: `📎 Archivos adjuntos (${newAttachments.length})`,
        createdAt: new Date().toISOString(),
        attachments: newAttachments
      };
      updatedIssue = {
        ...issue,
        attachments: [...(issue.attachments || []), ...newAttachments],
        comments: [...(issue.comments || []), newComment],
        updatedAt: new Date().toISOString()
      };
    } else {
      updatedIssue = {
        ...issue,
        attachments: [...(issue.attachments || []), ...newAttachments],
        updatedAt: new Date().toISOString()
      };
    }

    const updatedIssues = this.issues.map(i => i.id === updatedIssue.id ? updatedIssue : i);
    this.persistAndBroadcast(updatedIssues, updatedIssue);
    this.render();

    // Trigger background uploads to Drive for each file
    for (let i = 0; i < files.length; i++) {
      this.uploadAttachmentToDrive(files[i], newAttachments[i], issue.id);
    }
  }

  private async uploadAttachmentToDrive(file: File | Blob, att: Attachment, issueId: string) {
    try {
      const folderId = await resolveProjectFolderId(this.companyId, this.projectId, this.driveFolderName);
      const driveResult = await uploadFileToDrive(file, att.name, att.type, folderId);

      if (driveResult.id) {
        driveAudioBlobCache.set(driveResult.id, att.url);
        driveAudioBlobCache.set(att.id, att.url);
      }

      const issue = this.issues.find(i => i.id === issueId);
      if (issue) {
        if (issue.attachments) {
          const found = issue.attachments.find(a => a.id === att.id || a.name === att.name);
          if (found) {
            found.driveFileId = driveResult.id;
            found.webViewLink = driveResult.webViewLink;
            found.url = driveResult.url;
            found.isLocalPending = false;
          }
        }
        if (issue.comments) {
          for (const c of issue.comments) {
            if (c.attachments) {
              const found = c.attachments.find(a => a.id === att.id || a.name === att.name);
              if (found) {
                found.driveFileId = driveResult.id;
                found.webViewLink = driveResult.webViewLink;
                found.url = driveResult.url;
                found.isLocalPending = false;
              }
            }
          }
        }

        issue.updatedAt = new Date().toISOString();
        if (this.selectedIssue?.id === issueId) {
          this.selectedIssue = { ...issue };
        }

        this.persistAndBroadcast(this.issues, issue);
        this.render();
      }
    } catch (err) {
      console.error('[IncidenciasPanel] Error subiendo adjunto a Drive:', err);
      att.isLocalPending = false;
      this.render();
    }
  }

  // --- Send Chat Message ---
  private sendChatMessage(text: string, issue: Issue) {
    const newComment: Comment = {
      id: 'cmt_' + Date.now(),
      userId: this.currentUser?.email || 'user',
      userName: this.currentUser?.name || this.currentUser?.email || 'Usuario',
      text,
      createdAt: new Date().toISOString()
    };

    const updatedIssue: Issue = {
      ...issue,
      comments: [...(issue.comments || []), newComment],
      updatedAt: new Date().toISOString()
    };

    const updatedIssues = this.issues.map(i => i.id === updatedIssue.id ? updatedIssue : i);
    this.persistAndBroadcast(updatedIssues, updatedIssue);
    this.render();
  }

  // --- Issue Action Handlers ---
  private handleIssueAction(action: string, issue: Issue) {
    const user = this.currentUser;
    const authorName = user?.name || user?.email || 'Usuario';

    switch (action) {
      case 'colab': {
        const email = prompt('Ingresa el correo del colaborador a agregar:');
        if (!email || !email.trim()) return;
        const newColab = { name: email.split('@')[0], email: email.trim(), at: new Date().toISOString() };
        const updatedColabs = [...(issue.collaborators || []), newColab];
        this.applyActionUpdate(issue, {
          collaborators: updatedColabs
        }, `👤 Colaborador agregado: ${email.trim()}`);
        break;
      }
      case 'exec': {
        const email = prompt('Ingresa el correo del nuevo ejecutor:');
        if (!email || !email.trim()) return;
        this.applyActionUpdate(issue, {
          executor: { name: email.split('@')[0], position: 'Ejecutor', email: email.trim(), at: new Date().toISOString() }
        }, `➡️ Redirigida a ejecutor: ${email.trim()}`);
        break;
      }
      case 'resp': {
        const email = prompt('Ingresa el correo del nuevo responsable principal:');
        if (!email || !email.trim()) return;
        this.applyActionUpdate(issue, {
          assignedName: email.split('@')[0],
          assignedEmail: email.trim()
        }, `🔄 Responsable principal reasignado a: ${email.trim()}`);
        break;
      }
      case 'finish': {
        if (!confirm('¿Deseas finalizar la respuesta técnica de esta incidencia?')) return;
        this.applyActionUpdate(issue, { status: 'RESPONDIDA' }, `✅ Respuesta técnica finalizada por ${authorName}`);
        break;
      }
      case 'resolve': {
        if (!confirm('¿Marcar la incidencia como RESUELTA Y CERRADA?')) return;
        this.applyActionUpdate(issue, { status: 'RESUELTA' }, `🏁 Incidencia resuelta y cerrada por ${authorName}`);
        break;
      }
      case 'reject': {
        const reason = prompt('Motivo de rechazo de la respuesta:');
        if (reason === null) return;
        this.applyActionUpdate(issue, { status: 'RECHAZADA', rejectionReason: reason }, `❌ Respuesta rechazada: ${reason}`);
        break;
      }
      case 'agreement': {
        const dateStr = prompt('Establecer fecha de acuerdo (AAAA-MM-DD):', new Date().toISOString().slice(0, 10));
        if (!dateStr) return;
        this.applyActionUpdate(issue, { status: 'ACUERDO', agreementDate: dateStr }, `🤝 Acuerdo establecido hasta el ${dateStr}`);
        break;
      }
      case 'cancel': {
        const reason = prompt('Motivo de anulación de la incidencia:');
        if (reason === null) return;
        this.applyActionUpdate(issue, { status: 'ANULADA', rejectionReason: reason }, `🚫 Incidencia anulada: ${reason}`);
        break;
      }
    }
  }

  private applyActionUpdate(issue: Issue, changes: Partial<Issue>, logMessage: string) {
    const authorName = this.currentUser?.name || this.currentUser?.email || 'Sistema';
    const systemComment: Comment = {
      id: 'cmt_' + Date.now(),
      userId: this.currentUser?.email || 'system',
      userName: authorName,
      text: logMessage,
      createdAt: new Date().toISOString()
    };

    const updatedIssue: Issue = {
      ...issue,
      ...changes,
      comments: [...(issue.comments || []), systemComment],
      updatedAt: new Date().toISOString()
    };

    const updatedIssues = this.issues.map(i => i.id === updatedIssue.id ? updatedIssue : i);
    this.persistAndBroadcast(updatedIssues, updatedIssue);
    this.render();
  }
}

function escapeHtml(str?: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
