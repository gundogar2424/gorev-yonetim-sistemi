import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base: './' => hem GitHub Pages alt yolunda hem de dosyadan dogrudan acildiginda calisir
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      // Iki AYRI uygulama, iki ayri giris sayfasi:
      //  - index.html  -> Saha CRM (degismedi)
      //  - diyet.html  -> Diyet Kocu (bagimsiz program)
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        diyet: fileURLToPath(new URL('./diyet.html', import.meta.url)),
        // Telefonun onbelleginde eski kopya kalmamasi icin yepyeni giris adresi
        diyetkocu: fileURLToPath(new URL('./diyetkocu.html', import.meta.url))
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Servis-iscisini kendini imha edecek sekilde yayinla: tum cihazlardaki
      // bozuk/eski onbellegi temizler ve kapanir; sayfa hep internetten taze yuklenir.
      selfDestroying: true,
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Saha CRM',
        short_name: 'Saha CRM',
        description: 'Saha satis personeli icin mobil CRM',
        theme_color: '#0f766e',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}']
      }
    })
  ]
})
