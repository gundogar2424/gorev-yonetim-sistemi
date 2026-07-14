import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import StokApp from './StokApp'
import { initTheme } from './lib/theme'
// Tailwind/temel stiller CRM ile aynı dosyadan gelir (CRM'i değiştirmez)
import '../index.css'

initTheme()

// Stok Takip: CRM ve Diyet Koçu'ndan TAMAMEN AYRI, kendi giriş noktası olan program.
const rootEl = document.getElementById('root')!
try {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <HashRouter>
        <StokApp />
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
