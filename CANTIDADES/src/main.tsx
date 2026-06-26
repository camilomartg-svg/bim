import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  let refreshing = false;

  const registerServiceWorker = async () => {
    try {
      const meta = document.querySelector('meta[name="x-app-version"]') as HTMLMetaElement | null;
      const appVersion = meta?.content || '';
      const swUrl = appVersion ? `./sw.js?v=${encodeURIComponent(appVersion)}` : './sw.js';
      const registration = await navigator.serviceWorker.register(swUrl);

      const promptUpdate = () => {
        const waiting = registration.waiting;
        if (!waiting) return;
        waiting.postMessage({ type: 'SKIP_WAITING' });
      };

      if (registration.waiting) promptUpdate();

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            promptUpdate();
          }
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      const recheckRegistration = () => {
        if (!navigator.onLine) return;
        void registration.update();
      };

      window.addEventListener('online', recheckRegistration);
      window.addEventListener('focus', recheckRegistration);
    } catch (error) {
      console.error('No se pudo registrar el service worker de CANTIDADES.', error);
    }
  };

  window.addEventListener('load', () => {
    void registerServiceWorker();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
