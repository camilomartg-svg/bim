026
import re

def modify_app():
    with open('src/App.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    old_logic = '''            setAllTowers(prev => prev.map(t => {
             if (t.id === massGenTowerId) {
               // Merge or replace? We append.
               return { ...t, apartments: [...t.apartments, ...newApts] };
             }
             return t;
           }));'''
           
    new_logic = '''            setAllTowers(prev => prev.map(t => {
             if (t.id === massGenTowerId) {
               const floorsToRegenerate = config.mode === 'single' 
                 ? [config.single.floorNumber] 
                 : Array.from({length: config.multi.endFloor - config.multi.startFloor + 1}, (_, i) => config.multi.startFloor + i);
               
               const filteredApartments = t.apartments.filter(apt => {
                 const match = apt.id.match(/-f(\\d+)-a/);
                 if (match) {
                   const floorNum = parseInt(match[1]);
                   return !floorsToRegenerate.includes(floorNum);
                 }
                 return true;
               });

               return { ...t, apartments: [...filteredApartments, ...newApts] };
             }
             return t;
           }));'''

    if old_logic in content:
        content = content.replace(old_logic, new_logic)
    
    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

modify_app()
