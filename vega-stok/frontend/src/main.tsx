import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Katalog } from './Katalog'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Katalog />
  </StrictMode>,
)
