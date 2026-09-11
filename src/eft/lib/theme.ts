// EFT Dokunma tema tercihi (kendi anahtari: 'eft-theme').
export type ThemePref = 'auto' | 'light' | 'dark'
const KEY = 'eft-theme'
const BIG_KEY = 'eft-big'

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

export function applyTheme(): void {
  const pref = getThemePref()
  const dark = pref === 'dark' || (pref === 'auto' && systemPrefersDark())
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  root.classList.toggle('eft-big', getBigText())
  void applyStatusBar(dark)
}

// Android durum cubugunu sayfa zeminine boyar.
async function applyStatusBar(dark: boolean): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setBackgroundColor({ color: dark ? '#0f1a1a' : '#f2f8f7' })
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
  } catch {
    /* eklenti yok — gorsel bir eksiklik, hata degil */
  }
}

export function setThemePref(pref: ThemePref): void {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    /* yok say */
  }
  applyTheme()
}

export function getBigText(): boolean {
  try {
    return localStorage.getItem(BIG_KEY) === '1'
  } catch {
    return false
  }
}

export function setBigText(on: boolean): void {
  try {
    localStorage.setItem(BIG_KEY, on ? '1' : '0')
  } catch {
    /* yok say */
  }
  applyTheme()
}

export function initTheme(): void {
  applyTheme()
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getThemePref() === 'auto') applyTheme()
    })
  } catch {
    /* eski tarayici */
  }
}
