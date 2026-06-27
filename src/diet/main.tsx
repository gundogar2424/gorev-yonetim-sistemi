import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import DietApp from './DietApp'
// Tailwind/temel stiller CRM ile ayni dosyadan gelir (CRM'i degistirmez)
import '../index.css'

// Diyet Kocu: CRM'den TAMAMEN AYRI, kendi giris noktasi olan bagimsiz program.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <DietApp />
    </HashRouter>
  </React.StrictMode>
)
