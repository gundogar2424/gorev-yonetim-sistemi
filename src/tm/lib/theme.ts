// Termomiks Defteri tema tercihi (kendi anahtari: 'tm-theme').
// Diyet Kocu'nun 'diet-theme' tercihinden bagimsizdir.
export type ThemePref = 'auto' | 'light' | 'dark'
const KEY = 'tm-theme'

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
  void applyStatusBar(dark)
}

// Android durum cubugunu sayfa zeminine boyar (APK'da tepede beyaz serit kalmasin).
async function applyStatusBar(dark: boolean): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setBackgroundColor({ color: dark ? '#151724' : '#f6f8fa' })
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
