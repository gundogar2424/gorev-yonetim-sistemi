import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const backend = 'http://localhost:4000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // geliştirme sırasında yerel ağdan (telefon / el terminali) erişim
    fs: { allow: ['..'] }, // ../ortak (backend ile paylaşılan teklif hesabı)
    proxy: { '/api': backend, '/gorseller': backend, '/logo': backend },
  },
})
