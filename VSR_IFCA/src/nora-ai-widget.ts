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
    type: 'isolate' | 'hide' | 'show_all' | 'filter' | 'color' | 'camera' | 'none';
    classifications?: string[];
    categories?: string[];
    levels?: string[];
    materials?: string[];
    pilotes?: string[];
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
                    <button class="nora-ai-prompt-pill" data-prompt="Aísla todos los muros del proyecto">
                        <i class="fa-solid fa-border-all"></i> Aislar Muros
                    </button>
                    <button class="nora-ai-prompt-pill" data-prompt="Quiero ver solo las columnas">
                        <i class="fa-solid fa-eye"></i> Aislar Columnas
                    </button>
                    <button class="nora-ai-prompt-pill" data-prompt="Aísla la tubería sanitaria">
                        <i class="fa-solid fa-faucet-drip"></i> Tubería Sanitaria
                    </button>
                    <button class="nora-ai-prompt-pill" data-prompt="¿Volumen de concreto en piso 2?">
                        <i class="fa-solid fa-cube"></i> Concreto Piso 2
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

        // Si hay API key, consultamos Gemini en la nube
        if (apiKey) {
            const systemPrompt = `
Eres "nora AI Copilot", la asistente experta de Inteligencia Artificial para el visor BIM y CDE de Nora.

ESTRUCTURA DE CLASIFICACIÓN DEL PROYECTO (Árbol principal del visor):
${JSON.stringify(bimContext.classifications || bimContext.categories || {}, null, 2)}

NIVELES DISPONIBLES:
${JSON.stringify(Object.keys(bimContext.levels || {}), null, 2)}

MATERIALES PRESENTES EN EL MODELO:
${JSON.stringify(Object.keys(bimContext.materials || {}).slice(0, 40), null, 2)}

TOTAL ELEMENTOS EN EL MODELO: ${bimContext.totalElements || 0}

ESTADO DE FILTROS Y CONTEXTO ACTIVO EN LA CONVERSACIÓN:
${JSON.stringify(this.activeContext, null, 2)}

REGLAS CRÍTICAS DE INTERPRETACIÓN BIM:
1. CLASIFICACIÓN VS MATERIAL:
   - "muro", "muros", "paredes" SIEMPRE corresponde a la clasificación "MUROS" (o "MUROS CORTINA"). NUNCA lo interpretes como un material específico salvo que el usuario pida explícitamente "material muro básico...".
   - "columna", "columnas", "pilares" corresponde a la clasificación "COLUMNAS".
   - "viga", "vigas" corresponde a la clasificación "VIGAS".
   - "piso", "pisos", "placa", "placas", "losa", "losas" corresponde a "PISOS / PLACAS".
   - "puerta", "puertas" corresponde a "PUERTAS".
   - "ventana", "ventanas" corresponde a "VENTANAS".
   - "tubería", "tuberías", "tubo" corresponde a "TUBERÍAS".
   - "accesorios", "uniones", "codos" corresponde a "ACCESORIOS DE TUBERÍA".
   - "sanitarios", "aparatos sanitarios" corresponde a "APARATOS SANITARIOS".
2. ACCIONES EN EL VISOR 3D:
   - Si el usuario dice "aisla...", "ver solo...", "todos los muros", "deja solo...", usa action.type = "isolate" y coloca los nombres exactos en "classifications".
   - Si pide ocultar: action.type = "hide".
   - Si pide mostrar todo o limpiar filtros: action.type = "show_all".
   - Si solo pregunta por cantidades sin pedir aislar: action.type = "none".
3. ELEMENTO SELECCIONADO: Si el usuario pregunta por un elemento seleccionado o activo, responde con sus propiedades individuales.

SIEMPRE responde ÚNICAMENTE en formato JSON:
{
  "answer": "Respuesta clara y profesional en markdown...",
  "action": {
    "type": "isolate" | "hide" | "show_all" | "filter" | "none",
    "classifications": ["NOMBRE_EXACTO_DEL_CONTEXTO"],
    "categories": [],
    "levels": [],
    "materials": [],
    "message": "Mensaje descriptivo de la acción"
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
        // 2. Restablecer / Mostrar todo
        // =========================================================================
        const isReset = /(mostrar todo|muestra todo|restablecer|limpiar|reset|ver todo|todo el modelo|despejar|mostrar modelo|quitar filtros|restaurar|todo visible)/i.test(qClean);
        if (isReset) {
            this.activeContext = { activeClassifications: [], activeLevels: [], activeCategories: [], activeMaterials: [], activePilotes: [], lastActionType: 'show_all' };
            const total = bimContext?.totalElements || 0;
            return {
                answer: `🔄 <b>Modelo Restablecido:</b> Se han eliminado los aislamientos y filtros. Los <b>${total}</b> elementos del modelo están visibles en el visor 3D.`,
                action: { type: 'show_all', message: 'Modelo restablecido' }
            };
        }

        // =========================================================================
        // 3. Detección de Intención (Ocultar, Aislar, Cantidades)
        // =========================================================================
        const isHide = /(oculta|ocultar|esconde|esconder|apaga|apagar|quitar|quita|remover|desactiva)/i.test(qClean);
        const isExplicitQuantity = /(cu[aá]nto|cu[aá]ntos|cu[aá]nta|cu[aá]ntas|qu[eé] cantidad|dame el metrado|metrado|resumen de cantidades|cu[aá]l es el volumen|cu[aá]l es el [aá]rea|cu[aá]ntos metros)/i.test(qClean);
        const isExplicitIsolate = /(aisla|aislar|a[ií]sla|ver solo|muestra solo|mostrar solo|deja solo|dejame ver|quiero ver|necesito ver|necesito que aisles|solamente|unicamente|todos los|todas las|todo el|toda la|filtra|filtrar)/i.test(qClean);

        // =========================================================================
        // 4. Mapeo y Detección de Clasificaciones
        // =========================================================================
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

            // Si es MUROS CORTINA vs MUROS
            if (normReal.includes('muros cortina') || normReal.includes('muro cortina')) {
                if (isCortinaMentioned || isAllWalls) {
                    if (!matchedClassifications.includes(realClassif)) matchedClassifications.push(realClassif);
                }
                continue;
            }

            // Si coincide directamente con el nombre en el árbol
            if (qClean.includes(normReal)) {
                if (!matchedClassifications.includes(realClassif)) matchedClassifications.push(realClassif);
                continue;
            }

            // Buscar por alias
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

        // =========================================================================
        // 5. Extracción de Niveles
        // =========================================================================
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
        // 6. Extracción de Materiales (ESTRICTO - Sin falsos positivos)
        // =========================================================================
        let targetMaterialKey: string | null = null;
        const materialStopWords = new Set([
            'muro', 'muros', 'pared', 'paredes', 'columna', 'columnas', 'viga', 'vigas',
            'piso', 'pisos', 'placa', 'placas', 'losa', 'losas', 'puerta', 'puertas',
            'ventana', 'ventanas', 'tubo', 'tubos', 'tuberia', 'tuberias', 'aisla', 'aislar',
            'todos', 'todas', 'todo', 'toda', 'proyecto', 'modelo', 'nivel', 'niveles',
            'ver', 'solo', 'solamente', 'quitar', 'ocultar', 'mostrar', 'sin', 'con', 'del',
            'los', 'las', 'un', 'una', 'para', 'por', 'que', 'en'
        ]);

        const explicitMaterialKeywords = [
            'concreto', 'hormigon', 'ladrillo', 'pvc', 'vidrio', 'glass', 'acero',
            'madera', 'yeso', 'drywall', 'aluminio', 'hierro', 'pavco', 'cemento',
            'mortero', 'cobre', 'polietileno', 'asfalto', 'ceramica', 'gres', 'pintura'
        ];

        const hasMaterialIntent = qClean.includes('material') || explicitMaterialKeywords.some(mk => qClean.includes(mk));

        if (hasMaterialIntent && bimContext && bimContext.materials) {
            const matKeys = Object.keys(bimContext.materials);
            for (const mKey of matKeys) {
                const normMat = mKey.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const tokens = normMat.split(/[\s\-_/:]+/).filter(t => t.length > 2 && !materialStopWords.has(t));
                
                if (tokens.some(t => qClean.includes(t)) || (normMat.length > 3 && qClean.includes(normMat))) {
                    targetMaterialKey = mKey;
                    break;
                }
            }
        }

        // =========================================================================
        // 7. Contexto Efectivo y Continuidad Secuencial
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

        // =========================================================================
        // 8. Cálculo de Métricas y Generación de Respuesta
        // =========================================================================
        if (effectiveClassifications.length > 0 || effectiveLevels.length > 0 || effectiveMaterials.length > 0) {
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

            // Si se especificó solo nivel sin clasificación
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

            // CASO A: OCULTAR
            if (isHide) {
                return {
                    answer: `👁️ <b>Ocultando en visor 3D:</b><br>He ocultado <b>${classifStr || 'elementos'}</b>${lvlStr ? ' en nivel <b>' + lvlStr + '</b>' : ''} (${totalCount} elementos).<br><br>💡 <i>Tip: Di "mostrar todo" para restaurar la visibilidad completa.</i>`,
                    action: {
                        type: 'hide',
                        classifications: effectiveClassifications.length > 0 ? effectiveClassifications : undefined,
                        levels: effectiveLevels.length > 0 ? effectiveLevels : undefined,
                        materials: effectiveMaterials.length > 0 ? effectiveMaterials : undefined,
                        message: `Ocultado: ${classifStr || ''} ${lvlStr || ''}`.trim()
                    }
                };
            }

            // CASO B: CONSULTA DE CANTIDADES SIN PEDIR AISLAMIENTO
            if (isExplicitQuantity && !isExplicitIsolate) {
                let qtyAnswer = `📊 <b>Cantidades de ${classifStr || 'elementos'}</b>${lvlStr ? ' en nivel <b>' + lvlStr + '</b>' : ''}${matStr ? ' (Material: ' + matStr + ')' : ''}:<br>• <b>Total elementos:</b> ${totalCount}<br>• <b>Volumen total:</b> ${roundedVol} m³<br>• <b>Área total:</b> ${roundedArea} m²`;
                if (roundedLen > 0) qtyAnswer += `<br>• <b>Longitud total:</b> ${roundedLen} m`;
                qtyAnswer += `<br><br>¿Deseas que los aísle en el visor 3D? Solo dime: <i>"Aísla ${classifStr || 'estos elementos'}"</i>.`;

                return {
                    answer: qtyAnswer,
                    action: { type: 'none' }
                };
            }

            // CASO C: AISLAR (DEFAULT PARA COMANDOS DE SELECCIÓN Y FILTRO)
            let answerStr = '';
            if (isAllWalls || qClean.includes('todos los muros')) {
                answerStr = `🧱 <b>Mostrando todos los muros del proyecto:</b><br>He aislado <b>${totalCount} muros</b> en la totalidad del modelo 3D.`;
            } else {
                answerStr = `🧱 <b>Aislamiento aplicado:</b><br>Visualizando ${classifStr ? 'clasificación <b>' + classifStr + '</b>' : ''}${lvlStr ? (classifStr ? ' en nivel <b>' : 'nivel <b>') + lvlStr + '</b>' : ''}${matStr ? ' (Material: <b>' + matStr + '</b>)' : ''}:`;
            }

            answerStr += `<br>• <b>Total elementos:</b> ${totalCount}<br>• <b>Volumen acumulado:</b> ${roundedVol} m³<br>• <b>Área acumulada:</b> ${roundedArea} m²`;
            if (roundedLen > 0) {
                answerStr += `<br>• <b>Longitud acumulada:</b> ${roundedLen} m`;
            }

            answerStr += `<br><br>💡 <i>Tip: Puedes decir "mostrar todo" para restablecer el modelo completo.</i>`;

            return {
                answer: answerStr,
                action: {
                    type: 'isolate',
                    classifications: effectiveClassifications.length > 0 ? effectiveClassifications : undefined,
                    levels: effectiveLevels.length > 0 ? effectiveLevels : undefined,
                    materials: effectiveMaterials.length > 0 ? effectiveMaterials : undefined,
                    message: `Aislado: ${classifStr || ''} ${lvlStr || ''} ${matStr || ''}`.trim()
                }
            };
        }

        // =========================================================================
        // 9. Si no coincidió ningún filtro específico
        // =========================================================================
        const total = bimContext?.totalElements || 0;
        const availableClassList = availableClassifs.slice(0, 7).join('</b>, <b>');
        const availableLvlList = Object.keys(bimContext?.levels || {}).slice(0, 5).join('</b>, <b>');

        return {
            answer: `El modelo cargado cuenta con <b>${total} elementos</b>.<br><br>Puedes pedirme comandos directos como:<br>• <i>"Aísla todos los muros del proyecto"</i><br>• <i>"Quiero ver solo las columnas"</i><br>• <i>"Aísla la tubería sanitaria"</i><br>• <i>"¿Volumen de concreto en piso 2?"</i><br>• <i>"Mostrar todo"</i><br><br><b>Clasificaciones disponibles:</b> <b>${availableClassList}</b>...<br><b>Niveles:</b> <b>${availableLvlList}</b>...`,
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