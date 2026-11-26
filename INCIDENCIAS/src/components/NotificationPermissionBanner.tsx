import React, { useState, useEffect } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { requestNotificationPermission } from '../services/pushNotificationService';
import { motion, AnimatePresence } from 'motion/react';

export const NotificationPermissionBanner: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [status, setStatus] = useState<string>('idle');

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    const dismissed = sessionStorage.getItem('nora_notif_banner_dismissed');
    if (dismissed) return;

    if (Notification.permission === 'default') {
      // Mostrar banner al usuario para que active las notificaciones con un clic
      const timer = setTimeout(() => setShowBanner(true), 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleEnable = async () => {
    setStatus('enabling');
    try {
      const res = await requestNotificationPermission();
      if (res === 'granted') {
        setStatus('granted');
        setTimeout(() => setShowBanner(false), 2000);
      } else {
        setShowBanner(false);
      }
    } catch (_) {
      setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('nora_notif_banner_dismissed', 'true');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        className="fixed top-14 left-1/2 -translate-x-1/2 z-[90] max-w-[94vw] sm:max-w-md w-full pointer-events-auto"
      >
        <div className="p-3.5 rounded-2xl bg-slate-900/95 dark:bg-[#080d1a]/95 border border-amber-500/40 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-400 truncate">
                Activar Notificaciones en el Celular
              </p>
              <p className="text-[8.5px] text-slate-300 truncate">
                Recibe avisos al instante cuando te asignen hallazgos o mensajes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {status === 'granted' ? (
              <span className="flex items-center gap-1 text-[8.5px] font-black uppercase text-emerald-400">
                <Check className="w-3.5 h-3.5" /> Activo
              </span>
            ) : (
              <button
                onClick={handleEnable}
                disabled={status === 'enabling'}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[9px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
              >
                {status === 'enabling' ? '...' : 'Activar'}
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Cerrar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NotificationPermissionBanner;
