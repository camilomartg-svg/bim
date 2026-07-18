const fs = require('fs');

let js = fs.readFileSync('super-admin.js', 'utf8');

const regexCityBlock = /<label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Ciudad<\/span>\s*<input list="city-list-\$\{p\.slug\}"[^>]+>\s*<datalist id="city-list-\$\{p\.slug\}">[\s\S]*?<\/datalist>\s*<\/label>/;

const replacementCityBlock = `<label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Ciudad</span>
                    \${cityInputHTML}
                  </label>`;

// Now we need to inject the logic to compute cityInputHTML right after `if (isOpen) {`
const logicToInject = `
          const citiesByCountry = {
            "Colombia": ["Bogotá", "Medellín", "Cali", "Barranquilla", "Bucaramanga", "Cartagena", "Otro"],
            "México": ["Ciudad de México", "Guadalajara", "Monterrey", "Puebla", "Tijuana", "Otro"],
            "Perú": ["Lima", "Arequipa", "Trujillo", "Chiclayo", "Piura", "Otro"],
            "Chile": ["Santiago", "Valparaíso", "Concepción", "La Serena", "Antofagasta", "Otro"],
            "Argentina": ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "Tucumán", "Otro"],
            "Ecuador": ["Quito", "Guayaquil", "Cuenca", "Santo Domingo", "Machala", "Otro"],
            "Panamá": ["Ciudad de Panamá", "San Miguelito", "Tocumen", "David", "Colón", "Otro"],
            "España": ["Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza", "Otro"],
            "Estados Unidos": ["New York", "Los Angeles", "Chicago", "Houston", "Miami", "Otro"]
          };
          let cityInputHTML = '';
          if (p.country && p.country !== 'Otro' && citiesByCountry[p.country]) {
            const cities = citiesByCountry[p.country];
            const isCustomCity = p.city && !cities.includes(p.city) && p.city !== '';
            const selectValue = isCustomCity ? 'Otro' : (p.city || '');
            
            cityInputHTML = \`
              <select class="w-full text-xs rounded-xl border-slate-200 \${isCustomCity ? 'mb-2' : ''}" onchange="if(this.value === 'Otro') { this.nextElementSibling.classList.remove('hidden'); this.classList.add('mb-2'); this.nextElementSibling.focus(); } else { this.nextElementSibling.classList.add('hidden'); this.classList.remove('mb-2'); updateProject('\${p.slug}', 'city', this.value); }">
                <option value="">Seleccionar...</option>
                \${cities.map(c => \\\`<option value="\${c}" \${selectValue === c ? 'selected' : ''}>\${c}</option>\\\`).join('')}
              </select>
              <input class="w-full text-xs rounded-xl border-slate-200 \${isCustomCity ? '' : 'hidden'}" type="text" placeholder="¿Cuál?" value="\${isCustomCity ? p.city : ''}" onchange="updateProject('\${p.slug}', 'city', this.value)" />
            \`;
          } else if (p.country === 'Otro') {
            cityInputHTML = \`<input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="¿Cuál?" value="\${p.city || ''}" onchange="updateProject('\${p.slug}', 'city', this.value)" />\`;
          } else {
            cityInputHTML = \`<select class="w-full text-xs rounded-xl border-slate-200" disabled><option value="">Selecciona un país primero</option></select>\`;
          }
`;

if (regexCityBlock.test(js)) {
    js = js.replace(regexCityBlock, replacementCityBlock);
    
    // Inject the logic right before contentBase = `
    const logicRegex = /contentBase\s*=\s*`/;
    js = js.replace(logicRegex, logicToInject + '\n          contentBase = `');
    
    fs.writeFileSync('super-admin.js', js, 'utf8');
    console.log("Successfully replaced city dropdown logic!");
} else {
    console.log("Failed to find city block regex match.");
}
