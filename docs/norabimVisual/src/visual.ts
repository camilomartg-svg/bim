"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualEventService = powerbi.extensibility.IVisualEventService;

import { VisualFormattingSettingsModel } from "./settings";

export class Visual implements IVisual {
    private events: IVisualEventService;
    private target: HTMLElement;
    private container: HTMLDivElement;
    private iframe: HTMLIFrameElement;
    private loader: HTMLDivElement;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;

    private currentSrc: string = "";
    private currentFragId: string = "";
    private currentJsonId: string = "";
    private iframeLoaded: boolean = false;
    private pendingFilter: any = null;
    private lastSentIdsJson: string = "";

    private statusBadge: HTMLDivElement;

    constructor(options: VisualConstructorOptions) {
        this.events = options.host.eventService;
        this.formattingSettingsService = new FormattingSettingsService();
        this.target = options.element;

        this.target.innerHTML = "";
        this.target.style.overflow = "hidden";
        this.target.style.width = "100%";
        this.target.style.height = "100%";

        this.container = document.createElement("div");
        this.container.className = "norabim-container";
        this.container.style.position = "relative";
        this.container.style.width = "100%";
        this.container.style.height = "100%";
        this.container.style.backgroundColor = "#0f172a";

        this.iframe = document.createElement("iframe");
        this.iframe.className = "norabim-iframe";
        this.iframe.style.position = "absolute";
        this.iframe.style.top = "0";
        this.iframe.style.left = "0";
        this.iframe.style.width = "100%";
        this.iframe.style.height = "100%";
        this.iframe.style.border = "none";
        this.iframe.style.display = "block";
        this.iframe.setAttribute("allow", "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture");
        // Sandbox removed for unrestricted 3D model streaming in WebView2

        this.loader = document.createElement("div");
        this.loader.className = "norabim-loader";
        this.loader.style.position = "absolute";
        this.loader.style.top = "0";
        this.loader.style.left = "0";
        this.loader.style.width = "100%";
        this.loader.style.height = "100%";
        this.loader.style.display = "flex";
        this.loader.style.flexDirection = "column";
        this.loader.style.alignItems = "center";
        this.loader.style.justifyContent = "center";
        this.loader.style.backgroundColor = "rgba(15, 23, 42, 0.9)";
        this.loader.style.color = "#f8fafc";
        this.loader.style.fontFamily = "Segoe UI, sans-serif";
        this.loader.style.zIndex = "10";
        this.loader.style.pointerEvents = "none";
        this.loader.style.transition = "opacity 0.4s ease";
        this.loader.innerHTML = `
            <div style="font-size: 20px; font-weight: 600; margin-bottom: 8px; color: #38bdf8;">
                <span style="color: #60a5fa;">Nora</span>BIM 3D
            </div>
            <div style="font-size: 13px; color: #94a3b8;">Cargando modelo 3D...</div>
        `;

        this.statusBadge = document.createElement("div");
        this.statusBadge.style.cssText = "position:absolute; bottom:8px; left:8px; z-index:20; background:rgba(15,23,42,0.85); color:#38bdf8; font-family:Segoe UI, sans-serif; font-size:11px; padding:3px 8px; border-radius:6px; border:1px solid rgba(56,189,248,0.3); pointer-events:none; transition:opacity 0.5s ease;";
        this.statusBadge.innerText = "NoraBIM 3D: Inicializando...";

        this.container.appendChild(this.iframe);
        this.container.appendChild(this.loader);
        this.container.appendChild(this.statusBadge);
        this.target.appendChild(this.container);

        this.iframe.onload = () => {
            this.iframeLoaded = true;
            setTimeout(() => {
                this.loader.style.opacity = "0";
                setTimeout(() => {
                    this.loader.style.display = "none";
                }, 400);
            }, 1200);

            // Trigger model loading explicitly via message as backup to URL param
            if (this.currentFragId) {
                this.sendPostMessage({
                    type: "NORA_LOAD_MODEL",
                    fragId: this.currentFragId,
                    jsonId: this.currentJsonId
                });
            }

            if (this.pendingFilter) {
                setTimeout(() => {
                    this.sendPostMessage(this.pendingFilter);
                    this.pendingFilter = null;
                }, 1500);
            }
        };

        window.addEventListener("message", (event) => {
            try {
                if (!event.data || typeof event.data !== "object") return;
                if (event.data.type === "NORA_VIEWER_READY") {
                    if (this.pendingFilter) {
                        this.sendPostMessage(this.pendingFilter);
                        this.pendingFilter = null;
                    }
                } else if (event.data.type === "NORA_VIEWER_STATUS") {
                    if (this.statusBadge && event.data.text) {
                        this.statusBadge.innerText = (event.data.isError ? "⚠️ " : "⚡ ") + event.data.text;
                        this.statusBadge.style.opacity = "1";
                        if (event.data.isError) {
                            this.statusBadge.style.borderColor = "#ef4444";
                            this.statusBadge.style.color = "#f87171";
                        }
                    }
                }
            } catch (e) {
                console.error("[NoraBIM Visual] Message error:", e);
            }
        });
    }

    private sendPostMessage(payload: any) {
        try {
            if (this.iframe && this.iframe.contentWindow) {
                this.iframe.contentWindow.postMessage(payload, "*");
            }
        } catch (err) {
            console.warn("[NoraBIM Visual] postMessage failed:", err);
        }
    }

    public update(options: VisualUpdateOptions) {
        this.events.renderingStarted(options);

        try {
            const dataView = options.dataViews && options.dataViews[0];
            if (dataView) {
                this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
                    VisualFormattingSettingsModel,
                    dataView
                );
            }

            const modelSettings = this.formattingSettings?.modelCard;
            let viewerBaseUrl = (modelSettings?.viewerUrl?.value || "").trim();
            if (!viewerBaseUrl || viewerBaseUrl.includes("VSR_IFCA")) {
                viewerBaseUrl = "https://norabim.com/VSR_IFC_simplificado/";
            }
            if (!viewerBaseUrl.endsWith("/")) {
                viewerBaseUrl += "/";
            }

            // 1. Resolve fragId & jsonId from settings
            let fragId = (modelSettings?.defaultFragId?.value || "").trim();
            let jsonId = (modelSettings?.defaultJsonId?.value || "").trim();
            const autoIsolate = modelSettings?.autoIsolate?.value !== false;
            const forceLogin = modelSettings?.forceLogin?.value === true;

            const expressIds: number[] = [];

            // 2. Check categorical.categories
            if (dataView?.categorical?.categories) {
                for (const cat of dataView.categorical.categories) {
                    const roles = cat.source?.roles || {};
                    const colName = String(cat.source?.displayName || "").toLowerCase();
                    const isFrag = roles["fragId"] || colName.includes("frag") || colName.includes("modelo");
                    const isJson = roles["jsonId"] || (colName.includes("json") && !colName.includes("frag"));
                    const isExpress = roles["expressId"] || colName.includes("express") || colName === "id";

                    if (isFrag && !fragId) {
                        const val = cat.values?.find(v => v !== null && v !== undefined && String(v).trim() !== "");
                        if (val) fragId = String(val).trim();
                    } else if (isJson && !jsonId) {
                        const val = cat.values?.find(v => v !== null && v !== undefined && String(v).trim() !== "");
                        if (val) jsonId = String(val).trim();
                    } else if (isExpress || (!isFrag && !isJson)) {
                        if (Array.isArray(cat.values)) {
                            for (const val of cat.values) {
                                if (val !== null && val !== undefined && val !== "") {
                                    const num = Number(val);
                                    if (!isNaN(num)) expressIds.push(num);
                                }
                            }
                        }
                    }
                }
            }

            // 3. Check categorical.values
            if (dataView?.categorical?.values) {
                for (const valCol of dataView.categorical.values) {
                    const roles = valCol.source?.roles || {};
                    const colName = String(valCol.source?.displayName || "").toLowerCase();
                    const isFrag = roles["fragId"] || colName.includes("frag") || colName.includes("modelo");
                    const isJson = roles["jsonId"] || (colName.includes("json") && !colName.includes("frag"));

                    if (isFrag && !fragId) {
                        const val = valCol.values?.find(v => v !== null && v !== undefined && String(v).trim() !== "");
                        if (val) fragId = String(val).trim();
                    } else if (isJson && !jsonId) {
                        const val = valCol.values?.find(v => v !== null && v !== undefined && String(v).trim() !== "");
                        if (val) jsonId = String(val).trim();
                    }
                }
            }

            // 4. Check table columns and rows as fallback
            if ((!fragId || expressIds.length === 0) && dataView?.table?.columns && dataView?.table?.rows) {
                const cols = dataView.table.columns;
                let fragIdx = -1;
                let jsonIdx = -1;
                let expIdx = -1;

                cols.forEach((c, idx) => {
                    const roles = c.roles || {};
                    const name = String(c.displayName || "").toLowerCase();
                    if (roles["fragId"] || name.includes("frag") || name.includes("modelo")) fragIdx = idx;
                    else if (roles["jsonId"] || (name.includes("json") && !name.includes("frag"))) jsonIdx = idx;
                    else if (roles["expressId"] || name.includes("express") || name === "id") expIdx = idx;
                });

                if (expIdx === -1 && cols.length > 0) expIdx = 0;

                for (const row of dataView.table.rows) {
                    if (fragIdx >= 0 && !fragId && row[fragIdx]) {
                        fragId = String(row[fragIdx]).trim();
                    }
                    if (jsonIdx >= 0 && !jsonId && row[jsonIdx]) {
                        jsonId = String(row[jsonIdx]).trim();
                    }
                    if (expIdx >= 0 && expressIds.length < 50000) {
                        const num = Number(row[expIdx]);
                        if (!isNaN(num)) expressIds.push(num);
                    }
                }
            }

            // Ensure fragId has a valid fallback
            if (!fragId) {
                fragId = (modelSettings?.defaultFragId?.value || "").trim() || "1PG0-nKvsO0AnsddgwLSlGpJRtdCDMBdp";
            }

            if (this.statusBadge) {
                this.statusBadge.innerText = `NoraBIM 3D: ${fragId ? 'Conectado (' + fragId.slice(0, 8) + '...)' : 'Sin ID'} | ${expressIds.length} elem`;
                this.statusBadge.style.opacity = "1";
                setTimeout(() => {
                    if (this.statusBadge) this.statusBadge.style.opacity = "0.4";
                }, 4000);
            }

            // Build target URL with version tag to bypass stale WebView2 caching
            const url = new URL(viewerBaseUrl);
            url.searchParams.set("embed", "true");
            url.searchParams.set("_v", "20261028-10");
            if (fragId) url.searchParams.set("fileId", fragId);
            if (jsonId) url.searchParams.set("jsonId", jsonId);
            if (forceLogin) url.searchParams.set("forceLogin", "true");

            const targetUrlStr = url.toString();
            if (this.currentSrc !== targetUrlStr) {
                this.currentSrc = targetUrlStr;
                this.currentFragId = fragId;
                this.currentJsonId = jsonId;
                this.iframeLoaded = false;
                this.loader.style.display = "flex";
                this.loader.style.opacity = "1";
                this.iframe.src = targetUrlStr;
            } else if (this.iframeLoaded && fragId) {
                this.sendPostMessage({
                    type: "NORA_LOAD_MODEL",
                    fragId: fragId,
                    jsonId: jsonId
                });
            }

            const filterPayload = {
                type: "NORA_PBI_FILTER",
                expressIds: expressIds,
                isolate: autoIsolate,
                timestamp: Date.now()
            };

            const idsJson = JSON.stringify(expressIds.slice(0, 100));
            if (idsJson !== this.lastSentIdsJson || this.pendingFilter) {
                this.lastSentIdsJson = idsJson;
                if (this.iframeLoaded) {
                    this.sendPostMessage(filterPayload);
                } else {
                    this.pendingFilter = filterPayload;
                }
            }

            this.events.renderingFinished(options);
        } catch (error) {
            console.error("[NoraBIM Visual] Error in update:", error);
            this.events.renderingFailed(options, String(error));
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
