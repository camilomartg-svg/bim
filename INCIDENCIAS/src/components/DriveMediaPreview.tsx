import React, { useEffect, useState } from 'react';
import { Attachment } from '../types';
import { postToAppsScript, getAuthenticatedDriveUrl } from '../utils/googleDriveUtils';
import { Mic, Video, Image as ImageIcon, ExternalLink, RefreshCw, Play, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

// Global in-memory cache of resolved blob: URLs by driveFileId or attachmentId
const driveBlobUrlCache = new Map<string, string>();
const inFlightDownloads = new Map<string, Promise<string>>();

export function registerLocalMediaBlob(key: string | undefined, blobUrl: string | undefined) {
  if (!key || !blobUrl) return;
  driveBlobUrlCache.set(key, blobUrl);
}

export function extractDriveFileId(att: Partial<Attachment> | undefined): string {
  if (!att) return '';
  if (att.driveFileId && att.driveFileId.trim().length > 10) {
    return att.driveFileId.trim();
  }
  const candidates = [att.webViewLink, att.url].filter(Boolean) as string[];
  for (const raw of candidates) {
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

export async function fetchDriveFileAsBlobUrl(
  fileId: string,
  mimeType: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const cached = driveBlobUrlCache.get(fileId);
  if (cached) return cached;

  const existing = inFlightDownloads.get(fileId);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const CHUNK_LIMIT = 3 * 1024 * 1024; // 3 MB per request
      let offset = 0;
      let total = 0;
      const parts: Uint8Array[] = [];

      while (true) {
        const res = await postToAppsScript(
          {
            action: 'chunk',
            id: fileId,
            offset,
            limit: CHUNK_LIMIT
          },
          45_000
        );

        if (!res || res.error || res.status === 'error' || !res.data) {
          throw new Error(res?.error || res?.message || 'No se pudo descargar el contenido multimedia desde Drive.');
        }

        const chunkBytes = base64ToUint8Array(res.data);
        parts.push(chunkBytes);
        total = Number(res.total) || offset + chunkBytes.length;
        offset = Number(res.nextOffset) || offset + chunkBytes.length;

        if (onProgress && total > 0) {
          onProgress(Math.min(99, Math.round((offset / total) * 100)));
        }

        if (res.done || offset >= total || chunkBytes.length === 0) {
          break;
        }
      }

      const cleanMime = (mimeType || 'application/octet-stream').split(';')[0].trim();
      const blob = new Blob(parts, { type: cleanMime });
      const blobUrl = URL.createObjectURL(blob);
      driveBlobUrlCache.set(fileId, blobUrl);
      if (onProgress) onProgress(100);
      return blobUrl;
    } finally {
      inFlightDownloads.delete(fileId);
    }
  })();

  inFlightDownloads.set(fileId, promise);
  return promise;
}

/**
 * Native Audio Player that automatically streams audio bytes from Google Drive
 * (since https://drive.google.com/file/d/.../view is an HTML viewer page and not a raw audio stream).
 */
export const DriveAudioPlayer: React.FC<{
  attachment: Attachment;
  className?: string;
}> = ({ attachment, className }) => {
  const fileId = extractDriveFileId(attachment);
  const directPlayable =
    driveBlobUrlCache.get(attachment.id) ||
    (fileId ? driveBlobUrlCache.get(fileId) : undefined) ||
    (attachment.url?.startsWith('blob:') || attachment.url?.startsWith('data:audio/') ? attachment.url : undefined);

  const [audioSrc, setAudioSrc] = useState<string | undefined>(directPlayable);
  const [loading, setLoading] = useState<boolean>(!directPlayable && Boolean(fileId));
  const [error, setError] = useState<string | null>(null);

  const loadAudio = async () => {
    if (!fileId) return;
    setLoading(true);
    setError(null);
    try {
      const lower = (attachment.name || '').toLowerCase();
      const fallbackMime = lower.endsWith('.m4a') || lower.endsWith('.mp4')
        ? 'audio/mp4'
        : lower.endsWith('.mp3')
        ? 'audio/mpeg'
        : lower.endsWith('.wav')
        ? 'audio/wav'
        : 'audio/webm';
      const url = await fetchDriveFileAsBlobUrl(fileId, attachment.type || fallbackMime);
      if (attachment.id) driveBlobUrlCache.set(attachment.id, url);
      setAudioSrc(url);
    } catch (err: any) {
      console.warn('[DriveAudioPlayer] Error cargando audio desde Drive:', err);
      setError('No se pudo cargar el audio.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (directPlayable) {
      setAudioSrc(directPlayable);
      setLoading(false);
      return;
    }
    if (fileId) {
      loadAudio();
    }
  }, [fileId, attachment.url, attachment.id]);

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold', className)}>
        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
        <span>Cargando audio desde Google Drive...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold', className)}>
        <span>{error}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            loadAudio();
          }}
          className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 text-white uppercase text-[8.5px] font-black cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!audioSrc) {
    return (
      <div className={cn('flex items-center gap-1.5 text-[9px] text-amber-500 font-bold', className)}>
        <Clock className="w-3 h-3 animate-pulse" />
        <span>Sincronizando nota de voz...</span>
      </div>
    );
  }

  return (
    <audio
      controls
      preload="metadata"
      src={audioSrc}
      onClick={(e) => e.stopPropagation()}
      className={cn('w-full h-8 rounded-lg', className)}
    />
  );
};

/**
 * Image Preview with automatic fallback to binary chunk download if Google Drive thumbnail is blocked.
 */
export const DriveImagePreview: React.FC<{
  attachment: Attachment;
  isMe?: boolean;
  compact?: boolean;
}> = ({ attachment, isMe, compact }) => {
  const fileId = extractDriveFileId(attachment);
  const cachedBlob =
    driveBlobUrlCache.get(attachment.id) ||
    (fileId ? driveBlobUrlCache.get(fileId) : undefined) ||
    (attachment.url?.startsWith('blob:') || attachment.url?.startsWith('data:image/') ? attachment.url : undefined);

  const defaultThumb =
    cachedBlob ||
    (fileId
      ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`
      : getAuthenticatedDriveUrl(attachment.url, null));

  const [imgSrc, setImgSrc] = useState<string>(defaultThumb || '');
  const [fallbackTried, setFallbackTried] = useState(false);
  const [loadingFallback, setLoadingFallback] = useState(false);

  useEffect(() => {
    setImgSrc(defaultThumb || '');
    setFallbackTried(false);
  }, [defaultThumb]);

  const handleImageError = async () => {
    if (fallbackTried || !fileId) return;
    setFallbackTried(true);
    setLoadingFallback(true);
    try {
      const blobUrl = await fetchDriveFileAsBlobUrl(fileId, attachment.type || 'image/jpeg');
      if (attachment.id) driveBlobUrlCache.set(attachment.id, blobUrl);
      setImgSrc(blobUrl);
    } catch (err) {
      console.warn('[DriveImagePreview] Error en descarga directa de imagen:', err);
    } finally {
      setLoadingFallback(false);
    }
  };

  const openUrl =
    attachment.webViewLink ||
    (fileId ? `https://drive.google.com/file/d/${fileId}/view` : '') ||
    imgSrc;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'mt-2 rounded-2xl overflow-hidden border transition-all',
        isMe ? 'bg-white/5 border-white/15' : 'bg-slate-900/50 border-slate-800',
        compact ? 'max-w-xs' : 'max-w-sm'
      )}
    >
      {imgSrc ? (
        <a href={openUrl} target="_blank" rel="noreferrer" className="block relative group/img bg-black/40">
          <img
            src={imgSrc}
            alt={attachment.name}
            referrerPolicy="no-referrer"
            onError={handleImageError}
            className={cn(
              'w-full object-cover transition-transform duration-300 group-hover/img:scale-[1.02]',
              compact ? 'max-h-48' : 'max-h-64'
            )}
          />
          {loadingFallback && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 text-white text-[10px] font-bold">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Cargando foto...</span>
            </div>
          )}
        </a>
      ) : (
        <div className="p-6 flex items-center justify-center gap-2 text-amber-400 text-[10px] font-bold">
          <Clock className="w-4 h-4 animate-pulse" />
          <span>Subiendo foto a Drive...</span>
        </div>
      )}
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <ImageIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[10px] font-bold truncate text-slate-200">{attachment.name}</span>
        </div>
        {openUrl && (
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[8.5px] font-black uppercase text-blue-400 hover:underline shrink-0 flex items-center gap-1"
          >
            <span>Abrir</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
    </div>
  );
};

/**
 * Native Video Player that can play local session blobs immediately OR stream raw video bytes
 * directly from Google Drive (bypassing Google Drive's 10-minute video transcoding delay).
 */
export const DriveVideoPlayer: React.FC<{
  attachment: Attachment;
  isMe?: boolean;
}> = ({ attachment, isMe }) => {
  const fileId = extractDriveFileId(attachment);
  const cachedBlob =
    driveBlobUrlCache.get(attachment.id) ||
    (fileId ? driveBlobUrlCache.get(fileId) : undefined) ||
    (attachment.url?.startsWith('blob:') || attachment.url?.startsWith('data:video/') ? attachment.url : undefined);

  const [videoSrc, setVideoSrc] = useState<string | undefined>(cachedBlob);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  useEffect(() => {
    if (cachedBlob) {
      setVideoSrc(cachedBlob);
    }
  }, [cachedBlob]);

  const handleLoadNativeVideo = async () => {
    if (!fileId) return;
    setLoading(true);
    setProgress(5);
    try {
      const blobUrl = await fetchDriveFileAsBlobUrl(
        fileId,
        attachment.type || 'video/mp4',
        (pct) => setProgress(pct)
      );
      if (attachment.id) driveBlobUrlCache.set(attachment.id, blobUrl);
      setVideoSrc(blobUrl);
    } catch (err) {
      console.warn('[DriveVideoPlayer] Usando visor iframe de respaldo:', err);
      setUseIframeFallback(true);
    } finally {
      setLoading(false);
    }
  };

  const openUrl =
    attachment.webViewLink ||
    (fileId ? `https://drive.google.com/file/d/${fileId}/view` : '') ||
    videoSrc ||
    '';

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'mt-2 rounded-2xl overflow-hidden border transition-all max-w-md',
        isMe ? 'bg-white/5 border-white/15' : 'bg-slate-900/60 border-slate-800'
      )}
    >
      {videoSrc ? (
        <video
          controls
          playsInline
          src={videoSrc}
          className="w-full max-h-64 bg-black object-contain"
        />
      ) : useIframeFallback && fileId ? (
        <iframe
          src={`https://drive.google.com/file/d/${fileId}/preview`}
          className="w-full h-56 bg-black border-0"
          allow="autoplay; fullscreen"
          title={attachment.name}
        />
      ) : fileId ? (
        <div className="relative h-44 bg-gradient-to-br from-slate-900 via-purple-950/40 to-black flex flex-col items-center justify-center p-4 text-center gap-2.5">
          {loading ? (
            <>
              <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-300">
                Cargando video ({progress}%)...
              </span>
              <div className="w-40 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleLoadNativeVideo}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-wider shadow-xl active:scale-95 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Reproducir Video Aquí</span>
              </button>
              <span className="text-[8.5px] text-slate-400 font-semibold">
                Reproducción directa sin esperar procesamiento de Drive
              </span>
            </>
          )}
        </div>
      ) : (
        <div className="p-6 flex items-center justify-center gap-2 text-amber-400 text-[10px] font-bold">
          <Clock className="w-4 h-4 animate-pulse" />
          <span>Subiendo video a Drive...</span>
        </div>
      )}

      <div className="px-3 py-2 flex items-center justify-between gap-2 bg-black/30">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Video className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span className="text-[10px] font-bold truncate text-slate-200">{attachment.name}</span>
        </div>
        {openUrl && (
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[8.5px] font-black uppercase text-purple-400 hover:underline shrink-0 flex items-center gap-1"
          >
            <span>Drive</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
    </div>
  );
};
