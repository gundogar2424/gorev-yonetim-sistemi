import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import DietApp from './DietApp'
import { initTheme } from './lib/theme'
// Tailwind/temel stiller CRM ile ayni dosyadan gelir (CRM'i degistirmez)
import '../index.css'

// Temayi (Otomatik/Açık/Koyu) uygula ve sistem degisimini dinle
initTheme()

// Diyet Kocu: CRM'den TAMAMEN AYRI, kendi giris noktasi olan bagimsiz program.
// Beyaz ekrana karsi: render bir hata verirse kullaniciya mesaj goster.
const rootEl = document.getElementById('root')!
try {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <HashRouter>
        <DietApp />
      </HashRouter>
    </React.StrictMode>
  )
} catch (err) {
  rootEl.innerHTML =
    '<div style="padding:24px;font-family:system-ui,sans-serif;color:#b91c1c">' +
    'Uygulama açılırken bir sorun oluştu. Lütfen sayfayı yenileyin.<br><br>' +
    '<span style="color:#64748b;font-size:13px">Ayrıntı: ' +
    String((err as Error)?.message ?? err) +
    '</span></div>'
}
