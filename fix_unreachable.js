const fs = require('fs');

let js = fs.readFileSync('super-admin.js', 'utf8');

// The block that is currently unreachable
const badBlock = `
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
        }, 50);`;

// The fixed block with invalidateSize
const goodBlock = `
      // Map initialization
      setTimeout(() => {
        config.projects.forEach(p => {
          if (window.openProjectAccordions[p.slug]) {
            const mapId = 'map-preview-' + p.slug;
            const mapEl = document.getElementById(mapId);
            if (mapEl && window.L) {
              const lat = p.landing?.map?.lat !== undefined ? parseFloat(p.landing.map.lat) : 4.60971;
              const lng = p.landing?.map?.lng !== undefined ? parseFloat(p.landing.map.lng) : -74.08175;
              const zoom = p.landing?.map?.zoom !== undefined ? parseInt(p.landing.map.zoom) : 15;
              
              if (!mapEl._leaflet_id) {
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
                
                // Fix map not rendering tiles properly in newly visible containers
                setTimeout(() => { map.invalidateSize(); }, 100);
              }
            }
          }
        });
      }, 100);`;

// 1. Remove bad block
js = js.replace(badBlock, '');

// 2. Insert good block right before window.updateProjectDeep = 
const targetStr = "    }).join('');\\n    }\\n  \\n    window.updateProjectDeep =";
const newTargetStr = "    }).join('');\\n" + goodBlock + "\\n    }\\n  \\n    window.updateProjectDeep =";
js = js.replace("    }).join('');\\n    }\\n  \\n  window.updateProjectDeep =", "    }).join('');\\n" + goodBlock + "\\n    }\\n  \\n  window.updateProjectDeep =");

fs.writeFileSync('super-admin.js', js, 'utf8');
