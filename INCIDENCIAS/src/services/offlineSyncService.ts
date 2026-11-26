import { Issue, Attachment } from '../types';
import { uploadFileToDrive } from '../utils/googleDriveUtils';
import { saveIncidentToDrive, getCachedIncidents, updateLocalIncidentsCache } from './driveIncidentsService';

const DB_NAME = 'nora_offline_cde_v1';
const DB_VERSION = 1;
const ISSUES_STORE = 'pending_issues';
const FILES_STORE = 'pending_files';

export interface PendingIssueRecord {
  id: string; // Issue ID
  issueData: Issue;
  companyId: string;
  projectId: string;
  status: 'QUEUED' | 'UPLOADING' | 'DONE' | 'FAILED';
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export interface PendingFileRecord {
  id: string; // Unique file queue ID (issueId_attachmentId)
  issueId: string;
  attachmentId: string;
  fileName: string;
  fileType: string;
  category: 'image' | 'video' | 'file';
  fileBlob: Blob;
  status: 'QUEUED' | 'UPLOADING' | 'DONE' | 'FAILED';
  attempts: number;
  createdAt: string;
  driveFileId?: string;
  webViewLink?: string;
  lastError?: string;
}

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingIssuesCount: number;
  pendingFilesCount: number;
  lastSyncedAt?: string;
  error?: string;
}

// In-memory state tracking
let isSyncingInProgress = false;
const listeners = new Set<(state: SyncState) => void>();

/**
 * Open or upgrade IndexedDB database
 */
function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB no está disponible en este entorno.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(ISSUES_STORE)) {
        db.createObjectStore(ISSUES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        const fileStore = db.createObjectStore(FILES_STORE, { keyPath: 'id' });
        fileStore.createIndex('issueId', 'issueId', { unique: false });
        fileStore.createIndex('status', 'status', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Compress images larger than 3MB to ~1920px max dimension for fast mobile site uploads
 */
export async function optimizeImageForUpload(fileBlob: Blob, maxWidth = 1920, quality = 0.85): Promise<Blob> {
  if (!fileBlob.type.startsWith('image/') || fileBlob.size < 2.5 * 1024 * 1024) {
    return fileBlob;
  }

  return new Promise<Blob>((resolve) => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(fileBlob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(fileBlob);

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < fileBlob.size) {
              resolve(blob);
            } else {
              resolve(fileBlob);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(fileBlob);
      };
      img.src = url;
    } catch (_) {
      resolve(fileBlob);
    }
  });
}

/**
 * Enqueues a newly created issue and all its local file attachments into IndexedDB.
 * Updates local cache immediately (0ms wait for the user).
 */
export async function enqueueOfflineIssue(
  issue: Issue,
  filesMap: Map<string, Blob | File>,
  companyId: string,
  projectId: string
): Promise<void> {
  const db = await openOfflineDB();

  // Flag issue as pending background sync
  const enrichedIssue: Issue = {
    ...issue,
    isLocalPending: filesMap.size > 0 || !navigator.onLine,
    companyId,
    projectId,
    updatedAt: new Date().toISOString()
  };

  // 1. Optimistic local cache update so it is immediately visible in the UI
  const existing = getCachedIncidents(companyId, projectId);
  const existsIndex = existing.findIndex(i => i.id === issue.id);
  const updatedList = existsIndex >= 0 
    ? existing.map(i => i.id === issue.id ? enrichedIssue : i)
    : [enrichedIssue, ...existing];
  updateLocalIncidentsCache(updatedList, companyId, projectId);

  // 2. Save issue record in IndexedDB
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([ISSUES_STORE], 'readwrite');
    const store = tx.objectStore(ISSUES_STORE);
    const record: PendingIssueRecord = {
      id: issue.id,
      issueData: enrichedIssue,
      companyId,
      projectId,
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
      attempts: 0
    };
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // 3. Save raw file blobs in IndexedDB
  if (filesMap.size > 0) {
    // A. Prepare and optimize all file records in memory FIRST (outside IDB transaction)
    const fileRecords: PendingFileRecord[] = [];
    for (const [attachmentId, fileBlob] of filesMap.entries()) {
      const att = issue.attachments?.find(a => a.id === attachmentId);
      let fileName = att?.name || `Adjunto_${Date.now()}`;
      const fileType = att?.type || fileBlob.type || 'application/octet-stream';
      const isImg = fileType.startsWith('image/');
      const isVid = fileType.startsWith('video/');
      const category = (att?.category as any) || (isImg ? 'image' : isVid ? 'video' : 'file');

      // Ensure proper extension
      if (isImg && !fileName.includes('.')) fileName += '.jpg';
      if (isVid && !fileName.includes('.')) fileName += '.mp4';

      const finalBlob = await optimizeImageForUpload(fileBlob);

      fileRecords.push({
        id: `${issue.id}_${attachmentId}`,
        issueId: issue.id,
        attachmentId,
        fileName,
        fileType,
        category,
        fileBlob: finalBlob,
        status: 'QUEUED',
        attempts: 0,
        createdAt: new Date().toISOString()
      });
    }

    // B. Open IndexedDB transaction and synchronously store records without yielding
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([FILES_STORE], 'readwrite');
      const store = tx.objectStore(FILES_STORE);
      for (const rec of fileRecords) {
        store.put(rec);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  notifyStatusChange();

  // 4. Trigger background sync immediately if online
  if (navigator.onLine) {
    setTimeout(() => {
      triggerBackgroundSync().catch(console.error);
    }, 100);
  }
}

/**
 * Returns the count of pending issues and files
 */
export async function getPendingSyncCounts(): Promise<{ issuesCount: number; filesCount: number }> {
  try {
    const db = await openOfflineDB();
    const issuesCount = await new Promise<number>((resolve) => {
      const tx = db.transaction([ISSUES_STORE], 'readonly');
      const req = tx.objectStore(ISSUES_STORE).count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });

    const filesCount = await new Promise<number>((resolve) => {
      const tx = db.transaction([FILES_STORE], 'readonly');
      const req = tx.objectStore(FILES_STORE).count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });

    return { issuesCount, filesCount };
  } catch (_) {
    return { issuesCount: 0, filesCount: 0 };
  }
}

/**
 * Processes the queue: uploads files to Drive, updates issue URLs, saves to Drive
 */
export async function triggerBackgroundSync(): Promise<void> {
  if (isSyncingInProgress) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    notifyStatusChange();
    return;
  }

  isSyncingInProgress = true;
  notifyStatusChange();

  try {
    const db = await openOfflineDB();

    // 1. Fetch pending files
    const pendingFiles = await new Promise<PendingFileRecord[]>((resolve) => {
      const tx = db.transaction([FILES_STORE], 'readonly');
      const req = tx.objectStore(FILES_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    // 2. Fetch pending issues
    const pendingIssues = await new Promise<PendingIssueRecord[]>((resolve) => {
      const tx = db.transaction([ISSUES_STORE], 'readonly');
      const req = tx.objectStore(ISSUES_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    if (pendingFiles.length === 0 && pendingIssues.length === 0) {
      isSyncingInProgress = false;
      notifyStatusChange();
      return;
    }

    // 3. Upload pending files one by one to avoid network saturation
    for (const fileRecord of pendingFiles) {
      if (fileRecord.status === 'DONE') continue;

      try {
        const issueRec = pendingIssues.find(i => i.id === fileRecord.issueId);
        const companyId = issueRec?.companyId || 'default';
        const projectId = issueRec?.projectId || 'default';

        const driveResult = await uploadFileToDrive(
          fileRecord.fileBlob,
          fileRecord.fileName,
          fileRecord.fileType,
          undefined,
          undefined,
          { companyId, projectId }
        );

        // Update file record as DONE
        await new Promise<void>((res, rej) => {
          const tx = db.transaction([FILES_STORE], 'readwrite');
          fileRecord.status = 'DONE';
          fileRecord.driveFileId = driveResult.id;
          fileRecord.webViewLink = driveResult.webViewLink || driveResult.url;
          const req = tx.objectStore(FILES_STORE).put(fileRecord);
          req.onsuccess = () => res();
          req.onerror = () => rej(tx.error);
        });

        // Update the issue attachment with real Drive URL in the pending issue record
        if (issueRec) {
          const atts = issueRec.issueData.attachments || [];
          const matchedAtt = atts.find(a => a.id === fileRecord.attachmentId);
          if (matchedAtt) {
            matchedAtt.url = driveResult.url || driveResult.webViewLink;
            matchedAtt.webViewLink = driveResult.webViewLink;
            matchedAtt.driveFileId = driveResult.id;
            matchedAtt.isLocalPending = false;
          }

          // Update in IndexedDB
          await new Promise<void>((res, rej) => {
            const tx = db.transaction([ISSUES_STORE], 'readwrite');
            const req = tx.objectStore(ISSUES_STORE).put(issueRec);
            req.onsuccess = () => res();
            req.onerror = () => rej(tx.error);
          });

          // Also update local cache so user can view uploaded Drive file
          const currentList = getCachedIncidents(companyId, projectId);
          const updated = currentList.map(i => i.id === issueRec.id ? issueRec.issueData : i);
          updateLocalIncidentsCache(updated, companyId, projectId);

          // Persist progress to Drive IMMEDIATELY so files show up on desktop without waiting!
          try {
            await saveIncidentToDrive(issueRec.issueData, companyId, projectId);
          } catch (syncErr) {
            console.warn('[offlineSyncService] Warning persisting partial upload to Drive:', syncErr);
          }
        }

        notifyStatusChange();
      } catch (fileErr: any) {
        console.warn(`[offlineSyncService] Error subiendo archivo ${fileRecord.fileName}:`, fileErr);
        fileRecord.attempts = (fileRecord.attempts || 0) + 1;
        fileRecord.lastError = fileErr?.message || String(fileErr);
        // If offline or network dropped, abort and wait for next online event
        if (!navigator.onLine) break;
      }
    }

    // 4. Check issues whose files are all uploaded (or had no files)
    for (const issueRec of pendingIssues) {
      const remainingFilesForIssue = await new Promise<PendingFileRecord[]>((resolve) => {
        const tx = db.transaction([FILES_STORE], 'readonly');
        const req = tx.objectStore(FILES_STORE).getAll();
        req.onsuccess = () => {
          const files = (req.result || []) as PendingFileRecord[];
          resolve(files.filter(f => f.issueId === issueRec.id && f.status !== 'DONE'));
        };
        req.onerror = () => resolve([]);
      });

      if (remainingFilesForIssue.length === 0) {
        try {
          // All files for this issue are in Drive. Save the issue JSON to Google Drive
          const cleanIssueToSave: Issue = {
            ...issueRec.issueData,
            isLocalPending: false,
            updatedAt: new Date().toISOString()
          };

          await saveIncidentToDrive(cleanIssueToSave, issueRec.companyId, issueRec.projectId);

          // Clean up completed files from IndexedDB
          await new Promise<void>((res) => {
            const tx = db.transaction([FILES_STORE], 'readwrite');
            const store = tx.objectStore(FILES_STORE);
            const req = store.getAll();
            req.onsuccess = () => {
              const all = (req.result || []) as PendingFileRecord[];
              all.filter(f => f.issueId === issueRec.id).forEach(f => store.delete(f.id));
              res();
            };
            req.onerror = () => res();
          });

          // Clean up completed issue from IndexedDB
          await new Promise<void>((res) => {
            const tx = db.transaction([ISSUES_STORE], 'readwrite');
            const req = tx.objectStore(ISSUES_STORE).delete(issueRec.id);
            req.onsuccess = () => res();
            req.onerror = () => res();
          });

          // Update local cache to remove isLocalPending badge
          const cached = getCachedIncidents(issueRec.companyId, issueRec.projectId);
          const finalUpdated = cached.map(i => i.id === issueRec.id ? cleanIssueToSave : i);
          updateLocalIncidentsCache(finalUpdated, issueRec.companyId, issueRec.projectId);

          notifyStatusChange();
        } catch (saveErr: any) {
          console.warn(`[offlineSyncService] Error guardando JSON de incidencia ${issueRec.id} en Drive:`, saveErr);
          issueRec.attempts = (issueRec.attempts || 0) + 1;
          issueRec.lastError = saveErr?.message || String(saveErr);
          if (!navigator.onLine) break;
        }
      }
    }
  } catch (err) {
    console.error('[offlineSyncService] Error durante sincronización en segundo plano:', err);
  } finally {
    isSyncingInProgress = false;
    notifyStatusChange();
  }
}

/**
 * Subscribes to sync state changes
 */
export function subscribeSyncStatus(callback: (state: SyncState) => void): () => void {
  listeners.add(callback);
  notifyStatusChange();
  return () => listeners.delete(callback);
}

async function notifyStatusChange() {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const counts = await getPendingSyncCounts();

  const state: SyncState = {
    isOnline,
    isSyncing: isSyncingInProgress,
    pendingIssuesCount: counts.issuesCount,
    pendingFilesCount: counts.filesCount
  };

  listeners.forEach(cb => {
    try {
      cb(state);
    } catch (_) {}
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nora_sync_status_changed', { detail: state }));
  }
}

// Global lifecycle event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[offlineSyncService] Señal de red detectada. Iniciando sincronización de incidencias pendientes...');
    notifyStatusChange();
    triggerBackgroundSync().catch(console.error);
  });

  window.addEventListener('offline', () => {
    console.log('[offlineSyncService] Modo sin conexión activado.');
    notifyStatusChange();
  });

  // Background heartbeat every 20 seconds
  setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      getPendingSyncCounts().then(({ issuesCount, filesCount }) => {
        if (issuesCount > 0 || filesCount > 0) {
          triggerBackgroundSync().catch(console.error);
        }
      });
    }
  }, 20000);

  // Initial trigger after app boot
  setTimeout(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      triggerBackgroundSync().catch(console.error);
    }
  }, 2000);

  // Listen to Service Worker Background Sync triggers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'TRIGGER_BACKGROUND_SYNC') {
        console.log('[offlineSyncService] Recibida orden de sincronización desde el Service Worker.');
        triggerBackgroundSync().catch(console.error);
      }
    });
  }
}
