import sys
import re

def modify_app():
    with open('src/App.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the Config Modal block and replace its contents.
    # We will look for `{/* Config Modal */}`
    start_idx = content.find('{/* Config Modal */}')
    if start_idx == -1:
        print("Could not find Config Modal")
        return
        
    end_idx = content.find('</AnimatePresence>', start_idx) + len('</AnimatePresence>')
    
    config_modal_new = '''{/* Config Modal - Project Builder */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl border border-alcabama-light-grey max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-alcabama-black uppercase tracking-wide">Constructor de Proyecto</h3>
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
                    Ingresa la contraseña para acceder al constructor del proyecto.
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
                <div className="space-y-6">
                  <div className="bg-alcabama-light-grey/5 p-4 rounded-xl border border-alcabama-light-grey">
                     <p className="text-xs text-alcabama-dark-grey font-medium mb-4">
                       Administra las torres de tu proyecto. Puedes generar apartamentos masivamente para cada torre.
                     </p>
                     
                     <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                       {allTowers.map((tower, idx) => (
                         <div key={tower.id} className="flex items-center justify-between bg-white border border-alcabama-light-grey rounded-xl p-4 shadow-sm">
                           <div>
                             <h4 className="font-bold text-sm uppercase">{tower.name}</h4>
                             <p className="text-[10px] text-alcabama-grey mt-0.5">{tower.apartments.length} apartamentos</p>
                           </div>
                           <button 
                             onClick={() => setMassGenTowerId(tower.id)}
                             className="px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-indigo-100 transition-colors"
                           >
                             Generación Masiva
                           </button>
                         </div>
                       ))}
                     </div>
                     
                     <button
                       onClick={() => {
                         const nextId = allTowers.length > 0 ? Math.max(...allTowers.map(t => t.id)) + 1 : 1;
                         setAllTowers([...allTowers, { id: nextId, name: `TORRE ${nextId}`, apartments: [] }]);
                       }}
                       className="w-full mt-4 h-11 border-2 border-dashed border-alcabama-light-grey text-alcabama-grey font-bold uppercase tracking-wider text-xs rounded-xl hover:bg-alcabama-light-grey/10 transition-colors"
                     >
                       + Añadir Nueva Torre
                     </button>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-alcabama-grey uppercase tracking-wider mb-2">URL Web App (Apps Script)</label>
                    <input
                      type="text"
                      value={scriptUrlInput}
                      onChange={(e) => setScriptUrlInput(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full h-11 px-4 rounded-xl border border-alcabama-light-grey bg-white text-sm text-alcabama-black focus:outline-none focus:ring-2 focus:ring-alcabama-pink"
                    />
                  </div>

                  <button
                    onClick={() => {
                      try {
                        localStorage.setItem('entrega_propi_mad_custom_structure', JSON.stringify(allTowers));
                      } catch(e) {}
                      if (scriptUrlInput.trim()) {
                        try {
                          localStorage.setItem(SCRIPT_URL_STORAGE_KEY, scriptUrlInput.trim());
                        } catch {}
                      }
                      setShowConfigModal(false);
                      refreshData(tempConfig, true);
                      window.location.reload();
                    }}
                    className="w-full h-11 bg-green-500 text-white font-bold uppercase tracking-wider text-xs rounded-xl hover:bg-green-600 transition-colors shadow-lg shadow-green-500/30"
                  >
                    Guardar Cambios
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <MassGenerationModal 
        isOpen={massGenTowerId !== null} 
        towerName={massGenTowerId ? allTowers.find(t => t.id === massGenTowerId)?.name || '' : ''}
        onClose={() => setMassGenTowerId(null)}
        onGenerate={(config) => {
           if (!massGenTowerId) return;
           const newApts = [];
           
           if (config.mode === 'single') {
             for (let i = 0; i < config.single.amount; i++) {
               const num = config.single.startNum + i;
               const aptNumber = `${config.single.prefix} ${config.single.floorNumber}${num < 10 ? '0'+num : num}`.trim();
               newApts.push({
                 id: `t${massGenTowerId}-f${config.single.floorNumber}-a${num}`,
                 number: aptNumber,
                 status: 'in_process'
               });
             }
           } else {
             for (let f = config.multi.startFloor; f <= config.multi.endFloor; f++) {
               for (let i = 0; i < config.multi.spacesPerFloor; i++) {
                 const num = config.multi.startNum + i;
                 const aptNumber = `${config.multi.spacePrefix} ${f}${num < 10 ? '0'+num : num}`.trim();
                 newApts.push({
                   id: `t${massGenTowerId}-f${f}-a${num}`,
                   number: aptNumber,
                   status: 'in_process'
                 });
               }
             }
           }
           
           setAllTowers(prev => prev.map(t => {
             if (t.id === massGenTowerId) {
               // Merge or replace? We append.
               return { ...t, apartments: [...t.apartments, ...newApts] };
             }
             return t;
           }));
           setMassGenTowerId(null);
        }}
      />
'''
    
    content = content[:start_idx] + config_modal_new + content[end_idx:]

    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

modify_app()
