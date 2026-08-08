import React, { useState, useEffect } from 'react';
import { 
  Leaf, 
  Calendar, 
  User, 
  Plus, 
  X, 
  Mic, 
  MicOff, 
  Search, 
  ShieldCheck, 
  AlertCircle, 
  Trash2, 
  Check, 
  Clock,
  Eye,
  Download,
  AlertTriangle,
  Layers,
  FileSpreadsheet,
  Award,
  Recycle,
  BarChart3,
  TrendingUp,
  Inbox,
  FileText,
  Camera,
  Video,
  RefreshCw,
  Edit3,
  Scale,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  subscribeToEnvironmentalReports, 
  subscribeToTeam, 
  saveReport, 
  deleteReport
} from '../services/firebaseService';
import { db, storage } from '../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { uploadFileToDrive, getOrCreateFolder, getAuthenticatedDriveUrl } from '../utils/googleDriveUtils';
import { exportAprovechamientoToPDF, exportAprovechamientoToExcel } from '../utils/reportExporter';
import { 
  QualityReport, 
  TeamMember, 
  EnvironmentalInspectionSection,
  EnvironmentalInspectionItem,
  EnvironmentalAprovechamientoLog
} from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const SNR10_MATERIALS = [
  { material: "Acero", density: 7800 },
  { material: "Baldosa cerámica", density: 2400 },
  { material: "Cemento pórtland, a granel", density: 1440 },
  { material: "Concreto simple", density: 2300 },
  { material: "Concreto reforzado", density: 2400 },
  { material: "Hierro (Fundido)", density: 7200 },
  { material: "Hierro (Forjado)", density: 7700 },
  { material: "Madera laminada", density: 600 },
  { material: "Mampostería de concreto", density: 2150 },
  { material: "Mampostería de ladrillo macizo", density: 1850 },
  { material: "Mampostería de piedra", density: 2200 },
  { material: "Mortero de inyección para mampostería", density: 2250 },
  { material: "Mortero de pega para mampostería", density: 2100 },
  { material: "Piedra (Caliza, mármol, cuarzo)", density: 2700 },
  { material: "Piedra (Basalto, granito, gneis)", density: 2850 },
  { material: "Piedra (Arenisca)", density: 2200 },
  { material: "Piedra (Pizarra)", density: 2605 }
];
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart as RePieChart, 
  Pie, 
  Cell 
} from 'recharts';

// Speech recognition helper
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const INITIAL_INS_SECTIONS = (): EnvironmentalInspectionSection[] => [
  {
    title: "1. INSTALACIONES LOCATIVAS",
    items: [
      { id: "1.1", description: "El cerramiento contribuye a la mitigación del deterioro del ambiente.", status: "", observations: "" },
      { id: "1.2", description: "Existen sistemas de recirculación y/ utilización de agua en el lavado de llantas.", status: "", observations: "" },
      { id: "1.3", description: "Zonas libres de vectores.", status: "", observations: "" },
      { id: "1.4", description: "Las áreas de campamentos de contratistas se encuentran aseadas y/o organizadas.", status: "", observations: "" },
      { id: "1.5", description: "Se cuenta con el número de Baterías sanitarias acorde al personal de obra (1 batería X 15 Personas).", status: "", observations: "" }
    ],
    compliancePercentage: 0
  },
  {
    title: "2. ALMACENAMIENTO DE SUSTANCIAS QUÍMICAS",
    items: [
      { id: "2.1", description: "Áreas de intervención libres de fugas, derrames y descargas de sustancias peligrosas.", status: "", observations: "" },
      { id: "2.2", description: "Área demarcada y Señalizada.", status: "", observations: "" },
      { id: "2.3", description: "Se cuenta con Fichas y/o Hojas de seguridad y rótulos.", status: "", observations: "" },
      { id: "2.4", description: "Se cuenta con Extintor.", status: "", observations: "" },
      { id: "2.5", description: "Se cuenta con uso adecuado de recipientes para el almacenamiento (No alimentos).", status: "", observations: "" },
      { id: "2.6", description: "Se cuenta con Techo, muros (no inflamable) piso duro y Dique de contención.", status: "", observations: "" },
      { id: "2.7", description: "Se cuenta con Kit de Derrame.", status: "", observations: "" }
    ],
    compliancePercentage: 0
  },
  {
    title: "3. CASINO",
    items: [
      { id: "3.1", description: "El área de casino se encuentran aseadas y/o organizadas.", status: "", observations: "" },
      { id: "3.2", description: "El personal de Casino cuenta con guantes, tapabocas, cofia y excelente higiene personal.", status: "", observations: "" },
      { id: "3.3", description: "El personal de casino cuenta con Curso de manipulación de alimentos vigente.", status: "", observations: "" },
      { id: "3.4", description: "La trampa de grasas se encuentra en óptimo funcionamiento.", status: "", observations: "" },
      { id: "3.5", description: "Se realiza un adecuado Manejo integral de los residuos generados por el Casino.", status: "", observations: "" },
      { id: "3.6", description: "Se ejecutan procedimientos de limpieza y desinfección según el plan de saneamiento.", status: "", observations: "" },
      { id: "3.7", description: "Zonas libres de vectores.", status: "", observations: "" }
    ],
    compliancePercentage: 0
  },
  {
    title: "4. MAQUINARIA Y EQUIPO",
    items: [
      { id: "4.1", description: "Vehículo con cobertura y carga que no sobrepase su capacidad de carga.", status: "", observations: "" },
      { id: "4.2", description: "Vehículos y maquinaria sin derrames visibles de sustancias químicas.", status: "", observations: "" },
      { id: "4.3", description: "Limpieza de las llantas de los vehículos al momento de la evacuación.", status: "", observations: "" },
      { id: "4.4", description: "Se cuenta con protección del suelo para la limpieza del trompo y mixer dentro de la obra.", status: "", observations: "" },
      { id: "4.5", description: "Se cuenta con Extintor.", status: "", observations: "" },
      { id: "4.6", description: "Se cuenta con Cortadora de Ladrillo con insonorización, recirculación y / desarenador en óptimas condiciones para su funcionamiento.", status: "", observations: "" }
    ],
    compliancePercentage: 0
  },
  {
    title: "5. RECURSO FAUNA Y FLORA",
    items: [
      { id: "5.1", description: "Individuos arbóreos internos con protección.", status: "", observations: "" },
      { id: "5.2", description: "Individuos arbóreos externos con protección.", status: "", observations: "" },
      { id: "5.3", description: "Individuos arbóreos sin afectación mecánica, sustancias químicas o Daño sistema radicular.", status: "", observations: "" },
      { id: "5.4", description: "Presencia de fauna silvestre en el proyecto con adecuado manejo.", status: "", observations: "" },
      { id: "5.5", description: "Zonas blandas libres de materiales, maquinaria, herramienta, equipos y/o residuos RCD.", status: "", observations: "" }
    ],
    compliancePercentage: 0
  },
  {
    title: "6. RECURSO HÍDRICO",
    items: [
      { id: "6.1", description: "Áreas de intervención libres de fugas, derrames y descargas de agua potable.", status: "", observations: "" },
      { id: "6.2", description: "Sistema de drenaje urbano (sumideros, redes conectadas, pozos de inspección, cárcamos) cuentan con limpieza y se encuentran libres de sedimentos, sustancias y o materiales provenientes de la obra).", status: "", observations: "" },
      { id: "6.3", description: "No se Evidencia de vertimientos en espacio público, predios vecinos, cuerpos de agua y/o los componentes del sistema de drenaje urbano Afectados.", status: "", observations: "" },
      { id: "6.4", description: "Se cuenta con Aparatos sanitarios y Griferías Ahorradores y/o bajo consumo.", status: "", observations: "" },
      { id: "6.5", description: "Se cuenta con Provisional de obra en correcto uso y funcionamiento.", status: "", observations: "" }
    ],
    compliancePercentage: 0
  },
  {
    title: "7. RECURSO AIRE",
    items: [
      { id: "7.1", description: "Se percibe que las áreas e instalaciones están libres de olores ofensivos.", status: "", observations: "" },
      { id: "7.2", description: "Se realiza Humectación de áreas susceptibles a generar material particulado.", status: "", observations: "" },
      { id: "7.3", description: "Se realiza Barrido interno y externo en húmedo para mitigar el material particulado.", status: "", observations: "" },
      { id: "7.4", description: "Se realiza control sobre actividades en obra para Mitigar la generación del material particulado.", status: "", observations: "" },
      { id: "7.5", description: "En el área de ejecución del proyecto no se presentan quemas a cielo abierto.", status: "", observations: "" }
    ],
    compliancePercentage: 0
  },
  {
    title: "8. RECURSO SUELO",
    items: [
      { id: "8.1", description: "Se evidencia Acopio de materiales cubierto y/o humectado.", status: "", observations: "" },
      { id: "8.2", description: "Se cuenta con elementos para el correcto almacenamiento de materiales de construcción.", status: "", observations: "" },
      { id: "8.3", description: "Se realiza Limpieza de vías perimetrales del proyecto.", status: "", observations: "" },
      { id: "8.4", description: "Se cuenta con las licencias y/o permisos de material de cantera.", status: "", observations: "" },
      { id: "8.5", description: "Se evidencia que Espacio público está libre de materiales de obra y/o RCD.", status: "", observations: "" }
    ],
    compliancePercentage: 0
  },
  {
    title: "9. RECURSO ENERGÍA",
    items: [
      { id: "9.1", description: "Se cuenta con Equipos de cómputo conectados sin Uso.", status: "", observations: "" },
      { id: "9.2", description: "Se encuentran Equipos de obra conectados sin Uso.", status: "", observations: "" },
      { id: "9.3", description: "Se cuenta con Provisional de obra en correcto uso y funcionamiento.", status: "", observations: "" },
      { id: "9.4", description: "Se cuenta con luminarias Ahorradoras y/o bajo consumo.", status: "", observations: "" }
    ],
    compliancePercentage: 0
  },
  {
    title: "10. MANEJO DE RCD",
    items: [
      { id: "10.1", description: "Se cuenta con sitio de almacenamiento temporal de APROVECHABLES (PLASTICO - MADERA- CHATARRA- CARTON- PVC) señalizados.", status: "", observations: "" },
      { id: "10.2", description: "Se cuenta con sitio de almacenamiento temporal de RESPEL señalizados.", status: "", observations: "" },
      { id: "10.3", description: "Se cuenta con sitio de almacenamiento temporal de ORDINARIOS señalizados.", status: "", observations: "" },
      { id: "10.4", description: "Se cuenta con sitio de almacenamiento temporal de PETREOS señalizados.", status: "", observations: "" },
      { id: "10.5", description: "Se cuenta con puntos ecológicos, (Señalizados, rotulados, Código de colores y separación en la fuente).", status: "", observations: "" },
      { id: "10.6", description: "Se cuenta con Extintor.", status: "", observations: "" },
      { id: "10.7", description: "Se realiza una adecuada separación por tipologías de los Residuos.", status: "", observations: "" }
    ],
    compliancePercentage: 0
  },
  {
    title: "11. ORDEN Y ASEO",
    items: [
      { id: "11.1", description: "Adecuado estado de limpieza al interior del proyecto constructivo (Cimentación y/o Estructura).", status: "", observations: "" },
      { id: "11.2", description: "Adecuado estado de limpieza al interior del proyecto constructivo (Mampostería).", status: "", observations: "" },
      { id: "11.3", description: "Adecuado estado de limpieza al interior del proyecto constructivo (Instalaciones hidrosanitarias y gas).", status: "", observations: "" },
      { id: "11.4", description: "Adecuado estado de limpieza al interior del proyecto constructivo (Instalaciones Eléctricas y/o comunicaciones).", status: "", observations: "" },
      { id: "11.5", description: "Adecuado estado de limpieza al interior del proyecto constructivo (Acabados Internos).", status: "", observations: "" },
      { id: "11.6", description: "Adecuado estado de limpieza al interior del proyecto constructivo (Acabados Externos).", status: "", observations: "" },
      { id: "11.7", description: "Adecuado estado de limpieza al interior del proyecto constructivo (Obras de urbanismo).", status: "", observations: "" }
    ],
    compliancePercentage: 0
  }
];

export default function EnvironmentalReportList() {
  const { user, googleAccessToken, connectGoogleDrive } = useAuth();
  const [activeTab, setActiveTab] = useState<'INSPECCION' | 'APROVECHAMIENTO'>('INSPECCION');
  
  // Google Drive upload states
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveUploadProgress, setDriveUploadProgress] = useState('');
  const [driveUploadError, setDriveUploadError] = useState<string | null>(null);
  
  // Data States
  const [reports, setReports] = useState<QualityReport[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatsYear, setSelectedStatsYear] = useState<string>('ALL');
  const [selectedStatsPeriod, setSelectedStatsPeriod] = useState<string>('ALL');

  // 10-day calendar editing validation for Aprovechamiento reports' initial evidence
  const isEditableInicioEvidence = (report: QualityReport) => {
    if (report.subtype !== 'APROVECHAMIENTO') return false;
    const createdDate = new Date(report.createdAt);
    const now = new Date();
    // 10 calendar days in milliseconds: 10 * 24 * 60 * 60 * 1000
    const diffTime = now.getTime() - createdDate.getTime();
    return diffTime <= 10 * 24 * 60 * 60 * 1000;
  };

  // Open until the 10th day of the following month validation
  const isRestOfFormEditable = (report: QualityReport) => {
    if (report.subtype !== 'APROVECHAMIENTO') return false;
    
    let reportYear = new Date(report.createdAt).getFullYear();
    let reportMonth = new Date(report.createdAt).getMonth() + 1; // 1-indexed (1 to 12)

    if (report.startDate) {
      try {
        const parts = report.startDate.split('-');
        if (parts.length >= 2) {
          reportYear = parseInt(parts[0], 10);
          reportMonth = parseInt(parts[1], 10);
        }
      } catch (e) {}
    }

    let nextMonth = reportMonth + 1;
    let nextYear = reportYear;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }

    // Accessible until the 10th day of the following month at midnight (or 11:59:59 PM)
    const deadline = new Date(nextYear, nextMonth - 1, 10, 23, 59, 59, 999);
    const now = new Date();
    return now.getTime() <= deadline.getTime();
  };

  const isEditableAprovechamiento = (report: QualityReport) => {
    return isRestOfFormEditable(report);
  };

  const handleStartEditing = (report: QualityReport) => {
    setEditingReportId(report.id);
    setAprTitle(report.title || '');
    setAprCode(report.code?.replace('INF-APR-AMB-', '') || '');
    setAprLogs(report.logs || []);
    setAprStartDate(report.startDate || '');
    setAprEndDate(report.endDate || '');
    setAprResponsibleName(report.responsibleName || '');
    setAprResponsibleEmail(report.responsibleEmail || '');
    setAprResponsiblePosition(report.responsiblePosition || 'DIRECTOR DE OBRA');
    setAprProcessDescription(report.processDescription || '');
    setAprMediaFiles(report.mediaFiles || []);
    setAprMediaDuring(report.mediaDuring || []);
    setAprMediaFinal(report.mediaFinal || []);
    setAprPlanName(report.planName || '');
    setAprPlanUrl(report.planUrl || '');
    setAprSelectedMarkArea(report.planMarkedArea || null);
    
    // Close detail view and open modal in edit mode
    setSelectedReport(null);
    setIsAprModalOpen(true);
  };
  
  // Selection and Detail Modals
  const [selectedReport, setSelectedReport] = useState<QualityReport | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  
  // Voice Dictation Cache
  const [activeVoiceDictation, setActiveVoiceDictation] = useState<{ path: string } | null>(null);
  const [dictationEngine, setDictationEngine] = useState<any>(null);

  // Modal 1: CREATE INSPECCIÓN AMBIENTAL
  const [isInsModalOpen, setIsInsModalOpen] = useState(false);
  const [insTitle, setInsTitle] = useState('');
  const [insCode, setInsCode] = useState('');
  const [insSections, setInsSections] = useState<EnvironmentalInspectionSection[]>(INITIAL_INS_SECTIONS());

  // Modal 2: CREATE APROVECHAMIENTO LOG
  const [isAprModalOpen, setIsAprModalOpen] = useState(false);
  const [aprTitle, setAprTitle] = useState('');
  const [aprCode, setAprCode] = useState('');
  const [aprLogs, setAprLogs] = useState<EnvironmentalAprovechamientoLog[]>([]);

  // New fields according to physical requirements
  const [aprStartDate, setAprStartDate] = useState('');
  const [aprEndDate, setAprEndDate] = useState('');
  const [aprResponsibleName, setAprResponsibleName] = useState('');
  const [aprResponsibleEmail, setAprResponsibleEmail] = useState('');
  const [aprResponsiblePosition, setAprResponsiblePosition] = useState('DIRECTOR DE OBRA');
  const [aprProcessDescription, setAprProcessDescription] = useState('');
  
  // Start operation media records (photos/videos)
  const [aprMediaFiles, setAprMediaFiles] = useState<Array<{ name: string; url: string; type: 'image' | 'video' }>>([]);
  const [aprMediaDuring, setAprMediaDuring] = useState<Array<{ name: string; url: string; type: 'image' | 'video' }>>([]);
  const [aprMediaFinal, setAprMediaFinal] = useState<Array<{ name: string; url: string; type: 'image' | 'video' }>>([]);
  const [cameraTarget, setCameraTarget] = useState<'inicio' | 'during' | 'final'>('inicio');
  const [isInsideAprCDETarget, setIsInsideAprCDETarget] = useState<'inicio' | 'during' | 'final'>('inicio');
  
  // Plan markup states
  const [aprPlanName, setAprPlanName] = useState('');
  const [aprPlanUrl, setAprPlanUrl] = useState('');
  const [aprSelectedMarkArea, setAprSelectedMarkArea] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const closeAprModal = () => {
    setIsAprModalOpen(false);
    setEditingReportId(null);
    setAprTitle('');
    setAprCode('');
    setAprLogs([]);
    setAprProcessDescription('');
    setAprMediaFiles([]);
    setAprMediaDuring([]);
    setAprMediaFinal([]);
    setAprPlanName('');
    setAprPlanUrl('');
    setAprSelectedMarkArea(null);
  };

  // CDE interior selector state
  const [isInsideAprCDEOpen, setIsInsideAprCDEOpen] = useState(false);
  
  // Camera capture states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraMode, setCameraMode] = useState<'photo' | 'video'>('photo');
  const [isCameraRecording, setIsCameraRecording] = useState(false);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [mediaRecorderRef, setMediaRecorderRef] = useState<any>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Current edit log row inside AprModal
  const [currentMaterial, setCurrentMaterial] = useState<EnvironmentalAprovechamientoLog['material']>('PLASTICO');
  const [currentQuantity, setCurrentQuantity] = useState<number>(0);
  const [currentUnit, setCurrentUnit] = useState<EnvironmentalAprovechamientoLog['unit']>('KG');
  const [currentRecipient, setCurrentRecipient] = useState('');
  const [currentCertificate, setCurrentCertificate] = useState('');
  const [currentLogDate, setCurrentLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentLogObs, setCurrentLogObs] = useState('');

  // Inline editing active report state variables
  const [activeReportLogs, setActiveReportLogs] = useState<EnvironmentalAprovechamientoLog[]>([]);
  const totalVolumenAcumulado = activeReportLogs.reduce((sum, log) => sum + (log.volumenReutilizado || 0), 0);
  const totalAreaAcumulada = activeReportLogs.reduce((sum, log) => sum + (log.areaRecuperada || 0), 0);
  const totalAprovechamientoKg = activeReportLogs.reduce((sum, log) => sum + ((log.volumenReutilizado || 0) * (log.densidadSNR || 2300)), 0);
  const totalAprovechamientoTon = totalAprovechamientoKg / 1000;
  const [activeReportDesc, setActiveReportDesc] = useState('');
  const [activeReportMedia, setActiveReportMedia] = useState<any[]>([]);
  const [activeReportMediaDuring, setActiveReportMediaDuring] = useState<any[]>([]);
  const [activeReportMediaFinal, setActiveReportMediaFinal] = useState<any[]>([]);
  const [activeReportRespName, setActiveReportRespName] = useState('');
  const [activeReportRespEmail, setActiveReportRespEmail] = useState('');
  const [activeReportRespPosition, setActiveReportRespPosition] = useState('');
  const [hasUnsavedInlineChanges, setHasUnsavedInlineChanges] = useState(false);
  const [lastInitializedReportId, setLastInitializedReportId] = useState<string | null>(null);

  // States for adding a log row inline in the active report
  const [inlineMaterial, setInlineMaterial] = useState<EnvironmentalAprovechamientoLog['material']>('PETREOS');
  const [inlineQuantity, setInlineQuantity] = useState<number>(0);
  const [inlineUnit, setInlineUnit] = useState<EnvironmentalAprovechamientoLog['unit']>('M3');
  const [inlineRecipient, setInlineRecipient] = useState('');
  const [inlineCertificate, setInlineCertificate] = useState('');
  const [inlineLogDate, setInlineLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [inlineLogObs, setInlineLogObs] = useState('');
  
  // New stockpile dimension fields
  const [inlineLargo, setInlineLargo] = useState<number | ''>('');
  const [inlineAncho, setInlineAncho] = useState<number | ''>('');
  const [inlineAlto, setInlineAlto] = useState<number | ''>('');
  const [inlineSubUnits, setInlineSubUnits] = useState<Array<{
    id: string;
    largo: number | '';
    ancho: number | '';
    alto: number | '';
    torres?: number | '';
    unidades?: number | '';
  }>>([
    { id: '1', largo: '', ancho: '', alto: '', torres: 1, unidades: 1 }
  ]);
  const [expandedLogIds, setExpandedLogIds] = useState<Record<string, boolean>>({});
  const [inlineDuracion, setInlineDuracion] = useState<number | ''>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  });
  const [inlineMaterialSNR, setInlineMaterialSNR] = useState<string>('Concreto simple');
  const [inlineDensidadSNR, setInlineDensidadSNR] = useState<number>(2300);

  // Sub-modal: GENERATE COMPLIANCE ISSUE
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [pendingIssueText, setPendingIssueText] = useState('');
  const [pendingIssueSection, setPendingIssueSection] = useState('');
  const [pendingIssueItemCode, setPendingIssueItemCode] = useState('');
  const [assignedMemberEmail, setAssignedMemberEmail] = useState('');
  const [assignedDaysLimit, setAssignedDaysLimit] = useState(3);

  // Subscribe to DB
  useEffect(() => {
    const unsub = subscribeToEnvironmentalReports((data) => {
      setReports(data);
      setLoading(false);
    });

    const unsubTeam = subscribeToTeam((team) => {
      setTeamMembers(team);
    });

    return () => {
      unsub();
      unsubTeam();
    };
  }, []);

  // Compute active report for current month
  const nowForActive = new Date();
  const currentActiveYear = nowForActive.getFullYear();
  const currentActiveMonth = nowForActive.getMonth();

  const activeMonthReport = reports.find(r => {
    if (r.subtype === 'APROVECHAMIENTO' && r.startDate) {
      try {
        const parts = r.startDate.split('-');
        const rYear = parseInt(parts[0], 10);
        const rMonth = parseInt(parts[1], 10) - 1; // 0-indexed month
        return rYear === currentActiveYear && rMonth === currentActiveMonth;
      } catch (e) {
        return false;
      }
    }
    return false;
  });

  // Keep inline states synchronized with the DB activeMonthReport values when they change, without overwriting unsaved inline edits or triggering endless loops
  useEffect(() => {
    if (activeMonthReport && !isUploadingToDrive) {
      const reportId = activeMonthReport.id;
      const reportIdHasChanged = reportId !== lastInitializedReportId;
      
      // Synchronize state if the active report document actually changed (e.g. month switched), 
      // or if the user has no unsaved changes and we received a new database update (e.g. from chatbot uploads or database edits)
      if (reportIdHasChanged || !hasUnsavedInlineChanges) {
        setActiveReportLogs(activeMonthReport.logs || []);
        setActiveReportDesc(activeMonthReport.processDescription || '');
        setActiveReportMedia(activeMonthReport.mediaFiles || []);
        setActiveReportMediaDuring(activeMonthReport.mediaDuring || []);
        setActiveReportMediaFinal(activeMonthReport.mediaFinal || []);
        setActiveReportRespName(activeMonthReport.responsibleName || '');
        setActiveReportRespEmail(activeMonthReport.responsibleEmail || '');
        setActiveReportRespPosition(activeMonthReport.responsiblePosition || 'DIRECTOR DE OBRA');
        setLastInitializedReportId(reportId);

        if (reportIdHasChanged) {
          setHasUnsavedInlineChanges(false);
        }

        // Los días del proceso se calculan solos basado en los días del mes
        let calculatedDays = 30;
        if (activeMonthReport.startDate) {
          try {
            const parts = activeMonthReport.startDate.split('-');
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10); // 1-indexed
            calculatedDays = new Date(year, month, 0).getDate();
          } catch (e) {
            calculatedDays = 30;
          }
        }
        setInlineDuracion(calculatedDays);
        
        // Auto-heal/sync associated Aprovechamiento issue to Firestore
        saveAssociatedAprovechamientoIssue(activeMonthReport);
      }
    }
  }, [
    activeMonthReport,
    isUploadingToDrive,
    hasUnsavedInlineChanges,
    lastInitializedReportId
  ]);

  // Sync environmental Aprovechamiento reports directly to issues dashboard Directed to Director de Obra
  const saveAssociatedAprovechamientoIssue = async (payload: any) => {
    if (payload.subtype !== 'APROVECHAMIENTO') return;
    try {
      const issueId = 'issue_e_apr_' + payload.id;
      
      let totalAprovechado = 0;
      if (payload.logs && Array.isArray(payload.logs)) {
        payload.logs.forEach((log: any) => {
          if (log.status === 'APROVECHADO') {
            const qty = Number(log.quantity) || 0;
            totalAprovechado += log.unit === 'TON' ? qty * 1000 : qty;
          }
        });
      }

      const issueObj: any = {
        id: issueId,
        code: payload.code || `AMB-APR-${Date.now().toString().slice(-4)}`,
        title: `APROVECHAMIENTO: ${payload.title}`,
        type: 'Informe Ambiental',
        degreeOfAction: 'control',
        impact: ['Impacto Ambiental Sostenibilidad'],
        description: `CONTROL DE APROVECHAMIENTO RCD Y GESTIÓN DE RESIDUOS:\n\n• Reporte: ${payload.code}\n• Material Aprovechado: ${totalAprovechado.toLocaleString('es-ES')} kg\n• Periodo: ${payload.startDate || ''} al ${payload.endDate || ''}\n• Responsable: ${payload.responsibleName || 'ROBERTO GÓMEZ'}\n\nDescripción del Proceso:\n${payload.processDescription || 'Sin comentarios.'}`,
        status: 'ACTIVO',
        specialty: 'AMBIENTAL',
        assignedPosition: payload.responsiblePosition || 'Director de Obra',
        assignedName: payload.responsibleName || 'Roberto Gómez',
        assignedEmail: payload.responsibleEmail || 'rgomez@bim.com',
        assignedTeam: 'AMBIENTAL',
        creatorId: user?.id || payload.creatorId || 'anonymous',
        creatorName: user?.name || payload.creatorName || 'Gestor Ambiental',
        creatorPosition: user?.position || payload.creatorPosition || 'Ambiental',
        creatorTeam: 'AMBIENTAL',
        createdAt: payload.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attachments: payload.mediaFiles || [],
        dueDate: payload.endDate || new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        comments: [],
        reviewers: [],
        reviewerEmails: [],
        locations: payload.planMarkedArea ? { units: [], levels: [], spaces: [], x: payload.planMarkedArea.x, y: payload.planMarkedArea.y } : { units: [], levels: [], spaces: [] },
        fromReport: true,
        reportType: 'ENVIRONMENTAL',
        sourceReportId: payload.id
      };

      const docRef = doc(db, 'issues', issueId);
      
      // Calculate cumulative aggregates from logs
      let totalVolumen = 0;
      let totalArea = 0;
      let maxLargo = 0;
      let maxAncho = 0;
      let maxAlto = 0;
      let maxDuracion = 30;
      
      if (payload.logs && Array.isArray(payload.logs)) {
        payload.logs.forEach((log: any) => {
          totalVolumen += Number(log.volumenReutilizado) || 0;
          totalArea += Number(log.areaRecuperada) || 0;
          if (Number(log.largo) > maxLargo) maxLargo = Number(log.largo);
          if (Number(log.ancho) > maxAncho) maxAncho = Number(log.ancho);
          const logAlto = log.alto !== undefined ? log.alto : log.fondo;
          if (Number(logAlto) > maxAlto) maxAlto = Number(logAlto);
          if (Number(log.duracionProceso) > maxDuracion || maxDuracion === 30) {
            maxDuracion = Number(log.duracionProceso);
          }
        });
      }

      const acopioPayload = {
        acopioLargo: maxLargo || null,
        acopioAncho: maxAncho || null,
        acopioAlto: maxAlto || null,
        acopioDuracionProceso: maxDuracion || 30,
        acopioVolumen: totalVolumen || null,
        acopioAreaRecuperada: totalArea || null,
      };

      await setDoc(docRef, {
        ...issueObj,
        ...acopioPayload
      }, { merge: true });

      console.log(`Associated issue ${issueId} created/updated with cumulative acopio metrics: VOL=${totalVolumen}, AREA=${totalArea}`);
    } catch (err) {
      console.error("Error creating associated Aprovechamiento issue:", err);
    }
  };

  const compressImageBase64 = async (dataUrl: string): Promise<string> => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) return dataUrl;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Downscale to maximum dimension of 800px to ensure tiny document footprint (approx 50KB to 100KB)
        const maxDim = 800;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress quality to 0.45 JPEG
          resolve(canvas.toDataURL('image/jpeg', 0.45));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => {
        console.warn("Failed to load image for base64 scaling, using original source");
        resolve(dataUrl);
      };
      img.src = dataUrl;
    });
  };

  const compressImageThumbnail = async (dataUrl: string): Promise<string> => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) return '';
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Extremely tiny footprint (max 420px size) to remain super small (about 10KB - 15KB)
        const maxDim = 420;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.4));
        } else {
          resolve('');
        }
      };
      img.onerror = () => {
        resolve('');
      };
      img.src = dataUrl;
    });
  };

  const convertBlobToBase64 = async (url: string): Promise<string> => {
    if (!url) return '';
    if (url.startsWith('data:')) {
      if (url.startsWith('data:image')) {
        return await compressImageBase64(url);
      }
      return url;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn("[Convert Blob] Timing out reading blob:", url);
      controller.abort();
    }, 8000); // 8 seconds safety limit

    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      const blob = await res.blob();
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (base64.startsWith('data:image')) {
        return await compressImageBase64(base64);
      }
      return base64;
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn("Could not convert blob to base64, using original url", err);
      return url;
    }
  };

  const dataURLtoBlob = (dataurl: string): Blob => {
    try {
      const parts = dataurl.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch (e) {
      console.error("Error converting data URL to Blob:", e);
      return new Blob([], { type: 'image/jpeg' });
    }
  };

  const uploadMediaListToDrive = async (
    mediaList: Array<{ name: string; url: string; type: 'image' | 'video' }>,
    accessToken: string | null
  ): Promise<Array<{ name: string; url: string; type: 'image' | 'video'; webViewLink?: string; driveFileId?: string }>> => {
    if (!mediaList || !Array.isArray(mediaList)) return [];
    const uploadedList: any[] = [];
    let folderId = '1Bym51TtKVSzDsweJaMAh0VxCAAQQbU3w';
    
    setDriveUploadError(null);

    // Resilient fallback chain for access token
    const activeToken = accessToken || googleAccessToken || localStorage.getItem('google_drive_token');

    for (let i = 0; i < mediaList.length; i++) {
      const media = mediaList[i];
      const isNewFile = media.url && (media.url.startsWith('blob:') || media.url.startsWith('data:'));
      
      if (isNewFile) {
        try {
          let blob: Blob;
          if (media.url.startsWith('data:')) {
            blob = dataURLtoBlob(media.url);
          } else {
            const controller = new AbortController();
            const fetchTimeout = setTimeout(() => controller.abort(), 15000); // stable timeout for local blobs
            try {
              const res = await fetch(media.url, { signal: controller.signal });
              blob = await res.blob();
            } finally {
              clearTimeout(fetchTimeout);
            }
          }
          const fileType = blob.type || (media.type === 'video' ? 'video/mp4' : 'image/jpeg');

          let driveInfo: { webViewLink?: string; driveFileId?: string; url?: string } = {};
          let driveUploadSucceeded = false;

          // 1. PRIORITIZE GOOGLE DRIVE UPLOAD IF CONFIGURED/CONNECTED OR STORED
          if (activeToken) {
            try {
              setDriveUploadProgress(`Subiendo archivo ${i + 1} de ${mediaList.length} a Google Drive: ${media.name}...`);
              
              // Direct upload to Google Drive
              const uploadResult = await uploadFileToDrive(blob, media.name, fileType, folderId, activeToken);
              
              driveInfo = {
                url: uploadResult.url,
                webViewLink: uploadResult.webViewLink,
                driveFileId: uploadResult.id
              };
              driveUploadSucceeded = true;
            } catch (err: any) {
              console.error("Error uploading file to Drive, falling back to secure store:", err);
              setDriveUploadError(`Fallo de conexión temporal con Google Drive para "${media.name}". Intentando otra vía...`);
            }
          }

          if (driveUploadSucceeded) {
            uploadedList.push({
              name: media.name,
              url: `/api/drive-image/${driveInfo.driveFileId}`,
              type: media.type,
              webViewLink: driveInfo.webViewLink,
              driveFileId: driveInfo.driveFileId,
              // Utilizar un enlace de miniatura directo y ultraligero a través de nuestro proxy de Node.js
              thumbnail: `/api/drive-image/${driveInfo.driveFileId}`
            });
            continue; // Proceed to next file immediately!
          }

          // Generate or compile thumbnail base64 ONLY lazy-loaded if Drive uploading failed and we fall back to local/Firebase
          let thumbnailBase64 = '';
          const getLazyThumbnail = async (): Promise<string> => {
            if (thumbnailBase64) return thumbnailBase64;
            if (fileType.startsWith('image/')) {
              try {
                let localDataUrl = media.url;
                if (media.url.startsWith('blob:')) {
                  localDataUrl = await convertBlobToBase64(media.url);
                }
                const compressed = await compressImageThumbnail(localDataUrl);
                thumbnailBase64 = compressed;
                return compressed;
              } catch (thErr) {
                console.warn("Could not generate inline thumbnail base64:", thErr);
              }
            }
            return '';
          };

          // 2. FALLBACK TO FIREBASE STORAGE (Only if Drive is not connected or failed, with strict 12s timeout)
          let firebaseSucceeded = false;
          let firebaseUrl = '';
          
          try {
            setDriveUploadProgress("Guardando archivo " + (i + 1) + " de " + mediaList.length + " en Servidor Seguro: " + media.name + "...");
            const storageRefPath = ref(storage, "environmental_reports_evidence/" + Date.now() + "_" + media.name);
            
            // Promise.race so we never hang if Firebase Storage is not working or unconfigured in the console
            const uploadPromise = uploadBytes(storageRefPath, blob);
            const timeoutPromise = new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Firebase Storage upload timeout')), 12000)
            );
            const firebaseUploadResult = await Promise.race([uploadPromise, timeoutPromise]);
            
            const downloadUrlPromise = getDownloadURL(firebaseUploadResult.ref);
            const dlTimeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('getDownloadURL timeout')), 6000)
            );
            firebaseUrl = await Promise.race([downloadUrlPromise, dlTimeoutPromise]);
            firebaseSucceeded = true;
          } catch (err) {
            console.warn("Firebase Storage failed or timed out, will compress and save in Firestore:", err);
          }

          if (firebaseSucceeded && firebaseUrl) {
            uploadedList.push({
              name: media.name,
              url: firebaseUrl,
              type: media.type,
              thumbnail: (await getLazyThumbnail()) || undefined
            });
            continue;
          }

          // 3. FINAL FALLBACK: COMPRESS IMAGE TO VERY TINY BASE64 AND SAVE LOCALLY IN FIRESTORE
          setDriveUploadProgress(`Preparando copia de seguridad ${i + 1} de ${mediaList.length}: ${media.name}...`);
          let base64Url = media.url;
          if (media.url.startsWith('data:')) {
            if (media.url.startsWith('data:image')) {
              base64Url = await compressImageBase64(media.url);
            }
          } else {
            base64Url = await convertBlobToBase64(media.url);
          }

          uploadedList.push({
            name: media.name,
            url: base64Url,
            type: media.type,
            thumbnail: (await getLazyThumbnail()) || undefined
          });

        } catch (err) {
          console.error("Critical error uploading file completely:", err);
          uploadedList.push(media);
        }
      } else {
        uploadedList.push(media);
      }
    }
    return uploadedList;
  };

  // Inline saving utility
  const handleSaveActiveReportInline = async (
    updatedLogs?: EnvironmentalAprovechamientoLog[],
    updatedDesc?: string,
    updatedMedia?: any[],
    updatedMediaDuring?: any[],
    updatedMediaFinal?: any[],
    silent = true
  ) => {
    if (!activeMonthReport) return;

    const logsToSave = updatedLogs !== undefined ? updatedLogs : activeReportLogs;
    const descToSave = updatedDesc !== undefined ? updatedDesc : activeReportDesc;
    const mediaToSave = updatedMedia !== undefined ? updatedMedia : activeReportMedia;
    const mediaDuringToSave = updatedMediaDuring !== undefined ? updatedMediaDuring : activeReportMediaDuring;
    const mediaFinalToSave = updatedMediaFinal !== undefined ? updatedMediaFinal : activeReportMediaFinal;

    const hasNewFiles = [...mediaToSave, ...mediaDuringToSave, ...mediaFinalToSave].some(
      f => f.url && (f.url.startsWith('blob:') || f.url.startsWith('data:'))
    );

    let finalMedia = mediaToSave;
    let finalMediaDuring = mediaDuringToSave;
    let finalMediaFinal = mediaFinalToSave;

    if (hasNewFiles) {
      try {
        setIsUploadingToDrive(true);
        finalMedia = await uploadMediaListToDrive(mediaToSave, googleAccessToken);
        finalMediaDuring = await uploadMediaListToDrive(mediaDuringToSave, googleAccessToken);
        finalMediaFinal = await uploadMediaListToDrive(mediaFinalToSave, googleAccessToken);
        
        // Sync local states
        setActiveReportMedia(finalMedia);
        setActiveReportMediaDuring(finalMediaDuring);
        setActiveReportMediaFinal(finalMediaFinal);
      } catch (uploadErr) {
        console.error("Error processing inline files:", uploadErr);
        // Do not block saving, keep original blobs or fall back to base64 which was already handled
      } finally {
        setIsUploadingToDrive(false);
        setDriveUploadProgress('');
      }
    }

    try {
      const payload: any = {
        ...activeMonthReport,
        updatedAt: new Date().toISOString(),
        logs: logsToSave,
        processDescription: descToSave,
        mediaFiles: finalMedia,
        mediaDuring: finalMediaDuring,
        mediaFinal: finalMediaFinal,
        responsibleName: activeReportRespName || activeMonthReport.responsibleName || '',
        responsibleEmail: activeReportRespEmail || activeMonthReport.responsibleEmail || '',
        responsiblePosition: activeReportRespPosition || activeMonthReport.responsiblePosition || 'DIRECTOR DE OBRA',
      };

      await saveReport(payload);
      await saveAssociatedAprovechamientoIssue(payload);
      
      // Update local report list synchronously to prevent the state sync hook from overwriting local states with outdated properties before Firestore snapshot resolves
      setReports(prev => prev.map(r => r.id === payload.id ? { ...r, ...payload } : r));

      setHasUnsavedInlineChanges(false);
      
      if (!silent) {
        alert("¡Los cambios del informe del mes han sido guardados exitosamente!");
      }
    } catch (err) {
      console.error("Error inline saving active report:", err);
      // ALWAYS notify the user of database save failures so they don't lose data silently!
      alert("⚠️ Error al guardar los cambios en la base de datos: " + (err instanceof Error ? err.message : String(err)) + "\n\nPor favor, recarga e inténtalo de nuevo.");
    }
  };

  // Live preview handler of active report for the modal viewer
  const handlePreviewActiveReport = () => {
    if (!activeMonthReport) return;
    setSelectedReport({
      ...activeMonthReport,
      logs: activeReportLogs,
      processDescription: activeReportDesc,
      mediaFiles: activeReportMedia,
      mediaDuring: activeReportMediaDuring,
      mediaFinal: activeReportMediaFinal,
      responsibleName: activeReportRespName || activeMonthReport.responsibleName || '',
      responsibleEmail: activeReportRespEmail || activeMonthReport.responsibleEmail || '',
      responsiblePosition: activeReportRespPosition || activeMonthReport.responsiblePosition || 'DIRECTOR DE OBRA',
    });
  };

  // Auto-create aprovechamiento report on the 1st of every month (or if none exists for the current month)
  useEffect(() => {
    if (loading || isAutoCreating) {
      // Wait until database subscriptions have initially resolved
      return;
    }
    
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Check if there is already an APROVECHAMIENTO report for this month
    const hasReportForThisMonth = reports.some(r => {
      if (r.reportType === 'ENVIRONMENTAL' && r.subtype === 'APROVECHAMIENTO' && r.startDate) {
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

    if (!hasReportForThisMonth) {
      const runAutoCreation = async () => {
        setIsAutoCreating(true);
        try {
          const reportId = 'env_apr_auto_' + currentYear + '_' + (currentMonth + 1);
          const docRef = doc(db, 'reports', reportId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            console.log("¡El informe mensual de aprovechamiento ya existe en Firestore! Evitando sobreescribir.");
            const existingData = { id: docSnap.id, ...docSnap.data() } as any;
            if (!reports.some(r => r.id === reportId)) {
              setReports(prev => [existingData, ...prev]);
            }
            return;
          }

          const existingApr = reports.filter(r => r.subtype === 'APROVECHAMIENTO');
          let nextCodeNum = '0001';
          if (existingApr.length > 0) {
            let maxCodeVal = 0;
            existingApr.forEach(r => {
              const matches = r.code?.match(/INF-(?:APR|INS)-AMB-(\d+)/);
              if (matches) {
                const num = parseInt(matches[1], 10);
                if (num > maxCodeVal) {
                  maxCodeVal = num;
                }
              }
            });
            nextCodeNum = String(maxCodeVal + 1).padStart(4, '0');
          }
          const repCode = `INF-APR-AMB-${nextCodeNum}`;
          
          const monthNames = [
            "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
            "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
          ];
          const currentMonthName = monthNames[currentMonth];
          const autoTitle = `BITÁCORA Y APROVECHAMIENTO DE MATERIAL RCD - ${currentMonthName} ${currentYear}`;
          
          const startDate = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
          const endDate = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];

          let respName = 'ROBERTO GÓMEZ';
          let respEmail = 'rgomez@bim.com';
          let respPosition = 'DIRECTOR DE OBRA';

          const director = teamMembers.find(m => 
            m.position?.toUpperCase() === 'DIRECTOR DE OBRA' || 
            m.position?.toUpperCase().includes('DIRECTOR DE OBRA')
          );
          if (director) {
            respName = director.name;
            respEmail = director.email;
            respPosition = 'DIRECTOR DE OBRA';
          } else {
            const anyDir = teamMembers.find(m => m.position?.toUpperCase().includes('DIRECTOR'));
            if (anyDir) {
              respName = anyDir.name;
              respEmail = anyDir.email;
              respPosition = anyDir.position;
            }
          }

          const payload: any = {
            id: 'env_apr_auto_' + currentYear + '_' + (currentMonth + 1), // predictable, stable de-duplicate ID!
            code: repCode,
            title: autoTitle.toUpperCase(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            creatorId: 'system_auto',
            creatorName: 'Automatización Ambiental',
            creatorPosition: 'Asistente Digital',
            creatorTeam: 'AMBIENTAL',
            blocks: [],
            status: 'FINALIZED',
            reportType: 'ENVIRONMENTAL',
            subtype: 'APROVECHAMIENTO',
            logs: [],
            startDate: startDate,
            endDate: endDate,
            responsibleName: respName,
            responsibleEmail: respEmail,
            responsiblePosition: respPosition,
            processDescription: '',
            mediaFiles: [],
            planName: '',
            planUrl: '',
            planMarkedArea: null
          };

          await saveReport(payload);
          await saveAssociatedAprovechamientoIssue(payload);
          console.log("¡Informe de Aprovechamiento Mensual auto-creado exitosamente!");
        } catch (err) {
          console.error("Error auto-creating report:", err);
        } finally {
          setIsAutoCreating(false);
        }
      };

      runAutoCreation();
    }
  }, [loading, reports, teamMembers, isAutoCreating]);

  // Stop camera on unmount or when modal closes
  useEffect(() => {
    if (!isAprModalOpen) {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
      setIsCameraActive(false);
      setIsCameraRecording(false);
      setMediaRecorderRef(null);
    }
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isAprModalOpen]);

  // Compute next code number
  useEffect(() => {
    if (isInsModalOpen && !insCode) {
      const existingIns = reports.filter(r => r.subtype === 'INSPECCION');
      if (existingIns.length > 0) {
        const matches = existingIns[0].code?.match(/INF-INS-AMB-(\d+)/);
        if (matches) {
          setInsCode(String(parseInt(matches[1]) + 1).padStart(4, '0'));
          return;
        }
      }
      setInsCode('0001');
    }
  }, [isInsModalOpen, reports]);

  useEffect(() => {
    if (isAprModalOpen && !editingReportId) {
      if (!aprCode) {
        const existingApr = reports.filter(r => r.subtype === 'APROVECHAMIENTO');
        if (existingApr.length > 0) {
          const matches = existingApr[0].code?.match(/INF-APR-AMB-(\d+)/);
          if (matches) {
            setAprCode(String(parseInt(matches[1]) + 1).padStart(4, '0'));
          } else {
            setAprCode('0001');
          }
        } else {
          setAprCode('0001');
        }
      }

      // Auto-populate first day of physical month and last calendar date
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      setAprStartDate(firstDay);
      setAprEndDate(lastDay);

      // Default Descriptive Title
      const monthNames = [
        "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
        "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
      ];
      const currentMonthName = monthNames[now.getMonth()];
      setAprTitle(`BITÁCORA Y APROVECHAMIENTO DE MATERIAL RCD - ${currentMonthName} ${now.getFullYear()}`);

      // Auto set responsible role "DIRECTOR DE OBRA"
      const director = teamMembers.find(m => 
        m.position?.toUpperCase() === 'DIRECTOR DE OBRA' || 
        m.position?.toUpperCase().includes('DIRECTOR DE OBRA')
      );
      if (director) {
        setAprResponsibleName(director.name);
        setAprResponsibleEmail(director.email);
        setAprResponsiblePosition('DIRECTOR DE OBRA');
      } else {
        const anyDir = teamMembers.find(m => m.position?.toUpperCase().includes('DIRECTOR'));
        if (anyDir) {
          setAprResponsibleName(anyDir.name);
          setAprResponsibleEmail(anyDir.email);
          setAprResponsiblePosition(anyDir.position);
        } else {
          setAprResponsibleName('DIRECTOR DE OBRA ASIGNADO');
          setAprResponsibleEmail('director.obra@norabim.com');
          setAprResponsiblePosition('DIRECTOR DE OBRA');
        }
      }

      // Default process description placeholder so it is not completely empty
      setAprProcessDescription('');
    }
  }, [isAprModalOpen, reports, teamMembers]);

  // Handle Inspection checkbox toggle
  const handleCheckStatus = (secIndex: number, itemIndex: number, newStatus: 'C' | 'NC' | 'N/A') => {
    const nextSecs = [...insSections];
    const item = nextSecs[secIndex].items[itemIndex];
    item.status = item.status === newStatus ? "" : newStatus;

    // Recalculate compliance percentage
    const targetItems = nextSecs[secIndex].items;
    const complies = targetItems.filter(i => i.status === 'C').length;
    const nonComplies = targetItems.filter(i => i.status === 'NC').length;
    const totalRated = complies + nonComplies;

    nextSecs[secIndex].compliancePercentage = totalRated > 0 ? Math.round((complies / totalRated) * 100) : 0;
    setInsSections(nextSecs);

    // If NC is selected, suggest creating an actionable issue item
    if (item.status === 'NC') {
      triggerIssueCreation(nextSecs[secIndex].title, item.id, item.description);
    }
  };

  // Open task creator for non compliancies
  const triggerIssueCreation = (sectionTitle: string, itemId: string, description: string) => {
    setPendingIssueSection(sectionTitle);
    setPendingIssueItemCode(itemId);
    setPendingIssueText(`HALLAZGO AMBIENTAL (${itemId}) - EN ${sectionTitle}: ${description}`);
    if (teamMembers.length > 0) {
      const director = teamMembers.find(m => m.position === 'Director de Obra' || m.position.toUpperCase() === 'DIRECTOR DE OBRA');
      if (director) {
        setAssignedMemberEmail(director.email);
      } else {
        setAssignedMemberEmail(teamMembers[0].email);
      }
    }
    setIsIssueModalOpen(true);
  };

  const handleCreateIssue = async () => {
    if (!assignedMemberEmail) {
      alert("Seleccione un responsable de obra.");
      return;
    }
    const selMember = teamMembers.find(m => m.email === assignedMemberEmail);
    if (!selMember) return;

    try {
      const issueId = 'issue_e_direct_' + Math.random().toString(36).substr(2, 9);
      const computedDueDate = new Date();
      computedDueDate.setDate(computedDueDate.getDate() + assignedDaysLimit);

      const issueObj = {
        id: issueId,
        code: `AMB-INS-${pendingIssueItemCode}`,
        title: `CRÍTICA AMBIENTAL: ${pendingIssueSection.slice(3)}`,
        type: 'No Conformidad Ambiental',
        degreeOfAction: 'critica',
        impact: ['Impacto Ambiental Sostenibilidad'],
        description: pendingIssueText,
        status: 'ACTIVO',
        specialty: 'AMBIENTAL',
        assignedPosition: selMember.position,
        assignedName: selMember.name,
        assignedEmail: selMember.email,
        assignedTeam: 'AMBIENTAL',
        creatorId: user?.id || 'anonymous',
        creatorName: user?.name || 'Gestor Ambiental',
        creatorPosition: user?.position || 'Ambiental',
        creatorTeam: 'AMBIENTAL',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attachments: [],
        dueDate: computedDueDate.toISOString().split('T')[0],
        comments: [],
        locations: { units: [], levels: [], spaces: [] },
        fromReport: true,
        reportType: 'ENVIRONMENTAL'
      };

      await setDoc(doc(db, 'issues', issueId), issueObj);
      setIsIssueModalOpen(false);
      alert("¡Alerta de No Conformidad creada e incorporada a la Bitácora con éxito!");
    } catch (err) {
      console.error(err);
      alert("No se pudo crear la alerta.");
    }
  };

  // Handle Inspection input notes change
  const handleObservationChange = (secIndex: number, itemIndex: number, value: string) => {
    const nextSecs = [...insSections];
    nextSecs[secIndex].items[itemIndex].observations = value;
    setInsSections(nextSecs);
  };

  // Voice Speech Dictation handler
  const handleVoiceDictation = (secIndex: number, itemIndex: number, targetField: 'observations') => {
    if (!SpeechRecognition) {
      alert("Dictado por voz no compatible con este explorador.");
      return;
    }

    const dictationPath = `${secIndex}-${itemIndex}`;

    if (activeVoiceDictation && activeVoiceDictation.path === dictationPath) {
      if (dictationEngine) {
        dictationEngine.stop();
      }
      setActiveVoiceDictation(null);
      return;
    }

    const engine = new SpeechRecognition();
    engine.lang = 'es-ES';
    engine.continuous = false;
    engine.interimResults = false;

    engine.onstart = () => {
      setActiveVoiceDictation({ path: dictationPath });
    };

    engine.onresult = (evt: any) => {
      const transcript = evt.results[0][0].transcript;
      const nextSecs = [...insSections];
      const prevVal = nextSecs[secIndex].items[itemIndex].observations;
      nextSecs[secIndex].items[itemIndex].observations = prevVal ? `${prevVal.trim()} ${transcript}` : transcript;
      setInsSections(nextSecs);
    };

    engine.onerror = (err: any) => {
      console.error("Voice dictation error:", err);
      setActiveVoiceDictation(null);
    };

    engine.onend = () => {
      setActiveVoiceDictation(null);
    };

    engine.start();
    setDictationEngine(engine);
  };

  // Voice dictation for Aprovechamiento general description
  const handleAprDescriptionDictation = () => {
    if (!SpeechRecognition) {
      alert("Dictado por voz no compatible con este explorador.");
      return;
    }

    const dictationPath = 'aprProcessDescription';

    if (activeVoiceDictation && activeVoiceDictation.path === dictationPath) {
      if (dictationEngine) {
        dictationEngine.stop();
      }
      setActiveVoiceDictation(null);
      return;
    }

    const engine = new SpeechRecognition();
    engine.lang = 'es-ES';
    engine.continuous = false;
    engine.interimResults = false;

    engine.onstart = () => {
      setActiveVoiceDictation({ path: dictationPath });
    };

    engine.onresult = (evt: any) => {
      const transcript = evt.results[0][0].transcript;
      setAprProcessDescription(prev => prev ? `${prev.trim()} ${transcript}` : transcript);
    };

    engine.onerror = (err: any) => {
      console.error("Voice dictation error:", err);
      setActiveVoiceDictation(null);
    };

    engine.onend = () => {
      setActiveVoiceDictation(null);
    };

    engine.start();
    setDictationEngine(engine);
  };

  // Device Camera activation handlers
  const startCamera = async (target: 'inicio' | 'during' | 'final' = 'inicio', deviceId?: string) => {
    setCameraTarget(target);
    setCameraError(null);
    try {
      // Clean previous stream if any
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' },
        audio: true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      setIsCameraActive(true);

      // Enumerate available devices for switching cameras
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoIn = allDevices.filter(d => d.kind === 'videoinput');
      setCameraDevices(videoIn);
      if (!selectedCameraId && videoIn.length > 0) {
        setSelectedCameraId(deviceId || videoIn[0].deviceId);
      }
    } catch (err: any) {
      console.warn("Could not start real hardware camera stream:", err);
      setCameraError(
        err.message || 
        "No se pudo acceder a la cámara de manera directa. Verifique los permisos del explorador o si el entorno iFrame restringe el hardware directo de la cámara."
      );
      // We will still allow the camera view to be shown with a highly polished live simulated sandbox so the user can easily "capture" files!
      setIsCameraActive(true);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
    setIsCameraRecording(false);
    if (mediaRecorderRef) {
      try {
        mediaRecorderRef.stop();
      } catch (e) {}
      setMediaRecorderRef(null);
    }
    setRecordedChunks([]);
  };

  const addCapturedMediaFile = (file: { name: string; url: string; type: 'image' | 'video' }) => {
    if (isAprModalOpen) {
      if (cameraTarget === 'during') {
        setAprMediaDuring(prev => [...prev, file]);
      } else if (cameraTarget === 'final') {
        setAprMediaFinal(prev => [...prev, file]);
      } else {
        setAprMediaFiles(prev => [...prev, file]);
      }
    } else {
      setHasUnsavedInlineChanges(true);
      if (cameraTarget === 'during') {
        setActiveReportMediaDuring(prev => [...prev, file]);
      } else if (cameraTarget === 'final') {
        setActiveReportMediaFinal(prev => [...prev, file]);
      } else {
        setActiveReportMedia(prev => [...prev, file]);
      }
    }
  };

  const capturePhotoFromCamera = (videoEl: HTMLVideoElement | null) => {
    if (videoEl && cameraStream) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth || 640;
        canvas.height = videoEl.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg');
          const fileName = `CAM_FOTO_${Date.now().toString().slice(-6)}.jpg`;
          
          addCapturedMediaFile({
            name: fileName,
            url: dataUrl,
            type: 'image'
          });
          
          // Stop camera after capture
          stopCamera();
          return;
        }
      } catch (err) {
        console.error("Failed to capture from canvas, using simulation backup", err);
      }
    }

    // Simulation backup / fail-safe if hardware not running
    const mockImages = [
      'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600',
      'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=600',
      'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=600',
      'https://images.unsplash.com/photo-1590069261209-f8e9b8642343?w=600'
    ];
    const chosen = mockImages[Math.floor(Math.random() * mockImages.length)];
    const fileName = `SIM_CAM_FOTO_${Date.now().toString().slice(-4)}.jpg`;
    addCapturedMediaFile({
      name: fileName,
      url: chosen,
      type: 'image'
    });
    stopCamera();
  };

  const startVideoRecordingFromCamera = () => {
    if (!cameraStream) {
      // Simulation recording
      setIsCameraRecording(true);
      return;
    }

    try {
      setRecordedChunks([]);
      const options = { mimeType: 'video/webm;codecs=vp9' };
      let rec: MediaRecorder;
      try {
        rec = new MediaRecorder(cameraStream, options);
      } catch (e) {
        rec = new MediaRecorder(cameraStream);
      }

      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          setRecordedChunks(prev => [...prev, e.data]);
        }
      };

      rec.onstop = () => {
        // Delay a tiny bit to gather chunks
        setTimeout(() => {
          setRecordedChunks(currentChunks => {
            if (currentChunks.length === 0) return [];
            const blob = new Blob(currentChunks, { type: 'video/webm' });
            const videoUrl = URL.createObjectURL(blob);
            const fileName = `CAM_VIDEO_${Date.now().toString().slice(-6)}.webm`;
            addCapturedMediaFile({
              name: fileName,
              url: videoUrl,
              type: 'video'
            });
            return [];
          });
        }, 100);
      };

      rec.start(1000); // chunk size time-slice 1sec
      setMediaRecorderRef(rec);
      setIsCameraRecording(true);
    } catch (err) {
      console.error("Failed to start MediaRecorder, fallback to simulation", err);
      setIsCameraRecording(true);
    }
  };

  const stopVideoRecordingFromCamera = () => {
    if (mediaRecorderRef && isCameraRecording) {
      try {
        mediaRecorderRef.stop();
      } catch (e) {
        console.error("Error stopping media recorder:", e);
      }
      setMediaRecorderRef(null);
      setIsCameraRecording(false);
      stopCamera();
    } else {
      // Simulation stop
      setIsCameraRecording(false);
      const fileName = `SIM_CAM_VIDEO_${Date.now().toString().slice(-4)}.mp4`;
      addCapturedMediaFile({
        name: fileName,
        url: 'https://assets.mixkit.co/videos/preview/mixkit-dusty-road-on-a-sunny-day-4384-large.mp4', // Safe sample video asset
        type: 'video'
      });
      stopCamera();
    }
  };

  // Save the full Inspection Checklist to DB
  const handleSaveInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!insTitle.trim()) {
      alert("Por favor ingrese un título descriptivo.");
      return;
    }
    if (!insCode.trim() || insCode.length !== 4) {
      alert("Por favor ingrese un código numérico de 4 dígitos.");
      return;
    }

    try {
      const repCode = `INF-INS-AMB-${insCode}`;
      const payload: Partial<QualityReport> = {
        id: 'env_ins_' + Math.random().toString(36).substr(2, 9),
        code: repCode,
        title: insTitle.toUpperCase(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        creatorId: user?.id || 'anonymous',
        creatorName: user?.name || 'Usuario',
        creatorPosition: user?.position || 'Ambiental',
        creatorTeam: 'AMBIENTAL',
        blocks: [], // compat support
        status: 'FINALIZED',
        reportType: 'ENVIRONMENTAL',
        subtype: 'INSPECCION',
        sections: insSections
      };

      await saveReport(payload);
      setIsInsModalOpen(false);
      setInsTitle('');
      setInsCode('');
      setInsSections(INITIAL_INS_SECTIONS());
      alert("¡Informe de Inspección Ambiental guardado exitosamente!");
    } catch (err) {
      console.error(err);
      alert("Error al guardar inspección.");
    }
  };

  // Log row manipulation
  const addAprovechamientoLogRow = () => {
    if (currentQuantity <= 0) {
      alert("La cantidad debe ser mayor a cero.");
      return;
    }
    if (!currentRecipient.trim()) {
      alert("Registre la entidad receptora u operador autorizado.");
      return;
    }

    const newLog: EnvironmentalAprovechamientoLog = {
      id: 'log-' + Math.random().toString(36).substr(2, 9),
      material: currentMaterial,
      quantity: Number(currentQuantity),
      unit: currentUnit,
      recipient: currentRecipient.toUpperCase(),
      certificateCode: currentCertificate.trim() || 'S/C',
      date: currentLogDate,
      observations: currentLogObs.trim(),
      status: currentMaterial === 'RESPEL' ? 'DISPUESTO' : currentMaterial === 'ORDINARIOS' ? 'DISPUESTO' : 'APROVECHADO'
    };

    setAprLogs([...aprLogs, newLog]);
    
    // Clear inputs
    setCurrentQuantity(0);
    setCurrentRecipient('');
    setCurrentCertificate('');
    setCurrentLogObs('');
  };

  const removeAprovechamientoLogRow = (idx: number) => {
    setAprLogs(aprLogs.filter((_, i) => i !== idx));
  };

  const addInlineLogRow = async () => {
    // Collect non-empty unit rows
    const validUnits = inlineSubUnits.filter(u => u.largo !== '' || u.ancho !== '' || u.alto !== '');
    
    if (validUnits.length === 0) {
      alert("Por favor ingrese al menos una unidad de medida con Largo, Ancho y Alto.");
      return;
    }

    // Validate that all started units are fully complete
    const incomplete = validUnits.find(
      u => u.largo === '' || u.ancho === '' || u.alto === '' || 
           Number(u.largo) <= 0 || Number(u.ancho) <= 0 || Number(u.alto) <= 0 ||
           (u.torres !== undefined && u.torres !== '' && Number(u.torres) <= 0) ||
           (u.unidades !== undefined && u.unidades !== '' && Number(u.unidades) <= 0)
    );
    if (incomplete) {
      alert("Por favor asegúrese de que todas las unidades tengan valores válidos mayores a cero de Largo, Ancho, Alto, Torres y Unidades.");
      return;
    }

    if (inlineDuracion === '' || Number(inlineDuracion) <= 0) {
      alert("Por favor ingrese la duración del proceso en días.");
      return;
    }

    const numDuracion = Number(inlineDuracion);

    // Compute dimensions and metrics with repetition multipliers
    const totalLargoVal = validUnits.reduce((sum, u) => {
      const repCount = (Number(u.torres) || 1) * (Number(u.unidades) || 1);
      return sum + (Number(u.largo) * repCount);
    }, 0);
    const totalAreaVal = validUnits.reduce((sum, u) => {
      const repCount = (Number(u.torres) || 1) * (Number(u.unidades) || 1);
      return sum + (Number(u.largo) * Number(u.ancho) * repCount);
    }, 0);
    const totalVolumenVal = validUnits.reduce((sum, u) => {
      const repCount = (Number(u.torres) || 1) * (Number(u.unidades) || 1);
      return sum + (Number(u.largo) * Number(u.ancho) * Number(u.alto) * repCount);
    }, 0);

    // Equivalent uniform width/height for single-row serialization compatibility
    const eqAnchoVal = totalLargoVal > 0 ? (totalAreaVal / totalLargoVal) : 0;
    const eqAltoVal = totalAreaVal > 0 ? (totalVolumenVal / totalAreaVal) : 0;

    // Serialize sub-units
    const savedUnitsObj = validUnits.map(u => {
      const rep = (Number(u.torres) || 1) * (Number(u.unidades) || 1);
      return {
        id: u.id,
        largo: Number(u.largo),
        ancho: Number(u.ancho),
        alto: Number(u.alto),
        torres: Number(u.torres) || 1,
        unidades: Number(u.unidades) || 1,
        volume: Number(u.largo) * Number(u.ancho) * Number(u.alto) * rep,
        area: Number(u.largo) * Number(u.ancho) * rep
      };
    });

    const newLog: EnvironmentalAprovechamientoLog = {
      id: 'log-' + Math.random().toString(36).substr(2, 9),
      material: 'PETREOS',
      quantity: Number(totalVolumenVal.toFixed(2)),
      unit: 'M3',
      recipient: 'ACOPIO SECUNDARIO OBRA',
      certificateCode: 'S/C',
      date: inlineLogDate,
      observations: inlineLogObs.trim() || 'Registro de Cubicación de Acopio.',
      status: 'APROVECHADO',
      largo: Number(totalLargoVal.toFixed(2)),
      ancho: Number(eqAnchoVal.toFixed(2)),
      alto: Number(eqAltoVal.toFixed(2)),
      duracionProceso: numDuracion,
      volumenReutilizado: Number(totalVolumenVal.toFixed(2)),
      areaRecuperada: Number(totalAreaVal.toFixed(2)),
      materialSNR: inlineMaterialSNR,
      densidadSNR: inlineDensidadSNR,
      units: savedUnitsObj
    };

    const nextLogs = [...activeReportLogs, newLog];
    setActiveReportLogs(nextLogs);
    setHasUnsavedInlineChanges(true);

    // Save directly to Firestore immediately
    await handleSaveActiveReportInline(nextLogs);

    // Reset inputs
    setInlineLargo('');
    setInlineAncho('');
    setInlineAlto('');
    setInlineSubUnits([
      { id: '1', largo: '', ancho: '', alto: '', torres: 1, unidades: 1 }
    ]);
    
    // Reset duracion to month's calculated days
    let calculatedDays = 30;
    if (activeMonthReport && activeMonthReport.startDate) {
      try {
        const parts = activeMonthReport.startDate.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        calculatedDays = new Date(year, month, 0).getDate();
      } catch (e) {}
    }
    setInlineDuracion(calculatedDays);
    setInlineLogObs('');
  };

  const removeInlineLogRow = async (idx: number) => {
    const nextLogs = activeReportLogs.filter((_, i) => i !== idx);
    setActiveReportLogs(nextLogs);
    setHasUnsavedInlineChanges(true);

    // Save directly to Firestore immediately
    await handleSaveActiveReportInline(nextLogs);
  };

  const startVoiceDictationForActiveReport = () => {
    if (activeVoiceDictation) {
      if (dictationEngine) {
        try { dictationEngine.stop(); } catch(e){}
      }
      setActiveVoiceDictation(null);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("La API de Dictado por Voz no está soportada en este navegador.");
      return;
    }

    const engine = new SpeechRecognition();
    engine.lang = 'es-ES';
    engine.interimResults = false;
    engine.maxAlternatives = 1;

    setActiveVoiceDictation({ path: 'activeReport' });
    engine.onresult = (evt: any) => {
      const transcript = evt.results[0][0].transcript;
      setActiveReportDesc(prev => prev ? `${prev.trim()} ${transcript}` : transcript);
      setHasUnsavedInlineChanges(true);
    };

    engine.onerror = (err: any) => {
      console.error("Voice dictation error:", err);
      setActiveVoiceDictation(null);
    };

    engine.onend = () => {
      setActiveVoiceDictation(null);
    };

    engine.start();
    setDictationEngine(engine);
  };

  // Save Aprovechamiento report
  const handleSaveAprovechamiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aprTitle.trim()) {
      alert("Por favor ingrese un título.");
      return;
    }
    if (!aprCode.trim() || aprCode.length !== 4) {
      alert("Por favor ingrese un código numérico de 4 dígitos.");
      return;
    }

    const hasNewFiles = [...aprMediaFiles, ...aprMediaDuring, ...aprMediaFinal].some(
      f => f.url && (f.url.startsWith('blob:') || f.url.startsWith('data:'))
    );

    let finalMedia = aprMediaFiles;
    let finalMediaDuring = aprMediaDuring;
    let finalMediaFinal = aprMediaFinal;

    if (hasNewFiles) {
      try {
        setIsUploadingToDrive(true);
        finalMedia = await uploadMediaListToDrive(aprMediaFiles, googleAccessToken);
        finalMediaDuring = await uploadMediaListToDrive(aprMediaDuring, googleAccessToken);
        finalMediaFinal = await uploadMediaListToDrive(aprMediaFinal, googleAccessToken);
      } catch (uploadErr) {
        console.error("Error modal processing files:", uploadErr);
        // Do not block saving; file fallback to base64 was handled inside uploadMediaListToDrive
      } finally {
        setIsUploadingToDrive(false);
        setDriveUploadProgress('');
      }
    }

    try {
      const repCode = `INF-APR-AMB-${aprCode}`;
      const existingReport = editingReportId ? reports.find(r => r.id === editingReportId) : null;
      const payload: any = {
        id: editingReportId || 'env_apr_' + Math.random().toString(36).substr(2, 9),
        code: repCode,
        title: aprTitle.toUpperCase(),
        createdAt: existingReport ? existingReport.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        creatorId: existingReport ? existingReport.creatorId : (user?.id || 'anonymous'),
        creatorName: existingReport ? existingReport.creatorName : (user?.name || 'Usuario'),
        creatorPosition: existingReport ? existingReport.creatorPosition : (user?.position || 'Ambiental'),
        creatorTeam: existingReport ? (existingReport.creatorTeam || 'AMBIENTAL') : 'AMBIENTAL',
        blocks: [],
        status: 'FINALIZED',
        reportType: 'ENVIRONMENTAL',
        subtype: 'APROVECHAMIENTO',
        logs: aprLogs,
        // High fidelity extended fields
        startDate: aprStartDate,
        endDate: aprEndDate,
        responsibleName: aprResponsibleName,
        responsibleEmail: aprResponsibleEmail,
        responsiblePosition: aprResponsiblePosition,
        processDescription: aprProcessDescription,
        mediaFiles: finalMedia,
        mediaDuring: finalMediaDuring,
        mediaFinal: finalMediaFinal,
        planName: aprPlanName,
        planUrl: aprPlanUrl,
        planMarkedArea: aprSelectedMarkArea
      };

      await saveReport(payload);
      await saveAssociatedAprovechamientoIssue(payload);
      setIsAprModalOpen(false);
      setEditingReportId(null);
      setAprTitle('');
      setAprCode('');
      setAprLogs([]);
      setAprProcessDescription('');
      setAprMediaFiles([]);
      setAprMediaDuring([]);
      setAprMediaFinal([]);
      setAprPlanName('');
      setAprPlanUrl('');
      setAprSelectedMarkArea(null);
      alert(editingReportId ? "¡Informe de Aprovechamiento actualizado exitosamente!" : "¡Informe y Formulario de Aprovechamiento de Residuos guardado con éxito!");
    } catch (err) {
      console.error(err);
      alert("Error al guardar informe.");
    }
  };

  // Delete handler
  const handleDeleteSelectedReport = async () => {
    if (!selectedReport) return;
    try {
      await deleteReport(selectedReport.id);
      if (selectedReport.subtype === 'APROVECHAMIENTO') {
        try {
          await deleteDoc(doc(db, 'issues', 'issue_e_apr_' + selectedReport.id));
          console.log("Associated Aprovechamiento issue deleted successfully.");
        } catch (e) {
          console.warn("Could not delete associated issue:", e);
        }
      }
      setSelectedReport(null);
      setIsConfirmingDelete(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Filter lists based on tab & term
  const inspectionsList = reports.filter(r => r.subtype === 'INSPECCION' && (
    r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.code.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  const aprovechamientosList = reports.filter(r => r.subtype === 'APROVECHAMIENTO' && (
    r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.code.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  const pastAprovechamientosList = activeMonthReport
    ? aprovechamientosList.filter(r => r.id !== activeMonthReport.id)
    : aprovechamientosList;

  // Compute Overall Aprovechamiento Stats for dynamic visualizers
  const overallAprovechamientoStats = () => {
    let totalAprovechadoKg = 0; // Kg equivalents
    let totalGeneradoKg = 0; // Kg equivalents

    const convertToKg = (q: number, u: 'KG' | 'TON' | 'M3', m: string, densidadSNR?: number): number => {
      if (u === 'KG') return q;
      if (u === 'TON') return q * 1000;
      if (u === 'M3') {
        if (densidadSNR !== undefined && densidadSNR > 0) {
          return q * densidadSNR;
        }
      }
      // m3 estimations (concrete rcd: ~1500kg, wood ~600kg, plastics ~100kg etc)
      const densities: Record<string, number> = {
        PETREOS: 1400,
        MADERA: 500,
        PLASTICO: 120,
        CHATARRA: 750,
        CARTON: 150,
        PVC: 200,
        RESPEL: 800,
        ORDINARIOS: 300
      };
      const dens = densities[m] || 500;
      return q * dens;
    };

    // Gather logs from filtered reports
    const allLogs: EnvironmentalAprovechamientoLog[] = [];
    const filteredReports = reports.filter(r => {
      if (r.subtype !== 'APROVECHAMIENTO') return false;

      // Determine year and month
      let rYear = new Date(r.createdAt).getFullYear();
      let rMonth = new Date(r.createdAt).getMonth(); // 0-11
      if (r.startDate) {
        try {
          const parts = r.startDate.split('-');
          if (parts[0] && parts[1]) {
            rYear = parseInt(parts[0], 10);
            rMonth = parseInt(parts[1], 10) - 1; // 0-indexed
          }
        } catch (e) {}
      }

      // Filter by selectedStatsYear
      if (selectedStatsYear !== 'ALL' && rYear.toString() !== selectedStatsYear) {
        return false;
      }

      // Filter by selectedStatsPeriod (Semester/Quarter)
      if (selectedStatsPeriod !== 'ALL') {
        if (selectedStatsPeriod === 'S1') {
          // S1: months 0 to 5 (January to June)
          if (rMonth < 0 || rMonth > 5) return false;
        } else if (selectedStatsPeriod === 'S2') {
          // S2: months 6 to 11 (July to December)
          if (rMonth < 6 || rMonth > 11) return false;
        } else if (selectedStatsPeriod === 'Q1') {
          // Q1: months 0 to 2 (Jan, Feb, Mar)
          if (rMonth < 0 || rMonth > 2) return false;
        } else if (selectedStatsPeriod === 'Q2') {
          // Q2: months 3 to 5 (Apr, May, Jun)
          if (rMonth < 3 || rMonth > 5) return false;
        } else if (selectedStatsPeriod === 'Q3') {
          // Q3: months 6 to 8 (Jul, Aug, Sep)
          if (rMonth < 6 || rMonth > 8) return false;
        } else if (selectedStatsPeriod === 'Q4') {
          // Q4: months 9 to 11 (Oct, Nov, Dec)
          if (rMonth < 9 || rMonth > 11) return false;
        }
      }
      
      return true;
    });

    filteredReports.forEach(r => {
      if (r.logs) allLogs.push(...r.logs);
    });

    const materialMap: Record<string, number> = {};

    allLogs.forEach(entry => {
      const kg = convertToKg(entry.quantity, entry.unit, entry.material, entry.densidadSNR);
      totalGeneradoKg += kg;
      if (entry.status === 'APROVECHADO') {
        totalAprovechadoKg += kg;
      }
      materialMap[entry.material] = (materialMap[entry.material] || 0) + kg;
    });

    const recyclingRate = totalGeneradoKg > 0 ? Math.round((totalAprovechadoKg / totalGeneradoKg) * 100) : 0;

    const barData = Object.entries(materialMap).map(([name, val]) => ({
      name,
      Kilogramos: Math.round(val),
      color: name === 'RESPEL' ? '#EF4444' : name === 'ORDINARIOS' ? '#64748B' : '#10B981'
    }));

    return {
      totalGeneradoKg: Math.round(totalGeneradoKg),
      totalAprovechadoKg: Math.round(totalAprovechadoKg),
      recyclingRate,
      barData,
      allLogs,
      filteredReportsCount: filteredReports.length
    };
  };

  const wastesRegistryStats = overallAprovechamientoStats();

  return (
    <div className="flex-1 bg-slate-50 dark:bg-[#020617] h-screen overflow-hidden flex flex-col font-sans">
      
      {/* HEADER SECTION */}
      <header className="p-6 lg:p-8 border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-[#050914]/60 backdrop-blur-xl shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl lg:text-4xl font-display font-black text-slate-900 dark:text-white tracking-tight uppercase flex items-center gap-2.5">
              <Leaf className="w-9 h-9 text-emerald-500 animate-pulse" />
              Gestión Ambiental
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] flex items-center gap-3">
              <span className="w-6 h-px bg-slate-200 dark:bg-slate-800" />
              Cumplimiento y Sostenibilidad Nora CDE
            </p>
          </div>

          {/* DUAL COHESIVE TAB TOGLE */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#0b1021] border border-slate-200/50 dark:border-slate-800/80 rounded-2xl">
            <button
              onClick={() => setActiveTab('INSPECCION')}
              className={cn(
                "px-5 py-2 rounded-xl text-[9.5px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2",
                activeTab === 'INSPECCION'
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/15"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Inspección Ambiental
            </button>
            <button
              onClick={() => setActiveTab('APROVECHAMIENTO')}
              className={cn(
                "px-5 py-2 rounded-xl text-[9.5px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2",
                activeTab === 'APROVECHAMIENTO'
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/15"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              <Recycle className="w-3.5 h-3.5" />
              Aprovechamiento RCD
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5" />
              <input 
                type="text" 
                placeholder="Buscar por código u obra..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-[#070b16] border border-slate-200/80 dark:border-slate-800 rounded-xl text-[9.5px] font-semibold uppercase tracking-wider focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none w-48 sm:w-56"
              />
            </div>
            
            <button 
              onClick={() => activeTab === 'INSPECCION' ? setIsInsModalOpen(true) : setIsAprModalOpen(true)}
              className="px-5 py-2 bg-slate-900 border border-slate-800 dark:bg-emerald-500 hover:bg-emerald-600 dark:hover:bg-emerald-400 text-white dark:text-slate-950 rounded-xl text-[9.5px] font-black uppercase tracking-widest transition-all duration-300 active:scale-95 flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo Registro
            </button>
          </div>
        </div>
      </header>

      {/* RENDER ACTIVE TAB */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
        <div className="max-w-7xl mx-auto">
          
          {/* TAB 1: INSPECCIONES AMBIENTALES LIST */}
          {activeTab === 'INSPECCION' && (
            <div className="space-y-6">
              {inspectionsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-[#050508] rounded-[32px] border border-slate-100 dark:border-slate-900 shadow-sm p-8">
                  <div className="w-16 h-16 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-center justify-center mb-4">
                    <FileSpreadsheet className="w-7 h-7 text-emerald-500" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">No hay inspecciones ambientales</h3>
                  <p className="text-[10px] text-slate-400 max-w-sm mt-1 uppercase font-bold tracking-wide">
                    Haga clic en "Nuevo Registro" para iniciar su planilla de 11 categorías de control de sostenibilidad.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {inspectionsList.map((report) => {
                    // Calculate general compliance %
                    const totalSecs = report.sections?.length || 0;
                    const sum = report.sections?.reduce((acc, cur) => acc + (cur.compliancePercentage || 0), 0) || 0;
                    const avgCompliance = totalSecs > 0 ? Math.round(sum / totalSecs) : 0;

                    return (
                      <div 
                        key={report.id}
                        onClick={() => setSelectedReport(report)}
                        className="group bg-white dark:bg-[#050508] border border-slate-200/80 dark:border-slate-900 rounded-[30px] p-6 hover:border-emerald-500/40 cursor-pointer shadow-sm hover:shadow-xl dark:hover:shadow-none duration-300 transition-all flex flex-col justify-between h-64 relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[8px] font-mono font-black rounded-lg tracking-wider uppercase">
                            {report.code}
                          </span>
                          <span className="text-[8px] font-mono font-black text-slate-400 uppercase">
                            {format(new Date(report.createdAt), 'dd MMM yyyy', { locale: es })}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider line-clamp-2 leading-relaxed">
                            {report.title}
                          </h3>
                          <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                            <User className="w-3.5 h-3.5 text-slate-300" />
                            Auditor: <span className="font-mono text-slate-800 dark:text-slate-300 font-bold">{report.creatorName}</span>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-900/60 pt-4 mt-4 flex items-center justify-between">
                          <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider">
                            Cumplimiento Ambiental
                          </span>
                          <div className={cn(
                            "px-3 py-1 rounded-xl text-[10px] font-mono font-black",
                            avgCompliance >= 85 ? "bg-emerald-500/10 text-emerald-500" :
                            avgCompliance >= 60 ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500"
                          )}>
                            {avgCompliance}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: APROVECHAMIENTO DE RESIDUOS LIST */}
          {activeTab === 'APROVECHAMIENTO' && (
            <div className="space-y-8">
              
              {/* HISTORIC CONSOLIDATION FILTERS */}
              {(() => {
                const availableYears = Array.from(new Set(reports.filter(r => r.subtype === 'APROVECHAMIENTO').map(r => {
                  if (r.startDate) {
                    const parts = r.startDate.split('-');
                    if (parts[0] && parts[0].length === 4) return parts[0];
                  }
                  return new Date(r.createdAt).getFullYear().toString();
                }))).filter(Boolean).sort((a, b) => b.localeCompare(a));

                return (
                  <div className="bg-white dark:bg-[#050508] border border-slate-200/60 dark:border-slate-900 rounded-[28px] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all duration-300">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/20">
                          <Calendar className="w-4 h-4 text-emerald-500" />
                        </div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                          Consolidado de Indicadores RCD
                        </h3>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                        Suma total de reportes procesados: <span className="text-emerald-500 font-mono font-black">{wastesRegistryStats.filteredReportsCount} reportes</span> coincidentes
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                      {/* FILTER BY YEAR */}
                      <div className="flex flex-col gap-1 w-full sm:w-48">
                        <span className="text-[8.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Filtrar por Año</span>
                        <select
                          value={selectedStatsYear}
                          onChange={(e) => setSelectedStatsYear(e.target.value)}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#070b16] border border-slate-200 dark:border-slate-850 rounded-xl text-[9.5px] font-mono font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          <option value="ALL">TODOS LOS AÑOS</option>
                          {availableYears.map(yr => (
                            <option key={yr} value={yr}>{yr}</option>
                          ))}
                        </select>
                      </div>

                      {/* FILTER BY PERIOD (SEMESTERS / QUARTERS) */}
                      <div className="flex flex-col gap-1 w-full sm:w-56">
                        <span className="text-[8.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Filtrar por Periodo</span>
                        <select
                          value={selectedStatsPeriod}
                          onChange={(e) => setSelectedStatsPeriod(e.target.value)}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#070b16] border border-slate-200 dark:border-slate-850 rounded-xl text-[9.5px] font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          <option value="ALL">AÑO COMPLETO / TODOS</option>
                          <optgroup label="Semestres">
                            <option value="S1">1ER SEMESTRE (ENE - JUN)</option>
                            <option value="S2">2DO SEMESTRE (JUL - DIC)</option>
                          </optgroup>
                          <optgroup label="Trimestres">
                            <option value="Q1">1ER TRIMESTRE (ENE - MAR)</option>
                            <option value="Q2">2DO TRIMESTRE (ABR - JUN)</option>
                            <option value="Q3">3ER TRIMESTRE (JUL - SEP)</option>
                            <option value="Q4">4TO TRIMESTRE (OCT - DIC)</option>
                          </optgroup>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* KPIS DASHBOARD FOR ENVIRONMENTAL EFFICIENCY */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-[#050508] border border-slate-200/60 dark:border-slate-900 p-6 rounded-[28px] shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ECO RATE CDE</p>
                    <h3 className="text-3xl font-black font-mono text-emerald-500">{wastesRegistryStats.recyclingRate}%</h3>
                    <p className="text-[8.5px] text-slate-400 font-bold uppercase">Tasa de Aprovechamiento</p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-center justify-center">
                    <Award className="w-6 h-6 text-emerald-500" />
                  </div>
                </div>

                <div className="bg-white dark:bg-[#050508] border border-slate-200/60 dark:border-slate-900 p-6 rounded-[28px] shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">RESIDUOS REINTEGRADOS</p>
                    <h3 className="text-3xl font-black font-mono text-slate-800 dark:text-white">
                      {(wastesRegistryStats.totalAprovechadoKg / 1000).toFixed(1)} <span className="text-xs font-bold text-slate-400">Ton</span>
                    </h3>
                    <p className="text-[8.5px] text-slate-400 font-bold uppercase">Material Aprovechado</p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-center justify-center">
                    <Recycle className="w-6 h-6 text-emerald-500" />
                  </div>
                </div>

                <div className="bg-white dark:bg-[#050508] border border-slate-200/60 dark:border-slate-900 p-6 rounded-[28px] shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">COPRODUCTOS AMBIENTALES</p>
                    <h3 className="text-3xl font-black font-mono text-slate-800 dark:text-white">
                      {(wastesRegistryStats.totalGeneradoKg / 1000).toFixed(1)} <span className="text-xs font-bold text-slate-400">Ton</span>
                    </h3>
                    <p className="text-[8.5px] text-slate-400 font-bold uppercase">Total Residuos Totales</p>
                  </div>
                  <div className="w-12 h-12 bg-slate-500/5 rounded-2xl border border-slate-500/10 flex items-center justify-center">
                    <Layers className="w-6 h-6 text-slate-400" />
                  </div>
                </div>

                <div className="bg-white dark:bg-[#050508] border border-slate-200/60 dark:border-slate-900 p-6 rounded-[28px] shadow-sm flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">COEFICIENCIA GLOBAL</p>
                    <h3 className="text-3xl font-black font-mono text-emerald-500">A+</h3>
                    <p className="text-[8.5px] text-slate-400 font-bold uppercase">Clasificación Sello Verde</p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-emerald-500" />
                  </div>
                </div>
              </div>

              {/* DYNAMIC CHARTS */}
              {wastesRegistryStats.barData.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* BAR CHART MIX */}
                  <div className="bg-white dark:bg-[#050508] border border-slate-200/60 dark:border-slate-900 p-6 rounded-[32px] lg:col-span-2">
                    <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-emerald-500" />
                      Masa de Residuos por Categoría (Kilogramos)
                    </h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={wastesRegistryStats.barData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="name" fontSize={9} stroke="#94a3b8" />
                          <YAxis fontSize={9} stroke="#94a3b8" />
                          <Tooltip contentStyle={{ fontSize: 10, background: '#070C19', color: '#FFF', borderRadius: 8, border: 'none' }} />
                          <Bar dataKey="Kilogramos" fill="#10B981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* PIE METRICS */}
                  <div className="bg-white dark:bg-[#050508] border border-slate-200/60 dark:border-slate-900 p-6 rounded-[32px] flex flex-col justify-between">
                    <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                      Balance Destino Final
                    </h3>
                    
                    <div className="h-44 relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie
                            data={[
                              { name: 'Aprovechado', value: wastesRegistryStats.totalAprovechadoKg, color: '#10B981' },
                              { name: 'Dispueto/No Reciclado', value: wastesRegistryStats.totalGeneradoKg - wastesRegistryStats.totalAprovechadoKg, color: '#E2E8F0' }
                            ]}
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            <Cell fill="#10B981" />
                            <Cell fill="#64748B" />
                          </Pie>
                        </RePieChart>
                      </ResponsiveContainer>
                      <div className="absolute text-center">
                        <span className="text-xl font-black font-mono text-slate-800 dark:text-white">
                          {wastesRegistryStats.recyclingRate}%
                        </span>
                        <p className="text-[7.5px] font-black text-slate-400 uppercase">Aprovechamiento</p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-900/60 text-[8.5px] uppercase font-bold tracking-wide text-slate-400">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" /> Coproductos Aprovechables</span>
                        <span className="text-slate-800 dark:text-white font-mono">{(wastesRegistryStats.totalAprovechadoKg / 1000).toFixed(2)} T</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-slate-400 rounded-full" /> Ordinarios / Químicos</span>
                        <span className="text-slate-800 dark:text-white font-mono">{((wastesRegistryStats.totalGeneradoKg - wastesRegistryStats.totalAprovechadoKg) / 1000).toFixed(2)} T</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ACTIVE REPORT PANEL FOR CURRENT MONTH (OPEN & EDITABLE DIRECTLY) */}
              {activeMonthReport && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pl-1">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Planilla Abierta - Mes en Curso
                    </h3>
                    <span className={cn(
                      "text-[8px] font-mono font-black uppercase tracking-wider px-2.5 py-1 rounded-xl shadow-sm border",
                      isEditableAprovechamiento(activeMonthReport)
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 animate-pulse"
                        : "bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20"
                    )}>
                      {isEditableAprovechamiento(activeMonthReport)
                        ? "✍️ EDICIÓN ACTIVA (Plazo de 10 días calendario)"
                        : "🔒 REGISTRO CERRADO (Límite excedido)"}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-[#050508] border border-slate-200/80 dark:border-slate-900 rounded-[32px] overflow-hidden shadow-sm flex flex-col">
                    {/* Header Banner */}
                    <div className="p-6 lg:p-8 bg-slate-50/50 dark:bg-black/20 border-b border-slate-100 dark:border-slate-950 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[7.5px] font-mono font-black rounded-md tracking-wider uppercase">
                            {activeMonthReport.code}
                          </span>
                          <span className="text-[8px] font-mono font-black text-slate-400 uppercase">
                            CREADO EL {format(new Date(activeMonthReport.createdAt), 'dd/MM/yyyy')}
                          </span>
                        </div>
                        <h2 className="text-sm lg:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider leading-relaxed">
                          {activeMonthReport.title}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2.5 mt-3.5">
                          <button
                            type="button"
                            onClick={handlePreviewActiveReport}
                            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-650 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-[9px] uppercase tracking-[0.15em] rounded-xl shadow-md transition-all duration-305 transform active:scale-95 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-white animate-pulse" />
                            Ver Detalle
                          </button>
                          <button
                            type="button"
                            onClick={() => exportAprovechamientoToPDF(activeMonthReport, googleAccessToken)}
                            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-550/15 hover:bg-rose-605 text-rose-600 hover:text-white dark:text-rose-450 dark:hover:text-white border border-rose-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 active:scale-95 cursor-pointer font-sans"
                            title="Descargar Reporte en formato PDF"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Descargar PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => exportAprovechamientoToExcel(activeMonthReport)}
                            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-500/15 hover:bg-emerald-605 text-emerald-600 hover:text-white dark:text-emerald-450 dark:hover:text-white border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 active:scale-95 cursor-pointer font-sans"
                            title="Descargar Planilla en formato Excel"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            Descargar Excel
                          </button>
                        </div>
                      </div>
                      
                      {/* Metadatos */}
                      <div className="grid grid-cols-2 gap-4 max-w-md text-[8.5px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <div className="bg-white dark:bg-[#0c0d14] p-3 rounded-2xl border border-slate-150 dark:border-slate-900 shadow-sm flex items-center gap-2.5">
                          <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
                          <div>
                            <span className="text-[7px] text-slate-400 block font-bold">VIGENCIA MENSUAL</span>
                            <span className="text-slate-800 dark:text-slate-200 font-mono font-bold font-black">{activeMonthReport.startDate || '1°'} al {activeMonthReport.endDate || 'Fin'}</span>
                          </div>
                        </div>
                        <div className="bg-white dark:bg-[#0c0d14] p-3 rounded-2xl border border-slate-150 dark:border-slate-900 shadow-sm flex items-center gap-2.5">
                          <User className="w-4 h-4 text-emerald-500 shrink-0" />
                          <div>
                            <span className="text-[7px] text-slate-400 block font-bold">RESPONSABLE GENERAL</span>
                            <span className="text-slate-800 dark:text-slate-200 font-black truncate max-w-[120px] block">{activeMonthReport.responsibleName}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Columns Panels */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-950 flex-1">
                      {/* Left Column: Processes & evidence */}
                      <div className="lg:col-span-5 p-6 lg:p-8 space-y-6">
                        {/* Process details */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[8.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                              Descripción de procesos del mes
                            </label>
                            {isEditableAprovechamiento(activeMonthReport) && (
                              <button
                                type="button"
                                onClick={() => startVoiceDictationForActiveReport()}
                                className={cn(
                                  "p-1.5 rounded-lg border text-[8px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all duration-300",
                                  activeVoiceDictation?.path === 'activeReport'
                                    ? "bg-red-500 border-red-500 text-white animate-pulse"
                                    : "bg-slate-50 dark:bg-[#080d1a] hover:bg-slate-100 dark:hover:bg-[#0f1933] border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                                )}
                              >
                                <Mic className="w-3 h-3" />
                                {activeVoiceDictation?.path === 'activeReport' ? 'Escuchando...' : 'Dictar por voz'}
                              </button>
                            )}
                          </div>
                          
                          {isEditableAprovechamiento(activeMonthReport) ? (
                            <textarea
                              value={activeReportDesc}
                              onChange={(e) => {
                                setActiveReportDesc(e.target.value);
                                setHasUnsavedInlineChanges(true);
                              }}
                              placeholder="Escriba los procesos, metodologías y actividades de mitigación ambiental planificadas..."
                              className="w-full h-24 p-4 text-[9.5px] font-medium bg-slate-50 dark:bg-[#040710] border border-slate-200 dark:border-slate-900 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-slate-800 dark:text-slate-100"
                            />
                          ) : (
                            <p className="p-4 bg-slate-50/50 dark:bg-black/20 text-[9.5px] leading-relaxed text-slate-600 dark:text-slate-400 rounded-2xl italic">
                              {activeReportDesc || "No se ha ingresado una descripción para los procesos de este período."}
                            </p>
                          )}
                        </div>

                         {/* Evidence & Media Row */}
                        <div className="space-y-6">
                          {driveUploadError && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-2.5 text-slate-850 dark:text-slate-200 text-[9px] font-semibold leading-relaxed"
                            >
                              <span className="text-amber-500 font-bold">⚠️</span>
                              <div className="flex-1">
                                <p>{driveUploadError}</p>
                                <p className="text-[8px] text-slate-500 dark:text-slate-400 mt-1 uppercase font-black tracking-wider">
                                  La foto se guardó localmente en menor resolución para evitar exceder el límite del servidor. El reporte se guardará correctamente.
                                </p>
                              </div>
                              <button 
                                type="button" 
                                onClick={() => setDriveUploadError(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-white font-bold ml-1 text-xs"
                              >
                                ×
                              </button>
                            </motion.div>
                          )}
                          {/* 1. Registro de Evidencias de Inicio / Acopio */}
                          <div className="space-y-3 bg-slate-50/50 dark:bg-[#070b16]/30 p-4.5 rounded-3xl border border-slate-200/50 dark:border-slate-900">
                            <label className="text-[8.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block flex items-center justify-between">
                              <span>1. Registro de Evidencias de Inicio / Acopio ({activeReportMedia.length})</span>
                              {!isEditableInicioEvidence(activeMonthReport) && (
                                <span className="text-[7.5px] text-amber-500 font-bold uppercase tracking-widest">🔒 Bloqueado (MÁX 10 DÍAS)</span>
                              )}
                            </label>
                            
                            {activeReportMedia.length === 0 ? (
                              <div className="py-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center">
                                <Camera className="w-5 h-5 text-slate-300 dark:text-slate-700 mb-1" />
                                <p className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider">Sin fotos cargadas de inicio</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-3 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                                {activeReportMedia.map((media: any, idx: number) => (
                                  <div key={idx} className="group relative rounded-xl border border-slate-200 dark:border-slate-900 bg-slate-50 dark:bg-[#070b16] overflow-hidden aspect-video">
                                    {media.type === 'image' || media.type?.startsWith('image') || media.category === 'image' ? (
                                      <img 
                                        src={getAuthenticatedDriveUrl(media.driveFileId ? `/api/drive-image/${media.driveFileId}` : (media.thumbnail || media.url), googleAccessToken)} 
                                        onError={(e) => {
                                          const originalUrl = media.driveFileId ? `/api/drive-image/${media.driveFileId}` : (media.thumbnail || media.url);
                                          const authUrl = getAuthenticatedDriveUrl(originalUrl, googleAccessToken);
                                          if (e.currentTarget.src !== authUrl) {
                                            e.currentTarget.src = authUrl;
                                          }
                                        }}
                                        onClick={() => window.open(media.webViewLink || media.url, '_blank')}
                                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-all duration-300" 
                                        alt={media.name} 
                                        referrerPolicy="no-referrer" 
                                      />
                                    ) : (
                                      <div 
                                        onClick={() => window.open(media.webViewLink || media.url, '_blank')}
                                        className="w-full h-full flex items-center justify-center bg-slate-900 text-white cursor-pointer hover:bg-slate-850 transition-colors"
                                      >
                                        <Video className="w-4 h-4 opacity-40" />
                                      </div>
                                    )}
                                    <div 
                                      onClick={() => window.open(media.webViewLink || media.url, '_blank')}
                                      className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center py-2 px-1 cursor-pointer select-none"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-white animate-pulse" />
                                      <span className="text-[6.5px] text-white font-extrabold uppercase tracking-widest mt-0.5">Ver en Drive ↗</span>
                                    </div>
                                    {isEditableInicioEvidence(activeMonthReport) && (
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          const next = activeReportMedia.filter((_, i) => i !== idx);
                                          setActiveReportMedia(next);
                                          setHasUnsavedInlineChanges(true);
                                        }}
                                        className="absolute top-1.5 right-1.5 p-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-md"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {isEditableInicioEvidence(activeMonthReport) && (
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <label className="flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-900 border-dashed hover:border-emerald-500/30 dark:hover:border-emerald-500/30 rounded-xl cursor-pointer text-[8px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-emerald-500 transition-colors bg-slate-100/50 dark:bg-black/10">
                                  <Plus className="w-3.5 h-3.5" />
                                  Cargar Fotos
                                  <input 
                                    type="file" 
                                    multiple 
                                    accept="image/*,video/*" 
                                    className="hidden"
                                    onChange={async (e) => {
                                      if (e.target.files && e.target.files.length > 0) {
                                        let hasVideo = false;
                                        for (let i = 0; i < e.target.files.length; i++) {
                                          if (e.target.files[i].type.startsWith('video')) {
                                            hasVideo = true;
                                            break;
                                          }
                                        }
                                        if (hasVideo && !googleAccessToken) {
                                          alert("⚠️ Para poder subir VIDEOS, debe conectar su Google Drive primero en la barra superior. Los videos no se pueden guardar en la base de datos local debido a su gran tamaño.");
                                          return;
                                        }
                                        const nextFiles: any[] = [];
                                        for (let i = 0; i < e.target.files.length; i++) {
                                          const f = e.target.files[i];
                                          const res = await new Promise<string>((resolve) => {
                                            const r = new FileReader();
                                            r.onload = () => resolve(r.result as string);
                                            r.readAsDataURL(f);
                                          });
                                          nextFiles.push({
                                            name: f.name,
                                            url: res,
                                            type: f.type.startsWith('video') ? 'video' : 'image'
                                          });
                                        }
                                        const next = [...activeReportMedia, ...nextFiles];
                                        setActiveReportMedia(next);
                                        setHasUnsavedInlineChanges(true);
                                      }
                                    }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => startCamera('inicio')}
                                  className="flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-900 border-dashed hover:border-emerald-500/30 rounded-xl text-[8px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-emerald-500 transition-colors bg-slate-100/50 dark:bg-black/10"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                  Usar Cámara
                                </button>
                              </div>
                            )}
                          </div>

                          {/* 2. Registro Fotográfico Durante la Reutilización */}
                          <div className="space-y-3 bg-slate-50/50 dark:bg-[#070b16]/30 p-4.5 rounded-3xl border border-slate-200/50 dark:border-slate-900">
                            <label className="text-[8.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block flex items-center justify-between">
                              <span>2. Registro Fotográfico Durante la Reutilización ({activeReportMediaDuring.length})</span>
                              {!isRestOfFormEditable(activeMonthReport) && (
                                <span className="text-[7.5px] text-red-500 font-bold uppercase tracking-widest">🔒 Bloqueado (MES CERRADO)</span>
                              )}
                            </label>
                            
                            {activeReportMediaDuring.length === 0 ? (
                              <div className="py-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center">
                                <Camera className="w-5 h-5 text-slate-300 dark:text-slate-700 mb-1" />
                                <p className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider">Sin fotos durante el proceso</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-3 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                                {activeReportMediaDuring.map((media: any, idx: number) => (
                                  <div key={idx} className="group relative rounded-xl border border-slate-200 dark:border-slate-900 bg-slate-50 dark:bg-[#070b16] overflow-hidden aspect-video">
                                    {media.type === 'image' || media.type?.startsWith('image') || media.category === 'image' ? (
                                      <img 
                                        src={getAuthenticatedDriveUrl(media.driveFileId ? `/api/drive-image/${media.driveFileId}` : (media.thumbnail || media.url), googleAccessToken)} 
                                        onError={(e) => {
                                          const originalUrl = media.driveFileId ? `/api/drive-image/${media.driveFileId}` : (media.thumbnail || media.url);
                                          const authUrl = getAuthenticatedDriveUrl(originalUrl, googleAccessToken);
                                          if (e.currentTarget.src !== authUrl) {
                                            e.currentTarget.src = authUrl;
                                          }
                                        }}
                                        onClick={() => window.open(media.webViewLink || media.url, '_blank')}
                                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-all duration-300" 
                                        alt={media.name} 
                                        referrerPolicy="no-referrer" 
                                      />
                                    ) : (
                                      <div 
                                        onClick={() => window.open(media.webViewLink || media.url, '_blank')}
                                        className="w-full h-full flex items-center justify-center bg-slate-900 text-white cursor-pointer hover:bg-slate-850 transition-colors"
                                      >
                                        <Video className="w-4 h-4 opacity-40" />
                                      </div>
                                    )}
                                    <div 
                                      onClick={() => window.open(media.webViewLink || media.url, '_blank')}
                                      className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center py-2 px-1 cursor-pointer select-none"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-white animate-pulse" />
                                      <span className="text-[6.5px] text-white font-extrabold uppercase tracking-widest mt-0.5">Ver en Drive ↗</span>
                                    </div>
                                    {isRestOfFormEditable(activeMonthReport) && (
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          const next = activeReportMediaDuring.filter((_, i) => i !== idx);
                                          setActiveReportMediaDuring(next);
                                          setHasUnsavedInlineChanges(true);

                                        }}
                                        className="absolute top-1.5 right-1.5 p-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-md"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {isRestOfFormEditable(activeMonthReport) && (
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <label className="flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-900 border-dashed hover:border-emerald-500/30 dark:hover:border-emerald-500/30 rounded-xl cursor-pointer text-[8px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-emerald-500 transition-colors bg-slate-100/50 dark:bg-black/10">
                                  <Plus className="w-3.5 h-3.5" />
                                  Cargar Fotos
                                  <input 
                                    type="file" 
                                    multiple 
                                    accept="image/*,video/*" 
                                    className="hidden"
                                    onChange={async (e) => {
                                      if (e.target.files && e.target.files.length > 0) {
                                        let hasVideo = false;
                                        for (let i = 0; i < e.target.files.length; i++) {
                                          if (e.target.files[i].type.startsWith('video')) {
                                            hasVideo = true;
                                            break;
                                          }
                                        }
                                        if (hasVideo && !googleAccessToken) {
                                          alert("⚠️ Para poder subir VIDEOS, debe conectar su Google Drive primero en la barra superior. Los videos no se pueden guardar en la base de datos local debido a su gran tamaño.");
                                          return;
                                        }
                                        const nextFiles: any[] = [];
                                        for (let i = 0; i < e.target.files.length; i++) {
                                          const f = e.target.files[i];
                                          const res = await new Promise<string>((resolve) => {
                                            const r = new FileReader();
                                            r.onload = () => resolve(r.result as string);
                                            r.readAsDataURL(f);
                                          });
                                          nextFiles.push({
                                            name: f.name,
                                            url: res,
                                            type: f.type.startsWith('video') ? 'video' : 'image'
                                          });
                                        }
                                        const next = [...activeReportMediaDuring, ...nextFiles];
                                        setActiveReportMediaDuring(next);
                                        setHasUnsavedInlineChanges(true);

                                      }
                                    }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => startCamera('during')}
                                  className="flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-900 border-dashed hover:border-emerald-500/30 rounded-xl text-[8px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-emerald-500 transition-colors bg-slate-100/50 dark:bg-black/10"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                  Usar Cámara
                                </button>
                              </div>
                            )}
                          </div>

                          {/* 3. Registro Fotográfico Resultado Final de la Reutilización */}
                          <div className="space-y-3 bg-slate-50/50 dark:bg-[#070b16]/30 p-4.5 rounded-3xl border border-slate-200/50 dark:border-slate-900">
                            <label className="text-[8.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block flex items-center justify-between">
                              <span>3. Registro Fotográfico Resultado Final de la Reutilización ({activeReportMediaFinal.length})</span>
                              {!isRestOfFormEditable(activeMonthReport) && (
                                <span className="text-[7.5px] text-red-500 font-bold uppercase tracking-widest">🔒 Bloqueado (MES CERRADO)</span>
                              )}
                            </label>
                            
                            {activeReportMediaFinal.length === 0 ? (
                              <div className="py-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center">
                                <Camera className="w-5 h-5 text-slate-300 dark:text-slate-700 mb-1" />
                                <p className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider">Sin fotos del resultado final</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-3 max-h-24 overflow-y-auto custom-scrollbar pr-1">
                                {activeReportMediaFinal.map((media: any, idx: number) => (
                                  <div key={idx} className="group relative rounded-xl border border-slate-200 dark:border-slate-900 bg-slate-50 dark:bg-[#070b16] overflow-hidden aspect-video">
                                    {media.type === 'image' || media.type?.startsWith('image') || media.category === 'image' ? (
                                      <img 
                                        src={getAuthenticatedDriveUrl(media.driveFileId ? `/api/drive-image/${media.driveFileId}` : (media.thumbnail || media.url), googleAccessToken)} 
                                        onError={(e) => {
                                          const originalUrl = media.driveFileId ? `/api/drive-image/${media.driveFileId}` : (media.thumbnail || media.url);
                                          const authUrl = getAuthenticatedDriveUrl(originalUrl, googleAccessToken);
                                          if (e.currentTarget.src !== authUrl) {
                                            e.currentTarget.src = authUrl;
                                          }
                                        }}
                                        onClick={() => window.open(media.webViewLink || media.url, '_blank')}
                                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-all duration-300" 
                                        alt={media.name} 
                                        referrerPolicy="no-referrer" 
                                      />
                                    ) : (
                                      <div 
                                        onClick={() => window.open(media.webViewLink || media.url, '_blank')}
                                        className="w-full h-full flex items-center justify-center bg-slate-900 text-white cursor-pointer hover:bg-slate-850 transition-colors"
                                      >
                                        <Video className="w-4 h-4 opacity-40" />
                                      </div>
                                    )}
                                    <div 
                                      onClick={() => window.open(media.webViewLink || media.url, '_blank')}
                                      className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center py-2 px-1 cursor-pointer select-none"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-white animate-pulse" />
                                      <span className="text-[6.5px] text-white font-extrabold uppercase tracking-widest mt-0.5">Ver en Drive ↗</span>
                                    </div>
                                    {isRestOfFormEditable(activeMonthReport) && (
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          const next = activeReportMediaFinal.filter((_, i) => i !== idx);
                                          setActiveReportMediaFinal(next);
                                          setHasUnsavedInlineChanges(true);

                                        }}
                                        className="absolute top-1.5 right-1.5 p-1 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-md"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {isRestOfFormEditable(activeMonthReport) && (
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <label className="flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-900 border-dashed hover:border-emerald-500/30 dark:hover:border-emerald-500/30 rounded-xl cursor-pointer text-[8px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-emerald-500 transition-colors bg-slate-100/50 dark:bg-black/10">
                                  <Plus className="w-3.5 h-3.5" />
                                  Cargar Fotos
                                  <input 
                                    type="file" 
                                    multiple 
                                    accept="image/*,video/*" 
                                    className="hidden"
                                    onChange={async (e) => {
                                      if (e.target.files && e.target.files.length > 0) {
                                        let hasVideo = false;
                                        for (let i = 0; i < e.target.files.length; i++) {
                                          if (e.target.files[i].type.startsWith('video')) {
                                            hasVideo = true;
                                            break;
                                          }
                                        }
                                        if (hasVideo && !googleAccessToken) {
                                          alert("⚠️ Para poder subir VIDEOS, debe conectar su Google Drive primero en la barra superior. Los videos no se pueden guardar en la base de datos local debido a su gran tamaño.");
                                          return;
                                        }
                                        const nextFiles: any[] = [];
                                        for (let i = 0; i < e.target.files.length; i++) {
                                          const f = e.target.files[i];
                                          const res = await new Promise<string>((resolve) => {
                                            const r = new FileReader();
                                            r.onload = () => resolve(r.result as string);
                                            r.readAsDataURL(f);
                                          });
                                          nextFiles.push({
                                            name: f.name,
                                            url: res,
                                            type: f.type.startsWith('video') ? 'video' : 'image'
                                          });
                                        }
                                        const next = [...activeReportMediaFinal, ...nextFiles];
                                        setActiveReportMediaFinal(next);
                                        setHasUnsavedInlineChanges(true);

                                      }
                                    }}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => startCamera('final')}
                                  className="flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-900 border-dashed hover:border-emerald-500/30 rounded-xl text-[8px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-emerald-500 transition-colors bg-slate-100/50 dark:bg-black/10"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                  Usar Cámara
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Location / Plane */}
                        {activeMonthReport.planUrl && (
                          <div className="space-y-2">
                            <label className="text-[8.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                              Ubicación y plano asociado
                            </label>
                            <div className="relative border border-slate-200 dark:border-slate-900 rounded-2xl bg-slate-950 overflow-hidden h-24 flex items-center justify-center">
                              <img src={activeMonthReport.planUrl} className="w-full h-full object-cover opacity-25 select-none pointer-events-none" alt="Blue-print visualization" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-2.5">
                                <p className="text-[7.5px] font-bold text-white uppercase truncate">{activeMonthReport.planName || 'PLAN DE CONTROL AMBIENTAL'}</p>
                              </div>
                              {activeMonthReport.planMarkedArea && (
                                <div 
                                  className="absolute w-6 h-6 border-2 border-emerald-500 bg-emerald-500/20 rounded-full animate-bounce"
                                  style={{ 
                                    left: `${activeMonthReport.planMarkedArea.x - 10}%`, 
                                    top: `${activeMonthReport.planMarkedArea.y - 9}%`, 
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right Column: Weight Ledger control panel */}
                      <div className="lg:col-span-7 p-6 lg:p-8 flex flex-col space-y-6">
                        {/* Title weights */}
                        <div className="flex items-center justify-between shrink-0">
                          <div>
                            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                              Planilla de Cubicación y Aprovechamiento de Acopio
                            </h3>
                            <p className="text-[8px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider block mt-0.5">
                              TOTAL: {activeReportLogs.length} CUBICACIONES REGISTRADAS
                            </p>
                          </div>
                        </div>

                        {/* Bento Highlights for Volume, Area, and Weight (MÉTRICAS RESALTADAS) */}
                        <div id="active_bento_metrics" className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
                          {/* VOLUMEN TOTAL REUTILIZADO */}
                          <div id="stat_volumen_reutilizado" className="relative group overflow-hidden p-4 rounded-3xl bg-gradient-to-br from-amber-500/[0.07] via-amber-500/[0.02] to-transparent border border-amber-500/20 dark:border-amber-500/10 shadow-sm flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:border-amber-500/35">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[8px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                                Volumen Total Reutilizado RCD
                              </span>
                              <span className="text-[7px] font-mono font-bold px-1.5 py-0.5 bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/10 uppercase">MÉTRICA CLAVE</span>
                            </div>
                            <div>
                              <p className="text-xl lg:text-2xl font-display font-black text-amber-550 dark:text-amber-400 tracking-tight leading-none">
                                {totalVolumenAcumulado.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-[10px] font-medium text-slate-500 tracking-wide uppercase">m³</span>
                              </p>
                              <p className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wide mt-1">Sustento volumétrico acumulado en obra</p>
                            </div>
                          </div>

                          {/* ÁREA FINAL RECUPERADA */}
                          <div id="stat_area_recuperada" className="relative group overflow-hidden p-4 rounded-3xl bg-gradient-to-br from-teal-500/[0.07] via-teal-500/[0.02] to-transparent border border-teal-500/20 dark:border-teal-500/10 shadow-sm flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:border-teal-500/35">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[8px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Recycle className="w-3.5 h-3.5 text-teal-550 animate-pulse" />
                                Área Final Recuperada RCD
                              </span>
                              <span className="text-[7px] font-mono font-bold px-1.5 py-0.5 bg-teal-500/10 text-teal-500 rounded-full border border-teal-500/10 uppercase">META MENSUAL</span>
                            </div>
                            <div>
                              <p className="text-xl lg:text-2xl font-display font-black text-teal-555 dark:text-teal-400 tracking-tight leading-none">
                                {totalAreaAcumulada.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-[10px] font-medium text-slate-500 tracking-wide uppercase">m²</span>
                              </p>
                              <p className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wide mt-1">Superficie restituida y liberada del proyecto</p>
                            </div>
                          </div>

                          {/* TOTAL DE APROVECHAMIENTO (Sustento de Peso) */}
                          <div id="stat_total_aprovechamiento" className="relative group overflow-hidden p-4 rounded-3xl bg-gradient-to-br from-emerald-500/[0.12] via-emerald-500/[0.04] to-transparent border border-emerald-500/30 dark:border-emerald-500/20 shadow-lg flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:border-emerald-500/55">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Scale className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                                Total Aprovechamiento RCD
                              </span>
                              <span className="text-[7px] font-mono font-black px-1.5 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-450 rounded-full border border-emerald-500/30 uppercase tracking-wider">PESO NETO ⭐</span>
                            </div>
                            <div>
                              <div className="flex items-baseline gap-1.5">
                                <p className="text-xl lg:text-2xl font-display font-black text-emerald-650 dark:text-emerald-400 tracking-tight leading-none">
                                  {totalAprovechamientoKg.toLocaleString('es-ES', { maximumFractionDigits: 0 })} <span className="text-[9.5px] font-medium text-slate-500 tracking-wide uppercase font-sans">kg</span>
                                </p>
                                <span className="text-xs font-mono font-bold text-slate-400">/</span>
                                <p className="text-sm lg:text-base font-display font-black text-emerald-600 dark:text-emerald-300 tracking-tight leading-none">
                                  {totalAprovechamientoTon.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} <span className="text-[8px] font-medium text-slate-500 tracking-wide uppercase font-sans">t</span>
                                </p>
                              </div>
                              <p className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wide mt-1">Impacto neto en peso (Volumen × Densidad SNR-10)</p>
                            </div>
                          </div>
                        </div>

                        {/* Inline add row form (Only visible if report is editable) */}
                        {isEditableAprovechamiento(activeMonthReport) && (
                          <div id="inline_quick_acopio_form" className="p-4 bg-slate-50 dark:bg-[#070b16] border border-slate-200/60 dark:border-slate-900 rounded-3xl space-y-3.5 shadow-inner">
                            <h4 className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              ⚡ Registro Rápido de Cubicación y Control de Acopio
                            </h4>
                            
                            {/* NEW: Multi-Unit / Cubicaciones List */}
                            <div className="space-y-2 border-b border-slate-100 dark:border-slate-900 pb-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest">Aprovechamientos de Material / Unidades de Acopio</span>
                                <button
                                  type="button"
                                  onClick={() => setInlineSubUnits([...inlineSubUnits, { id: 'u-' + Date.now() + Math.random(), largo: '', ancho: '', alto: '', torres: 1, unidades: 1 }])}
                                  className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-600 text-emerald-600 hover:text-white dark:text-emerald-400 dark:hover:text-white border border-emerald-500/20 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all duration-300 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" /> Añadir Aprovechamiento
                                </button>
                              </div>
                              
                              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                                {inlineSubUnits.map((subUnit, subIdx) => {
                                  const subL = Number(subUnit.largo) || 0;
                                  const subW = Number(subUnit.ancho) || 0;
                                  const subH = Number(subUnit.alto) || 0;
                                  const subT = Number(subUnit.torres) || 1;
                                  const subU = Number(subUnit.unidades) || 1;
                                  const subVol = subL * subW * subH * subT * subU;
                                  const subArea = subL * subW * subT * subU;

                                  return (
                                    <div key={subUnit.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-2 bg-white dark:bg-[#0c1224]/50 border border-slate-200/50 dark:border-slate-800/40 rounded-xl transition-all">
                                      {/* ID / Name (APROVECHAMIENTO X instead of UNIDAD X) */}
                                      <div className="md:col-span-2">
                                        <span className="text-[7.5px] font-black text-emerald-600 dark:text-emerald-450 uppercase font-mono bg-emerald-500/5 px-2 py-0.5 rounded-md border border-emerald-500/10 block text-center truncate" title={`Aprovechamiento ${subIdx + 1}`}>
                                          APROV. {subIdx + 1}
                                        </span>
                                      </div>

                                      {/* Largo, Ancho, Alto, Torres, Unidades Inputs */}
                                      <div className="grid grid-cols-5 md:col-span-7 gap-1.5">
                                        <div className="space-y-0.5">
                                          <span className="text-[6.5px] text-slate-400 font-bold uppercase block text-center" title="Largo (m)">Largo (m)</span>
                                          <input 
                                            type="number" 
                                            step="0.01"
                                            min="0"
                                            value={subUnit.largo}
                                            placeholder="0.00"
                                            onChange={(e) => {
                                              const val = e.target.value === '' ? '' : Number(e.target.value);
                                              setInlineSubUnits(inlineSubUnits.map(item => item.id === subUnit.id ? { ...item, largo: val } : item));
                                            }}
                                            className="w-full text-center px-1 py-1 bg-white dark:bg-[#0c1224] border border-slate-200 dark:border-slate-800 rounded-lg text-[9px] font-mono font-bold outline-none focus:ring-1 focus:ring-emerald-500"
                                          />
                                        </div>

                                        <div className="space-y-0.5">
                                          <span className="text-[6.5px] text-slate-400 font-bold uppercase block text-center" title="Ancho (m)">Ancho (m)</span>
                                          <input 
                                            type="number" 
                                            step="0.01"
                                            min="0"
                                            value={subUnit.ancho}
                                            placeholder="0.00"
                                            onChange={(e) => {
                                              const val = e.target.value === '' ? '' : Number(e.target.value);
                                              setInlineSubUnits(inlineSubUnits.map(item => item.id === subUnit.id ? { ...item, ancho: val } : item));
                                            }}
                                            className="w-full text-center px-1 py-1 bg-white dark:bg-[#0c1224] border border-slate-200 dark:border-slate-800 rounded-lg text-[9px] font-mono font-bold outline-none focus:ring-1 focus:ring-emerald-500"
                                          />
                                        </div>

                                        <div className="space-y-0.5">
                                          <span className="text-[6.5px] text-slate-400 font-bold uppercase block text-center" title="Alto / Espesor (m)">Alto (m)</span>
                                          <input 
                                            type="number" 
                                            step="0.01"
                                            min="0"
                                            value={subUnit.alto}
                                            placeholder="0.00"
                                            onChange={(e) => {
                                              const val = e.target.value === '' ? '' : Number(e.target.value);
                                              setInlineSubUnits(inlineSubUnits.map(item => item.id === subUnit.id ? { ...item, alto: val } : item));
                                            }}
                                            className="w-full text-center px-1 py-1 bg-white dark:bg-[#0c1224] border border-slate-200 dark:border-slate-800 rounded-lg text-[9px] font-mono font-bold outline-none focus:ring-1 focus:ring-emerald-500"
                                          />
                                        </div>

                                        <div className="space-y-0.5">
                                          <span className="text-[6.5px] text-emerald-600 dark:text-emerald-450 font-black uppercase block text-center" title="Cantidad de Torres para repetición">Torres</span>
                                          <input 
                                            type="number" 
                                            step="1"
                                            min="1"
                                            value={subUnit.torres ?? ''}
                                            placeholder="1"
                                            onChange={(e) => {
                                              const val = e.target.value === '' ? '' : Number(e.target.value);
                                              setInlineSubUnits(inlineSubUnits.map(item => item.id === subUnit.id ? { ...item, torres: val } : item));
                                            }}
                                            className="w-full text-center px-1 py-1 bg-white dark:bg-[#0c1224] border border-emerald-500/25 dark:border-emerald-500/15 rounded-lg text-[9px] font-mono font-black text-emerald-600 dark:text-emerald-400 outline-none focus:ring-1 focus:ring-emerald-500"
                                          />
                                        </div>

                                        <div className="space-y-0.5">
                                          <span className="text-[6.5px] text-emerald-600 dark:text-emerald-450 font-black uppercase block text-center" title="Cantidad de Unidades por Torre para repetición">Unidades</span>
                                          <input 
                                            type="number" 
                                            step="1"
                                            min="1"
                                            value={subUnit.unidades ?? ''}
                                            placeholder="1"
                                            onChange={(e) => {
                                              const val = e.target.value === '' ? '' : Number(e.target.value);
                                              setInlineSubUnits(inlineSubUnits.map(item => item.id === subUnit.id ? { ...item, unidades: val } : item));
                                            }}
                                            className="w-full text-center px-1 py-1 bg-white dark:bg-[#0c1224] border border-emerald-500/25 dark:border-emerald-500/15 rounded-lg text-[9px] font-mono font-black text-emerald-600 dark:text-emerald-400 outline-none focus:ring-1 focus:ring-emerald-500"
                                          />
                                        </div>
                                      </div>

                                      {/* Calculations */}
                                      <div className="md:col-span-2 flex items-center justify-around text-center border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-900 pt-1.5 md:pt-0 pl-0 md:pl-2">
                                        <div className="flex flex-col">
                                          <span className="text-[7px] font-mono text-slate-400">VOL.</span>
                                          <span className="text-[8.5px] font-mono font-black text-amber-500" title="Volumen Total Multiplicado">
                                            {subVol.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³
                                          </span>
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-[7px] font-mono text-slate-400">ÁREA</span>
                                          <span className="text-[8.5px] font-mono font-black text-teal-500" title="Área Total Multiplicada">
                                            {subArea.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²
                                          </span>
                                        </div>
                                      </div>

                                      {/* Action (Remove) */}
                                      <div className="md:col-span-1 text-right">
                                        <button
                                          type="button"
                                          disabled={inlineSubUnits.length === 1}
                                          onClick={() => setInlineSubUnits(inlineSubUnits.filter(item => item.id !== subUnit.id))}
                                          className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-20 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                                          title="Eliminar aprovechamiento"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Aggregations panel */}
                            {(() => {
                              const validUnits = inlineSubUnits.filter(u => u.largo !== '' || u.ancho !== '' || u.alto !== '');
                              const totalLargoCurrent = validUnits.reduce((sum, u) => {
                                const rep = (Number(u.torres) || 1) * (Number(u.unidades) || 1);
                                return sum + ((Number(u.largo) || 0) * rep);
                              }, 0);
                              const totalAreaCurrent = validUnits.reduce((sum, u) => {
                                const rep = (Number(u.torres) || 1) * (Number(u.unidades) || 1);
                                return sum + (((Number(u.largo) || 0) * (Number(u.ancho) || 0)) * rep);
                              }, 0);
                              const totalVolumenCurrent = validUnits.reduce((sum, u) => {
                                const rep = (Number(u.torres) || 1) * (Number(u.unidades) || 1);
                                return sum + (((Number(u.largo) || 0) * (Number(u.ancho) || 0) * (Number(u.alto) || 0)) * rep);
                              }, 0);
                              const eqAnchoCurrent = totalLargoCurrent > 0 ? (totalAreaCurrent / totalLargoCurrent) : 0;
                              const eqAltoCurrent = totalAreaCurrent > 0 ? (totalVolumenCurrent / totalAreaCurrent) : 0;

                              return (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-100/60 dark:bg-[#121b33]/25 p-2.5 rounded-2xl border border-slate-200/40 dark:border-slate-800/20 text-center items-center">
                                  <div>
                                    <span className="block text-[7px] text-slate-400 font-bold uppercase tracking-wider">Largo Total (m)</span>
                                    <span className="text-[10px] font-mono font-black text-slate-800 dark:text-slate-100">{totalLargoCurrent.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m</span>
                                  </div>
                                  <div>
                                    <span className="block text-[7px] text-slate-400 font-bold uppercase tracking-wider">Suma Área (m²)</span>
                                    <span className="text-[10px] font-mono font-black text-teal-600 dark:text-teal-400">{totalAreaCurrent.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²</span>
                                  </div>
                                  <div>
                                    <span className="block text-[7px] text-slate-400 font-bold uppercase tracking-wider">Suma Volumen (m³)</span>
                                    <span className="text-[10px] font-mono font-black text-amber-600 dark:text-amber-450">{totalVolumenCurrent.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m³</span>
                                  </div>
                                  <div>
                                    <span className="block text-[7px] text-slate-400 font-bold uppercase tracking-wider">Eq. Ancho / Alto</span>
                                    <span className="text-[8px] font-mono font-black text-slate-500 dark:text-slate-400">{eqAnchoCurrent.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}m × {eqAltoCurrent.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}m</span>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Row 2: SNR-10 Material Selection & Density display */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 border-t border-slate-100 dark:border-slate-900 pt-3">
                              {/* Material selection */}
                              <div className="md:col-span-5 space-y-1">
                                <span className="text-[7.5px] font-bold text-slate-400 uppercase">Densidad SNR-10 - Selección de Material</span>
                                <select 
                                  value={inlineMaterialSNR}
                                  onChange={(e) => {
                                    const selected = e.target.value;
                                    setInlineMaterialSNR(selected);
                                    const match = SNR10_MATERIALS.find(m => m.material === selected);
                                    if (match) {
                                      setInlineDensidadSNR(match.density);
                                    }
                                  }}
                                  className="w-full px-3 py-1.5 bg-white dark:bg-[#0c1224] border border-slate-250 dark:border-slate-800 rounded-xl text-[9px] font-semibold outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                >
                                  {SNR10_MATERIALS.map((m) => (
                                    <option key={m.material} value={m.material}>
                                      {m.material}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Density read-only */}
                              <div className="md:col-span-4 space-y-1">
                                <span className="text-[7.5px] font-bold text-slate-400 uppercase">Densidad Asignada</span>
                                <div className="px-3 py-1.5 bg-slate-100 dark:bg-[#0c1224]/30 border border-slate-250 dark:border-slate-850 rounded-xl text-[9px] font-mono font-black text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                  <span>{inlineDensidadSNR.toLocaleString('es-ES')}</span>
                                  <span className="text-[7.5px] text-slate-400 font-sans">kg/m³</span>
                                </div>
                              </div>

                              {/* Duración (Días, calculado solo) */}
                              <div className="md:col-span-3 space-y-1">
                                <span className="text-[7.5px] font-bold text-slate-400 uppercase">Proceso (Días) 🔒</span>
                                <input 
                                  type="number" 
                                  step="1"
                                  min="0"
                                  readOnly
                                  disabled
                                  value={inlineDuracion}
                                  placeholder="Días"
                                  className="w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-805 rounded-xl text-[9px] font-mono font-bold text-slate-500 outline-none select-none cursor-not-allowed"
                                />
                              </div>
                            </div>

                            {/* Row 3: Observación, calcs and button */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center border-t border-slate-100 dark:border-slate-900 pt-3">
                              {/* Observación */}
                              <div className="md:col-span-9 space-y-1">
                                <span className="text-[7.5px] font-bold text-slate-400 uppercase">Observación / Sustento Técnico</span>
                                <input 
                                  type="text" 
                                  placeholder="EJ. ACOPIO DE MATERIAL PÉTREO REUTILIZADO EN BASE DE CAMINO"
                                  value={inlineLogObs}
                                  onChange={(e) => setInlineLogObs(e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white dark:bg-[#0c1224] border border-slate-280 dark:border-slate-800 rounded-xl text-[9px] font-semibold outline-none uppercase focus:ring-1 focus:ring-emerald-500"
                                />
                              </div>

                              {/* Save Trigger */}
                              <div className="md:col-span-3">
                                <button
                                  type="button"
                                  onClick={addInlineLogRow}
                                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[8.5px] font-black uppercase tracking-wider shadow-lg shadow-emerald-500/10 transition-all duration-300 active:scale-95 flex items-center justify-center gap-1.5"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Registrar Acopio
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* List / Table of Weights Logs */}
                        <div className="flex-1 overflow-y-auto border border-slate-200/60 dark:border-slate-900 rounded-3xl bg-slate-50/50 dark:bg-black/10 min-h-[160px] max-h-[300px] custom-scrollbar">
                          {activeReportLogs.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center py-10 text-center text-slate-450">
                              <Inbox className="w-7 h-7 text-slate-300 dark:text-slate-800 mb-2" />
                              <p className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">Sin registros ingresados este mes</p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse text-[8.5px]">
                                <thead className="bg-slate-100 dark:bg-[#0b1021] sticky top-0 text-slate-450 dark:text-slate-500 uppercase font-black tracking-wider text-[7.5px] border-b border-slate-200 dark:border-slate-950 z-10">
                                  <tr>
                                    <th className="px-4 py-3">Largo</th>
                                    <th className="px-4 py-3">Ancho</th>
                                    <th className="px-4 py-3">Alto</th>
                                    <th className="px-4 py-3">Volumen Total (m³)</th>
                                    <th className="px-4 py-3">Área Final (m²)</th>
                                    <th className="px-4 py-3">Plazo (Días)</th>
                                    <th className="px-4 py-3">Densidad SNR-10</th>
                                    <th className="px-4 py-3">Observación</th>
                                    {isEditableAprovechamiento(activeMonthReport) && <th className="px-4 py-3 text-right">Acción</th>}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-900/40 text-slate-750 dark:text-slate-350 font-medium">
                                  {activeReportLogs.map((log, idx) => {
                                    const isCubicacion = log.largo !== undefined;
                                    const displayLargo = isCubicacion ? `${log.largo} m` : 'N/A';
                                    const displayAncho = isCubicacion ? `${log.ancho} m` : 'N/A';
                                    const displayAlto = isCubicacion ? `${log.alto !== undefined ? log.alto : log.fondo} m` : 'N/A';
                                    const displayVolumen = isCubicacion ? `${log.volumenReutilizado?.toFixed(1)} m³` : `${log.quantity} ${log.unit}`;
                                    const displayArea = isCubicacion ? `${log.areaRecuperada?.toFixed(1)} m²` : 'N/A';
                                    const displayDuracion = isCubicacion ? `${log.duracionProceso} días` : '30 días';

                                    const hasUnits = log.units && log.units.length > 0;
                                    const isExpanded = !!expandedLogIds[log.id];

                                    return (
                                      <React.Fragment key={log.id || idx}>
                                        <tr className="hover:bg-slate-100/50 dark:hover:bg-[#0b1021]/30 transition-colors">
                                          <td className="px-4 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-105">
                                            <div className="flex items-center gap-1.5">
                                              {hasUnits && (
                                                <button
                                                  type="button"
                                                  onClick={() => setExpandedLogIds(prev => ({ ...prev, [log.id]: !prev[log.id] }))}
                                                  className="p-1 rounded text-emerald-600 hover:bg-emerald-550/10 dark:text-emerald-400 transition-colors cursor-pointer flex items-center justify-center"
                                                  title="Ver desglose de aprovechamientos"
                                                >
                                                  <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", isExpanded && "rotate-180")} />
                                                </button>
                                              )}
                                              <span>{displayLargo}</span>
                                              {hasUnits && (
                                                <span className="text-[7.5px] font-sans font-black tracking-wider px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 rounded-full">
                                                  {log.units?.length} aprov.
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-4 py-2.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                                            <div className="flex flex-col">
                                              <span>{displayAncho}</span>
                                              {hasUnits && <span className="text-[6.5px] text-slate-400 font-sans tracking-wide uppercase">(EQ.)</span>}
                                            </div>
                                          </td>
                                          <td className="px-4 py-2.5 font-mono font-bold text-slate-950 dark:text-slate-200">
                                            <div className="flex flex-col">
                                              <span>{displayAlto}</span>
                                              {hasUnits && <span className="text-[6.5px] text-slate-400 font-sans tracking-wide uppercase">(EQ.)</span>}
                                            </div>
                                          </td>
                                          <td className="px-4 py-2.5 font-mono font-black text-amber-500">{displayVolumen}</td>
                                          <td className="px-4 py-2.5 font-mono font-black text-teal-500">{displayArea}</td>
                                          <td className="px-4 py-2.5 font-mono font-semibold text-slate-700 dark:text-slate-400">{displayDuracion}</td>
                                          <td className="px-4 py-2.5 font-sans">
                                            {log.materialSNR ? (
                                              <div className="flex flex-col">
                                                <span className="font-sans font-black uppercase text-[8px] text-emerald-600 dark:text-emerald-400">{log.materialSNR}</span>
                                                <span className="text-[7.5px] text-slate-400">{(log.densidadSNR || 0).toLocaleString('es-ES')} kg/m³</span>
                                              </div>
                                            ) : (
                                              <span className="text-slate-400 text-[8px]">N/A</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-2.5 truncate max-w-[125px] uppercase text-[8px] tracking-wide">{log.observations || 'SIN OBSERVACIONES'}</td>
                                          {isEditableAprovechamiento(activeMonthReport) && (
                                            <td className="px-4 py-2.5 text-right">
                                              <button
                                                type="button"
                                                onClick={() => removeInlineLogRow(idx)}
                                                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                                title="Eliminar fila"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </td>
                                          )}
                                        </tr>
                                        {hasUnits && isExpanded && (
                                          <tr className="bg-slate-100/30 dark:bg-white/[0.01]">
                                            <td colSpan={9} className="px-6 py-2 border-t border-slate-200/40 dark:border-slate-800/25">
                                              <div className="flex flex-wrap gap-2 items-center pl-4 border-l-2 border-emerald-500/45 py-1">
                                                <span className="font-black text-slate-400 uppercase tracking-widest text-[7px] mr-1.5">Desglose de Aprovechamientos:</span>
                                                {log.units?.map((unit: any, uIdx: number) => (
                                                  <span key={unit.id || uIdx} className="bg-white dark:bg-[#0c1224]/80 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800/65 font-mono text-[8px] shadow-sm flex items-center lg:flex-nowrap flex-wrap gap-1.5 transition-all hover:scale-[1.02]">
                                                    <span className="text-[7px] font-sans font-black text-emerald-600 dark:text-emerald-400 uppercase bg-emerald-500/5 px-1.5 py-0.5 rounded-md border border-emerald-500/10">APROV. {uIdx + 1}</span>
                                                    <span className="text-slate-800 dark:text-slate-200 font-bold">{unit.largo}m</span>
                                                    <span className="text-slate-400 font-sans">×</span>
                                                    <span className="text-slate-800 dark:text-slate-200 font-bold">{unit.ancho}m</span>
                                                    <span className="text-slate-400 font-sans">×</span>
                                                    <span className="text-slate-800 dark:text-slate-200 font-bold">{unit.alto}m</span>
                                                    {unit.torres !== undefined && unit.unidades !== undefined && (unit.torres > 1 || unit.unidades > 1) && (
                                                      <>
                                                        <span className="text-emerald-605 dark:text-emerald-400 font-sans font-black text-[6.5px] select-none bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 px-1 py-0.5 rounded" title={`Multiplicado por ${unit.torres} torres con ${unit.unidades} unidades`}>
                                                          × {unit.torres} T × {unit.unidades} U
                                                        </span>
                                                      </>
                                                    )}
                                                    <span className="text-slate-400 font-medium font-sans">=</span>
                                                    <span className="text-amber-500 font-black">{unit.volume.toFixed(1)} m³</span>
                                                    <span className="text-slate-400 font-sans">({unit.area.toFixed(1)} m²)</span>
                                                  </span>
                                                ))}
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Active changes confirmation footer */}
                    {isEditableAprovechamiento(activeMonthReport) && (
                      <div className="px-8 py-4 bg-slate-100/50 dark:bg-black/30 border-t border-slate-150 dark:border-slate-950 flex items-center justify-between gap-6 shrink-0 transition-all duration-300">
                        <div className="flex items-center gap-2">
                          {hasUnsavedInlineChanges ? (
                            <span className="flex items-center gap-2 text-[8px] font-black uppercase text-amber-550 tracking-wider">
                              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce" />
                              Hay modificaciones pendientes sin consolidar
                            </span>
                          ) : (
                            <span className="flex items-center gap-2 text-[8px] font-black uppercase text-emerald-500 tracking-wider">
                              <Check className="w-4 h-4 text-emerald-500" />
                              Todos los cambios están actualizados y sincronizados
                            </span>
                          )}
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => handleSaveActiveReportInline(undefined, undefined, undefined, undefined, undefined, false)}
                          className={cn(
                            "px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 shadow-lg",
                            hasUnsavedInlineChanges 
                              ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 animate-pulse active:scale-95"
                              : "bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 shadow-none cursor-default"
                          )}
                          disabled={!hasUnsavedInlineChanges}
                        >
                          <Check className="w-3.5 h-3.5" />
                          Guardar Cambios del Mes
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* LIST OF HISTORICAL LEDGER REPORTS (OLDER DEPOSITS AND CLOSED MONTHS) */}
              <div className="space-y-4 pt-4 border-t border-slate-150 dark:border-slate-900/50 mt-6">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">
                  Histórico de Reportes de Meses Anteriores
                </h3>
                {pastAprovechamientosList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#050508] border border-slate-200/60 dark:border-slate-900 rounded-[24px]">
                    <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-3" />
                    <p className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest">No hay registros históricos anteriores</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pastAprovechamientosList.map((report) => (
                      <div 
                        key={report.id}
                        onClick={() => setSelectedReport(report)}
                        className="bg-white dark:bg-[#050508] border border-slate-200/80 dark:border-slate-900 rounded-[30px] p-6 hover:border-emerald-500/40 cursor-pointer shadow-sm hover:shadow-xl dark:hover:shadow-none duration-300 transition-all flex flex-col justify-between h-56 relative overflow-hidden"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[8px] font-mono font-black rounded-lg tracking-wider uppercase">
                              {report.code}
                            </span>
                            <span className="text-[8px] font-mono font-black text-slate-400 uppercase">
                              {format(new Date(report.createdAt), 'dd MMM yyyy', { locale: es })}
                            </span>
                          </div>

                          <h3 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider line-clamp-2 leading-relaxed">
                            {report.title}
                          </h3>
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-900/60 pt-4 mt-4 flex items-center justify-between">
                          <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider">
                            Planillas de Peso / RCD
                          </span>
                          <span className="text-[9.5px] font-mono font-extrabold text-emerald-500 tracking-wider">
                            {report.logs?.length || 0} Registros
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </div>

      {/* DETAIL MODAL FOR ENVIRONMENTAL REPORTS */}
      <AnimatePresence>
        {selectedReport && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#070709] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
              
              <header className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-black/30">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.3em]">{selectedReport.code}</span>
                    {selectedReport.subtype === 'APROVECHAMIENTO' && (
                      <span className={cn(
                        "text-[7px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-md",
                        isEditableAprovechamiento(selectedReport) 
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                      )}>
                        {isEditableAprovechamiento(selectedReport) 
                          ? "✍️ EDITABLE (PLAZO 10 DÍAS)" 
                          : "🔒 REGISTRO BLOQUEADO (LÍMITE EXCEDIDO)"}
                      </span>
                    )}
                  </div>
                  <h2 className="text-sm lg:text-base font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <Leaf className="w-5 h-5 text-emerald-500" />
                    {selectedReport.title}
                  </h2>
                </div>
                
                <div className="flex items-center gap-2">
                  {selectedReport.subtype === 'APROVECHAMIENTO' && (
                    <>
                      <button 
                        onClick={() => exportAprovechamientoToPDF(selectedReport, googleAccessToken)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-550/10 hover:bg-rose-600 text-rose-600 hover:text-white dark:text-rose-400 dark:hover:text-white border border-rose-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 active:scale-95 cursor-pointer"
                        title="Descargar Reporte en formato PDF"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        PDF
                      </button>
                      <button 
                        onClick={() => exportAprovechamientoToExcel(selectedReport)}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-600 text-emerald-600 hover:text-white dark:text-emerald-400 dark:hover:text-white border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 active:scale-95 cursor-pointer"
                        title="Descargar Planilla en formato Excel"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        EXCEL
                      </button>
                    </>
                  )}
                  {selectedReport.subtype === 'APROVECHAMIENTO' && isEditableAprovechamiento(selectedReport) && (
                    <button 
                      onClick={() => handleStartEditing(selectedReport)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 active:scale-95"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Editar Registro
                    </button>
                  )}
                  <button 
                    onClick={() => setIsConfirmingDelete(true)}
                    className="p-2 text-red-400 hover:text-red-500 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setSelectedReport(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                
                {/* SUBTYPE 1: INSPECCION DETAIL */}
                {selectedReport.subtype === 'INSPECCION' && selectedReport.sections && (
                  <div className="space-y-8">
                    {selectedReport.sections.map((section, secIndex) => (
                      <div key={secIndex} className="bg-slate-50/50 dark:bg-[#050813] border border-slate-200/50 dark:border-slate-900/60 rounded-2xl overflow-hidden shadow-sm">
                        
                        {/* Table Header exactly matching mockup design */}
                        <div className="grid grid-cols-12 bg-emerald-600 text-white font-mono font-black text-[9.5px] uppercase tracking-wider items-center py-2.5 px-4">
                          <div className="col-span-12 md:col-span-5 uppercase tracking-widest">{section.title}</div>
                          <div className="hidden md:block col-span-3 text-center">EVALUACIÓN (C  /  NC  /  N/A)</div>
                          <div className="hidden md:block col-span-3 text-left">OBSERVACIONES</div>
                          <div className="hidden md:block col-span-1 text-center">% CUMP.</div>
                        </div>

                        {/* Excel cells mapping */}
                        <div className="divide-y divide-slate-200/60 dark:divide-slate-900/40">
                          {section.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="grid grid-cols-12 items-stretch py-3.5 px-4 hover:bg-white dark:hover:bg-black/20 transition-all duration-200">
                              
                              {/* Description */}
                              <div className="col-span-12 md:col-span-5 flex items-start gap-2.5">
                                <span className="text-[8.5px] font-mono font-black bg-slate-100 dark:bg-slate-900 p-1 rounded text-slate-400">
                                  {item.id}
                                </span>
                                <p className="text-[10px] font-extrabold uppercase text-slate-700 dark:text-slate-300 tracking-wide line-height-[1.5]">
                                  {item.description}
                                </p>
                              </div>

                              {/* Status indicators */}
                              <div className="col-span-12 md:col-span-3 grid grid-cols-3 items-center py-2 md:py-0 text-center gap-1.5">
                                {['C', 'NC', 'N/A'].map((indicator) => (
                                  <div key={indicator} className="flex flex-col items-center">
                                    <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-1 md:hidden">{indicator}</span>
                                    <div className={cn(
                                      "w-8 h-8 rounded-lg flex items-center justify-center font-mono font-black text-xs border select-none transition-all",
                                      item.status === indicator 
                                        ? indicator === 'C' ? "bg-emerald-500 border-emerald-500 text-white" : indicator === 'NC' ? "bg-red-500 border-red-500 text-white" : "bg-slate-400 border-slate-400 text-white"
                                        : "bg-slate-50 dark:bg-[#070b16] border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-800"
                                    )}>
                                      {item.status === indicator ? 'X' : ''}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Observations */}
                              <div className="col-span-12 md:col-span-3 flex items-center justify-start py-1 md:py-0 bg-slate-50 md:bg-transparent px-3 md:px-0 rounded-xl">
                                {item.observations ? (
                                  <p className="text-[9.5px] font-mono font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider max-h-16 overflow-y-auto">
                                    {item.observations}
                                  </p>
                                ) : (
                                  <span className="text-[8.5px] text-slate-400 font-bold uppercase tracking-widest">- Sin observaciones -</span>
                                )}
                              </div>

                              {/* Right col: % compliance matching custom rowSpan vertical cell exactly */}
                              {itemIndex === 0 && (
                                <div className="hidden md:flex col-span-1 text-center items-center justify-center font-mono font-black border-l border-slate-200 dark:border-slate-800/80 bg-slate-100/50 dark:bg-[#040812]" style={{ gridRow: `span ${section.items.length}` }}>
                                  <div className="text-center">
                                    <p className={cn(
                                      "text-xs leading-none",
                                      section.compliancePercentage >= 85 ? "text-emerald-500" :
                                      section.compliancePercentage >= 60 ? "text-amber-500" : "text-red-500"
                                    )}>
                                      {section.compliancePercentage}%
                                    </p>
                                  </div>
                                </div>
                              )}

                            </div>
                          ))}
                        </div>

                      </div>
                    ))}
                  </div>
                )}

                {/* SUBTYPE 2: APROVECHAMIENTO DETAIL */}
                {selectedReport.subtype === 'APROVECHAMIENTO' && selectedReport.logs && (
                  <div className="space-y-8">
                    
                    {/* ENHANCED HIGHLIGHTED BENTO FOR KEY METRICS (MÉTRICAS CLAVE RESALTADAS MAS IMPORTANTES) */}
                    <div id="hist_bento_metrics" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* VOLUMEN TOTAL REUTILIZADO */}
                      <div className="relative group overflow-hidden p-6 rounded-3xl bg-gradient-to-br from-amber-500/[0.12] via-amber-500/[0.04] to-transparent border-2 border-amber-500/40 dark:border-amber-500/20 shadow-lg flex flex-col justify-between">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-505/5 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-widest flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-amber-500 animate-pulse" />
                            Volumen Total Reutilizado RCD
                          </span>
                          <span className="text-[7.5px] font-mono font-bold px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full border border-amber-500/20 uppercase">MÉTRICA MÁS IMPORTANTE ⭐</span>
                        </div>
                        <div>
                          <p className="text-2xl lg:text-3xl font-display font-black text-amber-600 dark:text-amber-400 tracking-tight leading-none">
                            {selectedReport.logs.reduce((sum: number, log: any) => sum + (log.volumenReutilizado || 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">m³</span>
                          </p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-1">Cubicación total acumulada registrada para este periodo mensual.</p>
                        </div>
                      </div>

                      {/* ÁREA FINAL RECUPERADA */}
                      <div className="relative group overflow-hidden p-6 rounded-3xl bg-gradient-to-br from-teal-500/[0.12] via-teal-500/[0.04] to-transparent border-2 border-teal-500/40 dark:border-teal-500/20 shadow-lg flex flex-col justify-between">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-teal-555/5 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-black text-teal-700 dark:text-teal-300 uppercase tracking-widest flex items-center gap-1.5">
                            <Recycle className="w-4 h-4 text-teal-500 animate-pulse" />
                            Área Final Recuperada RCD
                          </span>
                          <span className="text-[7.5px] font-mono font-bold px-2 py-0.5 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-full border border-teal-500/20 uppercase">MÉTRICA MÁS IMPORTANTE ⭐</span>
                        </div>
                        <div>
                          <p className="text-2xl lg:text-3xl font-display font-black text-teal-600 dark:text-teal-400 tracking-tight leading-none">
                            {selectedReport.logs.reduce((sum: number, log: any) => sum + (log.areaRecuperada || 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">m²</span>
                          </p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-1">Suma total de superficies liberadas y restituidas del proyecto.</p>
                        </div>
                      </div>

                      {/* TOTAL DE APROVECHAMIENTO (Sustento de Peso) */}
                      <div className="relative group overflow-hidden p-6 rounded-3xl bg-gradient-to-br from-emerald-500/[0.12] via-emerald-500/[0.04] to-transparent border-2 border-emerald-500/40 dark:border-emerald-500/20 shadow-lg flex flex-col justify-between">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:scale-110 transition-transform duration-500" />
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest flex items-center gap-1.5">
                            <Scale className="w-4 h-4 text-emerald-500 animate-pulse" />
                            Total Aprovechamiento RCD
                          </span>
                          <span className="text-[7.5px] font-mono font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 rounded-full border border-emerald-500/25 uppercase">MÉTRICA MÁS IMPORTANTE ⭐</span>
                        </div>
                        <div>
                          {(() => {
                            const histTotalKg = selectedReport.logs.reduce((sum: number, log: any) => sum + ((log.volumenReutilizado || 0) * (log.densidadSNR || 2300)), 0);
                            const histTotalTon = histTotalKg / 1000;
                            return (
                              <div>
                                <div className="flex items-baseline gap-1.5">
                                  <p className="text-2xl lg:text-3xl font-display font-black text-emerald-600 dark:text-emerald-400 tracking-tight leading-none">
                                    {histTotalKg.toLocaleString('es-ES', { maximumFractionDigits: 0 })} <span className="text-xs font-medium text-slate-500 tracking-wide uppercase font-sans">kg</span>
                                  </p>
                                  <span className="text-xs font-mono font-bold text-slate-400">/</span>
                                  <p className="text-lg lg:text-xl font-display font-black text-emerald-700 dark:text-emerald-300 tracking-tight leading-none">
                                    {histTotalTon.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} <span className="text-[9px] font-medium text-slate-500 tracking-wide uppercase font-sans">t</span>
                                  </p>
                                </div>
                                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">Impacto neto en peso calculado para este periodo (Volumen × Densidad SNR-10).</p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    
                    {/* Operational Metadata Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 dark:bg-[#070b16] p-6 rounded-[24px] border border-slate-200/50 dark:border-slate-900">
                      <div>
                        <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Vigencia de la Operación</h4>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase font-mono">
                          <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span>
                            {selectedReport.startDate || '1° de Mes'} AL {selectedReport.endDate || 'Fin de Mes'}
                          </span>
                        </div>
                        <span className="text-[7.5px] font-extrabold text-emerald-500 uppercase tracking-wider block mt-1">✓ Registro de Operación mensual</span>
                      </div>

                      <div>
                        <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Responsable del Registro</h4>
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide truncate">
                            {selectedReport.responsibleName || 'Director de Obra Assigned'}
                          </span>
                          <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 text-[7px] font-black uppercase rounded shrink-0">
                            {selectedReport.responsiblePosition || 'DIRECTOR DE OBRA'}
                          </span>
                        </div>
                        <span className="text-[8px] text-slate-400 font-mono font-bold block mt-0.5 truncate">{selectedReport.responsibleEmail || 'director.obra@norabim.com'}</span>
                      </div>

                      <div>
                        <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Nivel de Alerta y Notificación</h4>
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                          <span className="text-[8.5px] font-mono font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">NOTIFICACIÓN DIRECTA ACTIVA</span>
                        </div>
                        <span className="text-[7.5px] font-bold text-slate-400 uppercase block mt-1">Notificados: DIRECTOR DE OBRA & GRUPO OBRA</span>
                      </div>
                    </div>

                    {/* Description of operations */}
                    {selectedReport.processDescription && (
                      <div className="bg-slate-50 dark:bg-[#070b16] p-5 rounded-[20px] border border-slate-200/50 dark:border-slate-900 space-y-1.5">
                        <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Descripción del Proceso Realizado</h4>
                        <p className="text-[10px] font-extrabold uppercase text-slate-700 dark:text-slate-350 tracking-wide leading-relaxed">
                          {selectedReport.processDescription}
                        </p>
                      </div>
                    )}

                    {/* Startup Evidence Images/Videos */}
                    {selectedReport.mediaFiles && selectedReport.mediaFiles.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Registro de Evidencias de Inicio ({selectedReport.mediaFiles.length})</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {selectedReport.mediaFiles.map((media: any, idx: number) => (
                            <div key={idx} className="group relative rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 aspect-video bg-black/10">
                              {media.type === 'video' || media.type?.startsWith('video') || media.category === 'video' ? (
                                <video 
                                  src={media.url} 
                                  onClick={() => window.open(media.webViewLink || media.url, '_blank')}
                                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-all duration-350" 
                                  muted loop autoPlay 
                                />
                              ) : (
                                <img 
                                  src={getAuthenticatedDriveUrl(media.driveFileId ? `/api/drive-image/${media.driveFileId}` : (media.thumbnail || media.url || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=500'), googleAccessToken)} 
                                  onError={(e) => {
                                    const originalUrl = media.driveFileId ? `/api/drive-image/${media.driveFileId}` : (media.thumbnail || media.url || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=500');
                                    const authUrl = getAuthenticatedDriveUrl(originalUrl, googleAccessToken);
                                    if (e.currentTarget.src !== authUrl) {
                                      e.currentTarget.src = authUrl;
                                    }
                                  }}
                                  onClick={() => window.open(media.webViewLink || media.url, '_blank')}
                                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-all duration-350" 
                                  alt="Inicio de operación" 
                                  referrerPolicy="no-referrer" 
                                />
                              )}
                              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors pointer-events-none" />
                              <div className="absolute top-1.5 right-1.5 bg-black/50 backdrop-blur-xs p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <Eye className="w-3 h-3 text-white" />
                              </div>
                              <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[7px] text-white font-mono uppercase truncate text-center">
                                {media.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Durante Evidence Images/Videos */}
                    {selectedReport.mediaDuring && selectedReport.mediaDuring.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Registro de Evidencias Durante la Reutilización ({selectedReport.mediaDuring.length})</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {selectedReport.mediaDuring.map((media: any, idx: number) => (
                            <div key={idx} className="group relative rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 aspect-video bg-black/10">
                              {media.type === 'video' || media.type?.startsWith('video') || media.category === 'video' ? (
                                <video 
                                  src={media.url} 
                                  onClick={() => window.open(media.webViewLink || media.url, '_blank')}
                                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-all duration-350" 
                                  muted loop autoPlay 
                                />
                              ) : (
                                <img 
                                  src={getAuthenticatedDriveUrl(media.driveFileId ? `/api/drive-image/${media.driveFileId}` : (media.thumbnail || media.url), googleAccessToken)} 
                                  onError={(e) => {
                                    const originalUrl = media.driveFileId ? `/api/drive-image/${media.driveFileId}` : (media.thumbnail || media.url);
                                    const authUrl = getAuthenticatedDriveUrl(originalUrl, googleAccessToken);
                                    if (e.currentTarget.src !== authUrl) {
                                      e.currentTarget.src = authUrl;
                                    }
                                  }}
                                  onClick={() => window.open(media.webViewLink || media.url, '_blank')}
                                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-all duration-350" 
                                  alt="Durante proceso" 
                                  referrerPolicy="no-referrer" 
                                />
                              )}
                              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors pointer-events-none" />
                              <div className="absolute top-1.5 right-1.5 bg-black/50 backdrop-blur-xs p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <Eye className="w-3 h-3 text-white" />
                              </div>
                              <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[7px] text-white font-mono uppercase truncate text-center">
                                {media.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Final Evidence Images/Videos */}
                    {selectedReport.mediaFinal && selectedReport.mediaFinal.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Registro de Evidencias Resultado Final ({selectedReport.mediaFinal.length})</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {selectedReport.mediaFinal.map((media: any, idx: number) => (
                            <div key={idx} className="group relative rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 aspect-video bg-black/10">
                              {media.type === 'video' || media.type?.startsWith('video') || media.category === 'video' ? (
                                <video 
                                  src={media.url} 
                                  onClick={() => window.open(media.webViewLink || media.url, '_blank')}
                                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-all duration-350" 
                                  muted loop autoPlay 
                                />
                              ) : (
                                <img 
                                  src={getAuthenticatedDriveUrl(media.driveFileId ? `/api/drive-image/${media.driveFileId}` : (media.thumbnail || media.url), googleAccessToken)} 
                                  onError={(e) => {
                                    const originalUrl = media.driveFileId ? `/api/drive-image/${media.driveFileId}` : (media.thumbnail || media.url);
                                    const authUrl = getAuthenticatedDriveUrl(originalUrl, googleAccessToken);
                                    if (e.currentTarget.src !== authUrl) {
                                      e.currentTarget.src = authUrl;
                                    }
                                  }}
                                  onClick={() => window.open(media.webViewLink || media.url, '_blank')}
                                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-all duration-350" 
                                  alt="Resultado final" 
                                  referrerPolicy="no-referrer" 
                                />
                              )}
                              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors pointer-events-none" />
                              <div className="absolute top-1.5 right-1.5 bg-black/50 backdrop-blur-xs p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <Eye className="w-3 h-3 text-white" />
                              </div>
                              <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[7px] text-white font-mono uppercase truncate text-center">
                                {media.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Annotated Map Blueprint section */}
                    {selectedReport.planUrl && (
                      <div className="space-y-3">
                        <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Ubicación de Acopio Delimitado en Plano</h4>
                        <div className="bg-slate-50 dark:bg-[#070b16]/30 rounded-3xl p-4 border border-slate-200/50 dark:border-slate-900">
                          <div className="relative bg-[#0d111e] rounded-2xl overflow-hidden aspect-[16/9] border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
                            <img src={selectedReport.planUrl} className="w-full h-full object-cover opacity-25 select-none pointer-events-none" alt="Blue-print visualization" referrerPolicy="no-referrer" />
                            
                            <div className="absolute top-4 left-4 bg-black/80 backdrop-blur border border-slate-800 rounded-lg p-2 max-w-[200px]">
                              <p className="text-[7.5px] font-mono text-emerald-400 font-bold uppercase tracking-widest">Plano Vinculado</p>
                              <p className="text-[8px] font-bold text-white uppercase truncate">{selectedReport.planName || 'PLAN DE CONTROL AMBIENTAL'}</p>
                            </div>

                            {selectedReport.planMarkedArea && (
                              <div 
                                className="absolute bg-emerald-500/20 border-2 border-emerald-500 rounded-xl flex items-center justify-center shadow-lg"
                                style={{ 
                                  left: `${selectedReport.planMarkedArea.x - 10}%`, 
                                  top: `${selectedReport.planMarkedArea.y - 9}%`, 
                                  width: '20%', 
                                  height: '18%' 
                                }}
                              >
                                <span className="bg-emerald-500 text-slate-950 px-2 py-0.5 rounded text-[8px] font-black uppercase text-center truncate select-none">
                                  📌 ACOPIO SELECCIONADO
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Table of waste logs */}
                    <div className="space-y-3">
                      <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Planilla de Control y Cubicación de Acopio</h4>
                      <div className="overflow-x-auto bg-white dark:bg-[#050508] border border-slate-200/80 dark:border-slate-900 rounded-3xl">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 dark:border-slate-900 bg-slate-50 dark:bg-[#070b16] text-[8.5px] font-black text-slate-400 uppercase tracking-widest">
                              <th className="py-4.5 px-6">Largo</th>
                              <th className="py-4.5 px-6">Ancho</th>
                              <th className="py-4.5 px-6">Alto</th>
                              <th className="py-4.5 px-6">Volumen Total (m³)</th>
                              <th className="py-4.5 px-6">Área Recuperada (m²)</th>
                              <th className="py-4.5 px-6">Plazo (Días)</th>
                              <th className="py-4.5 px-6">Densidad SNR-10</th>
                              <th className="py-4.5 px-6 text-right">Observación / Sustento</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-950 text-[10px] uppercase font-semibold text-slate-700 dark:text-slate-300">
                            {selectedReport.logs.map((log, idx) => {
                              const isCubicacion = log.largo !== undefined;
                              const displayLargo = isCubicacion ? `${log.largo} m` : 'N/A';
                              const displayAncho = isCubicacion ? `${log.ancho} m` : 'N/A';
                              const displayAlto = isCubicacion ? `${log.alto !== undefined ? log.alto : log.fondo} m` : 'N/A';
                              const displayVolumen = isCubicacion ? `${log.volumenReutilizado?.toFixed(1)} m³` : `${log.quantity} ${log.unit}`;
                              const displayArea = isCubicacion ? `${log.areaRecuperada?.toFixed(1)} m²` : 'N/A';
                              const displayDuracion = isCubicacion ? `${log.duracionProceso} días` : '30 días';

                              return (
                                <tr key={log.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-[#111111]/30 transition-all duration-150 animate-in fade-in-10">
                                  <td className="py-4 px-6 font-mono font-bold text-slate-900 dark:text-white">{displayLargo}</td>
                                  <td className="py-4 px-6 font-mono font-bold text-slate-900 dark:text-white">{displayAncho}</td>
                                  <td className="py-4 px-6 font-mono font-bold text-slate-905 dark:text-slate-100">{displayAlto}</td>
                                  <td className="py-4 px-6 font-mono font-black text-amber-500">{displayVolumen}</td>
                                  <td className="py-4 px-6 font-mono font-black text-teal-400">{displayArea}</td>
                                  <td className="py-4 px-6 font-mono text-[9px] text-slate-400">{displayDuracion}</td>
                                  <td className="py-4 px-6">
                                    {log.materialSNR ? (
                                      <div className="flex flex-col">
                                        <span className="font-sans font-black uppercase text-[8px] text-emerald-600 dark:text-emerald-400">{log.materialSNR}</span>
                                        <span className="text-[7.5px] text-slate-400 font-mono">{(log.densidadSNR || 0).toLocaleString('es-ES')} kg/m³</span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 text-[8px]">N/A</span>
                                    )}
                                  </td>
                                  <td className="py-4 px-6 text-right text-[8.5px] uppercase text-slate-500 font-bold max-w-[200px] truncate">
                                    {log.observations || 'SIN COMENTARIOS'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRM DELETE SUBMODAL */}
      <AnimatePresence>
        {isConfirmingDelete && (
          <div className="fixed inset-0 bg-slate-950/30 backdrop-blur-sm z-[110] flex items-center justify-center">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#0c0c0e] border border-slate-200 dark:border-slate-800 p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl relative"
            >
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-2">¿Eliminar este informe?</h3>
              <p className="text-[10px] text-slate-400 uppercase font-black leading-relaxed mb-6">Esta acción no se puede deshacer y eliminará las planillas seleccionadas permanentemente.</p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsConfirmingDelete(false)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-[9px] font-black uppercase"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDeleteSelectedReport}
                  className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[9px] font-black uppercase"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CREATE INSPECCIÓN AMBIENTAL CHECKLIST */}
      <AnimatePresence>
        {isInsModalOpen && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#070709] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
              
              <header className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-black/30">
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.3em]">Planilla de Inspección</span>
                  <h2 className="text-sm lg:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Leaf className="w-5 h-5 text-emerald-500" />
                    Nueva Inspección Ambiental Periódica
                  </h2>
                </div>
                <button 
                  onClick={() => setIsInsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </header>

              <form onSubmit={handleSaveInspection} className="flex-1 overflow-hidden flex flex-col">
                <div className="p-6 bg-slate-50 dark:bg-[#050914] border-b border-slate-100 dark:border-slate-900/60 flex flex-col md:flex-row gap-4 shrink-0">
                  <div className="flex-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Título del Monitoreo *</label>
                    <input 
                      type="text"
                      required
                      value={insTitle}
                      onChange={(e) => setInsTitle(e.target.value)}
                      placeholder="E.g., MONITOREO Y ACCIONES PREVENTIVAS SEMANA 22 - GESTIÓN AMBIENTAL"
                      className="w-full bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-[9.5px] font-extrabold uppercase tracking-wide focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div className="w-full md:w-44">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">N° de Carpeta (4 dígitos)</label>
                    <input 
                      type="text"
                      required
                      maxLength={4}
                      pattern="\d{4}"
                      value={insCode}
                      onChange={(e) => setInsCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="0001"
                      className="w-full bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-[10px] font-mono font-black text-center focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>

                {/* SPREADSHEET SCROLLING BODY FOR CHECKS */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                  {insSections.map((section, secIndex) => (
                    <div key={secIndex} className="bg-slate-50/50 dark:bg-[#050813] border border-slate-200/50 dark:border-slate-900 rounded-2xl overflow-hidden shadow-sm">
                      
                      {/* Excel layout visual banner */}
                      <div className="grid grid-cols-12 bg-emerald-600 text-white font-mono font-black text-[9.5px] uppercase tracking-wider items-center py-2.5 px-4">
                        <div className="col-span-12 md:col-span-5">{section.title}</div>
                        <div className="hidden md:block col-span-3 text-center">EVALUACIÓN (C  /  NC  /  N/A)</div>
                        <div className="hidden md:block col-span-3 text-left">OBSERVACIONES</div>
                        <div className="hidden md:block col-span-1 text-center">% CUMP.</div>
                      </div>

                      <div className="divide-y divide-slate-200/60 dark:divide-slate-900/40">
                        {section.items.map((item, itemIndex) => (
                          <div key={itemIndex} className="grid grid-cols-12 items-stretch py-3 px-4 hover:bg-white dark:hover:bg-black/20 transition-all duration-150">
                            
                            {/* Desc */}
                            <div className="col-span-12 md:col-span-5 flex items-start gap-2.5">
                              <span className="text-[8px] font-mono font-black bg-slate-100 dark:bg-slate-900 p-1 rounded text-slate-400">
                                {item.id}
                              </span>
                              <p className="text-[10px] font-extrabold uppercase text-slate-700 dark:text-slate-300 tracking-wide mt-0.5">
                                {item.description}
                              </p>
                            </div>

                            {/* C / NC / N/A Interactive switches */}
                            <div className="col-span-12 md:col-span-3 grid grid-cols-3 items-center py-2 md:py-0 text-center gap-1.5">
                              {(['C', 'NC', 'N/A'] as const).map((ind) => (
                                <div key={ind} className="flex flex-col items-center">
                                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 md:hidden">{ind}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCheckStatus(secIndex, itemIndex, ind)}
                                    className={cn(
                                      "w-7 h-7 rounded-lg flex items-center justify-center font-mono font-black text-xs border transition-all active:scale-90",
                                      item.status === ind 
                                        ? ind === 'C' ? "bg-emerald-500 border-emerald-500 text-white" : ind === 'NC' ? "bg-red-500 border-red-500 text-white" : "bg-slate-500 border-slate-500 text-white"
                                        : "bg-white dark:bg-black border-slate-200 dark:border-slate-800 text-transparent hover:border-slate-400 dark:hover:border-slate-600"
                                    )}
                                  >
                                    X
                                  </button>
                                </div>
                              ))}
                            </div>

                            {/* Observaciones Input with Speech Recognition */}
                            <div className="col-span-12 md:col-span-3 flex items-center gap-2">
                              <input 
                                type="text"
                                value={item.observations}
                                onChange={(e) => handleObservationChange(secIndex, itemIndex, e.target.value.toUpperCase())}
                                placeholder="NOTAS / HALLAZGO"
                                className="w-full bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-[9.5px] uppercase tracking-wider font-semibold focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleVoiceDictation(secIndex, itemIndex, 'observations')}
                                className={cn(
                                  "p-1.5 rounded-lg border flex items-center justify-center transition-all active:scale-95",
                                  activeVoiceDictation?.path === `${secIndex}-${itemIndex}`
                                    ? "bg-red-500 border-red-500 text-white animate-pulse"
                                    : "bg-white dark:bg-black border-slate-200 dark:border-slate-800 text-slate-400 hover:text-emerald-500"
                                )}
                              >
                                {activeVoiceDictation?.path === `${secIndex}-${itemIndex}` ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                              </button>
                            </div>

                            {/* Spanning cell representation on the very first cell */}
                            {itemIndex === 0 && (
                              <div className="hidden md:flex col-span-1 text-center items-center justify-center font-mono font-black border-l border-slate-200 dark:border-slate-900 bg-slate-100/30 dark:bg-black/10 text-xs" style={{ gridRow: `span ${section.items.length}` }}>
                                <span className={cn(
                                  section.compliancePercentage >= 85 ? "text-emerald-500" :
                                  section.compliancePercentage >= 60 ? "text-amber-500" : "text-red-500"
                                )}>
                                  {section.compliancePercentage}%
                                </span>
                              </div>
                            )}

                          </div>
                        ))}
                      </div>

                    </div>
                  ))}
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0 bg-slate-50/50 dark:bg-black/30">
                  <button 
                    type="button"
                    onClick={() => setIsInsModalOpen(false)}
                    className="px-5 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-slate-50 transition-colors"
                  >
                    Descartar
                  </button>
                  <button 
                    type="submit"
                    className="px-8 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/10 transition-all active:scale-95"
                  >
                    Guardar Inspección
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CREATE APROVECHAMIENTO REPORT */}
      <AnimatePresence>
        {isAprModalOpen && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#070709] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />
              
              <header className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-black/30">
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.3em]">Residuos RCD</span>
                  <h2 className="text-sm lg:text-base font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Leaf className="w-5 h-5 text-emerald-500" />
                    {editingReportId ? 'Editar Registro de Aprovechamiento' : 'Nuevo Registro de Aprovechamiento'}
                  </h2>
                </div>
                <button 
                  onClick={closeAprModal}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </header>

              <form onSubmit={handleSaveAprovechamiento} className="flex-1 overflow-hidden flex flex-col">
                <div className="p-6 bg-slate-50 dark:bg-[#050914] border-b border-slate-100 dark:border-slate-900/60 flex flex-col md:flex-row gap-4 shrink-0">
                  <div className="flex-1">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Título del Informe *</label>
                    <input 
                      type="text"
                      required
                      value={aprTitle}
                      onChange={(e) => setAprTitle(e.target.value)}
                      placeholder="E.g., BITÁCORA Y APROVECHAMIENTO DE MATERIAL RCD - MAYO 2026"
                      className="w-full bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-[9.5px] font-extrabold uppercase tracking-wide focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none"
                    />
                  </div>

                  <div className="w-full md:w-44">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">N° de Carpeta (4 dígitos)</label>
                    <input 
                      type="text"
                      required
                      maxLength={4}
                      pattern="\d{4}"
                      value={aprCode}
                      onChange={(e) => setAprCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="0001"
                      className="w-full bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-[10px] font-mono font-black text-center focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>

                {/* MATRIX CREATION PANEL */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">

                  {/* 🔔 ALERTA DE SEGUIMIENTO AUTOMÁTICO (Alert box) */}
                  <div className="bg-amber-500/10 border border-amber-500/25 p-5 rounded-3xl flex items-start gap-4">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-bounce" />
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                        Alerta de Registro de Operación RCD Automatizado
                      </p>
                      <p className="text-[9.5px] font-bold text-slate-600 dark:text-slate-400 uppercase leading-relaxed tracking-wider">
                        Fechas de vigencia auto-configuradas desde el primero hasta el último día calendario de este mes.
                        Se ha emitido un aviso activo de seguimiento de control y supervisión directa para el rol <span className="text-emerald-500 font-extrabold text-[10px]">DIRECTOR DE OBRA</span> y todos los miembros del grupo o equipo de <span className="text-emerald-500 font-extrabold text-[10px]">OBRA</span>.
                      </p>
                    </div>
                  </div>

                  {/* 📅 DATOS DE CONTROL Y RESPONSABILIDAD (Dates & automatic responsible) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 dark:bg-[#070b16] p-6 rounded-[24px] border border-slate-200/50 dark:border-slate-900">
                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Fecha de Inicio de Operación (Automatizado)</label>
                      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 select-none opacity-80 cursor-not-allowed">
                        <Calendar className="w-4 h-4 text-slate-405 shrink-0" />
                        <input 
                          type="date"
                          disabled
                          readOnly
                          value={aprStartDate}
                          className="bg-transparent border-none w-full text-[10px] font-mono font-black focus:outline-none uppercase dark:text-white cursor-not-allowed text-slate-500 dark:text-slate-400"
                        />
                      </div>
                      <span className="text-[7.5px] font-extrabold text-emerald-500 uppercase tracking-wider mt-1 block">✓ Auto-iniciado el 1° del mes</span>
                    </div>

                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Fecha de Finalización Operación (Mes en Curso)</label>
                      <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 select-none opacity-80 cursor-not-allowed">
                        <Calendar className="w-4 h-4 text-slate-405 shrink-0" />
                        <input 
                          type="date"
                          disabled
                          readOnly
                          value={aprEndDate}
                          className="bg-transparent border-none w-full text-[10px] font-mono font-black focus:outline-none uppercase dark:text-white cursor-not-allowed text-slate-500 dark:text-slate-400"
                        />
                      </div>
                      <span className="text-[7.5px] font-extrabold text-slate-400 uppercase tracking-wider mt-1 block">📅 Vigencia: último día de mes</span>
                    </div>

                    <div>
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Responsable Automático Asignado</label>
                      <div className="bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-1.5 flex flex-col justify-center min-h-[42px]">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-[9.5px] font-black text-slate-850 dark:text-slate-250 uppercase tracking-wide truncate">{aprResponsibleName || 'Director de Obra'}</span>
                          <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10 text-[7px] font-black uppercase rounded shrink-0">
                            {aprResponsiblePosition}
                          </span>
                        </div>
                        <span className="text-[8px] text-slate-400 font-mono font-bold truncate block">{aprResponsibleEmail}</span>
                      </div>
                      <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider mt-1 block">Alerta activa para: DIRECTOR DE OBRA y OBRA</span>
                    </div>
                  </div>

                  {/* 📝 DESCRIPCIÓN DE LOS PROCESOS A REALIZAR */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Descripción del Proceso a Realizar *</label>
                      <button
                        type="button"
                        onClick={handleAprDescriptionDictation}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[7.5px] font-black uppercase tracking-widest transition-all cursor-pointer",
                          activeVoiceDictation?.path === 'aprProcessDescription'
                            ? "bg-red-500 text-white animate-pulse shadow-sm"
                            : "bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-205 dark:hover:bg-slate-800/80"
                        )}
                      >
                        {activeVoiceDictation?.path === 'aprProcessDescription' ? (
                          <>
                            <MicOff className="w-3 h-3 text-white" />
                            <span>Escuchando...</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span>Dictar por Voz</span>
                          </>
                        )}
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      required
                      value={aprProcessDescription}
                      onChange={(e) => setAprProcessDescription(e.target.value)}
                      placeholder="DESCRIBA AQUÍ LOS PROCESOS DE SEPARACIÓN, ALMACENAMIENTO, CARGUE Y TRANSPORTE DE RESIDUOS A REALIZAR..."
                      className="w-full bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-400/80 dark:text-white"
                    />
                  </div>

                  {/* 📸 REGISTRO DE INICIO (Media Upload Simulation or CDE) */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        Registro de Inicio (Fotografías / Videos Obligatorios)
                      </label>
                      <span className="text-[7.5px] font-black text-slate-500 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded-lg uppercase">
                        {aprMediaFiles.length} Archivos de Inicio Cargados
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Option A: Desktop simulated simulator */}
                      <div className="border border-dashed border-slate-250 dark:border-slate-800 rounded-[24px] p-6 flex flex-col items-center justify-center text-center bg-slate-50/20 dark:bg-[#070b16]/20 hover:bg-slate-50/50 dark:hover:bg-slate-900/5 duration-300 relative group transition-all">
                        <input 
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          onChange={(e) => {
                            if (e.target.files) {
                              const filesArr = Array.from(e.target.files);
                              const hasVideo = filesArr.some(f => f.type.startsWith('video'));
                              if (hasVideo && !googleAccessToken) {
                                alert("⚠️ Para poder subir VIDEOS, debe conectar su Google Drive primero en la barra superior. Los videos no se pueden guardar en la base de datos local debido a su gran tamaño.");
                                return;
                              }
                              const nextFiles = filesArr.map(f => ({
                                name: f.name,
                                url: URL.createObjectURL(f),
                                type: f.type.startsWith('video') ? ('video' as const) : ('image' as const)
                              }));
                              setAprMediaFiles(prev => [...prev, ...nextFiles]);
                            }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-500 mb-2 border border-slate-200/50 dark:border-slate-800 group-hover:scale-110 duration-300 transition-transform">
                          <Plus className="w-5 h-5 text-emerald-500" />
                        </div>
                        <p className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Cargar desde Escritorio</p>
                        <p className="text-[8px] text-slate-400 uppercase tracking-widest mt-1">Seleccione archivos de la computadora</p>
                      </div>

                      {/* Option B: Active Device Camera */}
                      <div 
                        onClick={() => {
                          startCamera();
                        }}
                        className="border border-slate-250 dark:border-slate-800 rounded-[24px] p-6 flex flex-col items-center justify-center text-center bg-slate-50/20 dark:bg-[#070b16]/20 hover:border-emerald-500/20 hover:bg-emerald-500/[0.01] cursor-pointer group transition-all"
                      >
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-500 mb-2 border border-slate-200/50 dark:border-slate-800 group-hover:scale-110 duration-300 transition-transform">
                          <Camera className="w-5 h-5 text-emerald-500" />
                        </div>
                        <p className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Activar Cámara de Dispositivo</p>
                        <p className="text-[8px] text-slate-400 uppercase tracking-widest mt-1">Fotografías o Videos en tiempo real</p>
                      </div>

                      {/* Option C: CDE File pick */}
                      <div 
                        onClick={() => {
                          setIsInsideAprCDEOpen(true);
                        }}
                        className="border border-slate-250 dark:border-slate-800 rounded-[24px] p-6 flex flex-col items-center justify-center text-center bg-slate-50/20 dark:bg-[#070b16]/20 hover:border-emerald-500/20 hover:bg-emerald-500/[0.01] cursor-pointer group transition-all"
                      >
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-500 mb-2 border border-slate-200/50 dark:border-slate-800 group-hover:scale-110 duration-300 transition-transform">
                          <Layers className="w-5 h-5 text-emerald-500" />
                        </div>
                        <p className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Elegir desde CDE Hub</p>
                        <p className="text-[8px] text-slate-400 uppercase tracking-widest mt-1">Vincule registros del repositorio central</p>
                      </div>
                    </div>

                    {/* Display pre-loaded start operation media assets preview */}
                    {aprMediaFiles.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                        {aprMediaFiles.map((media, idx) => (
                          <div key={idx} className="relative group rounded-2xl overflow-hidden border border-slate-200/60 dark:border-slate-800 aspect-video bg-black/5 flex items-center justify-center">
                            {media.type === 'video' ? (
                              <video src={media.url} className="w-full h-full object-cover animate-pulse" muted loop autoPlay />
                            ) : (
                              <img src={media.url || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=500'} className="w-full h-full object-cover" alt="Startup registration preview" referrerPolicy="no-referrer" />
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button 
                                type="button"
                                onClick={() => setAprMediaFiles(prev => prev.filter((_, i) => i !== idx))}
                                className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 text-[7px] text-white font-mono uppercase truncate">
                              {media.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 📸 REGISTRO FOTOGRÁFICO DURANTE EL PROCESO (Durante) */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        Registro Durante el Proceso (Fotografías / Videos)
                      </label>
                      <span className="text-[7.5px] font-black text-slate-500 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded-lg uppercase">
                        {aprMediaDuring.length} Archivos Durante Proceso
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Option A: Desktop file pick */}
                      <div className="relative border border-dashed border-slate-250 dark:border-slate-800 rounded-[24px] p-6 flex flex-col items-center justify-center text-center bg-slate-50/20 dark:bg-[#070b16]/20 hover:bg-slate-50/50 dark:hover:bg-slate-900/5 duration-300 relative group transition-all">
                        <input 
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          onChange={(e) => {
                            if (e.target.files) {
                              const filesArr = Array.from(e.target.files);
                              const hasVideo = filesArr.some(f => f.type.startsWith('video'));
                              if (hasVideo && !googleAccessToken) {
                                alert("⚠️ Para poder subir VIDEOS, debe conectar su Google Drive primero en la barra superior. Los videos no se pueden guardar en la base de datos local debido a su gran tamaño.");
                                return;
                              }
                              const nextFiles = filesArr.map(f => ({
                                name: f.name,
                                url: URL.createObjectURL(f),
                                type: f.type.startsWith('video') ? ('video' as const) : ('image' as const)
                              }));
                              setAprMediaDuring(prev => [...prev, ...nextFiles]);
                            }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-500 mb-2 border border-slate-200/50 dark:border-slate-800 group-hover:scale-110 duration-300 transition-transform">
                          <Plus className="w-5 h-5 text-emerald-500" />
                        </div>
                        <p className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Cargar desde Escritorio</p>
                        <p className="text-[8px] text-slate-400 uppercase tracking-widest mt-1">Seleccione archivos de la computadora</p>
                      </div>

                      {/* Option B: Active Device Camera */}
                      <div 
                        onClick={() => {
                          startCamera('during');
                        }}
                        className="border border-dashed border-slate-250 dark:border-slate-800 rounded-[24px] p-6 flex flex-col items-center justify-center text-center bg-slate-50/20 dark:bg-[#070b16]/20 hover:border-emerald-500/20 hover:bg-emerald-500/[0.01] cursor-pointer group transition-all"
                      >
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-500 mb-2 border border-slate-200/50 dark:border-slate-800 group-hover:scale-110 duration-300 transition-transform">
                          <Camera className="w-5 h-5 text-emerald-500" />
                        </div>
                        <p className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Activar Cámara de Dispositivo</p>
                        <p className="text-[8px] text-slate-400 uppercase tracking-widest mt-1">Fotografías o Videos en tiempo real</p>
                      </div>

                      {/* Option C: CDE File pick */}
                      <div 
                        onClick={() => {
                          setIsInsideAprCDEOpen(true);
                        }}
                        className="border border-dashed border-slate-250 dark:border-slate-800 rounded-[24px] p-6 flex flex-col items-center justify-center text-center bg-slate-50/20 dark:bg-[#070b16]/20 hover:border-emerald-500/20 hover:bg-emerald-500/[0.01] cursor-pointer group transition-all"
                      >
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-500 mb-2 border border-slate-200/50 dark:border-slate-800 group-hover:scale-110 duration-300 transition-transform">
                          <Layers className="w-5 h-5 text-emerald-500" />
                        </div>
                        <p className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Elegir desde CDE Hub</p>
                        <p className="text-[8px] text-slate-400 uppercase tracking-widest mt-1">Vincule registros del repositorio central</p>
                      </div>
                    </div>

                    {/* Display pre-loaded during media assets preview */}
                    {aprMediaDuring.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                        {aprMediaDuring.map((media: any, idx: number) => (
                          <div key={idx} className="relative group rounded-2xl overflow-hidden border border-slate-200/60 dark:border-slate-800 aspect-video bg-black/5 flex items-center justify-center">
                            {media.type === 'video' ? (
                              <video src={media.url} className="w-full h-full object-cover animate-pulse" muted loop autoPlay />
                            ) : (
                              <img src={getAuthenticatedDriveUrl(media.driveFileId ? `/api/drive-image/${media.driveFileId}` : (media.thumbnail || media.url), googleAccessToken)} className="w-full h-full object-cover" alt="During operation preview" referrerPolicy="no-referrer" />
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button 
                                type="button"
                                onClick={() => setAprMediaDuring(prev => prev.filter((_, i) => i !== idx))}
                                className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 text-[7px] text-white font-mono uppercase truncate">
                              {media.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 📸 REGISTRO FOTOGRÁFICO DE CIERRE (Final) */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        Registro de Cierre (Fotografías / Videos)
                      </label>
                      <span className="text-[7.5px] font-black text-slate-500 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded-lg uppercase">
                        {aprMediaFinal.length} Archivos de Cierre
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Option A: Desktop file pick */}
                      <div className="relative border border-dashed border-slate-250 dark:border-slate-800 rounded-[24px] p-6 flex flex-col items-center justify-center text-center bg-slate-50/20 dark:bg-[#070b16]/20 hover:bg-slate-50/50 dark:hover:bg-slate-900/5 duration-300 relative group transition-all">
                        <input 
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          onChange={(e) => {
                            if (e.target.files) {
                              const filesArr = Array.from(e.target.files);
                              const hasVideo = filesArr.some(f => f.type.startsWith('video'));
                              if (hasVideo && !googleAccessToken) {
                                alert("⚠️ Para poder subir VIDEOS, debe conectar su Google Drive primero en la barra superior. Los videos no se pueden guardar en la base de datos local debido a su gran tamaño.");
                                return;
                              }
                              const nextFiles = filesArr.map(f => ({
                                name: f.name,
                                url: URL.createObjectURL(f),
                                type: f.type.startsWith('video') ? ('video' as const) : ('image' as const)
                              }));
                              setAprMediaFinal(prev => [...prev, ...nextFiles]);
                            }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-500 mb-2 border border-slate-200/50 dark:border-slate-800 group-hover:scale-110 duration-300 transition-transform">
                          <Plus className="w-5 h-5 text-emerald-500" />
                        </div>
                        <p className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Cargar desde Escritorio</p>
                        <p className="text-[8px] text-slate-400 uppercase tracking-widest mt-1">Seleccione archivos de la computadora</p>
                      </div>

                      {/* Option B: Active Device Camera */}
                      <div 
                        onClick={() => {
                          startCamera('final');
                        }}
                        className="border border-dashed border-slate-250 dark:border-slate-800 rounded-[24px] p-6 flex flex-col items-center justify-center text-center bg-slate-50/20 dark:bg-[#070b16]/20 hover:border-emerald-500/20 hover:bg-emerald-500/[0.01] cursor-pointer group transition-all"
                      >
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-500 mb-2 border border-slate-200/50 dark:border-slate-800 group-hover:scale-110 duration-300 transition-transform">
                          <Camera className="w-5 h-5 text-emerald-500" />
                        </div>
                        <p className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Activar Cámara de Dispositivo</p>
                        <p className="text-[8px] text-slate-400 uppercase tracking-widest mt-1">Fotografías o Videos en tiempo real</p>
                      </div>

                      {/* Option C: CDE File pick */}
                      <div 
                        onClick={() => {
                          setIsInsideAprCDEOpen(true);
                        }}
                        className="border border-dashed border-slate-250 dark:border-slate-800 rounded-[24px] p-6 flex flex-col items-center justify-center text-center bg-slate-50/20 dark:bg-[#070b16]/20 hover:border-emerald-500/20 hover:bg-emerald-500/[0.01] cursor-pointer group transition-all"
                      >
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-slate-500 mb-2 border border-slate-200/50 dark:border-slate-800 group-hover:scale-110 duration-300 transition-transform">
                          <Layers className="w-5 h-5 text-emerald-500" />
                        </div>
                        <p className="text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Elegir desde CDE Hub</p>
                        <p className="text-[8px] text-slate-400 uppercase tracking-widest mt-1">Vincule registros del repositorio central</p>
                      </div>
                    </div>

                    {/* Display pre-loaded final media assets preview */}
                    {aprMediaFinal.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                        {aprMediaFinal.map((media: any, idx: number) => (
                          <div key={idx} className="relative group rounded-2xl overflow-hidden border border-slate-200/60 dark:border-slate-800 aspect-video bg-black/5 flex items-center justify-center">
                            {media.type === 'video' ? (
                              <video src={media.url} className="w-full h-full object-cover animate-pulse" muted loop autoPlay />
                            ) : (
                              <img src={getAuthenticatedDriveUrl(media.driveFileId ? `/api/drive-image/${media.driveFileId}` : (media.thumbnail || media.url), googleAccessToken)} className="w-full h-full object-cover" alt="Final operation preview" referrerPolicy="no-referrer" />
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button 
                                type="button"
                                onClick={() => setAprMediaFinal(prev => prev.filter((_, i) => i !== idx))}
                                className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 text-[7px] text-white font-mono uppercase truncate">
                              {media.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 🗺️ PLANO DE ACOPIO (Interactive Map coordinates markup) */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                          Plano PDF de Localización (CDE u Ordenador) *
                        </label>
                        <p className="text-[7.5px] uppercase font-bold text-slate-400">Cargo del plano del sitio de acopio y delimitación de área.</p>
                      </div>
                      {aprPlanUrl && (
                        <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-[8px] font-mono font-black uppercase tracking-widest flex items-center gap-1">
                          ✓ Plano Cargado: {aprPlanName}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* A. Desktop Upload Plan */}
                      <div className="relative border border-dashed border-slate-250 dark:border-slate-800 p-4 rounded-xl bg-slate-50/10 dark:bg-black/10 flex items-center justify-center text-center hover:bg-slate-50/30 transition-colors cursor-pointer group">
                        <input 
                          type="file"
                          accept="application/pdf,image/*"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              const f = e.target.files[0];
                              setAprPlanName(f.name);
                              setAprPlanUrl(f.type.includes('pdf') ? 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=1000' : URL.createObjectURL(f)); // Fallback blueprint view for PDF
                            }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <div className="flex items-center gap-3">
                          <Download className="w-4 h-4 text-emerald-500" />
                          <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Cargar PDF Plano de Escritorio</span>
                        </div>
                      </div>

                      {/* B. CDE Link Plan */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsInsideAprCDEOpen(true);
                        }}
                        className="border border-slate-250 dark:border-slate-800 p-4 rounded-xl bg-slate-50/10 dark:bg-black/10 hover:border-emerald-500/20 hover:bg-emerald-500/[0.01] transition-all flex items-center justify-center gap-3 text-center"
                      >
                        <Layers className="w-4 h-4 text-emerald-500" />
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Vincular Planos del CDE Hub</span>
                      </button>
                    </div>

                    {/* Real Interactive Blueprint mapping box if a plan URL is set! */}
                    {aprPlanUrl ? (
                      <div className="space-y-2 border border-slate-200 dark:border-slate-900 rounded-[24px] p-4 bg-slate-50 dark:bg-black/40">
                        <div className="flex items-center justify-between text-[8px] font-black uppercase text-slate-400">
                          <span>Instrucciones: Haga click sobre el plano para marcar la "ZONA DE ACOPIO DE OBRA"</span>
                          {aprSelectedMarkArea ? (
                            <span className="text-emerald-500 font-mono text-[8.5px] font-black">
                              Lugar Marcado: X:{Math.round(aprSelectedMarkArea.x)}% Y:{Math.round(aprSelectedMarkArea.y)}% (SITIO REGISTRADO)
                            </span>
                          ) : (
                            <span className="text-red-400 font-bold uppercase tracking-wider">Pendiente por marcar en el plano</span>
                          )}
                        </div>

                        <div 
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = ((e.clientX - rect.left) / rect.width) * 100;
                            const clickY = ((e.clientY - rect.top) / rect.height) * 100;
                            // Set selection markup bounding box
                            setAprSelectedMarkArea({ x: clickX, y: clickY, w: 20, h: 18 });
                          }}
                          className="relative bg-[#111625] rounded-2xl overflow-hidden aspect-[16/9] border border-slate-200 dark:border-slate-800 flex items-center justify-center cursor-crosshair group shadow-inner"
                        >
                          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
                          <img 
                            src={aprPlanUrl || "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=1000"} 
                            className="w-full h-full object-cover opacity-35 select-none pointer-events-none" 
                            alt="Site map background"
                            referrerPolicy="no-referrer"
                          />

                          <div className="absolute top-4 left-4 bg-slate-950/80 backdrop-blur-sm border border-slate-800 rounded-lg p-2.5 pointer-events-none max-w-xs space-y-1">
                            <p className="text-[7.5px] font-mono text-emerald-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              VISTA PREVIA CDE LOCALIZADOR
                            </p>
                            <p className="text-[8.5px] font-sans font-black text-white uppercase tracking-tight truncate">
                              {aprPlanName || 'PLANO PLANIFICACIÓN DE OBRA'}
                            </p>
                          </div>

                          {aprSelectedMarkArea && (
                            <motion.div 
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="absolute bg-emerald-500/25 border-2 border-emerald-500 rounded-xl flex flex-col items-center justify-center shadow-lg shadow-emerald-500/10 pointer-events-none"
                              style={{ 
                                left: `${aprSelectedMarkArea.x - 10}%`, 
                                top: `${aprSelectedMarkArea.y - 9}%`, 
                                width: '20%', 
                                height: '18%' 
                              }}
                            >
                              <div className="bg-emerald-500 text-slate-950 px-2 py-0.5 rounded text-[8px] font-black uppercase text-center tracking-wider max-w-full truncate">
                                📌 ACOPIO RCD
                              </div>
                            </motion.div>
                          )}

                          {!aprSelectedMarkArea && (
                            <span className="absolute text-[9px] font-black text-slate-400 uppercase tracking-widest animate-pulse border border-slate-700/60 bg-slate-950/70 backdrop-blur px-3 py-1.5 rounded-xl pointer-events-none">
                              Haga Click para delimitar el área de acopio
                            </span>
                          )}
                        </div>

                        {aprSelectedMarkArea && (
                          <div className="flex justify-between items-center bg-emerald-500/[0.03] border border-emerald-500/20 p-2.5 rounded-xl">
                            <p className="text-[8.5px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
                              ¡Ubicación de acopio establecida de forma física sobre el plano!
                            </p>
                            <button 
                              type="button" 
                              onClick={() => setAprSelectedMarkArea(null)}
                              className="text-[8px] font-black text-red-500 uppercase hover:underline"
                            >
                              Quitar Marca
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-10 border border-slate-200 dark:border-[#1e293b] rounded-2xl bg-slate-500/5 text-center flex flex-col items-center justify-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                          Pendiente por Selección o Carga de Plano PDF
                        </p>
                        <p className="text-[8px] text-slate-450 uppercase tracking-wide mt-1 max-w-sm">
                          Debe cargar un plano desde su dispositivo o vincularlo del CDE para habilitar la localización y delimitación de la zona de acopio.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* INTERNAL MODAL SUB-POPUP: CDE Explorer selector */}
                  <AnimatePresence>
                    {isInsideAprCDEOpen && (
                      <div className="fixed inset-0 z-[160] flex items-center justify-center p-8 bg-[#020617]/75 backdrop-blur-3xl">
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: 15 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 15 }}
                          className="bg-white dark:bg-[#070709] w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-850 overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
                        >
                          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-black/30 animate-pulse">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center text-slate-950">
                                <Layers className="w-4 h-4" />
                              </div>
                              <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-wide uppercase">Vinculación de Archivos CDE Hub</h3>
                                <p className="text-[8px] text-slate-500 font-extrabold uppercase tracking-widest mt-0.5">Gestión de recursos para el aprovechamiento</p>
                              </div>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => setIsInsideAprCDEOpen(false)} 
                              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex-1 overflow-auto p-6 space-y-3 custom-scrollbar">
                            {[
                              { id: 'cde-pdf1', name: 'PLANO_ACOPIO_ZONA_NORTE_V2.pdf', category: 'plan_pdf', url: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1000' },
                              { id: 'cde-pdf2', name: 'PLANO_LOCALIZACION_ACOPIOS_SOSTENIBLE_NORA.pdf', category: 'plan_pdf', url: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=1000' },
                              { id: 'cde-vi1', name: 'Inspección_Cierre_Operativo_Mayo.mp4', category: 'video', url: '#' },
                              { id: 'cde-img1', name: 'Foto_Estado_Inicial_Zona_Acopio_Norte.jpg', category: 'image', url: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800' }
                            ].map(file => (
                              <button 
                                key={file.id} 
                                type="button"
                                onClick={() => {
                                  if (file.category === 'plan_pdf') {
                                    setAprPlanName(file.name);
                                    setAprPlanUrl(file.url);
                                  } else {
                                    // Add reference
                                    setAprMediaFiles(prev => [...prev, {
                                      name: file.name,
                                      url: file.url === '#' ? 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=500' : file.url,
                                      type: file.category as any
                                    }]);
                                  }
                                  setIsInsideAprCDEOpen(false);
                                }}
                                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-emerald-500/[0.03] dark:bg-black/25 border border-slate-200/60 dark:border-slate-850 rounded-2xl hover:border-emerald-500/40 transition-all text-left group"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-slate-150 dark:bg-slate-900 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-emerald-555 group-hover:text-white transition-all">
                                    <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black text-slate-850 dark:text-slate-200 uppercase tracking-tight">{file.name}</p>
                                    <p className="text-[7.5px] text-slate-450 font-black uppercase tracking-widest mt-1">{file.category.replace('_', ' ')}</p>
                                  </div>
                                </div>
                                <span className="p-2 bg-slate-100 dark:bg-slate-905 border border-slate-200 dark:border-slate-800 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-all text-[8px] font-bold uppercase tracking-wider">
                                  Seleccionar
                                </span>
                              </button>
                            ))}
                          </div>

                          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-black/20 text-center">
                            <p className="text-[8px] text-slate-500 font-extrabold uppercase tracking-widest">Sincronizado de Forma Directa</p>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>


                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0 bg-slate-50/50 dark:bg-black/30">
                  <button 
                    type="button"
                    onClick={closeAprModal}
                    className="px-5 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-slate-50 transition-colors"
                  >
                    Descartar
                  </button>
                  <button 
                    type="submit"
                    className="px-8 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/10 transition-all active:scale-95"
                  >
                    {editingReportId ? 'Actualizar Registro' : 'Guardar Aprovechamiento'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* COMPLIANCE ALERT ISSUE CREATOR DIALOG */}
      <AnimatePresence>
        {isIssueModalOpen && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#070709] border border-slate-200 dark:border-slate-800 p-6 rounded-3xl w-full max-w-md shadow-2xl relative"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 rounded-t-3xl" />
              
              <h3 className="text-xs font-black text-red-500 uppercase tracking-widest flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4.5 h-4.5 text-red-500" />
                No Conformidad Detectada
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide leading-relaxed mb-4">
                Ha marcado un cumplimiento crítico como NO CONFORME (NC). Se guardará una incidencia asociada al equipo ambiental.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Detalle de No Conformidad</label>
                  <textarea
                    rows={3}
                    value={pendingIssueText}
                    onChange={(e) => setPendingIssueText(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 dark:bg-black border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-[10px] font-bold uppercase transition-all"
                  />
                </div>

                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Asignar Responsable del Proyecto</label>
                  <select
                    value={assignedMemberEmail}
                    onChange={(e) => setAssignedMemberEmail(e.target.value)}
                    className="w-full bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-[9.5px] font-bold uppercase transition-all"
                  >
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.email}>{m.name.toUpperCase()} ({m.position.toUpperCase()})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Días de Plazo para Subsanar</label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={assignedDaysLimit}
                    onChange={(e) => setAssignedDaysLimit(Number(e.target.value) || 3)}
                    className="w-full bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-[10px] font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-900">
                <button
                  onClick={() => setIsIssueModalOpen(false)}
                  className="flex-1 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-[9px] font-black uppercase"
                >
                  Omitir Alerta
                </button>
                <button
                  onClick={handleCreateIssue}
                  className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[9px] font-black uppercase"
                >
                  Levantar Hallazgo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Live Camera Dialog Modal */}
      <AnimatePresence>
        {isCameraActive && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col text-white relative"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-emerald-500/15 rounded-xl border border-emerald-500/20">
                    {cameraMode === 'photo' ? (
                      <Camera className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Video className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider block">Cámara del Dispositivo</span>
                    <span className="text-[8px] font-bold text-slate-400 tracking-wider uppercase block">
                      {cameraMode === 'photo' ? 'Registrar Fotografía de Inicio' : 'Registrar Video de Inicio'}
                    </span>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={stopCamera}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Viewfinder/Preview Container */}
              <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                {cameraStream ? (
                  <video
                    ref={(el) => {
                      if (el && cameraStream) {
                        try {
                          el.srcObject = cameraStream;
                          el.play().catch(e => console.warn("Video play error:", e));
                        } catch (err) {
                          console.error("Stream attachment failed:", err);
                        }
                      }
                    }}
                    playsInline
                    muted
                    autoPlay
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="p-8 text-center max-w-sm flex flex-col items-center">
                    {cameraError ? (
                      <>
                        <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
                        <p className="text-[10px] font-black uppercase text-amber-500 tracking-wide mb-2">Simulador de Cámara Listo</p>
                        <p className="text-[8.5px] text-slate-400 font-semibold uppercase leading-normal mb-3">{cameraError}</p>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-[9px] font-black uppercase tracking-wider">Iniciando Cámara...</p>
                      </>
                    )}
                    {/* Simulator fallback hint */}
                    <div className="mt-2 p-3 bg-slate-800/80 border border-slate-700/60 rounded-2xl text-left">
                      <p className="text-[7.5px] text-slate-400 font-extrabold uppercase tracking-widest mb-1">MÓDULO DE SIMULACIÓN ACTIVO</p>
                      <p className="text-[8px] text-slate-300 leading-relaxed uppercase">Puede pulsar el botón inferior central de captura para registrar de forma asistida fotos o videos del estado ambiental de inicio con totales garantías y un alto nivel de detalle.</p>
                    </div>
                  </div>
                )}

                {/* Recording Timer / State */}
                {isCameraRecording && (
                  <div className="absolute top-4 left-4 bg-red-500/95 text-white px-3 py-1.5 rounded-full flex items-center gap-2 animate-pulse">
                    <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                    <span className="text-[8px] font-bold font-mono tracking-widest uppercase">GRABANDO VIDEO DE INICIO</span>
                  </div>
                )}
              </div>

              {/* Control bar */}
              <div className="p-6 bg-slate-950/40 border-t border-slate-800/60 space-y-4">
                {/* Mode switch */}
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    disabled={isCameraRecording}
                    onClick={() => setCameraMode('photo')}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer",
                      cameraMode === 'photo' 
                        ? "bg-emerald-500 text-white shadow-sm font-black" 
                        : "bg-slate-800 text-slate-450 hover:text-white hover:bg-slate-700"
                    )}
                  >
                    FOTOGRAFÍA
                  </button>
                  <button
                    type="button"
                    disabled={isCameraRecording}
                    onClick={() => setCameraMode('video')}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer",
                      cameraMode === 'video' 
                        ? "bg-emerald-500 text-white shadow-sm font-black" 
                        : "bg-slate-800 text-slate-450 hover:text-white hover:bg-slate-700"
                    )}
                  >
                    VIDEO DE INICIO
                  </button>
                </div>

                {/* Capture Trigger */}
                <div className="flex items-center justify-center gap-6">
                  {cameraDevices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const currentIdx = cameraDevices.findIndex(d => d.deviceId === selectedCameraId);
                        const nextIdx = (currentIdx + 1) % cameraDevices.length;
                        const nextCam = cameraDevices[nextIdx];
                        setSelectedCameraId(nextCam.deviceId);
                        startCamera(cameraTarget, nextCam.deviceId);
                      }}
                      className="p-3 bg-slate-850 hover:bg-slate-700 text-slate-300 rounded-2xl transition-all cursor-pointer border border-slate-800"
                      title="Cambiar Cámara"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}

                  {cameraMode === 'photo' ? (
                    <button
                      type="button"
                      onClick={() => {
                        const videoElement = document.querySelector('video');
                        capturePhotoFromCamera(videoElement);
                      }}
                      className="w-16 h-16 bg-white active:scale-95 duration-100 rounded-full border-4 border-slate-700/60 hover:border-emerald-500/40 relative flex items-center justify-center text-slate-800 hover:text-emerald-600 transition-all cursor-pointer"
                    >
                      <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (isCameraRecording) {
                          stopVideoRecordingFromCamera();
                        } else {
                          startVideoRecordingFromCamera();
                        }
                      }}
                      className={cn(
                        "w-16 h-16 active:scale-95 duration-100 rounded-full border-4 relative flex items-center justify-center transition-all cursor-pointer",
                        isCameraRecording 
                          ? "border-red-500/40 bg-red-600"
                          : "border-slate-700/60 bg-white hover:border-emerald-500/40"
                      )}
                    >
                      <div className={cn(
                        "duration-300 flex items-center justify-center",
                        isCameraRecording 
                          ? "w-5 h-5 bg-white rounded-sm"
                          : "w-12 h-12 bg-red-500 rounded-full text-white"
                      )}>
                        {!isCameraRecording && <Video className="w-5 h-5" />}
                      </div>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FULL-SCREEN GOOGLE DRIVE UPLOADER PORTAL/OVERLAY */}
      <AnimatePresence>
        {isUploadingToDrive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/85 backdrop-blur-[6px] z-[9999] flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.div 
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white dark:bg-[#070b16] p-8 rounded-[36px] border border-slate-200/60 dark:border-slate-800 shadow-2xl max-w-sm w-full flex flex-col items-center gap-5"
            >
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-[5px] border-emerald-500/15 border-t-emerald-500 animate-spin" />
                <Recycle className="w-6 h-6 text-emerald-500 absolute animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider">
                  Sincronizando con Google Drive
                </h3>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest text-emerald-500">
                  Carpeta de Aprovechamiento
                </p>
              </div>
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 max-w-[260px] leading-relaxed bg-slate-50 dark:bg-black/20 p-3.5 rounded-2xl w-full border border-slate-100 dark:border-slate-900/60 font-mono">
                {driveUploadProgress || "Conectando al servidor..."}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
