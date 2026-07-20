import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'node:path';

/**
 * Vite + Electron ビルド設定
 * - renderer: src/renderer
 * - main/preload: src/main
 */
export default defineConfig({
  root: '.',
  publicDir: 'src/renderer/assets',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@main': path.resolve(__dirname, 'src/main'),
    },
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'src/main/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['sql.js', 'electron', 'electron-updater', 'ws', 'openai'],
            },
          },
          resolve: {
            alias: {
              '@shared': path.resolve(__dirname, 'src/shared'),
              '@main': path.resolve(__dirname, 'src/main'),
            },
          },
        },
      },
      preload: {
        input: 'src/main/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              // パッケージ後の Electron では CJS preload が最も安定
              output: {
                format: 'cjs',
                entryFileNames: '[name].cjs',
                inlineDynamicImports: true,
              },
            },
          },
        },
      },
      renderer: {},
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
