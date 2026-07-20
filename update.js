const fs = require('fs');

let js = fs.readFileSync('super-admin.js', 'utf8');

const newRenderProjects = `
  window.openProjectAccordions = window.openProjectAccordions || {};
  window.toggleProjectAccordion = (slug) => {
    window.openProjectAccordions[slug] = !window.openProjectAccordions[slug];
    renderProjects();
  };

  function renderProjects() {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    
    projectsListEl.innerHTML = config.projects.map((p, i) => {
      const isOpen = !!window.openProjectAccordions[p.slug];
      const isSuperAdmin = userRole === 'SUPER_ADMINISTRADOR';
      
      // Lógica de bloqueo
      const isLocked = p.lockDataSources === true;
      const canEditDataSources = isSuperAdmin || !isLocked;
      const disableAttr = canEditDataSources ? '' : 'disabled="disabled"';
      const disableClass = canEditDataSources ? '' : 'opacity-50 cursor-not-allowed';

      let accordionContent = '';
      if (isOpen) {
        accordionContent = \`
        <div class="p-5 border-t border-slate-200 bg-white">
          <div class="grid gap-6">
            <section>
              <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Información base</h3>
              <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Nombre</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.name || ''}" onchange="updateProject('\${p.slug}', 'name', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Slug (Solo lectura)</span><input class="w-full text-xs rounded-xl border-slate-200 bg-slate-100" type="text" value="\${p.slug || ''}" readonly disabled /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Home personalizado</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="Vacío = usar landing automática" value="\${p.homeUrl || ''}" onchange="updateProject('\${p.slug}', 'homeUrl', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Ciudad</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.city || ''}" onchange="updateProject('\${p.slug}', 'city', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Tipo</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.type || ''}" onchange="updateProject('\${p.slug}', 'type', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Estado</span>
                  <select class="w-full text-xs rounded-xl border-slate-200" onchange="updateProject('\${p.slug}', 'status', this.value)">
                    <option value="Planeacion" \${p.status==='Planeacion'?'selected':''}>Planeación</option>
                    <option value="Activo" \${p.status==='Activo'?'selected':''}>Activo</option>
                    <option value="Cerrado" \${p.status==='Cerrado'?'selected':''}>Cerrado</option>
                  </select>
                </label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">ID Empresa (opcional)</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="nora, amarillo, etc." value="\${p.empresaId || ''}" onchange="updateProject('\${p.slug}', 'empresaId', this.value)" /></label>
                <label class="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"><input class="rounded border-slate-300" type="checkbox" \${p.enabled!==false?'checked':''} onchange="updateProject('\${p.slug}', 'enabled', this.checked)" />Proyecto activo en el portal</label>
                <label class="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"><input class="rounded border-slate-300" type="checkbox" \${(!p.landing || p.landing.enabled!==false)?'checked':''} onchange="updateProjectDeep('\${p.slug}', 'landing', 'enabled', this.checked)" />Usar landing tipo Green I</label>
              </div>
            </section>

            <section>
              <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Branding y textos</h3>
              <div class="mt-4 grid gap-4 md:grid-cols-2">
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Logo del proyecto</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="https://..." value="\${p.landing?.logoUrl || ''}" onchange="updateProjectDeep('\${p.slug}', 'landing', 'logoUrl', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Logo portal claro</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="https://..." value="\${p.landing?.portalLogoLight || ''}" onchange="updateProjectDeep('\${p.slug}', 'landing', 'portalLogoLight', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Logo portal oscuro</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="https://..." value="\${p.landing?.portalLogoDark || ''}" onchange="updateProjectDeep('\${p.slug}', 'landing', 'portalLogoDark', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Logo visor claro</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="https://..." value="\${p.landing?.viewerLogoLight || ''}" onchange="updateProjectDeep('\${p.slug}', 'landing', 'viewerLogoLight', this.value)" /></label>
                <label class="block md:col-span-2"><span class="mb-2 block text-sm font-semibold text-slate-700">Logo visor oscuro</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="https://..." value="\${p.landing?.viewerLogoDark || ''}" onchange="updateProjectDeep('\${p.slug}', 'landing', 'viewerLogoDark', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Eyebrow superior</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.landing?.eyebrow || ''}" onchange="updateProjectDeep('\${p.slug}', 'landing', 'eyebrow', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Título landing</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.landing?.title || ''}" onchange="updateProjectDeep('\${p.slug}', 'landing', 'title', this.value)" /></label>
                <label class="block md:col-span-2"><span class="mb-2 block text-sm font-semibold text-slate-700">Descripción principal</span><textarea class="w-full text-xs rounded-2xl border-slate-200" rows="3" onchange="updateProjectDeep('\${p.slug}', 'landing', 'subtitle', this.value)">\${p.landing?.subtitle || ''}</textarea></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Eyebrow acciones</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.landing?.actionEyebrow || ''}" onchange="updateProjectDeep('\${p.slug}', 'landing', 'actionEyebrow', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Título acciones</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.landing?.actionTitle || ''}" onchange="updateProjectDeep('\${p.slug}', 'landing', 'actionTitle', this.value)" /></label>
                <label class="block md:col-span-2"><span class="mb-2 block text-sm font-semibold text-slate-700">Descripción acciones</span><textarea class="w-full text-xs rounded-2xl border-slate-200" rows="3" onchange="updateProjectDeep('\${p.slug}', 'landing', 'actionDescription', this.value)">\${p.landing?.actionDescription || ''}</textarea></label>
              </div>
            </section>

            <section>
              <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Mapa y ciudad</h3>
              <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Eyebrow mapa</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.landing?.map?.eyebrow || ''}" onchange="updateProjectDeepMap('\${p.slug}', 'eyebrow', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Nombre ciudad visible</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.landing?.map?.cityLabel || ''}" onchange="updateProjectDeepMap('\${p.slug}', 'cityLabel', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Zoom del mapa</span><input class="w-full text-xs rounded-xl border-slate-200" type="number" step="1" value="\${p.landing?.map?.zoom || 15}" onchange="updateProjectDeepMap('\${p.slug}', 'zoom', parseFloat(this.value))" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Latitud</span><input class="w-full text-xs rounded-xl border-slate-200" type="number" step="any" value="\${p.landing?.map?.lat || 4.60971}" onchange="updateProjectDeepMap('\${p.slug}', 'lat', parseFloat(this.value))" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Longitud</span><input class="w-full text-xs rounded-xl border-slate-200" type="number" step="any" value="\${p.landing?.map?.lng || -74.08175}" onchange="updateProjectDeepMap('\${p.slug}', 'lng', parseFloat(this.value))" /></label>
                <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Actualiza las coordenadas para ajustar la visualización del mapa en la landing.</div>
                <label class="block md:col-span-2 xl:col-span-3"><span class="mb-2 block text-sm font-semibold text-slate-700">Descripción de ciudad</span><textarea class="w-full text-xs rounded-2xl border-slate-200" rows="3" onchange="updateProjectDeepMap('\${p.slug}', 'description', this.value)">\${p.landing?.map?.description || ''}</textarea></label>
                <label class="block md:col-span-2 xl:col-span-3"><span class="mb-2 block text-sm font-semibold text-slate-700">Dirección</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.landing?.map?.address || ''}" onchange="updateProjectDeepMap('\${p.slug}', 'address', this.value)" /></label>
              </div>
            </section>

            <section>
              <div class="flex items-center justify-between mb-4">
                  <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Modelos IFC y Fuentes de datos</h3>
                  \${isSuperAdmin ? \`
                  <label class="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
                      <input class="rounded border-rose-300 text-rose-600" type="checkbox" \${isLocked?'checked':''} onchange="updateProject('\${p.slug}', 'lockDataSources', this.checked)" />
                      Bloquear para Empresa
                  </label>
                  \` : \`
                  \${isLocked ? '<span class="px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded bg-slate-200 text-slate-500">🔒 Bloqueado por Super Admin</span>' : ''}
                  \`}
              </div>
              <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label class="block \${disableClass}"><span class="mb-2 block text-sm font-semibold text-slate-700">Nombre Carpeta Modelos IFC</span><input \${disableAttr} class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.dataSources?.driveFolderName || ''}" onchange="updateProjectDeepDS('\${p.slug}', 'driveFolderName', this.value)" /></label>
                <label class="block \${disableClass}"><span class="mb-2 block text-sm font-semibold text-slate-700">ID Carpeta Modelos IFC</span><input \${disableAttr} class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.dataSources?.driveFolderId || ''}" onchange="updateProjectDeepDS('\${p.slug}', 'driveFolderId', this.value)" /></label>
                <label class="block md:col-span-2 xl:col-span-1 \${disableClass}"><span class="mb-2 block text-sm font-semibold text-slate-700">Script de Modelos (Drive)</span><input \${disableAttr} class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.dataSources?.driveScriptUrl || ''}" onchange="updateProjectDeepDS('\${p.slug}', 'driveScriptUrl', this.value)" /></label>
                <label class="block \${disableClass}"><span class="mb-2 block text-sm font-semibold text-slate-700">Sheet ID STATUS</span><input \${disableAttr} class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.dataSources?.statusSheetId || ''}" onchange="updateProjectDeepDS('\${p.slug}', 'statusSheetId', this.value)" /></label>
                <label class="block \${disableClass}"><span class="mb-2 block text-sm font-semibold text-slate-700">Script STATUS</span><input \${disableAttr} class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.dataSources?.statusScriptUrl || ''}" onchange="updateProjectDeepDS('\${p.slug}', 'statusScriptUrl', this.value)" /></label>
                <label class="block \${disableClass}"><span class="mb-2 block text-sm font-semibold text-slate-700">Sheet ID CANTIDADES</span><input \${disableAttr} class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.dataSources?.cantidadesSheetId || ''}" onchange="updateProjectDeepDS('\${p.slug}', 'cantidadesSheetId', this.value)" /></label>
                <label class="block md:col-span-2 xl:col-span-2 \${disableClass}"><span class="mb-2 block text-sm font-semibold text-slate-700">Script CANTIDADES</span><input \${disableAttr} class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.dataSources?.cantidadesScriptUrl || ''}" onchange="updateProjectDeepDS('\${p.slug}', 'cantidadesScriptUrl', this.value)" /></label>
              </div>
            </section>

            <section>
              <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Módulos del proyecto</h3>
              <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Visor IFC</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.modules?.ifc || ''}" onchange="updateProjectDeepMod('\${p.slug}', 'ifc', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">STATUS</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.modules?.status || ''}" onchange="updateProjectDeepMod('\${p.slug}', 'status', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">CANTIDADES</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.modules?.cantidades || ''}" onchange="updateProjectDeepMod('\${p.slug}', 'cantidades', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Visor PDF</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.modules?.pdf || ''}" onchange="updateProjectDeepMod('\${p.slug}', 'pdf', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Visor DWG</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.modules?.dwg || ''}" onchange="updateProjectDeepMod('\${p.slug}', 'dwg', this.value)" /></label>
              </div>
            </section>

            <section>
              <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Acciones del panel</h3>
              <div class="mt-4 grid gap-4 md:grid-cols-3">
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Publicaciones</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.actions?.publicaciones || ''}" onchange="updateProjectDeepAct('\${p.slug}', 'publicaciones', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Solicitudes</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.actions?.solicitudes || ''}" onchange="updateProjectDeepAct('\${p.slug}', 'solicitudes', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Equipo</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.actions?.equipo || ''}" onchange="updateProjectDeepAct('\${p.slug}', 'equipo', this.value)" /></label>
              </div>
            </section>
          </div>
        </div>
        \`;
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
          \${accordionContent}
        </div>
      \`;
    }).join('');
  }

  window.updateProjectDeep = (slug, parent, field, val) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    const proj = config.projects.find(p => p.slug === slug);
    if(proj) {
        if(!proj[parent]) proj[parent] = {};
        proj[parent][field] = val;
    }
  };
  
  window.updateProjectDeepMap = (slug, field, val) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    const proj = config.projects.find(p => p.slug === slug);
    if(proj) {
        if(!proj.landing) proj.landing = {};
        if(!proj.landing.map) proj.landing.map = {};
        proj.landing.map[field] = val;
    }
  };

  window.updateProjectDeepDS = (slug, field, val) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    const proj = config.projects.find(p => p.slug === slug);
    if(proj) {
        if(!proj.dataSources) proj.dataSources = {};
        proj.dataSources[field] = val;
    }
  };

  window.updateProjectDeepMod = (slug, field, val) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    const proj = config.projects.find(p => p.slug === slug);
    if(proj) {
        if(!proj.modules) proj.modules = {};
        proj.modules[field] = val;
    }
  };
  
  window.updateProjectDeepAct = (slug, field, val) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    const proj = config.projects.find(p => p.slug === slug);
    if(proj) {
        if(!proj.actions) proj.actions = {};
        proj.actions[field] = val;
    }
  };
`;

const oldRenderProjectsRegex = /function renderProjects\(\) \{[\s\S]*?\}\s*window\.updateProject = [\s\S]*?\};\s*window\.deleteProject =/m;

const oldMatch = js.match(oldRenderProjectsRegex);
if (!oldMatch) {
  console.log('Could not find old renderProjects to replace');
} else {
  js = js.replace(oldRenderProjectsRegex, newRenderProjects + '\n\n  window.deleteProject =');
  fs.writeFileSync('super-admin.js', js, 'utf8');
  console.log('Successfully updated super-admin.js');
}
