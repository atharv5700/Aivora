import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      process.env.ELECTRON_BUILD === 'true' && electron([
        {
          // Main-Process entry file of the Electron App.
          entry: 'electron/main/index.ts',
          onstart(options) {
            options.startup()
          },
          vite: {
            build: {
              sourcemap: false,
              minify: 'esbuild',
              outDir: 'dist-electron/main',
              rollupOptions: {
                external: ['electron', 'path', 'fs'],
              },
            },
          },
        },
        {
          entry: 'electron/preload/index.ts',
          onstart(options) {
            options.reload()
          },
          vite: {
            build: {
              sourcemap: false,
              minify: 'esbuild',
              outDir: 'dist-electron/preload',
              rollupOptions: {
                external: ['electron', 'path', 'fs'],
              },
            },
          },
        },
      ]),
      process.env.ELECTRON_BUILD === 'true' && renderer(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'Aivora AI',
          short_name: 'Aivora',
          description: 'Advanced AI Chat Application',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    // Vite automatically exposes env vars prefixed with VITE_ 
    // Users can access them via import.meta.env.VITE_*
    envPrefix: 'VITE_',
  };
});
