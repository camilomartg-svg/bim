import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// Output to docs/CONVERTIR_FRAG/ so GitHub Pages serves it at norabim.com/CONVERTIR_FRAG/
const outDir = process.env.VITE_OUTDIR ?? path.resolve(__dirname, '../../../docs/CONVERTIR_FRAG');

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir,
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
