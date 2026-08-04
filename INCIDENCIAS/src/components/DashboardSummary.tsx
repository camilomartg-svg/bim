import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, addDoc, getDocs, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Issue, DEGREE_OF_ACTION, Comment, Attachment, IMPACT_OPTIONS, TeamMember } from '../types';
import { useAuth } from '../context/AuthContext';
import { getProjectConfig, subscribeToTeam, deleteIssue } from '../services/firebaseService';
import { 
  Search, Filter, ClipboardList, Clock, User, ArrowRight, AlertCircle, 
  ChevronDown, ChevronUp, MapPin, Tag, ShieldCheck, Zap, Paperclip, Layers, Box,
  ExternalLink, MessageSquare, Send, Calendar, SortDesc, FileText as FileIcon, Image as ImageIcon,
  ArrowUpAZ, ArrowDownAZ, X, Trash2, CheckCircle2, Leaf
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format, differenceInDays, isPast } from 'date-fns';
import { isMedicionAlertActive, isEficaciaAlertActive } from '../utils/followUpUtils';

interface DashboardSummaryProps {
  onSelectIssue: (issue: Issue) => void;
  onOpenReport?: (reportId: string) => void;
  selectedIssueId?: string;
  filterRole: 'author' | 'responsible' | 'reviewer' | 'bim';
}

type SortOption = 'dueDate' | 'createdAt' | 'degreeOfAction' | 'title';

type SortCriteria = { field: SortOption; order: 'asc' | 'desc' };

export default function DashboardSummary({ onSelectIssue, onOpenReport, selectedIssueId, filterRole }: DashboardSummaryProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isFiltersVisible, setIsFiltersVisible] = useState(false);
  
  // Advanced Filters
  const [degreeFilter, setDegreeFilter] = useState<string[]>([]);
  const [dueDateFilter, setDueDateFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [impactFilter, setImpactFilter] = useState<string[]>([]);
  const [specialtyFilter, setSpecialtyFilter] = useState<string[]>([]);
  const [responsibleFilter, setResponsibleFilter] = useState<string[]>([]);

  const [unitFilter, setUnitFilter] = useState<string[]>([]);
  const [levelFilter, setLevelFilter] = useState<string[]>([]);
  const [spaceFilter, setSpaceFilter] = useState<string[]>([]);
  const [teamFilter, setTeamFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>(['ACTIVO', 'RESPONDIDA', 'VENCIDA', 'RECHAZADA', 'ACUERDO', 'REVISION_RESPONSABLE']);
  
  const [impactOptions, setImpactOptions] = useState<string[]>(IMPACT_OPTIONS);
  const [availableTeams, setAvailableTeams] = useState<string[]>([]);
  const [teamMemberMap, setTeamMemberMap] = useState<Record<string, string>>({}); // email -> teamName

  useEffect(() => {
    async function loadConfig() {
      const fbConfig = await getProjectConfig();
      if (fbConfig && fbConfig.impactOptions) {
        setImpactOptions(fbConfig.impactOptions);
      }
    }
    loadConfig();
  }, []);
  
  const [showAnuladas, setShowAnuladas] = useState(false);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria[]>([{ field: 'title', order: 'asc' }]);
  const [fieldSettings, setFieldSettings] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    async function loadConfig() {
      const fbConfig = await getProjectConfig();
      if (fbConfig) {
        if (fbConfig.impactOptions) {
          setImpactOptions(fbConfig.impactOptions);
        }
        if (fbConfig.teams) {
          setAvailableTeams(fbConfig.teams);
        }
        
        let visibility = fbConfig.fieldVisibility || {};
        const userPosition = (user as any)?.position;
        if (userPosition && fbConfig.roleOverrides?.[userPosition]?.fieldVisibility) {
          visibility = fbConfig.roleOverrides[userPosition].fieldVisibility!;
        } else if (userPosition && fbConfig.roleVisibility?.[userPosition]) {
          visibility = fbConfig.roleVisibility[userPosition];
        } else if (fbConfig.roleVisibility?.['GLOBAL']) {
          visibility = fbConfig.roleVisibility['GLOBAL'];
        }
        const fieldArray = Object.entries(visibility).map(([id, visible]) => ({ id, visible }));
        setFieldSettings(fieldArray);
      }
    }
    loadConfig();
  }, [user?.position]);

  const isFieldVisible = (id: string) => {
    if (fieldSettings.length === 0) return true;
    const field = fieldSettings.find(f => f.id === id);
    return field ? field.visible : true;
  };

  useEffect(() => {
    const q = query(collection(db, 'issues'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const issuesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Issue));
      setIssues(issuesData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToTeam((teamData) => {
      const map: Record<string, string> = {};
      teamData.forEach(m => {
        if (m.email && m.team) {
          map[m.email] = m.team;
        }
      });
      setTeamMemberMap(map);
    });
    return () => unsubscribe();
  }, []);

  // Auto-sync active environmental Aprovechamiento report/issue to issues dashboard on mount
  useEffect(() => {
    if (!user) return;

    const syncActiveAprovechamientoReport = async () => {
      try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Fetch reports to find active Aprovechamiento report
        const reportsSnap = await getDocs(collection(db, 'reports'));
        const reportsData = reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        
        const activeReport = reportsData.find(r => {
          if (r.subtype === 'APROVECHAMIENTO' && r.startDate) {
            try {
              const parts = r.startDate.split('-');
              const rYear = parseInt(parts[0], 10);
              const rMonth = parseInt(parts[1], 10) - 1; // 0-indexed month
              return rYear === currentYear && rMonth === currentMonth;
            } catch (e) {
              return false;
            }
          }
          return false;
        });

        if (activeReport) {
          const issueId = 'issue_e_apr_' + activeReport.id;
          let totalAprovechado = 0;
          if (activeReport.logs && Array.isArray(activeReport.logs)) {
            activeReport.logs.forEach((log: any) => {
              if (log.status === 'APROVECHADO') {
                const qty = Number(log.quantity) || 0;
                totalAprovechado += log.unit === 'TON' ? qty * 1000 : qty;
              }
            });
          }

          const issueObj: any = {
            id: issueId,
            code: activeReport.code || `AMB-APR-${Date.now().toString().slice(-4)}`,
            title: `APROVECHAMIENTO: ${activeReport.title}`,
            type: 'Informe Ambiental',
            degreeOfAction: 'control',
            impact: ['Impacto Ambiental Sostenibilidad'],
            description: `CONTROL DE APROVECHAMIENTO RCD Y GESTIÓN DE RESIDUOS:\n\n• Reporte: ${activeReport.code}\n• Material Aprovechado: ${totalAprovechado.toLocaleString('es-ES')} kg\n• Periodo: ${activeReport.startDate || ''} al ${activeReport.endDate || ''}\n• Responsable: ${activeReport.responsibleName || 'ROBERTO GÓMEZ'}\n\nDescripción del Proceso:\n${activeReport.processDescription || 'Sin comentarios.'}`,
            status: 'ACTIVO',
            specialty: 'AMBIENTAL',
            assignedPosition: activeReport.responsiblePosition || 'Director de Obra',
            assignedName: activeReport.responsibleName || 'Roberto Gómez',
            assignedEmail: activeReport.responsibleEmail || 'rgomez@bim.com',
            assignedTeam: 'AMBIENTAL',
            creatorId: user.id || activeReport.creatorId || 'anonymous',
            creatorName: user.name || activeReport.creatorName || 'Gestor Ambiental',
            creatorPosition: user.position || activeReport.creatorPosition || 'Ambiental',
            creatorTeam: 'AMBIENTAL',
            createdAt: activeReport.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            attachments: activeReport.mediaFiles || [],
            dueDate: activeReport.endDate || new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            comments: [],
            reviewers: [],
            reviewerEmails: [],
            locations: activeReport.planMarkedArea ? { units: [], levels: [], spaces: [], x: activeReport.planMarkedArea.x, y: activeReport.planMarkedArea.y } : { units: [], levels: [], spaces: [] },
            fromReport: true,
            reportType: 'ENVIRONMENTAL',
            sourceReportId: activeReport.id
          };

          const docRef = doc(db, 'issues', issueId);
          try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data();
              const updatePayload = {
                title: `APROVECHAMIENTO: ${activeReport.title}`,
                description: `CONTROL DE APROVECHAMIENTO RCD Y GESTIÓN DE RESIDUOS:\n\n• Reporte: ${activeReport.code}\n• Material Aprovechado: ${totalAprovechado.toLocaleString('es-ES')} kg\n• Periodo: ${activeReport.startDate || ''} al ${activeReport.endDate || ''}\n• Responsable: ${activeReport.responsibleName || 'ROBERTO GÓMEZ'}\n\nDescripción del Proceso:\n${activeReport.processDescription || 'Sin comentarios.'}`,
                attachments: activeReport.mediaFiles || [],
                dueDate: activeReport.endDate || new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                locations: activeReport.planMarkedArea ? { units: [], levels: [], spaces: [], x: activeReport.planMarkedArea.x, y: activeReport.planMarkedArea.y } : (data.locations || { units: [], levels: [], spaces: [] }),
                updatedAt: new Date().toISOString(),
                fromReport: true,
                reportType: 'ENVIRONMENTAL',
                sourceReportId: activeReport.id
              };
              await setDoc(docRef, updatePayload, { merge: true });
            } else {
              await setDoc(docRef, issueObj);
            }
          } catch (err) {
            console.error("Error auto-syncing Aprovechamiento report to issues dashboard:", err);
          }
        }
      } catch (err) {
        console.error("Error auto-syncing Aprovechamiento report to issues dashboard:", err);
      }
    };

    syncActiveAprovechamientoReport();
  }, [user]);

  const getEffectiveStatus = (issue: Issue): string => {
    if (issue.status === 'ACUERDO') return 'ACUERDO';
    if (issue.status === 'RESUELTA') return 'RESUELTA';
    if (issue.status === 'REVISION_RESPONSABLE') return 'REVISION_RESPONSABLE';
    if (issue.status === 'RESPONDIDA') return 'RESPONDIDA';
    if (issue.status === 'RECHAZADA') return 'RECHAZADA';
    
    if (issue.dueDate) {
      const dueDate = new Date(issue.dueDate + 'T23:59:59');
      if (isPast(dueDate)) return 'VENCIDA';
    }
    return issue.status || 'ACTIVO';
  };

  const getDueDateColor = (dueDateStr?: string, status?: string) => {
    if (!dueDateStr) return 'text-slate-500';
    if (status === 'ACUERDO') return 'text-blue-400';
    
    const dueDate = new Date(dueDateStr + 'T23:59:59');
    const today = new Date();
    const daysLeft = differenceInDays(dueDate, today);

    if (daysLeft < 0) return 'text-red-500';
    if (daysLeft < 2) return 'text-orange-500';
    return 'text-emerald-500';
  };

  const filteredIssues = issues.filter(issue => {
    // Filter by role
    let isRoleMatch = false;
    const userEmail = user?.email?.toLowerCase();
    
    if (filterRole === 'author') {
       isRoleMatch = issue.creatorId === user?.id || issue.authorEmail?.toLowerCase() === userEmail;
    } else if (filterRole === 'responsible') {
       const userPosUpper = user?.position?.trim().toUpperCase() || '';
       const issuePosUpper = issue.assignedPosition?.trim().toUpperCase() || '';
       const isDirDeObraUser = userPosUpper.includes('DIRECTOR DE OBRA');
       const isDirDeObraIssue = issuePosUpper.includes('DIRECTOR DE OBRA');
       
       isRoleMatch = issue.assignedEmail?.toLowerCase() === userEmail || 
                     issue.redirectedTo?.email?.toLowerCase() === userEmail || 
                     issue.executor?.email?.toLowerCase() === userEmail ||
                     (user?.position && issuePosUpper === userPosUpper) ||
                     (isDirDeObraUser && isDirDeObraIssue);
    } else if (filterRole === 'reviewer') {
       isRoleMatch = issue.reviewerEmails?.some(email => email.toLowerCase() === userEmail);
    } else if (filterRole === 'bim') {
       isRoleMatch = true;
    }
    
    const isBimManager = user?.position?.toUpperCase().includes('BIM');
    const isExplicitAdmin = user?.email?.toLowerCase() === 'imagina3ddesign@gmail.com';
    const isAdminUser = user?.role === 'admin' || isBimManager || isExplicitAdmin;

    if (!isRoleMatch) return false;

    const isAnulada = issue.status === 'ANULADA';
    if (showAnuladas) {
      if (!isAnulada) return false;
      // Only author or admin can see anuladas
      if (issue.creatorId !== user?.id && !isAdminUser) return false;
    } else {
      if (isAnulada) return false;
    }

    const matchesSearch = 
      issue.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (issue.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (issue.code && issue.code.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;

    if (dueDateFilter !== 'all') {
       const today = new Date();
       const issueDate = issue.dueDate ? new Date(issue.dueDate + 'T23:59:59') : null;
       const daysLeft = issueDate ? differenceInDays(issueDate, today) : 999;
       
       if (dueDateFilter === 'overdue') {
         if (!issueDate || !isPast(issueDate)) return false;
       } else if (dueDateFilter === 'today') {
         if (daysLeft !== 0) return false;
       } else if (dueDateFilter === '3days') {
         if (daysLeft < 0 || daysLeft > 3) return false;
       } else if (dueDateFilter === '5days') {
         if (daysLeft < 0 || daysLeft > 5) return false;
       } else if (dueDateFilter === '10days') {
         if (daysLeft < 0 || daysLeft > 10) return false;
       }
    }

    // Filter by advanced options
    if (typeFilter.length > 0 && (!issue.type || !typeFilter.includes(issue.type))) return false;
    
    // IMPACT FILTER: Ensure robust matching for both single string or array format
    if (impactFilter.length > 0) {
      let issueImpacts: string[] = [];
      if (Array.isArray(issue.impact)) {
        issueImpacts = issue.impact.map(i => i.trim().toUpperCase());
      } else if (typeof (issue.impact as any) === 'string') {
        issueImpacts = [(issue.impact as any).trim().toUpperCase()];
      }
      
      const normalizedFilters = impactFilter.map(f => f.trim().toUpperCase());
      // If none of the selected filters match any of the issue's impacts, filter out
      if (!normalizedFilters.some(imp => issueImpacts.includes(imp))) return false;
    }

    if (specialtyFilter.length > 0 && (!issue.specialty || !specialtyFilter.includes(issue.specialty))) return false;
    if (responsibleFilter.length > 0 && !responsibleFilter.includes(issue.assignedName || '')) return false;

    // Filter by location hierarchy
    if (unitFilter.length > 0) {
      const issueUnits = issue.locations?.units || [];
      if (!unitFilter.some(u => issueUnits.includes(u))) return false;
    }
    if (levelFilter.length > 0) {
      const issueLevels = issue.locations?.levels || [];
      if (!levelFilter.some(l => issueLevels.includes(l))) return false;
    }
    if (spaceFilter.length > 0) {
      const issueSpaces = issue.locations?.spaces || [];
      if (!spaceFilter.some(s => issueSpaces.includes(s))) return false;
    }

    // Filter by degree of action
    if (degreeFilter.length > 0 && !degreeFilter.includes(issue.degreeOfAction || '')) {
      return false;
    }

    // Status Filter
    if (statusFilter.length > 0) {
      const effectiveStatus = getEffectiveStatus(issue);
      if (!statusFilter.includes(effectiveStatus)) return false;
    }

    // Team Filter
    if (teamFilter.length > 0) {
      const assigneeTeam = issue.assignedEmail ? teamMemberMap[issue.assignedEmail] : null;
      if (!assigneeTeam || !teamFilter.includes(assigneeTeam)) return false;
    }

    return true;
  });

  const unitOptions = Array.from(new Set(issues.flatMap(i => i.locations?.units || []))).sort();
  const levelOptions = Array.from(new Set(issues.flatMap(i => i.locations?.levels || []))).sort();
  const spaceOptions = Array.from(new Set(issues.flatMap(i => i.locations?.spaces || []))).sort();

  const sortedIssues = [...filteredIssues].sort((a, b) => {
    const degreePriority = { 'inmediata': 3, 'urgente': 2, 'pronta': 1 };

    for (const criteria of sortCriteria) {
      let valA: any = '';
      let valB: any = '';

      if (criteria.field === 'degreeOfAction') {
        valA = degreePriority[a.degreeOfAction as keyof typeof degreePriority] || 0;
        valB = degreePriority[b.degreeOfAction as keyof typeof degreePriority] || 0;
      } else {
        valA = a[criteria.field as keyof Issue] || '';
        valB = b[criteria.field as keyof Issue] || '';
      }

      if (valA < valB) return criteria.order === 'asc' ? -1 : 1;
      if (valA > valB) return criteria.order === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const handleSortClick = (field: SortOption, e: React.MouseEvent) => {
    if (e.ctrlKey) {
      setSortCriteria(prev => {
        const existing = prev.find(p => p.field === field);
        if (existing) {
          return prev.map(p => p.field === field ? { ...p, order: p.order === 'asc' ? 'desc' : 'asc' } : p);
        }
        return [...prev, { field, order: 'desc' }];
      });
    } else {
      const existing = sortCriteria.find(p => p.field === field);
      if (existing && sortCriteria.length === 1) {
        setSortCriteria([{ field, order: existing.order === 'asc' ? 'desc' : 'asc' }]);
      } else {
        setSortCriteria([{ field, order: 'desc' }]);
      }
    }
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#020617] -m-8 p-6 lg:p-10 min-h-[calc(100vh-80px)] transition-colors duration-300">
      <div className="mb-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsFiltersVisible(!isFiltersVisible)}
              className={cn(
                "flex items-center gap-3 px-5 py-3 rounded-2xl border transition-all duration-500 group shadow-sm",
                isFiltersVisible 
                  ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-[#020617] shadow-2xl dark:shadow-white/5" 
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-400 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <Filter className={cn("w-3.5 h-3.5 transition-transform duration-500", isFiltersVisible ? "rotate-180" : "group-hover:scale-110")} />
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">
                {isFiltersVisible ? 'Cerrar Filtros' : 'Filtrar Datos'}
              </span>
              {isFiltersVisible ? <ChevronUp className="w-3 h-3 opacity-40 ml-0.5" /> : <ChevronDown className="w-3 h-3 opacity-40 ml-0.5" />}
            </button>

            {/* Clear All Button - Polished */}
            {(typeFilter.length > 0 || impactFilter.length > 0 || specialtyFilter.length > 0 || responsibleFilter.length > 0 || degreeFilter.length > 0 || dueDateFilter !== 'all' || searchTerm) && (
              <motion.button 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => {
                  setDegreeFilter([]);
                  setDueDateFilter('all');
                  setSearchTerm('');
                  setTypeFilter([]);
                  setImpactFilter([]);
                  setSpecialtyFilter([]);
                  setResponsibleFilter([]);
                  setTeamFilter([]);
                  setStatusFilter(['ACTIVO', 'RESPONDIDA', 'VENCIDA', 'RECHAZADA', 'ACUERDO', 'REVISION_RESPONSABLE']);
                }}
                className="px-5 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2.5 hover:bg-red-500/20 transition-all hover:shadow-2xl hover:shadow-red-500/5 active:scale-95 group"
              >
                <X className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-500" />
                Limpiar Selección
              </motion.button>
            )}
          </div>

          <div className="flex items-center gap-4 text-nowrap">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em]">Registros Encontrados:</span>
            <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
              <span className="text-[11px] font-black text-slate-900 dark:text-white">{sortedIssues.length}</span>
            </div>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isFiltersVisible && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: "auto", opacity: 1, marginBottom: 32 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              className="space-y-8 relative z-30 p-8 lg:p-10 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 shadow-2xl rounded-[2.5rem] transition-colors duration-300"
              id="filters-container"
            >
              <div className="flex flex-wrap items-center gap-10">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2.5 px-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-700" />
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Temporalidad</span>
                  </div>
                  <div className="relative group/due hover:z-[70]">
                    <button className="px-5 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] transition-all border border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center gap-5 shadow-sm min-w-[180px]">
                      <span className="opacity-40">Vence:</span>
                      {dueDateFilter === 'all' ? 'Ver Todos' : 
                      dueDateFilter === 'overdue' ? 'Vencidas' :
                      dueDateFilter === 'today' ? 'Hoy' :
                      `< ${dueDateFilter.replace('days', '')} Días`}
                      <ChevronDown className="w-3.5 h-3.5 ml-auto opacity-30" />
                    </button>
                    <div className="absolute top-full left-0 pt-2 w-60 opacity-0 invisible group-hover/due:opacity-100 group-hover/due:visible transition-all z-[60]">
                      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl shadow-2xl p-2.5">
                        {[
                          { id: 'all', label: 'Todos' },
                          { id: 'overdue', label: 'Vencidas' },
                          { id: 'today', label: 'Hoy' },
                          { id: '3days', label: '< 3 Días' },
                          { id: '5days', label: '< 5 Días' },
                          { id: '10days', label: '< 10 Días' }
                        ].map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => setDueDateFilter(opt.id)}
                            className={cn(
                              "w-full text-left px-4.5 py-3 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                              dueDateFilter === opt.id ? "bg-slate-900 dark:bg-white text-white dark:text-[#020617]" : "text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2.5 px-1.5">
                    <Zap className="w-3.5 h-3.5 text-slate-700" />
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Criterio de Acción</span>
                  </div>
                  <div className="flex gap-2.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    {['inmediata', 'urgente', 'pronta'].map(degree => (
                      <button
                        key={degree}
                        onClick={(e) => {
                          if (e.ctrlKey) {
                            setDegreeFilter(prev => prev.includes(degree) ? prev.filter(d => d !== degree) : [...prev, degree]);
                          } else {
                            setDegreeFilter(prev => prev.length === 1 && prev[0] === degree ? [] : [degree]);
                          }
                        }}
                        className={cn(
                          "px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-[0.1em] transition-all border",
                          degreeFilter.includes(degree)
                            ? "bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900 shadow-xl" 
                            : "bg-transparent border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
                        )}
                      >
                        {degree}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2.5 px-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-700" />
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Estado de Respuesta</span>
                  </div>
                  <div className="flex flex-wrap gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    {['ACTIVO', 'RESPONDIDA', 'RESUELTA', 'RECHAZADA', 'ACUERDO', 'REVISION_RESPONSABLE', 'VENCIDA'].map(status => (
                      <button
                        key={status}
                        onClick={(e) => {
                          if (e.ctrlKey) {
                            setStatusFilter(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
                          } else {
                            setStatusFilter(prev => prev.includes(status) && prev.length === 1 ? [] : [status]);
                          }
                        }}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-[0.1em] transition-all border",
                          statusFilter.includes(status)
                            ? "bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900 shadow-xl" 
                            : "bg-transparent border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
                        )}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-8 pt-8 border-t border-slate-200 dark:border-slate-900">
                <div className="relative flex-1">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 dark:text-slate-700" />
                  <input
                    type="text"
                    placeholder="Búsqueda estratégica..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-14 pr-6 py-4 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-900 rounded-2xl text-[13px] text-slate-900 dark:text-white font-semibold focus:outline-none focus:border-slate-400 dark:focus:border-slate-700 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-700 shadow-sm"
                  />
                </div>
                
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 px-1">
                    <SortDesc className="w-3.5 h-3.5 text-slate-700" />
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Ordenamiento</span>
                  </div>
                  <div className="flex gap-2.5">
                    {[
                      { id: 'dueDate', label: 'Vencimiento' },
                      { id: 'createdAt', label: 'F. Creación' }
                    ].map(opt => {
                      const active = sortCriteria.find(p => p.field === opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={(e) => handleSortClick(opt.id as any, e)}
                          className={cn(
                            "px-5 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                            active
                              ? "bg-slate-900 dark:bg-white text-white dark:text-[#020617] border-slate-900 dark:border-white shadow-xl dark:shadow-white/5" 
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:border-slate-400 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white"
                          )}
                        >
                          {opt.label}
                          {active && (active.order === 'asc' ? ' ↑' : ' ↓')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Advanced Filters Row */}
              <div className="flex flex-wrap items-center gap-6 pt-8 border-t border-slate-900">
                <div className="flex items-center gap-2.5 px-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-700" />
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Segmentación Avanzada</span>
                </div>
                
                <div className="flex flex-wrap gap-3">
                  <FilterSelect 
                    label="Categoría" 
                    options={Array.from(new Set(issues.map(i => i.type).filter(Boolean))).sort()} 
                    selected={typeFilter} 
                    onChange={setTypeFilter} 
                  />
                  <FilterSelect 
                    label="Afectación" 
                    options={[...impactOptions].sort()} 
                    selected={impactFilter} 
                    onChange={setImpactFilter} 
                  />
                  <FilterSelect 
                    label="Especialidad" 
                    options={Array.from(new Set(issues.map(i => i.specialty).filter(Boolean))).sort()} 
                    selected={specialtyFilter} 
                    onChange={setSpecialtyFilter} 
                  />
                  <FilterSelect 
                    label="Responsable" 
                    options={Array.from(new Set(issues.map(i => i.assignedName).filter(Boolean))).sort()} 
                    selected={responsibleFilter} 
                    onChange={setResponsibleFilter} 
                  />
                  <FilterSelect 
                    label="Equipo" 
                    options={[...availableTeams].sort()} 
                    selected={teamFilter} 
                    onChange={setTeamFilter} 
                  />
                  <FilterSelect 
                    label="Unidad" 
                    options={unitOptions} 
                    selected={unitFilter} 
                    onChange={setUnitFilter} 
                  />
                  <FilterSelect 
                    label="Nivel" 
                    options={levelOptions} 
                    selected={levelFilter} 
                    onChange={setLevelFilter} 
                  />
                  <FilterSelect 
                    label="Espacio" 
                    options={spaceOptions} 
                    selected={spaceFilter} 
                    onChange={setSpaceFilter} 
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 space-y-4 overflow-auto pr-2 custom-scrollbar">
        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-white"></div>
          </div>
        ) : sortedIssues.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-950 p-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-900 rounded-3xl transition-colors duration-300">
            <ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-800 mx-auto mb-4" />
            <h3 className="text-slate-500 dark:text-slate-600 font-display font-black uppercase tracking-[0.2em] text-[10px]">No hay incidencias</h3>
            <p className="text-slate-400 dark:text-slate-600 text-[10px] mt-2">No se encontraron incidencias para mostrar.</p>
          </div>
        ) : (
          sortedIssues.map((issue) => {
            const isSSTIssue = issue.specialty === 'SST' || 
                              (issue.type && issue.type.toUpperCase().includes('SST')) ||
                              (issue.code && issue.code.toUpperCase().startsWith('SST'));

            const isEnvironmental = issue.specialty === 'AMBIENTAL' || 
                                    issue.type === 'Informe Ambiental' ||
                                    issue.type === 'No Conformidad Ambiental' ||
                                    (issue.type && issue.type.toLowerCase().includes('ambiental')) ||
                                    issue.reportType === 'ENVIRONMENTAL';

            return (
            <motion.div
              key={issue.id}
              layout
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-4 cursor-pointer transition-all hover:scale-[1.002] hover:shadow-lg group relative border rounded-xl transition-colors duration-200",
                expandedId === issue.id 
                  ? "bg-white dark:bg-[#0a0a0a] border-slate-300 dark:border-slate-700 shadow-lg" 
                  : "bg-white dark:bg-[#050505] border-slate-200 dark:border-[#1a1a1a] hover:border-slate-300 dark:hover:border-slate-800",
                isEnvironmental && "border-emerald-500/30 bg-emerald-500/[0.02] dark:bg-emerald-950/[0.05] hover:border-emerald-500/50 shadow-emerald-500/[0.01]"
              )}
              onClick={(e) => {
                toggleExpand(issue.id, e);
                onSelectIssue(issue);
              }}
            >
              <div className="flex items-center justify-between mb-5">
                 <div className="flex items-center gap-3">
                    <div className={cn(
                      "px-2.5 py-1 rounded-lg shadow-lg",
                      isEnvironmental ? "bg-emerald-600 text-white" : "bg-slate-900 dark:bg-white"
                    )}>
                      <span className={cn(
                        "text-[9px] font-black font-mono tracking-widest uppercase",
                        isEnvironmental ? "text-white" : "text-white dark:text-[#020617]"
                      )}>
                        {issue.code || `#${issue.id.slice(0, 4)}`}
                      </span>
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-xl text-[8px] font-black uppercase tracking-[0.15em] border shadow-sm",
                      getEffectiveStatus(issue) === 'VENCIDA' ? "bg-rose-500/10 border-rose-500/20 text-rose-600" :
                      getEffectiveStatus(issue) === 'ACUERDO' ? "bg-violet-500/10 border-violet-500/20 text-violet-600" :
                      getEffectiveStatus(issue) === 'REVISION_RESPONSABLE' ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-600" :
                      getEffectiveStatus(issue) === 'RESPONDIDA' ? "bg-amber-500/10 border-amber-500/20 text-amber-600" :
                      getEffectiveStatus(issue) === 'RESUELTA' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" :
                      getEffectiveStatus(issue) === 'ACTIVO' ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-600" :
                      getEffectiveStatus(issue) === 'RECHAZADA' ? "bg-red-500/10 border-red-500/20 text-red-600" :
                      "bg-slate-500/10 border-slate-500/20 text-slate-400"
                    )}>
                      {getEffectiveStatus(issue)}
                    </div>
                    {issue.fromReport && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenReport && issue.sourceReportId && onOpenReport(issue.sourceReportId);
                        }}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all border shadow-xl active:scale-95 group/badge",
                          isEnvironmental
                            ? "bg-emerald-600 hover:bg-emerald-500 border-emerald-400/50 shadow-emerald-500/30 text-white"
                            : "bg-indigo-600 hover:bg-indigo-500 border-indigo-400/50 shadow-indigo-600/30 text-white"
                        )}
                        title={isEnvironmental ? "Ir al Informe Ambiental" : "Ir al Informe de Obra"}
                      >
                        <ClipboardList className="w-2.5 h-2.5 text-white" />
                        <span className="text-[7.5px] font-black text-white uppercase tracking-widest leading-none">
                          {isEnvironmental ? 'INF. AMBIENTAL' : 'VIENE DE INFORME'}
                        </span>
                      </button>
                    )}

                    {/* Follow-up State and Highlights for closed Quality issues */}
                    {issue.status === 'RESUELTA' && issue.reportType === 'QUALITY' && (() => {
                      const isMedAlert = isMedicionAlertActive(issue);
                      const isEfiAlert = isEficaciaAlertActive(issue);
                      const medComp = !!issue.medicionInicial?.completed;
                      const efiComp = !!issue.revisionEficacia?.completed;

                      if (isMedAlert) {
                        return (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-500 text-white rounded-lg shadow-md animate-pulse">
                            <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                            <span className="text-[7.5px] font-black uppercase tracking-widest leading-none">ALERTA MEDICIÓN INICIAL</span>
                          </div>
                        );
                      }
                      if (isEfiAlert) {
                        return (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-500 text-white rounded-lg shadow-md animate-pulse">
                            <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                            <span className="text-[7.5px] font-black uppercase tracking-widest leading-none">ALERTA REVISIÓN EFICACIA</span>
                          </div>
                        );
                      }
                      if (!medComp) {
                        return (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 text-amber-650 border border-amber-500/20 rounded-lg shadow-sm">
                            <Clock className="w-2.5 h-2.5 shrink-0" />
                            <span className="text-[7.5px] font-black uppercase tracking-widest leading-none">SEG. MEDICIÓN PENDIENTE</span>
                          </div>
                        );
                      }
                      if (!efiComp) {
                        return (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 text-amber-650 border border-amber-500/20 rounded-lg shadow-sm">
                            <Clock className="w-2.5 h-2.5 shrink-0" />
                            <span className="text-[7.5px] font-black uppercase tracking-widest leading-none">SEG. EFICACIA PENDIENTE</span>
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 rounded-lg shadow-sm">
                          <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                          <span className="text-[7.5px] font-black uppercase tracking-widest leading-none">SEGUIMIENTOS OK</span>
                        </div>
                      );
                    })()}
                 </div>
                 <div className="flex items-center gap-3">
                   {isFieldVisible('type') && (
                     <div className="px-2 py-1 bg-white border border-slate-100 dark:border-white text-[#020617] text-[7px] font-black uppercase tracking-widest rounded-lg shadow-sm">
                       {issue.type}
                     </div>
                   )}
                   {isFieldVisible('degreeOfAction') && issue.degreeOfAction && (
                     <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 transition-colors">
                        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: (DEGREE_OF_ACTION as any)[issue.degreeOfAction]?.color }} />
                        <span className="text-[8px] font-black uppercase tracking-[0.1em]" style={{ color: (DEGREE_OF_ACTION as any)[issue.degreeOfAction]?.color }}>
                           {issue.degreeOfAction}
                        </span>
                     </div>
                   )}
                   {expandedId === issue.id ? <ChevronUp className="w-4.5 h-4.5 text-white" /> : <ChevronDown className="w-4.5 h-4.5 text-slate-700 group-hover:text-slate-400 transition-colors" />}
                 </div>
              </div>

              <h3 className="text-xs font-display font-black text-slate-900 dark:text-white tracking-tight leading-snug uppercase group-hover:translate-x-1 transition-transform">{issue.title}</h3>
              
              <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/50">
                 <div className="flex items-center gap-6">
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                          <User className="w-3 h-3" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest leading-none">
                            {issue.assignedName || '-' }
                          </span>
                          <span className="text-[7px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest mt-1">Responsable Original</span>
                          {((issue.assignedEmail && teamMemberMap[issue.assignedEmail]) || issue.assignedTeam) && (
                            <span className="text-[7.5px] text-indigo-500 dark:text-indigo-400 font-black uppercase tracking-wider mt-1">
                              Proceso Auditado: {(issue.assignedEmail && teamMemberMap[issue.assignedEmail]) || issue.assignedTeam}
                            </span>
                          )}
                        </div>
                      </div>

                      {issue.redirectedTo && (
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg bg-amber-500/10 dark:bg-amber-500/5 flex items-center justify-center text-amber-500">
                            <ArrowRight className="w-3 h-3" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest leading-none">
                              {issue.redirectedTo.name}
                            </span>
                            <span className="text-[7px] text-amber-400 dark:text-amber-700 font-bold uppercase tracking-widest mt-1">COLABORADOR</span>
                          </div>
                        </div>
                      )}

                      {issue.executor && (
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/5 flex items-center justify-center text-indigo-500">
                            <ShieldCheck className="w-3 h-3" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest leading-none">
                              {issue.executor.name}
                            </span>
                            <span className="text-[7px] text-indigo-400 dark:text-indigo-800 font-bold uppercase tracking-widest mt-1">Ejecutor</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5">
                       <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                         <Clock className="w-3 h-3" />
                       </div>
                       <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                         {format(new Date(issue.updatedAt), 'dd/MM HH:mm')}
                       </span>
                    </div>
                    {issue.dueDate && isFieldVisible('dueDate') && (
                      <div className="flex items-center gap-2.5">
                         <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center", getDueDateColor(issue.dueDate, issue.status).replace('text-', 'bg-').replace('-500', '-500/10'))}>
                            <AlertCircle className={cn("w-3 h-3", getDueDateColor(issue.dueDate, issue.status))} />
                         </div>
                         <span className={cn("text-[9px] font-black uppercase tracking-[0.05em]", getDueDateColor(issue.dueDate, issue.status))}>
                           Vence {format(new Date(issue.dueDate + 'T00:00:00'), 'dd/MM/yy')}
                         </span>
                      </div>
                    )}
                 </div>
                 <div className="flex -space-x-1.5">
                    {isFieldVisible('reviewers') && issue.reviewers?.slice(0, 3).map((rev, i) => (
                      <div key={i} className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 border-[1.5px] border-white dark:border-slate-950 flex items-center justify-center text-[9px] font-black text-slate-400 dark:text-slate-500 shadow-sm">
                        {rev.charAt(0)}
                      </div>
                    ))}
                 </div>
              </div>

              <AnimatePresence>
                {expandedId === issue.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-800 space-y-8">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-8 space-y-8">
                          <div className="bg-white dark:bg-slate-900/50 p-5 lg:p-6 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 relative overflow-hidden transition-colors duration-300">
                            {/* FICHA TÉCNICA SST - PROMINENT IN DASHBOARD SUMMARY */}
                            {isSSTIssue && (
                              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-6 mb-8 shadow-sm">
                                 <div className="flex items-center gap-3 mb-6 border-b border-emerald-500/10 pb-3">
                                   <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                   <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Ficha de Caracterización SST</h4>
                                 </div>
                                 
                                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                   <div>
                                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Especialidad</p>
                                      <p className="text-[10px] font-black text-emerald-400 uppercase">{issue.specialty || "SST"}</p>
                                   </div>
                                   <div>
                                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Mes Ejecución</p>
                                      <p className="text-[10px] font-bold text-white uppercase">{issue.month || "N/R"}</p>
                                   </div>
                                   <div>
                                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Actividad Económica</p>
                                      <p className="text-[10px] font-bold text-white uppercase truncate">{issue.economicActivity || "N/R"}</p>
                                   </div>
                                   <div>
                                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Clase Registro</p>
                                      <p className="text-[10px] font-bold text-blue-400 uppercase">{issue.issueClass ? `CLASE ${issue.issueClass}` : "ESTÁNDAR"}</p>
                                   </div>
                                   <div className="col-span-2 md:col-span-1">
                                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Factor de Peligro</p>
                                      <p className="text-[10px] font-black text-red-500 uppercase truncate">{issue.danger || "SIN CLASIFICACIÓN"}</p>
                                   </div>
                                 </div>

                                 <div className="mt-4 p-4 bg-slate-950/50 rounded-xl border border-slate-800">
                                    <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest mb-1">Empresa Corresponsable</p>
                                    <p className="text-[10px] font-bold text-white uppercase truncate">{issue.responsibleCompany || "SIN ASIGNAR"}</p>
                                 </div>

                                 {issue.dangerDescription && (
                                   <div className="mt-4 pt-4 border-t border-emerald-500/10">
                                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Criterio de Riesgo / Detalle de Peligro</p>
                                      <p className="text-[10px] text-slate-400 font-bold italic leading-relaxed">{issue.dangerDescription}</p>
                                   </div>
                                 )}

                                 {/* Site Report Link in expanded summary */}
                                 {issue.fromReport && (
                                   <div className="mt-6 pt-6 border-t border-indigo-500/20 bg-indigo-500/5 -mx-6 -mb-6 p-6 rounded-b-2xl">
                                      <div className="flex items-center justify-between gap-4">
                                         <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                                               <ClipboardList className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                               <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Originado en Informe de Obra</p>
                                               <p className="text-[11px] font-black text-white uppercase truncate max-w-[200px]">{issue.sourceReportTitle || 'Informe de Obra'}</p>
                                            </div>
                                         </div>
                                         {issue.sourceReportId && onOpenReport && (
                                            <button 
                                              onClick={() => onOpenReport(issue.sourceReportId!)}
                                              className="px-5 py-3 bg-white text-[#020617] rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-100 transition-all shadow-xl active:scale-95"
                                            >
                                               Ir al Informe <ExternalLink className="w-3 h-3" />
                                            </button>
                                         )}
                                      </div>
                                   </div>
                                 )}
                              </div>
                            )}

                            {/* FICHA TÉCNICA AMBIENTAL - PROMINENT IN DASHBOARD SUMMARY */}
                            {isEnvironmental && (
                              <div className="bg-emerald-500/[0.04] border border-emerald-500/20 rounded-2xl p-6 mb-8 shadow-sm">
                                 <div className="flex items-center gap-3 mb-6 border-b border-emerald-500/10 pb-3">
                                   <Leaf className="w-5 h-5 text-emerald-500" />
                                   <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Ficha de Caracterización Ambiental</h4>
                                 </div>
                                 
                                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                   <div>
                                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Especialidad</p>
                                      <p className="text-[10px] font-black text-emerald-400 uppercase">AMBIENTAL</p>
                                   </div>
                                   <div>
                                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Sello Verde</p>
                                      <p className="text-[10px] font-bold text-white uppercase">A+</p>
                                   </div>
                                   <div>
                                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Tipo de Reporte</p>
                                      <p className="text-[10px] font-bold text-white uppercase truncate">{issue.type || "INFORME AMBIENTAL"}</p>
                                   </div>
                                   <div>
                                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Impactos Evaluados</p>
                                      <p className="text-[10px] font-bold text-emerald-450 uppercase">SOSTENIBILIDAD RCD</p>
                                   </div>
                                 </div>

                                 {/* Display acopio results if filled */}
                                 {issue.acopioLargo !== undefined && Number(issue.acopioLargo) > 0 && (
                                   <div className="mt-6 pt-6 border-t border-emerald-500/10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                     <div className="p-4 bg-emerald-500/[0.02]/5 border border-emerald-500/10 rounded-xl">
                                       <span className="block text-[7px] font-black text-slate-400 uppercase tracking-widest">Área Final Recuperada</span>
                                       <span className="text-sm font-sans font-black text-emerald-450">{(issue.acopioAreaRecuperada || 0).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²</span>
                                     </div>
                                     <div className="p-4 bg-emerald-500/[0.02]/5 border border-emerald-500/10 rounded-xl">
                                       <span className="block text-[7px] font-black text-slate-400 uppercase tracking-widest">Volumen Total Reutilizado</span>
                                       <span className="text-sm font-sans font-black text-emerald-400">{(issue.acopioVolumen || 0).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³</span>
                                     </div>
                                   </div>
                                 )}

                                 {/* Site Report Link in expanded summary */}
                                 {issue.fromReport && (
                                   <div className="mt-6 pt-6 border-t border-emerald-500/20 bg-emerald-500/5 -mx-6 -mb-6 p-6 rounded-b-2xl">
                                      <div className="flex items-center justify-between gap-4">
                                         <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
                                               <ClipboardList className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                               <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-1">Originado en Gestión Ambiental</p>
                                               <p className="text-[11px] font-black text-white uppercase truncate max-w-[200px]">{issue.title || 'Control de Acopio'}</p>
                                            </div>
                                         </div>
                                         {issue.sourceReportId && onOpenReport && (
                                            <button 
                                              onClick={() => onOpenReport(issue.sourceReportId!)}
                                              className="px-5 py-3 bg-emerald-600 text-white hover:bg-emerald-500 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-xl active:scale-95 border border-emerald-500/30"
                                            >
                                               Ver Planilla Ambiental <ExternalLink className="w-3 h-3" />
                                            </button>
                                         )}
                                      </div>
                                   </div>
                                 )}
                              </div>
                            )}

                            <h4 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 px-1">Descripción Técnica Detallada</h4>
                            <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                              {issue.description || 'Sin descripción detallada.'}
                            </p>
                            {issue.status === 'RECHAZADA' && issue.rejectionReason && (
                              <div className="mt-6 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
                                <h5 className="text-[9px] font-black text-red-400 uppercase tracking-[0.1em] mb-2 flex items-center gap-2">
                                  <AlertCircle className="w-3 h-3" /> Sustentación de Rechazo
                                </h5>
                                <p className="text-[12px] text-red-500/80 font-medium italic">{issue.rejectionReason}</p>
                              </div>
                            )}
                            <div className="mt-8 flex flex-col gap-3">
                               {issue.locations && (issue.locations.units.length > 0 || issue.locations.levels.length > 0 || issue.locations.spaces.length > 0) && (
                                  <div className="mt-2 mb-4 p-5 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors duration-300">
                                     <h4 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 px-1">
                                       <MapPin className="w-3 h-3 text-emerald-500" /> Ubicación Jerárquica
                                     </h4>
                                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                       <div className="space-y-1.5">
                                         <p className="text-[7px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest pl-0.5">Unidad</p>
                                         <div className="flex flex-wrap gap-1.5">
                                           {issue.locations.units.length > 0 ? issue.locations.units.map((u, idx) => (
                                             <span key={`${u}-${idx}`} className="px-2 py-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[8px] font-black rounded-lg border border-slate-200 dark:border-slate-700 uppercase">{u}</span>
                                           )) : <span className="text-[8px] text-slate-300 dark:text-slate-700 italic">N/A</span>}
                                         </div>
                                       </div>
                                       <div className="space-y-1.5">
                                         <p className="text-[7px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest pl-0.5">Nivel</p>
                                         <div className="flex flex-wrap gap-1.5">
                                           {issue.locations.levels.length > 0 ? issue.locations.levels.map((l, idx) => (
                                             <span key={`${l}-${idx}`} className="px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-black rounded-lg border border-emerald-500/10 uppercase">{l}</span>
                                           )) : <span className="text-[8px] text-slate-300 dark:text-slate-700 italic">N/A</span>}
                                         </div>
                                       </div>
                                       <div className="space-y-1.5">
                                         <p className="text-[7px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest pl-0.5">Espacio</p>
                                         <div className="flex flex-wrap gap-1.5">
                                           {issue.locations.spaces.length > 0 ? issue.locations.spaces.map((s, idx) => (
                                             <span key={`${s}-${idx}`} className="px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[8px] font-black rounded-lg border border-blue-500/10 uppercase">{s}</span>
                                           )) : <span className="text-[8px] text-slate-300 dark:text-slate-700 italic">N/A</span>}
                                         </div>
                                       </div>
                                     </div>
                                  </div>
                               )}

                               {/* ACCIÓN CORRECTIVA / PLAN DE ACCIÓN */}
                               <div className="mt-2 mb-6 p-6 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 border-dashed rounded-2xl shadow-inner font-sans">
                                  <h4 className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 px-1">
                                    <Zap className="w-3 h-3 text-indigo-500" /> ACCIÓN CORRECTIVA SUGERIDA
                                  </h4>
                                  <p className="text-[12px] text-slate-800 dark:text-slate-350 font-bold italic leading-relaxed pl-1 font-sans">
                                    {issue.proposedActionPlan || 'No se registró acción correctiva específica.'}
                                  </p>
                               </div>

                               <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 mb-1">Gestión de Acciones</h4>
                               <StatusManager issue={issue} isBimPanel={filterRole === 'bim'} />
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 pt-6 border-t border-slate-200 dark:border-slate-800/50">
                               {isFieldVisible('impact') && (
                                 <div>
                                    <h4 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 px-1">
                                      <ShieldCheck className="w-3 h-3 text-slate-300 dark:text-slate-700" /> Afectación del Proyecto
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                      {issue.impact?.map((imp, idx) => (
                                        <span key={`${imp}-${idx}`} className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[8px] font-black rounded-lg uppercase tracking-wider shadow-sm transition-colors duration-300">
                                          {imp}
                                        </span>
                                      ))}
                                      {(!issue.impact || issue.impact.length === 0) && <span className="text-[9px] text-slate-400 dark:text-slate-600 italic px-1">No registradas</span>}
                                    </div>
                                 </div>
                               )}
                               <div>
                                  <h4 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 px-1">
                                    <Paperclip className="w-3 h-3 text-slate-300 dark:text-slate-700" /> Documentación
                                  </h4>
                                  <div className="space-y-2.5">
                                    {issue.attachments?.map((att, idx) => (
                                      <a key={`${att.id || att.name || idx}-${idx}`} href={att.url} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-slate-400 dark:hover:border-slate-700 group transition-all shadow-sm">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-400 dark:text-slate-600 shrink-0">
                                            {att.type.includes('image') ? <ImageIcon className="w-3.5 h-3.5" /> : <FileIcon className="w-3.5 h-3.5" />}
                                          </div>
                                          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-semibold group-hover:text-slate-900 dark:group-hover:text-white transition-colors uppercase tracking-tight">{att.name}</span>
                                        </div>
                                        <ExternalLink className="w-3 h-3 text-slate-300 dark:text-slate-700 group-hover:text-slate-900 dark:group-hover:text-white" />
                                      </a>
                                    ))}
                                    {(!issue.attachments || issue.attachments.length === 0) && <p className="text-[9px] text-slate-400 dark:text-slate-600 italic px-1">Sin archivos vinculados</p>}
                                  </div>
                               </div>
                            </div>
                         </div>
                       </div>
                    </div>

                        <div className="lg:col-span-4 space-y-6">
                           <div className="bg-slate-100/50 dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 transition-colors duration-300">
                             <h4 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                               <User className="w-3 h-3 text-slate-300 dark:text-slate-700" /> EQUIPOS DE RESPONSABLES
                             </h4>
                             <div className="space-y-5">
                                <div>
                                  <p className="text-[8px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-3">Autor del Hallazgo</p>
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/5 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-[13px] font-black border border-emerald-500/20 shadow-sm uppercase">
                                      {issue.creatorName?.charAt(0) || 'A'}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tightest">{issue.creatorPosition || 'General'}</span>
                                      <span className="text-[9px] text-slate-500 font-bold uppercase">{issue.creatorName || 'Auditor Log'}</span>
                                    </div>
                                  </div>
                                </div>
                                {isFieldVisible('assignedPosition') && (
                                  <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
                                    <div>
                                      <p className="text-[8px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-3">RESPONSABLE INICIAL / DIRECTOR</p>
                                      <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-slate-800 flex items-center justify-center text-white text-[13px] font-black border border-slate-700 shadow-sm uppercase shadow-black/20 dark:shadow-none">
                                          {issue.assignedName?.charAt(0) || '?'}
                                        </div>
                                        <div className="flex flex-col">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tightest">{issue.assignedPosition || '-'}</span>
                                            {(issue.principalApproved || issue.status === 'RESPONDIDA') && (
                                              <CheckCircle2 className="w-3 h-3 text-emerald-500" strokeWidth={3} />
                                            )}
                                          </div>
                                          <span className="text-[9px] text-slate-500 font-bold uppercase">{issue.assignedName || '-' }</span>
                                        </div>
                                      </div>
                                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/40 flex items-center justify-between col-span-full">
                                        <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider">Proceso Auditado</span>
                                        <span className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase bg-indigo-500/10 px-2 py-0.5 rounded tracking-wider">
                                          {(issue.assignedEmail && teamMemberMap[issue.assignedEmail]) || issue.assignedTeam || 'SIN ESPECIFICAR'}
                                        </span>
                                      </div>
                                    </div>

                                    {issue.redirectedTo && (
                                      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                                        <p className="text-[8px] font-bold text-amber-500 uppercase tracking-widest mb-3">COLABORADOR</p>
                                        <div className="flex items-center gap-3">
                                          <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white text-[13px] font-black shadow-lg shadow-amber-500/20 uppercase">
                                            {issue.redirectedTo.name.charAt(0)}
                                          </div>
                                          <div className="flex flex-col text-left overflow-hidden">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase truncate">{issue.redirectedTo.name}</span>
                                              {issue.collaboratorApproved && (
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" strokeWidth={3} />
                                              )}
                                            </div>
                                            <span className="text-[7.5px] text-amber-400/80 font-bold uppercase truncate">{issue.redirectedTo.position}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Executor Section */}
                                    {issue.executor && (
                                      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                                        <p className="text-[8px] font-bold text-indigo-500/60 uppercase tracking-widest mb-3">RESPONSABLE EJECUTOR</p>
                                        <div className="flex items-center gap-3">
                                          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/5 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-[13px] font-black border border-indigo-500/20 shadow-sm uppercase">
                                            {issue.executor.name.charAt(0)}
                                          </div>
                                          <div className="flex flex-col text-left overflow-hidden">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase truncate">{issue.executor.name}</span>
                                              {issue.executor.approved && (
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" strokeWidth={3} />
                                              )}
                                            </div>
                                            <span className="text-[7.5px] text-indigo-400/80 font-bold uppercase truncate">{issue.executor.position}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {isFieldVisible('reviewers') && (
                                  <div className="pt-5 border-t border-slate-200 dark:border-slate-800">
                                     <p className="text-[7px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] mb-3">COMITÉ DE REVISIÓN</p>
                                    
                                    <div className="flex flex-wrap gap-2">
                                      {issue.reviewers?.map((rev, idx) => (
                                        <span key={`${rev}-${idx}`} className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tight shadow-sm transition-colors duration-300">
                                          {rev}
                                        </span>
                                      ))}
                                      {(!issue.reviewers || issue.reviewers.length === 0) && (
                                        <span className="text-[9px] text-slate-400 dark:text-slate-600 italic">Sin revisores</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        </div>
                      </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
          })
        )}
      </div>
    </div>
  );
}

function FilterSelect({ label, options, selected, onChange }: { label: string, options: string[], selected: string[], onChange: (vals: string[]) => void }) {
  return (
    <div className="relative group/filter hover:z-[70]">
      <button className={cn(
        "px-4 py-2.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all border flex items-center gap-3 shadow-sm",
        selected.length > 0 
          ? "bg-slate-900 dark:bg-white text-white dark:text-[#020617] border-slate-900 dark:border-white shadow-lg shadow-slate-900/20" 
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white"
      )}>
        <span className="opacity-60">{label}:</span> 
        <span className="font-black">{selected.length > 0 ? `${selected.length}` : 'TODOS'}</span>
        <ChevronDown className="w-2.5 h-2.5 opacity-40 ml-0.5" />
      </button>
      <div className="absolute top-full left-0 pt-2 w-60 opacity-0 invisible group-hover/filter:opacity-100 group-hover/filter:visible transition-all z-[60]">
        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl shadow-2xl p-2.5 max-h-72 overflow-auto custom-scrollbar transition-colors duration-300">
          <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 px-3 border-b border-slate-100 dark:border-slate-900 pb-2">{label}</p>
          <div className="space-y-0.5">
            {options.sort().map(opt => (
              <button
                key={opt}
                onClick={() => {
                  if (selected.includes(opt)) onChange(selected.filter(s => s !== opt));
                  else onChange([...selected, opt]);
                }}
                className={cn(
                  "w-full text-left px-4 py-2.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-between group/opt transition-all",
                  selected.includes(opt) 
                    ? "bg-slate-900 dark:bg-white text-white dark:text-[#020617]" 
                    : "text-slate-500 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <span className="truncate">{opt}</span>
                {selected.includes(opt) && <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-[#020617]" />}
              </button>
            ))}
            {options.length === 0 && <p className="text-[9px] text-slate-300 dark:text-slate-600 italic text-center py-4">Sin opciones</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusManager({ issue, isBimPanel }: { issue: Issue, isBimPanel?: boolean }) {
  const { user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showAgreementPicker, setShowAgreementPicker] = useState(false);
  const [showRejectionPicker, setShowRejectionPicker] = useState(false);
  
  const [agreementDate, setAgreementDate] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const userEmail_lower = user?.email?.toLowerCase();
  const isAuthor = issue.creatorId === user?.id || issue.authorEmail?.toLowerCase() === userEmail_lower;
  const isInitialResponsible = issue.assignedEmail?.toLowerCase() === userEmail_lower || (issue.assignedPosition?.toUpperCase() === user?.position?.toUpperCase() && !!user?.position);
  const isCollaborator = issue.redirectedTo?.email?.toLowerCase() === userEmail_lower;
  const isExecutor = issue.executor?.email?.toLowerCase() === userEmail_lower;
  const isResponsible = isInitialResponsible || isCollaborator || isExecutor;
  const isReviewer = issue.reviewerEmails?.some(email => email.toLowerCase() === userEmail_lower);
  const isExplicitAdmin = user?.email?.toLowerCase() === 'imagina3ddesign@gmail.com';
  const isAdminUser = user?.role === 'admin' || user?.position?.toUpperCase().includes('BIM') || isExplicitAdmin;

  // Approval Chain Logic (DashboardSummary version)
  const hasExecutor = !!issue.executor;
  const executorApproved = issue.executor?.approved === true;
  const hasCollaborator = !!issue.redirectedTo;
  const collaboratorApproved = issue.collaboratorApproved === true;

  const isNextExecutor = hasExecutor && !executorApproved && (isExecutor || isAdminUser);
  const isNextCollaborator = hasCollaborator && !collaboratorApproved && (isCollaborator || isAdminUser) && (!hasExecutor || executorApproved);
  const isNextPrincipal = (isInitialResponsible || isAdminUser) && (!hasExecutor || executorApproved) && (!hasCollaborator || collaboratorApproved) && issue.status !== 'RESPONDIDA' && issue.status !== 'RESUELTA';

  const [showRedirectionPicker, setShowRedirectionPicker] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'team'));
    getDocs(q).then(snapshot => {
      setTeamMembers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TeamMember)));
    });
  }, []);

  const [redirectionType, setRedirectionType] = useState<'COLABORADOR' | 'EJECUTOR' | 'RESPONSABLE'>('COLABORADOR');

  const handleRedirection = async (member: TeamMember) => {
    setIsUpdating(true);
    console.log(`[StatusManager] Redirecting issue ${issue.id} to ${member.email} as ${redirectionType}`);
    try {
      const redirectedData = {
        name: member.name,
        position: member.position,
        email: member.email,
        team: member.team || '',
        at: new Date().toISOString()
      };

      const updateData: any = {
        updatedAt: new Date().toISOString()
      };

      let roleText = 'responsable';
      if (redirectionType === 'COLABORADOR') {
        updateData.redirectedTo = redirectedData;
        roleText = 'colaborador';
        // Also add to reviewers if not already there
        const currentReviewerEmails = issue.reviewerEmails || [];
        if (!currentReviewerEmails.includes(member.email)) {
          updateData.reviewerEmails = [...currentReviewerEmails, member.email];
        }
        
        const currentReviewers = issue.reviewers || [];
        if (!currentReviewers.includes(member.name)) {
          updateData.reviewers = [...currentReviewers, member.name];
        }
      } else if (redirectionType === 'EJECUTOR') {
        updateData.executor = redirectedData;
        roleText = 'segundo responsable (ejecutor)';
      } else {
        // Handle RESPONSABLE redirection
        updateData.assignedName = member.name;
        updateData.assignedPosition = member.position;
        updateData.assignedEmail = member.email;
        updateData.assignedTeam = member.team || '';
        roleText = 'nuevo responsable';
      }

      console.log('[StatusManager] updateDoc payload:', updateData);
      await updateDoc(doc(db, 'issues', issue.id), updateData);

      await addDoc(collection(db, `issues/${issue.id}/comments`), {
        userId: user?.id || 'SYSTEM',
        userName: user?.name || 'SISTEMA',
        text: `Incidencia redirigida a ${member.name} (${member.position}) como ${roleText}.`,
        createdAt: new Date().toISOString()
      });

      setShowRedirectionPicker(false);
    } catch (err) {
      console.error('[StatusManager] Error in handleRedirection:', err);
      alert("Error al redirigir la incidencia. Verifique sus permisos de red y base de datos.");
    } finally {
      setIsUpdating(false);
    }
  };

  const updateStatus = async (status: Issue['status'], extra?: any) => {
    setIsUpdating(true);
    try {
      const updateData: any = { 
        status, 
        updatedAt: new Date().toISOString(),
        ...extra
      };

      if (status === 'RESUELTA') {
        updateData.resolvedAt = new Date().toISOString();
      }

      // Reset approval chain on rejection to enable the process again
      if (status === 'RECHAZADA') {
        if (issue.executor) {
          updateData['executor.approved'] = false;
          updateData['executor.approvedAt'] = null;
        }
        updateData.collaboratorApproved = false;
        updateData.collaboratorApprovedAt = null;
        updateData.principalApproved = false;
        updateData.principalApprovedAt = null;
        
        // Add comment for traceability
        await addDoc(collection(db, `issues/${issue.id}/comments`), {
          userId: user?.id || 'system',
          userName: user?.name || 'SISTEMA',
          text: `RESPUESTA RECHAZADA: ${extra?.rejectionReason || 'No se proporcionó motivo.'}`,
          createdAt: new Date().toISOString()
        });
      }

      await updateDoc(doc(db, 'issues', issue.id), updateData);
      setShowAgreementPicker(false);
      setShowRejectionPicker(false);
    } catch (err) {
      console.error("Status update failed", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePartialResponse = async () => {
    setIsUpdating(true);
    try {
      const updateData: any = {
        updatedAt: new Date().toISOString(),
        status: 'REVISION_RESPONSABLE'
      };

      let actionText = '';
      if (isNextExecutor) {
        updateData['executor.approved'] = true;
        updateData['executor.approvedAt'] = new Date().toISOString();
        actionText = 'EJECUTOR';
      } else if (isNextCollaborator) {
        updateData.collaboratorApproved = true;
        updateData.collaboratorApprovedAt = new Date().toISOString();
        actionText = 'COLABORADOR';
      } else {
        return;
      }

      await updateDoc(doc(db, 'issues', issue.id), updateData);
      
      await addDoc(collection(db, `issues/${issue.id}/comments`), {
        userId: user?.id || 'system',
        userName: user?.name || 'SISTEMA',
        text: `CONFIRMACIÓN DE FASE: Visto Bueno (${actionText}) registrado por ${user?.name}. Se habilita siguiente etapa en la cadena de aprobación.`,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
      alert("Error al confirmar respuesta parcial.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFinalApproval = async () => {
    setIsUpdating(true);
    try {
      const updateData: any = {
        updatedAt: new Date().toISOString(),
        status: 'RESPONDIDA',
        principalApproved: true,
        principalApprovedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'issues', issue.id), updateData);
      
      await addDoc(collection(db, `issues/${issue.id}/comments`), {
        userId: user?.id || 'system',
        userName: user?.name || 'SISTEMA',
        text: `RESPUESTA FINALIZADA: Respuesta técnica definitiva aprobada por el Responsable Inicial (${user?.name}).`,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
      alert("Error al finalizar respuesta técnica.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!showConfirmDelete) {
      setShowConfirmDelete(true);
      return;
    }
    
    setIsUpdating(true);
    try {
      console.log("[StatusManager] Attempting to delete issue:", issue.id);
      await deleteIssue(issue.id);
      console.log("[StatusManager] Issue deleted successfully");
    } catch (error: any) {
      console.error("[StatusManager] Error deleting issue:", error);
      let message = error.message;
      try {
        const parsed = JSON.parse(error.message);
        message = parsed.error || error.message;
      } catch (e) {}
      alert("Error al eliminar la incidencia: " + message);
    } finally {
      setIsUpdating(false);
      setShowConfirmDelete(false);
    }
  };

  const actions: any[] = [];

  if (issue.status === 'ANULADA') {
    if ((isAuthor || isAdminUser) && !isReviewer && !isResponsible) {
      actions.push({ id: 'ACTIVO', label: 'REACTIVAR INCIDENCIA', color: 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/10' });
    }
  } else {
    const canManage = (isAuthor || isAdminUser);

    if (isResponsible) {
      if (isNextExecutor) {
        actions.push({ 
          id: 'PARTIAL_EXEC', 
          label: 'MARCAR RESPUESTA PARCIAL', 
          color: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/10', 
          onClick: handlePartialResponse 
        });
      }
      
      if (isNextCollaborator) {
        actions.push({ 
          id: 'PARTIAL_COLAB', 
          label: 'CONFIRMAR VISTO BUENO (COLABORADOR)', 
          color: 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/10', 
          onClick: handlePartialResponse 
        });
      }

      if (isNextPrincipal) {
        actions.push({ 
          id: 'RESPONDIDA', 
          label: 'FINALIZAR RESPUESTA TÉCNICA', 
          color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/10', 
          onClick: handleFinalApproval 
        });
      }

      // Redirection Management - DEFINITIVELY EXCLUDE EXECUTOR
      if (!isExecutor && !isNextExecutor && (isInitialResponsible || isCollaborator || isAdminUser) && issue.status !== 'RESPONDIDA' && issue.status !== 'RESUELTA') {
        if (isInitialResponsible || isAdminUser) {
          actions.push({ 
            id: 'AGREGAR_COLAB', 
            label: 'AGREGAR COLABORADOR', 
            color: 'bg-slate-800 hover:bg-slate-700 font-black', 
            onClick: () => { setRedirectionType('COLABORADOR'); setShowRedirectionPicker(true); }
          });
          actions.push({ 
            id: 'REDIRIGIR_EXEC', 
            label: 'REDIRIGIR A EJECUTOR', 
            color: 'bg-slate-800 hover:bg-slate-700 font-black', 
            onClick: () => { setRedirectionType('EJECUTOR'); setShowRedirectionPicker(true); }
          });
        } else if (isCollaborator) {
          actions.push({ 
            id: 'REDIRIGIR_EXEC', 
            label: 'REDIRIGIR A EJECUTOR', 
            color: 'bg-slate-800 hover:bg-slate-700 font-black', 
            onClick: () => { setRedirectionType('EJECUTOR'); setShowRedirectionPicker(true); } 
          });
        }
      }
    } else if (canManage) {
      if (!isExecutor) {
        actions.push({ id: 'RESUELTA', label: 'RESUELTA Y CERRADA', color: 'bg-slate-900 hover:bg-black shadow-slate-900/10' });
        actions.push({ id: 'RECHAZADA', label: 'RECHAZAR RESPUESTA', color: 'bg-red-500 hover:bg-red-600 shadow-red-500/10', needsJustification: true });
        actions.push({ id: 'ACUERDO', label: 'ESTABLECER ACUERDO', color: 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/10', shadow: 'shadow-amber-500/20', needsDate: true });
        actions.push({ id: 'ANULADA', label: 'ANULAR INCIDENCIA', color: 'bg-slate-400 hover:bg-slate-500' });
      }
    }
  }

  if (isBimPanel) {
    if (showConfirmDelete) {
      actions.push({ 
        id: 'DELETE_CONFIRM', 
        label: '¿CONFIRMAR ELIMINACIÓN?', 
        color: 'bg-red-700 hover:bg-red-800 shadow-red-700/20',
        onClick: handleDelete,
        icon: Trash2
      });
      actions.push({ 
        id: 'DELETE_CANCEL', 
        label: 'CANCELAR', 
        color: 'bg-slate-800 hover:bg-slate-700',
        onClick: () => setShowConfirmDelete(false),
        icon: X
      });
    } else {
      actions.push({ 
        id: 'DELETE', 
        label: 'ELIMINAR INCIDENCIA (BIM)', 
        color: 'bg-red-600 hover:bg-red-700 shadow-red-600/10',
        onClick: () => setShowConfirmDelete(true),
        icon: Trash2
      });
    }
  }

  if (actions.length === 0) {
    return (
      <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-900 border-dashed transition-colors">
        <p className="text-[9px] text-slate-400 dark:text-slate-600 font-black uppercase tracking-[0.2em] text-center">Permisos de lectura exclusivos para revisores.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        {actions.map(action => (
          <button
            key={action.id}
            disabled={isUpdating || issue.status === action.id}
            onClick={(e) => {
              e.stopPropagation();
              if (action.onClick) action.onClick();
              else if (action.needsDate) setShowAgreementPicker(true);
              else if (action.needsJustification) setShowRejectionPicker(true);
              else if (action.needsRedirection) setShowRedirectionPicker(true);
              else updateStatus(action.id as any);
            }}
            className={cn(
              "px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 text-white shadow-xl",
              action.color,
              action.shadow || "shadow-black/20",
              issue.status === action.id && "ring-4 ring-white/10 opacity-60"
            )}
          >
            {action.label}
          </button>
        ))}
      </div>

      {showAgreementPicker && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-8 bg-white dark:bg-slate-950 border border-amber-500/20 rounded-[2rem] space-y-6 shadow-2xl relative overflow-hidden transition-colors">
          <div className="absolute top-0 right-0 p-4">
             <button onClick={() => setShowAgreementPicker(false)} className="text-slate-400 dark:text-slate-700 hover:text-slate-900 dark:hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div>
            <h5 className="text-lg font-display font-black text-amber-500 mb-2 tracking-tight">Establecer Acuerdo de Entrega</h5>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Selecciona la nueva fecha compromiso. Esta acción es vinculante.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <input 
              type="date"
              value={agreementDate}
              onChange={(e) => setAgreementDate(e.target.value)}
              className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-4 text-[12px] text-slate-900 dark:text-white font-bold focus:border-amber-500/50 outline-none transition-all"
            />
            <button 
              disabled={!agreementDate}
              onClick={() => updateStatus('ACUERDO', { agreementDate })}
              className="bg-amber-500 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-amber-600 disabled:opacity-30 transition-all shadow-xl shadow-amber-500/20"
            >
              Confirmar
            </button>
          </div>
        </motion.div>
      )}

      {showRejectionPicker && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-8 bg-slate-950 border border-red-500/20 rounded-[2rem] space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
             <button onClick={() => setShowRejectionPicker(false)} className="text-slate-700 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div>
            <h5 className="text-lg font-display font-black text-red-500 mb-2 tracking-tight">Sustentación de Rechazo</h5>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">Describe detalladamente los criterios técnicos no cumplidos.</p>
          </div>
          <textarea 
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Escriba aquí los motivos del rechazo..."
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-[12px] text-white h-32 focus:border-red-500/50 outline-none resize-none transition-all font-medium"
          />
          <button 
            disabled={!rejectionReason.trim()}
            onClick={() => updateStatus('RECHAZADA', { rejectionReason })}
            className="w-full bg-red-500 text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] hover:bg-red-600 disabled:opacity-30 shadow-xl shadow-red-500/20 transition-all"
          >
            Rechazar Respuesta
          </button>
        </motion.div>
      )}

      {showRedirectionPicker && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-8 bg-white dark:bg-slate-950 border border-amber-500/20 rounded-[2rem] space-y-6 shadow-2xl relative overflow-hidden transition-colors">
          <div className="absolute top-0 right-0 p-4">
             <button onClick={() => setShowRedirectionPicker(false)} className="text-slate-400 dark:text-slate-700 hover:text-slate-900 dark:hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <div>
            <h5 className="text-lg font-display font-black text-amber-500 mb-2 tracking-tight">
              {redirectionType === 'COLABORADOR' ? 'Agregar Colaborador' : 
               redirectionType === 'EJECUTOR' ? 'Redirigir a Ejecutor' :
               'Redirigir a Nuevo Responsable'}
            </h5>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              {redirectionType === 'COLABORADOR' 
                ? 'Selecciona a un colaborador para que apoye en la resolución de este hallazgo.' 
                : redirectionType === 'EJECUTOR'
                ? 'Define al ejecutor final encargado de la respuesta.'
                : 'El hallazgo será transferido íntegramente a una nueva persona.'}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[250px] overflow-auto pr-2 custom-scrollbar">
            {teamMembers.map(member => (
              <button
                key={member.id}
                onClick={() => handleRedirection(member)}
                className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white text-[10px] font-black shrink-0 uppercase">
                  {member.name.charAt(0)}
                </div>
                <div className="overflow-hidden">
                  <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase truncate">{member.name}</p>
                  <p className="text-[8px] font-bold text-slate-500 uppercase truncate">{member.position}</p>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}


