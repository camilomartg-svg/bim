const fs = require('fs');

let js = fs.readFileSync('super-admin.js', 'utf8');

// Add the inner tab state functions
if (!js.includes('window.projectInnerTabs')) {
    const fnToInsert = `
    window.projectInnerTabs = window.projectInnerTabs || {};
    window.switchProjectInnerTab = (slug, tab) => {
      window.projectInnerTabs[slug] = tab;
      
      // Stop event propagation to prevent accordion from toggling
      if (window.event) window.event.stopPropagation();
      
      renderProjects();
    };
`;
    js = js.replace('window.openProjectAccordions = window.openProjectAccordions || {};', 'window.openProjectAccordions = window.openProjectAccordions || {};' + fnToInsert);
}

// Find the start of the accordion content
const startTag = '<div class="p-5 border-t border-slate-200 bg-white">';
const contentStartIdx = js.indexOf(startTag);

if (contentStartIdx !== -1) {
    const replaceStart = js.indexOf("let accordionContent = '';");
    // Find the end by looking for "return `" inside the map loop
    const replaceEnd = js.indexOf('return `', replaceStart);
    
    if (replaceStart !== -1 && replaceEnd !== -1) {
        let blockToReplace = js.substring(replaceStart - 8, replaceEnd - 8);
        
        // Find the split point for "Configuración Avanzada" (Branding y textos)
        const splitStr = '<h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Branding y textos</h3>';
        const splitIdx = blockToReplace.indexOf(splitStr);
        
        if (splitIdx !== -1) {
            // Find the <section> opening tag before the splitStr
            const sectionStartIdx = blockToReplace.lastIndexOf('<section>', splitIdx);
            
            if (sectionStartIdx !== -1) {
                let basePart = blockToReplace.substring(0, sectionStartIdx);
                let configPart = blockToReplace.substring(sectionStartIdx);
                
                const innerBaseStart = basePart.indexOf('<div class="grid gap-6">') + '<div class="grid gap-6">'.length;
                let innerBase = basePart.substring(innerBaseStart);
                
                let innerConfig = configPart.substring(0, configPart.lastIndexOf('</div>'));
                innerConfig = innerConfig.substring(0, innerConfig.lastIndexOf('</div>'));
                // Remove trailing tags
                innerConfig = innerConfig.replace(/`;?\\s*}\\s*$/, '');
                innerConfig = innerConfig.trim();
                
                const newAccordionLogic = `        let accordionContent = '';
        if (isOpen) {
          const innerTab = window.projectInnerTabs?.[p.slug] || 'base';
          
          const tabsHTML = \`
            <ul class="flex border-t border-slate-200 text-sm font-semibold text-slate-500 px-5 pt-3 bg-slate-50 gap-4">
              <li><button onclick="switchProjectInnerTab('\${p.slug}', 'base')" class="block px-4 py-2 hover:text-blue-600 focus:outline-none \${innerTab === 'base' ? 'border-b-2 border-blue-600 text-blue-600' : ''}">Información Base</button></li>
              <li><button onclick="switchProjectInnerTab('\${p.slug}', 'config')" class="block px-4 py-2 hover:text-blue-600 focus:outline-none \${innerTab === 'config' ? 'border-b-2 border-blue-600 text-blue-600' : ''}">Configuración</button></li>
            </ul>
          \`;
          
          const contentBase = \`
            \${tabsHTML}
            <div class="p-5 bg-white border-t border-slate-200">
              <div class="grid gap-6">
\${innerBase}
              </div>
            </div>
          \`;

          const contentConfig = \`
            \${tabsHTML}
            <div class="p-5 bg-white border-t border-slate-200">
              <div class="grid gap-6">
\${innerConfig}
              </div>
            </div>
          \`;

          accordionContent = innerTab === 'base' ? contentBase : contentConfig;
        }\n`;
                
                js = js.substring(0, replaceStart - 8) + newAccordionLogic + js.substring(replaceEnd - 8);
                fs.writeFileSync('super-admin.js', js, 'utf8');
                console.log("Successfully replaced tabs!");
            }
        }
    }
}
