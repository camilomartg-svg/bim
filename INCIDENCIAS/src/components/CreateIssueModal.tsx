import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { handleFirestoreError, OperationType } from '../services/firestore-errors';
import { 
  Issue, 
  Attachment, 
  ISSUE_TYPES, 
  IMPACT_OPTIONS, 
  DEGREE_OF_ACTION, 
  IssueDegreeOfAction,
  User,
  StructuralUnit,
  SiteReport,
  SiteReportBlock,
  IssueStatus
} from '../types';
import { DayType, calculateDueDate } from '../lib/dateUtils';
import { MONTHS, DEFAULT_ECONOMIC_ACTIVITIES, DEFAULT_DANGERS, DANGER_DESCRIPTIONS, PRIORITY_CLASS_MAP } from '../constants';
import { useAuth } from '../context/AuthContext';
import { 
  getProjectConfig,
  subscribeToTeam,
  subscribeToUnits,
  saveIssue,
  saveReport
} from '../services/firebaseService';
import { X, Paperclip, Send, AlertCircle, Box, Map as MapIcon, Image as ImageIcon, FileText, Link, Plus, Trash2, Camera, User as UserIcon, MapPin, Package, ShieldCheck, Building2, ClipboardList, ChevronRight, CheckCircle2, Calendar, Zap, ArrowRight, Mic, MicOff, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface CreateIssueModalProps {
  onClose: () => void;
  onSuccess?: (type: 'issue' | 'report') => void;
}

// Mock positions/professionals if not many users exist
const MOCK_POSITIONS = [
  { position: "Interventor Eléctrico", name: "Juan Pérez" },
  { position: "Arquitecto Residente", name: "María García" },
  { position: "Ingeniero Hidráulico", name: "Carlos Ruiz" },
  { position: "Residente SST", name: "Ana López" },
  { position: "Director de Obra", name: "Roberto Gómez" },
];

export default function CreateIssueModal({ onClose, onSuccess }: CreateIssueModalProps) {
  const [activeMode, setActiveMode] = useState<'issue' | 'report'>('issue');
  
  // Issue Mode States
  const [title, setTitle] = useState('');
  const [type, setType] = useState(ISSUE_TYPES[0]);
  const [degreeOfAction, setDegreeOfAction] = useState<IssueDegreeOfAction>('pronta');
  const [impact, setImpact] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [dueDateDays, setDueDateDays] = useState(7);
  const [dayType, setDayType] = useState<DayType>('OFICINA');

  useEffect(() => {
    if (type?.toLowerCase() === 'hallazgo sst') {
      const issueClass = PRIORITY_CLASS_MAP[DEGREE_OF_ACTION[degreeOfAction]?.label] || 'N/A';
      let days = 7;
      
      if (issueClass === 'A') days = 3;
      else if (issueClass === 'B') days = 5;
      else if (issueClass === 'C') days = 10;
      else if (issueClass === 'I') days = 1;
      
      setDueDateDays(days);
      setDayType('CALENDARIO');
    }
  }, [type, degreeOfAction]);

  useEffect(() => {
    if (type === 'Informe Ambiental') {
      setAssignedPosition('Director de Obra');
    }
  }, [type]);

  useEffect(() => {
    const calculated = calculateDueDate(new Date(), dueDateDays, dayType);
    setDueDate(calculated.toISOString().split('T')[0]);
  }, [dueDateDays, dayType]);
  
  const [assignedPosition, setAssignedPosition] = useState('');
  const [assignedName, setAssignedName] = useState('');
  const [reviewers, setReviewers] = useState<string[]>([]);
  
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);

  useEffect(() => {
    // Automatically set execution month based on current date (creation month)
    setMonth(MONTHS[new Date().getMonth()]);
  }, []);

  const [responsibleCompany, setResponsibleCompany] = useState('');
  const [economicActivity, setEconomicActivity] = useState(DEFAULT_ECONOMIC_ACTIVITIES[0]);
  const [danger, setDanger] = useState(DEFAULT_DANGERS[0]);
  const [dangerDescription, setDangerDescription] = useState(DANGER_DESCRIPTIONS[DEFAULT_DANGERS[0]][0]);
  const [proposedActionPlan, setProposedActionPlan] = useState('');

  // Report Mode States
  const [reportTitle, setReportTitle] = useState('');
  const [reportBlocks, setReportBlocks] = useState<SiteReportBlock[]>([]);
  const [reportReviewers, setReportReviewers] = useState<string[]>([]);
  
  // For "Convert to Hallazgo" within report blocks
  const [convertingBlockId, setConvertingBlockId] = useState<string | null>(null);

  const { user } = useAuth();

  const canCreateReport = () => {
    if (!user) return false;
    const ut = (user as any).team || '';
    const pos = (user as any).position || '';
    const isAuthorizedTeam = ut === 'ARQUITECTURA' || ut === 'COORDINACIÓN TÉCNICA' || ut.toUpperCase().includes('BIM');
    const isBimManager = pos.toUpperCase().includes('BIM');
    const isAdmin = user.role === 'admin' || user.email === 'imagina3ddesign@gmail.com';
    return isAuthorizedTeam || isBimManager || isAdmin;
  };
  
  const [customActivities, setCustomActivities] = useState<string[]>(DEFAULT_ECONOMIC_ACTIVITIES);
  const [customDangers, setCustomDangers] = useState<string[]>(DEFAULT_DANGERS);
  const [customCompanies, setCustomCompanies] = useState<string[]>([]);
  const [customDangerDescriptions, setCustomDangerDescriptions] = useState<Record<string, string[]>>(DANGER_DESCRIPTIONS);

  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);
  const [hierarchyUnits, setHierarchyUnits] = useState<StructuralUnit[]>([]);
  const [showLocationError, setShowLocationError] = useState(false);

  const getAvailableLevels = () => {
    if (selectedUnits.length === 0) return [];
    const levels = new Set<string>();
    selectedUnits.forEach(unitName => {
      const unit = hierarchyUnits.find(u => u.name === unitName);
      if (unit) {
        unit.levels.forEach(lvl => levels.add(lvl.name));
      }
    });
    
    const result = Array.from(levels).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    return result.length > 0 ? ["NINGUNA", ...result] : ["NINGUNA"];
  };

  const getAvailableSpaces = () => {
    if (selectedLevels.length === 0) return [];
    const spaces = new Set<string>();
    selectedUnits.forEach(unitName => {
      const unit = hierarchyUnits.find(u => u.name === unitName);
      if (unit) {
        selectedLevels.forEach(lvlName => {
          if (lvlName === "NINGUNA") {
             // If "NINGUNA" is selected as level, spaces don't strictly apply but we add the option
          } else {
            unit.spaces
              .filter(spc => spc.levelName === lvlName)
              .forEach(spc => spaces.add(spc.name));
          }
        });
      }
    });
    
    const result = Array.from(spaces).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    return result.length > 0 ? ["NINGUNA", ...result] : ["NINGUNA"];
  };

  const [fieldSettings, setFieldSettings] = useState<any[]>([]);
  const [customImpacts, setCustomImpacts] = useState<string[]>(IMPACT_OPTIONS);
  const [customTypes, setCustomTypes] = useState<string[]>(ISSUE_TYPES);
  const [customTeam, setCustomTeam] = useState<{position: string, name: string, email?: string}[]>(MOCK_POSITIONS);
  
  const [isCDEOpen, setIsCDEOpen] = useState(false);
  
  const [attachments, setAttachments] = useState<Partial<Attachment>[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeCreatorTeam, setActiveCreatorTeam] = useState((user as any)?.team || 'ARQUITECTURA');
  
  // State for which context is picking from CDE
  const [cdeTarget, setCdeTarget] = useState<{ type: 'issue' | 'block', blockId?: string }>({ type: 'issue' });

  useEffect(() => {
    let unsubscribeTeam: () => void;
    let unsubscribeUnits: () => void;
    let currentConfig: any = null;

    const updateAllSettings = (fetchedTeam: any[], fbConfig: any) => {
      if (!fbConfig) return;
      
      let fieldVisibility = fbConfig.fieldVisibility || {};
      let issueTypes = fbConfig.issueTypes || ISSUE_TYPES;
      let impactOptions = fbConfig.impactOptions || IMPACT_OPTIONS;
      let allowedUnitIds: string[] | undefined = undefined;
      
      // Type Overrides (Apply on top of global)
      if (type && fbConfig.typeOverrides?.[type]) {
        const typeOverride = fbConfig.typeOverrides[type];
        if (typeOverride.fieldVisibility) fieldVisibility = { ...fieldVisibility, ...typeOverride.fieldVisibility };
        if (typeOverride.impactOptions) impactOptions = typeOverride.impactOptions;
        if (typeOverride.units) allowedUnitIds = typeOverride.units;
      }

      const fieldArray = Object.entries(fieldVisibility).map(([id, visible]) => ({ id, visible }));
      setFieldSettings(fieldArray);
      setCustomImpacts(impactOptions);

      // Filter types based on user permissions
      const filteredTypes = issueTypes.filter(t => {
        const override = fbConfig.typeOverrides?.[t];
        if (!override) return true;
        
        // If explicitly set to ALL (TODOS), then anyone can create
        if (override.allowedCreatorAll) {
          return true;
        }

        const limitCreatorTeams = override.allowedCreatorTeams !== undefined ? override.allowedCreatorTeams : (override.allowedTeams || []);
        const limitCreatorRoles = override.allowedCreatorRoles !== undefined ? override.allowedCreatorRoles : (override.allowedRoles || []);
        const limitCreatorEmails = override.allowedCreatorUserEmails !== undefined ? override.allowedCreatorUserEmails : (override.allowedUserEmails || []);
        const limitCreatorIds = override.allowedCreatorUserIds !== undefined ? override.allowedCreatorUserIds : (override.allowedUserIds || []);

        if (
          limitCreatorTeams.length > 0 || 
          limitCreatorRoles.length > 0 || 
          limitCreatorEmails.length > 0 ||
          limitCreatorIds.length > 0
        ) {
          const userEmail = user?.email;
          const userRole = (user as any)?.position;
          const userTeam = (user as any)?.team;
          
          const isEmailAllowed = userEmail && limitCreatorEmails.includes(userEmail);
          const isRoleAllowed = userRole && limitCreatorRoles.includes(userRole);
          const isTeamAllowed = userTeam && limitCreatorTeams.includes(userTeam);
          const isIdAllowed = userEmail && limitCreatorIds && fetchedTeam.some(m => m.email === userEmail && limitCreatorIds.includes(m.id));
          
          return isIdAllowed || isEmailAllowed || isRoleAllowed || isTeamAllowed;
        }
        return true;
      });

      setCustomTypes(filteredTypes);
      if (filteredTypes.length > 0 && !filteredTypes.includes(type)) {
        setType(filteredTypes[0]);
      }

      setCustomActivities(fbConfig.economicActivities || DEFAULT_ECONOMIC_ACTIVITIES);
      setCustomDangers(fbConfig.dangers || DEFAULT_DANGERS);
      setCustomCompanies(fbConfig.responsibleCompanies || []);
      setCustomDangerDescriptions(fbConfig.dangerDescriptions || DANGER_DESCRIPTIONS);

      // Filter team based on current type permissions (receivers)
      let teamToUse = fetchedTeam;
      if (type && fbConfig.typeOverrides?.[type]) {
        const override = fbConfig.typeOverrides[type];
        
        if (override.allowedReceiverAll) {
          teamToUse = fetchedTeam;
        } else {
          const limitReceiverReceiverTeams = override.allowedReceiverTeams !== undefined ? override.allowedReceiverTeams : (override.allowedTeams || []);
          const limitReceiverRoles = override.allowedReceiverRoles !== undefined ? override.allowedReceiverRoles : (override.allowedRoles || []);
          const limitReceiverEmails = override.allowedReceiverUserEmails !== undefined ? override.allowedReceiverUserEmails : (override.allowedUserEmails || []);
          const limitReceiverIds = override.allowedReceiverUserIds !== undefined ? override.allowedReceiverUserIds : (override.allowedUserIds || []);

          if (
            limitReceiverReceiverTeams.length > 0 || 
            limitReceiverRoles.length > 0 || 
            limitReceiverEmails.length > 0 ||
            limitReceiverIds.length > 0
          ) {
            teamToUse = fetchedTeam.filter(member => {
              const isIdAllowed = limitReceiverIds.includes(member.id);
              const isEmailAllowed = member.email && limitReceiverEmails.includes(member.email);
              const isRoleAllowed = limitReceiverRoles.includes(member.position);
              const isTeamAllowed = member.team && limitReceiverReceiverTeams.includes(member.team);
              return isIdAllowed || isEmailAllowed || isRoleAllowed || isTeamAllowed;
            });
          } else if (override.teamIds) {
            teamToUse = fetchedTeam.filter(m => override.teamIds!.includes(m.id));
          }
        }
      }
      setCustomTeam(teamToUse);

      // Units subscription needs the allowedUnitIds
      if (unsubscribeUnits) unsubscribeUnits();
      unsubscribeUnits = subscribeToUnits((fetchedUnits) => {
        const filtered = allowedUnitIds !== undefined
          ? fetchedUnits.filter(u => allowedUnitIds!.includes(u.id))
          : fetchedUnits;
        setHierarchyUnits(filtered);
      });
    };

    const loadAll = async () => {
      currentConfig = await getProjectConfig();
      if (unsubscribeTeam) unsubscribeTeam();
      unsubscribeTeam = subscribeToTeam((fetchedTeam) => {
        updateAllSettings(fetchedTeam, currentConfig);
      });
    };

    loadAll();
    window.addEventListener('storage_settings_updated', loadAll);
    return () => {
      window.removeEventListener('storage_settings_updated', loadAll);
      if (unsubscribeTeam) unsubscribeTeam();
      if (unsubscribeUnits) unsubscribeUnits();
    };
  }, [type, user]);

  const startSpeechRecognition = (onTranscript: (text: string) => void) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Su navegador no soporta el reconocimiento de voz. Por favor use Chrome o Edge.");
      return;
    }

    if (isListening) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = false;

    let finalTranscript = '';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript;
          finalTranscript += transcript;
          onTranscript(transcript);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed') {
        alert("Permiso de micrófono denegado. Por favor habilítelo en su navegador.");
      }
      setIsListening(false);
      recognition.stop();
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    // To stop the recognition, we'll need a way for the user to click the button again
    // For now, let's make the button a toggle
    recognition.start();

    // Store the recognition instance if we want to stop it manually
    (window as any)._currentRecognition = recognition;
  };

  const stopSpeechRecognition = () => {
    if ((window as any)._currentRecognition) {
      (window as any)._currentRecognition.stop();
      setIsListening(false);
    }
  };

  const isFieldVisible = (id: string) => {
    if (fieldSettings.length === 0) return true;
    const field = fieldSettings.find(f => f.id === id);
    return field ? field.visible : true;
  };

  // Auto-fill Assigned Name when position changes
  useEffect(() => {
    const professional = customTeam.find(p => p.position === assignedPosition);
    if (professional) {
      setAssignedName(professional.name);
    } else {
      setAssignedName('');
    }
  }, [assignedPosition, customTeam]);

  const addReportBlock = () => {
    const newBlock: SiteReportBlock = {
      id: Math.random().toString(36).substr(2, 9),
      description: '',
      location: { units: [], levels: [], spaces: [] },
      attachments: []
    };
    setReportBlocks([...reportBlocks, newBlock]);
  };

  const removeReportBlock = (id: string) => {
    setReportBlocks(reportBlocks.filter(b => b.id !== id));
  };

  const updateReportBlock = (id: string, updates: Partial<SiteReportBlock>) => {
    setReportBlocks(reportBlocks.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const handleReportSubmit = async (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!user) return;

    if (!reportTitle.trim()) {
      alert("⚠️ El Título del Informe es obligatorio.");
      return;
    }

    if (reportBlocks.length === 0) {
      alert("⚠️ Debe agregar al menos un bloque de información al informe.");
      return;
    }

    const directorMember = customTeam.find(m => m.position === "Director de Obra");
    
    setIsSubmitting(true);
    try {
      const reviewerEmails = reportReviewers.map(rPos => {
        const member = customTeam.find(m => m.position === rPos);
        return (member as any)?.email || '';
      }).filter(Boolean);

      const reportData: Omit<SiteReport, 'id'> = {
        code: `INF-${Math.floor(Date.now() / 100000)}`, // Simple unique code
        title: reportTitle,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        creatorId: user.id,
        creatorName: user.name,
        creatorPosition: user.position || "GENERAL",
        creatorTeam: activeCreatorTeam,
        authorEmail: user.email,
        assignedPosition: "Director de Obra",
        assignedName: directorMember?.name || 'NO ASIGNADO',
        assignedEmail: directorMember?.email || '',
        reviewers: reportReviewers,
        reviewerEmails,
        blocks: reportBlocks,
        status: "FINALIZED"
      };

      const reportId = await saveReport(reportData);
      
      // Update all issues linked to this report that were created during this session
      const linkedIssueIds = reportBlocks
        .filter(b => b.issueId)
        .map(b => b.issueId!);

      if (linkedIssueIds.length > 0 && reportId) {
        await Promise.all(linkedIssueIds.map(id => 
          updateDoc(doc(db, 'issues', id), {
            sourceReportId: reportId,
            sourceReportTitle: reportTitle || 'INFORME DE OBRA'
          })
        ));
      }

      alert("🎉 Informe de obra finalizado y guardado con éxito.");
      if (onSuccess) onSuccess('report');
      onClose();
    } catch (err) {
      console.error("Error al guardar informe:", err);
      alert("⚠️ Error crítico al guardar el informe. Revise su conexión o contacte soporte.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const convertBlockToIssue = async (block: SiteReportBlock) => {
    if (!user) return;
    
    // First, we need to collect necessary fields that are not in the block but in an Issue
    // We'll show a mini-modal or expand the block UI to ask for missing fields:
    // title, type, degreeOfAction, impact, assignedPosition, dueDate
    
    setConvertingBlockId(block.id);
  };

  const finalizeConversion = async (blockId: string, issueFields: Partial<Issue>) => {
     if (!user) return;
     const block = reportBlocks.find(b => b.id === blockId);
     if (!block) return;

     setIsSubmitting(true);
     try {
       const directorMember = customTeam.find(m => m.position === "Director de Obra");
       const assignedMember = customTeam.find(m => m.position === issueFields.assignedPosition);

       const specialty = getSpecialtyFromPosition(issueFields.assignedPosition || 'DIRECTOR DE OBRA');
       const code = await generateCode(specialty);

       const issueData: Omit<Issue, 'id'> = {
         ...issueFields as any,
         code,
         description: block.description,
         locations: block.location,
         attachments: block.attachments as any,
         status: 'ACTIVO',
         specialty,
         creatorId: user.id,
         creatorName: user.name,
         creatorPosition: user.position || "GENERAL",
         creatorTeam: activeCreatorTeam,
         authorEmail: user.email,
         month: MONTHS[new Date().getMonth()],
         createdAt: new Date().toISOString(),
         updatedAt: new Date().toISOString(),
         comments: [],
         assignedName: assignedMember?.name || '',
         assignedEmail: (assignedMember as any)?.email || '',
         reviewers: [],
         reviewerEmails: [],
         fromReport: true,
         sourceReportId: 'NEW_REPORT', // It's being created in same modal
         sourceReportTitle: reportTitle || 'INFORME DE OBRA'
       };

       const docRef = await addDoc(collection(db, 'issues'), {
         ...issueData,
         createdAt: new Date().toISOString(),
         updatedAt: new Date().toISOString()
       });

       // Update block with issue link
       updateReportBlock(blockId, { 
         issueId: docRef.id, 
         issueStatus: 'ACTIVO' 
       });

       setConvertingBlockId(null);
     } catch (err) {
       console.error("Error converting block to issue:", err);
       alert("Error al convertir a hallazgo");
     } finally {
       setIsSubmitting(false);
     }
  };

  const sortedTeam = [...customTeam].sort((a, b) => a.position.localeCompare(b.position));

  useEffect(() => {
    if (activeMode === 'report' && reportBlocks.length === 0) {
      addReportBlock();
    }
  }, [activeMode]);
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const url = URL.createObjectURL(file);
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        
        setAttachments(prev => [...prev, { 
          id: Math.random().toString(36).substr(2, 9), 
          name: file.name, 
          url: url, 
          type: file.type || 'application/octet-stream',
          category: isImage ? 'image' : (isVideo ? 'video' : 'file')
        }]);
      });
    }
  };

  const handleCDEFilePick = (file: any) => {
    const newAttachment: Partial<Attachment> = {
      id: file.id || Math.random().toString(36).substr(2, 9),
      name: file.name,
      url: file.url,
      type: file.category === 'video' ? 'video/mp4' : 'application/pdf',
      category: file.category
    };

    if (activeMode === 'issue') {
      setAttachments(prev => [...prev, newAttachment]);
    } else if (activeMode === 'report' && cdeTarget.blockId) {
      const block = reportBlocks.find(b => b.id === cdeTarget.blockId);
      if (block) {
        updateReportBlock(cdeTarget.blockId, {
          attachments: [...(block.attachments || []), newAttachment as any]
        });
      }
    }
    setIsCDEOpen(false);
  };

  const updateAttachment = (index: number, field: keyof Attachment, value: any) => {
    const newAtts = [...attachments];
    newAtts[index] = { ...newAtts[index], [field]: value };
    setAttachments(newAtts);
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const toggleImpact = (option: string) => {
    setImpact(prev => 
      prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]
    );
  };

  const addReviewer = (pos: string) => {
    if (pos && !reviewers.includes(pos)) {
      setReviewers([...reviewers, pos]);
    }
  };

  const removeReviewer = (pos: string) => {
    setReviewers(reviewers.filter(r => r !== pos));
  };

  const getSpecialtyFromPosition = (pos: string) => {
    const p = pos ? pos.toLowerCase() : '';
    if (p.includes('sst') || p.includes('seguridad') || p.includes('salud')) return 'SST';
    if (p.includes('eléctrico') || p.includes('electrico')) return 'ELÉCTRICO';
    if (p.includes('arquitect')) return 'ARQUITECTURA';
    if (p.includes('hidráulic') || p.includes('hidraulico')) return 'HIDRÁULICO';
    if (p.includes('mecánic') || p.includes('mecanico')) return 'MECÁNICO';
    if (p.includes('estructur')) return 'ESTRUCTURAL';
    if (p.includes('gas')) return 'GAS';
    return 'GENERAL';
  };

  const generateCode = async (specialty: string) => {
    const prefix = specialty.slice(0, 3).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    try {
      const q = query(collection(db, 'issues'), where('specialty', '==', specialty));
      const snapshot = await getDocs(q);
      const nextNum = (snapshot.size + 1).toString().padStart(3, '0');
      return `${prefix}-${nextNum}`;
    } catch (err) {
      console.warn("Failed to get count for code, using random suffix", err);
      return `${prefix}-${Math.floor(Math.random() * 900) + 100}`;
    }
  };

  const handleSubmit = async (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    
    // Validation
    const errors: string[] = [];
    if (!title.trim()) errors.push("Título (Obligatorio)");
    if (!description.trim()) errors.push("Descripción Técnica (Obligatorio)");
    if (isFieldVisible('type') && !type) errors.push("Tipo de Incidencia");
    if (isFieldVisible('degreeOfAction') && !degreeOfAction) errors.push("Grado de Respuesta");
    if (isFieldVisible('impact') && impact.length === 0) errors.push("Prioridad / Afectación (seleccione al menos una o 'NINGUNA')");
    if (isFieldVisible('dueDate') && !dueDate) errors.push("Fecha de Vencimiento");
    if (isFieldVisible('assignedPosition') && !assignedPosition) errors.push("Responsable Asignado");
    
    // Jerarquía de ubicación obligatoria
    if (selectedUnits.length === 0) errors.push("Unidad Estructural (Selección Mínima)");
    
    // Auto-select NINGUNA if empty but available
    const finalLevels = selectedLevels.length > 0 ? selectedLevels : (getAvailableLevels().includes("NINGUNA") ? ["NINGUNA"] : []);
    const finalSpaces = selectedSpaces.length > 0 ? selectedSpaces : (getAvailableSpaces().includes("NINGUNA") ? ["NINGUNA"] : []);

    if (finalLevels.length === 0) errors.push("Nivel / Piso (Seleccione al menos uno o 'NINGUNA')");
    if (finalSpaces.length === 0) errors.push("Espacio Específico (Seleccione al menos uno o 'NINGUNA')");

    // Add validation for new fields if visible
    if (isFieldVisible('economicActivity') && !economicActivity) errors.push("Actividad Económica");
    if (isFieldVisible('danger') && !danger) errors.push("Factor de Peligro");
    if (isFieldVisible('proposedActionPlan') && !proposedActionPlan.trim()) errors.push("Plan de Acción Propuesto");

    if (errors.length > 0) {
      setShowLocationError(selectedUnits.length === 0 || finalLevels.length === 0 || finalSpaces.length === 0);
      alert("⚠️ Verifique los siguientes campos:\n\n" + errors.map(e => `• ${e}`).join("\n"));
      
      if (selectedUnits.length === 0 || selectedLevels.length === 0 || selectedSpaces.length === 0) {
        const locationSection = document.getElementById('location-section');
        if (locationSection) {
          locationSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    if (!user) return;
    setShowLocationError(false);

    setIsSubmitting(true);
    console.log("Submitting issue...");
    
    try {
      const creatorPos = (user as any).position || "General";
      let specialty = getSpecialtyFromPosition(creatorPos);
      
      // Force AMBIENTAL specialty if type contains AMBIENTAL or is "Informe Ambiental"
      if (type.toUpperCase().includes('AMBIENTAL') || type === 'Informe Ambiental') {
        specialty = 'AMBIENTAL';
      }
      
      // Force SST specialty if type contains SST to ensure correct coding and visibility
      if (type.toUpperCase().includes('SST')) {
        specialty = 'SST';
      }

      const code = await generateCode(specialty);

      const assignedMember = customTeam.find(p => p.position === assignedPosition);
      const assignedEmail = (assignedMember as any)?.email || '';
      const assignedTeam = (assignedMember as any)?.team || '';
      
      const reviewerEmails = reviewers.map(rPos => {
        const member = customTeam.find(p => p.position === rPos);
        return (member as any)?.email || '';
      }).filter(Boolean);

      const cleanedAttachments = attachments
        .filter(a => a.name && a.url)
        .map(a => ({
          id: a.id || Math.random().toString(36).substr(2, 9),
          name: a.name || 'Sin nombre',
          url: a.url || '',
          type: a.type || 'application/octet-stream',
          category: a.category || 'file'
        }));

      const issueData: Omit<Issue, 'id'> = {
        code,
        title,
        type,
        degreeOfAction,
        impact,
        description,
        status: 'ACTIVO',
        specialty,
        assignedPosition,
        assignedName,
        assignedEmail,
        assignedTeam,
        reviewers,
        reviewerEmails,
        creatorId: user.id,
        creatorName: user.name,
        creatorPosition: (user as any).position || "GENERAL",
        creatorTeam: activeCreatorTeam,
        authorEmail: user.email,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dueDate,
        attachments: cleanedAttachments,
        comments: [],
        locations: {
          units: selectedUnits,
          levels: finalLevels,
          spaces: finalSpaces
        },
        month,
        responsibleCompany,
        economicActivity,
        danger,
        dangerDescription,
        issueClass: PRIORITY_CLASS_MAP[DEGREE_OF_ACTION[degreeOfAction]?.label] || '',
        proposedActionPlan
      };

      console.log("Saving issue data:", issueData);
      
      // Use the service which includes better error logging and timestamp handling
      await saveIssue(issueData);
      
      if (onSuccess) onSuccess('issue');
      onClose();
    } catch (error: any) {
      console.error("Error creating issue:", error);
      let errorMessage = "Ocurrió un error inesperado al guardar.";
      
      try {
        // Try to parse the standard JSON error from handleFirestoreError
        const parsed = JSON.parse(error.message);
        errorMessage = `Detalle Técnico: ${parsed.error}\nOperación: ${parsed.operationType}`;
      } catch (e) {
        errorMessage = error.message || String(error);
      }
      
      alert("⚠️ Error al crear la incidencia:\n\n" + errorMessage + "\n\nPor favor reporte este error si el problema persiste.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-[#020617]/40 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-[#020617] rounded-[2.5rem] w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] border border-slate-200 dark:border-slate-800"
      >
        {/* Header */}
        <div className="p-8 lg:p-10 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white/80 dark:bg-white/80 dark:bg-[#020617]/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-5">
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 mr-2">
              <button 
                type="button"
                onClick={() => setActiveMode('issue')}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                  activeMode === 'issue' 
                    ? "bg-white dark:bg-[#020617] text-slate-900 dark:text-white shadow-xl shadow-slate-900/5" 
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                <Plus className="w-3.5 h-3.5" /> Registro
              </button>
              {canCreateReport() && (
                <button 
                  type="button"
                  onClick={() => setActiveMode('report')}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                    activeMode === 'report' 
                      ? "bg-white dark:bg-[#020617] text-slate-900 dark:text-white shadow-xl shadow-slate-900/5" 
                      : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <ClipboardList className="w-3.5 h-3.5" /> Informe de Obra
                </button>
              )}
            </div>
            <div>
                      <div className="flex items-center gap-3 mb-0.5">
                <h2 className="text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight">
                  {activeMode === 'issue' ? 'Registro de Hallazgo' : 'Informe de Obra'}
                </h2>
                <div className="px-2.5 py-0.5 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-full text-[8px] font-black uppercase tracking-widest border border-blue-500/20">SISTEMA CDE</div>
              </div>
              <p className="text-[9px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-[0.3em]">
                {activeMode === 'issue' ? (
                   <span className="flex items-center gap-2">
                     EQUIPO ENCARGADO: <span className={cn(
                       "px-2 py-0.5 rounded-md border",
                       activeCreatorTeam === 'ARQUITECTURA' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                       activeCreatorTeam === 'COORDINACIÓN TÉCNICA' ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-600 shadow-cyan-500/5 shadow-xl" :
                       "bg-slate-500/10 border-slate-500/20 text-slate-500"
                     )}>{activeCreatorTeam}</span>
                   </span>
                ) : (
                   <span className="flex items-center gap-2">
                     EMITIDO POR: <span className={cn(
                       "px-2 py-0.5 rounded-md border",
                       activeCreatorTeam === 'ARQUITECTURA' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                       activeCreatorTeam === 'COORDINACIÓN TÉCNICA' ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-500 shadow-cyan-500/5 shadow-xl" :
                       "bg-slate-500/10 border-slate-500/20 text-slate-500"
                     )}>{activeCreatorTeam}</span>
                   </span>
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-4 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all border border-slate-200 dark:border-slate-800 shadow-sm active:scale-95 group">
            <X className="w-5 h-5 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
          </button>
        </div>

        <form 
          onSubmit={activeMode === 'issue' ? handleSubmit : handleReportSubmit} 
          className="flex-1 overflow-auto p-10 lg:p-12 space-y-12 custom-scrollbar bg-white dark:bg-transparent transition-colors"
        >
          {activeMode === 'report' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 pb-10 border-b border-slate-100 dark:border-slate-800/50">
              <div className="space-y-4">
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Equipo Emisor del Informe
                </label>
                <div className="flex gap-4">
                  {['ARQUITECTURA', 'COORDINACIÓN TÉCNICA'].map((team) => (
                    <button
                      key={team}
                      type="button"
                      onClick={() => setActiveCreatorTeam(team)}
                      className={cn(
                        "flex-1 px-6 py-4 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-widest text-center",
                        activeCreatorTeam === team 
                          ? (team === 'ARQUITECTURA' ? "bg-amber-500/10 border-amber-500 text-amber-600" : "bg-cyan-500/10 border-cyan-500 text-cyan-600")
                          : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-400 hover:border-slate-200 dark:hover:border-slate-700"
                      )}
                    >
                      {team}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Título General del Informe <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="Ej: Informe de Seguimiento de Obra - Semana 12"
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-900 dark:text-white font-bold focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>
          )}

          {activeMode === 'issue' ? (
            <>
              {/* Section 1: Basic Info */}
          <section className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="group">
                  <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-600 mb-3 px-1 flex items-center justify-between">
                    <span>Título de la incidencia <span className="text-red-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Inconsistencia en trazado hidrosanitario N05"
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-[13px] text-slate-900 dark:text-white font-semibold focus:border-slate-400 dark:focus:border-slate-700 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700 shadow-inner"
                  />
                </div>
                {isFieldVisible('type') && (
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-1">
                      Tipo de Incidencia <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-[13px] text-slate-900 dark:text-white font-semibold focus:border-slate-400 dark:focus:border-slate-700 outline-none transition-all appearance-none cursor-pointer shadow-inner pr-12"
                      >
                        <option value="">Seleccionar Categoría...</option>
                        {customTypes.sort().map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <Box className="w-4.5 h-4.5 text-slate-700 absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>

              {isFieldVisible('degreeOfAction') && (
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-1">
                    Prioridad de Respuesta <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
                    {Object.entries(DEGREE_OF_ACTION)
                      .filter(([key]) => ['inmediata', 'urgente', 'pronta', 'posterior'].includes(key))
                      .map(([key, value]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setDegreeOfAction(key as IssueDegreeOfAction)}
                          className={cn(
                            "py-3 text-[9px] font-black uppercase tracking-[0.15em] rounded-xl transition-all border shadow-sm",
                            degreeOfAction === key 
                              ? "bg-white border-white text-slate-900 shadow-xl" 
                              : "text-slate-500 border-transparent hover:text-slate-300"
                          )}
                        >
                        <span className="flex items-center justify-center gap-2">
                          <div className={cn("w-1.5 h-1.5 rounded-full", degreeOfAction === key ? "" : "opacity-30")} style={{ backgroundColor: (value as any).color }} />
                          {(value as any).label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {isFieldVisible('impact') && (
              <div>
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-4 px-1 flex items-center justify-between">
                  <span>Afectación del Proyecto (Prioridad) <span className="text-red-500">*</span></span>
                  <div className="flex gap-1">
                    {impact.length > 0 && <span className="px-2 py-0.5 bg-blue-500 text-white rounded-full text-[8px] font-black">{impact.length}</span>}
                  </div>
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {customImpacts.sort().map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleImpact(opt)}
                      className={cn(
                        "p-4 text-[8px] font-black uppercase tracking-[0.1em] rounded-xl border transition-all text-center leading-tight shadow-sm min-h-[60px] flex items-center justify-center px-4",
                        impact.includes(opt) 
                          ? "bg-white border-white text-[#020617] shadow-xl shadow-white/5 scale-[1.02]" 
                          : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-400 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isFieldVisible('issueClass') && (
              <div className="md:col-span-2 lg:col-span-1">
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-1">
                  Clase de Incidencia (Automático)
                </label>
                <div className="px-6 py-4 bg-slate-900/50 border border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="text-[13px] text-white font-black">{PRIORITY_CLASS_MAP[DEGREE_OF_ACTION[degreeOfAction]?.label] || 'N/A'}</span>
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500">
                    {PRIORITY_CLASS_MAP[DEGREE_OF_ACTION[degreeOfAction]?.label] || '-'}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Section 1.5: Categorización y Riesgo */}
          {(isFieldVisible('month') || isFieldVisible('economicActivity') || isFieldVisible('danger')) && (
            <section className="grid grid-cols-1 md:grid-cols-3 gap-10 p-10 bg-slate-50 dark:bg-slate-950/30 rounded-[3rem] border border-slate-100 dark:border-slate-800/50">
              {isFieldVisible('month') && (
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-1">
                    Mes de Ejecución <span className="text-red-500">*</span>
                  </label>
                  <div className="w-full px-6 py-4 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl text-[13px] text-slate-500 dark:text-slate-400 font-bold shadow-inner">
                    {month}
                  </div>
                </div>
              )}

              {isFieldVisible('economicActivity') && (
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-1">
                    Actividad Económica <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={economicActivity}
                    onChange={(e) => setEconomicActivity(e.target.value)}
                    className="w-full px-6 py-4 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-[13px] text-slate-900 dark:text-white font-bold focus:border-slate-400 dark:focus:border-slate-700 outline-none transition-all shadow-sm"
                  >
                    <option value="">Seleccionar Actividad...</option>
                    {customActivities.sort().map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              )}

              {isFieldVisible('danger') && (
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-1">
                    Factor de Peligro <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={danger}
                    onChange={(e) => {
                      setDanger(e.target.value);
                      setDangerDescription('');
                    }}
                    className="w-full px-6 py-4 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-[13px] text-slate-900 dark:text-white font-bold focus:border-slate-400 dark:focus:border-slate-700 outline-none transition-all shadow-sm"
                  >
                    <option value="">Seleccionar Peligro...</option>
                    {customDangers.sort().map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              )}

              {isFieldVisible('dangerDescription') && danger && (
                <div className="md:col-span-3">
                  <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-1">
                    Descripción Específica del Peligro ({danger}) <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(customDangerDescriptions[danger] || []).map((desc) => (
                      <button
                        key={desc}
                        type="button"
                        onClick={() => setDangerDescription(desc)}
                        className={cn(
                          "p-4 text-[9px] font-black uppercase tracking-[0.05em] rounded-xl border transition-all text-left shadow-sm min-h-[50px] flex items-center px-4",
                          dangerDescription === desc 
                            ? "bg-slate-900 dark:bg-white border-slate-900 dark:border-white text-white dark:text-slate-900 shadow-xl" 
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-400 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white"
                        )}
                      >
                        {desc}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Section 2: Details & Description */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-8">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-1 flex items-center justify-between">
                  <span>Descripción Técnica <span className="text-red-500">*</span></span>
                  <button
                    type="button"
                    onClick={() => isListening ? stopSpeechRecognition() : startSpeechRecognition((text) => setDescription(prev => prev ? `${prev} ${text}` : text))}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition-all",
                      isListening ? "bg-red-500 text-white animate-pulse" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    )}
                  >
                    {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                    {isListening ? 'Parar dictado' : 'Dictar por voz'}
                  </button>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describa el hallazgo con precisión técnica..."
                  className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-[13px] text-slate-900 dark:text-white font-semibold focus:border-slate-400 dark:focus:border-slate-700 outline-none transition-all resize-none h-32 shadow-inner placeholder:text-slate-400 dark:placeholder:text-slate-700"
                />
              </div>

              {isFieldVisible('proposedActionPlan') && (
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-1">
                    Plan de Acción Propuesto <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={proposedActionPlan}
                    onChange={(e) => setProposedActionPlan(e.target.value)}
                    placeholder="Especifique las acciones sugeridas para mitigar o corregir el hallazgo..."
                    className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-[13px] text-slate-900 dark:text-white font-semibold focus:border-slate-400 dark:focus:border-slate-700 outline-none transition-all resize-none h-32 shadow-inner placeholder:text-slate-400 dark:placeholder:text-slate-700"
                  />
                </div>
              )}
            </div>
            {isFieldVisible('dueDate') && (
              <div className="space-y-6">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 px-1">
                    Fecha de Vencimiento <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 px-1">Cantidad de Días</label>
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={dueDateDays}
                          onChange={(e) => setDueDateDays(parseInt(e.target.value) || 0)}
                          className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-xs text-white font-black group-focus-within:border-slate-600 outline-none transition-all shadow-inner"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[8px] font-black uppercase tracking-widest text-slate-400 px-1">Tipo de Días</label>
                        <select
                          value={dayType}
                          onChange={(e) => setDayType(e.target.value as DayType)}
                          className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-[9px] text-white font-black uppercase tracking-widest outline-none transition-all shadow-inner appearance-none cursor-pointer"
                        >
                          <option value="OFICINA">Oficina (Lun-Vie)</option>
                          <option value="OBRA">Obra (Lun-Sab)</option>
                          <option value="CALENDARIO">Calendario (Lun-Dom)</option>
                        </select>
                      </div>
                    </div>
                    <div className="relative group">
                       <input
                         type="date"
                         value={dueDate}
                         onChange={(e) => setDueDate(e.target.value)}
                         className="w-full px-6 py-4 bg-slate-900/50 border border-slate-800 rounded-2xl text-[13px] text-white font-black focus:border-slate-700 outline-none transition-all shadow-inner"
                       />
                       <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                         <Calendar className="w-4 h-4 text-slate-700 group-focus-within:text-white transition-colors" />
                       </div>
                    </div>
                    <p className="px-2 text-[7px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                      * El cálculo descuenta automáticamente los festivos de Colombia.
                    </p>
                  </div>
                </div>
                <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2.5 text-blue-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Información Crítica</span>
                  </div>
                  <p className="text-[11px] text-blue-400/60 leading-relaxed font-semibold">
                    Esta fecha se utilizará para el seguimiento de entregas y el reporte de indicadores clave de desempeño (KPIs).
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Section 3: Assignment & Roles */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {isFieldVisible('assignedPosition') && (
              <div className="space-y-6">
                 <div className="group">
                  <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-4 flex items-center justify-between px-1">
                    <span className="flex items-center gap-2">Responsable Asignado <span className="text-red-500">*</span></span>
                    <UserIcon className="w-3.5 h-3.5 text-slate-800 group-focus-within:text-blue-500 transition-colors" />
                  </label>
                  <div className="space-y-4">
                    <select
                      value={assignedPosition}
                      onChange={(e) => setAssignedPosition(e.target.value)}
                      disabled={type === 'Informe Ambiental'}
                      className={cn(
                        "w-full px-6 py-4 border rounded-2xl text-[13px] font-bold outline-none transition-all shadow-inner",
                        type === 'Informe Ambiental' 
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 cursor-not-allowed" 
                          : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-slate-700"
                      )}
                    >
                      <option value="">Seleccionar Cargo / Disciplina...</option>
                      {sortedTeam.map(p => <option key={p.position} value={p.position}>{p.position}</option>)}
                    </select>
                    {type === 'Informe Ambiental' && (
                      <p className="text-[9px] font-black uppercase tracking-wider text-emerald-550 mt-2 px-1">
                        🔒 Dirigido obligatoriamente al Director de Obra para incidencias ambientales formales.
                      </p>
                    )}

                    {isFieldVisible('responsibleCompany') && (
                      <div className="relative">
                        <Building2 className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        {customCompanies.length > 0 ? (
                          <select
                            value={responsibleCompany}
                            onChange={(e) => setResponsibleCompany(e.target.value)}
                            className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] text-slate-900 dark:text-white font-black uppercase tracking-widest focus:border-emerald-500 outline-none transition-all shadow-inner appearance-none cursor-pointer"
                          >
                            <option value="">EMPRESA CORRESPONSABLE...</option>
                            {customCompanies.sort().map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={responsibleCompany}
                            onChange={(e) => setResponsibleCompany(e.target.value.toUpperCase())}
                            placeholder="EMPRESA CORRESPONSABLE..."
                            className="w-full pl-14 pr-6 py-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] text-slate-900 dark:text-white font-black uppercase tracking-widest focus:border-emerald-500 outline-none transition-all shadow-inner placeholder:text-slate-400"
                          />
                        )}
                      </div>
                    )}
                    <AnimatePresence>
                      {assignedName && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }} 
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="px-5 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center justify-between shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-black text-[9px]">
                              {assignedName.slice(0,1)}
                            </div>
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{assignedName}</span>
                          </div>
                          <span className="text-[8px] font-black text-emerald-500/40 uppercase tracking-widest">Verificado</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            )}

            {isFieldVisible('reviewers') && (
              <div className="space-y-6">
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 mb-4 px-1">Comité de Revisión</label>
                <div className="flex gap-4">
                  <select
                    id="rev-select"
                    className="flex-1 px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-[13px] text-slate-900 dark:text-white font-bold focus:border-slate-400 dark:focus:border-slate-700 outline-none transition-all shadow-inner"
                    onChange={(e) => {
                      addReviewer(e.target.value);
                      e.target.value = '';
                    }}
                  >
                    <option value="">Añadir Revisor...</option>
                    {sortedTeam.map(p => <option key={p.position} value={p.position}>{p.position}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2.5 p-5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 border-dashed rounded-2xl min-h-[60px]">
                   {reviewers.map(r => (
                     <motion.div 
                        key={r} 
                        layout
                        initial={{ scale: 0.8, opacity: 0 }} 
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg shadow-sm"
                     >
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{r}</span>
                       <button type="button" onClick={() => removeReviewer(r)} className="hover:text-red-500 transition-colors">
                         <X className="w-3 h-3" />
                       </button>
                     </motion.div>
                   ))}
                   {reviewers.length === 0 && <p className="text-[9px] text-slate-700 font-bold uppercase tracking-widest w-full text-center py-2 italic">Sin revisores definidos</p>}
                </div>
              </div>
            )}
          </section>
          
          {/* LOCATION HIERARCHY SECTION */}
          <section id="location-section" className={cn(
            "bg-slate-50 dark:bg-slate-900/40 p-8 lg:p-10 rounded-[2.5rem] border transition-all duration-500 space-y-10",
            showLocationError ? "border-red-500 shadow-lg shadow-red-500/10" : "border-slate-200 dark:border-slate-800"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg transition-colors",
                  showLocationError ? "bg-red-500 shadow-red-500/20" : "bg-emerald-500 shadow-emerald-500/20"
                )}>
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={cn("text-sm font-black uppercase tracking-tight", showLocationError ? "text-red-500" : "text-slate-900 dark:text-white")}>
                    Ubicación del Hallazgo <span className="text-red-500 font-bold ml-1">*</span>
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Define la zona de incidencia jerárquicamente</p>
                </div>
              </div>
              {showLocationError && (
                <div className="bg-red-500/10 text-red-500 text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border border-red-500/20 animate-bounce">
                  Selección obligatoria
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* UNITY */}
              <div className="space-y-4">
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-600 px-1">Unidad Estructural</label>
                <div className="relative group/select">
                  <select 
                    multiple
                    value={selectedUnits}
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions, option => option.value);
                      setSelectedUnits(values);
                      setSelectedLevels([]); // Reset dependencies
                      setSelectedSpaces([]);
                      if (values.length > 0) setShowLocationError(false);
                    }}
                    className={cn(
                      "w-full bg-white dark:bg-slate-950 border rounded-2xl p-4 text-[11px] font-bold uppercase tracking-tight text-slate-900 dark:text-white min-h-[140px] focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none",
                      showLocationError && selectedUnits.length === 0 ? "border-red-500" : "border-slate-200 dark:border-slate-800"
                    )}
                  >
                    <option value="NINGUNA" className="p-2 rounded-lg m-1 checked:bg-slate-500/10 checked:text-slate-500 italic">NINGUNA</option>
                    {hierarchyUnits
                      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
                      .map(unit => (
                        <option key={unit.id} value={unit.name} className="p-2 rounded-lg m-1 checked:bg-emerald-500/10 checked:text-emerald-500 transition-colors">
                          {unit.name}
                        </option>
                      ))}
                  </select>
                  <p className="text-[8px] text-slate-500 mt-2 px-1 font-bold">MANTÉN CTRL/CMD PARA SELECCIÓN MÚLTIPLE</p>
                </div>
              </div>

              {/* LEVEL */}
              <div className="space-y-4">
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500 dark:text-emerald-400 px-1">Nivel / Piso</label>
                <div className="relative">
                  <select 
                    multiple
                    disabled={selectedUnits.length === 0}
                    value={selectedLevels}
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions, option => option.value);
                      setSelectedLevels(values);
                      setSelectedSpaces([]); // Reset dependency
                    }}
                    className={cn(
                      "w-full bg-white dark:bg-slate-950 border rounded-2xl p-4 text-[11px] font-bold uppercase tracking-tight text-slate-900 dark:text-white min-h-[140px] focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none",
                      selectedUnits.length === 0 && "opacity-40 cursor-not-allowed",
                      showLocationError && selectedLevels.length === 0 ? "border-red-500" : "border-slate-200 dark:border-slate-800"
                    )}
                  >
                    {getAvailableLevels().map(level => (
                      <option key={level} value={level} className={cn("p-2 rounded-lg m-1 checked:bg-emerald-500/10 checked:text-emerald-500", level === "NINGUNA" && "italic")}>{level}</option>
                    ))}
                  </select>
                  {selectedUnits.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center p-4 bg-white/10 dark:bg-black/10 backdrop-blur-[1px] rounded-2xl pointer-events-none">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Seleccione una Unidad</span>
                    </div>
                  )}
                </div>
              </div>

              {/* SPACE */}
              <div className="space-y-4">
                <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-blue-500 dark:text-blue-400 px-1">Espacio Específico</label>
                <div className="relative">
                  <select 
                    multiple
                    disabled={selectedLevels.length === 0}
                    value={selectedSpaces}
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions, option => option.value);
                      setSelectedSpaces(values);
                    }}
                    className={cn(
                      "w-full bg-white dark:bg-slate-950 border rounded-2xl p-4 text-[11px] font-bold uppercase tracking-tight text-slate-900 dark:text-white min-h-[140px] focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none",
                      selectedLevels.length === 0 && "opacity-40 cursor-not-allowed",
                      showLocationError && selectedSpaces.length === 0 ? "border-red-500" : "border-slate-200 dark:border-slate-800"
                    )}
                  >
                    {getAvailableSpaces().map(space => (
                      <option key={space} value={space} className={cn("p-2 rounded-lg m-1 checked:bg-blue-500/10 checked:text-blue-500", space === "NINGUNA" && "italic")}>{space}</option>
                    ))}
                  </select>
                  {selectedLevels.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center p-4 bg-white/10 dark:bg-black/10 backdrop-blur-[1px] rounded-2xl pointer-events-none">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Seleccione un Nivel</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Annexes */}
          {isFieldVisible('attachments') && (
            <section className="space-y-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
                 <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-slate-50 dark:bg-slate-900 text-slate-400 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-800">
                      <Paperclip className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white leading-none">Documentación y Evidencia</label>
                      <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest mt-1">Soporte Técnico y Anexos</p>
                    </div>
                 </div>
                 <div className="flex flex-wrap gap-3">
                   <button 
                     type="button" 
                     onClick={() => setIsCDEOpen(true)}
                     className="flex items-center gap-2.5 px-5 py-2.5 bg-white text-[#020617] rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all shadow-xl shadow-white/5 active:scale-95"
                   >
                     <Package className="w-3.5 h-3.5" /> CDE HUB
                   </button>
                   <label className="flex items-center gap-2.5 px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm cursor-pointer active:scale-95">
                     <Plus className="w-3.5 h-3.5 text-blue-400" /> Cargar Local
                     <input type="file" multiple accept="image/*,video/*,application/pdf" className="hidden" onChange={handleFileUpload} />
                   </label>
                   <label className="flex items-center gap-2.5 px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm cursor-pointer active:scale-95">
                     <Video className="w-3.5 h-3.5 text-blue-400" /> Video
                     <input 
                      type="file" 
                      accept="video/*" 
                      capture="environment" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const url = URL.createObjectURL(file);
                          setAttachments([...attachments, { 
                            id: Math.random().toString(36).substr(2, 9), 
                            name: `Video_${new Date().getTime()}`, 
                            url: url, 
                            type: file.type || 'video/mp4',
                            category: 'video' 
                          }]);
                        }
                      }}
                     />
                   </label>
                   <label className="flex items-center gap-2.5 px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm cursor-pointer active:scale-95">
                     <Camera className="w-3.5 h-3.5 text-emerald-400" /> Foto
                     <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const url = URL.createObjectURL(file);
                          setAttachments([...attachments, { 
                            id: Math.random().toString(36).substr(2, 9), 
                            name: `Captura_${new Date().getTime()}`, 
                            url: url, 
                            type: file.type || 'image/jpeg',
                            category: 'image' 
                          }]);
                        }
                      }}
                     />
                   </label>
                 </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {attachments.map((att, index) => (
                  <motion.div 
                    key={index} 
                    initial={{ opacity: 0, scale: 0.9 }} 
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 bg-slate-950 border border-slate-900 rounded-[2rem] relative group shadow-2xl flex flex-col gap-5"
                  >
                    <div className="flex justify-between items-start">
                      <div className="w-11 h-11 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-slate-700 shadow-sm overflow-hidden bg-center bg-cover">
                        {att.category === 'image' && att.url ? (
                          <img src={att.url} className="w-full h-full object-cover" />
                        ) : att.category === 'video' && att.url ? (
                          <video src={att.url} className="w-full h-full object-cover" muted playsInline />
                        ) : att.category === 'image' ? (
                          <ImageIcon className="w-5 h-5" />
                        ) : (
                          <FileText className="w-5 h-5" />
                        )}
                      </div>
                      <button 
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="p-2.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <input
                        type="text"
                        placeholder="Identificar recurso..."
                        value={att.name}
                        onChange={(e) => updateAttachment(index, 'name', e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-white font-bold outline-none focus:border-slate-600 transition-all shadow-inner"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {['file', 'image', 'video', 'bim_model', 'plan_pdf'].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => updateAttachment(index, 'category', cat as any)}
                            className={cn(
                              "px-2.5 py-1 rounded-full border text-[7px] font-black uppercase tracking-widest transition-all",
                              att.category === cat ? "bg-white border-white text-[#020617] shadow-lg shadow-white/5" : "bg-transparent border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400 shadow-sm"
                            )}
                          >
                            {cat.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {attachments.length === 0 && (
                  <div className="col-span-full py-16 text-center border border-dashed border-slate-900 rounded-[2.5rem] bg-slate-950/50">
                    <div className="w-16 h-16 bg-slate-900 rounded-[2rem] border border-slate-800 flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <Paperclip className="w-8 h-8 text-slate-800 rotate-45" />
                    </div>
                    <p className="text-[9px] text-slate-700 font-black uppercase tracking-[0.3em]">Sin documentación vinculada</p>
                  </div>
                )}
              </div>
            </section>
          )}

            </>
          ) : (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
               {/* INFO GENERAL DEL INFORME */}
               <section className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div className="group">
                      <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-600 mb-3 px-1">TÍTULO DEL INFORME <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={reportTitle}
                        onChange={(e) => setReportTitle(e.target.value)}
                        placeholder="Ej: Informe de Avance Arquitectónico - Torre A N05"
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 shadow-inner rounded-2xl text-[13px] font-bold text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-600 mb-3 px-1">FECHA DE CREACIÓN</label>
                      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 rounded-2xl text-[13px] font-bold text-slate-400 border border-slate-200 dark:border-slate-800">
                        {new Date().toLocaleDateString()} (AUTOMÁTICA)
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-600 mb-3 px-1">RESPONSABLE ASIGNADO</label>
                      <div className="px-6 py-5 bg-indigo-500/5 border border-indigo-500/10 rounded-[2.5rem] flex items-center gap-5">
                         <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                            <UserIcon className="w-6 h-6" />
                         </div>
                         <div>
                            <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">Director de Obra</p>
                            <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Roberto Gómez (roberto.gomez@constructora.com)</p>
                         </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-600 mb-3 px-1">COMITÉ DE REVISIÓN</label>
                      <div className="space-y-4">
                        <select 
                          className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-500 border border-slate-200 dark:border-slate-800 outline-none"
                          onChange={(e) => {
                            if (e.target.value && !reportReviewers.includes(e.target.value)) {
                              setReportReviewers([...reportReviewers, e.target.value]);
                            }
                            e.target.value = '';
                          }}
                        >
                          <option value="">AÑADIR REVISOR...</option>
                          {sortedTeam.map(t => <option key={t.position} value={t.position}>{t.position}</option>)}
                        </select>
                        <div className="flex flex-wrap gap-2">
                          {reportReviewers.map(r => (
                            <div key={r} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                               <span className="text-[8px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">{r}</span>
                               <button type="button" onClick={() => setReportReviewers(reportReviewers.filter(rv => rv !== r))} className="text-red-500 hover:text-red-600">
                                  <X className="w-3 h-3" />
                               </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
               </section>

               <div className="h-px bg-slate-100 dark:bg-slate-800/50" />

               {/* BLOQUES DE INFORMACIÓN */}
               <section className="space-y-10">
                  <div className="flex items-center justify-between px-1">
                     <div>
                        <h4 className="text-xl font-display font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                           Contenido del Informe
                           <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-900 text-slate-400 rounded-full text-[10px]">{reportBlocks.length}</span>
                        </h4>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Detalle técnico por ubicación o hallazgo</p>
                     </div>
                     <button 
                       type="button"
                       onClick={addReportBlock}
                       className="flex items-center gap-3 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 group"
                     >
                        <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> Agregar Bloque
                     </button>
                  </div>

                  <div className="space-y-12">
                     {reportBlocks.map((block, idx) => (
                        <div key={block.id} className="relative p-1 bg-white dark:bg-[#020617] border border-slate-200 dark:border-slate-800 rounded-[3rem] shadow-sm">
                           {idx > 0 && (
                             <button 
                               type="button"
                               onClick={() => removeReportBlock(block.id)} 
                               className="absolute -top-4 -right-4 w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-red-600 transition-colors z-10 active:scale-95 shadow-red-500/20"
                             >
                                <Trash2 className="w-5 h-5" />
                             </button>
                           )}
                           
                           <div className="p-10">
                              <div className="flex flex-col gap-10">
                                 {/* TOP SECTION: DESCRIPTION & LOCATION */}
                                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                    <div className="space-y-4">
                                       <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 px-1 flex items-center justify-between">
                                          <span>DESCRIPCIÓN TÉCNICA <span className="text-rose-500">*</span></span>
                                          <button
                                            type="button"
                                            onClick={() => isListening ? stopSpeechRecognition() : startSpeechRecognition((text) => updateReportBlock(block.id, { description: block.description ? `${block.description} ${text}` : text }))}
                                            className={cn(
                                              "flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition-all",
                                              isListening ? "bg-rose-500 text-white animate-pulse" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                            )}
                                          >
                                            {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                                            {isListening ? 'Parar dictado' : 'Dictar por voz'}
                                          </button>
                                       </label>
                                       <textarea
                                          value={block.description}
                                          onChange={(e) => updateReportBlock(block.id, { description: e.target.value })}
                                          placeholder="Describa a detalle el estado, avance o hallazgo detectado..."
                                          className="w-full px-8 py-7 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] text-[14px] font-medium text-slate-900 dark:text-white min-h-[220px] outline-none shadow-sm resize-none focus:border-indigo-500 transition-all placeholder:text-slate-300 custom-scrollbar"
                                       />
                                    </div>

                                    <div className="space-y-4">
                                       <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 px-1">
                                          SOPORTE GRÁFICO Y PLANIMETRÍA
                                       </label>
                                       <div className="w-full bg-slate-50/50 dark:bg-slate-900/50 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 flex flex-col items-center justify-center min-h-[220px] transition-all hover:bg-slate-50 dark:hover:bg-slate-900 group relative">
                                          {block.attachments && block.attachments.some(a => a.category === 'image' || a.category === 'video') ? (
                                            <div className="grid grid-cols-2 gap-3 w-full h-full overflow-y-auto custom-scrollbar p-2">
                                              {block.attachments.filter(a => a.category === 'image' || a.category === 'video').map(att => (
                                                <div key={att.id} className="relative aspect-video rounded-xl overflow-hidden group/item shadow-sm">
                                                  {att.category === 'video' ? (
                                                    <video src={att.url} className="w-full h-full object-cover" muted playsInline />
                                                  ) : (
                                                    <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                                                  )}
                                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <button 
                                                      type="button" 
                                                      onClick={() => updateReportBlock(block.id, { attachments: block.attachments.filter(a => a.id !== att.id) })}
                                                      className="p-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors shadow-lg"
                                                    >
                                                      <Trash2 className="w-4 h-4" />
                                                    </button>
                                                  </div>
                                                  {att.category === 'video' && (
                                                    <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 rounded text-[7px] text-white font-bold uppercase tracking-widest">Video</div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <div className="flex flex-col items-center gap-4 text-center">
                                              <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                                                <ImageIcon className="w-8 h-8 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                                              </div>
                                              <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Sin Documentación Vinculada</p>
                                            </div>
                                          )}
                                          
                                          {/* Floating Buttons */}
                                          <div className="absolute bottom-6 right-6 flex gap-3">
                                            <button 
                                              type="button"
                                              onClick={() => { setCdeTarget({ type: 'block', blockId: block.id }); setIsCDEOpen(true); }}
                                              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl text-[8px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 shadow-xl hover:scale-105 active:scale-95 transition-all"
                                            >
                                              <Package className="w-3 h-3" /> CDE HUB
                                            </button>
                                            <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl text-[8px] font-black uppercase tracking-widest text-blue-500 shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer">
                                              <Plus className="w-3 h-3" /> Cargar Local
                                              <input 
                                                type="file" 
                                                multiple 
                                                accept="image/*,plan/*,pdf/*,video/*"
                                                className="hidden" 
                                                onChange={(e) => {
                                                  const files = e.target.files;
                                                  if (files) {
                                                    Array.from(files).forEach(file => {
                                                      const url = URL.createObjectURL(file);
                                                      const isVideo = file.type.startsWith('video/');
                                                      const newAtt = { 
                                                        id: Math.random().toString(36).substr(2, 9), 
                                                        name: file.name, 
                                                        url: url, 
                                                        type: file.type || 'application/octet-stream',
                                                        category: isVideo ? 'video' : 'image' 
                                                      };
                                                      updateReportBlock(block.id, {
                                                        attachments: [...(block.attachments || []), newAtt as any]
                                                      });
                                                    });
                                                  }
                                                }}
                                              />
                                            </label>
                                            <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/50 rounded-xl text-[8px] font-black uppercase tracking-widest text-emerald-500 shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer">
                                              <Camera className="w-3 h-3" /> Captura
                                              <input 
                                                type="file" 
                                                accept="image/*,video/*" 
                                                capture="environment" 
                                                className="hidden" 
                                                onChange={(e) => {
                                                  const file = e.target.files?.[0];
                                                  if (file) {
                                                    const url = URL.createObjectURL(file);
                                                    const isVideo = file.type.startsWith('video/');
                                                    const newAtt = { 
                                                      id: Math.random().toString(36).substr(2, 9), 
                                                      name: `${isVideo ? 'Video' : 'Captura'}_${new Date().getTime()}`, 
                                                      url: url, 
                                                      type: file.type,
                                                      category: isVideo ? 'video' : 'image' 
                                                    };
                                                    updateReportBlock(block.id, {
                                                      attachments: [...(block.attachments || []), newAtt as any]
                                                    });
                                                  }
                                                }}
                                              />
                                            </label>
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                                    
                                    <div className="space-y-6">
                                       <div className="space-y-4">
                                          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400 mb-2 px-1 flex items-center gap-2">
                                             <MapPin className="w-4 h-4" /> UBICACIÓN DEL HALLAZGO
                                          </label>
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                             <div className="space-y-2">
                                                <span className="text-[8px] font-black uppercase text-slate-500 ml-1">Unidad / Torre</span>
                                                <select 
                                                  multiple
                                                  value={block.location.units}
                                                  onChange={(e) => {
                                                     const vals = Array.from(e.target.selectedOptions, o => o.value);
                                                     updateReportBlock(block.id, { location: { ...block.location, units: vals, levels: [], spaces: [] } });
                                                  }}
                                                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-[10px] font-bold uppercase tracking-tight text-slate-700 dark:text-slate-300 h-[140px] outline-none shadow-inner transition-all focus:border-cyan-500/50"
                                                >
                                                   <option value="NINGUNA" className="p-1 italic text-slate-400">NINGUNA</option>
                                                   {[...hierarchyUnits].sort((a,b) => a.name.localeCompare(b.name)).map(u => <option key={u.id} value={u.name} className="p-1">{u.name}</option>)}
                                                </select>
                                             </div>
                                             <div className="space-y-2">
                                                <span className="text-[8px] font-black uppercase text-slate-500 ml-1">Nivel / Piso</span>
                                                <select 
                                                  multiple
                                                  value={block.location.levels}
                                                  onChange={(e) => {
                                                     const vals = Array.from(e.target.selectedOptions, o => o.value);
                                                     updateReportBlock(block.id, { location: { ...block.location, levels: vals, spaces: [] } });
                                                  }}
                                                  disabled={block.location.units.length === 0}
                                                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-[10px] font-bold uppercase tracking-tight text-slate-700 dark:text-slate-300 h-[140px] outline-none shadow-inner transition-all focus:border-cyan-500/50 disabled:opacity-30"
                                                >
                                                   <option value="NINGUNA" className="p-1 italic text-slate-400">NINGUNA</option>
                                                   {hierarchyUnits
                                                     .filter(u => block.location.units.includes(u.name))
                                                     .flatMap(u => u.levels)
                                                     .sort((a,b) => a.name.localeCompare(b.name))
                                                     .map(l => <option key={l.id} value={l.name} className="p-1">{l.name}</option>)}
                                                </select>
                                             </div>
                                             <div className="space-y-2">
                                                <span className="text-[8px] font-black uppercase text-slate-500 ml-1">Espacio Específico</span>
                                                <select 
                                                  multiple
                                                  value={block.location.spaces}
                                                  onChange={(e) => {
                                                     const vals = Array.from(e.target.selectedOptions, o => o.value);
                                                     updateReportBlock(block.id, { location: { ...block.location, spaces: vals } });
                                                  }}
                                                  disabled={block.location.levels.length === 0}
                                                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-[10px] font-bold uppercase tracking-tight text-slate-700 dark:text-slate-300 h-[140px] outline-none shadow-inner transition-all focus:border-cyan-500/50 disabled:opacity-30"
                                                >
                                                   <option value="NINGUNA" className="p-1 italic text-slate-400">NINGUNA</option>
                                                   {hierarchyUnits
                                                     .filter(u => block.location.units.includes(u.name))
                                                     .flatMap(u => u.spaces)
                                                     .filter(s => s.levelName && block.location.levels.includes(s.levelName))
                                                     .sort((a,b) => (a.name || '').localeCompare(b.name || ''))
                                                     .map(s => <option key={s.id} value={s.name} className="p-1">{s.name}</option>)}
                                                </select>
                                             </div>
                                          </div>
                                       </div>
                                    </div>
                                 </div>

                                 {/* BOTTOM SECTION: ATTACHMENTS & CONVERSION */}
                                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 pt-10 border-t border-slate-100 dark:border-slate-800/50 text-wrap">
                                    <div className="space-y-4">
                                       <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 px-1 flex items-center gap-2">
                                          <Paperclip className="w-4 h-4" /> ARCHIVOS ADJUNTOS Y EVIDENCIA
                                       </label>
                                       <div className="flex gap-4">
                                          <div className="flex flex-col gap-3">
                                             <button 
                                               type="button" 
                                               onClick={() => {
                                                  setCdeTarget({ type: 'block', blockId: block.id });
                                                  setIsCDEOpen(true);
                                               }}
                                               className="w-14 h-14 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-center hover:scale-105 transition-all shadow-sm text-slate-500 hover:border-indigo-500 hover:text-indigo-500 active:scale-95"
                                             >
                                                <Package className="w-6 h-6" />
                                             </button>
                                             <label className="w-14 h-14 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-center hover:scale-105 transition-all shadow-sm cursor-pointer text-blue-500 hover:border-blue-500 active:scale-95">
                                                <Plus className="w-6 h-6" />
                                                <input 
                                                   type="file" 
                                                   multiple 
                                                   className="hidden" 
                                                   onChange={(e) => {
                                                     const files = e.target.files;
                                                     if (files) {
                                                       Array.from(files).forEach(file => {
                                                         const url = URL.createObjectURL(file);
                                                         const newAtt = { 
                                                           id: Math.random().toString(36).substr(2, 9), 
                                                           name: file.name, 
                                                           url: url, 
                                                           type: file.type || 'application/octet-stream',
                                                           category: 'file' 
                                                         };
                                                         updateReportBlock(block.id, {
                                                           attachments: [...(block.attachments || []), newAtt as any]
                                                         });
                                                       });
                                                     }
                                                   }}
                                                />
                                             </label>
                                          </div>
                                          <div className="flex-1 overflow-x-auto custom-scrollbar pb-2">
                                             <div className="flex gap-3 min-w-min">
                                                {block.attachments.length === 0 ? (
                                                   <div className="w-full min-w-[300px] h-14 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-center bg-slate-50/30 dark:bg-slate-900/10">
                                                      <p className="text-[9px] text-slate-300 font-black uppercase tracking-widest">Sin Documentación Adjunta</p>
                                                   </div>
                                                ) : (
                                                   block.attachments.map(att => (
                                                      <div key={att.id} className="flex-shrink-0 flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm group">
                                                         <div className="w-8 h-8 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                                                            <ImageIcon className="w-4 h-4 text-slate-400" />
                                                         </div>
                                                         <div className="max-w-[100px]">
                                                            <p className="text-[9px] font-bold text-slate-900 dark:text-white truncate">{att.name}</p>
                                                         </div>
                                                         <button type="button" onClick={() => updateReportBlock(block.id, { attachments: block.attachments.filter(a => a.id !== att.id ) })} className="text-rose-500 p-1 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors">
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                         </button>
                                                      </div>
                                                   ))
                                                )}
                                             </div>
                                          </div>
                                       </div>
                                    </div>

                                    <div className="flex items-center justify-end">
                                       <div className="w-full max-w-sm flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-600/5 p-6 rounded-[2rem] border border-indigo-100 dark:border-indigo-600/10 shadow-sm">
                                          <div className="flex items-center gap-4">
                                             <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl transition-all", block.issueId ? "bg-emerald-500 shadow-emerald-500/30" : "bg-white dark:bg-slate-900 text-slate-300 shadow-indigo-100 dark:shadow-none")}>
                                                {block.issueId ? <CheckCircle2 className="w-6 h-6 text-white" /> : <AlertCircle className="w-6 h-6" />}
                                             </div>
                                             <div>
                                                <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
                                                   {block.issueId ? 'REPORTADO' : 'NOTIFICAR HALLAZGO'}
                                                </p>
                                                <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">
                                                   {block.issueId ? `REFERENCIA: ${block.issueId?.slice(-6).toUpperCase()}` : 'VINCULAR COMO INCIDENCIA'}
                                                </p>
                                             </div>
                                          </div>
                                          {!block.issueId && (
                                             <button 
                                               type="button"
                                               onClick={() => convertBlockToIssue(block)}
                                               className="px-6 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:scale-105 active:scale-95 transition-all text-wrap"
                                             >
                                                Convertir
                                             </button>
                                          )}
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </section>
            </div>
          )}

          <AnimatePresence>
            {isCDEOpen && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-12 bg-[#020617]/60 backdrop-blur-3xl">
                 <motion.div 
                   initial={{ opacity: 0, scale: 0.9, y: 20 }}
                   animate={{ opacity: 1, scale: 1, y: 0 }}
                   exit={{ opacity: 0, scale: 0.9, y: 20 }}
                   className="bg-white dark:bg-[#020617] w-full max-w-3xl rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
                 >
                    <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-white/80 dark:bg-[#020617]/80 backdrop-blur-xl">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-[#020617] shadow-xl shadow-white/5">
                            <Package className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-xl font-display font-black text-slate-800 dark:text-white tracking-tight">Hub de Recursos CDE</h3>
                            <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mt-0.5">Explorador de Archivos del Proyecto</p>
                          </div>
                       </div>
                       <button type="button" onClick={() => setIsCDEOpen(false)} className="p-3.5 hover:bg-slate-900 rounded-2xl transition-all border border-slate-800 shadow-sm active:scale-95 group">
                         <X className="w-5 h-5 text-slate-500 group-hover:text-white" />
                       </button>
                    </div>
                    <div className="flex-1 overflow-auto p-8 grid grid-cols-1 gap-4 custom-scrollbar">
                       {[
                         { id: '1', name: 'Plano_Arquitectura_N05.dwg', category: 'plan_dwg', url: '#' },
                         { id: '2', name: 'Modelo_Estructura_V2.ifc', category: 'bim_model', url: '#' },
                         { id: '3', name: 'Detalle_Empalme_Viga.pdf', category: 'plan_pdf', url: '#' },
                         { id: '4', name: 'Inspección_Cimentación.mp4', category: 'video', url: '#' },
                       ].map(file => (
                         <button 
                           key={file.id} 
                           type="button"
                           onClick={() => handleCDEFilePick(file)}
                           className="flex items-center gap-6 p-6 bg-slate-900/50 border border-slate-800 rounded-[1.75rem] hover:border-slate-700 hover:bg-slate-900 transition-all text-left group shadow-sm active:scale-[0.99]"
                         >
                            <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-slate-600 group-hover:bg-white group-hover:text-[#020617] transition-all shadow-sm">
                               <Package className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                               <p className="text-[13px] font-black text-white uppercase tracking-tight group-hover:text-blue-400 transition-colors">{file.name}</p>
                               <div className="flex items-center gap-2 mt-1.5">
                                  <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest">{file.category.replace('_', ' ')}</p>
                               </div>
                            </div>
                            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl group-hover:bg-white group-hover:text-[#020617] transition-all">
                               <Plus className="w-4 h-4 group-hover:scale-125 transition-transform" />
                            </div>
                         </button>
                       ))}
                    </div>
                    <div className="p-6 border-t border-slate-800 bg-slate-900/10 flex justify-center">
                       <p className="text-[9px] text-slate-700 font-bold uppercase tracking-widest">Sincronizado con Repositorio Central de Obra</p>
                    </div>
                 </motion.div>
              </div>
            )}
            
            {convertingBlockId && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-8 bg-white/80 dark:bg-[#020617]/80 backdrop-blur-xl">
                 <motion.div 
                   initial={{ opacity: 0, scale: 0.9, y: 20 }}
                   animate={{ opacity: 1, scale: 1, y: 0 }}
                   exit={{ opacity: 0, scale: 0.9, y: 20 }}
                   className="bg-white dark:bg-[#020617] w-full max-w-xl rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl flex flex-col p-10"
                 >
                    <div className="flex items-center gap-4 mb-8">
                       <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                         <Send className="w-6 h-6" />
                       </div>
                       <div>
                         <h3 className="text-xl font-display font-black text-slate-900 dark:text-white tracking-tight">Finalizar Hallazgo</h3>
                         <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Complete los detalles obligatorios para el registro</p>
                       </div>
                    </div>
                    
                    <div className="space-y-6 text-left font-sans">
                       <div>
                          <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 ml-1">Título del Hallazgo</label>
                          <input 
                            placeholder="Ej: Defecto en soldadura..."
                            className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[13px] font-bold outline-none text-slate-900 dark:text-white"
                            id="conv-title"
                          />
                       </div>
                       <div className="grid grid-cols-2 gap-6">
                          <div>
                             <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 ml-1">Tipo de Incidencia</label>
                             <select className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] font-black uppercase outline-none text-slate-900 dark:text-white" id="conv-type">
                                {ISSUE_TYPES.sort().map(t => <option key={t} value={t}>{t}</option>)}
                             </select>
                          </div>
                          <div>
                             <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 ml-1">Grado de Acción (Prioridad)</label>
                             <select className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] font-black uppercase outline-none text-slate-900 dark:text-white" id="conv-priority">
                                {Object.entries(DEGREE_OF_ACTION).filter(([key]) => ['inmediata', 'urgente', 'pronta', 'posterior'].includes(key)).map(([k, v]) => <option key={k} value={k}>{(v as any).label}</option>)}
                             </select>
                          </div>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-6">
                          <div>
                             <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 ml-1">Afectación del Proyecto</label>
                             <select className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] font-black uppercase outline-none text-slate-900 dark:text-white" id="conv-impact">
                                {customImpacts.sort().map(opt => <option key={opt} value={opt}>{opt}</option>)}
                             </select>
                          </div>
                          <div>
                             <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 ml-1">Vencimiento Estimado</label>
                             <input 
                                type="date"
                                id="conv-dueDate"
                                defaultValue={new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0]}
                                className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] font-bold outline-none text-slate-900 dark:text-white"
                             />
                          </div>
                       </div>

                       <div>
                          <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 ml-1">Asignar Responsable de Ejecución</label>
                          <select className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[11px] font-black uppercase outline-none text-slate-900 dark:text-white" id="conv-assign">
                             {sortedTeam.map(t => <option key={t.position} value={t.position}>{t.position}</option>)}
                          </select>
                       </div>
                    </div>
                    
                    <div className="flex gap-4 mt-10">
                       <button 
                         type="button"
                         onClick={() => setConvertingBlockId(null)} 
                         className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                       >
                         Cancelar
                       </button>
                       <button 
                         type="button"
                         onClick={() => {
                            const t = (document.getElementById('conv-title') as HTMLInputElement).value;
                            const tp = (document.getElementById('conv-type') as HTMLSelectElement).value;
                            const pr = (document.getElementById('conv-priority') as HTMLSelectElement).value;
                            const as = (document.getElementById('conv-assign') as HTMLSelectElement).value;
                            const im = (document.getElementById('conv-impact') as HTMLSelectElement).value;
                            const dd = (document.getElementById('conv-dueDate') as HTMLInputElement).value;
                            
                            if (!t) { alert("Título es obligatorio"); return; }
                            
                            finalizeConversion(convertingBlockId, {
                               title: t,
                               type: tp,
                               degreeOfAction: pr as any,
                               assignedPosition: as,
                               impact: [im],
                               dueDate: dd,
                            });
                         }}
                         className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all text-white"
                       >
                         CREAR HALLAZGO
                       </button>
                    </div>
                 </motion.div>
              </div>
            )}
          </AnimatePresence>
        </form>

        {/* Footer */}
        <div className="p-8 lg:p-10 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-white/80 dark:bg-[#020617]/80 backdrop-blur-xl flex flex-col md:flex-row justify-between items-center gap-6 transition-colors font-sans">
          <div className="hidden lg:flex flex-col">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-700 uppercase tracking-[0.3em] mb-1 leading-none">Certificación de Registro:</span>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] text-slate-500 dark:text-slate-600 font-black uppercase tracking-widest">Protocolo de Verificación CDE (V2.1.0)</span>
            </div>
          </div>
          <div className="flex gap-5 w-full md:w-auto">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 md:flex-none px-10 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors active:scale-95"
            >
              Cancelar
            </button>
            <button 
              onClick={activeMode === 'issue' ? handleSubmit : handleReportSubmit}
              disabled={(activeMode === 'issue' ? !title : !reportTitle) || isSubmitting}
              className={cn(
                "flex-1 md:flex-none px-14 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3",
                activeMode === 'issue' 
                  ? "bg-slate-900 dark:bg-white text-white dark:text-[#020617] shadow-slate-900/10 dark:shadow-white/5 hover:bg-black dark:hover:bg-slate-100"
                  : "bg-indigo-600 text-white shadow-indigo-600/20 hover:bg-indigo-700"
              )}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  PROCESANDO...
                </>
              ) : (
                <>
                  {activeMode === 'issue' ? <Send className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  {activeMode === 'issue' ? 'Emitir Hallazgo' : 'Finalizar Informe'}
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}