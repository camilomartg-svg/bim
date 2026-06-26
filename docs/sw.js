const CACHE_NAME = 'portal-bim-alcabama-v9';
// Lista de archivos que queremos guardar en caché para que la app funcione offline.
const urlsToCache = [
  'home.html', // Ruta relativa a la ubicación del Service Worker
  'portal-config.json',
  'portal-configurator.html',
  'portal-configurator.js',
  'project-landing.html',
  'manifest.json',
  'portal.webmanifest',
  'inse.html', 
  'blue_project_plans.html', // Ruta corregida
  'assets/icons/favicon.png',
  'assets/icons/favicon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/portal-bim-favicon.png',
  'assets/icons/portal-bim-192.png',
  'assets/icons/portal-bim-512.png',
  'assets/icons/portal-bim-maskable-512.png',
  'assets/icons/portal-bim-apple-touch.png',
  'https://cdn.tailwindcss.com?plugins=forms,typography',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap',
  'https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@900&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200',
  'https://i.postimg.cc/wMDNvJB5/Portal-BIM-Alcabama-7-1.png',
  'https://i.postimg.cc/mgpPTVwf/Portal-BIM-Alcabama-7-2.png',
  'https://i.postimg.cc/3RNgrPXN/1752525357-ciien-00000-mejora-de-color.png'
];

// Evento de instalación: se abre el caché y se guardan los archivos.
self.addEventListener('install', event => {
  // Forzar al nuevo Service Worker a activarse inmediatamente.
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento de activación: limpia cachés antiguos.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Evento fetch: intercepta las peticiones.
self.addEventListener('fetch', event => {
  // Si la petición es para el modelo IFC o las librerías del visor, ir siempre a la red.
  if (event.request.url.includes('.ifc') || event.request.url.includes('unpkg.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.url.includes('portal-config.json')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Para todo lo demás, usar la estrategia de "cache-first".
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});
