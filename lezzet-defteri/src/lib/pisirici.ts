// PILAV PISIRICI: Instant Pot MRRC2001WE (20-Cup Multigrain Rice Cooker + Steamer, 5 L, 860 W)
// Bu cihazda Cake, Pressure Cook, Air Fry ve derin kizartma YOKTUR. Burada yalnizca gercek modlar var;
// yapay zeka baska bir sey uydursa bile kural denetimi duzeltir.
import { gramToplami } from './tm7'

export type PpMod = '' | 'whiteRice' | 'brownRice' | 'carbReduce' | 'mixedGrains' | 'quinoa' | 'steam' | 'slowCook' | 'saute' | 'keepWarm'
export type PpKeepWarm = '' | 'acik' | 'kapali' | 'low' | 'high'

export interface PpAdim {
  text: string // ne yapilacak
  ingredients: string // bu adimda hazneye giren malzemeler
  mod: PpMod // '' = cihaz disi adim (dogrma, kaliba dokme, sogutma…)
  dakika: number // sure; pirinc modlarinda 0 (cihaz kendisi bitirir)
  kapak: '' | 'acik' | 'kapali'
  sepet: boolean // buhar sepeti takili
  su: string // Steam'de haznenin dibine konan su ("1 bardak")
  keepWarm: PpKeepWarm
  butonlar: string // "Menu Select ile Slow Cook seç, + / - ile 1 sa 30 dk yap, Start'a bas"
  tip: string
  bitince?: string // cihaz bitince ne yapilacak (Cancel, kapagi acma…); kural denetimi doldurur
}

export interface PpSurum {
  ingredients: string[]
  steps: PpAdim[]
  warnings: string[]
  uygun: boolean // false: bu tarif bu cihazda yapilamaz (derin kizartma vb.)
  cihaz: string
  createdAt: number
  alternatif?: { baslik: string; adimlar: string[] } // kek/brownie icin 2. secenek (kalipla Steam)
}

export const PP_CIHAZLAR = [{ id: 'mrrc2001we', ad: 'Instant Pot MRRC2001WE (20-Cup Multigrain Rice Cooker + Steamer, 5 L, 860 W)' }] as const
const KEY_CIHAZ = 'lz-pilav-pisirici'
export function ppCihaz(): string {
  try {
    return localStorage.getItem(KEY_CIHAZ) || 'mrrc2001we'
  } catch {
    return 'mrrc2001we'
  }
}
export function ppCihazKaydet(v: string): void {
  try {
    localStorage.setItem(KEY_CIHAZ, v)
  } catch {
    /* yok */
  }
}
export function ppAcik(): boolean {
  return ppCihaz() !== 'yok'
}

export const PP_MODLAR: PpMod[] = ['', 'whiteRice', 'brownRice', 'carbReduce', 'mixedGrains', 'quinoa', 'steam', 'slowCook', 'saute', 'keepWarm']
const MOD_AD: Record<PpMod, string> = {
  '': '',
  whiteRice: 'White Rice',
  brownRice: 'Brown Rice',
  carbReduce: 'CarbReduce',
  mixedGrains: 'Mixed Grains',
  quinoa: 'Quinoa',
  steam: 'Steam',
  slowCook: 'Slow Cook',
  saute: 'Sauté',
  keepWarm: 'Keep Warm'
}
export function ppModAdi(m: PpMod): string {
  return MOD_AD[m] ?? ''
}
const PIRINC: PpMod[] = ['whiteRice', 'brownRice', 'mixedGrains', 'quinoa']

// Cihaz kilavuzu (yapay zeka istemine de aynen girer)
export const PP_KILAVUZ = [
  'White Rice: 1 bardak pirince 1.5 bardak su, kapak kapalı, bitince kendiliğinden Keep Warm’e geçer.',
  'Brown Rice: 1 bardak pirince 1.2 bardak su, kapak kapalı.',
  'CarbReduce: 40 dakika. Sepetin altına (hazneye) 2 bardak su, pirinç sepetin içinde.',
  'Mixed Grains: 1 bardağa 1.2 bardak su.',
  'Quinoa: 1 bardağa 1.5 bardak su.',
  'Steam: varsayılan 10 dakika, 5 dakika ile 1 saat arası; sepet + en az yarım bardak su şart.',
  'Slow Cook: varsayılan 6 saat, 30 dakika ile 24 saat arası; Keep Warm varsayılan AÇIK. Bitince hemen Cancel.',
  'Sauté: varsayılan 30 dakika, 1 ile 30 dakika arası; kapak AÇIK; Keep Warm varsayılan KAPALI. Kendi durmaz, bitince Cancel.',
  'Keep Warm: Low ya da High (ısıtma/sıcak tutma).',
  'Düğmeler: Menu Select (mod seçimi), + / - (süre), Start, Cancel. Time düğmesi YOK.',
  'MAX çizgisi: toplam 2,5 kg’ı geçme (hazne MAX çizgisine kadar yaklaşık 2,8 litre).',
  'YOK: Cake, Pressure Cook, Air Fry, derin kızartma, Time düğmesi. Bunları asla yazma.'
]

export function sureYazi(dk: number): string {
  if (!dk) return ''
  const s = Math.floor(dk / 60)
  const d = dk % 60
  return [s ? `${s} sa` : '', d ? `${d} dk` : ''].filter(Boolean).join(' ')
}

export function ppAdimOzeti(a: PpAdim): string {
  if (!a.mod) return ''
  const b = [ppModAdi(a.mod)]
  if (a.dakika) b.push(sureYazi(a.dakika))
  if (a.kapak) b.push(a.kapak === 'acik' ? 'kapak açık' : 'kapak kapalı')
  if (a.sepet) b.push('sepet')
  if (a.su) b.push(`${a.su} su`)
  if (a.keepWarm === 'low' || a.keepWarm === 'high') b.push(`Keep Warm ${a.keepWarm === 'low' ? 'Low' : 'High'}`)
  else if (a.keepWarm) b.push(`Keep Warm ${a.keepWarm === 'acik' ? 'açık' : 'kapalı'}`)
  return b.join(' · ')
}

// Yapay zekadan gelen ham adimi guvene al: bilinmeyen mod (Cake, Pressure Cook…) asagidaki kurallarla duzeltilir
export function ppAdimTemizle(x: Partial<PpAdim> & { mod?: string }): PpAdim & { hamMod: string } {
  const ham = String(x.mod ?? '').trim()
  const k = ham.toLowerCase().replace(/[\s_-]/g, '')
  const eslesme: Record<string, PpMod> = {
    whiterice: 'whiteRice', brownrice: 'brownRice', carbreduce: 'carbReduce', mixedgrains: 'mixedGrains', quinoa: 'quinoa',
    steam: 'steam', slowcook: 'slowCook', saute: 'saute', sauté: 'saute', keepwarm: 'keepWarm'
  }
  return {
    text: String(x.text ?? '').trim(),
    ingredients: String(x.ingredients ?? '').trim(),
    mod: eslesme[k] ?? '',
    hamMod: k,
    dakika: Math.max(0, Math.round(Number(x.dakika) || 0)),
    kapak: x.kapak === 'acik' || x.kapak === 'kapali' ? x.kapak : '',
    sepet: !!x.sepet,
    su: String(x.su ?? '').trim(),
    keepWarm: (['acik', 'kapali', 'low', 'high'] as const).includes(x.keepWarm as 'acik') ? (x.keepWarm as PpKeepWarm) : '',
    butonlar: String(x.butonlar ?? '').trim(),
    tip: String(x.tip ?? '').trim()
  }
}

const sade = (s: string) => s.toLocaleLowerCase('tr')
const KEK = /\b(kek|keki|brownie|cake|muffin|cheesecake|pandispanya|fırın tatlı|revani|islak kek|ıslak kek|browni)/
const DERIN = /(derin yağ|bol yağda|kızgın yağda|kızartma yağında|deep fry|derin kızart|yağda kızart)/
const CITIR = /(çıtır|fırında kızar|fırında altı kızar|gratin|üstü kızar)/
const ERIT = /(erit|eriyene)/
const FIRIN = /fırın/
const SEBZE = /(sebze|patates|kabak|patlıcan|biber|havuç|brokoli|karnabahar|mantar|domates|soğan|bezelye|fasulye)/

function butonMetni(a: PpAdim): string {
  const s = sureYazi(a.dakika)
  const sure = s ? `, + / - ile ${s} yap` : ''
  switch (a.mod) {
    case 'saute':
      return `Kapağı açık bırak. Menu Select ile Sauté seç${sure}, Start’a bas.`
    case 'steam':
      return `Hazneye ${a.su || 'en az yarım bardak'} su koy, buhar sepetini yerleştir, kapağı kapat. Menu Select ile Steam seç${sure}, Start’a bas.`
    case 'slowCook':
      return `Kapağı kapat. Menu Select ile Slow Cook seç${sure}, Start’a bas.`
    case 'carbReduce':
      return `Hazneye (sepetin altına) ${a.su || '2 bardak'} su koy, pirinci sepete koy, sepeti yerleştir, kapağı kapat. Menu Select ile CarbReduce seç, Start’a bas (40 dk).`
    case 'keepWarm':
      return `Menu Select ile Keep Warm ${a.keepWarm === 'high' ? 'High' : 'Low'} seç, Start’a bas.`
    case '':
      return ''
    default:
      return `Kapağı kapat. Menu Select ile ${ppModAdi(a.mod)} seç, Start’a bas.`
  }
}

// Cihaz bitince yapilacak: kullanici Keep Warm'de unutmasin
function bitinceMetni(a: PpAdim): string {
  switch (a.mod) {
    case 'saute':
      return 'Sauté 30 dk varsayılanla çalışır, kendi durmaz: süre dolunca ya da iş bitince Cancel’a bas.'
    case 'slowCook':
      return 'Bitince hemen Cancel’a bas, Keep Warm’de bırakma.'
    case 'steam':
      return 'Bitince Cancel’a bas; sepeti çıkarırken buhara dikkat et.'
    case 'whiteRice':
    case 'brownRice':
    case 'mixedGrains':
    case 'quinoa':
      return 'END yazınca kapağı 10 dakika açma, sonra Cancel’a bas. Keep Warm’de bırakma.'
    case 'carbReduce':
      return 'Bitince hemen Cancel’a bas, Keep Warm’de bırakma.'
    default:
      return ''
  }
}

// Kek/brownie icin 2. secenek: kalipla Steam (hamur az olsa da duzgun pisirir)
export const KALIP_STEAM = {
  baslik: 'Seçenek 2: Kalıpla Steam, 35–40 dk',
  adimlar: [
    'Hamuru hazneye sığan, ısıya dayanıklı bir kalıba dök. Kalıbın üstünü folyo ile kapat, buhar damlamasın.',
    'Hazneye 2 bardak su koy, buhar sepetini yerleştir, kalıbı sepete koy, kapağı kapat.',
    'Menu Select ile Steam seç, + / - ile 40 dk yap, Start’a bas.',
    '35. dakikada kürdanla kontrol et; hafif nemli kırıntı kalıyorsa tamamdır. Bitince Cancel’a bas.'
  ]
}

// KURAL DENETIMI: cihazin gercek sinirlari ve kullanicinin donusum kurallari
export function ppDenetle(pp: PpSurum, tarif: { title: string; tags?: string[]; steps?: string[] }, hamModlar: string[] = []): PpSurum {
  const uyari = new Set(pp.warnings.filter(Boolean))
  const tumMetin = sade([tarif.title, ...(tarif.tags ?? []), ...(tarif.steps ?? []), ...pp.steps.map((a) => a.text)].join(' '))
  const kek = KEK.test(sade(`${tarif.title} ${(tarif.tags ?? []).join(' ')}`))
  let uygun = pp.uygun

  const steps = pp.steps.map((a0, i) => {
    const a = { ...a0 }
    // Bu makinede Time dugmesi yok: yapay zeka yazdiysa "+ / -" yap
    const timeYok = (x: string) => x.replace(/\bTime\s*(düğmesi(yle)?\s*)?(ile)?/g, '+ / - ile ').replace(/\s{2,}/g, ' ')
    a.text = timeYok(a.text)
    a.tip = timeYok(a.tip)
    const ham = hamModlar[i] ?? ''
    const t = sade(`${a.text} ${a.ingredients}`)
    // Cake / Pressure Cook / Bake gibi olmayan modlar: Slow Cook
    if (!a.mod && /cake|bake|pressure|airfry|fırın/.test(ham)) a.mod = 'slowCook'
    // Eritme: White Rice ile asla; Sauté, kapak acik, 2-3 dk, surekli karistir
    if (ERIT.test(t) && a.mod && a.mod !== 'saute' && a.mod !== 'keepWarm') {
      a.mod = 'saute'
      a.dakika = 3
    }
    if (ERIT.test(t) && a.mod === 'saute') {
      a.dakika = Math.min(3, Math.max(2, a.dakika || 3))
      if (!/karıştır/i.test(a.tip)) a.tip = [a.tip, 'Sürekli karıştır; eriyince hemen Cancel’a bas.'].filter(Boolean).join(' ')
    }
    // Kek / brownie / firin tatlisi: White Rice (ve diger pirinc modlari) yasak -> Slow Cook 1 sa 30 dk
    if (kek && (PIRINC.includes(a.mod) || (a.mod === 'slowCook' && !ERIT.test(t)))) {
      if (PIRINC.includes(a.mod) || a.dakika !== 90) {
        a.mod = 'slowCook'
        a.dakika = 90
      }
      if (!/kürdan/i.test(a.tip)) a.tip = [a.tip, '1 saatte kürdanla kontrol et; üzerinde hafif nemli kırıntı kalıyorsa tamamdır.'].filter(Boolean).join(' ')
    }
    // Firin donusumu: firin 200 °C sebze -> Steam 10-15 dk (kek ustte Slow Cook'a cevrildi)
    if (!kek && FIRIN.test(t) && (SEBZE.test(t) || /200/.test(t)) && a.mod !== 'saute') {
      a.mod = 'steam'
      a.dakika = Math.min(15, Math.max(10, a.dakika || 15))
      if (!/kontrol/i.test(a.tip)) a.tip = [a.tip, 'Fırın yerine buhar: 10. dakikada çatalla kontrol et.'].filter(Boolean).join(' ')
    }
    // Mod sinirlari
    if (a.mod === 'saute') {
      a.kapak = 'acik'
      if (!a.keepWarm) a.keepWarm = 'kapali'
      a.dakika = Math.min(30, Math.max(1, a.dakika || 30))
    }
    if (a.mod === 'steam') {
      a.sepet = true
      a.kapak = 'kapali'
      if (!a.su) a.su = '1 bardak'
      a.dakika = Math.min(60, Math.max(5, a.dakika || 10))
    }
    if (a.mod === 'slowCook') {
      a.kapak = 'kapali'
      // Cihaz bitince Keep Warm'e gecer; biz Cancel dedirdigimiz icin "Keep Warm acik" rozeti gosterilmez
      if (a.keepWarm === 'acik') a.keepWarm = ''
      a.dakika = Math.min(24 * 60, Math.max(30, a.dakika || 360))
    }
    if (a.mod === 'carbReduce') {
      a.sepet = true
      if (!a.su) a.su = '2 bardak'
      a.kapak = 'kapali'
      a.dakika = 40
    }
    if (PIRINC.includes(a.mod)) {
      a.kapak = 'kapali'
      a.dakika = 0
    }
    if (a.mod === 'keepWarm' && a.keepWarm !== 'high') a.keepWarm = 'low'
    if (!a.mod) {
      a.kapak = ''
      a.dakika = 0
    }
    a.butonlar = butonMetni(a)
    a.bitince = bitinceMetni(a)
    return a
  })

  if (DERIN.test(tumMetin)) {
    uygun = false
    uyari.add('Bu pişiricide olmaz: tarif derin (bol yağda) kızartma istiyor; bu cihazda kızartma modu yok.')
  }
  if (CITIR.test(tumMetin)) uyari.add('Aynı çıtırlık olmaz, nemli olur: bu cihazda fırın ya da air fry yok.')
  if (kek) uyari.add('Kek/brownie White Rice’ta pişmez (hamur susuz olduğu için erken Keep Warm’e geçer, altı yanar). İki seçenek var: Slow Cook 1 sa 30 dk ya da kalıpla Steam 35–40 dk.')
  const gram = gramToplami(pp.ingredients)
  // Hamur (kek, brownie) 1 litreden azsa hazne genis kalir, ince olur ve kurur
  if (kek && gram > 0 && gram < 1000) uyari.add('Hazneye göre az: hamur ince yayılıp kurur. Miktarları 2 katına çıkar ya da 2. seçenekteki gibi kalıpla Steam’de pişir.')
  if (gram > 2500) uyari.add('Toplam 2,5 kg’ı geçiyor: MAX çizgisini aşabilir. Yarıya indir ya da iki seferde pişir.')
  return { ...pp, steps, uygun, warnings: [...uyari], alternatif: kek ? KALIP_STEAM : undefined }
}
