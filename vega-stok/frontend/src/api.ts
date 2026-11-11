export interface Urun {
  id: number
  kod: string
  ad: string
  barkod: string | null
  marka: string | null
  kategori: string | null
  olcu: string | null
  raf: string | null
  kdv: number | null
  satisFiyati: number | null
  kritikEsik: number | null
  stok: number
  gorselSurum: number | null
  /** Tedarikçiye verilmiş açık siparişlerin toplam adedi */
  yoldaki: number
  /** Termini en yakın açık siparişin tedarikçisi ve tarihi (YYYY-AA-GG) */
  tedarikci: string | null
  termin: string | null
}

export interface Siparis {
  id: number
  urunId: number
  tedarikci: string
  miktar: number
  termin: string | null
  gecikti: 0 | 1
}

export type UrunDetayi = Urun & { siparisler: Siparis[] }
export type KritikUrun = Urun & { eksik: number }
export type AcikSiparis = Siparis & { urunAd: string; urunKod: string; stok: number; gorselSurum: number | null }

export interface Filtreler {
  markalar: string[]
  kategoriler: string[]
  olculer: string[]
}

export interface Arama {
  q: string
  marka: string
  kategori: string
  olcu: string
}

export interface Saglik {
  urunSayisi: number
  demo: boolean
  esitleme: { sonHizliTur: string | null; sonTamTur: string | null; sonHata: string | null }
}

/** Oturum düştüğünde (401) App giriş ekranına döner. */
export const OTURUM_BITTI = 'oturum-bitti'

async function json<T>(yanit: Response): Promise<T> {
  if (yanit.status === 401) window.dispatchEvent(new Event(OTURUM_BITTI))
  if (!yanit.ok) {
    const govde = (await yanit.json().catch(() => null)) as { hata?: string } | null
    throw new Error(govde?.hata ?? `Sunucu hatası (${yanit.status})`)
  }
  return yanit.json() as Promise<T>
}

const getir = <T,>(adres: string, sinyal?: AbortSignal) => fetch(adres, { signal: sinyal }).then(json<T>)

const gonder = <T = { tamam: true }>(yontem: string, adres: string, govde?: unknown) =>
  fetch(adres, {
    method: yontem,
    ...(govde === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) }),
  }).then(json<T>)

export function urunleriAra(arama: Arama, sinyal: AbortSignal): Promise<Urun[]> {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(arama)) if (v) p.set(k, v)
  return getir<Urun[]>(`/api/urunler?${p}`, sinyal)
}

export const filtreleriGetir = () => getir<Filtreler>('/api/filtreler')
export const saglikGetir = () => getir<Saglik>('/api/saglik')
export const urunGetir = (id: number) => getir<UrunDetayi>(`/api/urunler/${id}`)
export const barkodlaGetir = (barkod: string) => getir<Urun>(`/api/urunler/barkod/${encodeURIComponent(barkod)}`)
export const kritikStokGetir = () => getir<KritikUrun[]>('/api/kritik-stok')
export const acikSiparisleriGetir = () => getir<AcikSiparis[]>('/api/siparisler')
export const tedarikcileriGetir = () => getir<string[]>('/api/tedarikciler')

type SiparisAlanlari = { tedarikci: string; miktar: number; termin: string | null }
export const siparisEkle = (urunId: number, s: SiparisAlanlari) => gonder('POST', '/api/siparisler', { urunId, ...s })
export const siparisGuncelle = (id: number, s: SiparisAlanlari) => gonder('PUT', `/api/siparisler/${id}`, s)
export const siparisTeslim = (id: number) => gonder('POST', `/api/siparisler/${id}/teslim`)
export const siparisSil = (id: number) => gonder('DELETE', `/api/siparisler/${id}`)
export const kritikEsikKaydet = (urunId: number, esik: number | null) => gonder('PUT', `/api/urunler/${urunId}/kritik-esik`, { esik })

export function gorselYukle(urunId: number, dosya: File): Promise<{ gorselSurum: number }> {
  return fetch(`/api/urunler/${urunId}/gorsel`, {
    method: 'PUT',
    headers: { 'Content-Type': dosya.type || 'image/jpeg' },
    body: dosya,
  }).then(json<{ gorselSurum: number }>)
}

// --- Teklifler ---
export interface TeklifKalemi {
  urunId: number | null
  kod: string | null
  ad: string
  miktar: number
  birimFiyat: number
  iskonto: string
  kdv: number
}

export interface TeklifGirdi {
  musteriAd: string
  musteriTelefon: string | null
  musteriAdres: string | null
  genelIskonto: string
  kdvDahil: boolean
  gecerlilikGun: number
  notu: string | null
  kalemler: TeklifKalemi[]
}

export type Teklif = Omit<TeklifGirdi, 'kalemler'> & { id: number; no: string; tarih: string; kalemler: (TeklifKalemi & { gorselSurum: number | null })[] }
export interface TeklifOzeti { id: number; no: string; tarih: string; musteriAd: string; genelToplam: number; kalemSayisi: number }
export interface Musteri { ad: string; telefon: string | null; adres: string | null }
export interface Firma { ad: string; adres: string; telefon: string; eposta: string; vergi: string; fiyatlarKdvDahil: boolean }

export const teklifleriGetir = () => getir<TeklifOzeti[]>('/api/teklifler')
export const teklifGetir = (id: number) => getir<Teklif>(`/api/teklifler/${id}`)
export const teklifEkle = (t: TeklifGirdi) => gonder<{ id: number }>('POST', '/api/teklifler', t)
export const teklifGuncelle = (id: number, t: TeklifGirdi) => gonder('PUT', `/api/teklifler/${id}`, t)
export const teklifSil = (id: number) => gonder('DELETE', `/api/teklifler/${id}`)
export const teklifMetniGetir = (id: number) => getir<{ metin: string; telefon: string | null }>(`/api/teklifler/${id}/metin`)
export const musterileriGetir = () => getir<Musteri[]>('/api/musteriler')
export const ayarlariGetir = () => getir<Firma & { logoVar: boolean }>('/api/ayarlar')
export const ayarlariKaydet = (f: Firma) => gonder<Firma>('PUT', '/api/ayarlar', f)
export const logoYukle = (dosya: File) =>
  fetch('/api/ayarlar/logo', { method: 'PUT', headers: { 'Content-Type': dosya.type || 'image/png' }, body: dosya }).then(json<{ tamam: true }>)

// --- Giriş ve kullanıcılar ---
export type Rol = 'yonetici' | 'satis' | 'depo'
export const ROL_ADLARI: Record<Rol, string> = { yonetici: 'Yönetici', satis: 'Satış', depo: 'Depo' }
export interface Kullanici { id: number; kullaniciAdi: string; ad: string; rol: Rol; aktif: boolean }

// Giriş durumu sorgusu 401 dönmez; json() yerine doğrudan okunur
export const oturumGetir = () => fetch('/api/oturum').then((y) => y.json() as Promise<{ kullanici: Kullanici | null; kurulumGerekli: boolean }>)
const kimlikGonder = (adres: string, govde: unknown) =>
  fetch(adres, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) }).then(async (y) => {
    const g = (await y.json().catch(() => null)) as { kullanici?: Kullanici; hata?: string } | null
    if (!y.ok || !g?.kullanici) throw new Error(g?.hata ?? `Sunucu hatası (${y.status})`)
    return g.kullanici
  })
export const girisYap = (kullaniciAdi: string, sifre: string) => kimlikGonder('/api/oturum', { kullaniciAdi, sifre })
export const kurulumYap = (g: { kullaniciAdi: string; ad: string; sifre: string }) => kimlikGonder('/api/kurulum', g)
export const cikisYap = () => fetch('/api/oturum', { method: 'DELETE' })
export const sifreDegistir = (eski: string, yeni: string) => gonder('PUT', '/api/oturum/sifre', { eski, yeni })
export const kullanicilariGetir = () => getir<Kullanici[]>('/api/kullanicilar')
export const kullaniciEkle = (k: { kullaniciAdi: string; ad: string; rol: Rol; sifre: string }) => gonder<{ id: number }>('POST', '/api/kullanicilar', k)
export const kullaniciGuncelle = (id: number, k: { ad: string; rol: Rol; aktif: boolean; sifre?: string }) => gonder('PUT', `/api/kullanicilar/${id}`, k)
