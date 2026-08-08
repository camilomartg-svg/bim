import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db, storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { handleFirestoreError, OperationType } from '../services/firestore-errors';
import { Issue, Comment, Attachment, DEGREE_OF_ACTION } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  X, Paperclip, Send, Clock, User as UserIcon, CheckCircle2, XCircle, Calendar, AlertTriangle, Trash2,
  ExternalLink, FileText, Image as ImageIcon, Video, Box, Map as MapIcon, ChevronRight, MessageSquare, MapPin, Tag, ShieldCheck, Zap, Eye, ClipboardList, ArrowRight, AlertCircle,
  TrendingUp, Maximize2, Layers, Save, Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format, differenceInDays, isPast } from 'date-fns';
import { getMedicionDueDate, getEficaciaDueDate, isMedicionAlertActive, isEficaciaAlertActive, generateFollowUpCode } from '../utils/followUpUtils';
import { getProjectConfig, subscribeToTeam, deleteIssue, syncIssueStatusToParentReport } from '../services/firebaseService';
import { uploadFileToDrive, getAuthenticatedDriveUrl } from '../utils/googleDriveUtils';

interface IssueDetailProps {
  issue: Issue;
  onClose: () => void;
  onOpenReport?: (reportId: string) => void;
}

export default function IssueDetail({ issue: initialIssue, onClose, onOpenReport }: IssueDetailProps) {
  const [issue, setIssue] = useState<Issue>(initialIssue);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showAgreementPicker, setShowAgreementPicker] = useState(false);
  const [showRejectionPicker, setShowRejectionPicker] = useState(false);
  const [agreementDate, setAgreementDate] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [fieldSettings, setFieldSettings] = useState<any[]>([]);
  const [teamMemberMap, setTeamMemberMap] = useState<Record<string, string>>({});
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [showRedirectionPicker, setShowRedirectionPicker] = useState(false);
  const [selectedRedirection, setSelectedRedirection] = useState<any>(null);
  const { user, googleAccessToken } = useAuth();

  const [largo, setLargo] = useState<number | ''>('');
  const [ancho, setAncho] = useState<number | ''>('');
  const [alto, setAlto] = useState<number | ''>('');
  const [duracion, setDuracion] = useState<number | ''>('');
  const [isSavingAcopio, setIsSavingAcopio] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsUploadingPhoto(true);

    try {
      const base64UrlPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      let url = "";
      let driveFileId = "";
      let webViewLink = "";
      let uploadSuccess = false;

      const gToken = googleAccessToken || localStorage.getItem('google_drive_token');
      if (gToken) {
        try {
          console.log("Attempting direct upload to Google Drive first for file:", file.name);
          // Standard RCD Evidence destination folder
          const driveResult = await uploadFileToDrive(file, file.name, file.type, '1Bym51TtKVSzDsweJaMAh0VxCAAQQbU3w', gToken);
          url = driveResult.url;
          driveFileId = driveResult.id;
          webViewLink = driveResult.webViewLink;
          uploadSuccess = true;
          console.log("Google Drive upload successful:", driveResult);
        } catch (driveErr) {
          console.warn("Google Drive upload failed in detail panel, falling back to Firebase/Base64:", driveErr);
        }
      }

      if (!uploadSuccess) {
        try {
          const uploadPromise = async () => {
            const storageRef = ref(storage, `issues/${issue.id}/${Date.now()}_det_${file.name}`);
            const uploadResult = await uploadBytes(storageRef, file);
            return await getDownloadURL(uploadResult.ref);
          };

          const timeoutPromise = new Promise<string>((_, reject) => 
            setTimeout(() => reject(new Error("Storage timeout")), 4000)
          );

          url = await Promise.race([uploadPromise(), timeoutPromise]);
        } catch (uploadErr) {
          console.warn("Storage upload took fallback route to Base64 in details panel:", uploadErr);
          url = await base64UrlPromise;
        }
      }

      const attachment = {
        id: Date.now().toString(),
        name: file.name,
        type: file.type,
        url,
        category: (file.type.startsWith('image/') ? 'image' : 'file') as any,
        ...(driveFileId ? { driveFileId } : {}),
        ...(webViewLink ? { webViewLink } : {})
      };

      // Update Issue's attachments
      const updatedAttachments = [...(issue.attachments || []), attachment];
      await updateDoc(doc(db, 'issues', issue.id), {
        attachments: updatedAttachments,
        updatedAt: new Date().toISOString()
      });

      setIssue(prev => ({
        ...prev,
        attachments: updatedAttachments
      }));

      // Post a system comment in the chat
      await addDoc(collection(db, 'issues', issue.id, 'comments'), {
        userId: user?.id || 'system',
        userName: user?.name || 'SISTEMA',
        text: `📸 NUEVA EVIDENCIA DE CAMPO CARGADA:\n• El usuario ha subido el archivo **${file.name}** directamente desde el panel de control del hallazgo.${driveFileId ? ' Sincronizado en el repositorio oficial de Google Drive.' : ''}`,
        createdAt: new Date().toISOString(),
        userAvatar: user?.name ? user.name.charAt(0) : 'S',
        attachments: [attachment]
      });

      // Sync directly to the parent report document
      const reportId = issue.sourceReportId || (issue.id.startsWith('issue_e_apr_') ? issue.id.replace('issue_e_apr_', '') : null);
      if (reportId) {
        try {
          const reportRef = doc(db, 'reports', reportId);
          const reportSnap = await getDoc(reportRef);
          if (reportSnap.exists()) {
            const reportData = reportSnap.data();
            const existingMediaDuring = reportData.mediaDuring || [];
            await updateDoc(reportRef, {
              mediaDuring: [...existingMediaDuring, attachment],
              updatedAt: new Date().toISOString()
            });
            console.log("Details panel photo uploaded, synchronized straight to parent environmental report!", reportId);
          }
        } catch (syncErr) {
          console.error("Error syncing details photo to parent report:", syncErr);
        }
      }

      alert(driveFileId ? "¡Foto de evidencia cargada y guardada directamente en Google Drive con éxito!" : "¡Foto de evidencia cargada y sincronizada con éxito!");
    } catch (err) {
      console.error("Error uploading photo:", err);
      alert("Error al subir la fotografía.");
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (issue) {
      setLargo(issue.acopioLargo !== undefined && issue.acopioLargo !== null ? issue.acopioLargo : '');
      setAncho(issue.acopioAncho !== undefined && issue.acopioAncho !== null ? issue.acopioAncho : '');
      setAlto(issue.acopioAlto !== undefined && issue.acopioAlto !== null ? issue.acopioAlto : '');
      setDuracion(issue.acopioDuracionProceso !== undefined && issue.acopioDuracionProceso !== null ? issue.acopioDuracionProceso : '');
    }
  }, [issue]);

  const numLargo = Number(largo) || 0;
  const numAncho = Number(ancho) || 0;
  const numAlto = Number(alto) || 0;
  const calculatedArea = numAncho * numLargo;
  const calculatedVolumen = numAncho * numLargo * numAlto;

  const handleSaveAcopio = async () => {
    setIsSavingAcopio(true);
    try {
      const updateData = {
        acopioLargo: numLargo,
        acopioAncho: numAncho,
        acopioAlto: numAlto,
        acopioDuracionProceso: Number(duracion) || 0,
        acopioVolumen: calculatedVolumen,
        acopioAreaRecuperada: calculatedArea,
        updatedAt: new Date().toISOString()
      };
      await updateDoc(doc(db, 'issues', issue.id), updateData);
      
      setIssue(prev => ({
        ...prev,
        ...updateData
      }));

      await addDoc(collection(db, 'issues', issue.id, 'comments'), {
        userId: user?.id || 'system',
        userName: user?.name || 'SISTEMA',
        text: `📊 ACTUALIZACIÓN DE ACOPIO: Largo: ${numLargo}m, Ancho: ${numAncho}m, Alto: ${numAlto}m | Área final recuperada: ${calculatedArea.toFixed(1)}m² | Volumen total reutilizado: ${calculatedVolumen.toFixed(1)}m³ (Duración: ${duracion || 0} días).`,
        createdAt: new Date().toISOString()
      });

      // Synchronize directly with parent report and update the logs accordingly
      const reportId = issue.sourceReportId || (issue.id.startsWith('issue_e_apr_') ? issue.id.replace('issue_e_apr_', '') : null);
      if (reportId) {
        try {
          const reportRef = doc(db, 'reports', reportId);
          const reportSnap = await getDoc(reportRef);
          if (reportSnap.exists()) {
            const reportData = reportSnap.data();
            const existingLogs = reportData.logs || [];
            let updatedLogs = [...existingLogs];

            if (updatedLogs.length > 0) {
              // Edit/update the latest log's dimensions
              const latestIdx = updatedLogs.length - 1;
              const latestLog = updatedLogs[latestIdx];
              const density = latestLog.densidadSNR || 2300;
              updatedLogs[latestIdx] = {
                ...latestLog,
                largo: numLargo,
                ancho: numAncho,
                alto: numAlto,
                duracionProceso: Number(duracion) || 0,
                volumenReutilizado: calculatedVolumen,
                areaRecuperada: calculatedArea,
                quantity: calculatedVolumen * density
              };
            } else {
              // Log is empty, construct first entry
              const newLog = {
                id: 'log-' + Math.random().toString(36).substr(2, 9),
                material: 'PETREOS',
                quantity: calculatedVolumen * 2300,
                unit: 'KG',
                recipient: 'OBRA (REUTILIZACIÓN AUTÓCTONA)',
                certificateCode: 'AUT-RCD',
                date: new Date().toISOString().split('T')[0],
                observations: 'Modificado por control de acopio.',
                status: 'APROVECHADO',
                largo: numLargo,
                ancho: numAncho,
                alto: numAlto,
                duracionProceso: Number(duracion) || 0,
                volumenReutilizado: calculatedVolumen,
                areaRecuperada: calculatedArea,
                materialSNR: 'Concreto simple',
                densidadSNR: 2300
              };
              updatedLogs.push(newLog);
            }

            await updateDoc(reportRef, {
              logs: updatedLogs,
              updatedAt: new Date().toISOString()
            });
            console.log("Acopio changes successfully synchronized with the parent environmental report logs!");
          }
        } catch (syncErr) {
          console.error("Error synchronizing acopio changes to parent report:", syncErr);
        }
      }
      
      alert("¡Cubicación y control de acopio guardados con éxito!");
    } catch (err) {
      console.error("Error saving acopio metrics:", err);
      alert("Error al guardar los datos de acopio.");
    } finally {
      setIsSavingAcopio(false);
    }
  };

  useEffect(() => {
    async function loadConfig() {
      const fbConfig = await getProjectConfig();
      if (fbConfig) {
        let visibility = fbConfig.fieldVisibility || {};

        // Type Overrides (Apply on top of global)
        if (issue.type && fbConfig.typeOverrides?.[issue.type]) {
          const typeOverride = fbConfig.typeOverrides[issue.type];
          if (typeOverride.fieldVisibility) visibility = { ...visibility, ...typeOverride.fieldVisibility };
        }

        const fieldArray = Object.entries(visibility).map(([id, visible]) => ({ id, visible }));
        setFieldSettings(fieldArray);
      }
    }
    loadConfig();
  }, [issue.type]);

  const isFieldVisible = (id: string) => {
    if (fieldSettings.length === 0) return true;
    const field = fieldSettings.find(f => f.id === id);
    return field ? field.visible : true;
  };

  const getIssueAuditedProcess = (issue: Issue) => {
    if (issue.assignedEmail && teamMemberMap[issue.assignedEmail]) {
      return teamMemberMap[issue.assignedEmail];
    }
    if (issue.assignedName) {
      const found = teamMembers.find(m => m.name?.toLowerCase() === issue.assignedName?.toLowerCase());
      if (found?.team) return found.team;
    }
    return issue.assignedTeam || 'SIN ESPECIFICAR';
  };

  useEffect(() => {
    const unsubIssue = onSnapshot(doc(db, 'issues', initialIssue.id), (doc) => {
      if (doc.exists()) {
        setIssue({ id: doc.id, ...doc.data() } as Issue);
      }
    });

    const q = query(collection(db, 'issues', initialIssue.id, 'comments'), orderBy('createdAt', 'asc'));
    const unsubComments = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment)));
    });

    return () => {
      unsubIssue();
      unsubComments();
    };
  }, [initialIssue.id]);

  useEffect(() => {
    const unsubscribe = subscribeToTeam((teamData) => {
      setTeamMembers(teamData);
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

  const getEffectiveStatus = (issue: Issue): string => {
    if (issue.status === 'ACUERDO') return 'ACUERDO';
    if (issue.status === 'RESUELTA') return 'RESUELTA';
    if (issue.status === 'RESPONDIDA') return 'RESPONDIDA';
    if (issue.status === 'RECHAZADA') return 'RECHAZADA';
    
    if (issue.dueDate) {
      const dueDate = new Date(issue.dueDate + 'T23:59:59');
      if (isPast(dueDate)) return 'VENCIDA';
    }
    return issue.status || 'ACTIVO';
  };

  const isSSTIssue = issue.specialty === 'SST' || 
                    (issue.type && issue.type.toUpperCase().includes('SST')) ||
                    (issue.code && issue.code.toUpperCase().startsWith('SST'));

  const isEnvironmentalIssue = issue.specialty === 'AMBIENTAL' || 
                              issue.type === 'Informe Ambiental' ||
                              issue.type === 'No Conformidad Ambiental' ||
                              (issue.type && issue.type.toLowerCase().includes('ambiental')) ||
                              issue.reportType === 'ENVIRONMENTAL';

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
        await addDoc(collection(db, 'issues', issue.id, 'comments'), {
          userId: user?.id || 'system',
          userName: user?.name || 'SISTEMA',
          text: `RESPUESTA RECHAZADA: ${extra?.rejectionReason || 'No se proporcionó motivo.'}`,
          createdAt: new Date().toISOString()
        });
      }

      await updateDoc(doc(db, 'issues', issue.id), updateData);
      await syncIssueStatusToParentReport(issue, status);
      setShowAgreementPicker(false);
      setShowRejectionPicker(false);
    } catch (err) {
      console.error(err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `issues/${issue.id}`);
      } catch (firestoreErr: any) {
        alert("Error al actualizar la incidencia: " + firestoreErr.message);
      }
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
      await syncIssueStatusToParentReport(issue, 'REVISION_RESPONSABLE');
      
      await addDoc(collection(db, 'issues', issue.id, 'comments'), {
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
      await syncIssueStatusToParentReport(issue, 'RESPONDIDA');
      
      await addDoc(collection(db, 'issues', issue.id, 'comments'), {
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

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    try {
      await addDoc(collection(db, 'issues', issue.id, 'comments'), {
        userId: user.id,
        userName: user.name,
        text: newComment,
        createdAt: new Date().toISOString(),
      });
      setNewComment('');
    } catch (err) { 
      console.error(err); 
      try {
        handleFirestoreError(err, OperationType.CREATE, `issues/${issue.id}/comments`);
      } catch (firestoreErr: any) {
        alert("Error al añadir comentario: " + firestoreErr.message);
      }
    }
  };

  const [redirectionType, setRedirectionType] = useState<'COLABORADOR' | 'EJECUTOR' | 'RESPONSABLE'>('COLABORADOR');

  const handleRedirection = async (member: any) => {
    setIsUpdating(true);
    console.log(`[IssueDetail] Redirecting issue ${issue.id} to ${member.email} as ${redirectionType}`);
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

      console.log('[IssueDetail] updateDoc payload:', updateData);
      await updateDoc(doc(db, 'issues', issue.id), updateData);
      
      // Add a system comment about the redirection
      await addDoc(collection(db, 'issues', issue.id, 'comments'), {
        userId: user?.id || 'system',
        userName: user?.name || 'SISTEMA',
        text: `Incidencia redirigida a ${member.name} (${member.position}) como ${roleText}.`,
        createdAt: new Date().toISOString()
      });

      setShowRedirectionPicker(false);
      setSelectedRedirection(null);
    } catch (err) {
      console.error('[IssueDetail] Error in handleRedirection:', err);
      alert("Error al redirigir la incidencia. Verifique sus permisos de red y base de datos.");
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
      console.log("[IssueDetail] Attempting to delete issue:", issue.id);
      await deleteIssue(issue.id);
      console.log("[IssueDetail] Issue deleted successfully");
      onClose(); // Hide detail after deletion
    } catch (error: any) {
      console.error("[IssueDetail] Error deleting issue:", error);
      // Try to parse JSON error if it comes from handleFirestoreError
      let message = error.message;
      try {
        const parsed = JSON.parse(error.message);
        message = parsed.error || error.message;
      } catch (e) {
        // Not JSON
      }
      alert("Error al eliminar la incidencia: " + message);
    } finally {
      setIsUpdating(false);
      setShowConfirmDelete(false);
    }
  };

  const userEmail = user?.email?.toLowerCase();
  const isAuthor = issue.creatorId === user?.id || issue.authorEmail?.toLowerCase() === userEmail;
  const isInitialResponsible = issue.assignedEmail?.toLowerCase() === userEmail || (issue.assignedPosition?.toUpperCase() === user?.position?.toUpperCase() && !!user?.position);
  const isCollaborator = issue.redirectedTo?.email?.toLowerCase() === userEmail;
  const isExecutor = issue.executor?.email?.toLowerCase() === userEmail;
  const isResponsible = isInitialResponsible || isCollaborator || isExecutor;
  const isReviewer = issue.reviewerEmails?.some((email: string) => email.toLowerCase() === userEmail);
  
  const isBimTeam = user?.team?.toUpperCase().includes('BIM') || 
                    user?.position?.toUpperCase().includes('BIM') ||
                    user?.email?.toLowerCase() === 'imagina3ddesign@gmail.com';
  const isAdminUser = user?.role === 'admin' || isBimTeam;
  const canManage = (isAuthor || isAdminUser);

  // Approval Chain Logic
  const hasExecutor = !!issue.executor;
  const executorApproved = issue.executor?.approved === true;
  const hasCollaborator = !!issue.redirectedTo;
  const collaboratorApproved = issue.collaboratorApproved === true;

  const isNextExecutor = hasExecutor && !executorApproved && (isExecutor || isAdminUser);
  const isNextCollaborator = hasCollaborator && !collaboratorApproved && (isCollaborator || isAdminUser) && (!hasExecutor || executorApproved);
  const isNextPrincipal = (isInitialResponsible || isAdminUser) && (!hasExecutor || executorApproved) && (!hasCollaborator || collaboratorApproved) && issue.status !== 'RESPONDIDA' && issue.status !== 'RESUELTA';

  return (
    <motion.div 
      initial={{ x: 50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 50, opacity: 0 }}
      className="flex-1 min-w-0 bg-white dark:bg-[#020617] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-[40] relative transition-colors duration-200"
    >
      {/* Header */}
      <div className="p-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white/80 dark:bg-[#020617]/80 backdrop-blur-3xl sticky top-0 z-10">
        <div className="flex items-center gap-6">
           <div className="px-3.5 py-1.5 bg-white border border-white rounded-xl shadow-xl shadow-white/5">
             <span className="text-lg font-display font-black text-[#020617] tracking-widest font-mono uppercase">{issue.code || issue.id.slice(0, 8)}</span>
           </div>
           <div className={cn(
             "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] border shadow-sm transition-all",
             getEffectiveStatus(issue) === 'VENCIDA' ? "bg-red-500/10 border-red-500/20 text-red-500" :
             getEffectiveStatus(issue) === 'ACUERDO' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
             getEffectiveStatus(issue) === 'RESPONDIDA' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
             getEffectiveStatus(issue) === 'RESUELTA' ? "bg-white border-white text-[#020617]" :
             "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-500"
           )}>
             {getEffectiveStatus(issue)}
           </div>
           <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm flex items-center gap-2">
             <UserIcon className="w-3 h-3 text-slate-400 dark:text-slate-600" />
             <span className="text-[9px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-[0.2em]">{issue.creatorName} <span className="text-slate-400 dark:text-slate-600">[{issue.creatorPosition || "GENERAL"}]</span></span>
             {issue.creatorTeam && (
               <div className={cn(
                 "ml-2 px-1.5 py-0.5 rounded-md border text-[7px] font-black uppercase tracking-widest shadow-xl",
                  issue.creatorTeam === 'ARQUITECTURA' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                  issue.creatorTeam === 'COORDINACIÓN TÉCNICA' ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-500" :
                  "bg-slate-500/10 border-slate-500/20 text-slate-500"
               )}>
                 {issue.creatorTeam}
               </div>
             )}
             {issue.fromReport && (
               <button 
                 onClick={() => onOpenReport && issue.sourceReportId && onOpenReport(issue.sourceReportId)}
                 className="ml-2 flex items-center gap-2 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 rounded-md border border-indigo-400/50 shadow-lg shadow-indigo-600/20 transition-all active:scale-95 group/badge"
                 title="Ir al Informe de Obra"
               >
                 <ClipboardList className="w-2.5 h-2.5 text-white" />
                 <span className="text-[8px] font-black text-white uppercase tracking-widest whitespace-nowrap">VIENE DE INFORME</span>
               </button>
             )}
             {isAdminUser && (
               <div className="flex gap-2">
                 {showConfirmDelete && (
                   <button 
                     onClick={handleDelete}
                     className="px-4 py-2 bg-red-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 animate-in fade-in zoom-in-95"
                   >
                     Confirmar Eliminar
                   </button>
                 )}
                 <button 
                   onClick={() => setShowConfirmDelete(!showConfirmDelete)}
                   className={cn(
                     "p-3 rounded-xl transition-all border shadow-sm active:scale-95 group",
                     showConfirmDelete 
                       ? "bg-slate-800 border-slate-700 text-slate-400" 
                       : "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white"
                   )}
                   title={showConfirmDelete ? "Cancelar" : "Eliminar permanentemente (BIM)"}
                 >
                   {showConfirmDelete ? <X className="w-5 h-5" /> : <Trash2 className="w-5 h-5 transition-transform group-hover:scale-110" />}
                 </button>
               </div>
             )}
           </div>
           <span className="text-[7px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">VER. 2.1.3</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-3 bg-slate-900 hover:bg-slate-800 rounded-xl transition-all text-slate-500 hover:text-white border border-slate-800 shadow-sm active:scale-95">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-10 grid grid-cols-1 xl:grid-cols-12 gap-10 custom-scrollbar bg-slate-50 dark:bg-[#020617] transition-colors duration-200">
        <div className="xl:col-span-8 space-y-10">
          {/* Main Info */}
          <section className="bg-white dark:bg-slate-900/40 p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl shadow-slate-200/40 dark:shadow-black/20 relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 p-10 pointer-events-none opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
              <ShieldCheck className="w-80 h-80 text-white" />
            </div>
            
            <div className="flex gap-3 mb-8">
              {isFieldVisible('degreeOfAction') && issue.degreeOfAction && (
                <div className="flex items-center gap-2.5 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 shadow-sm">
                  <Zap className="w-3.5 h-3.5" style={{ color: (DEGREE_OF_ACTION as any)[issue.degreeOfAction]?.color }} />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: (DEGREE_OF_ACTION as any)[issue.degreeOfAction]?.color }}>
                    {(DEGREE_OF_ACTION as any)[issue.degreeOfAction]?.label}
                  </span>
                </div>
              )}
              {isFieldVisible('type') && (
                <div className="px-4 py-2 rounded-full bg-slate-900 dark:bg-white border border-slate-900 dark:border-white text-white dark:text-[#020617] text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-slate-900/10">
                  {issue.type}
                </div>
              )}
            </div>

            {issue.fromReport && (
              <div className={cn(
                "flex flex-col md:flex-row items-center gap-6 mb-12 px-8 py-8 border-2 shadow-2xl rounded-[3rem] w-full group/source animate-in zoom-in-95 slide-in-from-top-4 duration-700 relative overflow-hidden",
                issue.reportType === 'QUALITY'
                  ? "from-red-900/40 via-red-600/20 to-red-500/5 border-red-500 shadow-[0_0_50px_-12px_rgba(239,68,68,0.3)] bg-gradient-to-br"
                  : "from-indigo-900/40 via-indigo-600/20 to-indigo-500/5 border-indigo-500 shadow-[0_0_50px_-12px_rgba(79,70,229,0.3)] bg-gradient-to-br"
              )}>
                <div className="absolute top-0 right-0 p-8 opacity-10 scale-150 group-hover:rotate-12 transition-transform duration-1000">
                  <FileText className={cn("w-32 h-32", issue.reportType === 'QUALITY' ? "text-red-500" : "text-indigo-500")} />
                </div>
                {/* Decorative pulse for attention */}
                <div className={cn("absolute inset-0 pointer-events-none animate-pulse", issue.reportType === 'QUALITY' ? "bg-red-600/5" : "bg-indigo-600/5")} />
                
                <div className={cn(
                  "w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-2xl shrink-0 relative z-10",
                  issue.reportType === 'QUALITY' ? "bg-red-600 shadow-red-600/40" : "bg-indigo-600 shadow-indigo-600/40"
                )}>
                  <ClipboardList className="w-10 h-10 text-white" />
                </div>
                <div className="flex-1 flex flex-col relative z-10">
                  <span className={cn(
                    "text-[12px] font-black uppercase tracking-[0.5em] mb-3 leading-none flex items-center gap-3",
                    issue.reportType === 'QUALITY' ? "text-red-400" : "text-indigo-400"
                  )}>
                     <Zap className="w-4 h-4 text-amber-500 fill-amber-500 animate-bounce" />
                     {issue.reportType === 'QUALITY' ? "Viene de un Informe de Calidad (BIM)" : "Viene de un Informe de Obra"}
                  </span>
                  <div className="flex flex-col md:flex-row md:items-center gap-6">
                    <div className="flex flex-col">
                      <span className="text-xl font-display font-black text-white uppercase tracking-widest leading-none mb-2">{issue.sourceReportTitle || (issue.reportType === 'QUALITY' ? 'Informe de Control de Calidad' : 'Auditoría Técnica de Obra')}</span>
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border",
                          issue.reportType === 'QUALITY' 
                            ? "bg-red-500/20 border-red-500/30 text-red-300"
                            : "bg-indigo-500/20 border-indigo-500/30 text-indigo-300"
                        )}>
                           {issue.creatorTeam || (issue.reportType === 'QUALITY' ? 'EQUIPO CALIDAD' : 'EQUIPO BIM')}
                        </span>
                        {issue.sourceReportId && <span className={cn("text-[9px] font-mono font-black uppercase tracking-widest", issue.reportType === 'QUALITY' ? "text-red-400/60" : "text-indigo-400/60")}>ID: {issue.sourceReportId.slice(0, 12)}</span>}
                      </div>
                    </div>
                  </div>
                </div>
                
                {issue.sourceReportId ? (
                  onOpenReport && (
                    <button 
                      onClick={() => onOpenReport(issue.sourceReportId!)}
                      className={cn(
                        "relative z-10 px-8 py-5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-2xl flex items-center gap-3 active:scale-95 shrink-0 group/btn bg-white",
                        issue.reportType === 'QUALITY'
                          ? "text-red-900 hover:bg-red-50 shadow-red-600/20"
                          : "text-indigo-900 hover:bg-indigo-50 shadow-indigo-600/20"
                      )}
                    >
                      <span className="group-hover:translate-x-0.5 transition-transform">Ver Informe Completo</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  )
                ) : (
                  <div className={cn(
                    "px-6 py-4 border rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2",
                    issue.reportType === 'QUALITY'
                      ? "bg-red-500/10 border-red-500/20 text-red-400"
                      : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                  )}>
                     <AlertCircle className="w-4 h-4" /> ID de Informe no vinculado
                  </div>
                )}
              </div>
            )}

            {/* INFORME DE SEGUIMIENTO DE AUDITORÍA DE CALIDAD */}
            {issue.status === 'RESUELTA' && issue.reportType === 'QUALITY' && (
              <div className="bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-850 rounded-[2.5rem] p-8 mb-10 shadow-lg shadow-black/5">
                <div className="flex items-center gap-4 mb-8 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <Clock className="w-5 h-5 text-indigo-500 animate-pulse" />
                  <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-[0.3em] flex items-center gap-2">
                    Seguimiento Técnico Post-Cierre de Calidad
                  </h3>
                </div>

                {/* Persistent warnings/alerts */}
                {(isMedicionAlertActive(issue) || isEficaciaAlertActive(issue)) && (
                  <div className="mb-8 p-5 bg-rose-500/10 border border-rose-500/25 rounded-2xl flex items-start gap-4 animate-pulse">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Alerta de Seguimiento Técnico Mandatorio</h4>
                      <p className="text-[11px] text-[#ef4444] dark:text-rose-400 mt-1 font-semibold leading-relaxed">
                        Se ha alcanzado o superado el período límite de revisión post-cierre (3 días antes del plazo). Por favor, registre la evaluación requerida en el panel de chat de la incidencia.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* MEDICIÓN INICIAL (1 MES) */}
                  <div className={cn(
                    "p-6 rounded-[2rem] border transition-all duration-300",
                    issue.medicionInicial?.completed 
                      ? "bg-emerald-500/5 border-emerald-500/20 shadow-inner" 
                      : isMedicionAlertActive(issue)
                        ? "bg-red-500/5 border-red-500/25 animate-pulse" 
                        : "bg-slate-100/30 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800"
                  )}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500 flex flex-wrap gap-1 items-center">
                        <span>1. MEDICIÓN INICIAL (1 MES)</span>
                        <span className="text-slate-400 dark:text-slate-500 font-mono text-[7px] font-bold">[{issue.medicionInicial?.code || generateFollowUpCode(issue, 1)}]</span>
                      </span>
                      {issue.medicionInicial?.completed ? (
                        <div className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[7px] font-black uppercase tracking-widest">
                          Revisado
                        </div>
                      ) : isMedicionAlertActive(issue) ? (
                        <div className="px-2 py-0.5 rounded-md bg-red-500 text-white text-[7px] font-black uppercase tracking-widest animate-pulse">
                          Alerta Activa
                        </div>
                      ) : (
                        <div className="px-2 py-0.5 rounded-md bg-slate-500/10 border border-slate-500/20 text-slate-400 text-[7px] font-black uppercase tracking-widest">
                          Pendiente
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-[10px] text-slate-500">
                        <span>Fórmula Límite de Entrega:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-300">
                          {getMedicionDueDate(issue) ? format(getMedicionDueDate(issue)!, 'dd/MM/yyyy') : '-'}
                        </span>
                      </div>
                      
                      {issue.medicionInicial?.completed ? (
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black uppercase text-slate-405">Código seguimiento:</span>
                            <span className="text-[10px] font-mono font-bold text-[#6366f1]">{issue.medicionInicial.code || generateFollowUpCode(issue, 1)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black uppercase text-slate-405">Inspección por:</span>
                            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-300 truncate max-w-[150px]">{issue.medicionInicial.completedByName}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black uppercase text-slate-405">Valoración de Eficacia:</span>
                            <span className={cn(
                              "text-[9px] font-black uppercase px-2 py-0.5 rounded-md",
                              issue.medicionInicial.valoration === 'EFICAZ' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                            )}>
                              {issue.medicionInicial.valoration === 'EFICAZ' ? 'EFICAZ 🟢' : 'NO EFICAZ 🔴'}
                            </span>
                          </div>
                          <div className="pt-2">
                            <span className="text-[8px] font-black uppercase text-slate-405 block mb-1">Evidencia / Notas:</span>
                            <p className="text-[11px] text-slate-655 dark:text-slate-400 leading-relaxed font-semibold italic break-words bg-slate-100/50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800">
                              {issue.medicionInicial.notes}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500 leading-relaxed italic border-t border-slate-250 dark:border-slate-800 pt-3">
                          La revisión obligatoria se registrará en el canal de chat de la incidencia por el autor o equipo Calidad.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* REVISIÓN EFICACIA (3 MESES) */}
                  <div className={cn(
                    "p-6 rounded-[2rem] border transition-all duration-300",
                    issue.revisionEficacia?.completed 
                      ? "bg-emerald-500/5 border-emerald-500/20 shadow-inner" 
                      : isEficaciaAlertActive(issue)
                        ? "bg-red-500/5 border-red-500/25 animate-pulse" 
                        : "bg-slate-100/30 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800"
                  )}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500 flex flex-wrap gap-1 items-center">
                        <span>2. REVISIÓN EFICACIA (3 MESES)</span>
                        <span className="text-slate-400 dark:text-slate-500 font-mono text-[7px] font-bold">[{issue.revisionEficacia?.code || generateFollowUpCode(issue, 2)}]</span>
                      </span>
                      {issue.revisionEficacia?.completed ? (
                        <div className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[7px] font-black uppercase tracking-widest">
                          Revisado
                        </div>
                      ) : isEficaciaAlertActive(issue) ? (
                        <div className="px-2 py-0.5 rounded-md bg-red-500 text-white text-[7px] font-black uppercase tracking-widest animate-pulse">
                          Alerta Activa
                        </div>
                      ) : (
                        <div className="px-2 py-0.5 rounded-md bg-slate-500/10 border border-slate-500/20 text-slate-400 text-[7px] font-black uppercase tracking-widest">
                          Pendiente
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-[10px] text-slate-500">
                        <span>Fórmula Límite de Entrega:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-300">
                          {getEficaciaDueDate(issue) ? format(getEficaciaDueDate(issue)!, 'dd/MM/yyyy') : '-'}
                        </span>
                      </div>
                      
                      {issue.revisionEficacia?.completed ? (
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black uppercase text-slate-405">Código seguimiento:</span>
                            <span className="text-[10px] font-mono font-bold text-[#6366f1]">{issue.revisionEficacia.code || generateFollowUpCode(issue, 2)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black uppercase text-slate-405">Inspección por:</span>
                            <span className="text-[10px] font-bold text-slate-800 dark:text-slate-300 truncate max-w-[150px]">{issue.revisionEficacia.completedByName}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black uppercase text-slate-405">Valoración de Eficacia:</span>
                            <span className={cn(
                              "text-[9px] font-black uppercase px-2 py-0.5 rounded-md",
                              issue.revisionEficacia.valoration === 'EFICAZ' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                            )}>
                              {issue.revisionEficacia.valoration === 'EFICAZ' ? 'EFICAZ 🟢' : 'NO EFICAZ 🔴'}
                            </span>
                          </div>
                          <div className="pt-2">
                            <span className="text-[8px] font-black uppercase text-slate-405 block mb-1">Evidencia / Notas:</span>
                            <p className="text-[11px] text-slate-655 dark:text-slate-400 leading-relaxed font-semibold italic break-words bg-slate-100/50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800">
                              {issue.revisionEficacia.notes}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500 leading-relaxed italic border-t border-slate-250 dark:border-slate-800 pt-3">
                          La revisión obligatoria se registrará en el canal de chat de la incidencia por el autor o equipo Calidad.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* HISTORICO DE MEDICIONES EXTRAORDINARIAS */}
                {issue.extraordinarias && issue.extraordinarias.length > 0 && (
                  <div className="mt-8 border-t border-slate-200 dark:border-slate-800/80 pt-8">
                    <p className="text-[9px] font-black text-slate-405 dark:text-slate-500 uppercase tracking-[0.25em] mb-4">Seguimientos Extraordinarios Registrados ({issue.extraordinarias.length})</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {issue.extraordinarias.map((extra, idx) => (
                        <div key={idx} className="p-6 rounded-[2rem] border bg-indigo-500/5 border-indigo-500/20 shadow-inner">
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-indigo-500">
                              SEGUIMIENTO EXTRAORDINARIO {extra.consecutive}
                            </span>
                            <div className="px-2 py-0.5 rounded-md bg-[#6366f1]/20 border border-[#6366f1]/30 text-[#6366f1] text-[7px] font-black uppercase tracking-widest">
                              Extraordinario
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <div className="flex justify-between items-center text-[10px] text-slate-500">
                              <span>Código Registro:</span>
                              <span className="font-mono font-bold text-[#6366f1]">{extra.code}</span>
                            </div>
                            
                            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[8px] font-black uppercase text-slate-405">Fecha Registro:</span>
                                <span className="text-[10px] font-bold text-slate-800 dark:text-slate-300">{format(new Date(extra.completedAt), 'dd/MM/yyyy')}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[8px] font-black uppercase text-slate-405">Registrado por:</span>
                                <span className="text-[10px] font-bold text-slate-800 dark:text-slate-300 truncate max-w-[150px]">{extra.completedByName}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[8px] font-black uppercase text-slate-405">Valoración de Eficacia:</span>
                                <span className={cn(
                                  "text-[9px] font-black uppercase px-2 py-0.5 rounded-md",
                                  extra.valoration === 'EFICAZ' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                                )}>
                                  {extra.valoration === 'EFICAZ' ? 'EFICAZ 🟢' : 'NO EFICAZ 🔴'}
                                </span>
                              </div>
                              <div className="pt-2">
                                <span className="text-[8px] font-black uppercase text-slate-405 block mb-1">Evidencia / Notas:</span>
                                <p className="text-[11px] text-slate-655 dark:text-slate-400 leading-relaxed font-semibold italic break-words bg-slate-100/50 dark:bg-slate-950/50 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800">
                                  {extra.notes}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <h2 className="text-4xl font-display font-black text-slate-900 dark:text-white tracking-tight leading-[1.1] mb-10 max-w-2xl uppercase">{issue.title}</h2>
            
            <div className="mb-10 space-y-12">
              {/* FICHA TÉCNICA SST - MOVED HIGHER AND MADE PROMINENT */}
              {isSSTIssue && (
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-[2.5rem] p-8 -mx-2 mb-10 shadow-lg shadow-emerald-500/5">
                   <div className="flex items-center gap-4 mb-8 border-b border-emerald-500/10 pb-4">
                     <ShieldCheck className="w-6 h-6 text-emerald-500" />
                     <h3 className="text-sm font-black text-emerald-500 uppercase tracking-[0.3em]">Caracterización y Riesgo SST</h3>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     <div className="bg-slate-100/50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl">
                        <p className="text-[7px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Especialidad</p>
                        <p className="text-xs font-bold text-emerald-400">{issue.specialty || "SST"}</p>
                     </div>
                     <div className="bg-slate-100/50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl">
                        <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Mes de Ejecución</p>
                        <p className="text-xs font-bold text-slate-800 dark:text-white">{issue.month || "NO REGISTRADO"}</p>
                     </div>
                     <div className="bg-slate-100/50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl">
                        <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Actividad Económica</p>
                        <p className="text-xs font-bold text-slate-800 dark:text-white">{issue.economicActivity || "NO REGISTRADA"}</p>
                     </div>
                     <div className="bg-slate-100/50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl">
                        <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Clase de Registro</p>
                        <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{issue.issueClass ? `CLASE ${issue.issueClass}` : "ESTÁNDAR"}</p>
                     </div>
                     <div className="bg-slate-100/50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl lg:col-span-2">
                        <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Empresa Corresponsable</p>
                        <p className="text-xs font-bold text-slate-800 dark:text-white">{issue.responsibleCompany || "NO ASIGNADA"}</p>
                     </div>
                   </div>

                   <div className="mt-8 pt-8 border-t border-emerald-500/10">
                      <div className="flex items-start gap-4 p-6 bg-red-500/5 border border-red-500/10 dark:border-red-500/20 rounded-3xl">
                         <AlertTriangle className="w-5 h-5 text-red-500 mt-1" />
                         <div className="space-y-4 flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               <div>
                                  <p className="text-[8px] font-black text-red-500/60 uppercase tracking-widest mb-1">Factor de Peligro</p>
                                  <p className="text-sm font-black text-slate-800 dark:text-white">{issue.danger || "SIN CLASIFICACIÓN"}</p>
                               </div>
                               <div>
                                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Descripción Específica</p>
                                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-relaxed italic">
                                    {issue.dangerDescription || "No se registró descripción detallada del peligro."}
                                  </p>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] flex items-center gap-4">
                  <div className="w-8 h-px bg-slate-200 dark:bg-slate-800" />
                  Descripción Técnica Detallada
                </h4>
                <p className="text-lg text-slate-700 dark:text-slate-300 leading-relaxed font-semibold bg-slate-100 dark:bg-slate-950 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-inner italic">
                  {issue.description}
                </p>
              </div>

              {/* CONTROL Y VOLUMETRÍA DE ACOPIOS (ENVIRONMENTAL REPORT) */}
              {isEnvironmentalIssue && (
                (() => {
                  const reportDate = new Date(issue.createdAt);
                  const tenDaysLater = new Date(reportDate.getTime() + 10 * 24 * 60 * 60 * 1000);
                  const now = new Date();
                  const isWithin10Days = now.getTime() <= tenDaysLater.getTime();
                  const daysRemaining = Math.max(0, Math.ceil((tenDaysLater.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
                  const isAcopioEditable = isWithin10Days || isAdminUser;

                  return (
                    <div className="bg-emerald-500/[0.04] dark:bg-emerald-950/[0.05] border border-emerald-500/20 rounded-[2.5rem] p-8 -mx-2 shadow-lg shadow-emerald-550/[0.02] space-y-8 animate-in fade-in zoom-in-95 duration-500">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-500/10 pb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                            <TrendingUp className="w-5 h-5 animate-pulse" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em]">Cubicación y Recuperación Ambiental</h3>
                            <p className="text-[9.5px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Control Volumétrico y Áreas de Acopio de Obra</p>
                          </div>
                        </div>

                        <div className={cn(
                          "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-2 border self-start md:self-auto shadow-sm",
                          isWithin10Days 
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                            : "bg-rose-500/10 border-rose-503/20 text-rose-500"
                        )}>
                          {isWithin10Days ? (
                            <>
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <span>Habilitado para edición ({daysRemaining} d restantes)</span>
                            </>
                          ) : (
                            <span>🔒 Plazo de edición vencido (10 días completados)</span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Largo Input */}
                        <div className="space-y-2">
                          <label className="block text-[8px] font-black uppercase tracking-widest text-slate-500 px-1">Largo del Acopio (metros)</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              disabled={!isAcopioEditable}
                              value={largo}
                              onChange={(e) => setLargo(e.target.value === '' ? '' : Number(e.target.value))}
                              placeholder="Largo en ml"
                              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 disabled:opacity-60 rounded-2xl px-5 py-3.5 text-xs font-mono font-bold uppercase transition-all focus:border-emerald-500 outline-none"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">ML</span>
                          </div>
                        </div>

                        {/* Ancho Input */}
                        <div className="space-y-2">
                          <label className="block text-[8px] font-black uppercase tracking-widest text-slate-500 px-1">Ancho del Acopio (metros)</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              disabled={!isAcopioEditable}
                              value={ancho}
                              onChange={(e) => setAncho(e.target.value === '' ? '' : Number(e.target.value))}
                              placeholder="Ancho en ml"
                              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 disabled:opacity-60 rounded-2xl px-5 py-3.5 text-xs font-mono font-bold uppercase transition-all focus:border-emerald-500 outline-none"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">ML</span>
                          </div>
                        </div>

                        {/* Alto / Espesor Input */}
                        <div className="space-y-2">
                          <label className="block text-[8px] font-black uppercase tracking-widest text-slate-500 px-1">Espesor / Alto (metros)</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              disabled={!isAcopioEditable}
                              value={alto}
                              onChange={(e) => setAlto(e.target.value === '' ? '' : Number(e.target.value))}
                              placeholder="Alto en ml"
                              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 disabled:opacity-60 rounded-2xl px-5 py-3.5 text-xs font-mono font-bold uppercase transition-all focus:border-emerald-500 outline-none"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">ML</span>
                          </div>
                        </div>

                        {/* Duración en obra Input */}
                        <div className="space-y-2">
                          <label className="block text-[8px] font-black uppercase tracking-widest text-slate-500 px-1">Retención del Acopio (días)</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="1"
                              disabled={!isAcopioEditable}
                              value={duracion}
                              onChange={(e) => setDuracion(e.target.value === '' ? '' : Number(e.target.value))}
                              placeholder="Plazo en días"
                              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 disabled:opacity-60 rounded-2xl px-5 py-3.5 text-xs font-mono font-bold uppercase transition-all focus:border-emerald-500 outline-none"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">DÍAS</span>
                          </div>
                        </div>
                      </div>

                      {/* Resultados de Cubicaciones */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-slate-950/60 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-900 shadow-inner">
                        {/* Área Final Recuperada */}
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                            <Maximize2 className="w-6 h-6" />
                          </div>
                          <div>
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Área Final Recuperada</span>
                            <div className="flex items-baseline gap-1.5 mt-0.5">
                              <span className="span-area text-xl font-display font-black text-slate-850 dark:text-teal-400">
                                {calculatedArea.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-slate-500">m²</span>
                            </div>
                          </div>
                        </div>

                        {/* Volumen Total Reutilizado */}
                        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-900 pt-4 md:pt-0 md:pl-6">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                            <Layers className="w-6 h-6 animate-pulse" />
                          </div>
                          <div>
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Volumen Total Reutilizado / Cubicación</span>
                            <div className="flex items-baseline gap-1.5 mt-0.5">
                              <span className="span-volumen text-xl font-display font-black text-slate-850 dark:text-emerald-400">
                                {calculatedVolumen.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-slate-500">m³</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {isAcopioEditable && (
                        <div className="flex justify-end pt-2">
                          <button
                            onClick={handleSaveAcopio}
                            disabled={isSavingAcopio}
                            className="px-8 py-4 bg-emerald-650 hover:bg-emerald-600 text-white font-black text-[10.5px] uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                          >
                            {isSavingAcopio ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Guardando Cubicaciones...</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4" />
                                <span>Guardar Datos de Acopio</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}

              {/* Jerarquía de Ubicación - Moved below technical Characterization */}
              {issue.locations && (
                <div className="p-8 bg-slate-100/50 dark:bg-slate-950/50 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-inner">
                  <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-6 flex items-center gap-4 px-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500" /> Ubicación del Hallazgo
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                      <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest pl-1">Unidades</p>
                      <div className="flex flex-wrap gap-2">
                        {issue.locations.units.map(u => (
                          <span key={u} className="px-3 py-1 bg-slate-200/50 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-white text-[9px] font-black rounded-lg uppercase">{u}</span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest pl-1">Niveles</p>
                      <div className="flex flex-wrap gap-2">
                        {issue.locations.levels.map(l => (
                          <span key={l} className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black rounded-lg uppercase">{l}</span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest pl-1">Espacios</p>
                      <div className="flex flex-wrap gap-2">
                        {issue.locations.spaces.map(s => (
                          <span key={s} className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black rounded-lg uppercase">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Proposed Action Plan / Acción Correctiva */}
              <div className="space-y-4">
                <h4 className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.3em] flex items-center gap-4">
                  <div className="w-8 h-px bg-slate-800 dark:bg-slate-700" />
                  ACCIÓN CORRECTIVA SUGERIDA
                </h4>
                <div className="p-8 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 border-dashed rounded-[2rem] shadow-inner font-sans">
                  <p className="text-[14px] text-slate-800 dark:text-slate-350 leading-relaxed font-bold italic font-sans break-words whitespace-pre-line">
                    {issue.proposedActionPlan || 'No se registró un plan de acción o acción correctiva específica para este hallazgo.'}
                  </p>
                 {issue.status === 'ACUERDO' && issue.agreementDate && (
                    <div className="mt-4 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Compromiso de entrega:</p>
                      <p className="text-sm font-black text-white">{format(new Date(issue.agreementDate + 'T00:00:00'), 'dd MMMM, yyyy')}</p>
                    </div>
                 )}
                </div>
              </div>
            </div>

            {issue.status === 'RECHAZADA' && issue.rejectionReason && (
              <div className="mb-10 p-8 bg-red-500/5 border border-red-500/10 dark:border-red-500/20 rounded-[2rem] shadow-sm">
                <h5 className="text-[9px] font-black text-red-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4" /> Justificación Técnica de Rechazo
                </h5>
                <p className="text-base text-red-700 dark:text-red-400/80 font-bold italic leading-relaxed">{issue.rejectionReason}</p>
              </div>
            )}

            {/* Status Management Bar */}
            <div className="flex flex-col gap-6 pt-10 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between px-2">
                  <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Protocolo de Acción y Estados</h4>
                  <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                     <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Sincronizado</span>
                  </div>
                </div>

                {issue.status === 'ANULADA' ? (
                     canManage && (
                       <button 
                         onClick={() => updateStatus('ACTIVO')}
                         className="px-8 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-600/10 flex items-center gap-2.5 active:scale-95"
                       >
                         <CheckCircle2 className="w-4 h-4" /> Reactivar Hallazgo
                       </button>
                     )
                   ) : (
                     <div className="flex flex-col gap-4 w-full">
                       {/* Visual Approval Chain */}
                       {(hasExecutor || hasCollaborator) && (
                         <div className="flex items-center gap-4 px-2 mb-2">
                            {hasExecutor && (
                              <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border text-[8px] font-black uppercase tracking-widest transition-all", 
                                executorApproved ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500")}>
                                 {executorApproved ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />} EJECUTOR
                              </div>
                            )}
                            {hasCollaborator && (
                              <>
                                <ChevronRight className="w-3 h-3 text-slate-350 dark:text-slate-800" />
                                <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border text-[8px] font-black uppercase tracking-widest transition-all", 
                                  collaboratorApproved ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500")}>
                                   {collaboratorApproved ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />} COLABORADOR
                                </div>
                              </>
                            )}
                            <ChevronRight className="w-3 h-3 text-slate-350 dark:text-slate-800" />
                            <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border text-[8px] font-black uppercase tracking-widest transition-all", 
                              issue.status === 'RESPONDIDA' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500")}>
                               {issue.status === 'RESPONDIDA' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />} PRINCIPAL
                            </div>
                         </div>
                       )}

                        {/* ACTION BUTTONS (Chain) */}
                       <div className="flex flex-wrap gap-3">
                         {isNextExecutor && (
                            <div className="flex flex-col gap-2">
                              <span className="text-[7px] font-black text-indigo-500 uppercase tracking-widest pl-1">Paso 1: Respuesta del Ejecutor ({issue.executor?.name})</span>
                              <button 
                                onClick={handlePartialResponse}
                                className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/10 flex items-center gap-2.5 active:scale-95"
                              >
                                <CheckCircle2 className="w-4 h-4" /> MARCAR RESPUESTA PARCIAL
                              </button>
                            </div>
                         )}
                         {isNextCollaborator && (
                            <div className="flex flex-col gap-2">
                              <span className="text-[7px] font-black text-amber-500 uppercase tracking-widest pl-1">Paso 2: Visto Bueno del Colaborador ({issue.redirectedTo?.name})</span>
                              <button 
                                onClick={handlePartialResponse}
                                className="px-8 py-4 bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-amber-500 transition-all shadow-xl shadow-amber-600/10 flex items-center gap-2.5 active:scale-95 border-2 border-amber-400/30"
                              >
                                <ShieldCheck className="w-4 h-4" /> CONFIRMAR VISTO BUENO (COLABORADOR)
                              </button>
                            </div>
                         )}
                         {isNextPrincipal && (
                            <div className="flex flex-col gap-2">
                              <span className="text-[7px] font-black text-emerald-500 uppercase tracking-widest pl-1">Etapa Final: Cierre de Incidencia</span>
                              <button 
                                onClick={handleFinalApproval}
                                className="px-8 py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-600/10 flex items-center gap-2.5 active:scale-95"
                              >
                                <CheckCircle2 className="w-4 h-4" /> FINALIZAR RESPUESTA TÉCNICA
                              </button>
                            </div>
                         )}
                       </div>

                       {/* MANAGEMENT BUTTONS (Redirection, Anulation, etc.) */}
                       <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-800">
                          {(isInitialResponsible || isAdminUser) && !isNextExecutor && !isExecutor && (
                            <>
                              <button 
                                onClick={() => { setRedirectionType('COLABORADOR'); setShowRedirectionPicker(true); }}
                                className="px-6 py-4 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-slate-800 hover:text-white transition-all flex items-center gap-2.5 active:scale-95"
                              >
                                <ArrowRight className="w-4 h-4" /> Delegar a Colaborador
                              </button>
                              <button 
                                onClick={() => { setRedirectionType('EJECUTOR'); setShowRedirectionPicker(true); }}
                                className="px-6 py-4 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-slate-800 hover:text-white transition-all flex items-center gap-2.5 active:scale-95"
                              >
                                <ArrowRight className="w-4 h-4" /> Redirigir a Ejecutor
                              </button>
                            </>
                          )}
                          
                          {isCollaborator && !isNextExecutor && !isNextCollaborator && !isExecutor && (
                            <button 
                              onClick={() => { setRedirectionType('EJECUTOR'); setShowRedirectionPicker(true); }}
                              className="px-6 py-4 bg-slate-900 border border-slate-800 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-slate-800 hover:text-white transition-all flex items-center gap-2.5 active:scale-95"
                            >
                              <ArrowRight className="w-4 h-4" /> Redirigir a Ejecutor
                            </button>
                          )}

                          {canManage && (
                            <div className="flex flex-wrap gap-3">
                              {issue.status === 'RESPONDIDA' && (
                                <button onClick={() => updateStatus('RESUELTA')} className="px-6 py-4 bg-white text-[#020617] rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-slate-100 transition-all flex items-center gap-2.5">
                                  <ShieldCheck className="w-4 h-4" /> Validar Resolución
                                </button>
                              )}
                              <button onClick={() => setShowRejectionPicker(true)} className="px-5 py-3 bg-red-600/10 text-red-500 border border-red-500/20 rounded-xl text-[9px] font-black uppercase hover:bg-red-600 hover:text-white transition-all flex items-center gap-2">
                                <XCircle className="w-4 h-4" /> RECHAZAR RESPUESTA
                              </button>
                              <button onClick={() => setShowAgreementPicker(true)} className="px-5 py-3 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-xl text-[9px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2">
                                <Calendar className="w-4 h-4" /> Pactar Fecha
                              </button>
                              <button onClick={() => updateStatus('ANULADA')} className="px-5 py-3 bg-slate-950 text-slate-700 border border-slate-800 rounded-xl text-[9px] font-black uppercase hover:text-red-500 transition-all flex items-center gap-2">
                                <XCircle className="w-4 h-4" /> Anular
                              </button>
                            </div>
                          )}
                       </div>

                       {/* BIM ADMIN DELETE */}
                       {isAdminUser && (
                         <div className="pt-6 border-t border-slate-800/50">
                            {showConfirmDelete ? (
                              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col gap-3">
                                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest text-center">Confirmar eliminación definitiva?</p>
                                <div className="flex gap-2">
                                  <button onClick={handleDelete} className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">SÍ, ELIMINAR</button>
                                  <button onClick={() => setShowConfirmDelete(false)} className="px-6 py-3 bg-slate-900 text-slate-400 border border-slate-800 rounded-xl text-[10px] font-black uppercase active:scale-95 transition-all">CANCELAR</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setShowConfirmDelete(true)} className="px-5 py-3 bg-red-600/10 text-red-500 border border-red-500/30 rounded-xl text-[9px] font-black uppercase hover:bg-red-600 hover:text-white transition-all flex items-center gap-2">
                                <Trash2 className="w-4 h-4" /> ELIMINAR INCIDENCIA (BIM)
                              </button>
                            )}
                         </div>
                       )}
                    </div>
                  )}
                </div>

                <AnimatePresence>
                 {showAgreementPicker && (
                   <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-4 p-8 bg-blue-500/5 border border-blue-500/20 rounded-[2rem] space-y-6 overflow-hidden shadow-inner">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <h5 className="text-base font-display font-black text-white tracking-tight">Acuerdo de Cronograma</h5>
                          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">Establezca la fecha compromiso de resolución</p>
                        </div>
                     </div>
                     <div className="flex gap-4">
                       <input 
                         type="date"
                         value={agreementDate}
                         onChange={(e) => setAgreementDate(e.target.value)}
                         className="flex-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-6 py-4 text-xs text-white font-bold focus:border-blue-500 outline-none transition-all shadow-sm"
                       />
                       <button onClick={() => updateStatus('ACUERDO', { agreementDate })} className="bg-blue-600 px-10 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] text-white shadow-xl shadow-blue-600/30 active:scale-95 transition-all">Confirmar</button>
                     </div>
                   </motion.div>
                 )}

                 {showRejectionPicker && (
                   <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-4 p-8 bg-red-500/5 border border-red-500/10 dark:border-red-500/20 rounded-[2rem] space-y-6 overflow-hidden shadow-inner">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <h5 className="text-base font-display font-black text-red-500 tracking-tight">Sustentación de No Conformidad</h5>
                          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">Indique por qué la resolución actual no es válida</p>
                        </div>
                     </div>
                     <textarea 
                       value={rejectionReason}
                       onChange={(e) => setRejectionReason(e.target.value)}
                       placeholder="Escriba los motivos técnicos detallados..."
                       className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-xs text-white font-bold h-32 focus:border-red-500 outline-none resize-none transition-all shadow-sm"
                     />
                     <button onClick={() => updateStatus('RECHAZADA', { rejectionReason })} className="w-full bg-red-600 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] text-white shadow-xl shadow-red-600/30 active:scale-95 transition-all">Registrar Informe</button>
                    </motion.div>
                  )}

                  {showRedirectionPicker && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-4 p-8 bg-amber-500/5 border border-amber-500/20 rounded-[2.5rem] space-y-6 overflow-hidden shadow-inner">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-amber-600 rounded-[1.25rem] flex items-center justify-center text-white shadow-xl shadow-amber-600/20">
                             <ArrowRight className="w-6 h-6" />
                           </div>
                           <div>
                              <h5 className="text-xl font-display font-black text-white tracking-tight leading-none">
                                {redirectionType === 'COLABORADOR' ? 'Agregar Colaborador' : 
                                 redirectionType === 'EJECUTOR' ? 'Redirigir a Ejecutor' :
                                 'Redirigir a Nuevo Responsable'}
                              </h5>
                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2">
                                {redirectionType === 'COLABORADOR' 
                                  ? 'Delegue el hallazgo a un colaborador para apoyo técnico' 
                                  : redirectionType === 'EJECUTOR'
                                    ? 'Defina al ejecutor final encargado de la respuesta'
                                    : 'Transfiera la responsabilidad principal a otro miembro'}
                              </p>
                           </div>
                        </div>
                        <button onClick={() => setShowRedirectionPicker(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 transition-colors">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {teamMembers.map((member) => (
                          <button
                            key={member.id}
                            onClick={() => handleRedirection(member)}
                            className="flex items-center gap-4 p-5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-amber-500/50 hover:bg-amber-500/5 transition-all group text-left shadow-sm active:scale-95"
                          >
                            <div className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center text-slate-600 group-hover:text-amber-500 group-hover:border-amber-500/30 transition-all">
                              <UserIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-black text-white truncate uppercase mb-0.5">{member.name}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{member.position}</span>
                                {member.team && (
                                  <span className="text-[7px] font-black px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/10 uppercase tracking-tighter">{member.team}</span>
                                )}
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-800 group-hover:text-amber-500 transition-colors" />
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
          </section>

          {/* Linked Elements */}
          <section className="bg-slate-100/50 dark:bg-slate-900/10 p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-800/50 shadow-xl">
            {isFieldVisible('impact') && issue.impact && issue.impact.length > 0 && (
              <div className="mb-8 p-6 bg-slate-100/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-[2rem] shadow-inner">
                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 flex items-center gap-2 px-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-700" /> Afectación del Proyecto
                </h4>
                <div className="flex flex-wrap gap-2">
                  {issue.impact.map(imp => (
                    <span key={imp} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-[8px] font-black rounded-lg uppercase tracking-wider shadow-sm">
                      {imp}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {isFieldVisible('attachments') && (
              <>
                <div className="flex items-center justify-between mb-10">
                  <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em] flex items-center gap-4">
                    <div className="w-8 h-px bg-slate-800" />
                    Entregables y Evidencia de Campo
                  </h4>
                  <div className="px-4 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                    <span className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em]">{issue.attachments?.length || 0} RECURSOS ACTIVOS</span>
                  </div>
                </div>

                {/* Direct Upload & Camera Trigger Bar inside Issue Detail panel */}
                <div className="mb-8 p-4 bg-slate-105/50 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.15em] pl-1">Evidencia Digital de Aprovechamiento / Obra V2</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleUploadPhoto}
                      className="hidden"
                    />
                    <input 
                      type="file" 
                      accept="image/*"
                      capture="environment"
                      ref={cameraInputRef}
                      onChange={handleUploadPhoto}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploadingPhoto}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-blue-500 border border-slate-200 dark:border-slate-800/80 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>{isUploadingPhoto ? '⏳ Leyendo...' : 'Subir Archivo'}</span>
                    </button>
                    <button
                      type="button"
                      disabled={isUploadingPhoto}
                      onClick={() => cameraInputRef.current?.click()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/15 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Cámara</span>
                    </button>
                  </div>
                </div>
                
                  {/* Image Previews Section */}
                  {issue.attachments?.filter(a => a.type.startsWith('image/')).length > 0 && (
                    <div className="col-span-full space-y-4 mb-6">
                      <div className="flex items-center gap-3">
                        <ImageIcon className="w-4 h-4 text-slate-500" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Evidencia Fotográfica</span>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {issue.attachments.filter(a => a.type.startsWith('image/')).map(att => (
                          <a key={att.id} href={getAuthenticatedDriveUrl(att.url, googleAccessToken)} target="_blank" rel="noreferrer" className="aspect-video bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-[1.5rem] overflow-hidden hover:border-indigo-500 group/img transition-all relative shadow-2xl">
                             <img src={getAuthenticatedDriveUrl(att.url, googleAccessToken)} alt={att.name} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                             <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                               <Eye className="w-6 h-6 text-white" />
                             </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {issue.attachments?.map((att) => (
                      <a 
                        key={att.id} 
                        href={getAuthenticatedDriveUrl(att.url, googleAccessToken)} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-6 p-6 bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-[1.75rem] hover:border-slate-350 dark:hover:border-slate-700 hover:bg-slate-150 dark:hover:bg-slate-900 transition-all group shadow-sm active:scale-[0.99]"
                      >
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center text-slate-600 group-hover:bg-white group-hover:text-[#020617] transition-all shadow-sm">
                          {att.type.includes('image') ? <ImageIcon className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                        </div>
                        <div className="overflow-hidden flex-1 text-left">
                          <p className="text-[13px] font-black text-slate-800 dark:text-white truncate uppercase tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{att.name}</p>
                          <div className="flex items-center gap-2.5 mt-1.5">
                             <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest leading-none">{att.category.replace('_', ' ')}</p>
                          </div>
                        </div>
                        <div className="p-2.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg group-hover:bg-slate-800 transition-colors">
                          <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-white transition-colors" />
                        </div>
                      </a>
                    ))}
                  </div>
                  {(!issue.attachments || issue.attachments.length === 0) && (
                    <div className="col-span-full py-16 text-center border border-dashed border-slate-250 dark:border-slate-800 rounded-[2.5rem] bg-slate-100/30 dark:bg-slate-950/30">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <Paperclip className="w-8 h-8 text-slate-800" />
                      </div>
                      <p className="text-[9px] text-slate-700 font-bold uppercase tracking-[0.3em]">Protocolo Sin Documentación de Soporte</p>
                    </div>
                  )}
                </>
            )}
          </section>
        </div>

        <div className="xl:col-span-4 space-y-10">
          {/* Metadata Card */}
          <section className="bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-xl space-y-10 sticky top-28">
             <div className="space-y-8">
                <div>
                   <h4 className="text-[9px] font-black text-slate-700 uppercase tracking-[0.4em] mb-8 flex items-center gap-4">
                     <div className="w-6 h-px bg-slate-200 dark:bg-slate-800" />
                     Cronometría Técnica
                   </h4>
                   <div className="space-y-4">
                     <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl group transition-all hover:bg-slate-100 dark:hover:bg-slate-800">
                       <div className="flex flex-col">
                         <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mb-0.5">Registro Inicial</span>
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Apertura del Item</span>
                       </div>
                       <span className="text-xs font-display font-black text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white">{format(new Date(issue.createdAt), 'dd/MM/yyyy HH:mm')}</span>
                     </div>
                     {issue.dueDate && isFieldVisible('dueDate') && (
                       <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl group transition-all hover:bg-slate-100 dark:hover:bg-slate-800">
                         <div className="flex flex-col">
                           <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mb-0.5">Terminal Límite</span>
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fecha de Vencimiento</span>
                         </div>
                         <span className={cn("text-base font-display font-black", getDueDateColor(issue.dueDate, issue.status))}>{format(new Date(issue.dueDate + 'T23:59:59'), 'dd MMM')}</span>
                       </div>
                     )}
                     {issue.status === 'ACUERDO' && issue.agreementDate && (
                       <div className="flex items-center justify-between p-6 bg-blue-600 rounded-2xl shadow-xl shadow-blue-600/10">
                         <div className="flex flex-col">
                           <span className="text-[8px] font-black text-white/50 uppercase tracking-[0.2em] mb-0.5">Pacto de Entrega</span>
                           <span className="text-[9px] font-black text-white uppercase tracking-widest">Nueva Resolución</span>
                         </div>
                         <span className="text-lg font-display font-black text-white">{format(new Date(issue.agreementDate + 'T00:00:00'), 'dd MMM')}</span>
                       </div>
                     )}
                   </div>
                </div>

                <div className="pt-10 border-t border-slate-200 dark:border-slate-800 pb-4">
                   <h4 className="text-[9px] font-black text-slate-700 uppercase tracking-[0.4em] mb-8 flex items-center gap-4">
                     <div className="w-6 h-px bg-slate-200 dark:bg-slate-800" />
                     EQUIPOS DE RESPONSABLES
                   </h4>
                   <div className="space-y-3">
                      {isFieldVisible('assignedPosition') && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-4 p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                             <div className="w-10 h-10 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center">
                               <UserIcon className="w-5 h-5 text-slate-600" />
                             </div>
                             <div className="flex flex-col flex-1">
                               <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-0.5">RESPONSABLE INICIAL / DIRECTOR</span>
                               <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-800 dark:text-white">{issue.assignedName}</span>
                                  {(issue.principalApproved || issue.status === 'RESPONDIDA') && (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} />
                                  )}
                               </div>
                               <span className="text-[7px] text-slate-500 font-bold uppercase mt-0.5">{issue.assignedPosition} {issue.assignedEmail ? `(${issue.assignedEmail})` : ''}</span>
                               
                               <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                                 <span className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Proceso Auditado</span>
                                 <span className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase bg-indigo-500/10 px-2 py-0.5 rounded tracking-wider">
                                   {getIssueAuditedProcess(issue)}
                                  </span>
                                </div>
                              </div>
                           </div>

                           {issue.redirectedTo && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                              className="flex items-center gap-4 p-5 bg-amber-500/5 border border-amber-500/20 rounded-2xl relative overflow-hidden group/redir"
                            >
                               <div className="w-10 h-10 bg-amber-500/20 border border-amber-500/30 rounded-xl flex items-center justify-center">
                                 <UserIcon className="w-5 h-5 text-amber-500" />
                               </div>
                               <div className="flex flex-col flex-1">
                                 <span className="text-[8px] font-black text-amber-500/60 uppercase tracking-widest mb-0.5">COLABORADOR</span>
                                 <div className="flex items-center gap-2">
                                   <span className="text-xs font-bold text-slate-800 dark:text-white uppercase">{issue.redirectedTo.name}</span>
                                   {issue.collaboratorApproved && (
                                     <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} />
                                   )}
                                 </div>
                                 <span className="text-[7px] text-amber-500 font-bold uppercase mt-0.5">{issue.redirectedTo.position} {issue.redirectedTo.team ? `[${issue.redirectedTo.team}]` : ''}</span>
                               </div>
                            </motion.div>
                          )}

                          {issue.executor && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                              className="flex items-center gap-4 p-5 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl relative overflow-hidden group/exec"
                            >
                               <div className="w-10 h-10 bg-indigo-500/20 border border-indigo-500/30 rounded-xl flex items-center justify-center">
                                 <UserIcon className="w-5 h-5 text-indigo-500" />
                               </div>
                               <div className="flex flex-col flex-1">
                                 <span className="text-[8px] font-black text-indigo-500/60 uppercase tracking-widest mb-0.5">RESPONSABLE EJECUTOR</span>
                                 <div className="flex items-center gap-2">
                                   <span className="text-xs font-bold text-slate-800 dark:text-white uppercase">{issue.executor.name}</span>
                                   {issue.executor.approved && (
                                     <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} />
                                   )}
                                 </div>
                                 <span className="text-[7px] text-indigo-500 font-bold uppercase mt-0.5">{issue.executor.position} {issue.executor.team ? `[${issue.executor.team}]` : ''}</span>
                               </div>
                            </motion.div>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-4 p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl">
                       <div className="w-10 h-10 bg-slate-200 dark:bg-slate-900 border border-slate-350 dark:border-slate-800 rounded-xl flex items-center justify-center text-slate-800 dark:text-white">
                         <ShieldCheck className="w-5 h-5" />
                       </div>
                       <div className="flex flex-col">
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">AUTOR DEL HALLAZGO / AUDITOR SST</span>
                         <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-white">{issue.creatorName}</span>
                            {issue.authorEmail && teamMemberMap[issue.authorEmail] && (
                              <span className="text-[7px] font-black px-1.5 py-0.5 bg-indigo-500/20 text-indigo-500 rounded uppercase tracking-tighter">{teamMemberMap[issue.authorEmail]}</span>
                            )}
                          </div>
                         <span className="text-[7px] text-slate-500 font-bold uppercase mt-1">
                           {issue.creatorPosition || "REGISTRO CDE HUB"}
                         </span>
                         {issue.authorEmail && <span className="text-[7px] text-slate-400 font-bold uppercase mt-0.5">{issue.authorEmail}</span>}
                       </div>
                    </div>
                    {isFieldVisible('reviewers') && (
                      <div className="pt-2">
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-3 block px-1">COMITÉ DE REVISIÓN</span>
                        
                        {issue.reviewers && issue.reviewers.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {issue.reviewers.map((rev, idx) => (
                              <div key={idx} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-[8px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tight">
                                {rev}
                              </div>
                            ))}
                          </div>
                        )}

                        {(!issue.reviewers || issue.reviewers.length === 0) && (
                           <p className="text-[9px] text-slate-700 font-bold uppercase tracking-[0.2em] px-1 italic">Sin revisores</p>
                        )}
                      </div>
                    )}
                   </div>
                </div>
             </div>
           </section>
        </div>
      </div>
    </motion.div>
  );
}
