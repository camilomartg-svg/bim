// pwa-helper.js - Centralized PWA registration and installation prompt helper

(function() {
    // 1. Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('ServiceWorker registrado con éxito:', registration.scope);
                })
                .catch(error => {
                    console.log('Fallo en el registro de ServiceWorker:', error);
                });
        });
    }

    // 2. Inject floating banner HTML dynamically
    document.addEventListener('DOMContentLoaded', () => {
        // Create the banner container
        const banner = document.createElement('div');
        banner.id = 'pwa-install-banner';
        // Tailwind classes for beautiful glassmorphism and transition
        banner.className = 'fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 transform translate-y-20 opacity-0 pointer-events-none transition-all duration-500 ease-out';
        
        banner.innerHTML = `
            <div class="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-gray-200/50 dark:border-gray-800/50 shadow-2xl rounded-2xl p-4 flex items-center gap-4">
                <!-- Logo de la App -->
                <div class="w-12 h-12 rounded-xl bg-black flex items-center justify-center flex-shrink-0 shadow-md border border-gray-800">
                    <img src="https://i.postimg.cc/SQ6JTZqj/LOGO-NORA-BLANCO.png" alt="nora BIM" class="w-8 h-auto">
                </div>
                <!-- Texto descriptivo -->
                <div class="flex-grow min-w-0">
                    <h4 class="text-sm font-semibold text-gray-900 dark:text-white truncate">Instalar nora BIM</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Acceso directo en tu pantalla de inicio</p>
                </div>
                <!-- Botón de Instalar y Cerrar -->
                <div class="flex items-center gap-2 flex-shrink-0">
                    <button id="pwa-install-btn" class="bg-black hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-black px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition">
                        Instalar
                    </button>
                    <button id="pwa-close-btn" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 transition flex items-center justify-center">
                        <span class="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(banner);

        // Setup Event Listeners for the injected banner
        let deferredPrompt;
        const installBtn = document.getElementById('pwa-install-btn');
        const closeBtn = document.getElementById('pwa-close-btn');

        // Hook up custom nav/header buttons if they exist
        const navInstallBtns = document.querySelectorAll('.nav-pwa-install-btn');

        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent the default browser install prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            deferredPrompt = e;
            
            // Show any nav/header buttons
            navInstallBtns.forEach(btn => {
                btn.classList.remove('hidden');
                // Ensure it is displayed
                btn.style.display = 'flex';
            });

            // Check session storage before displaying the floating banner
            if (sessionStorage.getItem('pwa-banner-dismissed') !== 'true') {
                showBanner();
            }
        });

        // Setup triggers
        const triggerPrompt = async () => {
            if (!deferredPrompt) return;
            // Show prompt
            deferredPrompt.prompt();
            // Wait for choice
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`PWA installation outcome: ${outcome}`);
            deferredPrompt = null;
            hideBanner();
            hideNavButtons();
        };

        if (installBtn) {
            installBtn.addEventListener('click', triggerPrompt);
        }

        // Setup nav buttons clicks
        navInstallBtns.forEach(btn => {
            btn.addEventListener('click', triggerPrompt);
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                sessionStorage.setItem('pwa-banner-dismissed', 'true');
                hideBanner();
            });
        }

        function showBanner() {
            banner.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
            banner.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
        }

        function hideBanner() {
            banner.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
            banner.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
        }

        function hideNavButtons() {
            navInstallBtns.forEach(btn => {
                btn.classList.add('hidden');
                btn.style.display = 'none';
            });
        }

        window.addEventListener('appinstalled', () => {
            deferredPrompt = null;
            hideBanner();
            hideNavButtons();
            console.log('nora BIM PWA instalada con éxito.');
        });
    });

    // 3. Centralized Traffic & GeoIP Logger
    (async function initTrafficTracker() {
        try {
            const lastTrackTime = sessionStorage.getItem('nora_last_traffic_track');
            const now = Date.now();
            // Throttle duplicate tracking within 10 seconds in same session
            if (lastTrackTime && (now - parseInt(lastTrackTime, 10)) < 10000) {
                return;
            }
            sessionStorage.setItem('nora_last_traffic_track', now.toString());

            let userEmail = 'Anónimo';
            let userRole = 'Visitante';
            try {
                const ua = JSON.parse(sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount') || 'null');
                if (ua) {
                    userEmail = ua.username || ua.email || 'Usuario Registrado';
                    userRole = ua.role || 'MIEMBRO';
                }
            } catch(e) {}

            let geoData = { ip: '181.135.24.102', city: 'Bogotá', region: 'Cundinamarca', country_name: 'Colombia', country_code: 'CO', latitude: 4.6097, longitude: -74.0817 };
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
                clearTimeout(timeoutId);
                if (res.ok) {
                    const data = await res.json();
                    if (data.ip) {
                        geoData = data;
                    }
                }
            } catch(e) {
                try {
                    const res2 = await fetch('https://ip-api.com/json/');
                    if (res2.ok) {
                        const data2 = await res2.json();
                        if (data2.query) {
                            geoData = {
                                ip: data2.query,
                                city: data2.city || 'Bogotá',
                                region: data2.regionName || '',
                                country_name: data2.country || 'Colombia',
                                country_code: data2.countryCode || 'CO',
                                latitude: data2.lat || 4.6,
                                longitude: data2.lon || -74.08
                            };
                        }
                    }
                } catch(e2) {}
            }

            const visitLog = {
                id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                ip: geoData.ip || 'Desconocida',
                city: geoData.city || 'Bogotá',
                region: geoData.region || '',
                country: geoData.country_name || 'Colombia',
                countryCode: geoData.country_code || 'CO',
                latitude: geoData.latitude || 4.6097,
                longitude: geoData.longitude || -74.0817,
                page: window.location.pathname.split('/').pop() || 'index.html',
                pageTitle: document.title || 'nora BIM',
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                userEmail: userEmail,
                userRole: userRole
            };

            const existingLogs = JSON.parse(localStorage.getItem('nora_traffic_logs') || '[]');
            existingLogs.unshift(visitLog);
            if (existingLogs.length > 500) existingLogs.pop();
            localStorage.setItem('nora_traffic_logs', JSON.stringify(existingLogs));

            fetch('https://script.google.com/macros/s/AKfycbx2RAQx_8K4o22xE0Mw-ETc7K_58vIoi6-PgVi64u80inuiw144ks3cgWSdCtXqIgB02g/exec?action=logTraffic', {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(visitLog)
            }).catch(() => {});

        } catch (err) {
            console.warn('Traffic tracking silent notice:', err);
        }
    })();
})();
