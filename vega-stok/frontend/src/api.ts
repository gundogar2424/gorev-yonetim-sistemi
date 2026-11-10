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
}

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

async function json<T>(yanit: Response): Promise<T> {
  if (!yanit.ok) {
    const govde = (await yanit.json().catch(() => null)) as { hata?: string } | null
    throw new Error(govde?.hata ?? `Sunucu hatası (${yanit.status})`)
  }
  return yanit.json() as Promise<T>
}

export function urunleriAra(arama: Arama, sinyal: AbortSignal): Promise<Urun[]> {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(arama)) if (v) p.set(k, v)
  return fetch(`/api/urunler?${p}`, { signal: sinyal }).then(json<Urun[]>)
}

export const filtreleriGetir = (): Promise<Filtreler> => fetch('/api/filtreler').then(json<Filtreler>)

export const saglikGetir = (): Promise<{ demo: boolean; esitleme: { sonHata: string | null } }> =>
  fetch('/api/saglik').then(json<{ demo: boolean; esitleme: { sonHata: string | null } }>)

export function gorselYukle(urunId: number, dosya: File): Promise<{ gorselSurum: number }> {
  return fetch(`/api/urunler/${urunId}/gorsel`, {
    method: 'PUT',
    headers: { 'Content-Type': dosya.type || 'image/jpeg' },
    body: dosya,
  }).then(json<{ gorselSurum: number }>)
}

export const gorselAdresi = (u: Urun, boyut: 'kart' | 'buyuk'): string | null =>
  u.gorselSurum ? `/gorseller/${u.id}/${boyut}.webp?v=${u.gorselSurum}` : null
