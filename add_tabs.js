const fs = require('fs');

let js = fs.readFileSync('super-admin.js', 'utf8');

// Add the inner tab state functions
if (!js.includes('window.projectInnerTabs')) {
    const fnToInsert = `
    window.projectInnerTabs = window.projectInnerTabs || {};
    window.switchProjectInnerTab = (slug, tab) => {
      window.projectInnerTabs[slug] = tab;
      renderProjects();
    };
`;
    js = js.replace('window.openProjectAccordions = window.openProjectAccordions || {};', 'window.openProjectAccordions = window.openProjectAccordions || {};' + fnToInsert);
}

// Now replace the accordion rendering logic.
// Find the start of the accordion content
const searchStart = `        let accordionContent = '';
        if (isOpen) {
          accordionContent = \`
          <div class="p-5 border-t border-slate-200 bg-white">
            <div class="grid gap-6">
              <section>
                <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Informacin base</h3>`;

const searchMid1 = `                  <label class="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"><input class="rounded border-slate-300" type="checkbox" \${(!p.landing || p.landing.enabled!==false)?'checked':''} onchange="updateProjectDeep('\${p.slug}', 'landing', 'enabled', this.checked)" />Usar landing tipo Green I</label>
                </div>
              </section>`;

const searchMid2 = `              <section>
                <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Branding y textos</h3>`;

const searchEnd = `                </div>
              </section>
            </div>
          </div>
        \`;
      }).join('');`;

// We need to slice the string into Base and Config components.
const contentStartIdx = js.indexOf('<div class="p-5 border-t border-slate-200 bg-white">');
const contentEndIdx = js.indexOf('            </div>\\n          </div>\\n        `;\\n      }).join(\\'\\');', contentStartIdx);

if (contentStartIdx !== -1 && contentEndIdx !== -1) {
    const rawContent = js.substring(contentStartIdx, contentEndIdx);
    
    // Find where the split is (Branding y textos)
    const splitStr = '              <section>\\n                <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Branding y textos</h3>';
    const splitIdx = rawContent.indexOf(splitStr);
    
    if (splitIdx !== -1) {
        let baseContent = rawContent.substring(0, splitIdx).trim();
        // Remove the wrapping <div class="p-5 border-t border-slate-200 bg-white"><div class="grid gap-6"> from baseContent
        baseContent = baseContent.replace('<div class="p-5 border-t border-slate-200 bg-white">\\n            <div class="grid gap-6">\\n', '');
        
        let configContent = rawContent.substring(splitIdx).trim();
        
        const newAccordionLogic = `
          const innerTab = window.projectInnerTabs?.[p.slug] || 'base';
          const tabsHTML = \`
            <ul class="flex border-t border-slate-200 text-sm font-semibold text-slate-500 px-5 pt-3 bg-slate-50">
              <li><button onclick="switchProjectInnerTab('\${p.slug}', 'base')" class="block px-4 py-2 hover:text-blue-600 focus:outline-none \${innerTab === 'base' ? 'border-b-2 border-blue-600 text-blue-600' : ''}">Informacin Base</button></li>
              <li><button onclick="switchProjectInnerTab('\${p.slug}', 'config')" class="block px-4 py-2 hover:text-blue-600 focus:outline-none \${innerTab === 'config' ? 'border-b-2 border-blue-600 text-blue-600' : ''}">Configuracin Avanzada</button></li>
            </ul>
          \`;
          
          const contentBase = \`
            \${tabsHTML}
            <div class="p-5 bg-white border-t border-slate-200">
              <div class="grid gap-6">
                \n${baseContent}\n
              </div>
            </div>
          \`;

          const contentConfig = \`
            \${tabsHTML}
            <div class="p-5 bg-white border-t border-slate-200">
              <div class="grid gap-6">
                \n${configContent}\n
              </div>
            </div>
          \`;

          accordionContent = innerTab === 'base' ? contentBase : contentConfig;
        `;
        
        const replaceStart = js.indexOf('        if (isOpen) {');
        const replaceEnd = js.indexOf('        return `\\n          <div class="border-b border-slate-100 last:border-0 bg-slate-50">');
        
        if (replaceStart !== -1 && replaceEnd !== -1) {
            js = js.substring(0, replaceStart) + '        if (isOpen) {\\n' + newAccordionLogic + '\\n        }\\n' + js.substring(replaceEnd);
        }
    }
}

fs.writeFileSync('super-admin.js', js, 'utf8');
