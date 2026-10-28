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
    private iframeLoaded: boolean = false;
    private pendingFilter: any = null;
    private lastSentIdsJson: string = "";

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
        this.iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-downloads");

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

        this.container.appendChild(this.iframe);
        this.container.appendChild(this.loader);
        this.target.appendChild(this.container);

        this.iframe.onload = () => {
            this.iframeLoaded = true;
            setTimeout(() => {
                this.loader.style.opacity = "0";
                setTimeout(() => {
                    this.loader.style.display = "none";
                }, 400);
            }, 1200);

            if (this.pendingFilter) {
                setTimeout(() => {
                    this.sendPostMessage(this.pendingFilter);
                    this.pendingFilter = null;
                }, 1500);
            }
        };

        window.addEventListener("message", (event) => {
            try {
                if (event.data && typeof event.data === "object" && event.data.type === "NORA_VIEWER_READY") {
                    if (this.pendingFilter) {
                        this.sendPostMessage(this.pendingFilter);
                        this.pendingFilter = null;
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

            let fragId = (modelSettings?.defaultFragId?.value || "").trim();
            let jsonId = (modelSettings?.defaultJsonId?.value || "").trim();
            const autoIsolate = modelSettings?.autoIsolate?.value !== false;
            const forceLogin = modelSettings?.forceLogin?.value === true;

            // Extract fields from dataView roles (expressId, fragId, jsonId)
            const expressIds: number[] = [];
            if (dataView?.categorical?.categories && dataView.categorical.categories.length > 0) {
                for (const cat of dataView.categorical.categories) {
                    const roles = cat.source?.roles || {};
                    if (roles["fragId"]) {
                        const val = cat.values?.find(v => v !== null && v !== undefined && String(v).trim() !== "");
                        if (val && !fragId) {
                            fragId = String(val).trim();
                        }
                    } else if (roles["jsonId"]) {
                        const val = cat.values?.find(v => v !== null && v !== undefined && String(v).trim() !== "");
                        if (val && !jsonId) {
                            jsonId = String(val).trim();
                        }
                    } else {
                        // ExpressID role or default category
                        if (Array.isArray(cat.values)) {
                            for (const val of cat.values) {
                                if (val !== null && val !== undefined && val !== "") {
                                    const num = Number(val);
                                    if (!isNaN(num)) {
                                        expressIds.push(num);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Build target URL with version tag to bypass stale WebView2 caching
            const url = new URL(viewerBaseUrl);
            url.searchParams.set("embed", "true");
            url.searchParams.set("_v", "20261028-04");
            if (fragId) url.searchParams.set("fileId", fragId);
            if (jsonId) url.searchParams.set("jsonId", jsonId);
            if (forceLogin) url.searchParams.set("forceLogin", "true");

            const targetUrlStr = url.toString();
            if (this.currentSrc !== targetUrlStr) {
                this.currentSrc = targetUrlStr;
                this.iframeLoaded = false;
                this.loader.style.display = "flex";
                this.loader.style.opacity = "1";
                this.iframe.src = targetUrlStr;
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
