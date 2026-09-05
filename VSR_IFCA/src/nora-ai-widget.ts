/**
 * nora AI Copilot - BIM & CDE Assistant Component
 * Integrates Google Gemini API with live BIM context and 3D viewer action dispatching.
 * Soporta elementos estructurales, arquitectónicos e hidrosanitarios (MEP).
 */

import './nora-ai-widget.css';

export interface NoraAIOptions {
    getBIMContext: () => any;
    execute3DAction: (action: NoraAIAction) => Promise<string | void>;
    apiKey?: string;
}

export interface NoraAIAction {
    type: 'isolate' | 'hide' | 'show_all' | 'filter' | 'color' | 'camera' | 'none';
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
                    <button class="nora-ai-prompt-pill" data-prompt="Quiero ver solo las columnas">
                        <i class="fa-solid fa-eye"></i> Aislar Columnas
                    </button>
                    <button class="nora-ai-prompt-pill" data-prompt="Aísla la tubería sanitaria">
                        <i class="fa-solid fa-faucet-drip"></i> Tubería Sanitaria
                    </button>
                    <button class="nora-ai-prompt-pill" data-prompt="¿Volumen de concreto 3000psi en el piso 2?">
                        <i class="fa-solid fa-cube"></i> Concreto Piso 2
                    </button>
                    <button class="nora-ai-prompt-pill" data-prompt="Muéstrame todo el modelo y limpia los filtros">
                        <i class="fa-solid fa-rotate-left"></i> Restablecer 3D
                    </button>
                </div>

                <div class="nora-ai-msg bot">
                    <div class="nora-ai-bubble">
                        👋 ¡Hola! Soy <b>nora AI Copilot</b>. Puedo responder preguntas sobre cantidades, redes hidrosanitarias, elementos estructurales y <b>ejecutar aislamientos directamente en el visor 3D</b>. ¿Qué te gustaría consultar?
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
        activeLevels: string[];
        activeCategories: string[];
        activeMaterials: string[];
        activePilotes: string[];
        lastActionType: string;
    } = {
        activeLevels: [],
        activeCategories: [],
        activeMaterials: [],
        activePilotes: [],
        lastActionType: 'none'
    };

    public clearChat() {
        this.chatHistory = [];
        this.activeContext = { activeLevels: [], activeCategories: [], activeMaterials: [], activePilotes: [], lastActionType: 'none' };
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
                    this.activeContext = { activeLevels: [], activeCategories: [], activeMaterials: [], activePilotes: [], lastActionType: 'show_all' };
                } else {
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
        
        if (!apiKey) {
            const result = this.localHeuristicFallback(userQuery, bimContext);
            this.chatHistory.push({ role: 'model', parts: [{ text: JSON.stringify(result) }] });
            return result;
        }

        const systemPrompt = `
Eres "nora AI", la asistente experta de IA para la plataforma nora BIM CDE.

CONTEXTO DEL MODELO IFC CARGADO EN PANTALLA:
${JSON.stringify(bimContext, null, 2)}

ESTADO DE FILTROS Y CONTEXTO ACTIVO EN LA CONVERSACIÓN ACTUAL:
${JSON.stringify(this.activeContext, null, 2)}

REGLAS CRÍTICAS:
1. REGLA DE OBJETO SELECCIONADO (PRIORIDAD MÁXIMA): Si el usuario usa palabras como "seleccionado", "este elemento", "el que toque", "este muro", "esta tuberia" o consulta por las dimensiones de un elemento activo, responde mostrando ÚNICAMENTE el área, volumen, longitud, nivel y material del objeto individual. NO sumes todos los objetos de esa categoría en el proyecto.
2. CONTINUIDAD: Combina filtros de niveles y categorías si la conversación es secuencial.
3. HIDROSANITARIO Y MEP: Reconoce tuberías (IfcPipeSegment / TUBERÍAS), uniones (IfcPipeFitting / UNIONES) y aparatos sanitarios (IfcSanitaryTerminal / APARATOS SANITARIOS).

SIEMPRE responde ÚNICAMENTE en JSON estricto:
{
  "answer": "Respuesta clara al usuario...",
  "action": {
    "type": "isolate" | "hide" | "show_all" | "filter" | "color" | "none",
    "categories": ["NOMBRE_CATEGORIA"],
    "levels": ["NOMBRE_NIVEL"],
    "materials": ["NOMBRE_MATERIAL"],
    "pilotes": ["NUMERO_PILOTE"],
    "message": "Mensaje descriptivo de la acción ejecutada"
  }
}
        `;

        const contents = [
            { role: 'user', parts: [{ text: systemPrompt }] },
            { role: 'model', parts: [{ text: '{"answer": "Entendido.", "action": {"type": "none"}}' }] },
            ...this.chatHistory
        ];

        for (const modelName of ['gemini-2.5-flash', 'gemini-2.5-pro']) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            const payload = {
                contents,
                generationConfig: {
                    temperature: 0.2,
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
                    const errTxt = await res.text();
                    console.warn(`[nora AI] Model ${modelName} returned status ${res.status}:`, errTxt);
                }
            } catch (err) {
                console.warn(`[nora AI] Model ${modelName} fetch error:`, err);
            }
        }

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
        const qClean = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // =========================================================================
        // 0.0 Inspección de Objetos Seleccionados (Prioridad Absoluta)
        // =========================================================================
        let selectedEls: any[] = bimContext?.selectedElements || [];

        // Si bimContext viene vacío, inspeccionamos directamente el DOM de la tabla de cantidades
        if (selectedEls.length === 0 && typeof document !== 'undefined') {
            const tableRows = document.querySelectorAll('table tbody tr');
            for (let i = 0; i < tableRows.length; i++) {
                const r = tableRows[i] as HTMLElement;
                const isSelected = r.classList.contains('selected') || r.classList.contains('active') || r.querySelector('input:checked') || (r.getAttribute('style') || '').includes('rgb');
                if (isSelected || tableRows.length === 1) {
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
            if (selectedEls.length === 0 && tableRows.length > 0) {
                const r = tableRows[0] as HTMLElement;
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
                }
            }
        }

        const isSelectionQuery = ['seleccionad', 'este', 'esta', 'tocado', 'marcado', 'que toque', 'actual'].some(k => qClean.includes(k));

        if (selectedEls.length > 0 && (isSelectionQuery || qClean.includes('area') || qClean.includes('volumen') || qClean.includes('longitud') || qClean.includes('medida'))) {
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
        // 0.1 Ejecución del Hook TypeScript / JS del Super Admin
        // =========================================================================
        try {
            const rawTSCode = localStorage.getItem('NORA_CUSTOM_TS_CODE');
            if (rawTSCode && rawTSCode.trim()) {
                const availableLevelsInModel = bimContext?.levels ? Object.keys(bimContext.levels) : [
                    "PISO 1 NE", "ED ADMIN P2 NF", "ED ADMIN P2 NE", "ED ADMIN P1 NF", "ED ADMIN P1 NC", "SOTANO NF", "LEVEL 2", "LEVEL 3", "LEVEL 4"
                ];

                const resultContext: any = {
                    query: query,
                    availableLevels: availableLevelsInModel,
                    activeContext: this.activeContext,
                    categoriesMatched: [],
                    detectedAction: 'none',
                    levelMatched: null,
                    parsedJSON: {
                        action: 'none',
                        categories: [],
                        levelMatched: [],
                        filters: [],
                        message: ''
                    }
                };

                const cleanJS = this.stripTypeScriptTypes(rawTSCode);
                const customHook = new Function('query', 'result', `${cleanJS}\n return noraBrainCustomPipeline(query, result);`);
                const tsResult = customHook(query, resultContext);

                if (tsResult) {
                    const pj = tsResult.parsedJSON || {};
                    const customMessage = pj.message || tsResult.message || tsResult.feedback;

                    if (customMessage) {
                        return {
                            answer: customMessage,
                            action: {
                                type: (pj.action === 'isolate' || tsResult.action === 'isolate') ? 'isolate' : 'none',
                                categories: pj.categories || tsResult.categories,
                                levels: pj.levelMatched || tsResult.levelMatched,
                                message: customMessage
                            }
                        };
                    }

                    let matchedLevels: string[] = pj.levelMatched || (pj.filters?.find((f: any) => f.targetProperty === 'NIVEL INTEGRADO')?.values) || [];
                    let matchedCats: string[] = pj.categories || tsResult.categoriesMatched || [];

                    if (matchedLevels.length > 0 || matchedCats.length > 0) {
                        let totalCount = 0, totalVol = 0, totalArea = 0;
                        for (const lvl of (matchedLevels.length > 0 ? matchedLevels : Object.keys(bimContext?.levels || {}))) {
                            const stats = bimContext?.levels?.[lvl];
                            if (stats) {
                                totalCount += stats.count || 0;
                                totalVol += stats.volume || 0;
                                totalArea += stats.area || 0;
                            }
                        }

                        const lvlStr = matchedLevels.join(', ');
                        const catStr = matchedCats.join(', ');

                        return {
                            answer: `Aislando ${catStr ? 'categoría(s) <b>' + catStr + '</b>' : ''}${lvlStr ? (catStr ? ' en ' : '') + 'nivel(es) <b>' + lvlStr + '</b>' : ''}:<br>• <b>Total elementos:</b> ${totalCount}<br>• <b>Volumen acumulado:</b> ${Math.round(totalVol * 100) / 100} m³<br>• <b>Área acumulada:</b> ${Math.round(totalArea * 100) / 100} m²`,
                            action: {
                                type: 'isolate',
                                levels: matchedLevels.length > 0 ? matchedLevels : undefined,
                                categories: matchedCats.length > 0 ? matchedCats : undefined,
                                message: `Aislado: ${catStr} ${lvlStr}`.trim()
                            }
                        };
                    }
                }
            }
        } catch (err) {
            console.warn('[nora AI] Error al ejecutar Hook TS del Cerebro:', err);
        }

        // =========================================================================
        // 1. Saludos & Ayuda General
        // =========================================================================
        const greetings = ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'saludos', 'quien eres', 'que haces', 'que puedes hacer', 'ayuda', 'help'];
        if (greetings.some(g => qClean.includes(g))) {
            const total = bimContext?.totalElements || 0;
            const catCount = Object.keys(bimContext?.categories || {}).length;
            return {
                answer: `¡Hola! 👋 Soy <b>nora AI Copilot</b>. Estoy conectada en tiempo real a tu modelo 3D (${total} elementos en ${catCount} categorías).<br><br>Puedo ayudarte a:<br>• <b>Aislar elementos estructurales e hidrosanitarios</b> ("Quiero ver solo las columnas", "Aísla la tubería sanitaria")<br>• <b>Consultar cantidades y longitudes</b> ("¿Longitud de tubería en Level 4?")<br>• <b>Consultar objetos seleccionados</b> ("Dame el área del muro seleccionado")`,
                action: { type: 'none' }
            };
        }

        // =========================================================================
        // 2. Restablecer / Mostrar todo
        // =========================================================================
        if (qClean.includes('mostrar todo') || qClean.includes('limpiar') || qClean.includes('restablecer') || qClean.includes('reset') || qClean.includes('encender todo')) {
            this.activeContext = { activeLevels: [], activeCategories: [], activeMaterials: [], activePilotes: [], lastActionType: 'show_all' };
            return {
                answer: 'Se han restablecido todos los filtros y la visibilidad completa del modelo 3D.',
                action: {
                    type: 'show_all',
                    message: 'Modelo 3D y filtros restablecidos'
                }
            };
        }

        // =========================================================================
        // 3. Extracción de Categorías (Estructural + Arquitectura + MEP / Hidrosanitario)
        // =========================================================================
        const matchedCategories: string[] = [];
        if (bimContext && bimContext.categories) {
            const catKeys = Object.keys(bimContext.categories);

            const categoryPatterns: Array<{ userRegex: RegExp; keyRegex: RegExp }> = [
                // Estructura y Obra Gris
                { userRegex: /colum/i, keyRegex: /column|colum/i },
                { userRegex: /viga|beam/i, keyRegex: /beam|viga/i },
                { userRegex: /muro|wall/i, keyRegex: /wall|muro/i },
                { userRegex: /tram|member/i, keyRegex: /member|tram/i },
                { userRegex: /ciment|zapat|footing/i, keyRegex: /footing|ciment|zapat/i },
                { userRegex: /escaler|stair/i, keyRegex: /stair|escaler/i },
                { userRegex: /pilot|pile/i, keyRegex: /pilot|pile/i },
                { userRegex: /\b(?:losa|losas|placa|placas|slab)\b/i, keyRegex: /slab|piso|placa|losa/i },

                // Hidrosanitario / MEP
                { userRegex: /tub[eo]|pipe/i, keyRegex: /tuberi|pipe|conducc/i },
                { userRegex: /union|accesorio|codo|tee|yee|fitting/i, keyRegex: /union|fitting|accesori/i },
                { userRegex: /sanitari|inodoro|lavaman|orinal|aparato|terminal/i, keyRegex: /sanitari|aparato|terminal/i }
            ];

            for (const pattern of categoryPatterns) {
                if (pattern.userRegex.test(qClean)) {
                    for (const catKey of catKeys) {
                        const normKey = catKey.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        if (pattern.keyRegex.test(normKey)) {
                            if (!matchedCategories.includes(catKey)) {
                                matchedCategories.push(catKey);
                            }
                        }
                    }
                }
            }

            if (matchedCategories.length === 0) {
                for (const catKey of catKeys) {
                    const normKey = catKey.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    if (qClean.includes(normKey)) {
                        matchedCategories.push(catKey);
                    }
                }
            }
        }

        // =========================================================================
        // 4. Extracción de Niveles (Español / Inglés / Cotas de Obra)
        // =========================================================================
        let targetLevelKey: string | null = null;
        if (bimContext && bimContext.levels) {
            const levelKeys = Object.keys(bimContext.levels);
            const numMatch = qClean.match(/(?:piso|nivel|level|planta|p|n)\s*([0-9]+)/) || qClean.match(/\b([0-9]+)\b/);
            const queryLevelNumber = numMatch ? numMatch[1] : null;

            for (const lKey of levelKeys) {
                const normLvl = lKey.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (qClean.includes(normLvl)) {
                    targetLevelKey = lKey;
                    break;
                }
                if (queryLevelNumber) {
                    const lNumMatch = normLvl.match(/(?:piso|nivel|level|p|n)\s*([0-9]+)/) || normLvl.match(/\b([0-9]+)\b/);
                    if (lNumMatch && lNumMatch[1] === queryLevelNumber) {
                        targetLevelKey = lKey;
                        break;
                    }
                }
            }
            if (!targetLevelKey && qClean.includes('sotano')) {
                targetLevelKey = levelKeys.find(l => l.toLowerCase().includes('sotano')) || null;
            }
        }

        // =========================================================================
        // 5. Extracción Dinámica de Material (Concretos, PVC Sanitaria, Ventilación)
        // =========================================================================
        let targetMaterialKey: string | null = null;
        if (bimContext && bimContext.materials) {
            const matKeys = Object.keys(bimContext.materials);

            for (const mKey of matKeys) {
                const normMat = mKey.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const matTokens = normMat.split(/[\s\-_/]+/);
                const hasMatch = matTokens.some(token => token.length > 2 && qClean.includes(token));

                if (hasMatch || qClean.includes(normMat)) {
                    targetMaterialKey = mKey;
                    break;
                }
            }
        }

        // =========================================================================
        // 6. Resolución y Respuesta de Visibilidad 3D
        // =========================================================================
        const effectiveLevels: string[] = targetLevelKey ? [targetLevelKey] : [...this.activeContext.activeLevels];
        const effectiveCategories: string[] = matchedCategories.length > 0 ? matchedCategories : (targetLevelKey && this.activeContext.activeCategories.length > 0 ? [...this.activeContext.activeCategories] : []);
        const effectiveMaterials: string[] = targetMaterialKey ? [targetMaterialKey] : [...this.activeContext.activeMaterials];

        if (effectiveCategories.length > 0 || effectiveLevels.length > 0 || effectiveMaterials.length > 0) {
            let totalCount = 0, totalVol = 0, totalArea = 0, totalLen = 0;

            for (const cat of (effectiveCategories.length > 0 ? effectiveCategories : Object.keys(bimContext?.categories || {}))) {
                const stats = bimContext?.categories?.[cat];
                if (stats) {
                    totalCount += stats.count || 0;
                    totalVol += stats.volume || 0;
                    totalArea += stats.area || 0;
                    totalLen += stats.length || 0;
                }
            }

            const catListStr = effectiveCategories.join(', ');
            const lvlListStr = effectiveLevels.join(', ');
            const matListStr = effectiveMaterials.join(', ');

            let answerStr = `Aislando ${catListStr ? 'categoría(s) <b>' + catListStr + '</b>' : ''}${lvlListStr ? (catListStr ? ' en ' : '') + 'nivel <b>' + lvlListStr + '</b>' : ''}${matListStr ? ' (Material: <b>' + matListStr + '</b>)' : ''}:<br>• <b>Total elementos:</b> ${totalCount}<br>• <b>Volumen acumulado:</b> ${Math.round(totalVol * 100) / 100} m³<br>• <b>Área acumulada:</b> ${Math.round(totalArea * 100) / 100} m²`;

            if (totalLen > 0) {
                answerStr += `<br>• <b>Longitud acumulada:</b> ${Math.round(totalLen * 100) / 100} m`;
            }

            return {
                answer: answerStr,
                action: {
                    type: 'isolate',
                    categories: effectiveCategories.length > 0 ? effectiveCategories : undefined,
                    levels: effectiveLevels.length > 0 ? effectiveLevels : undefined,
                    materials: effectiveMaterials.length > 0 ? effectiveMaterials : undefined,
                    message: `Aislado: ${catListStr} ${lvlListStr} ${matListStr}`.trim()
                }
            };
        }

        const total = bimContext?.totalElements || 0;
        return {
            answer: `El modelo cargado cuenta con <b>${total} elementos</b>.<br><br>Puedes pedirme:<br>• <i>"Aísla la tubería sanitaria"</i><br>• <i>"Quiero ver solo las columnas del nivel 2"</i><br>• <i>"Dame el área del muro seleccionado"</i>`,
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