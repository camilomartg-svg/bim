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
    elementTypes?: string[];
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
    private lastInspectedElement: any = null;

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

        const activeKey = this.options.apiKey || this.userApiKey || (window as any).NORA_GEMINI_API_KEY || '';
        const isValidKey = activeKey.startsWith('AIza');
        const isBadKey = !!activeKey && !isValidKey;
        const subTitleText = isValidKey 
            ? 'Gemini Copilot (Online)' 
            : (isBadKey ? 'Key Inválida (Motor Local)' : 'BIM AI Engine (Local)');
        const statusColor = isValidKey ? '#34d399' : (isBadKey ? '#ef4444' : '#f59e0b');

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
                            <i class="fa-solid fa-circle" style="color: ${statusColor}; font-size: 8px;"></i> ${subTitleText}
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
                    <button class="nora-ai-prompt-pill" data-prompt="Aísla los elementos que hacen parte de la fachada">
                        <i class="fa-solid fa-building"></i> Aislar Fachada
                    </button>
                    <button class="nora-ai-prompt-pill" data-prompt="Oculta la fachada para ver el interior">
                        <i class="fa-solid fa-eye-slash"></i> Ver Interior
                    </button>
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
        const inputKey = prompt(
            'Configurar Google Gemini API Key:\n\n' +
            '• Clave oficial gratuita en: https://aistudio.google.com/app/apikey\n' +
            '• Formato requerido: Comienza siempre por "AIzaSy..."\n' +
            '(Nota: Tokens tipo Google Cloud como "AQ..." o "ya29..." no son válidos).\n\n' +
            'Pega tu API Key de Gemini (o deja vacío para usar motor local):',
            currentKey
        );
        if (inputKey !== null) {
            const trimmed = inputKey.trim();
            if (trimmed) {
                if (!trimmed.startsWith('AIza')) {
                    alert(
                        '⚠️ Atención: La clave ingresada no parece una API Key de Gemini (suelen iniciar por "AIzaSy...").\n\n' +
                        'Has ingresado un token tipo Google Cloud (' + trimmed.substring(0, 8) + '...) que la API rechazará con error 400.\n\n' +
                        'Puedes generar tu API Key gratuita en https://aistudio.google.com/app/apikey'
                    );
                }
                this.userApiKey = trimmed;
                localStorage.setItem('NORA_GEMINI_KEY', this.userApiKey);
            } else {
                this.userApiKey = '';
                localStorage.removeItem('NORA_GEMINI_KEY');
            }
            this.updateStatusText();
        }
    }

    private updateStatusText(overrideStatus?: { text: string; color: string }) {
        const statusEl = this.drawerEl.querySelector('#nora-ai-status-text');
        if (!statusEl) return;
        if (overrideStatus) {
            statusEl.innerHTML = `<i class="fa-solid fa-circle" style="color: ${overrideStatus.color}; font-size: 8px;"></i> ${overrideStatus.text}`;
            return;
        }
        const activeKey = this.userApiKey || this.options.apiKey || (window as any).NORA_GEMINI_API_KEY || '';
        if (activeKey) {
            if (activeKey.startsWith('AIza')) {
                statusEl.innerHTML = `<i class="fa-solid fa-circle" style="color: #34d399; font-size: 8px;"></i> Gemini Copilot (Online)`;
            } else {
                statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #ef4444; font-size: 8px;" title="Clave no válida. Debe comenzar por AIzaSy"></i> Key Inválida (Motor Local)`;
            }
        } else {
            statusEl.innerHTML = `<i class="fa-solid fa-circle" style="color: #f59e0b; font-size: 8px;"></i> BIM AI Engine (Local)`;
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

        // Actualizar referencia al elemento seleccionado si existe
        if (bimContext?.selectedElements && bimContext.selectedElements.length > 0) {
            this.lastInspectedElement = bimContext.selectedElements[0];
        }

        const qClean = userQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        let qNorm = qClean
            .replace(/\btpda[s]?\b/g, 'todas')
            .replace(/\btpd[os]\b/g, 'todos')
            .replace(/\btodso\b/g, 'todos')
            .replace(/\btodsa\b/g, 'todas')
            .replace(/\btodo[s]?\s+el\s+modelo\b/g, 'todo')
            .replace(/\bre+st[aá]blec[ea]?\b/g, 'restablecer')
            .replace(/\bre+st[aá]bl[ea]c?e?r?\b/g, 'restablecer')
            .replace(/\bresteblece\b/g, 'restablecer')
            .replace(/\breinici[ae]r?\b/g, 'restablecer')
            .replace(/\baisl[ae]m[eo]\b/g, 'aislar')
            .replace(/\basil[ae]r?\b/g, 'aislar')
            .replace(/\baislam\b/g, 'aislar')
            .replace(/\bventans\b/g, 'ventanas')
            .replace(/\bventna[s]?\b/g, 'ventanas')
            .replace(/\bmuros?\s+cotina\b/g, 'muros cortina');

        const isReset = /(?:re*st[aá]blec|reset|limpi|mostra?r?\s*todo|ver\s*todo|todo\s*el\s*modelo|despejar|mostrar\s*modelo|quitar\s*filtros|restaurar|todo\s*visible|ver\s*todos?|^todos?$|^todo$)/i.test(qNorm);
        const isSameType = /(?:mismo\s+tipo|mismo\s+nombre|misma\s+categor[ií]a|iguales|similares|de\s+(?:este|ese|aquel)\s*tipo|del\s+mismo|de\s+esa\s+categor[ií]a|de\s+esta\s+categor[ií]a|como\s+(?:este|ese))/i.test(qNorm);
        const isSelectionInfo = ['seleccionad', 'este', 'esta', 'tocado', 'marcado', 'que toque', 'actual', 'que seleccione', 'que elemento es', 'cual es este', 'que es esto'].some(k => qNorm.includes(k)) && !qNorm.includes('aisla');
        const isOnlyThisSelected = /(?:aisla\s*(?:solo|solamente)?\s*(?:este|el\s*seleccionado|esta\s*pieza)|ver\s*solo\s*este)/i.test(qNorm) && !isSameType;

        // Comandos contextuales directos se resuelven en 0ms localmente sin riesgo de timeout o alucinación de red
        if (isReset || isSameType || isSelectionInfo || isOnlyThisSelected) {
            const directResult = this.localHeuristicFallback(userQuery, bimContext);
            this.chatHistory.push({ role: 'user', parts: [{ text: userQuery }] });
            this.chatHistory.push({ role: 'model', parts: [{ text: directResult.answer }] });
            return directResult;
        }

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

ELEMENTO SELECCIONADO O DE REFERENCIA:
${JSON.stringify(this.lastInspectedElement || bimContext.selectedElements?.[0] || null, null, 2)}

ESTADO DE FILTROS Y CONTEXTO ACTIVO:
${JSON.stringify(this.activeContext, null, 2)}

REGLAS CRÍTICAS DE RESPUESTA:
1. SENCILLEZ Y CONCISIÓN TOTAL: Tu respuesta en el campo "answer" debe ser MUY BREVE, DIRECTA Y NATURAL (máximo 1 o 2 oraciones, sin texto de relleno).
2. PROHIBIDO DAR RESPUESTAS GENÉRICAS o soltar menús de ayuda largos a menos que el usuario diga explícitamente "ayuda".
3. Si el usuario pide aislar o cuantificar (ej: "aisla los muros"), di directamente lo que hiciste y el dato esencial (ej: "🧱 He aislado **3,908 muros** (Vol: 1,809.5 m³ | Área: 13,583 m²).").
4. FACHADA Y ENVOLVENTE: Si el usuario pide aislar o consultar la fachada ("aisla la fachada", "elementos de la fachada", "que hacen parte de la fachada", "envolvente exterior"), aísla en classifications los Muros Cortina, Montantes de Muro Cortina y Barandillas (ej: ["MUROS CORTINA", "MONTANTES DE MURO CORTINA", "BARANDILLAS"]). Si pide ver el interior u ocultar la fachada, usa action.type = "hide" con esas clasificaciones.
5. Si el usuario pide algo que no existe en el modelo (por ejemplo "ventanas"), pero el modelo tiene un equivalente obvio (como "Muros Cortina" / fachada vidriada), aíslalos y acláralo en una sola oración: "Este proyecto no tiene ventanas convencionales; he aislado los **Muros Cortina** de la fachada (X uds)."
6. REFERENCIAS CONTEXTUALES: Si el usuario dice "aisla los de ese mismo tipo", "del mismo tipo", "iguales a este", etc., toma el nombre/tipo (name) del ELEMENTO SELECCIONADO y aísla con action.elementTypes: [name].
7. NO incluyas advertencias de auditoría a menos que el usuario pregunte específicamente por anomalías o auditoría.
8. NO agregues tips o consejos no solicitados.

CAPACIDADES Y ACCIONES:
1. CONTROL DE VISIBILIDAD Y FILTRADO MULTICRITERIO:
   - Admite condiciones numéricas: height, length, volume, area, slope, diameter.
   - Mapeo difuso de materiales: drywall -> Gypsum Board; concreto -> Concrete; vidrio -> Glass; acero -> Steel; pvc -> PVC.
   - Inversión lógica: si dice "oculta todo lo que no sea...", invertMatch = true.
2. MANIPULACIÓN DE CÁMARA Y SECCIÓN:
   - Cortes o cajas de sección: action.type = "section", sectionBox: { axis: "x"|"y"|"z", fitToElements: true, clear: false }.
   - Vistas estándar: cameraView = "top" | "front" | "iso" | "focus".
3. MODOS GRÁFICOS ANALÍTICOS Y MAPAS DE CALOR:
   - Heatmap: action.type = "color", colorOverrides: { mode: "heatmap" }.
   - Anomalías: action.type = "color", colorOverrides: { mode: "anomalies" }.
   - Presencia de metadatos: action.type = "color", colorOverrides: { mode: "presence" }.
   - Limpiar colores: colorOverrides: { clear: true }.
4. TAKEOFF AL VUELO:
   - Conteo total, volumen (m³), área (m²), longitud (m).

SIEMPRE responde ÚNICAMENTE en formato JSON:
{
  "answer": "Respuesta muy concisa y directa de 1-2 oraciones...",
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
    "message": "Mensaje descriptivo"
  }
}
            `;

            const contents = [
                { role: 'user', parts: [{ text: systemPrompt }] },
                { role: 'model', parts: [{ text: '{"answer": "Entendido.", "action": {"type": "none"}}' }] },
                ...this.chatHistory
            ];

            if (!apiKey.startsWith('AIza')) {
                console.warn('[nora AI] Gemini API key does not start with AIza, falling back to local engine');
                this.updateStatusText({ text: 'Key Inválida (Motor Local)', color: '#ef4444' });
            } else {
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
                            this.updateStatusText({ text: 'Gemini Copilot (Online)', color: '#34d399' });
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
                            if (res.status === 400 || res.status === 403) {
                                this.updateStatusText({ text: `Key Rechazada por Google (${res.status})`, color: '#ef4444' });
                            }
                        }
                    } catch (err) {
                        console.warn(`[nora AI] Model ${modelName} fetch error:`, err);
                    }
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

        // Normalización de errores tipográficos y variantes coloquiales
        let qNorm = qClean
            .replace(/\btpda[s]?\b/g, 'todas')
            .replace(/\btpd[os]\b/g, 'todos')
            .replace(/\btodso\b/g, 'todos')
            .replace(/\btodsa\b/g, 'todas')
            .replace(/\btodo[s]?\s+el\s+modelo\b/g, 'todo')
            .replace(/\bre+st[aá]blec[ea]?\b/g, 'restablecer')
            .replace(/\bre+st[aá]bl[ea]c?e?r?\b/g, 'restablecer')
            .replace(/\bresteblece\b/g, 'restablecer')
            .replace(/\breinici[ae]r?\b/g, 'restablecer')
            .replace(/\baisl[ae]m[eo]\b/g, 'aislar')
            .replace(/\basil[ae]r?\b/g, 'aislar')
            .replace(/\baislam\b/g, 'aislar')
            .replace(/\bventans\b/g, 'ventanas')
            .replace(/\bventna[s]?\b/g, 'ventanas')
            .replace(/\bmuros?\s+cotina\b/g, 'muros cortina');

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

        // Si hay un elemento seleccionado actualmente, se recuerda en memoria contextual
        if (selectedEls.length > 0) {
            this.lastInspectedElement = selectedEls[0];
        }
        const activeRefEl = selectedEls.length > 0 ? selectedEls[0] : this.lastInspectedElement;

        // =========================================================================
        // 0.1 AISLAMIENTO O FILTRADO DE ELEMENTOS DEL MISMO TIPO / SELECCIONADO
        // =========================================================================
        const isSameTypeQuery = /(?:mismo\s+tipo|mismo\s+nombre|misma\s+categor[ií]a|iguales|similares|de\s+(?:este|ese|aquel)\s*tipo|del\s+mismo|de\s+esa\s+categor[ií]a|de\s+esta\s+categor[ií]a|como\s+(?:este|ese))/i.test(qNorm);

        if (isSameTypeQuery) {
            if (!activeRefEl) {
                return {
                    answer: '⚠️ No tengo ningún elemento de referencia. Haz clic en un elemento del modelo 3D primero.',
                    action: { type: 'none' }
                };
            }

            const targetName = activeRefEl.name || activeRefEl.category || activeRefEl.classification;
            const targetClassif = activeRefEl.classification;
            const isHide = /(?:oculta|ocultar|esconde|esconder|quita|quitar|remover)/i.test(qNorm);

            if (isHide) {
                return {
                    answer: `👁️ He ocultado todos los elementos del tipo **${targetName}**${targetClassif ? ' (' + targetClassif + ')' : ''}.`,
                    action: {
                        type: 'hide',
                        elementTypes: [targetName],
                        categories: [targetName],
                        message: `Ocultados elementos tipo ${targetName}`
                    }
                };
            }

            return {
                answer: `🎯 He aislado todos los elementos del tipo **${targetName}**${targetClassif ? ' (' + targetClassif + ')' : ''} en el modelo 3D.`,
                action: {
                    type: 'isolate',
                    elementTypes: [targetName],
                    categories: [targetName],
                    cameraView: 'focus',
                    message: `Aislados elementos tipo ${targetName}`
                }
            };
        }

        // Consultar qué elemento es el seleccionado actualmente
        const isSelectionInfoQuery = ['seleccionad', 'este', 'esta', 'tocado', 'marcado', 'que toque', 'actual', 'que seleccione', 'que elemento es', 'cual es este', 'que es esto'].some(k => qNorm.includes(k)) && !qNorm.includes('aisla');

        if (activeRefEl && isSelectionInfoQuery) {
            const el = activeRefEl;
            const detailLines: string[] = [];
            if (el.name) detailLines.push(`• <b>Nombre / Tipo:</b> ${el.name}`);
            if (el.category) detailLines.push(`• <b>Categoría:</b> ${el.category}${el.classification ? ' (' + el.classification + ')' : ''}`);
            if (el.level) detailLines.push(`• <b>Ubicación (Nivel):</b> ${el.level}`);
            if (el.material) detailLines.push(`• <b>Material:</b> ${el.material}`);
            if (el.area > 0) detailLines.push(`• <b>Área Individual:</b> ${el.area} m²`);
            if (el.volume > 0) detailLines.push(`• <b>Volumen Individual:</b> ${el.volume} m³`);
            if (el.length > 0) detailLines.push(`• <b>Longitud Individual:</b> ${el.length} m`);

            return {
                answer: `📌 <b>Elemento seleccionado:</b><br>${detailLines.join('<br>')}`,
                action: { type: 'none' }
            };
        }

        // Aislar exclusivamente el elemento seleccionado
        const isIsolateOnlySelection = /(?:aisla\s*(?:solo|solamente)?\s*(?:este|el\s*seleccionado|esta\s*pieza)|ver\s*solo\s*este)/i.test(qNorm) && !isSameTypeQuery;
        if (isIsolateOnlySelection && activeRefEl) {
            const targetName = activeRefEl.name || 'Elemento seleccionado';
            return {
                answer: `🎯 He enfocado y aislado el elemento **${targetName}** en el visor 3D.`,
                action: {
                    type: 'isolate',
                    elementTypes: activeRefEl.name ? [activeRefEl.name] : undefined,
                    cameraView: 'focus',
                    message: `Aislado elemento ${targetName}`
                }
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
        // 1.1 SALUDOS Y AYUDA DIRECTA
        // =========================================================================
        if (/^(?:hola|buenos\s*d[ií]as|buenas\s*tardes|buenas|saludos|hey|hi)$/i.test(qNorm)) {
            return {
                answer: '👋 ¡Hola! ¿En qué puedo ayudarte con el modelo 3D? Puedes pedirme aislar elementos, medir cantidades, hacer cortes o cambiar de vista.',
                action: { type: 'none' }
            };
        }

        if (/(?:qu[eé]\s+puedes\s+hacer|ayuda|comandos|que\s+haces)/i.test(qNorm)) {
            return {
                answer: '💡 Puedes pedirme cosas sencillas como:\n• **Aislar:** *"aisla los muros"*, *"columnas del piso 2"*\n• **Cortes y vistas:** *"corte en eje X"*, *"vista en planta"*\n• **Cantidades:** *"cuantos muros hay"*, *"volumen de concreto"*\n• **Restablecer:** *"restablecer"* o *"mostrar todo"*',
                action: { type: 'none' }
            };
        }

        // =========================================================================
        // 2. RESTABLECER / MOSTRAR TODO (Tolerante a fallas ortográficas y variantes)
        // =========================================================================
        const isReset = /(?:re*st[aá]blec|reset|limpi|mostra?r?\s*todo|ver\s*todo|todo\s*el\s*modelo|despejar|mostrar\s*modelo|quitar\s*filtros|restaurar|todo\s*visible|ver\s*todos?|^todos?$|^todo$)/i.test(qNorm);
        if (isReset) {
            this.activeContext = { activeClassifications: [], activeLevels: [], activeCategories: [], activeMaterials: [], activePilotes: [], lastActionType: 'show_all' };
            const total = bimContext?.totalElements || 0;
            return {
                answer: `🔄 He restablecido la visibilidad completa del modelo (${total} elementos).`,
                action: { type: 'show_all', message: 'Modelo restablecido' }
            };
        }

        // =========================================================================
        // 3. MODOS GRÁFICOS ANALÍTICOS Y MAPAS DE CALOR (COLOR OVERRIDES)
        // =========================================================================
        if (/(?:limpiar\s+colores|quitar\s+colores|restablecer\s+colores|sin\s+colorear|sin\s+colores)/i.test(qNorm)) {
            return {
                answer: '🎨 Colores analíticos restablecidos a la apariencia normal.',
                action: { type: 'color', colorOverrides: { clear: true }, message: 'Colores analíticos restablecidos' }
            };
        }

        if (/(?:mapa\s+de\s+calor|heatmap|degradado|gradiente)\s*(?:de\s+|por\s+)?(?:volumen|cantidades|esfuerzos)?/i.test(qNorm)) {
            return {
                answer: '🔥 Visualizando mapa de calor según el volumen de los elementos.',
                action: { type: 'color', colorOverrides: { mode: 'heatmap' }, message: 'Mapa de calor por volumen aplicado' }
            };
        }

        if (/(?:pinta|colorea|resalta|detecta|audita)\s*(?:las\s*)?anomal[ií]as|volumen\s*=?\s*0|sin\s+nivel/i.test(qNorm)) {
            const anomTotal = bimContext?.anomalies?.totalAnomalies || 0;
            return {
                answer: `⚠️ Se han resaltado en rojo los **${anomTotal} elementos anómalos** (volumen = 0 o sin nivel) y en verde los conformes.`,
                action: { type: 'color', colorOverrides: { mode: 'anomalies' }, message: `Auditoría visual: ${anomTotal} anomalías en rojo` }
            };
        }

        if (/(?:pinta|colorea)\s*(?:de\s+)?rojo.*sin\s+(?:par[aá]metro|fase|nivel)|verde.*con\s+(?:par[aá]metro|fase|nivel)/i.test(qNorm)) {
            return {
                answer: '🔍 Se resaltaron en verde los elementos con parámetros completos y en rojo los elementos sin nivel o fase.',
                action: { type: 'color', colorOverrides: { mode: 'presence' }, message: 'Auditoría de metadatos aplicada' }
            };
        }

        // =========================================================================
        // 4. GENERACIÓN DE CORTES Y CAJAS DE SECCIÓN (SECTION BOX)
        // =========================================================================
        if (/(?:quitar\s+cortes?|limpiar\s+secci[oó]n|sin\s+cortes?|eliminar\s+corte)/i.test(qNorm)) {
            return {
                answer: '✂️ Planos de corte eliminados.',
                action: { type: 'section', sectionBox: { clear: true }, message: 'Planos de corte eliminados' }
            };
        }

        const cutMatch = qNorm.match(/(?:haz\s+un\s+)?corte\s+(?:transversal|longitudinal|secci[oó]n)?\s*(?:en\s+el\s+eje\s+)?([xyz]|4|[0-9]+)?/i) || qNorm.match(/caja\s+de\s+secci[oó]n|section\s*box/i);
        if (cutMatch && !qNorm.includes('aisla') && !qNorm.includes('cuanto')) {
            let axis: 'x' | 'y' | 'z' = 'y';
            const rawAxis = cutMatch[1]?.toLowerCase();
            if (rawAxis === 'x' || rawAxis === '4') axis = 'x';
            else if (rawAxis === 'z') axis = 'z';
            else axis = 'y';

            return {
                answer: `✂️ Corte transversal insertado en el eje **${axis.toUpperCase()}**. Puedes moverlo en el visor 3D.`,
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
        const isCamTop = /(?:vista\s+superior|planta|vista\s+en\s+planta|desde\s+arriba)/i.test(qNorm);
        const isCamFront = /(?:vista\s+frontal|fachada\s+principal|de\s+frente)/i.test(qNorm);
        const isCamIso = /(?:isom[eé]trica|vista\s+3d|isom[eé]trico)/i.test(qNorm);
        const isCamFocus = /(?:enf[oó]cate|ac[eé]rcate|centra|zoom\s+a|mira\s+de\s+frente)/i.test(qNorm);

        if ((isCamTop || isCamFront || isCamIso || isCamFocus) && !qNorm.includes('aisla') && !qNorm.includes('muros') && !qNorm.includes('columnas')) {
            const camView = isCamTop ? 'top' : isCamFront ? 'front' : isCamIso ? 'iso' : 'focus';
            const camNames: Record<string, string> = { top: 'Superior (Planta)', front: 'Frontal', iso: 'Isométrica 3D', focus: 'Enfocada' };
            return {
                answer: `📷 Vista orientada a **${camNames[camView]}**.`,
                action: { type: 'camera', cameraView: camView as any, message: `Vista ${camNames[camView]} activada` }
            };
        }

        // =========================================================================
        // 6. DETECCIÓN DE FILTROS NUMÉRICOS Y GEOMÉTRICOS AVANZADOS
        // =========================================================================
        let numericFilter: NoraAIAction['numericFilter'] | undefined = undefined;

        // Altura: ej. "de más de 2.50 metros de altura", "altura mayor a 3m"
        const heightMatch = qNorm.match(/(?:altura|alto|altas|altos)\s*(?:de\s*)?(?:m[aá]s\s*de|mayor\s*(?:a|que)|superior\s*(?:a|que)|>)\s*([0-9]+(?:[\.,][0-9]+)?)/i);
        const heightLessMatch = qNorm.match(/(?:altura|alto)\s*(?:de\s*)?(?:menos\s*de|menor\s*(?:a|que)|inferior\s*(?:a|que)|<)\s*([0-9]+(?:[\.,][0-9]+)?)/i);
        if (heightMatch) {
            numericFilter = { property: 'height', operator: '>', value: parseFloat(heightMatch[1].replace(',', '.')) };
        } else if (heightLessMatch) {
            numericFilter = { property: 'height', operator: '<', value: parseFloat(heightLessMatch[1].replace(',', '.')) };
        }

        // Pendiente: ej. "pendiente menor al 1%"
        const slopeMatch = qNorm.match(/(?:pendiente)\s*(?:menor\s*(?:a|que|al)|menos\s*de|<)\s*([0-9]+(?:[\.,][0-9]+)?)\s*%/i);
        if (slopeMatch) {
            numericFilter = { property: 'slope', operator: '<', value: parseFloat(slopeMatch[1].replace(',', '.')) };
        }

        // Volumen: ej. "volumen mayor a 0.5 m3"
        const volMatch = qNorm.match(/(?:volumen)\s*(?:m[aá]s\s*de|mayor\s*(?:a|que)|superior\s*(?:a|que)|>)\s*([0-9]+(?:[\.,][0-9]+)?)/i);
        if (volMatch) {
            numericFilter = { property: 'volume', operator: '>', value: parseFloat(volMatch[1].replace(',', '.')) };
        }

        // Longitud: ej. "longitud mayor a 4 metros"
        const lenMatch = qNorm.match(/(?:longitud|largo)\s*(?:m[aá]s\s*de|mayor\s*(?:a|que)|superior\s*(?:a|que)|>)\s*([0-9]+(?:[\.,][0-9]+)?)/i);
        if (lenMatch) {
            numericFilter = { property: 'length', operator: '>', value: parseFloat(lenMatch[1].replace(',', '.')) };
        }

        // Inversión lógica: ej. "oculta todo lo que no sea estructura de concreto"
        const isNegationQuery = /(?:oculta|quita|remover)\s+todo\s+lo\s+que\s+no\s+sea/i.test(qNorm);

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
            if (qNorm.includes(groupName) || groupKeywords.some(gk => qNorm.includes(gk))) {
                for (const realMat of availableMaterials) {
                    const normM = realMat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    if (groupKeywords.some(gk => normM.includes(gk))) {
                        targetMaterialKey = realMat;
                        break;
                    }
                }
                if (!targetMaterialKey) targetMaterialKey = groupName;
                break;
            }
        }

        // =========================================================================
        // 8. EXTRACCIÓN DE CLASIFICACIONES Y NIVELES
        // =========================================================================
        const isHide = /(oculta|ocultar|esconde|esconder|apaga|apagar|quitar|quita|remover|desactiva)/i.test(qNorm);
        const isExplicitQuantity = /(cu[aá]nto|cu[aá]ntos|cu[aá]nta|cu[aá]ntas|qu[eé] cantidad|dame el metrado|metrado|resumen de cantidades|cu[aá]l es el volumen|cu[aá]l es el [aá]rea|cu[aá]ntos metros)/i.test(qNorm);
        const isExplicitIsolate = /(aisla|aislar|a[ií]sla|ver solo|muestra solo|mostrar solo|deja solo|dejame ver|quiero ver|necesito ver|necesito que aisles|solamente|unicamente|todos los|todas las|todo el|toda la|filtra|filtrar)/i.test(qNorm);

        const classifDict = bimContext?.classifications || bimContext?.categories || {};
        const availableClassifs = Object.keys(classifDict);
        const matchedClassifications: string[] = [];

        // =========================================================================
        // 8.0 RECONOCIMIENTO INTELIGENTE DE FACHADA Y ENVOLVENTE EXTERIOR
        // =========================================================================
        const isFacadeQuery = /(?:fachada|fachadas|envolvente|envolventes|exterior(?:es)?)\b/i.test(qNorm);
        const isInteriorQuery = /(?:interior(?:es)?|distribuci[oó]n\s+interior|tabiquer[ií]a\s+interior)\b/i.test(qNorm) && !qNorm.includes('exterior');

        if (isFacadeQuery || isInteriorQuery) {
            const facadeMatches = availableClassifs.filter(c => {
                const nc = c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return nc.includes('cortina') || 
                       nc.includes('montante') || 
                       nc.includes('barandilla') || 
                       nc.includes('fachada') || 
                       nc.includes('envolvente') ||
                       nc.includes('vidrio') ||
                       nc.includes('acristalamiento');
            });

            if (facadeMatches.length > 0) {
                let facadeCount = 0;
                let facadeArea = 0;
                let facadeVol = 0;
                for (const fm of facadeMatches) {
                    const stats = classifDict[fm] || {};
                    facadeCount += stats.count || 0;
                    facadeArea += stats.area || 0;
                    facadeVol += stats.volume || 0;
                }

                const wantsToHide = isHide || isNegationQuery || isInteriorQuery || /(?:oculta|ocultar|esconde|esconder|quitar|adentro|ver\s+el\s+interior)/i.test(qNorm);

                if (wantsToHide) {
                    return {
                        answer: `🏢 He ocultado los elementos de la **Fachada y Envolvente** (${facadeMatches.join(', ')}: ${facadeCount} uds) para visualizar la distribución interior.`,
                        action: {
                            type: 'hide',
                            classifications: facadeMatches,
                            message: `Fachada y Envolvente ocultada (${facadeCount} uds)`
                        }
                    };
                }

                if (isExplicitQuantity && !isExplicitIsolate) {
                    return {
                        answer: `📊 La **Fachada y Envolvente Exterior** está compuesta por **${facadeCount} elementos** (${facadeMatches.join(', ')})${facadeArea > 0 ? ' con un área total de **' + Math.round(facadeArea).toLocaleString() + ' m²**' : ''}.`,
                        action: { type: 'none' }
                    };
                }

                const areaStr = facadeArea > 0 ? ` | Área: **${Math.round(facadeArea).toLocaleString()} m²**` : '';
                return {
                    answer: `🏢 He aislado los elementos de la **Fachada y Envolvente Exterior** (${facadeMatches.join(', ')}: **${facadeCount} uds**${areaStr}).`,
                    action: {
                        type: 'isolate',
                        classifications: facadeMatches,
                        cameraView: 'focus',
                        message: `Aislada Fachada y Envolvente (${facadeCount} uds)`
                    }
                };
            }
        }

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

        const isCortinaMentioned = qNorm.includes('cortina') || qNorm.includes('curtain') || qNorm.includes('fachada flotante');
        const isAllWalls = /(todos los muros|todos muros|aisla los muros|aisla muros|aislar los muros|todos los muros del proyecto|necesito que aisles todos los muros)/i.test(qNorm);

        for (const realClassif of availableClassifs) {
            const normReal = realClassif.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

            if (normReal.includes('muros cortina') || normReal.includes('muro cortina')) {
                if (isCortinaMentioned || isAllWalls) {
                    if (!matchedClassifications.includes(realClassif)) matchedClassifications.push(realClassif);
                }
                continue;
            }

            if (qNorm.includes(normReal)) {
                if (!matchedClassifications.includes(realClassif)) matchedClassifications.push(realClassif);
                continue;
            }

            for (const [keyGroup, aliasList] of Object.entries(classificationAliases)) {
                const normGroup = keyGroup.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (normReal === normGroup || normReal.includes(normGroup) || normGroup.includes(normReal)) {
                    const matchFound = aliasList.some(alias => {
                        const regex = new RegExp(`\\b${alias}\\b`, 'i');
                        return regex.test(qNorm);
                    });
                    if (matchFound) {
                        if (!matchedClassifications.includes(realClassif)) matchedClassifications.push(realClassif);
                    }
                }
            }
        }

        // =========================================================================
        // 8.1 MANEJO INTELIGENTE DE CATEGORÍAS NO EXISTENTES (EJ. VENTANAS -> MUROS CORTINA)
        // =========================================================================
        const isWindowsQuery = /\b(ventanas?|ventaner[ií]as?|vidrieras?)\b/i.test(qNorm);
        if (isWindowsQuery && !matchedClassifications.some(c => /ventana/i.test(c))) {
            const curtainMatches = availableClassifs.filter(c => {
                const nc = c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return nc.includes('cortina') || nc.includes('curtain') || nc.includes('montante') || nc.includes('panel vidriado');
            });

            if (curtainMatches.length > 0) {
                let curtainCount = 0;
                for (const cm of curtainMatches) {
                    curtainCount += classifDict[cm]?.count || 0;
                }
                return {
                    answer: `🪟 Este proyecto no utiliza ventanas convencionales; su fachada es de **${curtainMatches.join(' y ')}** (${curtainCount} uds). Los he aislado para ti en el visor 3D.`,
                    action: {
                        type: 'isolate',
                        classifications: curtainMatches,
                        cameraView: 'focus',
                        message: `Aislado: ${curtainMatches.join(', ')}`
                    }
                };
            } else {
                return {
                    answer: 'ℹ️ Este modelo no contiene la categoría de **Ventanas**.',
                    action: { type: 'none' }
                };
            }
        }

        // Extracción de Niveles
        let targetLevelKey: string | null = null;
        if (bimContext && bimContext.levels) {
            const levelKeys = Object.keys(bimContext.levels);
            const numMatch = qNorm.match(/(?:piso|nivel|level|planta|sotano|p|n)\s*([0-9]+)/i) || qNorm.match(/\b([0-9]+)\b/);
            const queryLevelNumber = numMatch ? numMatch[1] : null;

            for (const lKey of levelKeys) {
                const normLvl = lKey.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (qNorm.includes(normLvl)) {
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

        // Si el usuario pidió explícitamente una categoría que no existe en este modelo BIM
        if (matchedClassifications.length === 0 && !targetLevelKey && !targetMaterialKey && !numericFilter) {
            for (const [keyGroup, aliasList] of Object.entries(classificationAliases)) {
                if (aliasList.some(alias => new RegExp(`\\b${alias}\\b`, 'i').test(qNorm))) {
                    return {
                        answer: `ℹ️ No se encontraron elementos de **${keyGroup}** en este modelo BIM.`,
                        action: { type: 'none' }
                    };
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
            : (matchedClassifications.length > 0 && !qNorm.includes('todo el proyecto') && !qNorm.includes('todos los') ? [...this.activeContext.activeLevels] : []);

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

            // Filtro numérico descriptor
            let numDesc = '';
            if (numericFilter) {
                const pNames: Record<string, string> = { height: 'altura', slope: 'pendiente', volume: 'volumen', length: 'longitud', area: 'área', diameter: 'diámetro' };
                numDesc = ` con ${pNames[numericFilter.property] || numericFilter.property} ${numericFilter.operator} ${numericFilter.value}${numericFilter.property === 'slope' ? '%' : 'm'}`;
            }

            let invertDesc = isNegationQuery ? ' (excluyendo lo que no coincida)' : '';

            // CASO A: OCULTAR
            if (isHide) {
                return {
                    answer: `👁️ He ocultado **${classifStr || 'elementos'}**${lvlStr ? ' en **' + lvlStr + '**' : ''}${numDesc}${invertDesc} (${totalCount} uds).`,
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
                let qtyAnswer = `📊 **${classifStr || 'Elementos'}**${lvlStr ? ' en **' + lvlStr + '**' : ''}${matStr ? ' (' + matStr + ')' : ''}: **${totalCount} uds**`;
                if (roundedVol > 0) qtyAnswer += ` | Vol: **${roundedVol} m³**`;
                if (roundedArea > 0) qtyAnswer += ` | Área: **${roundedArea} m²**`;
                if (roundedLen > 0) qtyAnswer += ` | Long: **${roundedLen} m**`;

                return {
                    answer: qtyAnswer,
                    action: { type: 'none' }
                };
            }

            // CASO C: AISLAMIENTO MULTICRITERIO + TAKEOFF EN TIEMPO REAL
            const metricsSummary: string[] = [];
            if (roundedVol > 0) metricsSummary.push(`Vol: **${roundedVol} m³**`);
            if (roundedArea > 0) metricsSummary.push(`Área: **${roundedArea} m²**`);
            if (roundedLen > 0) metricsSummary.push(`Long: **${roundedLen} m**`);
            const metricsStr = metricsSummary.length > 0 ? ` (${metricsSummary.join(' | ')})` : '';

            let answerStr = '';
            if (isAllWalls || qNorm.includes('todos los muros')) {
                answerStr = `🧱 He aislado **${totalCount} muros** en el modelo 3D${metricsStr}.`;
            } else {
                answerStr = `🎯 He aislado **${classifStr || 'elementos'}**${lvlStr ? ' en **' + lvlStr + '**' : ''}${matStr ? ' (' + matStr + ')' : ''}${numDesc}: **${totalCount} uds**${metricsStr}.`;
            }

            // Solo mostrar auditoría si el usuario preguntó por anomalías o inconsistencias
            if (qNorm.includes('audita') || qNorm.includes('anomali') || qNorm.includes('inconsisten')) {
                const zeroVol = bimContext?.anomalies?.zeroVolumeCount || 0;
                const missingLvl = bimContext?.anomalies?.missingLevelCount || 0;
                if (zeroVol > 0 || missingLvl > 0) {
                    answerStr += `<br>⚠️ *Auditoría:* ${zeroVol} elementos con vol=0, ${missingLvl} sin nivel.`;
                }
            }

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
        // 10. Si no coincidió ningún filtro específico (Respuesta sencilla y directa)
        // =========================================================================
        return {
            answer: 'No reconocí esa consulta en el modelo. Puedes pedirme cosas sencillas como *"aisla los muros"*, *"corte en eje X"*, o *"mostrar todo"*.',
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