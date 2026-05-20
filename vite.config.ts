import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        exportWorker: 'export-worker.html',
      },
      output: {
        manualChunks(id) {
          if (id.includes('/src/domains/export/exportPipeline.ts')) {
            return 'export-pipeline';
          }
          if (id.includes('/node_modules/docx/')) {
            return 'vendor-docx';
          }
          if (id.includes('/node_modules/pdf-lib/')) {
            return 'vendor-pdf';
          }
          if (id.includes('/node_modules/html2canvas/')) {
            return 'vendor-html2canvas';
          }
          return undefined;
        },
      },
    },
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});
