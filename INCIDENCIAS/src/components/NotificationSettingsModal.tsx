import React, { useState } from 'react';
import { 
  X, Check, Settings, Bell, Zap, Calendar, BellOff, RotateCcw, 
  MessageSquare, Paperclip, CheckCircle2, ArrowRight, Clock, AlertCircle, 
  User, Briefcase, ClipboardCheck, Sparkles, Sliders
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export type NotificationFrequency = 'INSTANT' | 'WEEKLY' | 'MUTED';

export type NotificationCategory = 
  | 'NUEVAS_INCIDENCIAS'
  | 'MENSAJES_CHAT'
  | 'ARCHIVOS_EVIDENCIAS'
  | 'CAMBIOS_ESTADO'
  | 'REDIRECCIONES'
  | 'DEVOLUCIONES_RECHAZOS'
  | 'VENCIMIENTOS'
  | 'AUDITORIA_CALIDAD';

export interface RoleNotificationSettings {
  [category: string]: NotificationFrequency;
}

export interface UserNotificationPreferences {
  author: RoleNotificationSettings;
  responsible: RoleNotificationSettings;
  reviewer: RoleNotificationSettings;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
  author: {
    NUEVAS_INCIDENCIAS: 'INSTANT',
    MENSAJES_CHAT: 'INSTANT',
    ARCHIVOS_EVIDENCIAS: 'INSTANT',
    CAMBIOS_ESTADO: 'INSTANT',
    REDIRECCIONES: 'INSTANT',
    DEVOLUCIONES_RECHAZOS: 'INSTANT',
    VENCIMIENTOS: 'INSTANT',
    AUDITORIA_CALIDAD: 'WEEKLY'
  },
  responsible: {
    NUEVAS_INCIDENCIAS: 'INSTANT',
    MENSAJES_CHAT: 'INSTANT',
    ARCHIVOS_EVIDENCIAS: 'INSTANT',
    CAMBIOS_ESTADO: 'INSTANT',
    REDIRECCIONES: 'INSTANT',
    DEVOLUCIONES_RECHAZOS: 'INSTANT',
    VENCIMIENTOS: 'INSTANT',
    AUDITORIA_CALIDAD: 'WEEKLY'
  },
  reviewer: {
    NUEVAS_INCIDENCIAS: 'WEEKLY',
    MENSAJES_CHAT: 'WEEKLY',
    ARCHIVOS_EVIDENCIAS: 'WEEKLY',
    CAMBIOS_ESTADO: 'INSTANT',
    REDIRECCIONES: 'WEEKLY',
    DEVOLUCIONES_RECHAZOS: 'INSTANT',
    VENCIMIENTOS: 'WEEKLY',
    AUDITORIA_CALIDAD: 'INSTANT'
  }
};

export interface CategoryDefinition {
  id: NotificationCategory;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  examples: string;
}

export const NOTIFICATION_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'NUEVAS_INCIDENCIAS',
    name: 'Nuevas Asignaciones y Hallazgos',
    description: 'Cuando se crea una nueva incidencia o te la asignan por primera vez.',
    icon: Bell,
    examples: 'Registro de hallazgo en obra o nueva incidencia asignada a tu cargo'
  },
  {
    id: 'MENSAJES_CHAT',
    name: 'Mensajes y Comentarios en el Chat',
    description: 'Intercambio de mensajes, solicitudes de información o sustentos técnicos.',
    icon: MessageSquare,
    examples: 'Comentarios de autores, contratistas o revisores en el canal técnico'
  },
  {
    id: 'ARCHIVOS_EVIDENCIAS',
    name: 'Carga de Archivos y Evidencias',
    description: 'Nuevas fotos, planos, videos o documentos adjuntos en Google Drive.',
    icon: Paperclip,
    examples: 'Archivos fotográficos, informes PDF y evidencias técnicas subidas'
  },
  {
    id: 'CAMBIOS_ESTADO',
    name: 'Cambios de Estado de la Incidencia',
    description: 'Respuestas finalizadas, resoluciones, pactos de acuerdos o cierres.',
    icon: CheckCircle2,
    examples: 'Paso a Respondida, Resuelta, Pacto de Fecha o Anulación'
  },
  {
    id: 'REDIRECCIONES',
    name: 'Redirecciones y Colaboradores',
    description: 'Delegaciones a ejecutores de campo o adición de colaboradores técnicos.',
    icon: ArrowRight,
    examples: 'Asignación de ejecutor, visto bueno de colaboradores'
  },
  {
    id: 'DEVOLUCIONES_RECHAZOS',
    name: 'Devoluciones y Rechazos',
    description: 'Incidencias devueltas a la fuente, rechazos de redirección o ratificaciones.',
    icon: RotateCcw,
    examples: 'Devolución de responsabilidad, rechazo de asignación o ratificación'
  },
  {
    id: 'VENCIMIENTOS',
    name: 'Alertas de Vencimiento y Plazos',
    description: 'Avisos preventivos cuando una fecha límite está próxima o vencida.',
    icon: Clock,
    examples: 'Incidencias por vencer en 48 horas o con plazo sobrepasado'
  },
  {
    id: 'AUDITORIA_CALIDAD',
    name: 'Auditoría y Calidad ISO 19650',
    description: 'Alertas de medición inicial (15 días) y evaluación de eficacia (3 meses).',
    icon: AlertCircle,
    examples: 'Controles periódicos del Sistema de Gestión de Calidad'
  }
];

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserNotificationPreferences;
  onSave: (newPrefs: UserNotificationPreferences) => Promise<void>;
  initialRole?: 'author' | 'responsible' | 'reviewer';
}

export default function NotificationSettingsModal({
  isOpen,
  onClose,
  preferences,
  onSave,
  initialRole = 'author'
}: NotificationSettingsModalProps) {
  const [activeRole, setActiveRole] = useState<'author' | 'responsible' | 'reviewer'>(initialRole);
  const [draftPrefs, setDraftPrefs] = useState<UserNotificationPreferences>(preferences);
  const [isSaving, setIsSaving] = useState(false);

  // Keep in sync when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setDraftPrefs(preferences);
      setActiveRole(initialRole);
    }
  }, [isOpen, preferences, initialRole]);

  if (!isOpen) return null;

  const currentRoleSettings = draftPrefs[activeRole] || DEFAULT_NOTIFICATION_PREFERENCES[activeRole];

  const handleFrequencyChange = (catId: NotificationCategory, freq: NotificationFrequency) => {
    setDraftPrefs(prev => ({
      ...prev,
      [activeRole]: {
        ...(prev[activeRole] || {}),
        [catId]: freq
      }
    }));
  };

  const handleApplyAll = (freq: NotificationFrequency) => {
    const updatedRoleSettings: RoleNotificationSettings = {};
    NOTIFICATION_CATEGORIES.forEach(c => {
      updatedRoleSettings[c.id] = freq;
    });
    setDraftPrefs(prev => ({
      ...prev,
      [activeRole]: updatedRoleSettings
    }));
  };

  const handleResetDefaults = () => {
    setDraftPrefs(prev => ({
      ...prev,
      [activeRole]: { ...DEFAULT_NOTIFICATION_PREFERENCES[activeRole] }
    }));
  };

  const handleSaveAndClose = async () => {
    setIsSaving(true);
    try {
      const savePromise = onSave(draftPrefs);
      await Promise.race([
        savePromise,
        new Promise(resolve => setTimeout(resolve, 800))
      ]);
      onClose();
    } catch (err) {
      console.warn("Error al guardar preferencias:", err);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-4xl bg-white dark:bg-[#070d18] border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 md:p-8 pb-5 border-b border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-[#0a1324]/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-sm">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">
                Configuración de Notificaciones por Rol
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Personaliza de forma individual qué notificaciones recibes y su frecuencia según tu función.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all active:scale-95"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role Selector Tabs */}
        <div className="px-6 md:px-8 py-3.5 bg-slate-50/80 dark:bg-[#040812] border-b border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 p-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            {[
              { id: 'author', label: 'Rol: Autor', icon: User, desc: 'Incidencias que creaste' },
              { id: 'responsible', label: 'Rol: Responsable', icon: Briefcase, desc: 'Incidencias asignadas a ti' },
              { id: 'reviewer', label: 'Rol: Revisor', icon: ClipboardCheck, desc: 'Auditoría y comités' }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeRole === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveRole(tab.id as any)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
                    isActive
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider">
            <span className="text-slate-400 dark:text-slate-600 mr-1 hidden sm:inline">Aplicar a este rol:</span>
            <button
              onClick={() => handleApplyAll('INSTANT')}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-all cursor-pointer"
            >
              Todo al Instante
            </button>
            <button
              onClick={() => handleApplyAll('WEEKLY')}
              className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition-all cursor-pointer"
            >
              Todo Semanal
            </button>
            <button
              onClick={handleResetDefaults}
              className="px-2.5 py-1 rounded-lg bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
            >
              Por Defecto
            </button>
          </div>
        </div>

        {/* Content: List of notification categories with 3-way toggle */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 custom-scrollbar">
          {NOTIFICATION_CATEGORIES.map((category) => {
            const Icon = category.icon;
            const currentFreq: NotificationFrequency = currentRoleSettings[category.id] || 'INSTANT';

            return (
              <div
                key={category.id}
                className={cn(
                  "p-5 rounded-2xl border transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4",
                  currentFreq === 'INSTANT' 
                    ? "bg-white dark:bg-[#0c162b] border-slate-200 dark:border-slate-800 shadow-sm"
                    : currentFreq === 'WEEKLY'
                      ? "bg-indigo-500/[0.03] dark:bg-indigo-950/20 border-indigo-500/20 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 opacity-60 hover:opacity-100"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                    currentFreq === 'INSTANT' ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" :
                    currentFreq === 'WEEKLY' ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30" :
                    "bg-slate-200 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        {category.name}
                      </h4>
                      {currentFreq === 'INSTANT' && (
                        <span className="px-2 py-0.5 rounded-full text-[7.5px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          ⚡ En Tiempo Real
                        </span>
                      )}
                      {currentFreq === 'WEEKLY' && (
                        <span className="px-2 py-0.5 rounded-full text-[7.5px] font-black uppercase tracking-wider bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                          📅 Resumen Semanal
                        </span>
                      )}
                      {currentFreq === 'MUTED' && (
                        <span className="px-2 py-0.5 rounded-full text-[7.5px] font-black uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-500">
                          🔕 Desactivado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 leading-relaxed">
                      {category.description}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-600 font-semibold mt-1">
                      Ejemplo: {category.examples}
                    </p>
                  </div>
                </div>

                {/* 3-way Segmented Button */}
                <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900/90 rounded-2xl border border-slate-200 dark:border-slate-800 self-start md:self-center shrink-0">
                  <button
                    onClick={() => handleFrequencyChange(category.id, 'INSTANT')}
                    className={cn(
                      "px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                      currentFreq === 'INSTANT'
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20 scale-[1.02]"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    )}
                    title="Recibir aviso en tiempo real en la bandeja"
                  >
                    <Zap className="w-3 h-3" />
                    <span>Al Instante</span>
                  </button>

                  <button
                    onClick={() => handleFrequencyChange(category.id, 'WEEKLY')}
                    className={cn(
                      "px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                      currentFreq === 'WEEKLY'
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-[1.02]"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    )}
                    title="No saturar la bandeja diaria; agrupar en el reporte semanal"
                  >
                    <Calendar className="w-3 h-3" />
                    <span>Semanal</span>
                  </button>

                  <button
                    onClick={() => handleFrequencyChange(category.id, 'MUTED')}
                    className={cn(
                      "px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                      currentFreq === 'MUTED'
                        ? "bg-slate-700 dark:bg-slate-800 text-white shadow-md scale-[1.02]"
                        : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    )}
                    title="Silenciar por completo este tipo de notificación para este rol"
                  >
                    <BellOff className="w-3 h-3" />
                    <span>No Recibir</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-6 md:p-8 pt-4 border-t border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-[#0a1324]/80 flex items-center justify-between gap-4">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Esta configuración se guarda únicamente para tu usuario y se sincroniza en todos tus dispositivos.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveAndClose}
              disabled={isSaving}
              className="px-8 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all shadow-xl hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Preferencias'}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
