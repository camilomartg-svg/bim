import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;
export declare class ModelCardSettings extends FormattingSettingsCard {
    viewerUrl: formattingSettings.TextInput;
    defaultFragId: formattingSettings.TextInput;
    defaultJsonId: formattingSettings.TextInput;
    autoIsolate: formattingSettings.ToggleSwitch;
    forceLogin: formattingSettings.ToggleSwitch;
    name: string;
    displayName: string;
    slices: Array<FormattingSettingsSlice>;
}
export declare class VisualFormattingSettingsModel extends FormattingSettingsModel {
    modelCard: ModelCardSettings;
    cards: ModelCardSettings[];
}
