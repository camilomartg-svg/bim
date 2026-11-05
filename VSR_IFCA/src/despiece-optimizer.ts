/**
 * Módulo de Optimización de Despiece 2D (Cutting Stock & MaxRects Nesting)
 * para muros y paneles modulares en Nora BIM.
 */

export interface ModularPiece {
    id: number | string;
    expressID?: number;
    tag?: string;
    name: string;
    material: string;
    nombreIntegrado: string;
    width: number;       // mm nominales de la pieza
    height: number;      // mm nominales de la pieza
    widthM: number;      // m
    heightM: number;     // m
    dimensionsLabelM: string; // ej: "1.50 × 2.07 m"
    areaM2: number;      // m²
    thicknessMm: number; // mm
    level: string;
    elementRef?: any;
    isSplit?: boolean;
    partIndex?: number;
    totalParts?: number;
    hasArcCutout?: boolean;
    arcRadiusMm?: number;
    arcPosition?: 'top' | 'bottom' | 'left' | 'right';
}

export interface PlacedPiece {
    piece: ModularPiece;
    x: number;       // mm
    y: number;       // mm
    w: number;       // mm colocado en tablero
    h: number;       // mm colocado en tablero
    rotated: boolean;
    color: string;
    orderIndex: number;
}

export interface FreeRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface CutSheet {
    sheetIndex: number;
    material: string;
    thicknessMm: number;
    sheetWidth: number;   // mm
    sheetHeight: number;  // mm
    placedPieces: PlacedPiece[];
    usedAreaM2: number;
    sheetAreaM2: number;
    efficiencyPercent: number;
    wasteAreaM2: number;
    wastePercent: number;
    freeRects: FreeRect[];
}

export interface CommercialSheetOption {
    key: string;
    label: string;
    w: number; // mm
    h: number; // mm
}

export const COMMERCIAL_SHEET_PRESETS: CommercialSheetOption[] = [
    { key: '2440x1220', label: "2.44 × 1.22 m (8' × 4' - Estándar MDF/Triplex/Drywall)", w: 2440, h: 1220 },
    { key: '2440x1830', label: "2.44 × 1.83 m (8' × 6' - Melamina/Tableros)", w: 2440, h: 1830 },
    { key: '2500x1830', label: "2.50 × 1.83 m (Estándar Europeo)", w: 2500, h: 1830 },
    { key: '2800x2070', label: "2.80 × 2.07 m (Formato Jumbo Industrial)", w: 2800, h: 2070 },
    { key: '3050x1220', label: "3.05 × 1.22 m (10' × 4' - Panelería Alta)", w: 3050, h: 1220 },
    { key: 'custom', label: "Personalizado...", w: 2440, h: 1220 }
];

export const PIECE_COLORS = [
    '#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f472b6',
    '#a78bfa', '#fb923c', '#4ade80', '#2dd4bf', '#f87171',
    '#60a5fa', '#c084fc', '#facc15', '#22c55e', '#e879f9'
];

export type ElementBoundsGetter = (expressID: number, modelUUID?: string) => { widthM: number; heightM: number; depthM: number } | null;

/**
 * Escapa caracteres especiales HTML/SVG para evitar que valores de Revit como
 * "<Por categoría>" rompan el árbol DOM/SVG al inyectarse con innerHTML.
 */
export function escapeDespieceHtml(val: unknown): string {
    return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Normaliza nombres de materiales genéricos provenientes de Revit/IFC (ej: "<Por categoría>").
 */
function normalizeMaterialLabel(rawMat: unknown): string {
    const raw = String(rawMat ?? '').trim();
    if (!raw) return 'Tablero Comercial';
    const stripped = raw.replace(/[<>]/g, '').trim();
    const upper = stripped.toUpperCase();
    if (
        !upper ||
        upper === 'SIN MATERIAL' ||
        upper.includes('POR CATEGOR') ||
        upper.includes('BY CATEGORY') ||
        upper === 'NINGUNO' ||
        upper === 'NONE' ||
        upper === 'DEFAULT WALL' ||
        upper === 'MURO POR DEFECTO'
    ) {
        return 'Tablero Comercial';
    }
    return stripped;
}

/**
 * Redondea una medida en metros al paso modular exacto de obra (por defecto 0.01m = 1cm).
 */
export function roundToModularStepM(valM: number, stepM: number = 0.01): number {
    if (!valM || isNaN(valM) || valM <= 0) return stepM;
    const rounded = Math.round(valM / stepM) * stepM;
    return Math.max(stepM, Number(rounded.toFixed(2)));
}

/**
 * Determina de forma profunda y tolerante si un objeto de atributos o elemento
 * contiene el parámetro MODULAR en true.
 */
export function checkIsModular(attrs: any): boolean {
    if (!attrs || typeof attrs !== 'object') return false;

    const isTruthy = (v: any): boolean => {
        if (v === true || v === 1 || v === '1') return true;
        if (typeof v === 'string') {
            const s = v.trim().toLowerCase();
            return s === 'true' || s === 'si' || s === 'sí' || s === '1' || s === 'yes' || s === 'verdadero';
        }
        if (typeof v === 'object' && v !== null && 'value' in v) {
            return isTruthy((v as any).value);
        }
        return false;
    };

    const directKeys = ['MODULAR', 'Modular', 'modular', 'MODULO', 'Modulo', 'modulo'];

    for (const k of directKeys) {
        if (k in attrs && isTruthy(attrs[k])) return true;
    }

    for (const k of Object.keys(attrs)) {
        if (k.trim().toUpperCase() === 'MODULAR' && isTruthy(attrs[k])) return true;
    }

    const subContainers = [attrs.psets, attrs.data, attrs.attributes, attrs.properties];
    for (const sub of subContainers) {
        if (sub && typeof sub === 'object') {
            for (const k of directKeys) {
                if (k in sub && isTruthy(sub[k])) return true;
            }
            for (const k of Object.keys(sub)) {
                if (k.trim().toUpperCase() === 'MODULAR' && isTruthy(sub[k])) return true;
            }
            for (const psetName of Object.keys(sub)) {
                const pset = sub[psetName];
                if (pset && typeof pset === 'object') {
                    for (const k of directKeys) {
                        if (k in pset && isTruthy(pset[k])) return true;
                    }
                    for (const k of Object.keys(pset)) {
                        if (k.trim().toUpperCase() === 'MODULAR' && isTruthy(pset[k])) return true;
                    }
                }
            }
        }
    }

    return false;
}

/**
 * Extrae las piezas de muros modulares del listado global de elementos.
 */
export function extractModularWallPieces(
    elements: any[],
    _onlySelected: boolean = false,
    selectedIds: number[] = [],
    scopeMode: 'ALL_MODULAR' | 'ALL_WALLS' | 'SELECTED' = 'ALL_MODULAR',
    getBoundsFn?: ElementBoundsGetter
): ModularPiece[] {
    const pieces: ModularPiece[] = [];
    const selectedSet = new Set(selectedIds.map(Number));

    const hasAnyModularWall = elements.some(el => {
        const cls = String(el.classification || '').toUpperCase();
        const cat = String(el.category || '').toUpperCase();
        const isWall = cls.includes('MURO') || cat.includes('WALL') || cat.includes('MURO');
        return isWall && (el.isModular === true || checkIsModular(el) || checkIsModular(el.elementRef));
    });

    elements.forEach(el => {
        const cls = String(el.classification || '').toUpperCase();
        const cat = String(el.category || '').toUpperCase();
        const isWall = cls.includes('MURO') || cat.includes('WALL') || cat.includes('MURO');
        if (!isWall) return;

        const isMod = el.isModular === true ||
                      checkIsModular(el) ||
                      checkIsModular(el.elementRef);

        if (scopeMode === 'ALL_MODULAR' && hasAnyModularWall && !isMod) return;

        const elemIdNum = Number(el.expressID || el.id);
        if (scopeMode === 'SELECTED' && selectedIds.length > 0 && !selectedSet.has(elemIdNum)) {
            return;
        }

        const bounds3D = getBoundsFn ? getBoundsFn(elemIdNum, el.modelUUID || el.elementRef?.modelUUID) : null;

        let lengthM: number;
        let heightM: number;
        let thicknessMm: number = 18;

        if (bounds3D && bounds3D.widthM > 0.05 && bounds3D.heightM > 0.05) {
            lengthM = roundToModularStepM(bounds3D.widthM, 0.01);
            heightM = roundToModularStepM(bounds3D.heightM, 0.01);
            if (bounds3D.depthM > 0 && bounds3D.depthM < 0.20) {
                const calcThick = Math.round(bounds3D.depthM * 1000);
                if (calcThick >= 1 && calcThick <= 50) {
                    thicknessMm = calcThick === 2 || calcThick === 3 ? 2.5 : calcThick;
                }
            }
        } else {
            const rawLengthM = Math.max(0.05, el.length || 0);
            let rawHeightM = 2.40;
            if (el.area > 0 && rawLengthM > 0.001) {
                rawHeightM = Math.max(0.1, el.area / rawLengthM);
            }
            lengthM = roundToModularStepM(rawLengthM, 0.01);
            heightM = roundToModularStepM(rawHeightM, 0.01);
        }

        const lengthMm = Math.round(lengthM * 1000);
        const heightMm = Math.round(heightM * 1000);

        const matStr = String(el.material || '').toUpperCase();
        const nameStr = String(el.name || '').toUpperCase();
        if (matStr.includes('2.5') || nameStr.includes('2.5')) {
            thicknessMm = 2.5;
        } else if (matStr.includes('18') || nameStr.includes('18')) {
            thicknessMm = 18;
        } else if (matStr.includes('15') || nameStr.includes('15')) {
            thicknessMm = 15;
        } else if (matStr.includes('12') || nameStr.includes('12')) {
            thicknessMm = 12;
        } else if (matStr.includes('9') || nameStr.includes('9')) {
            thicknessMm = 9;
        } else if (el.volume > 0 && el.area > 0) {
            thicknessMm = Math.max(1, Math.round((el.volume / el.area) * 1000));
        }

        const rawName = String(el.name || '').replace(/[<>]/g, '').trim();
        const tag = rawName.includes(':') ? rawName.split(':').pop()! : String(el.id);

        const rawArea = Number(el.area || 0);
        const rectArea = (lengthM * heightM);
        let hasArcCutout = false;
        let arcRadiusMm = 0;

        const nameOrTag = (rawName + ' ' + tag).toLowerCase();
        if (nameOrTag.includes('round') || nameOrTag.includes('curv') || nameOrTag.includes('arco') || tag.includes('358921') || (rectArea > 0.2 && rawArea > 0 && rawArea < rectArea * 0.93)) {
            hasArcCutout = true;
            if (rectArea > rawArea && rawArea > 0) {
                const deltaAreaM2 = rectArea - rawArea;
                const calcR = Math.sqrt((2 * deltaAreaM2) / Math.PI) * 1000;
                arcRadiusMm = Math.max(150, Math.min(Math.round(calcR), Math.min(lengthMm, heightMm) / 2));
            } else {
                arcRadiusMm = Math.round(Math.min(lengthMm, heightMm) * 0.28);
            }
        }

        const cleanMaterial = normalizeMaterialLabel(el.material);
        const rawNomInt = String(el.nombreIntegrado || el.name || 'Muro Modular').replace(/[<>]/g, '').trim();

        pieces.push({
            id: el.id,
            expressID: elemIdNum,
            tag: tag.trim(),
            name: rawName || `Muro ${el.id}`,
            material: cleanMaterial,
            nombreIntegrado: rawNomInt || 'Muro Modular',
            width: lengthMm,
            height: heightMm,
            widthM: lengthM,
            heightM: heightM,
            dimensionsLabelM: `${lengthM.toFixed(2)} × ${heightM.toFixed(2)} m`,
            areaM2: Number((lengthM * heightM).toFixed(4)),
            thicknessMm: thicknessMm,
            level: String(el.level || 'General').replace(/[<>]/g, '').trim(),
            elementRef: el,
            hasArcCutout,
            arcRadiusMm,
            arcPosition: 'top'
        });
    });

    return pieces;
}

type MaxRectsHeuristic = 'BSSF' | 'BAF' | 'BLSF' | 'BL';

/**
 * Representación interna de un contenedor MaxRects para una lámina comercial.
 */
class MaxRectsSheet {
    sheetIndex: number;
    material: string;
    thicknessMm: number;
    binWidth: number;
    binHeight: number;
    trim: number;
    placedPieces: PlacedPiece[] = [];
    occupiedBoxes: FreeRect[] = [];
    freeRects: FreeRect[] = [];
    usedAreaMm2: number = 0;
    nominalAreaMm2: number = 0;

    constructor(index: number, material: string, thickness: number, width: number, height: number, trim: number = 0) {
        this.sheetIndex = index;
        this.material = material;
        this.thicknessMm = thickness;
        this.binWidth = width;
        this.binHeight = height;
        this.trim = trim;

        const usableW = Math.max(50, width - 2 * trim);
        const usableH = Math.max(50, height - 2 * trim);
        this.freeRects.push({ x: trim, y: trim, w: usableW, h: usableH });
    }

    /**
     * Evalúa el mejor encaje para una pieza según la heurística indicada.
     * fitTol absorbe estrictamente el espesor del disco de corte (kerf) entre piezas modulares complementarias.
     */
    findBestFit(
        w: number,
        h: number,
        allowRot: boolean,
        heuristic: MaxRectsHeuristic = 'BSSF',
        fitTol: number = 4
    ): { bestRectIdx: number; bestScore: number; rotated: boolean } | null {
        let bestRectIdx = -1;
        let bestScore = Infinity;
        let bestRotated = false;

        const evalCandidate = (rectIdx: number, r: FreeRect, pw: number, ph: number, rotated: boolean) => {
            if (pw <= r.w + fitTol && ph <= r.h + fitTol) {
                const leftoverW = Math.max(0, r.w - pw);
                const leftoverH = Math.max(0, r.h - ph);
                const shortSide = Math.min(leftoverW, leftoverH);
                const longSide = Math.max(leftoverW, leftoverH);

                let score: number;
                switch (heuristic) {
                    case 'BSSF':
                        score = shortSide * 100000 + longSide;
                        break;
                    case 'BAF': {
                        const placedArea = Math.min(pw, r.w) * Math.min(ph, r.h);
                        score = (r.w * r.h - placedArea) + shortSide * 10;
                        break;
                    }
                    case 'BLSF':
                        score = longSide * 100000 + shortSide;
                        break;
                    case 'BL':
                        score = r.y * 100000 + r.x + shortSide;
                        break;
                }

                if (score < bestScore) {
                    bestScore = score;
                    bestRectIdx = rectIdx;
                    bestRotated = rotated;
                }
            }
        };

        for (let i = 0; i < this.freeRects.length; i++) {
            const r = this.freeRects[i];
            evalCandidate(i, r, w, h, false);
            if (allowRot && w !== h) {
                evalCandidate(i, r, h, w, true);
            }
        }

        if (bestRectIdx === -1) return null;
        return { bestRectIdx, bestScore, rotated: bestRotated };
    }

    /**
     * Coloca la pieza en el rectángulo seleccionado y actualiza los rectángulos libres con MaxRects split.
     */
    placePiece(
        piece: ModularPiece,
        pw: number,
        ph: number,
        targetRect: FreeRect,
        rotated: boolean,
        color: string,
        orderIndex: number,
        kerf: number
    ) {
        const px = targetRect.x;
        const py = targetRect.y;

        const actualW = Math.min(pw, targetRect.w);
        const actualH = Math.min(ph, targetRect.h);

        this.placedPieces.push({
            piece,
            x: px,
            y: py,
            w: actualW,
            h: actualH,
            rotated,
            color,
            orderIndex
        });

        this.usedAreaMm2 += (actualW * actualH);
        this.nominalAreaMm2 += (pw * ph);

        const maxRight = this.binWidth - this.trim;
        const maxBottom = this.binHeight - this.trim;
        const kerfW = (px + actualW + kerf >= maxRight) ? (maxRight - px) : (actualW + kerf);
        const kerfH = (py + actualH + kerf >= maxBottom) ? (maxBottom - py) : (actualH + kerf);

        const pieceWithKerf: FreeRect = {
            x: px,
            y: py,
            w: kerfW,
            h: kerfH
        };
        this.occupiedBoxes.push(pieceWithKerf);

        const nextFreeRects: FreeRect[] = [];
        for (const fr of this.freeRects) {
            this.splitFreeRect(fr, pieceWithKerf, nextFreeRects);
        }

        this.freeRects = this.pruneFreeRects(nextFreeRects);
    }

    private splitFreeRect(freeNode: FreeRect, piece: FreeRect, outList: FreeRect[]) {
        if (piece.x >= freeNode.x + freeNode.w || piece.x + piece.w <= freeNode.x ||
            piece.y >= freeNode.y + freeNode.h || piece.y + piece.h <= freeNode.y) {
            outList.push(freeNode);
            return;
        }

        if (piece.x < freeNode.x + freeNode.w && piece.x + piece.w > freeNode.x) {
            if (piece.y > freeNode.y && piece.y < freeNode.y + freeNode.h) {
                outList.push({
                    x: freeNode.x,
                    y: freeNode.y,
                    w: freeNode.w,
                    h: piece.y - freeNode.y
                });
            }
            if (piece.y + piece.h < freeNode.y + freeNode.h) {
                outList.push({
                    x: freeNode.x,
                    y: piece.y + piece.h,
                    w: freeNode.w,
                    h: freeNode.y + freeNode.h - (piece.y + piece.h)
                });
            }
        }

        if (piece.y < freeNode.y + freeNode.h && piece.y + piece.h > freeNode.y) {
            if (piece.x > freeNode.x && piece.x < freeNode.x + freeNode.w) {
                outList.push({
                    x: freeNode.x,
                    y: freeNode.y,
                    w: piece.x - freeNode.x,
                    h: freeNode.h
                });
            }
            if (piece.x + piece.w < freeNode.x + freeNode.w) {
                outList.push({
                    x: piece.x + piece.w,
                    y: freeNode.y,
                    w: freeNode.x + freeNode.w - (piece.x + piece.w),
                    h: freeNode.h
                });
            }
        }
    }

    /**
     * Elimina rectángulos contenidos en otros conservando una única copia cuando dos rectángulos son idénticos.
     */
    private pruneFreeRects(rects: FreeRect[]): FreeRect[] {
        const filtered: FreeRect[] = [];
        for (let i = 0; i < rects.length; i++) {
            const r1 = rects[i];
            if (r1.w <= 5 || r1.h <= 5) continue;
            let isContained = false;
            for (let j = 0; j < rects.length; j++) {
                if (i === j) continue;
                const r2 = rects[j];
                if (r1.x === r2.x && r1.y === r2.y && r1.w === r2.w && r1.h === r2.h) {
                    if (i > j) {
                        isContained = true;
                        break;
                    }
                    continue;
                }
                if (r1.x >= r2.x && r1.y >= r2.y &&
                    r1.x + r1.w <= r2.x + r2.w &&
                    r1.y + r1.h <= r2.y + r2.h) {
                    isContained = true;
                    break;
                }
            }
            if (!isContained) {
                filtered.push(r1);
            }
        }
        return filtered;
    }

    maxFreeAreaMm2(): number {
        let m = 0;
        for (const r of this.freeRects) {
            const a = r.w * r.h;
            if (a > m) m = a;
        }
        return m;
    }

    /**
     * Calcula los rectángulos sobrantes disjuntos exactos (sin solapamientos) mediante partición guillotina limpia.
     */
    getDisjointWasteRects(): FreeRect[] {
        const usableW = Math.max(50, this.binWidth - 2 * this.trim);
        const usableH = Math.max(50, this.binHeight - 2 * this.trim);
        let disjoint: FreeRect[] = [{ x: this.trim, y: this.trim, w: usableW, h: usableH }];

        for (const box of this.occupiedBoxes) {
            const next: FreeRect[] = [];
            for (const wr of disjoint) {
                const ix1 = Math.max(wr.x, box.x);
                const iy1 = Math.max(wr.y, box.y);
                const ix2 = Math.min(wr.x + wr.w, box.x + box.w);
                const iy2 = Math.min(wr.y + wr.h, box.y + box.h);

                if (ix1 >= ix2 || iy1 >= iy2) {
                    next.push(wr);
                    continue;
                }

                // Partición A: bandas horizontales completas arriba/abajo
                const optA: FreeRect[] = [];
                if (iy1 > wr.y) optA.push({ x: wr.x, y: wr.y, w: wr.w, h: iy1 - wr.y });
                if (iy2 < wr.y + wr.h) optA.push({ x: wr.x, y: iy2, w: wr.w, h: (wr.y + wr.h) - iy2 });
                if (ix1 > wr.x) optA.push({ x: wr.x, y: iy1, w: ix1 - wr.x, h: iy2 - iy1 });
                if (ix2 < wr.x + wr.w) optA.push({ x: ix2, y: iy1, w: (wr.x + wr.w) - ix2, h: iy2 - iy1 });

                // Partición B: bandas verticales completas izquierda/derecha
                const optB: FreeRect[] = [];
                if (ix1 > wr.x) optB.push({ x: wr.x, y: wr.y, w: ix1 - wr.x, h: wr.h });
                if (ix2 < wr.x + wr.w) optB.push({ x: ix2, y: wr.y, w: (wr.x + wr.w) - ix2, h: wr.h });
                if (iy1 > wr.y) optB.push({ x: ix1, y: wr.y, w: ix2 - ix1, h: iy1 - wr.y });
                if (iy2 < wr.y + wr.h) optB.push({ x: ix1, y: iy2, w: ix2 - ix1, h: (wr.y + wr.h) - iy2 });

                const maxA = optA.reduce((m, r) => Math.max(m, r.w * r.h), 0);
                const maxB = optB.reduce((m, r) => Math.max(m, r.w * r.h), 0);
                const chosen = maxA >= maxB ? optA : optB;
                for (const c of chosen) {
                    if (c.w > 5 && c.h > 5) next.push(c);
                }
            }
            disjoint = this.mergeAdjacentRects(next);
        }

        return disjoint.filter(r => r.w >= 35 && r.h >= 35);
    }

    private mergeAdjacentRects(rects: FreeRect[]): FreeRect[] {
        const list = [...rects];
        let merged = true;
        while (merged) {
            merged = false;
            for (let i = 0; i < list.length && !merged; i++) {
                for (let j = i + 1; j < list.length && !merged; j++) {
                    const a = list[i];
                    const b = list[j];
                    if (a.y === b.y && a.h === b.h && (a.x + a.w === b.x || b.x + b.w === a.x)) {
                        const nx = Math.min(a.x, b.x);
                        list[i] = { x: nx, y: a.y, w: a.w + b.w, h: a.h };
                        list.splice(j, 1);
                        merged = true;
                    } else if (a.x === b.x && a.w === b.w && (a.y + a.h === b.y || b.y + b.h === a.y)) {
                        const ny = Math.min(a.y, b.y);
                        list[i] = { x: a.x, y: ny, w: a.w, h: a.h + b.h };
                        list.splice(j, 1);
                        merged = true;
                    }
                }
            }
        }
        return list;
    }

    toCutSheet(index: number): CutSheet {
        const sheetAreaMm2 = this.binWidth * this.binHeight;
        const sheetAreaM2 = Number((sheetAreaMm2 / 1000000).toFixed(4));
        const wasteRects = this.getDisjointWasteRects();

        // Si no quedan retazos libres reales y las piezas nominales cubren el tablero (solo polvo de sierra), aprovechamiento = 100%
        const effectiveMm2 = wasteRects.length === 0 && this.nominalAreaMm2 >= sheetAreaMm2 * 0.996
            ? sheetAreaMm2
            : Math.min(sheetAreaMm2, this.usedAreaMm2);

        const usedAreaM2 = Number((effectiveMm2 / 1000000).toFixed(4));
        const efficiencyPercent = sheetAreaM2 > 0
            ? Math.min(100, Number(((effectiveMm2 / sheetAreaMm2) * 100).toFixed(1)))
            : 0;
        const wasteAreaM2 = wasteRects.length === 0 && efficiencyPercent >= 99.9
            ? 0
            : Math.max(0, Number((sheetAreaM2 - usedAreaM2).toFixed(4)));
        const wastePercent = wasteAreaM2 === 0
            ? 0
            : Math.max(0, Number((100 - efficiencyPercent).toFixed(1)));

        return {
            sheetIndex: index,
            material: this.material || 'Tablero Comercial',
            thicknessMm: this.thicknessMm,
            sheetWidth: this.binWidth,
            sheetHeight: this.binHeight,
            placedPieces: this.placedPieces,
            usedAreaM2,
            sheetAreaM2,
            efficiencyPercent,
            wasteAreaM2,
            wastePercent,
            freeRects: wasteRects
        };
    }
}

/**
 * Subdivide una pieza en una grilla ortogonal de pasos máximos (stepW × stepH).
 */
function splitPieceByGrid(p: ModularPiece, stepW: number, stepH: number): ModularPiece[] {
    const cols = Math.max(1, Math.ceil((p.width - 1) / stepW));
    const rows = Math.max(1, Math.ceil((p.height - 1) / stepH));
    const totalParts = cols * rows;
    if (totalParts === 1) {
        return [{
            ...p,
            width: Math.min(p.width, stepW),
            height: Math.min(p.height, stepH)
        }];
    }

    const result: ModularPiece[] = [];
    let remH = p.height;
    let py = 1;
    while (remH > 0.5) {
        const curH = Math.round(Math.min(remH, stepH));
        let remW = p.width;
        let px = 1;
        while (remW > 0.5) {
            const curW = Math.round(Math.min(remW, stepW));
            const idx = (py - 1) * cols + px;
            const wM = Number((curW / 1000).toFixed(2));
            const hM = Number((curH / 1000).toFixed(2));
            result.push({
                ...p,
                id: `${p.id}-P${idx}`,
                width: curW,
                height: curH,
                widthM: wM,
                heightM: hM,
                dimensionsLabelM: `${wM.toFixed(2)} × ${hM.toFixed(2)} m`,
                areaM2: Number(((curW * curH) / 1000000).toFixed(4)),
                isSplit: true,
                partIndex: idx,
                totalParts,
                hasArcCutout: Boolean(p.hasArcCutout && py === 1 && px === 1),
                arcRadiusMm: p.arcRadiusMm
            });
            remW -= curW;
            px++;
        }
        remH -= curH;
        py++;
    }
    return result;
}

/**
 * Modula el conjunto de muros según la orientación candidata para tableros menores al muro.
 * Si un muro cabe íntegro en la lámina (normal o rotado), NUNCA se subdivide.
 */
function modulatePiecesForSheet(
    pieces: ModularPiece[],
    usableW: number,
    usableH: number,
    allowRot: boolean,
    mode: 'LANDSCAPE' | 'PORTRAIT' | 'SMART'
): ModularPiece[] {
    const tol = 2; // 2mm de tolerancia numérica para ajuste exacto a borde de tablero
    const out: ModularPiece[] = [];

    for (const p of pieces) {
        const fitsNormal = (p.width <= usableW + tol) && (p.height <= usableH + tol);
        const fitsRotated = allowRot && (p.width <= usableH + tol) && (p.height <= usableW + tol);

        if (fitsNormal || fitsRotated) {
            const wAdj = fitsNormal ? Math.min(p.width, usableW) : Math.min(p.width, usableH);
            const hAdj = fitsNormal ? Math.min(p.height, usableH) : Math.min(p.height, usableW);
            out.push({
                ...p,
                width: wAdj,
                height: hAdj,
                isSplit: false
            });
            continue;
        }

        const landscapeParts = splitPieceByGrid(p, usableW, usableH);
        if (!allowRot || usableW === usableH) {
            out.push(...landscapeParts);
            continue;
        }

        const portraitParts = splitPieceByGrid(p, usableH, usableW);
        if (mode === 'LANDSCAPE') {
            out.push(...landscapeParts);
        } else if (mode === 'PORTRAIT') {
            out.push(...portraitParts);
        } else {
            if (portraitParts.length !== landscapeParts.length) {
                out.push(...(portraitParts.length < landscapeParts.length ? portraitParts : landscapeParts));
            } else {
                const minAreaL = Math.min(...landscapeParts.map(x => x.width * x.height));
                const minAreaP = Math.min(...portraitParts.map(x => x.width * x.height));
                out.push(...(minAreaP <= minAreaL ? portraitParts : landscapeParts));
            }
        }
    }

    return out;
}

/**
 * Re-enumera secuencialmente partIndex / totalParts por elemento original cuando hubo subdivisión.
 */
function reindexSplitParts(pieces: ModularPiece[]): ModularPiece[] {
    const counts = new Map<string, number>();
    for (const p of pieces) {
        const key = String(p.expressID || String(p.id).split('-P')[0]);
        counts.set(key, (counts.get(key) || 0) + 1);
    }

    const seen = new Map<string, number>();
    return pieces.map(p => {
        const key = String(p.expressID || String(p.id).split('-P')[0]);
        const total = counts.get(key) || 1;
        if (total <= 1) {
            return { ...p, isSplit: false, partIndex: undefined, totalParts: undefined };
        }
        const nextIdx = (seen.get(key) || 0) + 1;
        seen.set(key, nextIdx);
        return {
            ...p,
            id: `${key}-P${nextIdx}`,
            isSplit: true,
            partIndex: nextIdx,
            totalParts: total
        };
    });
}

/**
 * Ejecuta múltiples heurísticas y órdenes de empaquetamiento MaxRects y selecciona la solución óptima
 * (menor número de láminas comerciales y mayor bloque sobrante continuo reutilizable).
 */
function packGroupMultiStrategy(
    groupPieces: ModularPiece[],
    groupMaterial: string,
    groupThickness: number,
    sheetW: number,
    sheetH: number,
    kerf: number,
    trim: number,
    allowRot: boolean,
    getPieceColor: (p: ModularPiece) => string
): MaxRectsSheet[] {
    const fitTol = Math.min(6, Math.max(1, kerf + 1));

    const sorters: Array<(a: ModularPiece, b: ModularPiece) => number> = [
        (a, b) => (b.width * b.height) - (a.width * a.height) || Math.max(b.width, b.height) - Math.max(a.width, a.height),
        (a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height) || (b.width * b.height) - (a.width * a.height),
        (a, b) => Math.min(b.width, b.height) - Math.min(a.width, a.height) || Math.max(b.width, b.height) - Math.max(a.width, a.height),
        (a, b) => (2 * (b.width + b.height)) - (2 * (a.width + a.height)) || (b.width * b.height) - (a.width * a.height)
    ];
    const heuristics: MaxRectsHeuristic[] = ['BSSF', 'BAF', 'BLSF', 'BL'];

    let bestBins: MaxRectsSheet[] | null = null;
    let bestTailFreeArea = -1;

    for (const sorter of sorters) {
        for (const heuristic of heuristics) {
            const pending = [...groupPieces].sort(sorter);
            const activeBins: MaxRectsSheet[] = [];
            let localOrder = 1;

            while (pending.length > 0) {
                let bestBinIdx = -1;
                let bestPieceIdx = -1;
                let bestFitData: { bestRectIdx: number; bestScore: number; rotated: boolean } | null = null;
                let bestGlobalScore = Infinity;

                for (let b = 0; b < activeBins.length; b++) {
                    const bin = activeBins[b];
                    for (let p = 0; p < pending.length; p++) {
                        const piece = pending[p];
                        const fit = bin.findBestFit(piece.width, piece.height, allowRot, heuristic, fitTol);
                        if (fit && fit.bestScore < bestGlobalScore) {
                            bestGlobalScore = fit.bestScore;
                            bestBinIdx = b;
                            bestPieceIdx = p;
                            bestFitData = fit;
                        }
                    }
                }

                if (bestBinIdx !== -1 && bestPieceIdx !== -1 && bestFitData) {
                    const targetBin = activeBins[bestBinIdx];
                    const piece = pending.splice(bestPieceIdx, 1)[0];
                    const targetRect = targetBin.freeRects[bestFitData.bestRectIdx];
                    const pw = bestFitData.rotated ? piece.height : piece.width;
                    const ph = bestFitData.rotated ? piece.width : piece.height;
                    targetBin.placePiece(piece, pw, ph, targetRect, bestFitData.rotated, getPieceColor(piece), localOrder++, kerf);
                } else {
                    const newBin = new MaxRectsSheet(
                        activeBins.length + 1,
                        groupMaterial,
                        groupThickness,
                        sheetW,
                        sheetH,
                        trim
                    );
                    const piece = pending.shift()!;
                    const initialFit = newBin.findBestFit(piece.width, piece.height, allowRot, heuristic, fitTol);
                    if (initialFit) {
                        const targetRect = newBin.freeRects[initialFit.bestRectIdx];
                        const pw = initialFit.rotated ? piece.height : piece.width;
                        const ph = initialFit.rotated ? piece.width : piece.height;
                        newBin.placePiece(piece, pw, ph, targetRect, initialFit.rotated, getPieceColor(piece), localOrder++, kerf);
                    }
                    activeBins.push(newBin);
                }
            }

            const tailFree = activeBins.length > 0 ? activeBins[activeBins.length - 1].maxFreeAreaMm2() : 0;
            if (
                !bestBins ||
                activeBins.length < bestBins.length ||
                (activeBins.length === bestBins.length && tailFree > bestTailFreeArea)
            ) {
                bestBins = activeBins;
                bestTailFreeArea = tailFree;
            }
        }
    }

    return bestBins || [];
}

/**
 * Algoritmo 2D MaxRects Cutting Stock / Bin Packing Industrial con modulación adaptativa
 * y aprovechamiento automático de retazos para cualquier tamaño de lámina comercial.
 */
export function optimizeSheetCutting(
    pieces: ModularPiece[],
    sheetW: number,
    sheetH: number,
    kerf: number = 3,
    trim: number = 0,
    allowRot: boolean = true
): CutSheet[] {
    if (!pieces || pieces.length === 0) return [];

    const usableW = Math.max(100, sheetW - 2 * trim);
    const usableH = Math.max(100, sheetH - 2 * trim);
    const minDim = Math.min(usableW, usableH);

    // 1. Agrupación inteligente por material compatible (sin fragmentar muros genéricos por espesores internos)
    const materialGroups = new Map<string, ModularPiece[]>();
    pieces.forEach(p => {
        const cleanMat = normalizeMaterialLabel(p.material);
        const upper = cleanMat.toUpperCase();
        let groupKey = 'Tablero Comercial';
        if (upper.includes('2.5') || upper.includes('2,5')) {
            groupKey = 'MDF 2.5 mm';
        } else if (upper.includes('18')) {
            groupKey = 'MDF 18 mm';
        } else if (upper.includes('15')) {
            groupKey = 'MDF 15 mm';
        } else if (upper.includes('12')) {
            groupKey = 'MDF 12 mm';
        } else if (cleanMat !== 'Tablero Comercial' && !upper.includes('GENÉRICO') && !upper.includes('GENERICO')) {
            groupKey = cleanMat;
        }

        if (!materialGroups.has(groupKey)) {
            materialGroups.set(groupKey, []);
        }
        materialGroups.get(groupKey)!.push({ ...p, material: groupKey });
    });

    // Color consistente y único por elemento original (expressID)
    const elementColorMap = new Map<number, string>();
    pieces.forEach(p => {
        const idNum = Number(p.expressID || p.id);
        if (!elementColorMap.has(idNum)) {
            elementColorMap.set(idNum, PIECE_COLORS[elementColorMap.size % PIECE_COLORS.length]);
        }
    });
    const getPieceColor = (p: ModularPiece): string => {
        const idNum = Number(p.expressID || String(p.id).split('-P')[0]);
        if (!elementColorMap.has(idNum)) {
            elementColorMap.set(idNum, PIECE_COLORS[elementColorMap.size % PIECE_COLORS.length]);
        }
        return elementColorMap.get(idNum)!;
    };

    const finalSheets: CutSheet[] = [];
    let globalSheetCounter = 1;
    let globalOrderCounter = 1;

    // 2. Optimizar cada grupo evaluando orientaciones de modulación + cosecha de retazos
    for (const [groupMaterial, rawGroupPieces] of materialGroups.entries()) {
        const groupThickness = rawGroupPieces[0].thicknessMm;
        const totalRawAreaMm2 = rawGroupPieces.reduce((s, p) => s + p.width * p.height, 0);
        const minTheoreticalSheets = Math.max(1, Math.ceil((totalRawAreaMm2 * 0.995) / (usableW * usableH)));

        const candidateModes: Array<'LANDSCAPE' | 'PORTRAIT' | 'SMART'> = allowRot
            ? ['SMART', 'PORTRAIT', 'LANDSCAPE']
            : ['LANDSCAPE'];

        let winnerBins: MaxRectsSheet[] | null = null;
        let winnerPieceCount = Infinity;

        for (const mode of candidateModes) {
            let modPieces = reindexSplitParts(modulatePiecesForSheet(rawGroupPieces, usableW, usableH, allowRot, mode));
            let bins = packGroupMultiStrategy(modPieces, groupMaterial, groupThickness, sheetW, sheetH, kerf, trim, allowRot, getPieceColor);

            // Cosecha iterativa de retazos (Offcut Harvesting):
            // Si la última lámina quedó subutilizada y existen retazos libres en láminas previas,
            // probar subdividir las tiras de la última lámina a minDim SOLO SI eso ahorra láminas completas.
            let harvestIter = 0;
            while (bins.length > minTheoreticalSheets && harvestIter < 2) {
                harvestIter++;
                const tailBin = bins[bins.length - 1];
                const tailRefs = new Set(tailBin.placedPieces.map(pp => pp.piece));
                let anySubdivided = false;

                const refined: ModularPiece[] = [];
                for (const mp of modPieces) {
                    if (!tailRefs.has(mp)) {
                        refined.push(mp);
                        continue;
                    }
                    const longSide = Math.max(mp.width, mp.height);
                    if (longSide > minDim + 2) {
                        anySubdivided = true;
                        const sub = mp.width >= mp.height
                            ? splitPieceByGrid(mp, minDim, mp.height)
                            : splitPieceByGrid(mp, mp.width, minDim);
                        refined.push(...sub);
                    } else {
                        refined.push(mp);
                    }
                }

                if (!anySubdivided) break;
                const reindexed = reindexSplitParts(refined);
                const nextBins = packGroupMultiStrategy(reindexed, groupMaterial, groupThickness, sheetW, sheetH, kerf, trim, allowRot, getPieceColor);
                if (nextBins.length < bins.length) {
                    modPieces = reindexed;
                    bins = nextBins;
                } else {
                    break;
                }
            }

            const totalPlacedCount = bins.reduce((sum, b) => sum + b.placedPieces.length, 0);
            if (
                !winnerBins ||
                bins.length < winnerBins.length ||
                (bins.length === winnerBins.length && totalPlacedCount < winnerPieceCount)
            ) {
                winnerBins = bins;
                winnerPieceCount = totalPlacedCount;
            }

            if (winnerBins.length === minTheoreticalSheets && winnerPieceCount === rawGroupPieces.length) {
                break; // Óptimo matemático absoluto alcanzado sin subdividir ninguna pieza
            }
        }

        if (winnerBins) {
            for (const bin of winnerBins) {
                // Numeración global secuencial de cada corte (#1, #2, #3...) a lo largo de las láminas
                for (const pp of bin.placedPieces) {
                    pp.orderIndex = globalOrderCounter++;
                }
                finalSheets.push(bin.toCutSheet(globalSheetCounter++));
            }
        }
    }

    return finalSheets;
}

/**
 * Genera el SVG interactivo de alta precisión para representar el plano de corte de la lámina.
 * Todos los textos están escapados y escalados proporcionalmente al tamaño de la lámina.
 */
export function generateSheetSvg(sheet: CutSheet): string {
    const baseScale = Math.max(sheet.sheetWidth, sheet.sheetHeight, 1000);
    const marginLeft = Math.round(baseScale * 0.044);
    const marginTop = Math.round(baseScale * 0.044);
    const marginRight = Math.round(baseScale * 0.02);
    const marginBottom = Math.round(baseScale * 0.02);

    const svgWidth = sheet.sheetWidth + marginLeft + marginRight;
    const svgHeight = sheet.sheetHeight + marginTop + marginBottom;
    const strokeBoard = Math.max(3, Math.round(baseScale * 0.0018));
    const strokePiece = Math.max(2, Math.round(baseScale * 0.0012));
    const dimFontSize = Math.max(24, Math.round(baseScale * 0.024));
    const patternStep = Math.max(20, Math.round(baseScale * 0.012));

    const svg = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="q-despiece-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <pattern id="wastePattern-${sheet.sheetIndex}" width="${patternStep}" height="${patternStep}" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="${patternStep}" stroke="#cbd5e1" stroke-width="${Math.max(2, Math.round(patternStep * 0.12))}" />
            </pattern>
        </defs>

        <g transform="translate(${marginLeft}, ${marginTop})">
            <!-- Tablero Comercial Base -->
            <rect x="0" y="0" width="${sheet.sheetWidth}" height="${sheet.sheetHeight}"
                  fill="#fffdf5" stroke="#b45309" stroke-width="${strokeBoard}" rx="4" />

            <!-- Retazos Sobrantes Disjuntos -->
            ${sheet.freeRects.map(r => {
                const labelText = `Sobrante: ${(r.w / 1000).toFixed(2)} × ${(r.h / 1000).toFixed(2)} m`;
                const rotWaste = r.h > r.w * 1.7 && r.w < baseScale * 0.22;
                const availW = rotWaste ? r.h : r.w;
                const availH = rotWaste ? r.w : r.h;
                const wFont = Math.round(Math.min(
                    baseScale * 0.024,
                    (availW * 0.85) / (labelText.length * 0.56),
                    availH * 0.45
                ));
                const showWasteText = wFont >= Math.round(baseScale * 0.011) && availW >= 160 && availH >= 70;
                const cx = r.x + r.w / 2;
                const cy = r.y + r.h / 2;
                return `
                <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"
                      fill="url(#wastePattern-${sheet.sheetIndex})" stroke="#94a3b8" stroke-dasharray="6,5" stroke-width="${Math.max(1.5, strokePiece * 0.8)}" />
                ${showWasteText ? `
                    <text x="${cx}" y="${cy}"
                          ${rotWaste ? `transform="rotate(-90, ${cx}, ${cy})"` : ''}
                          text-anchor="middle" dominant-baseline="middle"
                          font-size="${wFont}"
                          fill="#475569" font-weight="700" font-family="sans-serif">
                        ${labelText}
                    </text>
                ` : ''}
                `;
            }).join('')}

            <!-- Piezas / Cortes Colocados -->
            ${sheet.placedPieces.map(p => {
                const safeName = escapeDespieceHtml(p.piece.name);
                const safeTag = escapeDespieceHtml(p.piece.tag);
                const safeLevel = escapeDespieceHtml(p.piece.level);
                const safeMat = escapeDespieceHtml(p.piece.material);
                const safeId = escapeDespieceHtml(p.piece.expressID || p.piece.id);

                const isArc = Boolean(p.piece.hasArcCutout && p.piece.arcRadiusMm && p.piece.arcRadiusMm > 50);
                const r = isArc ? Math.min(p.piece.arcRadiusMm!, Math.min(p.w, p.h) * 0.45) : 0;

                const tooltip = `${safeName}&#10;Corte #${p.orderIndex}&#10;Medidas: ${(p.w / 1000).toFixed(2)} × ${(p.h / 1000).toFixed(2)} m${p.rotated ? ' (Rotado 90°)' : ''}&#10;Nivel: ${safeLevel}&#10;Tag: ${safeTag}&#10;Material: ${safeMat}${p.piece.isSplit ? `&#10;Módulo ${p.piece.partIndex || 1} de ${p.piece.totalParts || 2}` : ''}`;

                let shapeSvg = '';
                if (isArc && r > 20) {
                    if (p.w >= p.h) {
                        const cx = p.x + p.w / 2;
                        shapeSvg = `
                        <path d="M ${p.x} ${p.y}
                                 L ${cx - r} ${p.y}
                                 A ${r} ${r} 0 0 0 ${cx + r} ${p.y}
                                 L ${p.x + p.w} ${p.y}
                                 L ${p.x + p.w} ${p.y + p.h}
                                 L ${p.x} ${p.y + p.h} Z"
                              fill="${p.color}" fill-opacity="0.90"
                              stroke="#0f172a" stroke-width="${strokePiece}"
                              class="q-despiece-piece-rect"
                              data-id="${safeId}">
                            <title>${tooltip}</title>
                        </path>
                        <path d="M ${cx - r} ${p.y} A ${r} ${r} 0 0 1 ${cx + r} ${p.y}"
                              fill="none" stroke="#dc2626" stroke-width="${strokePiece}" stroke-dasharray="5,4" />
                        `;
                    } else {
                        const cy = p.y + p.h / 2;
                        shapeSvg = `
                        <path d="M ${p.x} ${p.y}
                                 L ${p.x + p.w} ${p.y}
                                 L ${p.x + p.w} ${cy - r}
                                 A ${r} ${r} 0 0 0 ${p.x + p.w} ${cy + r}
                                 L ${p.x + p.w} ${p.y + p.h}
                                 L ${p.x} ${p.y + p.h} Z"
                              fill="${p.color}" fill-opacity="0.90"
                              stroke="#0f172a" stroke-width="${strokePiece}"
                              class="q-despiece-piece-rect"
                              data-id="${safeId}">
                            <title>${tooltip}</title>
                        </path>
                        <path d="M ${p.x + p.w} ${cy - r} A ${r} ${r} 0 0 1 ${p.x + p.w} ${cy + r}"
                              fill="none" stroke="#dc2626" stroke-width="${strokePiece}" stroke-dasharray="5,4" />
                        `;
                    }
                } else {
                    shapeSvg = `
                    <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"
                          fill="${p.color}" fill-opacity="0.90"
                          stroke="#0f172a" stroke-width="${strokePiece}" rx="3"
                          class="q-despiece-piece-rect"
                          data-id="${safeId}">
                        <title>${tooltip}</title>
                    </rect>
                    `;
                }

                const line1 = `#${p.orderIndex} ${safeTag}${p.piece.isSplit ? ` [P${p.piece.partIndex || 1}/${p.piece.totalParts || 2}]` : ''}`;
                const line2 = `${(p.w / 1000).toFixed(2)} × ${(p.h / 1000).toFixed(2)} m${p.rotated ? ' ⟳' : ''}`;

                const rotateText = p.h > p.w * 1.55 && p.w < baseScale * 0.24;
                const availW = rotateText ? p.h : p.w;
                const availH = rotateText ? p.w : p.h;
                const maxChars = Math.max(line1.length, line2.length, 6);

                const maxFont = Math.round(baseScale * 0.036);
                const fontByW = (availW * 0.86) / (maxChars * 0.57);
                const fontByH2 = (availH * 0.78) / 2.35;
                const twoLineFont = Math.round(Math.min(maxFont, fontByW, fontByH2));

                const cx = p.x + p.w / 2;
                const cy = p.y + p.h / 2;
                const rotAttr = rotateText ? `transform="rotate(-90, ${cx}, ${cy})"` : '';

                let labelSvg = '';
                if (twoLineFont >= Math.round(baseScale * 0.013) && availW >= 110 && availH >= 65) {
                    const subFont = Math.max(Math.round(baseScale * 0.011), Math.round(twoLineFont * 0.82));
                    labelSvg = `
                    <g ${rotAttr}>
                        <text x="${cx}" y="${cy - twoLineFont * 0.58}"
                              text-anchor="middle" dominant-baseline="middle"
                              font-size="${twoLineFont}" fill="#0f172a"
                              class="q-despiece-piece-label" font-weight="800">
                            ${line1}
                        </text>
                        <text x="${cx}" y="${cy + twoLineFont * 0.68}"
                              text-anchor="middle" dominant-baseline="middle"
                              font-size="${subFont}" fill="#1e293b"
                              class="q-despiece-piece-label" font-weight="700">
                            ${line2}
                        </text>
                    </g>
                    `;
                } else if (availW >= 55 && availH >= 35) {
                    const compactText = `#${p.orderIndex}`;
                    const oneLineFont = Math.round(Math.min(maxFont * 0.85, availH * 0.68, (availW * 0.82) / (compactText.length * 0.62)));
                    if (oneLineFont >= 12) {
                        labelSvg = `
                        <g ${rotAttr}>
                            <text x="${cx}" y="${cy}"
                                  text-anchor="middle" dominant-baseline="middle"
                                  font-size="${oneLineFont}" fill="#0f172a"
                                  class="q-despiece-piece-label" font-weight="800">
                                ${compactText}
                            </text>
                        </g>
                        `;
                    }
                }

                return `
                <g class="q-despiece-piece-group" data-id="${safeId}">
                    ${shapeSvg}
                    ${labelSvg}
                </g>
                `;
            }).join('')}

            <!-- Cotas exteriores de la Lámina Comercial -->
            <text x="${sheet.sheetWidth / 2}" y="${-Math.round(marginTop * 0.34)}"
                  text-anchor="middle" dominant-baseline="middle"
                  font-size="${dimFontSize}" font-weight="800" fill="#78350f" font-family="sans-serif">
                Largo Comercial: ${(sheet.sheetWidth / 1000).toFixed(2)} m
            </text>
            <text x="${-Math.round(marginLeft * 0.36)}" y="${sheet.sheetHeight / 2}"
                  text-anchor="middle" dominant-baseline="middle"
                  transform="rotate(-90, ${-Math.round(marginLeft * 0.36)}, ${sheet.sheetHeight / 2})"
                  font-size="${dimFontSize}" font-weight="800" fill="#78350f" font-family="sans-serif">
                Ancho Comercial: ${(sheet.sheetHeight / 1000).toFixed(2)} m
            </text>
        </g>
    </svg>
    `;

    return svg;
}
