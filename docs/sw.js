const CACHE_NAME = 'portal-bim-nora-v36';
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
  'empresas.html',
  'empresas.json',
  
  'assets/icons/favicon.png',
  'assets/icons/favicon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/apple-touch-icon.png',
  'https://i.postimg.cc/W3trgjZX/FAVICON-NORA-NEGRO.png',
  'assets/icons/portal-bim-192.png',
  'assets/icons/portal-bim-512.png',
  'assets/icons/portal-bim-maskable-512.png',
  'assets/icons/portal-bim-apple-touch.png',
  'https://cdn.tailwindcss.com?plugins=forms,typography',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap',
  'https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@900&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200',
  'https://i.postimg.cc/wMDNvJB5/Portal-BIM-Amarillo-7-1.png',
  'https://i.postimg.cc/mgpPTVwf/Portal-BIM-Amarillo-7-2.png',
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
  // Ignorar URLs que no sean http/https (como chrome-extension://)
  if (!event.request.url.startsWith('http')) return;

  // Estrategia Network-First, fallback to Cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clonar la respuesta antes de guardarla en caché
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          // Solo guardar en caché si es una petición GET válida y no es un archivo de super-admin
          const isSuperAdminFile = event.request.url.includes('super-admin');
          if (event.request.method === 'GET' && response.status === 200 && !isSuperAdminFile) {
            cache.put(event.request, responseClone);
          }
        });
        return response;
      })
      .catch(() => {
        // Si falla la red, intentar sacar del caché
        return caches.match(event.request);
      })
  );
});






