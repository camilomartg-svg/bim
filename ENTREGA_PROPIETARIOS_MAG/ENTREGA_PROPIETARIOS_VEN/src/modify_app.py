import sys
import re

file_path = r"c:\Users\camilo.martinez\Documents\GitHub\bim\ENTREGA_PROPIETARIOS_MAG\ENTREGA_PROPIETARIOS_MAD\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Imports
content = content.replace(
    "import { Building2, CheckCircle2, Clock, Info, Search, Lock, Save, Loader2, Eye, EyeOff, RefreshCw } from 'lucide-react';",
    "import { Building2, CheckCircle2, Clock, Info, Search, Lock, Save, Loader2, Eye, EyeOff, RefreshCw, Settings } from 'lucide-react';"
)

# 2. Constants & generateStructure
old_gen_struct = """// --- Constants & Mock Data Generation ---

const TOTAL_TOWERS = 21;
const FLOORS_PER_TOWER = 9;
const APTS_PER_FLOOR = 4;

const generateStructure = (): Tower[] => {
  const towers: Tower[] = [];
  
  for (let t = 1; t <= TOTAL_TOWERS; t++) {
    const apartments: Apartment[] = [];
    for (let f = 1; f <= FLOORS_PER_TOWER; f++) {
      for (let a = 1; a <= APTS_PER_FLOOR; a++) {
        const aptNumber = `${f}0${a}`;
        let status: Status = 'in_process'; // Default status
        
        // Special case for COW as seen in the image (Tower 1, Floor 1, Position 4)
        if (f === 1 && a === 4) {
          status = 'special';
        }

        apartments.push({
          id: `t${t}-f${f}-a${a}`,
          number: status === 'special' ? 'COW' : aptNumber,
          status: status,
        });
      }
    }
    towers.push({
      id: t,
      name: `TORRE ${t}`,
      apartments,
    });
  }
  return towers;
};"""

new_gen_struct = """// --- Constants & Mock Data Generation ---

const DEFAULT_CONFIG = { totalTowers: 21, floorsPerTower: 9, aptsPerFloor: 4 };

const getStoredConfig = () => {
  try {
    const raw = localStorage.getItem('entrega_propi_mad_config');
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_CONFIG;
};

const generateStructure = (config = getStoredConfig()): Tower[] => {
  const towers: Tower[] = [];
  
  for (let t = 1; t <= config.totalTowers; t++) {
    const apartments: Apartment[] = [];
    for (let f = 1; f <= config.floorsPerTower; f++) {
      for (let a = 1; a <= config.aptsPerFloor; a++) {
        const aptNumber = `${f}${(a).toString().padStart(2, '0')}`;
        let status: Status = 'in_process'; // Default status
        
        // Special case for COW as seen in the image (Tower 1, Floor 1, Position 4)
        if (f === 1 && a === 4) {
          status = 'special';
        }

        apartments.push({
          id: `t${t}-f${f}-a${a}`,
          number: status === 'special' ? 'COW' : aptNumber,
          status: status,
        });
      }
    }
    towers.push({
      id: t,
      name: `TORRE ${t}`,
      apartments,
    });
  }
  return towers;
};"""

content = content.replace(old_gen_struct, new_gen_struct)

# 3. TowerCard dynamic grid columns
old_tower_card_1 = """          <div className="grid grid-cols-[40px_1fr] gap-1">
          {/* Header Row */}
          <div className="text-[8px] font-bold text-alcabama-grey flex items-center justify-center uppercase">
            Piso
          </div>
          <div className="grid grid-cols-4 gap-1">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="text-[8px] font-bold text-alcabama-grey text-center uppercase">
                Apt {n}
              </div>
            ))}
          </div>"""

new_tower_card_1 = """          <div className="grid grid-cols-[40px_1fr] gap-1">
          {/* Header Row */}
          <div className="text-[8px] font-bold text-alcabama-grey flex items-center justify-center uppercase">
            Piso
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${floors.length > 0 ? floors[0].apts.length : 4}, minmax(0, 1fr))` }}>
            {Array.from({ length: floors.length > 0 ? floors[0].apts.length : 4 }, (_, i) => i + 1).map(n => (
              <div key={n} className="text-[8px] font-bold text-alcabama-grey text-center uppercase">
                Apt {n}
              </div>
            ))}
          </div>"""
content = content.replace(old_tower_card_1, new_tower_card_1)

old_tower_card_2 = """              <div className="grid grid-cols-4 gap-1">
                {apts.map((apt) => ("""
new_tower_card_2 = """              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${floors.length > 0 ? floors[0].apts.length : 4}, minmax(0, 1fr))` }}>
                {apts.map((apt) => ("""
content = content.replace(old_tower_card_2, new_tower_card_2)

# 4. App state
old_app_state = """  const [allTowers, setAllTowers] = useState<Tower[]>(() => generateStructure());"""
new_app_state = """  const [config, setConfig] = useState(() => getStoredConfig());
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configPassword, setConfigPassword] = useState('');
  const [configError, setConfigError] = useState('');
  const [tempConfig, setTempConfig] = useState(() => getStoredConfig());
  const [isConfigUnlocked, setIsConfigUnlocked] = useState(false);

  const [allTowers, setAllTowers] = useState<Tower[]>(() => generateStructure(getStoredConfig()));"""
content = content.replace(old_app_state, new_app_state)

# 5. refreshData use config
old_refresh = "const merged = mergeSheetDataIntoTowers(generateStructure(), data);"
new_refresh = "const merged = mergeSheetDataIntoTowers(generateStructure(config), data);"
content = content.replace(old_refresh, new_refresh)

# Add config to useCallback dependencies. Actually just replace refreshData entirely.
old_refresh_def = """  const refreshData = React.useCallback(async () => {
    setIsRefreshing(true);
    setSyncError(null);
    try {
      const data = await fetchSheetData();
      if (!data || data.length === 0) throw new Error('No data received');
      const merged = mergeSheetDataIntoTowers(generateStructure(), data);
      setAllTowers(merged);
      writeCachedTowers(merged);
      setIsUsingCachedData(false);
      setLastUpdatedAt(Date.now());
    } catch {
      const cached = readCachedTowers();
      if (cached) {
        skipNextCacheWriteRef.current = true;
        setAllTowers(cached.towers);
        setIsUsingCachedData(true);
        setLastUpdatedAt(cached.savedAt);
        setSyncError('No se pudo actualizar desde Google Sheets. Mostrando última información guardada.');
      } else {
        setSyncError('No se pudo cargar la información desde Google Sheets. Intenta de nuevo.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);"""

new_refresh_def = """  const refreshData = React.useCallback(async (currentConfig = config) => {
    setIsRefreshing(true);
    setSyncError(null);
    try {
      const data = await fetchSheetData();
      if (!data || data.length === 0) throw new Error('No data received');
      const merged = mergeSheetDataIntoTowers(generateStructure(currentConfig), data);
      setAllTowers(merged);
      writeCachedTowers(merged);
      setIsUsingCachedData(false);
      setLastUpdatedAt(Date.now());
    } catch {
      const cached = readCachedTowers();
      if (cached) {
        skipNextCacheWriteRef.current = true;
        setAllTowers(cached.towers);
        setIsUsingCachedData(true);
        setLastUpdatedAt(cached.savedAt);
        setSyncError('No se pudo actualizar desde Google Sheets. Mostrando última información guardada.');
      } else {
        setSyncError('No se pudo cargar la información desde Google Sheets. Intenta de nuevo.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [config]);"""
content = content.replace(old_refresh_def, new_refresh_def)

# 6. Button in header
old_edit_mode_toggle = """                {/* Edit Mode Toggle */}
                <button
                  onClick={() => {
                    if (isEditMode) {
                      setIsEditMode(false);
                    } else {
                      handleEnableEditMode();
                    }
                  }}"""
new_edit_mode_toggle = """                {/* Config Modal Toggle */}
                <button
                  onClick={() => {
                    setShowConfigModal(true);
                    setIsConfigUnlocked(false);
                    setConfigPassword('');
                    setConfigError('');
                    setTempConfig(config);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all bg-white text-alcabama-grey border border-alcabama-light-grey hover:bg-alcabama-light-grey/10 w-full sm:w-auto"
                >
                  <Settings size={14} className="text-alcabama-grey" />
                  Configuración
                </button>

                {/* Edit Mode Toggle */}
                <button
                  onClick={() => {
                    if (isEditMode) {
                      setIsEditMode(false);
                    } else {
                      handleEnableEditMode();
                    }
                  }}"""
content = content.replace(old_edit_mode_toggle, new_edit_mode_toggle)

# 7. Logo replacement
old_logo = """<img 
                src="https://i.postimg.cc/GmWLmfZZ/Logo-transparente_negro.png" """
new_logo = """<img 
                src="https://i.postimg.cc/KYVnrN6h/LOGO.jpg" """
content = content.replace(old_logo, new_logo)

old_logo_alt = """alt="Alcabama Logo" """
new_logo_alt = """alt="ENTREGA_PROPIETARIOS_MAD Logo" """
content = content.replace(old_logo_alt, new_logo_alt)

# 8. Modal Config rendering
modal_content = """

      {/* Config Modal */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-alcabama-light-grey"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-alcabama-black uppercase tracking-wide">Configuración del Proyecto</h3>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="text-alcabama-grey hover:text-alcabama-black transition-colors"
                >
                  ✕
                </button>
              </div>

              {!isConfigUnlocked ? (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 text-blue-800 rounded-xl text-xs">
                    Ingresa la contraseña para acceder al tablero de configuración.
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-alcabama-grey uppercase tracking-wider mb-2">Contraseña</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-alcabama-grey" size={16} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={configPassword}
                        onChange={(e) => setConfigPassword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (configPassword === 'Alcabama2026') {
                              setIsConfigUnlocked(true);
                              setConfigError('');
                            } else {
                              setConfigError('Contraseña incorrecta');
                            }
                          }
                        }}
                        placeholder="Contraseña"
                        className="w-full h-11 pl-10 pr-10 rounded-xl border border-alcabama-light-grey bg-white text-sm text-alcabama-black focus:outline-none focus:ring-2 focus:ring-alcabama-pink"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-alcabama-grey hover:text-alcabama-black"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {configError && (
                      <p className="mt-2 text-xs font-bold text-red-600 uppercase tracking-wider">{configError}</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (configPassword === 'Alcabama2026') {
                        setIsConfigUnlocked(true);
                        setConfigError('');
                      } else {
                        setConfigError('Contraseña incorrecta');
                      }
                    }}
                    className="w-full h-11 bg-alcabama-black text-white font-bold uppercase tracking-wider text-xs rounded-xl hover:bg-black transition-colors"
                  >
                    Desbloquear
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-alcabama-grey uppercase tracking-wider mb-2">Número de Torres</label>
                    <input
                      type="number"
                      min="1"
                      value={tempConfig.totalTowers}
                      onChange={(e) => setTempConfig({...tempConfig, totalTowers: parseInt(e.target.value) || 1})}
                      className="w-full h-11 px-4 rounded-xl border border-alcabama-light-grey bg-white text-sm text-alcabama-black focus:outline-none focus:ring-2 focus:ring-alcabama-pink"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-alcabama-grey uppercase tracking-wider mb-2">Pisos por Torre</label>
                    <input
                      type="number"
                      min="1"
                      value={tempConfig.floorsPerTower}
                      onChange={(e) => setTempConfig({...tempConfig, floorsPerTower: parseInt(e.target.value) || 1})}
                      className="w-full h-11 px-4 rounded-xl border border-alcabama-light-grey bg-white text-sm text-alcabama-black focus:outline-none focus:ring-2 focus:ring-alcabama-pink"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-alcabama-grey uppercase tracking-wider mb-2">Apartamentos por Piso</label>
                    <input
                      type="number"
                      min="1"
                      value={tempConfig.aptsPerFloor}
                      onChange={(e) => setTempConfig({...tempConfig, aptsPerFloor: parseInt(e.target.value) || 1})}
                      className="w-full h-11 px-4 rounded-xl border border-alcabama-light-grey bg-white text-sm text-alcabama-black focus:outline-none focus:ring-2 focus:ring-alcabama-pink"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setShowConfigModal(false)}
                      className="flex-1 h-11 bg-alcabama-light-grey/10 text-alcabama-grey font-bold uppercase tracking-wider text-xs rounded-xl hover:bg-alcabama-light-grey/20 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => {
                        setConfig(tempConfig);
                        localStorage.setItem('entrega_propi_mad_config', JSON.stringify(tempConfig));
                        setAllTowers(generateStructure(tempConfig));
                        setShowConfigModal(false);
                        refreshData(tempConfig);
                      }}
                      className="flex-1 h-11 bg-blue-600 text-white font-bold uppercase tracking-wider text-xs rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-colors"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}"""

# Inject before the final div/closing of return
content = content.replace("    </div>\n  );\n}", modal_content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated successfully.")
