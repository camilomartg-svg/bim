"use strict";

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

export class ModelCardSettings extends FormattingSettingsCard {
    viewerUrl = new formattingSettings.TextInput({
        name: "viewerUrl",
        displayName: "URL del Visor NoraBIM",
        placeholder: "https://norabim.com/VSR_IFC_simplificado/",
        value: "https://norabim.com/VSR_IFC_simplificado/"
    });

    defaultFragId = new formattingSettings.TextInput({
        name: "defaultFragId",
        displayName: "ID Archivo FRAG (Google Drive)",
        placeholder: "1PG0-nKvsO0AnsddgwLSlGpJRtdCDMBdp",
        value: ""
    });

    defaultJsonId = new formattingSettings.TextInput({
        name: "defaultJsonId",
        displayName: "ID Archivo JSON (Google Drive)",
        placeholder: "Pega el ID del archivo .json (opcional)",
        value: ""
    });

    autoIsolate = new formattingSettings.ToggleSwitch({
        name: "autoIsolate",
        displayName: "Aislar elementos seleccionados",
        value: true
    });

    forceLogin = new formattingSettings.ToggleSwitch({
        name: "forceLogin",
        displayName: "Forzar inicio de sesión (Probar Login)",
        value: false
    });

    name: string = "modelSettings";
    displayName: string = "Modelo y Visor NoraBIM";
    slices: Array<FormattingSettingsSlice> = [this.viewerUrl, this.defaultFragId, this.defaultJsonId, this.autoIsolate, this.forceLogin];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    modelCard = new ModelCardSettings();
    cards = [this.modelCard];
}
