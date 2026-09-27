import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Lezzet Defteri: depodaki diger uygulamalardan TAMAMEN AYRI proje.
// Kendi package.json'i, kendi derlemesi, kendi cikti klasoru (dist/) vardir.
export default defineConfig({
  base: './',
  define: {
    __APP_BUILD__: JSON.stringify(process.env.APP_BUILD || 'dev')
  },
  plugins: [react()]
})
