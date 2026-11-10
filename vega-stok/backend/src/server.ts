import fastifyStatic from '@fastify/static'
import Fastify from 'fastify'
import { createReadStream, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from './config'
import { durum, esitlemeyiBaslat } from './esitleme/servis'
import { BOYUTLAR, gorselKaydet, gorselYolu, type Boyut } from './gorsel/servis'
import { GirdiHatasi } from './girdi'
import { teklifRotalari } from './teklif/rotalar'
import { tedarikRotalari } from './tedarik/rotalar'
import { vegaKapat } from './vega/baglanti'
import { db, filtreSecenekleri, urunAra, urunBarkodla, urunVarMi } from './yerel/db'
import { demoVerisiYukle } from './yerel/demo'

const app = Fastify({ logger: true })

app.setErrorHandler((hata, _istek, yanit) =>
  hata instanceof GirdiHatasi ? yanit.code(400).send({ hata: hata.message }) : yanit.send(hata),
)

app.get('/api/saglik', () => ({
  urunSayisi: (db.prepare('SELECT COUNT(*) AS n FROM urun').get() as { n: number }).n,
  demo: config.demo,
  esitleme: durum,
}))

// Anlık arama: /api/urunler?q=civ 4x&marka=...&kategori=...&olcu=...
app.get<{ Querystring: { q?: string; marka?: string; kategori?: string; olcu?: string; limit?: string } }>(
  '/api/urunler',
  (istek) => {
    const { limit, ...filtre } = istek.query
    return urunAra({ ...filtre, limit: limit ? Number(limit) || undefined : undefined })
  },
)

app.get('/api/filtreler', () => filtreSecenekleri())

// El terminali (barkod okuyucu)
app.get<{ Params: { barkod: string } }>('/api/urunler/barkod/:barkod', (istek, yanit) => {
  const urun = urunBarkodla(istek.params.barkod)
  return urun ?? yanit.code(404).send({ hata: 'Ürün bulunamadı' })
})

app.register(tedarikRotalari)
app.register(teklifRotalari)

// --- Görseller ---
// Dosya ham gövde olarak gelir: fetch(url, { method: 'PUT', body: dosya })
app.addContentTypeParser(/^image\//, { parseAs: 'buffer', bodyLimit: 25 * 1024 * 1024 }, (_istek, govde, bitti) =>
  bitti(null, govde),
)

app.put<{ Params: { id: string } }>('/api/urunler/:id/gorsel', async (istek, yanit) => {
  const id = Number(istek.params.id)
  if (!Number.isInteger(id) || !urunVarMi(id)) return yanit.code(404).send({ hata: 'Ürün bulunamadı' })
  if (!Buffer.isBuffer(istek.body) || istek.body.length === 0) return yanit.code(400).send({ hata: 'Görsel dosyası gönderilmedi' })
  try {
    return { gorselSurum: await gorselKaydet(id, istek.body) }
  } catch {
    return yanit.code(400).send({ hata: 'Dosya görsel olarak okunamadı' })
  }
})

app.get<{ Params: { id: string; boyut: string } }>('/gorseller/:id/:boyut', (istek, yanit) => {
  const id = Number(istek.params.id)
  const boyut = istek.params.boyut.replace(/\.webp$/, '')
  if (!Number.isInteger(id) || !(boyut in BOYUTLAR)) return yanit.code(404).send()
  const yol = gorselYolu(id, boyut as Boyut)
  if (!existsSync(yol)) return yanit.code(404).send()
  // Adres ?v=sürüm taşıdığı için dosya süresiz önbelleğe alınabilir
  return yanit
    .type('image/webp')
    .header('Cache-Control', 'public, max-age=31536000, immutable')
    .send(createReadStream(yol))
})

// --- Arayüz (npm run build çıktısı varsa aynı porttan sunulur) ---
const arayuz = resolve(import.meta.dirname, '../../frontend/dist')
if (existsSync(arayuz)) {
  app.register(fastifyStatic, { root: arayuz })
  app.setNotFoundHandler((istek, yanit) =>
    istek.method === 'GET' && !istek.url.startsWith('/api/') && !istek.url.startsWith('/gorseller/')
      ? yanit.sendFile('index.html')
      : yanit.code(404).send({ hata: 'Bulunamadı' }),
  )
}

let durdur = () => {}
if (config.demo) {
  demoVerisiYukle()
    .then((n) => app.log.info(`DEMO modu: ${n} örnek ürün yüklendi, Vega'ya bağlanılmıyor`))
    .catch((e) => app.log.error(e))
} else {
  durdur = esitlemeyiBaslat({
    info: (m) => app.log.info(m),
    error: (m) => app.log.error(m),
  })
}

for (const sinyal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinyal, async () => {
    durdur()
    await app.close()
    await vegaKapat()
    db.close()
    process.exit(0)
  })
}

// 0.0.0.0: yerel ağdaki bilgisayar ve el terminalleri erişebilsin
app.listen({ port: config.port, host: '0.0.0.0' }).catch((e) => {
  app.log.error(e)
  process.exit(1)
})
