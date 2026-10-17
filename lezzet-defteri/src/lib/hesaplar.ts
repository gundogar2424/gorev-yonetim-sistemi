// TAKIP EDILEN YEMEK HESAPLARI: Instagram/TikTok/YouTube'daki yemek hesaplari.
// "Yeni mekan" kontrolu: hesaplarin son haftalarda tanittigi, henuz kayitli olmayan
// mekanlar tek bir Google aramali istekle bulunur; yeni bir sey varsa bildirim gelir.
import { lzDb } from '../db'
import { aiMekanOner, apiAnahtari, type MekanOnerisi } from './ai'
import { bildir } from './kampanya'

const KEY_HESAP = 'lz-yemek-hesaplari'
const KEY_YENI = 'lz-hesap-yeni' // { zaman, gorulen: normal adlar, liste: son bulunanlar }
const KEY_OTO = 'lz-hesap-oto' // '0' ise kendiliginden bakilmaz
const ARALIK = 3 * 24 * 3600 * 1000 // kendiliginden kontrol en fazla 3 gunde bir

function oku(k: string): string {
  try {
    return localStorage.getItem(k) ?? ''
  } catch {
    return ''
  }
}
function yaz(k: string, v: string): void {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* yok */
  }
}

export function hesaplariOku(): string[] {
  try {
    return JSON.parse(oku(KEY_HESAP) || '[]') as string[]
  } catch {
    return []
  }
}
export function hesaplariYaz(h: string[]): void {
  yaz(KEY_HESAP, JSON.stringify(h))
}
// "@ad", "ad" ya da profil linki -> "@ad"
export function hesapAdi(girdi: string): string {
  const t = girdi.trim()
  const ad = t.match(/(?:instagram|tiktok|youtube)\.com\/@?([\w.]+)/i)?.[1] ?? t.replace(/^@/, '').split(/\s/)[0]
  return ad ? `@${ad}` : ''
}
export function hesapTakipEt(girdi: string): boolean {
  const h = hesapAdi(girdi)
  const liste = hesaplariOku()
  if (!h || liste.some((x) => x.toLowerCase() === h.toLowerCase())) return false
  hesaplariYaz([...liste, h])
  return true
}
export function takipEdiliyor(girdi: string): boolean {
  const h = hesapAdi(girdi).toLowerCase()
  return !!h && hesaplariOku().some((x) => x.toLowerCase() === h)
}

export function otoKontrol(): boolean {
  return oku(KEY_OTO) !== '0'
}
export function otoKontrolAyarla(v: boolean): void {
  yaz(KEY_OTO, v ? '1' : '0')
}

type Kayit = { zaman: number; gorulen: string[]; liste: MekanOnerisi[] }
function kayitOku(): Kayit {
  try {
    return { zaman: 0, gorulen: [], liste: [], ...(JSON.parse(oku(KEY_YENI) || '{}') as Partial<Kayit>) }
  } catch {
    return { zaman: 0, gorulen: [], liste: [] }
  }
}
export function sonYeniKontrol(): { zaman: number; liste: MekanOnerisi[] } {
  const k = kayitOku()
  return { zaman: k.zaman, liste: k.liste }
}

const normal = (x: string) => x.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]+/gu, '')

// Takip edilen hesaplarin yeni tanittigi, kayitli olmayan ve daha once gosterilmemis mekanlar
export async function yeniMekanlariBul(yer = 'Türkiye'): Promise<MekanOnerisi[]> {
  const hesaplar = hesaplariOku()
  if (!hesaplar.length) return []
  const kayitli = await lzDb.mekanlar.toArray()
  const k = kayitOku()
  const liste = await aiMekanOner(
    'Bu hesapların SON 30 GÜNDE paylaştığı ve tanıttığı mekanlar, en yeniden eskiye. populerlik alanına hangi hesabın ne zaman ' +
      'paylaştığını yaz (ör. "@hesap · 12 Ekim: …"). Bulunduğum yere yakınlık şart değil.',
    yer,
    kayitli.map((m) => m.ad),
    hesaplar.join(', ')
  )
  const bilinen = new Set([...k.gorulen, ...kayitli.map((m) => normal(m.ad))])
  const yeniler = liste.filter((o) => o.ad && !bilinen.has(normal(o.ad)))
  yaz(KEY_YENI, JSON.stringify({ zaman: Date.now(), gorulen: [...k.gorulen, ...yeniler.map((o) => normal(o.ad))].slice(-300), liste: yeniler }))
  return yeniler
}

// Uygulama acilinca: ayar aciksa ve son kontrolden 3 gun gectiyse arka planda bakar, yeni varsa bildirir
export async function yeniMekanOtoKontrol(): Promise<void> {
  if (!otoKontrol() || !apiAnahtari() || !hesaplariOku().length) return
  if (Date.now() - kayitOku().zaman < ARALIK) return
  try {
    const yeniler = await yeniMekanlariBul()
    if (!yeniler.length) return
    const ilk = yeniler[0]
    await bildir(
      yeniler.length > 1 ? `Takip ettiklerinden ${yeniler.length} yeni mekan` : `${ilk.ad}`,
      yeniler.length > 1 ? yeniler.map((o) => o.ad).slice(0, 4).join(', ') : `${ilk.populerlik || 'Takip ettiğin bir hesap yeni tanıttı'}`,
      7000
    )
  } catch {
    /* sessizce: kredi/limit/baglanti; bir sonraki acilista tekrar dener */
  }
}
