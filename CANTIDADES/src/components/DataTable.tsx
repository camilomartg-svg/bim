import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BIMElement } from '../types';

type PurchaseStatus = 'PENDIENTE' | 'PEDIDO' | 'COMPRADO' | 'ALMACEN' | 'INSTALADO';

interface HistoryEntry {
  status: PurchaseStatus;
  at: string;
}

interface DataTableProps {
  elements: BIMElement[];
  onSelectElement: (id: string | null) => void;
  selectedElementId?: string;
  selectedElementIds?: string[];
  onSetSelectedElementIds?: (ids: string[]) => void;
  modelKey?: string;
  statuses: Record<string, PurchaseStatus | undefined>;
  history?: Record<string, HistoryEntry[] | undefined>;
  isSanitaryModel?: boolean;
  mergeUnionLengthsIntoPipes?: boolean;
  pipeAdditionsByGroup: Record<string, number>;
  unionAdditionsByGroup: Record<string, number>;
  onChangeStatus: (id: string, status: PurchaseStatus) => void;
  onChangeStatusMany?: (ids: string[], status: PurchaseStatus) => void;
  onPipeAdditionChange: (groupKey: string, value: number) => void;
  onUnionAdditionChange: (groupKey: string, value: number) => void;
  onClearFilters?: () => void;
}

type PipeStageState = {
  pedido: number;
  comprado: number;
  almacen: number;
  instalado: number;
};

type PipeGroupingMode = 'POR_NIVEL' | 'TOTAL';
type PipeCutPiece = { id: string; length: number; scaled: number };
type PipeCutTube = { tubeNumber: number; pieces: PipeCutPiece[]; usedLength: number; waste: number };
type PipeCutPlanGroup = {
  groupKey: string;
  tipo: string;
  diameter: string;
  pieces: PipeCutPiece[];
  tubes: PipeCutTube[];
  totalLength: number;
  totalWaste: number;
  minimumUnits: number;
  actualUnits: number;
};

export default function DataTable({ elements, onSelectElement, selectedElementId, selectedElementIds, onSetSelectedElementIds, modelKey, statuses, history, isSanitaryModel, mergeUnionLengthsIntoPipes, pipeAdditionsByGroup, unionAdditionsByGroup, onChangeStatus, onChangeStatusMany, onPipeAdditionChange, onUnionAdditionChange, onClearFilters }: DataTableProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  const [activeTab, setActiveTab] = useState<'DETALLE' | 'ESTADOS' | 'HISTORIAL' | 'TUBERIAS' | 'UNIONES' | 'CORTES'>('DETALLE');
  const [bulkStatus, setBulkStatus] = useState<PurchaseStatus>('COMPRADO');
  const [rowHeight, setRowHeight] = useState(() => {
    const stored = Number(localStorage.getItem('cantidades:tableRowHeight'));
    return Number.isFinite(stored) && stored >= 18 && stored <= 40 ? stored : 24;
  });
  const selectedSet = useMemo(() => new Set(selectedElementIds ?? []), [selectedElementIds]);
  const lastAnchorIndexRef = useRef<number | null>(null);
  const PIPE_COMMERCIAL_LENGTH_STORAGE_KEY = 'cantidades:pipeCommercialLength:v1';
  const PIPE_GROUPING_MODE_STORAGE_KEY = 'cantidades:pipeGroupingMode:v1';

  const STATUS_ORDER: PurchaseStatus[] = ['PENDIENTE', 'PEDIDO', 'COMPRADO', 'ALMACEN', 'INSTALADO'];

  const normalizePipeCommercialLength = (value: unknown, fallback = 6) => {
    const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(9999, Math.max(0.1, parsed));
  };

  const [pipeCommercialLengthInput, setPipeCommercialLengthInput] = useState(() => {
    try {
      const stored = localStorage.getItem(PIPE_COMMERCIAL_LENGTH_STORAGE_KEY);
      return String(normalizePipeCommercialLength(stored ?? 6));
    } catch {
      return '6';
    }
  });
  const [pipeGroupingMode, setPipeGroupingMode] = useState<PipeGroupingMode>(() => {
    try {
      const stored = localStorage.getItem(PIPE_GROUPING_MODE_STORAGE_KEY);
      return stored === 'TOTAL' ? 'TOTAL' : 'POR_NIVEL';
    } catch {
      return 'POR_NIVEL';
    }
  });
  const pipeCommercialLength = useMemo(
    () => normalizePipeCommercialLength(pipeCommercialLengthInput),
    [pipeCommercialLengthInput],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });

    const ro = new ResizeObserver(() => setContainerHeight(el.clientHeight));
    ro.observe(el);

    setContainerHeight(el.clientHeight);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PIPE_COMMERCIAL_LENGTH_STORAGE_KEY, String(pipeCommercialLength));
    } catch {
    }
  }, [pipeCommercialLength]);

  useEffect(() => {
    try {
      localStorage.setItem(PIPE_GROUPING_MODE_STORAGE_KEY, pipeGroupingMode);
    } catch {
    }
  }, [pipeGroupingMode]);

  useEffect(() => {
    if (!isSanitaryModel && (activeTab === 'TUBERIAS' || activeTab === 'UNIONES' || activeTab === 'CORTES')) {
      setActiveTab('DETALLE');
    }
  }, [activeTab, isSanitaryModel]);

  const getProp = (el: BIMElement, key: string) => {
    if (!el.properties) return '-';
    
    // 1. Try top-level first
    const val = el.properties[key];
    if (val !== undefined && val !== null) {
      if (typeof val === 'object' && val !== null) {
        if ('value' in val) return String(val.value);
        if ('NominalValue' in val) {
          const nv = val.NominalValue;
          return (typeof nv === 'object' && nv !== null && 'value' in nv) ? String(nv.value) : String(nv);
        }
        if ('QuantityValue' in val) {
          const qv = val.QuantityValue;
          return (typeof qv === 'object' && qv !== null && 'value' in qv) ? String(qv.value) : String(qv);
        }
      }
      return String(val);
    }
    
    // 2. Recursive deep search (BFS)
    const queue = [el.properties];
    const seen = new Set<any>();
    let steps = 0;
    const maxSteps = 1000;
    
    while (queue.length > 0 && steps < maxSteps) {
      const current = queue.shift();
      if (!current || typeof current !== 'object') continue;
      if (seen.has(current)) continue;
      seen.add(current);
      steps++;
      
      const subVal = current[key];
      if (subVal !== undefined && subVal !== null) {
        if (typeof subVal === 'object' && subVal !== null) {
          if ('value' in subVal) return String(subVal.value);
          if ('NominalValue' in subVal) {
            const nv = subVal.NominalValue;
            return (typeof nv === 'object' && nv !== null && 'value' in nv) ? String(nv.value) : String(nv);
          }
          if ('QuantityValue' in subVal) {
            const qv = subVal.QuantityValue;
            return (typeof qv === 'object' && qv !== null && 'value' in qv) ? String(qv.value) : String(qv);
          }
        }
        return String(subVal);
      }
      
      for (const k in current) {
        if (k === 'ObjectPlacement' || k === 'Representation' || k === 'OwnerHistory') continue;
        const nested = current[k];
        if (nested && typeof nested === 'object') {
          queue.push(nested);
        }
      }
    }
    
    return '-';
  };

  const getFirstProp = (el: BIMElement, keys: string[]) => {
    for (const key of keys) {
      const v = getProp(el, key);
      if (v !== '-' && v !== '') return v;
    }
    return '-';
  };

  const parseNumber = (value: unknown) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const s = String(value).trim();
    if (s === '' || s === '-') return null;
    const cleaned = s
      .replace(/\s/g, '')
      .replace(',', '.')
      .replace(/[^\d.\-]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };

  const getMetric = (el: BIMElement, key: string, fallback?: number) => {
    const raw = getProp(el, key);
    const n = parseNumber(raw);
    if (n !== null) return n;
    return fallback ?? 0;
  };

  const getMetricByKeys = (el: BIMElement, keys: string[], fallback = 0) => {
    for (const key of keys) {
      const n = parseNumber(getProp(el, key));
      if (n !== null) return n;
    }
    return fallback;
  };

  const normalizeSearchText = (value: unknown) =>
    String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const getElementSearchText = (el: BIMElement) => normalizeSearchText([
    getFirstProp(el, ["CLASIFICACION", "CLASIFICACIÓN"]),
    getFirstProp(el, ["CATEGORIA", "CATEGORÍA"]),
    getFirstProp(el, ["TIPO"]),
    getFirstProp(el, ["DETALLE"]),
    getProp(el, "NOMBRE INTEGRADO"),
    getProp(el, "Sistema"),
    el.name,
    el.category,
    getProp(el, "ifcType"),
    getProp(el, "ObjectType")
  ].join(' '));
  const getElementIfcType = (el: BIMElement) =>
    normalizeSearchText([
      getProp(el, 'ifcType'),
      getProp(el, 'type'),
      el.category
    ].join(' '));

  const includesAny = (text: string, needles: string[]) => needles.some((needle) => text.includes(needle));

  const isUnionElement = (el: BIMElement) => {
    const text = getElementSearchText(el);
    const ifcType = getElementIfcType(el);
    if (includesAny(text, ['tubo sin uniones', 'tubo sin union', 'sin uniones', 'sin union'])) return false;
    if (includesAny(ifcType, ['ifcflowsegment', 'ifcpipesegment', 'pipesegment', 'flowsegment', 'ifcconduitsegment', 'conduitsegment', 'ifccablecarriersegment', 'cablecarriersegment'])) return false;
    if (includesAny(ifcType, ['ifcflowfitting', 'ifcpipefitting', 'pipefitting', 'flowfitting', 'ifcconduitfitting', 'conduitfitting', 'ifccablecarrierfitting', 'cablecarrierfitting'])) return true;
    return includesAny(text, [
      'union',
      'fitting',
      'pipe fitting',
      'pipefitting',
      'ifcpipefitting',
      'accesorio',
      'codo',
      'tee',
      'reduccion',
      'reduction',
      'adaptador',
      'adapter',
      'coupling',
      'copla',
      'caja',
      'conduit fitting',
      'conduitfitting'
    ]);
  };

  const isPipeElement = (el: BIMElement) => {
    const text = getElementSearchText(el);
    const ifcType = getElementIfcType(el);
    if (includesAny(ifcType, ['ifcflowsegment', 'ifcpipesegment', 'pipesegment', 'flowsegment', 'ifcconduitsegment', 'conduitsegment', 'ifccablecarriersegment', 'cablecarriersegment'])) return true;
    if (includesAny(ifcType, ['ifcflowfitting', 'ifcpipefitting', 'pipefitting', 'flowfitting', 'ifcconduitfitting', 'conduitfitting', 'ifccablecarrierfitting', 'cablecarrierfitting'])) return false;
    if (includesAny(text, ['ifcpipefitting', 'pipe fitting', 'pipefitting', 'ifcconduitfitting', 'conduit fitting', 'conduitfitting'])) return false;
    if (isUnionElement(el)) return false;
    return includesAny(text, [
      'tuber',
      'tubo',
      'pipe segment',
      'pipesegment',
      'ifcpipesegment',
      'pipe',
      'conduit',
      'canalizacion',
      'canalización',
      'coraza',
      'ducto',
      'bandeja',
      'canaleta'
    ]);
  };

  const [expandedCortesGroups, setExpandedCortesGroups] = useState<Record<string, boolean>>({});

  const toggleCortesGroup = (groupKey: string) => {
    setExpandedCortesGroups((prev) => ({
      ...prev,
      [groupKey]: prev[groupKey] === undefined ? false : !prev[groupKey],
    }));
  };

  const normalizePipeStages = (totalUnits: number, st: PipeStageState | undefined) => {
    const installed = Math.min(Math.max(0, Math.floor(st?.instalado ?? 0)), totalUnits);
    const almacen = Math.min(Math.max(0, Math.floor(st?.almacen ?? 0)), totalUnits - installed);
    const comprado = Math.min(Math.max(0, Math.floor(st?.comprado ?? 0)), totalUnits - installed - almacen);
    const pedido = Math.min(Math.max(0, Math.floor(st?.pedido ?? 0)), totalUnits - installed - almacen - comprado);
    const pendiente = Math.max(0, totalUnits - (pedido + comprado + almacen + installed));
    return { pendiente, pedido, comprado, almacen, instalado: installed };
  };

  const normalizePipeStageMeters = (totalLength: number, totalUnits: number, st: PipeStageState | undefined, commercialLength: number) => {
    const units = normalizePipeStages(totalUnits, st);
    let remaining = Math.max(0, totalLength);
    const instalado = Math.min(remaining, units.instalado * commercialLength);
    remaining -= instalado;
    const almacen = Math.min(remaining, units.almacen * commercialLength);
    remaining -= almacen;
    const comprado = Math.min(remaining, units.comprado * commercialLength);
    remaining -= comprado;
    const pedido = Math.min(remaining, units.pedido * commercialLength);
    remaining -= pedido;
    return { pendiente: remaining, pedido, comprado, almacen, instalado };
  };

  const derivePipeStagesFromStatusLength = (totalUnits: number, statusLength: Record<PurchaseStatus, number>, commercialLength: number): PipeStageState => {
    const unitsFromLength = (length: number) => {
      if (!(length > 0)) return 0;
      return Math.min(totalUnits, Math.ceil((length - 1e-9) / commercialLength));
    };
    const instalado = unitsFromLength(statusLength.INSTALADO);
    const uptoAlmacen = unitsFromLength(statusLength.INSTALADO + statusLength.ALMACEN);
    const almacen = Math.max(0, uptoAlmacen - instalado);
    const uptoComprado = unitsFromLength(statusLength.INSTALADO + statusLength.ALMACEN + statusLength.COMPRADO);
    const comprado = Math.max(0, uptoComprado - uptoAlmacen);
    const uptoPedido = unitsFromLength(statusLength.INSTALADO + statusLength.ALMACEN + statusLength.COMPRADO + statusLength.PEDIDO);
    const pedido = Math.max(0, uptoPedido - uptoComprado);
    return normalizePipeStages(totalUnits, { pedido, comprado, almacen, instalado });
  };

  const movePipeStage = (totalUnits: number, current: PipeStageState | undefined, stage: 'pedido' | 'comprado' | 'almacen' | 'instalado', nextValue: number) => {
    const cur = normalizePipeStages(totalUnits, current);
    const target = Math.max(0, Math.floor(nextValue));

    if (stage === 'pedido') {
      const max = totalUnits - (cur.comprado + cur.almacen + cur.instalado);
      const pedido = Math.min(target, max);
      return { pedido, comprado: cur.comprado, almacen: cur.almacen, instalado: cur.instalado };
    }
    if (stage === 'comprado') {
      const total = cur.pedido + cur.comprado;
      const max = totalUnits - (cur.almacen + cur.instalado);
      const comprado = Math.min(target, total, max);
      const pedido = total - comprado;
      return { pedido, comprado, almacen: cur.almacen, instalado: cur.instalado };
    }
    if (stage === 'almacen') {
      const total = cur.comprado + cur.almacen;
      const max = totalUnits - cur.instalado;
      const almacen = Math.min(target, total, max);
      const comprado = total - almacen;
      return { pedido: cur.pedido, comprado, almacen, instalado: cur.instalado };
    }
    const total = cur.almacen + cur.instalado;
    const instalado = Math.min(target, total, totalUnits);
    const almacen = total - instalado;
    return { pedido: cur.pedido, comprado: cur.comprado, almacen, instalado };
  };

  const elementsById = useMemo(() => {
    const map = new Map<string, BIMElement>();
    for (const el of elements) map.set(el.id, el);
    return map;
  }, [elements]);

  const applyPipeAssignmentsToModel = (ids: string[], totalUnits: number, totalLength: number, commercialLength: number, st: PipeStageState) => {
    const items = ids
      .map((id) => {
        const el = elementsById.get(id);
        if (!el) return null;
        const length = Math.max(0, getMetricByKeys(el, ['LONGITUD INTEGRADO', 'LONGITUD', 'LENGTH', 'Length'], 0));
        return { id, length };
      })
      .filter(Boolean) as Array<{ id: string; length: number }>;

    const tgt = normalizePipeStageMeters(totalLength, totalUnits, st, commercialLength);
    let needInst = tgt.instalado;
    let needAlm = tgt.almacen;
    let needComp = tgt.comprado;
    let needPed = tgt.pedido;

    const assigned: Record<PurchaseStatus, string[]> = { PENDIENTE: [], PEDIDO: [], COMPRADO: [], ALMACEN: [], INSTALADO: [] };

    for (const it of items) {
      if (needInst > 0) {
        assigned.INSTALADO.push(it.id);
        needInst -= it.length;
        continue;
      }
      if (needAlm > 0) {
        assigned.ALMACEN.push(it.id);
        needAlm -= it.length;
        continue;
      }
      if (needComp > 0) {
        assigned.COMPRADO.push(it.id);
        needComp -= it.length;
        continue;
      }
      if (needPed > 0) {
        assigned.PEDIDO.push(it.id);
        needPed -= it.length;
        continue;
      }
      assigned.PENDIENTE.push(it.id);
    }

    if (onChangeStatusMany) {
      if (assigned.PENDIENTE.length) onChangeStatusMany(assigned.PENDIENTE, 'PENDIENTE');
      if (assigned.PEDIDO.length) onChangeStatusMany(assigned.PEDIDO, 'PEDIDO');
      if (assigned.COMPRADO.length) onChangeStatusMany(assigned.COMPRADO, 'COMPRADO');
      if (assigned.ALMACEN.length) onChangeStatusMany(assigned.ALMACEN, 'ALMACEN');
      if (assigned.INSTALADO.length) onChangeStatusMany(assigned.INSTALADO, 'INSTALADO');
    } else {
      for (const id of assigned.PENDIENTE) onChangeStatus(id, 'PENDIENTE');
      for (const id of assigned.PEDIDO) onChangeStatus(id, 'PEDIDO');
      for (const id of assigned.COMPRADO) onChangeStatus(id, 'COMPRADO');
      for (const id of assigned.ALMACEN) onChangeStatus(id, 'ALMACEN');
      for (const id of assigned.INSTALADO) onChangeStatus(id, 'INSTALADO');
    }
  };

  const pipePurchaseSummary = useMemo(() => {
    if (!isSanitaryModel) return [];
    const map = new Map<string, { tipo: string; diameter: string; level: string; ids: string[]; totalLength: number; count: number; statusLength: Record<PurchaseStatus, number>; statusCount: Record<PurchaseStatus, number> }>();
    const asNumber = (v: string) => {
      const n = parseNumber(v);
      return n !== null ? n : null;
    };
    for (const el of elements) {
      const includeAsPipe = isPipeElement(el) || (mergeUnionLengthsIntoPipes && isUnionElement(el));
      if (!includeAsPipe) continue;
      const len = getMetricByKeys(el, ['LONGITUD INTEGRADO', 'LONGITUD', 'LENGTH', 'Length'], 0);
      if (!(len > 0)) continue;
      const st: PurchaseStatus = statuses[el.id] ?? 'PENDIENTE';
      const tipoRaw = getProp(el, "NOMBRE INTEGRADO");
      const tipo = tipoRaw !== '-' && tipoRaw !== '' ? tipoRaw : el.name;
      const diameterRaw = getFirstProp(el, ["Tamaño", "TAMAÑO", "TAMANO"]);
      const diameter = diameterRaw !== '-' && diameterRaw !== '' ? diameterRaw : 'SIN DIÁMETRO';
      const levelRaw = getFirstProp(el, ["NIVEL INTEGRADO", "Nivel"]);
      const level = levelRaw !== '-' && levelRaw !== '' ? levelRaw : 'SIN NIVEL';
      const key = pipeGroupingMode === 'TOTAL'
        ? `${tipo}||${diameter}`
        : `${tipo}||${diameter}||${level}`;
      const cur = map.get(key) ?? {
        tipo,
        diameter,
        level,
        ids: [],
        totalLength: 0,
        count: 0,
        statusLength: { PENDIENTE: 0, PEDIDO: 0, COMPRADO: 0, ALMACEN: 0, INSTALADO: 0 },
        statusCount: { PENDIENTE: 0, PEDIDO: 0, COMPRADO: 0, ALMACEN: 0, INSTALADO: 0 }
      };
      cur.ids.push(el.id);
      cur.totalLength += len;
      cur.count += 1;
      cur.statusLength[st] += len;
      cur.statusCount[st] += 1;
      map.set(key, cur);
    }
    const arr = Array.from(map.values()).map((v) => {
      const units = Math.ceil(v.totalLength / pipeCommercialLength);
      const waste = units * pipeCommercialLength - v.totalLength;
      const groupKey = pipeGroupingMode === 'TOTAL'
        ? `${v.tipo}||${v.diameter}`
        : `${v.tipo}||${v.diameter}||${v.level}`;
      return { ...v, units, waste, groupKey };
    });
    return arr.sort((a, b) => {
      const t = a.tipo.localeCompare(b.tipo, 'es');
      if (t !== 0) return t;
      const na = asNumber(a.diameter);
      const nb = asNumber(b.diameter);
      if (na !== null && nb !== null) return na - nb;
      if (na !== null) return -1;
      if (nb !== null) return 1;
      const d = a.diameter.localeCompare(b.diameter, 'es');
      if (d !== 0) return d;
      return a.level.localeCompare(b.level, 'es');
    });
  }, [elements, getFirstProp, getMetricByKeys, getProp, isSanitaryModel, mergeUnionLengthsIntoPipes, pipeCommercialLength, pipeGroupingMode, statuses]);

  const unionsPurchaseSummary = useMemo(() => {
    if (!isSanitaryModel) return [];
    const map = new Map<string, { tipo: string; diameter: string; level: string; ids: string[]; count: number; statusCount: Record<PurchaseStatus, number> }>();
    const asNumber = (v: string) => {
      const n = parseNumber(v);
      return n !== null ? n : null;
    };
    for (const el of elements) {
      if (!isUnionElement(el)) continue;
      const st: PurchaseStatus = statuses[el.id] ?? 'PENDIENTE';
      const tipoRaw = getProp(el, "NOMBRE INTEGRADO");
      const tipo = tipoRaw !== '-' && tipoRaw !== '' ? tipoRaw : el.name;
      const diameterRaw = getFirstProp(el, ["Tamaño", "TAMAÑO", "TAMANO"]);
      const diameter = diameterRaw !== '-' && diameterRaw !== '' ? diameterRaw : 'SIN DIÁMETRO';
      const levelRaw = getFirstProp(el, ["NIVEL INTEGRADO", "Nivel"]);
      const level = levelRaw !== '-' && levelRaw !== '' ? levelRaw : 'SIN NIVEL';
      const key = pipeGroupingMode === 'TOTAL'
        ? `${tipo}||${diameter}`
        : `${tipo}||${diameter}||${level}`;
      const cur = map.get(key) ?? {
        tipo,
        diameter,
        level,
        ids: [],
        count: 0,
        statusCount: { PENDIENTE: 0, PEDIDO: 0, COMPRADO: 0, ALMACEN: 0, INSTALADO: 0 }
      };
      cur.ids.push(el.id);
      cur.count += 1;
      cur.statusCount[st] += 1;
      map.set(key, cur);
    }
    const pickDominantStatus = (v: { statusCount: Record<PurchaseStatus, number> }): PurchaseStatus => {
      let best: PurchaseStatus = 'PENDIENTE';
      let bestCount = -1;
      for (const st of STATUS_ORDER) {
        const cnt = v.statusCount[st] ?? 0;
        if (cnt > bestCount) {
          best = st;
          bestCount = cnt;
        }
      }
      return best;
    };
    const arr = Array.from(map.values()).map((v) => {
      const dominantStatus = pickDominantStatus(v);
      const groupKey = pipeGroupingMode === 'TOTAL'
        ? `${v.tipo}||${v.diameter}`
        : `${v.tipo}||${v.diameter}||${v.level}`;
      return { ...v, dominantStatus, groupKey };
    });
    return arr.sort((a, b) => {
      const t = a.tipo.localeCompare(b.tipo, 'es');
      if (t !== 0) return t;
      const na = asNumber(a.diameter);
      const nb = asNumber(b.diameter);
      if (na !== null && nb !== null) return na - nb;
      if (na !== null) return -1;
      if (nb !== null) return 1;
      const d = a.diameter.localeCompare(b.diameter, 'es');
      if (d !== 0) return d;
      return a.level.localeCompare(b.level, 'es');
    });
  }, [elements, getFirstProp, getProp, isSanitaryModel, pipeGroupingMode, statuses]);

  const pipeCutPlans = useMemo(() => {
    if (!isSanitaryModel) return [] as PipeCutPlanGroup[];
    const map = new Map<string, { tipo: string; diameter: string; pieces: PipeCutPiece[]; totalLength: number }>();
    const asNumber = (v: string) => {
      const n = parseNumber(v);
      return n !== null ? n : null;
    };

    for (const el of elements) {
      const includeAsPipe = isPipeElement(el) || (mergeUnionLengthsIntoPipes && isUnionElement(el));
      if (!includeAsPipe) continue;
      const length = getMetricByKeys(el, ['LONGITUD INTEGRADO', 'LONGITUD', 'LENGTH', 'Length'], 0);
      if (!(length > 0)) continue;
      
      const tipoRaw = getProp(el, "NOMBRE INTEGRADO");
      const tipo = tipoRaw !== '-' && tipoRaw !== '' ? tipoRaw : el.name;
      const diameterRaw = getFirstProp(el, ["Tamaño", "TAMAÑO", "TAMANO"]);
      const diameter = diameterRaw !== '-' && diameterRaw !== '' ? diameterRaw : 'SIN DIÁMETRO';
      const key = `${tipo}||${diameter}`;
      const cur = map.get(key) ?? { tipo, diameter, pieces: [], totalLength: 0 };
      
      let remainingLength = length;
      let partIndex = 1;
      while (remainingLength > 1e-4) {
        const pieceLength = remainingLength > pipeCommercialLength + 1e-4 ? pipeCommercialLength : remainingLength;
        cur.pieces.push({ 
          id: partIndex > 1 ? `${el.id}_p${partIndex}` : el.id, 
          length: pieceLength, 
          scaled: Math.max(1, Math.round(pieceLength * 100)) 
        });
        cur.totalLength += pieceLength;
        remainingLength -= pieceLength;
        partIndex++;
      }
      
      map.set(key, cur);
    }

    return Array.from(map.entries())
      .map(([groupKey, value]) => {
        const tubes = chooseBetterCutPlan(value.pieces, pipeCommercialLength);
        const totalWaste = tubes.reduce((sum, tube) => sum + tube.waste, 0);
        return {
          groupKey,
          tipo: value.tipo,
          diameter: value.diameter,
          pieces: value.pieces.slice().sort((a, b) => b.length - a.length || a.id.localeCompare(b.id, 'es')),
          tubes,
          totalLength: Number(value.totalLength.toFixed(6)),
          totalWaste: Number(totalWaste.toFixed(6)),
          minimumUnits: Math.ceil(value.totalLength / pipeCommercialLength),
          actualUnits: tubes.length,
        };
      })
      .sort((a, b) => {
        const t = a.tipo.localeCompare(b.tipo, 'es');
        if (t !== 0) return t;
        const na = asNumber(a.diameter);
        const nb = asNumber(b.diameter);
        if (na !== null && nb !== null) return na - nb;
        if (na !== null) return -1;
        if (nb !== null) return 1;
        return a.diameter.localeCompare(b.diameter, 'es');
      });
  }, [elements, getFirstProp, getMetricByKeys, getProp, isSanitaryModel, mergeUnionLengthsIntoPipes, pipeCommercialLength]);



  const applyStatusToIds = (ids: string[], status: PurchaseStatus) => {
    if (onChangeStatusMany) {
      onChangeStatusMany(ids, status);
      return;
    }
    for (const id of ids) onChangeStatus(id, status);
  };

  const normalizeUnionStages = (totalUnits: number, counts?: Partial<Record<PurchaseStatus, number>>) => {
    const instalado = Math.min(Math.max(0, Math.floor(counts?.INSTALADO ?? 0)), totalUnits);
    const almacen = Math.min(Math.max(0, Math.floor(counts?.ALMACEN ?? 0)), totalUnits - instalado);
    const comprado = Math.min(Math.max(0, Math.floor(counts?.COMPRADO ?? 0)), totalUnits - instalado - almacen);
    const pedido = Math.min(Math.max(0, Math.floor(counts?.PEDIDO ?? 0)), totalUnits - instalado - almacen - comprado);
    const pendiente = Math.max(0, totalUnits - (pedido + comprado + almacen + instalado));
    return { pendiente, pedido, comprado, almacen, instalado };
  };

  const moveUnionStage = (totalUnits: number, current: Partial<Record<PurchaseStatus, number>> | undefined, stage: 'pedido' | 'comprado' | 'almacen' | 'instalado', nextValue: number) => {
    const cur = normalizeUnionStages(totalUnits, current);
    const target = Math.max(0, Math.floor(nextValue));

    if (stage === 'pedido') {
      const max = totalUnits - (cur.comprado + cur.almacen + cur.instalado);
      const pedido = Math.min(target, max);
      return { pedido, comprado: cur.comprado, almacen: cur.almacen, instalado: cur.instalado };
    }
    if (stage === 'comprado') {
      const total = cur.pedido + cur.comprado;
      const max = totalUnits - (cur.almacen + cur.instalado);
      const comprado = Math.min(target, total, max);
      const pedido = total - comprado;
      return { pedido, comprado, almacen: cur.almacen, instalado: cur.instalado };
    }
    if (stage === 'almacen') {
      const total = cur.comprado + cur.almacen;
      const max = totalUnits - cur.instalado;
      const almacen = Math.min(target, total, max);
      const comprado = total - almacen;
      return { pedido: cur.pedido, comprado, almacen, instalado: cur.instalado };
    }
    const total = cur.almacen + cur.instalado;
    const instalado = Math.min(target, total, totalUnits);
    const almacen = total - instalado;
    return { pedido: cur.pedido, comprado: cur.comprado, almacen, instalado };
  };

  const applyUnionAssignmentsToModel = (ids: string[], counts: { pedido: number; comprado: number; almacen: number; instalado: number }) => {
    const orderedIds = [...ids].sort((a, b) => a.localeCompare(b, 'es'));
    let needInst = counts.instalado;
    let needAlm = counts.almacen;
    let needComp = counts.comprado;
    let needPed = counts.pedido;
    const assigned: Record<PurchaseStatus, string[]> = { PENDIENTE: [], PEDIDO: [], COMPRADO: [], ALMACEN: [], INSTALADO: [] };

    for (const id of orderedIds) {
      if (needInst > 0) {
        assigned.INSTALADO.push(id);
        needInst -= 1;
        continue;
      }
      if (needAlm > 0) {
        assigned.ALMACEN.push(id);
        needAlm -= 1;
        continue;
      }
      if (needComp > 0) {
        assigned.COMPRADO.push(id);
        needComp -= 1;
        continue;
      }
      if (needPed > 0) {
        assigned.PEDIDO.push(id);
        needPed -= 1;
        continue;
      }
      assigned.PENDIENTE.push(id);
    }

    if (assigned.PENDIENTE.length) applyStatusToIds(assigned.PENDIENTE, 'PENDIENTE');
    if (assigned.PEDIDO.length) applyStatusToIds(assigned.PEDIDO, 'PEDIDO');
    if (assigned.COMPRADO.length) applyStatusToIds(assigned.COMPRADO, 'COMPRADO');
    if (assigned.ALMACEN.length) applyStatusToIds(assigned.ALMACEN, 'ALMACEN');
    if (assigned.INSTALADO.length) applyStatusToIds(assigned.INSTALADO, 'INSTALADO');
  };

  function buildBestFitPlan(items: PipeCutPiece[], commercialLength: number) {
    const tubes: PipeCutTube[] = [];
    const sorted = items.slice().sort((a, b) => b.length - a.length || a.id.localeCompare(b.id, 'es'));
    for (const item of sorted) {
      let bestIndex = -1;
      let bestRemaining = Infinity;
      for (let i = 0; i < tubes.length; i++) {
        const tube = tubes[i];
        const remaining = commercialLength - tube.usedLength;
        if (item.length <= remaining + 1e-9) {
          const nextRemaining = remaining - item.length;
          if (nextRemaining < bestRemaining) {
            bestRemaining = nextRemaining;
            bestIndex = i;
          }
        }
      }
      if (bestIndex === -1) {
        tubes.push({
          tubeNumber: tubes.length + 1,
          pieces: [item],
          usedLength: item.length,
          waste: Math.max(0, commercialLength - item.length),
        });
        continue;
      }
      const target = tubes[bestIndex];
      target.pieces.push(item);
      target.usedLength += item.length;
      target.waste = Math.max(0, commercialLength - target.usedLength);
    }
    return tubes.map((tube, index) => ({
      ...tube,
      tubeNumber: index + 1,
      pieces: tube.pieces.slice().sort((a, b) => b.length - a.length || a.id.localeCompare(b.id, 'es')),
      usedLength: Number(tube.usedLength.toFixed(6)),
      waste: Number(Math.max(0, commercialLength - tube.usedLength).toFixed(6)),
    }));
  }

  function pickBestSubsetIndices(items: PipeCutPiece[], capacityScaled: number) {
    const reachable = new Uint8Array(capacityScaled + 1);
    const prevSum = new Int32Array(capacityScaled + 1);
    const prevIdx = new Int32Array(capacityScaled + 1);
    prevSum.fill(-1);
    prevIdx.fill(-1);
    reachable[0] = 1;

    for (let idx = 0; idx < items.length; idx++) {
      const weight = items[idx].scaled;
      for (let sum = capacityScaled; sum >= weight; sum--) {
        if (!reachable[sum] && reachable[sum - weight]) {
          reachable[sum] = 1;
          prevSum[sum] = sum - weight;
          prevIdx[sum] = idx;
        }
      }
    }

    let best = capacityScaled;
    while (best > 0 && !reachable[best]) best -= 1;
    if (best <= 0) return [];

    const picked: number[] = [];
    let current = best;
    while (current > 0) {
      const idx = prevIdx[current];
      if (idx < 0) break;
      picked.push(idx);
      current = prevSum[current];
    }
    return picked;
  }

  function buildKnapsackPlan(items: PipeCutPiece[], commercialLength: number) {
    const capacityScaled = Math.max(1, Math.round(commercialLength * 100));
    const remaining = items
      .slice()
      .sort((a, b) => b.length - a.length || a.id.localeCompare(b.id, 'es'));
    const tubes: PipeCutTube[] = [];

    while (remaining.length > 0) {
      let picked = pickBestSubsetIndices(remaining, capacityScaled);
      if (!picked.length) picked = [0];
      picked.sort((a, b) => b - a);
      const pieces = picked.map((idx) => remaining[idx]).sort((a, b) => b.length - a.length || a.id.localeCompare(b.id, 'es'));
      let usedLength = 0;
      for (const piece of pieces) usedLength += piece.length;
      tubes.push({
        tubeNumber: tubes.length + 1,
        pieces,
        usedLength: Number(usedLength.toFixed(6)),
        waste: Number(Math.max(0, commercialLength - usedLength).toFixed(6)),
      });
      for (const idx of picked) remaining.splice(idx, 1);
    }

    return tubes;
  }

  function chooseBetterCutPlan(items: PipeCutPiece[], commercialLength: number) {
    const knapsack = buildKnapsackPlan(items, commercialLength);
    const bestFit = buildBestFitPlan(items, commercialLength);
    const score = (plan: PipeCutTube[]) => {
      const totalWaste = plan.reduce((sum, tube) => sum + tube.waste, 0);
      return { units: plan.length, waste: Number(totalWaste.toFixed(6)) };
    };
    const a = score(knapsack);
    const b = score(bestFit);
    if (a.units !== b.units) return a.units < b.units ? knapsack : bestFit;
    return a.waste <= b.waste ? knapsack : bestFit;
  }

  const totals = useMemo(() => {
    let area = 0;
    let length = 0;
    let volume = 0;
    for (const el of elements) {
      area += getMetric(el, 'AREA INTEGRADO', 0);
      length += getMetric(el, 'LONGITUD INTEGRADO', 0);
      volume += getMetric(el, 'VOLUMEN INTEGRADO', el.volume);
    }
    return { count: elements.length, area, length, volume };
  }, [elements]);

  const escapeCsvCell = (value: unknown) => {
    const text = String(value ?? '');
    if (/[;"\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const downloadCsv = (rows: Array<Array<unknown>>, baseName: string) => {
    const content = rows.map((row) => row.map(escapeCsvCell).join(';')).join('\r\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportCurrentTab = () => {
    const safeModel = (modelKey || 'local').replace(/[^\w.-]+/g, '_');
    if (activeTab === 'DETALLE') {
      const rows: Array<Array<unknown>> = [[
        'Sel', 'Estado', 'Clasificación', 'Tipo', 'Categoría', 'Elemento', 'Detalle', 'Material Integrado', 'Ubicación', 'Área M2', 'Longitud M', 'Volumen M3'
      ]];
      for (const el of elements) {
        const st = statuses[el.id] ?? 'PENDIENTE';
        const tipoRaw = getProp(el, "NOMBRE INTEGRADO");
        const tipo = tipoRaw !== '-' && tipoRaw !== '' ? tipoRaw : el.name;
        rows.push([
          selectedSet.has(el.id) ? 'X' : '',
          st,
          (() => {
            const v = getFirstProp(el, ["CLASIFICACION", "CLASIFICACIÓN"]);
            return v !== '-' ? v : 'SIN CLASIFICAR';
          })(),
          tipo,
          el.category ?? '',
          getProp(el, "NOMBRE INTEGRADO") || el.name,
          getProp(el, "DETALLE") || '-',
          getProp(el, "MATERIAL INTEGRADO"),
          getProp(el, "NIVEL INTEGRADO"),
          format2FromRaw(getProp(el, "AREA INTEGRADO")),
          format2FromRaw(getProp(el, "LONGITUD INTEGRADO")),
          format2FromRaw(getProp(el, "VOLUMEN INTEGRADO"), el.volume)
        ]);
      }
      downloadCsv(rows, `${safeModel}_detalle`);
      return;
    }
    if (activeTab === 'ESTADOS') {
      const rows: Array<Array<unknown>> = [['Estado', 'Cantidad', 'Área m2', 'Longitud m', 'Volumen m3']];
      for (const st of STATUS_ORDER) {
        const v = statusTotals[st];
        rows.push([st, v.count, format2(v.area), format2(v.length), format2(v.volume)]);
      }
      rows.push(['TOTAL', totals.count, format2(totals.area), format2(totals.length), format2(totals.volume)]);
      downloadCsv(rows, `${safeModel}_estados`);
      return;
    }
    if (activeTab === 'HISTORIAL') {
      const rows: Array<Array<unknown>> = [['ID', 'Tipo', ...STATUS_ORDER]];
      for (const el of elements) {
        const tipoRaw = getProp(el, "NOMBRE INTEGRADO");
        const tipo = tipoRaw !== '-' && tipoRaw !== '' ? tipoRaw : el.name;
        const entries = (history?.[el.id] ?? []).slice().sort((a, b) => a.at.localeCompare(b.at));
        const latestByStatus = new Map<PurchaseStatus, string>();
        for (const entry of entries) latestByStatus.set(entry.status, entry.at);
        rows.push([el.id, tipo, ...STATUS_ORDER.map((st) => latestByStatus.get(st) ?? '-')]);
      }
      downloadCsv(rows, `${safeModel}_historial`);
      return;
    }
    if (activeTab === 'TUBERIAS') {
      const rows: Array<Array<unknown>> = [[
        'Tipo',
        'Diámetro',
        ...(pipeGroupingMode === 'POR_NIVEL' ? ['Nivel'] : []),
        `Unidades (${pipeCommercialLengthLabel})`,
        'Pendiente',
        'Pedido',
        'Comprado',
        'Almacén',
        'Instalado',
        'Longitud total (m)',
        'Restante (m)',
        'Desperdicio (m)',
        'Adicionales'
      ]];
      for (const r of pipePurchaseSummary) {
        const baseState = derivePipeStagesFromStatusLength(r.units, r.statusLength, pipeCommercialLength);
        const display = normalizePipeStages(r.units, baseState);
        const remaining = normalizePipeStageMeters(r.totalLength, r.units, baseState, pipeCommercialLength).pendiente;
        rows.push([
          r.tipo,
          r.diameter,
          ...(pipeGroupingMode === 'POR_NIVEL' ? [r.level] : []),
          r.units,
          display.pendiente,
          display.pedido,
          display.comprado,
          display.almacen,
          display.instalado,
          format2(r.totalLength), format2(remaining), format2(r.waste), pipeAdditionsByGroup[r.groupKey] ?? 0
        ]);
      }
      downloadCsv(rows, `${safeModel}_tuberias_${pipeGroupingMode.toLowerCase()}_${String(pipeCommercialLength).replace('.', '_')}m`);
      return;
    }
    if (activeTab === 'UNIONES') {
      const rows: Array<Array<unknown>> = [[
        'Tipo',
        'Diámetro',
        ...(pipeGroupingMode === 'POR_NIVEL' ? ['Nivel'] : []),
        'Unidades totales',
        'Unidades pendientes',
        'Pedido',
        'Comprado',
        'Almacén',
        'Instalado',
        'Adicionales'
      ]];
      for (const r of unionsPurchaseSummary) {
        const display = normalizeUnionStages(r.count, r.statusCount);
        rows.push([
          r.tipo,
          r.diameter,
          ...(pipeGroupingMode === 'POR_NIVEL' ? [r.level] : []),
          r.count,
          display.pendiente,
          display.pedido,
          display.comprado,
          display.almacen,
          display.instalado,
          unionAdditionsByGroup[r.groupKey] ?? 0
        ]);
      }
      downloadCsv(rows, `${safeModel}_uniones_${pipeGroupingMode.toLowerCase()}`);
      return;
    }
    if (activeTab === 'CORTES') {
      const rows: Array<Array<unknown>> = [[
        'Tipo',
        'Diámetro',
        'Tubo',
        'Tramos',
        'Cortes',
        'Longitud usada (m)',
        'Sobrante (m)',
      ]];
      for (const plan of pipeCutPlans) {
        for (const tube of plan.tubes) {
          rows.push([
            plan.tipo,
            plan.diameter,
            tube.tubeNumber,
            tube.pieces.length,
            tube.pieces.map((piece) => format2(piece.length)).join(' + '),
            format2(tube.usedLength),
            format2(tube.waste),
          ]);
        }
      }
      downloadCsv(rows, `${safeModel}_cortes_${String(pipeCommercialLength).replace('.', '_')}m`);
    }
  };

  const statusTotals = useMemo(() => {
    const base: Record<PurchaseStatus, { count: number; area: number; length: number; volume: number }> = {
      PENDIENTE: { count: 0, area: 0, length: 0, volume: 0 },
      PEDIDO: { count: 0, area: 0, length: 0, volume: 0 },
      COMPRADO: { count: 0, area: 0, length: 0, volume: 0 },
      ALMACEN: { count: 0, area: 0, length: 0, volume: 0 },
      INSTALADO: { count: 0, area: 0, length: 0, volume: 0 }
    };
    for (const el of elements) {
      const st = statuses[el.id] ?? 'PENDIENTE';
      const bucket = base[st];
      bucket.count += 1;
      bucket.area += getMetric(el, 'AREA INTEGRADO', 0);
      bucket.length += getMetric(el, 'LONGITUD INTEGRADO', 0);
      bucket.volume += getMetric(el, 'VOLUMEN INTEGRADO', el.volume);
    }
    return base;
  }, [elements, statuses]);

  const format2 = (n: number) => n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatShortNumber = (n: number) => n.toLocaleString('es-CO', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2
  });
  const format2FromRaw = (raw: unknown, fallback?: number) => {
    const n = parseNumber(raw);
    if (n !== null) return format2(n);
    if (fallback !== undefined && Number.isFinite(fallback)) return format2(fallback);
    return '-';
  };
  const pipeCommercialLengthLabel = `${formatShortNumber(pipeCommercialLength)} m`;

  const overscan = 20;
  const totalRows = elements.length;

  useEffect(() => {
    try {
      localStorage.setItem('cantidades:tableRowHeight', String(rowHeight));
    } catch {
    }
  }, [rowHeight]);

  const { paddingTop, paddingBottom, visibleElements, startIndex } = useMemo(() => {
    const safeScrollTop = Math.max(0, scrollTop);
    const start = Math.max(0, Math.floor(safeScrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / rowHeight) + overscan * 2;
    const end = Math.min(totalRows, start + visibleCount);
    const top = start * rowHeight;
    const bottom = Math.max(0, (totalRows - end) * rowHeight);
    return {
      paddingTop: top,
      paddingBottom: bottom,
      visibleElements: elements.slice(start, end),
      startIndex: start
    };
  }, [containerHeight, elements, rowHeight, scrollTop, totalRows]);

  const statusRowBg = (st: PurchaseStatus) => {
    switch (st) {
      case 'PENDIENTE':
        return 'bg-slate-100';
      case 'PEDIDO':
        return 'bg-blue-100';
      case 'COMPRADO':
        return 'bg-amber-100';
      case 'ALMACEN':
        return 'bg-violet-100';
      case 'INSTALADO':
        return 'bg-emerald-100';
    }
  };

  const statusTint = (st: PurchaseStatus) => {
    switch (st) {
      case 'PENDIENTE':
        return { row: 'bg-slate-50', hover: 'hover:bg-slate-100', pill: 'bg-slate-200 text-slate-700' };
      case 'PEDIDO':
        return { row: 'bg-blue-50', hover: 'hover:bg-blue-100', pill: 'bg-blue-200 text-blue-900' };
      case 'COMPRADO':
        return { row: 'bg-amber-50', hover: 'hover:bg-amber-100', pill: 'bg-amber-200 text-amber-900' };
      case 'ALMACEN':
        return { row: 'bg-violet-50', hover: 'hover:bg-violet-100', pill: 'bg-violet-200 text-violet-900' };
      case 'INSTALADO':
        return { row: 'bg-emerald-50', hover: 'hover:bg-emerald-100', pill: 'bg-emerald-200 text-emerald-900' };
    }
  };

  const nextStatus = (cur: PurchaseStatus): PurchaseStatus => {
    const idx = STATUS_ORDER.indexOf(cur);
    return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length] ?? 'PENDIENTE';
  };

  const allIds = useMemo(() => elements.map((e) => e.id), [elements]);
  const isAllSelected = selectedElementIds && selectedElementIds.length > 0 && selectedElementIds.length === allIds.length;
  const selectedCount = selectedElementIds?.length ?? 0;

  const applySelectionAtIndex = (absoluteIndex: number, shouldSelect: boolean, isRange: boolean) => {
    if (!onSetSelectedElementIds) return;
    const current = selectedElementIds ?? [];
    const anchor = lastAnchorIndexRef.current;
    const next = new Set(current);

    if (isRange && anchor !== null) {
      const from = Math.min(anchor, absoluteIndex);
      const to = Math.max(anchor, absoluteIndex);
      for (let i = from; i <= to; i += 1) {
        const id = elements[i]?.id;
        if (!id) continue;
        if (shouldSelect) next.add(id);
        else next.delete(id);
      }
    } else {
      const id = elements[absoluteIndex]?.id;
      if (id) {
        if (shouldSelect) next.add(id);
        else next.delete(id);
      }
    }

    lastAnchorIndexRef.current = absoluteIndex;
    onSetSelectedElementIds(Array.from(next));
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="h-10 px-4 border-b border-slate-100 bg-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('DETALLE')}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-colors ${
              activeTab === 'DETALLE'
                ? 'bg-[#003d4d] text-white border-[#003d4d]'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Detalle
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ESTADOS')}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-colors ${
              activeTab === 'ESTADOS'
                ? 'bg-[#003d4d] text-white border-[#003d4d]'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Estados
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('HISTORIAL')}
            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-colors ${
              activeTab === 'HISTORIAL'
                ? 'bg-[#003d4d] text-white border-[#003d4d]'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Historial
          </button>
          {isSanitaryModel && (
            <button
              type="button"
              onClick={() => setActiveTab('TUBERIAS')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                activeTab === 'TUBERIAS'
                  ? 'bg-[#003d4d] text-white border-[#003d4d]'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Tuberías
            </button>
          )}
          {isSanitaryModel && (
            <button
              type="button"
              onClick={() => setActiveTab('UNIONES')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                activeTab === 'UNIONES'
                  ? 'bg-[#003d4d] text-white border-[#003d4d]'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Uniones
            </button>
          )}
          {isSanitaryModel && (
            <button
              type="button"
              onClick={() => setActiveTab('CORTES')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-colors ${
                activeTab === 'CORTES'
                  ? 'bg-[#003d4d] text-white border-[#003d4d]'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Cortes
            </button>
          )}
          <button
            type="button"
            onClick={exportCurrentTab}
            className="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-colors bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            title="Descargar CSV separado por punto y coma"
          >
            Exportar CSV
          </button>
        </div>

        <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest flex items-center gap-4">
          <span>Elementos: {totals.count.toLocaleString('es-CO')}</span>
          <span>Área: {format2(totals.area)} m²</span>
          <span>Longitud: {format2(totals.length)} m</span>
          <span>Volumen: {format2(totals.volume)} m³</span>
        </div>
      </div>

      <div className="h-10 px-4 border-b border-slate-100 bg-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">
            <input
              type="checkbox"
              checked={Boolean(isAllSelected)}
              onChange={(e) => {
                if (!onSetSelectedElementIds) return;
                if (e.target.checked) onSetSelectedElementIds(allIds);
                else onSetSelectedElementIds([]);
              }}
              className="accent-[#003d4d]"
            />
            Seleccionar todo
          </label>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Seleccionados: {selectedCount.toLocaleString('es-CO')}
          </span>
          <button
            type="button"
            onClick={() => onSetSelectedElementIds?.([])}
            className="px-2 py-1 rounded border border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50"
          >
            Limpiar selección
          </button>
          <button
            type="button"
            onClick={onClearFilters}
            className="px-2 py-1 rounded border border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            disabled={!onClearFilters}
          >
            Limpiar filtros
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isSanitaryModel && (
            <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">
              <span>Longitud tubo</span>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={pipeCommercialLengthInput}
                onChange={(e) => setPipeCommercialLengthInput(e.target.value)}
                onBlur={() => setPipeCommercialLengthInput(String(normalizePipeCommercialLength(pipeCommercialLengthInput)))}
                className="w-20 bg-white border border-slate-200 rounded px-2 py-1 text-[10px] font-bold text-slate-700 normal-case tracking-normal"
                title="Longitud comercial del tubo en metros"
              />
              <span className="text-[10px] text-slate-500 normal-case tracking-normal">m</span>
            </label>
          )}
          {isSanitaryModel && (activeTab === 'TUBERIAS' || activeTab === 'UNIONES') && (
            <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">
              <span>Agrupar</span>
              <select
                value={pipeGroupingMode}
                onChange={(e) => setPipeGroupingMode(e.target.value as PipeGroupingMode)}
                className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600"
                title="Modo de agrupación para tuberías y uniones"
              >
                <option value="POR_NIVEL">Por nivel</option>
                <option value="TOTAL">Total tipo + diámetro</option>
              </select>
            </label>
          )}
          <select
            value={String(rowHeight)}
            onChange={(e) => setRowHeight(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600"
            title="Tamaño de filas"
          >
            <option value="20">Compacto</option>
            <option value="24">Normal</option>
            <option value="32">Grande</option>
          </select>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as PurchaseStatus)}
            className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600"
          >
            {STATUS_ORDER.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              if (!onChangeStatusMany) return;
              if (!selectedElementIds || selectedElementIds.length === 0) return;
              onChangeStatusMany(selectedElementIds, bulkStatus);
            }}
            className="px-3 py-1 rounded bg-[#003d4d] text-white text-[10px] font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-40"
            disabled={!onChangeStatusMany || !selectedElementIds || selectedElementIds.length === 0}
          >
            Aplicar
          </button>
          <button
            type="button"
            onClick={() => {
              if (!onChangeStatusMany) return;
              if (!selectedElementIds || selectedElementIds.length === 0) return;
              onChangeStatusMany(selectedElementIds, 'COMPRADO');
            }}
            className="px-3 py-1 rounded bg-amber-500 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-amber-600 disabled:opacity-40"
            disabled={!onChangeStatusMany || !selectedElementIds || selectedElementIds.length === 0}
          >
            Comprar
          </button>
        </div>
      </div>

      {activeTab === 'ESTADOS' ? (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#003d4d] text-white z-10">
              <tr>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Estado</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Cantidad</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Área m²</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Longitud m</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-right">Volumen m³</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {STATUS_ORDER.map((st) => {
                const v = statusTotals[st];
                const bg = statusRowBg(st);
                return (
                  <tr key={st} className={bg}>
                    <td className="px-4 py-2 text-xs font-bold text-slate-700">{st}</td>
                    <td className="px-4 py-2 text-xs text-right font-mono text-slate-700">{v.count.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-2 text-xs text-right font-mono text-slate-700">{format2(v.area)}</td>
                    <td className="px-4 py-2 text-xs text-right font-mono text-slate-700">{format2(v.length)}</td>
                    <td className="px-4 py-2 text-xs text-right font-mono font-bold text-slate-900">{format2(v.volume)}</td>
                  </tr>
                );
              })}
              <tr className="bg-white">
                <td className="px-4 py-2 text-xs font-black text-slate-900 uppercase">Total</td>
                <td className="px-4 py-2 text-xs text-right font-mono text-slate-900">{totals.count.toLocaleString('es-CO')}</td>
                <td className="px-4 py-2 text-xs text-right font-mono text-slate-900">{format2(totals.area)}</td>
                <td className="px-4 py-2 text-xs text-right font-mono text-slate-900">{format2(totals.length)}</td>
                <td className="px-4 py-2 text-xs text-right font-mono font-black text-slate-900">{format2(totals.volume)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : activeTab === 'DETALLE' ? (
        <div ref={containerRef} className="flex-1 overflow-auto bg-white">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead className="sticky top-0 bg-[#003d4d] text-white z-10">
              <tr>
                <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Sel</th>
                <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Estado</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Clasificación</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Tipo</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Categoría</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Elemento</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Detalle</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Material Integrado</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Ubicación</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Área M2</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Longitud M</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-right">Volumen M3</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paddingTop > 0 && (
                <tr style={{ height: paddingTop }}>
                  <td colSpan={12} />
                </tr>
              )}

              {visibleElements.map((el, idx) => {
                const isSelected = selectedElementId === el.id;
                const st: PurchaseStatus = statuses[el.id] ?? 'PENDIENTE';
                const tint = statusTint(st);
                const isChecked = selectedSet.has(el.id);
                const absoluteIndex = startIndex + idx;
                const tipoRaw = getProp(el, "NOMBRE INTEGRADO");
                const tipo = tipoRaw !== '-' && tipoRaw !== '' ? tipoRaw : el.name;

                return (
                  <tr
                    key={el.id}
                    className={`${tint.row} ${tint.hover} cursor-pointer transition-colors ${isSelected ? 'outline outline-2 outline-blue-300' : ''}`}
                    onClick={(e) => {
                      if (e.shiftKey) {
                        applySelectionAtIndex(absoluteIndex, true, true);
                        return;
                      }
                      lastAnchorIndexRef.current = absoluteIndex;
                      onSelectElement(el.id);
                    }}
                  >
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = e.currentTarget;
                          applySelectionAtIndex(absoluteIndex, target.checked, e.shiftKey);
                        }}
                        className="accent-[#003d4d]"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onChangeStatus(el.id, nextStatus(st));
                        }}
                        className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${tint.pill}`}
                        title="Cambiar estado"
                      >
                        {st}
                      </button>
                    </td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 uppercase font-bold">
                      {(() => {
                        const v = getFirstProp(el, ["CLASIFICACION", "CLASIFICACIÓN"]);
                        return v !== '-' ? v : 'SIN CLASIFICAR';
                      })()}
                    </td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 uppercase font-medium">{tipo}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 uppercase">{el.category}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 uppercase font-medium">{getProp(el, "NOMBRE INTEGRADO") || el.name}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 uppercase">{getProp(el, "DETALLE") || '-'}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 uppercase">{getProp(el, "MATERIAL INTEGRADO")}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 uppercase">{getProp(el, "NIVEL INTEGRADO")}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 text-right font-mono">{format2FromRaw(getProp(el, "AREA INTEGRADO"))}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 text-right font-mono">{format2FromRaw(getProp(el, "LONGITUD INTEGRADO"))}</td>
                    <td className="px-4 py-1.5 text-[10px] text-slate-600 text-right font-mono font-bold">
                      {format2FromRaw(getProp(el, "VOLUMEN INTEGRADO"), el.volume)}
                    </td>
                  </tr>
                );
              })}

              {paddingBottom > 0 && (
                <tr style={{ height: paddingBottom }}>
                  <td colSpan={12} />
                </tr>
              )}

              {totalRows === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-400 text-xs italic">
                    No hay datos para mostrar con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'HISTORIAL' ? (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead className="sticky top-0 bg-[#003d4d] text-white z-10">
              <tr>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">ID</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Tipo</th>
                {STATUS_ORDER.map((st) => (
                  <th key={st} className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">{st}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {elements.map((el) => {
                const tipoRaw = getProp(el, "NOMBRE INTEGRADO");
                const tipo = tipoRaw !== '-' && tipoRaw !== '' ? tipoRaw : el.name;
                const entries = (history?.[el.id] ?? []).slice().sort((a, b) => a.at.localeCompare(b.at));
                const latestByStatus = new Map<PurchaseStatus, string>();
                for (const entry of entries) {
                  latestByStatus.set(entry.status, entry.at);
                }
                return (
                  <tr key={el.id}>
                    <td className="px-4 py-2 text-xs font-mono text-slate-700">{el.id}</td>
                    <td className="px-4 py-2 text-xs text-slate-700">{tipo}</td>
                    {STATUS_ORDER.map((st) => (
                      <td key={st} className="px-4 py-2 text-[10px] text-slate-600">
                        {latestByStatus.get(st) ? new Date(latestByStatus.get(st)!).toLocaleString('es-CO') : '-'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'TUBERIAS' ? (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="sticky top-0 bg-[#003d4d] text-white z-10">
              <tr>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Tipo</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Diámetro</th>
                {pipeGroupingMode === 'POR_NIVEL' && (
                  <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Nivel</th>
                )}
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">{`Unidades (${pipeCommercialLengthLabel})`}</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Pendiente</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Pedido</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Comprado</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Almacén</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Instalado</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Longitud total (m)</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Restante (m)</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Desperdicio (m)</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-right">Adicionales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pipePurchaseSummary.map((r) => (
                <tr key={r.groupKey}>
                  <td className="px-4 py-2 text-xs font-bold text-slate-700">{r.tipo}</td>
                  <td className="px-4 py-2 text-xs text-slate-700">{r.diameter}</td>
                  {pipeGroupingMode === 'POR_NIVEL' && (
                    <td className="px-4 py-2 text-xs text-slate-700">{r.level}</td>
                  )}
                  <td className="px-4 py-2 text-xs text-right font-mono font-black text-slate-900">{r.units.toLocaleString('es-CO')}</td>
                  {(() => {
                    const baseState = derivePipeStagesFromStatusLength(r.units, r.statusLength, pipeCommercialLength);
                    const display = normalizePipeStages(r.units, baseState);
                    const onSet = (stage: 'pedido' | 'comprado' | 'almacen' | 'instalado') => (value: number) => {
                      const current = derivePipeStagesFromStatusLength(r.units, r.statusLength, pipeCommercialLength);
                      const next = movePipeStage(r.units, current, stage, value);
                      applyPipeAssignmentsToModel(r.ids, r.units, r.totalLength, pipeCommercialLength, next);
                    };
                    const toSafeNumber = (raw: string) => {
                      const n = Number(raw);
                      return Number.isFinite(n) ? n : 0;
                    };
                    return (
                      <>
                        <td className="px-4 py-2 text-xs text-right font-mono font-black text-slate-900">{display.pendiente.toLocaleString('es-CO')}</td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={display.pedido}
                            onChange={(e) => onSet('pedido')(toSafeNumber(e.target.value))}
                            className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={display.comprado}
                            onChange={(e) => onSet('comprado')(toSafeNumber(e.target.value))}
                            className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={display.almacen}
                            onChange={(e) => onSet('almacen')(toSafeNumber(e.target.value))}
                            className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={display.instalado}
                            onChange={(e) => onSet('instalado')(toSafeNumber(e.target.value))}
                            className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                          />
                        </td>
                      </>
                    );
                  })()}
                  <td className="px-4 py-2 text-xs text-right font-mono text-slate-700">{format2(r.totalLength)}</td>
                  <td className="px-4 py-2 text-xs text-right font-mono font-black text-slate-900">{format2(normalizePipeStageMeters(r.totalLength, r.units, derivePipeStagesFromStatusLength(r.units, r.statusLength, pipeCommercialLength), pipeCommercialLength).pendiente)}</td>
                  <td className="px-4 py-2 text-xs text-right font-mono text-slate-700">{format2(r.waste)}</td>
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      value={pipeAdditionsByGroup[r.groupKey] ?? 0}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        onPipeAdditionChange(r.groupKey, Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
                      }}
                      className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                    />
                  </td>
                </tr>
              ))}
              {pipePurchaseSummary.length > 0 && (() => {
                let tUnits = 0, tPendiente = 0, tPedido = 0, tComprado = 0, tAlmacen = 0, tInstalado = 0, tLength = 0, tRestante = 0, tWaste = 0, tAdicionales = 0;
                for (const r of pipePurchaseSummary) {
                  tUnits += r.units;
                  tLength += r.totalLength;
                  tWaste += r.waste;
                  const baseState = derivePipeStagesFromStatusLength(r.units, r.statusLength, pipeCommercialLength);
                  const display = normalizePipeStages(r.units, baseState);
                  tPendiente += display.pendiente;
                  tPedido += display.pedido;
                  tComprado += display.comprado;
                  tAlmacen += display.almacen;
                  tInstalado += display.instalado;
                  tRestante += normalizePipeStageMeters(r.totalLength, r.units, baseState, pipeCommercialLength).pendiente;
                  tAdicionales += pipeAdditionsByGroup[r.groupKey] ?? 0;
                }
                return (
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td colSpan={pipeGroupingMode === 'POR_NIVEL' ? 3 : 2} className="px-4 py-3 text-xs font-black text-slate-900 uppercase text-right">Totales:</td>
                    <td className="px-4 py-3 text-xs text-right font-mono font-black text-[#003d4d]">{tUnits.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-xs text-right font-mono font-black text-[#003d4d]">{tPendiente.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-xs text-right font-mono font-black text-[#003d4d]">{tPedido.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-xs text-right font-mono font-black text-[#003d4d]">{tComprado.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-xs text-right font-mono font-black text-[#003d4d]">{tAlmacen.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-xs text-right font-mono font-black text-[#003d4d]">{tInstalado.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-xs text-right font-mono font-black text-[#003d4d]">{format2(tLength)}</td>
                    <td className="px-4 py-3 text-xs text-right font-mono font-black text-[#003d4d]">{format2(tRestante)}</td>
                    <td className="px-4 py-3 text-xs text-right font-mono font-black text-[#003d4d]">{format2(tWaste)}</td>
                    <td className="px-4 py-3 text-xs text-right font-mono font-black text-[#003d4d]">{tAdicionales.toLocaleString('es-CO')}</td>
                  </tr>
                );
              })()}
              {pipePurchaseSummary.length === 0 && (
                <tr>
                  <td colSpan={pipeGroupingMode === 'POR_NIVEL' ? 13 : 12} className="px-4 py-8 text-center text-slate-400 text-xs italic">
                    No hay tuberías con longitud para resumir con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'CORTES' ? (
        <div className="flex-1 overflow-auto bg-slate-50/40 p-4 space-y-4">
          {pipeCutPlans.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden px-4 py-3 shadow-sm flex items-center justify-between">
              <div className="text-sm font-black text-[#003d4d] uppercase flex items-center gap-4">
                Total General de Cortes
                <button
                  type="button"
                  onClick={() => {
                    const allExpanded = pipeCutPlans.every(p => expandedCortesGroups[p.groupKey] !== false);
                    const next: Record<string, boolean> = {};
                    for (const p of pipeCutPlans) next[p.groupKey] = !allExpanded;
                    setExpandedCortesGroups(next);
                  }}
                  className="px-2 py-1 text-[9px] border border-slate-200 text-slate-500 rounded hover:bg-slate-50 transition-colors uppercase tracking-widest"
                >
                  {pipeCutPlans.every(p => expandedCortesGroups[p.groupKey] !== false) ? 'Recoger Todos' : 'Expandir Todos'}
                </button>
              </div>
              <div className="flex items-center gap-6 text-[11px] font-bold uppercase tracking-widest text-slate-600">
                <span className="flex flex-col items-end">
                  <span className="text-slate-400 text-[9px]">Tramos Totales</span>
                  <span className="text-slate-800">{pipeCutPlans.reduce((sum, p) => sum + p.pieces.length, 0).toLocaleString('es-CO')}</span>
                </span>
                <span className="flex flex-col items-end">
                  <span className="text-slate-400 text-[9px]">Tubos Totales</span>
                  <span className="text-slate-800">{pipeCutPlans.reduce((sum, p) => sum + p.actualUnits, 0).toLocaleString('es-CO')}</span>
                </span>
                <span className="flex flex-col items-end">
                  <span className="text-slate-400 text-[9px]">Longitud Total</span>
                  <span className="text-slate-800">{format2(pipeCutPlans.reduce((sum, p) => sum + p.totalLength, 0))} m</span>
                </span>
                <span className="flex flex-col items-end">
                  <span className="text-slate-400 text-[9px]">Sobrante Total</span>
                  <span className="text-slate-900">{format2(pipeCutPlans.reduce((sum, p) => sum + p.totalWaste, 0))} m</span>
                </span>
              </div>
            </div>
          )}
          {pipeCutPlans.map((plan) => {
            const isExpanded = expandedCortesGroups[plan.groupKey] !== false;
            return (
              <section key={plan.groupKey} className="bg-white border border-slate-200 rounded-lg overflow-hidden transition-all">
                <div
                  className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleCortesGroup(plan.groupKey)}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-slate-400">
                      {isExpanded ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900 uppercase">{plan.tipo}</div>
                      <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Diámetro: {plan.diameter}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                    <span>Tramos: {plan.pieces.length.toLocaleString('es-CO')}</span>
                    <span>Tubos: {plan.actualUnits.toLocaleString('es-CO')}</span>
                    <span>Longitud: {format2(plan.totalLength)} m</span>
                    <span className="text-slate-900">Sobrante: {format2(plan.totalWaste)} m</span>
                  </div>
                </div>
                {isExpanded && (
                  <>
                    <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-4">
                      <span>Mínimo teórico: {plan.minimumUnits.toLocaleString('es-CO')} tubos</span>
                      <span>Plan actual: {plan.actualUnits.toLocaleString('es-CO')} tubos</span>
                    </div>
                    <div className="overflow-auto max-h-[400px]">
                      <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead className="sticky top-0 bg-[#003d4d] text-white z-10">
                          <tr>
                            <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Tubo</th>
                            <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Tramos</th>
                            <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Cortes</th>
                            <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Usado (m)</th>
                            <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-right">Sobrante (m)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {plan.tubes.map((tube) => (
                            <tr key={`${plan.groupKey}:${tube.tubeNumber}`}>
                              <td className="px-4 py-2 text-xs font-black text-slate-700">{`Tubo ${tube.tubeNumber}`}</td>
                              <td className="px-4 py-2 text-xs text-right font-mono text-slate-700">{tube.pieces.length.toLocaleString('es-CO')}</td>
                              <td className="px-4 py-2 text-xs text-slate-700 font-mono">{tube.pieces.map((piece) => format2(piece.length)).join(' + ')}</td>
                              <td className="px-4 py-2 text-xs text-right font-mono text-slate-700">{format2(tube.usedLength)}</td>
                              <td className="px-4 py-2 text-xs text-right font-mono font-black text-slate-900">{format2(tube.waste)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            );
          })}
          {pipeCutPlans.length === 0 && (
            <div className="px-4 py-10 text-center text-slate-400 text-xs italic bg-white border border-slate-200 rounded-lg">
              No hay tramos de tubería aptos para generar un plan de cortes con los filtros actuales.
            </div>
          )}
        </div>
      ) : activeTab === 'UNIONES' ? (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[1050px]">
            <thead className="sticky top-0 bg-[#003d4d] text-white z-10">
              <tr>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Tipo</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Diámetro</th>
                {pipeGroupingMode === 'POR_NIVEL' && (
                  <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10">Nivel</th>
                )}
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Unidades totales</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Unidades pendientes</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Pedido</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Comprado</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Almacén</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-r border-white/10 text-right">Instalado</th>
                <th className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-right">Adicionales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {unionsPurchaseSummary.map((r) => (
                <tr key={r.groupKey}>
                  <td className="px-4 py-2 text-xs font-bold text-slate-700">{r.tipo}</td>
                  <td className="px-4 py-2 text-xs text-slate-700">{r.diameter}</td>
                  {pipeGroupingMode === 'POR_NIVEL' && (
                    <td className="px-4 py-2 text-xs text-slate-700">{r.level}</td>
                  )}
                  {(() => {
                    const display = normalizeUnionStages(r.count, r.statusCount);
                    const onSet = (stage: 'pedido' | 'comprado' | 'almacen' | 'instalado') => (value: number) => {
                      const next = moveUnionStage(r.count, r.statusCount, stage, value);
                      applyUnionAssignmentsToModel(r.ids, next);
                    };
                    const toSafeNumber = (raw: string) => {
                      const n = Number(raw);
                      return Number.isFinite(n) ? n : 0;
                    };
                    return (
                      <>
                        <td className="px-4 py-2 text-xs text-right font-mono font-black text-slate-900">{r.count.toLocaleString('es-CO')}</td>
                        <td className="px-4 py-2 text-xs text-right font-mono font-black text-slate-900">{display.pendiente.toLocaleString('es-CO')}</td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={display.pedido}
                            onChange={(e) => onSet('pedido')(toSafeNumber(e.target.value))}
                            className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={display.comprado}
                            onChange={(e) => onSet('comprado')(toSafeNumber(e.target.value))}
                            className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={display.almacen}
                            onChange={(e) => onSet('almacen')(toSafeNumber(e.target.value))}
                            className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={display.instalado}
                            onChange={(e) => onSet('instalado')(toSafeNumber(e.target.value))}
                            className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={unionAdditionsByGroup[r.groupKey] ?? 0}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              onUnionAdditionChange(r.groupKey, Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
                            }}
                            className="w-20 text-right bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                          />
                        </td>
                      </>
                    );
                  })()}
                </tr>
              ))}
              {unionsPurchaseSummary.length > 0 && (() => {
                let uCount = 0, uPendiente = 0, uPedido = 0, uComprado = 0, uAlmacen = 0, uInstalado = 0, uAdicionales = 0;
                for (const r of unionsPurchaseSummary) {
                  uCount += r.count;
                  const display = normalizeUnionStages(r.count, r.statusCount);
                  uPendiente += display.pendiente;
                  uPedido += display.pedido;
                  uComprado += display.comprado;
                  uAlmacen += display.almacen;
                  uInstalado += display.instalado;
                  uAdicionales += unionAdditionsByGroup[r.groupKey] ?? 0;
                }
                return (
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td colSpan={pipeGroupingMode === 'POR_NIVEL' ? 3 : 2} className="px-4 py-3 text-xs font-black text-slate-900 uppercase text-right">Totales:</td>
                    <td className="px-4 py-3 text-xs text-right font-mono font-black text-[#003d4d]">{uCount.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-xs text-right font-mono font-black text-[#003d4d]">{uPendiente.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-xs text-right font-mono font-black text-[#003d4d]">{uPedido.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-xs text-right font-mono font-black text-[#003d4d]">{uComprado.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-xs text-right font-mono font-black text-[#003d4d]">{uAlmacen.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-xs text-right font-mono font-black text-[#003d4d]">{uInstalado.toLocaleString('es-CO')}</td>
                    <td className="px-4 py-3 text-xs text-right font-mono font-black text-[#003d4d]">{uAdicionales.toLocaleString('es-CO')}</td>
                  </tr>
                );
              })()}
              {unionsPurchaseSummary.length === 0 && (
                <tr>
                  <td colSpan={pipeGroupingMode === 'POR_NIVEL' ? 10 : 9} className="px-4 py-8 text-center text-slate-400 text-xs italic">
                    No hay uniones de tubería para resumir con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
