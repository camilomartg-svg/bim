/**
 * nora AI Copilot - BIM & CDE Assistant Component
 * Integrates Google Gemini API with live BIM context and 3D viewer action dispatching.
 */

import './nora-ai-widget.css';

export interface NoraAIOptions {
    getBIMContext: () => any;
    execute3DAction: (action: NoraAIAction) => Promise<string | void>;
    apiKey?: string;
}

export interface NoraAIAction {
    type: 'isolate' | 'hide' | 'show_all' | 'filter' | 'color' | 'camera' | 'section' | 'none';
    classifications?: string[];
    categories?: string[];
    levels?: string[];
    materials?: string[];
    pilotes?: string[];
    numericFilter?: {
        property: 'height' | 'length' | 'volume' | 'area' | 'slope' | 'diameter';
        operator: '>' | '<' | '>=' | '<=' | '==' | 'between';
        value: number;
        value2?: number;
    };
    invertMatch?: boolean;
    cameraView?: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right' | 'iso' | 'focus' | 'reset';
    sectionBox?: {
        axis?: 'x' | 'y' | 'z';
        fitToElements?: boolean;
        clear?: boolean;
    };
    colorOverrides?: {
        mode?: 'status' | 'heatmap' | 'anomalies' | 'presence' | 'custom';
        palette?: Record<string, string>;
        clear?: boolean;
    };
    colorMode?: string;
    targetID?: number;
    message?: string;
}

export class NoraAIWidget {
    private options: NoraAIOptions;
    private isOpen: boolean = false;
    private isRecording: boolean = false;
    private recognition: any = null;
    private userApiKey: string = localStorage.getItem('NORA_GEMINI_KEY') || '';
    private chatHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    private drawerEl!: HTMLElement;
    private fabEl!: HTMLElement;
    private bodyEl!: HTMLElement;
    private inputEl!: HTMLInputElement;
    private sendBtnEl!: HTMLButtonElement;
    private voiceBtnEl!: HTMLButtonElement;

    constructor(options: NoraAIOptions) {
        this.options = options;
        this.initUI();
        this.initSpeechRecognition();
    }

    private initUI() {
        this.fabEl = document.createElement('button');
        this.fabEl.className = 'nora-ai-fab';
        this.fabEl.id = 'nora-ai-trigger';
        this.fabEl.title = 'Consultar nora AI Copilot';
        this.fabEl.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> <span>nora AI</span>';
        this.fabEl.addEventListener('click', () => this.toggle());

        const isApiKeyActive = !!(this.options.apiKey || this.userApiKey || (window as any).NORA_GEMINI_API_KEY);
        const subTitleText = isApiKeyActive ? 'Gemini Copilot (Online)' : 'BIM AI Engine (Local)';

        this.drawerEl = document.createElement('div');
        this.drawerEl.className = 'nora-ai-drawer';
        this.drawerEl.innerHTML = `
            <div class="nora-ai-header">
                <div class="nora-ai-title-area">
                    <div class="nora-ai-avatar">
                        <i class="fa-solid fa-sparkles"></i>
                    </div>
                    <div>
                        <div class="nora-ai-title">nora AI Copilot</div>
                        <div class="nora-ai-subtitle" id="nora-ai-status-text">
                            <i class="fa-solid fa-circle" style="color: ${isApiKeyActive ? '#34d399' : '#f59e0b'}; font-size: 8px;"></i> ${subTitleText}
                        </div>
                    </div>
                </div>
                <div class="nora-ai-header-actions">
                    <button class="nora-ai-header-btn" id="nora-ai-key" title="Configurar Gemini API Key">
                        <i class="fa-solid fa-key"></i>
                    </button>
                    <button class="nora-ai-header-btn" id="nora-ai-clear" title="Limpiar conversación">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                    <button class="nora-ai-header-btn" id="nora-ai-close" title="Cerrar">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>

            <div class="nora-ai-body" id="nora-ai-messages">
                <div class="nora-ai-prompts">
                    <button class="nora-ai-prompt-pill" data-prompt="Aísla los muros de más de 2.50 metros de altura en el Piso 3">
                        <i class="fa-solid fa-ruler-vertical"></i> Muros > 2.5m Piso 3
                    </button>
                    <button class="nora-ai-prompt-pill" data-prompt="Haz un corte transversal en el eje X y enfócate">
                        <i class="fa-solid fa-scissors"></i> Corte Transversal
                    </button>
                    <button class="nora-ai-prompt-pill" data-prompt="Pinta las anomalías de modelado en rojo y verde">
                        <i class="fa-solid fa-triangle-exclamation"></i> Auditar Anomalías
                    </button>
                    <button class="nora-ai-prompt-pill" data-prompt="Mapa de calor por volumen de elementos">
                        <i class="fa-solid fa-fire-flame-curved"></i> Mapa de Calor
                    </button>
                    <button class="nora-ai-prompt-pill" data-prompt="Aísla la estructura de concreto y drywall">
                        <i class="fa-solid fa-cubes"></i> Concreto y Drywall
                    </button>
                    <button class="nora-ai-prompt-pill" data-prompt="Muéstrame todo el modelo y limpia los filtros">
                        <i class="fa-solid fa-rotate-left"></i> Restablecer 3D
                    </button>
                </div>

                <div class="nora-ai-msg bot">
                    <div class="nora-ai-bubble">
                        👋 ¡Hola! Soy <b>nora AI Copilot</b>. Puedo responder preguntas sobre cantidades, redes hidrosanitarias, estructuras y <b>ejecutar aislamientos directamente en el visor 3D</b>. ¿Qué te gustaría consultar?
                    </div>
                </div>
            </div>

            <div class="nora-ai-footer">
                <div class="nora-ai-input-wrapper">
                    <input type="text" class="nora-ai-input" id="nora-ai-input" placeholder="Pregunta o pide aislar elementos en 3D..." autocomplete="off" />
                    <button class="nora-ai-voice-btn" id="nora-ai-voice" title="Dictar por voz">
                        <i class="fa-solid fa-microphone"></i>
                    </button>
                </div>
                <button class="nora-ai-send-btn" id="nora-ai-send" title="Enviar">
                    <i class="fa-solid fa-paper-plane"></i>
                </button>
            </div>
        `;

        const container = document.getElementById('nora-ai-container');
        if (container) {
            this.drawerEl.className = 'nora-ai-docked';
            container.appendChild(this.drawerEl);
            const closeBtn = this.drawerEl.querySelector('#nora-ai-close') as HTMLElement;
            if (closeBtn) closeBtn.style.display = 'none';
        } else {
            document.body.appendChild(this.fabEl);
            document.body.appendChild(this.drawerEl);
        }

        this.bodyEl = this.drawerEl.querySelector('#nora-ai-messages') as HTMLElement;
        this.inputEl = this.drawerEl.querySelector('#nora-ai-input') as HTMLInputElement;
        this.sendBtnEl = this.drawerEl.querySelector('#nora-ai-send') as HTMLButtonElement;
        this.voiceBtnEl = this.drawerEl.querySelector('#nora-ai-voice') as HTMLButtonElement;

        this.drawerEl.querySelector('#nora-ai-close')?.addEventListener('click', () => this.close());
        this.drawerEl.querySelector('#nora-ai-clear')?.addEventListener('click', () => this.clearChat());
        this.drawerEl.querySelector('#nora-ai-key')?.addEventListener('click', () => this.configureApiKey());

        this.sendBtnEl.addEventListener('click', () => this.handleSend());
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleSend();
        });

        this.bodyEl.addEventListener('click', (e) => {
            const pill = (e.target as HTMLElement).closest('.nora-ai-prompt-pill');
            if (pill) {
                const text = pill.getAttribute('data-prompt');
                if (text) {
                    this.inputEl.value = text;
                    this.handleSend();
                }
            }
        });
    }

    private configureApiKey() {
        const currentKey = this.userApiKey || this.options.apiKey || '';
        const inputKey = prompt('Configurar Google Gemini API Key (deja en blanco para usar el motor local BIM):', currentKey);
        if (inputKey !== null) {
            this.userApiKey = inputKey.trim();
            if (this.userApiKey) {
                localStorage.setItem('NORA_GEMINI_KEY', this.userApiKey);
            } else {
                localStorage.removeItem('NORA_GEMINI_KEY');
            }
            this.updateStatusText();
        }
    }

    private updateStatusText() {
        const statusEl = this.drawerEl.querySelector('#nora-ai-status-text');
        const activeKey = this.userApiKey || this.options.apiKey || (window as any).NORA_GEMINI_API_KEY;
        if (statusEl) {
            statusEl.innerHTML = activeKey
                ? `<i class="fa-solid fa-circle" style="color: #34d399; font-size: 8px;"></i> Gemini Copilot (Online)`
                : `<i class="fa-solid fa-circle" style="color: #f59e0b; font-size: 8px;"></i> BIM AI Engine (Local)`;
        }
    }

    private initSpeechRecognition() {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'es-ES';
            this.recognition.continuous = false;
            this.recognition.interimResults = false;

            this.recognition.onstart = () => {
                this.isRecording = true;
                this.voiceBtnEl.classList.add('recording');
                this.inputEl.placeholder = 'Escuchando...';
            };
            this.recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                this.inputEl.value = transcript;
                this.handleSend();
            };
            this.recognition.onerror = () => this.stopRecording();
            this.recognition.onend = () => this.stopRecording();

            this.voiceBtnEl.addEventListener('click', () => {
                if (this.isRecording) {
                    this.recognition.stop();
                } else {
                    this.recognition.start();
                }
            });
        } else {
            this.voiceBtnEl.style.display = 'none';
        }
    }

    private stopRecording() {
        this.isRecording = false;
        this.voiceBtnEl.classList.remove('recording');
        this.inputEl.placeholder = 'Pregunta o pide aislar elementos en 3D...';
    }

    public toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }

    public open() {
        this.isOpen = true;
        const rightPanel = document.getElementById('properties-panel');
        const noraTabBtn = document.getElementById('right-tab-nora');
        const propTabBtn = document.getElementById('right-tab-properties');
        const noraContainer = document.getElementById('nora-ai-container');
        const propContent = document.getElementById('properties-content');

        if (rightPanel) rightPanel.classList.remove('closed');
        if (noraTabBtn && propTabBtn && noraContainer && propContent) {
            noraTabBtn.classList.add('active');
            propTabBtn.classList.remove('active');
            noraContainer.style.display = 'flex';
            propContent.style.display = 'none';
        } else {
            this.drawerEl.classList.add('open');
        }
        this.inputEl.focus();
    }

    public close() {
        this.isOpen = false;
        const noraContainer = document.getElementById('nora-ai-container');
        if (!noraContainer) {
            const rightPanel = document.getElementById('properties-panel');
            if (rightPanel) rightPanel.classList.add('closed');
            if (this.drawerEl) this.drawerEl.classList.remove('open');
        }
    }

    private activeContext: {
        activeClassifications: string[];
        activeLevels: string[];
        activeCategories: string[];
        activeMaterials: string[];
        activePilotes: string[];
        lastActionType: string;
    } = {
        activeClassifications: [],
        activeLevels: [],
        activeCategories: [],
        activeMaterials: [],
        activePilotes: [],
        lastActionType: 'none'
    };

    public clearChat() {
        this.chatHistory = [];
        this.activeContext = { activeClassifications: [], activeLevels: [], activeCategories: [], activeMaterials: [], activePilotes: [], lastActionType: 'none' };
        this.bodyEl.innerHTML = `
            <div class="nora-ai-msg bot">
                <div class="nora-ai-bubble">
                    Conversación y contexto reiniciados. ¿En qué puedo ayudarte?
                </div>
            </div>
        `;
    }

    private appendUserMessage(text: string) {
        const msg = document.createElement('div');
        msg.className = 'nora-ai-msg user';
        msg.innerHTML = `<div class="nora-ai-bubble">${this.escapeHTML(text)}</div>`;
        this.bodyEl.appendChild(msg);
        this.scrollToBottom();
    }

    private appendBotMessage(htmlContent: string, actionBadge?: string) {
        const msg = document.createElement('div');
        msg.className = 'nora-ai-msg bot';
        
        let content = `<div class="nora-ai-bubble">${htmlContent}</div>`;
        if (actionBadge) {
            content += `<div class="nora-ai-action-badge"><i class="fa-solid fa-circle-check"></i> ${this.escapeHTML(actionBadge)}</div>`;
        }

        msg.innerHTML = content;
        this.bodyEl.appendChild(msg);
        this.scrollToBottom();
    }

    private showTypingIndicator(): HTMLElement {
        const typing = document.createElement('div');
        typing.className = 'nora-ai-msg bot';
        typing.id = 'nora-ai-typing-msg';
        typing.innerHTML = `
            <div class="nora-ai-bubble nora-ai-typing">
                <div class="nora-ai-typing-dot"></div>
                <div class="nora-ai-typing-dot"></div>
                <div class="nora-ai-typing-dot"></div>
            </div>
        `;
        this.bodyEl.appendChild(typing);
        this.scrollToBottom();
        return typing;
    }

    private removeTypingIndicator() {
        const typing = this.bodyEl.querySelector('#nora-ai-typing-msg');
        if (typing) typing.remove();
    }

    private scrollToBottom() {
        this.bodyEl.scrollTop = this.bodyEl.scrollHeight;
    }

    private escapeHTML(str: string): string {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
    }

    private async handleSend() {
        const query = this.inputEl.value.trim();
        if (!query) return;

        this.inputEl.value = '';
        this.appendUserMessage(query);
        this.showTypingIndicator();

        try {
            const bimContext = this.options.getBIMContext();
            const response = await this.queryLLM(query, bimContext);

            this.removeTypingIndicator();

            let actionBadge: string | undefined;
            if (response.action && response.action.type !== 'none') {
                if (response.action.type === 'show_all') {
                    this.activeContext = { activeClassifications: [], activeLevels: [], activeCategories: [], activeMaterials: [], activePilotes: [], lastActionType: 'show_all' };
                } else {
                    if (response.action.classifications && response.action.classifications.length > 0) {
                        this.activeContext.activeClassifications = response.action.classifications;
                    }
                    if (response.action.levels && response.action.levels.length > 0) {
                        this.activeContext.activeLevels = response.action.levels;
                    }
                    if (response.action.categories && response.action.categories.length > 0) {
                        this.activeContext.activeCategories = response.action.categories;
                    }
                    if (response.action.materials && response.action.materials.length > 0) {
                        this.activeContext.activeMaterials = response.action.materials;
                    }
                    if (response.action.pilotes && response.action.pilotes.length > 0) {
                        this.activeContext.activePilotes = response.action.pilotes;
                    }
                    this.activeContext.lastActionType = response.action.type;
                }

                const actionResult = await this.options.execute3DAction(response.action);
                actionBadge = response.action.message || (typeof actionResult === 'string' ? actionResult : `Acción 3D ejecutada: ${response.action.type}`);
            }

            this.appendBotMessage(this.formatMarkdown(response.answer), actionBadge);
        } catch (err: any) {
            console.error('[nora AI] Query error:', err);
            this.removeTypingIndicator();
            this.appendBotMessage(`⚠️ Ocurrió un inconveniente al procesar la consulta: ${err.message || err}`);
        }
    }

    private async queryLLM(userQuery: string, bimContext: any): Promise<{ answer: string; action: NoraAIAction }> {
        const apiKey = this.userApiKey || this.options.apiKey || (window as any).NORA_GEMINI_API_KEY || '';

        this.chatHistory.push({ role: 'user', parts: [{ text: userQuery }] });
        if (this.chatHistory.length > 20) this.chatHistory = this.chatHistory.slice(-20);

        // Si hay API key, consultamos Gemini en la nube con el nuevo schema avanzado
        if (apiKey) {
            const systemPrompt = `
Eres "nora AI Copilot", la asistente experta de Inteligencia Artificial para el visor BIM y CDE de Nora.

ESTRUCTURA DE CLASIFICACIÓN DEL PROYECTO (Árbol principal del visor):
${JSON.stringify(bimContext.classifications || bimContext.categories || {}, null, 2)}

NIVELES DISPONIBLES:
${JSON.stringify(Object.keys(bimContext.levels || {}), null, 2)}

MATERIALES DISPONIBLES EN EL MODELO:
${JSON.stringify((bimContext.materialsList || Object.keys(bimContext.materials || {})).slice(0, 50), null, 2)}

ANOMALÍAS DETECTADAS EN EL MODELO:
${JSON.stringify(bimContext.anomalies || {}, null, 2)}

TOTAL ELEMENTOS EN EL MODELO: ${bimContext.totalElements || 0}

ESTADO DE FILTROS Y CONTEXTO ACTIVO:
${JSON.stringify(this.activeContext, null, 2)}

CAPACIDADES Y REGLAS DE INTERPRETACIÓN:
1. CONTROL DE VISIBILIDAD Y FILTRADO MULTICRITERIO:
   - Admite condiciones geométricas compuestas: altura (height), longitud (length), volumen (volume), área (area), pendiente (slope), diámetro (diameter).
   - Mapeo difuso de materiales: Interpreta "drywall" o "paneles de yeso" como Gypsum Board / Cartón Yeso; "concreto" u "hormigón" como Concrete; "vidrio" como Glass; "acero" como Steel; "pvc" como PVC.
   - Inversión lógica: Si el usuario dice "oculta todo lo que no sea...", activa invertMatch = true.
2. MANIPULACIÓN DE CÁMARA Y SECCIÓN:
   - Cortes transversales o cajas de sección: action.type = "section", con sectionBox: { axis: "x"|"y"|"z", fitToElements: true, clear: false }.
   - Vistas estándar: cameraView = "top" | "front" | "iso" | "focus".
3. MODOS GRÁFICOS ANALÍTICOS Y MAPAS DE CALOR:
   - Heatmap: action.type = "color", colorOverrides: { mode: "heatmap" }.
   - Anomalías: action.type = "color", colorOverrides: { mode: "anomalies" }.
   - Presencia de metadatos: action.type = "color", colorOverrides: { mode: "presence" }.
   - Limpiar colores: colorOverrides: { clear: true }.
4. CO-PILOTO PARA CUANTIFICACIÓN (TAKEOFF AL VUELO):
   - Al aislar o consultar, calcula: Conteo total, volumen (m³), área (m²), longitud (m).
   - Informa si hay valores anómalos (volumen = 0 o elementos sin nivel asignado).

SIEMPRE responde ÚNICAMENTE en formato JSON:
{
  "answer": "Respuesta clara y profesional en markdown con formato estructurado, emojis y advertencias de auditoría...",
  "action": {
    "type": "isolate" | "hide" | "show_all" | "filter" | "color" | "camera" | "section" | "none",
    "classifications": ["NOMBRE_EXACTO_DEL_CONTEXTO"],
    "categories": [],
    "levels": [],
    "materials": [],
    "numericFilter": {
      "property": "height" | "length" | "volume" | "area" | "slope" | "diameter",
      "operator": ">" | "<" | ">=" | "<=" | "==" | "between",
      "value": 0,
      "value2": 0
    },
    "invertMatch": false,
    "cameraView": "top" | "bottom" | "front" | "back" | "left" | "right" | "iso" | "focus",
    "sectionBox": {
      "axis": "x" | "y" | "z",
      "fitToElements": true,
      "clear": false
    },
    "colorOverrides": {
      "mode": "heatmap" | "anomalies" | "presence",
      "clear": false
    },
    "message": "Mensaje descriptivo de la acción ejecutada"
  }
}
            `;

            const contents = [
                { role: 'user', parts: [{ text: systemPrompt }] },
                { role: 'model', parts: [{ text: '{"answer": "Entendido.", "action": {"type": "none"}}' }] },
                ...this.chatHistory
            ];

            for (const modelName of ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']) {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
                const payload = {
                    contents,
                    generationConfig: {
                        temperature: 0.1,
                        responseMimeType: "application/json"
                    }
                };

                try {
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (res.ok) {
                        const data = await res.json();
                        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                        if (rawText) {
                            this.chatHistory.push({ role: 'model', parts: [{ text: rawText }] });
                            try {
                                return JSON.parse(rawText);
                            } catch (e) {
                                return { answer: rawText, action: { type: 'none' } };
                            }
                        }
                    } else {
                        console.warn(`[nora AI] Model ${modelName} returned status ${res.status}`);
                    }
                } catch (err) {
                    console.warn(`[nora AI] Model ${modelName} fetch error:`, err);
                }
            }
        }

        // Motor BIM Heurístico Local Robusto
        const fallbackResult = this.localHeuristicFallback(userQuery, bimContext);
        this.chatHistory.push({ role: 'model', parts: [{ text: JSON.stringify(fallbackResult) }] });
        return fallbackResult;
    }

    private stripTypeScriptTypes(tsCode: string): string {
        if (!tsCode) return '';
        let js = tsCode;
        js = js.replace(/export\s+(interface|type|enum)\s+[\s\S]*?}/g, '');
        js = js.replace(/(interface|type)\s+[A-Za-z0-9_]+\s*=?\s*[\s\S]*?(};|;|\n(?=[a-zA-Z]))/g, '');
        js = js.replace(/\)\s*:\s*([A-Za-z0-9_<>\[\]\{\}\s|&]+|\{[\s\S]*?\})\s*\{/g, ') {');
        js = js.replace(/(\b[A-Za-z0-9_]+)\s*:\s*(string|any|boolean|number|void|never|object|unknown|string\[\]|any\[\]|number\[\]|keyof\s+typeof\s+[A-Za-z0-9_]+|[A-Za-z0-9_<>\[\]|&\s]+)(?=[,\)\s=])/g, '$1');
        js = js.replace(/(\b(?:const|let|var)\s+[A-Za-z0-9_]+)\s*:\s*(string|any|boolean|number|object|unknown|string\[\]|any\[\]|number\[\]|[A-Za-z0-9_<>\[\]|&\s]+)(?=\s*=)/g, '$1');
        js = js.replace(/\s+as\s+[A-Za-z0-9_<>\[\]]+/g, '');
        return js;
    }

    private localHeuristicFallback(query: string, bimContext: any): { answer: string; action: NoraAIAction } {
        const qClean = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

        // =========================================================================
        // 0. Inspección de Selección Activa (DOM o Memoria)
        // =========================================================================
        let selectedEls: any[] = bimContext?.selectedElements || [];
        if (selectedEls.length === 0 && typeof document !== 'undefined') {
            const tableRows = document.querySelectorAll('table tbody tr');
            for (let i = 0; i < tableRows.length; i++) {
                const r = tableRows[i] as HTMLElement;
                const isSelected = r.classList.contains('selected') || r.classList.contains('active') || r.querySelector('input:checked');
                if (isSelected) {
                    const cells = r.querySelectorAll('td');
                    if (cells.length >= 8) {
                        selectedEls.push({
                            name: cells[4]?.innerText?.trim() || cells[2]?.innerText?.trim() || 'Elemento seleccionado',
                            category: cells[3]?.innerText?.trim() || '',
                            classification: cells[1]?.innerText?.trim() || '',
                            material: cells[6]?.innerText?.trim() || '',
                            level: cells[7]?.innerText?.trim() || '',
                            area: parseFloat(cells[8]?.innerText?.replace(',', '.') || '0') || 0,
                            length: parseFloat(cells[9]?.innerText?.replace(',', '.') || '0') || 0,
                            volume: parseFloat(cells[10]?.innerText?.replace(',', '.') || '0') || 0
                        });
                        break;
                    }
                }
            }
        }

        const isSelectionQuery = ['seleccionad', 'este', 'esta', 'tocado', 'marcado', 'que toque', 'actual', 'que seleccione'].some(k => qClean.includes(k));

        if (selectedEls.length > 0 && isSelectionQuery) {
            const el = selectedEls[0];
            const detailLines: string[] = [];
            if (el.name) detailLines.push(`• <b>Nombre / Tipo:</b> ${el.name}`);
            if (el.category) detailLines.push(`• <b>Categoría:</b> ${el.category}${el.classification ? ' (' + el.classification + ')' : ''}`);
            if (el.level) detailLines.push(`• <b>Ubicación (Nivel):</b> ${el.level}`);
            if (el.material) detailLines.push(`• <b>Material:</b> ${el.material}`);
            if (el.area > 0) detailLines.push(`• <b>Área Individual:</b> ${el.area} m²`);
            if (el.volume > 0) detailLines.push(`• <b>Volumen Individual:</b> ${el.volume} m³`);
            if (el.length > 0) detailLines.push(`• <b>Longitud Individual:</b> ${el.length} m`);

            return {
                answer: `📌 <b>Información del Objeto Seleccionado:</b><br>${detailLines.join('<br>')}`,
                action: { type: 'none' }
            };
        }

        // =========================================================================
        // 1. Hook TS del Super Admin (Si existe)
        // =========================================================================
        try {
            const rawTSCode = localStorage.getItem('NORA_CUSTOM_TS_CODE');
            if (rawTSCode && rawTSCode.trim()) {
                const availableLevels = bimContext?.levels ? Object.keys(bimContext.levels) : [];
                const resultContext: any = {
                    query: query,
                    availableLevels: availableLevels,
                    activeContext: this.activeContext,
                    parsedJSON: { action: 'none', filters: [] }
                };

                const cleanJS = this.stripTypeScriptTypes(rawTSCode);
                const customHook = new Function('query', 'result', `${cleanJS}\n return noraBrainCustomPipeline(query, result);`);
                const tsResult = customHook(query, resultContext);

                if (tsResult && (tsResult.message || tsResult.parsedJSON?.message)) {
                    const msg = tsResult.parsedJSON?.message || tsResult.message;
                    return {
                        answer: msg,
                        action: {
                            type: tsResult.action || tsResult.parsedJSON?.action || 'none',
                            classifications: tsResult.classificationsMatched || tsResult.parsedJSON?.classifications,
                            categories: tsResult.categoriesMatched || tsResult.parsedJSON?.categories,
                            levels: tsResult.levelMatched || tsResult.parsedJSON?.levelMatched,
                            message: msg
                        }
                    };
                }
            }
        } catch (err) {
            console.warn('[nora AI] Error en Hook TS:', err);
        }

        // =========================================================================
        // 2. RESTABLECER / MOSTRAR TODO
        // =========================================================================
        const isReset = /(mostrar todo|muestra todo|restablecer|limpiar|reset|ver todo|todo el modelo|despejar|mostrar modelo|quitar filtros|restaurar|todo visible)/i.test(qClean);
        if (isReset) {
            this.activeContext = { activeClassifications: [], activeLevels: [], activeCategories: [], activeMaterials: [], activePilotes: [], lastActionType: 'show_all' };
            const total = bimContext?.totalElements || 0;
            return {
                answer: `🔄 <b>Modelo Restablecido:</b> Se han eliminado los aislamientos, filtros, planos de corte y colores analíticos. Los <b>${total}</b> elementos del modelo están visibles en el visor 3D.`,
                action: { type: 'show_all', message: 'Modelo restablecido' }
            };
        }

        // =========================================================================
        // 3. MODOS GRÁFICOS ANALÍTICOS Y MAPAS DE CALOR (COLOR OVERRIDES)
        // =========================================================================
        if (/(?:limpiar\s+colores|quitar\s+colores|restablecer\s+colores|sin\s+colorear|sin\s+colores)/i.test(qClean)) {
            return {
                answer: '🎨 <b>Colores Analíticos Restablecidos:</b> Se ha restaurado la visualización de materiales estándar del modelo.',
                action: { type: 'color', colorOverrides: { clear: true }, message: 'Colores analíticos restablecidos' }
            };
        }

        if (/(?:mapa\s+de\s+calor|heatmap|degradado|gradiente)\s*(?:de\s+|por\s+)?(?:volumen|cantidades|esfuerzos)?/i.test(qClean)) {
            return {
                answer: '🔥 <b>Mapa de Calor Analítico (Heatmap):</b><br>Visualizando degradado térmico según el <b>volumen de elementos</b>:<br>• 🟥 <b>Rojo:</b> Elementos de mayor volumen (Top 25%)<br>• 🟧 <b>Naranja:</b> Volumen medio-alto (50% - 75%)<br>• 🟨 <b>Amarillo:</b> Volumen medio-bajo (25% - 50%)<br>• 🟦 <b>Azul:</b> Elementos ligeros o de menor volumen (0 - 25%)<br><br>💡 <i>Di "limpiar colores" para volver a la apariencia normal.</i>',
                action: { type: 'color', colorOverrides: { mode: 'heatmap' }, message: 'Mapa de calor por volumen aplicado' }
            };
        }

        if (/(?:pinta|colorea|resalta|detecta|audita)\s*(?:las\s*)?anomal[ií]as|volumen\s*=?\s*0|sin\s+nivel/i.test(qClean)) {
            const anomTotal = bimContext?.anomalies?.totalAnomalies || 0;
            return {
                answer: `⚠️ <b>Auditoría Visual de Anomalías:</b><br>Se han resaltado en 🟥 <b>ROJO</b> los <b>${anomTotal} elementos anómalos</b> (volumen = 0 o sin nivel asignado) y en 🟩 <b>VERDE</b> los elementos conformes para su auditoría geométrica inmediata.`,
                action: { type: 'color', colorOverrides: { mode: 'anomalies' }, message: `Auditoría visual: ${anomTotal} anomalías en rojo` }
            };
        }

        if (/(?:pinta|colorea)\s*(?:de\s+)?rojo.*sin\s+(?:par[aá]metro|fase|nivel)|verde.*con\s+(?:par[aá]metro|fase|nivel)/i.test(qClean)) {
            return {
                answer: '🔍 <b>Auditoría de Parámetros Asignados:</b><br>• 🟩 <b>Verde:</b> Elementos con parámetros de fase y nivel completos.<br>• 🟥 <b>Rojo:</b> Elementos con metadatos ausentes o sin clasificar.',
                action: { type: 'color', colorOverrides: { mode: 'presence' }, message: 'Auditoría de metadatos aplicada' }
            };
        }

        // =========================================================================
        // 4. GENERACIÓN DE CORTES Y CAJAS DE SECCIÓN (SECTION BOX)
        // =========================================================================
        if (/(?:quitar\s+cortes?|limpiar\s+secci[oó]n|sin\s+cortes?|eliminar\s+corte)/i.test(qClean)) {
            return {
                answer: '✂️ <b>Cortes y Cajas de Sección Eliminados:</b> El modelo ahora es visible sin planos de corte.',
                action: { type: 'section', sectionBox: { clear: true }, message: 'Planos de corte eliminados' }
            };
        }

        const cutMatch = qClean.match(/(?:haz\s+un\s+)?corte\s+(?:transversal|longitudinal|secci[oó]n)?\s*(?:en\s+el\s+eje\s+)?([xyz]|4|[0-9]+)?/i) || qClean.match(/caja\s+de\s+secci[oó]n|section\s*box/i);
        if (cutMatch && !qClean.includes('aisla') && !qClean.includes('cuanto')) {
            let axis: 'x' | 'y' | 'z' = 'y';
            const rawAxis = cutMatch[1]?.toLowerCase();
            if (rawAxis === 'x' || rawAxis === '4') axis = 'x';
            else if (rawAxis === 'z') axis = 'z';
            else axis = 'y';

            return {
                answer: `✂️ <b>Corte Transversal Generado:</b><br>Se ha insertado un plano de corte dinámico en el <b>Eje ${axis.toUpperCase()}</b> enfocado en el centro del modelo. Puedes manipularlo arrastrando su gizmo en 3D.<br><br>💡 <i>Di "quitar corte" o "mostrar todo" para restaurar.</i>`,
                action: {
                    type: 'section',
                    sectionBox: { axis },
                    cameraView: axis === 'x' ? 'left' : axis === 'z' ? 'front' : 'top',
                    message: `Corte transversal en eje ${axis.toUpperCase()} generado`
                }
            };
        }

        // =========================================================================
        // 5. MANIPULACIÓN DE CÁMARA Y VISTAS DE INSPECCIÓN GUIADAS
        // =========================================================================
        const isCamTop = /(?:vista\s+superior|planta|vista\s+en\s+planta|desde\s+arriba)/i.test(qClean);
        const isCamFront = /(?:vista\s+frontal|fachada\s+principal|de\s+frente)/i.test(qClean);
        const isCamIso = /(?:isom[eé]trica|vista\s+3d|isom[eé]trico)/i.test(qClean);
        const isCamFocus = /(?:enf[oó]cate|ac[eé]rcate|centra|zoom\s+a|mira\s+de\s+frente)/i.test(qClean);

        if ((isCamTop || isCamFront || isCamIso || isCamFocus) && !qClean.includes('aisla') && !qClean.includes('muros') && !qClean.includes('columnas')) {
            const camView = isCamTop ? 'top' : isCamFront ? 'front' : isCamIso ? 'iso' : 'focus';
            const camNames: Record<string, string> = { top: 'Superior (Planta)', front: 'Frontal', iso: 'Isométrica 3D', focus: 'Enfocada' };
            return {
                answer: `📷 <b>Cámara Ajustada:</b> Vista cambiada a orientación <b>${camNames[camView]}</b>.`,
                action: { type: 'camera', cameraView: camView as any, message: `Vista ${camNames[camView]} activada` }
            };
        }

        // =========================================================================
        // 6. DETECCIÓN DE FILTROS NUMÉRICOS Y GEOMÉTRICOS AVANZADOS
        // =========================================================================
        let numericFilter: NoraAIAction['numericFilter'] | undefined = undefined;

        // Altura: ej. "de más de 2.50 metros de altura", "altura mayor a 3m"
        const heightMatch = qClean.match(/(?:altura|alto|altas|altos)\s*(?:de\s*)?(?:m[aá]s\s*de|mayor\s*(?:a|que)|superior\s*(?:a|que)|>)\s*([0-9]+(?:[\.,][0-9]+)?)/i);
        const heightLessMatch = qClean.match(/(?:altura|alto)\s*(?:de\s*)?(?:menos\s*de|menor\s*(?:a|que)|inferior\s*(?:a|que)|<)\s*([0-9]+(?:[\.,][0-9]+)?)/i);
        if (heightMatch) {
            numericFilter = { property: 'height', operator: '>', value: parseFloat(heightMatch[1].replace(',', '.')) };
        } else if (heightLessMatch) {
            numericFilter = { property: 'height', operator: '<', value: parseFloat(heightLessMatch[1].replace(',', '.')) };
        }

        // Pendiente: ej. "pendiente menor al 1%"
        const slopeMatch = qClean.match(/(?:pendiente)\s*(?:menor\s*(?:a|que|al)|menos\s*de|<)\s*([0-9]+(?:[\.,][0-9]+)?)\s*%/i);
        if (slopeMatch) {
            numericFilter = { property: 'slope', operator: '<', value: parseFloat(slopeMatch[1].replace(',', '.')) };
        }

        // Volumen: ej. "volumen mayor a 0.5 m3"
        const volMatch = qClean.match(/(?:volumen)\s*(?:m[aá]s\s*de|mayor\s*(?:a|que)|superior\s*(?:a|que)|>)\s*([0-9]+(?:[\.,][0-9]+)?)/i);
        if (volMatch) {
            numericFilter = { property: 'volume', operator: '>', value: parseFloat(volMatch[1].replace(',', '.')) };
        }

        // Longitud: ej. "longitud mayor a 4 metros"
        const lenMatch = qClean.match(/(?:longitud|largo)\s*(?:m[aá]s\s*de|mayor\s*(?:a|que)|superior\s*(?:a|que)|>)\s*([0-9]+(?:[\.,][0-9]+)?)/i);
        if (lenMatch) {
            numericFilter = { property: 'length', operator: '>', value: parseFloat(lenMatch[1].replace(',', '.')) };
        }

        // Inversión lógica: ej. "oculta todo lo que no sea estructura de concreto"
        const isNegationQuery = /(?:oculta|quita|remover)\s+todo\s+lo\s+que\s+no\s+sea/i.test(qClean);

        // =========================================================================
        // 7. MAPEO DIFUSO DE MATERIALES Y TIPOS (FUZZY MAPPING)
        // =========================================================================
        let targetMaterialKey: string | null = null;
        const availableMaterials = bimContext?.materialsList || Object.keys(bimContext?.materials || {});

        const fuzzyMaterialTerms: Record<string, string[]> = {
            "drywall": ["gypsum", "carton yeso", "durlock", "drywall", "placa yeso", "yeso", "sheetrock"],
            "concreto": ["concrete", "hormigon", "concreto", "cemento", "mortero"],
            "vidrio": ["glass", "vidrio", "cristal", "panel vidriado", "acristalamiento"],
            "acero": ["steel", "acero", "metal", "hierro", "perfil metalico", "aluminio"],
            "pvc": ["pvc", "sanitario", "pavco", "polietileno", "plastico"],
            "ladrillo": ["ladrillo", "bloque", "mamposteria", "arcilla", "masonry"],
            "madera": ["wood", "madera", "timber"]
        };

        for (const [groupName, groupKeywords] of Object.entries(fuzzyMaterialTerms)) {
            if (qClean.includes(groupName) || groupKeywords.some(gk => qClean.includes(gk))) {
                // Find actual material matching this group in the model
                for (const realMat of availableMaterials) {
                    const normM = realMat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    if (groupKeywords.some(gk => normM.includes(gk))) {
                        targetMaterialKey = realMat;
                        break;
                    }
                }
                if (!targetMaterialKey) targetMaterialKey = groupName; // Fallback symbolic
                break;
            }
        }

        // =========================================================================
        // 8. EXTRACCIÓN DE CLASIFICACIONES Y NIVELES
        // =========================================================================
        const isHide = /(oculta|ocultar|esconde|esconder|apaga|apagar|quitar|quita|remover|desactiva)/i.test(qClean);
        const isExplicitQuantity = /(cu[aá]nto|cu[aá]ntos|cu[aá]nta|cu[aá]ntas|qu[eé] cantidad|dame el metrado|metrado|resumen de cantidades|cu[aá]l es el volumen|cu[aá]l es el [aá]rea|cu[aá]ntos metros)/i.test(qClean);
        const isExplicitIsolate = /(aisla|aislar|a[ií]sla|ver solo|muestra solo|mostrar solo|deja solo|dejame ver|quiero ver|necesito ver|necesito que aisles|solamente|unicamente|todos los|todas las|todo el|toda la|filtra|filtrar)/i.test(qClean);

        const classifDict = bimContext?.classifications || bimContext?.categories || {};
        const availableClassifs = Object.keys(classifDict);
        const matchedClassifications: string[] = [];

        const classificationAliases: Record<string, string[]> = {
            "MUROS": ["muro", "muros", "pared", "paredes", "wall", "walls", "tabique", "tabiques", "mamposteria"],
            "MUROS CORTINA": ["muro cortina", "muros cortina", "curtain wall", "fachada flotante", "muro vidriado"],
            "COLUMNAS": ["columna", "columnas", "pilar", "pilares", "column", "columns"],
            "VIGAS": ["viga", "vigas", "beam", "beams", "dintel", "dinteles", "vigueta", "viguetas"],
            "PISOS / PLACAS": ["piso", "pisos", "placa", "placas", "losa", "losas", "slab", "slabs", "floor", "floors", "forjado", "forjados", "entrepiso", "suelo", "suelos"],
            "CUBIERTAS": ["cubierta", "cubiertas", "techo", "techos", "roof", "roofs", "tejado", "tejados", "cielo raso"],
            "CIMENTACIONES": ["cimentacion", "cimentaciones", "zapata", "zapatas", "foundation", "foundations", "fundacion", "fundaciones", "pedestal", "pedestales", "viga de amarre", "vigas de amarre"],
            "PILOTES": ["pilote", "pilotes", "pile", "piles"],
            "PUERTAS": ["puerta", "puertas", "door", "doors", "porton", "portones"],
            "VENTANAS": ["ventana", "ventanas", "window", "windows", "ventaneria", "ventanerias", "vidriera", "vidrieras"],
            "BARANDILLAS": ["barandilla", "barandillas", "baranda", "barandas", "railing", "railings", "pasamanos"],
            "ESCALERAS": ["escalera", "escaleras", "stair", "stairs", "grada", "gradas", "peldano", "peldanos"],
            "TUBERÍAS": ["tuberia", "tuberias", "tubo", "tubos", "pipe", "pipes", "conduit", "red sanitaria", "red hidraulica", "desague", "agua potable", "tubo sanitario"],
            "ACCESORIOS DE TUBERÍA": ["accesorio", "accesorios", "union", "uniones", "codo", "codos", "tee", "fitting", "fittings", "reduccion", "reducciones", "acople"],
            "APARATOS SANITARIOS": ["aparato sanitario", "aparatos sanitarios", "sanitario", "sanitarios", "inodoro", "inodoros", "lavamanos", "ducha", "duchas", "grifo", "griferia", "sanitary"],
            "EQUIPOS MECÁNICOS": ["equipo mecanico", "equipos mecanicos", "bomba", "bombas", "caldera", "calderas", "chiller", "tanque", "tanques"],
            "CONDUCTOS": ["conducto", "conductos", "ducto", "ductos", "rejilla", "rejillas", "difusor", "difusores", "hvac"],
            "LUMINARIAS": ["luminaria", "luminarias", "lampara", "lamparas", "iluminacion", "light", "foco", "focos"],
            "DISPOSITIVOS ELÉCTRICOS": ["electrico", "electrica", "electricos", "electricas", "tablero", "tableros", "toma", "tomas", "tomacorriente", "interruptor"]
        };

        const isCortinaMentioned = qClean.includes('cortina') || qClean.includes('curtain') || qClean.includes('fachada flotante');
        const isAllWalls = /(todos los muros|todos muros|aisla los muros|aisla muros|aislar los muros|todos los muros del proyecto|necesito que aisles todos los muros)/i.test(qClean);

        for (const realClassif of availableClassifs) {
            const normReal = realClassif.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

            if (normReal.includes('muros cortina') || normReal.includes('muro cortina')) {
                if (isCortinaMentioned || isAllWalls) {
                    if (!matchedClassifications.includes(realClassif)) matchedClassifications.push(realClassif);
                }
                continue;
            }

            if (qClean.includes(normReal)) {
                if (!matchedClassifications.includes(realClassif)) matchedClassifications.push(realClassif);
                continue;
            }

            for (const [keyGroup, aliasList] of Object.entries(classificationAliases)) {
                const normGroup = keyGroup.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (normReal === normGroup || normReal.includes(normGroup) || normGroup.includes(normReal)) {
                    const matchFound = aliasList.some(alias => {
                        const regex = new RegExp(`\\b${alias}\\b`, 'i');
                        return regex.test(qClean);
                    });
                    if (matchFound) {
                        if (!matchedClassifications.includes(realClassif)) matchedClassifications.push(realClassif);
                    }
                }
            }
        }

        // Extracción de Niveles
        let targetLevelKey: string | null = null;
        if (bimContext && bimContext.levels) {
            const levelKeys = Object.keys(bimContext.levels);
            const numMatch = qClean.match(/(?:piso|nivel|level|planta|sotano|p|n)\s*([0-9]+)/i) || qClean.match(/\b([0-9]+)\b/);
            const queryLevelNumber = numMatch ? numMatch[1] : null;

            for (const lKey of levelKeys) {
                const normLvl = lKey.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (qClean.includes(normLvl)) {
                    targetLevelKey = lKey;
                    break;
                }
                if (queryLevelNumber) {
                    const lNumMatch = normLvl.match(/(?:piso|nivel|level|planta|p|n)\s*([0-9]+)/i) || normLvl.match(/\b([0-9]+)\b/);
                    if (lNumMatch && lNumMatch[1] === queryLevelNumber) {
                        targetLevelKey = lKey;
                        break;
                    }
                }
            }
        }

        // =========================================================================
        // 9. CÁLCULO DE TAKEOFF AL VUELO Y DETECCIÓN DE ANOMALÍAS
        // =========================================================================
        const effectiveClassifications = matchedClassifications.length > 0
            ? matchedClassifications
            : (targetLevelKey && this.activeContext.activeClassifications.length > 0 ? [...this.activeContext.activeClassifications] : []);

        const effectiveLevels = targetLevelKey
            ? [targetLevelKey]
            : (matchedClassifications.length > 0 && !qClean.includes('todo el proyecto') && !qClean.includes('todos los') ? [...this.activeContext.activeLevels] : []);

        const effectiveMaterials = targetMaterialKey
            ? [targetMaterialKey]
            : (matchedClassifications.length > 0 ? [] : [...this.activeContext.activeMaterials]);

        if (effectiveClassifications.length > 0 || effectiveLevels.length > 0 || effectiveMaterials.length > 0 || numericFilter || isNegationQuery) {
            let totalCount = 0, totalVol = 0, totalArea = 0, totalLen = 0;
            const targetLvl = effectiveLevels.length > 0 ? effectiveLevels[0] : null;

            for (const cl of (effectiveClassifications.length > 0 ? effectiveClassifications : Object.keys(classifDict))) {
                if (targetLvl && bimContext?.matrixByLevelAndClassification?.[targetLvl]?.[cl]) {
                    const stats = bimContext.matrixByLevelAndClassification[targetLvl][cl];
                    totalCount += stats.count || 0;
                    totalVol += stats.volume || 0;
                    totalArea += stats.area || 0;
                    totalLen += stats.length || 0;
                } else if (bimContext?.classifications?.[cl]) {
                    const stats = bimContext.classifications[cl];
                    totalCount += stats.count || 0;
                    totalVol += stats.volume || 0;
                    totalArea += stats.area || 0;
                    totalLen += stats.length || 0;
                } else if (bimContext?.categories?.[cl]) {
                    const stats = bimContext.categories[cl];
                    totalCount += stats.count || 0;
                    totalVol += stats.volume || 0;
                    totalArea += stats.area || 0;
                    totalLen += stats.length || 0;
                }
            }

            if (effectiveClassifications.length === 0 && targetLvl && bimContext?.levels?.[targetLvl]) {
                const lvlStats = bimContext.levels[targetLvl];
                totalCount = lvlStats.count || 0;
                totalVol = lvlStats.volume || 0;
                totalArea = lvlStats.area || 0;
            }

            const classifStr = effectiveClassifications.join(', ');
            const lvlStr = effectiveLevels.join(', ');
            const matStr = effectiveMaterials.join(', ');

            const roundedVol = Math.round(totalVol * 100) / 100;
            const roundedArea = Math.round(totalArea * 100) / 100;
            const roundedLen = Math.round(totalLen * 100) / 100;

            // Detección de Anomalías de Modelado
            const anomaliesInfo = bimContext?.anomalies || {};
            const zeroVol = anomaliesInfo.zeroVolumeCount || 0;
            const missingLvl = anomaliesInfo.missingLevelCount || 0;
            let anomalyWarning = '';
            if (zeroVol > 0 || missingLvl > 0) {
                anomalyWarning = `<br><br>⚠️ <b>Auditoría de Modelado:</b> Se detectaron <b>${zeroVol} elementos con volumen = 0</b> y <b>${missingLvl} elementos sin nivel</b> en el modelo.<br>💡 <i>Tip: Puedes decir "Pinta las anomalías de rojo" para visualizarlas en 3D.</i>`;
            }

            // Filtro numérico descriptor
            let numDesc = '';
            if (numericFilter) {
                const pNames: Record<string, string> = { height: 'altura', slope: 'pendiente', volume: 'volumen', length: 'longitud', area: 'área', diameter: 'diámetro' };
                numDesc = ` con ${pNames[numericFilter.property] || numericFilter.property} ${numericFilter.operator} ${numericFilter.value}${numericFilter.property === 'slope' ? '%' : 'm'}`;
            }

            // Inversión lógica descriptor
            let invertDesc = isNegationQuery ? ' (excluyendo lo que no coincida)' : '';

            // CASO A: OCULTAR
            if (isHide) {
                return {
                    answer: `👁️ <b>Ocultando en visor 3D:</b><br>He ocultado <b>${classifStr || 'elementos'}</b>${numDesc}${lvlStr ? ' en nivel <b>' + lvlStr + '</b>' : ''}${invertDesc} (${totalCount} elementos).<br><br>💡 <i>Di "mostrar todo" para restaurar la visibilidad completa.</i>`,
                    action: {
                        type: 'hide',
                        classifications: effectiveClassifications.length > 0 ? effectiveClassifications : undefined,
                        levels: effectiveLevels.length > 0 ? effectiveLevels : undefined,
                        materials: effectiveMaterials.length > 0 ? effectiveMaterials : undefined,
                        numericFilter,
                        invertMatch: isNegationQuery,
                        message: `Ocultado: ${classifStr || ''} ${lvlStr || ''}`.trim()
                    }
                };
            }

            // CASO B: CONSULTA DE CANTIDADES SIN PEDIR AISLAMIENTO
            if (isExplicitQuantity && !isExplicitIsolate) {
                let qtyAnswer = `📊 <b>Takeoff al Vuelo: ${classifStr || 'Elementos'}</b>${numDesc}${lvlStr ? ' en nivel <b>' + lvlStr + '</b>' : ''}${matStr ? ' (Material: ' + matStr + ')' : ''}:<br>• <b>Total elementos:</b> ${totalCount}<br>• <b>Volumen total:</b> ${roundedVol} m³<br>• <b>Área total:</b> ${roundedArea} m²`;
                if (roundedLen > 0) qtyAnswer += `<br>• <b>Longitud total:</b> ${roundedLen} m`;
                qtyAnswer += `${anomalyWarning}<br><br>¿Deseas aislar o enfocar estos elementos en 3D? Solo dime: <i>"Aísla ${classifStr || 'estos elementos'}"</i>.`;

                return {
                    answer: qtyAnswer,
                    action: { type: 'none' }
                };
            }

            // CASO C: AISLAMIENTO MULTICRITERIO + TAKEOFF EN TIEMPO REAL
            let answerStr = '';
            if (isAllWalls || qClean.includes('todos los muros')) {
                answerStr = `🧱 <b>Mostrando todos los muros del proyecto:</b><br>He aislado <b>${totalCount} muros</b> en la totalidad del modelo 3D.`;
            } else {
                answerStr = `🎯 <b>Filtro Semántico Aplicado:</b><br>Visualizando ${classifStr ? 'clasificación <b>' + classifStr + '</b>' : ''}${numDesc}${lvlStr ? (classifStr ? ' en nivel <b>' : 'nivel <b>') + lvlStr + '</b>' : ''}${matStr ? ' (Material: <b>' + matStr + '</b>)' : ''}${invertDesc}:`;
            }

            answerStr += `<br>• <b>Conteo de elementos:</b> ${totalCount} uds.<br>• <b>Volumen acumulado:</b> ${roundedVol} m³<br>• <b>Área superficial:</b> ${roundedArea} m²`;
            if (roundedLen > 0) {
                answerStr += `<br>• <b>Longitud acumulada:</b> ${roundedLen} m`;
            }

            answerStr += `${anomalyWarning}<br><br>💡 <i>Tip: Puedes decir "Haz un corte en el eje X", "Mapa de calor" o "Mostrar todo".</i>`;

            return {
                answer: answerStr,
                action: {
                    type: 'isolate',
                    classifications: effectiveClassifications.length > 0 ? effectiveClassifications : undefined,
                    levels: effectiveLevels.length > 0 ? effectiveLevels : undefined,
                    materials: effectiveMaterials.length > 0 ? effectiveMaterials : undefined,
                    numericFilter,
                    invertMatch: isNegationQuery,
                    cameraView: 'focus',
                    message: `Aislado: ${classifStr || ''} ${lvlStr || ''} ${matStr || ''}`.trim()
                }
            };
        }

        // =========================================================================
        // 10. Si no coincidió ningún filtro específico
        // =========================================================================
        const total = bimContext?.totalElements || 0;
        const availableClassList = availableClassifs.slice(0, 6).join('</b>, <b>');
        const availableLvlList = Object.keys(bimContext?.levels || {}).slice(0, 4).join('</b>, <b>');

        return {
            answer: `El modelo cargado cuenta con <b>${total} elementos</b>.<br><br><b>Nuevas capacidades activas:</b><br>1️⃣ <b>Filtrado Complejo:</b> <i>"Aísla los muros de más de 2.50 metros en el Piso 3"</i><br>2️⃣ <b>Cámara y Secciones:</b> <i>"Haz un corte transversal en el eje X y enfócate"</i><br>3️⃣ <b>Mapas de Calor y Auditoría:</b> <i>"Mapa de calor por volumen"</i> o <i>"Pinta anomalías en rojo"</i><br>4️⃣ <b>Takeoff al Vuelo:</b> <i>"¿Volumen de concreto en piso 2?"</i><br><br><b>Clasificaciones:</b> <b>${availableClassList}</b>...<br><b>Niveles:</b> <b>${availableLvlList}</b>...`,
            action: { type: 'none' }
        };
    }

    private formatMarkdown(text: string): string {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.*?)\*/g, '<i>$1</i>')
            .replace(/\n/g, '<br>');
    }
}