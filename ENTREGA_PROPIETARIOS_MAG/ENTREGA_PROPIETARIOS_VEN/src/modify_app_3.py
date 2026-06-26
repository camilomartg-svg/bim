import sys
import os

def modify_app():
    with open('src/App.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update isEditMode initialization
    old_state = "const [isEditMode, setIsEditMode] = useState(false);"
    new_state = "const [isEditMode, setIsEditMode] = useState(() => sessionStorage.getItem('isEditMode') === 'true');"
    content = content.replace(old_state, new_state)

    # 2. Update setIsEditMode calls to also set sessionStorage
    # Look for setIsEditMode(true) and setIsEditMode(false)
    # Actually, we can use a useEffect to sync isEditMode to sessionStorage to avoid patching all calls.
    # Let's insert a useEffect right after the state declaration.
    if new_state in content and "sessionStorage.setItem('isEditMode'" not in content:
        sync_effect = "\n  React.useEffect(() => {\n    sessionStorage.setItem('isEditMode', isEditMode.toString());\n  }, [isEditMode]);\n"
        content = content.replace(new_state, new_state + sync_effect)

    # 3. Update the MassGenerationModal handler to remove the `multi` branch since we removed it from the component
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
           }'''
           
    content = content.replace(old_handler, new_handler)

    # 4. Link unlocking Config Modal to enabling Edit Mode
    # "if (configPassword === 'Alcabama2026') {"
    # We will replace all instances of:
    # setIsConfigUnlocked(true);
    # setConfigError('');
    # with:
    # setIsConfigUnlocked(true);
    # setConfigError('');
    # setIsEditMode(true);
    
    config_unlock_old = '''setIsConfigUnlocked(true);
                              setConfigError('');'''
    config_unlock_new = '''setIsConfigUnlocked(true);
                              setConfigError('');
                              setIsEditMode(true);'''
    content = content.replace(config_unlock_old, config_unlock_new)

    config_unlock_old2 = '''setIsConfigUnlocked(true);
                        setConfigError('');'''
    config_unlock_new2 = '''setIsConfigUnlocked(true);
                        setConfigError('');
                        setIsEditMode(true);'''
    content = content.replace(config_unlock_old2, config_unlock_new2)

    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

modify_app()
