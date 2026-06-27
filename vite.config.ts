import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

const OPTIONAL_ENTRY_PRELOAD_PATTERNS = [
  /assets\/vendor-markdown-[\w-]+\.js$/,
];

export default defineConfig({
  plugins: [wasm(), react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  build: {
    target: 'esnext',
    modulePreload: {
      resolveDependencies(_filename, deps, context) {
        if (context.hostType !== 'html' || !context.hostId.endsWith('index.html')) {
          return deps;
        }
        return deps.filter((dep) => (
          !OPTIONAL_ENTRY_PRELOAD_PATTERNS.some((pattern) => pattern.test(dep))
        ));
      },
    },
    rollupOptions: {
      input: {
        main: 'index.html',
        exportWorker: 'export-worker.html',
      },
      treeshake: {
        moduleSideEffects(id) {
          if (id.includes('/node_modules/js-yaml/')) {
            return false;
          }
          return undefined;
        },
      },
      output: {
        manualChunks(id) {
          if (id.includes('commonjsHelpers')) {
            return 'global';
          }
          if (id.endsWith('.css')) {
            return undefined;
          }
          if (id.includes('/node_modules/js-yaml/')) {
            return 'vendor-yaml';
          }
          if (
            id.includes('/node_modules/unified/')
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
