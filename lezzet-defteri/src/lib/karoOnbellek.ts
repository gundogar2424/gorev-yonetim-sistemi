// HARITA KAROLARI ONBELLEGI: acilan ve ev cevresindeki karolar telefonda (Cache Storage) saklanir.
// Internet yokken ya da zayifken once onbellekten gelir; sokak cizgileri ve kayitli pinler yine gorunur.
// Cevre listesiyle ayni mantik: once telefondan, ag arka planda.
import L from 'leaflet'
import { sonKonum } from './cevre'

const KASA = 'lz-karolar-v1'
const EN_FAZLA = 2500 // en fazla bu kadar karo (yaklasik 40-60 MB)
const KEY_ON_YUKLEME = 'lz-karo-on-yukleme'

async function kasa(): Promise<Cache | null> {
  try {
    return 'caches' in window ? await caches.open(KASA) : null
  } catch {
    return null
  }
}

// Karoyu once onbellekten, yoksa agdan getirip saklar
export async function karoGetir(url: string, agiDene = true): Promise<Blob | null> {
  const k = await kasa()
  const varolan = await k?.match(url).catch(() => undefined)
  if (varolan) return varolan.blob()
  if (!agiDene) return null
  const r = await fetch(url, { mode: 'cors' })
  if (!r.ok) throw new Error(String(r.status))
  const b = await r.blob()
  if (k) void k.put(url, new Response(b, { headers: { 'content-type': r.headers.get('content-type') ?? 'image/png' } })).catch(() => undefined)
  return b
}

// Onbellekli karo katmani: once telefondan, sonra ag; ikisi de yoksa hata (Leaflet bos birakir)
export const OnbellekliKaro = L.TileLayer.extend({
  createTile(this: L.TileLayer, coords: L.Coords, done: L.DoneCallback) {
    const img = document.createElement('img')
    img.alt = ''
    img.setAttribute('role', 'presentation')
    const url = this.getTileUrl(coords)
    karoGetir(url)
      .then((b) => {
        if (!b) throw new Error('yok')
        const u = URL.createObjectURL(b)
        img.onload = () => {
          URL.revokeObjectURL(u)
          done(undefined, img)
        }
        img.onerror = () => done(new Error('karo'), img)
        img.src = u
      })
      .catch((e) => done(e instanceof Error ? e : new Error('karo'), img))
    return img
  }
}) as unknown as new (url: string, ayar?: L.TileLayerOptions) => L.TileLayer

// Karo koordinati
function karo(lat: number, lon: number, z: number): { x: number; y: number } {
  const n = 2 ** z
  const x = Math.floor(((lon + 180) / 360) * n)
  const r = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)
  return { x, y }
}

// Ev cevresi: son konumun ~1,2 km cevresi, 13-17 yakinlik (yaklasik 150 karo). Haftada bir, internet varken, arka planda.
export async function evCevresiniSakla(sablon = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', zorla = false): Promise<number> {
  const k = sonKonum()
  if (!k || !navigator.onLine) return 0
  try {
    const son = Number(localStorage.getItem(KEY_ON_YUKLEME) || 0)
    if (!zorla && Date.now() - son < 7 * 864e5) return 0
    localStorage.setItem(KEY_ON_YUKLEME, String(Date.now()))
  } catch {
    /* yok */
  }
  const derece = 1.2 / 111 // ~1,2 km
  let n = 0
  for (let z = 13; z <= 17; z++) {
    const a = karo(k.lat + derece, k.lon - derece * 1.3, z)
    const b = karo(k.lat - derece, k.lon + derece * 1.3, z)
    for (let x = a.x; x <= b.x; x++)
      for (let y = a.y; y <= b.y; y++) {
        const url = sablon.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
        try {
          await karoGetir(url)
          n++
        } catch {
          /* tek karo inmediyse devam */
        }
        // Sunucuyu yormamak icin kisa mola
        await new Promise((r) => setTimeout(r, 120))
      }
  }
  void sinirla()
  return n
}

// Onbellek cok buyumesin: en eski karolar silinir
async function sinirla(): Promise<void> {
  const k = await kasa()
  if (!k) return
  const anahtarlar = await k.keys()
  if (anahtarlar.length <= EN_FAZLA) return
  for (const r of anahtarlar.slice(0, anahtarlar.length - EN_FAZLA)) await k.delete(r)
}
