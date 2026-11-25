import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register Service Worker for PWA Offline Caching & Background Sync
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('../sw.js', { scope: '../' })
      .then(reg => {
        if ('sync' in reg) {
          (reg as any).sync.register('nora-sync-issues').catch(() => {});
        }
      })
      .catch(err => {
        console.warn('[PWA] Error registrando Service Worker:', err);
      });
  });
}
