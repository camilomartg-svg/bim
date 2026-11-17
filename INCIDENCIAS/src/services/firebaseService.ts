import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from './firebase';
import {
  archiveIncidentsRecord,
  loadIncidentsLocationsFromSheet,
  loadIncidentsConfigFromSheet,
  saveIncidentsConfigToSheet,
  saveIncidentsLocationsToSheet
} from '../utils/googleDriveUtils';
import { handleFirestoreError, OperationType } from './firestore-errors';
import { 
  Issue, 
  Comment, 
  ProjectConfig, 
  TeamMember, 
  StructuralUnit,
  SiteReport,
  QualityReport
} from '../types';

// Helper to get active project and company context
export const getProjectAndCompany = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('project') || 'default';
  
  let companyId = urlParams.get('empresa') || 'default';
  if (companyId === 'default') {
    const userAccountStr = sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount');
    if (userAccountStr) {
      try {
        companyId = JSON.parse(userAccountStr).empresa || 'default';
      } catch (e) {}
    }
  }
  return { projectId, companyId };
};

const projectConfigCache = new Map<string, any>();
const platformConfigCache = new Map<string, PlatformConfig | null>();
const platformTeamCache = new Map<string, Promise<any[] | null>>();

// Reports
export const subscribeToReports = (callback: (reports: SiteReport[]) => void) => {
  const { projectId, companyId } = getProjectAndCompany();
  const q = query(
    collection(db, 'reports'),
    where('projectId', '==', projectId),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const reports = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as SiteReport))
      .filter(r => !r.reportType || r.reportType === 'SITE');
    callback(reports);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'reports');
  });
};

export const subscribeToQualityReports = (callback: (reports: QualityReport[]) => void) => {
  const { projectId, companyId } = getProjectAndCompany();
  const q = query(
    collection(db, 'reports'),
    where('projectId', '==', projectId),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const reports = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as QualityReport))
      .filter(r => r.reportType === 'QUALITY');
    callback(reports);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'reports-quality');
  });
};

export const subscribeToEnvironmentalReports = (callback: (reports: QualityReport[]) => void) => {
  const { projectId, companyId } = getProjectAndCompany();
  const q = query(
    collection(db, 'reports'),
    where('projectId', '==', projectId),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const reports = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as QualityReport))
      .filter(r => r.reportType === 'ENVIRONMENTAL');
    callback(reports);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'reports-environmental');
  });
};

const cleanObject = (obj: any): any => {
  const result: any = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        result[key] = cleanObject(obj[key]);
      } else {
        result[key] = obj[key];
      }
    }
  }
  return result;
};

export const syncIssueStatusToParentReport = async (issue: any, newStatus: string) => {
  if ((issue.reportType !== 'QUALITY' && issue.reportType !== 'ENVIRONMENTAL') || !issue.sourceReportId) return;
  const blockId = issue.id.replace('issue_q_', '').replace('issue_e_', '');
  
  const reportRef = doc(db, 'reports', issue.sourceReportId);
  try {
    const reportSnap = await getDoc(reportRef);
    if (reportSnap.exists()) {
      const reportData = reportSnap.data() as any;
      const updatedBlocks = (reportData.blocks || []).map((b: any) => {
        if (b.id === blockId) {
          return { ...b, status: newStatus };
        }
        return b;
      });
      
      const allClosed = updatedBlocks.every((b: any) => b.status === 'RESUELTA' || b.status === 'ANULADA');
      const updatedStatus = allClosed ? 'CERRADO' : 'FINALIZED';
      
      await setDoc(reportRef, {
        ...reportData,
        blocks: updatedBlocks,
        status: updatedStatus,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  } catch (error) {
    console.error("Error syncing issue status to parent report:", error);
  }
};

export const saveReport = async (report: any) => {
  const path = 'reports';
  const { projectId, companyId } = getProjectAndCompany();
  try {
    let reportId = report.id;
    const isNew = !reportId;
    
    if (isNew) {
      const docRef = doc(collection(db, path));
      reportId = docRef.id;
      await setDoc(docRef, {
        ...report,
        id: reportId,
        projectId,
        companyId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } else {
      await setDoc(doc(db, path, reportId), {
        ...report,
        projectId,
        companyId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    // Sync child blocks to Issues if it's a Quality Report
    if (report.reportType === 'QUALITY') {
      const blocks = report.blocks || [];
      for (const block of blocks) {
        try {
          const issueId = `issue_q_${block.id}`;
          const issueData: any = {
            id: issueId,
            projectId,
            companyId,
            code: block.code?.includes('-') ? block.code : `CAL-${report.code.replace('INF-CAL-', '')}-${block.code || '0000'}`,
            title: block.title ? block.title : `HALLAZGO DE CALIDAD: ${block.type || 'S/N'} (${block.source || 'S/S'})`,
            type: block.type || 'No Conformidad',
            degreeOfAction: block.criticality || 'MEDIA',
            impact: [],
            description: block.description || '',
            status: block.status || 'ACTIVO',
            specialty: 'CALIDAD',
            assignedPosition: block.assignedPosition || '',
            assignedName: block.assignedName || '',
            assignedEmail: block.assignedEmail || '',
            assignedTeam: 'CALIDAD',
            reviewers: block.reviewerCommittee || [],
            reviewerEmails: [],
            creatorId: report.creatorId && report.creatorId !== 'anonymous' ? report.creatorId : (auth.currentUser?.uid || 'anonymous'),
            creatorName: report.creatorName || 'Usuario',
            creatorPosition: report.creatorPosition || 'Calidad',
            creatorTeam: report.creatorTeam || 'CALIDAD',
            authorEmail: report.authorEmail || auth.currentUser?.email || '',
            createdAt: report.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            attachments: block.attachments || [],
            dueDate: block.dueDate || '',
            comments: [],
            locations: { units: [], levels: [], spaces: [] },
            
            proposedActionPlan: block.correctiveAction || '',
            initialEfficiencyMeasure: block.initialEfficiencyMeasure || '',
            implementationSupport: block.implementationSupport || '',
            
            fromReport: true,
            reportType: 'QUALITY',
            sourceReportId: reportId,
            sourceReportTitle: report.title || ''
          };
          
          const cleanedData = cleanObject(issueData);
          await setDoc(doc(db, 'issues', issueId), cleanedData, { merge: true });
        } catch (blockErr) {
          console.error(`Error saving individual issue block ${block.id}:`, blockErr);
        }
      }
    }

    // Sync child blocks to Issues if it's an Environmental Report
    if (report.reportType === 'ENVIRONMENTAL') {
      const blocks = report.blocks || [];
      for (const block of blocks) {
        try {
          const issueId = `issue_e_${block.id}`;
          const issueData: any = {
            id: issueId,
            projectId,
            companyId,
            code: block.code?.includes('-') ? block.code : `AMB-${report.code.replace('INF-AMB-', '')}-${block.code || '0000'}`,
            title: block.title ? block.title : `HALLAZGO AMBIENTAL: ${block.type || 'S/N'} (${block.source || 'S/S'})`,
            type: block.type || 'No Conformidad Ambiental',
            degreeOfAction: block.criticality || 'MEDIA',
            impact: [],
            description: block.description || '',
            status: block.status || 'ACTIVO',
            specialty: 'AMBIENTAL',
            assignedPosition: block.assignedPosition || '',
            assignedName: block.assignedName || '',
            assignedEmail: block.assignedEmail || '',
            assignedTeam: 'AMBIENTAL',
            reviewers: block.reviewerCommittee || [],
            reviewerEmails: [],
            creatorId: report.creatorId && report.creatorId !== 'anonymous' ? report.creatorId : (auth.currentUser?.uid || 'anonymous'),
            creatorName: report.creatorName || 'Usuario',
            creatorPosition: report.creatorPosition || 'Ambiental',
            creatorTeam: report.creatorTeam || 'AMBIENTAL',
            authorEmail: report.authorEmail || auth.currentUser?.email || '',
            createdAt: report.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            attachments: block.attachments || [],
            dueDate: block.dueDate || '',
            comments: [],
            locations: { units: [], levels: [], spaces: [] },
            
            proposedActionPlan: block.correctiveAction || '',
            initialEfficiencyMeasure: block.initialEfficiencyMeasure || '',
            implementationSupport: block.implementationSupport || '',
            
            fromReport: true,
            reportType: 'ENVIRONMENTAL',
            sourceReportId: reportId,
            sourceReportTitle: report.title || ''
          };
          
          const cleanedData = cleanObject(issueData);
          await setDoc(doc(db, 'issues', issueId), cleanedData, { merge: true });
        } catch (blockErr) {
          console.error(`Error saving individual issue block ${block.id}:`, blockErr);
        }
      }
    }

    return reportId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// Issues
export const subscribeToIssues = (callback: (issues: Issue[]) => void) => {
  const { projectId, companyId } = getProjectAndCompany();
  const cacheKey = `cached_issues_${companyId}_${projectId}`;

  // 1. Inmediatamente servir datos locales si existen
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    if (Array.isArray(cached) && cached.length > 0) {
      callback(cached);
    }
  } catch (_) {}

  // 2. Escuchar actualizaciones locales inmediatas
  const handleLocalUpdate = (e: any) => {
    if (e.detail && Array.isArray(e.detail)) {
      callback(e.detail);
    }
  };
  window.addEventListener('local_issues_updated', handleLocalUpdate);

  // 3. Suscripción a Firestore con tolerancia total a fallos
  let unsubscribeFirestore = () => {};
  try {
    const q = query(
      collection(db, 'issues'),
      where('projectId', '==', projectId),
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );
    unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      const issues = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Issue));
      if (issues.length > 0) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(issues));
        } catch (_) {}
        callback(issues);
      }
    }, (error) => {
      console.warn("Firestore snapshot skipped (operando en modo Google Drive / local):", error?.message || error);
    });
  } catch (err) {
    console.warn("Firestore subscription error (usando modo Google Drive / local):", err);
  }

  return () => {
    window.removeEventListener('local_issues_updated', handleLocalUpdate);
    try {
      unsubscribeFirestore();
    } catch (_) {}
  };
};

export const saveIssue = async (issue: Omit<Issue, 'id'> & { id?: string }) => {
  const path = 'issues';
  const { projectId, companyId } = getProjectAndCompany();
  const issueId = issue.id || ('iss_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8));

  const savedIssue: Issue = {
    ...issue,
    id: issueId,
    projectId,
    companyId,
    createdAt: (issue as any).createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // 1. Actualizar caché local inmediatamente para que la UI responda sin demoras
  const cacheKey = `cached_issues_${companyId}_${projectId}`;
  try {
    const localIssues: Issue[] = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    const idx = localIssues.findIndex(i => i.id === issueId);
    if (idx >= 0) {
      localIssues[idx] = savedIssue;
    } else {
      localIssues.unshift(savedIssue);
    }
    localStorage.setItem(cacheKey, JSON.stringify(localIssues));
    window.dispatchEvent(new CustomEvent('local_issues_updated', { detail: localIssues }));
  } catch (cacheErr) {
    console.warn("[saveIssue] Local storage cache warning:", cacheErr);
  }

  // 2. PRINCIPAL: Guardar JSON directamente en Google Drive bajo la carpeta del proyecto
  try {
    await archiveIncidentsRecord('incidencia', savedIssue, issueId, companyId, projectId);
    console.log("[saveIssue] Incidencia guardada exitosamente en Google Drive:", issueId);
  } catch (driveErr) {
    console.error("[saveIssue] Error al archivar incidencia en Google Drive:", driveErr);
  }

  // 3. SECUNDARIO: Sincronización en Firestore no bloqueante con timeout
  try {
    await safeFirestoreCall(
      setDoc(doc(db, path, issueId), savedIssue, { merge: true }),
      1200,
      null
    );
  } catch (firestoreErr) {
    console.warn("[saveIssue] Firestore sync skipped (guardado en Drive y local completado):", firestoreErr);
  }

  return issueId;
};

export const deleteIssue = async (id: string) => {
  console.log(`[firebaseService] Starting deleteIssue for ID: ${id}`);
  const path = `issues/${id}`;
  try {
    // 1. Delete comments subcollection (try to clean up)
    try {
      const commentsRef = collection(db, 'issues', id, 'comments');
      const commentsSnapshot = await getDocs(commentsRef);
      console.log(`[firebaseService] Found ${commentsSnapshot.size} comments to delete`);
      const deletePromises = commentsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    } catch (e) {
      console.warn("[firebaseService] Warning: Could not delete some comments", e);
    }

    // 2. Delete the issue itself
    const issueRef = doc(db, 'issues', id);
    await deleteDoc(issueRef);
    console.log(`[firebaseService] Successfully deleted issue: ${id}`);
  } catch (error) {
    console.error(`[firebaseService] Fatal error deleting issue ${id}:`, error);
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

// Platform integration helpers
interface PlatformConfig {
  responsibleCompanies: string[];
  teams: string[];
}

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx2RAQx_8K4o22xE0Mw-ETc7K_58vIoi6-PgVi64u80inuiw144ks3cgWSdCtXqIgB02g/exec';

export const getPlatformConfig = async (companyId: string): Promise<PlatformConfig | null> => {
  const { projectId } = getProjectAndCompany();
  const cacheKey = `${companyId}_${projectId}`;
  if (platformConfigCache.has(cacheKey)) return platformConfigCache.get(cacheKey) ?? null;
  try {
    const companiesSet = new Set<string>();
    const teamsSet = new Set<string>();
    
    // 1. Fetch empresas.json
    try {
        const empresasRes = await fetch('../empresas.json');
      if (empresasRes.ok) {
        const empresas = await empresasRes.json();
        const company = empresas.find((e: any) => e && !e.deleted && (e.id === companyId || e.id?.toLowerCase() === companyId?.toLowerCase() || e.name?.toLowerCase() === companyId?.toLowerCase()));
        if (company) {
          const members = company.members || [];
          members.forEach((m: any) => {
            if (m.empresaUsuario && m.empresaUsuario.trim()) {
              companiesSet.add(m.empresaUsuario.trim());
            }
            if (m.empresa && m.empresa.trim()) {
              companiesSet.add(m.empresa.trim());
            }
          });
        }
      }
    } catch (e) {
      console.warn("Could not load empresas.json in getPlatformConfig:", e);
    }

    // 2. Fetch project task teams from config-<companyId>.json
    let hasProjectTeams = false;
    if (projectId && projectId !== 'default' && companyId && companyId !== 'default') {
      try {
        const configRes = await fetch(`../config-${companyId}.json`);
        if (configRes.ok) {
          const configData = await configRes.json();
          const project = configData.projects?.find((p: any) => p.slug === projectId || p.name === projectId || p.id === projectId);
          if (project && Array.isArray(project.equiposDeTarea) && project.equiposDeTarea.length > 0) {
            project.equiposDeTarea.forEach((t: any) => {
              const name = typeof t === 'string' ? t.trim().toUpperCase() : t.name?.trim().toUpperCase();
              if (name) {
                teamsSet.add(name);
                hasProjectTeams = true;
              }
            });
          }
        }
      } catch (e) {
        console.warn("Could not load config-<companyId>.json in getPlatformConfig:", e);
      }
      
      // Also query Google Sheets endpoint if needed
      try {
        const teamsRes = await fetch(`${GOOGLE_SCRIPT_URL}?action=getTeams&empresa=${encodeURIComponent(companyId)}&proyecto=${encodeURIComponent(projectId)}`);
        if (teamsRes.ok) {
          const remoteTeams = await teamsRes.json();
          if (Array.isArray(remoteTeams) && remoteTeams.length > 0) {
            remoteTeams.forEach((rt: any) => {
              const name = typeof rt === 'string' ? rt.trim().toUpperCase() : rt.name?.trim().toUpperCase();
              if (name) {
                teamsSet.add(name);
                hasProjectTeams = true;
              }
            });
          }
        }
      } catch (e) {
        console.warn("Could not fetch remote teams in getPlatformConfig:", e);
      }
    }

    // 3. Fallback to default teams ONLY if no project task teams exist at all
    if (!hasProjectTeams || teamsSet.size === 0) {
      ['AMBIENTAL', 'ARQUITECTURA', 'BIM', 'CALIDAD', 'COORDINACIÓN TÉCNICA', 'ESTRUCTURA', 'INSTALACIONES', 'SST'].forEach(t => teamsSet.add(t));
    }
    
    const result = {
      responsibleCompanies: Array.from(companiesSet).sort(),
      teams: Array.from(teamsSet).sort()
    };
    platformConfigCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.warn("Could not load platform configuration:", error);
    platformConfigCache.set(cacheKey, null);
    return null;
  }
};

export const getPlatformTeam = async (companyId: string, projectId: string): Promise<any[] | null> => {
  const cacheKey = `${companyId}_${projectId}`;
  const cached = platformTeamCache.get(cacheKey);
  if (cached) return cached;
  const request = (async () => {
  try {
    // 1. Fetch empresas.json
    let empresas: any[] = [];
    try {
      const empresasRes = await fetch('../empresas.json');
      if (empresasRes.ok) {
        empresas = await empresasRes.json();
      }
    } catch (_) {}
    
    const company = empresas.find((e: any) => e && !e.deleted && (e.id === companyId || e.id?.toLowerCase() === companyId?.toLowerCase() || e.name?.toLowerCase() === companyId?.toLowerCase())) || { name: 'HIDROSANITARIO SAS', members: [] };
    const companyMembers = company.members || [];
    
    // 2. Fetch project config & ISO data from Drive or local cache
    let projectData: any = null;
    try {
      const rawProj = sessionStorage.getItem('activeProject') || localStorage.getItem('activeProject') || localStorage.getItem('cached_project_iso_data');
      if (rawProj) {
        projectData = JSON.parse(rawProj);
      }
    } catch (_) {}

    if (!projectData || !projectData.members || projectData.members.length === 0) {
      try {
        const { companyName, projectName } = getHumanCompanyAndProject(companyId, projectId);
        const driveUrl = new URL(INCIDENCES_CONFIG_SCRIPT_URL || FILES_GATEWAY_URL);
        driveUrl.searchParams.set('action', 'getProjectConfig');
        driveUrl.searchParams.set('empresa', companyName || companyId);
        driveUrl.searchParams.set('companyId', companyId);
        driveUrl.searchParams.set('proyecto', projectId);
        driveUrl.searchParams.set('projectName', projectName || projectId);
        const driveRes = await fetch(driveUrl.toString());
        if (driveRes.ok) {
          const driveJson = await driveRes.json();
          if (driveJson?.status === 'success' && driveJson.data) {
            projectData = driveJson.data;
            try {
              localStorage.setItem('cached_project_iso_data', JSON.stringify(projectData));
              localStorage.setItem('activeProject', JSON.stringify(projectData));
            } catch (_) {}
          }
        }
      } catch (err) {
        console.warn('Could not load project config from Google Drive in getPlatformTeam:', err);
      }
    }

    // 3. Fetch directory users from Google Script for real names, companies and positions
    let dirUsers: any[] = [];
    try {
      const dirRes = await fetch(INCIDENCES_CONFIG_SCRIPT_URL || FILES_GATEWAY_URL);
      if (dirRes.ok) {
        dirUsers = await dirRes.json();
      }
    } catch (err) {
      console.warn('Could not fetch directory users from gateway:', err);
    }

    const iso = projectData?.iso19650 || {};
    const deliveryTeams = Array.isArray(iso.deliveryTeams) ? iso.deliveryTeams : [];
    const receiverTeams = Array.isArray(iso.receiverTeams) ? iso.receiverTeams : [];

    // Collect all member emails from project
    const memberEmailsSet = new Set<string>();
    if (Array.isArray(projectData?.members)) {
      projectData.members.forEach((e: string) => { if (e) memberEmailsSet.add(e.toLowerCase().trim()); });
    }
    // Also include leaders and teams members
    if (iso.liderEquipoEntrega) memberEmailsSet.add(iso.liderEquipoEntrega.toLowerCase().trim());
    if (iso.directorDeObra) memberEmailsSet.add(iso.directorDeObra.toLowerCase().trim());
    (iso.projectAdmins || []).forEach((e: string) => { if (e) memberEmailsSet.add(e.toLowerCase().trim()); });
    deliveryTeams.forEach((dt: any) => {
      if (dt.leadEmail) memberEmailsSet.add(dt.leadEmail.toLowerCase().trim());
      (dt.members || []).forEach((m: any) => {
        const mail = (typeof m === 'string' ? m : m.email || m.username || '').toLowerCase().trim();
        if (mail) memberEmailsSet.add(mail);
      });
      (dt.taskTeams || []).forEach((tt: any) => {
        (tt.members || []).forEach((m: any) => {
          const mail = (typeof m === 'string' ? m : m.email || m.username || '').toLowerCase().trim();
          if (mail) memberEmailsSet.add(mail);
        });
      });
    });
    receiverTeams.forEach((rt: any) => {
      if (rt.leadEmail) memberEmailsSet.add(rt.leadEmail.toLowerCase().trim());
      (rt.members || []).forEach((m: any) => {
        const mail = (typeof m === 'string' ? m : m.email || m.username || '').toLowerCase().trim();
        if (mail) memberEmailsSet.add(mail);
      });
      (rt.taskTeams || []).forEach((tt: any) => {
        (tt.members || []).forEach((m: any) => {
          const mail = (typeof m === 'string' ? m : m.email || m.username || '').toLowerCase().trim();
          if (mail) memberEmailsSet.add(mail);
        });
      });
    });

    // If still empty, fall back to company members
    if (memberEmailsSet.size === 0) {
      companyMembers.forEach((m: any) => {
        if (m.email) memberEmailsSet.add(m.email.toLowerCase().trim());
      });
    }

    const memberEmails = Array.from(memberEmailsSet);

    // Map each member to rich format
    return memberEmails.map((email: string) => {
      const cleanEmail = email.toLowerCase().trim();
      const du = Array.isArray(dirUsers) ? dirUsers.find((u: any) => (u.email || '').toLowerCase().trim() === cleanEmail) : null;
      const compMember = companyMembers.find((m: any) => (m.email || '').toLowerCase().trim() === cleanEmail);

      let teamGroup = 'GENERAL';
      let branch: 'DELIVERY' | 'RECEIVER' | 'ADMIN' | 'NONE' = 'NONE';

      // Check delivery teams
      for (const dt of deliveryTeams) {
        const isLead = (dt.leadEmail || '').toLowerCase().trim() === cleanEmail;
        const isMem = (dt.members || []).some((m: any) => (typeof m === 'string' ? m : m.email || '').toLowerCase().trim() === cleanEmail);
        const isTaskMem = (dt.taskTeams || []).some((tt: any) => (tt.members || []).some((m: any) => (typeof m === 'string' ? m : m.email || '').toLowerCase().trim() === cleanEmail));
        if (isLead || isMem || isTaskMem) {
          teamGroup = dt.name;
          branch = 'DELIVERY';
          break;
        }
      }

      // Check receiver teams
      if (branch === 'NONE') {
        for (const rt of receiverTeams) {
          const isLead = (rt.leadEmail || '').toLowerCase().trim() === cleanEmail;
          const isMem = (rt.members || []).some((m: any) => (typeof m === 'string' ? m : m.email || '').toLowerCase().trim() === cleanEmail);
          const isTaskMem = (rt.taskTeams || []).some((tt: any) => (tt.members || []).some((m: any) => (typeof m === 'string' ? m : m.email || '').toLowerCase().trim() === cleanEmail));
          if (isLead || isMem || isTaskMem) {
            teamGroup = rt.name;
            branch = 'RECEIVER';
            break;
          }
        }
      }

      if (cleanEmail === (iso.liderEquipoEntrega || '').toLowerCase().trim()) branch = 'DELIVERY';
      if (cleanEmail === (iso.directorDeObra || '').toLowerCase().trim()) branch = 'RECEIVER';
      if ((iso.projectAdmins || []).map((a: string) => a.toLowerCase().trim()).includes(cleanEmail)) branch = 'ADMIN';

      // Check memberBranches explicit mapping
      if (iso.memberBranches && iso.memberBranches[cleanEmail]) {
        const mb = iso.memberBranches[cleanEmail].toLowerCase().trim();
        if (mb === 'delivery') branch = 'DELIVERY';
        if (mb === 'receiver') branch = 'RECEIVER';
      }

      // Determine user's company:
      // 1. Check if user has an explicit company representation for this project
      const repComp = iso?.memberCompanies?.[cleanEmail] ||
                      projectData?.memberCompanies?.[cleanEmail] ||
                      localStorage.getItem(`project_rep_company_${projectId}_${cleanEmail}`) ||
                      localStorage.getItem(`project_rep_company_${projectData?.slug}_${cleanEmail}`);

      let companyName = repComp || '';

      // Find user details across all companies in empresas.json
      let userDetailsFromCompany: any = compMember;
      if (Array.isArray(empresas) && empresas.length > 0) {
        for (const comp of empresas) {
          if (comp.deleted) continue;
          const isMember = (comp.members || []).find((m: any) => 
            (m.email || '').toLowerCase().trim() === cleanEmail
          );
          if (isMember) {
            if (!userDetailsFromCompany || isMember.role !== 'INVITADO') {
              userDetailsFromCompany = isMember;
            }
            if (!companyName) {
              const empUser = isMember.empresaUsuario || isMember.empresa;
              if (empUser && empUser.trim()) {
                companyName = empUser.trim();
                if (isMember.role !== 'INVITADO') break;
              } else if (comp.name) {
                companyName = comp.name.trim();
                if (isMember.role !== 'INVITADO') break;
              }
            }
          }
          const isAdmin = (comp.admins || []).some((a: string) => a.toLowerCase().trim() === cleanEmail);
          if (isAdmin && !companyName) {
            companyName = comp.name.trim();
            break;
          }
        }
      }

      if (!companyName) {
        companyName = du?.empresa || du?.empresaUsuario || compMember?.empresaUsuario || compMember?.empresa || company.name || 'EMPRESA';
      }

      const name = du?.nombre || du?.name || userDetailsFromCompany?.name || userDetailsFromCompany?.nombre || cleanEmail.split('@')[0];
      const cargo = du?.cargo || userDetailsFromCompany?.cargo || userDetailsFromCompany?.role || 'Colaborador';
      const position = `${cargo} (${name})`;

      return {
        id: cleanEmail,
        email: cleanEmail,
        name,
        cargo,
        position,
        company: companyName,
        team: teamGroup.toUpperCase().trim(),
        branch
      };
    });
  } catch (error) {
    console.warn("Error loading platform team: ", error);
    return null;
  }
  })();
  platformTeamCache.set(cacheKey, request);
  return request;
};

// Team
export const subscribeToTeam = (callback: (team: any[]) => void) => {
  const { projectId, companyId } = getProjectAndCompany();
  
  let active = true;
  let storedUnsubscribe: (() => void) | null = null;
  
  getPlatformTeam(companyId, projectId).then((platformTeam) => {
    if (!active) return;
    if (platformTeam && platformTeam.length > 0) {
      callback(platformTeam);
    } else {
      // Fallback: use Firestore
      const q = query(
        collection(db, 'team'),
        where('projectId', '==', projectId),
        where('companyId', '==', companyId)
      );
      storedUnsubscribe = onSnapshot(q, (snapshot) => {
        if (!active) return;
        const team = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(team);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'team');
      });
    }
  }).catch((err) => {
    console.warn("Error loading platform team, falling back to Firestore team collection", err);
    if (!active) return;
    const q = query(
      collection(db, 'team'),
      where('projectId', '==', projectId),
      where('companyId', '==', companyId)
    );
    storedUnsubscribe = onSnapshot(q, (snapshot) => {
      if (!active) return;
      const team = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(team);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'team');
    });
  });

  return () => {
    active = false;
    if (storedUnsubscribe) {
      storedUnsubscribe();
    }
  };
};

// Helper to prevent offline or missing Firestore databases from hanging forever
const safeFirestoreCall = async <T>(promise: Promise<T>, timeoutMs = 1200, fallback: T = null as any): Promise<T> => {
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs))
    ]);
  } catch (err) {
    console.warn("Firestore safe call timed out or failed:", err);
    return fallback;
  }
};

export const saveTeamMember = async (member: any) => {
  const path = 'team';
  const { projectId, companyId } = getProjectAndCompany();
  try {
    const firestorePromise = member.id
      ? setDoc(doc(db, path, member.id), {
          ...member,
          projectId,
          companyId
        }, { merge: true })
      : addDoc(collection(db, path), {
          ...member,
          projectId,
          companyId
        });
    await safeFirestoreCall(firestorePromise, 1000, null);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteTeamMember = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'team', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `team/${id}`);
  }
};

// Config
export const getProjectConfig = async () => {
  const { projectId, companyId } = getProjectAndCompany();
  const configDocId = `${companyId}_${projectId}`;
  const cachedInMemory = projectConfigCache.get(configDocId);
  if (cachedInMemory) return cachedInMemory;
  let fbConfig: any = null;
  
  // 1. Local storage fallback
  try {
    const cached = localStorage.getItem(`cached_project_config_${configDocId}`) || localStorage.getItem('cached_project_config');
    if (cached) {
      fbConfig = JSON.parse(cached);
    }
  } catch (cacheErr) {
    console.error("Local project config storage fallbacks failed:", cacheErr);
  }

  // 2. Firestore read with timeout safeguard
  try {
    const docSnap: any = await safeFirestoreCall(getDoc(doc(db, 'config', configDocId)), 1200, null);
    if (docSnap && typeof docSnap.exists === 'function' && docSnap.exists()) {
      fbConfig = { ...(fbConfig || {}), ...docSnap.data() };
    }
  } catch (error) {
    console.warn("Firestore error reading config/project:", error);
  }

  // 3. Google Drive fallback if types are empty or not loaded
  if (!fbConfig || !fbConfig.issueTypes || fbConfig.issueTypes.length === 0) {
    try {
      const driveCfg = await loadIncidentsConfigFromSheet(companyId, projectId);
      if (driveCfg) {
        fbConfig = { ...driveCfg, ...(fbConfig || {}) };
      }
    } catch (driveErr) {
      console.warn("Drive config reading warning:", driveErr);
    }
  }

  // 4. Load platform config to merge companies and teams
  const platformConfig = await getPlatformConfig(companyId);
  if (platformConfig) {
    if (!fbConfig) {
      fbConfig = {
        impactOptions: [],
        issueTypes: [],
        economicActivities: [],
        dangers: [],
        dangerDescriptions: {}
      };
    }
    fbConfig.responsibleCompanies = platformConfig.responsibleCompanies;
    fbConfig.teams = platformConfig.teams;
  }

  if (fbConfig) {
    try {
      projectConfigCache.set(configDocId, fbConfig);
      localStorage.setItem(`cached_project_config_${configDocId}`, JSON.stringify(fbConfig));
    } catch (cacheStoreErr) {
      console.warn("Could not save merged project config to local cache", cacheStoreErr);
    }
  }
  
  return fbConfig;
};

export const saveProjectConfig = async (config: any) => {
  const { projectId, companyId } = getProjectAndCompany();
  const configDocId = `${companyId}_${projectId}`;

  // 1. Inmediatamente actualizar memoria y caché local
  projectConfigCache.set(configDocId, config);
  try {
    localStorage.setItem(`cached_project_config_${configDocId}`, JSON.stringify(config));
    localStorage.setItem('cached_project_config', JSON.stringify(config));
  } catch (cacheStoreErr) {
    console.warn("Could not write project config to local cache on save", cacheStoreErr);
  }

  // 2. PRINCIPAL: Guardar directamente en Google Drive (Carpeta raíz 1-9SumRefiih81mc_eASsswy_W_U0-qe5)
  let driveStorageResult: any = null;
  try {
    let locations: any[] = [];
    try {
      const unitsCacheKey = `cached_units_${companyId}_${projectId}`;
      const localUnitsRaw = localStorage.getItem(unitsCacheKey) || localStorage.getItem('cached_units');
      if (localUnitsRaw) {
        const parsed = JSON.parse(localUnitsRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          locations = parsed;
        }
      }
      if (locations.length === 0) {
        const unitsSnapshot: any = await safeFirestoreCall(
          getDocs(query(
            collection(db, 'units'),
            where('projectId', '==', projectId),
            where('companyId', '==', companyId)
          )),
          1000,
          null
        );
        if (unitsSnapshot && unitsSnapshot.docs) {
          locations = unitsSnapshot.docs.map((unitDoc: any) => ({
            id: unitDoc.id,
            ...unitDoc.data()
          }));
        }
      }
    } catch (locErr) {
      console.warn("Units query skipped for locations backup:", locErr);
    }

    driveStorageResult = await saveIncidentsConfigToSheet({
      ...config,
      projectId,
      companyId,
      locations,
      updatedAt: new Date().toISOString()
    }, companyId, projectId);
    console.log("Configuración guardada en Google Drive:", driveStorageResult);
  } catch (driveErr: any) {
    console.error("Error guardando en Google Drive:", driveErr);
    throw new Error(driveErr?.message || "No se pudo guardar la configuración en Google Drive.");
  }

  // 3. SECUNDARIO: Sincronizar en Firestore sin bloquear la UI ni el guardado de Drive
  try {
    await safeFirestoreCall(
      setDoc(doc(db, 'config', configDocId), {
        ...config,
        projectId,
        companyId,
        driveStorage: driveStorageResult || null,
        updatedAt: new Date().toISOString()
      }, { merge: true }),
      1200,
      null
    );
  } catch (firestoreErr) {
    console.warn("Firestore sync skipped (Drive save succeeded):", firestoreErr);
  }

  return driveStorageResult;
};

// Structural Units
export const subscribeToUnits = (callback: (units: StructuralUnit[]) => void) => {
  const { projectId, companyId } = getProjectAndCompany();
  const cacheKey = `cached_units_${companyId}_${projectId}`;
  let deliveredUnits: StructuralUnit[] = [];

  // 1. Inmediatamente servir datos locales si existen
  try {
    const localRaw = localStorage.getItem(cacheKey) || localStorage.getItem('cached_units');
    if (localRaw) {
      const parsed = JSON.parse(localRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        deliveredUnits = parsed;
        callback(parsed);
      }
    }

    // Fallback secundario: revisar si el proyecto tiene locations en config
    if (deliveredUnits.length === 0) {
      const configDocId = `${companyId}_${projectId}`;
      const cfgRaw = localStorage.getItem(`cached_project_config_${configDocId}`) || localStorage.getItem('cached_project_config');
      if (cfgRaw) {
        const parsedCfg = JSON.parse(cfgRaw);
        if (Array.isArray(parsedCfg.locations) && parsedCfg.locations.length > 0) {
          deliveredUnits = parsedCfg.locations;
          localStorage.setItem(cacheKey, JSON.stringify(deliveredUnits));
          callback(deliveredUnits);
        }
      }
    }
  } catch (e) {
    console.warn("Error reading local cached units:", e);
  }

  // 2. Escuchar actualizaciones locales en tiempo real
  const localHandler = (e: any) => {
    if (e?.detail && Array.isArray(e.detail)) {
      deliveredUnits = e.detail;
      callback(e.detail);
    }
  };
  window.addEventListener('local_units_updated', localHandler);

  // 3. Cargar desde Google Drive en segundo plano
  let isMounted = true;
  loadIncidentsLocationsFromSheet(companyId, projectId)
    .then((units) => {
      if (!isMounted) return;
      if (Array.isArray(units) && units.length > 0) {
        deliveredUnits = units as StructuralUnit[];
        try {
          localStorage.setItem(cacheKey, JSON.stringify(units));
          localStorage.setItem('cached_units', JSON.stringify(units));
        } catch (_) {}
        callback(deliveredUnits);
      }
    })
    .catch((error) => console.warn('No se pudieron cargar las ubicaciones desde Drive:', error));

  // 4. Firestore snapshot sin bloquear ni emitir errores destructivos
  let unsubscribeFirestore = () => {};
  try {
    const q = query(
      collection(db, 'units'),
      where('projectId', '==', projectId),
      where('companyId', '==', companyId)
    );
    unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      if (!isMounted) return;
      const units = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StructuralUnit));
      if (units.length > 0) {
        deliveredUnits = units;
        try {
          localStorage.setItem(cacheKey, JSON.stringify(units));
          localStorage.setItem('cached_units', JSON.stringify(units));
        } catch (_) {}
        callback(units);
      } else if (deliveredUnits.length > 0) {
        callback(deliveredUnits);
      }
    }, (error) => {
      console.warn("Firestore snapshot skipped for units (using Drive/cache):", error?.message || error);
    });
  } catch (fsErr) {
    console.warn("Firestore subscription failed for units:", fsErr);
  }

  return () => {
    isMounted = false;
    window.removeEventListener('local_units_updated', localHandler);
    unsubscribeFirestore();
  };
};

export const saveUnit = async (unit: Omit<StructuralUnit, 'id'> & { id?: string }) => {
  const path = 'units';
  const { projectId, companyId } = getProjectAndCompany();
  const unitId = unit.id || `unit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const fullUnit: StructuralUnit = {
    ...unit,
    id: unitId
  };

  // 1. Guardar de inmediato en caché local
  try {
    const cacheKey = `cached_units_${companyId}_${projectId}`;
    const raw = localStorage.getItem(cacheKey);
    let currentUnits: StructuralUnit[] = raw ? JSON.parse(raw) : [];
    const index = currentUnits.findIndex(u => u.id === unitId || u.name === fullUnit.name);
    if (index >= 0) {
      currentUnits[index] = fullUnit;
    } else {
      currentUnits.push(fullUnit);
    }
    localStorage.setItem(cacheKey, JSON.stringify(currentUnits));
    localStorage.setItem('cached_units', JSON.stringify(currentUnits));

    // También actualizar en config local para respaldo integrado
    const configDocId = `${companyId}_${projectId}`;
    const rawCfg = localStorage.getItem(`cached_project_config_${configDocId}`);
    if (rawCfg) {
      try {
        const parsedCfg = JSON.parse(rawCfg);
        parsedCfg.locations = currentUnits;
        localStorage.setItem(`cached_project_config_${configDocId}`, JSON.stringify(parsedCfg));
      } catch (_) {}
    }

    // Notificar reactivamente a los componentes suscritos
    window.dispatchEvent(new CustomEvent('local_units_updated', { detail: currentUnits }));
    window.dispatchEvent(new Event('storage_settings_updated'));
  } catch (cacheErr) {
    console.warn("Could not save unit to localStorage:", cacheErr);
  }

  // 2. Guardar en Google Drive
  try {
    await saveIncidentsLocationsToSheet('upsert', fullUnit, companyId, projectId);
  } catch (driveErr) {
    console.warn("Could not save unit to Google Drive sheet:", driveErr);
  }

  // 3. Sincronizar Firestore de forma segura sin bloquear
  try {
    await safeFirestoreCall(
      setDoc(doc(db, path, unitId), {
        ...fullUnit,
        projectId,
        companyId
      }, { merge: true }),
      1200,
      null
    );
  } catch (firestoreErr) {
    console.warn("Firestore sync skipped for unit:", firestoreErr);
  }

  return fullUnit;
};

export const deleteUnit = async (id: string) => {
  const { projectId, companyId } = getProjectAndCompany();
  // 1. Eliminar inmediatamente de caché local
  try {
    const cacheKey = `cached_units_${companyId}_${projectId}`;
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      let currentUnits: StructuralUnit[] = JSON.parse(raw);
      currentUnits = currentUnits.filter(u => u.id !== id);
      localStorage.setItem(cacheKey, JSON.stringify(currentUnits));
      localStorage.setItem('cached_units', JSON.stringify(currentUnits));

      // Actualizar config local
      const configDocId = `${companyId}_${projectId}`;
      const rawCfg = localStorage.getItem(`cached_project_config_${configDocId}`);
      if (rawCfg) {
        try {
          const parsedCfg = JSON.parse(rawCfg);
          parsedCfg.locations = currentUnits;
          localStorage.setItem(`cached_project_config_${configDocId}`, JSON.stringify(parsedCfg));
        } catch (_) {}
      }

      window.dispatchEvent(new CustomEvent('local_units_updated', { detail: currentUnits }));
      window.dispatchEvent(new Event('storage_settings_updated'));
    }
  } catch (cacheErr) {
    console.warn("Could not delete unit from localStorage:", cacheErr);
  }

  // 2. Guardar eliminación en Google Drive
  try {
    await saveIncidentsLocationsToSheet('delete', { id }, companyId, projectId);
  } catch (driveErr) {
    console.warn("Could not delete unit from Google Drive sheet:", driveErr);
  }

  // 3. Sincronizar Firestore
  try {
    await safeFirestoreCall(deleteDoc(doc(db, 'units', id)), 1200, null);
  } catch (firestoreErr) {
    console.warn("Firestore delete skipped for unit:", firestoreErr);
  }
};

export const deleteReport = async (id: string) => {
  try {
    // 1. Find and cascade-delete any associated issues
    const issuesRef = collection(db, 'issues');
    const qIssues = query(issuesRef, where('sourceReportId', '==', id));
    const issuesSnapshot = await getDocs(qIssues);
    
    const deletePromises = issuesSnapshot.docs.map(async (docSnap) => {
      // Clean up comments for this issue first
      try {
        const commentsRef = collection(db, 'issues', docSnap.id, 'comments');
        const commentsSnapshot = await getDocs(commentsRef);
        const commentDeletes = commentsSnapshot.docs.map(cDoc => deleteDoc(cDoc.ref));
        await Promise.all(commentDeletes);
      } catch (comError) {
        console.warn(`[deleteReport] Warning. Comments for issue ${docSnap.id} could not be fully deleted:`, comError);
      }
      
      // Delete issue itself
      await deleteDoc(docSnap.ref);
    });
    
    await Promise.all(deletePromises);

    // 2. Delete the report document
    await deleteDoc(doc(db, 'reports', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `reports/${id}`);
  }
};
