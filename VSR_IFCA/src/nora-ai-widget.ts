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

const DEFAULT_GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export class NoraAIWidget {
    private options: NoraAIOptions;
    private isOpen: boolean = false;
    private isRecording: boolean = false;
    private recognition: any = null;
    private userApiKey: string = localStorage.getItem('NORA_GEMINI_KEY') || '';

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
        const subTitleText = isApiKeyActive ? 'Gemini 2.5 Flash (Online)' : 'BIM AI Engine (Local)';

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
                    <button class="nora-ai-prompt-pill" data-prompt="¿Cuántas columnas y vigas hay?">
                        <i class="fa-solid fa-chart-pie"></i> Columnas y Vigas
                    </button>
                    <button class="nora-ai-prompt-pill" data-prompt="Aísla la categoría TRAMOS en el modelo 3D">
                        <i class="fa-solid fa-eye"></i> Aislar TRAMOS
                    </button>
                    <button class="nora-ai-prompt-pill" data-prompt="Aísla los elementos del Piso 1">
                        <i class="fa-solid fa-layer-group"></i> Nivel 1
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
        document.body.appendChild(this.drawerEl);

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
            const trimmed = inputKey.trim();
            this.userApiKey = trimmed;
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
                ? `<i class="fa-solid fa-circle" style="color: #34d399; font-size: 8px;"></i> Gemini 2.5 Flash (Online)`
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
        this.drawerEl.classList.add('open');
        this.inputEl.focus();
    }

    public close() {
        this.isOpen = false;
        this.drawerEl.classList.remove('open');
    }

    public clearChat() {
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

        if (!apiKey) {
            return this.localHeuristicFallback(userQuery, bimContext);
        }

        const systemPrompt = `
Eres "nora AI", un Asistente experto en BIM y CDE para nora BIM.

CONTEXTO DEL MODELO CORTADO/CARGADO EN PANTALLA:
${JSON.stringify(bimContext, null, 2)}

INSTRUCCIONES DE RESPUESTA:
1. Responde de forma precisa, amable y concisa en formato texto HTML/Markdown básico. Usa negritas para destacar números o valores clave.
2. Si el usuario pide aislaciones, ocultamientos, filtrados o mostrar todo (ej. "Aísla las columnas del piso 1", "Muéstrame solo TRAMOS", "Limpiar filtros"), debes incluir una propiedad "action" en la respuesta JSON.
3. SIEMPRE debes responder ÚNICAMENTE en el siguiente formato JSON estricto:

{
  "answer": "Explicación o respuesta directa al usuario aquí...",
  "action": {
    "type": "isolate" | "hide" | "show_all" | "filter" | "color" | "none",
    "categories": ["NOMBRE_CATEGORIA"],
    "levels": ["NOMBRE_NIVEL"],
    "materials": ["NOMBRE_MATERIAL"],
    "pilotes": ["NUMERO_PILOTE"],
    "colorMode": "category" | "level" | "material" | "pilote" | "none",
    "message": "Mensaje descriptivo de la acción ejecutada"
  }
}
        `;

        const url = `${DEFAULT_GEMINI_ENDPOINT}?key=${apiKey}`;
        const payload = {
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: systemPrompt },
                        { text: `Pregunta del usuario: "${userQuery}"` }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json"
            }
        };

        let res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify(payload)
        });

        // Retry without responseMimeType if model throws 400 on mime parameter
        if (!res.ok && res.status === 400) {
            const retryPayload = { ...payload, generationConfig: { temperature: 0.2 } };
            const retryRes = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify(retryPayload)
            });
            if (retryRes.ok) {
                res = retryRes;
            }
        }

        if (!res.ok) {
            const errBody = await res.text();
            console.warn(`[nora AI] Gemini API error ${res.status}:`, errBody);
            // Fallback to intelligent local heuristic if API key has quota/access restrictions
            return this.localHeuristicFallback(userQuery, bimContext);
        }

        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        try {
            return JSON.parse(rawText);
        } catch (e) {
            return {
                answer: rawText,
                action: { type: 'none' }
            };
        }
    }

    private localHeuristicFallback(query: string, bimContext: any): { answer: string; action: NoraAIAction } {
        const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // 1. Greetings & Casual questions
        const greetings = ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'saludos', 'quien eres', 'que haces', 'que puedes hacer', 'ayuda', 'help', 'solo sabes decir eso'];
        if (greetings.some(g => q.includes(g))) {
            const total = bimContext?.totalElements || 0;
            const catCount = Object.keys(bimContext?.categories || {}).length;
            return {
                answer: `¡Hola! 👋 Soy <b>nora AI Copilot</b>. Estoy conectada en tiempo real a tu modelo 3D (${total} elementos en ${catCount} categorías).<br><br>Puedo responderte sobre:<br>• <b>Cantidades y volúmenes</b> ("¿Cuántas columnas hay?", "Volumen de TRAMOS")<br>• <b>Niveles y materiales</b> ("Aísla Piso 1", "Elementos de Hormigón")<br>• <b>Acciones 3D</b> ("Aísla vigas", "Muéstrame todo el modelo")<br><br><i>💡 Tip: Presiona el ícono 🔑 en la cabecera si deseas vincular una API Key de Gemini.</i>`,
                action: { type: 'none' }
            };
        }

        // 2. Reset / Show All
        if (q.includes('mostrar todo') || q.includes('limpiar') || q.includes('restablecer') || q.includes('reset') || q.includes('encender todo')) {
            return {
                answer: 'Se han restablecido todos los filtros y la visibilidad completa del modelo 3D.',
                action: {
                    type: 'show_all',
                    message: 'Modelo 3D y filtros restablecidos'
                }
            };
        }

        // 3. Category search with rich synonyms & plural forms
        if (bimContext && bimContext.categories) {
            const categoryKeys = Object.keys(bimContext.categories);

            // Synonym mapping
            const catMap: Record<string, string[]> = {
                'columnas': ['columna', 'columnas', 'column'],
                'muros': ['muro', 'muros', 'wall', 'pared'],
                'pisos': ['piso', 'pisos', 'placa', 'placas', 'slab'],
                'tramos': ['tramo', 'tramos', 'escalera', 'escaleras', 'stair'],
                'vigas': ['viga', 'vigas', 'beam'],
                'cimentacion': ['cimentacion', 'zapata', 'zapatas', 'footing'],
                'pilotes': ['pilote', 'pilotes', 'pile'],
                'descansillos': ['descansillo', 'descansillos', 'landing']
            };

            for (const catKey of categoryKeys) {
                const catNorm = catKey.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                
                // Check direct key inclusion or synonyms
                let matched = q.includes(catNorm);
                if (!matched) {
                    for (const group in catMap) {
                        if (catNorm.includes(group) && catMap[group].some(word => q.includes(word))) {
                            matched = true;
                            break;
                        }
                    }
                }

                if (matched) {
                    const stats = bimContext.categories[catKey];
                    const wantsIsolate = q.includes('aisla') || q.includes('filtr') || q.includes('muestra') || q.includes('ver') || q.includes('solo');

                    return {
                        answer: `La categoría <b>${catKey}</b> cuenta con <b>${stats.count} elementos</b>.<br>• <b>Volumen total:</b> ${stats.volume} m³<br>• <b>Área total:</b> ${stats.area} m²`,
                        action: wantsIsolate ? {
                            type: 'isolate',
                            categories: [catKey],
                            message: `Aislada categoría ${catKey} (${stats.count} elementos)`
                        } : { type: 'none' }
                    };
                }
            }
        }

        // 4. Level search
        if (bimContext && bimContext.levels) {
            const levelKeys = Object.keys(bimContext.levels);
            for (const lvlKey of levelKeys) {
                const lvlNorm = lvlKey.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (q.includes(lvlNorm) || (q.includes('piso 1') && lvlNorm.includes('piso 1')) || (q.includes('sotano') && lvlNorm.includes('sotano'))) {
                    const stats = bimContext.levels[lvlKey];
                    return {
                        answer: `En el nivel <b>${lvlKey}</b> hay <b>${stats.count} elementos registrados</b>.`,
                        action: {
                            type: 'isolate',
                            levels: [lvlKey],
                            message: `Aislado nivel ${lvlKey}`
                        }
                    };
                }
            }
        }

        // 5. Material search with PSI / strength matching
        if (bimContext && bimContext.materials) {
            const matKeys = Object.keys(bimContext.materials);
            let bestMatchMatKey: string | null = null;
            
            // Check specific numbers in query from last mentioned to first
            const numbersInQuery = (q.match(/\d+/g) || []).reverse();
            for (const num of numbersInQuery) {
                if (num === '3' || num === '2' || num === '1') continue; // ignore single digits like '3' in m3
                for (const matKey of matKeys) {
                    const matNorm = matKey.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    if (matNorm.includes(num)) {
                        bestMatchMatKey = matKey;
                        break;
                    }
                }
                if (bestMatchMatKey) break;
            }

            if (!bestMatchMatKey) {
                for (const matKey of matKeys) {
                    const matNorm = matKey.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    if (q.includes(matNorm) || (q.includes('hormigon') && matNorm.includes('hormigon')) || (q.includes('concreto') && matNorm.includes('con'))) {
                        bestMatchMatKey = matKey;
                        break;
                    }
                }
            }

            if (bestMatchMatKey) {
                const stats = bimContext.materials[bestMatchMatKey];
                const wantsIsolate = q.includes('aisla') || q.includes('filtr') || q.includes('muestra') || q.includes('ver') || q.includes('solo');

                return {
                    answer: `El material <b>${bestMatchMatKey}</b> está presente en <b>${stats.count} elementos</b> del modelo.<br>• <b>Volumen acumulado:</b> ${stats.volume || 0} m³<br>• <b>Área acumulada:</b> ${stats.area || 0} m²`,
                    action: wantsIsolate ? {
                        type: 'isolate',
                        materials: [bestMatchMatKey],
                        message: `Aislado material ${bestMatchMatKey}`
                    } : { type: 'none' }
                };
            }
        }

        // 6. Total Quantities query
        if (q.includes('cuantida') || q.includes('volumen') || q.includes('cuantos') || q.includes('total')) {
            const total = bimContext?.totalElements || 0;
            const categories = bimContext?.categories || {};
            const catList = Object.keys(categories).map(c => `• <b>${c}:</b> ${categories[c].count} elementos (${categories[c].volume} m³)`).join('<br>');
            return {
                answer: `<b>Resumen Total del Modelo:</b><br>Total de elementos: <b>${total}</b><br><br>${catList}`,
                action: { type: 'none' }
            };
        }

        // Fallback response for unhandled queries
        const catCount = Object.keys(bimContext?.categories || {}).length;
        const total = bimContext?.totalElements || 0;
        return {
            answer: `El modelo cargado cuenta con <b>${total} elementos</b> distribuidos en <b>${catCount} categorías</b>.<br><br>Prueba consultando por una categoría como <i>"¿Cuántas columnas hay?"</i>, <i>"Aísla vigas"</i> o <i>"Resumen de cantidades"</i>.`,
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
