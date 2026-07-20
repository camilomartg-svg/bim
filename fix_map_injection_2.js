const fs = require('fs');

let js = fs.readFileSync('super-admin.js', 'utf8');

const mapBlockStart = js.indexOf('      // Map initialization');
if (mapBlockStart !== -1) {
    // Find the end of the setTimeout block
    const mapBlockEnd = js.indexOf('      }, 50);', mapBlockStart) + 13;
    const mapBlock = js.substring(mapBlockStart, mapBlockEnd);
    
    // Remove it from its current position
    js = js.replace(mapBlock, '');
    
    // Find where renderProjects ends
    // It's the first window.updateProjectDeep
    const renderProjectsEnd = js.indexOf('window.updateProjectDeep = ');
    if (renderProjectsEnd !== -1) {
        // We need to inject the mapBlock just before the closing brace of renderProjects
        // renderProjects ends right before window.updateProjectDeep, with `    }`
        // Let's find the `    }` before `window.updateProjectDeep`
        const insertPos = js.lastIndexOf('    }', renderProjectsEnd);
        
        js = js.substring(0, insertPos) + mapBlock + '\\n' + js.substring(insertPos);
        fs.writeFileSync('super-admin.js', js, 'utf8');
    }
}
