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

async function json<T>(yanit: Response): Promise<T> {
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
