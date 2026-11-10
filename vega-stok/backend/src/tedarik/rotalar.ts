import type { FastifyInstance } from 'fastify'
import { GirdiHatasi } from '../girdi'
import { urunGetir, urunVarMi } from '../yerel/db'
import {
  acikSiparisler, kritikEsikAyarla, kritikStok, siparisEkle, siparisGuncelle, siparisSil, siparisTeslim, tedarikciler, urunSiparisleri,
} from './db'

/** İstek gövdesinden sipariş alanlarını doğrulayarak okur. */
function siparisOku(govde: unknown) {
  const g = (govde ?? {}) as Record<string, unknown>
  const tedarikci = typeof g.tedarikci === 'string' ? g.tedarikci.trim() : ''
  const miktar = Number(g.miktar)
  const termin = g.termin == null || g.termin === '' ? null : String(g.termin)
  if (!tedarikci || tedarikci.length > 100) throw new GirdiHatasi('Tedarikçi adı gerekli')
  if (!Number.isFinite(miktar) || miktar <= 0) throw new GirdiHatasi('Miktar sıfırdan büyük olmalı')
  if (termin !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(termin) || Number.isNaN(Date.parse(termin)))) throw new GirdiHatasi('Termin tarihi geçersiz')
  return { tedarikci, miktar, termin }
}

export async function tedarikRotalari(app: FastifyInstance) {
  app.get('/api/kritik-stok', () => kritikStok())
  app.get('/api/siparisler', () => acikSiparisler())
  app.get('/api/tedarikciler', () => tedarikciler())

  app.get<{ Params: { id: string } }>('/api/urunler/:id', (istek, yanit) => {
    const urun = urunGetir(Number(istek.params.id))
    return urun ? { ...urun, siparisler: urunSiparisleri(Number(istek.params.id)) } : yanit.code(404).send({ hata: 'Ürün bulunamadı' })
  })

  app.put<{ Params: { id: string } }>('/api/urunler/:id/kritik-esik', (istek, yanit) => {
    const id = Number(istek.params.id)
    if (!urunVarMi(id)) return yanit.code(404).send({ hata: 'Ürün bulunamadı' })
    const ham = (istek.body as { esik?: unknown } | null)?.esik
    const esik = ham == null || ham === '' ? null : Number(ham)
    if (esik !== null && (!Number.isFinite(esik) || esik < 0)) throw new GirdiHatasi('Kritik eşik geçersiz')
    kritikEsikAyarla(id, esik)
    return { tamam: true }
  })

  app.post('/api/siparisler', (istek, yanit) => {
    const urunId = Number((istek.body as { urunId?: unknown } | null)?.urunId)
    if (!urunVarMi(urunId)) return yanit.code(404).send({ hata: 'Ürün bulunamadı' })
    return { id: siparisEkle({ urunId, ...siparisOku(istek.body) }) }
  })

  const bulunamadi = { hata: 'Açık sipariş bulunamadı' }
  app.put<{ Params: { id: string } }>('/api/siparisler/:id', (istek, yanit) =>
    siparisGuncelle(Number(istek.params.id), siparisOku(istek.body)) ? { tamam: true } : yanit.code(404).send(bulunamadi),
  )
  app.post<{ Params: { id: string } }>('/api/siparisler/:id/teslim', (istek, yanit) =>
    siparisTeslim(Number(istek.params.id)) ? { tamam: true } : yanit.code(404).send(bulunamadi),
  )
  app.delete<{ Params: { id: string } }>('/api/siparisler/:id', (istek, yanit) =>
    siparisSil(Number(istek.params.id)) ? { tamam: true } : yanit.code(404).send(bulunamadi),
  )
}
