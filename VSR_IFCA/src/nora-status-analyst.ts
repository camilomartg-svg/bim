/**
 * nora AI — Analista de Estados de Avance (Control de Avance / STATUS)
 *
 * Interpreta preguntas en lenguaje natural sobre estados de construcción y
 * responde con datos REALES leídos de window.noraStatusAPI (expuesta por el
 * módulo STATUS de main.ts). También genera la acción 3D correspondiente
 * (aislar/colorear por estado, por clasificación y por nivel).
 *
 * Ejemplos que entiende:
 *  - "¿Cuál es el avance general?"            - "Aísla los elementos en progreso"
 *  - "¿Cuántas vigas rechazadas hay en el piso 3?"
 *  - "Muéstrame los elementos críticos"        - "Avance por piso" / "por clasificación"
 *  - "¿Qué piso va más atrasado?"              - "Pinta el modelo por estado"
 *  - "Pendientes de columnas"                  - "Haz un informe de avance"
 */

export type StatusAIResult = { answer: string; action: any };

const STATUS_LABEL: Record<string, string> = {
    'NINGUNO': 'Pendientes (sin iniciar)',
    'EN PROGRESO': 'En progreso',
    'PARA INSPECCIÓN': 'Para inspección',
    'APROBADO': 'Aprobados',
    'CERRADO': 'Cerrados',
    'RECHAZADO': 'Rechazados',
    'CRITICO': 'Críticos'
};
const STATUS_ICON: Record<string, string> = {
    'NINGUNO': '⚪',
    'EN PROGRESO': '🟡',
    'PARA INSPECCIÓN': '🔵',
    'APROBADO': '🟢',
    'CERRADO': '✅',
    'RECHAZADO': '🔴',
    'CRITICO': '🚨'
};
const ALL_STATUSES = ['NINGUNO', 'EN PROGRESO', 'PARA INSPECCIÓN', 'APROBADO', 'CERRADO', 'RECHAZADO'];

const norm = (s: any) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const esc = (s: any) => String(s ?? '').replace(/[&<>'"*]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;', '*': '&#42;' }[c] || c));
const fmt = (n: number, d = 1) => (Math.round((n || 0) * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('es-CO');
const bar = (pct: number) => {
    const filled = Math.max(0, Math.min(10, Math.round((pct || 0) / 10)));
    return '▰'.repeat(filled) + '▱'.repeat(10 - filled);
};

const STATUS_PATTERNS: Array<[RegExp, string]> = [
    [/\b(rechazad[oa]s?|reprocesos?|no\s+conformes?)\b/, 'RECHAZADO'],
    [/\b(para\s+inspeccion|inspeccion(?:es)?|por\s+inspeccionar|por\s+revisar)\b/, 'PARA INSPECCIÓN'],
    [/\b(en\s+progreso|en\s+ejecucion|en\s+proceso|en\s+curso|ejecutandose|en\s+obra)\b/, 'EN PROGRESO'],
    [/\b(cerrad[oa]s?)\b/, 'CERRADO'],
    [/\b(aprobad[oa]s?|ejecutad[oa]s?|terminad[oa]s?|finalizad[oa]s?|completad[oa]s?)\b/, 'APROBADO'],
    [/\b(pendientes?|sin\s+iniciar|sin\s+estado|ningun[oa]?|no\s+iniciad[oa]s?|por\s+ejecutar|faltantes?|sin\s+empezar)\b/, 'NINGUNO'],
    [/\b(critic[oa]s?|en\s+riesgo|riesgos?|alertas?|estancad[oa]s?|vencid[oa]s?|problemas?|urgentes?)\b/, 'CRITICO']
];

const GENERIC_TOKENS = new Set([
    'estructural', 'estructura', 'arquitectura', 'arquitectonico', 'general', 'otros', 'otras', 'elementos',
    'elemento', 'modelo', 'generico', 'genericos', 'clasificacion', 'integrado', 'varios', 'sin', 'dato'
]);

/** ¿La consulta habla de estados / avance? */
export function isStatusIntent(query: string): boolean {
    const q = norm(query);
    // "pendiente" usado como inclinación (ej: tuberías con pendiente > 2%)
    const slopeUsage = /pendiente\s*(?:mayor|menor|superior|inferior|de|del|>|<|=|igual)?\s*(?:a|al|que)?\s*[0-9]/.test(q);
    if (/\b(avances?|progreso|porcentaje\s+de\s+(?:avance|ejecucion)|como\s+va|cuanto\s+va|estados?\b|semaforo|control\s+de\s+avance|atrasad[oa]s?|rezagad[oa]s?|adelantad[oa]s?)/.test(q)) return true;
    return STATUS_PATTERNS.some(([re, st]) => !(st === 'NINGUNO' && slopeUsage) && re.test(q));
}

/** ¿Pide un análisis profundo/narrativo (mejor resuelto por Gemini si hay API key)? */
export function isAnalyticStatusQuery(query: string): boolean {
    return /\b(analiza|analisis|diagnostic\w*|recomien\w*|sugier\w*|suger\w*|informe|reporte|resumen\s+ejecutivo|por\s*que|que\s+hago|conclusi\w*|evalua\w*|interpreta\w*|plan\s+de\s+accion|prioriza\w*)\b/.test(norm(query));
}

function getAPI(): any {
    return (window as any).noraStatusAPI || null;
}

function detectStatuses(q: string): string[] {
    const slopeUsage = /pendiente\s*(?:mayor|menor|superior|inferior|de|del|>|<|=|igual)?\s*(?:a|al|que)?\s*[0-9]/.test(q);
    const found: string[] = [];
    for (const [re, st] of STATUS_PATTERNS) {
        if (st === 'NINGUNO' && slopeUsage) continue;
        if (re.test(q)) found.push(st);
    }
    // "aprobados" incluye también los cerrados (equivalen a ejecutado)
    if (found.includes('APROBADO') && !found.includes('CERRADO') && !/\bsolo\s+aprobad/.test(q)) found.push('CERRADO');
    return found;
}

function detectLevel(q: string, levelNames: string[]): { levels: string[]; rest: string } {
    let rest = q;
    const sorted = [...levelNames].sort((a, b) => b.length - a.length);
    for (const name of sorted) {
        const n = norm(name);
        if (n.length >= 3 && rest.includes(n)) {
            return { levels: [name], rest: rest.replace(n, ' ') };
        }
    }
    const m = rest.match(/\b(piso|nivel|planta|level|sotano|cubierta|n|p)\s*-?\s*([0-9]+)\b/);
    if (m) {
        const word = m[1];
        const num = m[2];
        const candidates = levelNames.filter(name => {
            const nums = norm(name).match(/[0-9]+/g) || [];
            return nums.includes(num) || nums.includes(String(parseInt(num, 10)));
        });
        const isBasement = word === 'sotano';
        const preferred = candidates.filter(c => isBasement === norm(c).includes('sotano'));
        const pick = (preferred.length > 0 ? preferred : candidates);
        if (pick.length > 0) {
            const sameWord = pick.find(c => norm(c).includes(word));
            return { levels: [sameWord || pick[0]], rest: rest.replace(m[0], ' ') };
        }
    }
    return { levels: [], rest };
}

function detectClassifications(q: string, names: string[]): string[] {
    const scored: Array<{ name: string; score: number }> = [];
    for (const name of names) {
        const tokens = norm(name).split(/[^a-z0-9]+/).filter(t => t.length >= 4 && !GENERIC_TOKENS.has(t));
        if (tokens.length === 0) continue;
        let score = 0;
        for (const t of tokens) {
            const stem = t.replace(/(es|s)$/, '');
            if (stem.length >= 3 && new RegExp(`\\b${stem}`).test(q)) score++;
        }
        if (score > 0) scored.push({ name, score });
    }
    if (scored.length === 0) return [];
    const max = Math.max(...scored.map(s => s.score));
    return scored.filter(s => s.score === max).map(s => s.name);
}

function scopeLabel(classifications: string[], levels: string[]): string {
    const parts: string[] = [];
    if (classifications.length) parts.push(classifications.map(esc).join(', '));
    if (levels.length) parts.push(levels.map(esc).join(', '));
    return parts.length ? ` — ${parts.join(' · ')}` : '';
}

function summaryLines(s: any): string {
    const c = s.counts || {};
    const lines = [
        `${STATUS_ICON['APROBADO']} Aprobados/Cerrados: **${(c['APROBADO'] || 0) + (c['CERRADO'] || 0)}** (${fmt(s.pctAprobado)}%)`,
        `${STATUS_ICON['EN PROGRESO']} En progreso: **${c['EN PROGRESO'] || 0}** (${fmt(s.pct?.['EN PROGRESO'])}%)`,
        `${STATUS_ICON['PARA INSPECCIÓN']} Para inspección: **${c['PARA INSPECCIÓN'] || 0}** (${fmt(s.pct?.['PARA INSPECCIÓN'])}%)`,
        `${STATUS_ICON['NINGUNO']} Pendientes: **${c['NINGUNO'] || 0}** (${fmt(s.pctPendiente)}%)`,
        `${STATUS_ICON['RECHAZADO']} Rechazados: **${c['RECHAZADO'] || 0}** (${fmt(s.pctRechazado)}%)`
    ];
    return lines.map(l => `• ${l}`).join('\n');
}

function criticalLines(s: any, limit = 6): string {
    const cr = s.critical || {};
    if (!cr.total) return '✅ No hay elementos en estado crítico.';
    let out = `🚨 **${cr.total} elementos críticos**: ${cr.rechazados} rechazados · ${cr.inspeccionVencida} con inspección vencida (>${s.umbralesCriticos?.inspeccionDias}d) · ${cr.estancados} estancados en progreso (>${s.umbralesCriticos?.progresoDias}d)`;
    const top = (cr.top || []).slice(0, limit);
    if (top.length) {
        out += '\n' + top.map((e: any) => `  ▸ #${e.expressID} ${esc(e.name || e.classification)} · ${esc(e.level)} — ${esc(e.reason)}`).join('\n');
        if (cr.total > top.length) out += `\n  … y ${cr.total - top.length} más.`;
    }
    return out;
}

function laggards(groups: any[], label: string, n = 3): string {
    const valid = groups.filter(g => g.total >= 3);
    if (valid.length < 2) return '';
    const worst = [...valid].sort((a, b) => a.avancePonderado - b.avancePonderado).slice(0, n);
    return `🐢 **${label} más rezagados**: ` + worst.map(g => `${esc(g.name)} (${fmt(g.avancePonderado)}%)`).join(' · ');
}

function groupTable(groups: any[], status: string | null, max = 12): string {
    let rows = [...groups];
    if (status) {
        const key = status === 'CRITICO' ? 'criticos' : null;
        rows = rows
            .map(g => ({ ...g, _v: key ? g.criticos : (status === 'APROBADO' ? (g.counts['APROBADO'] || 0) + (g.counts['CERRADO'] || 0) : (g.counts[status] || 0)) }))
            .filter(g => g._v > 0)
            .sort((a, b) => b._v - a._v);
        if (rows.length === 0) return `No hay elementos ${STATUS_LABEL[status]?.toLowerCase() || status} en ningún grupo.`;
        return rows.slice(0, max).map(g => `• **${esc(g.name)}**: ${g._v} de ${g.total} (${fmt((g._v / g.total) * 100)}%)`).join('\n')
            + (rows.length > max ? `\n… y ${rows.length - max} más.` : '');
    }
    rows.sort((a, b) => a.avancePonderado - b.avancePonderado);
    return rows.slice(0, max).map(g =>
        `• **${esc(g.name)}** ${bar(g.avancePonderado)} ${fmt(g.avancePonderado)}% — ${g.counts['APROBADO'] + g.counts['CERRADO']}/${g.total} aprob.${g.counts['RECHAZADO'] ? ` · ${g.counts['RECHAZADO']} rech.` : ''}${g.criticos ? ` · 🚨${g.criticos}` : ''}`
    ).join('\n') + (rows.length > max ? `\n… y ${rows.length - max} grupos más.` : '');
}

/**
 * Resuelve una consulta de estados. Devuelve null si no es una consulta de estados.
 */
export function resolveStatusQuery(query: string, bimContext?: any): StatusAIResult | null {
    const q = norm(query);
    if (!isStatusIntent(q)) return null;

    const api = getAPI();
    if (!api) {
        return {
            answer: '⚠️ El módulo **Control de Avance (STATUS)** aún no está inicializado. Abre el panel de Control de Avance (botón "Avance") y vuelve a preguntar.',
            action: { type: 'none' }
        };
    }

    const base = api.getStats();
    if (!base || base.total === 0) {
        return { answer: 'ℹ️ No hay elementos con datos de avance. Carga un modelo con propiedades primero.', action: { type: 'none' } };
    }

    // ---------------- Parseo de la intención ----------------
    // Frases de desglose (se quitan antes de buscar clasificaciones para que "por piso" no active "PISOS / PLACAS")
    const byLevelReq = /\bpor\s+(pisos?|niveles?|plantas?)\b|\b(que|cual|cuales)\s+(pisos?|niveles?|plantas?)\b/.test(q);
    const byClassReq = /\bpor\s+(clasificacion(?:es)?|categorias?|tipos?|elementos?|disciplinas?|sistemas?)\b|\b(que|cual|cuales)\s+(clasificacion(?:es)?|categorias?|tipos?\s+de\s+elementos?)\b/.test(q);
    let qClean = q.replace(/\bpor\s+(pisos?|niveles?|plantas?|clasificacion(?:es)?|categorias?|tipos?|elementos?)\b/g, ' ')
        .replace(/\b(que|cual|cuales)\s+(pisos?|niveles?|plantas?)\b/g, ' ');

    const lvl = detectLevel(qClean, base.levelNames || []);
    const levels = lvl.levels;
    qClean = lvl.rest;
    const classifications = detectClassifications(qClean, base.classificationNames || []);

    const rankingWorst = /\b(atrasad[oa]s?|rezagad[oa]s?|menos\s+avance|menor\s+avance|peor(?:es)?|mas\s+lent[oa]s?|mas\s+bajo)\b/.test(q);
    const rankingBest = /\b(adelantad[oa]s?|mas\s+avance|mayor\s+avance|mejor(?:es)?|mas\s+avanzad[oa]s?|mas\s+alto)\b/.test(q);
    let statuses = detectStatuses(q);
    if ((rankingWorst || rankingBest) && (byLevelReq || byClassReq)) statuses = statuses.filter(s => s !== 'CRITICO');
    // "avance general ... y cuántos van aprobados" => resumen general (ya incluye los aprobados)
    const wantsGeneral = /\b(avance\s+general|avance\s+del\s+proyecto|estado\s+general|resumen\s+general|como\s+va\s+(?:el\s+)?proyecto)\b/.test(q);
    if (wantsGeneral && !/\b(aisla\w*|muestra\w*|resalta\w*|filtra\w*)\b/.test(q)) statuses = [];

    const wantsColorAll = /\b(colorea\w*|pinta\w*|colores?|semaforo|mapa\s+de\s+(?:estados?|avance))\b/.test(q) && statuses.length === 0;
    const wantsClearColors = /\b(quita\w*|apaga\w*|desactiva\w*|limpia\w*|borra\w*)\b.*\bcolor/.test(q);
    const hasVerb = /\b(aisla\w*|muestra\w*|mostrar|ver|ensena\w*|resalta\w*|filtra\w*|visualiza\w*|ubica\w*|donde|cuales|selecciona\w*|enfoca\w*|marca\w*)\b/.test(q);
    const isCountQuestion = /\b(cuant[oa]s?|porcentaje|que\s+tanto|numero\s+de|total\s+de)\b|%/.test(q);
    const asksSelected = /\b(este|esta|estos|estas|seleccionad[oa]s?|seleccion)\b/.test(q) && (bimContext?.selectedElements?.length || 0) > 0;
    const wantsReport = isAnalyticStatusQuery(q);

    const filters = { classifications: classifications.length ? classifications : undefined, levels: levels.length ? levels : undefined };
    const scoped = (classifications.length || levels.length) ? api.getStats(filters) : base;
    const scope = scopeLabel(classifications, levels);

    // ---------------- 1. Estado de la selección actual ----------------
    if (asksSelected) {
        const ids = new Set((bimContext.selectedElements || []).map((e: any) => Number(e.expressID)));
        const rows = api.getElements({}).filter((r: any) => ids.has(Number(r.expressID)));
        if (rows.length > 0) {
            const lines = rows.slice(0, 10).map((r: any) =>
                `• #${r.expressID} ${esc(r.name)} — ${STATUS_ICON[r.status]} **${r.status}**${r.lastChange ? ` (desde ${new Date(r.lastChange).toLocaleDateString('es-CO')})` : ''}${r.critical ? ` 🚨 ${esc(r.reason)}` : ''}`
            ).join('\n');
            return { answer: `📌 **Estado de la selección** (${rows.length}):\n${lines}`, action: { type: 'none' } };
        }
    }

    // ---------------- 2. Colorear / limpiar colores por estado ----------------
    if (wantsClearColors) {
        return { answer: '🎨 He desactivado los colores de estado en el visor.', action: { type: 'color', colorOverrides: { mode: 'status', clear: true }, message: 'Colores de estado desactivados' } };
    }
    if (wantsColorAll) {
        return {
            answer: `🎨 He coloreado el modelo por estado de avance.\n${summaryLines(base)}`,
            action: { type: 'color', colorOverrides: { mode: 'status' }, message: 'Modelo coloreado por estado' }
        };
    }

    // ---------------- 3. Ranking: qué piso / clasificación va más atrasado o adelantado ----------------
    if ((rankingWorst || rankingBest) && (byLevelReq || byClassReq || /\b(piso|nivel|clasificacion|categoria)\b/.test(q))) {
        const useLevels = byLevelReq || (/\b(piso|nivel|planta)\b/.test(q) && !byClassReq);
        const groups = (useLevels ? scoped.byLevel : scoped.byClassification).filter((g: any) => g.total >= 1);
        const sorted = [...groups].sort((a: any, b: any) => rankingWorst ? a.avancePonderado - b.avancePonderado : b.avancePonderado - a.avancePonderado);
        const top = sorted[0];
        if (!top) return { answer: 'No encontré grupos para comparar.', action: { type: 'none' } };
        const label = useLevels ? 'nivel' : 'clasificación';
        const list = sorted.slice(0, 5).map((g: any, i: number) => `${i + 1}. **${esc(g.name)}** ${bar(g.avancePonderado)} ${fmt(g.avancePonderado)}% (${g.total} elem.${g.counts['RECHAZADO'] ? `, ${g.counts['RECHAZADO']} rech.` : ''})`).join('\n');
        return {
            answer: `${rankingWorst ? '🐢' : '🚀'} El ${label} ${rankingWorst ? 'más atrasado' : 'más adelantado'} es **${esc(top.name)}** con ${fmt(top.avancePonderado)}% de avance ponderado.\n${list}\n\nHe aislado ese ${label} coloreado por estado.`,
            action: {
                type: 'status_isolate',
                statuses: ALL_STATUSES,
                levels: useLevels ? [top.name] : filters.levels,
                classifications: useLevels ? filters.classifications : [top.name],
                message: `Aislado ${top.name} por estado`
            }
        };
    }

    // ---------------- 4. Desglose por nivel o por clasificación ----------------
    if (byLevelReq || byClassReq) {
        const useLevels = byLevelReq && !byClassReq ? true : (byClassReq && !byLevelReq ? false : true);
        const groups = useLevels ? scoped.byLevel : scoped.byClassification;
        const st = statuses.length ? statuses[0] : null;
        const title = st
            ? `${STATUS_ICON[st]} **${STATUS_LABEL[st]} por ${useLevels ? 'nivel' : 'clasificación'}**${scope}`
            : `📊 **Avance por ${useLevels ? 'nivel' : 'clasificación'}**${scope} (ordenado de menor a mayor)`;
        return {
            answer: `${title}\n${groupTable(groups, st)}`,
            action: st && hasVerb
                ? { type: 'status_isolate', statuses: st === 'APROBADO' ? ['APROBADO', 'CERRADO'] : [st], classifications: filters.classifications, levels: filters.levels, message: `Aislados ${STATUS_LABEL[st]}` }
                : { type: 'none' }
        };
    }

    // ---------------- 5. Informe completo (motor local) ----------------
    if (wantsReport) {
        const recs: string[] = [];
        if (scoped.critical?.rechazados) recs.push(`Priorizar el reproceso de los **${scoped.critical.rechazados} rechazados**.`);
        if (scoped.critical?.inspeccionVencida) recs.push(`Programar inspección para **${scoped.critical.inspeccionVencida} elementos** con inspección vencida.`);
        if (scoped.critical?.estancados) recs.push(`Revisar frentes de obra con **${scoped.critical.estancados} elementos** estancados en progreso.`);
        if (scoped.pctPendiente > 50) recs.push(`El ${fmt(scoped.pctPendiente)}% sigue sin iniciar: verificar programación y recursos.`);
        if (scoped.cambiosUltimos7Dias === 0) recs.push('No hubo cambios de estado en los últimos 7 días: confirmar que el registro de avance esté al día.');
        const worstLvl = laggards(scoped.byLevel || [], 'Niveles');
        const worstCls = laggards(scoped.byClassification || [], 'Clasificaciones');
        return {
            answer: [
                `📋 **Informe de avance${scope}**`,
                `Avance ponderado: **${fmt(scoped.avancePonderado)}%** ${bar(scoped.avancePonderado)} · por volumen: **${fmt(scoped.avancePonderadoVolumen)}%**`,
                summaryLines(scoped),
                `🕒 Cambios de estado últimos 7 días: **${scoped.cambiosUltimos7Dias}**`,
                worstLvl, worstCls,
                criticalLines(scoped, 5),
                recs.length ? `💡 **Recomendaciones**\n${recs.map(r => `• ${r}`).join('\n')}` : ''
            ].filter(Boolean).join('\n\n'),
            action: { type: 'none' }
        };
    }

    // ---------------- 6. Elementos críticos ----------------
    if (statuses.includes('CRITICO') && statuses.length === 1) {
        const doIsolate = hasVerb || !isCountQuestion;
        const cr = scoped.critical || {};
        return {
            answer: `${criticalLines(scoped, 8)}${scope ? `\n(Filtro${scope})` : ''}${doIsolate && cr.total ? '\n\nHe aislado los críticos: 🔴 rechazados · 🟠 inspección vencida / estancados.' : ''}`,
            action: doIsolate && cr.total
                ? { type: 'status_isolate', statuses: ['CRITICO'], classifications: filters.classifications, levels: filters.levels, message: `Aislados ${cr.total} elementos críticos` }
                : { type: 'none' }
        };
    }

    // ---------------- 7. Estado(s) específico(s) ----------------
    if (statuses.length > 0) {
        const rows = api.getElements({ statuses, classifications: filters.classifications, levels: filters.levels });
        const vol = rows.reduce((a: number, r: any) => a + (r.volume || 0), 0);
        const area = rows.reduce((a: number, r: any) => a + (r.area || 0), 0);
        const label = statuses.filter(s => !(s === 'CERRADO' && statuses.includes('APROBADO'))).map(s => STATUS_LABEL[s]).join(' + ');
        const icon = STATUS_ICON[statuses[0]] || '📌';
        const doIsolate = hasVerb || !isCountQuestion;

        let answer = `${icon} **${label}${scope}: ${rows.length}** de ${scoped.total} elementos (${fmt(scoped.total ? (rows.length / scoped.total) * 100 : 0)}%)`;
        const metrics: string[] = [];
        if (vol > 0) metrics.push(`Vol: ${fmt(vol, 2)} m³`);
        if (area > 0) metrics.push(`Área: ${fmt(area, 2)} m²`);
        if (metrics.length) answer += ` · ${metrics.join(' · ')}`;

        if (rows.length > 0) {
            // ¿Dónde se concentran?
            const tally = (key: 'level' | 'classification') => {
                const m = new Map<string, number>();
                rows.forEach((r: any) => m.set(r[key], (m.get(r[key]) || 0) + 1));
                return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
            };
            if (!levels.length) answer += `\n📍 Por nivel: ${tally('level').map(([k, v]) => `${esc(k)} (${v})`).join(' · ')}`;
            if (!classifications.length) answer += `\n🏷️ Por clasificación: ${tally('classification').map(([k, v]) => `${esc(k)} (${v})`).join(' · ')}`;
            if (statuses.includes('RECHAZADO') || statuses.includes('PARA INSPECCIÓN') || statuses.includes('EN PROGRESO')) {
                const old = rows.filter((r: any) => r.daysInStatus !== null).sort((a: any, b: any) => (b.daysInStatus || 0) - (a.daysInStatus || 0)).slice(0, 3);
                if (old.length) answer += `\n⏱️ Más antiguos: ${old.map((r: any) => `#${r.expressID} (${r.daysInStatus}d)`).join(' · ')}`;
            }
            if (doIsolate) answer += '\n\nLos he aislado en el visor 3D y filtrado la tabla de Control de Avance.';
        }
        return {
            answer,
            action: doIsolate && rows.length > 0
                ? { type: 'status_isolate', statuses, classifications: filters.classifications, levels: filters.levels, message: `Aislados ${rows.length} elementos: ${label}` }
                : { type: 'none' }
        };
    }

    // ---------------- 8. Avance general (o de un alcance: vigas, piso 3, ...) ----------------
    const answer = [
        `📊 **Avance${scope || ' general del proyecto'}: ${fmt(scoped.avancePonderado)}%** ${bar(scoped.avancePonderado)}`,
        `Total: **${scoped.total}** elementos · ${fmt(scoped.pctAprobado)}% aprobados · avance por volumen ${fmt(scoped.avancePonderadoVolumen)}%`,
        summaryLines(scoped),
        scoped.critical?.total ? `🚨 **${scoped.critical.total} críticos** (${scoped.critical.rechazados} rechazados, ${scoped.critical.inspeccionVencida} inspección vencida, ${scoped.critical.estancados} estancados)` : '✅ Sin elementos críticos',
        !classifications.length ? laggards(scoped.byClassification || [], 'Clasificaciones') : '',
        `ℹ️ Avance ponderado: Aprobado/Cerrado 100% · Para inspección 80% · En progreso 40% · Pendiente/Rechazado 0%`
    ].filter(Boolean).join('\n');

    const isolateScope = hasVerb && (classifications.length > 0 || levels.length > 0);
    return {
        answer: answer + (isolateScope ? '\n\nHe aislado el alcance en 3D coloreado por estado.' : ''),
        action: isolateScope
            ? { type: 'status_isolate', statuses: ALL_STATUSES, classifications: filters.classifications, levels: filters.levels, message: `Aislado ${[...classifications, ...levels].join(' · ')} por estado` }
            : { type: 'none' }
    };
}

/** Resumen compacto de estados para inyectar en el prompt de Gemini. */
export function getStatusContextForLLM(): any {
    const api = getAPI();
    if (!api) return null;
    try {
        const s = api.getStats();
        return {
            total: s.total,
            counts: s.counts,
            pct: s.pct,
            pctAprobado: s.pctAprobado,
            avancePonderado: s.avancePonderado,
            avancePonderadoVolumen: s.avancePonderadoVolumen,
            pesosAvance: s.pesosAvance,
            volumenesPorEstado: s.volumes,
            critical: s.critical,
            umbralesCriticos: s.umbralesCriticos,
            cambiosUltimos7Dias: s.cambiosUltimos7Dias,
            byLevel: (s.byLevel || []).slice(0, 40),
            byClassification: (s.byClassification || []).slice(0, 40)
        };
    } catch (e) {
        return null;
    }
}
