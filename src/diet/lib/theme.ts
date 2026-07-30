// Tema tercihi: Otomatik (telefonun ayarina uyar) / Açık / Koyu.
// <html> uzerine 'dark' sinifi eklenip cikarilir; index.css'teki .dark
// kurallari devreye girer. Tercih cihazda (localStorage) saklanir.

export type ThemePref = 'auto' | 'light' | 'dark'
const KEY = 'diet-theme'

// VARSAYILAN: KOYU. MyFitnessPal'in kontrol paneli koyu temada tasarlandi;
// kartlar/renkler ona gore ayarlandi. Kullanici Ayarlar > Görünüm'den
// Açık ya da Otomatik'e gecebilir; sectigi an localStorage'a yazilir.
export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'auto') return v
  } catch {
    /* yok say */
  }
  return 'dark'
}

// TEK SEFERLIK GECIS: yeni koyu tasarima gecerken, cihazda ESKIDEN kalma bir
// tema tercihi varsa varsayilan degisikligi hic devreye girmiyordu (kayitli
// deger her zaman kazanir) — kullanici koyu temayi hic gormuyordu. Bu yuzden
// bir kereye mahsus 'dark'a cekiyoruz ve bunu bir bayrakla isaretliyoruz.
// Sonrasinda Ayarlar > Görünüm'den ne secilirse o kalir; bir daha dokunulmaz.
const MIGRATED_KEY = 'diet-theme-dark-migrated'
function migrateToDarkOnce(): void {
  try {
    if (localStorage.getItem(MIGRATED_KEY)) return
    localStorage.setItem(MIGRATED_KEY, '1')
    localStorage.setItem(KEY, 'dark')
  } catch {
    /* yok say */
  }
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
  void applyStatusBar(dark)
}

// ANDROID DURUM CUBUGU: koyu temada tepede beyaz bir serit kalmasin diye
// durum cubugunu da sayfa zeminine (#151724) boyar ve saat/pil simgelerini
// beyaza cevirir. Web'de ve eklenti yoksa sessizce atlanir.
async function applyStatusBar(dark: boolean): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setBackgroundColor({ color: dark ? '#151724' : '#f6f8fa' })
    // Style.Dark = koyu zemin + ACIK simgeler; Style.Light = tersi.
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
  } catch {
    /* eklenti yok / desteklenmiyor — gorsel bir eksiklik, hata degil */
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

// Uygulama acilisinda cagrilir: uygula + sistem degisimini dinle (Otomatik'te)
export function initTheme(): void {
  migrateToDarkOnce()
  applyTheme()
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getThemePref() === 'auto') applyTheme()
    })
  } catch {
    /* eski tarayici — dinleyici yok */
  }
}
