// Tema tercihi: Otomatik (telefonun ayarina uyar) / Açık / Koyu.
// <html> uzerine 'dark' sinifi eklenip cikarilir; index.css'teki .dark
// kurallari devreye girer. Tercih cihazda (localStorage) saklanir.

export type ThemePref = 'auto' | 'light' | 'dark'
const KEY = 'diet-theme'

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'auto') return v
  } catch {
    /* yok say */
  }
  return 'auto'
}

function systemPrefersDark(): boolean {
  try {
    return !!window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

// Tercihe gore <html>.dark sinifini ayarla
export function applyTheme(): void {
  const pref = getThemePref()
  const dark = pref === 'dark' || (pref === 'auto' && systemPrefersDark())
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
}

export function setThemePref(pref: ThemePref): void {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    /* yok say */
  }
  applyTheme()
}

// Uygulama acilisinda cagrilir: uygula + sistem degisimini dinle (Otomatik'te)
export function initTheme(): void {
  applyTheme()
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getThemePref() === 'auto') applyTheme()
    })
  } catch {
    /* eski tarayici — dinleyici yok */
  }
}
