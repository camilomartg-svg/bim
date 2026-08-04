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

// Reports
export const subscribeToReports = (callback: (reports: SiteReport[]) => void) => {
  const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
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
  const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
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
  const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
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
  try {
    let reportId = report.id;
    const isNew = !reportId;
    
    if (isNew) {
      const docRef = doc(collection(db, path));
      reportId = docRef.id;
      await setDoc(docRef, {
        ...report,
        id: reportId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } else {
      await setDoc(doc(db, path, reportId), {
        ...report,
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
  const q = query(collection(db, 'issues'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const issues = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Issue));
    callback(issues);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'issues');
  });
};

export const saveIssue = async (issue: Omit<Issue, 'id'> & { id?: string }) => {
  const path = 'issues';
  try {
    if (issue.id) {
      await setDoc(doc(db, path, issue.id), {
        ...issue,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return issue.id;
    } else {
      const docRef = await addDoc(collection(db, path), {
        ...issue,
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

// Team
export const subscribeToTeam = (callback: (team: any[]) => void) => {
  return onSnapshot(collection(db, 'team'), (snapshot) => {
    const team = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(team);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'team');
  });
};

export const saveTeamMember = async (member: any) => {
  const path = 'team';
  try {
    if (member.id) {
      await setDoc(doc(db, path, member.id), member);
    } else {
      await addDoc(collection(db, path), member);
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
  try {
    const docSnap = await getDoc(doc(db, 'config', 'project'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      try {
        localStorage.setItem('cached_project_config', JSON.stringify(data));
      } catch (cacheStoreErr) {
        console.warn("Could not save project config to local cache", cacheStoreErr);
      }
      return data;
    }
    return null;
  } catch (error) {
    console.warn("Firestore error reading config/project. Attempting local storage fallback:", error);
    try {
      const cached = localStorage.getItem('cached_project_config');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (cacheErr) {
      console.error("Local project config storage fallbacks failed:", cacheErr);
    }
    return null; // Return null instead of throwing to avoid crashing pages
  }
};

export const saveProjectConfig = async (config: any) => {
  try {
    await setDoc(doc(db, 'config', 'project'), config);
    try {
      localStorage.setItem('cached_project_config', JSON.stringify(config));
    } catch (cacheStoreErr) {
      console.warn("Could not write project config to local cache on save", cacheStoreErr);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'config/project');
  }
};

// Structural Units
export const subscribeToUnits = (callback: (units: StructuralUnit[]) => void) => {
  return onSnapshot(collection(db, 'units'), (snapshot) => {
    const units = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StructuralUnit));
    callback(units);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'units');
  });
};

export const saveUnit = async (unit: Omit<StructuralUnit, 'id'> & { id?: string }) => {
  const path = 'units';
  try {
    if (unit.id) {
      const { id, ...rest } = unit;
      await setDoc(doc(db, path, id), rest);
    } else {
      await addDoc(collection(db, path), unit);
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
