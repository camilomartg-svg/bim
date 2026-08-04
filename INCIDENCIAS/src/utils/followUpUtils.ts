import { Issue } from '../types';
import { differenceInDays, addMonths, subDays } from 'date-fns';

/**
 * Gets the date when the issue was resolved/closed.
 * Falls back to updatedAt or createdAt if resolvedAt is not defined.
 */
export function getCloseDate(issue: Issue): Date | null {
  if (issue.status !== 'RESUELTA') return null;
  const dateStr = issue.resolvedAt || issue.updatedAt || issue.createdAt;
  return dateStr ? new Date(dateStr) : null;
}

/**
 * Calculates the due date for MEDICIÓN INICIAL (1 month after closing).
 */
export function getMedicionDueDate(issue: Issue): Date | null {
  const closeDate = getCloseDate(issue);
  if (!closeDate) return null;
  return addMonths(closeDate, 1);
}

/**
 * Calculates the due date for REVISIÓN EFICACIA (3 months after closing).
 */
export function getEficaciaDueDate(issue: Issue): Date | null {
  const closeDate = getCloseDate(issue);
  if (!closeDate) return null;
  return addMonths(closeDate, 3);
}

/**
 * Checks whether the MEDICIÓN INICIAL alert is active (within 3 days of due date or overdue, and not completed).
 */
export function isMedicionAlertActive(issue: Issue): boolean {
  if (issue.status !== 'RESUELTA') return false;
  
  // Only for Quality Report issues
  if (issue.reportType !== 'QUALITY') return false;
  
  // If already completed, no alert
  if (issue.medicionInicial?.completed) return false;
  
  const dueDate = getMedicionDueDate(issue);
  if (!dueDate) return false;
  
  const today = new Date();
  const daysUntilDue = differenceInDays(dueDate, today);
  
  // Generates alert 3 days before (meaning 3 days or less remaining, or already overdue!)
  return daysUntilDue <= 3;
}

/**
 * Checks whether the REVISIÓN EFICACIA alert is active (within 3 days of due date or overdue, and not completed).
 */
export function isEficaciaAlertActive(issue: Issue): boolean {
  if (issue.status !== 'RESUELTA') return false;
  
  // Only for Quality Report issues
  if (issue.reportType !== 'QUALITY') return false;
  
  // If already completed, no alert
  if (issue.revisionEficacia?.completed) return false;
  
  const dueDate = getEficaciaDueDate(issue);
  if (!dueDate) return false;
  
  const today = new Date();
  const daysUntilDue = differenceInDays(dueDate, today);
  
  // Generates alert 3 days before (meaning 3 days or less remaining, or already overdue!)
  return daysUntilDue <= 3;
}

/**
 * Checks if the currently logged-in user is authorized to perform quality follow-up reviews.
 * Rule: Only the creator of the Quality Report OR users belonging to the "CALIDAD" team.
 */
export function isAuthorizedForQualityFollowUp(issue: Issue, user: any): boolean {
  if (!user) return false;
  
  const isCreatorOfReport = 
    (issue.creatorId && user.id === issue.creatorId) ||
    (issue.authorEmail && user.email === issue.authorEmail);
    
  const isQualityTeam = user.team?.toUpperCase() === 'CALIDAD' || 
                        user.team?.toUpperCase().includes('CALIDAD');
                        
  return !!(isCreatorOfReport || isQualityTeam);
}

/**
 * Helper to generate review code according to requirements:
 * "AC" + "-" + consecutive starting at "01" (e.g. "01", "02") + "-" + issue.code
 * example: "AC-01-NCE-2501-1"
 */
export function generateFollowUpCode(issue: Issue, consecutive: number): string {
  const paddedConsecutive = consecutive < 10 ? `0${consecutive}` : `${consecutive}`;
  return `AC-${paddedConsecutive}-${issue.code || issue.id}`;
}
