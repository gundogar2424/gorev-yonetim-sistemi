// TAKIP EDILEN YEMEK HESAPLARI: Instagram/TikTok/YouTube'daki yemek hesaplari.
// "Yeni mekan" kontrolu: hesaplarin son haftalarda tanittigi, henuz kayitli olmayan
// mekanlar tek bir Google aramali istekle bulunur; yeni bir sey varsa bildirim gelir.
import { lzDb } from '../db'
import { aiMekanOner, apiAnahtari, type MekanOnerisi } from './ai'
import { bildir } from './kampanya'

const KEY_HESAP = 'lz-yemek-hesaplari'
const KEY_YENI = 'lz-hesap-yeni' // { zaman, gorulen: normal adlar, liste: son bulunanlar }
const KEY_OTO = 'lz-hesap-oto' // '0' ise kendiliginden bakilmaz
const KEY_CIKAN = 'lz-hesap-cikan' // takipten cikarilanlar: otomatik takip bunlari tekrar eklemez
const KEY_ADAY = 'lz-hesap-aday' // videosu paylasilan, takip edilip edilmeyecegi sorulacak kisiler
const KEY_FOTO = 'lz-hesap-foto' // { normalAd: { foto: dataURL, t: deneme zamani } }
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
// "@ad", "ad" ya da profil linki -> "@ad"; "Buğra Karaman" gibi gorunen ad oldugu gibi kalir
export function hesapAdi(girdi: string): string {
  const t = girdi.trim()
  const link = t.match(/(?:instagram|tiktok|youtube)\.com\/@?([\w.]+)/i)?.[1]
  if (link) return `@${link}`
  if (/^@?[\w.]+$/.test(t)) return `@${t.replace(/^@/, '')}`
  return t.replace(/\s+/g, ' ').slice(0, 60)
}
// platform: gorunen adla takip edilirken aramayi kolaylastirir (ör. "Buğra Karaman (YouTube)")
// oto: videosu paylasilinca kendiliginden takip; kullanici takipten ciktiysa eklenmez
export function hesapTakipEt(girdi: string, platform = '', oto = false): boolean {
  const ad = hesapAdi(girdi)
  const h = ad && !ad.startsWith('@') && platform ? `${ad} (${platform})` : ad
  if (!h || takipEdiliyor(girdi)) return false
  if (oto) {
    // Kendiliginden takip edilmez: kullaniciya "takip edilsin mi?" diye sorulur (reddedilenler bir daha sorulmaz)
    if (!cikanlar().includes(hesapNormal(h)) && !adaylar().some((x) => hesapNormal(x) === hesapNormal(h))) yaz(KEY_ADAY, JSON.stringify([...adaylar(), h]))
    return false
  }
  yaz(KEY_ADAY, JSON.stringify(adaylar().filter((x) => hesapNormal(x) !== hesapNormal(h))))
  hesaplariYaz([...hesaplariOku(), h])
  yaz(KEY_CIKAN, JSON.stringify(cikanlar().filter((x) => x !== hesapNormal(h))))
  return true
}
export function adaylar(): string[] {
  try {
    return JSON.parse(oku(KEY_ADAY) || '[]') as string[]
  } catch {
    return []
  }
}
// "Hayir, takip etme": bir daha sorulmaz
export function adayReddet(h: string): void {
  yaz(KEY_ADAY, JSON.stringify(adaylar().filter((x) => x !== h)))
  yaz(KEY_CIKAN, JSON.stringify([...cikanlar(), hesapNormal(h)]))
}
export function hesapBirak(h: string): void {
  hesaplariYaz(hesaplariOku().filter((x) => x !== h))
  yaz(KEY_CIKAN, JSON.stringify([...cikanlar(), hesapNormal(h)]))
}
function cikanlar(): string[] {
  try {
    return JSON.parse(oku(KEY_CIKAN) || '[]') as string[]
  } catch {
    return []
  }
}
// Karsilastirma icin: "@Ad", "Ad (YouTube)" -> "ad"
export function hesapNormal(x: string): string {
  return x.toLocaleLowerCase('tr').replace(/\s*\([^)]*\)$/, '').replace(/^@/, '').trim()
}
export function takipEdiliyor(girdi: string): boolean {
  const h = hesapNormal(hesapAdi(girdi))
  return !!h && hesaplariOku().some((x) => hesapNormal(x) === h)
}

// PROFIL FOTOGRAFI: cihaza kucuk resim olarak kaydedilir (Instagram adresleri birkac gunde gecersiz olur)
type FotoKayit = Record<string, { foto: string; t: number }>
function fotolar(): FotoKayit {
  try {
    return JSON.parse(oku(KEY_FOTO) || '{}') as FotoKayit
  } catch {
    return {}
  }
}
export function hesapFoto(h: string): string {
  return fotolar()[hesapNormal(h)]?.foto ?? ''
}
// adres: bilinen fotograf adresi (ör. gonderi sahibinin); yoksa @kullaniciadi ile Instagram'dan bulunur. Gunde en fazla bir deneme.
export async function hesapFotoGetir(h: string, adres = ''): Promise<string> {
  const k = hesapNormal(h)
  const f = fotolar()
  if (f[k]?.foto) return f[k].foto
  if (!adres && f[k] && Date.now() - f[k].t < 24 * 3600 * 1000) return ''
  try {
    const { instagramProfilFoto, youtubeKanalFoto } = await import('./video')
    const { uzaktanFotoIndir } = await import('./image')
    const t = h.trim()
    const url =
      adres ||
      (t.startsWith('@')
        ? await instagramProfilFoto(t.slice(1))
        : /\(youtube\)$/i.test(t)
          ? await youtubeKanalFoto(t.replace(/\s*\([^)]*\)$/, ''))
          : '')
    const foto = url ? await uzaktanFotoIndir(url).catch(() => '') : ''
    yaz(KEY_FOTO, JSON.stringify({ ...fotolar(), [k]: { foto, t: Date.now() } }))
    return foto
  } catch {
    return ''
  }
}

// Kullanicinin galeriden sectigi fotograf
export function hesapFotoKaydet(h: string, foto: string): void {
  yaz(KEY_FOTO, JSON.stringify({ ...fotolar(), [hesapNormal(h)]: { foto, t: Date.now() } }))
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
