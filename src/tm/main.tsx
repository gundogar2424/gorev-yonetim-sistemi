import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import TmApp from './TmApp'
import { initTheme } from './lib/theme'
// Tailwind/temel stiller CRM ve Diyet Kocu ile AYNI dosyadan gelir.
// Bu dosya yalnizca OKUNUR; degistirilmez.
import '../index.css'

initTheme()

// Termomiks Defteri: CRM ve Diyet Kocu'ndan TAMAMEN AYRI, kendi giris noktasi
// olan ucuncu bagimsiz program. Beyaz ekrana karsi: render hata verirse mesaj goster.
const rootEl = document.getElementById('root')!
try {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <HashRouter>
        <TmApp />
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
