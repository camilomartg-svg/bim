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
  saveIncidentsConfigToSheet,
  saveIncidentsLocationsToSheet
} from '../utils/googleDriveUtils';
import {
  fetchIncidentsFromDrive,
  getCachedIncidents,
  saveIncidentToDrive,
  deleteIncidentFromDrive
} from './driveIncidentsService';
import { handleFirestoreError, OperationType } from './firestore-errors';
import { getActiveProjectData, loadAndCacheProjectIso } from '../utils/userScope';
import { FILES_GATEWAY_URL } from '../utils/googleDriveUtils';
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

// Issues - Single Source of Truth: Google Drive (1-9SumRefiih81mc_eASsswy_W_U0-qe5 / [Empresa] / [Proyecto])
export const subscribeToIssues = (callback: (issues: Issue[]) => void) => {
  const { projectId, companyId } = getProjectAndCompany();

  // 1. Inmediatamente emitir incidencias en caché local para que nunca esté en blanco ni parpadee
  const cached = getCachedIncidents(companyId, projectId);
  if (cached.length > 0) {
    callback(cached);
  }

  // 2. Cargar incidencias frescas directamente desde Google Drive
  fetchIncidentsFromDrive(companyId, projectId).then((fresh) => {
    callback(fresh);
  }).catch((err) => {
    console.warn('[firebaseService] No se pudieron cargar incidencias frescas desde Google Drive:', err);
  });

  // 3. Escuchar actualizaciones locales y entre pestañas
  const handleUpdate = (e: any) => {
    const detail = e.detail;
    if (detail && detail.incidents) {
      if (detail.companyId === companyId && detail.projectId === projectId) {
        callback(detail.incidents);
      }
    } else {
      const current = getCachedIncidents(companyId, projectId);
      callback(current);
    }
  };

  window.addEventListener('nora_incidents_updated', handleUpdate);

  // 4. Polling periódico cada 12 segundos para sincronizar cambios remotos en Google Drive
  const interval = setInterval(() => {
    fetchIncidentsFromDrive(companyId, projectId).then((fresh) => {
      callback(fresh);
    }).catch(() => {});
  }, 12000);

  return () => {
    window.removeEventListener('nora_incidents_updated', handleUpdate);
    clearInterval(interval);
  };
};

export const saveIssue = async (issue: Omit<Issue, 'id'> & { id?: string }) => {
  const { projectId, companyId } = getProjectAndCompany();
  try {
    const savedId = await saveIncidentToDrive(issue, companyId, projectId);
    return savedId;
  } catch (error) {
    console.error('[firebaseService] Error guardando incidencia en Google Drive:', error);
    throw error;
  }
};

export const deleteIssue = async (id: string) => {
  const { projectId, companyId } = getProjectAndCompany();
  try {
    await deleteIncidentFromDrive(id, companyId, projectId);
  } catch (error) {
    console.error(`[firebaseService] Error eliminando incidencia ${id} en Drive:`, error);
  }
};

export const updateIssue = async (id: string, updates: Partial<Issue>) => {
  const { projectId, companyId } = getProjectAndCompany();
  const cached = getCachedIncidents(companyId, projectId);
  const existing = cached.find(i => i.id === id);
  const merged: Issue = {
    ...(existing || {}),
    ...updates,
    id,
    updatedAt: new Date().toISOString()
  } as Issue;
  return saveIssue(merged);
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
      // 1. Fetch empresas.json (all companies in Nora)
      let allCompanies: any[] = [];
      try {
        const empresasRes = await fetch('../empresas.json?t=' + Date.now());
        if (empresasRes.ok) {
          allCompanies = await empresasRes.json();
        }
      } catch (err) {
        console.warn("Could not load empresas.json:", err);
      }

      // Map users across all companies in empresas.json
      const companyUsersMap = new Map<string, { member: any; companyName: string }>();
      allCompanies.forEach((comp: any) => {
        if (!comp || comp.deleted) return;
        const compName = String(comp.name || comp.razonSocial || '').trim();
        if (Array.isArray(comp.members)) {
          comp.members.forEach((m: any) => {
            if (m && m.email) {
              const clean = String(m.email).toLowerCase().trim();
              if (!companyUsersMap.has(clean)) {
                companyUsersMap.set(clean, { member: m, companyName: compName });
              }
            }
          });
        }
      });

      // 2. Fetch Nora Global Directory from Google Apps Script (all registered users)
      const dirUsersMap = new Map<string, any>();
      try {
        const gatewayUrl = (typeof FILES_GATEWAY_URL !== 'undefined' && FILES_GATEWAY_URL) 
          ? FILES_GATEWAY_URL 
          : 'https://script.google.com/macros/s/AKfycbx2RAQx_8K4o22xE0Mw-ETc7K_58vIoi6-PgVi64u80inuiw144ks3cgWSdCtXqIgB02g/exec';
        const dirRes = await fetch(gatewayUrl);
        if (dirRes.ok) {
          const dirUsers = await dirRes.json();
          if (Array.isArray(dirUsers)) {
            dirUsers.forEach((u: any) => {
              if (u && u.email) {
                dirUsersMap.set(String(u.email).toLowerCase().trim(), u);
              }
            });
          }
        }
      } catch (e) {
        console.warn("Could not fetch global directory users:", e);
      }

      // 3. Load activeProject data (ISO 19650 teams, assigned members)
      let activeProject: any = null;
      try {
        activeProject = getActiveProjectData();
      } catch (_) {}

      if (!activeProject || !Array.isArray(activeProject.members) || activeProject.members.length === 0) {
        try {
          activeProject = await loadAndCacheProjectIso(companyId, projectId);
        } catch (_) {}
      }

      // Fallback: check config-<companyId>.json or portal-config.json
      if (!activeProject || !Array.isArray(activeProject.members) || activeProject.members.length === 0) {
        try {
          const configRes = await fetch(`../config-${companyId}.json?t=` + Date.now());
          if (configRes.ok) {
            const configData = await configRes.json();
            const foundProj = configData.projects?.find((p: any) => p.slug === projectId || p.name === projectId || p.id === projectId);
            if (foundProj) {
              activeProject = { ...(activeProject || {}), ...foundProj };
            }
          }
        } catch (_) {}
      }

      if (!activeProject || !Array.isArray(activeProject.members) || activeProject.members.length === 0) {
        try {
          const portalRes = await fetch(`../portal-config.json?t=` + Date.now());
          if (portalRes.ok) {
            const portalData = await portalRes.json();
            const foundProj = portalData.projects?.find((p: any) => p.slug === projectId || p.name === projectId || p.id === projectId);
            if (foundProj) {
              activeProject = { ...(activeProject || {}), ...foundProj };
            }
          }
        } catch (_) {}
      }

      const iso = activeProject?.iso19650 || {};
      const deliveryTeams = Array.isArray(iso.deliveryTeams) ? iso.deliveryTeams : [];
      const receiverTeams = Array.isArray(iso.receiverTeams) ? iso.receiverTeams : [];
      const projectAdmins = Array.isArray(iso.projectAdmins) ? iso.projectAdmins : [];
      const memberBranches = iso.memberBranches || {};
      const memberCompanies = iso.memberCompanies || {};

      // 4. Collect all authorized project member emails
      const projectMemberEmailsSet = new Set<string>();

      // From activeProject.members (the official authorized directory of 11+ members)
      if (Array.isArray(activeProject?.members)) {
        activeProject.members.forEach((m: any) => {
          const clean = (typeof m === 'string' ? m : m.email || m.username || '').toLowerCase().trim();
          if (clean) projectMemberEmailsSet.add(clean);
        });
      }

      // From project admins
      projectAdmins.forEach((adm: any) => {
        const clean = (typeof adm === 'string' ? adm : adm.email || adm.username || '').toLowerCase().trim();
        if (clean) projectMemberEmailsSet.add(clean);
      });

      // From delivery teams (leads, members, task teams)
      deliveryTeams.forEach((dt: any) => {
        if (dt.leadEmail) projectMemberEmailsSet.add(String(dt.leadEmail).toLowerCase().trim());
        if (Array.isArray(dt.members)) {
          dt.members.forEach((m: any) => {
            const clean = (typeof m === 'string' ? m : m.email || '').toLowerCase().trim();
            if (clean) projectMemberEmailsSet.add(clean);
          });
        }
        if (Array.isArray(dt.taskTeams)) {
          dt.taskTeams.forEach((tt: any) => {
            if (Array.isArray(tt.members)) {
              tt.members.forEach((m: any) => {
                const clean = (typeof m === 'string' ? m : m.email || '').toLowerCase().trim();
                if (clean) projectMemberEmailsSet.add(clean);
              });
            }
          });
        }
      });

      // From receiver teams (leads, members, task teams)
      receiverTeams.forEach((rt: any) => {
        if (rt.leadEmail) projectMemberEmailsSet.add(String(rt.leadEmail).toLowerCase().trim());
        if (Array.isArray(rt.members)) {
          rt.members.forEach((m: any) => {
            const clean = (typeof m === 'string' ? m : m.email || '').toLowerCase().trim();
            if (clean) projectMemberEmailsSet.add(clean);
          });
        }
        if (Array.isArray(rt.taskTeams)) {
          rt.taskTeams.forEach((tt: any) => {
            if (Array.isArray(tt.members)) {
              tt.members.forEach((m: any) => {
                const clean = (typeof m === 'string' ? m : m.email || '').toLowerCase().trim();
                if (clean) projectMemberEmailsSet.add(clean);
              });
            }
          });
        }
      });

      if (iso.directorDeObra) {
        projectMemberEmailsSet.add(String(iso.directorDeObra).toLowerCase().trim());
      }
      if (activeProject?.creatorEmail) {
        projectMemberEmailsSet.add(String(activeProject.creatorEmail).toLowerCase().trim());
      }

      // Also ensure members of the host company are included
      const hostCompany = allCompanies.find((c: any) => c && !c.deleted && (c.id === companyId || c.name?.toLowerCase() === companyId?.toLowerCase()));
      if (hostCompany && Array.isArray(hostCompany.members)) {
        hostCompany.members.forEach((m: any) => {
          if (m && m.email) {
            projectMemberEmailsSet.add(String(m.email).toLowerCase().trim());
          }
        });
      }

      // Fallback: If no members were found, include all users from all companies in empresas.json
      if (projectMemberEmailsSet.size === 0) {
        companyUsersMap.forEach((_, email) => {
          projectMemberEmailsSet.add(email);
        });
      }

      // 5. Build full TeamMember objects
      const resultTeam: any[] = [];
      projectMemberEmailsSet.forEach((email) => {
        const dirU = dirUsersMap.get(email);
        const compU = companyUsersMap.get(email);
        const m = compU?.member;

        const displayName = dirU?.nombre || dirU?.name || m?.name || m?.nombre || email.split('@')[0];
        const cargo = dirU?.cargo || dirU?.especialidad || m?.cargo || m?.especialidad || m?.role || 'Colaborador';
        const position = `${cargo} (${displayName})`;

        // Resolve Company
        let companyName = memberCompanies[email] || dirU?.empresa || m?.empresaUsuario || compU?.companyName || hostCompany?.name || 'Empresa';
        companyName = companyName.trim();

        // Resolve Team and Branch
        let teamName = '';
        let branch: 'DELIVERY' | 'RECEIVER' | 'ADMIN' | 'NONE' = 'NONE';

        if (projectAdmins.some((a: any) => String(a).toLowerCase().trim() === email)) {
          branch = 'ADMIN';
          teamName = 'ADMINISTRACIÓN';
        }

        for (const dt of deliveryTeams) {
          if (dt.leadEmail && String(dt.leadEmail).toLowerCase().trim() === email) {
            branch = 'DELIVERY';
            teamName = dt.name;
            break;
          }
          if (Array.isArray(dt.members) && dt.members.some((dm: any) => String(dm).toLowerCase().trim() === email)) {
            branch = 'DELIVERY';
            teamName = dt.name;
          }
          if (Array.isArray(dt.taskTeams)) {
            for (const tt of dt.taskTeams) {
              if (Array.isArray(tt.members) && tt.members.some((tm: any) => String(tm).toLowerCase().trim() === email)) {
                branch = 'DELIVERY';
                teamName = tt.name || dt.name;
                break;
              }
            }
          }
          if (branch === 'DELIVERY') break;
        }

        if (branch === 'NONE') {
          for (const rt of receiverTeams) {
            if (rt.leadEmail && String(rt.leadEmail).toLowerCase().trim() === email) {
              branch = 'RECEIVER';
              teamName = rt.name;
              break;
            }
            if (Array.isArray(rt.members) && rt.members.some((rm: any) => String(rm).toLowerCase().trim() === email)) {
              branch = 'RECEIVER';
              teamName = rt.name;
            }
            if (Array.isArray(rt.taskTeams)) {
              for (const tt of rt.taskTeams) {
                if (Array.isArray(tt.members) && tt.members.some((tm: any) => String(tm).toLowerCase().trim() === email)) {
                  branch = 'RECEIVER';
                  teamName = tt.name || rt.name;
                  break;
                }
              }
            }
            if (branch === 'RECEIVER') break;
          }
        }

        if (memberBranches[email]) {
          branch = String(memberBranches[email]).toUpperCase().trim() as any;
        }

        if (!teamName) {
          teamName = dirU?.especialidad || m?.especialidad || m?.empresaUsuario || companyName || 'GENERAL';
        }
        teamName = teamName.toUpperCase().trim();

        resultTeam.push({
          id: email,
          name: displayName,
          email: email,
          position: position,
          team: teamName,
          company: companyName,
          cargo: cargo,
          branch: branch
        });
      });

      return resultTeam;
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

export const saveTeamMember = async (member: any) => {
  const path = 'team';
  const { projectId, companyId } = getProjectAndCompany();
  try {
    if (member.id) {
      await setDoc(doc(db, path, member.id), {
        ...member,
        projectId,
        companyId
      }, { merge: true });
    } else {
      await addDoc(collection(db, path), {
        ...member,
        projectId,
        companyId
      });
    }
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
  
  // 1. Prioridad: Cargar desde Google Drive (fuente de verdad oficial y permanente)
  try {
    const driveConfig = await loadIncidentsConfigFromSheet(companyId, projectId);
    if (driveConfig && typeof driveConfig === 'object') {
      fbConfig = driveConfig;
      console.log("[Drive] Configuración de incidencias cargada exitosamente desde Google Drive.");
    }
  } catch (driveErr) {
    console.warn("Error leyendo configuración de incidencias desde Drive:", driveErr);
  }

  // 2. Fallback: Firestore
  if (!fbConfig) {
    try {
      const docSnap = await getDoc(doc(db, 'config', configDocId));
      if (docSnap.exists()) {
        fbConfig = docSnap.data();
      }
    } catch (error) {
      console.warn("Firestore error reading config/project fallback:", error);
    }
  }

  // 3. Fallback: Almacenamiento local
  if (!fbConfig) {
    try {
      const cached = localStorage.getItem(`cached_project_config_${configDocId}`) || localStorage.getItem('cached_project_config');
      if (cached) {
        fbConfig = JSON.parse(cached);
      }
    } catch (cacheErr) {
      console.error("Local project config storage fallbacks failed:", cacheErr);
    }
  }

  // Load platform config to merge companies and teams if missing
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
    if (platformConfig.responsibleCompanies && (!fbConfig.responsibleCompanies || fbConfig.responsibleCompanies.length === 0)) {
      fbConfig.responsibleCompanies = platformConfig.responsibleCompanies;
    }
    if (platformConfig.teams && (!fbConfig.teams || fbConfig.teams.length === 0)) {
      fbConfig.teams = platformConfig.teams;
    }
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
  
  // Actualizar caché inmediatamente
  projectConfigCache.set(configDocId, config);
  try {
    localStorage.setItem(`cached_project_config_${configDocId}`, JSON.stringify(config));
  } catch (_) {}

  // 1. Guardar de forma garantizada en Google Drive en la carpeta de la empresa y proyecto
  try {
    let locations = config.locations || [];
    if (!locations.length) {
      try {
        const unitsSnapshot = await getDocs(query(
          collection(db, 'units'),
          where('projectId', '==', projectId),
          where('companyId', '==', companyId)
        ));
        if (!unitsSnapshot.empty) {
          locations = unitsSnapshot.docs.map((unitDoc) => ({
            id: unitDoc.id,
            ...unitDoc.data()
          }));
        }
      } catch (_) {}
    }

    await saveIncidentsConfigToSheet({
      ...config,
      projectId,
      companyId,
      locations
    }, companyId, projectId);
    console.log("[Drive] Configuración de incidencias guardada exitosamente en Google Drive.");
  } catch (driveErr) {
    console.error("Error guardando configuración de incidencias en Google Drive:", driveErr);
  }

  // 2. Guardar en Firestore si está disponible (sin bloquear en caso de error)
  try {
    await setDoc(doc(db, 'config', configDocId), {
      ...config,
      projectId,
      companyId
    }, { merge: true });
  } catch (error) {
    console.warn("Firestore setDoc para config ignorado o no disponible:", error);
  }
};

// Structural Units
export const subscribeToUnits = (callback: (units: StructuralUnit[]) => void) => {
  const { projectId, companyId } = getProjectAndCompany();
  let remoteUnits: StructuralUnit[] = [];
  let lastFirestoreUnits: StructuralUnit[] | null = null;
  loadIncidentsLocationsFromSheet(companyId, projectId)
    .then((units) => {
      remoteUnits = units as StructuralUnit[];
      if (!lastFirestoreUnits || lastFirestoreUnits.length === 0) callback(remoteUnits);
    })
    .catch((error) => console.warn('No se pudieron cargar las ubicaciones desde Drive:', error));
  const q = query(
    collection(db, 'units'),
    where('projectId', '==', projectId),
    where('companyId', '==', companyId)
  );
  return onSnapshot(q, (snapshot) => {
    const units = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StructuralUnit));
    lastFirestoreUnits = units;
    callback(units.length > 0 ? units : remoteUnits);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'units');
  });
};

export const saveUnit = async (unit: Omit<StructuralUnit, 'id'> & { id?: string }) => {
  const path = 'units';
  const { projectId, companyId } = getProjectAndCompany();
  try {
    let savedUnit: StructuralUnit;
    if (unit.id) {
      const { id, ...rest } = unit;
      await setDoc(doc(db, path, id), {
        ...rest,
        projectId,
        companyId
      }, { merge: true });
      savedUnit = unit as StructuralUnit;
    } else {
      const docRef = await addDoc(collection(db, path), {
        ...unit,
        projectId,
        companyId
      });
      savedUnit = { ...unit, id: docRef.id } as StructuralUnit;
    }
    await saveIncidentsLocationsToSheet('upsert', savedUnit, companyId, projectId);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteUnit = async (id: string) => {
  const { projectId, companyId } = getProjectAndCompany();
  try {
    await deleteDoc(doc(db, 'units', id));
    await saveIncidentsLocationsToSheet('delete', { id }, companyId, projectId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `units/${id}`);
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
