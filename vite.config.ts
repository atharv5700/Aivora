import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';


// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  let electron, renderer;
  // Only import electron plugins if we are building for Electron
  if (process.env.ELECTRON_BUILD === 'true') {
    try {
      electron = (await import('vite-plugin-electron')).default;
      renderer = (await import('vite-plugin-electron-renderer')).default;
    } catch (e) {
      console.warn('Could not load electron plugins:', e);
    }
  }

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      // Only use the plugins if they were successfully loaded and we are in Electron build mode
      process.env.ELECTRON_BUILD === 'true' && electron && electron([
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
      process.env.ELECTRON_BUILD === 'true' && renderer && renderer(),
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
