import re

def modify_app():
    with open('src/App.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    old_tower_name = '''                           <div>
                             <h4 className="font-bold text-sm uppercase">{tower.name}</h4>
                             <p className="text-[10px] text-alcabama-grey mt-0.5">{tower.apartments.length} unidades</p>
                           </div>'''
    
    new_tower_name = '''                           <div className="flex-1 mr-4">
                             <input
                               type="text"
                               value={tower.name}
                               onChange={(e) => {
                                 const val = e.target.value;
                                 setAllTowers(prev => prev.map(t => t.id === tower.id ? { ...t, name: val } : t));
                               }}
                               className="font-bold text-sm uppercase w-full bg-transparent border-b border-transparent hover:border-alcabama-light-grey focus:border-alcabama-pink focus:outline-none transition-colors"
                               placeholder="Nombre de la torre"
                             />
                             <p className="text-[10px] text-alcabama-grey mt-0.5">{tower.apartments.length} unidades</p>
                           </div>'''
                           
    if old_tower_name in content:
        content = content.replace(old_tower_name, new_tower_name)
    
    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

modify_app()
