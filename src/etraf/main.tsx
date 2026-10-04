import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import EtApp from './EtApp'
import { initTheme } from './lib/theme'
// Tailwind/temel stiller diger programlarla AYNI dosyadan gelir (yalnizca okunur).
import '../index.css'

initTheme()

// Etrafimda: diger programlardan TAMAMEN AYRI, kendi giris noktasi olan
// yedinci bagimsiz program (yakindaki yeme-icme / kultur / gezi yerleri).
const rootEl = document.getElementById('root')!
try {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <HashRouter>
        <EtApp />
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
