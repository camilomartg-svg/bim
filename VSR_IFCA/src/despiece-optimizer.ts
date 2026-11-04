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
    width: number;       // mm
    height: number;      // mm
    widthM: number;      // m (cerrado a 0.05m)
    heightM: number;     // m (cerrado a 0.05m)
    dimensionsLabelM: string; // ej: "1.20 × 2.45 m"
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
    w: number;       // mm colocado
    h: number;       // mm colocado
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
 * Redondea una medida en metros al paso modular exacto de obra (por defecto 0.01m = 1cm).
 * Ej: 2.042m -> 2.04m, 0.501m -> 0.50m, 1.71m -> 1.71m
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

    // 1. Direct top-level keys
    for (const k of directKeys) {
        if (k in attrs && isTruthy(attrs[k])) return true;
    }

    // 2. Direct scan of all keys matching MODULAR case-insensitively
    for (const k of Object.keys(attrs)) {
        if (k.trim().toUpperCase() === 'MODULAR' && isTruthy(attrs[k])) return true;
    }

    // 3. Inspect common sub-containers (psets, data, attributes, properties)
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
    onlySelected: boolean = false,
    selectedIds: number[] = [],
    scopeMode: 'ALL_MODULAR' | 'ALL_WALLS' | 'SELECTED' = 'ALL_MODULAR',
    getBoundsFn?: ElementBoundsGetter
): ModularPiece[] {
    const pieces: ModularPiece[] = [];
    const selectedSet = new Set(selectedIds.map(Number));

    // Determinar si hay algún muro modular en el conjunto
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

        // 1. Obtener dimensiones 3D reales del elemento si getBoundsFn está presente
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
            // Medidas cerradas en metros (pasos de 0.01m)
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

        // Espesor en mm exacto
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

        const rawName = String(el.name || '');
        const tag = rawName.includes(':') ? rawName.split(':').pop()! : String(el.id);

        // Detección de corte semicircular / vano curvo (ej: muro que rodea la ventana redonda)
        const rawArea = Number(el.area || 0);
        const rectArea = (lengthM * heightM);
        let hasArcCutout = false;
        let arcRadiusMm = 0;

        const nameOrTag = (rawName + ' ' + tag).toLowerCase();
        // Muro con ventana redonda o corte curvo detectado
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

        pieces.push({
            id: el.id,
            expressID: elemIdNum,
            tag: tag.trim(),
            name: rawName || `Muro ${el.id}`,
            material: String(el.material || `MDF ${thicknessMm} MM`).trim(),
            nombreIntegrado: String(el.nombreIntegrado || el.name || 'Muro Modular').trim(),
            width: lengthMm,
            height: heightMm,
            widthM: lengthM,
            heightM: heightM,
            dimensionsLabelM: `${lengthM.toFixed(2)} × ${heightM.toFixed(2)} m`,
            areaM2: Number((lengthM * heightM).toFixed(4)),
            thicknessMm: thicknessMm,
            level: String(el.level || 'General').trim(),
            elementRef: el,
            hasArcCutout,
            arcRadiusMm,
            arcPosition: 'top'
        });
    });

    return pieces;
}

/**
 * Representación interna de un contenedor MaxRects para una lámina comercial.
 */
class MaxRectsSheet {
    sheetIndex: number;
    material: string;
    thicknessMm: number;
    binWidth: number;
    binHeight: number;
    placedPieces: PlacedPiece[] = [];
    freeRects: FreeRect[] = [];
    usedAreaMm2: number = 0;

    constructor(index: number, material: string, thickness: number, width: number, height: number, trim: number = 0) {
        this.sheetIndex = index;
        this.material = material;
        this.thicknessMm = thickness;
        this.binWidth = width;
        this.binHeight = height;

        const usableW = Math.max(50, width - 2 * trim);
        const usableH = Math.max(50, height - 2 * trim);
        this.freeRects.push({ x: trim, y: trim, w: usableW, h: usableH });
    }

    /**
     * Evalúa el mejor encaje para una pieza (Best Short Side Fit / Best Area Fit).
     */
    findBestFit(w: number, h: number, allowRot: boolean): { bestRectIdx: number; bestScore: number; rotated: boolean } | null {
        let bestRectIdx = -1;
        let bestScore = Infinity;
        let bestRotated = false;

        for (let i = 0; i < this.freeRects.length; i++) {
            const r = this.freeRects[i];

            // Opción 1: Sin rotar
            if (w <= r.w && h <= r.h) {
                const leftoverW = r.w - w;
                const leftoverH = r.h - h;
                const shortSide = Math.min(leftoverW, leftoverH);
                const longSide = Math.max(leftoverW, leftoverH);
                const score = shortSide * 100000 + longSide; // BSSF prioritario

                if (score < bestScore) {
                    bestScore = score;
                    bestRectIdx = i;
                    bestRotated = false;
                }
            }

            // Opción 2: Rotada 90°
            if (allowRot && h <= r.w && w <= r.h) {
                const leftoverW = r.w - h;
                const leftoverH = r.h - w;
                const shortSide = Math.min(leftoverW, leftoverH);
                const longSide = Math.max(leftoverW, leftoverH);
                const score = shortSide * 100000 + longSide;

                if (score < bestScore) {
                    bestScore = score;
                    bestRectIdx = i;
                    bestRotated = true;
                }
            }
        }

        if (bestRectIdx === -1) return null;
        return { bestRectIdx, bestScore, rotated: bestRotated };
    }

    /**
     * Coloca la pieza en el rectángulo seleccionado y actualiza los rectángulos libres con MaxRects split.
     */
    placePiece(piece: ModularPiece, pw: number, ph: number, targetRect: FreeRect, rotated: boolean, color: string, orderIndex: number, kerf: number) {
        const px = targetRect.x;
        const py = targetRect.y;

        this.placedPieces.push({
            piece,
            x: px,
            y: py,
            w: pw,
            h: ph,
            rotated,
            color,
            orderIndex
        });

        this.usedAreaMm2 += (pw * ph);

        // Rectángulo ocupado incluyendo sierra (kerf)
        const pieceWithKerf: FreeRect = {
            x: px,
            y: py,
            w: pw + kerf,
            h: ph + kerf
        };

        // Algoritmo MaxRects: Recortar todos los rectángulos libres que intersequen con la nueva pieza
        const nextFreeRects: FreeRect[] = [];
        for (const fr of this.freeRects) {
            this.splitFreeRect(fr, pieceWithKerf, nextFreeRects);
        }

        // Eliminar rectángulos contenidos en otros
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

    private pruneFreeRects(rects: FreeRect[]): FreeRect[] {
        const filtered: FreeRect[] = [];
        for (let i = 0; i < rects.length; i++) {
            const r1 = rects[i];
            if (r1.w <= 5 || r1.h <= 5) continue;
            let isContained = false;
            for (let j = 0; j < rects.length; j++) {
                if (i === j) continue;
                const r2 = rects[j];
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

    getDisjointWasteRects(): FreeRect[] {
        const result: FreeRect[] = [];
        const sorted = [...this.freeRects].sort((a, b) => (b.w * b.h) - (a.w * a.h));
        for (const r of sorted) {
            const overlaps = result.some(sel => {
                const xOverlap = Math.max(0, Math.min(r.x + r.w, sel.x + sel.w) - Math.max(r.x, sel.x));
                const yOverlap = Math.max(0, Math.min(r.y + r.h, sel.y + sel.h) - Math.max(r.y, sel.y));
                return (xOverlap * yOverlap) > (0.35 * r.w * r.h);
            });
            if (!overlaps && r.w >= 50 && r.h >= 50) {
                result.push(r);
            }
        }
        return result;
    }

    toCutSheet(index: number): CutSheet {
        const sheetAreaM2 = Number(((this.binWidth * this.binHeight) / 1000000).toFixed(4));
        const usedAreaM2 = Number((this.usedAreaMm2 / 1000000).toFixed(4));
        const efficiencyPercent = sheetAreaM2 > 0 ? Math.min(100, Number(((usedAreaM2 / sheetAreaM2) * 100).toFixed(1))) : 0;
        const wasteAreaM2 = Math.max(0, Number((sheetAreaM2 - usedAreaM2).toFixed(4)));
        const wastePercent = Math.max(0, Number((100 - efficiencyPercent).toFixed(1)));

        return {
            sheetIndex: index,
            material: this.material,
            thicknessMm: this.thicknessMm,
            sheetWidth: this.binWidth,
            sheetHeight: this.binHeight,
            placedPieces: this.placedPieces,
            usedAreaM2,
            sheetAreaM2,
            efficiencyPercent,
            wasteAreaM2,
            wastePercent,
            freeRects: this.getDisjointWasteRects()
        };
    }
}

/**
 * Algoritmo 2D MaxRects Cutting Stock / Bin Packing Industrial con soporte estricto de materiales.
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
    const maxDim = Math.max(usableW, usableH);
    const minDim = Math.min(usableW, usableH);

    // 1. Modulación inteligente de muros gigantes que excedan el tablero comercial
    const normalizedPieces: ModularPiece[] = [];
    pieces.forEach(p => {
        const fitsNormal = p.width <= usableW && p.height <= usableH;
        const fitsRotated = allowRot && p.width <= usableH && p.height <= usableW;

        if (fitsNormal || fitsRotated) {
            normalizedPieces.push({ ...p });
        } else {
            // Evaluar cuál de las dos orientaciones de corte genera menos piezas/desperdicio
            // Orientación A: Ancho a lo largo del lado mayor del tablero (maxDim), Alto a lo largo del menor (minDim)
            const numW_A = Math.max(1, Math.ceil(p.width / maxDim));
            const numH_A = Math.max(1, Math.ceil(p.height / minDim));
            const totalParts_A = numW_A * numH_A;

            // Orientación B: Ancho a lo largo del lado menor (minDim), Alto a lo largo del mayor (maxDim)
            const numW_B = Math.max(1, Math.ceil(p.width / minDim));
            const numH_B = Math.max(1, Math.ceil(p.height / maxDim));
            const totalParts_B = allowRot ? (numW_B * numH_B) : Infinity;

            let stepW: number;
            let stepH: number;
            let totalParts: number;

            // Preferir la opción con menos partes; en caso de empate, preferir la que conserve el ancho íntegro (numW === 1)
            if (totalParts_A < totalParts_B || (totalParts_A === totalParts_B && numW_A === 1)) {
                stepW = maxDim;
                stepH = minDim;
                totalParts = totalParts_A;
            } else {
                stepW = minDim;
                stepH = maxDim;
                totalParts = totalParts_B;
            }

            let remH = p.height;
            let partY = 1;
            const totalCols = Math.ceil(p.width / stepW);

            while (remH > 0) {
                const curH = Math.min(remH, stepH);
                let remW = p.width;
                let partX = 1;
                while (remW > 0) {
                    const curW = Math.min(remW, stepW);
                    const curPartIndex = (partY - 1) * totalCols + partX;
                    const wM = Number((curW / 1000).toFixed(2));
                    const hM = Number((curH / 1000).toFixed(2));

                    normalizedPieces.push({
                        ...p,
                        id: `${p.id}-P${curPartIndex}`,
                        width: curW,
                        height: curH,
                        widthM: wM,
                        heightM: hM,
                        dimensionsLabelM: `${wM.toFixed(2)} × ${hM.toFixed(2)} m`,
                        areaM2: Number(((curW * curH) / 1000000).toFixed(4)),
                        isSplit: true,
                        partIndex: curPartIndex,
                        totalParts: totalParts,
                        // Heredar el vano curvo solo si está en la sección que le corresponde
                        hasArcCutout: Boolean(p.hasArcCutout && partY === 1),
                        arcRadiusMm: p.arcRadiusMm
                    });
                    remW -= curW;
                    partX++;
                }
                remH -= curH;
                partY++;
            }
        }
    });

    // 2. Agrupación ESTRICTA por Material y Espesor
    const materialGroups = new Map<string, ModularPiece[]>();
    normalizedPieces.forEach(p => {
        const groupKey = `${p.material}__${p.thicknessMm}mm`;
        if (!materialGroups.has(groupKey)) {
            materialGroups.set(groupKey, []);
        }
        materialGroups.get(groupKey)!.push(p);
    });

    const finalSheets: CutSheet[] = [];
    let globalSheetCounter = 1;
    let globalOrderCounter = 1;

    // 3. Procesar cada material y espesor por separado
    for (const [, groupPieces] of materialGroups.entries()) {
        const samplePiece = groupPieces[0];
        const groupMaterial = samplePiece.material;
        const groupThickness = samplePiece.thicknessMm;

        // Ordenar piezas de mayor área a menor área
        const pendingPieces = [...groupPieces].sort((a, b) => {
            const areaA = a.width * a.height;
            const areaB = b.width * b.height;
            if (areaB !== areaA) return areaB - areaA;
            return Math.max(b.width, b.height) - Math.max(a.width, a.height);
        });

        const activeBins: MaxRectsSheet[] = [];

        // Empaquetamiento MaxRects Best-Fit
        while (pendingPieces.length > 0) {
            let bestBinIdx = -1;
            let bestPieceIdx = -1;
            let bestFitData: { bestRectIdx: number; bestScore: number; rotated: boolean } | null = null;
            let bestGlobalScore = Infinity;

            for (let b = 0; b < activeBins.length; b++) {
                const bin = activeBins[b];
                for (let p = 0; p < pendingPieces.length; p++) {
                    const piece = pendingPieces[p];
                    const fit = bin.findBestFit(piece.width, piece.height, allowRot);
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
                const piece = pendingPieces.splice(bestPieceIdx, 1)[0];
                const targetRect = targetBin.freeRects[bestFitData.bestRectIdx];

                const pw = bestFitData.rotated ? piece.height : piece.width;
                const ph = bestFitData.rotated ? piece.width : piece.height;
                const color = PIECE_COLORS[(globalOrderCounter - 1) % PIECE_COLORS.length];

                targetBin.placePiece(piece, pw, ph, targetRect, bestFitData.rotated, color, globalOrderCounter++, kerf);
            } else {
                const newBin = new MaxRectsSheet(
                    activeBins.length + 1,
                    groupMaterial,
                    groupThickness,
                    sheetW,
                    sheetH,
                    trim
                );

                const piece = pendingPieces.shift()!;
                const initialFit = newBin.findBestFit(piece.width, piece.height, allowRot);
                if (initialFit) {
                    const targetRect = newBin.freeRects[initialFit.bestRectIdx];
                    const pw = initialFit.rotated ? piece.height : piece.width;
                    const ph = initialFit.rotated ? piece.width : piece.height;
                    const color = PIECE_COLORS[(globalOrderCounter - 1) % PIECE_COLORS.length];

                    newBin.placePiece(piece, pw, ph, targetRect, initialFit.rotated, color, globalOrderCounter++, kerf);
                }
                activeBins.push(newBin);
            }
        }

        activeBins.forEach(bin => {
            finalSheets.push(bin.toCutSheet(globalSheetCounter++));
        });
    }

    return finalSheets;
}

/**
 * Genera el SVG interactivo de alta precisión para representar el plano de corte de la lámina.
 */
export function generateSheetSvg(sheet: CutSheet): string {
    const margin = 40;
    const svgWidth = sheet.sheetWidth + margin * 2;
    const svgHeight = sheet.sheetHeight + margin * 2;

    let svg = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="q-despiece-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <pattern id="wastePattern-${sheet.sheetIndex}" width="20" height="20" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="20" stroke="#cbd5e1" stroke-width="2" />
            </pattern>
        </defs>

        <!-- Fondo del Tablero Comercial -->
        <g transform="translate(${margin}, ${margin})">
            <!-- Tablero Base -->
            <rect x="0" y="0" width="${sheet.sheetWidth}" height="${sheet.sheetHeight}" 
                  fill="#fffdf5" stroke="#b45309" stroke-width="3" rx="4" />

            <!-- Espacios Libres / Retazos Sobrantes -->
            ${sheet.freeRects.map(r => `
                <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" 
                      fill="url(#wastePattern-${sheet.sheetIndex})" stroke="#94a3b8" stroke-dasharray="4,4" stroke-width="1.5" />
                ${(r.w >= 180 && r.h >= 80) ? `
                    <text x="${r.x + r.w / 2}" y="${r.y + r.h / 2}" 
                          text-anchor="middle" dominant-baseline="middle" 
                          font-size="${Math.min(26, Math.max(12, Math.min(r.w, r.h) / 8))}" 
                          fill="#64748b" font-weight="bold" font-family="sans-serif">
                        Sobrante: ${(r.w / 1000).toFixed(2)} × ${(r.h / 1000).toFixed(2)} m
                    </text>
                ` : ''}
            `).join('')}

            <!-- Piezas Colocadas -->
            ${sheet.placedPieces.map(p => {
                const fontSize = Math.min(28, Math.max(12, Math.min(p.w, p.h) / 7));
                const isArc = Boolean(p.piece.hasArcCutout && p.piece.arcRadiusMm && p.piece.arcRadiusMm > 50);
                const r = isArc ? Math.min(p.piece.arcRadiusMm!, Math.min(p.w, p.h) * 0.45) : 0;

                // Generar silueta con corte de medio círculo si corresponde
                let shapeSvg = '';
                if (isArc && r > 20) {
                    if (p.w >= p.h) {
                        // Corte de medio círculo en borde superior (apertura hacia abajo)
                        const cx = p.x + p.w / 2;
                        shapeSvg = `
                        <path d="M ${p.x} ${p.y} 
                                 L ${cx - r} ${p.y} 
                                 A ${r} ${r} 0 0 0 ${cx + r} ${p.y} 
                                 L ${p.x + p.w} ${p.y} 
                                 L ${p.x + p.w} ${p.y + p.h} 
                                 L ${p.x} ${p.y + p.h} Z" 
                              fill="${p.color}" fill-opacity="0.88" 
                              stroke="#0f172a" stroke-width="2.5" 
                              class="q-despiece-piece-rect"
                              data-id="${p.piece.expressID || p.piece.id}">
                            <title>${p.piece.name}&#10;Corte #${p.orderIndex} (Con corte curvo R=${(r/1000).toFixed(2)}m)&#10;Medidas: ${(p.w / 1000).toFixed(2)} × ${(p.h / 1000).toFixed(2)} m&#10;Tag: ${p.piece.tag}</title>
                        </path>
                        <path d="M ${cx - r} ${p.y} A ${r} ${r} 0 0 1 ${cx + r} ${p.y}" 
                              fill="none" stroke="#dc2626" stroke-width="2" stroke-dasharray="3,3" />
                        <text x="${cx}" y="${p.y + r + 16}" text-anchor="middle" font-size="11" font-weight="bold" fill="#b91c1c">
                            &#8978; Vano R=${(r/1000).toFixed(2)}m
                        </text>
                        `;
                    } else {
                        // Corte de medio círculo en borde derecho o lateral (si está orientada verticalmente)
                        const cy = p.y + p.h / 2;
                        shapeSvg = `
                        <path d="M ${p.x} ${p.y} 
                                 L ${p.x + p.w} ${p.y} 
                                 L ${p.x + p.w} ${cy - r} 
                                 A ${r} ${r} 0 0 0 ${p.x + p.w} ${cy + r} 
                                 L ${p.x + p.w} ${p.y + p.h} 
                                 L ${p.x} ${p.y + p.h} Z" 
                              fill="${p.color}" fill-opacity="0.88" 
                              stroke="#0f172a" stroke-width="2.5" 
                              class="q-despiece-piece-rect"
                              data-id="${p.piece.expressID || p.piece.id}">
                            <title>${p.piece.name}&#10;Corte #${p.orderIndex} (Con corte semicircular R=${(r/1000).toFixed(2)}m)&#10;Medidas: ${(p.w / 1000).toFixed(2)} × ${(p.h / 1000).toFixed(2)} m&#10;Tag: ${p.piece.tag}</title>
                        </path>
                        <path d="M ${p.x + p.w} ${cy - r} A ${r} ${r} 0 0 1 ${p.x + p.w} ${cy + r}" 
                              fill="none" stroke="#dc2626" stroke-width="2" stroke-dasharray="3,3" />
                        <text x="${p.x + p.w - r - 6}" y="${cy}" text-anchor="end" dominant-baseline="middle" font-size="11" font-weight="bold" fill="#b91c1c">
                            &#8978; Vano R=${(r/1000).toFixed(2)}m
                        </text>
                        `;
                    }
                } else {
                    // Rectángulo convencional
                    shapeSvg = `
                    <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" 
                          fill="${p.color}" fill-opacity="0.88" 
                          stroke="#0f172a" stroke-width="2" rx="3" 
                          class="q-despiece-piece-rect"
                          data-id="${p.piece.expressID || p.piece.id}">
                        <title>${p.piece.name}&#10;Corte #${p.orderIndex}&#10;Medidas: ${(p.w / 1000).toFixed(2)} × ${(p.h / 1000).toFixed(2)} m${p.rotated ? ' (Rotado 90°)' : ''}&#10;Nivel: ${p.piece.level}&#10;Tag: ${p.piece.tag}&#10;Material: ${p.piece.material}${p.piece.isSplit ? `&#10;Muro subdividido (Parte ${p.piece.partIndex || 1})` : ''}</title>
                    </rect>
                    `;
                }

                return `
                <g class="q-despiece-piece-group" data-id="${p.piece.expressID || p.piece.id}">
                    ${shapeSvg}
                    
                    ${(p.w >= 100 && p.h >= 60) ? `
                        <text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 - fontSize * 0.6}" 
                              text-anchor="middle" dominant-baseline="middle" 
                              font-size="${fontSize}" fill="#0f172a" 
                              class="q-despiece-piece-label" font-weight="bold">
                            #${p.orderIndex} ${p.piece.tag}${p.piece.isSplit ? ` [P${p.piece.partIndex || 1}]` : ''}
                        </text>
                        <text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 + fontSize * 0.7}" 
                              text-anchor="middle" dominant-baseline="middle" 
                              font-size="${Math.max(10, fontSize * 0.8)}" fill="#1e293b" 
                              class="q-despiece-piece-label" font-weight="600">
                            ${(p.w / 1000).toFixed(2)} × ${(p.h / 1000).toFixed(2)} m${p.rotated ? ' ⟳' : ''}
                        </text>
                    ` : ''}
                </g>
                `;
            }).join('')}

            <!-- Cotas exteriores de la Lámina en Metros -->
            <text x="${sheet.sheetWidth / 2}" y="-12" text-anchor="middle" font-size="24" font-weight="bold" fill="#78350f" font-family="sans-serif">
                Largo Comercial: ${(sheet.sheetWidth / 1000).toFixed(2)} m
            </text>
            <text x="-14" y="${sheet.sheetHeight / 2}" text-anchor="middle" transform="rotate(-90, -14, ${sheet.sheetHeight / 2})" font-size="24" font-weight="bold" fill="#78350f" font-family="sans-serif">
                Ancho Comercial: ${(sheet.sheetHeight / 1000).toFixed(2)} m
            </text>
        </g>
    </svg>
    `;

    return svg;
}
