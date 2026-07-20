const fs = require('fs');

let js = fs.readFileSync('super-admin.js', 'utf8');

// 1. Add updateProjectDeepMap function right before updateProjectDeepDS
const mapFunc = `
  window.updateProjectDeepMap = (slug, prop, value) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (config && config.projects) {
        const proj = config.projects.find(p => p.slug === slug);
        if (proj) {
            if (!proj.landing) proj.landing = {};
            if (!proj.landing.map) proj.landing.map = { lat: 4.60971, lng: -74.08175, zoom: 15 };
            proj.landing.map[prop] = prop === 'zoom' ? parseInt(value) || 15 : parseFloat(value) || 0;
        }
    }
  };
`;

js = js.replace('window.updateProjectDeepDS =', mapFunc + '\\n  window.updateProjectDeepDS =');

// 2. Replace the old "Ciudad" input with the new País, Ciudad, Dirección, Lat, Lng, Zoom fields
const oldCiudadLabel = `<label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Ciudad</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.city || ''}" onchange="updateProject('\${p.slug}', 'city', this.value)" /></label>`;

const newLocationFields = `
                  <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">País</span>
                    <select class="w-full text-xs rounded-xl border-slate-200" onchange="updateProject('\${p.slug}', 'country', this.value)">
                      <option value="">Seleccionar...</option>
                      <option value="Colombia" \${p.country==='Colombia'?'selected':''}>Colombia</option>
                      <option value="México" \${p.country==='México'?'selected':''}>México</option>
                      <option value="Perú" \${p.country==='Perú'?'selected':''}>Perú</option>
                      <option value="Chile" \${p.country==='Chile'?'selected':''}>Chile</option>
                      <option value="Argentina" \${p.country==='Argentina'?'selected':''}>Argentina</option>
                      <option value="Ecuador" \${p.country==='Ecuador'?'selected':''}>Ecuador</option>
                      <option value="Panamá" \${p.country==='Panamá'?'selected':''}>Panamá</option>
                      <option value="España" \${p.country==='España'?'selected':''}>España</option>
                      <option value="Estados Unidos" \${p.country==='Estados Unidos'?'selected':''}>Estados Unidos</option>
                      <option value="Otro" \${p.country==='Otro'?'selected':''}>Otro</option>
                    </select>
                  </label>
                  <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Ciudad</span>
                    <input list="city-list-\${p.slug}" class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="Selecciona o escribe..." value="\${p.city || ''}" onchange="updateProject('\${p.slug}', 'city', this.value)" />
                    <datalist id="city-list-\${p.slug}">
                      <option value="Bogotá"></option>
                      <option value="Medellín"></option>
                      <option value="Cali"></option>
                      <option value="Barranquilla"></option>
                      <option value="Bucaramanga"></option>
                      <option value="Cartagena"></option>
                      <option value="Ciudad de México"></option>
                      <option value="Lima"></option>
                      <option value="Santiago"></option>
                      <option value="Buenos Aires"></option>
                      <option value="Quito"></option>
                      <option value="Madrid"></option>
                      <option value="Miami"></option>
                    </datalist>
                  </label>
                  <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Dirección</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="\${p.address || ''}" placeholder="Ej. Av. Siempre Viva 123" onchange="updateProject('\${p.slug}', 'address', this.value)" /></label>
                  
                  <!-- Mapa -->
                  <div class="col-span-full border-t border-slate-100 pt-4 mt-2 mb-2">
                    <h4 class="text-xs font-bold uppercase tracking-[0.1em] text-slate-400 mb-4">Ubicación en el Mapa</h4>
                    <div class="grid gap-4 md:grid-cols-3">
                        <label class="block"><span class="mb-2 block text-xs font-semibold text-slate-600">Latitud</span><input class="w-full text-xs rounded-xl border-slate-200" type="number" step="any" placeholder="Ej. 4.6097" value="\${p.landing?.map?.lat !== undefined ? p.landing.map.lat : ''}" onchange="updateProjectDeepMap('\${p.slug}', 'lat', this.value)" /></label>
                        <label class="block"><span class="mb-2 block text-xs font-semibold text-slate-600">Longitud</span><input class="w-full text-xs rounded-xl border-slate-200" type="number" step="any" placeholder="Ej. -74.0817" value="\${p.landing?.map?.lng !== undefined ? p.landing.map.lng : ''}" onchange="updateProjectDeepMap('\${p.slug}', 'lng', this.value)" /></label>
                        <label class="block"><span class="mb-2 block text-xs font-semibold text-slate-600">Zoom</span><input class="w-full text-xs rounded-xl border-slate-200" type="number" min="1" max="22" placeholder="15" value="\${p.landing?.map?.zoom !== undefined ? p.landing.map.zoom : '15'}" onchange="updateProjectDeepMap('\${p.slug}', 'zoom', this.value)" /></label>
                    </div>
                  </div>
`;

js = js.replace(oldCiudadLabel, newLocationFields);

fs.writeFileSync('super-admin.js', js, 'utf8');
