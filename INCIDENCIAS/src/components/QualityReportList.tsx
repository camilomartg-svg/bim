import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Calendar, 
  User, 
  ChevronRight, 
  Eye, 
  Plus, 
  X, 
  Mic, 
  MicOff, 
  Filter, 
  Search, 
  ShieldCheck, 
  AlertCircle, 
  MapPin, 
  Users, 
  Building2, 
  Briefcase, 
  AlertTriangle, 
  Trash2, 
  Save, 
  Check, 
  Clock,
  Download,
  Paperclip,
  Image as ImageIcon,
  Film,
  Music,
  Loader2,
  Video,
  Camera,
  FileSpreadsheet,
  FileUp,
  StopCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { calculateDueDate, DayType } from '../lib/dateUtils';
import { 
  subscribeToQualityReports, 
  subscribeToTeam, 
  saveReport, 
  getProjectConfig,
  deleteReport
} from '../services/firebaseService';
import { useAuth } from '../context/AuthContext';
import { QualityReport, QualityReportBlock, TeamMember, IssueDegreeOfAction, IssueStatus } from '../types';
import { format } from 'date-fns';
import { generateQualityReportPDF } from '../utils/pdfGenerator';

const DEGREE_OF_ACTION = {
  menor: { label: "MENOR", color: "#00B050" },
  mayor: { label: "MAYOR", color: "#FFC000" },
  critica: { label: "CRÍTICA", color: "#FF0000" },
  no_aplica: { label: "NO APLICA", color: "#94A3B8" }
};

const COMPLIANCE_STATES = {
  CUMPLIDA_A_TIEMPO: { label: "Cumplida a tiempo", css: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  CUMPLIDA_FUERA_DE_TIEMPO: { label: "Cumplida fuera de tiempo", css: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  POR_VENCERSE: { label: "Por vencerse", css: "bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse" },
  CON_RETRASO: { label: "Con retraso", css: "bg-red-500/10 text-red-500 border-red-500/20" }
};

const getAbbreviation = (text: string) => {
  if (!text) return '';
  const match = text.match(/\[([A-Z0-9]+)\]/i);
  if (match) return match[1].toUpperCase();
  
  const clean = text.replace(/[^a-zA-Z0-9\s]/g, '');
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    return words.map(w => w[0]).join('').toUpperCase().slice(0, 3);
  }
  return text.slice(0, 3).toUpperCase();
};

const getDynamicBlockCode = (blockType: string, blockSource: string, reportCode: string, consecutive: number) => {
  const typeAbb = getAbbreviation(blockType);
  const sourceAbb = getAbbreviation(blockSource);
  const repCode = reportCode?.trim() || '0001';
  return `${typeAbb}${sourceAbb}-${repCode}-${consecutive}`;
};

export default function QualityReportList() {
  const { user } = useAuth();
  const isBimTeam = user?.team?.toUpperCase().includes('BIM') || 
                    user?.position?.toUpperCase().includes('BIM') ||
                    user?.email?.toLowerCase() === 'imagina3ddesign@gmail.com';

  const [reports, setReports] = useState<QualityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<QualityReport | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleDeleteReport = async () => {
    if (!selectedReport) return;
    try {
      await deleteReport(selectedReport.id);
      setSelectedReport(null);
      setIsConfirmingDelete(false);
    } catch (err) {
      console.error("Error al eliminar informe de calidad:", err);
    }
  };

  const handleCloseModal = () => {
    setSelectedReport(null);
    setIsConfirmingDelete(false);
  };

  const handleDownloadPDF = async () => {
    if (!selectedReport) return;
    try {
      await generateQualityReportPDF(selectedReport, teamMembers);
    } catch (e) {
      console.error("Error generating PDF:", e);
    }
  };
  
  // Create report form states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [manualReportCode, setManualReportCode] = useState('');
  const [blocks, setBlocks] = useState<Omit<QualityReportBlock, 'id'>[]>([]);
  
  // Custom dropdown options loaded from DB
  const [sources, setSources] = useState<string[]>([]);
  const [hitos, setHitos] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [codeStart, setCodeStart] = useState('0001');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  
  // Filters for Status (RESUELTAS by default is OFF)
  const [statusFilters, setStatusFilters] = useState<Record<string, boolean>>({
    ACTIVO: true,
    RESPONDIDA: true,
    VENCIDA: true,
    RECHAZADA: true,
    ACUERDO: true,
    ANULADA: true,
    REVISION_RESPONSABLE: true,
    RESUELTA: false // RESUELTA is OFF by default as requested!
  });
  const [showFiltersMenu, setShowFiltersMenu] = useState(false);

  // Voice Dictation
  const [isListening, setIsListening] = useState(false);
  const [activeSpeechField, setActiveSpeechField] = useState<{ blockIndex: number, field: string } | null>(null);
  const [recognitionInstance, setRecognitionInstance] = useState<any>(null);

  useEffect(() => {
    // 1. Subscribe to Quality Reports
    const unsubReports = subscribeToQualityReports((data) => {
      setReports(data);
      setLoading(false);
    });

    // 2. Fetch configurations and teams
    async function loadConfig() {
      const config = await getProjectConfig();
      if (config) {
        const rawSources = config.qualitySources || [
          "Auditoría Interna",
          "Auditoría Externa",
          "PQRS",
          "Revisión de la Dirección (Alta Gerencia)",
          "Gestión de Requisitos Legales",
          "Emergencias",
          "Eventos de Seguridad y Salud en el Trabajo",
          "Inspeccion de seguridad",
          "Inspeccion ambiental",
          "Inspecciones Rutinarias, Planeadas, No Planeadas (Calidad)",
          "Proyectos de Mejoras",
          "Mejoras de Procesos",
          "Gestión de Riesgos",
          "Gestión de Indicadores",
          "Gestión Ambiental",
          "Iniciativas Estratégicas",
          "Otros"
        ];
        setSources([...rawSources].sort((a, b) => a.localeCompare(b)));

        const rawHitos = config.qualityHitos || [
          "Escrituración",
          "Salida a Ventas",
          "Inicio de Obra",
          "Entregas - Post Construcción",
          "SST",
          "Calidad",
          "Ambiental",
          "Inicio de entregas",
          "ESCRITURACIÓN TORRE 3 Y 4"
        ];
        setHitos([...rawHitos].sort((a, b) => a.localeCompare(b)));

        const rawTypes = config.qualityTypes || [
          "Conformidad",
          "No Conformidad",
          "Oportunidad de mejora",
          "Accidente de Trabajo",
          "Accidente de Trabajo Mortal",
          "Alerta de seguridad"
        ];
        setTypes([...rawTypes].sort((a, b) => a.localeCompare(b)));

        setCodeStart(config.qualityCodeStart || '0001');
      } else {
        // Safe fallbacks sorted alphabetically
        const rawSources = [
          "Auditoría Interna",
          "Auditoría Externa",
          "PQRS",
          "Revisión de la Dirección (Alta Gerencia)",
          "Gestión de Requisitos Legales",
          "Emergencias",
          "Eventos de Seguridad y Salud en el Trabajo",
          "Inspeccion de seguridad",
          "Inspeccion ambiental",
          "Inspecciones Rutinarias, Planeadas, No Planeadas (Calidad)",
          "Proyectos de Mejoras",
          "Mejoras de Procesos",
          "Gestión de Riesgos",
          "Gestión de Indicadores",
          "Gestión Ambiental",
          "Iniciativas Estratégicas",
          "Otros"
        ];
        setSources([...rawSources].sort((a, b) => a.localeCompare(b)));

        const rawHitos = [
          "Escrituración",
          "Salida a Ventas",
          "Inicio de Obra",
          "Entregas - Post Construcción",
          "SST",
          "Calidad",
          "Ambiental",
          "Inicio de entregas",
          "ESCRITURACIÓN TORRE 3 Y 4"
        ];
        setHitos([...rawHitos].sort((a, b) => a.localeCompare(b)));

        const rawTypes = [
          "Conformidad",
          "No Conformidad",
          "Oportunidad de mejora",
          "Accidente de Trabajo",
          "Accidente de Trabajo Mortal",
          "Alerta de seguridad"
        ];
        setTypes([...rawTypes].sort((a, b) => a.localeCompare(b)));
      }
    }

    const unsubTeam = subscribeToTeam((fetchedTeam) => {
      setTeamMembers(fetchedTeam);
    });

    loadConfig();

    return () => {
      unsubReports();
      unsubTeam();
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
    };
  }, []);

  // Voice Dictation Helper
  const toggleSpeechRecognition = (blockIndex: number, field: string, currentValue: string, callback: (newVal: string) => void) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Su navegador no soporta reconocimiento de voz o micrófono. Utilice micro-buscadores compatibles como Chrome o Edge.");
      return;
    }

    if (isListening && activeSpeechField?.blockIndex === blockIndex && activeSpeechField?.field === field) {
      if (recognitionInstance) recognitionInstance.stop();
      setIsListening(false);
      setActiveSpeechField(null);
      return;
    }

    if (isListening && recognitionInstance) {
      recognitionInstance.stop();
    }

    const rec = new SpeechRecognition();
    rec.lang = 'es-ES';
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => {
      setIsListening(true);
      setActiveSpeechField({ blockIndex, field });
    };

    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        callback(currentValue ? `${currentValue} ${transcript}` : transcript);
      }
    };

    rec.onerror = (err: any) => {
      console.error(err);
      setIsListening(false);
      setActiveSpeechField(null);
    };

    rec.onend = () => {
      setIsListening(false);
      setActiveSpeechField(null);
    };

    setRecognitionInstance(rec);
    rec.start();
  };

  // Device capture states
  const [activeMediaBlock, setActiveMediaBlock] = useState<{ blockIndex: number, type: 'mic' | 'camera' } | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [audioRecorder, setAudioRecorder] = useState<MediaRecorder | null>(null);
  const [videoRecorder, setVideoRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [videoChunks, setVideoChunks] = useState<Blob[]>([]);
  
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [timerInterval, setTimerInterval] = useState<any>(null);
  
  // Camera specific (photo / video toggle)
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<'user' | 'environment'>('environment');

  // Trigger file-only upload fields
  const triggerImageSelector = (index: number) => {
    const el = document.getElementById(`img-input-${index}`) as HTMLInputElement;
    if (el) el.click();
  };

  const triggerDocSelector = (index: number) => {
    const el = document.getElementById(`doc-input-${index}`) as HTMLInputElement;
    if (el) el.click();
  };

  // Start Mic Record
  const startMicRecording = async (blockIndex: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const mergedBlob = new Blob(chunks, { type: 'audio/webm' });
        // Upload audio
        setUploadingBlock(prev => ({ ...prev, [blockIndex]: true }));
        try {
          const fileName = `voice_record_${Date.now()}.webm`;
          const storageRef = ref(storage, `quality_reports_evidence/${fileName}`);
          const uploadResult = await uploadBytes(storageRef, mergedBlob);
          const downloadUrl = await getDownloadURL(uploadResult.ref);
          
          const newAttachment = {
            id: 'att-' + Math.random().toString(36).substr(2, 9),
            name: `Audio Grabado (${new Date().toLocaleTimeString()}).webm`,
            url: downloadUrl,
            type: 'audio/webm',
            category: 'file' as const
          };

          setBlocks(prev => prev.map((b, i) => i === blockIndex ? {
            ...b,
            attachments: [...(b.attachments || []), newAttachment]
          } : b));
        } catch (err) {
          console.error("Error uploading recorded audio:", err);
          alert("Error al subir el audio grabado.");
        } finally {
          setUploadingBlock(prev => ({ ...prev, [blockIndex]: false }));
        }
      };

      setAudioChunks([]);
      setMicStream(stream);
      setAudioRecorder(recorder);
      setActiveMediaBlock({ blockIndex, type: 'mic' });
      setIsRecordingAudio(true);
      setAudioDuration(0);
      
      recorder.start();

      const timer = setInterval(() => {
        setAudioDuration(prev => prev + 1);
      }, 1000);
      setTimerInterval(timer);
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("No se pudo acceder al micrófono del dispositivo. Asegúrese de otorgar permisos.");
    }
  };

  const stopMicRecording = (cancel: boolean = false) => {
    if (timerInterval) clearInterval(timerInterval);
    setTimerInterval(null);

    if (audioRecorder && audioRecorder.state !== 'inactive') {
      if (cancel) {
        // Discard
        audioRecorder.onstop = () => {};
      }
      audioRecorder.stop();
    }

    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
    }

    setMicStream(null);
    setAudioRecorder(null);
    setIsRecordingAudio(false);
    setActiveMediaBlock(null);
  };

  // Start Camera
  const startCamera = async (blockIndex: number) => {
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: cameraFacingMode },
        audio: true 
      });
      setCameraStream(stream);
      setActiveMediaBlock({ blockIndex, type: 'camera' });
      setPhotoBlob(null);
      setIsRecordingVideo(false);
      setVideoDuration(0);
    } catch (err) {
      console.error("Camera access denied:", err);
      alert("No se pudo acceder a la cámara del dispositivo. Asegúrese de otorgar permisos.");
    }
  };

  const toggleCameraFacingMode = async (blockIndex: number) => {
    const nextMode = cameraFacingMode === 'user' ? 'environment' : 'user';
    setCameraFacingMode(nextMode);
    
    // Restart camera with new facing mode
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: nextMode },
        audio: true 
      });
      setCameraStream(stream);
    } catch (err) {
      console.error("Switch camera error:", err);
    }
  };

  // Capture instant photo
  const capturePhoto = (blockIndex: number) => {
    const videoElement = document.getElementById('camera-preview') as HTMLVideoElement;
    if (!videoElement) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth || 640;
    canvas.height = videoElement.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        setPhotoBlob(blob);
      }, 'image/jpeg', 0.85);
    }
  };

  // Keep / upload the captured photo
  const saveCapturedPhoto = async (blockIndex: number) => {
    if (!photoBlob) return;
    setUploadingBlock(prev => ({ ...prev, [blockIndex]: true }));
    try {
      const fileName = `cam_capture_${Date.now()}.jpg`;
      const storageRef = ref(storage, `quality_reports_evidence/${fileName}`);
      const uploadResult = await uploadBytes(storageRef, photoBlob);
      const downloadUrl = await getDownloadURL(uploadResult.ref);
      
      const newAttachment = {
        id: 'att-' + Math.random().toString(36).substr(2, 9),
        name: `Foto de Cámara (${new Date().toLocaleTimeString()}).jpg`,
        url: downloadUrl,
        type: 'image/jpeg',
        category: 'image' as const
      };

      setBlocks(prev => prev.map((b, i) => i === blockIndex ? {
        ...b,
        attachments: [...(b.attachments || []), newAttachment]
      } : b));
      closeCamera();
    } catch (err) {
      console.error("Error uploading photo snapshot:", err);
      alert("Error al subir la foto capturada.");
    } finally {
      setUploadingBlock(prev => ({ ...prev, [blockIndex]: false }));
    }
  };

  // Start Video Record from Camera
  const startVideoRecording = (blockIndex: number) => {
    if (!cameraStream) return;
    const recorder = new MediaRecorder(cameraStream);
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      const mergedBlob = new Blob(chunks, { type: 'video/webm' });
      setUploadingBlock(prev => ({ ...prev, [blockIndex]: true }));
      try {
        const fileName = `video_record_${Date.now()}.webm`;
        const storageRef = ref(storage, `quality_reports_evidence/${fileName}`);
        const uploadResult = await uploadBytes(storageRef, mergedBlob);
        const downloadUrl = await getDownloadURL(uploadResult.ref);
        
        const newAttachment = {
          id: 'att-' + Math.random().toString(36).substr(2, 9),
          name: `Video Grabado (${new Date().toLocaleTimeString()}).webm`,
          url: downloadUrl,
          type: 'video/webm',
          category: 'video' as const
        };

        setBlocks(prev => prev.map((b, i) => i === blockIndex ? {
          ...b,
          attachments: [...(b.attachments || []), newAttachment]
        } : b));
      } catch (err) {
        console.error("Error uploading video record:", err);
        alert("Error al subir el video grabado.");
      } finally {
        setUploadingBlock(prev => ({ ...prev, [blockIndex]: false }));
      }
    };

    setVideoChunks([]);
    setVideoRecorder(recorder);
    setIsRecordingVideo(true);
    setVideoDuration(0);
    recorder.start();

    const timer = setInterval(() => {
      setVideoDuration(prev => prev + 1);
    }, 1000);
    setTimerInterval(timer);
  };

  const stopVideoRecording = () => {
    if (timerInterval) clearInterval(timerInterval);
    setTimerInterval(null);

    if (videoRecorder && videoRecorder.state !== 'inactive') {
      videoRecorder.stop();
    }
    setIsRecordingVideo(false);
    setVideoRecorder(null);
  };

  // Close Camera
  const closeCamera = () => {
    if (timerInterval) clearInterval(timerInterval);
    setTimerInterval(null);

    if (videoRecorder && videoRecorder.state !== 'inactive') {
      videoRecorder.stop();
    }

    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }

    setCameraStream(null);
    setVideoRecorder(null);
    setIsRecordingVideo(false);
    setActiveMediaBlock(null);
    setPhotoBlob(null);
  };

  // Safe report count and block calculation to calculate automatic next block code
  const getNextBlockCode = (index: number) => {
    // Collect all existing blocks across all saved reports to know highest code
    let count = parseInt(codeStart) || 1;
    reports.forEach(rep => {
      rep.blocks?.forEach(blk => {
        const num = parseInt(blk.code);
        if (!isNaN(num) && num >= count) {
          count = num + 1;
        }
      });
    });
    // Add current index offset for unsaved ones in form
    return String(count + index).padStart(4, '0');
  };

  const getAssignedTeamOfBlock = (b: QualityReportBlock | any) => {
    if (b.assignedEmail) {
      const found = teamMembers.find(m => m.email?.toLowerCase() === b.assignedEmail?.toLowerCase());
      if (found?.team) return found.team;
    }
    if (b.assignedName) {
      const found = teamMembers.find(m => m.name?.toLowerCase() === b.assignedName?.toLowerCase());
      if (found?.team) return found.team;
    }
    return b.assignedTeam || '';
  };

  const handleAddNewFormBlock = () => {
    const nextIndex = blocks.length;
    const nextCode = getNextBlockCode(nextIndex);
    setBlocks(prev => [...prev, {
      source: sources[0] || 'Auditoría Interna',
      code: nextCode,
      title: '',
      hito: hitos[0] || 'Calidad',
      type: types[0] || 'Conformidad',
      criticality: 'menor',
      description: '',
      correctiveAction: '',
      assignedPosition: '',
      assignedName: '',
      reviewerCommittee: [],
      implementationSupport: '',
      dueDate: calculateDueDate(new Date(), 7, 'OFICINA').toISOString().split('T')[0],
      dueDateDays: 7,
      dayType: 'OFICINA',
      status: 'ACTIVO',
      complianceStatus: 'POR_VENCERSE',
      initialEfficiencyMeasure: ''
    }]);
  };

  const [uploadingBlock, setUploadingBlock] = useState<Record<number, boolean>>({});

  const handleUploadFile = async (blockIndex: number, file: File) => {
    setUploadingBlock(prev => ({ ...prev, [blockIndex]: true }));
    try {
      const storageRef = ref(storage, `quality_reports_evidence/blk_${blockIndex}_${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(uploadResult.ref);
      
      const category: 'image' | 'video' | 'file' = 
        file.type.startsWith('image/') ? 'image' :
        file.type.startsWith('video/') ? 'video' : 'file';

      const newAttachment = {
        id: 'att-' + Math.random().toString(36).substr(2, 9),
        name: file.name,
        url: downloadUrl,
        type: file.type || 'application/octet-stream',
        category
      };

      setBlocks(prev => prev.map((b, i) => i === blockIndex ? {
        ...b,
        attachments: [...(b.attachments || []), newAttachment]
      } : b));
    } catch (err) {
      console.error("Error uploading file:", err);
      alert("Error al subir archivo: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingBlock(prev => ({ ...prev, [blockIndex]: false }));
    }
  };

  const handleDeleteAttachment = (blockIndex: number, attachmentId: string) => {
    setBlocks(prev => prev.map((b, i) => i === blockIndex ? {
      ...b,
      attachments: (b.attachments || []).filter(a => a.id !== attachmentId)
    } : b));
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle.trim()) {
      alert("Ingrese un título para el informe de obra.");
      return;
    }
    if (!manualReportCode || manualReportCode.trim().length !== 4) {
      alert("Ingrese un código manual de 4 dígitos numéricos para el informe.");
      return;
    }
    if (blocks.length === 0) {
      alert("Agregue al menos un bloque/hallazgo de calidad.");
      return;
    }

    // Verify titles and descriptions
    for (let i = 0; i < blocks.length; i++) {
      if (!blocks[i].title || !blocks[i].title.trim()) {
        alert(`Especificar título en el bloque #${i + 1}`);
        return;
      }
      if (!blocks[i].description.trim()) {
        alert(`Especificar descripción en el bloque #${i + 1}`);
        return;
      }
    }

    try {
      // Structure blocks with generated dynamic IDs
      const finalBlocks: QualityReportBlock[] = blocks.map((b, i) => {
        const computedCode = getDynamicBlockCode(
          b.type,
          b.source,
          manualReportCode,
          i + 1
        );
        return {
          ...b,
          id: 'blk-' + Math.random().toString(36).substr(2, 9),
          code: computedCode,
          reviewerCommittee: b.reviewerCommittee || []
        };
      }) as QualityReportBlock[];

      const reportCode = `INF-CAL-${manualReportCode}`;

      await saveReport({
        code: reportCode,
        title: reportTitle.toUpperCase(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        creatorId: user?.id || 'anonymous',
        creatorName: user?.name || 'Usuario',
        creatorPosition: user?.position || 'Calidad',
        creatorTeam: 'CALIDAD',
        blocks: finalBlocks,
        status: 'FINALIZED',
        reportType: 'QUALITY'
      } as any);

      // Clean form state
      setReportTitle('');
      setManualReportCode('');
      setBlocks([]);
      setIsCreateModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Hubo un error guardando el informe.");
    }
  };

  const handleUpdateBlockStatusInDetail = async (blockId: string, updates: Partial<QualityReportBlock>) => {
    if (!selectedReport) return;
    
    const updatedBlocks = selectedReport.blocks.map(b => {
      if (b.id === blockId) {
        return {
          ...b,
          ...updates
        };
      }
      return b;
    });

    const allResolved = updatedBlocks.every(b => b.status === 'RESUELTA' || b.status === 'ANULADA');

    const updatedRep: QualityReport = {
      ...selectedReport,
      blocks: updatedBlocks,
      status: allResolved ? 'CERRADO' as any : 'FINALIZED',
      updatedAt: new Date().toISOString()
    };

    try {
      await saveReport(updatedRep as any);
      setSelectedReport(updatedRep);
    } catch (err) {
      console.error(err);
      alert("Error actualizando estado.");
    }
  };

  // Filtering reports based on search term AND sub-block status matches
  const filteredReports = reports.filter(rep => {
    // 1. Text Search matches report details or block descriptions/codes
    const textLower = searchTerm.toLowerCase();
    const textMatch = rep.title.toLowerCase().includes(textLower) ||
                      rep.code.toLowerCase().includes(textLower) ||
                      rep.creatorName.toLowerCase().includes(textLower) ||
                      rep.blocks?.some(b => 
                        b.description.toLowerCase().includes(textLower) || 
                        b.code.toLowerCase().includes(textLower) ||
                        b.assignedName.toLowerCase().includes(textLower)
                      );
    if (!textMatch) return false;

    // 2. Status match: report must have AT LEAST ONE block whose status is toggled ON (true)
    const hasVisibleBlockStatus = rep.blocks?.some(b => statusFilters[b.status ?? 'ACTIVO'] === true);
    return hasVisibleBlockStatus;
  });

  return (
    <div className="flex-1 bg-white dark:bg-[#020617] h-screen overflow-hidden flex flex-col font-sans transition-colors duration-200">
      <header className="p-8 lg:p-12 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#020617]/50 backdrop-blur-xl shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-3">
            <h1 className="text-4xl lg:text-5xl font-display font-black text-slate-900 dark:text-white tracking-tight uppercase">
              Informes de Calidad
            </h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3">
              <span className="w-8 h-px bg-slate-200 dark:bg-slate-800" />
              Trazabilidad de Control y Hallazgos de Calidad
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
             <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-slate-800 dark:group-focus-within:text-white transition-colors" />
                <input 
                  type="text"
                  placeholder="BUSCAR HALLAZGOS..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-12 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-white outline-none focus:border-indigo-505 dark:focus:border-indigo-500/50 focus:bg-white dark:focus:bg-slate-900 transition-all w-full sm:w-64"
                />
             </div>
             
             {/* Status Filter Dropdown Pill */}
             <div className="relative">
               <button 
                 onClick={() => setShowFiltersMenu(!showFiltersMenu)}
                 className="px-6 py-3.5 bg-slate-100 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-3 text-slate-600 dark:text-slate-400 font-black text-[10px] uppercase tracking-widest transition-all"
               >
                 <Filter className="w-4 h-4" /> Filtros Estados
               </button>
               <AnimatePresence>
                 {showFiltersMenu && (
                   <motion.div 
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 10 }}
                     className="absolute right-0 top-full mt-3 bg-slate-950 border border-slate-800 p-6 rounded-2xl shadow-2xl w-60 z-50 space-y-3"
                   >
                     <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                       <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Filtrar por Estado</span>
                       <button onClick={() => setShowFiltersMenu(false)} className="text-slate-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                     </div>
                     <div className="space-y-2">
                       {Object.keys(statusFilters).map((status) => (
                         <label key={status} className="flex items-center gap-3 p-2 bg-slate-900/40 rounded-xl border border-slate-900 hover:border-slate-800 cursor-pointer select-none">
                           <input 
                             type="checkbox"
                             checked={statusFilters[status]}
                             onChange={() => setStatusFilters(prev => ({ ...prev, [status]: !prev[status] }))}
                             className="rounded border-slate-800 text-indigo-500 bg-slate-950 focus:ring-0"
                           />
                           <span className={cn("text-[9px] font-black uppercase tracking-widest", statusFilters[status] ? "text-white" : "text-slate-600")}>
                             {status} {status === 'RESUELTA' && <span className="text-[8px] text-indigo-400 font-bold lowercase italic">(apagadas por defecto)</span>}
                           </span>
                         </label>
                       ))}
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
             </div>

             <button 
               onClick={() => {
                 setBlocks([]);
                 setReportTitle('');
                 const nextCodeNum = reports.length + 1001;
                 setManualReportCode(String(nextCodeNum).slice(-4));
                 setIsCreateModalOpen(true);
               }}
               className="bg-[#FFC000] text-slate-900 px-6 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-400 transition-all shadow-md flex items-center justify-center gap-2 group active:scale-95"
             >
               <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
               Registrar Informe de Calidad
             </button>
          </div>
        </div>
      </header>

      {/* Grid listing Quality Reports */}
      <div className="flex-1 overflow-auto p-8 lg:p-12 custom-scrollbar">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredReports.map((report) => {
              // Extract sub-blocks that match our filters
              const visibleBlocks = report.blocks?.filter(b => statusFilters[b.status ?? 'ACTIVO'] === true) || [];
              if (visibleBlocks.length === 0) return null;

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className="group p-6 bg-slate-900/30 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/50 rounded-[2.5rem] flex flex-col justify-between transition-all cursor-pointer min-h-[240px] relative active:scale-[0.98]"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="px-3 py-1 bg-white rounded-md">
                          <span className="text-[9px] font-black text-slate-950 font-mono tracking-widest">{report.code}</span>
                        </div>
                        {report.status === 'CERRADO' || report.blocks?.every(b => b.status === 'RESUELTA' || b.status === 'ANULADA') ? (
                          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[7px] font-black uppercase tracking-widest rounded">
                            SUBSANADO / CERRADO
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[7px] font-black uppercase tracking-widest rounded">
                            ABIERTO
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-[8px] font-black uppercase tracking-widest font-mono">
                          {format(new Date(report.createdAt), 'dd MMM, yy')}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-base font-display font-black text-white hover:text-indigo-400 transition-colors uppercase tracking-tight leading-snug line-clamp-2">
                      {report.title}
                    </h3>

                    {/* Block snippets */}
                    <div className="space-y-2 mt-4">
                      {visibleBlocks.slice(0, 3).map((b) => (
                        <div key={b.id} className="p-3 bg-slate-950/50 border border-slate-900 rounded-xl flex items-center justify-between text-[10px]">
                          <span className="font-mono text-slate-400 text-[8px] tracking-widest">#{b.code}</span>
                          <span className="font-bold text-slate-200 line-clamp-1 flex-1 mx-3">{b.description}</span>
                          <span className="text-[7px] px-2 py-0.5 rounded font-black uppercase bg-slate-900 text-indigo-400 border border-indigo-900/20">{b.status}</span>
                        </div>
                      ))}
                      {visibleBlocks.length > 3 && (
                        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest text-center mt-2">+ {visibleBlocks.length - 3} más hallazgos</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-5 mt-6 border-t border-slate-800/40 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="font-black uppercase tracking-widest">{report.creatorName}</span>
                    </span>
                    <span className="font-black text-slate-400 uppercase tracking-widest font-mono">
                      {report.blocks?.length || 0} HALLAZGOS TOTALES
                    </span>
                  </div>
                </motion.div>
              );
            })}

            {filteredReports.length === 0 && (
              <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-800 rounded-[3rem] space-y-4">
                <ShieldCheck className="w-12 h-12 text-slate-700 mx-auto" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No hay Informes de Calidad creados o válidos con el filtro de estado actual</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* MODAL 1: CREAR INFORME DE CALIDAD (Hallazgos de calidad) */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex justify-end">
            <motion.div 
              initial={{ x: '100%', opacity: 0.9 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 180 }}
              className="w-full max-w-4xl bg-white dark:bg-[#090d1f] border-l border-slate-200 dark:border-slate-900 h-screen overflow-hidden flex flex-col shadow-2xl"
            >
              <header className="p-8 border-b border-slate-200 dark:border-slate-900 flex justify-between items-center shrink-0 bg-white/50 dark:bg-[#020617]/50">
                <div>
                  <h2 className="text-xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Nuevo Informe de Calidad</h2>
                  <p className="text-[9px] text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest mt-1">Registra bloques y define responsable, comité de revisión y compromisos</p>
                </div>
                <button 
                  onClick={() => setIsCreateModalOpen(false)} 
                  className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 p-3 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-all shadow-inner border border-slate-200 dark:border-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </header>

              <form onSubmit={handleCreateReport} className="flex-1 overflow-auto p-8 space-y-10 custom-scrollbar">
                {/* Global Info */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-3 space-y-4">
                    <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 px-1">
                      Título del Informe <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      required
                      value={reportTitle}
                      onChange={(e) => setReportTitle(e.target.value)}
                      placeholder="INGRESAR NOMBRE DEL INFORME (E.G. REVISIÓN CALIDAD CIMENTACIÓN)"
                      className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl text-[13px] text-slate-800 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-indigo-500/50 dark:focus:border-slate-800 transition-all shadow-inner uppercase tracking-wide"
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="block text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 px-1">
                      Código de Informe <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      required
                      maxLength={4}
                      value={manualReportCode}
                      onChange={(e) => setManualReportCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="0001"
                      className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl text-[13px] text-slate-850 dark:text-white font-mono font-black text-center placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:border-indigo-500/50 dark:focus:border-slate-800 transition-all shadow-inner uppercase tracking-wide"
                    />
                  </div>
                </div>

                {/* Blocks Head */}
                <div className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-900">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Bloques Técnicos (Hallazgos)</h4>
                      <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-1">Suma bloques y personaliza sus parámetros indicativos</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={handleAddNewFormBlock}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-xl shadow-indigo-600/10 active:scale-95"
                    >
                      <Plus className="w-4 h-4" /> Añadir Bloque
                    </button>
                  </div>

                  {blocks.length === 0 && (
                    <div className="py-12 border-2 border-dashed border-slate-200 dark:border-slate-900 rounded-[2rem] bg-slate-50 dark:bg-slate-950/20 text-center text-slate-500 space-y-2">
                      <AlertCircle className="w-8 h-8 mx-auto text-slate-700" />
                      <p className="text-[9px] font-black uppercase tracking-widest">Sin bloques agregados. Toque "Añadir Bloque" para iniciar.</p>
                    </div>
                  )}

                  <div className="space-y-8">
                    {blocks.map((block, index) => {
                      const updateBlock = (fields: Partial<typeof block>) => {
                        setBlocks(prev => prev.map((b, i) => i === index ? { ...b, ...fields } : b));
                      };

                      const computedCode = getDynamicBlockCode(
                        block.type,
                        block.source,
                        manualReportCode,
                        index + 1
                      );

                      return (
                        <div key={index} className="bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-900 p-8 rounded-[2rem] relative space-y-6">
                          <button 
                            type="button" 
                            onClick={() => setBlocks(prev => prev.filter((_, i) => i !== index))}
                            className="absolute top-6 right-6 p-2 text-slate-500 dark:text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-black text-xs">
                              {index + 1}
                            </span>
                            <span className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-widest">
                              Bloque Técnico - Auto Código: <span className="font-mono text-indigo-400 font-extrabold">{computedCode}</span>
                            </span>
                          </div>

                          {/* Block finding title input */}
                          <div className="space-y-3">
                            <label className="block text-[8px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-500 mb-2 px-1">Título del Hallazgo / Incidencia <span className="text-red-500">*</span></label>
                            <input 
                              type="text" 
                              required
                              value={block.title || ''}
                              onChange={(e) => updateBlock({ title: e.target.value })}
                              placeholder="E.G. REGISTRO DE DESVIACIÓN DE NIVEL O DEFECTO DE VIGA"
                              className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl text-[10px] text-slate-800 dark:text-white font-bold uppercase tracking-wider outline-none focus:border-indigo-500/50 dark:focus:border-slate-800 transition-all shadow-inner"
                            />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* SOURCE dropdown */}
                            <div>
                              <label className="block text-[8px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-500 mb-2 px-1">Fuente del Hallazgo</label>
                              <select 
                                value={block.source}
                                onChange={(e) => updateBlock({ source: e.target.value })}
                                className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl text-[10px] text-slate-800 dark:text-white font-black uppercase tracking-wider outline-none focus:border-slate-350 dark:focus:border-slate-800 transition-all cursor-pointer"
                              >
                                {sources.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>

                            {/* Type dropdown */}
                            <div>
                              <label className="block text-[8px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-500 mb-2 px-1">Tipo de Calidad</label>
                              <select 
                                value={block.type}
                                onChange={(e) => updateBlock({ type: e.target.value })}
                                className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl text-[10px] text-slate-800 dark:text-white font-black uppercase tracking-wider outline-none focus:border-slate-350 dark:focus:border-slate-800 transition-all cursor-pointer"
                              >
                                {types.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </div>

                            {/* Hito dropdown */}
                            <div>
                              <label className="block text-[8px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-500 mb-2 px-1 font-sans">Hito Vinculado</label>
                              <select 
                                value={block.hito}
                                onChange={(e) => updateBlock({ hito: e.target.value })}
                                className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl text-[10px] text-slate-800 dark:text-white font-black uppercase tracking-wider outline-none focus:border-slate-350 dark:focus:border-slate-800 transition-all cursor-pointer"
                              >
                                {hitos.map(h => <option key={h} value={h}>{h}</option>)}
                              </select>
                            </div>
                          </div>

                          {/* Criticality & Core text fields */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Criticality select */}
                            <div>
                              <label className="block text-[8px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-500 mb-2 px-1">Criticidad</label>
                              <select 
                                value={block.criticality}
                                onChange={(e) => updateBlock({ criticality: e.target.value as IssueDegreeOfAction })}
                                className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl text-[10px] text-slate-800 dark:text-white font-black uppercase tracking-wider outline-none focus:border-slate-350 dark:focus:border-slate-800 transition-all cursor-pointer"
                              >
                                {Object.entries(DEGREE_OF_ACTION)
                                  .sort((a, b) => a[1].label.localeCompare(b[1].label))
                                  .map(([k, meta]) => (
                                    <option key={k} value={k} className="text-slate-950">{meta.label}</option>
                                  ))
                                }
                              </select>
                            </div>

                             {/* Date commitment with business/site/calendar logic */}
                             <div>
                               <label className="block text-[8px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-500 mb-2 px-1">Fecha de Compromiso</label>
                               <div className="grid grid-cols-2 gap-3 mb-2">
                                 <div>
                                   <label className="block text-[7px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-1 px-1">Plazo (Días)</label>
                                   <input 
                                     type="number"
                                     min="1"
                                     max="365"
                                     value={block.dueDateDays ?? 7}
                                     onChange={(e) => {
                                       const days = parseInt(e.target.value) || 0;
                                       const calculated = calculateDueDate(new Date(), days, block.dayType ?? 'OFICINA');
                                       updateBlock({ 
                                         dueDateDays: days,
                                         dueDate: calculated.toISOString().split('T')[0]
                                       });
                                     }}
                                     className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl text-[10px] text-slate-800 dark:text-white font-black outline-none focus:border-slate-350 dark:focus:border-slate-800 transition-all text-center"
                                   />
                                 </div>
                                 <div>
                                   <label className="block text-[7px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-1 px-1">Tipo de Días</label>
                                   <select
                                     value={block.dayType ?? 'OFICINA'}
                                     onChange={(e) => {
                                       const type = e.target.value as DayType;
                                       const calculated = calculateDueDate(new Date(), block.dueDateDays ?? 7, type);
                                       updateBlock({ 
                                         dayType: type,
                                         dueDate: calculated.toISOString().split('T')[0]
                                       });
                                     }}
                                     className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl text-[10px] text-slate-800 dark:text-white font-black uppercase tracking-wider outline-none focus:border-slate-350 dark:focus:border-slate-800 transition-all cursor-pointer"
                                   >
                                     <option value="OFICINA">Oficina (Lun-Vie)</option>
                                     <option value="OBRA">Obra (Lun-Sab)</option>
                                     <option value="CALENDARIO">Calendario</option>
                                   </select>
                                 </div>
                               </div>
                               <div>
                                 <label className="block text-[7px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-1 px-1 font-mono">Fecha Calculada / Manual</label>
                                 <input 
                                   type="date"
                                   value={block.dueDate}
                                   onChange={(e) => updateBlock({ dueDate: e.target.value })}
                                   className="w-full px-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl text-[10px] text-slate-800 dark:text-white font-black uppercase tracking-wider outline-none focus:border-slate-350 dark:focus:border-slate-800 transition-all"
                                 />
                               </div>
                             </div>
                          </div>

                          {/* TEXT DESCRIPTIONS AND DICTATIONS */}
                          <div className="space-y-6">
                            {/* Description with voice dictation */}
                            <div>
                              <div className="flex justify-between items-center mb-2 px-1">
                                <label className="text-[8px] font-black uppercase tracking-widest text-slate-500">Descripción del Hallazgo <span className="text-red-500">*</span></label>
                                <button 
                                  type="button"
                                  onClick={() => toggleSpeechRecognition(index, 'desc', block.description, (nv) => updateBlock({ description: nv }))}
                                  className={cn(
                                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest transition-all",
                                    isListening && activeSpeechField?.blockIndex === index && activeSpeechField?.field === 'desc' 
                                      ? "bg-red-500 text-white animate-pulse" 
                                      : "bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                  )}
                                >
                                  {isListening && activeSpeechField?.blockIndex === index && activeSpeechField?.field === 'desc' 
                                    ? <MicOff className="w-2.5 h-2.5" /> : <Mic className="w-2.5 h-2.5" />} Escuchar por voz
                                </button>
                              </div>
                              <textarea 
                                value={block.description}
                                onChange={(e) => updateBlock({ description: e.target.value })}
                                placeholder="Escribe o dicta por voz los detalles específicos del hallazgo de calidad..."
                                className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl text-[11px] text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-700 font-medium h-20 resize-none outline-none focus:border-slate-350 dark:focus:border-slate-800 transition-all"
                              />
                            </div>

                             {/* Attachments Upload Field */}
                             <div className="p-4 bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-900 rounded-2xl space-y-4">
                               <label className="block text-[8px] font-black uppercase tracking-widest text-[#FFC000] mb-1 px-1 flex items-center gap-1.5">
                                 <Paperclip className="w-3.5 h-3.5" /> EVIDENCIAS ADICIONALES (FOTOS, VIDEOS, AUDIOS, DOCUMENTOS)
                               </label>

                               {/* Hidden inputs for targeted actions */}
                               <input 
                                 id={`img-input-${index}`}
                                 type="file" 
                                 multiple 
                                 disabled={uploadingBlock[index]}
                                 accept="image/*,video/*"
                                 className="hidden"
                                 onChange={(e) => {
                                   const files = e.target.files;
                                   if (files) {
                                     Array.from(files).forEach(file => {
                                       handleUploadFile(index, file);
                                     });
                                   }
                                   e.target.value = '';
                                 }}
                               />
                               <input 
                                 id={`doc-input-${index}`}
                                 type="file" 
                                 multiple 
                                 disabled={uploadingBlock[index]}
                                 accept="audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                                 className="hidden"
                                 onChange={(e) => {
                                   const files = e.target.files;
                                   if (files) {
                                     Array.from(files).forEach(file => {
                                       handleUploadFile(index, file);
                                     });
                                   }
                                   e.target.value = '';
                                 }}
                               />
                               
                               {/* Media controls bar */}
                               <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                 {/* Mic button */}
                                 <button
                                   type="button"
                                   onClick={() => activeMediaBlock?.blockIndex === index && activeMediaBlock?.type === 'mic' ? stopMicRecording(false) : startMicRecording(index)}
                                   disabled={uploadingBlock[index]}
                                   className={cn(
                                     "flex flex-col items-center justify-center p-3 border rounded-xl gap-1.5 transition-all text-center select-none cursor-pointer",
                                     activeMediaBlock?.blockIndex === index && activeMediaBlock?.type === 'mic'
                                       ? "border-red-500 bg-red-500/10 text-red-500 animate-pulse"
                                       : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
                                   )}
                                 >
                                   <Mic className="w-5 h-5" />
                                   <span className="text-[7.5px] font-black uppercase tracking-widest">Activar Micr.</span>
                                 </button>

                                 {/* Camera button */}
                                 <button
                                   type="button"
                                   onClick={() => activeMediaBlock?.blockIndex === index && activeMediaBlock?.type === 'camera' ? closeCamera() : startCamera(index)}
                                   disabled={uploadingBlock[index]}
                                   className={cn(
                                     "flex flex-col items-center justify-center p-3 border rounded-xl gap-1.5 transition-all text-center select-none cursor-pointer",
                                     activeMediaBlock?.blockIndex === index && activeMediaBlock?.type === 'camera'
                                       ? "border-indigo-500 bg-indigo-500/10 text-indigo-500"
                                       : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
                                   )}
                                 >
                                   <Camera className="w-5 h-5" />
                                   <span className="text-[7.5px] font-black uppercase tracking-widest">Activar Cámara</span>
                                 </button>

                                 {/* Image selection */}
                                 <button
                                   type="button"
                                   onClick={() => triggerImageSelector(index)}
                                   disabled={uploadingBlock[index]}
                                   className="flex flex-col items-center justify-center p-3 border border-slate-200 dark:border-slate-800 rounded-xl gap-1.5 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-center select-none cursor-pointer"
                                 >
                                   <ImageIcon className="w-5 h-5" />
                                   <span className="text-[7.5px] font-black uppercase tracking-widest">Subir Foto</span>
                                 </button>

                                 {/* Document selection */}
                                 <button
                                   type="button"
                                   onClick={() => triggerDocSelector(index)}
                                   disabled={uploadingBlock[index]}
                                   className="flex flex-col items-center justify-center p-3 border border-slate-200 dark:border-slate-800 rounded-xl gap-1.5 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-center select-none cursor-pointer"
                                 >
                                   <FileUp className="w-5 h-5" />
                                   <span className="text-[7.5px] font-black uppercase tracking-widest">Documento</span>
                                 </button>
                               </div>

                               {/* Upload progress feedback */}
                               {uploadingBlock[index] && (
                                 <div className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[9px] font-black uppercase tracking-wider text-indigo-400 animate-pulse">
                                   <Loader2 className="w-3.5 h-3.5 animate-spin" /> Subiendo evidencias adicionales...
                                 </div>
                               )}

                               {/* Active Audio Capture UI */}
                               {activeMediaBlock?.blockIndex === index && activeMediaBlock?.type === 'mic' && (
                                 <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2">
                                   <div className="flex items-center justify-between">
                                     <div className="flex items-center gap-1.5">
                                       <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                       <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">GRABANDO AUDIO EN VIVO...</span>
                                     </div>
                                     <span className="text-[10px] font-black text-red-400 font-mono">
                                       {Math.floor(audioDuration / 60).toString().padStart(2, '0')}:{(audioDuration % 60).toString().padStart(2, '0')}
                                     </span>
                                   </div>
                                   <div className="flex gap-2">
                                     <button 
                                       type="button" 
                                       onClick={() => stopMicRecording(false)}
                                       className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-[8px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5"
                                     >
                                       <Check className="w-3 h-3" /> Guardar Audio
                                     </button>
                                     <button 
                                       type="button" 
                                       onClick={() => stopMicRecording(true)}
                                       className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-705 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all"
                                     >
                                       Cancelar
                                     </button>
                                   </div>
                                 </div>
                               )}

                               {/* Active Video/Camera Capture UI */}
                               {activeMediaBlock?.blockIndex === index && activeMediaBlock?.type === 'camera' && (
                                 <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3 text-white">
                                   <div className="flex items-center justify-between">
                                     <span className="text-[8px] font-black uppercase tracking-widest text-[#FFC000]">CÁMARA DEL DISPOSITIVO</span>
                                     <div className="flex gap-2">
                                       <button 
                                         type="button" 
                                         onClick={() => toggleCameraFacingMode(index)}
                                         className="px-2 py-1 bg-slate-800 hover:bg-slate-750 rounded text-[7px] font-black uppercase tracking-wider transition-all"
                                       >
                                         Girar Cámara
                                       </button>
                                       <button 
                                         type="button" 
                                         onClick={closeCamera}
                                         className="p-1 text-slate-400 hover:text-white"
                                       >
                                         <X className="w-3.5 h-3.5" />
                                       </button>
                                     </div>
                                   </div>
                                   
                                   <div className="relative aspect-video w-full bg-black rounded-lg overflow-hidden border border-slate-800">
                                     {!photoBlob ? (
                                       <video 
                                         id="camera-preview" 
                                         autoPlay 
                                         playsInline 
                                         muted 
                                         ref={(video) => {
                                           if (video && cameraStream && video.srcObject !== cameraStream) {
                                             video.srcObject = cameraStream;
                                           }
                                         }}
                                         className="w-full h-full object-cover" 
                                       />
                                     ) : (
                                       <img 
                                         src={URL.createObjectURL(photoBlob)} 
                                         alt="Preview snapshot" 
                                         className="w-full h-full object-cover" 
                                       />
                                     )}
                                     
                                     {isRecordingVideo && (
                                       <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-600 px-2 py-0.5 rounded text-[8px] font-bold text-white uppercase tracking-widest animate-pulse">
                                         <span className="w-1.5 h-1.5 bg-white rounded-full" />
                                         REC {Math.floor(videoDuration / 60).toString().padStart(2, '0')}:{(videoDuration % 60).toString().padStart(2, '0')}
                                       </div>
                                     )}
                                   </div>

                                   <div className="flex flex-wrap gap-2">
                                     {!photoBlob ? (
                                       <>
                                         <button 
                                           type="button" 
                                           onClick={() => capturePhoto(index)}
                                           className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"
                                         >
                                           <Camera className="w-3 h-3" /> Tomar Foto
                                         </button>
                                         
                                         {!isRecordingVideo ? (
                                           <button 
                                             type="button" 
                                             onClick={() => startVideoRecording(index)}
                                             className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"
                                           >
                                             <Film className="w-3 h-3" /> Grabar Video
                                           </button>
                                         ) : (
                                           <button 
                                             type="button" 
                                             onClick={stopVideoRecording}
                                             className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"
                                           >
                                             <StopCircle className="w-3 h-3" /> Detener Video
                                           </button>
                                         )}
                                       </>
                                     ) : (
                                       <>
                                         <button 
                                           type="button" 
                                           onClick={() => saveCapturedPhoto(index)}
                                           className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5"
                                         >
                                           <Check className="w-3 h-3" /> Usar Foto
                                         </button>
                                         <button 
                                           type="button" 
                                           onClick={() => setPhotoBlob(null)}
                                           className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[8px] font-black uppercase tracking-widest"
                                         >
                                           Volver a Tomar
                                         </button>
                                       </>
                                     )}
                                   </div>
                                 </div>
                               )}

                              {/* Uploaded Attachments List */}
                              {block.attachments && block.attachments.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                  {block.attachments.map((att) => {
                                    const isImg = att.category === 'image' || att.type?.startsWith('image/');
                                    const isVid = att.category === 'video' || att.type?.startsWith('video/');
                                    const isAud = !!att.type?.startsWith('audio/');

                                    return (
                                      <div key={att.id} className="p-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200/55 dark:border-slate-800/50 rounded-xl flex items-center justify-between gap-3 text-[9px] font-bold">
                                        <a 
                                          href={att.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          referrerPolicy="no-referrer"
                                          className="flex items-center gap-2 hover:text-indigo-400 dark:hover:text-indigo-400 text-slate-700 dark:text-slate-300 transition-colors truncate max-w-[80%]"
                                        >
                                          {isImg && <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />}
                                          {isVid && <Film className="w-4 h-4 text-sky-400 shrink-0" />}
                                          {isAud && <Music className="w-4 h-4 text-amber-400 shrink-0" />}
                                          {!isImg && !isVid && !isAud && <Paperclip className="w-4 h-4 text-indigo-400 shrink-0" />}
                                          <span className="truncate">{att.name}</span>
                                        </a>
                                        <button 
                                          type="button" 
                                          onClick={() => handleDeleteAttachment(index, att.id)}
                                          className="text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 p-1.5 rounded-lg transition-all"
                                          title="Eliminar"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-[8px] text-slate-400 dark:text-slate-600 italic">No se han cargado evidencias adicionales para este hallazgo.</p>
                              )}
                            </div>

                            {/* Corrective action */}
                            <div>
                              <label className="block text-[8px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-500 mb-2 px-1">Acción Correctiva Sugerida</label>
                              <textarea 
                                value={block.correctiveAction}
                                onChange={(e) => updateBlock({ correctiveAction: e.target.value })}
                                placeholder="Describa el plan de mitigación o acción correctiva inmediata..."
                                className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl text-[11px] text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-700 font-medium h-20 resize-none outline-none focus:border-slate-350 dark:focus:border-slate-800 transition-all"
                              />
                            </div>

                            {/* Cuadro de soporte de implementación with speech */}
                            <div>
                              <div className="flex justify-between items-center mb-2 px-1">
                                <label className="text-[8px] font-black uppercase tracking-widest text-slate-500">Cuadro de Soporte de Implementación</label>
                                <button 
                                  type="button"
                                  onClick={() => toggleSpeechRecognition(index, 'support', block.implementationSupport, (nv) => updateBlock({ implementationSupport: nv }))}
                                  className={cn(
                                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest transition-all",
                                    isListening && activeSpeechField?.blockIndex === index && activeSpeechField?.field === 'support' 
                                      ? "bg-red-500 text-white animate-pulse" 
                                      : "bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                  )}
                                >
                                  {isListening && activeSpeechField?.blockIndex === index && activeSpeechField?.field === 'support' 
                                    ? <MicOff className="w-2.5 h-2.5" /> : <Mic className="w-2.5 h-2.5" />} Escuchar por voz
                                </button>
                              </div>
                              <textarea 
                                value={block.implementationSupport}
                                onChange={(e) => updateBlock({ implementationSupport: e.target.value })}
                                placeholder="Soportes (e.g. Registro fotográfico, Ensayos de laboratorio, Protocolos de vaciado)..."
                                className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl text-[11px] text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-700 font-medium h-20 resize-none outline-none focus:border-slate-350 dark:focus:border-slate-800 transition-all"
                              />
                            </div>


                          </div>

                          {/* Responsible Assign and Reviewer Committee */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200 dark:border-slate-950">
                            {/* Assigned responsible */}
                            <div className="space-y-3">
                              <label className="block text-[8px] font-black uppercase tracking-widest text-slate-500 px-1">Responsable Asignado</label>
                              <select 
                                value={`${block.assignedPosition ?? ''}|${block.assignedName ?? ''}|${block.assignedEmail ?? ''}`}
                                onChange={(e) => {
                                  if (!e.target.value) {
                                    updateBlock({ assignedPosition: '', assignedName: '', assignedEmail: '', assignedTeam: '' });
                                    return;
                                  }
                                  const [pos, name, email] = e.target.value.split('|');
                                  const foundMember = teamMembers.find(m => m.email?.toLowerCase() === email?.toLowerCase() && m.position === pos);
                                  const t = foundMember?.team || '';
                                  updateBlock({ 
                                    assignedPosition: pos, 
                                    assignedName: name, 
                                    assignedEmail: email || '',
                                    assignedTeam: t
                                  });
                                }}
                                className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl text-[10px] text-slate-800 dark:text-white font-black uppercase tracking-wider outline-none focus:border-slate-350 dark:focus:border-slate-800 transition-all cursor-pointer"
                              >
                                <option value="">SELECCIONAR PERSONA...</option>
                                {[...teamMembers]
                                  .sort((a, b) => {
                                    const textA = `${a.position || ''} - ${a.name || ''}`.toUpperCase();
                                    const textB = `${b.position || ''} - ${b.name || ''}`.toUpperCase();
                                    return textA.localeCompare(textB);
                                  })
                                  .map((m) => (
                                    <option key={m.id} value={`${m.position}|${m.name}|${m.email || ''}`}>{m.position} - {m.name}</option>
                                  ))
                                }
                              </select>
                              {block.assignedName && (
                                <div className="space-y-1">
                                  <p className="px-2 text-[8px] text-emerald-400 font-black uppercase tracking-wider">✔ {block.assignedName} ({block.assignedPosition})</p>
                                  {getAssignedTeamOfBlock(block) && (
                                    <p className="px-2 text-[8px] text-indigo-400 font-black uppercase tracking-wider">🏢 Proceso Auditado: {getAssignedTeamOfBlock(block)}</p>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* committee select multi-array or simple selector */}
                            <div className="space-y-3">
                              <label className="block text-[8px] font-black uppercase tracking-widest text-slate-500 px-1">Añadir Comité de Revisión</label>
                              <select 
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val && !block.reviewerCommittee?.includes(val)) {
                                    updateBlock({ reviewerCommittee: [...(block.reviewerCommittee || []), val] });
                                  }
                                  e.target.value = '';
                                }}
                                className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl text-[10px] text-slate-800 dark:text-white font-black uppercase tracking-wider outline-none focus:border-slate-350 dark:focus:border-slate-800 transition-all cursor-pointer"
                              >
                                <option value="">AÑADIR A REVISIÓN...</option>
                                {allUniquePositionsInTeam(teamMembers).map((pos) => (
                                  <option key={pos} value={pos}>{pos}</option>
                                ))}
                              </select>

                              {/* Selected members list */}
                              <div className="flex flex-wrap gap-1.5 p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-900 min-h-[40px]">
                                {block.reviewerCommittee?.map((userPos) => (
                                  <span key={userPos} className="px-2 py-1 bg-slate-100 dark:bg-slate-900 rounded text-[7px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border border-slate-200 dark:border-slate-800">
                                    {userPos}
                                    <button 
                                      type="button" 
                                      onClick={() => updateBlock({ reviewerCommittee: block.reviewerCommittee?.filter(x => x !== userPos) })}
                                      className="text-slate-600 hover:text-red-500"
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </span>
                                ))}
                                {(!block.reviewerCommittee || block.reviewerCommittee.length === 0) && (
                                  <span className="text-[7px] text-slate-700 italic uppercase">Sin comité de revisión</span>
                                )}
                              </div>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>

                  {/* Persistent Add Block button at the bottom of the form */}
                  <div className="flex justify-center pt-8 border-t border-slate-200 dark:border-slate-900">
                    <button 
                      type="button" 
                      onClick={handleAddNewFormBlock}
                      className="w-full sm:w-auto px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-xl shadow-indigo-600/10 active:scale-95 border border-indigo-500"
                    >
                      <Plus className="w-5 h-5 animate-pulse" /> Añadir Nuevo Bloque (Hallazgo / No Conformidad)
                    </button>
                  </div>
                </div>

                <div className="pt-8 flex gap-4 shrink-0 justify-end">
                  <button 
                    type="button" 
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-8 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-900 transition-all active:scale-95"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-600/10 active:scale-95 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Guardar Informe
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: INSPECTOR DE DETALLES DE INFORME */}
      <AnimatePresence>
        {selectedReport && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex justify-center items-center p-4 lg:p-10">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-5xl bg-white dark:bg-[#090d1f] border border-slate-200 dark:border-slate-800 rounded-[3rem] shadow-2xl h-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              <header className="p-8 border-b border-slate-200 dark:border-slate-800/60 flex justify-between items-start bg-white/50 dark:bg-[#020617]/50 shrink-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-white text-slate-950 font-mono font-black text-[10px] rounded-md tracking-wider">
                       {selectedReport.code}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#FFC000]">INFORME DE CALIDAD</span>
                    {selectedReport.status === 'CERRADO' || selectedReport.blocks?.every(b => b.status === 'RESUELTA' || b.status === 'ANULADA') ? (
                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[8px] font-black uppercase tracking-widest rounded">
                        SUBSANADO / CERRADO
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[8px] font-black uppercase tracking-widest rounded animate-pulse">
                        PENDIENTE
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">{selectedReport.title}</h2>
                  <p className="text-[8px] text-slate-500 font-bold uppercase tracking-[0.2em]">
                    Registrado por: {selectedReport.creatorName} ({selectedReport.creatorPosition}) el {format(new Date(selectedReport.createdAt), 'dd MMMM, yyyy HH:mm')}
                  </p>
                </div>
                <button 
                  onClick={handleCloseModal}
                  className="bg-slate-900 border border-slate-800 p-3 rounded-full text-slate-400 hover:text-white transition-all shadow-inner"
                >
                  <X className="w-5 h-5" />
                </button>
              </header>

              <div className="flex-1 overflow-auto p-8 space-y-8 custom-scrollbar">
                <div className="space-y-6">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Hallazgos Registrados ({selectedReport.blocks?.length || 0})</h4>
                  
                  <div className="grid grid-cols-1 gap-6">
                    {selectedReport.blocks?.map((block) => (
                      <div key={block.id} className="p-6 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4">
                        <div className="flex flex-wrap justify-between items-center gap-4">
                          <div className="flex items-center gap-2.5">
                            <span className="px-2.5 py-1 bg-white dark:bg-slate-950 font-mono font-black text-[9px] text-indigo-600 dark:text-indigo-400 rounded border border-slate-250 dark:border-indigo-900/20 shadow-sm tracking-wider">
                              {block.code?.includes('-') ? block.code : `#${block.code}`}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-800 font-black text-[7px] uppercase tracking-widest text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-950 shadow-sm">
                              {block.type}
                            </span>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                              Fuente: <span className="text-slate-600 dark:text-slate-300 font-sans">{block.source}</span> | Hito: <span className="text-slate-600 dark:text-slate-300 font-sans">{block.hito}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DEGREE_OF_ACTION[block.criticality ?? 'inmediata']?.color }} />
                              <span className="text-[8.5px] font-black text-slate-400 tracking-wider uppercase font-sans">
                                {DEGREE_OF_ACTION[block.criticality ?? 'inmediata']?.label}
                              </span>
                            </div>

                            {/* Compliance label */}
                            {block.complianceStatus && (
                              <span className={cn("px-2.5 py-0.5 rounded border text-[8px] font-black uppercase tracking-widest", COMPLIANCE_STATES[block.complianceStatus]?.css)}>
                                {COMPLIANCE_STATES[block.complianceStatus]?.label}
                              </span>
                            )}
                          </div>
                        </div>

                        {block.title && (
                          <div className="pt-2 px-1">
                            <h5 className="text-[8px] font-black uppercase text-indigo-400 tracking-widest mb-1 select-none">Título del Hallazgo / Incidencia</h5>
                            <h4 className="text-[12px] font-black text-slate-900 dark:text-white uppercase tracking-wider font-sans leading-snug">
                              {block.title}
                            </h4>
                          </div>
                        )}

                        <div className="bg-white dark:bg-slate-950/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-950 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                          <div className="space-y-2">
                            <h5 className="text-[8px] font-black uppercase text-slate-600 dark:text-slate-500 tracking-widest">Descripción</h5>
                            <p className="font-medium text-slate-700 dark:text-slate-300 capitalize">{block.description}</p>
                          </div>
                          <div className="space-y-2">
                            <h5 className="text-[8px] font-black uppercase text-slate-600 dark:text-slate-500 tracking-widest">Acción Correctiva</h5>
                            <p className="font-medium text-slate-700 dark:text-slate-300 italic">{block.correctiveAction || 'No se especificó acción correctiva sugerida.'}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                          {block.implementationSupport && (
                            <div className="bg-white dark:bg-slate-950/20 p-4 rounded-xl border border-slate-200 dark:border-slate-900/40 space-y-1">
                              <h5 className="text-[7.5px] font-black uppercase text-slate-600 dark:text-slate-500 tracking-widest">Cuadro de Soporte de Implementación</h5>
                              <p className="font-medium text-slate-700 dark:text-slate-300">{block.implementationSupport}</p>
                            </div>
                          )}
                          {block.initialEfficiencyMeasure && (
                            <div className="bg-white dark:bg-slate-950/20 p-4 rounded-xl border border-slate-200 dark:border-slate-900/40 space-y-1">
                              <h5 className="text-[7.5px] font-black uppercase text-slate-600 dark:text-slate-500 tracking-widest">Medición Inicial Eficiencia</h5>
                              <p className="font-medium text-slate-700 dark:text-slate-300">{block.initialEfficiencyMeasure}</p>
                            </div>
                          )}
                        </div>

                        <div className="pt-4 border-t border-slate-800/40 flex flex-wrap items-center justify-between text-[11px] gap-4">
                          <div className="flex gap-6">
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                              <div className="flex flex-col">
                                <span className="text-[6.5px] text-slate-600 font-bold uppercase tracking-widest leading-none">Asignado a</span>
                                <span className="font-black text-slate-800 dark:text-slate-300 uppercase tracking-widest text-[8.5px] mt-0.5">{block.assignedName || 'SIN ASIGNAR'}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Users className="w-3.5 h-3.5 text-indigo-400" />
                              <div className="flex flex-col">
                                <span className="text-[6.5px] text-slate-600 font-bold uppercase tracking-widest leading-none">Proceso Auditado</span>
                                <span className="font-black text-slate-800 dark:text-slate-300 uppercase tracking-widest text-[8.5px] mt-0.5">{getAssignedTeamOfBlock(block) || 'SIN ESPECIFICAR'}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-slate-500" />
                              <div className="flex flex-col">
                                <span className="text-[6.5px] text-slate-600 font-bold uppercase tracking-widest leading-none">Fecha de Compromiso</span>
                                <span className="font-black text-slate-800 dark:text-slate-300 tracking-wider text-[8.5px] mt-0.5 font-mono">{block.dueDate}</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Controls to update blocker status or compliance state */}
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                              <span className="text-[6.5px] text-slate-500 font-bold uppercase tracking-widest text-right mb-1">Estado de la Respuesta</span>
                              <div className="flex gap-2">
                                {(["ACTIVO", "RESPONDIDA", "REVISION_RESPONSABLE", "RESUELTA"] as IssueStatus[]).map((st) => (
                                  <button 
                                    key={st}
                                    onClick={() => {
                                      let changes: Partial<QualityReportBlock> = { status: st };
                                      if (st === 'RESUELTA') {
                                        // Auto compliance trigger
                                        const now = new Date();
                                        const limit = new Date(block.dueDate);
                                        changes.complianceStatus = now <= limit ? 'CUMPLIDA_A_TIEMPO' : 'CUMPLIDA_FUERA_DE_TIEMPO';
                                      }
                                      handleUpdateBlockStatusInDetail(block.id, changes);
                                    }}
                                    className={cn(
                                      "px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all duration-300",
                                      block.status === st 
                                        ? "bg-indigo-600 border-indigo-500 text-white shadow-lg" 
                                        : "bg-slate-950 border-slate-880 border-slate-900 text-slate-500 hover:text-white"
                                    )}
                                  >
                                    {st.replace('_', ' ')}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Manual compliance changer if they want to override */}
                            <div className="flex flex-col">
                              <span className="text-[6.5px] text-slate-500 font-bold uppercase tracking-widest text-right mb-1">Cumplimiento</span>
                              <select 
                                value={block.complianceStatus || ''}
                                onChange={(e) => {
                                  const val = e.target.value as any;
                                  if (val) {
                                    handleUpdateBlockStatusInDetail(block.id, { complianceStatus: val });
                                  }
                                }}
                                className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-[8px] font-black text-slate-800 dark:text-slate-300 uppercase tracking-widest outline-none transition-all cursor-pointer"
                              >
                                {Object.entries(COMPLIANCE_STATES)
                                  .sort((a, b) => a[1].label.localeCompare(b[1].label))
                                  .map(([k, meta]) => (
                                    <option key={k} value={k}>{meta.label.toUpperCase()}</option>
                                  ))
                                }
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Reviewer Committee panel */}
                        {block.reviewerCommittee && block.reviewerCommittee.length > 0 && (
                          <div className="pt-3 border-t border-slate-800/20 flex flex-wrap gap-2 items-center">
                            <span className="text-[7.5px] text-slate-600 font-black uppercase tracking-widest">Comité de Revisión:</span>
                            {block.reviewerCommittee.map((rev) => (
                              <span key={rev} className="text-[7.5px] px-2 py-0.5 bg-white dark:bg-slate-950 font-black text-slate-600 dark:text-slate-500 rounded border border-slate-200 dark:border-slate-900 tracking-widest uppercase shadow-sm">
                                {rev}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <footer className="p-8 border-t border-slate-200 dark:border-slate-800 flex flex-wrap justify-end gap-3 shrink-0 bg-white/50 dark:bg-[#020617]/50">
                {isBimTeam && (
                  <div className="flex items-center gap-2">
                    {isConfirmingDelete ? (
                      <>
                        <button 
                          onClick={() => setIsConfirmingDelete(false)}
                          className="px-4 py-4 bg-slate-300 dark:bg-slate-800 text-slate-800 dark:text-slate-300 hover:bg-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
                        >
                          Cancelar
                        </button>
                        <button 
                          onClick={handleDeleteReport}
                          className="px-5 py-4 bg-red-700 hover:bg-red-800 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-red-600/30 active:scale-95 transition-all flex items-center gap-2 animate-pulse"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> CONFIRMAR ELIMINAR
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => setIsConfirmingDelete(true)}
                        className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-xl shadow-red-600/20 active:scale-95 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar Informe (BIM)
                      </button>
                    )}
                  </div>
                )}
                <button 
                  onClick={handleCloseModal}
                  className="px-8 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 hover:text-slate-850 dark:hover:text-white text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 rounded-xl transition-all border border-slate-200 dark:border-slate-800 shadow-inner"
                >
                  Cerrar Vista
                </button>
                <button 
                  onClick={handleDownloadPDF}
                  className="px-10 py-3 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar PDF (V.2)
                </button>
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// Helpers
function allUniquePositionsInTeam(team: TeamMember[]) {
  const positions = new Set<string>();
  team.forEach(m => {
    if (m.position) positions.add(m.position);
  });
  return Array.from(positions).sort();
}
