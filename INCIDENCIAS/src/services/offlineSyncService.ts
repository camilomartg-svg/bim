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
  category: 'image' | 'video' | 'audio' | 'file';
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
  currentFileName?: string;
  lastSyncedAt?: string;
  error?: string;
}

// In-memory state tracking
let isSyncingInProgress = false;
let currentUploadingFileLabel: string | undefined = undefined;
let syncRecheckRequested = false;

function formatFileSizeShort(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
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
export async function optimizeImageForUpload(fileBlob: Blob, maxWidth = 1600, quality = 0.80): Promise<Blob> {
  // Comprimir toda imagen mayor a 400KB para que suba en 1-2 segundos en 4G/3G móvil
  if (!fileBlob.type.startsWith('image/') || fileBlob.size < 400 * 1024) {
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

  // 3. Save raw file blobs in IndexedDB (sorted from lightest to heaviest!)
  if (filesMap.size > 0) {
    // A. Prepare, optimize, and materialize all file records in RAM first (prevents Android camera temp file expiration)
    const fileRecords: PendingFileRecord[] = [];
    for (const [attachmentId, fileBlob] of filesMap.entries()) {
      const att = issue.attachments?.find(a => a.id === attachmentId);
      let fileName = att?.name || `Adjunto_${Date.now()}`;
      const fileType = att?.type || fileBlob.type || 'application/octet-stream';
      const isImg = fileType.startsWith('image/');
      const isVid = fileType.startsWith('video/');
      const isAud = fileType.startsWith('audio/');
      const category = (att?.category as any) || (isImg ? 'image' : isVid ? 'video' : isAud ? 'audio' : 'file');

      // Ensure proper extension
      if (isImg && !fileName.includes('.')) fileName += '.jpg';
      if (isVid && !fileName.includes('.')) fileName += '.mp4';
      if (isAud && !fileName.includes('.')) fileName += '.webm';

      const optimized = await optimizeImageForUpload(fileBlob);
      let persistentBlob = optimized;
      try {
        const arrayBuf = await optimized.arrayBuffer();
        persistentBlob = new Blob([arrayBuf], { type: fileType });
      } catch (_) {}

      fileRecords.push({
        id: `${issue.id}_${attachmentId}`,
        issueId: issue.id,
        attachmentId,
        fileName,
        fileType,
        category,
        fileBlob: persistentBlob,
        status: 'QUEUED',
        attempts: 0,
        createdAt: new Date().toISOString()
      });
    }

    // Sort from lightest to heaviest so audios/photos upload first and heavy videos last
    fileRecords.sort((a, b) => (a.fileBlob?.size || 0) - (b.fileBlob?.size || 0));

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
    if (isSyncingInProgress) {
      syncRecheckRequested = true;
    }
    setTimeout(() => {
      triggerBackgroundSync().catch(console.error);
    }, 50);
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
      const req = tx.objectStore(ISSUES_STORE).getAll();
      req.onsuccess = () => {
        const all = (req.result || []) as PendingIssueRecord[];
        resolve(all.filter(i => i.status !== 'DONE').length);
      };
      req.onerror = () => resolve(0);
    });

    const filesCount = await new Promise<number>((resolve) => {
      const tx = db.transaction([FILES_STORE], 'readonly');
      const req = tx.objectStore(FILES_STORE).getAll();
      req.onsuccess = () => {
        const all = (req.result || []) as PendingFileRecord[];
        // Solo contar los archivos que realmente están pendientes por subir (no DONE ni ERROR)
        resolve(all.filter(f => f.status !== 'DONE' && (f.status as string) !== 'ERROR' && f.status !== 'FAILED' && (f.attempts || 0) < 3).length);
      };
      req.onerror = () => resolve(0);
    });

    return { issuesCount, filesCount };
  } catch (_) {
    return { issuesCount: 0, filesCount: 0 };
  }
}

/**
 * Limpia forzosamente la cola offline en caso de que algún archivo quede atascado
 */
export async function clearOfflineQueue(): Promise<void> {
  try {
    const db = await openOfflineDB();
    await new Promise<void>((res) => {
      const tx = db.transaction([FILES_STORE, ISSUES_STORE], 'readwrite');
      tx.objectStore(FILES_STORE).clear();
      tx.objectStore(ISSUES_STORE).clear();
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
    isSyncingInProgress = false;
    await notifyStatusChange();
  } catch (err) {
    console.warn('[offlineSyncService] Error limpiando cola offline:', err);
  }
}

/**
 * Processes the queue: uploads files to Drive, updates issue URLs, saves to Drive
 */
export async function triggerBackgroundSync(forceRetry = false): Promise<void> {
  if (isSyncingInProgress) {
    if (forceRetry) syncRecheckRequested = true;
    return;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    notifyStatusChange();
    return;
  }

  isSyncingInProgress = true;
  syncRecheckRequested = false;
  notifyStatusChange();

  try {
    const db = await openOfflineDB();

    // Si el usuario pulsó "Subir Ahora" (forceRetry), reactivar cualquier archivo previo fallido
    if (forceRetry) {
      const allFiles = await new Promise<PendingFileRecord[]>((resolve) => {
        const tx = db.transaction([FILES_STORE], 'readonly');
        const req = tx.objectStore(FILES_STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
      for (const f of allFiles) {
        if (f.status !== 'DONE') {
          f.status = 'QUEUED';
          f.attempts = 0;
          try {
            const tx = db.transaction([FILES_STORE], 'readwrite');
            tx.objectStore(FILES_STORE).put(f);
          } catch (_) {}
        }
      }
    }

    // Bucle de prioridad dinámica: en cada iteración toma siempre el archivo MÁS LIVIANO disponible
    // (audios -> fotos -> documentos -> videos al final)
    let safetyIterations = 0;
    while (safetyIterations < 100) {
      safetyIterations++;
      if (typeof navigator !== 'undefined' && !navigator.onLine) break;

      const allFiles = await new Promise<PendingFileRecord[]>((resolve) => {
        const tx = db.transaction([FILES_STORE], 'readonly');
        const req = tx.objectStore(FILES_STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });

      const pendingIssues = await new Promise<PendingIssueRecord[]>((resolve) => {
        const tx = db.transaction([ISSUES_STORE], 'readonly');
        const req = tx.objectStore(ISSUES_STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });

      // Persistir inmediatamente en Drive cualquier incidencia recién creada que aún esté en estado QUEUED
      for (const issRec of pendingIssues) {
        if (issRec.status === 'QUEUED') {
          issRec.status = 'UPLOADING';
          await new Promise<void>((res) => {
            const tx = db.transaction([ISSUES_STORE], 'readwrite');
            const req = tx.objectStore(ISSUES_STORE).put(issRec);
            req.onsuccess = () => res();
            req.onerror = () => res();
          });
          try {
            await saveIncidentToDrive(issRec.issueData, issRec.companyId, issRec.projectId);
          } catch (initSaveErr) {
            console.warn('[offlineSyncService] Guardado inicial de incidencia diferido:', initSaveErr);
          }
        }
      }

      // Filtrar archivos pendientes válidos
      const runnableFiles: PendingFileRecord[] = [];
      for (const f of allFiles) {
        if (f.status === 'DONE' || (f.status as string) === 'ERROR' || f.status === 'FAILED') continue;
        // Descartar blobs vacíos o corruptos o que superaron 3 intentos
        if (!f.fileBlob || f.fileBlob.size === 0 || (f.attempts || 0) >= 3) {
          f.status = 'FAILED';
          await new Promise<void>((res) => {
            const tx = db.transaction([FILES_STORE], 'readwrite');
            const req = tx.objectStore(FILES_STORE).put(f);
            req.onsuccess = () => res();
            req.onerror = () => res();
          });
          continue;
        }
        runnableFiles.push(f);
      }

      if (runnableFiles.length === 0) break;

      // ORDENAR POR PRIORIDAD:
      // 1. Archivos nuevos (0 intentos fallidos) van primero para que un archivo viejo nunca bloquee uno nuevo
      // 2. Del MÁS LIVIANO al MÁS PESADO (audios -> fotos -> PDFs -> videos)
      runnableFiles.sort((a, b) => {
        const attDiff = (a.attempts || 0) - (b.attempts || 0);
        if (attDiff !== 0) return attDiff;
        return (a.fileBlob?.size || 0) - (b.fileBlob?.size || 0);
      });

      const fileRecord = runnableFiles[0];
      const fileSize = fileRecord.fileBlob?.size || 0;
      currentUploadingFileLabel = `${fileRecord.fileName} (${formatFileSizeShort(fileSize)})`;
      notifyStatusChange();

      try {
        const issueRec = pendingIssues.find(i => i.id === fileRecord.issueId);
        const companyId = issueRec?.companyId || 'default';
        const projectId = issueRec?.projectId || 'default';

        const dynamicTimeoutMs = Math.max(90_000, Math.ceil(fileSize / (60 * 1024)) * 1000);
        console.log(`[offlineSyncService] Subiendo por prioridad (livianos primero): ${currentUploadingFileLabel}`);

        const uploadPromise = uploadFileToDrive(
          fileRecord.fileBlob,
          fileRecord.fileName,
          fileRecord.fileType,
          undefined,
          undefined,
          { companyId, projectId }
        );

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout subiendo ${fileRecord.fileName}`)), dynamicTimeoutMs)
        );

        const driveResult = await Promise.race([uploadPromise, timeoutPromise]);

        // Marcar archivo como DONE
        await new Promise<void>((res, rej) => {
          const tx = db.transaction([FILES_STORE], 'readwrite');
          fileRecord.status = 'DONE';
          fileRecord.driveFileId = driveResult.id;
          fileRecord.webViewLink = driveResult.webViewLink || driveResult.url;
          const req = tx.objectStore(FILES_STORE).put(fileRecord);
          req.onsuccess = () => res();
          req.onerror = () => rej(tx.error);
        });

        // Actualizar anexo en la incidencia (tanto en IndexedDB como en caché local y Drive)
        const targetIssue: Issue | undefined = issueRec?.issueData || getCachedIncidents(companyId, projectId).find(i => i.id === fileRecord.issueId);
        if (targetIssue) {
          const atts = targetIssue.attachments || [];
          const matchedAtt = atts.find(a => a.id === fileRecord.attachmentId);
          if (matchedAtt) {
            matchedAtt.url = driveResult.url || driveResult.webViewLink;
            matchedAtt.webViewLink = driveResult.webViewLink;
            matchedAtt.driveFileId = driveResult.id;
            matchedAtt.isLocalPending = false;
          }

          if (issueRec) {
            issueRec.issueData = targetIssue;
            await new Promise<void>((res) => {
              const tx = db.transaction([ISSUES_STORE], 'readwrite');
              const req = tx.objectStore(ISSUES_STORE).put(issueRec);
              req.onsuccess = () => res();
              req.onerror = () => res();
            });
          }

          const currentList = getCachedIncidents(companyId, projectId);
          const updated = currentList.map(i => i.id === targetIssue.id ? targetIssue : i);
          updateLocalIncidentsCache(updated, companyId, projectId);

          // Persistir avance en Drive inmediatamente para que las fotos/audios ya se vean mientras sube el video
          try {
            await saveIncidentToDrive(targetIssue, companyId, projectId);
          } catch (syncErr) {
            console.warn('[offlineSyncService] Warning persisting partial upload to Drive:', syncErr);
          }
        }

        notifyStatusChange();
      } catch (fileErr: any) {
        console.warn(`[offlineSyncService] Error subiendo archivo ${fileRecord.fileName}:`, fileErr);
        fileRecord.attempts = (fileRecord.attempts || 0) + 1;
        fileRecord.lastError = fileErr?.message || String(fileErr);
        if ((fileRecord.attempts || 0) >= 3) {
          fileRecord.status = 'FAILED';
        }
        try {
          const tx = db.transaction([FILES_STORE], 'readwrite');
          tx.objectStore(FILES_STORE).put(fileRecord);
        } catch (_) {}
        if (!navigator.onLine) break;
      }
    }

    currentUploadingFileLabel = undefined;

    // 4. Finalizar incidencias que ya no tienen archivos pendientes activos
    const finalIssues = await new Promise<PendingIssueRecord[]>((resolve) => {
      const tx = db.transaction([ISSUES_STORE], 'readonly');
      const req = tx.objectStore(ISSUES_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    for (const issueRec of finalIssues) {
      const remainingActiveFiles = await new Promise<PendingFileRecord[]>((resolve) => {
        const tx = db.transaction([FILES_STORE], 'readonly');
        const req = tx.objectStore(FILES_STORE).getAll();
        req.onsuccess = () => {
          const files = (req.result || []) as PendingFileRecord[];
          resolve(files.filter(f =>
            f.issueId === issueRec.id &&
            f.status !== 'DONE' &&
            f.status !== 'FAILED' &&
            (f.status as string) !== 'ERROR' &&
            (f.attempts || 0) < 3
          ));
        };
        req.onerror = () => resolve([]);
      });

      if (remainingActiveFiles.length === 0) {
        try {
          const cleanIssueToSave: Issue = {
            ...issueRec.issueData,
            isLocalPending: false,
            updatedAt: new Date().toISOString()
          };

          await saveIncidentToDrive(cleanIssueToSave, issueRec.companyId, issueRec.projectId);

          // Limpiar archivos terminados de IndexedDB
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

          // Limpiar incidencia terminada de IndexedDB
          await new Promise<void>((res) => {
            const tx = db.transaction([ISSUES_STORE], 'readwrite');
            const req = tx.objectStore(ISSUES_STORE).delete(issueRec.id);
            req.onsuccess = () => res();
            req.onerror = () => res();
          });

          const cached = getCachedIncidents(issueRec.companyId, issueRec.projectId);
          const finalUpdated = cached.map(i => i.id === issueRec.id ? cleanIssueToSave : i);
          updateLocalIncidentsCache(finalUpdated, issueRec.companyId, issueRec.projectId);

          notifyStatusChange();
        } catch (saveErr: any) {
          console.warn(`[offlineSyncService] Error guardando JSON final de incidencia ${issueRec.id}:`, saveErr);
          issueRec.attempts = (issueRec.attempts || 0) + 1;
          issueRec.lastError = saveErr?.message || String(saveErr);
          if (!navigator.onLine) break;
        }
      }
    }
  } catch (err) {
    console.error('[offlineSyncService] Error durante sincronización en segundo plano:', err);
  } finally {
    currentUploadingFileLabel = undefined;
    isSyncingInProgress = false;
    notifyStatusChange();
    if (syncRecheckRequested && (typeof navigator === 'undefined' || navigator.onLine)) {
      syncRecheckRequested = false;
      setTimeout(() => {
        triggerBackgroundSync().catch(console.error);
      }, 100);
    }
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
    pendingFilesCount: counts.filesCount,
    currentFileName: currentUploadingFileLabel
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
