import { API_CONFIG } from './config';

export interface ProjectSettings {
  projectName: string;
  companyLogoUrl: string;
  companyFooterLogoUrl: string;
  projectLogoUrl: string;
  scriptUrl: string;
  sheetId: string;
  sheetName: string;
}

export const PROJECT_SETTINGS_STORAGE_KEY = 'entrega_propi_mad:projectSettings';
export const LEGACY_SCRIPT_URL_STORAGE_KEY = 'entrega_propi_mad:scriptUrl';

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  projectName: 'Madero',
  companyLogoUrl: 'https://i.postimg.cc/GmWLmfZZ/Logo-transparente_negro.png',
  companyFooterLogoUrl: 'https://i.postimg.cc/0yDgcyBp/Logo-transparente_blanco.png',
  projectLogoUrl: 'https://i.postimg.cc/KYVnrN6h/LOGO.jpg',
  scriptUrl: API_CONFIG.scriptUrl,
  sheetId: API_CONFIG.sheetId,
  sheetName: API_CONFIG.sheetName,
};

const normalizeString = (value: unknown, fallback: string) => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

export const normalizeProjectSettings = (value?: Partial<ProjectSettings> | null): ProjectSettings => ({
  projectName: normalizeString(value?.projectName, DEFAULT_PROJECT_SETTINGS.projectName),
  companyLogoUrl: normalizeString(value?.companyLogoUrl, DEFAULT_PROJECT_SETTINGS.companyLogoUrl),
  companyFooterLogoUrl: normalizeString(value?.companyFooterLogoUrl, DEFAULT_PROJECT_SETTINGS.companyFooterLogoUrl),
  projectLogoUrl: normalizeString(value?.projectLogoUrl, DEFAULT_PROJECT_SETTINGS.projectLogoUrl),
  scriptUrl: normalizeString(value?.scriptUrl, DEFAULT_PROJECT_SETTINGS.scriptUrl),
  sheetId: normalizeString(value?.sheetId, DEFAULT_PROJECT_SETTINGS.sheetId),
  sheetName: normalizeString(value?.sheetName, DEFAULT_PROJECT_SETTINGS.sheetName),
});

export const readStoredProjectSettings = (): ProjectSettings => {
  try {
    const raw = localStorage.getItem(PROJECT_SETTINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<ProjectSettings> : null;
    const normalized = normalizeProjectSettings(parsed);
    const legacyScriptUrl = String(localStorage.getItem(LEGACY_SCRIPT_URL_STORAGE_KEY) ?? '').trim();
    if (legacyScriptUrl && (!parsed || !String(parsed.scriptUrl ?? '').trim())) {
      normalized.scriptUrl = legacyScriptUrl;
    }
    return normalized;
  } catch {
    return DEFAULT_PROJECT_SETTINGS;
  }
};

export const writeStoredProjectSettings = (value: Partial<ProjectSettings> | ProjectSettings) => {
  const normalized = normalizeProjectSettings(value);
  try {
    localStorage.setItem(PROJECT_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    localStorage.setItem(LEGACY_SCRIPT_URL_STORAGE_KEY, normalized.scriptUrl);
  } catch {
  }
  return normalized;
};
