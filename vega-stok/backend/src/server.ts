import Fastify from 'fastify'
import { config } from './config'
import { durum, esitlemeyiBaslat } from './esitleme/servis'
import { vegaKapat } from './vega/baglanti'
import { db, filtreSecenekleri, urunAra, urunBarkodla } from './yerel/db'

const app = Fastify({ logger: true })

app.get('/api/saglik', () => ({
  urunSayisi: (db.prepare('SELECT COUNT(*) AS n FROM urun').get() as { n: number }).n,
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

const durdur = esitlemeyiBaslat({
  info: (m) => app.log.info(m),
  error: (m) => app.log.error(m),
})

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
