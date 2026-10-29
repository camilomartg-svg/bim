"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import ISelectionManager = powerbi.extensibility.ISelectionManager;

import { VisualFormattingSettingsModel } from "./settings";

export class Visual implements IVisual {
    private host: IVisualHost;
    private events: IVisualEventService;
    private selectionManager: ISelectionManager;
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
    private latestFilterPayload: any = null;
    private lastSentIdsSig: string = "";
    private expressCategory: powerbi.DataViewCategoryColumn | null = null;
    private badgeFadeTimer: any = null;

    private statusBadge: HTMLDivElement;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.selectionManager = options.host.createSelectionManager();
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
            this.hideLoaderSoon(1000);

            if (this.currentFragId) {
                this.sendPostMessage({
                    type: "NORA_LOAD_MODEL",
                    fragId: this.currentFragId,
                    jsonId: this.currentJsonId
                });
            }

            const initialFilter = this.pendingFilter || this.latestFilterPayload;
            if (initialFilter) {
                this.sendPostMessage(initialFilter);
                this.pendingFilter = null;
            }
        };

        window.addEventListener("message", (event) => {
            try {
                if (!event.data || typeof event.data !== "object") return;
                const msg = event.data;

                if (msg.type === "NORA_VIEWER_READY") {
                    if (msg.loaded) {
                        this.hideLoaderSoon(100);
                    }
                    const payload = this.pendingFilter || this.latestFilterPayload;
                    if (payload) {
                        this.sendPostMessage(payload);
                        this.pendingFilter = null;
                    }
                } else if (msg.type === "NORA_VIEWER_STATUS") {
                    if (this.statusBadge && msg.text) {
                        this.statusBadge.innerText = (msg.isError ? "⚠️ " : "⚡ ") + msg.text;
                        this.statusBadge.style.opacity = "1";
                        if (msg.isError) {
                            this.statusBadge.style.borderColor = "#ef4444";
                            this.statusBadge.style.color = "#f87171";
                        } else {
                            this.statusBadge.style.borderColor = "rgba(56,189,248,0.35)";
                            this.statusBadge.style.color = "#38bdf8";
                        }
                        if (this.badgeFadeTimer) clearTimeout(this.badgeFadeTimer);
                        if (!msg.isError) {
                            this.badgeFadeTimer = setTimeout(() => {
                                if (this.statusBadge) this.statusBadge.style.opacity = "0.45";
                            }, 5000);
                        }
                    }
                } else if (msg.type === "NORA_VIEWER_CLICK") {
                    const clickedIds: number[] = Array.isArray(msg.expressIds)
                        ? msg.expressIds.map(Number).filter((n: number) => !isNaN(n))
                        : (msg.expressId !== undefined ? [Number(msg.expressId)] : []);
                    if (clickedIds.length > 0 && this.expressCategory && Array.isArray(this.expressCategory.values)) {
                        const wanted = new Set<number>(clickedIds);
                        const selectionIds: powerbi.visuals.ISelectionId[] = [];
                        const vals = this.expressCategory.values;
                        for (let i = 0; i < vals.length; i++) {
                            const v = Number(vals[i]);
                            if (!isNaN(v) && wanted.has(v)) {
                                selectionIds.push(
                                    this.host.createSelectionIdBuilder()
                                        .withCategory(this.expressCategory, i)
                                        .createSelectionId()
                                );
                                if (selectionIds.length >= 200) break;
                            }
                        }
                        if (selectionIds.length > 0) {
                            this.selectionManager.select(selectionIds, false);
                        }
                    }
                } else if (msg.type === "NORA_VIEWER_CLEAR") {
                    this.selectionManager.clear();
                }
            } catch (e) {
                console.error("[NoraBIM Visual] Message error:", e);
            }
        });
    }

    private hideLoaderSoon(delayMs: number) {
        setTimeout(() => {
            if (!this.loader) return;
            this.loader.style.opacity = "0";
            setTimeout(() => {
                if (this.loader) this.loader.style.display = "none";
            }, 400);
        }, delayMs);
    }

    private cleanDriveId(raw: any): string {
        const s = String(raw ?? "").trim();
        if (!s) return "";
        const mFile = s.match(/\/file\/d\/([a-zA-Z0-9_-]{15,})/);
        if (mFile) return mFile[1];
        const mId = s.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
        if (mId) return mId[1];
        return s;
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

            const autoIsolate = modelSettings?.autoIsolate?.value !== false;
            const forceLogin = modelSettings?.forceLogin?.value === true;

            // 1. Extract data-bound fragId, jsonId & expressIds FIRST (highest priority!)
            let dataFragId = "";
            let dataJsonId = "";
            const expressIds: number[] = [];
            this.expressCategory = null;

            // Check categorical.categories
            if (dataView?.categorical?.categories) {
                for (const cat of dataView.categorical.categories) {
                    const roles = cat.source?.roles || {};
                    const colName = String(cat.source?.displayName || "").toLowerCase();
                    const isFrag = Boolean(roles["fragId"] || colName.includes("frag") || colName.includes("modelo"));
                    const isJson = Boolean(roles["jsonId"] || (colName.includes("json") && !colName.includes("frag")));
                    const isExpress = Boolean(roles["expressId"] || colName.includes("express") || colName === "id");

                    if (isFrag && !dataFragId) {
                        const val = cat.values?.find(v => v !== null && v !== undefined && String(v).trim() !== "");
                        if (val) dataFragId = this.cleanDriveId(val);
                    }
                    if (isJson && !dataJsonId) {
                        const val = cat.values?.find(v => v !== null && v !== undefined && String(v).trim() !== "");
                        if (val) dataJsonId = this.cleanDriveId(val);
                    }
                    if (isExpress || (!isFrag && !isJson)) {
                        if (!this.expressCategory) this.expressCategory = cat;
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

            // Check categorical.values
            if (dataView?.categorical?.values) {
                for (const valCol of dataView.categorical.values) {
                    const roles = valCol.source?.roles || {};
                    const colName = String(valCol.source?.displayName || "").toLowerCase();
                    const isFrag = Boolean(roles["fragId"] || colName.includes("frag") || colName.includes("modelo"));
                    const isJson = Boolean(roles["jsonId"] || (colName.includes("json") && !colName.includes("frag")));

                    if (isFrag && !dataFragId) {
                        const val = valCol.values?.find(v => v !== null && v !== undefined && String(v).trim() !== "");
                        if (val) dataFragId = this.cleanDriveId(val);
                    } else if (isJson && !dataJsonId) {
                        const val = valCol.values?.find(v => v !== null && v !== undefined && String(v).trim() !== "");
                        if (val) dataJsonId = this.cleanDriveId(val);
                    }
                }
            }

            // Check table columns and rows as fallback
            if ((!dataFragId || expressIds.length === 0) && dataView?.table?.columns && dataView?.table?.rows) {
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

                if (expIdx === -1 && cols.length > 0 && fragIdx !== 0 && jsonIdx !== 0) expIdx = 0;
                const needIds = expressIds.length === 0;

                for (const row of dataView.table.rows) {
                    if (fragIdx >= 0 && !dataFragId && row[fragIdx]) {
                        dataFragId = this.cleanDriveId(row[fragIdx]);
                    }
                    if (jsonIdx >= 0 && !dataJsonId && row[jsonIdx]) {
                        dataJsonId = this.cleanDriveId(row[jsonIdx]);
                    }
                    if (needIds && expIdx >= 0 && expressIds.length < 50000) {
                        const num = Number(row[expIdx]);
                        if (!isNaN(num)) expressIds.push(num);
                    }
                }
            }

            // 2. Priority: Data-bound column > Formatting pane setting > Default demo model
            const settingsFragId = this.cleanDriveId(modelSettings?.defaultFragId?.value || "");
            const settingsJsonId = this.cleanDriveId(modelSettings?.defaultJsonId?.value || "");
            const fragId = dataFragId || settingsFragId || "1PG0-nKvsO0AnsddgwLSlGpJRtdCDMBdp";
            const jsonId = dataJsonId || settingsJsonId;

            if (this.statusBadge && !this.iframeLoaded) {
                this.statusBadge.style.borderColor = "rgba(56,189,248,0.35)";
                this.statusBadge.style.color = "#38bdf8";
                this.statusBadge.innerText = `NoraBIM 3D: Conectando (${fragId.slice(0, 8)}...) | ${expressIds.length} elem`;
                this.statusBadge.style.opacity = "1";
            }

            // 3. Build target URL with fresh version tag to bypass WebView2 cache
            const url = new URL(viewerBaseUrl);
            url.searchParams.set("embed", "true");
            url.searchParams.set("_v", "20261028-14");
            if (fragId) url.searchParams.set("fileId", fragId);
            if (jsonId) url.searchParams.set("jsonId", jsonId);
            if (forceLogin) url.searchParams.set("forceLogin", "true");

            const targetUrlStr = url.toString();
            const modelChanged = (fragId !== this.currentFragId) || (jsonId !== this.currentJsonId);

            if (this.currentSrc !== targetUrlStr) {
                this.currentSrc = targetUrlStr;
                this.currentFragId = fragId;
                this.currentJsonId = jsonId;
                this.iframeLoaded = false;
                this.loader.style.display = "flex";
                this.loader.style.opacity = "1";
                this.iframe.src = targetUrlStr;
            } else if (this.iframeLoaded && modelChanged && fragId) {
                this.currentFragId = fragId;
                this.currentJsonId = jsonId;
                this.sendPostMessage({
                    type: "NORA_LOAD_MODEL",
                    fragId: fragId,
                    jsonId: jsonId
                });
            }

            // 4. Compute exact filter signature across ALL expressIds (FNV-1a 32-bit hash)
            let hash = 2166136261;
            for (let i = 0; i < expressIds.length; i++) {
                hash ^= expressIds[i];
                hash = Math.imul(hash, 16777619);
            }
            const idsSig = `${fragId}:${autoIsolate}:${expressIds.length}:${hash >>> 0}`;

            const filterPayload = {
                type: "NORA_PBI_FILTER",
                expressIds: expressIds,
                isolate: autoIsolate,
                fragId: fragId,
                timestamp: Date.now()
            };
            this.latestFilterPayload = filterPayload;

            if (idsSig !== this.lastSentIdsSig || this.pendingFilter) {
                this.lastSentIdsSig = idsSig;
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
