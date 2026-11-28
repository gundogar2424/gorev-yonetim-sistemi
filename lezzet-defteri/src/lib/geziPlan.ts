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
export type GeziSoru = 'gun' | 'kimlerle' | 'cikis'
export interface GeziDurum {
  sohbet: GeziMesaj[]
  anlatim: string
  gun?: number
  kimlerle?: string
  cikis?: string
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
export const GEZI_SORULAR: Record<GeziSoru, string> = { gun: 'Kaç gün?', kimlerle: 'Kimlerle gideceksin?', cikis: 'Kaçta çıkacaksın?' }

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
    else if (d.bekleyen === 'kimlerle') y.kimlerle = metin.trim().slice(0, 120)
    else y.cikis = cikisOku(metin) ?? (metin.match(/\d{1,2}/) ? `${metin.match(/\d{1,2}/)![0].padStart(2, '0')}:00` : metin.trim().slice(0, 40))
    y.bekleyen = undefined
  } else {
    y.anlatim = `${d.anlatim} ${metin}`.trim().slice(0, 1200)
  }
  // Anlatimin icinde gecen bilgiler sorulmaz
  y.gun ??= gunOku(metin)
  y.kimlerle ??= kimlerleOku(metin)
  y.cikis ??= cikisOku(metin)
  const eksik: GeziSoru | undefined = !y.gun ? 'gun' : !y.kimlerle ? 'kimlerle' : !y.cikis ? 'cikis' : undefined
  if (eksik && y.soruSayisi < GEZI_EN_FAZLA_SORU) {
    y.bekleyen = eksik
    y.soruSayisi++
    y.sohbet = [...y.sohbet, { kim: 'ai', metin: GEZI_SORULAR[eksik] }]
    return { durum: y, sonraki: eksik }
  }
  y.gun ??= 1
  return { durum: y, sonraki: 'plan' }
}

export function planKur(d: GeziDurum, p: { baslik: string; gunler: GeziDurakAi[][] }): GeziDurum {
  let no = d.sonNo
  const gunler = p.gunler.filter((g) => g.length).map((g) => g.map((x) => ({ ...x, id: ++no })))
  return { ...d, plan: { baslik: p.baslik, gunler, zaman: Date.now() }, sonNo: no }
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
      gunler[gi] = saatSirala([...gunler[gi], { id: ++no, saat: x.saat, ad: x.ad.trim(), tur: x.tur, aciklama: x.aciklama }])
      sayi++
    } else if (!kilitli.has(x.id) && gunler.some((g) => g.some((y) => y.id === x.id))) {
      if (x.islem === 'cikar') gunler = gunler.map((g) => g.filter((y) => y.id !== x.id))
      else gunler = gunler.map((g) => (g.some((y) => y.id === x.id) ? saatSirala(g.map((y) => (y.id === x.id ? { ...y, saat: x.saat || y.saat, ad: x.ad?.trim() || y.ad, tur: x.tur || y.tur, aciklama: x.aciklama || y.aciklama } : y))) : g))
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
