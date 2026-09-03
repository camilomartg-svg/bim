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
        // Floating Action Button
        this.fabEl = document.createElement('button');
        this.fabEl.className = 'nora-ai-fab';
        this.fabEl.id = 'nora-ai-trigger';
        this.fabEl.title = 'Consultar nora AI Copilot';
        this.fabEl.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> <span>nora AI</span>';
        this.fabEl.addEventListener('click', () => this.toggle());

        const isApiKeyActive = !!(this.options.apiKey || this.userApiKey || (window as any).NORA_GEMINI_API_KEY);
        const subTitleText = isApiKeyActive ? 'Gemini 2.0 Flash (Online)' : 'BIM AI Engine (Local)';

        // Drawer
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
                    <button class="nora-ai-prompt-pill" data-prompt="Aísla columnas y pisos en el modelo 3D">
                        <i class="fa-solid fa-layer-group"></i> Columnas y Pisos
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
                        👋 ¡Hola! Soy <b>nora AI Copilot</b>. Puedo responder preguntas sobre las cantidades de tu modelo IFC, niveles, materiales y <b>ejecutar aislamientos directamente en el visor 3D</b>. ¿Qué te gustaría consultar?
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

        document.body.appendChild(this.fabEl);
        
        const container = document.getElementById('nora-ai-container');
        if (container) {
            this.drawerEl.className = 'nora-ai-docked';
            container.appendChild(this.drawerEl);
        } else {
            document.body.appendChild(this.drawerEl);
        }

        this.bodyEl = this.drawerEl.querySelector('#nora-ai-messages') as HTMLElement;
        this.inputEl = this.drawerEl.querySelector('#nora-ai-input') as HTMLInputElement;
        this.sendBtnEl = this.drawerEl.querySelector('#nora-ai-send') as HTMLButtonElement;
        this.voiceBtnEl = this.drawerEl.querySelector('#nora-ai-voice') as HTMLButtonElement;

        // Events
        this.drawerEl.querySelector('#nora-ai-close')?.addEventListener('click', () => this.close());
        this.drawerEl.querySelector('#nora-ai-clear')?.addEventListener('click', () => this.clearChat());
        this.drawerEl.querySelector('#nora-ai-key')?.addEventListener('click', () => this.configureApiKey());

        this.sendBtnEl.addEventListener('click', () => this.handleSend());
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleSend();
        });

        // Prompt pills
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
                ? `<i class="fa-solid fa-circle" style="color: #34d399; font-size: 8px;"></i> Gemini 2.0 Flash (Online)`
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

            this.recognition.onerror = () => {
                this.stopRecording();
            };

            this.recognition.onend = () => {
                this.stopRecording();
            };

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

        if (rightPanel) {
            rightPanel.classList.remove('closed');
        }
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
        const rightPanel = document.getElementById('properties-panel');
        if (rightPanel) {
            rightPanel.classList.add('closed');
        } else {
            this.drawerEl.classList.remove('open');
        }
    }

    public clearChat() {
        this.chatHistory = [];
        this.bodyEl.innerHTML = `
            <div class="nora-ai-msg bot">
                <div class="nora-ai-bubble">
                    Conversación reiniciada. ¿En qué puedo ayudarte?
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
        const typing = this.showTypingIndicator();

        try {
            const bimContext = this.options.getBIMContext();
            const response = await this.queryLLM(query, bimContext);

            this.removeTypingIndicator();

            let actionBadge: string | undefined;
            if (response.action && response.action.type !== 'none') {
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

        // Store query in chatHistory for conversational continuity
        this.chatHistory.push({ role: 'user', parts: [{ text: userQuery }] });
        if (this.chatHistory.length > 20) this.chatHistory = this.chatHistory.slice(-20);

        if (!apiKey) {
            const result = this.localHeuristicFallback(userQuery, bimContext);
            this.chatHistory.push({ role: 'model', parts: [{ text: JSON.stringify(result) }] });
            return result;
        }

        const systemPrompt = `
Eres "nora AI", la asistente experta de IA para la plataforma nora BIM.

CONTEXTO DEL MODELO IFC CARGADO EN PANTALLA:
${JSON.stringify(bimContext, null, 2)}

INSTRUCCIONES DE RESPUESTA:
1. Responde de forma precisa, amable y fluida a la conversación. Usa HTML básico (<b>, <i>, <br>).
2. Tienes acceso a categorías, niveles, materiales y matrices combinadas (Nivel x Material, Nivel x Categoría) en bimContext.
3. Si el usuario pide ver/aislar elementos (ej. "quiero ver solo las columnas", "aisla las columnas", "aisla columnas y pisos"), debes incluir "action" con las categorías exactas encontradas en bimContext.categories.
4. SIEMPRE responde ÚNICAMENTE en JSON estricto:

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
            { role: 'model', parts: [{ text: '{"answer": "Entendido. Estoy lista para responder y ejecutar acciones en el visor 3D.", "action": {"type": "none"}}' }] },
            ...this.chatHistory
        ];

        // Try official Gemini models sequentially WITHOUT custom headers to avoid browser CORS preflight blocks
        for (const modelName of ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']) {
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

        // Fallback to robust local heuristic engine
        const fallbackResult = this.localHeuristicFallback(userQuery, bimContext);
        this.chatHistory.push({ role: 'model', parts: [{ text: JSON.stringify(fallbackResult) }] });
        return fallbackResult;
    }

    private localHeuristicFallback(query: string, bimContext: any): { answer: string; action: NoraAIAction } {
        const qClean = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // 1. Greetings & Casual questions
        const greetings = ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'saludos', 'quien eres', 'que haces', 'que puedes hacer', 'ayuda', 'help'];
        if (greetings.some(g => qClean.includes(g))) {
            const total = bimContext?.totalElements || 0;
            const catCount = Object.keys(bimContext?.categories || {}).length;
            return {
                answer: `¡Hola! 👋 Soy <b>nora AI Copilot</b>. Estoy conectada en tiempo real a tu modelo 3D (${total} elementos en ${catCount} categorías).<br><br>Puedo responderte sobre:<br>• <b>Aislamiento 3D por categorías</b> ("Quiero ver solo las columnas", "Aísla tramos")<br>• <b>Cantidades por nivel y material</b> ("¿Volumen de concreto 3000psi en el piso 2?")<br>• <b>Restablecer visor</b> ("Muéstrame todo el modelo")`,
                action: { type: 'none' }
            };
        }

        // 2. Reset / Show All / Turn on everything
        if (qClean.includes('mostrar todo') || qClean.includes('limpiar') || qClean.includes('restablecer') || qClean.includes('reset') || qClean.includes('encender todo') || qClean.includes('prendo todo')) {
            return {
                answer: 'Se han restablecido todos los filtros y la visibilidad completa del modelo 3D.',
                action: {
                    type: 'show_all',
                    message: 'Modelo 3D y filtros restablecidos'
                }
            };
        }

        // 3. Multi-Category Extraction supporting standard IFC entity types, Spanish terms and Super Admin trained synonyms
        const matchedCategories: string[] = [];
        if (bimContext && bimContext.categories) {
            const catKeys = Object.keys(bimContext.categories);

            // Check Super Admin Trained Synonyms first
            try {
                const rawRules = localStorage.getItem('NORA_TRAINING_RULES');
                if (rawRules) {
                    const parsed = JSON.parse(rawRules);
                    if (Array.isArray(parsed.synonyms)) {
                        parsed.synonyms.forEach((s: any) => {
                            if (!s.term || !s.ifcCategory) return;
                            const terms = s.term.split(',').map((t: string) => t.trim().toLowerCase());
                            for (const term of terms) {
                                if (term && qClean.includes(term)) {
                                    const matchingKey = catKeys.find(k => k.toLowerCase() === s.ifcCategory.toLowerCase() || k.toLowerCase().includes(s.ifcCategory.toLowerCase()));
                                    if (matchingKey && !matchedCategories.includes(matchingKey)) {
                                        matchedCategories.push(matchingKey);
                                    } else if (!matchedCategories.includes(s.ifcCategory)) {
                                        matchedCategories.push(s.ifcCategory);
                                    }
                                }
                            }
                        });
                    }
                }
            } catch(e) {}

            const categoryPatterns: Array<{ userRegex: RegExp; keyRegex: RegExp }> = [
                { userRegex: /colum/i, keyRegex: /column|colum/i },
                { userRegex: /piso|placa|losa|slab/i, keyRegex: /slab|piso|placa|losa/i },
                { userRegex: /viga|beam/i, keyRegex: /beam|viga/i },
                { userRegex: /muro|wall/i, keyRegex: /wall|muro/i },
                { userRegex: /tram|member/i, keyRegex: /member|tram/i },
                { userRegex: /ciment|zapat|footing/i, keyRegex: /footing|ciment|zapat/i },
                { userRegex: /escaler|stair/i, keyRegex: /stair|escaler/i },
                { userRegex: /pilot|pile/i, keyRegex: /pilot|pile/i }
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

            // Fallback direct match if category is custom-named
            if (matchedCategories.length === 0) {
                for (const catKey of catKeys) {
                    const normKey = catKey.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    if (qClean.includes(normKey)) {
                        matchedCategories.push(catKey);
                    }
                }
            }
        }

        // 4. Level Extraction (Ignoring isolated "3D" / "3d")
        let targetLevelKey: string | null = null;
        if (bimContext && bimContext.levels) {
            const levelKeys = Object.keys(bimContext.levels);
            
            if (qClean.includes('piso 2') || qClean.includes('psio 2') || qClean.includes('p2') || qClean.includes('nivel 2')) {
                targetLevelKey = levelKeys.find(l => l.includes('P2') || l.includes('2')) || null;
            } else if (qClean.includes('piso 1') || qClean.includes('psio 1') || qClean.includes('p1') || qClean.includes('nivel 1')) {
                targetLevelKey = levelKeys.find(l => l.includes('P1') || l.includes('1')) || null;
            } else if (qClean.includes('piso 3') || qClean.includes('psio 3') || qClean.includes('p3') || qClean.includes('nivel 3')) {
                targetLevelKey = levelKeys.find(l => l.includes('P3') || l.includes('3')) || null;
            } else if (qClean.includes('sotano')) {
                targetLevelKey = levelKeys.find(l => l.toLowerCase().includes('sotano')) || null;
            }
        }

        // 5. Material Extraction
        let targetMaterialKey: string | null = null;
        if (bimContext && bimContext.materials) {
            const matKeys = Object.keys(bimContext.materials);
            
            if (qClean.includes('3000') || qClean.includes('210')) {
                targetMaterialKey = matKeys.find(m => m.includes('3000') || m.includes('210')) || null;
            } else if (qClean.includes('3500') || qClean.includes('245')) {
                targetMaterialKey = matKeys.find(m => m.includes('3500') || m.includes('245')) || null;
            } else if (qClean.includes('4000') || qClean.includes('280')) {
                targetMaterialKey = matKeys.find(m => m.includes('4000') || m.includes('280')) || null;
            }
        }

        // Evaluate Matched Categories
        if (matchedCategories.length > 0) {
            let totalCount = 0;
            let totalVol = 0;
            let totalArea = 0;

            for (const cat of matchedCategories) {
                const stats = bimContext.categories[cat];
                if (stats) {
                    totalCount += stats.count || 0;
                    totalVol += stats.volume || 0;
                    totalArea += stats.area || 0;
                }
            }

            const catListStr = matchedCategories.join(', ');
            return {
                answer: `Aislando categoría(s) <b>${catListStr}</b>:<br>• <b>Total elementos:</b> ${totalCount}<br>• <b>Volumen acumulado:</b> ${Math.round(totalVol * 100) / 100} m³<br>• <b>Área acumulada:</b> ${Math.round(totalArea * 100) / 100} m²`,
                action: {
                    type: 'isolate',
                    categories: matchedCategories,
                    message: `Aislada(s) categoría(s): ${catListStr}`
                }
            };
        }

        // Evaluate Level x Material
        if (targetLevelKey && targetMaterialKey && bimContext?.matrixByLevelAndMaterial) {
            const stats = bimContext.matrixByLevelAndMaterial[targetLevelKey]?.[targetMaterialKey];
            if (stats) {
                return {
                    answer: `En el nivel <b>${targetLevelKey}</b>, el concreto <b>${targetMaterialKey}</b> cuenta con <b>${stats.count} elementos</b>.<br>• <b>Volumen acumulado:</b> ${stats.volume} m³<br>• <b>Área acumulada:</b> ${stats.area} m²`,
                    action: {
                        type: 'isolate',
                        levels: [targetLevelKey],
                        materials: [targetMaterialKey],
                        message: `Aislado ${targetMaterialKey} en ${targetLevelKey}`
                    }
                };
            }
        }

        // Evaluate Level only
        if (targetLevelKey && bimContext?.levels?.[targetLevelKey]) {
            const stats = bimContext.levels[targetLevelKey];
            return {
                answer: `En el nivel <b>${targetLevelKey}</b> hay <b>${stats.count} elementos registrados</b>.<br>• <b>Volumen acumulado:</b> ${stats.volume} m³<br>• <b>Área acumulada:</b> ${stats.area} m²`,
                action: {
                    type: 'isolate',
                    levels: [targetLevelKey],
                    message: `Aislado nivel ${targetLevelKey}`
                }
            };
        }

        // Evaluate Material only
        if (targetMaterialKey && bimContext?.materials?.[targetMaterialKey]) {
            const stats = bimContext.materials[targetMaterialKey];
            return {
                answer: `El material <b>${targetMaterialKey}</b> está presente en <b>${stats.count} elementos</b> del modelo.<br>• <b>Volumen acumulado:</b> ${stats.volume} m³<br>• <b>Área acumulada:</b> ${stats.area} m²`,
                action: {
                    type: 'isolate',
                    materials: [targetMaterialKey],
                    message: `Aislado material ${targetMaterialKey}`
                }
            };
        }

        // Final Default Fallback Response
        const total = bimContext?.totalElements || 0;
        return {
            answer: `El modelo cargado cuenta con <b>${total} elementos</b>.<br><br>Puedes pedirme acciones como:<br>• <i>"Quiero ver solo las columnas"</i><br>• <i>"Aísla columnas y pisos"</i><br>• <i>"¿Cuánto concreto de 3000psi hay en el piso 2?"</i>`,
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
