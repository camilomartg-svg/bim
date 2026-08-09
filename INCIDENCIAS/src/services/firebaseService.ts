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
const getProjectAndCompany = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('project') || 'default';
  
  const userAccountStr = sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount');
  let companyId = 'default';
  if (userAccountStr) {
    try {
      companyId = JSON.parse(userAccountStr).empresa || 'default';
    } catch (e) {}
  }
  return { projectId, companyId };
};

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
  const q = query(
    collection(db, 'issues'),
    where('projectId', '==', projectId),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snapshot) => {
    const issues = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Issue));
    callback(issues);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'issues');
  });
};

export const saveIssue = async (issue: Omit<Issue, 'id'> & { id?: string }) => {
  const path = 'issues';
  const { projectId, companyId } = getProjectAndCompany();
  try {
    if (issue.id) {
      await setDoc(doc(db, path, issue.id), {
        ...issue,
        projectId,
        companyId,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return issue.id;
    } else {
      const docRef = await addDoc(collection(db, path), {
        ...issue,
        projectId,
        companyId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return docRef.id;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
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

export const getPlatformConfig = async (companyId: string): Promise<PlatformConfig | null> => {
  try {
    const empresasRes = await fetch(`../empresas.json?t=${Date.now()}`);
    if (!empresasRes.ok) return null;
    const empresas = await empresasRes.json();
    
    const company = empresas.find((e: any) => e && !e.deleted && (e.id === companyId || e.id?.toLowerCase() === companyId?.toLowerCase() || e.name?.toLowerCase() === companyId?.toLowerCase()));
    if (!company) return null;
    
    const members = company.members || [];
    const companiesSet = new Set<string>();
    const teamsSet = new Set<string>();
    
    // Default fallback teams
    teamsSet.add('AMBIENTAL');
    teamsSet.add('ARQUITECTURA');
    teamsSet.add('BIM');
    teamsSet.add('ESTRUCTURA');
    teamsSet.add('INSTALACIONES');
    teamsSet.add('CALIDAD');
    teamsSet.add('SST');
    
    members.forEach((m: any) => {
      if (m.empresaUsuario && m.empresaUsuario.trim()) {
        companiesSet.add(m.empresaUsuario.trim());
      }
      if (m.empresa && m.empresa.trim()) {
        companiesSet.add(m.empresa.trim());
      }
      if (m.especialidad && m.especialidad.trim()) {
        teamsSet.add(m.especialidad.trim().toUpperCase());
      }
    });

    const { projectId } = getProjectAndCompany();
    if (projectId && projectId !== 'default') {
      try {
        const configRes = await fetch(`../config-${companyId}.json?t=${Date.now()}`);
        if (configRes.ok) {
          const configData = await configRes.json();
          const project = configData.projects?.find((p: any) => p.slug === projectId || p.name === projectId);
          if (project && project.equiposDeTarea && project.equiposDeTarea.length > 0) {
            const projectTaskTeams = project.equiposDeTarea
              .map((t: any) => t.name?.trim().toUpperCase())
              .filter(Boolean);
            if (projectTaskTeams.length > 0) {
              teamsSet.clear();
              projectTaskTeams.forEach((t: string) => teamsSet.add(t));
            }
          }
        }
      } catch (e) {
        console.warn("Could not load project settings in getPlatformConfig:", e);
      }
    }
    
    return {
      responsibleCompanies: Array.from(companiesSet).sort(),
      teams: Array.from(teamsSet).sort()
    };
  } catch (error) {
    console.warn("Could not load platform configuration:", error);
    return null;
  }
};

export const getPlatformTeam = async (companyId: string, projectId: string): Promise<any[] | null> => {
  try {
    // 1. Fetch empresas.json
    const empresasRes = await fetch(`../empresas.json?t=${Date.now()}`);
    if (!empresasRes.ok) {
      throw new Error(`Failed to fetch empresas.json: ${empresasRes.statusText}`);
    }
    const empresas = await empresasRes.json();
    
    const company = empresas.find((e: any) => e && !e.deleted && (e.id === companyId || e.id?.toLowerCase() === companyId?.toLowerCase() || e.name?.toLowerCase() === companyId?.toLowerCase()));
    if (!company) {
      console.warn(`Company ${companyId} not found in empresas.json`);
      return null;
    }
    
    const companyMembers = company.members || [];
    
    // 2. Fetch config-<companyId>.json to see project members and task teams
    let projectMembersEmails: string[] = [];
    let equiposDeTarea: any[] = [];
    try {
      const configRes = await fetch(`../config-${companyId}.json?t=${Date.now()}`);
      if (configRes.ok) {
        const configData = await configRes.json();
        const project = configData.projects?.find((p: any) => p.slug === projectId || p.name === projectId);
        if (project) {
          if (project.members) {
            projectMembersEmails = project.members.map((email: string) => email.toLowerCase().trim());
          }
          if (project.equiposDeTarea) {
            equiposDeTarea = project.equiposDeTarea;
          }
        }
      }
    } catch (e) {
      console.warn(`Could not load config-${companyId}.json, defaulting to all company members`, e);
    }
    
    // 3. Filter company members
    let filteredMembers = companyMembers;
    if (projectMembersEmails.length > 0) {
      filteredMembers = companyMembers.filter((m: any) => m.email && projectMembersEmails.includes(m.email.toLowerCase().trim()));
    }
    
    // 4. Map to TeamMember format
    return filteredMembers.map((m: any) => {
      const displayName = m.name || m.email || 'Colaborador';
      const cargo = m.cargo || m.especialidad || m.role || 'Colaborador';
      const position = `${cargo} (${displayName})`;
      
      let teamGroup = 'GENERAL';
      const userEmail = m.email ? m.email.toLowerCase().trim() : '';
      if (equiposDeTarea && equiposDeTarea.length > 0) {
        const foundTeam = equiposDeTarea.find((t: any) => 
          t.members && t.members.some((email: string) => email.toLowerCase().trim() === userEmail)
        );
        if (foundTeam) {
          teamGroup = foundTeam.name;
        } else {
          teamGroup = (m.especialidad || m.empresaUsuario || 'GENERAL');
        }
      } else {
        teamGroup = (m.especialidad || m.empresaUsuario || 'GENERAL');
      }
      teamGroup = teamGroup.toUpperCase().trim();

      return {
        id: userEmail || Math.random().toString(36).substring(2, 9),
        name: displayName,
        email: m.email || '',
        position: position,
        team: teamGroup
      };
    });
  } catch (error) {
    console.warn("Error loading platform team: ", error);
    return null;
  }
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
  let fbConfig: any = null;
  
  try {
    const docSnap = await getDoc(doc(db, 'config', configDocId));
    if (docSnap.exists()) {
      fbConfig = docSnap.data();
    }
  } catch (error) {
    console.warn("Firestore error reading config/project. Attempting local storage fallback:", error);
    try {
      const cached = localStorage.getItem('cached_project_config');
      if (cached) {
        fbConfig = JSON.parse(cached);
      }
    } catch (cacheErr) {
      console.error("Local project config storage fallbacks failed:", cacheErr);
    }
  }

  // Load platform config to merge companies and teams
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
      localStorage.setItem('cached_project_config', JSON.stringify(fbConfig));
    } catch (cacheStoreErr) {
      console.warn("Could not save merged project config to local cache", cacheStoreErr);
    }
  }
  
  return fbConfig;
};

export const saveProjectConfig = async (config: any) => {
  const { projectId, companyId } = getProjectAndCompany();
  const configDocId = `${companyId}_${projectId}`;
  try {
    await setDoc(doc(db, 'config', configDocId), {
      ...config,
      projectId,
      companyId
    }, { merge: true });
    try {
      localStorage.setItem('cached_project_config', JSON.stringify(config));
    } catch (cacheStoreErr) {
      console.warn("Could not write project config to local cache on save", cacheStoreErr);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'config/' + configDocId);
  }
};

// Structural Units
export const subscribeToUnits = (callback: (units: StructuralUnit[]) => void) => {
  const { projectId, companyId } = getProjectAndCompany();
  const q = query(
    collection(db, 'units'),
    where('projectId', '==', projectId),
    where('companyId', '==', companyId)
  );
  return onSnapshot(q, (snapshot) => {
    const units = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StructuralUnit));
    callback(units);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'units');
  });
};

export const saveUnit = async (unit: Omit<StructuralUnit, 'id'> & { id?: string }) => {
  const path = 'units';
  const { projectId, companyId } = getProjectAndCompany();
  try {
    if (unit.id) {
      const { id, ...rest } = unit;
      await setDoc(doc(db, path, id), {
        ...rest,
        projectId,
        companyId
      }, { merge: true });
    } else {
      await addDoc(collection(db, path), {
        ...unit,
        projectId,
        companyId
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteUnit = async (id: string) => {
  try {
    await deleteDoc(doc(db, 'units', id));
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
