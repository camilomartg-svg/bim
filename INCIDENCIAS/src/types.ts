export type IssueStatus = "ACTIVO" | "RESPONDIDA" | "RESUELTA" | "VENCIDA" | "RECHAZADA" | "ACUERDO" | "ANULADA" | "REVISION_RESPONSABLE";
export type IssueDegreeOfAction = "inmediata" | "urgente" | "pronta" | "posterior" | "menor" | "mayor" | "critica" | "no_aplica";

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  category: "file" | "image" | "video" | "bim_model" | "bim_view" | "plan_pdf" | "plan_dwg";
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  attachments?: Attachment[];
}

export interface Issue {
  id: string;
  code: string;
  title: string;
  type: string; // selection list
  degreeOfAction: IssueDegreeOfAction;
  impact: string[]; // multi-selection
  description: string;
  status: IssueStatus;
  specialty: string;
  
  assignedPosition: string;
  assignedName: string;
  assignedEmail?: string;
  assignedTeam?: string;
  reviewers: string[];
  reviewerEmails?: string[]; // List of positions
  
  creatorId: string;
  creatorName: string;
  creatorPosition?: string;
  creatorTeam?: string;
  authorEmail?: string;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
  dueDate?: string;
  agreementDate?: string;
  rejectionReason?: string;
  comments: Comment[];
  redirectedTo?: {
    name: string;
    position: string;
    email: string;
    team?: string;
    at: string;
  };
  executor?: {
    name: string;
    position: string;
    email: string;
    team?: string;
    at: string;
    approved?: boolean;
    approvedAt?: string;
  };
  collaboratorApproved?: boolean;
  collaboratorApprovedAt?: string;
  principalApproved?: boolean;
  principalApprovedAt?: string;
  metadata?: Record<string, any>;
  locations?: {
    units: string[];
    levels: string[];
    spaces: string[];
  };
  
  // New Campos
  month?: string;
  responsibleCompany?: string;
  economicActivity?: string;
  danger?: string;
  dangerDescription?: string;
  issueClass?: string;
  proposedActionPlan?: string;
  
  fromReport?: boolean;
  sourceReportId?: string;
  sourceReportTitle?: string;
  reportType?: "SITE" | "QUALITY" | "ENVIRONMENTAL";
  
  resolvedAt?: string;
  medicionInicial?: {
    code?: string;
    completed: boolean;
    completedAt?: string;
    completedBy?: string;
    completedByName?: string;
    dueDate: string;
    valoration?: "EFICAZ" | "NO_EFICAZ" | "PENDIENTE";
    notes?: string;
  };
  revisionEficacia?: {
    code?: string;
    completed: boolean;
    completedAt?: string;
    completedBy?: string;
    completedByName?: string;
    dueDate: string;
    valoration?: "EFICAZ" | "NO_EFICAZ" | "PENDIENTE";
    notes?: string;
  };
  extraordinarias?: Array<{
    code: string;
    consecutive: number;
    completedAt: string;
    completedBy: string;
    completedByName: string;
    valoration: "EFICAZ" | "NO_EFICAZ";
    notes: string;
  }>;

  // Stockpile metrics for Environmental Report issues
  acopioLargo?: number;
  acopioAncho?: number;
  acopioAlto?: number;
  acopioDuracionProceso?: number;
  acopioVolumen?: number;
  acopioAreaRecuperada?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "technician" | "client";
  position: string; // Cargo
  team?: string;
}

export interface SiteReportBlock {
  id: string;
  description: string;
  location: {
    units: string[];
    levels: string[];
    spaces: string[];
  };
  attachments: Attachment[];
  issueId?: string; // If converted to issue
  issueStatus?: IssueStatus;
}

export interface SiteReport {
  id: string;
  code: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  creatorId: string;
  creatorName: string;
  creatorPosition: string;
  creatorTeam?: string;
  authorEmail: string;
  assignedPosition: "Director de Obra";
  assignedName: string; 
  assignedEmail: string;
  reviewers: string[]; 
  reviewerEmails: string[];
  blocks: SiteReportBlock[];
  status: "DRAFT" | "FINALIZED";
  reportType?: "SITE" | "QUALITY" | "ENVIRONMENTAL"; // Differentiate reports inside the unified collection
}

export interface QualityReportBlock {
  id: string;
  source: string; // "FUENTE" dropdown
  code: string; // automatic 4-digit code (numeric, e.g. "0001", "0002")
  title?: string; // block / issue title
  hito: string; // "Hito" dropdown
  type: string; // "Tipo" dropdown
  criticality: IssueDegreeOfAction; // uses DEGREE_OF_ACTION keys
  description: string; // text with voice dictation
  correctiveAction: string; // Acción correctiva
  assignedPosition: string; // Responsable asignado
  assignedName: string;
  assignedEmail?: string;
  assignedTeam?: string;
  reviewerCommittee: string[]; // comité de revisión
  implementationSupport: string; // Cuadro de soporte de implementación with voice dictation
  dueDate: string; // fecha de compromiso (commitment date)
  dueDateDays?: number; // custom business/work days picker
  dayType?: "OFICINA" | "OBRA" | "CALENDARIO"; // type of days used for due date calculation
  status: IssueStatus; // Same states
  complianceStatus?: "CUMPLIDA_A_TIEMPO" | "CUMPLIDA_FUERA_DE_TIEMPO" | "POR_VENCERSE" | "CON_RETRASO"; // compliance status
  initialEfficiencyMeasure: string; // Medición inicial eficiencia with voice dictation
  attachments?: Attachment[];
}

export interface EnvironmentalInspectionItem {
  id: string;
  description: string;
  status: "C" | "NC" | "N/A" | "";
  observations: string;
}

export interface EnvironmentalInspectionSection {
  title: string;
  items: EnvironmentalInspectionItem[];
  compliancePercentage: number;
}

export interface EnvironmentalAprovechamientoLog {
  id: string;
  material: "PLASTICO" | "MADERA" | "CHATARRA" | "CARTON" | "PVC" | "PETREOS" | "RESPEL" | "ORDINARIOS";
  quantity: number;
  unit: "KG" | "TON" | "M3";
  recipient: string;
  certificateCode: string;
  date: string;
  observations: string;
  status: "APROVECHADO" | "ACOPIADO" | "DISPUESTO";
  largo?: number;
  ancho?: number;
  alto?: number;
  fondo?: number;
  duracionProceso?: number;
  volumenReutilizado?: number;
  areaRecuperada?: number;
  materialSNR?: string;
  densidadSNR?: number;
  units?: Array<{
    id: string;
    largo: number;
    ancho: number;
    alto: number;
    volume: number;
    area: number;
    torres?: number;
    unidades?: number;
  }>;
}

export interface QualityReport {
  id: string;
  code: string; // automatically generated (e.g. INF-CAL-0001)
  title: string;
  createdAt: string;
  updatedAt: string;
  creatorId: string;
  creatorName: string;
  creatorPosition: string;
  creatorTeam?: string;
  authorEmail?: string;
  blocks: QualityReportBlock[];
  status: "DRAFT" | "FINALIZED" | "CERRADO";
  reportType: "QUALITY" | "ENVIRONMENTAL"; // Differentiate reports inside the unified collection
  subtype?: "INSPECCION" | "APROVECHAMIENTO";
  sections?: EnvironmentalInspectionSection[];
  logs?: EnvironmentalAprovechamientoLog[];
  
  // Aprovechamiento extended metadata
  startDate?: string;
  endDate?: string;
  responsibleName?: string;
  responsibleEmail?: string;
  responsiblePosition?: string;
  processDescription?: string;
  mediaFiles?: Array<{
    name: string;
    url: string;
    type: 'image' | 'video';
  }>;
  mediaDuring?: Array<{
    name: string;
    url: string;
    type: 'image' | 'video';
  }>;
  mediaFinal?: Array<{
    name: string;
    url: string;
    type: 'image' | 'video';
  }>;
  planName?: string;
  planUrl?: string;
  planMarkedArea?: {
    x: number;
    y: number;
    w: number;
    h: number;
  } | null;
}

export interface TeamMember {
  id: string;
  position: string;
  name: string;
  email: string;
  team?: string;
}

export interface UnitLevel {
  id: string;
  name: string;
}

export interface UnitSpace {
  id: string;
  name: string;
  levelName?: string;
}

export interface StructuralUnit {
  id: string;
  name: string;
  levels: UnitLevel[];
  spaces: UnitSpace[];
}

export interface BaseOverride {
  fieldVisibility?: Record<string, boolean>;
  issueTypes?: string[];
  impactOptions?: string[];
  units?: string[];
  allowedTeams?: string[];
  allowedRoles?: string[];
  allowedUserEmails?: string[];
  allowedUserIds?: string[];
  allowedCreatorAll?: boolean;
  allowedCreatorTeams?: string[];
  allowedCreatorRoles?: string[];
  allowedCreatorUserEmails?: string[];
  allowedCreatorUserIds?: string[];
  allowedReceiverAll?: boolean;
  allowedReceiverTeams?: string[];
  allowedReceiverRoles?: string[];
  allowedReceiverUserEmails?: string[];
  allowedReceiverUserIds?: string[];
}

export interface TypeOverride extends BaseOverride {}
export interface RoleOverride extends BaseOverride {}

export interface ProjectConfig {
  roleVisibility?: Record<string, Record<string, boolean>>; // Legacy
  roleOverrides?: Record<string, RoleOverride>; 
  typeOverrides?: Record<string, TypeOverride>; // New standardized overrides based on Issue Type
  fieldVisibility?: Record<string, boolean>; // Global fallback
  impactOptions: string[];
  issueTypes?: string[];
  economicActivities?: string[];
  dangers?: string[];
  responsibleCompanies?: string[];
  dangerDescriptions?: Record<string, string[]>;
  teams?: string[];
  qualitySources?: string[];
  qualityCodeStart?: string;
  qualityHitos?: string[];
  qualityTypes?: string[];
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  issueId: string;
  read: boolean;
  createdAt: string;
}

export const ISSUE_TYPES = [
  "Informe Ambiental",
  "Actividad no ejecutada",
  "Calidad del equipo o herramienta",
  "Calidad mano de obra",
  "Calidad o defecto de material",
  "No cumple especificación de diseño",
  "No cumple Norma"
];

export const IMPACT_OPTIONS = [
  "AFECTA EL AVANCE DE OBRA",
  "AFECTA EL INICIO DE OBRA",
  "AFECTA ENTREGA A PROPIETARIOS",
  "AFECTA LA INSTALACION DEL GAS",
  "AFECTA LA RUTA CRÍTICA",
  "AFECTA LAS CERTIFICACIONES (RETIE - TO)",
  "AFECTA SERVICIOS PÚBLICOS",
  "NINGUNA"
];

export const DEGREE_OF_ACTION = {
  inmediata: { label: "INMEDIATA", color: "#FF0000" },
  urgente: { label: "URGENTE", color: "#FFC000" },
  pronta: { label: "PRONTA", color: "#92D050" },
  posterior: { label: "POSTERIOR", color: "#00B050" },
  menor: { label: "MENOR", color: "#00B050" },
  mayor: { label: "MAYOR", color: "#FFC000" },
  critica: { label: "CRÍTICA", color: "#FF0000" },
  no_aplica: { label: "NO APLICA", color: "#94A3B8" }
};
