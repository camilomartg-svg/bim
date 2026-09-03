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
                        <div class="nora-ai-subtitle"><i class="fa-solid fa-circle" style="color: #34d399; font-size: 8px;"></i> Gemini 2.5 Flash</div>
                    </div>
                </div>
                <div class="nora-ai-header-actions">
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
                    <button class="nora-ai-prompt-pill" data-prompt="¿Cuáles son las cantidades y volúmenes por categoría?">
                        <i class="fa-solid fa-chart-pie"></i> Cantidades por categoría
                    </button>
                    <button class="nora-ai-prompt-pill" data-prompt="Aísla la categoría TRAMOS en el modelo 3D">
                        <i class="fa-solid fa-eye"></i> Aislar TRAMOS
                    </button>
                    <button class="nora-ai-prompt-pill" data-prompt="¿Qué porcentaje de avance está en estado INSTALADO?">
                        <i class="fa-solid fa-list-check"></i> Avance de obra
                    </button>
                    <button class="nora-ai-prompt-pill" data-prompt="Muéstrame todo el modelo y limpia los filtros">
                        <i class="fa-solid fa-rotate-left"></i> Restablecer 3D
                    </button>
                </div>

                <div class="nora-ai-msg bot">
                    <div class="nora-ai-bubble">
                        👋 ¡Hola! Soy <b>nora AI Copilot</b>. Puedo responder preguntas sobre las cantidades de tu modelo IFC, avance de obra, materiales y <b>ejecutar filtros y aislamientos directamente en la escena 3D</b>. ¿En qué te ayudo hoy?
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
            this.appendBotMessage(`⚠️ Lo siento, ocurrió un error al procesar tu consulta: ${err.message || err}`);
        }
    }

    private async queryLLM(userQuery: string, bimContext: any): Promise<{ answer: string; action: NoraAIAction }> {
        const systemPrompt = `
Eres "nora AI", un Asistente experto en BIM (Building Information Modeling) y CDE (Common Data Environment) para la plataforma nora BIM.

CONTEXTO ACTUAL DEL MODELO CORTADO/CARGADO EN PANTALLA:
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

        // If user provided an API Key or environment key
        const apiKey = this.options.apiKey || (window as any).NORA_GEMINI_API_KEY || '';

        if (!apiKey) {
            // Smart local heuristic fallback if no API key is set
            return this.localHeuristicFallback(userQuery, bimContext);
        }

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

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error(`Error API Gemini (${res.status}): ${await res.text()}`);
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
        const q = query.toLowerCase();

        // 1. Show all / Reset
        if (q.includes('mostrar todo') || q.includes('limpiar') || q.includes('restablecer') || q.includes('reset')) {
            return {
                answer: 'Se han restablecido todos los filtros y la visibilidad completa del modelo 3D.',
                action: {
                    type: 'show_all',
                    message: 'Modelo 3D y filtros restablecidos'
                }
            };
        }

        // 2. Search category isolation
        if (bimContext && bimContext.categories) {
            const categories = Object.keys(bimContext.categories);
            for (const cat of categories) {
                if (q.includes(cat.toLowerCase())) {
                    const stats = bimContext.categories[cat];
                    return {
                        answer: `La categoría <b>${cat}</b> cuenta con <b>${stats.count} elementos</b> (Área: ${stats.area} m², Volumen: ${stats.volume} m³).`,
                        action: {
                            type: 'isolate',
                            categories: [cat],
                            message: `Aislada categoría ${cat} (${stats.count} elementos)`
                        }
                    };
                }
            }
        }

        // 3. Search level isolation
        if (bimContext && bimContext.levels) {
            const levels = Object.keys(bimContext.levels);
            for (const lvl of levels) {
                if (q.includes(lvl.toLowerCase())) {
                    const stats = bimContext.levels[lvl];
                    return {
                        answer: `En el nivel <b>${lvl}</b> hay un total de <b>${stats.count} elementos</b>.`,
                        action: {
                            type: 'isolate',
                            levels: [lvl],
                            message: `Aislado nivel ${lvl}`
                        }
                    };
                }
            }
        }

        // 4. Progress / Status
        if (q.includes('avance') || q.includes('instalado') || q.includes('estado')) {
            const total = bimContext?.totalElements || 0;
            return {
                answer: `El modelo actual tiene <b>${total} elementos registrados</b>. Puedes inspeccionar el desglose en el panel inferior de Avance (STATUS).`,
                action: { type: 'none' }
            };
        }

        // General overview
        const catCount = Object.keys(bimContext?.categories || {}).length;
        const total = bimContext?.totalElements || 0;
        return {
            answer: `El modelo cargado contiene <b>${total} elementos</b> distribuidos en <b>${catCount} categorías</b> principales.<br><br>💡 <i>Tip: Puedes pedirme "Aísla TRAMOS" o "Muéstrame todo el modelo"</i>.`,
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
