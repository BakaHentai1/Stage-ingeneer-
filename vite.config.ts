import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

// base './' — относительные пути, чтобы сайт работал по адресу
// https://<user>.github.io/<repo>/ независимо от регистра имени репозитория.
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'STAGE ENGINEER',
        short_name: 'Stage Eng',
        description: 'Система технического специалиста сцены: звук, свет, LED, коммутация, учёт техники.',
        lang: 'ru',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0f1317',
        theme_color: '#0f1317',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        // Офлайн нужны только кириллица и латиница; остальные наборы шрифтов грузятся по требованию.
        globIgnores: ['**/*-{greek,greek-ext,vietnamese,latin-ext,cyrillic-ext}-*'],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
} as any);
