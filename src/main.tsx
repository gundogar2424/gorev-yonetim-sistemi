import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { ensureSeeded } from './db'

// Ilk acilista il/ilce ve ayar verisini hazirla, sonra uygulamayi baslat
ensureSeeded().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      {/* HashRouter: dosyadan acilista ve GitHub Pages alt yolunda sorunsuz calisir */}
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>
  )
})
