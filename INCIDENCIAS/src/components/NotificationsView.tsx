import React, { useState, useEffect, useMemo } from 'react';
import { Issue, Comment } from '../types';
import { useAuth } from '../context/AuthContext';
import { subscribeToIssues } from '../services/firebaseService';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { isMedicionAlertActive, isEficaciaAlertActive } from '../utils/followUpUtils';
import { isIncidentsAdmin } from '../utils/userScope';
import { 
  Bell, User, Briefcase, ClipboardCheck, ArrowRight, CheckCircle2, 
  XCircle, AlertTriangle, Clock, RotateCcw, ShieldAlert, MessageSquare, 
  Search, CheckCheck, Check, Filter, AlertCircle, Settings, Zap, Calendar, 
  Paperclip, Sliders, BellOff, Sparkles, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format, differenceInDays, isPast } from 'date-fns';
import { es } from 'date-fns/locale';

import NotificationSettingsModal, {
  UserNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationFrequency,
  NotificationCategory
} from './NotificationSettingsModal';

interface NotificationItem {
  id: string;
  issue: Issue;
  role: 'author' | 'responsible' | 'reviewer';
  category: NotificationCategory;
  type: 
    | 'NUEVA_INCIDENCIA'
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
    | 'NUEVO_COMENTARIO'
    | 'ARCHIVO_ADJUNTO';
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

function getWeekRangeString(d: Date = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  const diffToMonday = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diffToMonday));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return `${format(monday, "d 'de' MMMM", { locale: es })} al ${format(sunday, "d 'de' MMMM, yyyy", { locale: es })}`;
}

export default function NotificationsView({ onSelectIssue, canAccessBim }: NotificationsViewProps) {
  const { user } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsRole, setSettingsRole] = useState<'author' | 'responsible' | 'reviewer'>('author');

  // Frequency view per column: 'INSTANT' (real-time) or 'WEEKLY' (resumen semanal)
  const [columnViews, setColumnViews] = useState<Record<'author' | 'responsible' | 'reviewer', 'INSTANT' | 'WEEKLY'>>({
    author: 'INSTANT',
    responsible: 'INSTANT',
    reviewer: 'INSTANT'
  });

  const userIdentifier = user?.id || user?.email || 'default_user';
  const storageKey = `nora_notif_prefs_${userIdentifier.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  // Individual user notification preferences
  const [preferences, setPreferences] = useState<UserNotificationPreferences>(() => {
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return DEFAULT_NOTIFICATION_PREFERENCES;
  });

  // Sync preferences with Firestore user document for multi-device persistence
  useEffect(() => {
    if (!userIdentifier || userIdentifier === 'default_user') return;
    const cleanId = userIdentifier.toLowerCase().replace(/[^a-z0-9]/g, '_');
    getDoc(doc(db, 'user_notification_preferences', cleanId)).then((snap) => {
      if (snap.exists()) {
        const firestorePrefs = snap.data() as UserNotificationPreferences;
        setPreferences(firestorePrefs);
        try {
          localStorage.setItem(storageKey, JSON.stringify(firestorePrefs));
        } catch (_) {}
      }
    }).catch(console.error);
  }, [userIdentifier, storageKey]);

  const savePreferences = async (newPrefs: UserNotificationPreferences) => {
    setPreferences(newPrefs);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newPrefs));
    } catch (_) {}

    if (userIdentifier && userIdentifier !== 'default_user') {
      const cleanId = userIdentifier.toLowerCase().replace(/[^a-z0-9]/g, '_');
      try {
        await setDoc(doc(db, 'user_notification_preferences', cleanId), {
          ...newPrefs,
          userId: user?.id || '',
          userEmail: user?.email || '',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error("Error guardando preferencias en Firestore:", err);
      }
    }
  };

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

  const unmarkAsRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReadIds(prev => {
      const updated = prev.filter(item => item !== id);
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
            category: 'DEVOLUCIONES_RECHAZOS',
            type: 'DEVUELTA_A_FUENTE',
            title: `Devuelta a la fuente: ${issue.code}`,
            description: issue.returnToSourceReason 
              ? `Motivo: ${issue.returnToSourceReason}` 
              : `La incidencia te fue devuelta por el responsable para su reasignación o ajuste.`,
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
            category: 'DEVOLUCIONES_RECHAZOS',
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
            category: 'CAMBIOS_ESTADO',
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
            category: 'CAMBIOS_ESTADO',
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
            category: 'VENCIMIENTOS',
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
        // A. Redirección o asignación pendiente de aceptación
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
            category: 'REDIRECCIONES',
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
            category: 'CAMBIOS_ESTADO',
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

        // B2. Devolución no aceptada por el autor (ratificada)
        if (issue.redirectionStatus === 'DEVOLUCION_RECHAZADA') {
          list.push({
            id: `notif_resp_dev_rechazada_${issue.id}`,
            issue,
            role: 'responsible',
            category: 'DEVOLUCIONES_RECHAZOS',
            type: 'RESPUESTA_RECHAZADA',
            title: `Devolución no aceptada por autor: ${issue.code}`,
            description: `El autor rechazó la devolución y ratificó la responsabilidad. Revisa el chat para ver la aclaración técnica.`,
            timestamp: issue.updatedAt || issue.createdAt,
            priority: 'URGENTE',
            badgeLabel: 'Ratificada por Autor',
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
              category: 'VENCIMIENTOS',
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
              category: 'VENCIMIENTOS',
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
            category: 'AUDITORIA_CALIDAD',
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
            category: 'AUDITORIA_CALIDAD',
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
            category: 'AUDITORIA_CALIDAD',
            type: 'SEGUIMIENTO_EFICACIA',
            title: `Seguimiento de eficacia: ${issue.code}`,
            description: `Cumplimiento de plazo para evaluar la eficacia técnica de la medida correctiva (2do control).`,
            timestamp: issue.updatedAt || issue.createdAt,
            priority: 'ALTA',
            badgeLabel: 'Eficacia Calidad',
            badgeColor: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
          });
        }

        // D. En revisión interna por colaboradores
        if (issue.status === 'REVISION_RESPONSABLE') {
          list.push({
            id: `notif_rev_revision_${issue.id}`,
            issue,
            role: 'reviewer',
            category: 'CAMBIOS_ESTADO',
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

      // ==========================================
      // 4. EVENTOS DE CHAT Y ARCHIVOS / EVIDENCIAS
      // ==========================================
      if (issue.comments && issue.comments.length > 0) {
        // Take the latest 5 comments to keep notifications active & fresh
        const recentComments = issue.comments.slice(-5);
        recentComments.forEach((comment) => {
          const isMyComment = (userEmail && (comment as any).userEmail && (comment as any).userEmail.toLowerCase() === userEmail) ||
                              (userNameClean && cleanStr(comment.userName) === userNameClean);
          if (isMyComment) return; // Do not notify yourself of your own comments

          const commentText = comment.text || '';
          const isFile = commentText.includes('Ha adjuntado un archivo:') || 
                        commentText.toLowerCase().includes('.jpg') || 
                        commentText.toLowerCase().includes('.png') || 
                        commentText.toLowerCase().includes('.pdf') ||
                        commentText.toLowerCase().includes('.dwg');

          const isSystemStateComment = commentText.startsWith('🔄 INCIDENCIA DEVUELTA') ||
                                       commentText.startsWith('⛔ DEVOLUCIÓN RECHAZADA') ||
                                       commentText.startsWith('RESPUESTA FINALIZADA') ||
                                       commentText.startsWith('Incidencia redirigida');

          if (isSystemStateComment) return; // Already represented in state alerts

          const targetRoles: ('author' | 'responsible' | 'reviewer')[] = [];
          if (isAuthor) targetRoles.push('author');
          if (isResponsible) targetRoles.push('responsible');
          if (isReviewer) targetRoles.push('reviewer');

          targetRoles.forEach((role) => {
            if (isFile) {
              list.push({
                id: `notif_file_${issue.id}_${comment.id || comment.createdAt}`,
                issue,
                role,
                category: 'ARCHIVOS_EVIDENCIAS',
                type: 'ARCHIVO_ADJUNTO',
                title: `Evidencia adjunta en ${issue.code}`,
                description: `${comment.userName || 'Usuario'} adjuntó archivos o fotos a Google Drive.`,
                timestamp: comment.createdAt || issue.updatedAt,
                priority: 'MEDIA',
                badgeLabel: 'Evidencia Drive',
                badgeColor: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30'
              });
            } else {
              list.push({
                id: `notif_chat_${issue.id}_${comment.id || comment.createdAt}`,
                issue,
                role,
                category: 'MENSAJES_CHAT',
                type: 'NUEVO_COMENTARIO',
                title: `Nuevo mensaje en ${issue.code}`,
                description: `${comment.userName || 'Usuario'}: "${commentText.slice(0, 85)}${commentText.length > 85 ? '...' : ''}"`,
                timestamp: comment.createdAt || issue.updatedAt,
                priority: 'NORMAL',
                badgeLabel: 'Mensaje Chat',
                badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
              });
            }
          });
        });
      }
    });

    // Sort by timestamp desc
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [issues, userEmail, userNameClean, userId, isAdmin]);

  // Filtering by search term and role settings (instant vs weekly vs muted)
  const filterByRoleAndConfig = (role: 'author' | 'responsible' | 'reviewer') => {
    const rolePrefs = preferences[role] || DEFAULT_NOTIFICATION_PREFERENCES[role];
    const roleItems = allNotifications.filter(n => n.role === role);

    // 1. Remove muted items
    const unmutedItems = roleItems.filter(n => {
      const freq = rolePrefs[n.category] || 'INSTANT';
      return freq !== 'MUTED';
    });

    // 2. Separate into Instant (Unread), Weekly (Unread), and Read Items
    const instantUnread = unmutedItems.filter(n => !readIds.includes(n.id) && (rolePrefs[n.category] || 'INSTANT') === 'INSTANT');
    const weeklyUnread = unmutedItems.filter(n => !readIds.includes(n.id) && rolePrefs[n.category] === 'WEEKLY');
    const readItems = unmutedItems.filter(n => readIds.includes(n.id));

    // 3. Apply search term
    const applySearch = (items: NotificationItem[]) => {
      if (!searchTerm.trim()) return items;
      const term = searchTerm.toLowerCase();
      return items.filter(n => 
        n.title.toLowerCase().includes(term) || 
        n.description.toLowerCase().includes(term) || 
        n.issue.code.toLowerCase().includes(term)
      );
    };

    return {
      instantUnread: applySearch(instantUnread),
      weeklyUnread: applySearch(weeklyUnread),
      readItems: applySearch(readItems),
      allUnmuted: applySearch(unmutedItems)
    };
  };

  const authorGroup = useMemo(() => filterByRoleAndConfig('author'), [allNotifications, preferences, searchTerm]);
  const responsibleGroup = useMemo(() => filterByRoleAndConfig('responsible'), [allNotifications, preferences, searchTerm]);
  const reviewerGroup = useMemo(() => filterByRoleAndConfig('reviewer'), [allNotifications, preferences, searchTerm]);

  // Unread counts based on active view mode
  const getUnreadCount = (items: NotificationItem[]) => items.filter(n => !readIds.includes(n.id)).length;

  const totalUnread = getUnreadCount(authorGroup.allUnmuted) + 
                      getUnreadCount(responsibleGroup.allUnmuted) + 
                      getUnreadCount(reviewerGroup.allUnmuted);

  const openSettingsForRole = (role: 'author' | 'responsible' | 'reviewer') => {
    setSettingsRole(role);
    setIsSettingsOpen(true);
  };

  const renderColumn = (
    title: string,
    role: 'author' | 'responsible' | 'reviewer',
    subtitle: string,
    data: { instantUnread: NotificationItem[]; weeklyUnread: NotificationItem[]; readItems: NotificationItem[] },
    icon: React.ReactNode,
    accentBorder: string
  ) => {
    const currentView = columnViews[role];
    const items = currentView === 'INSTANT' 
      ? data.instantUnread 
      : currentView === 'WEEKLY' 
      ? data.weeklyUnread 
      : data.readItems;
    const unreadCount = data.instantUnread.length + data.weeklyUnread.length;

    return (
      <div className={cn(
        "flex-1 flex flex-col min-w-[340px] bg-slate-50/70 dark:bg-[#070d18] rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800/80 shadow-xl overflow-hidden transition-all duration-300",
        accentBorder
      )}>
        {/* Column Header */}
        <div className="p-6 pb-4 border-b border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-[#0a1324]/80 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3">
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

          {/* OVAL CONTROLS: Frequency Toggle (Al Instante / Semanal / Leídas) + Role Settings */}
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800/60 gap-2">
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-inner overflow-x-auto">
              <button
                onClick={() => setColumnViews(prev => ({ ...prev, [role]: 'INSTANT' }))}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-[8.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap",
                  currentView === 'INSTANT'
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                    : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                )}
                title="Notificaciones inmediatas pendientes de leer"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Al Instante ({data.instantUnread.length})</span>
              </button>

              <button
                onClick={() => setColumnViews(prev => ({ ...prev, [role]: 'WEEKLY' }))}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-[8.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap",
                  currentView === 'WEEKLY'
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                    : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                )}
                title="Resumen semanal pendiente de leer"
              >
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>Semanal ({data.weeklyUnread.length})</span>
              </button>

              <button
                onClick={() => setColumnViews(prev => ({ ...prev, [role]: 'READ' }))}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-[8.5px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap",
                  currentView === 'READ'
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                    : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                )}
                title="Notificaciones que ya leíste"
              >
                <CheckCheck className="w-3 h-3 text-emerald-400" />
                <span>Leídas ({data.readItems.length})</span>
              </button>
            </div>

            <button
              onClick={() => openSettingsForRole(role)}
              className="py-1.5 px-3 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 text-[9px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
              title={`Configurar qué notificaciones recibes como ${title}`}
            >
              <Settings className="w-3.5 h-3.5 text-amber-500" />
              <span>Configurar</span>
            </button>
          </div>
        </div>

        {/* Notification Cards List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
          {/* WEEKLY DIGEST BANNER (if in weekly mode) */}
          {currentView === 'WEEKLY' && (
            <div className="p-4 bg-indigo-500/[0.04] dark:bg-indigo-950/20 border border-indigo-500/20 rounded-2xl mb-2">
              <div className="flex items-center gap-2 mb-1.5">
                <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                  Resumen Semanal Consolidado
                </span>
              </div>
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-2.5">
                {getWeekRangeString()}
              </p>

              <div className="flex flex-wrap gap-1.5 text-[8px] font-black uppercase tracking-wider">
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                  {items.length} Eventos agrupados
                </span>
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                  Frecuencia Semanal Activa
                </span>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-600">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mb-3 text-slate-400">
                <CheckCircle2 className="w-6 h-6 stroke-1" />
              </div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {currentView === 'READ' 
                  ? 'Sin notificaciones leídas' 
                  : currentView === 'INSTANT' 
                  ? 'Sin notificaciones pendientes' 
                  : 'Sin resumen semanal pendiente'}
              </p>
              <p className="text-[10px] mt-1 text-slate-400 dark:text-slate-600 max-w-[240px]">
                {currentView === 'READ'
                  ? 'Las notificaciones que leas en el tablero principal se archivarán aquí automáticamente.'
                  : currentView === 'INSTANT' 
                  ? 'No tienes notificaciones pendientes. Todo lo que ya leíste se encuentra en la pestaña "Leídas".' 
                  : 'No hay eventos pendientes en el resumen de esta semana.'}
              </p>
              <button
                onClick={() => openSettingsForRole(role)}
                className="mt-4 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[8.5px] font-black uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5"
              >
                <Sliders className="w-3 h-3 text-amber-500" />
                <span>Modificar qué recibes aquí</span>
              </button>
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
                    <div className="flex items-center gap-2 text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider truncate max-w-[180px]">
                      <span>{item.issue.title}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {currentView === 'READ' ? (
                        <button
                          type="button"
                          onClick={(e) => unmarkAsRead(item.id, e)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[8px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-amber-500 transition-all cursor-pointer"
                          title="Devolver al tablero principal como no leída"
                        >
                          <RotateCcw className="w-3 h-3 text-amber-500" />
                          <span>Restaurar</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => markAsRead(item.id, e)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer"
                          title="Marcar como leída y mover a pestaña de leídas"
                        >
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="hidden sm:inline">Marcar leída</span>
                        </button>
                      )}
                      <div className="flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 group-hover:translate-x-1 transition-transform shrink-0">
                        <span>Ver</span>
                        <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                      </div>
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

        <div className="flex flex-wrap items-center gap-3">
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
            onClick={() => {
              setSettingsRole('author');
              setIsSettingsOpen(true);
            }}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 cursor-pointer shadow-sm"
            title="Configurar qué notificaciones recibir y su frecuencia"
          >
            <Sliders className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">Configurar Notificaciones</span>
          </button>

          <button
            onClick={markAllAsRead}
            disabled={totalUnread === 0}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40 cursor-pointer shadow-sm"
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
          authorGroup,
          <User className="w-5 h-5" />,
          "hover:border-slate-400/50 dark:hover:border-slate-700"
        )}

        {renderColumn(
          "Responsable",
          "responsible",
          "Incidencias asignadas a ti",
          responsibleGroup,
          <Briefcase className="w-5 h-5" />,
          "hover:border-slate-400/50 dark:hover:border-slate-700"
        )}

        {renderColumn(
          "Revisor",
          "reviewer",
          "Auditoría y comités técnicos",
          reviewerGroup,
          <ClipboardCheck className="w-5 h-5" />,
          "hover:border-slate-400/50 dark:hover:border-slate-700"
        )}
      </div>

      {/* Settings Modal */}
      <NotificationSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        preferences={preferences}
        onSave={savePreferences}
        initialRole={settingsRole}
      />
    </div>
  );
}
