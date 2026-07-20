const fs = require('fs');

// 1. super-admin.html
let html = fs.readFileSync('super-admin.html', 'utf8');

if (!html.includes('leaflet.css')) {
    html = html.replace('<style>', `
  <!-- Leaflet for maps -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>`);
    fs.writeFileSync('super-admin.html', html, 'utf8');
}

// 2. super-admin.js
let js = fs.readFileSync('super-admin.js', 'utf8');

if (!js.includes('map-preview-')) {
    js = js.replace(/<div class="grid gap-4 md:grid-cols-3">[\s\S]*?<label class="block"><span class="mb-2 block text-xs font-semibold text-slate-600">Latitud<\/span><input class="w-full text-xs rounded-xl border-slate-200" type="number" step="any" placeholder="Ej\. 4\.6097" value="\${p\.landing\?\.map\?\.lat !== undefined \? p\.landing\.map\.lat : ''}" onchange="updateProjectDeepMap\('\\$\\{p\.slug\\}', 'lat', this\.value\)" \/><\/label>[\s\S]*?<\/div>/m, 
    `<div class="grid gap-4 md:grid-cols-3">
                        <label class="block"><span class="mb-2 block text-xs font-semibold text-slate-600">Latitud</span><input id="lat-\${p.slug}" class="w-full text-xs rounded-xl border-slate-200" type="number" step="any" placeholder="Ej. 4.6097" value="\${p.landing?.map?.lat !== undefined ? p.landing.map.lat : ''}" onchange="updateProjectDeepMap('\${p.slug}', 'lat', this.value)" /></label>
                        <label class="block"><span class="mb-2 block text-xs font-semibold text-slate-600">Longitud</span><input id="lng-\${p.slug}" class="w-full text-xs rounded-xl border-slate-200" type="number" step="any" placeholder="Ej. -74.0817" value="\${p.landing?.map?.lng !== undefined ? p.landing.map.lng : ''}" onchange="updateProjectDeepMap('\${p.slug}', 'lng', this.value)" /></label>
                        <label class="block"><span class="mb-2 block text-xs font-semibold text-slate-600">Zoom</span><input id="zoom-\${p.slug}" class="w-full text-xs rounded-xl border-slate-200" type="number" min="1" max="22" placeholder="15" value="\${p.landing?.map?.zoom !== undefined ? p.landing.map.zoom : '15'}" onchange="updateProjectDeepMap('\${p.slug}', 'zoom', this.value)" /></label>
                    </div>
                    <div id="map-preview-\${p.slug}" style="height: 250px; z-index: 1;" class="w-full rounded-xl border border-slate-200 mt-4 overflow-hidden relative"></div>`);
}

if (!js.includes('L.map(mapId)')) {
    js = js.replace(/(\}\)\.join\(''\);\s*\n\s*\})/, `}).join('');
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
    }`);
}

fs.writeFileSync('super-admin.js', js, 'utf8');
