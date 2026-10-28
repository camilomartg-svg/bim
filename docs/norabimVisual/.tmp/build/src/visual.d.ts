import powerbi from "powerbi-visuals-api";
import "./../style/visual.less";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
export declare class Visual implements IVisual {
    private events;
    private target;
    private container;
    private iframe;
    private loader;
    private formattingSettings;
    private formattingSettingsService;
    private currentSrc;
    private iframeLoaded;
    private pendingFilter;
    private lastSentIdsJson;
    constructor(options: VisualConstructorOptions);
    private sendPostMessage;
    update(options: VisualUpdateOptions): void;
    getFormattingModel(): powerbi.visuals.FormattingModel;
}
