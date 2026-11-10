import type { FastifyInstance } from 'fastify'
import { createReadStream, existsSync } from 'node:fs'
import { logoKaydet, logoYolu, teklifMetni, teklifPdf } from './cikti'
import { firmaOku, firmaYaz, musteriler, teklifEkle, teklifGetir, teklifGuncelle, teklifListesi, teklifOku, teklifSil } from './db'

export async function teklifRotalari(app: FastifyInstance) {
  const yok = { hata: 'Teklif bulunamadı' }
  type Kimlik = { Params: { id: string } }

  app.get('/api/teklifler', () => teklifListesi())
  app.get('/api/musteriler', () => musteriler())
  app.post('/api/teklifler', (istek) => ({ id: teklifEkle(teklifOku(istek.body)) }))

  app.get<Kimlik>('/api/teklifler/:id', (istek, yanit) => teklifGetir(Number(istek.params.id)) ?? yanit.code(404).send(yok))
  app.put<Kimlik>('/api/teklifler/:id', (istek, yanit) =>
    teklifGuncelle(Number(istek.params.id), teklifOku(istek.body)) ? { tamam: true } : yanit.code(404).send(yok),
  )
  app.delete<Kimlik>('/api/teklifler/:id', (istek, yanit) => (teklifSil(Number(istek.params.id)) ? { tamam: true } : yanit.code(404).send(yok)))

  app.get<Kimlik>('/api/teklifler/:id/metin', (istek, yanit) => {
    const t = teklifGetir(Number(istek.params.id))
    return t ? { metin: teklifMetni(t), telefon: t.musteriTelefon } : yanit.code(404).send(yok)
  })

  app.get<Kimlik>('/api/teklifler/:id/pdf', async (istek, yanit) => {
    const t = teklifGetir(Number(istek.params.id))
    if (!t) return yanit.code(404).send(yok)
    return yanit
      .type('application/pdf')
      .header('Content-Disposition', `inline; filename="Teklif-${t.no}.pdf"`)
      .send(await teklifPdf(t))
  })

  // --- Firma bilgileri ve logo (PDF başlığında kullanılır) ---
  app.get('/api/ayarlar', () => ({ ...firmaOku(), logoVar: existsSync(logoYolu()) }))
  app.put('/api/ayarlar', (istek) => firmaYaz(istek.body))
  app.put('/api/ayarlar/logo', async (istek, yanit) => {
    if (!Buffer.isBuffer(istek.body) || istek.body.length === 0) return yanit.code(400).send({ hata: 'Logo dosyası gönderilmedi' })
    try {
      await logoKaydet(istek.body)
      return { tamam: true }
    } catch {
      return yanit.code(400).send({ hata: 'Dosya görsel olarak okunamadı' })
    }
  })
  app.get('/logo', (_istek, yanit) =>
    existsSync(logoYolu()) ? yanit.type('image/png').header('Cache-Control', 'no-cache').send(createReadStream(logoYolu())) : yanit.code(404).send(),
  )
}
