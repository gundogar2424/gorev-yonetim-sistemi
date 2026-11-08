// THERMOMIX (TM7) UYARLAMASI — Lezzet Defteri'nin kendi kopyasi.
// Termomiks Defteri programinin dosyalarina dokunulmaz; yalnizca onun
// okuyabildigi "tarif kodu" bicimi (JSON) ayni tutulur ki uyarlanan tarif
// oraya da yapistirilabilsin.
import type { LzRecipe } from '../types'

export type TmHiz = '' | 'yumusak' | '0.5' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'turbo'
export type TmMod = '' | 'sote' | 'karamel' | 'hamur' | 'buhar' | 'yavas' | 'sousvide' | 'ferment' | 'pirinc' | 'blender' | 'tartim' | 'temizlik'

export interface TmAdim {
  text: string // Ne yapilacak
  ingredients: string // Bu adimda kaba giren malzemeler (gram)
  seconds: number // Sure (0 = suresiz/elle)
  speed: TmHiz
  reverse: boolean // Ters bicak
  temp: string // '' | '37'...'160' | 'varoma'
  mode: TmMod
  tip: string
  kelebek?: boolean // Kelebek (cirpma) aksesuari takili: en fazla devir 4
}

export interface TmSurum {
  ingredients: string[] // Gramla
  steps: TmAdim[]
  warnings: string[]
  category: string
  createdAt: number
  referans?: string // Uyarlamada ornek alinan resmi Thermomix (Cookidoo) tarifi; yoksa bos
}

export const HIZLAR: TmHiz[] = ['', 'yumusak', '0.5', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'turbo']
export const MODLAR: TmMod[] = ['', 'sote', 'karamel', 'hamur', 'buhar', 'yavas', 'sousvide', 'ferment', 'pirinc', 'blender', 'tartim', 'temizlik']
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
  karamel: 'Karamelize',
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
  let hiz = String(x.speed ?? '').trim().toLowerCase().replace(',', '.') as TmHiz
  // "4.5", "7,5" gibi ara devirler en yakin tam devire yuvarlanir (bos kalirsa isitma adimi calismaz)
  if (!HIZLAR.includes(hiz)) {
    const n = Number(hiz)
    hiz = Number.isFinite(n) && n > 0 ? (String(Math.min(10, Math.max(1, Math.round(n)))) as TmHiz) : n === 0 ? '' : /yum|soft|gentle/i.test(hiz) ? 'yumusak' : ''
  }
  const mod = String(x.mode ?? '').trim().toLowerCase() as TmMod
  const sic = String(x.temp ?? '').toLowerCase().replace(/[^0-9a-z]/g, '')
  const text = String(x.text ?? '').trim()
  const tip = String(x.tip ?? '').trim()
  return {
    text,
    ingredients: String(x.ingredients ?? '').trim(),
    seconds: Number.isFinite(Number(x.seconds)) ? Math.max(0, Math.round(Number(x.seconds))) : 0,
    speed: HIZLAR.includes(hiz) ? hiz : '',
    reverse: !!x.reverse,
    temp: SICAKLIKLAR.includes(sic) ? sic : /^\d+$/.test(sic) ? String(Math.min(160, Math.max(37, Number(sic)))) : '',
    mode: MODLAR.includes(mod) ? mod : '',
    tip,
    kelebek: !!x.kelebek || /kelebe[kğ]/i.test(`${text} ${tip}`)
  }
}

// Pisirme ekranindaki ayar kutulari (uygulama ve paylasilan HTML ayni kaynagi kullanir)
export function adimKutulari(a: TmAdim): [string, string][] {
  return (
    [
      ['Süre', sureAdi(a.seconds)],
      ['Sıcaklık', sicaklikAdi(a.temp)],
      ['Devir', a.speed === 'yumusak' ? 'Yumuşak' : a.speed === 'turbo' ? 'Turbo' : a.speed ? a.speed : ''],
      ['Yön', a.speed && a.speed !== 'turbo' ? (a.reverse ? '⟲ Ters' : '⟳ Düz') : ''],
      ['Aksesuar', a.kelebek ? 'Kelebek' : '']
    ] as [string, string][]
  ).filter((k) => k[1])
}

// Adimda cihaz calisiyor mu (ayar var) yoksa elle mi yapiliyor
export function cihazAdimi(a: TmAdim): boolean {
  return !!(a.speed || a.temp || a.mode)
}

// "1000 g süt" gibi satirlardan gram toplami (adet/tutam gibi gramsizlar sayilmaz)
export function gramToplami(satirlar: string[]): number {
  let t = 0
  for (const s of satirlar) {
    const m = s.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(kg|g|gr|gram|ml|l)\b/i)
    if (!m) continue
    const n = Number(m[1])
    t += /^(kg|l)$/i.test(m[2]) ? n * 1000 : n
  }
  return Math.round(t)
}
function malzemeGrami(metin: string, ad: RegExp): number {
  // "1000 g süt", "süt 1000 g" ya da "1 litre süt"
  let top = 0
  for (const p of metin.split(/[,;+\n]| ve /)) {
    if (!ad.test(p)) continue
    const m = p.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(kg|g|gr|gram|ml|l|litre)\b/i)
    if (m) top += /^(kg|l|litre)$/i.test(m[2]) ? Number(m[1]) * 1000 : Number(m[1])
  }
  return top
}

// Termomiks Defteri'nin "Tarif ekle → kodu yapistir" ekraninin okudugu bicim
export function termomiksKodu(r: LzRecipe): string {
  const tm = tmSurumDenetle(r.tm!)
  return JSON.stringify(
    {
      title: r.title,
      category: tm.category || 'Diğer',
      servings: r.servings || 0,
      minutes: r.minutes || 0,
      ingredients: tm.ingredients,
      // Termomiks Defteri'nde Karamelize modu yok: kavurma (sote) olarak aktarilir, metinde belirtilir
      steps: tm.steps.map((a) => {
        const { kelebek, ...b } = a
        // Termomiks Defteri'nde kelebek alani yok: metne yazilir
        const t = kelebek && !/kelebe[kğ]/i.test(b.text) ? `Kelebeği tak. ${b.text}` : b.text
        return b.mode === 'karamel'
          ? { ...b, mode: 'sote', temp: b.temp || '160', text: /karamel/i.test(t) ? t : `Karamelize: ${t}` }
          : { ...b, text: t }
      }),
      notes: r.notes || '',
      warnings: tm.warnings,
      photo: r.photo || '',
      video: /^https:\/\//i.test(r.sourceUrl) && r.platform === 'youtube' ? r.sourceUrl : '',
      source: r.sourceUrl || r.author || 'Lezzet Rotası'
    },
    null,
    1
  )
}

// TM7 GUVENLIK KONTROLU: yapay zeka kurala aykiri ayar uretirse duzeltir (Vorwerk kurallari).
// Hem yeni uyarlamada hem eski kayitlar gosterilirken uygulanir; ayni adima iki kez uygulanmasi sonucu degistirmez.
const PEYNIRLI = /labne|mascarpone|maskarpone|krem ?peynir|süzme yoğurt|suzme yogurt|lor\b/i
const SUTLU_KREMA = /süt|sut|krema/i
export function tmKuralDenetle(a: TmAdim): TmAdim {
  const x = { ...a }
  const derece = /^\d+$/.test(x.temp) ? Number(x.temp) : x.temp === 'varoma' ? 120 : 0
  const ekle = (t: string) => {
    if (!x.tip.toLocaleLowerCase('tr').includes(t.slice(0, 14).toLocaleLowerCase('tr'))) x.tip = x.tip ? `${x.tip} ${t}` : t
  }
  const metin = `${x.text} ${x.ingredients}`
  // 1) 120 °C ustu yalnizca Kavurma/Karamelize; sonra modlara ozgu zorunlu ayarlar
  if (derece > 120 && x.mode !== 'sote' && x.mode !== 'karamel') x.mode = 'sote'
  if (x.mode === 'hamur') {
    x.speed = ''
    x.temp = ''
    x.reverse = false
  }
  if (x.mode === 'buhar') {
    x.temp = 'varoma'
    if (!x.speed || !['yumusak', '0.5', '1', '2'].includes(x.speed)) x.speed = '1'
  }
  if (x.mode === 'sote' || x.mode === 'karamel') {
    // Kavurma: ters bicak + dusuk devir (parcalar dagilmasin, dibi tutmasin)
    x.reverse = true
    if (x.speed && !['yumusak', '0.5', '1', '2'].includes(x.speed)) x.speed = '1'
    if (!x.speed) x.speed = 'yumusak'
  }
  // 2) Isitma icin devir sart: devir bos kalirsa cihaz isitmaz
  if (x.temp && !x.speed && !x.mode) {
    x.speed = 'yumusak'
    x.reverse = true
  }
  // 3) Turbo: yalnizca soguk ve 2 sn'ye kadar darbe
  if (x.speed === 'turbo') {
    if (derece >= 60) {
      x.speed = '10'
      ekle('Turbo sıcakta çalışmaz; hızı kademeli 10’a çıkar.')
    } else if (x.seconds > 3) {
      ekle(`Turbo’yu ${Math.min(5, Math.ceil(x.seconds / 2))} kez 1–2 sn darbe olarak uygula.`)
      x.seconds = 2
    }
  }
  // 4) Kelebek: en fazla devir 4, turbo yok
  if (x.kelebek) {
    const h = Number(x.speed)
    if (x.speed === 'turbo' || h > 4) {
      x.speed = '4'
      ekle('Kelebek takılıyken en fazla devir 4.')
    }
  }
  // 5) Sicakta yuksek devir: olcu kabi + kademeli
  const hiz = Number(x.speed)
  if (derece >= 60 && hiz >= 7) ekle('Sıcak: hızı kademeli artır, ölçü kabı takılı olsun.')
  else if (derece >= 60 && hiz >= 5) ekle('Sıcak sıvı: ölçü kabı takılı olsun.')
  // 6) Peynirli kremalar (labne, mascarpone…): isitmadan, kisa ve dusuk devir — yoksa sulanir
  if (!x.temp && PEYNIRLI.test(metin) && x.speed && x.speed !== 'yumusak') {
    if (hiz > 4) x.speed = x.kelebek ? '3' : '3'
    if (!x.kelebek) x.reverse = true
    if (x.seconds > 45) x.seconds = 40
    ekle('Labne/mascarpone fazla karıştırılırsa sulanır; karışır karışmaz durdur.')
  }
  // 7) Sutlu/nisastali krema pisirme: TM once isitir; sut miktarina gore sure
  if (derece >= 80 && derece <= 100 && x.mode === '' && SUTLU_KREMA.test(x.ingredients) && /un|nişasta|nisasta|irmik|pirinç unu|puding|muhallebi|krema/i.test(metin)) {
    const sut = malzemeGrami(x.ingredients, SUTLU_KREMA)
    const enAz = sut >= 900 ? 840 : sut >= 650 ? 660 : sut >= 400 ? 480 : 0
    if (enAz && x.seconds > 0 && x.seconds < enAz) {
      x.seconds = enAz
      ekle(`${Math.round(sut)} g süt için en az ${enAz / 60} dk gerekir (cihaz önce ısıtır).`)
    }
    if (x.seconds >= 300) ekle('Koyulaşmadıysa 1–2 dk daha pişir; koyulaşınca hemen durdur.')
  }
  return x
}

// Tum surumu denetler: adimlar + kapasite ve gram uyarilari (eksikse eklenir)
export function tmSurumDenetle(tm: TmSurum): TmSurum {
  const steps = tm.steps.map(tmKuralDenetle)
  const uyarilar = [...tm.warnings]
  const var_ = (k: string) => uyarilar.some((u) => u.toLocaleLowerCase('tr').includes(k))
  const toplam = gramToplami(tm.ingredients)
  const isitiliyor = steps.some((a) => a.temp)
  if (toplam > 2000 && isitiliyor && !var_('2 l') && !var_('böl')) {
    uyarilar.unshift(`Malzemeler toplam ~${(toplam / 1000).toFixed(1).replace('.', ',')} kg: ısıtılan tarifte hazneye en fazla 2 L konur. Kremayı/çorbayı iki partide pişir.`)
  } else if (toplam > 2200 && !var_('2,2') && !var_('böl')) {
    uyarilar.unshift(`Malzemeler toplam ~${(toplam / 1000).toFixed(1).replace('.', ',')} kg; hazne 2,2 L. İki partide yap.`)
  }
  return { ...tm, steps, warnings: uyarilar }
}

// COOKIDOO METNI: Vorwerk'in kendi uygulamasina (Cookidoo → "Oluşturduğum tarifler") elle girilirken
// kopyala-yapistir icin, Cookidoo'nun yazim bicimiyle ("14 dk/90°C/hız 4") duz metin.
export function cookidooMetni(r: LzRecipe): string {
  const tm = tmSurumDenetle(r.tm!)
  const ayar = (a: TmAdim): string => {
    if (!cihazAdimi(a)) return ''
    if (a.mode === 'hamur') return `${sureAdi(a.seconds)}/Hamur modu`
    const p: string[] = []
    if (a.seconds) p.push(sureAdi(a.seconds).replace(' ', ' '))
    if (a.temp) p.push(a.temp === 'varoma' ? 'Varoma' : `${a.temp}°C`)
    if (a.speed) p.push(a.speed === 'yumusak' ? 'yumuşak karıştırma' : a.speed === 'turbo' ? 'Turbo' : `hız ${a.speed}`)
    let t = p.join('/')
    if (a.reverse && a.speed) t += ' (ters yön)'
    if (a.mode) t += ` [${modAdi(a.mode)}]`
    return t
  }
  const adimlar = tm.steps.map((a, i) => {
    const on = [a.kelebek ? 'Kelebeği tak.' : '', a.ingredients ? `${a.ingredients} hazneye ekle.` : ''].filter(Boolean).join(' ')
    const s = ayar(a)
    return `${i + 1}. ${[on, a.text.replace(/\.?$/, '.'), s ? `→ ${s}` : '', a.tip ? `(${a.tip})` : ''].filter(Boolean).join(' ')}`
  })
  return [
    r.title,
    [r.servings ? `${r.servings} porsiyon` : '', r.minutes ? `~${r.minutes} dk` : '', tm.category].filter(Boolean).join(' · '),
    '',
    'MALZEMELER',
    ...tm.ingredients.map((m) => `- ${m}`),
    '',
    'HAZIRLANIŞI',
    ...adimlar,
    tm.warnings.length ? '' : '',
    ...tm.warnings.map((w) => `Not: ${w}`),
    tm.referans ? `Referans: ${tm.referans}` : '',
    r.sourceUrl ? `Kaynak: ${r.sourceUrl}` : ''
  ]
    .filter((x, i, arr) => !(x === '' && arr[i - 1] === ''))
    .join('\n')
}

// Cookidoo'nun ayri alanlari icin parcalar: malzemeler (satir satir), adimlar (satir satir, numarasiz), ipuclari
export function cookidooParcalari(r: LzRecipe): { malzemeler: string; adimlar: string; ipuclari: string } {
  const metin = cookidooMetni(r)
  const b = metin.split('\n')
  const kes = (bas: string, son: string) => {
    const i = b.indexOf(bas)
    if (i < 0) return []
    const j = son ? b.indexOf(son, i + 1) : b.length
    return b.slice(i + 1, j < 0 ? b.length : j).filter(Boolean)
  }
  const malzemeler = kes('MALZEMELER', 'HAZIRLANIŞI').map((x) => x.replace(/^- /, ''))
  const adimlar = kes('HAZIRLANIŞI', '').filter((x) => /^\d+\. /.test(x)).map((x) => x.replace(/^\d+\. /, ''))
  const ipuclari = b.filter((x) => /^(Not|Referans|Kaynak): /.test(x))
  return { malzemeler: malzemeler.join('\n'), adimlar: adimlar.join('\n'), ipuclari: ipuclari.join('\n') }
}
