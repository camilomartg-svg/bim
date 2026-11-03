/**
 * Módulo de Optimización de Despiece 2D (Cutting Stock & Guillotine Nesting)
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
    areaM2: number;      // m²
    thicknessMm: number; // mm
    level: string;
    elementRef?: any;
    isSplit?: boolean;
    partIndex?: number;
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

const PIECE_COLORS = [
    '#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f472b6',
    '#a78bfa', '#fb923c', '#4ade80', '#2dd4bf', '#f87171',
    '#60a5fa', '#c084fc', '#facc15', '#22c55e', '#e879f9'
];

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
            // Level 1: direct in container
            for (const k of directKeys) {
                if (k in sub && isTruthy(sub[k])) return true;
            }
            for (const k of Object.keys(sub)) {
                if (k.trim().toUpperCase() === 'MODULAR' && isTruthy(sub[k])) return true;
            }
            // Level 2: inside Psets like "Propiedades del Elemento", "Identity Data", etc.
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
    scopeMode: 'ALL_MODULAR' | 'ALL_WALLS' | 'SELECTED' = 'ALL_MODULAR'
): ModularPiece[] {
    const pieces: ModularPiece[] = [];
    const selectedSet = new Set(selectedIds.map(Number));

    // Determinar si hay algún muro modular en el set
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

        // Si scopeMode es ALL_MODULAR y existe algún modular, filtramos solo los modulares.
        // Si no se encontró ningún modular marcado explícitamente, no dejamos al usuario con la pantalla vacía.
        if (scopeMode === 'ALL_MODULAR' && hasAnyModularWall && !isMod) return;

        const elemIdNum = Number(el.expressID || el.id);
        if (scopeMode === 'SELECTED' && selectedIds.length > 0 && !selectedSet.has(elemIdNum)) {
            return;
        }

        // Longitud en mm
        const rawLengthM = Math.max(0.05, el.length || 0);
        const lengthMm = Math.round(rawLengthM * 1000);

        // Altura en mm: calculada desde area / length
        let heightM = 2.40;
        if (el.area > 0 && rawLengthM > 0.001) {
            heightM = Math.max(0.1, el.area / rawLengthM);
        }
        const heightMm = Math.round(heightM * 1000);

        // Espesor en mm
        let thicknessMm = 18;
        if (el.volume > 0 && el.area > 0) {
            thicknessMm = Math.max(1, Math.round((el.volume / el.area) * 1000));
        } else if (el.material && el.material.includes('18')) {
            thicknessMm = 18;
        } else if (el.material && el.material.includes('2.5')) {
            thicknessMm = 2.5;
        }

        const rawName = String(el.name || '');
        const tag = rawName.includes(':') ? rawName.split(':').pop()! : String(el.id);

        pieces.push({
            id: el.id,
            expressID: elemIdNum,
            tag: tag.trim(),
            name: rawName || `Muro ${el.id}`,
            material: String(el.material || 'MDF 18 MM').trim(),
            nombreIntegrado: String(el.nombreIntegrado || el.name || 'Muro Modular').trim(),
            width: lengthMm,
            height: heightMm,
            areaM2: Number((el.area || ((lengthMm * heightMm) / 1000000)).toFixed(4)),
            thicknessMm: thicknessMm,
            level: String(el.level || 'General').trim(),
            elementRef: el
        });
    });

    return pieces;
}

/**
 * Algoritmo 2D Guillotine Cutting Stock / Bin Packing con soporte de rotación y kerf.
 */
export function optimizeSheetCutting(
    pieces: ModularPiece[],
    sheetW: number,
    sheetH: number,
    kerf: number = 3,
    trim: number = 0,
    allowRot: boolean = true
): CutSheet[] {
    const usableW = Math.max(100, sheetW - 2 * trim);
    const usableH = Math.max(100, sheetH - 2 * trim);

    const maxDim = Math.max(usableW, usableH);
    const minDim = Math.min(usableW, usableH);

    // Si alguna pieza excede las dimensiones de la lámina, la modulamos en submódulos
    const workablePieces: ModularPiece[] = [];
    pieces.forEach(p => {
        const fitsNormal = p.width <= usableW && p.height <= usableH;
        const fitsRotated = allowRot && p.width <= usableH && p.height <= usableW;

        if (fitsNormal || fitsRotated) {
            workablePieces.push({ ...p });
        } else {
            // Muro de gran escala que excede el tamaño comercial del tablero:
            // Subdividir en paneles estándar (altura comercial + remate)
            let remH = p.height;
            let partIdx = 1;
            while (remH > 0) {
                const curH = Math.min(remH, maxDim);
                let remW = p.width;
                let subIdx = 1;
                while (remW > 0) {
                    const curW = Math.min(remW, minDim);
                    workablePieces.push({
                        ...p,
                        id: `${p.id}-M${partIdx}${p.width > minDim ? `.${subIdx}` : ''}`,
                        width: curW,
                        height: curH,
                        areaM2: Number(((curW * curH) / 1000000).toFixed(4)),
                        isSplit: true,
                        partIndex: partIdx
                    });
                    remW -= curW;
                    subIdx++;
                }
                remH -= curH;
                partIdx++;
            }
        }
    });

    // Heurística de ordenación: De mayor área a menor área
    workablePieces.sort((a, b) => {
        const areaA = a.width * a.height;
        const areaB = b.width * b.height;
        if (areaB !== areaA) return areaB - areaA;
        return Math.max(b.width, b.height) - Math.max(a.width, a.height);
    });

    const sheets: CutSheet[] = [];
    let globalOrder = 1;

    workablePieces.forEach(piece => {
        let placed = false;

        // Intentar ubicar en láminas existentes
        for (const sheet of sheets) {
            let bestRectIdx = -1;
            let bestScore = Infinity;
            let bestRotated = false;

            for (let i = 0; i < sheet.freeRects.length; i++) {
                const r = sheet.freeRects[i];

                // Opción A: Normal
                if (piece.width <= r.w && piece.height <= r.h) {
                    const leftoverW = r.w - piece.width;
                    const leftoverH = r.h - piece.height;
                    const score = Math.min(leftoverW, leftoverH); // Best Short Side Fit
                    if (score < bestScore) {
                        bestScore = score;
                        bestRectIdx = i;
                        bestRotated = false;
                    }
                }

                // Opción B: Rotada 90°
                if (allowRot && piece.height <= r.w && piece.width <= r.h) {
                    const leftoverW = r.w - piece.height;
                    const leftoverH = r.h - piece.width;
                    const score = Math.min(leftoverW, leftoverH);
                    if (score < bestScore) {
                        bestScore = score;
                        bestRectIdx = i;
                        bestRotated = true;
                    }
                }
            }

            if (bestRectIdx >= 0) {
                const targetRect = sheet.freeRects[bestRectIdx];
                sheet.freeRects.splice(bestRectIdx, 1);

                const pw = bestRotated ? piece.height : piece.width;
                const ph = bestRotated ? piece.width : piece.height;

                const color = PIECE_COLORS[(globalOrder - 1) % PIECE_COLORS.length];

                sheet.placedPieces.push({
                    piece,
                    x: targetRect.x,
                    y: targetRect.y,
                    w: pw,
                    h: ph,
                    rotated: bestRotated,
                    color,
                    orderIndex: globalOrder++
                });

                // Guillotine Cut (Corte de sierra ortogonal)
                const rightW = targetRect.w - pw - kerf;
                const topH = targetRect.h - ph - kerf;

                if (rightW > 0 && topH > 0) {
                    if (rightW * targetRect.h > targetRect.w * topH) {
                        sheet.freeRects.push({ x: targetRect.x + pw + kerf, y: targetRect.y, w: rightW, h: targetRect.h });
                        sheet.freeRects.push({ x: targetRect.x, y: targetRect.y + ph + kerf, w: pw, h: topH });
                    } else {
                        sheet.freeRects.push({ x: targetRect.x + pw + kerf, y: targetRect.y, w: rightW, h: ph });
                        sheet.freeRects.push({ x: targetRect.x, y: targetRect.y + ph + kerf, w: targetRect.w, h: topH });
                    }
                } else if (rightW > 0) {
                    sheet.freeRects.push({ x: targetRect.x + pw + kerf, y: targetRect.y, w: rightW, h: targetRect.h });
                } else if (topH > 0) {
                    sheet.freeRects.push({ x: targetRect.x, y: targetRect.y + ph + kerf, w: targetRect.w, h: topH });
                }

                sheet.usedAreaM2 += (piece.width * piece.height) / 1000000;
                placed = true;
                break;
            }
        }

        // Si no cupo en ninguna lámina abierta, crear una nueva lámina
        if (!placed) {
            const newSheetIndex = sheets.length + 1;
            const newSheet: CutSheet = {
                sheetIndex: newSheetIndex,
                material: piece.material,
                thicknessMm: piece.thicknessMm,
                sheetWidth: sheetW,
                sheetHeight: sheetH,
                placedPieces: [],
                usedAreaM2: 0,
                sheetAreaM2: Number(((sheetW * sheetH) / 1000000).toFixed(4)),
                efficiencyPercent: 0,
                wasteAreaM2: 0,
                wastePercent: 0,
                freeRects: [{ x: trim, y: trim, w: usableW, h: usableH }]
            };

            const targetRect = newSheet.freeRects[0];
            newSheet.freeRects.splice(0, 1);

            let rotated = false;
            if (!(piece.width <= targetRect.w && piece.height <= targetRect.h)) {
                if (allowRot && piece.height <= targetRect.w && piece.width <= targetRect.h) {
                    rotated = true;
                }
            } else if (allowRot) {
                if (piece.width < piece.height && targetRect.w > targetRect.h) {
                    rotated = true;
                }
            }

            const pw = rotated ? piece.height : piece.width;
            const ph = rotated ? piece.width : piece.height;

            const color = PIECE_COLORS[(globalOrder - 1) % PIECE_COLORS.length];

            newSheet.placedPieces.push({
                piece,
                x: targetRect.x,
                y: targetRect.y,
                w: pw,
                h: ph,
                rotated,
                color,
                orderIndex: globalOrder++
            });

            const rightW = targetRect.w - pw - kerf;
            const topH = targetRect.h - ph - kerf;

            if (rightW > 0 && topH > 0) {
                if (rightW * targetRect.h > targetRect.w * topH) {
                    newSheet.freeRects.push({ x: targetRect.x + pw + kerf, y: targetRect.y, w: rightW, h: targetRect.h });
                    newSheet.freeRects.push({ x: targetRect.x, y: targetRect.y + ph + kerf, w: pw, h: topH });
                } else {
                    newSheet.freeRects.push({ x: targetRect.x + pw + kerf, y: targetRect.y, w: rightW, h: ph });
                    newSheet.freeRects.push({ x: targetRect.x, y: targetRect.y + ph + kerf, w: targetRect.w, h: topH });
                }
            } else if (rightW > 0) {
                newSheet.freeRects.push({ x: targetRect.x + pw + kerf, y: targetRect.y, w: rightW, h: targetRect.h });
            } else if (topH > 0) {
                newSheet.freeRects.push({ x: targetRect.x, y: targetRect.y + ph + kerf, w: targetRect.w, h: topH });
            }

            newSheet.usedAreaM2 += (piece.width * piece.height) / 1000000;
            sheets.push(newSheet);
        }
    });

    // Calcular estadísticas de rendimiento y sobrantes
    sheets.forEach(s => {
        s.usedAreaM2 = Number(s.usedAreaM2.toFixed(4));
        s.efficiencyPercent = Math.min(100, Number(((s.usedAreaM2 / s.sheetAreaM2) * 100).toFixed(1)));
        s.wasteAreaM2 = Math.max(0, Number((s.sheetAreaM2 - s.usedAreaM2).toFixed(4)));
        s.wastePercent = Math.max(0, Number((100 - s.efficiencyPercent).toFixed(1)));
    });

    return sheets;
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
                        Sobrante: ${Math.round(r.w)} × ${Math.round(r.h)} mm
                    </text>
                ` : ''}
            `).join('')}

            <!-- Piezas Colocadas -->
            ${sheet.placedPieces.map(p => {
                const fontSize = Math.min(28, Math.max(12, Math.min(p.w, p.h) / 7));
                return `
                <g class="q-despiece-piece-group" data-id="${p.piece.expressID || p.piece.id}">
                    <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" 
                          fill="${p.color}" fill-opacity="0.82" 
                          stroke="#0f172a" stroke-width="2" rx="3" 
                          class="q-despiece-piece-rect"
                          data-id="${p.piece.expressID || p.piece.id}">
                        <title>${p.piece.name}&#10;Medidas: ${Math.round(p.w)} × ${Math.round(p.h)} mm${p.rotated ? ' (Rotado 90°)' : ''}&#10;Nivel: ${p.piece.level}&#10;Tag: ${p.piece.tag}</title>
                    </rect>
                    
                    ${(p.w >= 100 && p.h >= 60) ? `
                        <text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 - fontSize * 0.6}" 
                              text-anchor="middle" dominant-baseline="middle" 
                              font-size="${fontSize}" fill="#0f172a" 
                              class="q-despiece-piece-label">
                            #${p.orderIndex} ${p.piece.tag}
                        </text>
                        <text x="${p.x + p.w / 2}" y="${p.y + p.h / 2 + fontSize * 0.7}" 
                              text-anchor="middle" dominant-baseline="middle" 
                              font-size="${Math.max(10, fontSize * 0.8)}" fill="#1e293b" 
                              class="q-despiece-piece-label" font-weight="600">
                            ${Math.round(p.w)} × ${Math.round(p.h)} mm${p.rotated ? ' ⟳' : ''}
                        </text>
                    ` : ''}
                </g>
                `;
            }).join('')}

            <!-- Cotas exteriores de la Lámina -->
            <text x="${sheet.sheetWidth / 2}" y="-12" text-anchor="middle" font-size="22" font-weight="bold" fill="#78350f" font-family="sans-serif">
                Largo Comercial: ${sheet.sheetWidth} mm (${(sheet.sheetWidth / 1000).toFixed(2)} m)
            </text>
            <text x="-14" y="${sheet.sheetHeight / 2}" text-anchor="middle" transform="rotate(-90, -14, ${sheet.sheetHeight / 2})" font-size="22" font-weight="bold" fill="#78350f" font-family="sans-serif">
                Ancho Comercial: ${sheet.sheetHeight} mm (${(sheet.sheetHeight / 1000).toFixed(2)} m)
            </text>
        </g>
    </svg>
    `;

    return svg;
}
