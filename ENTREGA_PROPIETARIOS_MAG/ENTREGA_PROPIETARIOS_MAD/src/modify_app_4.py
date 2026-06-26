import re

def modify_app():
    with open('src/App.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Add the import for TowerEditorModal
    if "import { TowerEditorModal } from './TowerEditorModal';" not in content:
        content = content.replace("import { MassGenerationModal, MassGenerationConfig } from './MassGenerationModal';", 
                                  "import { MassGenerationModal, MassGenerationConfig } from './MassGenerationModal';\nimport { TowerEditorModal } from './TowerEditorModal';")

    # Add state for tower editor
    if "const [editingTowerId, setEditingTowerId] = useState<number | null>(null);" not in content:
        content = content.replace("const [massGenTowerId, setMassGenTowerId] = useState<number | null>(null);",
                                  "const [massGenTowerId, setMassGenTowerId] = useState<number | null>(null);\n  const [editingTowerId, setEditingTowerId] = useState<number | null>(null);")

    # Sync isConfigUnlocked with isEditMode
    if "setIsConfigUnlocked(isEditMode);" not in content:
        sync_effect = "\n  React.useEffect(() => {\n    if (isEditMode) setIsConfigUnlocked(true);\n  }, [isEditMode]);\n"
        content = content.replace("const [isEditMode, setIsEditMode] = useState(() => sessionStorage.getItem('isEditMode') === 'true');", 
                                  "const [isEditMode, setIsEditMode] = useState(() => sessionStorage.getItem('isEditMode') === 'true');" + sync_effect)

    # In the Project Builder tower list, add "Editar Unidades" and "Eliminar Torre" buttons
    old_list_item = '''<div key={tower.id} className="flex items-center justify-between bg-white border border-alcabama-light-grey rounded-xl p-4 shadow-sm">
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
                         </div>'''

    new_list_item = '''<div key={tower.id} className="flex items-center justify-between bg-white border border-alcabama-light-grey rounded-xl p-4 shadow-sm">
                           <div>
                             <h4 className="font-bold text-sm uppercase">{tower.name}</h4>
                             <p className="text-[10px] text-alcabama-grey mt-0.5">{tower.apartments.length} unidades</p>
                           </div>
                           <div className="flex gap-2">
                             <button 
                               onClick={() => setEditingTowerId(tower.id)}
                               className="px-3 py-2 bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-blue-100 transition-colors"
                             >
                               Editar Unidades
                             </button>
                             <button 
                               onClick={() => setMassGenTowerId(tower.id)}
                               className="px-3 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-indigo-100 transition-colors"
                             >
                               Masivo
                             </button>
                             <button 
                               onClick={() => setAllTowers(prev => prev.filter(t => t.id !== tower.id))}
                               className="px-3 py-2 bg-red-50 text-red-600 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-red-100 transition-colors"
                               title="Eliminar Torre"
                             >
                               X
                             </button>
                           </div>
                         </div>'''
    
    content = content.replace(old_list_item, new_list_item)

    # Insert TowerEditorModal component rendering before MassGenerationModal
    editor_modal = '''      <TowerEditorModal
        isOpen={editingTowerId !== null}
        tower={editingTowerId ? (allTowers.find(t => t.id === editingTowerId) || null) : null}
        onClose={() => setEditingTowerId(null)}
        onSave={(updatedTower) => {
          setAllTowers(prev => prev.map(t => t.id === updatedTower.id ? updatedTower : t));
          setEditingTowerId(null);
        }}
      />
      <MassGenerationModal'''
      
    content = content.replace("<MassGenerationModal", editor_modal)

    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

modify_app()
