/**
 * Módulo de Optimización de Despiece 2D (Cutting Stock, Extracción Exacta de Contornos/Perforaciones 3D->2D y Nesting en Cavidades)
 * para muros y paneles modulares en Nora BIM.
 */

export interface Point2D {
    x: number; // mm en [0, width]
    y: number; // mm en [0, height], y=0 borde superior, y=height borde inferior
}

export interface Tri2D {
    x0: number; y0: number;
    x1: number; y1: number;
    x2: number; y2: number;
}

export interface WallFaceProfile2D {
    widthMm: number;
    heightMm: number;
    thicknessMm: number;
    netAreaM2: number;
    outerLoops: Point2D[][];
    holeLoops: Point2D[][];
    triangles2D: Tri2D[];
    isRectangular: boolean;
    hasCurvedEdges: boolean;
    topCenter3D?: { x: number; y: number; z: number };
}

export interface RawMeshGeometryData {
    positions?: ArrayLike<number>;
    indices?: ArrayLike<number>;
    normals?: ArrayLike<number>;
    transform?: { elements?: ArrayLike<number> } | ArrayLike<number>;
    localId?: number;
}

export interface ModularPiece {
    id: number | string;
    expressID?: number;
    tag?: string;
    name: string;
    material: string;
    nombreIntegrado: string;
    width: number;       // mm nominales (ancho envolvente real de la pieza)
    height: number;      // mm nominales (alto envolvente real de la pieza)
    widthM: number;      // m
    heightM: number;     // m
    dimensionsLabelM: string; // ej: "1.50 × 2.07 m"
    areaM2: number;      // m² netos reales de una cara (descontando huecos y recortes)
    thicknessMm: number; // mm
    level: string;
    elementRef?: any;
    isSplit?: boolean;
    partIndex?: number;
    totalParts?: number;
    hasArcCutout?: boolean;
    arcRadiusMm?: number;
    arcPosition?: 'top' | 'bottom' | 'left' | 'right';
    outerLoops?: Point2D[][];
    holeLoops?: Point2D[][];
    triangles2D?: Tri2D[];
    isIrregular?: boolean;
    holeCount?: number;
    hasCurvedEdges?: boolean;
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

export type ElementBoundsGetter = (
    expressID: number,
    modelUUID?: string
) => {
    widthM: number;
    heightM: number;
    depthM: number;
    profile2D?: WallFaceProfile2D | null;
} | null;

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
 * Ajusta milímetros que están muy cerca de un centímetro exacto (tolerancia de exportación IFC ±2.5mm)
 * preservando medidas intermedias reales (ej. 1225mm).
 */
function snapNearCentimeterMm(valMm: number): number {
    const roundedMm = Math.max(10, Math.round(valMm));
    const nearestCmMm = Math.round(roundedMm / 10) * 10;
    if (nearestCmMm >= 10 && Math.abs(roundedMm - nearestCmMm) <= 2) {
        return nearestCmMm;
    }
    return roundedMm;
}

// ============================================================================
// MOTOR GEOMÉTRICO 3D -> 2D: EXTRACCIÓN EXACTA DE CONTORNOS Y PERFORACIONES
// ============================================================================

function signedPolygonArea2D(pts: Point2D[]): number {
    const n = pts.length;
    if (n < 3) return 0;
    let sum = 0;
    for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % n];
        sum += a.x * b.y - b.x * a.y;
    }
    return sum * 0.5;
}

function simplifyPolygonLoop(loop: Point2D[], collinearTolMm: number = 0.75): Point2D[] {
    if (loop.length <= 3) return loop;

    // 1. Eliminar puntos consecutivos casi idénticos (< 0.5mm)
    let pts: Point2D[] = [];
    for (let i = 0; i < loop.length; i++) {
        const p = loop[i];
        const prev = pts.length > 0 ? pts[pts.length - 1] : loop[loop.length - 1];
        if (Math.hypot(p.x - prev.x, p.y - prev.y) >= 0.5) {
            pts.push(p);
        }
    }
    if (pts.length <= 3) return pts;

    // 2. Eliminar vértices colineales intermedios preservando curvas reales
    let changed = true;
    while (changed && pts.length > 3) {
        changed = false;
        const next: Point2D[] = [];
        const n = pts.length;
        for (let i = 0; i < n; i++) {
            const prev = pts[(i - 1 + n) % n];
            const curr = pts[i];
            const nxt = pts[(i + 1) % n];
            const dx = nxt.x - prev.x;
            const dy = nxt.y - prev.y;
            const chordLen = Math.hypot(dx, dy);
            if (chordLen < 0.5) {
                changed = true;
                continue;
            }
            const perpDist = Math.abs((curr.x - prev.x) * dy - (curr.y - prev.y) * dx) / chordLen;
            const dot = (curr.x - prev.x) * (nxt.x - curr.x) + (curr.y - prev.y) * (nxt.y - curr.y);
            if (perpDist <= collinearTolMm && dot > 0) {
                changed = true;
                continue;
            }
            next.push(curr);
        }
        pts = next;
    }
    return pts;
}

function detectCurvedLoop(loops: Point2D[][]): boolean {
    for (const loop of loops) {
        if (loop.length < 7) continue;
        let gentleTurnRun = 0;
        const n = loop.length;
        for (let i = 0; i < n; i++) {
            const a = loop[(i - 1 + n) % n];
            const b = loop[i];
            const c = loop[(i + 1) % n];
            const v1x = b.x - a.x, v1y = b.y - a.y;
            const v2x = c.x - b.x, v2y = c.y - b.y;
            const l1 = Math.hypot(v1x, v1y);
            const l2 = Math.hypot(v2x, v2y);
            if (l1 < 1 || l2 < 1) continue;
            const cosA = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (l1 * l2)));
            const deg = (Math.acos(cosA) * 180) / Math.PI;
            if (deg >= 2.5 && deg <= 48) {
                gentleTurnRun++;
                if (gentleTurnRun >= 4) return true;
            } else {
                gentleTurnRun = 0;
            }
        }
    }
    return false;
}

function triangleArea2D(t: Tri2D): number {
    return 0.5 * Math.abs((t.x1 - t.x0) * (t.y2 - t.y0) - (t.y1 - t.y0) * (t.x2 - t.x0));
}

function pointInTriangle2D(px: number, py: number, t: Tri2D): boolean {
    const d1 = (px - t.x1) * (t.y0 - t.y1) - (t.x0 - t.x1) * (py - t.y1);
    const d2 = (px - t.x2) * (t.y1 - t.y2) - (t.x1 - t.x2) * (py - t.y2);
    const d3 = (px - t.x0) * (t.y2 - t.y0) - (t.x2 - t.x0) * (py - t.y0);
    const hasNeg = (d1 < -1e-4) || (d2 < -1e-4) || (d3 < -1e-4);
    const hasPos = (d1 > 1e-4) || (d2 > 1e-4) || (d3 > 1e-4);
    return !(hasNeg && hasPos);
}

function segmentIntersectsBox2D(
    ax: number, ay: number, bx: number, by: number,
    minX: number, minY: number, maxX: number, maxY: number
): boolean {
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dy = by - ay;
    const checks: Array<[number, number]> = [
        [-dx, ax - minX],
        [dx, maxX - ax],
        [-dy, ay - minY],
        [dy, maxY - ay]
    ];
    for (const [p, q] of checks) {
        if (Math.abs(p) < 1e-9) {
            if (q < 0) return false;
        } else {
            const r = q / p;
            if (p < 0) {
                if (r > t1) return false;
                if (r > t0) t0 = r;
            } else {
                if (r < t0) return false;
                if (r < t1) t1 = r;
            }
        }
    }
    return t0 <= t1;
}

function triangleIntersectsBox2D(
    t: Tri2D,
    minX: number, minY: number, maxX: number, maxY: number
): boolean {
    const triMinX = Math.min(t.x0, t.x1, t.x2);
    const triMaxX = Math.max(t.x0, t.x1, t.x2);
    const triMinY = Math.min(t.y0, t.y1, t.y2);
    const triMaxY = Math.max(t.y0, t.y1, t.y2);
    if (triMaxX < minX || triMinX > maxX || triMaxY < minY || triMinY > maxY) return false;

    if (t.x0 >= minX && t.x0 <= maxX && t.y0 >= minY && t.y0 <= maxY) return true;
    if (t.x1 >= minX && t.x1 <= maxX && t.y1 >= minY && t.y1 <= maxY) return true;
    if (t.x2 >= minX && t.x2 <= maxX && t.y2 >= minY && t.y2 <= maxY) return true;

    const cx = 0.5 * (minX + maxX);
    const cy = 0.5 * (minY + maxY);
    if (pointInTriangle2D(cx, cy, t)) return true;
    if (pointInTriangle2D(minX, minY, t)) return true;
    if (pointInTriangle2D(maxX, minY, t)) return true;
    if (pointInTriangle2D(maxX, maxY, t)) return true;
    if (pointInTriangle2D(minX, maxY, t)) return true;

    if (segmentIntersectsBox2D(t.x0, t.y0, t.x1, t.y1, minX, minY, maxX, maxY)) return true;
    if (segmentIntersectsBox2D(t.x1, t.y1, t.x2, t.y2, minX, minY, maxX, maxY)) return true;
    if (segmentIntersectsBox2D(t.x2, t.y2, t.x0, t.y0, minX, minY, maxX, maxY)) return true;

    return false;
}

/**
 * Encadena semiaristas dirigidas (u -> v) en lazos poligonales cerrados.
 */
function chainDirectedHalfEdges(
    edges: Array<[string, string]>,
    vertexCoords: Map<string, Point2D>
): Point2D[][] {
    const adj = new Map<string, Array<{ to: string; used: boolean }>>();
    for (const [u, v] of edges) {
        if (!adj.has(u)) adj.set(u, []);
        adj.get(u)!.push({ to: v, used: false });
    }

    const loops: Point2D[][] = [];
    for (const [startKey, outList] of adj.entries()) {
        for (const startEdge of outList) {
            if (startEdge.used) continue;
            startEdge.used = true;

            const keys: string[] = [startKey];
            let prevKey = startKey;
            let currKey = startEdge.to;
            let guard = 0;
            const maxSteps = edges.length + 5;

            while (currKey !== startKey && guard < maxSteps) {
                guard++;
                keys.push(currKey);
                const candidates = (adj.get(currKey) || []).filter(e => !e.used);
                if (candidates.length === 0) break;

                let chosen = candidates[0];
                if (candidates.length > 1) {
                    const pPrev = vertexCoords.get(prevKey)!;
                    const pCurr = vertexCoords.get(currKey)!;
                    const inAngle = Math.atan2(pPrev.y - pCurr.y, pPrev.x - pCurr.x);
                    let bestTurn = Infinity;
                    for (const cand of candidates) {
                        const pNext = vertexCoords.get(cand.to)!;
                        const outAngle = Math.atan2(pNext.y - pCurr.y, pNext.x - pCurr.x);
                        let turn = outAngle - inAngle;
                        while (turn <= 0) turn += Math.PI * 2;
                        if (turn < bestTurn) {
                            bestTurn = turn;
                            chosen = cand;
                        }
                    }
                }
                chosen.used = true;
                prevKey = currKey;
                currKey = chosen.to;
            }

            if (currKey === startKey && keys.length >= 3) {
                const pts = keys.map(k => vertexCoords.get(k)!).filter(Boolean);
                if (pts.length >= 3) loops.push(pts);
            }
        }
    }
    return loops;
}

/**
 * Construye contornos exteriores y perforaciones interiores exactas a partir de una triangulación 2D.
 * Usa cancelación topológica de semiaristas a 1mm con respaldo de rasterización de unión 2D.
 */
function buildLoopsFromTriangles2D(
    triangles: Tri2D[],
    widthMm: number,
    heightMm: number
): { outerLoops: Point2D[][]; holeLoops: Point2D[][]; netAreaMm2: number } {
    const netAreaMm2 = triangles.reduce((s, t) => s + triangleArea2D(t), 0);
    if (triangles.length === 0 || widthMm <= 1 || heightMm <= 1) {
        return {
            outerLoops: [[{ x: 0, y: 0 }, { x: widthMm, y: 0 }, { x: widthMm, y: heightMm }, { x: 0, y: heightMm }]],
            holeLoops: [],
            netAreaMm2: widthMm * heightMm
        };
    }

    // Método 1: Cancelación exacta de semiaristas (precisión vectorial 1mm)
    const vertexAccum = new Map<string, { sx: number; sy: number; n: number }>();
    const snapKey = (x: number, y: number): string => {
        const kx = Math.round(x);
        const ky = Math.round(y);
        const key = `${kx},${ky}`;
        const acc = vertexAccum.get(key);
        if (acc) {
            acc.sx += x;
            acc.sy += y;
            acc.n++;
        } else {
            vertexAccum.set(key, { sx: x, sy: y, n: 1 });
        }
        return key;
    };

    const seenTris = new Set<string>();
    const edgeCounts = new Map<string, number>();
    const addHalfEdge = (a: string, b: string) => {
        const rev = `${b}|${a}`;
        const revCount = edgeCounts.get(rev) || 0;
        if (revCount > 0) {
            if (revCount === 1) edgeCounts.delete(rev);
            else edgeCounts.set(rev, revCount - 1);
        } else {
            const fwd = `${a}|${b}`;
            edgeCounts.set(fwd, (edgeCounts.get(fwd) || 0) + 1);
        }
    };

    for (const t of triangles) {
        const cross = (t.x1 - t.x0) * (t.y2 - t.y0) - (t.y1 - t.y0) * (t.x2 - t.x0);
        if (Math.abs(cross) < 2) continue;
        const k0 = snapKey(t.x0, t.y0);
        const k1 = cross > 0 ? snapKey(t.x1, t.y1) : snapKey(t.x2, t.y2);
        const k2 = cross > 0 ? snapKey(t.x2, t.y2) : snapKey(t.x1, t.y1);
        if (k0 === k1 || k1 === k2 || k2 === k0) continue;

        const sortedKey = [k0, k1, k2].sort().join(';');
        if (seenTris.has(sortedKey)) continue;
        seenTris.add(sortedKey);

        addHalfEdge(k0, k1);
        addHalfEdge(k1, k2);
        addHalfEdge(k2, k0);
    }

    const vertexCoords = new Map<string, Point2D>();
    for (const [k, acc] of vertexAccum.entries()) {
        vertexCoords.set(k, {
            x: Math.max(0, Math.min(widthMm, acc.sx / acc.n)),
            y: Math.max(0, Math.min(heightMm, acc.sy / acc.n))
        });
    }

    const survivingEdges: Array<[string, string]> = [];
    for (const [edgeKey, count] of edgeCounts.entries()) {
        const [a, b] = edgeKey.split('|');
        for (let c = 0; c < count; c++) survivingEdges.push([a, b]);
    }

    const rawLoops = chainDirectedHalfEdges(survivingEdges, vertexCoords);
    const outerLoopsA: Point2D[][] = [];
    const holeLoopsA: Point2D[][] = [];
    let loopsSignedSum = 0;

    for (const rawLoop of rawLoops) {
        const simp = simplifyPolygonLoop(rawLoop, 0.75);
        if (simp.length < 3) continue;
        const sArea = signedPolygonArea2D(simp);
        if (Math.abs(sArea) < 100) continue; // ignorar micro-artefactos < 1 cm²
        loopsSignedSum += sArea;
        if (sArea > 0) outerLoopsA.push(simp);
        else holeLoopsA.push(simp);
    }

    const areaTolerance = Math.max(3000, netAreaMm2 * 0.045);
    if (outerLoopsA.length >= 1 && Math.abs(loopsSignedSum - netAreaMm2) <= areaTolerance) {
        return { outerLoops: outerLoopsA, holeLoops: holeLoopsA, netAreaMm2 };
    }

    // Método 2 (Respaldo): Rasterización de unión booleana 2D para mallas con solapamientos o vértices T
    const cellMm = Math.max(8, Math.round(Math.max(widthMm, heightMm) / 180));
    const cols = Math.max(4, Math.ceil(widthMm / cellMm));
    const rows = Math.max(4, Math.ceil(heightMm / cellMm));
    const stepX = widthMm / cols;
    const stepY = heightMm / rows;
    const grid = new Uint8Array(cols * rows);

    for (const t of triangles) {
        const c0 = Math.max(0, Math.floor(Math.min(t.x0, t.x1, t.x2) / stepX));
        const c1 = Math.min(cols - 1, Math.floor(Math.max(t.x0, t.x1, t.x2) / stepX));
        const r0 = Math.max(0, Math.floor(Math.min(t.y0, t.y1, t.y2) / stepY));
        const r1 = Math.min(rows - 1, Math.floor(Math.max(t.y0, t.y1, t.y2) / stepY));
        for (let r = r0; r <= r1; r++) {
            const cy = (r + 0.5) * stepY;
            for (let c = c0; c <= c1; c++) {
                if (grid[r * cols + c]) continue;
                const cx = (c + 0.5) * stepX;
                if (pointInTriangle2D(cx, cy, t)) {
                    grid[r * cols + c] = 1;
                }
            }
        }
    }

    const gCoords = new Map<string, Point2D>();
    const gKey = (gx: number, gy: number): string => {
        const k = `${gx},${gy}`;
        if (!gCoords.has(k)) {
            gCoords.set(k, { x: gx * stepX, y: gy * stepY });
        }
        return k;
    };
    const gEdges: Array<[string, string]> = [];
    const isSolid = (c: number, r: number) => c >= 0 && c < cols && r >= 0 && r < rows && grid[r * cols + c] === 1;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!isSolid(c, r)) continue;
            if (!isSolid(c, r - 1)) gEdges.push([gKey(c, r), gKey(c + 1, r)]);
            if (!isSolid(c + 1, r)) gEdges.push([gKey(c + 1, r), gKey(c + 1, r + 1)]);
            if (!isSolid(c, r + 1)) gEdges.push([gKey(c + 1, r + 1), gKey(c, r + 1)]);
            if (!isSolid(c - 1, r)) gEdges.push([gKey(c, r + 1), gKey(c, r)]);
        }
    }

    const gridLoops = chainDirectedHalfEdges(gEdges, gCoords);
    const outerLoopsB: Point2D[][] = [];
    const holeLoopsB: Point2D[][] = [];
    let solidCells = 0;
    for (let i = 0; i < grid.length; i++) solidCells += grid[i];
    const unionAreaMm2 = solidCells * stepX * stepY;

    for (const gl of gridLoops) {
        const simp = simplifyPolygonLoop(gl, Math.max(1, Math.min(stepX, stepY) * 0.4));
        if (simp.length < 3) continue;
        const sArea = signedPolygonArea2D(simp);
        if (Math.abs(sArea) < stepX * stepY) continue;
        if (sArea > 0) outerLoopsB.push(simp);
        else holeLoopsB.push(simp);
    }

    if (outerLoopsB.length >= 1) {
        return {
            outerLoops: outerLoopsB,
            holeLoops: holeLoopsB,
            netAreaMm2: unionAreaMm2 > 0 ? unionAreaMm2 : netAreaMm2
        };
    }

    return {
        outerLoops: [[{ x: 0, y: 0 }, { x: widthMm, y: 0 }, { x: widthMm, y: heightMm }, { x: 0, y: heightMm }]],
        holeLoops: [],
        netAreaMm2
    };
}

/**
 * Extrae el perfil 2D exacto (contorno exterior, huecos circulares/rectangulares/curvos y área neta de 1 cara)
 * directamente desde los buffers de triángulos 3D de FragmentsModel (getItemsGeometry).
 */
export function extractWallFaceProfileFromMeshes(meshes: RawMeshGeometryData[] | null | undefined): WallFaceProfile2D | null {
    if (!meshes || !Array.isArray(meshes) || meshes.length === 0) return null;

    interface Tri3D {
        ax: number; ay: number; az: number;
        bx: number; by: number; bz: number;
        cx: number; cy: number; cz: number;
        nx: number; ny: number; nz: number;
        area: number;
    }

    const tris3D: Tri3D[] = [];
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    for (const mesh of meshes) {
        const pos = mesh?.positions;
        if (!pos || pos.length < 9) continue;

        const rawEls = (mesh.transform && 'elements' in (mesh.transform as any))
            ? (mesh.transform as any).elements
            : mesh.transform;
        const m = (rawEls && rawEls.length === 16) ? rawEls : identity;

        const vCount = Math.floor(pos.length / 3);
        const wx = new Float64Array(vCount);
        const wy = new Float64Array(vCount);
        const wz = new Float64Array(vCount);

        for (let i = 0; i < vCount; i++) {
            const px = Number(pos[3 * i]);
            const py = Number(pos[3 * i + 1]);
            const pz = Number(pos[3 * i + 2]);
            wx[i] = m[0] * px + m[4] * py + m[8] * pz + m[12];
            wy[i] = m[1] * px + m[5] * py + m[9] * pz + m[13];
            wz[i] = m[2] * px + m[6] * py + m[10] * pz + m[14];
        }

        const idx = mesh.indices;
        const triCount = idx && idx.length >= 3 ? Math.floor(idx.length / 3) : Math.floor(vCount / 3);

        for (let t = 0; t < triCount; t++) {
            const i0 = idx ? Number(idx[3 * t]) : 3 * t;
            const i1 = idx ? Number(idx[3 * t + 1]) : 3 * t + 1;
            const i2 = idx ? Number(idx[3 * t + 2]) : 3 * t + 2;
            if (i0 >= vCount || i1 >= vCount || i2 >= vCount) continue;

            const ax = wx[i0], ay = wy[i0], az = wz[i0];
            const bx = wx[i1], by = wy[i1], bz = wz[i1];
            const cx = wx[i2], cy = wy[i2], cz = wz[i2];

            const abx = bx - ax, aby = by - ay, abz = bz - az;
            const acx = cx - ax, acy = cy - ay, acz = cz - az;
            const crx = aby * acz - abz * acy;
            const cry = abz * acx - abx * acz;
            const crz = abx * acy - aby * acx;
            const len = Math.hypot(crx, cry, crz);
            if (len < 2e-6 || !isFinite(len)) continue;

            tris3D.push({
                ax, ay, az,
                bx, by, bz,
                cx, cy, cz,
                nx: crx / len,
                ny: cry / len,
                nz: crz / len,
                area: 0.5 * len
            });
        }
    }

    if (tris3D.length === 0) return null;

    // 1. Agrupar normales (sin signo ±n) para hallar el plano principal del muro/panel
    interface NormalCluster {
        dx: number; dy: number; dz: number;
        sx: number; sy: number; sz: number;
        totalArea: number;
    }
    const clusters: NormalCluster[] = [];

    for (const tr of tris3D) {
        let nx = tr.nx, ny = tr.ny, nz = tr.nz;
        // Canonicalizar signo para agrupar cara frontal y posterior
        if (nz < -0.01 || (Math.abs(nz) <= 0.01 && (nx < -0.01 || (Math.abs(nx) <= 0.01 && ny < 0)))) {
            nx = -nx; ny = -ny; nz = -nz;
        }
        let matched: NormalCluster | null = null;
        for (const cl of clusters) {
            if (Math.abs(nx * cl.dx + ny * cl.dy + nz * cl.dz) >= 0.96) {
                matched = cl;
                break;
            }
        }
        if (matched) {
            const sign = (nx * matched.dx + ny * matched.dy + nz * matched.dz) >= 0 ? 1 : -1;
            matched.sx += sign * nx * tr.area;
            matched.sy += sign * ny * tr.area;
            matched.sz += sign * nz * tr.area;
            matched.totalArea += tr.area;
            const sl = Math.hypot(matched.sx, matched.sy, matched.sz) || 1;
            matched.dx = matched.sx / sl;
            matched.dy = matched.sy / sl;
            matched.dz = matched.sz / sl;
        } else {
            clusters.push({
                dx: nx, dy: ny, dz: nz,
                sx: nx * tr.area, sy: ny * tr.area, sz: nz * tr.area,
                totalArea: tr.area
            });
        }
    }

    // Preferir caras verticales/inclinadas (|ny| < 0.65) propias de muros; respaldo al cluster de mayor área
    const verticalClusters = clusters.filter(c => Math.abs(c.dy) < 0.65);
    const pool = verticalClusters.length > 0 ? verticalClusters : clusters;
    pool.sort((a, b) => b.totalArea - a.totalArea);
    const mainCluster = pool[0];

    let nfx = mainCluster.dx, nfy = mainCluster.dy, nfz = mainCluster.dz;
    if (nfz < -0.01 || (Math.abs(nfz) <= 0.01 && nfx < 0)) {
        nfx = -nfx; nfy = -nfy; nfz = -nfz;
    }

    // 2. Construir base ortonormal 2D de elevación (uAxis horizontal, vAxis vertical hacia arriba)
    let ux: number, uy: number, uz: number;
    if (Math.abs(nfy) < 0.92) {
        // cross((0, 1, 0), nFace) = (nfz, 0, -nfx)
        const ul = Math.hypot(nfz, nfx) || 1;
        ux = nfz / ul;
        uy = 0;
        uz = -nfx / ul;
    } else {
        // Panel horizontal: cross((0, 0, 1), nFace) = (-nfy, nfx, 0)
        const ul = Math.hypot(nfy, nfx) || 1;
        ux = -nfy / ul;
        uy = nfx / ul;
        uz = 0;
    }
    // vAxis = cross(nFace, uAxis)
    const vx = nfy * uz - nfz * uy;
    const vy = nfz * ux - nfx * uz;
    const vz = nfx * uy - nfy * ux;

    // 3. Medir espesor real y aislar UNA sola cara principal (evitando duplicar frente + reverso)
    let wMin = Infinity, wMax = -Infinity;
    let topMaxY = -Infinity;
    let topSumX = 0, topSumZ = 0, topCount = 0;

    for (const tr of tris3D) {
        const wa = tr.ax * nfx + tr.ay * nfy + tr.az * nfz;
        const wb = tr.bx * nfx + tr.by * nfy + tr.bz * nfz;
        const wc = tr.cx * nfx + tr.cy * nfy + tr.cz * nfz;
        if (wa < wMin) wMin = wa; if (wa > wMax) wMax = wa;
        if (wb < wMin) wMin = wb; if (wb > wMax) wMax = wb;
        if (wc < wMin) wMin = wc; if (wc > wMax) wMax = wc;
        if (tr.ay > topMaxY) topMaxY = tr.ay;
        if (tr.by > topMaxY) topMaxY = tr.by;
        if (tr.cy > topMaxY) topMaxY = tr.cy;
    }

    for (const tr of tris3D) {
        for (const [px, py, pz] of [[tr.ax, tr.ay, tr.az], [tr.bx, tr.by, tr.bz], [tr.cx, tr.cy, tr.cz]]) {
            if (py >= topMaxY - 0.08) {
                topSumX += px;
                topSumZ += pz;
                topCount++;
            }
        }
    }

    const thicknessMm = Math.max(1, Math.round((wMax - wMin) * 1000));

    // Agrupar triángulos paralelos a +nFace y -nFace por plano de profundidad (buckets de 5mm)
    const plusBuckets = new Map<number, { tris: Tri3D[]; area: number }>();
    const minusBuckets = new Map<number, { tris: Tri3D[]; area: number }>();

    for (const tr of tris3D) {
        const dot = tr.nx * nfx + tr.ny * nfy + tr.nz * nfz;
        if (Math.abs(dot) < 0.82) continue;
        const cw = ((tr.ax + tr.bx + tr.cx) * nfx + (tr.ay + tr.by + tr.cy) * nfy + (tr.az + tr.bz + tr.cz) * nfz) / 3;
        const bucketKey = Math.round(cw / 0.005);
        const map = dot > 0 ? plusBuckets : minusBuckets;
        let entry = map.get(bucketKey);
        if (!entry) {
            entry = { tris: [], area: 0 };
            map.set(bucketKey, entry);
        }
        entry.tris.push(tr);
        entry.area += tr.area;
    }

    let bestPlus: { tris: Tri3D[]; area: number } = { tris: [], area: 0 };
    for (const b of plusBuckets.values()) {
        if (b.area > bestPlus.area) bestPlus = b;
    }
    let bestMinus: { tris: Tri3D[]; area: number } = { tris: [], area: 0 };
    for (const b of minusBuckets.values()) {
        if (b.area > bestMinus.area) bestMinus = b;
    }

    // Preferir cara frontal (+nFace) para mantener orientación visual idéntica al visor 3D
    const chosenFace = (bestPlus.area >= bestMinus.area * 0.95 && bestPlus.tris.length > 0)
        ? bestPlus.tris
        : bestMinus.tris;

    if (chosenFace.length === 0) return null;

    // 4. Proyectar triángulos de la cara elegida al plano (u, v) en milímetros
    let uMin = Infinity, uMax = -Infinity;
    let vMin = Infinity, vMax = -Infinity;

    const rawProjected: Array<[number, number, number, number, number, number]> = [];
    for (const tr of chosenFace) {
        const u0 = (tr.ax * ux + tr.ay * uy + tr.az * uz) * 1000;
        const v0 = (tr.ax * vx + tr.ay * vy + tr.az * vz) * 1000;
        const u1 = (tr.bx * ux + tr.by * uy + tr.bz * uz) * 1000;
        const v1 = (tr.bx * vx + tr.by * vy + tr.bz * vz) * 1000;
        const u2 = (tr.cx * ux + tr.cy * uy + tr.cz * uz) * 1000;
        const v2 = (tr.cx * vx + tr.cy * vy + tr.cz * vz) * 1000;

        uMin = Math.min(uMin, u0, u1, u2);
        uMax = Math.max(uMax, u0, u1, u2);
        vMin = Math.min(vMin, v0, v1, v2);
        vMax = Math.max(vMax, v0, v1, v2);
        rawProjected.push([u0, v0, u1, v1, u2, v2]);
    }

    const rawW = uMax - uMin;
    const rawH = vMax - vMin;
    if (rawW < 10 || rawH < 10) return null;

    const widthMm = snapNearCentimeterMm(rawW);
    const heightMm = snapNearCentimeterMm(rawH);
    const scaleX = widthMm / rawW;
    const scaleY = heightMm / rawH;

    const triangles2D: Tri2D[] = [];
    for (const [u0, v0, u1, v1, u2, v2] of rawProjected) {
        const x0 = (u0 - uMin) * scaleX;
        const y0 = (vMax - v0) * scaleY;
        const x1 = (u1 - uMin) * scaleX;
        const y1 = (vMax - v1) * scaleY;
        const x2 = (u2 - uMin) * scaleX;
        const y2 = (vMax - v2) * scaleY;

        const cross = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
        if (Math.abs(cross) < 2) continue;
        if (cross > 0) {
            triangles2D.push({ x0, y0, x1, y1, x2, y2 });
        } else {
            triangles2D.push({ x0, y0, x1: x2, y1: y2, x2: x1, y2: y1 });
        }
    }

    if (triangles2D.length === 0) return null;

    const { outerLoops, holeLoops, netAreaMm2 } = buildLoopsFromTriangles2D(triangles2D, widthMm, heightMm);
    const bboxAreaMm2 = widthMm * heightMm;
    const isRectangular = holeLoops.length === 0 && outerLoops.length === 1 && netAreaMm2 >= bboxAreaMm2 * 0.988;
    const hasCurvedEdges = detectCurvedLoop(outerLoops) || detectCurvedLoop(holeLoops);

    return {
        widthMm,
        heightMm,
        thicknessMm,
        netAreaM2: Number((netAreaMm2 / 1000000).toFixed(4)),
        outerLoops,
        holeLoops,
        triangles2D,
        isRectangular,
        hasCurvedEdges,
        topCenter3D: topCount > 0
            ? { x: topSumX / topCount, y: topMaxY + 0.20, z: topSumZ / topCount }
            : undefined
    };
}

// ============================================================================
// RECORTE SUTHERLAND-HODGMAN Y DETECCIÓN DE CAVIDADES LIBRES EN PIEZAS IRREGULARES
// ============================================================================

function clipPolygonAgainstRect(poly: Point2D[], minX: number, minY: number, maxX: number, maxY: number): Point2D[] {
    let pts = poly;
    if (pts.length < 3) return [];

    const clipEdge = (
        input: Point2D[],
        inside: (p: Point2D) => boolean,
        intersect: (a: Point2D, b: Point2D) => Point2D
    ): Point2D[] => {
        const out: Point2D[] = [];
        const n = input.length;
        if (n === 0) return out;
        for (let i = 0; i < n; i++) {
            const curr = input[i];
            const prev = input[(i - 1 + n) % n];
            const currIn = inside(curr);
            const prevIn = inside(prev);
            if (currIn) {
                if (!prevIn) out.push(intersect(prev, curr));
                out.push(curr);
            } else if (prevIn) {
                out.push(intersect(prev, curr));
            }
        }
        return out;
    };

    pts = clipEdge(pts, p => p.x >= minX, (a, b) => ({
        x: minX,
        y: a.y + ((minX - a.x) / ((b.x - a.x) || 1e-9)) * (b.y - a.y)
    }));
    pts = clipEdge(pts, p => p.x <= maxX, (a, b) => ({
        x: maxX,
        y: a.y + ((maxX - a.x) / ((b.x - a.x) || 1e-9)) * (b.y - a.y)
    }));
    pts = clipEdge(pts, p => p.y >= minY, (a, b) => ({
        x: a.x + ((minY - a.y) / ((b.y - a.y) || 1e-9)) * (b.x - a.x),
        y: minY
    }));
    pts = clipEdge(pts, p => p.y <= maxY, (a, b) => ({
        x: a.x + ((maxY - a.y) / ((b.y - a.y) || 1e-9)) * (b.x - a.x),
        y: maxY
    }));

    return pts;
}

function clipTrianglesToRect(
    tris: Tri2D[],
    minX: number, minY: number, maxX: number, maxY: number
): Tri2D[] {
    const out: Tri2D[] = [];
    for (const t of tris) {
        const poly = clipPolygonAgainstRect(
            [{ x: t.x0, y: t.y0 }, { x: t.x1, y: t.y1 }, { x: t.x2, y: t.y2 }],
            minX, minY, maxX, maxY
        );
        if (poly.length < 3) continue;
        for (let i = 1; i < poly.length - 1; i++) {
            const p0 = poly[0], p1 = poly[i], p2 = poly[i + 1];
            const cross = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
            if (Math.abs(cross) >= 2) {
                if (cross > 0) out.push({ x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
                else out.push({ x0: p0.x, y0: p0.y, x1: p2.x, y1: p2.y, x2: p1.x, y2: p1.y });
            }
        }
    }
    return out;
}

function transformTrianglesForPlacement(
    tris: Tri2D[],
    origW: number,
    origH: number,
    placedW: number,
    placedH: number,
    rotated: boolean
): Tri2D[] {
    if (!rotated) {
        const sx = origW > 0 ? placedW / origW : 1;
        const sy = origH > 0 ? placedH / origH : 1;
        return tris.map(t => ({
            x0: t.x0 * sx, y0: t.y0 * sy,
            x1: t.x1 * sx, y1: t.y1 * sy,
            x2: t.x2 * sx, y2: t.y2 * sy
        }));
    }
    // Rotación 90° horaria: (x, y) en [0, origW]x[0, origH] -> (origH - y, x) en [0, placedW]x[0, placedH]
    const sx = origH > 0 ? placedW / origH : 1;
    const sy = origW > 0 ? placedH / origW : 1;
    return tris.map(t => ({
        x0: (origH - t.y0) * sx, y0: t.x0 * sy,
        x1: (origH - t.y1) * sx, y1: t.x1 * sy,
        x2: (origH - t.y2) * sx, y2: t.x2 * sy
    }));
}

function transformLoopForPlacement(
    loop: Point2D[],
    origW: number,
    origH: number,
    px: number,
    py: number,
    placedW: number,
    placedH: number,
    rotated: boolean
): Point2D[] {
    if (!rotated) {
        const sx = origW > 0 ? placedW / origW : 1;
        const sy = origH > 0 ? placedH / origH : 1;
        return loop.map(pt => ({
            x: px + pt.x * sx,
            y: py + pt.y * sy
        }));
    }
    const sx = origH > 0 ? placedW / origH : 1;
    const sy = origW > 0 ? placedH / origW : 1;
    return loop.map(pt => ({
        x: px + (origH - pt.y) * sx,
        y: py + pt.x * sy
    }));
}

/**
 * Busca el mayor rectángulo inscrito en celdas con valor `targetVal` usando histograma + pila monótona.
 */
function findLargestRectInGrid(
    grid: Uint8Array,
    cols: number,
    rows: number,
    targetVal: number,
    preferAspectForText: boolean = false
): { c0: number; r0: number; cw: number; rh: number; score: number } | null {
    const heights = new Int32Array(cols);
    const stackCols = new Int32Array(cols + 1);
    const stackHeights = new Int32Array(cols + 1);

    let best: { c0: number; r0: number; cw: number; rh: number; score: number } | null = null;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            heights[c] = grid[r * cols + c] === targetVal ? heights[c] + 1 : 0;
        }

        let top = 0;
        for (let c = 0; c <= cols; c++) {
            const curH = c < cols ? heights[c] : 0;
            let startCol = c;
            while (top > 0 && stackHeights[top - 1] > curH) {
                const h = stackHeights[top - 1];
                const leftCol = stackCols[top - 1];
                top--;
                const w = c - leftCol;
                const score = preferAspectForText
                    ? (w * h) * Math.min(w, h * 2.5)
                    : (w * h);
                if (!best || score > best.score) {
                    best = { c0: leftCol, r0: r - h + 1, cw: w, rh: h, score };
                }
                startCol = leftCol;
            }
            stackCols[top] = startCol;
            stackHeights[top] = curH;
            top++;
        }
    }

    return best && best.cw > 0 && best.rh > 0 ? best : null;
}

/**
 * Extrae los rectángulos libres reales (respetando margen de sierra `kerf`) dentro de escotes en L, U, arcos
 * o perforaciones grandes de una pieza irregular ya orientada en [0, placedW] × [0, placedH].
 */
function extractEmptyRectsFromPlacedPiece(
    placedTris: Tri2D[],
    placedW: number,
    placedH: number,
    kerf: number
): FreeRect[] {
    if (placedTris.length === 0 || placedW < 150 || placedH < 150) return [];

    const cellMm = Math.max(10, Math.round(Math.max(placedW, placedH) / 160));
    const cols = Math.max(4, Math.ceil(placedW / cellMm));
    const rows = Math.max(4, Math.ceil(placedH / cellMm));
    const stepX = placedW / cols;
    const stepY = placedH / rows;
    const pad = Math.max(2, kerf + 2);

    // 1 = material ocupado + margen de sierra, 0 = espacio libre seguro
    const grid = new Uint8Array(cols * rows);

    for (const t of placedTris) {
        const minX = Math.min(t.x0, t.x1, t.x2) - pad;
        const maxX = Math.max(t.x0, t.x1, t.x2) + pad;
        const minY = Math.min(t.y0, t.y1, t.y2) - pad;
        const maxY = Math.max(t.y0, t.y1, t.y2) + pad;

        const c0 = Math.max(0, Math.floor(minX / stepX));
        const c1 = Math.min(cols - 1, Math.floor(maxX / stepX));
        const r0 = Math.max(0, Math.floor(minY / stepY));
        const r1 = Math.min(rows - 1, Math.floor(maxY / stepY));

        for (let r = r0; r <= r1; r++) {
            const boxMinY = r * stepY - pad;
            const boxMaxY = (r + 1) * stepY + pad;
            for (let c = c0; c <= c1; c++) {
                if (grid[r * cols + c]) continue;
                const boxMinX = c * stepX - pad;
                const boxMaxX = (c + 1) * stepX + pad;
                if (triangleIntersectsBox2D(t, boxMinX, boxMinY, boxMaxX, boxMaxY)) {
                    grid[r * cols + c] = 1;
                }
            }
        }
    }

    const freeRects: FreeRect[] = [];
    for (let iter = 0; iter < 4; iter++) {
        const best = findLargestRectInGrid(grid, cols, rows, 0, false);
        if (!best) break;
        const rx = Math.ceil(best.c0 * stepX);
        const ry = Math.ceil(best.r0 * stepY);
        const rw = Math.floor((best.c0 + best.cw) * stepX) - rx;
        const rh = Math.floor((best.r0 + best.rh) * stepY) - ry;

        if (rw < 100 || rh < 100 || (rw * rh) < 25000) break;
        freeRects.push({ x: rx, y: ry, w: rw, h: rh });

        for (let r = best.r0; r < best.r0 + best.rh; r++) {
            for (let c = best.c0; c < best.c0 + best.cw; c++) {
                grid[r * cols + c] = 2; // marcar cavidad ya extraída
            }
        }
    }

    return freeRects;
}

/**
 * Halla la caja sólida más amplia dentro de una pieza irregular/perforada para ubicar su etiqueta SVG
 * sin caer jamás dentro de un agujero ni sobre el aire de un corte en L.
 */
function findBestSolidLabelBox(placedTris: Tri2D[], placedW: number, placedH: number): FreeRect {
    if (placedTris.length === 0 || placedW < 40 || placedH < 40) {
        return { x: 0, y: 0, w: placedW, h: placedH };
    }
    const cols = Math.min(80, Math.max(12, Math.round(placedW / 25)));
    const rows = Math.min(80, Math.max(12, Math.round(placedH / 25)));
    const stepX = placedW / cols;
    const stepY = placedH / rows;
    const grid = new Uint8Array(cols * rows);

    for (const t of placedTris) {
        const c0 = Math.max(0, Math.floor(Math.min(t.x0, t.x1, t.x2) / stepX));
        const c1 = Math.min(cols - 1, Math.floor(Math.max(t.x0, t.x1, t.x2) / stepX));
        const r0 = Math.max(0, Math.floor(Math.min(t.y0, t.y1, t.y2) / stepY));
        const r1 = Math.min(rows - 1, Math.floor(Math.max(t.y0, t.y1, t.y2) / stepY));
        for (let r = r0; r <= r1; r++) {
            const cy = (r + 0.5) * stepY;
            for (let c = c0; c <= c1; c++) {
                if (grid[r * cols + c]) continue;
                const cx = (c + 0.5) * stepX;
                if (pointInTriangle2D(cx, cy, t)) {
                    grid[r * cols + c] = 1;
                }
            }
        }
    }

    const best = findLargestRectInGrid(grid, cols, rows, 1, true);
    if (!best) return { x: 0, y: 0, w: placedW, h: placedH };
    return {
        x: best.c0 * stepX,
        y: best.r0 * stepY,
        w: best.cw * stepX,
        h: best.rh * stepY
    };
}

function subtractDisjointBoxes(baseBoxes: FreeRect[], cutouts: FreeRect[]): FreeRect[] {
    let current = [...baseBoxes];
    for (const cut of cutouts) {
        const next: FreeRect[] = [];
        for (const b of current) {
            const ix1 = Math.max(b.x, cut.x);
            const iy1 = Math.max(b.y, cut.y);
            const ix2 = Math.min(b.x + b.w, cut.x + cut.w);
            const iy2 = Math.min(b.y + b.h, cut.y + cut.h);
            if (ix1 >= ix2 || iy1 >= iy2) {
                next.push(b);
                continue;
            }
            if (iy1 > b.y) next.push({ x: b.x, y: b.y, w: b.w, h: iy1 - b.y });
            if (iy2 < b.y + b.h) next.push({ x: b.x, y: iy2, w: b.w, h: (b.y + b.h) - iy2 });
            if (ix1 > b.x) next.push({ x: b.x, y: iy1, w: ix1 - b.x, h: iy2 - iy1 });
            if (ix2 < b.x + b.w) next.push({ x: ix2, y: iy1, w: (b.x + b.w) - ix2, h: iy2 - iy1 });
        }
        current = next.filter(r => r.w > 2 && r.h > 2);
    }
    return current;
}

// ============================================================================
// EXTRACCIÓN DE PIEZAS DE MUROS MODULARES
// ============================================================================

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
 * Extrae las piezas de muros modulares del listado global de elementos, incorporando su perfil 2D exacto.
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
        const profile2D = bounds3D?.profile2D || null;

        let lengthMm: number;
        let heightMm: number;
        let thicknessMm: number = 18;

        if (profile2D && profile2D.widthMm >= 20 && profile2D.heightMm >= 20) {
            lengthMm = profile2D.widthMm;
            heightMm = profile2D.heightMm;
            if (profile2D.thicknessMm >= 1 && profile2D.thicknessMm <= 300) {
                thicknessMm = profile2D.thicknessMm === 2 || profile2D.thicknessMm === 3 ? 2.5 : profile2D.thicknessMm;
            }
        } else if (bounds3D && bounds3D.widthM > 0.05 && bounds3D.heightM > 0.05) {
            const lm = roundToModularStepM(bounds3D.widthM, 0.01);
            const hm = roundToModularStepM(bounds3D.heightM, 0.01);
            lengthMm = Math.round(lm * 1000);
            heightMm = Math.round(hm * 1000);
            if (bounds3D.depthM > 0 && bounds3D.depthM < 0.30) {
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
            const lm = roundToModularStepM(rawLengthM, 0.01);
            const hm = roundToModularStepM(rawHeightM, 0.01);
            lengthMm = Math.round(lm * 1000);
            heightMm = Math.round(hm * 1000);
        }

        const lengthM = Number((lengthMm / 1000).toFixed(3));
        const heightM = Number((heightMm / 1000).toFixed(3));

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
        const cleanMaterial = normalizeMaterialLabel(el.material);
        const rawNomInt = String(el.nombreIntegrado || el.name || 'Muro Modular').replace(/[<>]/g, '').trim();

        const rectAreaM2 = (lengthMm * heightMm) / 1000000;
        const rawElemArea = Number(el.area || 0);

        let areaM2 = Number(rectAreaM2.toFixed(4));
        let outerLoops: Point2D[][] | undefined;
        let holeLoops: Point2D[][] | undefined;
        let triangles2D: Tri2D[] | undefined;
        let isIrregular = false;
        let holeCount = 0;
        let hasCurvedEdges = false;

        if (profile2D) {
            isIrregular = !profile2D.isRectangular;
            holeCount = profile2D.holeLoops.length;
            hasCurvedEdges = profile2D.hasCurvedEdges;
            if (isIrregular) {
                areaM2 = profile2D.netAreaM2 > 0 ? profile2D.netAreaM2 : (rawElemArea > 0 ? Number(rawElemArea.toFixed(4)) : areaM2);
                outerLoops = profile2D.outerLoops;
                holeLoops = profile2D.holeLoops;
                triangles2D = profile2D.triangles2D;
            }
        } else if (rawElemArea > 0 && rawElemArea < rectAreaM2 * 0.96) {
            areaM2 = Number(rawElemArea.toFixed(4));
        }

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
            areaM2,
            thicknessMm,
            level: String(el.level || 'General').replace(/[<>]/g, '').trim(),
            elementRef: el,
            outerLoops,
            holeLoops,
            triangles2D,
            isIrregular,
            holeCount,
            hasCurvedEdges
        });
    });

    return pieces;
}

// ============================================================================
// MOTOR DE OPTIMIZACIÓN MAXRECTS + NESTING EN CAVIDADES DE PIEZAS IRREGULARES
// ============================================================================

type MaxRectsHeuristic = 'BSSF' | 'BAF' | 'BLSF' | 'BL';

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

        const pieceBBoxMm2 = piece.width * piece.height;
        const netRatio = pieceBBoxMm2 > 0
            ? Math.min(1, Math.max(0.01, (piece.areaM2 * 1000000) / pieceBBoxMm2))
            : 1;

        this.usedAreaMm2 += (actualW * actualH) * netRatio;
        this.nominalAreaMm2 += (pw * ph) * netRatio;

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

        // Si la pieza es irregular (L, U, vanos, perforación grande), recuperar cavidades rectangulares libres
        let solidObstacles: FreeRect[] = [pieceWithKerf];
        if (piece.isIrregular && piece.triangles2D && piece.triangles2D.length > 0 && netRatio < 0.94) {
            const placedTris = transformTrianglesForPlacement(
                piece.triangles2D,
                piece.width,
                piece.height,
                actualW,
                actualH,
                rotated
            );
            const localFree = extractEmptyRectsFromPlacedPiece(placedTris, actualW, actualH, kerf);
            if (localFree.length > 0) {
                const boardFreeCavities = localFree.map(r => ({
                    x: px + r.x,
                    y: py + r.y,
                    w: r.w,
                    h: r.h
                }));
                solidObstacles = subtractDisjointBoxes([pieceWithKerf], boardFreeCavities);
            }
        }

        for (const obs of solidObstacles) {
            this.occupiedBoxes.push(obs);
            const nextFreeRects: FreeRect[] = [];
            for (const fr of this.freeRects) {
                this.splitFreeRect(fr, obs, nextFreeRects);
            }
            this.freeRects = this.pruneFreeRects(nextFreeRects);
        }
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

                const optA: FreeRect[] = [];
                if (iy1 > wr.y) optA.push({ x: wr.x, y: wr.y, w: wr.w, h: iy1 - wr.y });
                if (iy2 < wr.y + wr.h) optA.push({ x: wr.x, y: iy2, w: wr.w, h: (wr.y + wr.h) - iy2 });
                if (ix1 > wr.x) optA.push({ x: wr.x, y: iy1, w: ix1 - wr.x, h: iy2 - iy1 });
                if (ix2 < wr.x + wr.w) optA.push({ x: ix2, y: iy1, w: (wr.x + wr.w) - ix2, h: iy2 - iy1 });

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

        const hasIrregularOrHoles = this.placedPieces.some(pp => pp.piece.isIrregular || (pp.piece.holeCount || 0) > 0);
        const effectiveMm2 = !hasIrregularOrHoles && wasteRects.length === 0 && this.nominalAreaMm2 >= sheetAreaMm2 * 0.996
            ? sheetAreaMm2
            : Math.min(sheetAreaMm2, this.usedAreaMm2);

        const usedAreaM2 = Number((effectiveMm2 / 1000000).toFixed(4));
        const efficiencyPercent = sheetAreaM2 > 0
            ? Math.min(100, Number(((effectiveMm2 / sheetAreaMm2) * 100).toFixed(1)))
            : 0;
        const wasteAreaM2 = !hasIrregularOrHoles && wasteRects.length === 0 && efficiencyPercent >= 99.9
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
 * Subdivide una pieza en una grilla ortogonal de pasos máximos (stepW × stepH),
 * recortando con exactitud geométrica cualquier perfil irregular, curva o perforación.
 */
function splitPieceByGrid(p: ModularPiece, stepW: number, stepH: number, alignEnd: boolean = false): ModularPiece[] {
    const cols = Math.max(1, Math.ceil((p.width - 1) / stepW));
    const rows = Math.max(1, Math.ceil((p.height - 1) / stepH));
    const totalGridCells = cols * rows;
    if (totalGridCells === 1) {
        return [{
            ...p,
            width: Math.min(p.width, stepW),
            height: Math.min(p.height, stepH)
        }];
    }

    const firstStepH = alignEnd && rows > 1 ? ((p.height % stepH) || stepH) : stepH;
    const firstStepW = alignEnd && cols > 1 ? ((p.width % stepW) || stepW) : stepW;

    const result: ModularPiece[] = [];
    let yOffset = 0;
    let remH = p.height;
    let py = 1;

    while (remH > 0.5) {
        const curH = Math.round(Math.min(remH, py === 1 ? firstStepH : stepH));
        let xOffset = 0;
        let remW = p.width;
        let px = 1;

        while (remW > 0.5) {
            const curW = Math.round(Math.min(remW, px === 1 ? firstStepW : stepW));
            const idx = (py - 1) * cols + px;

            if (p.isIrregular && p.triangles2D && p.triangles2D.length > 0) {
                const clipped = clipTrianglesToRect(
                    p.triangles2D,
                    xOffset,
                    yOffset,
                    xOffset + curW,
                    yOffset + curH
                );
                const clippedAreaMm2 = clipped.reduce((s, t) => s + triangleArea2D(t), 0);
                if (clipped.length > 0 && clippedAreaMm2 >= 100) {
                    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
                    for (const t of clipped) {
                        bx0 = Math.min(bx0, t.x0, t.x1, t.x2);
                        bx1 = Math.max(bx1, t.x0, t.x1, t.x2);
                        by0 = Math.min(by0, t.y0, t.y1, t.y2);
                        by1 = Math.max(by1, t.y0, t.y1, t.y2);
                    }
                    const subW = Math.max(10, Math.round(bx1 - bx0));
                    const subH = Math.max(10, Math.round(by1 - by0));
                    const localTris: Tri2D[] = clipped.map(t => ({
                        x0: Math.max(0, Math.min(subW, t.x0 - bx0)),
                        y0: Math.max(0, Math.min(subH, t.y0 - by0)),
                        x1: Math.max(0, Math.min(subW, t.x1 - bx0)),
                        y1: Math.max(0, Math.min(subH, t.y1 - by0)),
                        x2: Math.max(0, Math.min(subW, t.x2 - bx0)),
                        y2: Math.max(0, Math.min(subH, t.y2 - by0))
                    }));

                    const { outerLoops, holeLoops, netAreaMm2 } = buildLoopsFromTriangles2D(localTris, subW, subH);
                    const subIsRect = holeLoops.length === 0 && outerLoops.length === 1 && netAreaMm2 >= subW * subH * 0.988;
                    const wM = Number((subW / 1000).toFixed(3));
                    const hM = Number((subH / 1000).toFixed(3));

                    result.push({
                        ...p,
                        id: `${p.id}-P${idx}`,
                        width: subW,
                        height: subH,
                        widthM: wM,
                        heightM: hM,
                        dimensionsLabelM: `${wM.toFixed(2)} × ${hM.toFixed(2)} m`,
                        areaM2: Number((netAreaMm2 / 1000000).toFixed(4)),
                        isSplit: true,
                        partIndex: idx,
                        totalParts: totalGridCells,
                        outerLoops: subIsRect ? undefined : outerLoops,
                        holeLoops: subIsRect ? undefined : holeLoops,
                        triangles2D: subIsRect ? undefined : localTris,
                        isIrregular: !subIsRect,
                        holeCount: holeLoops.length,
                        hasCurvedEdges: detectCurvedLoop(outerLoops) || detectCurvedLoop(holeLoops)
                    });
                }
            } else {
                const wM = Number((curW / 1000).toFixed(3));
                const hM = Number((curH / 1000).toFixed(3));
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
                    totalParts: totalGridCells
                });
            }

            xOffset += curW;
            remW -= curW;
            px++;
        }
        yOffset += curH;
        remH -= curH;
        py++;
    }
    return result;
}

function modulatePiecesForSheet(
    pieces: ModularPiece[],
    usableW: number,
    usableH: number,
    allowRot: boolean,
    mode: 'LANDSCAPE' | 'PORTRAIT' | 'SMART' | 'SMART_END' | 'LANDSCAPE_END'
): ModularPiece[] {
    const tol = 2;
    const alignEnd = mode === 'SMART_END' || mode === 'LANDSCAPE_END';
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

        const landscapeParts = splitPieceByGrid(p, usableW, usableH, alignEnd);
        if (!allowRot || usableW === usableH) {
            out.push(...landscapeParts);
            continue;
        }

        const portraitParts = splitPieceByGrid(p, usableH, usableW, alignEnd);
        if (mode === 'LANDSCAPE' || mode === 'LANDSCAPE_END') {
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
        // 1. Piezas con cavidades/mayor envolvente primero para permitir anidar piezas menores dentro de L/U
        (a, b) => (b.width * b.height) - (a.width * a.height) || Math.max(b.width, b.height) - Math.max(a.width, a.height),
        // 2. Mayor área neta real primero
        (a, b) => b.areaM2 - a.areaM2 || (b.width * b.height) - (a.width * a.height),
        // 3. Mayor lado largo primero
        (a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height) || (b.width * b.height) - (a.width * a.height),
        // 4. Mayor lado corto primero
        (a, b) => Math.min(b.width, b.height) - Math.min(a.width, a.height) || Math.max(b.width, b.height) - Math.max(a.width, a.height),
        // 5. Mayor perímetro primero
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
 * Algoritmo 2D MaxRects Cutting Stock / Bin Packing Industrial con modulación adaptativa,
 * soporte exacto de contornos/perforaciones y aprovechamiento de cavidades internas.
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

    for (const [groupMaterial, rawGroupPieces] of materialGroups.entries()) {
        const groupThickness = rawGroupPieces[0].thicknessMm;
        const totalNetAreaMm2 = rawGroupPieces.reduce((s, p) => s + p.areaM2 * 1000000, 0);
        const minTheoreticalSheets = Math.max(1, Math.ceil((totalNetAreaMm2 * 0.995) / (usableW * usableH)));

        const hasOversizedIrregular = rawGroupPieces.some(p => p.isIrregular && (p.width > usableW + 2 || p.height > usableH + 2));
        const candidateModes: Array<'LANDSCAPE' | 'PORTRAIT' | 'SMART' | 'SMART_END' | 'LANDSCAPE_END'> = allowRot
            ? (hasOversizedIrregular ? ['SMART', 'SMART_END', 'PORTRAIT', 'LANDSCAPE', 'LANDSCAPE_END'] : ['SMART', 'PORTRAIT', 'LANDSCAPE'])
            : (hasOversizedIrregular ? ['LANDSCAPE', 'LANDSCAPE_END'] : ['LANDSCAPE']);

        let winnerBins: MaxRectsSheet[] | null = null;
        let winnerPieceCount = Infinity;

        for (const mode of candidateModes) {
            let modPieces = reindexSplitParts(modulatePiecesForSheet(rawGroupPieces, usableW, usableH, allowRot, mode));
            let bins = packGroupMultiStrategy(modPieces, groupMaterial, groupThickness, sheetW, sheetH, kerf, trim, allowRot, getPieceColor);

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
                break;
            }
        }

        if (winnerBins) {
            for (const bin of winnerBins) {
                for (const pp of bin.placedPieces) {
                    pp.orderIndex = globalOrderCounter++;
                }
                finalSheets.push(bin.toCutSheet(globalSheetCounter++));
            }
        }
    }

    return finalSheets;
}

function loopsToSvgPathD(loops: Point2D[][]): string {
    return loops
        .filter(loop => loop.length >= 3)
        .map(loop => {
            const cmds = loop.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`);
            return `${cmds.join(' ')} Z`;
        })
        .join(' ');
}

/**
 * Genera el SVG interactivo de alta precisión para representar el plano de corte de la lámina,
 * dibujando con exactitud geometrías en L, diagonales, curvas y perforaciones internas.
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

                const shapeNote = (p.piece.holeCount || 0) > 0
                    ? `&#10;Perforaciones internas: ${p.piece.holeCount}`
                    : (p.piece.isIrregular ? '&#10;Perfil especial / no rectangular' : '');

                const tooltip = `${safeName}&#10;Corte #${p.orderIndex}&#10;Envolvente: ${(p.w / 1000).toFixed(2)} × ${(p.h / 1000).toFixed(2)} m${p.rotated ? ' (Rotado 90°)' : ''}&#10;Área neta: ${p.piece.areaM2.toFixed(3)} m²&#10;Nivel: ${safeLevel}&#10;Tag: ${safeTag}&#10;Material: ${safeMat}${shapeNote}${p.piece.isSplit ? `&#10;Módulo ${p.piece.partIndex || 1} de ${p.piece.totalParts || 2}` : ''}`;

                let shapeSvg = '';
                let labelBox: FreeRect = { x: p.x, y: p.y, w: p.w, h: p.h };

                if (p.piece.isIrregular && p.piece.outerLoops && p.piece.outerLoops.length > 0) {
                    const placedOuter = p.piece.outerLoops.map(loop =>
                        transformLoopForPlacement(loop, p.piece.width, p.piece.height, p.x, p.y, p.w, p.h, p.rotated)
                    );
                    const placedHoles = (p.piece.holeLoops || []).map(loop =>
                        transformLoopForPlacement(loop, p.piece.width, p.piece.height, p.x, p.y, p.w, p.h, p.rotated)
                    );

                    const outerD = loopsToSvgPathD(placedOuter);
                    const holesD = loopsToSvgPathD(placedHoles);
                    const compoundD = holesD ? `${outerD} ${holesD}` : outerD;

                    shapeSvg = `
                    ${holesD ? `
                        <path d="${holesD}"
                              fill="url(#wastePattern-${sheet.sheetIndex})"
                              stroke="#dc2626" stroke-width="${Math.max(1.5, strokePiece * 0.85)}"
                              stroke-dasharray="6,4" />
                    ` : ''}
                    <path d="${compoundD}"
                          fill="${p.color}" fill-opacity="0.90" fill-rule="evenodd"
                          stroke="#0f172a" stroke-width="${strokePiece}" stroke-linejoin="round"
                          class="q-despiece-piece-rect"
                          data-id="${safeId}">
                        <title>${tooltip}</title>
                    </path>
                    `;

                    if (p.piece.triangles2D && p.piece.triangles2D.length > 0) {
                        const placedTris = transformTrianglesForPlacement(
                            p.piece.triangles2D,
                            p.piece.width,
                            p.piece.height,
                            p.w,
                            p.h,
                            p.rotated
                        );
                        const bestLocalBox = findBestSolidLabelBox(placedTris, p.w, p.h);
                        labelBox = {
                            x: p.x + bestLocalBox.x,
                            y: p.y + bestLocalBox.y,
                            w: bestLocalBox.w,
                            h: bestLocalBox.h
                        };
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

                const rotateText = labelBox.h > labelBox.w * 1.55 && labelBox.w < baseScale * 0.24;
                const availW = rotateText ? labelBox.h : labelBox.w;
                const availH = rotateText ? labelBox.w : labelBox.h;
                const maxChars = Math.max(line1.length, line2.length, 6);

                const maxFont = Math.round(baseScale * 0.036);
                const fontByW = (availW * 0.86) / (maxChars * 0.57);
                const fontByH2 = (availH * 0.78) / 2.35;
                const twoLineFont = Math.round(Math.min(maxFont, fontByW, fontByH2));

                const cx = labelBox.x + labelBox.w / 2;
                const cy = labelBox.y + labelBox.h / 2;
                const rotAttr = rotateText ? `transform="rotate(-90, ${cx}, ${cy})"` : '';

                let labelSvg = '';
                if (twoLineFont >= Math.round(baseScale * 0.012) && availW >= 100 && availH >= 60) {
                    const subFont = Math.max(Math.round(baseScale * 0.010), Math.round(twoLineFont * 0.82));
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
                } else if (availW >= 50 && availH >= 32) {
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
