const fs = require('fs');

let js = fs.readFileSync('super-admin.js', 'utf8');

const mapBlockStart = js.indexOf('      // Map initialization');
if (mapBlockStart !== -1) {
    const mapBlockEnd = js.indexOf('      }, 50);', mapBlockStart) + 13;
    const mapBlock = js.substring(mapBlockStart, mapBlockEnd);
    
    // Remove the block
    js = js.replace(mapBlock, '');
    
    // Insert it before window.updateProjectDeep
    const insertTarget = '  window.updateProjectDeep =';
    const targetIdx = js.indexOf(insertTarget);
    if (targetIdx !== -1) {
        // Find the '    }' right before it
        const insertPos = js.lastIndexOf('    }', targetIdx);
        
        // We need to add map.invalidateSize() to the block
        const fixedBlock = mapBlock
            .replace('              if (mapEl && !mapEl._leaflet_id && window.L) {', '              if (mapEl && !mapEl._leaflet_id && window.L) {\\n                setTimeout(() => { map.invalidateSize(); }, 200);');
        
        js = js.substring(0, insertPos) + fixedBlock + '\\n' + js.substring(insertPos);
    }
}

fs.writeFileSync('super-admin.js', js, 'utf8');
