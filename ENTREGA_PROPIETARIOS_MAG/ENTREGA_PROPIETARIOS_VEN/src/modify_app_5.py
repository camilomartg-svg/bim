import re

def modify_app():
    with open('src/App.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Fix setIsConfigUnlocked(false) being called unconditionally when opening Config Modal
    old_toggle = '''                    setShowConfigModal(true);
                    setIsConfigUnlocked(false);
                    setConfigPassword('');'''
    
    new_toggle = '''                    setShowConfigModal(true);
                    if (!isEditMode) setIsConfigUnlocked(false);
                    setConfigPassword('');'''
    
    content = content.replace(old_toggle, new_toggle)

    # 2. Add back the `multi` branch in `MassGenerationModal` handler
    old_handler = '''           if (config.mode === 'single') {
             for (let i = 0; i < config.single.amount; i++) {
               const num = config.single.startNum + i;
               const aptNumber = `${config.single.prefix} ${config.single.floorNumber}${num < 10 ? '0'+num : num}`.trim();
               newApts.push({
                 id: `t${massGenTowerId}-f${config.single.floorNumber}-a${num}`,
                 number: aptNumber,
                 status: 'in_process'
               });
             }
           }'''

    new_handler = '''           if (config.mode === 'single') {
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
           }'''

    if old_handler in content:
        content = content.replace(old_handler, new_handler)
    
    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

modify_app()
