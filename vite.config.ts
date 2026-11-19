import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => ({
  base: process.env.GITHUB_ACTIONS === 'true' ? '/Simpatik-for-Students/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      includeAssets: [
        'icons/simpatik-for-students.svg',
        'icons/simpatik-for-students-192.png',
        'icons/simpatik-for-students-512.png',
      ],
      workbox: {
        cacheId: 'simpatik-students-ujian-v2',
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2}'],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), '.'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        student: path.resolve(process.cwd(), 'index.html'),
      },
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));
