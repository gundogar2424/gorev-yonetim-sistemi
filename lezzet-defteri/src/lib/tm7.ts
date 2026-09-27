// THERMOMIX (TM7) UYARLAMASI — Lezzet Defteri'nin kendi kopyasi.
// Termomiks Defteri programinin dosyalarina dokunulmaz; yalnizca onun
// okuyabildigi "tarif kodu" bicimi (JSON) ayni tutulur ki uyarlanan tarif
// oraya da yapistirilabilsin.
import type { LzRecipe } from '../types'

export type TmHiz = '' | 'yumusak' | '0.5' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'turbo'
export type TmMod = '' | 'sote' | 'hamur' | 'buhar' | 'yavas' | 'sousvide' | 'ferment' | 'pirinc' | 'blender' | 'tartim' | 'temizlik'

export interface TmAdim {
  text: string // Ne yapilacak
  ingredients: string // Bu adimda kaba giren malzemeler (gram)
  seconds: number // Sure (0 = suresiz/elle)
  speed: TmHiz
  reverse: boolean // Ters bicak
  temp: string // '' | '37'...'160' | 'varoma'
  mode: TmMod
  tip: string
}

export interface TmSurum {
  ingredients: string[] // Gramla
  steps: TmAdim[]
  warnings: string[]
  category: string
  createdAt: number
}

export const HIZLAR: TmHiz[] = ['', 'yumusak', '0.5', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'turbo']
export const MODLAR: TmMod[] = ['', 'sote', 'hamur', 'buhar', 'yavas', 'sousvide', 'ferment', 'pirinc', 'blender', 'tartim', 'temizlik']
export const SICAKLIKLAR = ['', '37', '50', '60', '70', '80', '90', '95', '100', '110', '120', '130', '140', '150', '160', 'varoma']

// Termomiks Defteri'nin kategori listesiyle ayni (aktarinca dogru rafa dussun)
export const TM_KATEGORILER = [
  'Çorba', 'Et Yemeği', 'Tavuk & Balık', 'Sebze Yemeği', 'Kuru Baklagil', 'Pilav & Makarna', 'Ana Yemek',
  'Meze & Salata', 'Kahvaltılık', 'Börek & Hamur İşi', 'Ekmek & Poğaça', 'Sos & Marinat', 'Turşu & Konserve',
  'Reçel & Marmelat', 'Sütlü Tatlı', 'Şerbetli Tatlı', 'Kek & Kurabiye', 'Pasta', 'Dondurma & Soğuk Tatlı',
  'Tatlı', 'İçecek', 'Bebek Maması', 'Diğer'
]

const MOD_AD: Record<TmMod, string> = {
  '': '',
  sote: 'Sote / kavurma',
  hamur: 'Hamur yoğurma',
  buhar: 'Varoma buhar',
  yavas: 'Yavaş pişirme',
  sousvide: 'Sous-vide',
  ferment: 'Fermente / mayalama',
  pirinc: 'Pirinç modu',
  blender: 'Blender',
  tartim: 'Tartım',
  temizlik: 'Temizlik'
}

export function modAdi(m: TmMod): string {
  return MOD_AD[m] ?? ''
}
export function hizAdi(h: TmHiz): string {
  if (!h) return ''
  if (h === 'yumusak') return 'Yumuşak karıştırma'
  if (h === 'turbo') return 'Turbo'
  return `Devir ${h}`
}
export function sicaklikAdi(t: string): string {
  if (!t) return ''
  return t === 'varoma' ? 'Varoma' : `${t} °C`
}
export function sureAdi(sn: number): string {
  if (!sn || sn <= 0) return ''
  if (sn < 60) return `${sn} sn`
  const s = Math.floor(sn / 3600)
  const d = Math.floor((sn % 3600) / 60)
  const k = sn % 60
  return [s ? `${s} sa` : '', d ? `${d} dk` : '', k ? `${k} sn` : ''].filter(Boolean).join(' ')
}

// "20 sn · 100 °C · devir 2 · ters bıçak"
export function adimOzeti(a: TmAdim): string {
  const b: string[] = []
  if (sureAdi(a.seconds)) b.push(sureAdi(a.seconds))
  if (sicaklikAdi(a.temp)) b.push(sicaklikAdi(a.temp))
  if (a.speed) {
    b.push(hizAdi(a.speed).replace('Devir', 'devir'))
    b.push(a.reverse ? 'ters bıçak' : 'düz bıçak')
  }
  if (a.mode) b.push(modAdi(a.mode))
  return b.join(' · ')
}

// Yapay zekadan gelen ham adimi guvene al (bilinmeyen deger -> bos)
export function adimTemizle(x: Partial<TmAdim>): TmAdim {
  const hiz = String(x.speed ?? '') as TmHiz
  const mod = String(x.mode ?? '') as TmMod
  const sic = String(x.temp ?? '').toLowerCase().replace(/[^0-9a-z]/g, '')
  return {
    text: String(x.text ?? '').trim(),
    ingredients: String(x.ingredients ?? '').trim(),
    seconds: Number.isFinite(Number(x.seconds)) ? Math.max(0, Math.round(Number(x.seconds))) : 0,
    speed: HIZLAR.includes(hiz) ? hiz : '',
    reverse: !!x.reverse,
    temp: SICAKLIKLAR.includes(sic) ? sic : /^\d+$/.test(sic) ? String(Math.min(160, Math.max(37, Number(sic)))) : '',
    mode: MODLAR.includes(mod) ? mod : '',
    tip: String(x.tip ?? '').trim()
  }
}

// Termomiks Defteri'nin "Tarif ekle → kodu yapistir" ekraninin okudugu bicim
export function termomiksKodu(r: LzRecipe): string {
  const tm = r.tm!
  return JSON.stringify(
    {
      title: r.title,
      category: tm.category || 'Diğer',
      servings: r.servings || 0,
      minutes: r.minutes || 0,
      ingredients: tm.ingredients,
      steps: tm.steps,
      notes: r.notes || '',
      warnings: tm.warnings,
      photo: r.photo || '',
      video: /^https:\/\//i.test(r.sourceUrl) && r.platform === 'youtube' ? r.sourceUrl : '',
      source: r.sourceUrl || r.author || 'Lezzet Defteri'
    },
    null,
    1
  )
}
