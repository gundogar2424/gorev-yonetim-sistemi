import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' => hem GitHub Pages alt yolunda hem de dosyadan dogrudan acildiginda calisir
//
// NOT: PWA/servis-iscisi (vite-plugin-pwa) KALDIRILDI. Servis-iscisi onbellegi,
// telefonlarda surekli eski/bozuk kopyalarin takilmasina ve beyaz ekrana yol
// aciyordu. Artik servis-iscisi yok; sayfalar her zaman internetten taze yuklenir.
// Cihazlarda kalmis eski servis-iscileri, HTML'lerdeki temizleyici betikle silinir.
export default defineConfig({
  base: './',
  // Uygulama sürüm/derleme etiketi (Ayarlar'da gösterilir; hangi sürümde
  // olunduğu net görünsün diye). CI'da APP_BUILD ortam değişkeniyle gelir.
  define: {
    __APP_BUILD__: JSON.stringify(process.env.APP_BUILD || 'dev')
  },
  build: {
    rollupOptions: {
      // Iki AYRI uygulama, iki ayri giris sayfasi:
      //  - index.html              -> Saha CRM (degismedi)
      //  - diyet.html / diyetkocu.html -> Diyet Kocu (bagimsiz program)
      //  - stok.html               -> Stok Takip (bagimsiz program)
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        diyet: fileURLToPath(new URL('./diyet.html', import.meta.url)),
        diyetkocu: fileURLToPath(new URL('./diyetkocu.html', import.meta.url)),
        stok: fileURLToPath(new URL('./stok.html', import.meta.url))
      }
    }
  },
  plugins: [react()]
})
