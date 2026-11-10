import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const backend = 'http://localhost:4000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // geliştirme sırasında yerel ağdan (telefon / el terminali) erişim
    proxy: { '/api': backend, '/gorseller': backend },
  },
})
