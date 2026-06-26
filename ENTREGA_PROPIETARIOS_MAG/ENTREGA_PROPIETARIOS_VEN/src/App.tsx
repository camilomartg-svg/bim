/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, CheckCircle2, Clock, Info, Search, Lock, Save, Loader2, Eye, EyeOff, RefreshCw, Settings } from 'lucide-react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { fetchSheetData, triggerSync, updateSheetStatus, saveSheetStructure, SheetData } from './services/sheetService';
import { MassGenerationModal, MassGenerationConfig } from './MassGenerationModal';
import { TowerEditorModal } from './TowerEditorModal';
import { DEFAULT_PROJECT_SETTINGS, type ProjectSettings, readStoredProjectSettings, writeStoredProjectSettings } from './projectSettings';

// --- Types ---

type Status = 'owner_delivered' | 'post_construction_delivered' | 'notarized' | 'weekly_goal' | 'in_process' | 'special' | 'under_construction';
type Tab = 'towers' | 'charts';

const getLocalISODate = (d: Date = new Date()): string => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const normalizeToISODate = (v: unknown): string | null => {
  if (!v) return null;

  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return getLocalISODate(v);
  }

  if (typeof v !== 'string') return null;

  const s = v.trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const isoDateTime = s.match(/^(\d{4}-\d{2}-\d{2})[T ]/);
  if (isoDateTime) return isoDateTime[1];

  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return getLocalISODate(parsed);
  }

  return null;
};

const getTime24Now = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const time24ToAmPm = (time24: string): string | null => {
  const m = String(time24 ?? '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;

  const ampm = hh >= 12 ? 'PM' : 'AM';
  const hh12 = ((hh + 11) % 12) + 1;
  return `${String(hh12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
};

const tsToAmPm = (ts: number): string | null => {
  if (!Number.isFinite(ts)) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const hh = d.getHours();
  const mm = d.getMinutes();
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const hh12 = ((hh + 11) % 12) + 1;
  return `${String(hh12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
};

const extractTime24 = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${String(v.getHours()).padStart(2, '0')}:${String(v.getMinutes()).padStart(2, '0')}`;
  }
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;

  const iso = s.match(/(?:T| )(\d{2}):(\d{2})/);
  if (iso) return `${iso[1]}:${iso[2]}`;

  const ampm = s.match(/(\d{1,2}):(\d{2})\s*([AP]M)\b/i);
  if (ampm) {
    const hhRaw = Number(ampm[1]);
    const mm = Number(ampm[2]);
    const mer = String(ampm[3]).toUpperCase();
    if (hhRaw < 1 || hhRaw > 12 || mm < 0 || mm > 59) return null;
    let hh = hhRaw % 12;
    if (mer === 'PM') hh += 12;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  return null;
};

const formatWeeklyGoalDateTime = (v: unknown): string | null => {
  const date = normalizeToISODate(v);
  if (!date) return null;
  const time24 = extractTime24(v);
  const ampm = time24 ? time24ToAmPm(time24) : null;
  return ampm ? `${date} ${ampm}` : date;
};

const buildWeeklyGoalDateTimeValue = (dateIso: string, time24: string): string => {
  const date = normalizeToISODate(dateIso) ?? dateIso;
  const ampm = time24ToAmPm(time24);
  return ampm ? `${date} ${ampm}` : date;
};

const getStatusLabel = (status: Status) => {
  switch (status) {
    case 'owner_delivered': return 'Entregado a propietario';
    case 'post_construction_delivered': return 'Entregado a Post construcción';
    case 'notarized': return 'Escriturado';
    case 'weekly_goal': return 'Lista meta semanal';
    case 'in_process': return 'Sin proceso';
    case 'under_construction': return 'En obra';
    case 'special': return 'Área Especial';
    default: return '';
  }
};

const getStatusChipClass = (status: Status) => {
  switch (status) {
    case 'owner_delivered':
      return 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700';
    case 'post_construction_delivered':
      return 'bg-green-500 text-white border-green-600 hover:bg-green-600';
    case 'notarized':
      return 'bg-orange-500 text-white border-orange-600 hover:bg-orange-600';
    case 'weekly_goal':
      return 'bg-red-600 text-white border-red-700 hover:bg-red-700';
    case 'under_construction':
      return 'bg-gray-400 text-white border-gray-500 hover:bg-gray-500';
    case 'in_process':
      return 'bg-white text-alcabama-dark-grey border-alcabama-light-grey hover:border-alcabama-grey';
    case 'special':
      return 'bg-white text-alcabama-dark-grey border-alcabama-light-grey hover:border-alcabama-grey';
    default:
      return 'bg-white text-alcabama-dark-grey border-alcabama-light-grey hover:border-alcabama-grey';
  }
};

interface Apartment {
  id: string;
  number: string;
  status: Status;
  weeklyGoalDate?: string | null;
}

interface Tower {
  id: number;
  name: string;
  apartments: Apartment[];
}

interface PendingChange {
  towerId: number;
  aptNumber: string;
  status: Status;
  weeklyGoalDate?: string | null;
}

// --- Constants & Mock Data Generation ---

const DEFAULT_CONFIG = { totalTowers: 21, floorsPerTower: 9, aptsPerFloor: 4 };

const getStoredConfig = () => {
  try {
    const raw = localStorage.getItem('entrega_propi_ven_config');
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_CONFIG;
};

const getInitialStructure = (): Tower[] => {
  const saved = localStorage.getItem('entrega_propi_ven_custom_structure');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return generateStructure({ totalTowers: 21, floorsPerTower: 9, aptsPerFloor: 4 });
};

const generateStructure = (config = getStoredConfig()): Tower[] => {
  const towers: Tower[] = [];
  
  for (let t = 1; t <= config.totalTowers; t++) {
    const apartments: Apartment[] = [];
    for (let f = 1; f <= config.floorsPerTower; f++) {
      for (let a = 1; a <= config.aptsPerFloor; a++) {
        const aptNumber = `${f}${(a).toString().padStart(2, '0')}`;
        let status: Status = 'in_process'; // Default status
        
        // Special case for COW as seen in the image (Tower 1, Floor 1, Position 4)
        if (f === 1 && a === 4) {
          status = 'special';
        }

        apartments.push({
          id: `t${t}-f${f}-a${a}`,
          number: status === 'special' ? 'COW' : aptNumber,
          status: status,
        });
      }
    }
    towers.push({
      id: t,
      name: `TORRE ${t}`,
      apartments,
    });
  }
  return towers;
};

const DATA_CACHE_KEY = 'entrega_propi_ven_cache_v2';
const TIMELINE_EVENTS_KEY = 'entrega_propi_ven_timeline_events_v1';

type TimelineEvent = {
  towerId: number;
  aptNumber: string;
  status: Status;
  date: string;
  ts: number;
};

const readCachedTowers = (): { savedAt: number; towers: Tower[] } | null => {
  try {
    const raw = localStorage.getItem(DATA_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: unknown; towers?: unknown };
    if (typeof parsed?.savedAt !== 'number') return null;
    if (!Array.isArray(parsed?.towers)) return null;
    return { savedAt: parsed.savedAt, towers: parsed.towers as Tower[] };
  } catch {
    return null;
  }
};

const writeCachedTowers = (towers: Tower[]) => {
  try {
    localStorage.setItem(DATA_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), towers }));
  } catch {}
};

const readTimelineEvents = (): TimelineEvent[] => {
  try {
    const raw = localStorage.getItem(TIMELINE_EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is TimelineEvent => {
        const maybe = e as Partial<TimelineEvent>;
        return (
          typeof maybe?.towerId === 'number' &&
          typeof maybe?.aptNumber === 'string' &&
          typeof maybe?.status === 'string' &&
          typeof maybe?.date === 'string' &&
          typeof maybe?.ts === 'number'
        );
      })
      .slice(-5000);
  } catch {
    return [];
  }
};

const writeTimelineEvents = (events: TimelineEvent[]) => {
  try {
    localStorage.setItem(TIMELINE_EVENTS_KEY, JSON.stringify(events.slice(-5000)));
  } catch {}
};

const writeCustomStructure = (towers: Tower[]) => {
  try {
    localStorage.setItem('entrega_propi_ven_custom_structure', JSON.stringify(towers));
  } catch {}
};

const getApartmentPlacement = (apartment: Apartment) => {
  const raw = String(apartment.number ?? '').trim().toUpperCase();
  if (raw === 'COW') return { floor: 1, order: 999 };

  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return { floor: 0, order: 999 };

  if (digits.length >= 3) {
    const floor = Number(digits.slice(0, digits.length - 2));
    const order = Number(digits.slice(-2));
    return {
      floor: Number.isFinite(floor) ? floor : 0,
      order: Number.isFinite(order) ? order : 999,
    };
  }

  return {
    floor: 0,
    order: Number(digits) || 999,
  };
};

const mergeSheetDataIntoTowers = (baseTowers: Tower[], data: SheetData[]): Tower[] => {
  const statusMap = new Map<string, { status: Status; weeklyGoalDate?: string | null }>();
  const normalizeStatus = (raw: unknown): Status => {
    const s = String(raw ?? '').trim().toLowerCase();
    if (s === 'weekly_goal' || s === 'lista meta semanal') return 'weekly_goal';
    if (s === 'owner_delivered' || s === 'entregado a propietario') return 'owner_delivered';
    if (s === 'post_construction_delivered' || s === 'entregado a post construcción' || s === 'entregado a post construccion') return 'post_construction_delivered';
    if (s === 'notarized' || s === 'escriturado') return 'notarized';
    if (s === 'under_construction' || s === 'en obra') return 'under_construction';
    if (s === 'special' || s === 'área especial' || s === 'area especial') return 'special';
    return 'in_process';
  };

  for (const item of data) {
    const status = normalizeStatus(item.status);
    const towerId = Number(item.towerId);
    const aptNumber = String(item.aptNumber).trim();
    const rawWeekly = (item as SheetData).weeklyGoalDate;
    const weeklyStr = rawWeekly == null ? '' : String(rawWeekly);
    const weeklyValue = normalizeToISODate(weeklyStr) ? weeklyStr : null;
    statusMap.set(`${towerId}-${aptNumber}`, {
      status,
      weeklyGoalDate: weeklyValue
    });
  }

  return baseTowers.map(tower => ({
    ...tower,
    apartments: tower.apartments.map(apt => {
      const key = `${tower.id}-${apt.number}`;
      const entry = statusMap.get(key);

      if (entry?.status && apt.status !== 'special') {
        return { ...apt, status: entry.status, weeklyGoalDate: entry.status === 'weekly_goal' ? (entry.weeklyGoalDate ?? null) : null };
      }
      return apt;
    })
  }));
};

const buildTowersFromSheetData = (data: SheetData[]): Tower[] => {
  const normalizeStatus = (raw: unknown): Status => {
    const s = String(raw ?? '').trim().toLowerCase();
    if (s === 'weekly_goal' || s === 'lista meta semanal') return 'weekly_goal';
    if (s === 'owner_delivered' || s === 'entregado a propietario') return 'owner_delivered';
    if (s === 'post_construction_delivered' || s === 'entregado a post construcción' || s === 'entregado a post construccion') return 'post_construction_delivered';
    if (s === 'notarized' || s === 'escriturado') return 'notarized';
    if (s === 'under_construction' || s === 'en obra') return 'under_construction';
    if (s === 'special' || s === 'área especial' || s === 'area especial') return 'special';
    return 'in_process';
  };

  const towersById = new Map<number, Tower>();
  for (const item of data) {
    const towerId = Number(item.towerId);
    if (!Number.isFinite(towerId) || towerId <= 0) continue;
    const aptNumber = String(item.aptNumber ?? '').trim();
    if (!aptNumber) continue;

    let tower = towersById.get(towerId);
    if (!tower) {
      tower = { id: towerId, name: `TORRE ${towerId}`, apartments: [] };
      towersById.set(towerId, tower);
    }

    const rawWeekly = item.weeklyGoalDate;
    const weeklyStr = rawWeekly == null ? '' : String(rawWeekly);
    const weeklyValue = normalizeToISODate(weeklyStr) ? weeklyStr : null;
    const status = normalizeStatus(item.status);

    tower.apartments.push({
      id: `t${towerId}-apt-${aptNumber.replace(/[^\w-]+/g, '_')}`,
      number: aptNumber,
      status,
      weeklyGoalDate: status === 'weekly_goal' ? (weeklyValue ?? null) : null,
    });
  }

  const parseApartmentOrder = (value: string) => {
    const upper = String(value ?? '').trim().toUpperCase();
    if (upper === 'COW') return { rank: 999999, raw: upper };
    const numeric = Number(upper.replace(/[^\d]/g, ''));
    if (Number.isFinite(numeric) && numeric > 0) return { rank: numeric, raw: upper };
    return { rank: 500000, raw: upper };
  };

  return Array.from(towersById.values())
    .sort((a, b) => a.id - b.id)
    .map((tower) => ({
      ...tower,
      apartments: tower.apartments.slice().sort((a, b) => {
        const aa = parseApartmentOrder(a.number);
        const bb = parseApartmentOrder(b.number);
        if (aa.rank !== bb.rank) return aa.rank - bb.rank;
        return aa.raw.localeCompare(bb.raw, 'es');
      }),
    }));
};

// --- Components ---

const ApartmentCell = ({ 
  apartment, 
  onClick 
}: { 
  apartment: Apartment; 
  onClick: (apt: Apartment) => void;
  key?: string;
}) => {
  const getStatusStyles = (status: Status) => {
    switch (status) {
      case 'owner_delivered':
        return 'bg-blue-600 text-white border-blue-700';
      case 'post_construction_delivered':
        return 'bg-green-500 text-white border-green-600';
      case 'notarized':
        return 'bg-orange-500 text-white border-orange-600';
      case 'weekly_goal':
        return 'bg-red-600 text-white border-red-700';
      case 'in_process':
        return 'bg-white text-alcabama-black border-alcabama-light-grey';
      case 'under_construction':
        return 'bg-gray-400 text-white border-gray-500';
      case 'special':
        return 'bg-white text-alcabama-black border-alcabama-light-grey italic opacity-60';
      default:
        return 'bg-white text-alcabama-black border-alcabama-light-grey';
    }
  };

  return (
    <div
      onClick={() => onClick(apartment)}
      className={`
        flex items-center justify-center h-8 w-full text-[10px] font-medium border
        transition-all duration-200 hover:scale-110 hover:z-10 cursor-pointer shadow-sm
        ${getStatusStyles(apartment.status)}
      `}
      title={`Apartamento ${apartment.number} - ${getStatusLabel(apartment.status)}${apartment.status === 'weekly_goal' && apartment.weeklyGoalDate ? ` (${formatWeeklyGoalDateTime(apartment.weeklyGoalDate) ?? apartment.weeklyGoalDate})` : ''}`}
    >
      {apartment.number}
    </div>
  );
};

const TowerCard = ({ 
  tower, 
  onApartmentClick,
  statusFilter,
  weeklyGoalDateFilter
}: { 
  tower: Tower; 
  onApartmentClick: (apt: Apartment) => void;
  statusFilter: Status | null;
  weeklyGoalDateFilter: string | null;
  key?: string;
}) => {
  // Group apartments by floor (descending)
  const floors = useMemo(() => {
    const grouped: Record<number, Apartment[]> = {};
    tower.apartments.forEach((apt) => {
      const floorNum = getApartmentPlacement(apt).floor;
      if (!grouped[floorNum]) grouped[floorNum] = [];
      grouped[floorNum].push(apt);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => parseInt(b) - parseInt(a))
      .map(([floor, apts]) => ({
        floor: parseInt(floor),
        apts: apts.slice().sort((a, b) => getApartmentPlacement(a).order - getApartmentPlacement(b).order || a.number.localeCompare(b.number, 'es')),
      }));
  }, [tower]);

  const maxApartmentsPerFloor = useMemo(
    () => floors.reduce((max, item) => Math.max(max, item.apts.length), 0) || 4,
    [floors]
  );

  const towerStats = useMemo(() => ({
    owner: tower.apartments.filter(a => a.status === 'owner_delivered').length,
    post: tower.apartments.filter(a => a.status === 'post_construction_delivered').length,
    notarized: tower.apartments.filter(a => a.status === 'notarized').length,
    weekly: tower.apartments.filter(a => a.status === 'weekly_goal').length,
    process: tower.apartments.filter(a => a.status === 'in_process').length,
    underConstruction: tower.apartments.filter(a => a.status === 'under_construction').length,
    total: tower.apartments.filter(a => a.status !== 'special').length,
  }), [tower]);

  const ownerPercentage = towerStats.total > 0
    ? Math.round((towerStats.owner / towerStats.total) * 100)
    : 0;

  const filteredCount = statusFilter
    ? tower.apartments.filter(a =>
        a.status === statusFilter &&
        (statusFilter !== 'weekly_goal' || !weeklyGoalDateFilter || normalizeToISODate(a.weeklyGoalDate) === weeklyGoalDateFilter)
      ).length
    : towerStats.total;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      data-tower-id={tower.id}
      className={`bg-white rounded-xl shadow-lg overflow-hidden border border-alcabama-light-grey flex flex-col ${statusFilter && filteredCount === 0 ? 'opacity-40' : ''}`}
    >
      <div className="bg-alcabama-black text-white py-2 px-4 text-center font-bold text-sm tracking-wider">
        {statusFilter
          ? `${tower.name} - ${getStatusLabel(statusFilter)}${statusFilter === 'weekly_goal' && weeklyGoalDateFilter ? ` ${weeklyGoalDateFilter}` : ''} (${filteredCount})`
          : `${tower.name} - ${ownerPercentage}%`}
      </div>
      
      <div className="p-3 flex-1">
        <div className="grid grid-cols-[40px_1fr] gap-1">
          {/* Header Row */}
          <div className="text-[8px] font-bold text-alcabama-grey flex items-center justify-center uppercase">
            Piso
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${maxApartmentsPerFloor}, minmax(0, 1fr))` }}>
            {Array.from({ length: maxApartmentsPerFloor }, (_, i) => i + 1).map(n => (
              <div key={n} className="text-[8px] font-bold text-alcabama-grey text-center uppercase">
                Apt {n}
              </div>
            ))}
          </div>

          {/* Floor Rows */}
          {floors.map(({ floor, apts }) => (
            <React.Fragment key={floor}>
              <div className="flex items-center justify-center text-[10px] font-bold text-alcabama-dark-grey bg-alcabama-light-grey/20 rounded">
                P{floor}
              </div>
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${maxApartmentsPerFloor}, minmax(0, 1fr))` }}>
                {Array.from({ length: maxApartmentsPerFloor }, (_, idx) => {
                  const apt = apts[idx];
                  if (!apt) return <div key={`${floor}-empty-${idx}`} className="h-8 w-full" />;
                  return statusFilter && (
                    apt.status !== statusFilter ||
                    (statusFilter === 'weekly_goal' && weeklyGoalDateFilter && normalizeToISODate(apt.weeklyGoalDate) !== weeklyGoalDateFilter)
                  )
                    ? <div key={apt.id} className="h-8 w-full" />
                    : (
                      <ApartmentCell
                        key={apt.id}
                        apartment={apt}
                        onClick={onApartmentClick}
                      />
                    );
                })}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="bg-alcabama-light-grey/5 px-4 py-3 border-t border-alcabama-light-grey grid grid-cols-2 gap-2 text-xs text-alcabama-dark-grey leading-tight">
        <div className="flex items-start gap-2">
          <div className="w-2.5 h-2.5 bg-blue-600 rounded-sm shrink-0 mt-0.5" />
          <span className="break-words">Propietarios: <strong className="font-bold">{towerStats.owner}</strong></span>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-2.5 h-2.5 bg-green-500 rounded-sm shrink-0 mt-0.5" />
          <span className="break-words">Post Const.: <strong className="font-bold">{towerStats.post}</strong></span>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-2.5 h-2.5 bg-orange-500 rounded-sm shrink-0 mt-0.5" />
          <span className="break-words">Escriturado: <strong className="font-bold">{towerStats.notarized}</strong></span>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-2.5 h-2.5 bg-red-600 rounded-sm shrink-0 mt-0.5" />
          <span className="break-words">Meta Semanal: <strong className="font-bold">{towerStats.weekly}</strong></span>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-2.5 h-2.5 bg-gray-400 border border-gray-500 rounded-sm shrink-0 mt-0.5" />
          <span className="break-words">En obra: <strong className="font-bold">{towerStats.underConstruction}</strong></span>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-2.5 h-2.5 bg-white border border-alcabama-light-grey rounded-sm shrink-0 mt-0.5" />
          <span className="break-words">Sin proceso: <strong className="font-bold">{towerStats.process}</strong></span>
        </div>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | null>(null);
  const [weeklyGoalDateFilter, setWeeklyGoalDateFilter] = useState<string | null>(null);
  const [weeklyGoalDateInput, setWeeklyGoalDateInput] = useState(() => getLocalISODate());
  const [weeklyGoalTimeInput, setWeeklyGoalTimeInput] = useState(() => getTime24Now());
  const [timelineDateFilter, setTimelineDateFilter] = useState(() => getLocalISODate());
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configPassword, setConfigPassword] = useState('');
  const [configError, setConfigError] = useState('');
  const [isConfigUnlocked, setIsConfigUnlocked] = useState(false);

  // Custom structure state
  const [massGenTowerId, setMassGenTowerId] = useState<number | null>(null);
  const [editingTowerId, setEditingTowerId] = useState<number | null>(null);
  
  const [allTowers, setAllTowers] = useState<Tower[]>(() => getInitialStructure());
  const [editingApartment, setEditingApartment] = useState<{ towerId: number, apartment: Apartment } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isUsingCachedData, setIsUsingCachedData] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const skipNextCacheWriteRef = React.useRef(false);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>(() => readTimelineEvents());
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>(() => readStoredProjectSettings());
  const [tempProjectSettings, setTempProjectSettings] = useState<ProjectSettings>(() => readStoredProjectSettings());
  const [connectionSettings, setConnectionSettings] = useState<ProjectSettings>(() => readStoredProjectSettings());
  const [connectionTestResult, setConnectionTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSavingStructure, setIsSavingStructure] = useState(false);

  React.useEffect(() => {
    const normalized = writeStoredProjectSettings(readStoredProjectSettings());
    setProjectSettings(normalized);
    setTempProjectSettings(normalized);
    setConnectionSettings(normalized);
  }, []);

  React.useEffect(() => {
    document.title = `${projectSettings.projectName} | Entregas Propietarios`;
  }, [projectSettings.projectName]);

  const applyProjectSettings = React.useCallback((nextValue: Partial<ProjectSettings> | ProjectSettings) => {
    const normalized = writeStoredProjectSettings(nextValue);
    setProjectSettings(normalized);
    setTempProjectSettings(normalized);
    setConnectionSettings(normalized);
    return normalized;
  }, []);

  const handleOpenConfiguredScript = React.useCallback(() => {
    const next = String(connectionSettings.scriptUrl ?? '').trim();
    if (!next) return;
    const u = new URL(next);
    u.searchParams.set('callback', 'cb_test');
    u.searchParams.set('_ts', String(Date.now()));
    window.open(u.toString(), '_blank', 'noopener,noreferrer');
  }, [connectionSettings.scriptUrl]);

  const testScriptUrl = React.useCallback(async (rawUrl: string) => {
    const base = String(rawUrl ?? '').trim();
    if (!base) throw new Error('URL vacía.');
    const url = new URL(base);
    url.searchParams.set('_ts', String(Date.now()));
    url.searchParams.set('_', `${Date.now()}_${Math.random().toString(16).slice(2)}`);

    const callbackName = `__gas_test_cb_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    url.searchParams.set('callback', callbackName);

    const w = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');
    script.async = true;
    script.src = url.toString();

    await new Promise<void>((resolve, reject) => {
      let done = false;
      const cleanup = () => {
        try {
          delete w[callbackName];
        } catch {
          w[callbackName] = undefined;
        }
        if (script.parentNode) script.parentNode.removeChild(script);
      };

      const timer = window.setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        reject(new Error(`Timeout: ${script.src}`));
      }, 20000);

      w[callbackName] = (data: any) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        cleanup();
        const hasError = data && typeof data === 'object' && typeof data.error === 'string' && String(data.error).trim();
        if (hasError) reject(new Error(String(data.error)));
        else resolve();
      };

      script.onerror = () => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        cleanup();
        reject(new Error(`Load error: ${script.src}`));
      };

      document.head.appendChild(script);
    });
  }, []);

  const clearAllFilters = () => {
    setStatusFilter(null);
    setWeeklyGoalDateFilter(null);
    setSearchTerm('');
    setTimelineDateFilter(getLocalISODate());
  };

  React.useEffect(() => {
    if (!editingApartment) return;
    const d = editingApartment.apartment.weeklyGoalDate;
    const fallback = getLocalISODate();
    setWeeklyGoalDateInput(normalizeToISODate(d) ?? fallback);
    setWeeklyGoalTimeInput(extractTime24(d) ?? getTime24Now());
  }, [editingApartment]);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refreshData = React.useCallback(async () => {
    setIsRefreshing(true);
    setSyncError(null);
    try {
      const data = await fetchSheetData();
      if (!data) throw new Error('No data received');
      const nextTowers = buildTowersFromSheetData(data);
      skipNextCacheWriteRef.current = true;
      setAllTowers(nextTowers);
      writeCachedTowers(nextTowers);
      writeCustomStructure(nextTowers);
      setIsUsingCachedData(false);
      setLastUpdatedAt(Date.now());
    } catch {
      const cached = readCachedTowers();
      if (cached) {
        skipNextCacheWriteRef.current = true;
        setAllTowers(cached.towers);
        setIsUsingCachedData(true);
        setLastUpdatedAt(cached.savedAt);
        setSyncError('No se pudo actualizar desde Google Sheets. Mostrando última información guardada.');
      } else {
        setSyncError('No se pudo cargar la información desde Google Sheets. Intenta de nuevo.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const openConnectionModal = React.useCallback(() => {
    setConnectionTestResult(null);
    setConnectionSettings(readStoredProjectSettings());
    setShowConnectionModal(true);
  }, []);

  const syncEscrituras = React.useCallback(async () => {
    if (!isOnline) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const ok = await triggerSync();
      if (!ok) {
        setSyncError('No se pudo sincronizar. Revisa el Apps Script (permisos / Drive API / despliegue).');
        return;
      }
      await refreshData();
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, refreshData]);

  React.useEffect(() => {
    if (isLoading) return;
    if (skipNextCacheWriteRef.current) {
      skipNextCacheWriteRef.current = false;
      return;
    }
    writeCachedTowers(allTowers);
  }, [allTowers, isLoading]);

  React.useEffect(() => {
    const cached = readCachedTowers();
    if (cached) {
      skipNextCacheWriteRef.current = true;
      setAllTowers(cached.towers);
      setIsUsingCachedData(true);
      setLastUpdatedAt(cached.savedAt);
      setIsLoading(false);
    }
    refreshData();
  }, [refreshData]);

  // Password Protection State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [pendingStatus, setPendingStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [isEditMode, setIsEditMode] = useState(() => sessionStorage.getItem('isEditMode') === 'true');
  React.useEffect(() => {
    if (isEditMode) setIsConfigUnlocked(true);
  }, [isEditMode]);

  React.useEffect(() => {
    sessionStorage.setItem('isEditMode', isEditMode.toString());
  }, [isEditMode]);

  const openProjectBuilder = React.useCallback(() => {
    const currentSettings = readStoredProjectSettings();
    setTempProjectSettings(currentSettings);
    if (!isEditMode) setIsConfigUnlocked(false);
    setConfigPassword('');
    setConfigError('');
    setShowConfigModal(true);
  }, [isEditMode]);

  const handleSaveConnectionSettings = React.useCallback(async () => {
    const normalized = applyProjectSettings(connectionSettings);
    setConnectionTestResult({ ok: true, message: 'Configuracion guardada. Actualizando datos del tablero...' });
    try {
      await refreshData();
      setConnectionSettings(normalized);
      setShowConnectionModal(false);
    } catch {
      setConnectionSettings(normalized);
    }
  }, [applyProjectSettings, connectionSettings, refreshData]);

  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());
  const [isSaving, setIsSaving] = useState(false);

  // Warn before unload if there are pending changes
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingChanges.size > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingChanges]);

  const handleStatusChange = (newStatus: Status) => {
    if (!editingApartment) return;
    
    // If in edit mode, apply change immediately
    if (isEditMode) {
      const weeklyGoalValue = buildWeeklyGoalDateTimeValue(weeklyGoalDateInput, weeklyGoalTimeInput);
      const nowDate = getLocalISODate();
      const nowTs = Date.now();
      // Optimistic update
      setAllTowers(prev => prev.map(tower => {
        if (tower.id !== editingApartment.towerId) return tower;
        return {
          ...tower,
          apartments: tower.apartments.map(apt => 
            apt.id === editingApartment.apartment.id
              ? { ...apt, status: newStatus, weeklyGoalDate: newStatus === 'weekly_goal' ? weeklyGoalValue : null }
              : apt
          )
        };
      }));

      // Add to pending changes
      setPendingChanges(prev => {
        const newMap = new Map(prev);
        const key = `${editingApartment.towerId}-${editingApartment.apartment.number}`;
        newMap.set(key, {
          towerId: editingApartment.towerId,
          aptNumber: editingApartment.apartment.number,
          status: newStatus,
          weeklyGoalDate: newStatus === 'weekly_goal' ? weeklyGoalValue : null
        });
        return newMap;
      });

      const statusChanged = editingApartment.apartment.status !== newStatus;
      const dateChanged = newStatus === 'weekly_goal' && editingApartment.apartment.weeklyGoalDate !== weeklyGoalValue;

      if (statusChanged || dateChanged) {
        const eventDate = newStatus === 'weekly_goal' && weeklyGoalValue 
          ? (normalizeToISODate(weeklyGoalValue) ?? nowDate) 
          : nowDate;

        const event: TimelineEvent = {
          towerId: editingApartment.towerId,
          aptNumber: editingApartment.apartment.number,
          status: newStatus,
          date: eventDate,
          ts: nowTs
        };

        setTimelineEvents(prev => {
          const next = [...prev, event].slice(-5000);
          writeTimelineEvents(next);
          return next;
        });
      }

      setIsUsingCachedData(false);
      setLastUpdatedAt(Date.now());
      setEditingApartment(null);
    } else {
      // If not in edit mode, this shouldn't happen via UI but as a safeguard
      // we can prompt for edit mode or just ignore. 
    }
  };

  const handleRestoreApartment = () => {
    if (!editingApartment) return;
    if (!isEditMode) return;
    if (editingApartment.apartment.status === 'special') return;

    const key = `${editingApartment.towerId}-${editingApartment.apartment.number}`;

    setTimelineEvents(prev => {
      const next = prev.filter((e) => !(e.towerId === editingApartment.towerId && e.aptNumber === editingApartment.apartment.number));
      writeTimelineEvents(next);
      return next;
    });

    setPendingChanges(prev => {
      const next = new Map(prev);
      next.set(key, {
        towerId: editingApartment.towerId,
        aptNumber: editingApartment.apartment.number,
        status: 'under_construction',
        weeklyGoalDate: null
      });
      return next;
    });

    setAllTowers(prev => prev.map(tower => {
      if (tower.id !== editingApartment.towerId) return tower;
      return {
        ...tower,
        apartments: tower.apartments.map(apt =>
          apt.id === editingApartment.apartment.id
            ? { ...apt, status: 'under_construction', weeklyGoalDate: null }
            : apt
        )
      };
    }));

    setIsUsingCachedData(false);
    setLastUpdatedAt(Date.now());
    setEditingApartment(null);
  };

  const handleSaveChanges = async () => {
    if (pendingChanges.size === 0) return;
    
    setIsSaving(true);
    
    try {
      // Process all pending changes
      // Since GAS API (as implemented) handles one by one, we loop.
      // Ideally we would update GAS to handle batch, but for now we loop.
      const changes: PendingChange[] = Array.from(pendingChanges.values());
      let successCount = 0;
      
      // Execute sequentially to avoid overwhelming the script/rate limits if any
      for (const change of changes) {
        const success = await updateSheetStatus(change.towerId, change.aptNumber, change.status, change.weeklyGoalDate);
        if (success) successCount++;
      }
      
      if (successCount === changes.length) {
        setPendingChanges(new Map<string, PendingChange>());
        writeCachedTowers(allTowers);
        setIsUsingCachedData(false);
        setLastUpdatedAt(Date.now());
      } else {
        console.error(`Failed to save ${changes.length - successCount} changes`);
        // We could keep failed changes in the map, but for simplicity let's clear all 
        // and rely on the user to check if something looks wrong or just re-edit.
        // Or better: keep failed ones? 
        // For now, let's clear and assume retries will happen if user notices.
        setPendingChanges(new Map<string, PendingChange>()); 
        alert('Algunos cambios no se pudieron guardar. Por favor verifica.');
      }
    } catch (err) {
      console.error('Error saving changes:', err);
      alert('Error al guardar cambios.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProjectStructure = async () => {
    setIsSavingStructure(true);
    try {
      const normalizedSettings = applyProjectSettings(tempProjectSettings);

      try {
        localStorage.setItem('entrega_propi_ven_custom_structure', JSON.stringify(allTowers));
      } catch {
      }

      const payload = allTowers.map((tower) => ({
        id: tower.id,
        apartments: tower.apartments.map((apt) => ({
          number: apt.number,
          status: apt.status,
          weeklyGoalDate: apt.weeklyGoalDate ?? null,
        })),
      }));

      const saved = await saveSheetStructure(payload);
      if (!saved) {
        alert('No se pudo enviar la estructura al Apps Script. Verifica la URL desplegada.');
        setProjectSettings(normalizedSettings);
        setConnectionSettings(normalizedSettings);
        return;
      }

      setProjectSettings(normalizedSettings);
      setConnectionSettings(normalizedSettings);
      setShowConfigModal(false);
      window.setTimeout(() => {
        refreshData();
      }, 1200);
    } catch (error) {
      console.error('Error saving project structure:', error);
      alert('Error al guardar la estructura del proyecto.');
    } finally {
      setIsSavingStructure(false);
    }
  };

  const showTimelineItemInTower = (towerId: number, date: string) => {
    setTimelineDateFilter(date);
    setStatusFilter(null);
    setWeeklyGoalDateFilter(null);
    setSearchTerm(`TORRE ${towerId}`);

    window.setTimeout(() => {
      const el = document.querySelector(`[data-tower-id="${towerId}"]`);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const handleEnableEditMode = () => {
    setShowPasswordModal(true);
    setPassword('');
    setError('');
    setShowPassword(false);
  };

  const confirmStatusChange = () => {
    if (password === 'Alcabama2026') {
      setIsEditMode(true);
      setShowPasswordModal(false);
      setPassword('');
    } else {
      setError('Contraseña incorrecta');
    }
  };

  const filteredTowers = useMemo(() => {
    return allTowers.filter(t => 
      t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allTowers, searchTerm]);

  const stats = useMemo(() => {
    const total = allTowers.reduce((acc, t) => acc + t.apartments.filter(a => a.status !== 'special').length, 0);
    const ownerDelivered = allTowers.reduce((acc, t) => acc + t.apartments.filter(a => a.status === 'owner_delivered').length, 0);
    const postConstruction = allTowers.reduce((acc, t) => acc + t.apartments.filter(a => a.status === 'post_construction_delivered').length, 0);
    const notarized = allTowers.reduce((acc, t) => acc + t.apartments.filter(a => a.status === 'notarized').length, 0);
    const weeklyGoal = allTowers.reduce((acc, t) => acc + t.apartments.filter(a => a.status === 'weekly_goal').length, 0);
    const inProcess = allTowers.reduce((acc, t) => acc + t.apartments.filter(a => a.status === 'in_process').length, 0);
    const underConstruction = allTowers.reduce((acc, t) => acc + t.apartments.filter(a => a.status === 'under_construction').length, 0);
    
    return {
      total,
      ownerDelivered,
      postConstruction,
      notarized,
      weeklyGoal,
      inProcess,
      underConstruction,
      percentage: Math.round((ownerDelivered / total) * 100)
    };
  }, [allTowers]);

  const weeklyGoalTimeline = useMemo(() => {
    const today = getLocalISODate();

    const addDaysISO = (iso: string, days: number) => {
      const d = new Date(`${iso}T00:00:00`);
      d.setDate(d.getDate() + days);
      return getLocalISODate(d);
    };

    const getDayOfWeekLabel = (iso: string) => {
      const d = new Date(`${iso}T00:00:00`);
      const day = d.getDay();
      const labels = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
      return labels[day] ?? '';
    };

    const latestEventByKey = new Map<string, TimelineEvent>();
    for (const e of timelineEvents) {
      const date = normalizeToISODate(e.date);
      if (!date) continue;
      const key = `${e.towerId}-${e.aptNumber}`;
      const current = latestEventByKey.get(key);
      if (!current || e.ts > current.ts) {
        latestEventByKey.set(key, { ...e, date });
      }
    }

    const weeklyGoalWithDate = allTowers.reduce((acc, tower) => {
      return acc + tower.apartments.filter(a => a.status === 'weekly_goal' && normalizeToISODate(a.weeklyGoalDate)).length;
    }, 0);

    const weeklyGoalWithoutDate = allTowers.reduce((acc, tower) => {
      return acc + tower.apartments.filter(a => a.status === 'weekly_goal' && !normalizeToISODate(a.weeklyGoalDate)).length;
    }, 0);

    type TimelineItem = {
      towerId: number;
      towerName: string;
      aptNumber: string;
      status: Status;
      date: string;
      timeLabel?: string | null;
      ts?: number | null;
    };

    const scheduled = allTowers.flatMap(tower =>
      tower.apartments
        .filter(a => a.status !== 'special')
        .flatMap(a => {
          const key = `${tower.id}-${a.number}`;
          const ev = latestEventByKey.get(key);
          if (ev) {
            let itemDate = ev.date;
            let itemTimeLabel = tsToAmPm(ev.ts);
            
            if (ev.status === 'weekly_goal' && a.weeklyGoalDate) {
               const normalizedGoalDate = normalizeToISODate(a.weeklyGoalDate);
               if (normalizedGoalDate) {
                 itemDate = normalizedGoalDate;
                 const t24 = extractTime24(a.weeklyGoalDate);
                 itemTimeLabel = t24 ? time24ToAmPm(t24) : null;
               }
            }

            return [{
              towerId: tower.id,
              towerName: tower.name,
              aptNumber: a.number,
              status: ev.status,
              date: itemDate,
              timeLabel: itemTimeLabel,
              ts: ev.ts
            } satisfies TimelineItem];
          }

          if (a.status === 'weekly_goal') {
            const date = normalizeToISODate(a.weeklyGoalDate);
            if (!date) return [];
            const timeLabel = (() => {
              const t24 = extractTime24(a.weeklyGoalDate);
              return t24 ? time24ToAmPm(t24) : null;
            })();
            return [{
              towerId: tower.id,
              towerName: tower.name,
              aptNumber: a.number,
              status: 'weekly_goal' as const,
              date,
              timeLabel,
              ts: null
            } satisfies TimelineItem];
          }

          return [];
        })
    );

    const byDate = new Map<string, TimelineItem[]>();
    for (const item of scheduled) {
      const current = byDate.get(item.date);
      if (current) current.push(item);
      else byDate.set(item.date, [item]);
    }

    for (const items of byDate.values()) {
      items.sort((a, b) => {
        if ((a.ts ?? 0) !== (b.ts ?? 0)) return (a.ts ?? 0) - (b.ts ?? 0);
        if (a.towerId !== b.towerId) return a.towerId - b.towerId;
        return a.aptNumber.localeCompare(b.aptNumber);
      });
    }

    const anchor = normalizeToISODate(timelineDateFilter) ?? today;
    const start = addDaysISO(anchor, -6);

    const days = Array.from({ length: 13 }, (_, i) => {
      const date = addDaysISO(start, i);
      const kind =
        date < today ? 'overdue' :
        date === today ? 'today' :
        'upcoming';

      return {
        indexLabel: getDayOfWeekLabel(date),
        date,
        kind,
        items: byDate.get(date) ?? []
      };
    });

    const selectedDate = normalizeToISODate(timelineDateFilter) ?? today;

    const getWeekStartISO = (iso: string) => {
      const d = new Date(`${iso}T00:00:00`);
      const day = d.getDay();
      const offset = (day + 6) % 7;
      return addDaysISO(iso, -offset);
    };

    const weekStart = getWeekStartISO(today);
    const weekEnd = addDaysISO(weekStart, 6);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i));

    const thisWeek = weekDays
      .filter(d => d !== today)
      .map(d => ({ date: d, items: byDate.get(d) ?? [] }))
      .filter(d => d.items.length > 0);

    const upcoming = Array.from(byDate.entries())
      .filter(([d]) => d > weekEnd)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([, items]) => items);

    const upcomingWeeksMap = new Map<string, TimelineItem[]>();
    for (const [d, items] of byDate.entries()) {
      if (d <= weekEnd) continue;
      const wk = getWeekStartISO(d);
      const current = upcomingWeeksMap.get(wk);
      if (current) current.push(...items);
      else upcomingWeeksMap.set(wk, [...items]);
    }

    for (const items of upcomingWeeksMap.values()) {
      items.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if ((a.ts ?? 0) !== (b.ts ?? 0)) return (a.ts ?? 0) - (b.ts ?? 0);
        if (a.towerId !== b.towerId) return a.towerId - b.towerId;
        return a.aptNumber.localeCompare(b.aptNumber);
      });
    }

    const upcomingWeeks = Array.from(upcomingWeeksMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 4)
      .map(([wkStart, items]) => ({
        weekStart: wkStart,
        weekEnd: addDaysISO(wkStart, 6),
        items
      }));

    return {
      total: scheduled.length,
      weeklyGoalWithDate,
      weeklyGoalWithoutDate,
      today,
      selectedDate,
      weekStart,
      weekEnd,
      thisWeek,
      upcoming,
      upcomingWeeks,
      days,
      byDate
    };
  }, [allTowers, timelineDateFilter, timelineEvents]);

  const pieData = [
    { name: 'Propietario', value: stats.ownerDelivered, color: '#2563eb' },
    { name: 'Post Const.', value: stats.postConstruction, color: '#22c55e' },
    { name: 'Escriturado', value: stats.notarized, color: '#f97316' },
    { name: 'Meta Semanal', value: stats.weeklyGoal, color: '#dc2626' },
    { name: 'En Obra', value: stats.underConstruction, color: '#9ca3af' },
    { name: 'Sin Proceso', value: stats.inProcess, color: '#e5e7eb' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-alcabama-white overflow-x-hidden">
      {/* Navigation / Header */}
      <header className="bg-white border-b border-alcabama-light-grey sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-24">
            <div className="flex items-center">
              <img 
                src={projectSettings.companyLogoUrl}
                alt="Logo corporativo" 
                className="h-10 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            
            {/* Thin Pink Line */}
            <div className="flex-1 mx-12 h-[1px] bg-alcabama-pink/40 hidden md:block" />

            <div className="flex items-center gap-6">
              <div className="hidden md:block text-right">
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-alcabama-grey">Tablero</div>
                <div className="text-lg font-black text-alcabama-black">{projectSettings.projectName}</div>
              </div>
              <img 
                src={projectSettings.projectLogoUrl}
                alt={`Logo ${projectSettings.projectName}`} 
                className="h-16 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Secondary Header for Stats & Search */}
      <div className="bg-alcabama-light-grey/5 border-b border-alcabama-light-grey/20 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-start items-center gap-6">
            <div className="flex items-center gap-8">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Save Button */}
                {isEditMode && pendingChanges.size > 0 && (
                  <button
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed w-full sm:w-auto"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {isSaving ? 'Guardando...' : `Guardar (${pendingChanges.size})`}
                  </button>
                )}

                {/* Config Modal Toggle */}
                <button
                  onClick={openProjectBuilder}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all bg-white text-alcabama-grey border border-alcabama-light-grey hover:bg-alcabama-light-grey/10 w-full sm:w-auto"
                >
                  <Settings size={14} className="text-alcabama-grey" />
                  Configuración
                </button>

                {/* Edit Mode Toggle */}
                <button
                  onClick={() => {
                    if (isEditMode) {
                      setIsEditMode(false);
                    } else {
                      handleEnableEditMode();
                    }
                  }}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all w-full sm:w-auto ${
                    isEditMode 
                      ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' 
                      : 'bg-white text-alcabama-grey border border-alcabama-light-grey hover:bg-alcabama-light-grey/10'
                  }`}
                >
                  <Lock size={14} className={isEditMode ? 'text-white' : 'text-alcabama-grey'} />
                  {isEditMode ? 'Edición Activa' : 'Habilitar Edición'}
                </button>
              </div>
            </div>

            <div className="w-full md:w-auto">
              <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:flex-none md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-alcabama-grey" size={14} />
                  <input 
                    type="text" 
                    placeholder="Buscar torre..."
                    className="bg-white border border-alcabama-light-grey rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-alcabama-pink transition-all w-full shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  onClick={refreshData}
                  disabled={isRefreshing}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold bg-white border border-alcabama-light-grey hover:bg-alcabama-light-grey/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  title="Actualizar información"
                >
                  {isRefreshing ? <Loader2 size={16} className="animate-spin text-alcabama-grey" /> : <RefreshCw size={16} className="text-alcabama-grey" />}
                  Actualizar
                </button>

                <button
                  type="button"
                  onClick={syncEscrituras}
                  disabled={isSyncing || !isOnline}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold bg-white border border-alcabama-light-grey hover:bg-alcabama-light-grey/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  title="Sincronizar escriturados de Ventura"
                >
                  {isSyncing ? <Loader2 size={16} className="animate-spin text-alcabama-grey" /> : <RefreshCw size={16} className="text-alcabama-grey" />}
                  Sincronizar
                </button>

                <button
                  type="button"
                  onClick={openConnectionModal}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold bg-white border border-alcabama-light-grey hover:bg-alcabama-light-grey/10 transition-all"
                  title="Configurar conexión a Google Sheets"
                >
                  <Info size={16} className="text-alcabama-grey" />
                  Conexión
                </button>
              </div>

              <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-alcabama-grey">
                {isUsingCachedData ? 'Mostrando última información guardada' : (isOnline ? 'En línea' : 'Sin señal')}
                {lastUpdatedAt ? ` • Última: ${new Date(lastUpdatedAt).toLocaleString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
                {syncError ? ` • ${syncError}` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* General Progress Chart Section */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-alcabama-light-grey mb-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              
              {/* Left Side: Stacked Progress Bar (Rectangle) */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-end mb-1">
                   <h3 className="text-sm font-bold uppercase tracking-wider text-alcabama-grey">Progreso General</h3>
                   <span className="text-xs font-medium text-alcabama-light-grey">{stats.ownerDelivered} / {stats.total} Entregados</span>
                </div>
                
                {/* The Progress Bar Container */}
                <div className="h-16 w-full flex rounded-xl overflow-hidden bg-gray-100 relative shadow-inner">
                  {pieData.map((item, index) => {
                     const widthPercent = stats.total > 0 ? (item.value / stats.total) * 100 : 0;
                     if (widthPercent <= 0) return null;
                     return (
                       <div 
                         key={item.name}
                         className="h-full relative group transition-all duration-500 ease-out hover:opacity-90 flex items-center justify-center overflow-hidden"
                         style={{ width: `${widthPercent}%`, backgroundColor: item.color }}
                       >
                         {/* Text inside bar if wide enough */}
                         {widthPercent > 8 && (
                            <span className={`text-[10px] md:text-xs font-bold drop-shadow-md ${item.name === 'Sin Proceso' ? 'text-alcabama-dark-grey' : 'text-white'}`}>
                                {Math.round(widthPercent)}%
                            </span>
                         )}

                         {/* Tooltip on Hover */}
                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                           <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl whitespace-nowrap">
                             <div className="font-bold mb-0.5">{item.name}</div>
                             <div>{item.value} unidades ({Math.round(widthPercent)}%)</div>
                             {/* Triangle arrow */}
                             <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                           </div>
                         </div>
                       </div>
                     );
                  })}
                </div>

                {/* Compact Legend */}
                <div className="flex flex-wrap gap-x-6 gap-y-3 mt-4">
                   {pieData.map((item) => {
                      const percent = stats.total > 0 ? ((item.value / stats.total) * 100).toFixed(1) : '0';
                      return (
                        <div key={item.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color, border: item.name === 'Sin Proceso' ? '1px solid #e5e7eb' : 'none' }} />
                          <div className="flex flex-col leading-none">
                             <span className="text-[10px] font-bold text-alcabama-dark-grey uppercase tracking-wide">{item.name}</span>
                             <span className="text-[10px] text-alcabama-grey font-medium mt-0.5">{percent}% ({item.value})</span>
                          </div>
                        </div>
                      );
                   })}
                </div>
              </div>
              
              {/* Right Side: Big Total Number */}
              <div className="flex flex-col items-center justify-center md:border-l md:border-alcabama-light-grey h-full py-4">
                 <span className="text-sm font-bold text-alcabama-grey uppercase tracking-wider mb-2">Total Unidades</span>
                 <span className="text-7xl font-black text-alcabama-black tracking-tight">{stats.total}</span>
                 <div className="mt-2 text-xs text-alcabama-light-grey font-medium bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                    100% del proyecto
                 </div>
              </div>

            </div>

              {/* Dashboard Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-12">
                {[
                  {
                    status: 'owner_delivered' as const,
                    count: stats.ownerDelivered,
                    label: 'Entregado Propietario',
                    iconClassName: 'w-10 h-10 bg-blue-600 rounded-lg mb-2 flex items-center justify-center text-white font-bold',
                    activeClassName: 'ring-2 ring-offset-2 ring-blue-600 border-blue-600',
                    hoverClassName: 'hover:border-blue-600'
                  },
                  {
                    status: 'post_construction_delivered' as const,
                    count: stats.postConstruction,
                    label: 'Post Construcción',
                    iconClassName: 'w-10 h-10 bg-green-500 rounded-lg mb-2 flex items-center justify-center text-white font-bold',
                    activeClassName: 'ring-2 ring-offset-2 ring-green-500 border-green-500',
                    hoverClassName: 'hover:border-green-500'
                  },
                  {
                    status: 'notarized' as const,
                    count: stats.notarized,
                    label: 'Escriturado',
                    iconClassName: 'w-10 h-10 bg-orange-500 rounded-lg mb-2 flex items-center justify-center text-white font-bold',
                    activeClassName: 'ring-2 ring-offset-2 ring-orange-500 border-orange-500',
                    hoverClassName: 'hover:border-orange-500'
                  },
                  {
                    status: 'weekly_goal' as const,
                    count: stats.weeklyGoal,
                    label: 'Meta Semanal',
                    iconClassName: 'w-10 h-10 bg-red-600 rounded-lg mb-2 flex items-center justify-center text-white font-bold',
                    activeClassName: 'ring-2 ring-offset-2 ring-red-600 border-red-600',
                    hoverClassName: 'hover:border-red-600'
                  },
                  {
                    status: 'under_construction' as const,
                    count: stats.underConstruction,
                    label: 'En Obra',
                    iconClassName: 'w-10 h-10 bg-gray-400 rounded-lg mb-2 flex items-center justify-center text-white font-bold',
                    activeClassName: 'ring-2 ring-offset-2 ring-gray-400 border-gray-500',
                    hoverClassName: 'hover:border-gray-500'
                  },
                  {
                    status: 'in_process' as const,
                    count: stats.inProcess,
                    label: 'Sin Proceso',
                    iconClassName: 'w-10 h-10 bg-white border border-alcabama-light-grey rounded-lg mb-2 flex items-center justify-center text-alcabama-black font-bold',
                    activeClassName: 'ring-2 ring-offset-2 ring-alcabama-black border-alcabama-black',
                    hoverClassName: 'hover:border-alcabama-black'
                  }
                ].map((card) => {
                  const isActive = statusFilter === card.status;
                  return (
                    <button
                      key={card.status}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        const next = statusFilter === card.status ? null : card.status;
                        setStatusFilter(next);
                        if (next !== 'weekly_goal') setWeeklyGoalDateFilter(null);
                      }}
                      className={`bg-white p-4 rounded-xl shadow-sm border border-alcabama-light-grey flex flex-col items-center text-center transition-all ${isActive ? card.activeClassName : card.hoverClassName}`}
                    >
                      <div className={card.iconClassName}>
                        {card.count}
                      </div>
                      <p className="text-[10px] text-alcabama-grey uppercase font-bold tracking-wider leading-tight">{card.label}</p>
                    </button>
                  );
                })}
              </div>

              {statusFilter && (
                <div className="mb-8 flex items-center justify-between gap-4 bg-alcabama-light-grey/5 p-4 rounded-xl border border-alcabama-light-grey/20">
                  <div className="flex items-center gap-6">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey">
                      Filtro: <span className="text-alcabama-black">{getStatusLabel(statusFilter)}</span>
                    </div>
                    {statusFilter === 'weekly_goal' && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey">Fecha</span>
                        <input
                          type="date"
                          value={weeklyGoalDateFilter ?? ''}
                          onChange={(e) => setWeeklyGoalDateFilter(e.target.value ? e.target.value : null)}
                          className="h-9 rounded-lg border border-alcabama-light-grey px-3 text-xs text-alcabama-dark-grey"
                        />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey hover:text-alcabama-black transition-colors"
                  >
                    Quitar filtro
                  </button>
                </div>
              )}

              <div className="mb-8 bg-white rounded-xl shadow-sm border border-alcabama-light-grey p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey">Línea de tiempo</div>
                    <div className="text-xs text-alcabama-dark-grey mt-1">
                      Registros en línea de tiempo: <strong className="font-bold">{weeklyGoalTimeline.total}</strong>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-alcabama-grey" size={14} />
                      <input
                        type="text"
                        placeholder="Buscar torre..."
                        className="h-9 w-full rounded-full border border-alcabama-light-grey bg-white pl-10 pr-4 text-sm text-alcabama-dark-grey shadow-sm transition-all focus:outline-none focus:ring-1 focus:ring-alcabama-pink"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey">Fecha</span>
                      <input
                        type="date"
                        value={weeklyGoalTimeline.selectedDate}
                        onChange={(e) => setTimelineDateFilter(e.target.value)}
                        className="h-9 rounded-lg border border-alcabama-light-grey px-3 text-xs text-alcabama-dark-grey"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter(null);
                        setWeeklyGoalDateFilter(null);
                      }}
                      className="h-9 px-3 rounded-lg bg-alcabama-black text-white text-[10px] font-bold uppercase tracking-wider hover:bg-black transition-colors"
                    >
                      Ver en torres
                    </button>
                  </div>
                </div>

                <div className="mt-5">
                  {weeklyGoalTimeline.weeklyGoalWithoutDate > 0 && (
                    <div className="mb-6 rounded-xl border border-alcabama-light-grey/50 bg-alcabama-light-grey/5 p-4 text-sm text-alcabama-grey">
                      Se detectaron {weeklyGoalTimeline.weeklyGoalWithoutDate} entregas sin fecha definida.
                    </div>
                  )}
                  {weeklyGoalTimeline.total === 0 && (
                    <div className="mb-6 rounded-xl border border-alcabama-light-grey/50 bg-alcabama-light-grey/5 p-4 text-sm text-alcabama-grey">
                      No hay registros en la línea de tiempo todavía.
                    </div>
                  )}

                  <div className="w-full overflow-x-auto overscroll-x-contain">
                    <div className="flex items-start gap-2 px-1 min-w-max">
                      {weeklyGoalTimeline.days.map((day) => {
                        const isSelected = weeklyGoalTimeline.selectedDate === day.date;
                        const labelClass = isSelected
                          ? 'bg-alcabama-pink text-white border-alcabama-pink'
                          : 'bg-alcabama-light-grey/10 text-alcabama-dark-grey border-alcabama-light-grey/40';
                        const boxBorder =
                          day.kind === 'overdue'
                            ? 'border-red-600/50 hover:border-red-600'
                            : day.kind === 'today'
                              ? 'border-orange-500/50 hover:border-orange-500'
                              : 'border-alcabama-pink/40 hover:border-alcabama-pink';

                        return (
                          <div key={day.date} className="w-[64px] shrink-0 flex flex-col items-center gap-2">
                            <div className="min-h-[64px] w-full flex flex-col items-center justify-end gap-1">
                              {day.items.slice(0, 5).map((item) => (
                                <button
                                  key={`${day.date}-${item.towerId}-${item.aptNumber}`}
                                  type="button"
                                  onClick={() => showTimelineItemInTower(item.towerId, day.date)}
                                  className={`w-full px-1.5 py-1 rounded-md border text-[9px] font-black shadow-sm transition-colors ${getStatusChipClass(item.status)} ${isSelected ? 'ring-1 ring-alcabama-pink/40' : ''}`}
                                  title={`${getStatusLabel(item.status)} • Torre ${item.towerId} • Apt ${item.aptNumber}${item.timeLabel ? ` • ${item.timeLabel}` : ''}`}
                                >
                                  <div className="leading-none">T{item.towerId}-{item.aptNumber}</div>
                                  {item.timeLabel && <div className="mt-0.5 text-[8px] font-black leading-none opacity-90">{item.timeLabel}</div>}
                                </button>
                              ))}
                              {day.items.length > 5 && (
                                <div className={`w-full px-1.5 py-1 rounded-md border bg-white text-[9px] font-black text-alcabama-grey ${boxBorder}`}>
                                  +{day.items.length - 5}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setTimelineDateFilter(day.date)}
                              className={`w-10 h-10 rounded-md border flex items-center justify-center text-xs font-black tracking-wider ${labelClass}`}
                              aria-label={`Seleccionar día ${day.date}`}
                            >
                              {day.indexLabel}
                            </button>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey">
                              {day.date.slice(8, 10)}/{day.date.slice(5, 7)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-alcabama-light-grey/50 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey">Hoy</div>
                        <div className="text-xs font-bold text-alcabama-black">
                          {weeklyGoalTimeline.byDate.get(weeklyGoalTimeline.today)?.length ?? 0}
                        </div>
                      </div>
                      <div className="text-xs text-alcabama-grey mt-1">{weeklyGoalTimeline.today}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(weeklyGoalTimeline.byDate.get(weeklyGoalTimeline.today) ?? []).slice(0, 20).map((item) => (
                          <button
                            key={`today-${item.towerId}-${item.aptNumber}`}
                            type="button"
                            onClick={() => showTimelineItemInTower(item.towerId, weeklyGoalTimeline.today)}
                            className={`px-2 py-1 rounded-md border text-[10px] font-black transition-colors ${getStatusChipClass(item.status)}`}
                            title={`${getStatusLabel(item.status)} • Torre ${item.towerId} • Apt ${item.aptNumber}${item.timeLabel ? ` • ${item.timeLabel}` : ''}`}
                          >
                            T{item.towerId}-{item.aptNumber}{item.timeLabel ? ` ${item.timeLabel}` : ''}
                          </button>
                        ))}
                        {(weeklyGoalTimeline.byDate.get(weeklyGoalTimeline.today) ?? []).length === 0 && (
                          <div className="text-sm text-alcabama-grey">No hay registros para hoy.</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-alcabama-light-grey/50 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey">Esta semana</div>
                        <div className="text-xs font-bold text-alcabama-black">
                          {weeklyGoalTimeline.thisWeek.reduce((acc, d) => acc + d.items.length, 0)}
                        </div>
                      </div>
                      <div className="text-xs text-alcabama-grey mt-1">{weeklyGoalTimeline.weekStart} → {weeklyGoalTimeline.weekEnd}</div>
                      <div className="mt-3 space-y-3">
                        {weeklyGoalTimeline.thisWeek.length === 0 ? (
                          <div className="text-sm text-alcabama-grey">No hay más registros esta semana.</div>
                        ) : (
                          weeklyGoalTimeline.thisWeek.map((d) => (
                            <div key={`wk-${d.date}`}>
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-bold text-alcabama-black">{d.date}</div>
                                <div className="text-xs text-alcabama-grey">{d.items.length}</div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {d.items.slice(0, 20).map((item) => (
                                  <button
                                    key={`${d.date}-${item.towerId}-${item.aptNumber}`}
                                    type="button"
                                    onClick={() => showTimelineItemInTower(item.towerId, d.date)}
                                    className={`px-2 py-1 rounded-md border text-[10px] font-black transition-colors ${getStatusChipClass(item.status)}`}
                                    title={`${getStatusLabel(item.status)} • Torre ${item.towerId} • Apt ${item.aptNumber}${item.timeLabel ? ` • ${item.timeLabel}` : ''}`}
                                  >
                                    T{item.towerId}-{item.aptNumber}{item.timeLabel ? ` ${item.timeLabel}` : ''}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-alcabama-light-grey/50 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey">Próximas</div>
                        <div className="text-xs font-bold text-alcabama-black">{weeklyGoalTimeline.upcoming.length}</div>
                      </div>
                      <div className="text-xs text-alcabama-grey mt-1">Próximas semanas</div>
                      <div className="mt-3 space-y-3">
                        {weeklyGoalTimeline.upcomingWeeks.length === 0 ? (
                          <div className="text-sm text-alcabama-grey">No hay registros para las próximas semanas.</div>
                        ) : (
                          weeklyGoalTimeline.upcomingWeeks.map((w) => (
                            <div key={`up-${w.weekStart}`} className="rounded-lg border border-alcabama-light-grey/40 bg-alcabama-light-grey/5 p-3">
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-bold text-alcabama-black">{w.weekStart} → {w.weekEnd}</div>
                                <div className="text-xs text-alcabama-grey">{w.items.length}</div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {w.items.slice(0, 24).map((item) => (
                                  <button
                                    key={`up-${item.date}-${item.towerId}-${item.aptNumber}`}
                                    type="button"
                                    onClick={() => showTimelineItemInTower(item.towerId, item.date)}
                                    className={`px-2 py-1 rounded-md border text-[10px] font-black transition-colors ${getStatusChipClass(item.status)}`}
                                    title={`${item.date}${item.timeLabel ? ` • ${item.timeLabel}` : ''} • ${getStatusLabel(item.status)} • Torre ${item.towerId} • Apt ${item.aptNumber}`}
                                  >
                                    {item.date.slice(8, 10)}/{item.date.slice(5, 7)} T{item.towerId}-{item.aptNumber}{item.timeLabel ? ` ${item.timeLabel}` : ''}
                                  </button>
                                ))}
                                {w.items.length > 24 && (
                                  <div className="px-2 py-1 rounded-md text-[10px] font-black bg-white border border-alcabama-light-grey text-alcabama-grey">
                                    +{w.items.length - 24}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="relative mt-3">
                    <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-[2px] bg-alcabama-pink/40" />
                    <div className="flex items-center justify-between gap-2">
                      {weeklyGoalTimeline.days.map((day) => {
                        const isSelected = weeklyGoalTimeline.selectedDate === day.date;
                        const hasItems = day.items.length > 0;
                        const dotBase =
                          day.kind === 'overdue'
                            ? 'bg-red-600 border-red-700'
                            : day.kind === 'today'
                              ? 'bg-orange-500 border-orange-600'
                              : 'bg-alcabama-pink border-alcabama-pink';

                        const dotClass = hasItems
                          ? `${dotBase} shadow-md`
                          : 'bg-white border-alcabama-light-grey';

                        const sizeClass = isSelected ? 'w-4 h-4' : hasItems ? 'w-3 h-3' : 'w-2.5 h-2.5';

                        return (
                          <button
                            key={`${day.date}-dot`}
                            type="button"
                            onClick={() => setTimelineDateFilter(day.date)}
                            className="flex-1 relative flex items-center justify-center py-4"
                            aria-label={`Día ${day.date}`}
                          >
                            <span className={`rounded-full border ${dotClass} ${sizeClass}`} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-alcabama-light-grey/50 bg-alcabama-light-grey/5 p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div className="text-sm font-bold text-alcabama-black">
                        {weeklyGoalTimeline.selectedDate}
                      </div>
                      <div className="text-xs text-alcabama-grey">
                        {weeklyGoalTimeline.byDate.get(weeklyGoalTimeline.selectedDate)?.length ?? 0} registros
                      </div>
                    </div>

                    {(() => {
                      const selectedItems = weeklyGoalTimeline.byDate.get(weeklyGoalTimeline.selectedDate) ?? [];
                      if (selectedItems.length === 0) {
                        return <div className="mt-3 text-sm text-alcabama-grey">No hay registros para este día.</div>;
                      }

                      const byTower = new Map<number, { aptNumber: string; status: Status; timeLabel?: string | null; ts?: number | null }[]>();
                      for (const item of selectedItems) {
                        const current = byTower.get(item.towerId);
                        const payload = { aptNumber: item.aptNumber, status: item.status, timeLabel: item.timeLabel ?? null, ts: item.ts ?? null };
                        if (current) current.push(payload);
                        else byTower.set(item.towerId, [payload]);
                      }

                      const towers = Array.from(byTower.entries()).sort(([a], [b]) => a - b);

                      return (
                        <div className="mt-3 space-y-2">
                          {towers.map(([towerId, apts]) => (
                            <div key={towerId} className="flex flex-wrap items-center gap-2">
                              <span className="px-2 py-1 rounded-md text-[10px] font-black bg-alcabama-black text-white">
                                T{towerId}
                              </span>
                              {apts.slice(0, 30).map((apt) => (
                                <span
                                  key={`${towerId}-${apt.aptNumber}-${apt.status}-${apt.timeLabel ?? ''}-${apt.ts ?? ''}`}
                                  className={`px-2 py-1 rounded-md border text-[10px] font-bold ${getStatusChipClass(apt.status)}`}
                                  title={`${getStatusLabel(apt.status)}${apt.timeLabel ? ` • ${apt.timeLabel}` : ''}`}
                                >
                                  {apt.aptNumber}{apt.timeLabel ? ` ${apt.timeLabel}` : ''}
                                </span>
                              ))}
                              {apts.length > 30 && (
                                <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-white border border-alcabama-light-grey text-alcabama-grey">
                                  +{apts.length - 30} más
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 mb-8 bg-alcabama-light-grey/5 p-4 rounded-xl border border-alcabama-light-grey/20">
                <span className="text-[10px] font-bold uppercase text-alcabama-grey">Convenciones:</span>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-600 rounded-sm" />
                  <span className="text-[10px] text-alcabama-dark-grey">Entregado a propietario</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-sm" />
                  <span className="text-[10px] text-alcabama-dark-grey">Entregado a Post construcción</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-sm" />
                  <span className="text-[10px] text-alcabama-dark-grey">Escriturado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-600 rounded-sm" />
                  <span className="text-[10px] text-alcabama-dark-grey">Lista meta semanal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-400 border border-gray-500 rounded-sm" />
                  <span className="text-[10px] text-alcabama-dark-grey">En obra</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-white border border-alcabama-light-grey rounded-sm" />
                  <span className="text-[10px] text-alcabama-dark-grey">Sin proceso</span>
                </div>
              </div>

              {/* Towers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {filteredTowers.map((tower) => (
                  <TowerCard 
                    key={tower.id} 
                    tower={tower} 
                    onApartmentClick={(apt) => setEditingApartment({ towerId: tower.id, apartment: apt })}
                    statusFilter={statusFilter}
                    weeklyGoalDateFilter={weeklyGoalDateFilter}
                  />
                ))}
              </div>

              {filteredTowers.length === 0 && (
                <div className="text-center py-20">
                  <Building2 size={48} className="mx-auto text-alcabama-light-grey mb-4" />
                  <p className="text-alcabama-grey">No se encontraron torres que coincidan con "{searchTerm}"</p>
                </div>
              )}
            </motion.div>
      </main>

      {/* Footer */}
      <footer className="bg-alcabama-black text-white py-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-8">
          <img 
            src={projectSettings.companyFooterLogoUrl}
            alt="Logo corporativo footer" 
            className="h-8 opacity-50"
            referrerPolicy="no-referrer"
          />
          <div className="text-center md:text-right">
            <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] mb-2">Plataforma de Gestion de Entregas</p>
            <p className="text-xs text-white/60 mb-1">Proyecto activo: {projectSettings.projectName}</p>
            <p className="text-xs text-white/60">© {new Date().getFullYear()} Inversiones Alcabama S.A. Todos los derechos reservados. v1.2</p>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {showConnectionModal && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConnectionModal(false)}
              className="absolute inset-0 bg-alcabama-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
            >
              <div className="bg-alcabama-black px-6 py-5 text-white flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-black uppercase tracking-widest">Conexión</div>
                  <div className="text-xs text-white/60 mt-1">Configura Apps Script, Sheet ID y nombre de hoja sin recodificar.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConnectionModal(false)}
                  className="px-3 py-2 rounded-lg border border-white/15 bg-white/10 text-xs font-black uppercase tracking-widest hover:bg-white/15"
                >
                  Cerrar
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="text-xs text-alcabama-grey leading-relaxed">
                  La hoja y la carpeta de Drive son privadas. Para que esto funcione sin iniciar sesion, el Web App de Apps Script debe estar desplegado como: ejecutar como "yo" y acceso "cualquiera".
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey mb-2">URL Web App (Apps Script)</div>
                  <input
                    value={connectionSettings.scriptUrl}
                    onChange={(e) => setConnectionSettings((prev) => ({ ...prev, scriptUrl: e.target.value }))}
                    className="w-full rounded-xl border border-alcabama-light-grey px-4 py-3 text-sm font-medium text-alcabama-dark-grey focus:outline-none focus:ring-1 focus:ring-alcabama-pink"
                    placeholder="https://script.google.com/macros/s/.../exec"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey mb-2">Google Sheet ID</div>
                    <input
                      value={connectionSettings.sheetId}
                      onChange={(e) => setConnectionSettings((prev) => ({ ...prev, sheetId: e.target.value }))}
                      className="w-full rounded-xl border border-alcabama-light-grey px-4 py-3 text-sm font-medium text-alcabama-dark-grey focus:outline-none focus:ring-1 focus:ring-alcabama-pink"
                      placeholder="1AbCDeF..."
                    />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey mb-2">Nombre de hoja</div>
                    <input
                      value={connectionSettings.sheetName}
                      onChange={(e) => setConnectionSettings((prev) => ({ ...prev, sheetName: e.target.value }))}
                      className="w-full rounded-xl border border-alcabama-light-grey px-4 py-3 text-sm font-medium text-alcabama-dark-grey focus:outline-none focus:ring-1 focus:ring-alcabama-pink"
                      placeholder="Datos_VEN"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-alcabama-light-grey bg-alcabama-light-grey/5 p-4 text-xs text-alcabama-dark-grey">
                  Proyecto activo: <strong className="font-bold">{projectSettings.projectName}</strong><br />
                  Hoja actual: <strong className="font-bold">{connectionSettings.sheetName}</strong><br />
                  Sheet ID: <strong className="font-bold break-all">{connectionSettings.sheetId}</strong>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    disabled={isTestingConnection}
                    onClick={async () => {
                      setIsTestingConnection(true);
                      setConnectionTestResult(null);
                      try {
                        await testScriptUrl(connectionSettings.scriptUrl);
                        setConnectionTestResult({ ok: true, message: 'Conexion OK. El endpoint del Apps Script respondio JSONP.' });
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : String(e);
                        setConnectionTestResult({ ok: false, message: msg });
                      } finally {
                        setIsTestingConnection(false);
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-white border border-alcabama-light-grey hover:bg-alcabama-light-grey/10 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isTestingConnection ? <Loader2 size={14} className="animate-spin text-alcabama-grey" /> : <Info size={14} className="text-alcabama-grey" />}
                    Probar
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveConnectionSettings}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-alcabama-pink text-white hover:bg-alcabama-pink/90"
                  >
                    Guardar
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenConfiguredScript}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-white border border-alcabama-light-grey hover:bg-alcabama-light-grey/10"
                  >
                    Abrir
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setConnectionSettings((prev) => ({
                      ...prev,
                      scriptUrl: DEFAULT_PROJECT_SETTINGS.scriptUrl,
                      sheetId: DEFAULT_PROJECT_SETTINGS.sheetId,
                      sheetName: DEFAULT_PROJECT_SETTINGS.sheetName,
                    }));
                    setConnectionTestResult(null);
                  }}
                  className="w-full px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-white border border-alcabama-light-grey hover:bg-alcabama-light-grey/10"
                >
                  Restaurar conexion base
                </button>

                {connectionTestResult && (
                  <div className={`rounded-xl border p-4 text-xs break-words ${
                    connectionTestResult.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'
                  }`}>
                    {connectionTestResult.message}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingApartment && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingApartment(null)}
              className="absolute inset-0 bg-alcabama-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col"
            >
              <div className="bg-alcabama-black p-6 text-white">
                <h3 className="text-xl font-bold">{isEditMode ? 'Actualizar Estado' : 'Detalle'}</h3>
                <p className="text-xs text-white/60 uppercase tracking-widest mt-1">
                  Torre {editingApartment.towerId} • Apartamento {editingApartment.apartment.number}
                </p>
              </div>
              
              <div className="p-6 space-y-3 overflow-y-auto flex-1">
                {!isEditMode && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-alcabama-light-grey bg-white p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey">Estado actual</div>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full ${
                            editingApartment.apartment.status === 'owner_delivered'
                              ? 'bg-blue-600'
                              : editingApartment.apartment.status === 'post_construction_delivered'
                                ? 'bg-green-500'
                                : editingApartment.apartment.status === 'notarized'
                                  ? 'bg-orange-500'
                                  : editingApartment.apartment.status === 'weekly_goal'
                                    ? 'bg-red-600'
                                    : editingApartment.apartment.status === 'under_construction'
                                      ? 'bg-gray-400'
                                      : 'bg-alcabama-light-grey'
                          }`}
                        />
                        <div className="text-sm font-bold text-alcabama-dark-grey">
                          {getStatusLabel(editingApartment.apartment.status)}
                        </div>
                      </div>
                      {editingApartment.apartment.status === 'weekly_goal' && (
                        <div className="mt-2 text-xs text-alcabama-grey">
                          {editingApartment.apartment.weeklyGoalDate
                            ? `Fecha meta semanal: ${formatWeeklyGoalDateTime(editingApartment.apartment.weeklyGoalDate) ?? editingApartment.apartment.weeklyGoalDate}`
                            : 'Fecha meta semanal: sin fecha definida'}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setEditingApartment(null)}
                      className="w-full py-3 text-xs font-bold uppercase tracking-widest text-alcabama-grey hover:text-alcabama-black transition-colors"
                    >
                      Cerrar
                    </button>
                  </div>
                )}

                {isEditMode && (
                  <>
                    <p className="text-[10px] font-bold uppercase text-alcabama-grey mb-4">Selecciona el nuevo estado:</p>
                
                <button 
                  onClick={() => handleStatusChange('owner_delivered')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-alcabama-light-grey hover:border-blue-600 hover:bg-blue-50 transition-all group"
                >
                  <div className="w-4 h-4 bg-blue-600 rounded-full" />
                  <span className="text-sm font-medium text-alcabama-dark-grey group-hover:text-blue-700">Entregado a propietario</span>
                </button>

                <button 
                  onClick={() => handleStatusChange('post_construction_delivered')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-alcabama-light-grey hover:border-green-500 hover:bg-green-50 transition-all group"
                >
                  <div className="w-4 h-4 bg-green-500 rounded-full" />
                  <span className="text-sm font-medium text-alcabama-dark-grey group-hover:text-green-700">Entregado a Post construcción</span>
                </button>

                <button
                  onClick={() => handleStatusChange('notarized')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-alcabama-light-grey hover:border-orange-500 hover:bg-orange-50 transition-all group"
                >
                  <div className="w-4 h-4 bg-orange-500 rounded-full" />
                  <span className="text-sm font-medium text-alcabama-dark-grey group-hover:text-orange-700">Escriturado</span>
                </button>

                <div className="w-full flex items-center justify-between gap-4 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-alcabama-grey">Fecha meta semanal</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={weeklyGoalDateInput}
                      onChange={(e) => setWeeklyGoalDateInput(e.target.value)}
                      className="h-9 rounded-lg border border-alcabama-light-grey px-3 text-xs text-alcabama-dark-grey"
                    />
                    <input
                      type="time"
                      value={weeklyGoalTimeInput}
                      onChange={(e) => setWeeklyGoalTimeInput(e.target.value)}
                      className="h-9 rounded-lg border border-alcabama-light-grey px-3 text-xs text-alcabama-dark-grey"
                    />
                  </div>
                </div>

                <button 
                  onClick={() => handleStatusChange('weekly_goal')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-alcabama-light-grey hover:border-red-600 hover:bg-red-50 transition-all group"
                >
                  <div className="w-4 h-4 bg-red-600 rounded-full" />
                  <span className="text-sm font-medium text-alcabama-dark-grey group-hover:text-red-700">Lista meta semanal</span>
                </button>

                <button 
                  onClick={() => handleStatusChange('under_construction')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-alcabama-light-grey hover:border-gray-500 hover:bg-gray-50 transition-all group"
                >
                  <div className="w-4 h-4 bg-gray-400 rounded-full" />
                  <span className="text-sm font-medium text-alcabama-dark-grey group-hover:text-gray-600">En obra</span>
                </button>

                <button 
                  onClick={() => handleStatusChange('in_process')}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-alcabama-light-grey hover:border-alcabama-black hover:bg-alcabama-light-grey/5 transition-all group"
                >
                  <div className="w-4 h-4 bg-white border border-alcabama-light-grey rounded-full" />
                  <span className="text-sm font-medium text-alcabama-dark-grey group-hover:text-alcabama-black">Sin proceso</span>
                </button>

                <button
                  type="button"
                  onClick={handleRestoreApartment}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-alcabama-light-grey hover:border-alcabama-black hover:bg-alcabama-light-grey/10 transition-all group"
                >
                  <div className="w-4 h-4 bg-alcabama-black rounded-full" />
                  <span className="text-sm font-medium text-alcabama-dark-grey group-hover:text-alcabama-black">Restaurar (En obra)</span>
                </button>

                <div className="pt-4">
                  <button 
                    onClick={() => setEditingApartment(null)}
                    className="w-full py-3 text-xs font-bold uppercase tracking-widest text-alcabama-grey hover:text-alcabama-black transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPasswordModal(false)}
              className="absolute inset-0 bg-alcabama-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
              <div className="bg-alcabama-black p-6 text-white flex items-center gap-3">
                <Lock size={20} />
                <h3 className="text-lg font-bold">Verificar Identidad</h3>
              </div>
              
              <div className="p-6 space-y-4">
                <p className="text-sm text-alcabama-grey">
                  Ingresa la contraseña para confirmar el cambio de estado.
                </p>
                
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Contraseña"
                      className="w-full px-4 py-3 rounded-xl border border-alcabama-light-grey focus:outline-none focus:ring-2 focus:ring-alcabama-black/20 focus:border-alcabama-black transition-all"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && confirmStatusChange()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-alcabama-grey hover:text-alcabama-black transition-colors"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {error && (
                    <p className="text-xs text-red-500 font-bold ml-1">{error}</p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setShowPasswordModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-alcabama-grey hover:bg-alcabama-light-grey/10 rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmStatusChange}
                    className="flex-1 py-3 text-xs font-bold uppercase tracking-widest bg-alcabama-black text-white rounded-xl hover:bg-alcabama-black/90 transition-all"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Config Modal - Project Builder */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl border border-alcabama-light-grey max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-alcabama-black uppercase tracking-wide">Constructor de Proyecto</h3>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="text-alcabama-grey hover:text-alcabama-black transition-colors"
                >
                  ✕
                </button>
              </div>

              {!isConfigUnlocked ? (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 text-blue-800 rounded-xl text-xs">
                    Ingresa la contraseña para acceder al constructor del proyecto.
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-alcabama-grey uppercase tracking-wider mb-2">Contraseña</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-alcabama-grey" size={16} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={configPassword}
                        onChange={(e) => setConfigPassword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (configPassword === 'Alcabama2026') {
                              setIsConfigUnlocked(true);
                              setConfigError('');
                              setIsEditMode(true);
                            } else {
                              setConfigError('Contraseña incorrecta');
                            }
                          }
                        }}
                        placeholder="Contraseña"
                        className="w-full h-11 pl-10 pr-10 rounded-xl border border-alcabama-light-grey bg-white text-sm text-alcabama-black focus:outline-none focus:ring-2 focus:ring-alcabama-pink"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-alcabama-grey hover:text-alcabama-black"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {configError && (
                      <p className="mt-2 text-xs font-bold text-red-600 uppercase tracking-wider">{configError}</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (configPassword === 'Alcabama2026') {
                        setIsConfigUnlocked(true);
                        setConfigError('');
                        setIsEditMode(true);
                      } else {
                        setConfigError('Contraseña incorrecta');
                      }
                    }}
                    className="w-full h-11 bg-alcabama-black text-white font-bold uppercase tracking-wider text-xs rounded-xl hover:bg-black transition-colors"
                  >
                    Desbloquear
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-alcabama-light-grey/5 p-4 rounded-xl border border-alcabama-light-grey">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <h4 className="text-sm font-black uppercase tracking-wide text-alcabama-black">Identidad del tablero</h4>
                        <p className="text-xs text-alcabama-grey mt-1">Configura nombre y logos para clonar este mismo tablero en otros proyectos.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTempProjectSettings((prev) => ({
                          ...prev,
                          projectName: DEFAULT_PROJECT_SETTINGS.projectName,
                          companyLogoUrl: DEFAULT_PROJECT_SETTINGS.companyLogoUrl,
                          projectLogoUrl: DEFAULT_PROJECT_SETTINGS.projectLogoUrl,
                          companyFooterLogoUrl: DEFAULT_PROJECT_SETTINGS.companyFooterLogoUrl,
                        }))}
                        className="px-3 py-2 rounded-lg border border-alcabama-light-grey text-[10px] font-bold uppercase tracking-wider text-alcabama-grey hover:bg-white"
                      >
                        Restaurar branding
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-alcabama-grey uppercase tracking-wider mb-2">Nombre del proyecto</label>
                        <input
                          type="text"
                          value={tempProjectSettings.projectName}
                          onChange={(e) => setTempProjectSettings((prev) => ({ ...prev, projectName: e.target.value }))}
                          placeholder="Ventura"
                          className="w-full h-11 px-4 rounded-xl border border-alcabama-light-grey bg-white text-sm text-alcabama-black focus:outline-none focus:ring-2 focus:ring-alcabama-pink"
                        />
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-alcabama-grey uppercase tracking-wider mb-2">Logo corporativo superior</label>
                          <input
                            type="text"
                            value={tempProjectSettings.companyLogoUrl}
                            onChange={(e) => setTempProjectSettings((prev) => ({ ...prev, companyLogoUrl: e.target.value }))}
                            placeholder="https://..."
                            className="w-full h-11 px-4 rounded-xl border border-alcabama-light-grey bg-white text-sm text-alcabama-black focus:outline-none focus:ring-2 focus:ring-alcabama-pink"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-alcabama-grey uppercase tracking-wider mb-2">Logo del proyecto</label>
                          <input
                            type="text"
                            value={tempProjectSettings.projectLogoUrl}
                            onChange={(e) => setTempProjectSettings((prev) => ({ ...prev, projectLogoUrl: e.target.value }))}
                            placeholder="https://..."
                            className="w-full h-11 px-4 rounded-xl border border-alcabama-light-grey bg-white text-sm text-alcabama-black focus:outline-none focus:ring-2 focus:ring-alcabama-pink"
                          />
                        </div>
                        <div className="lg:col-span-2">
                          <label className="block text-xs font-bold text-alcabama-grey uppercase tracking-wider mb-2">Logo footer</label>
                          <input
                            type="text"
                            value={tempProjectSettings.companyFooterLogoUrl}
                            onChange={(e) => setTempProjectSettings((prev) => ({ ...prev, companyFooterLogoUrl: e.target.value }))}
                            placeholder="https://..."
                            className="w-full h-11 px-4 rounded-xl border border-alcabama-light-grey bg-white text-sm text-alcabama-black focus:outline-none focus:ring-2 focus:ring-alcabama-pink"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-xl border border-alcabama-light-grey bg-white p-4 flex items-center justify-center min-h-[96px]">
                          <img src={tempProjectSettings.companyLogoUrl} alt="Preview logo corporativo" className="max-h-12 object-contain" referrerPolicy="no-referrer" />
                        </div>
                        <div className="rounded-xl border border-alcabama-light-grey bg-white p-4 flex items-center justify-center min-h-[96px]">
                          <img src={tempProjectSettings.projectLogoUrl} alt="Preview logo proyecto" className="max-h-16 object-contain" referrerPolicy="no-referrer" />
                        </div>
                        <div className="rounded-xl border border-alcabama-light-grey bg-alcabama-black p-4 flex items-center justify-center min-h-[96px]">
                          <img src={tempProjectSettings.companyFooterLogoUrl} alt="Preview logo footer" className="max-h-10 object-contain" referrerPolicy="no-referrer" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-alcabama-light-grey/5 p-4 rounded-xl border border-alcabama-light-grey">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <h4 className="text-sm font-black uppercase tracking-wide text-alcabama-black">Fuente de datos</h4>
                        <p className="text-xs text-alcabama-grey mt-1">Estos datos tambien quedan guardados en el navegador para reusar el tablero como plantilla.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTempProjectSettings((prev) => ({
                          ...prev,
                          scriptUrl: DEFAULT_PROJECT_SETTINGS.scriptUrl,
                          sheetId: DEFAULT_PROJECT_SETTINGS.sheetId,
                          sheetName: DEFAULT_PROJECT_SETTINGS.sheetName,
                        }))}
                        className="px-3 py-2 rounded-lg border border-alcabama-light-grey text-[10px] font-bold uppercase tracking-wider text-alcabama-grey hover:bg-white"
                      >
                        Restaurar datos base
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-alcabama-grey uppercase tracking-wider mb-2">URL Web App (Apps Script)</label>
                        <input
                          type="text"
                          value={tempProjectSettings.scriptUrl}
                          onChange={(e) => setTempProjectSettings((prev) => ({ ...prev, scriptUrl: e.target.value }))}
                          placeholder="https://script.google.com/macros/s/.../exec"
                          className="w-full h-11 px-4 rounded-xl border border-alcabama-light-grey bg-white text-sm text-alcabama-black focus:outline-none focus:ring-2 focus:ring-alcabama-pink"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-alcabama-grey uppercase tracking-wider mb-2">Google Sheet ID</label>
                          <input
                            type="text"
                            value={tempProjectSettings.sheetId}
                            onChange={(e) => setTempProjectSettings((prev) => ({ ...prev, sheetId: e.target.value }))}
                            placeholder="1AbCDeF..."
                            className="w-full h-11 px-4 rounded-xl border border-alcabama-light-grey bg-white text-sm text-alcabama-black focus:outline-none focus:ring-2 focus:ring-alcabama-pink"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-alcabama-grey uppercase tracking-wider mb-2">Nombre de hoja</label>
                          <input
                            type="text"
                            value={tempProjectSettings.sheetName}
                            onChange={(e) => setTempProjectSettings((prev) => ({ ...prev, sheetName: e.target.value }))}
                            placeholder="Datos_VEN"
                            className="w-full h-11 px-4 rounded-xl border border-alcabama-light-grey bg-white text-sm text-alcabama-black focus:outline-none focus:ring-2 focus:ring-alcabama-pink"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-alcabama-light-grey/5 p-4 rounded-xl border border-alcabama-light-grey">
                     <p className="text-xs text-alcabama-dark-grey font-medium mb-4">
                       Administra las torres del proyecto. Puedes generar apartamentos masivamente y guardar la estructura en Google Sheets.
                     </p>
                     
                     <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                       {allTowers.map((tower, idx) => (
                         <div key={tower.id} className="flex items-center justify-between bg-white border border-alcabama-light-grey rounded-xl p-4 shadow-sm">
                           <div className="flex-1 mr-4">
                             <input
                               type="text"
                               value={tower.name}
                               onChange={(e) => {
                                 const val = e.target.value;
                                 setAllTowers(prev => prev.map(t => t.id === tower.id ? { ...t, name: val } : t));
                               }}
                               className="font-bold text-sm uppercase w-full bg-transparent border-b border-transparent hover:border-alcabama-light-grey focus:border-alcabama-pink focus:outline-none transition-colors"
                               placeholder="Nombre de la torre"
                             />
                             <p className="text-[10px] text-alcabama-grey mt-0.5">{tower.apartments.length} unidades</p>
                           </div>
                           <div className="flex gap-2">
                             <button 
                               onClick={() => setEditingTowerId(tower.id)}
                               className="px-3 py-2 bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-blue-100 transition-colors"
                             >
                               Editar Unidades
                             </button>
                             <button 
                               onClick={() => setMassGenTowerId(tower.id)}
                               className="px-3 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-indigo-100 transition-colors"
                             >
                               Masivo
                             </button>
                             <button 
                               onClick={() => setAllTowers(prev => prev.filter(t => t.id !== tower.id))}
                               className="px-3 py-2 bg-red-50 text-red-600 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-red-100 transition-colors"
                               title="Eliminar Torre"
                             >
                               X
                             </button>
                           </div>
                         </div>
                       ))}
                     </div>
                     
                     <button
                       onClick={() => {
                         const nextId = allTowers.length > 0 ? Math.max(...allTowers.map(t => t.id)) + 1 : 1;
                         setAllTowers([...allTowers, { id: nextId, name: `TORRE ${nextId}`, apartments: [] }]);
                       }}
                       className="w-full mt-4 h-11 border-2 border-dashed border-alcabama-light-grey text-alcabama-grey font-bold uppercase tracking-wider text-xs rounded-xl hover:bg-alcabama-light-grey/10 transition-colors"
                     >
                       + Añadir Nueva Torre
                     </button>
                  </div>

                  <button
                    onClick={handleSaveProjectStructure}
                    disabled={isSavingStructure}
                    className="w-full h-11 bg-green-500 text-white font-bold uppercase tracking-wider text-xs rounded-xl hover:bg-green-600 transition-colors shadow-lg shadow-green-500/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSavingStructure ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Guardar Cambios'
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

            <TowerEditorModal
        isOpen={editingTowerId !== null}
        tower={editingTowerId ? (allTowers.find(t => t.id === editingTowerId) || null) : null}
        onClose={() => setEditingTowerId(null)}
        onSave={(updatedTower) => {
          setAllTowers(prev => prev.map(t => t.id === updatedTower.id ? updatedTower : t));
          setEditingTowerId(null);
        }}
      />
      <MassGenerationModal 
        isOpen={massGenTowerId !== null} 
        towerName={massGenTowerId ? allTowers.find(t => t.id === massGenTowerId)?.name || '' : ''}
        onClose={() => setMassGenTowerId(null)}
        onGenerate={(config) => {
           if (!massGenTowerId) return;
           const newApts = [];
           
           if (config.mode === 'single') {
             for (let i = 0; i < config.single.amount; i++) {
               const num = config.single.startNum + i;
               const aptNumber = `${config.single.floorNumber}${num < 10 ? '0'+num : num}`;
               newApts.push({
                 id: `t${massGenTowerId}-f${config.single.floorNumber}-a${num}`,
                 number: aptNumber,
                 status: 'in_process'
               });
             }
           } else {
             for (let f = config.multi.startFloor; f <= config.multi.endFloor; f++) {
               for (let i = 0; i < config.multi.spacesPerFloor; i++) {
                 const num = config.multi.startNum + i;
                 const aptNumber = `${f}${num < 10 ? '0'+num : num}`;
                 newApts.push({
                   id: `t${massGenTowerId}-f${f}-a${num}`,
                   number: aptNumber,
                   status: 'in_process'
                 });
               }
             }
           }
           
           setAllTowers(prev => prev.map(t => {
             if (t.id === massGenTowerId) {
               // Merge or replace? We append.
               return { ...t, apartments: [...t.apartments, ...newApts] };
             }
             return t;
           }));
           setMassGenTowerId(null);
        }}
      />

    </div>
  );
}
