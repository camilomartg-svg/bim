import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

// Global error catcher for mobile PWA debugging
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.error('Window Uncaught Error:', event.error || event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
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
