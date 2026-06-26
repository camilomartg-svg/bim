import re

def modify_app():
    with open('src/App.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    old_state = "const [allTowers, setAllTowers] = useState<Tower[]>(() => generateStructure(getStoredConfig()));"
    new_state = "const [allTowers, setAllTowers] = useState<Tower[]>(() => getInitialStructure());"
    
    if old_state in content:
        content = content.replace(old_state, new_state)
    
    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

modify_app()
