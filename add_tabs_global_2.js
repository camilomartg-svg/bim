const fs = require('fs');

let js = fs.readFileSync('super-admin.js', 'utf8');

const replaceStart = js.indexOf("let accordionContent = '';");
const replaceEnd = js.indexOf("return `", replaceStart);

if (replaceStart !== -1 && replaceEnd !== -1) {
    let blockToReplace = js.substring(replaceStart - 8, replaceEnd - 8);
    
    const splitStr = '<h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Branding y textos</h3>';
    const splitIdx = blockToReplace.indexOf(splitStr);
    
    if (splitIdx !== -1) {
        const sectionStartIdx = blockToReplace.lastIndexOf('<section>', splitIdx);
        
        let basePart = blockToReplace.substring(0, sectionStartIdx);
        let configPart = blockToReplace.substring(sectionStartIdx);
        
        const innerBaseStart = basePart.indexOf('<div class="grid gap-6">') + '<div class="grid gap-6">'.length;
        let innerBase = basePart.substring(innerBaseStart);
        
        let innerConfig = configPart.substring(0, configPart.lastIndexOf('</div>'));
        innerConfig = innerConfig.substring(0, innerConfig.lastIndexOf('</div>'));
        innerConfig = innerConfig.replace(/`;?\\s*}\\s*$/, '');
        innerConfig = innerConfig.trim();
        
        const replacement = `let contentBase = '';
        if (isOpen) {
          contentBase = \`
          <div class="p-5 border-t border-slate-200 bg-white">
            <div class="grid gap-6">
\${innerBase}
            </div>
          </div>\`;
        }
        
        return \`
          <div class="border-b border-slate-100 last:border-0 bg-slate-50">
            <div class="grid grid-cols-12 gap-2 p-3 text-sm items-center hover:bg-slate-100 cursor-pointer" onclick="toggleProjectAccordion('\${p.slug}')">
              <div class="col-span-4 font-semibold text-slate-800 flex items-center gap-2">
                  <span class="material-symbols-outlined text-slate-400 text-lg transition-transform \${isOpen ? 'rotate-180' : ''}">expand_more</span>
                  \${p.name || p.title || 'Proyecto'}
              </div>
              <div class="col-span-3 font-mono text-[10px] text-slate-500 truncate" title="\${p.slug}">\${p.slug}</div>
              <div class="col-span-2">
                  <span class="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider \${p.status==='Activo'?'bg-emerald-100 text-emerald-700':p.status==='Cerrado'?'bg-rose-100 text-rose-700':'bg-slate-200 text-slate-700'}">\${p.status}</span>
              </div>
              <div class="col-span-3 text-right flex justify-end gap-2" onclick="event.stopPropagation()">
                <button onclick="deleteProject('\${p.slug}')" class="text-rose-500 hover:text-rose-700 p-1 bg-white border border-rose-200 rounded shadow-sm hover:shadow"><span class="material-symbols-outlined text-sm">delete</span></button>
              </div>
            </div>
            \${contentBase}
          </div>
        \`;
      }).join('');

      if (configListEl) {
        configListEl.innerHTML = config.projects.map((p, i) => {
          const isOpen = !!window.openConfigAccordions[p.slug];
          const isSuperAdmin = userRole === 'SUPER_ADMINISTRADOR';
          
          const isLocked = p.lockDataSources === true;
          const canEditDataSources = isSuperAdmin || !isLocked;
          const disableAttr = canEditDataSources ? '' : 'disabled="disabled"';
          const disableClass = canEditDataSources ? '' : 'opacity-50 cursor-not-allowed';
    
          let contentConfig = '';
          if (isOpen) {
            contentConfig = \`
            <div class="p-5 border-t border-slate-200 bg-white">
              <div class="grid gap-6">
\${innerConfig}
              </div>
            </div>\`;
          }
          
          return \`
            <div class="border-b border-slate-100 last:border-0 bg-slate-50">
              <div class="grid grid-cols-12 gap-2 p-3 text-sm items-center hover:bg-slate-100 cursor-pointer" onclick="toggleConfigAccordion('\${p.slug}')">
                <div class="col-span-4 font-semibold text-slate-800 flex items-center gap-2">
                    <span class="material-symbols-outlined text-slate-400 text-lg transition-transform \${isOpen ? 'rotate-180' : ''}">expand_more</span>
                    \${p.name || p.title || 'Proyecto'}
                </div>
                <div class="col-span-3 font-mono text-[10px] text-slate-500 truncate" title="\${p.slug}">\${p.slug}</div>
                <div class="col-span-2">
                    <span class="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider \${p.status==='Activo'?'bg-emerald-100 text-emerald-700':p.status==='Cerrado'?'bg-rose-100 text-rose-700':'bg-slate-200 text-slate-700'}">\${p.status}</span>
                </div>
                <div class="col-span-3 text-right flex justify-end gap-2" onclick="event.stopPropagation()">
                  <button onclick="deleteProject('\${p.slug}')" class="text-rose-500 hover:text-rose-700 p-1 bg-white border border-rose-200 rounded shadow-sm hover:shadow"><span class="material-symbols-outlined text-sm">delete</span></button>
                </div>
              </div>
              \${contentConfig}
            </div>
          \`;
        }).join('');
      }

      // Map initialization placeholder logic wrapper end
        `;
        
        let finalReplacement = replacement.replace(/\$\{innerBase\}/g, innerBase).replace(/\$\{innerConfig\}/g, innerConfig);
        
        const joinIdx = js.indexOf("}).join('');", replaceEnd);
        if (joinIdx !== -1) {
            js = js.substring(0, replaceStart - 8) + finalReplacement + js.substring(joinIdx + "}).join('');".length);
            // Replace toggleConfigAccordion
            if (!js.includes('toggleConfigAccordion')) {
                js = js.replace(
                    "window.toggleProjectAccordion = (slug) => {\n    window.openProjectAccordions[slug] = !window.openProjectAccordions[slug];\n    renderProjects();\n  };",
                    "window.toggleProjectAccordion = (slug) => {\n    window.openProjectAccordions[slug] = !window.openProjectAccordions[slug];\n    renderProjects();\n  };\n\n  window.toggleConfigAccordion = (slug) => {\n    window.openConfigAccordions[slug] = !window.openConfigAccordions[slug];\n    renderProjects();\n  };"
                );
            }
            fs.writeFileSync('super-admin.js', js, 'utf8');
            console.log("Successfully replaced tabs with dual render!");
        }
    }
}
