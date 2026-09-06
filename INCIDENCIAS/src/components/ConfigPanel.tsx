import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  CheckCircle, 
  Eye, 
  EyeOff, 
  Layout, 
  FileText, 
  MapPin, 
  User, 
  Calendar,
  Zap, 
  Plus, 
  Trash2, 
  Database,
  Users,
  X,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  GripVertical,
  Loader2,
  Paperclip,
  Copy,
  PlusSquare,
  Hash,
  Search,
  Building2,
  Briefcase,
  AlertTriangle,
  ShieldAlert,
  ClipboardList,
  Check,
  Leaf,
  Info
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { cn } from '../lib/utils';
import { IMPACT_OPTIONS, ISSUE_TYPES, TypeOverride, StructuralUnit, UnitLevel, UnitSpace, TeamMember } from '../types';
import { MONTHS, DEFAULT_ECONOMIC_ACTIVITIES, DEFAULT_DANGERS, DANGER_DESCRIPTIONS, PRIORITY_CLASS_MAP } from '../constants';
import { 
  getProjectConfig, 
  saveProjectConfig, 
  subscribeToTeam, 
  saveTeamMember, 
  deleteTeamMember,
  subscribeToUnits,
  saveUnit,
  deleteUnit
} from '../services/firebaseService';

export interface FieldConfig {
  id: string;
  label: string;
  icon: any;
  visible: boolean;
}

const DEFAULT_CONFIG: FieldConfig[] = [
  { id: 'type', label: 'Tipo de Incidencia', icon: FileText, visible: true },
  { id: 'degreeOfAction', label: 'Grado de Acción', icon: Zap, visible: true },
  { id: 'impact', label: 'Afectación del Proyecto', icon: Layout, visible: true },
  { id: 'assignedPosition', label: 'Responsable Asignado', icon: User, visible: true },
  { id: 'reviewers', label: 'Revisores Adicionales', icon: User, visible: true },
  { id: 'dueDate', label: 'Fecha de Vencimiento', icon: Calendar, visible: true },
  { id: 'attachments', label: 'Documentación y Evidencia', icon: Paperclip, visible: true },
  { id: 'month', label: 'Mes', icon: Calendar, visible: true },
  { id: 'responsibleCompany', label: 'Empresa Responsable', icon: Building2, visible: true },
  { id: 'economicActivity', label: 'Actividad Económica', icon: Briefcase, visible: true },
  { id: 'danger', label: 'Peligros', icon: AlertTriangle, visible: true },
  { id: 'dangerDescription', label: 'Descripción del Peligro', icon: ShieldAlert, visible: true },
  { id: 'issueClass', label: 'Clase', icon: Hash, visible: true },
  { id: 'proposedActionPlan', label: 'Plan de Acción Propuesto', icon: ClipboardList, visible: true },
];

const MOCK_TEAM = [
  { id: '1', position: "Interventor Eléctrico", name: "Juan Pérez", email: "juan.perez@constructora.com" },
  { id: '2', position: "Arquitecto Residente", name: "María García", email: "m.garcia@imagina.com" },
  { id: '3', position: "Ingeniero Hidráulico", name: "Carlos Ruiz", email: "cruiz@servicios.com" },
  { id: '4', position: "Residente SST", name: "Ana López", email: "alopez@obra.com" },
  { id: '5', position: "Director de Obra", name: "Roberto Gómez", email: "rgomez@bim.com" },
];

type ConfigTab = 'fields' | 'types' | 'impacts' | 'units' | 'activities' | 'dangers' | 'companies' | 'qualityReportConfig' | 'reportPermissions';

// Sub-component for a Structural Unit Row to handle local state and avoid re-render performance issues
function UnitRow({ 
  unit, 
  onDelete,
  selectedScope, 
  configMode,
  overrides, 
  setOverrides,
  onBulkOpen,
  allScopes
}: { 
  unit: StructuralUnit, 
  onDelete: (id: string) => void,
  selectedScope: string,
  configMode: 'role' | 'type',
  overrides: Record<string, any>,
  setOverrides: React.Dispatch<React.SetStateAction<Record<string, any>>>,
  onBulkOpen: () => void,
  allScopes: string[]
}) {
  const [localName, setLocalName] = useState(unit.name);
  const [localLevels, setLocalLevels] = useState<UnitLevel[]>(unit.levels);
  const [localSpaces, setLocalSpaces] = useState<UnitSpace[]>(unit.spaces);
  const [isEditing, setIsEditing] = useState(false);

  // Sync local state when unit prop changes, but ONLY if not currently focused
  useEffect(() => {
    if (!isEditing) {
      setLocalName(unit.name);
      setLocalLevels(unit.levels);
      setLocalSpaces(unit.spaces);
    }
  }, [unit, isEditing]);

  const commitUnit = (updates: Partial<StructuralUnit>) => {
    const updatedUnit = { ...unit, ...updates };
    saveUnit(updatedUnit);
  };

  return (
    <div className="p-8 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-[2rem] space-y-8 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-sm",
            selectedScope === 'GLOBAL' ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" : (overrides[selectedScope]?.units?.includes(unit.id) ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-slate-200 dark:bg-slate-800 text-slate-400")
          )}>
             <MapPin className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <input 
              type="text" 
              value={localName} 
              onFocus={() => setIsEditing(true)}
              onChange={(e) => setLocalName(e.target.value.toUpperCase())}
              onBlur={() => {
                setIsEditing(false);
                if (localName !== unit.name) {
                  commitUnit({ name: localName });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="bg-transparent border-none text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight focus:ring-0 outline-none w-full border-b border-transparent hover:border-slate-200 focus:border-emerald-500 transition-all font-mono"
              placeholder="ESTABLECER NOMBRE..."
            />
            {selectedScope !== 'GLOBAL' && (
              <p className={cn(
                "text-[8px] font-black uppercase tracking-widest mt-1 flex items-center gap-1.5", 
                overrides[selectedScope]?.units?.includes(unit.id) ? "text-emerald-500" : "text-slate-400"
              )}>
                {overrides[selectedScope]?.units?.includes(unit.id) 
                  ? <><CheckCircle className="w-2.5 h-2.5" /> VISIBLE PARA ESTE {configMode === 'type' ? 'TIPO' : 'ROL'}</> 
                  : <><EyeOff className="w-2.5 h-2.5" /> OCULTO (ID: {unit.id.substring(0,4)})</>}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {selectedScope === 'GLOBAL' && (
            <div className="flex items-center gap-2 mr-4">
              <button 
                onClick={async () => {
                  const updatedOverrides = { ...overrides };
                  allScopes.forEach(scope => {
                    const currentUnits = updatedOverrides[scope]?.units || [];
                    if (!currentUnits.includes(unit.id)) {
                      updatedOverrides[scope] = {
                        ...(updatedOverrides[scope] || {}),
                        units: [...currentUnits, unit.id]
                      };
                    }
                  });
                  setOverrides(updatedOverrides);
                  const fbConfig = await getProjectConfig();
                  const key = 'typeOverrides';
                  await saveProjectConfig({ ...fbConfig, [key]: updatedOverrides });
                  window.dispatchEvent(new Event('storage_settings_updated'));
                }}
                className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all whitespace-nowrap"
              >
                Activar para todos
              </button>
              <button 
                onClick={async () => {
                  const updatedOverrides = { ...overrides };
                  allScopes.forEach(scope => {
                    const currentUnits = updatedOverrides[scope]?.units || [];
                    if (currentUnits.includes(unit.id)) {
                      updatedOverrides[scope] = {
                        ...(updatedOverrides[scope] || {}),
                        units: currentUnits.filter(id => id !== unit.id)
                      };
                    }
                  });
                  setOverrides(updatedOverrides);
                  const fbConfig = await getProjectConfig();
                  const key = 'typeOverrides';
                  await saveProjectConfig({ ...fbConfig, [key]: updatedOverrides });
                  window.dispatchEvent(new Event('storage_settings_updated'));
                }}
                className="px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all whitespace-nowrap"
              >
                Desactivar para todos
              </button>
            </div>
          )}

          {selectedScope !== 'GLOBAL' && (
            <button 
              onClick={async () => {
                const currentUnits = overrides[selectedScope]?.units || [];
                const isCurrentlyActive = currentUnits.includes(unit.id);
                const newUnits = isCurrentlyActive
                  ? currentUnits.filter(id => id !== unit.id)
                  : [...currentUnits, unit.id];
                
                const updatedOverrides = {
                  ...overrides,
                  [selectedScope]: {
                    ...(overrides[selectedScope] || {}),
                    units: newUnits
                  }
                };
                
                setOverrides(updatedOverrides);
                
                // Save immediately to Firebase
                const fbConfig = await getProjectConfig();
                const key = 'typeOverrides';
                await saveProjectConfig({
                  ...fbConfig,
                  [key]: updatedOverrides
                });
                
                window.dispatchEvent(new Event('storage_settings_updated'));
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border flex items-center gap-2",
                overrides[selectedScope]?.units?.includes(unit.id)
                  ? "bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-500/20"
                  : "bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400"
              )}
            >
              {overrides[selectedScope]?.units?.includes(unit.id) ? (
                <><CheckCircle className="w-3.5 h-3.5" /> ACTIVO</>
              ) : (
                <><EyeOff className="w-3.5 h-3.5" /> INACTIVO</>
              )}
            </button>
          )}

          <button 
            onClick={() => onDelete(unit.id)} 
            className="p-2 text-slate-300 hover:text-red-500 transition-all hover:bg-red-500/10 rounded-xl group/del active:scale-90"
            title="Eliminar Unidad"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Levels Column */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Niveles / Pisos</h4>
            <button 
              onClick={() => {
                const newLevel = { id: Date.now().toString(), name: `PISO ${localLevels.length + 1}` };
                const newLevels = [...localLevels, newLevel];
                setLocalLevels(newLevels);
                commitUnit({ levels: newLevels });
              }}
              className="text-[8px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400 transition-colors"
            >
              + Agregar Piso
            </button>
          </div>
          <div className="space-y-3">
            {localLevels
              .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
              .map((lvl) => (
              <div key={lvl.id} className="flex items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 group shadow-sm hover:border-slate-300 transition-all">
                <GripVertical className="w-4 h-4 text-slate-200 dark:text-slate-800" />
                <input 
                  type="text" 
                  value={lvl.name} 
                  onFocus={() => setIsEditing(true)}
                  onChange={(e) => {
                    const newName = e.target.value.toUpperCase();
                    setLocalLevels(localLevels.map(l => l.id === lvl.id ? { ...l, name: newName } : l));
                  }}
                  onBlur={() => {
                    setIsEditing(false);
                    commitUnit({ levels: localLevels });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="flex-1 bg-transparent border-none text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight focus:ring-0 outline-none"
                />
                <button 
                  onClick={() => {
                    const newLevels = localLevels.filter(l => l.id !== lvl.id);
                    setLocalLevels(newLevels);
                    commitUnit({ levels: newLevels });
                  }}
                  className="opacity-100 p-1.5 text-slate-300 dark:text-slate-700 hover:text-red-500 transition-all font-bold"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Spaces Column */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Espacios Específicos</h4>
            <div className="flex items-center gap-4">
              <button 
                onClick={onBulkOpen}
                className="text-[8px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-400 transition-colors flex items-center gap-1.5"
              >
                <Copy className="w-3 h-3" /> Generación Masiva
              </button>
              <button 
                onClick={() => {
                  const newSpace = { 
                    id: Date.now().toString(), 
                    name: 'NUEVO ESPACIO', 
                    levelName: localLevels[0]?.name 
                  };
                  const newSpaces = [...localSpaces, newSpace];
                  setLocalSpaces(newSpaces);
                  commitUnit({ spaces: newSpaces });
                }}
                className="text-[8px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-1.5"
              >
                <PlusSquare className="w-3 h-3" /> Agregar Espacio
              </button>
            </div>
          </div>
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {localSpaces
              .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
              .map((space) => (
              <div key={space.id} className="flex items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 group shadow-sm hover:border-blue-500/20 transition-all">
                <div className="flex-1 space-y-1">
                  <input 
                    type="text" 
                    value={space.name} 
                    onFocus={() => setIsEditing(true)}
                    onChange={(e) => {
                      const newName = e.target.value.toUpperCase();
                      setLocalSpaces(localSpaces.map(s => s.id === space.id ? { ...s, name: newName } : s));
                    }}
                    onBlur={() => {
                      setIsEditing(false);
                      commitUnit({ spaces: localSpaces });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-full bg-transparent border-none text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight focus:ring-0 outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Nivel:</span>
                    <select 
                      value={space.levelName || ''} 
                      onChange={(e) => {
                        const newSpaces = localSpaces.map(s => s.id === space.id ? { ...s, levelName: e.target.value } : s);
                        setLocalSpaces(newSpaces);
                        commitUnit({ spaces: newSpaces });
                      }}
                      className="bg-transparent border-none text-[8px] font-black text-emerald-500 uppercase tracking-widest focus:ring-0 outline-none cursor-pointer hover:text-emerald-400"
                    >
                      <option value="">SIN NIVEL</option>
                      {localLevels.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                    </select>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    const newSpaces = localSpaces.filter(s => s.id !== space.id);
                    setLocalSpaces(newSpaces);
                    commitUnit({ spaces: newSpaces });
                  }}
                  className="opacity-100 p-1.5 text-slate-300 dark:text-slate-700 hover:text-red-500 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {localSpaces.length === 0 && <p className="text-center py-4 text-[8px] font-black text-slate-300 dark:text-slate-800 uppercase tracking-widest italic">Sin espacios creados</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function DangerItem({ 
  danger, 
  updateItem, 
  removeItem, 
  dangerDescriptionsMap, 
  setDangerDescriptionsMap 
}: { 
  danger: {id: string, name: string}, 
  updateItem: any, 
  removeItem: any, 
  dangerDescriptionsMap: Record<string, string[]>, 
  setDangerDescriptionsMap: any 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const descs = dangerDescriptionsMap[danger.name] || [];

  return (
    <div key={danger.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:border-slate-400 dark:hover:border-slate-700 transition-all">
      <div className="flex items-center gap-4 p-5">
        <input 
          type="text" 
          value={danger.name} 
          onChange={(e) => updateItem('danger', danger.id, e.target.value)}
          className="flex-1 bg-transparent border-none text-slate-900 dark:text-white text-sm font-bold focus:ring-0 outline-none uppercase tracking-tight"
        />
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg shadow-sm"
          >
            Descripciones ({descs.length})
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button onClick={() => removeItem('danger', danger.id)} className="p-2 text-slate-300 dark:text-slate-800 hover:text-red-500 transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-200 dark:border-slate-800 p-6 bg-white dark:bg-slate-900/30"
          >
            <div className="space-y-3 mb-4">
              {descs.map((d, dIdx) => (
                <div key={dIdx} className="flex gap-2 items-center">
                  <input 
                    type="text"
                    value={d}
                    onChange={(e) => {
                      const newDescs = [...descs];
                      newDescs[dIdx] = e.target.value.toUpperCase();
                      setDangerDescriptionsMap({ ...dangerDescriptionsMap, [danger.name]: newDescs });
                    }}
                    className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight outline-none focus:border-blue-500"
                  />
                  <button 
                    onClick={() => {
                      const newDescs = descs.filter((_, i) => i !== dIdx);
                      setDangerDescriptionsMap({ ...dangerDescriptionsMap, [danger.name]: newDescs });
                    }}
                    className="text-slate-300 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button 
              onClick={() => {
                const newDescs = [...descs, 'NUEVA DESCRIPCIÓN'];
                setDangerDescriptionsMap({ ...dangerDescriptionsMap, [danger.name]: newDescs });
              }}
              className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-500 hover:border-blue-500/50 transition-all rounded-xl"
            >
              + Agregar Descripción Específica
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ConfigPanel() {
  const [activeTab, setActiveTab] = useState<ConfigTab>('fields');
  const [config, setConfig] = useState<FieldConfig[]>(DEFAULT_CONFIG);
  const [typeOverrides, setTypeOverrides] = useState<Record<string, TypeOverride>>({});
  const [selectedConfigKey, setSelectedConfigKey] = useState<string>('GLOBAL');
  const [configMode, setConfigMode] = useState<'type'>('type'); // Only type allowed now
  
  // Global defaults
  const [globalImpacts, setGlobalImpacts] = useState<string[]>(IMPACT_OPTIONS);
  const [globalTypes, setGlobalTypes] = useState<string[]>(ISSUE_TYPES);
  const [globalActivities, setGlobalActivities] = useState<string[]>(DEFAULT_ECONOMIC_ACTIVITIES);
  const [globalDangers, setGlobalDangers] = useState<string[]>(DEFAULT_DANGERS);
  const [globalCompanies, setGlobalCompanies] = useState<string[]>([]);
  const [globalTeams, setGlobalTeams] = useState<string[]>([]);
  const [globalDangerDescriptions, setGlobalDangerDescriptions] = useState<Record<string, string[]>>(DANGER_DESCRIPTIONS);
  const [globalFields, setGlobalFields] = useState<FieldConfig[]>(DEFAULT_CONFIG);
  const [globalTeam, setGlobalTeam] = useState<TeamMember[]>([]);
  
  // Buffer state for currently edited scope
  const [impacts, setImpacts] = useState<{id: string, name: string}[]>([]);
  const [types, setTypes] = useState<{id: string, name: string}[]>([]);
  const [activities, setActivities] = useState<{id: string, name: string}[]>([]);
  const [dangers, setDangers] = useState<{id: string, name: string}[]>([]);
  const [companies, setCompanies] = useState<{id: string, name: string}[]>([]);
  const [teamsList, setTeamsList] = useState<{id: string, name: string}[]>([]);
  const [dangerDescriptionsMap, setDangerDescriptionsMap] = useState<Record<string, string[]>>(DANGER_DESCRIPTIONS);
  const [team, setTeam] = useState<{id: string, position: string, name: string, email: string, team?: string}[]>([]);
  const [units, setUnits] = useState<StructuralUnit[]>([]);
  const [allowedCreatorTeams, setAllowedCreatorTeams] = useState<string[]>([]);
  const [allowedCreatorRoles, setAllowedCreatorRoles] = useState<string[]>([]);
  const [allowedCreatorUserEmails, setAllowedCreatorUserEmails] = useState<string[]>([]);
  const [allowedCreatorUserIds, setAllowedCreatorUserIds] = useState<string[]>([]);
  const [allowedCreatorAll, setAllowedCreatorAll] = useState<boolean>(false);

  const [allowedReceiverTeams, setAllowedReceiverTeams] = useState<string[]>([]);
  const [allowedReceiverRoles, setAllowedReceiverRoles] = useState<string[]>([]);
  const [allowedReceiverUserEmails, setAllowedReceiverUserEmails] = useState<string[]>([]);
  const [allowedReceiverUserIds, setAllowedReceiverUserIds] = useState<string[]>([]);
  const [allowedReceiverAll, setAllowedReceiverAll] = useState<boolean>(false);

  const [permSubTab, setPermSubTab] = useState<'creator' | 'receiver'>('creator');
  
  // Control/Quality Report configuration
  const [qualitySources, setQualitySources] = useState<{id: string, name: string, abbreviation?: string}[]>([]);
  const [qualityHitos, setQualityHitos] = useState<{id: string, name: string}[]>([]);
  const [qualityTypes, setQualityTypes] = useState<{id: string, name: string, abbreviation?: string}[]>([]);
  const [qualityCodeStart, setQualityCodeStart] = useState<string>("0001");
  
  // Report tab view permissions by task teams
  const [siteReportsAllowedTeams, setSiteReportsAllowedTeams] = useState<string[]>([]);
  const [qualityReportsAllowedTeams, setQualityReportsAllowedTeams] = useState<string[]>([]);
  const [environmentalReportsAllowedTeams, setEnvironmentalReportsAllowedTeams] = useState<string[]>([]);
  
  // States for bulk generation
  const [bulkTargetUnit, setBulkTargetUnit] = useState<number | null>(null);
  const [bulkMode, setBulkMode] = useState<'single' | 'tower'>('single');
  const [bulkFormat, setBulkFormat] = useState({
    prefix: 'APTO',
    start: 1,
    count: 10,
    level: '',
    levelPrefix: 'PISO',
    levelStart: 1,
    levelEnd: 10
  });

  const [showSaved, setShowSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let unsubscribeTeam: (() => void) | null = null;
    let unsubscribeUnits: (() => void) | null = null;

    async function loadData() {
      setIsLoading(true);
      try {
        const fbConfig = await getProjectConfig();
        if (!active) return;
        if (fbConfig) {
          setTypeOverrides(fbConfig.typeOverrides || {});
          
          // Load Global defaults
          const gTypes = fbConfig.issueTypes || ISSUE_TYPES;
          const gImpacts = fbConfig.impactOptions || IMPACT_OPTIONS;
          const gActivities = fbConfig.economicActivities || DEFAULT_ECONOMIC_ACTIVITIES;
          const gDangers = fbConfig.dangers || DEFAULT_DANGERS;
          const gCompanies = fbConfig.responsibleCompanies || [];
          const gTeams = fbConfig.teams || [];
          const gDangerDescs = fbConfig.dangerDescriptions || DANGER_DESCRIPTIONS;
          const gFields = DEFAULT_CONFIG.map(def => ({
            ...def,
            visible: fbConfig.fieldVisibility?.[def.id] ?? def.visible
          }));
          
          setGlobalTypes(gTypes);
          setGlobalImpacts(gImpacts);
          setGlobalActivities(gActivities);
          setGlobalDangers(gDangers);
          setGlobalCompanies(gCompanies);
          setGlobalTeams(gTeams);
          setGlobalDangerDescriptions(gDangerDescs);
          setGlobalFields(gFields);

          // Load Quality Report Defaults
          const qSources = fbConfig.qualitySources || [
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
          const qHitos = fbConfig.qualityHitos || [
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
          const qTypes = fbConfig.qualityTypes || [
            "Conformidad",
            "No Conformidad",
            "Oportunidad de mejora",
            "Accidente de Trabajo",
            "Accidente de Trabajo Mortal",
            "Alerta de seguridad"
          ];
          const qCodeStart = fbConfig.qualityCodeStart || "0001";

          setQualitySources(qSources.map((v: string) => {
            const match = v.match(/^(.*?)\s*\[([A-Z]{1,3})\]\s*$/);
            return {
              id: Math.random().toString(36).substr(2, 9),
              name: match ? match[1].trim() : v,
              abbreviation: match ? match[2].toUpperCase() : ''
            };
          }));
          setQualityHitos(qHitos.map((v: string) => ({ id: Math.random().toString(36).substr(2, 9), name: v })));
          setQualityTypes(qTypes.map((v: string) => {
            const match = v.match(/^(.*?)\s*\[([A-Z]{1,3})\]\s*$/);
            return {
              id: Math.random().toString(36).substr(2, 9),
              name: match ? match[1].trim() : v,
              abbreviation: match ? match[2].toUpperCase() : ''
            };
          }));
          setQualityCodeStart(qCodeStart);

          setSiteReportsAllowedTeams(fbConfig.siteReportsAllowedTeams || fbConfig.siteReportsAllowedProfiles || []);
          setQualityReportsAllowedTeams(fbConfig.qualityReportsAllowedTeams || fbConfig.qualityReportsAllowedProfiles || []);
          setEnvironmentalReportsAllowedTeams(fbConfig.environmentalReportsAllowedTeams || fbConfig.environmentalReportsAllowedProfiles || []);

          // Fallback for types and impacts if explicitly set on root (legacy/shared)
          if (selectedConfigKey === 'GLOBAL') {
            setImpacts(gImpacts.map(v => ({ id: Math.random().toString(36).substr(2, 9), name: v })));
            setTypes(gTypes.map(v => ({ id: Math.random().toString(36).substr(2, 9), name: v })));
            setActivities(gActivities.map(v => ({ id: Math.random().toString(36).substr(2, 9), name: v })));
            setDangers(gDangers.map(v => ({ id: Math.random().toString(36).substr(2, 9), name: v })));
            setCompanies(gCompanies.map(v => ({ id: Math.random().toString(36).substr(2, 9), name: v })));
            setTeamsList(gTeams.map(v => ({ id: Math.random().toString(36).substr(2, 9), name: v })));
            setDangerDescriptionsMap(gDangerDescs);
            setConfig(gFields);
          }
        }
      } catch (err) {
        console.error("Error loading config inside ConfigPanel:", err);
      }

      try {
        unsubscribeTeam = subscribeToTeam((fetchedTeam) => {
          if (active) setGlobalTeam(fetchedTeam);
        });
      } catch (err) {
        console.error("Error subscribing to team in ConfigPanel:", err);
      }

      try {
        unsubscribeUnits = subscribeToUnits((fetchedUnits) => {
          if (active) setUnits(fetchedUnits);
        });
      } catch (err) {
        console.error("Error subscribing to units in ConfigPanel:", err);
      }

      if (active) setIsLoading(false);
    }

    loadData();

    return () => {
      active = false;
      if (unsubscribeTeam) unsubscribeTeam();
      if (unsubscribeUnits) unsubscribeUnits();
    };
  }, []);

  const lastSyncedRoleRef = React.useRef<string | null>(null);

  const [allRoles, setAllRoles] = useState<string[]>([]);

  useEffect(() => {
    const roles = Array.from(new Set(globalTeam.map(m => m.position).filter(Boolean))).sort();
    setAllRoles(roles);
  }, [globalTeam]);

  useEffect(() => {
    if (isLoading) return;
    
    // Explicitly sync buffer states ONLY when the role/type actually changes
    if (lastSyncedRoleRef.current === selectedConfigKey) {
      return;
    }
    lastSyncedRoleRef.current = selectedConfigKey;

    if (selectedConfigKey === 'GLOBAL') {
      setImpacts(globalImpacts.map(v => ({ id: Math.random().toString(36).substr(2, 9), name: v })));
      setTypes(globalTypes.map(v => ({ id: Math.random().toString(36).substr(2, 9), name: v })));
      setActivities(globalActivities.map(v => ({ id: Math.random().toString(36).substr(2, 9), name: v })));
      setDangers(globalDangers.map(v => ({ id: Math.random().toString(36).substr(2, 9), name: v })));
      setCompanies(globalCompanies.map(v => ({ id: Math.random().toString(36).substr(2, 9), name: v })));
      setTeamsList(globalTeams.map(v => ({ id: Math.random().toString(36).substr(2, 9), name: v })));
      setDangerDescriptionsMap(globalDangerDescriptions);
      setConfig(globalFields);
      setTeam(globalTeam);
    } else {
      const override = typeOverrides[selectedConfigKey] || {};
      
      const roleImpacts = (override.impactOptions || globalImpacts).map(v => ({ id: Math.random().toString(36).substr(2, 9), name: v }));
      const roleTypes = (override.issueTypes || globalTypes).map(v => ({ id: Math.random().toString(36).substr(2, 9), name: v }));
      const roleFields = DEFAULT_CONFIG.map(def => ({
        ...def,
        visible: override.fieldVisibility?.[def.id] ?? (globalFields.find(gf => gf.id === def.id)?.visible ?? def.visible)
      }));

      setImpacts(roleImpacts);
      setTypes(roleTypes);
      setConfig(roleFields);
      
      const legacyTeams = override.allowedTeams || [];
      const legacyRoles = override.allowedRoles || [];
      const legacyEmails = override.allowedUserEmails || [];
      const legacyIds = override.allowedUserIds || [];

      setAllowedCreatorTeams(override.allowedCreatorTeams !== undefined ? override.allowedCreatorTeams : legacyTeams);
      setAllowedCreatorRoles(override.allowedCreatorRoles !== undefined ? override.allowedCreatorRoles : legacyRoles);
      setAllowedCreatorUserEmails(override.allowedCreatorUserEmails !== undefined ? override.allowedCreatorUserEmails : legacyEmails);
      setAllowedCreatorUserIds(override.allowedCreatorUserIds !== undefined ? override.allowedCreatorUserIds : legacyIds);
      setAllowedCreatorAll(override.allowedCreatorAll !== undefined ? override.allowedCreatorAll : false);

      setAllowedReceiverTeams(override.allowedReceiverTeams !== undefined ? override.allowedReceiverTeams : legacyTeams);
      setAllowedReceiverRoles(override.allowedReceiverRoles !== undefined ? override.allowedReceiverRoles : legacyRoles);
      setAllowedReceiverUserEmails(override.allowedReceiverUserEmails !== undefined ? override.allowedReceiverUserEmails : legacyEmails);
      setAllowedReceiverUserIds(override.allowedReceiverUserIds !== undefined ? override.allowedReceiverUserIds : legacyIds);
      setAllowedReceiverAll(override.allowedReceiverAll !== undefined ? override.allowedReceiverAll : false);
      
      // Remove legacy teamIds check as it's replaced by allowedTeams/Roles/Emails
      setTeam(globalTeam);
    }
  }, [selectedConfigKey, configMode, isLoading, globalTeam]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
    const currentVisibility = config.reduce((acc, f) => ({ ...acc, [f.id]: f.visible }), {});
    const impactData = impacts.map(i => i.name).filter(i => i.trim() !== '');
    const typeData = types.map(t => t.name).filter(t => t.trim() !== '');
    const activityData = activities.map(a => a.name).filter(a => a.trim() !== '');
    const dangerData = dangers.map(d => d.name).filter(d => d.trim() !== '');
    const companyData = companies.map(c => c.name).filter(c => c.trim() !== '');
    const teamListData = teamsList.map(t => t.name).filter(t => t.trim() !== '');
    
    const qualitySourcesData = qualitySources.map(s => {
      const name = s.name.trim();
      const abb = s.abbreviation?.trim().toUpperCase();
      return abb ? `${name} [${abb}]` : name;
    }).filter(s => s.trim() !== '');
    const qualityHitosData = qualityHitos.map(h => h.name).filter(h => h.trim() !== '');
    const qualityTypesData = qualityTypes.map(t => {
      const name = t.name.trim();
      const abb = t.abbreviation?.trim().toUpperCase();
      return abb ? `${name} [${abb}]` : name;
    }).filter(t => t.trim() !== '');
    
    // Always update global activities and dangers because they are shared lists
    let newGlobalActivities = activityData;
    let newGlobalDangers = dangerData;
    let newGlobalCompanies = companyData;
    let newGlobalTeams = teamListData;
    let newGlobalDangerDescriptions = dangerDescriptionsMap;

    setGlobalActivities(activityData);
    setGlobalDangers(dangerData);
    setGlobalCompanies(companyData);
    setGlobalTeams(teamListData);
    setGlobalDangerDescriptions(dangerDescriptionsMap);

    let newGlobalFields = globalFields;
    let newGlobalImpacts = globalImpacts;
    let newGlobalTypes = globalTypes;
    let newTypeOverrides = { ...typeOverrides };

    if (selectedConfigKey === 'GLOBAL') {
      newGlobalFields = config;
      newGlobalImpacts = impactData;
      newGlobalTypes = typeData;
      
      setGlobalFields(config);
      setGlobalImpacts(impactData);
      setGlobalTypes(typeData);
      
      for (const member of team) {
        await saveTeamMember(member);
      }
    } else if (configMode === 'type') {
      const existingOverride = typeOverrides[selectedConfigKey] || {};
      newTypeOverrides[selectedConfigKey] = {
        ...existingOverride,
        fieldVisibility: currentVisibility,
        impactOptions: impactData,
        issueTypes: typeData,
        // Legacy fallbacks map to receivers
        allowedTeams: allowedReceiverTeams,
        allowedRoles: allowedReceiverRoles,
        allowedUserEmails: allowedReceiverUserEmails,
        allowedUserIds: allowedReceiverUserIds,

        allowedCreatorTeams,
        allowedCreatorRoles,
        allowedCreatorUserEmails,
        allowedCreatorUserIds,
        allowedCreatorAll,

        allowedReceiverTeams,
        allowedReceiverRoles,
        allowedReceiverUserEmails,
        allowedReceiverUserIds,
        allowedReceiverAll
      };
      setTypeOverrides(newTypeOverrides);
    }
    
    // Get existing config to preserve roleOverrides if any exist in DB
    const fbConfig = await getProjectConfig();
    
    const configToSave = {
      ...fbConfig,
      fieldVisibility: newGlobalFields.reduce((acc, f) => ({ ...acc, [f.id]: f.visible }), {}),
      impactOptions: newGlobalImpacts,
      issueTypes: newGlobalTypes,
      economicActivities: newGlobalActivities,
      dangers: newGlobalDangers,
      responsibleCompanies: newGlobalCompanies,
      teams: newGlobalTeams,
      dangerDescriptions: newGlobalDangerDescriptions,
      typeOverrides: newTypeOverrides,
      qualitySources: qualitySourcesData,
      qualityHitos: qualityHitosData,
      qualityTypes: qualityTypesData,
      qualityCodeStart: qualityCodeStart,
      siteReportsAllowedTeams: siteReportsAllowedTeams,
      qualityReportsAllowedTeams: qualityReportsAllowedTeams,
      environmentalReportsAllowedTeams: environmentalReportsAllowedTeams,
      siteReportsAllowedProfiles: siteReportsAllowedTeams,
      qualityReportsAllowedProfiles: qualityReportsAllowedTeams,
      environmentalReportsAllowedProfiles: environmentalReportsAllowedTeams
    };
    await saveProjectConfig(configToSave);

    // Note: team members saved above in the GLOBAL check or if needed individually
    // If we are in an override, we only saved to projectConfig.typeOverrides.team
    
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
    window.dispatchEvent(new Event('storage_settings_updated'));
    } catch (error: any) {
      console.error('Error saving Incidencias configuration:', error);
      alert(`No se pudo guardar la configuración en Google Drive.\n\n${error?.message || String(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkGenerate = async () => {
    if (bulkTargetUnit === null) return;
    const unit = units[bulkTargetUnit];
    let newSpaces = [...unit.spaces];
    let newLevels = [...unit.levels];
    
    if (bulkMode === 'single') {
      const levelNum = bulkFormat.level.match(/\d+/)?.[0] || '';
      for (let i = 0; i < bulkFormat.count; i++) {
        const suffixNum = bulkFormat.start + i;
        const suffixStr = suffixNum.toString().padStart(2, '0');
        const spaceNumStr = levelNum ? `${levelNum}${suffixStr}` : `${suffixNum}`;
        
        newSpaces.push({
          id: 's-' + Math.random().toString(36).substr(2, 9),
          name: `${bulkFormat.prefix} ${spaceNumStr}`,
          levelName: bulkFormat.level || undefined
        });
      }
    } else {
      for (let l = bulkFormat.levelStart; l <= bulkFormat.levelEnd; l++) {
        const targetLevelName = `${bulkFormat.levelPrefix.trim()} ${l}`.trim();
        
        const existingLevel = newLevels.find(lvl => 
          lvl.name.trim().toLowerCase() === targetLevelName.toLowerCase()
        );
        
        let levelToUse: string;
        if (!existingLevel) {
          const newLevelId = 'l-' + Math.random().toString(36).substr(2, 9);
          newLevels.push({ id: newLevelId, name: targetLevelName });
          levelToUse = targetLevelName;
        } else {
          levelToUse = existingLevel.name;
        }

        for (let i = 0; i < bulkFormat.count; i++) {
          const suffixNum = bulkFormat.start + i;
          const suffixStr = suffixNum.toString().padStart(2, '0');
          const spaceNumStr = `${l}${suffixStr}`;
          
          newSpaces.push({
            id: 's-' + Math.random().toString(36).substr(2, 9),
            name: `${bulkFormat.prefix} ${spaceNumStr}`,
            levelName: levelToUse
          });
        }
      }
    }
    
    await saveUnit({ ...unit, spaces: newSpaces, levels: newLevels });
    setBulkTargetUnit(null);
  };

const addItem = (type: 'impact' | 'type' | 'team' | 'activity' | 'danger' | 'company' | 'team_name' | 'quality_source' | 'quality_hito' | 'quality_type') => {
  if (type === 'impact') setImpacts(prev => [...prev, { id: Date.now().toString(), name: 'Nueva Afectación' }]);
  if (type === 'type') setTypes(prev => [...prev, { id: Date.now().toString(), name: 'Nuevo Tipo' }]);
  if (type === 'team') setTeam(prev => [...prev, { id: 'temp-' + Math.random().toString(36).substr(2, 9), position: 'Nuevo Cargo', name: 'Nombre', email: '', team: '' }]);
  if (type === 'activity') setActivities(prev => [...prev, { id: Date.now().toString(), name: 'Nueva Actividad' }]);
  if (type === 'danger') setDangers(prev => [...prev, { id: Date.now().toString(), name: 'Nuevo Peligro' }]);
  if (type === 'company') setCompanies(prev => [...prev, { id: Date.now().toString(), name: 'Nueva Empresa' }]);
  if (type === 'team_name') setTeamsList(prev => [...prev, { id: Date.now().toString(), name: 'NUEVO EQUIPO' }]);
  if (type === 'quality_source') setQualitySources(prev => [...prev, { id: Date.now().toString(), name: 'Nueva Fuente de Calidad' }]);
  if (type === 'quality_hito') setQualityHitos(prev => [...prev, { id: Date.now().toString(), name: 'Nuevo Hito de Calidad' }]);
  if (type === 'quality_type') setQualityTypes(prev => [...prev, { id: Date.now().toString(), name: 'Nuevo Tipo de Calidad' }]);
};

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const removeItem = async (type: 'impact' | 'type' | 'team' | 'activity' | 'danger' | 'company' | 'team_name' | 'quality_source' | 'quality_hito' | 'quality_type', id: string) => {
    const stringId = String(id);
    if (type === 'impact') setImpacts(prev => prev.filter(m => String(m.id) !== stringId));
    if (type === 'type') setTypes(prev => prev.filter(m => String(m.id) !== stringId));
    if (type === 'activity') setActivities(prev => prev.filter(m => String(m.id) !== stringId));
    if (type === 'danger') setDangers(prev => prev.filter(m => String(m.id) !== stringId));
    if (type === 'company') setCompanies(prev => prev.filter(m => String(m.id) !== stringId));
    if (type === 'team_name') setTeamsList(prev => prev.filter(m => String(m.id) !== stringId));
    if (type === 'quality_source') setQualitySources(prev => prev.filter(m => String(m.id) !== stringId));
    if (type === 'quality_hito') setQualityHitos(prev => prev.filter(m => String(m.id) !== stringId));
    if (type === 'quality_type') setQualityTypes(prev => prev.filter(m => String(m.id) !== stringId));
    if (type === 'team') {
      try {
        // Optimistic update
        setTeam(prev => prev.filter(m => String(m.id) !== stringId));
        setGlobalTeam(prev => prev.filter(m => String(m.id) !== stringId));
        
        await deleteTeamMember(stringId);
        
        // Final sync after deletion
        window.dispatchEvent(new Event('storage_settings_updated'));
      } catch (err) {
        console.error("Delete failed:", err);
        alert("Error al eliminar el usuario. Verifique sus permisos.");
        // Re-sync from global state on failure
        setTeam(globalTeam);
      }
    }
  };

  const updateItem = (type: 'impact' | 'type' | 'team' | 'activity' | 'danger' | 'company' | 'team_name' | 'quality_source' | 'quality_hito' | 'quality_type', id: string, value: any) => {
    const update = (prev: any[]) => prev.map(m => m.id === id ? (typeof value === 'object' ? { ...m, ...value } : { ...m, name: value }) : m);
    
    if (type === 'impact') setImpacts(update);
    if (type === 'team_name') setTeamsList(update);
    if (type === 'type') setTypes(update);
    if (type === 'quality_source') setQualitySources(update);
    if (type === 'quality_hito') setQualityHitos(update);
    if (type === 'quality_type') setQualityTypes(update);
    if (type === 'activity') setActivities(update);
    if (type === 'danger') {
      const item = dangers.find(d => d.id === id);
      if (item && item.name !== value && typeof value === 'string') {
        const oldName = item.name;
        setDangers(update);
        if (dangerDescriptionsMap[oldName]) {
          const newMap = { ...dangerDescriptionsMap };
          newMap[value] = newMap[oldName];
          delete newMap[oldName];
          setDangerDescriptionsMap(newMap);
        }
      } else {
        setDangers(update);
      }
    }
    if (type === 'company') setCompanies(update);
    if (type === 'team') setTeam(update);
  };

  const resetImpacts = () => {
    if (window.confirm('¿Desea restaurar las afectaciones por defecto? Se perderán las personalizaciones actuales.')) {
      setImpacts(IMPACT_OPTIONS.map(v => ({ id: Math.random().toString(36).substr(2, 9), name: v })));
    }
  };

  const resetTypes = () => {
    if (window.confirm('¿Desea restaurar los tipos de incidencia por defecto? Se perderán las personalizaciones actuales.')) {
      setTypes(ISSUE_TYPES.map(v => ({ id: Math.random().toString(36).substr(2, 9), name: v })));
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-main)]">
        <Loader2 className="w-12 h-12 text-slate-400 animate-spin mb-4" />
        <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Cargando Configuración...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 bg-[var(--bg-main)] overflow-auto transition-colors duration-300">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-4xl font-display font-black text-slate-900 dark:text-white tracking-tight">Personalización</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium italic">Configura parámetros y flujos de trabajo del proyecto</p>
          </div>
          
          <div className="flex flex-col md:flex-row items-stretch md:items-end gap-4">
            {activeTab !== 'types' && (
              <div className="flex flex-col gap-1.5 min-w-[280px]">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                  <Database className="w-3 h-3 text-indigo-500" /> Configurando para:
                </label>
                <select 
                  value={selectedConfigKey === 'GLOBAL' ? 'GLOBAL' : `${configMode}:${selectedConfigKey}`}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'GLOBAL') {
                      setSelectedConfigKey('GLOBAL');
                      setConfigMode('type'); // Default
                    } else {
                      const [mode, key] = val.split(':');
                      setConfigMode('type');
                      setSelectedConfigKey(key);
                      if ((activeTab as any) === 'types') setActiveTab('fields');
                    }
                  }}
                  className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3 text-[11px] font-black uppercase tracking-tight text-slate-900 dark:text-white outline-none focus:border-slate-900 dark:focus:border-white transition-all shadow-sm cursor-pointer hover:border-slate-300 dark:hover:border-slate-700"
                >
                  <option value="GLOBAL">🌏 CONFIGURACIÓN GLOBAL</option>
                  <optgroup label="📂 POR TIPO DE HALLAZGO">
                    {globalTypes.sort().map(typeName => (
                      <option key={`type:${typeName}`} value={`type:${typeName}`}>📄 {typeName}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}
            
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="bg-slate-900 disabled:opacity-60 dark:bg-white text-white dark:text-slate-900 px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate-900/10 dark:shadow-white/5 flex items-center justify-center gap-3 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Guardando en Drive…' : 'Guardar Configuración'}
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="flex p-1.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl w-fit shadow-sm transition-colors flex-wrap">
          {[
            { id: 'fields', label: 'Campos', icon: Settings },
            { id: 'types', label: 'Tipos', icon: FileText },
            { id: 'impacts', label: 'Afectaciones', icon: Layout },
            { id: 'units', label: 'Ubicaciones', icon: MapPin },
            { id: 'activities', label: 'Actividades', icon: Briefcase },
            { id: 'dangers', label: 'Peligros', icon: AlertTriangle },
            { id: 'qualityReportConfig', label: 'Informe de control', icon: ClipboardList },
            { id: 'reportPermissions', label: 'Permisos de Informes', icon: Eye }
          ].filter(tab => {
            if (tab.id === 'types' && selectedConfigKey !== 'GLOBAL') return false;
            // Also hide dangers/activities/units in type-specific config if preferred, but user only mentioned types
            return true;
          }).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as ConfigTab);
                if (tab.id === 'types') {
                  setSelectedConfigKey('GLOBAL');
                }
              }}
              className={cn(
                "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                activeTab === tab.id 
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg shadow-slate-900/10 dark:shadow-white/5" 
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8">
          <AnimatePresence mode="wait">
            {activeTab === 'fields' && (
              <motion.section 
                key="fields"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-black/20"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-lg shadow-slate-900/10 dark:shadow-white/5">
                      <Settings className="w-5 h-5" />
                    </div>
                    <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em]">Visibilidad del Formulario</h3>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {config.map((field) => (
                    <div 
                      key={field.id}
                      className={cn(
                        "flex items-center justify-between p-6 rounded-3xl border transition-all duration-300",
                        field.visible ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200/40 dark:shadow-black/20" : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-5">
                        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-colors", field.visible ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" : "bg-slate-200 dark:bg-slate-950 text-slate-400 dark:text-slate-800")}>
                           <field.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{field.label}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">{field.id}</p>
                        </div>
                      </div>
                      <button onClick={() => setConfig(config.map(f => f.id === field.id ? {...f, visible: !f.visible} : f))} className={cn("p-2.5 rounded-xl transition-all", field.visible ? "text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700" : "text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800")}>
                        {field.visible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                      </button>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {activeTab === 'types' && (
              <motion.section 
                key="types"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-black/20"
              >
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/10">
                      <FileText className="w-5 h-5" />
                    </div>
                    <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em]">Lista de Tipos de Incidencia</h3>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={resetTypes}
                      className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all border border-slate-100 rounded-xl hover:border-slate-200"
                    >
                      Restaurar Defectos
                    </button>
                    <button onClick={() => addItem('type')} className="p-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-slate-900/10 dark:shadow-white/5">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {types.slice().sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
                    <div key={t.id} className="flex items-center gap-4 p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl group hover:border-slate-400 dark:hover:border-slate-700 transition-all shadow-sm">
                      <input 
                        type="text" 
                        value={t.name} 
                        onChange={(e) => updateItem('type', t.id, e.target.value)}
                        className="flex-1 bg-transparent border-none text-slate-900 dark:text-white text-sm font-bold focus:ring-0 outline-none uppercase tracking-tight"
                      />
                      <button onClick={() => removeItem('type', t.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 dark:text-slate-800 hover:text-red-500 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {types.length === 0 && <p className="text-center py-10 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Sin tipos de incidencia definidos</p>}
              </motion.section>
            )}

            {activeTab === 'impacts' && (
              <motion.section 
                key="impacts"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-black/20"
              >
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/10">
                      <Layout className="w-5 h-5" />
                    </div>
                    <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em]">Lista de Afectaciones</h3>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={resetImpacts}
                      className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all border border-slate-100 rounded-xl hover:border-slate-200"
                    >
                      Restaurar Defectos
                    </button>
                    <button onClick={() => addItem('impact')} className="p-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-slate-900/10 dark:shadow-white/5">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {impacts.slice().sort((a, b) => a.name.localeCompare(b.name)).map((impact) => (
                    <div key={impact.id} className="flex items-center gap-4 p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl group hover:border-slate-400 dark:hover:border-slate-700 transition-all shadow-sm">
                      <input 
                        type="text" 
                        value={impact.name} 
                        onChange={(e) => updateItem('impact', impact.id, e.target.value)}
                        className="flex-1 bg-transparent border-none text-slate-900 dark:text-white text-sm font-bold focus:ring-0 outline-none uppercase tracking-tight"
                      />
                      <button onClick={() => removeItem('impact', impact.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 dark:text-slate-800 hover:text-red-500 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {activeTab === 'dangers' && (
              <motion.section 
                key="dangers"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-black/20"
              >
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-500/10">
                       <AlertTriangle className="w-5 h-5" />
                    </div>
                    <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em]">Lista de Peligros y Descripciones</h3>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => {
                        if (confirm('Restaurar Peligros por defecto?')) {
                          setDangers(DEFAULT_DANGERS.map(v => ({ id: Math.random().toString(36).substr(2, 9), name: v })));
                          setDangerDescriptionsMap(DANGER_DESCRIPTIONS);
                        }
                      }}
                      className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all border border-slate-100 rounded-xl hover:border-slate-200"
                    >
                      Restaurar Defectos
                    </button>
                    <button onClick={() => addItem('danger')} className="p-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-slate-900/10 dark:shadow-white/5">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {dangers.slice().sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
                    <DangerItem 
                      key={t.id}
                      danger={t}
                      updateItem={updateItem}
                      removeItem={removeItem}
                      dangerDescriptionsMap={dangerDescriptionsMap}
                      setDangerDescriptionsMap={setDangerDescriptionsMap}
                    />
                  ))}
                </div>
              </motion.section>
            )}

            {activeTab === 'activities' && (
              <motion.section 
                key="activities"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-black/20"
              >
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/10">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em]">Lista de Actividades Económicas</h3>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setActivities(DEFAULT_ECONOMIC_ACTIVITIES.map(v => ({ id: Math.random().toString(36).substr(2, 9), name: v })))}
                      className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all border border-slate-100 rounded-xl hover:border-slate-200"
                    >
                      Restaurar Defectos
                    </button>
                    <button onClick={() => addItem('activity')} className="p-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-slate-900/10 dark:shadow-white/5">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activities.slice().sort((a, b) => a.name.localeCompare(b.name)).map((t) => (
                    <div key={t.id} className="flex items-center gap-4 p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl group hover:border-slate-400 dark:hover:border-slate-700 transition-all shadow-sm">
                      <input 
                        type="text" 
                        value={t.name} 
                        onChange={(e) => updateItem('activity', t.id, e.target.value)}
                        className="flex-1 bg-transparent border-none text-slate-900 dark:text-white text-sm font-bold focus:ring-0 outline-none uppercase tracking-tight"
                      />
                      <button onClick={() => removeItem('activity', t.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 dark:text-slate-800 hover:text-red-500 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {activeTab === 'qualityReportConfig' && (
              <motion.section 
                key="qualityReportConfig"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-black/20"
              >
                {/* 1. Code Start Configuration */}
                <div className="mb-10 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 p-8 rounded-[2rem] space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-lg">
                      <Hash className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Código Numérico de Inicio</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Código de 4 dígitos para auto-enumeración de hallazgos</p>
                    </div>
                  </div>
                  <div className="max-w-xs">
                    <input 
                      type="text" 
                      value={qualityCodeStart} 
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setQualityCodeStart(val || "0001");
                      }}
                      placeholder="0001"
                      className="w-full px-6 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-[13px] text-slate-900 dark:text-white font-bold outline-none focus:border-slate-400 dark:focus:border-slate-700 transition-all shadow-sm"
                    />
                  </div>
                </div>

                {/* 2. Sources List */}
                <div className="mb-10 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 p-8 rounded-[2rem]">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-505 bg-indigo-500 flex items-center justify-center text-white shadow-lg">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Fuentes de Hallazgo (Menú Desplegable)</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Personaliza el dropdown FUENTE</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => addItem('quality_source')}
                      className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-lg"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar Fuente
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {qualitySources.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl group hover:border-slate-300 transition-all shadow-sm">
                        <div className="flex-1 flex items-center gap-2">
                          <input 
                            type="text" 
                            placeholder="Nombre de la fuente"
                            value={item.name} 
                            onChange={(e) => updateItem('quality_source', item.id, { name: e.target.value })}
                            className="flex-grow bg-transparent border-none text-slate-950 dark:text-white text-xs font-bold focus:ring-0 outline-none"
                          />
                          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800" />
                          <input 
                            type="text" 
                            placeholder="CON"
                            maxLength={3}
                            value={item.abbreviation || ''} 
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
                              updateItem('quality_source', item.id, { abbreviation: val });
                            }}
                            className="w-14 bg-transparent border-none text-right font-mono text-indigo-500 font-black text-xs focus:ring-0 outline-none"
                            title="Contracción de máximo 3 letras mayúsculas"
                          />
                        </div>
                        <button type="button" onClick={() => removeItem('quality_source', item.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {qualitySources.length === 0 && (
                      <p className="col-span-2 text-center py-6 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Sin fuentes definidas</p>
                    )}
                  </div>
                </div>

                {/* 3. Hitos List */}
                <div className="mb-10 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 p-8 rounded-[2rem]">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Hito (Menú Desplegable)</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Personaliza el dropdown de hitos vinculados</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => addItem('quality_hito')}
                      className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-lg"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar Hito
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {qualityHitos.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl group hover:border-slate-300 transition-all shadow-sm">
                        <input 
                          type="text" 
                          value={item.name} 
                          onChange={(e) => updateItem('quality_hito', item.id, e.target.value)}
                          className="flex-1 bg-transparent border-none text-slate-950 dark:text-white text-xs font-bold focus:ring-0 outline-none"
                        />
                        <button type="button" onClick={() => removeItem('quality_hito', item.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {qualityHitos.length === 0 && (
                      <p className="col-span-2 text-center py-6 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Sin hitos definidos</p>
                    )}
                  </div>
                </div>

                {/* 4. Tipos List */}
                <div className="bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 p-8 rounded-[2rem]">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg">
                        <Settings className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Tipo de Hallazgo (Menú Desplegable)</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Personaliza el dropdown del tipo de hallazgo de calidad</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => addItem('quality_type')}
                      className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-lg"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar Tipo
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {qualityTypes.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl group hover:border-slate-300 transition-all shadow-sm">
                        <div className="flex-1 flex items-center gap-2">
                          <input 
                            type="text" 
                            placeholder="Nombre del tipo"
                            value={item.name} 
                            onChange={(e) => updateItem('quality_type', item.id, { name: e.target.value })}
                            className="flex-grow bg-transparent border-none text-slate-950 dark:text-white text-xs font-bold focus:ring-0 outline-none"
                          />
                          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800" />
                          <input 
                            type="text" 
                            placeholder="CON"
                            maxLength={3}
                            value={item.abbreviation || ''} 
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
                              updateItem('quality_type', item.id, { abbreviation: val });
                            }}
                            className="w-14 bg-transparent border-none text-right font-mono text-indigo-500 font-black text-xs focus:ring-0 outline-none"
                            title="Contracción de máximo 3 letras mayúsculas"
                          />
                        </div>
                        <button type="button" onClick={() => removeItem('quality_type', item.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {qualityTypes.length === 0 && (
                      <p className="col-span-2 text-center py-6 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Sin tipos definidos</p>
                    )}
                  </div>
                </div>
              </motion.section>
            )}

            {activeTab === 'reportPermissions' && (
              <motion.section 
                key="reportPermissions"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-black/20"
              >
                {/* Visual Header */}
                <div className="mb-10 flex flex-col md:flex-row items-start gap-4 p-8 bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 rounded-[2rem]">
                  <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0">
                    <Eye className="w-6 h-6" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">Visibilidad de Informes por Equipos de Tarea</h3>
                    <p className="text-xs text-slate-500 font-medium tracking-tight leading-relaxed">
                      Determina qué <strong>Equipos de Tarea</strong> del proyecto tienen permiso para visualizar cada módulo de informe.
                      Los equipos y miembros se sincronizan automáticamente con la configuración del proyecto y la estructura de personal.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg text-[9px] font-black uppercase tracking-wider">
                        👑 Super Administradores y Administradores de Empresa: Acceso Total Incondicional
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg text-[9px] font-black uppercase tracking-wider">
                        ℹ️ Si no seleccionas ningún equipo, el informe será público para todo el personal
                      </span>
                    </div>
                  </div>
                </div>

                {/* Main Cards Grid */}
                <div className="space-y-8">
                  {/* Site Reports Allowed Teams */}
                  <div className="bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 p-8 rounded-[2rem]">
                    <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-lg shrink-0">
                          <ClipboardList className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight font-sans">Informes de Obra</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Visibilidad por Equipos de Tarea asignados</p>
                        </div>
                      </div>
                      <span className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest",
                        siteReportsAllowedTeams.length === 0 
                          ? "bg-emerald-500/15 text-emerald-500" 
                          : "bg-blue-500/15 text-blue-500"
                      )}>
                        {siteReportsAllowedTeams.length === 0 ? "PÚBLICO: TODOS LOS EQUIPOS" : `RESTRINGIDO: ${siteReportsAllowedTeams.length} EQUIPO(S)`}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {(globalTeams && globalTeams.length > 0 
                        ? globalTeams 
                        : ['AMBIENTAL', 'ARQUITECTURA', 'BIM', 'CALIDAD', 'COORDINACIÓN TÉCNICA', 'ESTRUCTURA', 'INSTALACIONES', 'SST']
                      ).filter(Boolean).sort().map((teamName) => {
                        const isSelected = siteReportsAllowedTeams.includes(teamName);
                        return (
                          <button
                            key={teamName}
                            type="button"
                            onClick={() => {
                              setSiteReportsAllowedTeams(prev => 
                                prev.includes(teamName) ? prev.filter(t => t !== teamName) : [...prev, teamName]
                              );
                            }}
                            className={cn(
                              "px-4 py-3 rounded-xl border text-[11px] font-bold text-left transition-all uppercase tracking-wider flex items-center justify-between",
                              isSelected 
                                ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900 shadow-lg shadow-slate-900/10 font-sans" 
                                : "bg-white border-slate-200 text-slate-500 hover:border-slate-400 dark:bg-[#0c0f1d] dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-600 font-sans"
                            )}
                          >
                            <span>{teamName}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-2 animate-in fade-in zoom-in" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quality Reports Allowed Teams */}
                  <div className="bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 p-8 rounded-[2rem]">
                    <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shrink-0">
                          <Check className="w-5 h-5 font-sans" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight font-sans">Informes de Calidad</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Visibilidad por Equipos de Tarea asignados</p>
                        </div>
                      </div>
                      <span className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest",
                        qualityReportsAllowedTeams.length === 0 
                          ? "bg-emerald-500/15 text-emerald-500" 
                          : "bg-indigo-500/15 text-indigo-500"
                      )}>
                        {qualityReportsAllowedTeams.length === 0 ? "PÚBLICO: TODOS LOS EQUIPOS" : `RESTRINGIDO: ${qualityReportsAllowedTeams.length} EQUIPO(S)`}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {(globalTeams && globalTeams.length > 0 
                        ? globalTeams 
                        : ['AMBIENTAL', 'ARQUITECTURA', 'BIM', 'CALIDAD', 'COORDINACIÓN TÉCNICA', 'ESTRUCTURA', 'INSTALACIONES', 'SST']
                      ).filter(Boolean).sort().map((teamName) => {
                        const isSelected = qualityReportsAllowedTeams.includes(teamName);
                        return (
                          <button
                            key={teamName}
                            type="button"
                            onClick={() => {
                              setQualityReportsAllowedTeams(prev => 
                                prev.includes(teamName) ? prev.filter(t => t !== teamName) : [...prev, teamName]
                              );
                            }}
                            className={cn(
                              "px-4 py-3 rounded-xl border text-[11px] font-bold text-left transition-all uppercase tracking-wider flex items-center justify-between",
                              isSelected 
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20 font-sans" 
                                : "bg-white border-slate-200 text-slate-500 hover:border-slate-400 dark:bg-[#0c0f1d] dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-600 font-sans"
                            )}
                          >
                            <span>{teamName}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-2 animate-in fade-in zoom-in" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Environmental Reports Allowed Teams */}
                  <div className="bg-slate-50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800 p-8 rounded-[2rem]">
                    <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shrink-0">
                          <Leaf className="w-5 h-5 font-sans" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight font-sans">Informes Ambientales</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Visibilidad por Equipos de Tarea asignados</p>
                        </div>
                      </div>
                      <span className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest",
                        environmentalReportsAllowedTeams.length === 0 
                          ? "bg-emerald-500/15 text-emerald-500" 
                          : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      )}>
                        {environmentalReportsAllowedTeams.length === 0 ? "PÚBLICO: TODOS LOS EQUIPOS" : `RESTRINGIDO: ${environmentalReportsAllowedTeams.length} EQUIPO(S)`}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {(globalTeams && globalTeams.length > 0 
                        ? globalTeams 
                        : ['AMBIENTAL', 'ARQUITECTURA', 'BIM', 'CALIDAD', 'COORDINACIÓN TÉCNICA', 'ESTRUCTURA', 'INSTALACIONES', 'SST']
                      ).filter(Boolean).sort().map((teamName) => {
                        const isSelected = environmentalReportsAllowedTeams.includes(teamName);
                        return (
                          <button
                            key={teamName}
                            type="button"
                            onClick={() => {
                              setEnvironmentalReportsAllowedTeams(prev => 
                                prev.includes(teamName) ? prev.filter(t => t !== teamName) : [...prev, teamName]
                              );
                            }}
                            className={cn(
                              "px-4 py-3 rounded-xl border text-[11px] font-bold text-left transition-all uppercase tracking-wider flex items-center justify-between",
                              isSelected 
                                ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/20 font-sans" 
                                : "bg-white border-slate-200 text-slate-500 hover:border-slate-400 dark:bg-[#0c0f1d] dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-600 font-sans"
                            )}
                          >
                            <span>{teamName}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-2 animate-in fade-in zoom-in" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.section>
            )}

            {activeTab === 'units' && (
              <motion.section 
                key="units"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 p-10 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-black/20"
              >
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/10">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em]">Jerarquía de Ubicaciones</h3>
                  </div>
                  <div className="flex gap-4">
                    {selectedConfigKey === 'GLOBAL' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={async () => {
                            if (!confirm(`¿Activar todas las unidades para todos los tipos?`)) return;
                            
                            const overrides = typeOverrides;
                            const setOverrides = setTypeOverrides;
                            const allScopes = globalTypes;
                            const key = 'typeOverrides';

                            const updatedOverrides = { ...overrides };
                            const allUnitIds = units.map(u => u.id);
                            allScopes.forEach(scope => {
                              updatedOverrides[scope] = {
                                ...(updatedOverrides[scope] || {}),
                                units: allUnitIds
                              };
                            });
                            setOverrides(updatedOverrides);
                            const fbConfig = await getProjectConfig();
                            await saveProjectConfig({ ...fbConfig, [key]: updatedOverrides });
                            window.dispatchEvent(new Event('storage_settings_updated'));
                          }}
                          className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg"
                        >
                          Activar para todos
                        </button>
                        <button 
                          onClick={async () => {
                            if (!confirm(`¿Desactivar todas las unidades para todos los tipos?`)) return;

                            const overrides = typeOverrides;
                            const setOverrides = setTypeOverrides;
                            const allScopes = globalTypes;
                            const key = 'typeOverrides';

                            const updatedOverrides = { ...overrides };
                            allScopes.forEach(scope => {
                              updatedOverrides[scope] = {
                                ...(updatedOverrides[scope] || {}),
                                units: []
                              };
                            });
                            setOverrides(updatedOverrides);
                            const fbConfig = await getProjectConfig();
                            await saveProjectConfig({ ...fbConfig, [key]: updatedOverrides });
                            window.dispatchEvent(new Event('storage_settings_updated'));
                          }}
                          className="px-4 py-2 bg-red-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg"
                        >
                          Desactivar para todos
                        </button>
                      </div>
                    )}
                    <button 
                      onClick={async () => {
                        await saveUnit({
                          name: 'NUEVA UNIDAD',
                          levels: [{ id: Date.now().toString(), name: 'PISO 1' }],
                          spaces: []
                        });
                      }} 
                      className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-lg"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar Unidad
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  {units
                    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
                    .map((unit) => (
                    <UnitRow 
                      key={unit.id}
                      unit={unit}
                      onDelete={deleteUnit}
                      selectedScope={selectedConfigKey}
                      configMode={configMode}
                      overrides={typeOverrides}
                      setOverrides={setTypeOverrides}
                      allScopes={globalTypes}
                      onBulkOpen={() => {
                        setBulkTargetUnit(units.indexOf(unit));
                        setBulkMode('single');
                        setBulkFormat(prev => ({ ...prev, level: unit.levels[0]?.name || '' }));
                      }}
                    />
                  ))}
                  {units.length === 0 && (
                    <div className="text-center py-20 bg-slate-50 dark:bg-slate-950/50 rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-slate-800">
                      <MapPin className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">No hay unidades estructurales configuradas</p>
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {bulkTargetUnit !== null && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md">
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl"
                      >
                        {/* Header */}
                        <div className="p-8 border-b border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                              <Copy className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-white uppercase tracking-tight">Generación Masiva</h4>
                              <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Unidad: {units[bulkTargetUnit].name}</p>
                            </div>
                          </div>
                          <button onClick={() => setBulkTargetUnit(null)} className="text-slate-500 hover:text-white transition-colors p-2">
                             <X className="w-6 h-6" />
                          </button>
                        </div>

                        {/* Mode Selector */}
                        <div className="p-8 pb-0">
                          <div className="bg-slate-950 p-2 rounded-2xl flex gap-2">
                            <button 
                              onClick={() => setBulkMode('single')}
                              className={cn(
                                "flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                bulkMode === 'single' ? "bg-slate-800 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                              )}
                            >
                              Nivel Único
                            </button>
                            <button 
                              onClick={() => setBulkMode('tower')}
                              className={cn(
                                "flex-1 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                bulkMode === 'tower' ? "bg-slate-800 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                              )}
                            >
                              Modo Torre (Varios Pisos)
                            </button>
                          </div>
                        </div>

                        {/* Form */}
                        <div className="p-8 space-y-6">
                          {bulkMode === 'tower' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-slate-800/50">
                              <div className="space-y-2">
                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Prefijo Nivel</label>
                                <input 
                                  type="text" 
                                  value={bulkFormat.levelPrefix}
                                  onChange={e => setBulkFormat({...bulkFormat, levelPrefix: e.target.value.toUpperCase()})}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-[10px] font-bold text-white uppercase outline-none focus:ring-1 focus:ring-indigo-500/50"
                                  placeholder="PISO"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-2">
                                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Inicio Piso</label>
                                  <input 
                                    type="number" 
                                    value={bulkFormat.levelStart}
                                    onChange={e => setBulkFormat({...bulkFormat, levelStart: parseInt(e.target.value) || 0})}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-[10px] font-bold text-white outline-none focus:ring-1 focus:ring-indigo-500/50"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Fin Piso</label>
                                  <input 
                                    type="number" 
                                    value={bulkFormat.levelEnd}
                                    onChange={e => setBulkFormat({...bulkFormat, levelEnd: parseInt(e.target.value) || 0})}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-[10px] font-bold text-white outline-none focus:ring-1 focus:ring-indigo-500/50"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Prefijo Espacios</label>
                              <div className="relative">
                                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                                <input 
                                  type="text" 
                                  value={bulkFormat.prefix}
                                  onChange={e => setBulkFormat({...bulkFormat, prefix: e.target.value.toUpperCase()})}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pl-9 text-[10px] font-bold text-white uppercase outline-none focus:ring-1 focus:ring-indigo-500/50"
                                  placeholder="APTO"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Inicio Num (Relativo)</label>
                              <div className="relative">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                                <input 
                                  type="number" 
                                  value={bulkFormat.start}
                                  onChange={e => setBulkFormat({...bulkFormat, start: parseInt(e.target.value) || 0})}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pl-9 text-[10px] font-bold text-white outline-none focus:ring-1 focus:ring-indigo-500/50"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">
                                  {bulkMode === 'single' ? 'Cantidad de Espacios' : 'Espacios por Nivel'}
                                </label>
                                <input 
                                  type="number" 
                                  value={bulkFormat.count}
                                  onChange={e => setBulkFormat({...bulkFormat, count: parseInt(e.target.value) || 0})}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-[10px] font-bold text-white outline-none focus:ring-1 focus:ring-indigo-500/50"
                                />
                              </div>
                              {bulkMode === 'single' && (
                                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                                  <p className="text-[7px] font-black text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                    <Eye className="w-2.5 h-2.5" /> Vista Previa Primer Item:
                                  </p>
                                  <p className="text-[10px] font-black text-white uppercase tracking-tight">
                                    {bulkFormat.prefix} {(bulkFormat.level.match(/\d+/)?.[0] || '') + bulkFormat.start.toString().padStart(2, '0')}
                                  </p>
                                </div>
                              )}
                            </div>
                            {bulkMode === 'single' && (
                              <div className="space-y-2">
                                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Nivel Destino</label>
                                <select 
                                  value={bulkFormat.level}
                                  onChange={e => setBulkFormat({...bulkFormat, level: e.target.value})}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-[10px] font-black text-white uppercase outline-none focus:ring-1 focus:ring-indigo-500/50"
                                >
                                  <option value="">SIN NIVEL</option>
                                  {units[bulkTargetUnit].levels.map(l => (
                                    <option key={l.id} value={l.name}>{l.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="p-8 pt-4 flex gap-4">
                          <button 
                            onClick={() => setBulkTargetUnit(null)}
                            className="flex-1 py-4 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={handleBulkGenerate}
                            className="flex-[1.5] py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                          >
                            <Zap className="w-4 h-4" /> Generar
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </motion.section>
            )}
          </AnimatePresence>

          <section className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-10 opacity-5 scale-150 rotate-12 pointer-events-none">
               <Database className="w-64 h-64" />
             </div>
             <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
                <div className="max-w-xl">
                  <h4 className="text-2xl font-display font-black mb-4 tracking-tight">Sincronización de Parámetros</h4>
                  <p className="text-slate-400 text-sm leading-relaxed font-medium">
                    Las modificaciones en este panel definen los estándares de recolección de datos para todo el proyecto. Estos cambios se aplican globalmente a nuevos registros.
                  </p>
                </div>
                <div className="flex items-center gap-6">
                   <div className="text-right">
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Estado de Sincronización</p>
                     <p className="text-xs font-black uppercase tracking-widest text-emerald-400">Punto de Entrega Activo</p>
                   </div>
                   <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10 shadow-inner">
                     <CheckCircle className="w-8 h-8 text-emerald-400" />
                   </div>
                </div>
             </div>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {showSaved && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-8 py-3 rounded-full font-bold text-xs uppercase tracking-widest shadow-2xl flex items-center gap-3 z-50 border border-emerald-400/50"
          >
            <CheckCircle className="w-4 h-4" />
            Preferencias Actualizadas
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
