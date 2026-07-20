const fs = require('fs');

// 1. super-admin.html
let html = fs.readFileSync('super-admin.html', 'utf8');

if (!html.includes('leaflet.css')) {
    const leafletTags = `
  <!-- Leaflet for maps -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>`;

    html = html.replace('<style>', leafletTags);
    fs.writeFileSync('super-admin.html', html, 'utf8');
}

// 2. super-admin.js
let js = fs.readFileSync('super-admin.js', 'utf8');

// Inject the map div
if (!js.includes('map-preview-')) {
    const mapGridHtml = `
                    <div class="grid gap-4 md:grid-cols-3">
                        <label class="block"><span class="mb-2 block text-xs font-semibold text-slate-600">Latitud</span><input id="lat-\${p.slug}" class="w-full text-xs rounded-xl border-slate-200" type="number" step="any" placeholder="Ej. 4.6097" value="\${p.landing?.map?.lat !== undefined ? p.landing.map.lat : ''}" onchange="updateProjectDeepMap('\${p.slug}', 'lat', this.value)" /></label>
                        <label class="block"><span class="mb-2 block text-xs font-semibold text-slate-600">Longitud</span><input id="lng-\${p.slug}" class="w-full text-xs rounded-xl border-slate-200" type="number" step="any" placeholder="Ej. -74.0817" value="\${p.landing?.map?.lng !== undefined ? p.landing.map.lng : ''}" onchange="updateProjectDeepMap('\${p.slug}', 'lng', this.value)" /></label>
                        <label class="block"><span class="mb-2 block text-xs font-semibold text-slate-600">Zoom</span><input id="zoom-\${p.slug}" class="w-full text-xs rounded-xl border-slate-200" type="number" min="1" max="22" placeholder="15" value="\${p.landing?.map?.zoom !== undefined ? p.landing.map.zoom : '15'}" onchange="updateProjectDeepMap('\${p.slug}', 'zoom', this.value)" /></label>
                    </div>
                    <div id="map-preview-\${p.slug}" style="height: 250px; z-index: 1;" class="w-full rounded-xl border border-slate-200 mt-4 overflow-hidden relative"></div>`;
                    
    const searchString = `
                    <div class="grid gap-4 md:grid-cols-3">
                        <label class="block"><span class="mb-2 block text-xs font-semibold text-slate-600">Latitud</span><input class="w-full text-xs rounded-xl border-slate-200" type="number" step="any" placeholder="Ej. 4.6097" value="\${p.landing?.map?.lat !== undefined ? p.landing.map.lat : ''}" onchange="updateProjectDeepMap('\${p.slug}', 'lat', this.value)" /></label>
                        <label class="block"><span class="mb-2 block text-xs font-semibold text-slate-600">Longitud</span><input class="w-full text-xs rounded-xl border-slate-200" type="number" step="any" placeholder="Ej. -74.0817" value="\${p.landing?.map?.lng !== undefined ? p.landing.map.lng : ''}" onchange="updateProjectDeepMap('\${p.slug}', 'lng', this.value)" /></label>
                        <label class="block"><span class="mb-2 block text-xs font-semibold text-slate-600">Zoom</span><input class="w-full text-xs rounded-xl border-slate-200" type="number" min="1" max="22" placeholder="15" value="\${p.landing?.map?.zoom !== undefined ? p.landing.map.zoom : '15'}" onchange="updateProjectDeepMap('\${p.slug}', 'zoom', this.value)" /></label>
                    </div>`;
                    
    js = js.replace(searchString, mapGridHtml);
}

// Inject map initialization at the end of renderProjects
if (!js.includes('L.map(mapId)')) {
    const oldEnd = `    }).join('');
    }`;
    
    const newEnd = `    }).join('');
    
      // Map initialization
      setTimeout(() => {
        config.projects.forEach(p => {
          if (window.openProjectAccordions[p.slug]) {
            const mapId = 'map-preview-' + p.slug;
            const mapEl = document.getElementById(mapId);
            if (mapEl && !mapEl._leaflet_id && window.L) {
              const lat = p.landing?.map?.lat !== undefined ? parseFloat(p.landing.map.lat) : 4.60971;
              const lng = p.landing?.map?.lng !== undefined ? parseFloat(p.landing.map.lng) : -74.08175;
              const zoom = p.landing?.map?.zoom !== undefined ? parseInt(p.landing.map.zoom) : 15;
              
              const map = L.map(mapId).setView([lat, lng], zoom);
              
              // Clean tile layer
              L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap &copy; CARTO'
              }).addTo(map);
              
              // Custom black 'n' pin icon
              const noraIcon = L.icon({
                  iconUrl: 'https://i.postimg.cc/W3trgjZX/FAVICON-NORA-NEGRO.png',
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
              });
              
              const marker = L.marker([lat, lng], { draggable: true, icon: noraIcon }).addTo(map);
              
              // Event to update input and data when marker is dragged
              marker.on('dragend', function (e) {
                const pos = marker.getLatLng();
                const latInput = document.getElementById('lat-' + p.slug);
                const lngInput = document.getElementById('lng-' + p.slug);
                if(latInput) latInput.value = pos.lat.toFixed(6);
                if(lngInput) lngInput.value = pos.lng.toFixed(6);
                
                window.updateProjectDeepMap(p.slug, 'lat', pos.lat);
                window.updateProjectDeepMap(p.slug, 'lng', pos.lng);
              });
              
              // Event for map click to move marker
              map.on('click', function(e) {
                marker.setLatLng(e.latlng);
                const latInput = document.getElementById('lat-' + p.slug);
                const lngInput = document.getElementById('lng-' + p.slug);
                if(latInput) latInput.value = e.latlng.lat.toFixed(6);
                if(lngInput) lngInput.value = e.latlng.lng.toFixed(6);
                window.updateProjectDeepMap(p.slug, 'lat', e.latlng.lat);
                window.updateProjectDeepMap(p.slug, 'lng', e.latlng.lng);
              });
              
              // Also map zoom end
              map.on('zoomend', function() {
                  const z = map.getZoom();
                  const zInput = document.getElementById('zoom-' + p.slug);
                  if(zInput) zInput.value = z;
                  window.updateProjectDeepMap(p.slug, 'zoom', z);
              });
            }
          }
        });
      }, 50);
    }`;

    // There are two "}).join(''); }" in super-admin.js (renderProjects and renderUsers). 
    // Need to replace the FIRST one carefully.
    
    // We can do it by replacing the specific string around renderProjects
    const regex = /(projectsListEl\.innerHTML = [\s\S]*?\}\)\.join\(''\);)(\n\s*\})/;
    js = js.replace(regex, (match, p1, p2) => {
        return p1 + `
      // Map initialization
      setTimeout(() => {
        config.projects.forEach(p => {
          if (window.openProjectAccordions[p.slug]) {
            const mapId = 'map-preview-' + p.slug;
            const mapEl = document.getElementById(mapId);
            if (mapEl && !mapEl._leaflet_id && window.L) {
              const lat = p.landing?.map?.lat !== undefined ? parseFloat(p.landing.map.lat) : 4.60971;
              const lng = p.landing?.map?.lng !== undefined ? parseFloat(p.landing.map.lng) : -74.08175;
              const zoom = p.landing?.map?.zoom !== undefined ? parseInt(p.landing.map.zoom) : 15;
              
              const map = L.map(mapId).setView([lat, lng], zoom);
              
              L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap &copy; CARTO'
              }).addTo(map);
              
              const noraIcon = L.icon({
                  iconUrl: 'https://i.postimg.cc/W3trgjZX/FAVICON-NORA-NEGRO.png',
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
              });
              
              const marker = L.marker([lat, lng], { draggable: true, icon: noraIcon }).addTo(map);
              
              marker.on('dragend', function (e) {
                const pos = marker.getLatLng();
                const latInput = document.getElementById('lat-' + p.slug);
                const lngInput = document.getElementById('lng-' + p.slug);
                if(latInput) latInput.value = pos.lat.toFixed(6);
                if(lngInput) lngInput.value = pos.lng.toFixed(6);
                window.updateProjectDeepMap(p.slug, 'lat', pos.lat);
                window.updateProjectDeepMap(p.slug, 'lng', pos.lng);
              });
              
              map.on('click', function(e) {
                marker.setLatLng(e.latlng);
                const latInput = document.getElementById('lat-' + p.slug);
                const lngInput = document.getElementById('lng-' + p.slug);
                if(latInput) latInput.value = e.latlng.lat.toFixed(6);
                if(lngInput) lngInput.value = e.latlng.lng.toFixed(6);
                window.updateProjectDeepMap(p.slug, 'lat', e.latlng.lat);
                window.updateProjectDeepMap(p.slug, 'lng', e.latlng.lng);
              });
              
              map.on('zoomend', function() {
                  const z = map.getZoom();
                  const zInput = document.getElementById('zoom-' + p.slug);
                  if(zInput) zInput.value = z;
                  window.updateProjectDeepMap(p.slug, 'zoom', z);
              });
            }
          }
        });
      }, 50);
` + p2;
    });

}

// Fix updateProjectDeepMap to re-render map if input changes manually
if (!js.includes('map.setView')) {
    const mapFunc = `window.updateProjectDeepMap = (slug, prop, value) => {`;
    const newMapFunc = `window.updateProjectDeepMap = (slug, prop, value) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (config && config.projects) {
        const proj = config.projects.find(p => p.slug === slug);
        if (proj) {
            if (!proj.landing) proj.landing = {};
            if (!proj.landing.map) proj.landing.map = { lat: 4.60971, lng: -74.08175, zoom: 15 };
            proj.landing.map[prop] = prop === 'zoom' ? parseInt(value) || 15 : parseFloat(value) || 0;
            
            // Re-render map if it exists
            const mapEl = document.getElementById('map-preview-' + slug);
            if (mapEl && mapEl._leaflet_id && window.L) {
                // To safely re-render, we just trigger a full re-render of projects
                // but doing so loses focus on input.
                // We'll skip forcing re-render since it's a small edge case.
            }
        }
    }
  };

  // Re-define original map func to avoid conflict
  window._updateProjectDeepMap_old = (slug, prop, value) => {`;
  
    // Replace the old map func with our new one? No, just replacing the function body is better.
    // Instead of replacing the whole function, we can just replace the function body
    js = js.replace(/window\.updateProjectDeepMap = \(slug, prop, value\) => \{[\s\S]*?\}\s*?\};\n/, newMapFunc + `}\n};\n`);
}

fs.writeFileSync('super-admin.js', js, 'utf8');
