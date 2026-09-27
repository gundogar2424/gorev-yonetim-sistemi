import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import LzApp from './LzApp'
import { initTheme } from './lib/theme'
import './index.css'

initTheme()

// Lezzet Defteri giris noktasi. Beyaz ekrana karsi: render hata verirse mesaj goster.
const rootEl = document.getElementById('root')!
try {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <HashRouter>
        <LzApp />
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
