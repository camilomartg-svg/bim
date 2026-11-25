import React, { useState, useEffect, useMemo } from 'react';
import { Issue, Comment } from '../types';
import { useAuth } from '../context/AuthContext';
import { subscribeToIssues } from '../services/firebaseService';
import { isMedicionAlertActive, isEficaciaAlertActive } from '../utils/followUpUtils';
import { isIncidentsAdmin } from '../utils/userScope';
import { 
  Bell, User, Briefcase, ClipboardCheck, ArrowRight, CheckCircle2, 
  XCircle, AlertTriangle, Clock, RotateCcw, ShieldAlert, MessageSquare, 
  Search, CheckCheck, Filter, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format, differenceInDays, isPast } from 'date-fns';
import { es } from 'date-fns/locale';

interface NotificationItem {
  id: string;
  issue: Issue;
  role: 'author' | 'responsible' | 'reviewer';
  type: 
    | 'DEVUELTA_A_FUENTE'
    | 'REDIRECCION_RECHAZADA'
    | 'RESPUESTA_LISTA'
    | 'ACUERDO'
    | 'REDIRECCION_PENDIENTE'
    | 'RESPUESTA_RECHAZADA'
    | 'VENCIDA'
    | 'POR_VENCER'
    | 'AUDITORIA_PENDIENTE'
    | 'SEGUIMIENTO_MEDICION'
    | 'SEGUIMIENTO_EFICACIA'
    | 'NUEVO_COMENTARIO';
  title: string;
  description: string;
  timestamp: string;
  priority: 'URGENTE' | 'ALTA' | 'MEDIA' | 'NORMAL';
  badgeLabel: string;
  badgeColor: string;
}

interface NotificationsViewProps {
  onSelectIssue: (issue: Issue, role: 'author' | 'responsible' | 'reviewer') => void;
  canAccessBim?: boolean;
}

export default function NotificationsView({ onSelectIssue, canAccessBim }: NotificationsViewProps) {
  const { user } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('nora_read_notifications') || '[]');
    } catch {
      return [];
    }
  });

  const markAsRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReadIds(prev => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      try {
        localStorage.setItem('nora_read_notifications', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const markAllAsRead = () => {
    const allIds = allNotifications.map(n => n.id);
    setReadIds(allIds);
    try {
      localStorage.setItem('nora_read_notifications', JSON.stringify(allIds));
    } catch (_) {}
  };

  useEffect(() => {
    const unsub = subscribeToIssues((fetchedIssues) => {
      setIssues(fetchedIssues);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const cleanStr = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const userEmail = (user?.email || '').toLowerCase().trim();
  const userNameClean = cleanStr(user?.name);
  const userId = user?.id || '';
  const isAdmin = isIncidentsAdmin(user) || user?.role === 'admin' || canAccessBim;

  const allNotifications = useMemo(() => {
    const list: NotificationItem[] = [];

    issues.forEach((issue) => {
      const authorEmail = (issue.authorEmail || '').toLowerCase().trim();
      const creatorNameClean = cleanStr(issue.creatorName);
      const assignedEmail = (issue.assignedEmail || '').toLowerCase().trim();
      const assignedNameClean = cleanStr(issue.assignedName);
      const collaboratorEmail = (issue.redirectedTo?.email || '').toLowerCase().trim();
      const executorEmail = (issue.executor?.email || '').toLowerCase().trim();

      const isAuthor = Boolean(
        (userEmail && authorEmail && userEmail === authorEmail) ||
        (userId && issue.creatorId && userId === issue.creatorId) ||
        (userNameClean && creatorNameClean && userNameClean === creatorNameClean)
      );

      const isResponsible = Boolean(
        (userEmail && assignedEmail && userEmail === assignedEmail) ||
        (userNameClean && assignedNameClean && userNameClean === assignedNameClean) ||
        (userEmail && collaboratorEmail && userEmail === collaboratorEmail) ||
        (userEmail && executorEmail && userEmail === executorEmail)
      );

      const isReviewer = Boolean(
        (userEmail && issue.reviewerEmails?.some(e => e.toLowerCase() === userEmail)) ||
        isAdmin
      );

      const dueDate = issue.dueDate ? new Date(issue.dueDate + 'T23:59:59') : null;
      const isOverdue = dueDate ? isPast(dueDate) : false;
      const daysLeft = dueDate ? differenceInDays(dueDate, new Date()) : null;

      // ==========================================
      // 1. COLUMNA: AUTOR
      // ==========================================
      if (isAuthor) {
        // A. Incidencia devuelta a la fuente
        if (issue.returnedToSource || issue.redirectionStatus === 'DEVUELTA_A_FUENTE') {
          list.push({
            id: `notif_auth_returned_${issue.id}_${issue.returnedAt || 'ret'}`,
            issue,
            role: 'author',
            type: 'DEVUELTA_A_FUENTE',
            title: `Devuelta a la fuente: ${issue.code}`,
            description: issue.returnToSourceReason 
              ? `Motivo: ${issue.returnToSourceReason}` 
              : `La incidencia te fue devuelta por el responsable para su reasignación.`,
            timestamp: issue.returnedAt || issue.updatedAt || issue.createdAt,
            priority: 'URGENTE',
            badgeLabel: 'Devuelta al Autor',
            badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
          });
        }

        // B. Redirección rechazada
        if (issue.redirectionStatus === 'RECHAZADA') {
          list.push({
            id: `notif_auth_reject_redir_${issue.id}`,
            issue,
            role: 'author',
            type: 'REDIRECCION_RECHAZADA',
            title: `Redirección rechazada en ${issue.code}`,
            description: issue.redirectionRejectionReason
              ? `Motivo de rechazo: ${issue.redirectionRejectionReason}`
              : `El destinatario no aceptó la redirección.`,
            timestamp: issue.updatedAt || issue.createdAt,
            priority: 'ALTA',
            badgeLabel: 'Redirección Rechazada',
            badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
          });
        }

        // C. Respuesta técnica finalizada (lista para validar)
        if (issue.status === 'RESPONDIDA') {
          list.push({
            id: `notif_auth_resp_${issue.id}`,
            issue,
            role: 'author',
            type: 'RESPUESTA_LISTA',
            title: `Respuesta técnica lista: ${issue.code}`,
            description: `El responsable ha completado la respuesta. Revisa el sustento y valida o rechaza la resolución.`,
            timestamp: issue.updatedAt || issue.createdAt,
            priority: 'MEDIA',
            badgeLabel: 'Por Validar',
            badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
          });
        }

        // D. Acuerdo establecido
        if (issue.status === 'ACUERDO') {
          list.push({
            id: `notif_auth_acuerdo_${issue.id}`,
            issue,
            role: 'author',
            type: 'ACUERDO',
            title: `Acuerdo establecido en ${issue.code}`,
            description: `Nueva fecha compromiso acordada: ${issue.agreementDate || 'Fecha pactada'}.`,
            timestamp: issue.updatedAt || issue.createdAt,
            priority: 'NORMAL',
            badgeLabel: 'Acuerdo',
            badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
          });
        }

        // E. Vencida sin respuesta
        if (isOverdue && issue.status === 'ACTIVO') {
          list.push({
            id: `notif_auth_overdue_${issue.id}`,
            issue,
            role: 'author',
            type: 'VENCIDA',
            title: `Plazo vencido: ${issue.code}`,
            description: `La incidencia superó la fecha límite sin haber sido respondida.`,
            timestamp: issue.dueDate || issue.updatedAt,
            priority: 'ALTA',
            badgeLabel: 'Vencida',
            badgeColor: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
          });
        }
      }

      // ==========================================
      // 2. COLUMNA: RESPONSABLE
      // ==========================================
      if (isResponsible) {
        // A. Redirección pendiente de aceptación
        const isPendingRedir = Boolean(
          issue.pendingRedirection || 
          issue.redirectionStatus === 'PENDIENTE' ||
          (issue.comments && issue.comments.some(c => c.text && c.text.includes('Incidencia redirigida a') && !issue.comments.some(c2 => c2.text && (c2.text.includes('REDIRECCIÓN ACEPTADA') || c2.text.includes('REDIRECCIÓN RECHAZADA')))))
        );

        if (isPendingRedir && issue.status !== 'RESPONDIDA' && issue.status !== 'RESUELTA' && issue.status !== 'ANULADA') {
          list.push({
            id: `notif_resp_pending_${issue.id}`,
            issue,
            role: 'responsible',
            type: 'REDIRECCION_PENDIENTE',
            title: `Asignación pendiente de aceptación: ${issue.code}`,
            description: `Te han redirigido esta incidencia. Ingresa para aceptarla o rechazarla con justificación obligatoria.`,
            timestamp: issue.updatedAt || issue.createdAt,
            priority: 'URGENTE',
            badgeLabel: 'Pendiente Aceptación',
            badgeColor: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
          });
        }

        // B. Respuesta técnica rechazada
        if (issue.status === 'RECHAZADA') {
          list.push({
            id: `notif_resp_rechazada_${issue.id}`,
            issue,
            role: 'responsible',
            type: 'RESPUESTA_RECHAZADA',
            title: `Respuesta rechazada: ${issue.code}`,
            description: issue.rejectionReason 
              ? `Observación: ${issue.rejectionReason}` 
              : `La respuesta técnica fue rechazada y requiere correcciones.`,
            timestamp: issue.updatedAt || issue.createdAt,
            priority: 'ALTA',
            badgeLabel: 'Rechazada',
            badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
          });
        }

        // C. Vencida o por vencer
        if (issue.status === 'ACTIVO' && daysLeft !== null) {
          if (daysLeft < 0) {
            list.push({
              id: `notif_resp_overdue_${issue.id}`,
              issue,
              role: 'responsible',
              type: 'VENCIDA',
              title: `Incidencia vencida: ${issue.code}`,
              description: `Venció hace ${Math.abs(daysLeft)} día(s). Requiere atención inmediata.`,
              timestamp: issue.dueDate || issue.updatedAt,
              priority: 'URGENTE',
              badgeLabel: 'Vencida',
              badgeColor: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
            });
          } else if (daysLeft <= 2) {
            list.push({
              id: `notif_resp_expiring_${issue.id}`,
              issue,
              role: 'responsible',
              type: 'POR_VENCER',
              title: `Próxima a vencer: ${issue.code}`,
              description: daysLeft === 0 ? `Vence hoy.` : `Vence en ${daysLeft} día(s).`,
              timestamp: issue.dueDate || issue.updatedAt,
              priority: 'MEDIA',
              badgeLabel: 'Por Vencer',
              badgeColor: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30'
            });
          }
        }
      }

      // ==========================================
      // 3. COLUMNA: REVISOR
      // ==========================================
      if (isReviewer) {
        // A. Incidencia lista para auditar o validar
        if (issue.status === 'RESPONDIDA') {
          list.push({
            id: `notif_rev_auditoria_${issue.id}`,
            issue,
            role: 'reviewer',
            type: 'AUDITORIA_PENDIENTE',
            title: `Pendiente de auditoría y cierre: ${issue.code}`,
            description: `Respuesta técnica finalizada. Disponible para validación, rechazo o establecimiento de acuerdo.`,
            timestamp: issue.updatedAt || issue.createdAt,
            priority: 'ALTA',
            badgeLabel: 'Auditoría Pendiente',
            badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
          });
        }

        // B. Alerta de Medición Inicial de Calidad
        if (isMedicionAlertActive(issue)) {
          list.push({
            id: `notif_rev_medicion_${issue.id}`,
            issue,
            role: 'reviewer',
            type: 'SEGUIMIENTO_MEDICION',
            title: `Seguimiento de medición inicial: ${issue.code}`,
            description: `Se requiere registrar el seguimiento y valoración de la acción correctiva (1er control).`,
            timestamp: issue.updatedAt || issue.createdAt,
            priority: 'ALTA',
            badgeLabel: 'Medición Calidad',
            badgeColor: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
          });
        }

        // C. Alerta de Eficacia de Calidad
        if (isEficaciaAlertActive(issue)) {
          list.push({
            id: `notif_rev_eficacia_${issue.id}`,
            issue,
            role: 'reviewer',
            type: 'SEGUIMIENTO_EFICACIA',
            title: `Seguimiento de eficacia: ${issue.code}`,
            description: `Cumplimiento de plazo para evaluar la eficacia técnica de la medida correctiva (2do control).`,
            timestamp: issue.updatedAt || issue.createdAt,
            priority: 'ALTA',
            badgeLabel: 'Eficacia Calidad',
            badgeColor: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
          });
        }

        // D. En revisión por parte de colaboradores
        if (issue.status === 'REVISION_RESPONSABLE') {
          list.push({
            id: `notif_rev_revision_${issue.id}`,
            issue,
            role: 'reviewer',
            type: 'AUDITORIA_PENDIENTE',
            title: `En revisión interna: ${issue.code}`,
            description: `Colaborador o ejecutor ha emitido respuesta parcial para visto bueno.`,
            timestamp: issue.updatedAt || issue.createdAt,
            priority: 'NORMAL',
            badgeLabel: 'Revisión en Proceso',
            badgeColor: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'
          });
        }
      }
    });

    // Sort by timestamp desc
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [issues, userEmail, userNameClean, userId, isAdmin]);

  // Split into 3 columns
  const authorNotifications = useMemo(() => {
    return allNotifications.filter(n => {
      const matchRole = n.role === 'author';
      if (!searchTerm.trim()) return matchRole;
      const term = searchTerm.toLowerCase();
      return matchRole && (n.title.toLowerCase().includes(term) || n.description.toLowerCase().includes(term) || n.issue.code.toLowerCase().includes(term));
    });
  }, [allNotifications, searchTerm]);

  const responsibleNotifications = useMemo(() => {
    return allNotifications.filter(n => {
      const matchRole = n.role === 'responsible';
      if (!searchTerm.trim()) return matchRole;
      const term = searchTerm.toLowerCase();
      return matchRole && (n.title.toLowerCase().includes(term) || n.description.toLowerCase().includes(term) || n.issue.code.toLowerCase().includes(term));
    });
  }, [allNotifications, searchTerm]);

  const reviewerNotifications = useMemo(() => {
    return allNotifications.filter(n => {
      const matchRole = n.role === 'reviewer';
      if (!searchTerm.trim()) return matchRole;
      const term = searchTerm.toLowerCase();
      return matchRole && (n.title.toLowerCase().includes(term) || n.description.toLowerCase().includes(term) || n.issue.code.toLowerCase().includes(term));
    });
  }, [allNotifications, searchTerm]);

  const unreadAuthor = authorNotifications.filter(n => !readIds.includes(n.id)).length;
  const unreadResponsible = responsibleNotifications.filter(n => !readIds.includes(n.id)).length;
  const unreadReviewer = reviewerNotifications.filter(n => !readIds.includes(n.id)).length;
  const totalUnread = unreadAuthor + unreadResponsible + unreadReviewer;

  const renderColumn = (
    title: string,
    role: 'author' | 'responsible' | 'reviewer',
    subtitle: string,
    items: NotificationItem[],
    unreadCount: number,
    icon: React.ReactNode,
    accentBorder: string
  ) => {
    return (
      <div className={cn(
        "flex-1 flex flex-col min-w-[320px] bg-slate-50/70 dark:bg-[#070d18] rounded-[2rem] border border-slate-200/80 dark:border-slate-800/80 shadow-xl overflow-hidden transition-all duration-300",
        accentBorder
      )}>
        {/* Column Header */}
        <div className="p-6 pb-4 border-b border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-[#0a1324]/80 backdrop-blur-md">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-slate-800 dark:text-slate-200 shadow-sm">
                {icon}
              </div>
              <div>
                <h3 className="text-base font-display font-black text-slate-900 dark:text-white uppercase tracking-wider">{title}</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{subtitle}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <span className="px-2.5 py-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm">
                  {unreadCount} nuevas
                </span>
              )}
              <span className="px-2.5 py-1 bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-[9px] font-black">
                {items.length}
              </span>
            </div>
          </div>
        </div>

        {/* Notification Cards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
          {items.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-600">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-3 text-slate-400">
                <CheckCircle2 className="w-6 h-6 stroke-1" />
              </div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Sin notificaciones</p>
              <p className="text-[10px] mt-1 text-slate-400 dark:text-slate-600">No hay alertas o acciones pendientes en esta categoría.</p>
            </div>
          ) : (
            items.map(item => {
              const isRead = readIds.includes(item.id);
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => {
                    markAsRead(item.id);
                    onSelectIssue(item.issue, item.role);
                  }}
                  className={cn(
                    "p-5 rounded-2xl border transition-all duration-200 cursor-pointer group relative overflow-hidden",
                    isRead 
                      ? "bg-white/60 dark:bg-[#0c162b]/60 border-slate-200/80 dark:border-slate-800/80 hover:bg-white dark:hover:bg-[#101c36] shadow-sm opacity-80 hover:opacity-100" 
                      : "bg-white dark:bg-[#0f1d38] border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 shadow-md hover:shadow-lg"
                  )}
                >
                  {/* Unread Indicator Bar */}
                  {!isRead && (
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500 rounded-r-full" />
                  )}

                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-white px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
                        {item.issue.code}
                      </span>
                      <span className={cn("text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border", item.badgeColor)}>
                        {item.badgeLabel}
                      </span>
                    </div>

                    <span className="text-[8.5px] font-semibold text-slate-400 dark:text-slate-500 shrink-0">
                      {format(new Date(item.timestamp), 'dd MMM, HH:mm', { locale: es })}
                    </span>
                  </div>

                  <h4 className="text-[12px] font-black text-slate-900 dark:text-white leading-snug tracking-tight group-hover:text-amber-500 transition-colors mb-1.5">
                    {item.title}
                  </h4>

                  <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed line-clamp-2">
                    {item.description}
                  </p>

                  <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                      <span>{item.issue.title}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 group-hover:translate-x-1 transition-transform">
                      <span>Ver incidencia</span>
                      <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#020617] overflow-hidden transition-colors duration-200">
      {/* Top Banner / Controls */}
      <div className="p-6 md:p-8 pb-4 border-b border-slate-200 dark:border-[#1a1a1a] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/50 dark:bg-[#020617]/50 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Centro de Notificaciones</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bandeja clasificada de avisos y eventos según tu rol en cada incidencia.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar notificación o código..."
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 font-medium outline-none focus:border-amber-500 transition-all shadow-inner"
            />
          </div>

          <button
            onClick={markAllAsRead}
            disabled={totalUnread === 0}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
            title="Marcar todas como leídas"
          >
            <CheckCheck className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline">Marcar Leídas</span>
          </button>
        </div>
      </div>

      {/* 3 Columns Layout (Autor, Responsable, Revisor) */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 md:p-8 flex gap-6 custom-scrollbar">
        {renderColumn(
          "Autor",
          "author",
          "Incidencias que tú creaste",
          authorNotifications,
          unreadAuthor,
          <User className="w-5 h-5" />,
          "hover:border-slate-400/50 dark:hover:border-slate-700"
        )}

        {renderColumn(
          "Responsable",
          "responsible",
          "Incidencias asignadas a ti",
          responsibleNotifications,
          unreadResponsible,
          <Briefcase className="w-5 h-5" />,
          "hover:border-slate-400/50 dark:hover:border-slate-700"
        )}

        {renderColumn(
          "Revisor",
          "reviewer",
          "Auditoría y comités técnicos",
          reviewerNotifications,
          unreadReviewer,
          <ClipboardCheck className="w-5 h-5" />,
          "hover:border-slate-400/50 dark:hover:border-slate-700"
        )}
      </div>
    </div>
  );
}
