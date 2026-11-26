import React, { useState, useEffect } from 'react';
import { subscribeSyncStatus, triggerBackgroundSync, clearOfflineQueue, SyncState } from '../services/offlineSyncService';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertTriangle, ArrowUpCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export const SyncStatusBar: React.FC = () => {
  const [syncState, setSyncState] = useState<SyncState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingIssuesCount: 0,
    pendingFilesCount: 0
  });

  const [justFinished, setJustFinished] = useState(false);
  const [prevSyncing, setPrevSyncing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const unsub = subscribeSyncStatus((state) => {
      setSyncState(state);

      if (prevSyncing && !state.isSyncing && state.pendingIssuesCount === 0 && state.pendingFilesCount === 0) {
        setJustFinished(true);
        const timer = setTimeout(() => setJustFinished(false), 4000);
        return () => clearTimeout(timer);
      }
      setPrevSyncing(state.isSyncing);
    });

    return () => unsub();
  }, [prevSyncing]);

  const hasPending = syncState.pendingIssuesCount > 0 || syncState.pendingFilesCount > 0;

  // Si el usuario lo cerró manualmente o todo está sincronizado, no mostrar
  if (isDismissed || (syncState.isOnline && !syncState.isSyncing && !hasPending && !justFinished)) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] max-w-[92vw] sm:max-w-md pointer-events-auto"
      >
        <div className={cn(
          "px-3.5 py-2 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center gap-2.5 transition-all",
          !syncState.isOnline
            ? "bg-slate-900/95 dark:bg-[#070b14]/95 border-amber-500/40 text-amber-300"
            : syncState.isSyncing
            ? "bg-slate-900/95 dark:bg-[#070b14]/95 border-blue-500/40 text-blue-300"
            : justFinished
            ? "bg-slate-900/95 dark:bg-[#070b14]/95 border-emerald-500/40 text-emerald-300"
            : "bg-slate-900/95 dark:bg-[#070b14]/95 border-slate-700 text-slate-300"
        )}>
          {/* Icon */}
          <div className="shrink-0">
            {!syncState.isOnline ? (
              <CloudOff className="w-4 h-4 text-amber-400 animate-pulse" />
            ) : syncState.isSyncing ? (
              <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
            ) : justFinished ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Cloud className="w-4 h-4 text-slate-400" />
            )}
          </div>

          {/* Text Message */}
          <div className="flex-1 min-w-0 pr-1">
            {!syncState.isOnline ? (
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-400 truncate">
                  Sin señal / Modo sin conexión
                </p>
                <p className="text-[8.5px] font-medium text-slate-300 truncate">
                  {hasPending 
                    ? `${syncState.pendingIssuesCount} incidencia(s) y ${syncState.pendingFilesCount} archivo(s) guardados en el teléfono.`
                    : 'Las incidencias se guardarán en tu teléfono y se subirán al volver la señal.'}
                </p>
              </div>
            ) : syncState.isSyncing ? (
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5 truncate">
                  Subiendo en segundo plano a Drive...
                </p>
                <p className="text-[8.5px] font-medium text-slate-300 truncate">
                  {syncState.pendingFilesCount > 0 
                    ? `Cargando fotos/videos pendientes (${syncState.pendingFilesCount} archivo(s)).`
                    : `Sincronizando incidencias pendientes (${syncState.pendingIssuesCount}).`}
                </p>
              </div>
            ) : justFinished ? (
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400 truncate">
                  Sincronización completada
                </p>
                <p className="text-[8.5px] font-medium text-slate-300 truncate">
                  Todas las incidencias y archivos están en la nube.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-300 truncate">
                  {syncState.pendingIssuesCount} incidencia(s) pendiente(s)
                </p>
                <p className="text-[8.5px] font-medium text-slate-400 truncate">
                  En espera de sincronización en segundo plano.
                </p>
              </div>
            )}
          </div>

          {/* Manual sync action button */}
          {syncState.isOnline && !syncState.isSyncing && hasPending && (
            <button
              onClick={() => triggerBackgroundSync(true)}
              className="shrink-0 px-2.5 py-1 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-[8.5px] font-black uppercase tracking-wider text-blue-300 active:scale-95 transition-all cursor-pointer"
            >
              Subir Ahora
            </button>
          )}

          {/* Dismiss button */}
          <button
            onClick={() => {
              setIsDismissed(true);
              // Limpiar la cola si el usuario descarta para que no vuelva a molestar
              clearOfflineQueue().catch(() => {});
            }}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors ml-1"
            title="Cerrar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
export default SyncStatusBar;
