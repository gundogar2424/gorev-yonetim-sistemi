// GEZIMI PLANLA: sohbetle planlama. Eksik bilgi sorulari (en fazla 3) telefonda sorulur, yapay zeka harcanmaz.
// Plan 1 kez olusturulur ve telefonda saklanir; "sunu degistir" yalnizca ilgili duraklari degistirir.
import type { GeziDegisiklik, GeziDurakAi } from './ai'

export interface GeziDurak extends GeziDurakAi {
  id: number
  kalsin?: boolean // Kalsin: sohbetteki degisiklikler bu duraga dokunmaz
}
export interface GeziMesaj {
  kim: 'ben' | 'ai'
  metin: string
}
export type GeziSoru = 'gun' | 'kimlerle' | 'cikis' | 'cocukYas'
export interface GeziDurum {
  sohbet: GeziMesaj[]
  anlatim: string
  gun?: number
  kimlerle?: string
  cikis?: string
  cocuk?: boolean // kimlerle icinde cocuk var
  cocukYas?: string // yazildigi gibi (ör. "4, 7"); bos = yas yazilmadi (uydurulmaz)
  cocukSoruldu?: boolean
  baslangic?: string // ilk gun: YYYY-AA-GG (anlatimdan anlasildiysa)
  bekleyen?: GeziSoru // cevabi beklenen soru
  soruSayisi: number
  plan?: { baslik: string; gunler: GeziDurak[][]; zaman: number }
  sonNo: number
  aiCagri: number // bu plan icin yapilan yapay zeka cagrisi sayisi
}

const KEY = 'lz-gezi-plan'
export const BOS_GEZI: GeziDurum = { sohbet: [], anlatim: '', soruSayisi: 0, sonNo: 0, aiCagri: 0 }
export const GEZI_EN_FAZLA_SORU = 3
export const GEZI_ACILIS = 'Nereye gideceksin, kaç gün, kimlerle, ne yapmak istiyorsun, anlat.'
export const GEZI_SORULAR: Record<GeziSoru, string> = { gun: 'Kaç gün?', kimlerle: 'Kimlerle gideceksin?', cikis: 'Kaçta çıkacaksın?', cocukYas: 'Çocukların yaşı kaç? Her çocuk için yaz.' }

export function geziOku(): GeziDurum {
  try {
    return { ...BOS_GEZI, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<GeziDurum>) }
  } catch {
    return { ...BOS_GEZI }
  }
}
export function geziYaz(d: GeziDurum): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...d, sohbet: d.sohbet.slice(-40) }))
  } catch {
    /* yok */
  }
}

const SAYI: Record<string, number> = { bir: 1, tek: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7 }
// "2 gün", "iki günlük", "3 gece", "günübirlik", "hafta sonu"
export function gunOku(m: string): number | undefined {
  const k = m.toLocaleLowerCase('tr')
  const r = k.match(/(\d{1,2})\s*(gün|gece)/)
  if (r) return Math.max(1, Math.min(14, Number(r[1]) + (r[2] === 'gece' ? 1 : 0)))
  const y = k.match(/(bir|tek|iki|üç|dört|beş|altı|yedi)\s*(gün|gece)/)
  if (y) return SAYI[y[1]] + (y[2] === 'gece' ? 1 : 0)
  if (/günübirlik|günü birlik/.test(k)) return 1
  if (/hafta ?sonu/.test(k)) return 2
  return undefined
}
export function kimlerleOku(m: string): string | undefined {
  const k = m.toLocaleLowerCase('tr')
  const r = k.match(/(tek başıma|yalnız|kendim|eşim\S*|karım\S*|kocam\S*|sevgilim\S*|aile\S*|çocuk\S*|kızım\S*|oğlum\S*|annem\S*|babam\S*|arkadaş\S*|kardeş\S*|\d+\s*kişi)/g)
  return r ? [...new Set(r)].join(', ') : undefined
}
// Cocuk var mi: "çocuk", "kızım", "oğlum", "bebek", "torun"
export function cocukVarMi(m: string): boolean {
  return /çocu[kğ]|kız[ıi]m|oğlum|bebe[kğ]|torun/.test(m.toLocaleLowerCase('tr'))
}
// Yaslar: "4 ve 7 yaşında", "3 yaş", "18 aylık". Yalnizca yazilan alinir; yoksa undefined (yas uydurulmaz)
export function cocukYasOku(m: string, soruCevabi = false): string | undefined {
  const k = m.toLocaleLowerCase('tr')
  const l: string[] = []
  for (const r of k.matchAll(/((?:\d{1,2}\s*(?:,|ve|-)\s*)*\d{1,2})\s*(yaş|ay)/g)) {
    for (const n of r[1].match(/\d{1,2}/g) ?? []) l.push(r[2] === 'ay' ? `${n} aylık` : n)
  }
  if (!l.length && soruCevabi) for (const n of k.match(/\b\d{1,2}\b/g) ?? []) if (Number(n) <= 17) l.push(n)
  return l.length ? l.join(', ') : undefined
}
const HAFTA = ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi']
const HAFTA_AD = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
const ikiHane = (n: number) => String(n).padStart(2, '0')
const gunStr = (d: Date) => `${d.getFullYear()}-${ikiHane(d.getMonth() + 1)}-${ikiHane(d.getDate())}`
// Ilk gun: "bugün", "yarın", "cumartesi", "hafta sonu". Anlasilmazsa undefined (uydurulmaz)
export function baslangicOku(m: string, simdi = new Date()): string | undefined {
  const k = m.toLocaleLowerCase('tr')
  const ileri = (n: number) => gunStr(new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate() + n))
  if (/\bbugün\b/.test(k)) return ileri(0)
  if (/\byarın\b/.test(k)) return ileri(1)
  const hedef = /hafta ?sonu/.test(k) ? 6 : HAFTA.findIndex((g) => new RegExp(`(^|[^a-zçğıöşü])${g}(?![a-zçğıöşü]*tesi)`).test(k))
  // "pazar" kelimesi "pazartesi"nin icinde gecer: once uzun adlar
  const tam = /pazartesi/.test(k) && hedef === 0 ? 1 : hedef
  if (tam < 0) return undefined
  return ileri((tam - simdi.getDay() + 7) % 7)
}
export function baslangicYazi(t: string | undefined): string {
  if (!t) return ''
  const [y, a, g] = t.split('-').map(Number)
  return `${t} ${HAFTA_AD[new Date(y, a - 1, g).getDay()]}`
}
export function cikisOku(m: string): string | undefined {
  const k = m.toLocaleLowerCase('tr')
  const r = k.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/)
  if (r) return `${r[1].padStart(2, '0')}:${r[2]}`
  const s = k.match(/saat\s*(\d{1,2})\b|\b(\d{1,2})\s*(?:'|’)?(?:de|da|te|ta)\s*(?:çık|yola)/)
  if (s) return `${String(s[1] ?? s[2]).padStart(2, '0')}:00`
  const y = k.match(/sabah erken|sabah|öğlen|öğleden sonra|akşam/)
  return y ? y[0] : undefined
}

// Kullanici mesaji (plan yokken): bilgiyi isler, siradaki eksik soruyu ya da "plan" dondurur. Yapay zeka KULLANMAZ.
export function geziMesajIsle(d: GeziDurum, metin: string): { durum: GeziDurum; sonraki: GeziSoru | 'plan' } {
  const y: GeziDurum = { ...d, sohbet: [...d.sohbet, { kim: 'ben', metin }] }
  if (d.bekleyen) {
    // Sorunun cevabi: anlasilmasa da yazildigi gibi alinir (ayni soru ikinci kez sorulmaz)
    if (d.bekleyen === 'gun') y.gun = gunOku(metin) ?? (Number(metin.match(/\d{1,2}/)?.[0]) || SAYI[metin.trim().toLocaleLowerCase('tr')] || 1)
    else if (d.bekleyen === 'kimlerle') {
      y.kimlerle = metin.trim().slice(0, 120)
      if (cocukVarMi(metin)) y.cocuk = true
    } else if (d.bekleyen === 'cocukYas') y.cocukYas = cocukYasOku(metin, true) // yas yazilmadiysa bos kalir
    else y.cikis = cikisOku(metin) ?? (metin.match(/\d{1,2}/) ? `${metin.match(/\d{1,2}/)![0].padStart(2, '0')}:00` : metin.trim().slice(0, 40))
    y.bekleyen = undefined
  } else {
    y.anlatim = `${d.anlatim} ${metin}`.trim().slice(0, 1200)
  }
  // Anlatimin icinde gecen bilgiler sorulmaz
  y.gun ??= gunOku(metin)
  y.kimlerle ??= kimlerleOku(metin)
  y.cikis ??= cikisOku(metin)
  y.baslangic ??= baslangicOku(metin)
  if (cocukVarMi(metin)) y.cocuk = true
  if (y.cocuk) y.cocukYas ??= cocukYasOku(metin)
  // Cocuk varsa ve yas yazilmadiysa: kimlerle sorusunun hemen ardindan yas sorulur (bir kez; 3 soru sinirina dahil degil)
  if (y.cocuk && !y.cocukYas && !y.cocukSoruldu && y.kimlerle) {
    y.cocukSoruldu = true
    y.bekleyen = 'cocukYas'
    y.sohbet = [...y.sohbet, { kim: 'ai', metin: GEZI_SORULAR.cocukYas }]
    return { durum: y, sonraki: 'cocukYas' }
  }
  const eksik: Exclude<GeziSoru, 'cocukYas'> | undefined = !y.gun ? 'gun' : !y.kimlerle ? 'kimlerle' : !y.cikis ? 'cikis' : undefined
  if (eksik && y.soruSayisi < GEZI_EN_FAZLA_SORU) {
    y.bekleyen = eksik
    y.soruSayisi++
    y.sohbet = [...y.sohbet, { kim: 'ai', metin: GEZI_SORULAR[eksik] }]
    return { durum: y, sonraki: eksik }
  }
  y.gun ??= 1
  return { durum: y, sonraki: 'plan' }
}

const MOLA_MI = /mola|kafe|kahve|yemek|kahvaltı|oyun|çay|dondurma|pasta/i
const dkEkle = (saat: string, dk: number): string => {
  const r = saat.match(/^(\d{1,2}):(\d{2})$/)
  if (!r) return saat
  const t = Math.min(23 * 60 + 59, Number(r[1]) * 60 + Number(r[2]) + dk)
  return `${ikiHane(Math.floor(t / 60))}:${ikiHane(t % 60)}`
}
// Ust uste 2 duraktan fazla yurume varsa araya mola durağı konur (yer adi uydurulmaz: "Mola (kafe)")
export function molaEkle(g: GeziDurakAi[]): GeziDurakAi[] {
  const l: GeziDurakAi[] = []
  let ustUste = 0
  for (const x of g) {
    const yuruyerek = (x.yurumeDk ?? 0) > 0
    if (yuruyerek && ustUste >= 2) {
      const onceki = l[l.length - 1]
      l.push({ saat: onceki ? dkEkle(onceki.saat, 45) : x.saat, ad: 'Mola (kafe)', tur: 'Mola', aciklama: 'Yürüyüş arası: yakındaki bir kafede dinlen.', acik: 'bilinmiyor', acikNot: '', yurumeDk: 0, aracDk: 0 })
      ustUste = 0
    }
    ustUste = yuruyerek ? ustUste + 1 : 0
    if (MOLA_MI.test(x.tur)) ustUste = 0
    l.push(x)
  }
  return l
}
export function planKur(d: GeziDurum, p: { baslik: string; gunler: GeziDurakAi[][] }): GeziDurum {
  let no = d.sonNo
  const gunler = p.gunler.filter((g) => g.length).map((g) => molaEkle(g).map((x) => ({ ...x, id: ++no })))
  return { ...d, plan: { baslik: p.baslik, gunler, zaman: Date.now() }, sonNo: no }
}
// Plandaki "o saatte kapali" duraklar (sohbette yazilir)
export function kapaliDuraklar(d: GeziDurum): string[] {
  return (d.plan?.gunler ?? []).flatMap((g, i) => g.filter((x) => x.acik === 'kapali').map((x) => `${i + 1}. gün ${x.saat} ${x.ad}: o saatte kapalı${x.acikNot ? ` (${x.acikNot})` : ''}`))
}
export function acikYazi(x: Pick<GeziDurak, 'acik' | 'acikNot'>): string {
  const n = x.acikNot ? ` · ${x.acikNot}` : ''
  return x.acik === 'acik' ? `Açık${n}` : x.acik === 'kapali' ? `O saatte kapalı${n}` : 'Açık / Kapalı: Belirtilmemiş'
}
export function yolYazi(x: Pick<GeziDurak, 'yurumeDk' | 'aracDk'>): string {
  if ((x.yurumeDk ?? 0) > 0) return `${x.yurumeDk} dk yürüme`
  if ((x.aracDk ?? 0) > 0) return `Araçla ${x.aracDk} dk`
  return ''
}
export function cocukYazi(d: Pick<GeziDurum, 'cocuk' | 'cocukYas'>): string {
  return d.cocuk ? `Çocuk var · ${d.cocukYas ? `yaş: ${d.cocukYas}` : 'yaş belirtilmemiş'}` : ''
}
// Yapay zekaya giden kisa ozet (yalnizca no, gun, saat, ad, tur)
export function planOzeti(d: GeziDurum): string {
  return (d.plan?.gunler ?? []).flatMap((g, i) => g.map((x) => `${x.kalsin ? '[KALSIN] ' : ''}#${x.id} | ${i + 1}. gün | ${x.saat} | ${x.ad} | ${x.tur}`)).join('\n')
}
const saatSirala = (g: GeziDurak[]) => [...g].sort((a, b) => (a.saat || '99').localeCompare(b.saat || '99'))
// Degisiklikleri uygular: yalnizca adi gecen duraklar degisir; Kalsin denenlere dokunulmaz
export function degisiklikUygula(d: GeziDurum, l: GeziDegisiklik[]): { durum: GeziDurum; sayi: number } {
  if (!d.plan) return { durum: d, sayi: 0 }
  let no = d.sonNo
  let sayi = 0
  let gunler = d.plan.gunler.map((g) => [...g])
  const kilitli = new Set(gunler.flat().filter((x) => x.kalsin).map((x) => x.id))
  for (const x of l) {
    if (x.islem === 'ekle') {
      if (!x.ad?.trim()) continue
      const gi = Math.max(0, Math.min(gunler.length - 1, (x.gun || 1) - 1))
      gunler[gi] = saatSirala([...gunler[gi], { id: ++no, saat: x.saat, ad: x.ad.trim(), tur: x.tur, aciklama: x.aciklama, acik: 'bilinmiyor' as const }])
      sayi++
    } else if (!kilitli.has(x.id) && gunler.some((g) => g.some((y) => y.id === x.id))) {
      if (x.islem === 'cikar') gunler = gunler.map((g) => g.filter((y) => y.id !== x.id))
      else gunler = gunler.map((g) => (g.some((y) => y.id === x.id) ? saatSirala(g.map((y) => (y.id === x.id ? { ...y, saat: x.saat || y.saat, ad: x.ad?.trim() || y.ad, tur: x.tur || y.tur, aciklama: x.aciklama || y.aciklama, acik: 'bilinmiyor' as const, acikNot: '', yurumeDk: 0, aracDk: 0 } : y))) : g))
      sayi++
    }
  }
  return { durum: { ...d, plan: { ...d.plan, gunler }, sonNo: no }, sayi }
}
export function durakCikar(d: GeziDurum, id: number): GeziDurum {
  return d.plan ? { ...d, plan: { ...d.plan, gunler: d.plan.gunler.map((g) => g.filter((x) => x.id !== id)) } } : d
}
export function durakKalsin(d: GeziDurum, id: number): GeziDurum {
  return d.plan ? { ...d, plan: { ...d.plan, gunler: d.plan.gunler.map((g) => g.map((x) => (x.id === id ? { ...x, kalsin: !x.kalsin } : x))) } } : d
}
