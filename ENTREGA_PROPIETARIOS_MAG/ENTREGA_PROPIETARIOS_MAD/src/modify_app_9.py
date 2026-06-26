import re

def modify_app():
    with open('src/App.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the refreshData definition
    old_refresh = '''      const data = await fetchSheetData();
      if (!data || data.length === 0) throw new Error('No data received');
      const merged = mergeSheetDataIntoTowers(generateStructure(currentConfig), data);
      setAllTowers(merged);
      writeCachedTowers(merged);'''
      
    new_refresh = '''      const data = await fetchSheetData();
      if (!data || data.length === 0) throw new Error('No data received');
      // Fix: Merge into the currently loaded custom structure, not the default structure
      setAllTowers(prevTowers => {
        const merged = mergeSheetDataIntoTowers(prevTowers, data);
        writeCachedTowers(merged);
        return merged;
      });'''

    if old_refresh in content:
        content = content.replace(old_refresh, new_refresh)
    
    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

modify_app()
