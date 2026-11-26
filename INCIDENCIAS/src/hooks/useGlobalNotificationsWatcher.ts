/**
 * useGlobalNotificationsWatcher.ts
 * Escucha incidencias en tiempo real y dispara notificaciones del sistema
 * en el celular o PC sin importar qué pestaña o módulo esté abierto.
 */

import { useEffect, useRef } from 'react';
import { subscribeToIssues, getProjectAndCompany } from '../services/firebaseService';
import { fetchNotificationPreferencesFromDrive } from '../services/driveIncidentsService';
import { sendInstantSystemNotification, areNotificationsGranted } from '../services/pushNotificationService';
import { UserNotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES } from '../components/NotificationSettingsModal';
import { User, Issue } from '../types';

export function useGlobalNotificationsWatcher(user: User | null) {
  const preferencesRef = useRef<UserNotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const knownIssuesRef = useRef<Map<string, string>>(new Map()); // id -> updatedAt
  const isFirstLoadRef = useRef(true);

  // 1. Cargar preferencias del usuario desde Google Drive
  useEffect(() => {
    if (!user || !user.email) return;
    const userIdentifier = user.email.toLowerCase().trim();
    const { companyId, projectId } = getProjectAndCompany();

    fetchNotificationPreferencesFromDrive(userIdentifier, companyId, projectId)
      .then((prefs) => {
        if (prefs) {
          preferencesRef.current = prefs;
        }
      })
      .catch(() => {});
  }, [user]);

  // 2. Suscribirse a las incidencias y vigilar cambios
  useEffect(() => {
    if (!user) return;
    const userEmail = (user.email || '').toLowerCase().trim();
    const userName = (user.name || '').toLowerCase().trim();

    const unsubscribe = subscribeToIssues((issues: Issue[]) => {
      // En la primera carga, registrar los estados existentes para no bombardear con el pasado
      if (isFirstLoadRef.current) {
        issues.forEach((iss) => {
          knownIssuesRef.current.set(iss.id, iss.updatedAt || iss.createdAt || 'v1');
        });
        isFirstLoadRef.current = false;
        return;
      }

      if (!areNotificationsGranted()) return;

      issues.forEach((issue) => {
        const lastKnown = knownIssuesRef.current.get(issue.id);
        const currentStamp = issue.updatedAt || issue.createdAt || 'v1';

        // Es una incidencia recién creada o modificada
        if (!lastKnown || lastKnown !== currentStamp) {
          knownIssuesRef.current.set(issue.id, currentStamp);

          const isAssigned = Boolean(
            (userEmail && issue.assignedEmail && userEmail === issue.assignedEmail.toLowerCase().trim()) ||
            (userName && issue.assignedName && userName === issue.assignedName.toLowerCase().trim())
          );

          const isAuthor = Boolean(
            (userEmail && issue.authorEmail && userEmail === issue.authorEmail.toLowerCase().trim()) ||
            (userName && issue.creatorName && userName === issue.creatorName.toLowerCase().trim())
          );

          // A. Nueva incidencia o reasignación donde el usuario es el Responsable
          if (isAssigned && issue.status === 'ACTIVO') {
            sendInstantSystemNotification({
              id: `instant_assigned_${issue.id}_${currentStamp}`,
              category: 'NUEVAS_INCIDENCIAS',
              role: 'responsible',
              title: `Nuevo Hallazgo Asignado: ${issue.code}`,
              body: `${issue.title || 'Tienes una nueva incidencia asignada para revisión técnica.'}`,
              issueId: issue.id,
              preferences: preferencesRef.current
            });
          }

          // B. Respuesta técnica enviada al Autor
          if (isAuthor && issue.status === 'RESPONDIDA') {
            sendInstantSystemNotification({
              id: `instant_responded_${issue.id}_${currentStamp}`,
              category: 'CAMBIOS_ESTADO',
              role: 'author',
              title: `Respuesta técnica lista: ${issue.code}`,
              body: `El responsable completó la respuesta técnica. Ingresa a validar.`,
              issueId: issue.id,
              preferences: preferencesRef.current
            });
          }

          // C. Incidencia devuelta a la fuente
          if (isAuthor && (issue.returnedToSource || issue.redirectionStatus === 'DEVUELTA_A_FUENTE')) {
            sendInstantSystemNotification({
              id: `instant_returned_${issue.id}_${currentStamp}`,
              category: 'DEVOLUCIONES_RECHAZOS',
              role: 'author',
              title: `Incidencia Devuelta a la Fuente: ${issue.code}`,
              body: issue.returnToSourceReason ? `Motivo: ${issue.returnToSourceReason}` : 'La incidencia requiere revisión por el autor.',
              issueId: issue.id,
              preferences: preferencesRef.current
            });
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user]);
}
