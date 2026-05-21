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
          if (id.includes('/src/domains/workspace/components/RelationGraphPanel.tsx')) {
            return 'relation-graph';
          }
          if (
            id.includes('/src/lib/markdownToHtml.ts')
            || id.includes('/node_modules/unified/')
            || id.includes('/node_modules/remark-')
            || id.includes('/node_modules/rehype-')
            || id.includes('/node_modules/micromark')
            || id.includes('/node_modules/mdast-util-')
            || id.includes('/node_modules/hast-util-')
            || id.includes('/node_modules/unist-util-')
            || id.includes('/node_modules/property-information/')
            || id.includes('/node_modules/space-separated-tokens/')
            || id.includes('/node_modules/comma-separated-tokens/')
            || id.includes('/node_modules/ccount/')
            || id.includes('/node_modules/katex/')
          ) {
            return 'vendor-markdown';
          }
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
